'use strict';
// This entry point ONLY qualifies measurement capability. No actual-app search,
// paired comparison, browser retry, or production operation exists here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('./measurement.cjs');
const LIMITS=Object.freeze({criterionMs:250,intervalMs:100,idleSamples:10,loadMs:8000,loadObserveMs:8300,postSamples:3,maxSamples:110,maxProcesses:128,requestTimeoutMs:2000,closeTimeoutMs:2000,maxWallMs:30000});
const hostNow=()=>Number(process.hrtime.bigint())/1e6;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const brief=e=>String(e?.message||e).slice(0,600);
async function deadline(fn,ms,label){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out; no retry')),ms);})]);}finally{clearTimeout(timer);}}
function processRows(info){
 if(!Array.isArray(info)||!info.length||info.length>LIMITS.maxProcesses)throw Error('CPU process-list missing or cap exceeded');
 const seen=new Set();return info.map(p=>{const id=String(p.id);if(!/^[0-9]{1,20}$/.test(id)||seen.has(id)||typeof p.type!=='string'||p.type.length>64||!Number.isFinite(p.cpuTime)||p.cpuTime<0)throw Error('Invalid, duplicate or oversized CPU process counter');seen.add(id);return{id,type:p.type,cpuTime:p.cpuTime};});
}
function compactWindow(w){const part=p=>p?{cpuSecondsLowerBound:p.cpuSecondsLowerBound,intervals:p.intervals,observedSpanMs:p.observedSpanMs,exitedProcessIds:p.exitedProcessIds,resetProcessIds:p.resetProcessIds}:null;return{qualified:w.qualified,reason:w.reason||null,maxGapMs:w.maxGapMs??null,maxAcquisitionMs:w.maxAcquisitionMs??null,bracketWidthsMs:w.bracketWidthsMs??null,incompleteAcquisition:!!w.incompleteAcquisition,inner:part(w.inner),outer:part(w.outer)};}
async function runPreflight({adapter,writer,now=hostNow,wait=sleep}){
 const start=now(),samples=[],summary={schema:'promotion-cpu-capability-v1',kind:'generic-worker-load-capability-only',pass:false,criterionMs:250,actualAppQualified:false,actualComparisonsStarted:0,phase:'starting',failure:null,shutdown:{detached:false,closed:false},limits:LIMITS};
 let failed=null,everPending=false,acquisitionPending=false;
 const guard=()=>{if(now()-start>LIMITS.maxWallMs)throw Error('Preflight whole-work budget exceeded');};
 const record=row=>{if(writer.append(row)!==true)throw Error('Bounded raw recording failed: '+writer.stats().reason);};
 const call=(fn,label)=>{guard();return deadline(fn,LIMITS.requestTimeoutMs,label);};
 async function acquire(phase){
  guard();if(samples.length>=LIMITS.maxSamples)throw Error('CPU sample cap exceeded');
  const a=now();acquisitionPending=true;
  const info=await call(()=>adapter.getProcesses(),'CPU acquisition');
  const b=now();acquisitionPending=false;const row={phase,start:a,end:b,processes:processRows(info)};
  samples.push(row);record({type:'sample',...row});
  if(b<a||b-a>250)throw Error('CPU acquisition exceeds fixed 250 ms criterion');
  if(samples.length>1&&a-samples.at(-2).end>250)throw Error('CPU sampling gap exceeds fixed 250 ms criterion');
  return row;
 }
 async function poll(phase){const a=now();await acquire(phase);await wait(Math.max(0,LIMITS.intervalMs-(now()-a)));}
 try{
  if(writer.stats().failures)throw Error('Raw recording unavailable');
  summary.browser=await call(()=>adapter.metadata(),'Browser metadata');record({type:'metadata',browser:summary.browser});
  summary.clockBefore=await M.calibrate({readPageEpoch:()=>call(()=>adapter.pageEpoch(),'Clock calibration'),now,rounds:5});
  summary.phase='idle';for(let i=0;i<LIMITS.idleSamples;i++)await poll('idle');
  const idle=samples.slice();if(idle.some((s,i)=>i&&s.start-idle[i-1].end>250))throw Error('Idle sampling gap exceeds fixed 250 ms criterion');
  summary.phase='load';const load=await call(()=>adapter.startLoad(LIMITS.loadMs),'Start generic worker load');
  if(!Number.isInteger(load.workers)||load.workers<1||load.workers>4||!Number.isFinite(load.startEpoch))throw Error('Invalid generic load start receipt');
  summary.load={workers:load.workers,durationRequestedMs:LIMITS.loadMs,description:'10 ms numerical work / 30 ms yield, at most 4 generic workers; not Rapier or app search'};
  const observe=now();while(now()-observe<LIMITS.loadObserveMs)await poll('load');
  const end=await call(()=>adapter.loadWindow(),'Load endpoint');
  if(!Number.isFinite(end.startEpoch)||!Number.isFinite(end.endEpoch)||end.startEpoch!==load.startEpoch||end.endEpoch-end.startEpoch<LIMITS.loadMs||end.endEpoch-end.startEpoch>LIMITS.loadMs+250||end.workersRemaining!==0)throw Error('Missing, delayed or inconsistent load endpoint');
  summary.load.observedPageMs=end.endEpoch-end.startEpoch;summary.load.startEpoch=end.startEpoch;summary.load.endEpoch=end.endEpoch;summary.load.workersRemaining=end.workersRemaining;
  summary.phase='post';for(let i=0;i<LIMITS.postSamples;i++)await poll('post');
  summary.clockAfter=await M.calibrate({readPageEpoch:()=>call(()=>adapter.pageEpoch(),'Clock calibration'),now,rounds:5});
  const clock=M.clockEnvelope(summary.clockBefore,summary.clockAfter),window=M.windowEvidence(samples,end.startEpoch,end.endEpoch,clock);
  summary.clockEnvelope={low:clock.low,high:clock.high,width:clock.width,qualified:clock.qualified,driftIntervalMs:clock.driftIntervalMs};summary.window=compactWindow(window);
  const diagnostics={exits:new Set(),newIds:new Set(),resets:new Set(),invalidCounters:new Set()};
  for(let i=1;i<samples.length;i++){const d=M.processDelta(samples[i-1],samples[i]);for(const key of Object.keys(diagnostics))for(const id of d[key])diagnostics[key].add(id);}
  summary.processDiagnostics=Object.fromEntries(Object.entries(diagnostics).map(([k,v])=>[k,[...v]]));
  if(!window.qualified)throw Error('Loaded CPU window failed unchanged 250 ms qualification');
  summary.phase='qualified-before-cleanup';
 }catch(e){failed=brief(e);everPending=acquisitionPending;}
 finally{
  // No replacement query follows a timeout. A transport detach and owned
  // browser close are the only teardown actions; both are independently bounded.
  try{await deadline(()=>adapter.detach(),LIMITS.closeTimeoutMs,'CDP detach');summary.shutdown.detached=true;}catch(e){summary.shutdown.detachError=brief(e);failed=failed||summary.shutdown.detachError;}
  try{await deadline(()=>adapter.close(),LIMITS.closeTimeoutMs,'Browser close');summary.shutdown.closed=true;}catch(e){summary.shutdown.closeError=brief(e);failed=failed||summary.shutdown.closeError;}
  try{writer.close();}catch(e){failed=failed||brief(e);}
  summary.recording=writer.stats();if(!summary.recording.complete)failed=failed||'Recording incomplete';
  summary.sampleCount=samples.length;summary.acquisitionPendingAtFailure=everPending;summary.wallMs=now()-start;
  if(summary.wallMs>LIMITS.maxWallMs)failed=failed||'Preflight whole-work budget exceeded';
  summary.failure=failed;summary.pass=!failed&&summary.window?.qualified===true&&summary.shutdown.detached&&summary.shutdown.closed&&summary.recording.complete;
  summary.phase=summary.pass?'capability-qualified':'failed';
  summary.limitsAndCaveats=['Capability pass is not actual-app or paired-CPU qualification.','CPU values are observed shared-process lower bounds, not total CPU savings.','Exited-process final increments and same-type PID reuse can remain unknown.','No actual comparison is started even on a pass.'];
 }
 return summary;
}
async function realAdapter(){
 // Loaded only by explicit CLI execution, never by local contract tests.
 const {chromium}=require('playwright');let browser,context,page,cdp;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,timeout:10000});
  context=await deadline(()=>browser.newContext({viewport:{width:1280,height:850}}),2000,'Context creation');
  page=await deadline(()=>context.newPage(),2000,'Page creation');
  await deadline(()=>page.goto('about:blank'),2000,'Blank page');
  cdp=await deadline(()=>browser.newBrowserCDPSession(),2000,'Independent browser CDP session');
 }catch(e){if(browser)await deadline(()=>browser.close(),2000,'Startup cleanup').catch(()=>{});throw e;}
 return{
  async metadata(){const v=await cdp.send('Browser.getVersion');const pick=k=>{if(typeof v[k]!=='string'||v[k].length>256)throw Error('Invalid browser version field');return v[k];};return{product:pick('product'),revision:pick('revision'),jsVersion:pick('jsVersion'),protocolVersion:pick('protocolVersion')};},
  async getProcesses(){return(await cdp.send('SystemInfo.getProcessInfo')).processInfo;},
  pageEpoch:()=>page.evaluate(()=>performance.timeOrigin+performance.now()),
  startLoad:durationMs=>page.evaluate(async ms=>{
   const n=Math.max(1,Math.min(4,navigator.hardwareConcurrency||2));
   const source='let running=false,x=1;function tick(){if(!running)return;const end=performance.now()+10;while(performance.now()<end)x=Math.sqrt(x+123.456);setTimeout(tick,30)};onmessage=e=>{if(e.data==="start"){running=true;tick()}};postMessage("ready")';
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),workers=[];
   try{await Promise.all(Array.from({length:n},()=>new Promise((resolve,reject)=>{const w=new Worker(url);workers.push(w);w.onmessage=e=>{if(e.data==='ready')resolve();};w.onerror=()=>reject(Error('Generic worker failed'));})));}
   finally{URL.revokeObjectURL(url);}
   const startEpoch=performance.timeOrigin+performance.now();globalThis.__cpuPreflight={startEpoch,endEpoch:null,workersRemaining:n};
   for(const w of workers)w.postMessage('start');
   setTimeout(()=>{for(const w of workers)w.terminate();globalThis.__cpuPreflight.endEpoch=performance.timeOrigin+performance.now();globalThis.__cpuPreflight.workersRemaining=0;},ms);
   return{startEpoch,workers:n};
  },durationMs),
  loadWindow:()=>page.evaluate(()=>({...globalThis.__cpuPreflight})),
  detach:()=>cdp.detach(),close:()=>browser.close()
 };
}
async function main(){
 const {createWriter,writeSummary}=require('./bounded-records.cjs');
 const out=path.resolve(process.env.OUT_DIR||'cpu-preflight-results');fs.mkdirSync(out,{recursive:false});
 const raw=path.join(out,'samples.ndjson');let writer,summary;
 try{writer=createWriter(raw,{maxBytes:1048576,maxRecords:128,maxLineBytes:32768});if(writer.stats().failures)throw Error('Raw output unavailable before browser launch');const adapter=await realAdapter();summary=await runPreflight({adapter,writer});}
 catch(e){try{writer?.close();}catch{}summary={schema:'promotion-cpu-capability-v1',pass:false,criterionMs:250,actualAppQualified:false,actualComparisonsStarted:0,phase:'startup-failed',failure:brief(e),recording:writer?.stats()||null};}
 summary.source={gitCommit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,measurementSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'measurement.cjs'))).digest('hex')};
 if(fs.existsSync(raw)){const stat=fs.statSync(raw);if(stat.size<=1048576)summary.rawSHA256=crypto.createHash('sha256').update(fs.readFileSync(raw)).digest('hex');else{summary.pass=false;summary.failure='Raw file exceeded declared limit';}}
 const saved=writeSummary(path.join(out,'summary.json'),summary,writer,{maxBytes:65536,maxLineBytes:65536,maxStringLength:1024,maxArrayLength:256,maxObjectKeys:64,maxNodes:2048,maxDepth:12});
 if(!saved.complete||!saved.pass){summary.pass=false;summary.failure=summary.failure||saved.summaryFailure||saved.reason||'Summary could not be saved completely';}
 console.log(JSON.stringify({kind:summary.schema,pass:summary.pass,samples:summary.sampleCount||0,failure:summary.failure||null,actualComparisonsStarted:0}));
 return summary.pass?0:2;
}
module.exports={LIMITS,deadline,processRows,compactWindow,runPreflight};
if(require.main===module)main().then(code=>{process.exitCode=code;},e=>{console.error('CPU preflight fatal: '+brief(e));process.exitCode=2;});
