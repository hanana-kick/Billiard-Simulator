'use strict';
// Prepared follow-on only. Requiring this module never loads Playwright or opens
// a socket. Main requires independently verified, CI-bound preflight evidence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const support=fs.existsSync(path.join(__dirname,'measurement.cjs'))?__dirname:path.resolve(__dirname,'../payload-early-assembled/verification/promotion-stop-corrected');
const auditFile=path.join(support,'audit.js');
const measurement=require(path.join(support,'measurement.cjs'));
const records=require(path.join(support,'bounded-records.cjs'));
const {createCaptureStore,createAuditEventDecoder}=require(auditFile);
const hostNow=()=>Number(process.hrtime.bigint())/1e6;
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
async function deadline(work,ms,label){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out; no replacement query')),ms);})]);}finally{clearTimeout(timer);}}
const RAW_LIMITS={maxBytes:64*1024*1024,maxRecords:65536,maxLineBytes:32768,maxStringChars:8192,maxStringBytes:32768,maxArrayLength:4096,maxObjectKeys:256,maxNodes:65536,maxDepth:32};
const SUMMARY_LIMITS={...RAW_LIMITS,maxBytes:262144,maxLineBytes:262144,maxStringChars:16384,maxStringBytes:32768};
const FUNCTIONAL_MODE='functional-with-separate-cpu';
const TIMING_ONLY_FAILURE='Loaded CPU window failed unchanged 250 ms qualification';
function preflightMode(env=process.env,options={}){
 const mode=options.mode??env.VALIDATION_MODE??'strict';
 assert(['strict',FUNCTIONAL_MODE].includes(mode),'Unknown VALIDATION_MODE; gate remains closed');
 return mode;
}
function exactKeys(value,keys,label){assert(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),label+' schema mismatch');}
// Only these two producer throws happen after a finite, fully recorded query.
// Unknown failures, timeouts, partial records and failed cleanup never enter here.
const EARLY_CPU_FAILURES=Object.freeze(['CPU acquisition exceeds fixed 250 ms criterion','CPU sampling gap exceeds fixed 250 ms criterion']);
function inspectEarlyPreflight(s,buffer,env,mode){
 const {LIMITS,STARTUP,processRows}=require(path.join(support,'cpu-preflight.cjs'));
 const gate=require(path.join(support,'check-preflight.cjs'));
 assert(['strict',FUNCTIONAL_MODE].includes(mode),'Unknown early preflight mode');
 assert.equal(hash(fs.readFileSync(path.join(support,'cpu-preflight.cjs'),'utf8')),'72212677b1cb59b6a4b6d4b07ec8c6ffcfa03a130485bf9738cd040327af62d1','Early preflight producer changed');
 assert.equal(s.schema,'promotion-cpu-capability-v1','Wrong early preflight schema');
 assert.equal(s.kind,'generic-worker-load-capability-only','Wrong early preflight scope');
 assert(s.pass===false&&s.phase==='failed'&&EARLY_CPU_FAILURES.includes(s.failure),'Unknown early preflight failure');
 assert.equal(s.criterionMs,250,'Early criterion changed');assert.deepEqual(s.limits,LIMITS,'Early preflight limits changed');
 assert(s.actualAppQualified===false&&s.actualComparisonsStarted===0,'Invalid early preflight scope');
 exactKeys(s.source,['gitCommit','runId','runAttempt','measurementSHA256'],'Early source');
 assert.equal(s.source.gitCommit,env.GITHUB_SHA,'Early commit mismatch');assert.equal(s.source.runId,env.GITHUB_RUN_ID,'Early run mismatch');assert.equal(s.source.runAttempt,env.GITHUB_RUN_ATTEMPT,'Early attempt mismatch');assert.equal(s.source.measurementSHA256,gate.MEASUREMENT_SHA256,'Early measurement source mismatch');
 exactKeys(s.shutdown,['detached','closed'],'Early shutdown');assert(s.shutdown.detached===true&&s.shutdown.closed===true,'Early cleanup incomplete');
 const stages=['Chrome launch','Context creation','Page creation','Blank page','Independent browser CDP session'];
 assert(Array.isArray(s.startupTiming)&&s.startupTiming.length===stages.length,'Early startup incomplete');let startupMs=0;
 s.startupTiming.forEach((v,i)=>{exactKeys(v,['stage','ms','completed'],'Early startup stage');assert(v.stage===stages[i]&&v.completed===true&&Number.isFinite(v.ms)&&v.ms>=0&&v.ms<=(i===0?STARTUP.launchMs:STARTUP.stepMs),'Early startup failed or over budget');startupMs+=v.ms;});assert(startupMs<=STARTUP.totalMs,'Early startup total exceeded');
 exactKeys(s.browser,['product','revision','jsVersion','protocolVersion'],'Early browser');for(const v of Object.values(s.browser))assert(typeof v==='string'&&v.length>0&&v.length<=256,'Invalid early browser metadata');assert(/^Chrome\//.test(s.browser.product),'Early browser is not Chrome');
 exactKeys(s.recording,['complete','bytes','records','failures','reason','closed'],'Early recording');
 assert(s.recording.complete===true&&s.recording.closed===true&&s.recording.failures===0&&s.recording.reason===null,'Early raw recording incomplete');
 assert(Number.isInteger(s.sampleCount)&&s.sampleCount>=1&&s.sampleCount<=LIMITS.maxSamples&&s.recording.records===s.sampleCount+1,'Early record count mismatch');
 assert(Number.isSafeInteger(s.recording.bytes)&&s.recording.bytes>0&&s.recording.bytes<=1048576,'Early raw size invalid');
 assert(s.acquisitionPendingAtFailure===false,'Early acquisition still pending');assert(Number.isFinite(s.wallMs)&&s.wallMs>=0&&s.wallMs<=LIMITS.maxWallMs,'Early work budget exceeded');
 assert(typeof s.rawSHA256==='string'&&/^[a-f0-9]{64}$/.test(s.rawSHA256),'Early raw digest missing');
 assert(Buffer.isBuffer(buffer)&&buffer.length===s.recording.bytes&&buffer.length<=1048576,'Early raw byte mismatch');assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),s.rawSHA256,'Early raw digest mismatch');
 const text=buffer.toString('utf8');assert(Buffer.from(text,'utf8').equals(buffer),'Early raw invalid UTF-8');const lines=text.split('\n');assert.equal(lines.pop(),'','Early raw missing newline');assert.equal(lines.length,s.recording.records,'Early raw record count mismatch');
 const rows=lines.map(line=>{assert(Buffer.byteLength(line)+1<=32768,'Early raw oversized record');const row=JSON.parse(line);records.encodeBounded(row,{maxLineBytes:32768,maxNodes:2048,maxArrayLength:128,maxObjectKeys:8,maxDepth:5,maxStringChars:256,maxStringBytes:1024});return row;});
 exactKeys(rows[0],['type','browser'],'Early raw metadata');assert.equal(rows[0].type,'metadata','Early raw metadata missing');assert.deepEqual(rows[0].browser,s.browser,'Early browser raw mismatch');
 const samples=rows.slice(1),phases=['idle','load','post'],counts=[0,0,0];let phase=0;
 for(let i=0;i<samples.length;i++){
  const x=samples[i];exactKeys(x,['type','phase','start','end','processes'],'Early raw sample');const p=phases.indexOf(x.phase);
  assert(x.type==='sample'&&p>=phase&&p<=phase+1&&p<=1&&(i!==0||p===0),'Early sample phase order');phase=p;counts[p]++;
  assert(Number.isFinite(x.start)&&x.start>=0&&Number.isFinite(x.end)&&x.end>=x.start&&x.end-x.start<=LIMITS.requestTimeoutMs,'Early query not finite within request budget');
  if(i)assert(x.start>=samples[i-1].end,'Early queries overlap');
  processRows(x.processes);for(const process of x.processes){exactKeys(process,['id','type','cpuTime'],'Early process counter');assert(typeof process.id==='string','Early process ID schema');}
  // The producer aborts immediately after the FIRST failed acquisition or gap.
  if(i<samples.length-1){assert(x.end-x.start<=250,'Earlier acquisition already failed');if(i)assert(x.start-samples[i-1].end<=250,'Earlier sampling gap already failed');}
 }
 const last=samples.at(-1),lastWidth=last.end-last.start,lastGap=samples.length>1?last.start-samples.at(-2).end:null;
 const expectedFailure=lastWidth>250?EARLY_CPU_FAILURES[0]:lastGap!==null&&lastGap>250?EARLY_CPU_FAILURES[1]:null;
 assert(expectedFailure&&s.failure===expectedFailure,'Early failure does not match first terminal timing breach');
 // Only idle/load aborts are admitted. Post needs endpoint/clock evidence
 // absent at this throw, so it remains closed even in functional mode.
 // These are exact producer prefixes, not a full-schema object with holes.
 assert(counts[0]>=1&&counts[0]<=10&&counts[2]<=3,'Early phase counts invalid');
 if(phase>=1)assert(counts[0]===10&&counts[1]>=1,'Early load lacks complete idle prefix');
 const keys=['schema','kind','pass','criterionMs','actualAppQualified','actualComparisonsStarted','phase','failure','shutdown','limits','startupTiming','browser','clockBefore','recording','sampleCount','acquisitionPendingAtFailure','wallMs','limitsAndCaveats','source','rawSHA256'];if(phase>=1)keys.push('load');exactKeys(s,keys,'Early producer summary prefix');
 exactKeys(s.clockBefore,['rounds','best'],'Early calibration');const rounds=s.clockBefore.rounds;assert(Array.isArray(rounds)&&rounds.length===5,'Early calibration rounds missing');
 for(let i=0;i<rounds.length;i++){const r=rounds[i];exactKeys(r,['start','end','pageEpoch','low','high','width'],'Early calibration round');assert(Object.values(r).every(Number.isFinite)&&r.start>=0&&r.end>=r.start&&r.end-r.start<=LIMITS.requestTimeoutMs&&r.width===r.end-r.start&&r.low===r.pageEpoch-r.end&&r.high===r.pageEpoch-r.start,'Early calibration invalid or over request budget');if(i)assert(r.start>=rounds[i-1].end,'Early calibration overlaps');}
 assert.deepEqual(s.clockBefore.best,rounds.reduce((a,b)=>!a||b.width<a.width?b:a,null),'Early calibration best mismatch');assert(rounds.at(-1).end<=samples[0].start,'Early calibration not before samples');
 assert(s.wallMs>=last.end-rounds[0].start,'Early wall time shorter than recorded trace');
 if(phase>=1){
  exactKeys(s.load,['workers','durationRequestedMs','description'],'Early load prefix');
  assert(Number.isInteger(s.load.workers)&&s.load.workers>=1&&s.load.workers<=4&&s.load.durationRequestedMs===8000,'Early load metadata invalid');assert.equal(s.load.description,'10 ms numerical work / 30 ms yield, at most 4 generic workers; not Rapier or app search','Early load description changed');
  const loaded=samples.filter(x=>x.phase==='load');
  // observe lies after idle and no later than the first load query. A next
  // loop iteration can exist only if its preceding query ended before
  // observe + 8300. Do not invent a bound from the loop guard to acquisition.
  if(loaded.length>=2)assert(loaded.at(-2).end<loaded[0].start+LIMITS.loadObserveMs,'Early load contradicts producer observation loop');

 }
 assert.deepEqual(s.limitsAndCaveats,['Capability pass is not actual-app or paired-CPU qualification.','CPU values are observed shared-process lower bounds, not total CPU savings.','Exited-process final increments and same-type PID reuse can remain unknown.','No actual comparison is started even on a pass.'],'Early scope caveats changed');
 const failedCriteria=[['acquisition',lastWidth],['gap',lastGap]].filter(([,v])=>v!==null&&v>250).map(([criterion,valueMs])=>({criterion,valueMs,limitMs:250}));
 return{schema:'promotion-preflight-inspection-v1',mode,evidenceValid:true,functionalReady:mode===FUNCTIONAL_MODE,cpuQualified:false,capabilityQualified:false,actualAppQualified:false,actualComparisonsStarted:0,preflightPass:false,preflightPhase:s.phase,preflightFailure:s.failure,cpuTimingOnlyFailure:true,failedCriteria,criterionMs:250,sampleCount:s.sampleCount,commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,rawSHA256:s.rawSHA256,capabilityEvidence:{complete:false,kind:'finite-completed-timing-abort-prefix',terminalPhase:last.phase,phaseCounts:counts,terminalSampleIndex:s.sampleCount-1,finalAcquisitionMs:lastWidth,finalGapMs:lastGap,loadEndpointObserved:false,clockAfterObserved:false,windowObserved:false},scope:'Partial generic capability evidence only; CPU failed, not qualified. Functional opt-in never qualifies an actual 8-second window, which retains its independent unchanged 250 ms proof.'};
}

function inspectPreflight(env=process.env,options={}){
 const mode=preflightMode(env,options),gate=require(path.join(support,'check-preflight.cjs')),{LIMITS,STARTUP,processRows,compactWindow}=require(path.join(support,'cpu-preflight.cjs'));
 for(const key of ['PREFLIGHT_SUMMARY','PREFLIGHT_RAW','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])assert(env[key],`Missing ${key}; actual-app gate remains closed`);
 assert(/^[a-f0-9]{40,64}$/.test(env.GITHUB_SHA)&&/^[0-9]{1,24}$/.test(env.GITHUB_RUN_ID)&&/^[1-9][0-9]{0,8}$/.test(env.GITHUB_RUN_ATTEMPT),'Invalid CI source binding');
 assert.equal(hash(fs.readFileSync(path.join(support,'measurement.cjs'),'utf8')),gate.MEASUREMENT_SHA256,'Measurement source changed');
 const s=gate.readSummary(env.PREFLIGHT_SUMMARY);
 records.encodeBounded(s,{maxBytes:65536,maxLineBytes:65536,maxStringChars:1024,maxStringBytes:4096,maxArrayLength:256,maxObjectKeys:64,maxNodes:2048,maxDepth:12});
 if(EARLY_CPU_FAILURES.includes(s.failure)){const stat=fs.statSync(env.PREFLIGHT_RAW);assert(stat.isFile()&&stat.size<=1048576,'Early preflight raw size exceeds limit');return inspectEarlyPreflight(s,fs.readFileSync(env.PREFLIGHT_RAW),env,mode);}
 exactKeys(s,['schema','kind','pass','criterionMs','actualAppQualified','actualComparisonsStarted','phase','failure','shutdown','limits','startupTiming','browser','clockBefore','load','clockAfter','clockEnvelope','window','processDiagnostics','recording','sampleCount','acquisitionPendingAtFailure','wallMs','limitsAndCaveats','source','rawSHA256'],'Preflight summary');
 assert.equal(s.schema,'promotion-cpu-capability-v1','Wrong preflight schema');
 assert.equal(s.kind,'generic-worker-load-capability-only','Wrong preflight scope');
 assert.equal(s.criterionMs,250,'Criterion changed');assert.deepEqual(s.limits,LIMITS,'Preflight limits changed');
 assert.equal(s.actualAppQualified,false,'Preflight cannot qualify actual app');assert.equal(s.actualComparisonsStarted,0,'Preflight started actual comparisons');
 exactKeys(s.source,['gitCommit','runId','runAttempt','measurementSHA256'],'Source');
 assert.equal(s.source.gitCommit,env.GITHUB_SHA,'Commit mismatch');assert.equal(s.source.runId,env.GITHUB_RUN_ID,'Run mismatch');assert.equal(s.source.runAttempt,env.GITHUB_RUN_ATTEMPT,'Attempt mismatch');assert.equal(s.source.measurementSHA256,gate.MEASUREMENT_SHA256,'Measurement source mismatch');
 exactKeys(s.shutdown,['detached','closed'],'Shutdown');assert(s.shutdown.detached===true&&s.shutdown.closed===true,'Cleanup incomplete');
 const stages=['Chrome launch','Context creation','Page creation','Blank page','Independent browser CDP session'];
 assert(Array.isArray(s.startupTiming)&&s.startupTiming.length===stages.length,'Startup metadata incomplete');let startupMs=0;
 s.startupTiming.forEach((v,i)=>{exactKeys(v,['stage','ms','completed'],'Startup stage');assert(v.stage===stages[i]&&v.completed===true&&Number.isFinite(v.ms)&&v.ms>=0&&v.ms<=(i===0?STARTUP.launchMs:STARTUP.stepMs),'Startup failed or exceeded budget');startupMs+=v.ms;});assert(startupMs<=STARTUP.totalMs,'Startup total budget exceeded');
 exactKeys(s.browser,['product','revision','jsVersion','protocolVersion'],'Browser metadata');for(const value of Object.values(s.browser))assert(typeof value==='string'&&value.length>0&&value.length<=256,'Invalid browser metadata');assert(/^Chrome\//.test(s.browser.product),'Not Chrome');
 exactKeys(s.recording,['complete','bytes','records','failures','reason','closed'],'Recording');
 assert(s.recording.complete===true&&s.recording.closed===true&&s.recording.failures===0&&s.recording.reason===null,'Raw records incomplete');
 assert(Number.isInteger(s.sampleCount)&&s.sampleCount>=15&&s.sampleCount<=LIMITS.maxSamples&&s.recording.records===s.sampleCount+1,'Invalid record count');
 assert(Number.isSafeInteger(s.recording.bytes)&&s.recording.bytes>0&&s.recording.bytes<=1048576,'Invalid raw byte count');
 assert(s.acquisitionPendingAtFailure===false,'Unfinished acquisition');assert(Number.isFinite(s.wallMs)&&s.wallMs>=0&&s.wallMs<=LIMITS.maxWallMs,'Work budget exceeded');
 assert(typeof s.rawSHA256==='string'&&/^[a-f0-9]{64}$/.test(s.rawSHA256),'Missing raw digest');
 const stat=fs.statSync(env.PREFLIGHT_RAW);assert(stat.isFile()&&stat.size<=1048576,'Preflight raw size exceeds limit');const buffer=fs.readFileSync(env.PREFLIGHT_RAW);
 assert.equal(buffer.length,s.recording.bytes,'Raw byte count mismatch');assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),s.rawSHA256,'Raw digest mismatch');
 const text=buffer.toString('utf8');assert(Buffer.from(text,'utf8').equals(buffer),'Invalid raw UTF-8');const lines=text.split('\n');assert.equal(lines.pop(),'','Missing final newline');assert.equal(lines.length,s.recording.records,'Raw record count mismatch');
 const rows=lines.map(line=>{assert(Buffer.byteLength(line)+1<=32768,'Oversized raw record');const row=JSON.parse(line);records.encodeBounded(row,{maxLineBytes:32768,maxNodes:2048,maxArrayLength:128,maxObjectKeys:8,maxDepth:5,maxStringChars:256,maxStringBytes:1024});return row;});
 exactKeys(rows[0],['type','browser'],'Raw metadata');assert.equal(rows[0].type,'metadata','Missing metadata');assert.deepEqual(rows[0].browser,s.browser,'Browser metadata mismatch');
 const samples=rows.slice(1),phases=['idle','load','post'],counts=[0,0,0];let phase=0;
 for(let i=0;i<samples.length;i++){
  const x=samples[i];exactKeys(x,['type','phase','start','end','processes'],'Raw sample');const p=phases.indexOf(x.phase);assert(x.type==='sample'&&p>=phase&&p<=phase+1,'Sample phase order');phase=p;counts[p]++;
  assert(Number.isFinite(x.start)&&x.start>=0&&Number.isFinite(x.end)&&x.end>=x.start&&x.end-x.start<=250,'Invalid or over-budget acquisition bracket');if(i)assert(x.start>=samples[i-1].end&&x.start-samples[i-1].end<=250,'Overlapping CPU requests or sampling gap');
  processRows(x.processes);for(const process of x.processes){exactKeys(process,['id','type','cpuTime'],'Process counter');assert(typeof process.id==='string','Process ID must use the recorded string schema');}
 }
 assert(counts[0]===LIMITS.idleSamples&&counts[1]>=2&&counts[2]===LIMITS.postSamples,'Incomplete sample phases');
 function calibration(c){
  exactKeys(c,['rounds','best'],'Calibration');assert(Array.isArray(c.rounds)&&c.rounds.length===5,'Missing calibration rounds');
  for(let i=0;i<c.rounds.length;i++){const r=c.rounds[i];exactKeys(r,['start','end','pageEpoch','low','high','width'],'Calibration round');assert(Object.values(r).every(Number.isFinite)&&r.start>=0&&r.end>=r.start&&r.width===r.end-r.start&&r.low===r.pageEpoch-r.end&&r.high===r.pageEpoch-r.start,'Invalid calibration');if(i)assert(r.start>=c.rounds[i-1].end,'Overlapping calibration rounds');}
  const best=c.rounds.reduce((a,b)=>!a||b.width<a.width?b:a,null);assert.deepEqual(c.best,best,'Calibration best mismatch');return c;
 }
 const before=calibration(s.clockBefore),after=calibration(s.clockAfter);assert(before.rounds.at(-1).end<=samples[0].start&&after.rounds[0].start>=samples.at(-1).end,'Calibration not outside observed samples');
 exactKeys(s.load,['workers','durationRequestedMs','description','observedPageMs','startEpoch','endEpoch','workersRemaining'],'Load');
 assert(Number.isInteger(s.load.workers)&&s.load.workers>=1&&s.load.workers<=4&&s.load.workersRemaining===0&&s.load.durationRequestedMs===8000,'Invalid load metadata');
 assert(Number.isFinite(s.load.startEpoch)&&Number.isFinite(s.load.endEpoch)&&s.load.endEpoch-s.load.startEpoch>=8000&&s.load.endEpoch-s.load.startEpoch<=8250&&s.load.observedPageMs===s.load.endEpoch-s.load.startEpoch,'Invalid load endpoint');
 assert.equal(s.load.description,'10 ms numerical work / 30 ms yield, at most 4 generic workers; not Rapier or app search','Load description changed');
 const clock=measurement.clockEnvelope(before,after);
 // Page receipts must be consistent with the actual producer's raw phases.
 // Use interval overlap, not full containment: clock uncertainty may straddle
 // a receipt boundary even when the real event obeyed the producer's order.
 const idle=samples.filter(x=>x.phase==='idle'),loaded=samples.filter(x=>x.phase==='load'),post=samples.filter(x=>x.phase==='post');
 const startHost=[s.load.startEpoch-clock.high,s.load.startEpoch-clock.low],endHost=[s.load.endEpoch-clock.high,s.load.endEpoch-clock.low];
 assert(startHost[1]>=idle.at(-1).end&&startHost[0]<=loaded[0].start,'Load start contradicts raw idle/load chronology');
 assert(endHost[0]<=post[0].start,'Load end contradicts raw post chronology');
 // observe is recorded by the producer before its first load acquisition and
 // after the load-start receipt. The loop exits only after 8,300 ms. Its exact
 // host instant is absent, so require a feasible interval, not an assumed
 // equality with firstLoad.start. The penultimate acquisition finishes before
 // the last loop guard, avoiding an invented guard-to-acquisition time bound.
 const observeLow=Math.max(idle.at(-1).end,startHost[0]),observeHigh=Math.min(loaded[0].start,post[0].start-LIMITS.loadObserveMs);
 assert(observeLow<=observeHigh&&loaded.at(-2).end<observeHigh+LIMITS.loadObserveMs,'Raw load observation contradicts 8300 ms producer loop');
 assert(s.wallMs>=after.rounds.at(-1).end-before.rounds[0].start,'Wall time shorter than recorded calibration/sample trace');
 const w=measurement.windowEvidence(samples,s.load.startEpoch,s.load.endEpoch,clock);
 assert.deepEqual(s.clockEnvelope,{low:clock.low,high:clock.high,width:clock.width,qualified:clock.qualified,driftIntervalMs:clock.driftIntervalMs},'Clock summary mismatch');assert.deepEqual(s.window,compactWindow(w),'Window summary mismatch');
 const finiteNonnegative=x=>Number.isFinite(x)&&x>=0;assert(w.reason===undefined&&w.incompleteAcquisition===false,'Incomplete window');assert([clock.width,w.maxGapMs,w.maxAcquisitionMs].every(finiteNonnegative)&&Array.isArray(w.bracketWidthsMs)&&w.bracketWidthsMs.length===2&&w.bracketWidthsMs.every(finiteNonnegative),'Missing timing evidence');
 for(const part of [w.inner,w.outer])assert(part&&finiteNonnegative(part.cpuSecondsLowerBound)&&Number.isInteger(part.intervals)&&part.intervals>=1&&part.intervals<=110&&Number.isFinite(part.observedSpanMs)&&part.observedSpanMs>0,'Missing lower-bound evidence');
 const diagnostics={exits:new Set(),newIds:new Set(),resets:new Set(),invalidCounters:new Set()};for(let i=1;i<samples.length;i++){const d=measurement.processDelta(samples[i-1],samples[i]);for(const key of Object.keys(diagnostics))for(const id of d[key])diagnostics[key].add(id);}assert.deepEqual(s.processDiagnostics,Object.fromEntries(Object.entries(diagnostics).map(([k,v])=>[k,[...v]])),'Process diagnostics mismatch');
 const failedCriteria=[['clock-width',clock.width],['acquisition',w.maxAcquisitionMs],['gap',w.maxGapMs],['start-bracket',w.bracketWidthsMs[0]],['end-bracket',w.bracketWidthsMs[1]]].filter(([,v])=>v>250).map(([criterion,valueMs])=>({criterion,valueMs,limitMs:250}));
 const cpuQualified=w.qualified===true;
 if(cpuQualified){assert(s.pass===true&&s.phase==='capability-qualified'&&s.failure===null,'Contradictory passing preflight verdict');gate.requireQualified(s,{commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT});gate.validateRaw(s,buffer);}
 else assert(s.pass===false&&s.phase==='failed'&&s.failure===TIMING_ONLY_FAILURE&&failedCriteria.length>0,'Unknown or non-timing preflight failure');
 assert(Array.isArray(s.limitsAndCaveats)&&s.limitsAndCaveats.length===4&&s.limitsAndCaveats.every(x=>typeof x==='string'),'Missing scope caveats');
 return {schema:'promotion-preflight-inspection-v1',mode,evidenceValid:true,functionalReady:cpuQualified||mode===FUNCTIONAL_MODE,cpuQualified,capabilityQualified:cpuQualified,actualAppQualified:false,actualComparisonsStarted:0,preflightPass:s.pass,preflightPhase:s.phase,preflightFailure:s.failure,cpuTimingOnlyFailure:!cpuQualified,failedCriteria,criterionMs:250,sampleCount:s.sampleCount,commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,rawSHA256:s.rawSHA256,scope:'cpuQualified denotes generic capability only. Each actual 8-second window requires its own unchanged 250 ms proof.'};
}
function verifyPreflight(env=process.env,options={}){
 const result=inspectPreflight(env,options);assert(result.functionalReady,'CPU capability gate closed: preflight failed; functional mode requires explicit opt-in');return result;
}
function preflightStatus(env=process.env,options={}){
 let result;
 try{result=inspectPreflight(env,options);}catch(error){result={schema:'promotion-preflight-inspection-v1',evidenceValid:false,functionalReady:false,cpuQualified:false,capabilityQualified:false,actualAppQualified:false,actualComparisonsStarted:0,error:String(error.message||error).slice(0,800)};}
 const json=records.encodeBounded(result,{maxBytes:8192,maxLineBytes:8192,maxStringChars:1024,maxStringBytes:4096,maxArrayLength:16,maxObjectKeys:32,maxNodes:256,maxDepth:5});
 if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,`functional_ready=${result.functionalReady}\ncpu_qualified=${result.cpuQualified}\n`);
 return {result,json,exitCode:result.functionalReady?0:1};
}
// Final case fields can contain large selections of already-recorded audit
// events. Only exact archived object identities become references. Their index
// is zero-based within the raw audit-event sequence, and their digest binds the
// exact packed event value. The shared payload dictionary is already SHA-bound.
function newAuditDecoder(){
 if(typeof createAuditEventDecoder==='function')return createAuditEventDecoder();
 return {push(row){assert(row&&typeof row==='object'&&!Object.hasOwn(row,'auditIndex')&&row.type!=='audit-observation-repeats','Compressed audit decoder unavailable');return [row];},finish(){}};
}
function createRecordedEvidence(store,fail){
 const events=[],references=new WeakMap(),frozen=new WeakSet(),decoded=[new Map(),new Map()],resolving=[new Set(),new Set()];
 function freeze(x){if(!x||typeof x!=='object'||frozen.has(x))return x;frozen.add(x);for(const v of Object.values(x))freeze(v);return Object.freeze(x);}
 function hydrate(x,depth=0,caseField=false){try{
  assert(depth<=store.limits.maxDepth,'Payload reference depth limit');if(!x||typeof x!=='object')return x;
  assert(!Object.hasOwn(x,'$missing'),'Missing capture payload');
  if(Object.hasOwn(x,'$auditEvent')){
   assert(caseField,'Audit references are only allowed in case fields');exactKeys(x,['$auditEvent'],'Audit reference');
   const ref=x.$auditEvent;exactKeys(ref,['index','sha256'],'Audit reference target');
   assert(Number.isSafeInteger(ref.index)&&ref.index>=0&&ref.index<events.length,'Missing referenced audit event');
   const target=events[ref.index];assert(typeof ref.sha256==='string'&&ref.sha256===target.sha256,'Audit event digest mismatch');return target.value;
  }
  if(Object.hasOwn(x,'$payload')){assert(Object.keys(x).length===1,'Invalid payload reference shape');return decode(x.$payload,depth+1,caseField);}
  if(Array.isArray(x))return x.map(v=>hydrate(v,depth+1,caseField));
  return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,hydrate(v,depth+1,caseField)]));
 }catch(e){fail(e.message);throw e;}}
 function decode(id,depth=0,caseField=false){try{
  assert(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id)&&store.payloads.has(id),'Missing referenced payload');
  const cache=decoded[Number(caseField)],active=resolving[Number(caseField)];assert(!active.has(id),'Cyclic payload reference');
  if(!cache.has(id)){active.add(id);try{cache.set(id,hydrate(JSON.parse(store.payloads.get(id)),depth+1,caseField));}finally{active.delete(id);}}return cache.get(id);
 }catch(e){fail(e.message);throw e;}}
 function archive(packed){
  assert(events.length<(typeof createAuditEventDecoder==='function'?RAW_LIMITS.maxRecords:store.limits.maxEvents),'Archived audit event count limit');
  const value=freeze(hydrate(packed));assert(value&&typeof value==='object'&&!Array.isArray(value),'Invalid audit event');
  const ref=Object.freeze({index:events.length,sha256:hash(packed)});events.push({value,sha256:ref.sha256});references.set(value,ref);return value;
 }
 function project(value){
  // Mirror the existing plain-data capture bounds BEFORE allocation/packing.
  // Replacements are examined first, so hydrated event bodies are never walked
  // again. No new references can be supplied by a caller or inferred by shape.
  const limits=store.limits,ancestors=new Set();let nodes=0,bytes=0;
  const charge=n=>{bytes+=n;assert(bytes<=limits.maxValueBytes,'capture byte limit');};
  const string=x=>{assert(x.length<=limits.maxValueBytes,'capture string limit');charge(Buffer.byteLength(JSON.stringify(x)));return x;};
  function visit(x,depth){
   assert(depth<=limits.maxDepth&&++nodes<=limits.maxNodes,'capture complexity limit');
   if(x&&typeof x==='object'&&references.has(x)){const ref={$auditEvent:references.get(x)};charge(Buffer.byteLength(JSON.stringify(ref)));return ref;}
   if(x===undefined||x===null){charge(4);return null;}
   if(typeof x==='string')return string(x);
   if(typeof x==='number'){assert(Number.isFinite(x),'nonfinite capture');charge(String(x).length);return x;}
   if(typeof x==='boolean'){charge(x?4:5);return x;}
   assert(typeof x==='object','unsupported capture');assert(!ancestors.has(x),'cyclic capture');ancestors.add(x);charge(2);let result;
   assert(!Object.hasOwn(x,'$auditEvent'),'Untrusted audit event reference');
   if(Array.isArray(x)||x instanceof Uint8Array){
    assert(x.length<=limits.maxArray,'capture array limit');result=[];
    for(let i=0;i<x.length;i++){if(i)charge(1);const d=Object.getOwnPropertyDescriptor(x,String(i));assert(d&&Object.hasOwn(d,'value'),'capture array accessor/hole');result.push(visit(d.value,depth+1));}
   }else{
    assert([Object.prototype,null].includes(Object.getPrototypeOf(x)),'nonplain capture');result=Object.create(null);let n=0,written=0;
    for(const key in x){assert(Object.hasOwn(x,key),'inherited capture key');assert(++n<=limits.maxKeys,'capture key limit');const d=Object.getOwnPropertyDescriptor(x,key);assert(Object.hasOwn(d,'value'),'capture accessor');if(d.value===undefined)continue;if(written++)charge(1);string(key);charge(1);result[key]=visit(d.value,depth+1);}
   }
   ancestors.delete(x);return result;
  }
  return visit(value,0);
 }
 return {hydrate,decode,archive,project,restore:x=>hydrate(x,0,true),events};
}
function createCaseRecorder(file,{writer=records.createWriter(file,RAW_LIMITS),maxSamples=6000}={}){
 const store=createCaptureStore(),saved=new Set();let failure=null,pageStatus=null;
 const fail=reason=>{failure=failure||String(reason).slice(0,300);return false;};
 const evidence=createRecordedEvidence(store,fail),auditDecoder=newAuditDecoder();let auditCursor=0,indexedAudit=false;
 function append(row){if(failure)return false;if(!writer.append(row))return fail('raw writer: '+writer.stats().reason);return true;}
 function payload(id,text){if(failure)return false;if(typeof text!=='string'||hash(text)!==id)return fail('payload SHA-256 mismatch');if(saved.has(id))return true;if(!store.payloads.has(id))store.importPayload(id,text);if(!store.status().complete)return fail(store.status().failure);for(let offset=0;offset<text.length;offset+=8192)if(!append({type:'payload-part',sha256:id,offset,totalChars:text.length,text:text.slice(offset,offset+8192)}))return false;saved.add(id);return true;}
 function flush(){for(const[id,text]of store.payloads)if(!saved.has(id)&&!payload(id,text))return false;return true;}
 function captured(type,value){try{const v=store.capture(type==='case-field'?evidence.project(value):value);if(!v){fail(store.status().failure);return null;}return flush()&&append({type,value:v})?v:null;}catch(e){fail(e.message);return null;}}
 function record(type,value){return type==='audit-event'?auditEvents(value)!==null:captured(type,value)!==null;}
 function auditEvents(value){try{const packed=captured('audit-event',value);if(packed===null)return null;indexedAudit=indexedAudit||Object.hasOwn(packed,'auditIndex')||packed.type==='audit-observation-repeats';const expanded=auditDecoder.push(packed).map(evidence.archive);auditCursor++;return expanded;}catch(e){fail(e.message);return null;}}
 // Single-event helper retained for local legacy tests/callers only.
 function auditEvent(value){const expanded=auditEvents(value);if(expanded===null)return null;if(expanded.length!==1){fail('Expected one uncompressed audit event');return null;}return expanded[0];}
 function finishAudit(){try{
  auditDecoder.finish();
  // A contiguous shorter prefix can still omit a terminal repeat row. At a
  // complete drain, bind both transport and expanded counts/bytes to the same
  // producer snapshot. Never compare during a partial batch.
  if(indexedAudit||pageStatus?.observation!==undefined){
   const o=pageStatus?.observation;exactKeys(o,['schema','observedOccurrences','expandedBytes','maxExpandedBytes','repeatedOccurrences','repeatRows','pendingOccurrences','templateStreams','templateBytes','maxOccurrences'],'Audit producer observation');
   assert(o.schema==='exact-observation-repeats-v1','Unknown audit producer observation schema');
   for(const key of ['observedOccurrences','expandedBytes','repeatedOccurrences','repeatRows','pendingOccurrences','templateStreams','templateBytes'])assert(Number.isSafeInteger(o[key])&&o[key]>=0,'Invalid audit producer observation count');
   assert(o.maxOccurrences===RAW_LIMITS.maxRecords&&o.maxExpandedBytes===store.limits.maxBytes&&o.observedOccurrences<=o.maxOccurrences&&o.expandedBytes<=o.maxExpandedBytes,'Audit producer observation limit mismatch');
   assert(o.pendingOccurrences===0&&o.repeatedOccurrences<=o.observedOccurrences&&o.repeatRows<=store.limits.maxEvents&&o.templateStreams<=store.limits.maxPayloads&&o.templateBytes<=store.limits.maxValueBytes,'Invalid audit producer observation metadata');
   assert(typeof auditDecoder.status==='function','Missing audit decoder status');const d=auditDecoder.status();
   assert(d.complete===true&&d.pending===0&&d.delivered===d.observed&&d.maxOccurrences===o.maxOccurrences&&d.maxExpandedBytes===o.maxExpandedBytes,'Incomplete audit decoder status');
   assert(Number.isSafeInteger(pageStatus.events)&&pageStatus.events===auditCursor&&d.compactRows===auditCursor,'Audit producer compact count mismatch');
   assert(d.observed===o.observedOccurrences,'Audit producer expanded count mismatch');
   assert(d.expandedBytes===o.expandedBytes,'Audit producer expanded byte mismatch');
  }
  return true;
 }catch(e){return fail(e.message);}}
 const samples=[];
 return {store,record,auditEvent,auditEvents,auditCursor:()=>auditCursor,finishAudit,payload,fail,samples,maxSamples,decode:evidence.decode,hydrate:evidence.hydrate,setPageStatus:s=>{pageStatus=s;if(s?.complete!==true)fail('page capture incomplete: '+s?.failure);},
  sample(row){if(samples.length>=maxSamples)return fail('CPU sample count limit');if(!record('process-cpu',row))return false;samples.push(row);return true;},
  close(){finishAudit();if((pageStatus?.pendingSources??0)!==0)fail('Unresolved worker source hashes at final capture');writer.close();return this.status();},status(){return {complete:!failure&&store.status().complete&&pageStatus?.complete===true&&(pageStatus.pendingSources??0)===0&&writer.stats().complete,failure,page:pageStatus,raw:writer.stats()};},writer};
}
// Offline reader only. Reconstruction proves reference/payload integrity, NOT
// lifecycle completion, case-field completeness or a historical case pass.
// References must resolve to an earlier, exact raw audit-event, never a future
// event, missing payload or arbitrary lookalike object. No writer/browser used.
function reconstructCaseFields(buffer){
 assert(Buffer.isBuffer(buffer)&&buffer.length<=RAW_LIMITS.maxBytes,'Raw reconstruction byte limit');
 const text=buffer.toString('utf8');assert(Buffer.from(text).equals(buffer),'Invalid raw UTF-8');
 const lines=text.split('\n');assert.equal(lines.pop(),'','Missing final raw newline');assert(lines.length<=RAW_LIMITS.maxRecords,'Raw reconstruction record limit');
 const store=createCaptureStore(),parts=new Map(),fields=Object.create(null),evidence=createRecordedEvidence(store,reason=>{throw Error(reason);}),auditDecoder=newAuditDecoder();
 for(const line of lines){
  assert(Buffer.byteLength(line)+1<=RAW_LIMITS.maxLineBytes,'Raw reconstruction line limit');const row=JSON.parse(line);records.encodeBounded(row,RAW_LIMITS);
  if(row.type==='payload-part'){
   exactKeys(row,['type','sha256','offset','totalChars','text'],'Payload part');
   assert(typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256),'Invalid payload digest');
   assert(Number.isInteger(row.totalChars)&&row.totalChars>0&&row.totalChars<=store.limits.maxValueBytes&&typeof row.text==='string'&&row.text.length>0&&row.text.length<=8192,'Invalid payload part size');
   assert(!store.payloads.has(row.sha256),'Duplicate completed payload');
   if(!parts.has(row.sha256)){assert(parts.size+store.payloads.size<store.limits.maxPayloads,'Payload part count limit');parts.set(row.sha256,{total:row.totalChars,text:''});}
   const part=parts.get(row.sha256);assert(row.totalChars===part.total&&row.offset===part.text.length&&row.offset+row.text.length<=part.total,'Payload part offset/length mismatch');part.text+=row.text;
   if(part.text.length===part.total){assert(store.importPayload(row.sha256,part.text),store.status().failure||'Invalid payload');parts.delete(row.sha256);}
  }else if(row.type==='audit-event'){
   exactKeys(row,['type','value'],'Audit event row');for(const event of auditDecoder.push(row.value))evidence.archive(event);
  }else if(row.type==='case-field'){
   exactKeys(row,['type','value'],'Case field row');const field=evidence.restore(row.value);exactKeys(field,['key','value'],'Case field');
   assert(typeof field.key==='string'&&!Object.hasOwn(fields,field.key),'Invalid or duplicate case field');fields[field.key]=field.value;
  }
 }
 auditDecoder.finish();assert.equal(parts.size,0,'Incomplete payload parts');return {fields,events:evidence.events.map(e=>e.value)};
}
async function assertPageRecordingReady(page,recorder){
 const host=recorder.status();if(host.failure||host.raw?.closed!==false||host.raw?.failures!==0||recorder.store.status().complete!==true){const reason='Host observation unavailable: '+String(host.failure||host.raw?.reason||'writer is not healthy and open');recorder.fail(reason);throw Error(reason);}
 const status=await page.evaluate(()=>__promotionAudit.read(0).status);
 recorder.setPageStatus(status);
 assert(status?.complete===true,'Browser observation unavailable: '+String(status?.failure||'missing status'));
 // A pending source hash is allowed here; final capture still requires zero.
 return status;
}
function stopAfterRecordingFailure(report,summary){
 if(summary.recording?.complete!==true){report.fatal=report.fatal||'Verification recording failed; remaining cases not started: '+String(summary.recording?.failure||'incomplete recording');return true;}
 return false;
}
async function collectAudit(page,recorder,cache){
 while(true){const batch=await page.evaluate(offset=>__promotionAudit.read(offset),recorder.auditCursor());recorder.setPageStatus(batch.status);
  for(const id of batch.payloads){if(recorder.store.payloads.has(id))continue;let text='',offset=0,total=null;do{const part=await page.evaluate(({id,offset})=>__promotionAudit.payloadPart(id,offset),{id,offset});if(!Number.isInteger(part.length)||part.length>4*1024*1024||part.text.length>8192||part.length<offset||part.text.length===0&&offset<part.length)throw Error('Invalid bounded payload transfer');total=part.length;text+=part.text;offset+=part.text.length;}while(offset<total);if(!recorder.payload(id,text))throw Error('Incomplete payload recording');}

  for(const event of batch.events){const archived=recorder.auditEvents(event);if(archived===null)throw Error('Incomplete audit recording');cache.push(...archived);}
  assert.equal(recorder.auditCursor(),batch.next,'Audit cursor mismatch');if(batch.next===batch.total){assert(recorder.finishAudit(),'Incomplete expanded audit recording');break;}
 }
 return cache;
}
// BEGIN ENDPOINT-AWARE SAMPLER
const startBoundedProcessSampler = (() => {
// LOCAL PROTOTYPE ONLY. This module does not load a browser or open a socket.
// Its sole transport dependency is the caller-supplied cdp.send fake/session.
const { processRows } = require(path.join(support, 'cpu-preflight.cjs'));
const POLICY = Object.freeze({
  intervalMs: 100, criterionMs: 250, windowMs: 8000,
  maxEndpointQueries: 2, beforeEndMs: 75, afterEndMs: 25,
  hintLatenessMs: 25, requestTimeoutMs: 2000, maxStopMs: 5000,
  maxSamples: 6000,
});
const hostNow = () => Number(process.hrtime.bigint()) / 1e6;
function sleepDefault(ms, { signal } = {}) {
  return new Promise(resolve => {
    let timer;
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    if (signal?.aborted) return finish();
    timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}
const brief = error => String(error?.message || error).slice(0, 600);
function startBoundedProcessSampler({ cdp, recorder, now = hostNow, sleep = sleepDefault,
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  if (typeof cdp?.send !== 'function' || typeof recorder?.sample !== 'function' ||
      typeof recorder?.record !== 'function' || typeof recorder?.fail !== 'function' ||
      !Array.isArray(recorder.samples)) throw TypeError('Missing sampler dependencies');
  const maxSamples = recorder.maxSamples ?? POLICY.maxSamples;
  if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > POLICY.maxSamples)
    throw RangeError('CPU sample cap must be between 1 and 6000');
  let running = true, sealed = false, pending = null, registration = null;
  let interruptSleep = null, abandonAcquisition = null, stopPromise = null;
  let nextNormalAt = now(), previousAcquisition = null;
  const hints = [];
  const counts = { normalQueries: 0, endpointQueries: 0, waits: 0, wakeups: 0, maxConcurrent: 0 };
  let activeQueries = 0;
  const fail = reason => { recorder.fail(reason); running = false; interruptSleep?.(); };
  const record = (type, value) => {
    if (sealed) return false;
    try { if (recorder.record(type, value) !== true) { fail('CPU scheduler metadata incomplete'); return false; } }
    catch (error) { fail('CPU scheduler metadata failure: ' + brief(error)); return false; }
    return true;
  };
  const saveSample = row => {
    if (sealed) return false;
    try { if (recorder.sample(row) !== true) { fail('CPU sample recording incomplete'); return false; } }
    catch (error) { fail('CPU sample recording failure: ' + brief(error)); return false; }
    return true;
  };
  function finishHint(hint, state, reason, at, queryKind = null) {
    if (hint.state !== 'planned') return;
    Object.assign(hint, { state, reason, resolvedAt: at, queryKind });
    record('cpu-endpoint-hint', { ...hint });
  }
  function expireHints(at) {
    for (const hint of hints) if (hint.state === 'planned' && at > hint.expiresAt) {
      const pendingAtTarget = previousAcquisition && previousAcquisition.start <= hint.targetAt &&
        previousAcquisition.end >= hint.targetAt;
      finishHint(hint, 'missed', pendingAtTarget ? 'acquisition-pending-at-target' : 'scheduler-late', at);
    }
  }
  function cancelHints(reason, at) {
    for (const hint of hints) finishHint(hint, 'cancelled', reason, at);
  }
  async function waitUntil(at) {
    const controller = new AbortController();
    let wake;
    const changed = new Promise(resolve => { wake = resolve; });
    interruptSleep = () => { controller.abort(); wake(); };
    counts.waits++;
    try {
      await Promise.race([Promise.resolve(sleep(Math.max(0, at - now()), { signal: controller.signal }))
        .catch(error => { if (!controller.signal.aborted) throw error; }), changed]);
      counts.wakeups++;
    } finally { controller.abort(); interruptSleep = null; }
  }
  function terminalPending(reason) {
    if (sealed) return;
    const at = now();
    cancelHints(reason, at);
    // The incomplete row must precede fail(): the production recorder refuses
    // further writes once failure is sticky. This also reserves no extra slot.
    if (pending) saveSample({ start: pending.start, end: at, incomplete: true, error: reason });
    fail(reason);
    sealed = true;
    abandonAcquisition?.();
  }
  async function acquire(kind) {
    // Check BEFORE issuing the request. Endpoint rows use the same existing cap.
    if (recorder.samples.length >= maxSamples) { fail('CPU sample count limit'); return; }
    const start = now();
    if (kind === 'normal') { nextNormalAt = start + POLICY.intervalMs; counts.normalQueries++; }
    else {
      if (counts.endpointQueries >= POLICY.maxEndpointQueries) { fail('CPU endpoint query limit'); return; }
      counts.endpointQueries++;
    }
    pending = { start, kind };
    activeQueries++;
    counts.maxConcurrent = Math.max(counts.maxConcurrent, activeQueries);
    if (activeQueries !== 1) { terminalPending('Overlapping CPU acquisition'); return; }
    let requestTimer;
    let abandon;
    const abandoned = new Promise(resolve => { abandon = () => resolve({ kind: 'abandoned' }); });
    abandonAcquisition = () => { clearTimer(requestTimer); abandon(); };
    let reply;
    try {
      reply = Promise.resolve(cdp.send('SystemInfo.getProcessInfo')).then(
        value => { activeQueries--; return { kind: 'reply', value }; },
        error => { activeQueries--; return { kind: 'error', error }; });
    } catch (error) { activeQueries--; reply = Promise.resolve({ kind: 'error', error }); }
    let outcome;
    try {
      outcome = await Promise.race([
        reply, abandoned,
        new Promise(resolve => { requestTimer = setTimer(() => resolve({ kind: 'timeout' }), POLICY.requestTimeoutMs); }),
      ]);
    } finally { clearTimer(requestTimer); abandonAcquisition = null; }
    if (sealed || outcome.kind === 'abandoned') return;
    if (outcome.kind === 'timeout') {
      terminalPending('CPU acquisition timeout; no replacement poll issued');
      return;
    }
    const end = now();
    let row;
    try {
      if (outcome.kind === 'error') throw outcome.error;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw Error('Invalid host acquisition interval');
      row = { start, end, processes: processRows(outcome.value.processInfo) };
    } catch (error) { row = { start, end, error: brief(error) }; }
    previousAcquisition = { start, end };
    pending = null;
    saveSample(row);
    if (row.error) fail('CPU acquisition failure');
    // Do not truncate, replace, or discard acquisitions over 250 ms. The
    // unchanged windowEvidence helper and raw gate decide qualification.
  }
  record('cpu-sampler-policy', { ...POLICY, maxSamples });
  const done = (async () => {
    try {
      while (running && !sealed) {
        const at = now();
        if (recorder.samples.length >= maxSamples) { fail('CPU sample count limit'); break; }
        expireHints(at);
        if (!running) break;
        const due = hints.filter(h => h.state === 'planned' && h.targetAt <= at);
        if (at >= nextNormalAt) {
          for (const hint of due) finishHint(hint, 'coalesced', 'normal-query-due', at, 'normal');
          if (running) await acquire('normal');
        } else if (due.length) {
          // One due batch gets at most ONE query; never burst pending hints.
          for (const hint of due.slice(0, -1)) finishHint(hint, 'coalesced', 'single-endpoint-query', at, 'endpoint');
          finishHint(due.at(-1), 'issued', 'predeclared-endpoint-query', at, 'endpoint');
          if (running) await acquire('endpoint');
        } else {
          const nextHintAt = Math.min(...hints.filter(h => h.state === 'planned').map(h => h.targetAt));
          await waitUntil(Math.min(nextNormalAt, nextHintAt));
        }
      }
    } catch (error) {
      if (pending) terminalPending('CPU scheduler failure: ' + brief(error));
      else fail('CPU scheduler failure: ' + brief(error));
    } finally {
      cancelHints('sampler-ended', now());
      interruptSleep?.();
    }
  })();
  function setWindow(pageStart, pageEnd, clockBefore) {
    // Single registration, including an invalid/unknown clock. No adaptive
    // replacement window and no append-only log growth from duplicate calls.
    if (registration) throw Error('CPU window already registered; replacement forbidden');
    if (!running || sealed) throw Error('CPU sampler is stopped');
    const registeredAt = now();
    const best = clockBefore?.best;
    const endpointsValid = Number.isFinite(pageStart) && Number.isFinite(pageEnd) &&
      pageEnd - pageStart === POLICY.windowMs;
    const clockValid = Number.isFinite(best?.low) && Number.isFinite(best?.high) &&
      best.low <= best.high && best.high - best.low <= POLICY.criterionMs;
    registration = { registeredAt, pageStart: Number.isFinite(pageStart) ? pageStart : null,
      pageEnd: Number.isFinite(pageEnd) ? pageEnd : null, accepted: endpointsValid,
      armed: endpointsValid && clockValid,
      reason: !endpointsValid ? 'not-a-fixed-eight-second-window' : !clockValid ? 'unknown-or-wide-before-clock' : null,
      clockBeforeHint: clockValid ? { low: best.low, high: best.high } : null,
      startHostHint: null, endHostHint: null, startAlreadyElapsed: null, hints: [] };
    if (registration.armed) {
      const startHost = [pageStart - best.high, pageStart - best.low];
      const endHost = [pageEnd - best.high, pageEnd - best.low];
      if (![...startHost, ...endHost].every(Number.isFinite)) {
        registration.armed = false; registration.reason = 'host-hint-overflow';
      } else {
        Object.assign(registration, { startHostHint: startHost, endHostHint: endHost,
          startAlreadyElapsed: registeredAt > startHost[1] });
        for (const [id, targetAt] of [['end-before', endHost[0] - POLICY.beforeEndMs],
          ['end-after', endHost[1] + POLICY.afterEndMs]]) {
          const hint = { id, targetAt, expiresAt: targetAt + POLICY.hintLatenessMs, state: 'planned' };
          hints.push(hint);
          registration.hints.push({ ...hint });
        }
      }
    }
    record('cpu-window-registration', registration);
    // A target earlier than registration is missed, even if inside its grace.
    // Never turn a late registration into a synthetic past observation.
    for (const hint of hints) if (hint.targetAt < registeredAt)
      finishHint(hint, 'missed', 'target-precedes-registration', registeredAt);
    interruptSleep?.();
    return structuredClone(registration);
  }
  function stop({ timeoutMs = POLICY.maxStopMs } = {}) {
    if (stopPromise) return stopPromise;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > POLICY.maxStopMs)
      throw RangeError('Stop timeout must be positive and at most 5000 ms');
    running = false;
    cancelHints('stop-requested', now());
    interruptSleep?.();
    stopPromise = (async () => {
      let timer;
      try {
        const settled = await Promise.race([
          done.then(() => true),
          new Promise(resolve => { timer = setTimer(() => resolve(false), timeoutMs); }),
        ]);
        if (!settled) terminalPending('CPU acquisition pending at shutdown; no replacement poll issued');
        sealed = true;
        return [...recorder.samples];
      } finally { clearTimer(timer); }
    })();
    return stopPromise;
  }
  const stats = () => ({ running, sealed, pending: pending && { ...pending },
    registration: registration && structuredClone(registration), hints: structuredClone(hints),
    counts: { ...counts, normal: counts.normalQueries, extra: counts.endpointQueries,
      missed: hints.filter(h => h.state === 'missed').length,
      coalesced: hints.filter(h => h.state === 'coalesced').length,
      overlap: Math.max(0, counts.maxConcurrent - 1) } });
  return { stop, setWindow, stats, status: stats };
}
return startBoundedProcessSampler;

})();
// END ENDPOINT-AWARE SAMPLER

function classifyCase(r,recording){
 const lifecycleFailures=r.failures.filter(f=>f.phase!=='primary-recall');
 const lifecycle={pass:lifecycleFailures.length===0&&r.uncovered.length===0&&r.lifecycleCompleted===true,failures:lifecycleFailures.map(f=>({phase:f.phase,error:String(f.error||'See raw failure details').slice(0,800)})),uncovered:r.uncovered};
 const recall={primary:r.primaryFirst===true&&!r.primaryRecallFailure,additional:r.additionalRecall===true,diagnostic:r.continuationDiagnostic?.foundIdentity===true,primaryStatus:r.primaryFirst===true&&!r.primaryRecallFailure?'passed':r.primaryRecallFailure||r.primaryFirst===false?'failed':'unreached',additionalStatus:r.additionalRecall===true?'passed':r.additionalRecall===false?'failed':'unreached'};
 lifecycle.status=lifecycle.pass?'passed':lifecycleFailures.length?'failed':'unreached';
 const functionalPass=lifecycle.pass&&recall.primary&&recall.additional&&recording.complete===true;
 const functional={pass:functionalPass,status:functionalPass?'passed':lifecycleFailures.length||recording.complete!==true||recall.primaryStatus==='failed'||recall.additionalStatus==='failed'?'failed':'unreached',lifecycleCompleted:r.lifecycleCompleted===true,scope:'Lifecycle, primary and additional recall, replay and complete recording; independent of CPU timing qualification'};
 const w=r.independentPostFirstCPU,bounded=x=>Number.isFinite(x)&&x>=0&&x<=250;
 const cpu={eligible:recording.complete===true&&r.primaryFirst===true&&w?.qualified===true&&r.postFirstCPUWindow?.end-r.postFirstCPUWindow?.start===8000&&bounded(w?.clock?.width)&&bounded(w.maxGapMs)&&bounded(w.maxAcquisitionMs)&&w.bracketWidthsMs?.length===2&&w.bracketWidthsMs.every(bounded)&&Number.isFinite(w?.inner?.cpuSecondsLowerBound)&&Number.isFinite(w?.outer?.cpuSecondsLowerBound),criterionMs:250,claim:null,window:{page:r.postFirstCPUWindow||null,maxAcquisitionMs:w?.maxAcquisitionMs??null,maxGapMs:w?.maxGapMs??null,bracketWidthsMs:w?.bracketWidthsMs??null,clockWidthMs:w?.clock?.width??null,inner:w?.inner?{cpuSecondsLowerBound:w.inner.cpuSecondsLowerBound,observedSpanMs:w.inner.observedSpanMs??null,intervals:w.inner.intervals??null}:null,outer:w?.outer?{cpuSecondsLowerBound:w.outer.cpuSecondsLowerBound,observedSpanMs:w.outer.observedSpanMs??null,intervals:w.outer.intervals??null}:null},limitation:'Shared-process observed lower bounds only. Exited-process terminal CPU and undetected PID reuse unknown; no per-worker attribution or total CPU savings claim'};
 cpu.status=cpu.eligible?'qualified':'ineligible';cpu.ineligibleReasons=[];if(!cpu.eligible){if(recording.complete!==true)cpu.ineligibleReasons.push('recording-incomplete');if(r.primaryFirst!==true)cpu.ineligibleReasons.push(recall.primaryStatus==='failed'?'primary-first-failed':'primary-first-unreached');if(!w)cpu.ineligibleReasons.push('actual-window-unreached');else{if(w.qualified!==true)cpu.ineligibleReasons.push('actual-window-unqualified');if(!bounded(w.clock?.width))cpu.ineligibleReasons.push('clock-width-unqualified');if(!bounded(w.maxGapMs))cpu.ineligibleReasons.push('sampling-gap-unqualified');if(!bounded(w.maxAcquisitionMs))cpu.ineligibleReasons.push('acquisition-unqualified');if(w.bracketWidthsMs?.length!==2||!w.bracketWidthsMs.every(bounded))cpu.ineligibleReasons.push('endpoint-brackets-unqualified');if(!Number.isFinite(w.inner?.cpuSecondsLowerBound)||!Number.isFinite(w.outer?.cpuSecondsLowerBound))cpu.ineligibleReasons.push('lower-bound-evidence-missing');}if(r.postFirstCPUWindow?.end-r.postFirstCPUWindow?.start!==8000)cpu.ineligibleReasons.push('exact-eight-second-window-missing');}cpu.scope='Actual post-first 8-second window, never inherited from generic preflight';
 const replay={primary:{count:r.replay?.length||0,allRestedAndScored:!!r.replay?.length&&r.replay.every(x=>x.rested&&x.scoreDelta===1)},diagnostic:{count:r.continuationDiagnostic?.replay?.length||0,allRestedAndScored:r.continuationDiagnostic?.replayValid===true}};
 return {id:r.id,fixture:r.fixture,arm:r.arm,repeat:r.repeat,lifecycle,functional,recall,recording,cpu,replay,firstCount:r.firstCount??null,promotionRequestHash:r.promotionRequestHash??null,failures:r.failures.map(f=>({phase:f.phase,error:String(f.error||'See raw failure details').slice(0,800)})),ok:functional.pass&&cpu.eligible};
}
function qualifiedPairs(cases){const pairs=[];for(let repeat=0;repeat<4;repeat++){const a=cases.find(c=>c.repeat===repeat&&c.arm==='baseline'),b=cases.find(c=>c.repeat===repeat&&c.arm==='candidate');pairs.push({repeat,eligible:!!a?.cpu.eligible&&!!b?.cpu.eligible&&a.lifecycle.pass&&b.lifecycle.pass&&a.recall.primary&&b.recall.primary&&a.promotionRequestHash===b.promotionRequestHash&&!!a.promotionRequestHash,baseline:a?.id??null,candidate:b?.id??null,claim:null});}return pairs;}
function reportVerdicts(report){
 const cases=report.cases,pairs=report.pairs||qualifiedPairs(cases),complete=cases.length===8;
 const functionalPass=!report.fatal&&complete&&cases.every(c=>c.functional.pass);
 const functional={pass:functionalPass,status:functionalPass?'passed':report.fatal||cases.some(c=>c.functional.status==='failed')?'failed':'unreached',expectedCases:8,recordedCases:cases.length,passedCases:cases.filter(c=>c.functional.pass).length,failedCases:cases.filter(c=>c.functional.status==='failed').length,unreachedCases:8-cases.length+cases.filter(c=>c.functional.status==='unreached').length};
 const cpu={qualified:!report.fatal&&complete&&cases.every(c=>c.cpu.eligible)&&pairs.length===4&&pairs.every(p=>p.eligible),criterionMs:250,eligibleCases:cases.filter(c=>c.cpu.eligible).length,eligiblePairs:pairs.filter(p=>p.eligible).length,preflightCapabilityQualified:report.preflight?.cpuQualified===true,scope:'Independent actual-window and matched-pair eligibility; preflight capability is retained separately',claim:null};
 return {functional,cpu,ok:functional.pass&&cpu.qualified,exitOk:report.preflight?.mode===FUNCTIONAL_MODE?functional.pass:functional.pass&&cpu.qualified};
}
function writeCompact(file,value){const writer=records.createWriter(file,{...SUMMARY_LIMITS,maxRecords:1});writer.append(value);writer.close();if(!writer.stats().complete)throw Error('Compact summary write failed: '+writer.stats().reason);}
async function main(){
 if(process.argv.includes('--preflight-status')){const status=preflightStatus();console.log(status.json);process.exitCode=status.exitCode;return;}
 const preflight=verifyPreflight();
const inputDir=path.resolve(process.env.INPUT_DIR||support),pageRecords=new WeakMap(),auditCaches=new WeakMap();
const {chromium}=require(require.resolve('playwright',{paths:[process.env.APP_DIR||process.cwd()]}));
const fixture=process.env.FIXTURE;assert(['default3','default4','moved3','moved4'].includes(fixture));const input=JSON.parse(fs.readFileSync(path.join(inputDir,'fixtures',fixture+'.json'))),manifest=JSON.parse(fs.readFileSync(path.join(inputDir,'sources.json'))),out=process.env.OUT_DIR||'promotion-stop-results';fs.mkdirSync(out,{recursive:true});
assert.equal(input.fixture,fixture);assert(Array.isArray(input.submitted?.snapshot?.world)&&input.submitted.snapshot.world.every(x=>Number.isInteger(x)&&x>=0&&x<=255));assert(input.first?.game&&input.initial?.options&&input.applied?.settings&&Number.isInteger(input.applied.selectedId));assert.equal(input.initial.options.solveTimeMs,20000);assert.equal(JSON.parse(input.applied.forecast.requestKey).length,6);assert(/^[a-f0-9]{64}$/.test(input.provenance.originalRecordSHA256));
const report={fixture,preflight,scope:'Prepared actual-app comparison; never inferred from generic preflight',baselineCommit:'277b3b7174e54b2bef16e09a9b7bfc0f5700b36d',candidateRawSHA:'d2723c450e14aff9632112eef0d08ce6d65eb420f5f06f20ab600783da8e3d09',inputFileSHA:hash(fs.readFileSync(path.join(inputDir,'fixtures',fixture+'.json'),'utf8')),cases:[],budgets:{forecast:15000,prepared:8000,restPromotion:60000,firstAfterPromotion:60000,postFirst:8000,resume:100000,resumeSlices:4,restore:8000,replaySteps:40000,independentCpuIntervalMs:100,maxEndpointCPUQueries:2,endpointBeforeMs:75,endpointAfterMs:25,cpuQualificationUncertaintyMs:250,diagnosticResumeLimit:4,diagnosticDeadlineMs:100000},started:new Date().toISOString()};
const state=async page=>{const value=await page.evaluate(()=>{const c=cueLab,o=c.optimizer,n=c.nextShot,j=n.job,r=c.state.routeResult;if((r?.results?.length||0)>2048||(o?.workers?.length||0)>128||(o?.busy?.size||0)>128){__promotionAudit.store.fail('Milestone collection limit');throw Error('Milestone collection limit');}return __promotionAudit.captureValue({at:performance.timeOrigin+performance.now(),status:c.state.routeStatus,error:c.state.routeError,settings:{...c.state.settings},options:{...c.state.routeOptions},selectedId:c.state.selectedId,predict:c.state.predict,precompute:c.state.nextShotPrecompute,shots:c.lab.shots,score:c.game?.scores,game:c.game?.snapshot(),rested:!c.lab.cue&&!c.lab.anyMotion()&&!c.game?.pending,identities:(r?.results||[]).map(LabRouteRules.successIdentity),termination:r?.terminationReason,continuable:r?.continuable,results:r?.results||[],cost:r?{tested:r.tested,physicsSteps:r.physicsSteps,workAttemptTotal:r.workAttemptTotal,retryOverhead:r.retryOverhead}:null,optimizer:{constructor:o?.constructor?.name,workerId:o?.worker?.__promotionId,workers:o?.workers?.map(w=>w.__promotionId),version:o?.version,disposed:o?.disposed??null,latest:!!o?.latest,poolBusy:o?.busy?[...o.busy.keys()].map(w=>w.__promotionId):null,requestGoal:o?.latest?.options?.searchGoal??o?.search?.req?.options?.searchGoal??null},job:j?{generation:j.generation,promoted:j.promoted,aiming:j.aiming,suspended:j.suspended,workerId:j.optimizer?.worker?.__promotionId,inputStamp:j.inputStamp,expectedStamp:j.expectedStamp,preparedIdentity:j.aimReceipt===c.forecastReceipt}:null,preparation:c.state.nextShotPreparation,forecast:{receipt:!!c.forecastReceipt,rested:c.forecastReceipt?.result?.rested,nextShot:!!c.forecastReceipt?.result?.nextShot,requestKey:c.requestKey,settings:c.forecastReceipt?.request?.settings,cue:c.forecastReceipt?.request?.selectedId},routeStamp:c.routeStamp,routeRequestStamp:c.routeRequestStamp});});if(!pageRecords.get(page).record('milestone-state',value))throw Error('Incomplete milestone capture');return value;};
const wait=(page,fn,ms)=>page.waitForFunction(fn,null,{timeout:ms}).then(()=>true,()=>false);
async function open(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#sidebarTrigger').click();await page.locator('#tab-routes').waitFor({state:'visible'});}
async function close(page){if(await page.locator('#sidebarTrigger').getAttribute('aria-expanded')==='true')await page.locator('.toolbox-heading').getByRole('button',{name:'설정 패널 닫기',exact:true}).click();}
const audit=page=>collectAudit(page,pageRecords.get(page),auditCaches.get(page));
async function runContinuationDiagnostic(page,r){
 const d={scope:'Separate moved3 continuation; never primary recall or primary post-first CPU',startedHostMs:hostNow(),deadlineHostMs:hostNow()+100000,maxResumes:4,slices:[],primaryRecallFailurePreserved:true};
 const beginEvents=await audit(page);d.eventStartIndex=beginEvents.length;await open(page);await page.locator('#tab-routes').click();
 for(let i=0;i<4&&hostNow()<d.deadlineHostMs;i++){
  const before=await state(page);if(before.status==='error')throw Error('Diagnostic entered runtime error: '+before.error);if(before.status==='searching'||!before.continuable){d.blocker='Not naturally paused/continuable';break;}
  if(hostNow()>=d.deadlineHostMs)break;const start=hostNow();await page.locator('#resumeSearch').click();const remaining=d.deadlineHostMs-hostNow();if(remaining<=0)break;
  const done=await wait(page,()=>cueLab.state.routeStatus!=='searching',Math.min(25000,remaining));const after=await state(page);d.slices.push({index:i,before,after,hostStart:start,hostEnd:hostNow(),done});if(after.status==='error')throw Error('Diagnostic runtime error: '+after.error);if(after.identities.length||!done)break;
 }
 d.final=await state(page);d.foundIdentity=d.final.identities.length>0;d.stop=await measurement.stopIfSearching(page);d.endedHostMs=hostNow();const all=await audit(page);d.events=all.slice(d.eventStartIndex).filter(e=>!e.source);d.replay=[];
 if(d.foundIdentity)d.replay=await page.evaluate(({request,rows,game})=>{request.snapshot.world=new Uint8Array(request.snapshot.world);return rows.map(row=>{const lab=PhysicsLab.fromSnapshot(RAPIER,request.snapshot),g=game.kind==='three'?new ThreeBallGame():new FourBallGame();try{g.restore(game);const before=g.scores[request.selectedId];lab.onEvent=e=>g.contact(e);g.begin(request.selectedId,{threeCushion:game.kind==='three'||!!request.options.fourBallThreeCushion});if(!lab.strike(request.selectedId,row.settings).ok)throw Error('Diagnostic replay refused');let steps=0;while((lab.cue||lab.anyMotion())&&steps++<40000)lab.step();if(lab.cue||lab.anyMotion())throw Error('Diagnostic replay not rested');g.finish();return {identity:LabRouteRules.successIdentity(row),scoreDelta:g.scores[request.selectedId]-before,steps,rested:true};}finally{lab.dispose();}});},{request:r.promotionRequest,rows:d.final.results,game:r.atRest.game});
 d.replayValid=d.replay.length>0&&d.replay.every(x=>x.rested&&x.scoreDelta===1);if(d.foundIdentity)assert(d.replayValid,'Diagnostic identity failed independent full-rest replay');return d;
}
await(async()=>{let browser;try{browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});const cdp=await browser.newBrowserCDPSession();report.chrome=browser.version();
for(let repeat=0;repeat<4&&!report.fatal;repeat++)for(const arm of(repeat===0||repeat===3?['baseline','candidate']:['candidate','baseline'])){
 if(report.fatal)break;
 const id=`${fixture}-${arm}-${repeat}`,r={id,fixture,arm,repeat,failures:[],uncovered:[],cpu:[],events:[],screenshots:[],pageErrors:[]};const recorder=createCaseRecorder(path.join(out,id+'.raw.ndjson'));let context,page,pcdp;let running=false,sampler,processSampler,processCDP,phase='setup';
 const capture=async name=>{const file=id+'-'+name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});r.screenshots.push(file);};
 const sample=async()=>{const start=hostNow(),s=await page.evaluate(()=>({at:performance.timeOrigin+performance.now(),status:cueLab.state.routeStatus,resultCount:cueLab.state.routeResult?.results?.length||0})),raw=(await pcdp.send('Performance.getMetrics')).metrics;assert(raw.length<=256,'Page metrics overflow');const metrics=Object.fromEntries(raw.map(x=>[x.name,x.value]));if(!recorder.record('page-observation',{phase,start,end:hostNow(),state:s,metrics,note:'Compact page observation; process CPU independent'}))running=false;};
 try{
  context=await browser.newContext({viewport:{width:1280,height:850}});await context.addInitScript({path:auditFile});page=await context.newPage();pageRecords.set(page,recorder);auditCaches.set(page,[]);pcdp=await context.newCDPSession(page);await pcdp.send('Performance.enable');page.on('pageerror',e=>{const value={error:String(e),stack:e.stack};if(r.pageErrors.length>=128){recorder.fail('Page error count overflow');return;}r.pageErrors.push(value);recorder.record('page-error',value);});page.setDefaultTimeout(7000);
  await page.goto(`http://127.0.0.1:${arm==='baseline'?8793:8794}/`,{waitUntil:'domcontentloaded',timeout:45000});assert(await wait(page,()=>globalThis.cueLab?.state.ready,45000),'App not ready');const sources=await page.evaluate(names=>__promotionAudit.captureValue(Object.fromEntries(names.map(k=>[k,document.getElementById('source-'+k)?.textContent]))),Object.keys(manifest[arm]));r.sourceHashes={};for(const[k,v]of Object.entries(sources)){assert.equal(hash(v),manifest[arm][k].embedded,'Wrong embedded '+k);r.sourceHashes[k]=hash(v);}phase='observation-preflight';await assertPageRecordingReady(page,recorder);await page.evaluate(()=>__promotionAudit.attach());
  await open(page);await page.locator('#tab-routes').click();if(fixture.endsWith('4'))await page.locator('#gameMode').getByRole('button',{name:'4구',exact:true}).click();
  // Controlled fixture initialization ONLY. No precompute/frontier/result inserted.
  r.setup=await page.evaluate(raw=>{const c=cueLab;c.cancelSearch('verification-fixture',true);c.nextShot.cancel('fixture');c.invalidate();c.lab.dispose();const s={...raw.submitted.snapshot,world:new Uint8Array(raw.submitted.snapshot.world)};c.lab=PhysicsLab.fromSnapshot(RAPIER,s);c.game=raw.fixture.endsWith('4')?new FourBallGame():new ThreeBallGame();c.game.restore(raw.first.game);c.lab.onEvent=e=>c.game?.contact(e);Object.assign(c.state,{gameMode:raw.fixture.endsWith('4')?'four':'free',selectedId:raw.applied.selectedId,settings:{...raw.applied.settings},routeOptions:{...raw.initial.options},horizon:JSON.parse(raw.applied.forecast.requestKey)[4],paused:true,predict:true,nextShotPrecompute:true,routeStatus:'idle',routeResult:null,routeProgress:null});c.accumulator=0;c.windup=null;c.notify();const q=c.lab.snapshot({trails:false});return __promotionAudit.captureValue({snapshot:{...q,world:q.world},settings:{...c.state.settings},options:{...c.state.routeOptions},game:c.game.snapshot(),cue:c.state.selectedId});},input);r.snapshotHash=hash(r.setup.snapshot);assert.equal(r.snapshotHash,hash(input.submitted.snapshot));assert.deepEqual(r.setup.settings,input.applied.settings);assert.deepEqual(r.setup.options,input.initial.options);assert(!Object.hasOwn(r.setup.options,'searchGoal'));
  await page.evaluate(async()=>{await document.fonts.load('16px "Pretendard Variable"','당구');if(![...document.fonts].some(f=>f.family.includes('Pretendard')&&f.status==='loaded'))throw Error('Korean font unavailable');});
  r.clockBefore=await measurement.calibrate({readPageEpoch:()=>page.evaluate(()=>performance.timeOrigin+performance.now())});processCDP=await browser.newBrowserCDPSession();processSampler=startBoundedProcessSampler({cdp:processCDP,recorder});running=true;sampler=(async()=>{while(running){const at=Date.now();try{await sample();}catch(e){recorder.record('page-observation-error',{phase,error:String(e)});recorder.fail('Page observation failed');running=false;}if(running)await new Promise(ok=>setTimeout(ok,Math.max(0,100-(Date.now()-at))));}})();
  phase='actual-ui-prediction';await page.locator('#tab-settings').click();const box=page.getByRole('checkbox',{name:'예상 궤적',exact:true});assert.equal(await box.getAttribute('aria-checked'),'true');await box.click();await box.click();const forecast=await wait(page,()=>!cueLab.state.predictionBusy&&!!cueLab.forecastReceipt,15000);r.forecast=await state(page);if(!forecast||!r.forecast.forecast.rested||!r.forecast.forecast.nextShot){r.uncovered.push('Natural current rested forecast unavailable');continue;}assert.deepEqual(r.forecast.forecast.settings,r.setup.settings);assert.equal(r.forecast.forecast.cue,r.setup.cue);r.initialForecastConsistency=await page.evaluate(()=>{const c=cueLab,q=c.forecastReceipt.request,a=c.lab.snapshot({trails:false});return __promotionAudit.captureValue({request:{...q,snapshot:{...q.snapshot,world:q.snapshot.world}},actual:{...a,world:a.world},key:c.requestKey,expectedKey:JSON.stringify([c.lab.steps,c.lab.revision,c.state.selectedId,c.state.settings,c.state.horizon,c.lab.params])});});assert.equal(hash(r.initialForecastConsistency.request.snapshot),r.snapshotHash,'Initial forecast differs from exact fixture');assert.equal(hash(r.initialForecastConsistency.actual),r.snapshotHash,'Current world differs from exact fixture');assert.equal(r.initialForecastConsistency.key,r.initialForecastConsistency.expectedKey,'Initial forecast key stale');assert.deepEqual(r.initialForecastConsistency.request.settings,r.setup.settings);assert.equal(r.initialForecastConsistency.request.selectedId,r.setup.cue);
  phase='natural-precompute';const preparationDeadline=hostNow()+8000;r.preparedReached=await wait(page,()=>!!cueLab.nextShot.job?.optimizer?.latest||!!cueLab.nextShot.job?.result,8000);r.beforeStrike=await state(page);if(!r.preparedReached){r.uncovered.push('Natural prepared coordinator not reached');continue;}r.preparedWorkerId=r.beforeStrike.job.workerId;r.preparedPhysicsReached=await wait(page,()=>{const id=cueLab.nextShot.job?.optimizer?.worker?.__promotionId;return !!cueLab.nextShot.job?.result||__promotionAudit.events.some(e=>e.scope===id&&e.type==='evaluation-advance');},Math.max(1,preparationDeadline-hostNow()));if(!r.preparedPhysicsReached){r.uncovered.push('Prepared request never observed actual evaluation or completed result');continue;}await close(page);await capture('prepared');
  phase='actual-shot-and-rest';r.strikeAt=Date.now();r.strikeStartHostMs=hostNow();await page.locator('#strike').click();const promoted=await wait(page,()=>!!cueLab.nextShot.job?.promoted&&cueLab.state.nextShotPreparation?.matched===true&&!cueLab.game?.pending&&!cueLab.lab.cue&&cueLab.lab.objects.every(o=>o.body.isSleeping()),60000);r.atRest=await state(page);if(!promoted){r.uncovered.push('Natural exact-rest promotion not observed within60s');continue;}assert.equal(r.atRest.score[r.setup.cue],r.setup.game.scores[r.setup.cue]+1,'Actual fixed-input shot did not score');assert.equal(r.atRest.optimizer.constructor,'NextShotOptimizer');assert.equal(r.atRest.optimizer.workerId,r.preparedWorkerId,'Prepared worker lineage replaced');
  const promoteHandled=await wait(page,()=>{const id=cueLab.optimizer?.worker?.__promotionId;return __promotionAudit.events.some(e=>e.scope===id&&e.type==='service-promoteToForeground-return')||cueLab.state.routeStatus==='error';},Math.max(1,60000-(hostNow()-r.strikeStartHostMs)));if(!promoteHandled){r.uncovered.push('Promotion dispatched but coordinator handler not observed within existing60s rest/promotion budget');continue;}const ev=await audit(page),promotion=ev.find(e=>e.type==='worker-dispatch'&&e.messageType==='promote'&&e.workerId===r.preparedWorkerId);assert(promotion,'No actual promote dispatch');r.promotion=promotion;const reconcile=ev.find(e=>e.type==='reconcile-return'&&e.promoted&&e.workerId===r.preparedWorkerId);assert(reconcile?.sameCoordinator&&reconcile.sameWorker&&reconcile.matched&&reconcile.settingsUnchanged&&reconcile.optionsUnchanged,'Natural reconcile invariants failed');r.reconcile=reconcile;const reconcileEntry=ev.findLast(e=>e.type==='reconcile-entry'&&e.workerId===r.preparedWorkerId&&e.at<=reconcile.at);assert(reconcileEntry?.snapshotMatches&&reconcileEntry.gameMatches&&reconcileEntry.inputMatches,'Predicted/rest fixture cache mismatched');r.reconcileEntry=reconcileEntry;const promoteBefore=ev.find(e=>e.type==='service-promoteToForeground-entry'&&e.scope===r.preparedWorkerId),promoteAfter=ev.find(e=>e.type==='service-promoteToForeground-return'&&e.scope===r.preparedWorkerId);assert(promoteAfter?.requestUnchanged);assert.equal(promoteBefore.requestGoal,null,'Original request goal unexpectedly set');assert.equal(promoteAfter.requestGoal,null,'Promotion mutated request goal');assert.equal(promoteAfter.goal,arm==='candidate'?'first-verified':null,'Wrong service-local promotion policy');assert.equal(promoteBefore.searchId,promoteAfter.searchId);assert.equal(promoteBefore.requestObjectId,promoteAfter.requestObjectId);r.promotionRequest=ev.find(e=>e.type==='service-promoteToForeground-entry'&&e.scope===r.preparedWorkerId)?.request;assert(r.promotionRequest,'Missing promoted request');r.promotionRequestHash=hash(r.promotionRequest);r.cpuPairingRule='Compare only cases sharing exact promotionRequestHash and reached lifecycle state; equal initial fixture alone is insufficient';r.settingsAtPromotion=r.atRest.settings;r.optionsAtPromotion=r.atRest.options;
  phase='promoted-first-search';const remaining=Math.max(1,60000-(await page.evaluate(()=>performance.timeOrigin+performance.now())-promotion.at));const first=await wait(page,()=>!!cueLab.state.routeResult?.results?.length||cueLab.state.routeStatus==='done'||cueLab.state.routeStatus==='error',remaining);r.first=await state(page);assert.notEqual(r.first.status,'error','Promoted search runtime error: '+r.first.error);if(!first||!r.first.identities.length){r.primaryFirst=false;r.primaryRecallFailure=true;r.failures.push({phase:'primary-recall',error:'No verified identity within unchanged natural slice/60s; recall failure, not evidence of a stop-policy defect'});if(fixture==='moved3')r.continuationDiagnostic=await runContinuationDiagnostic(page,r);continue;}r.primaryFirst=true;r.primaryRecallFailure=false;const eligibleEvents=await audit(page),actualRequest=eligibleEvents.findLast(e=>e.type==='worker-dispatch'&&e.workerId===r.preparedWorkerId&&e.messageType==='request'&&e.at<=promotion.at),promoteEntry=eligibleEvents.find(e=>e.type==='service-promoteToForeground-entry'&&e.scope===r.preparedWorkerId),priorVerified=eligibleEvents.findLast(e=>e.type==='worker-post'&&e.scope===r.preparedWorkerId&&e.at>=actualRequest.at&&e.at<=promoteEntry.at&&e.identities?.length),firstVerified=eligibleEvents.find(e=>e.type==='worker-post'&&e.scope===r.preparedWorkerId&&e.at>=promoteEntry.at&&e.requestId===promotion.requestId&&e.identities?.length);r.firstEligibility={alreadyVerified:!!priorVerified,promotionEntry:promoteEntry.at,firstObserved:priorVerified?promoteEntry.at:firstVerified?.at,observationAt:r.first.at};assert(r.firstEligibility.firstObserved,'Missing exact first eligibility event');r.firstAt=r.firstEligibility.firstObserved;try{r.cpuEndpointPlan=processSampler.setWindow(r.firstAt,r.firstAt+8000,r.clockBefore);}catch(error){r.cpuEndpointPlan={armed:false,error:String(error.message||error).slice(0,600)};}r.postFirstCPUWindow={start:r.firstAt,end:r.firstAt+8000,rule:'Page/worker clock endpoints; map through before/after calibration envelope to independent processCPU host-monotonic acquisition intervals. Never filter host samples directly by these epoch-like numbers.'};r.firstRows=r.first.results;r.firstCount=r.first.identities.length;phase='post-first-8s';await page.waitForTimeout(Math.max(0,r.firstAt+8000-await page.evaluate(()=>performance.timeOrigin+performance.now())));r.postFirst=await state(page);await capture('post-first');
  const after=await audit(page);r.promotedServiceEvidence=after.filter(e=>e.scope===r.preparedWorkerId&&e.type.startsWith('service-'));r.postFirstEvaluateDispatches=after.filter(e=>e.type==='worker-dispatch'&&e.messageType==='evaluate'&&e.scope===r.preparedWorkerId&&e.at>r.firstAt);const serviceEnd=r.promotedServiceEvidence.at(-1);const liveEvaluation=new Map(),nestedLive=new Set(),terminatedScopes=after.filter(e=>e.type==='worker-terminate').map(e=>e.workerId),terminated=scope=>terminatedScopes.some(dead=>scope===dead||scope?.startsWith(dead+'.'));for(const e of [...after].sort((a,b)=>a.at-b.at)){if(!(e.scope===r.preparedWorkerId||e.scope?.startsWith(r.preparedWorkerId+'.')))continue;if(e.type==='evaluation-begin'&&!terminated(e.scope))liveEvaluation.set(e.scope+':'+e.id,e);if(['evaluation-finish','evaluation-dispose'].includes(e.type))liveEvaluation.delete(e.scope+':'+e.id);if(e.type==='worker-created'&&!terminated(e.workerId))nestedLive.add(e.workerId);if(e.type==='worker-terminate'){for(const id of nestedLive)if(id===e.workerId||id.startsWith(e.workerId+'.'))nestedLive.delete(id);for(const[k,v]of liveEvaluation)if(v.scope===e.workerId||v.scope.startsWith(e.workerId+'.'))liveEvaluation.delete(k);}}r.postFirstActiveLedger={evaluations:[...liveEvaluation.values()],nestedWorkers:[...nestedLive]};if(arm==='candidate'){assert.equal(r.postFirst.status,'done');r.completedCacheAlreadyIdle=!!priorVerified&&!promoteEntry.latest;assert(r.completedCacheAlreadyIdle||r.postFirst.termination==='first-verified-paused','Expected verified pause unless completed cache was already idle');assert.equal(r.postFirstEvaluateDispatches.length,0);assert(r.promotedServiceEvidence.filter(e=>e.type==='service-promoteToForeground-return').every(e=>e.requestUnchanged),'Promotion mutated admitted request');assert.equal(serviceEnd?.liveWorkers?.length,0,'Nested evaluation workers remain live');assert.equal(r.postFirstActiveLedger.evaluations.length,0,'Physical evaluations remain active');assert.equal(r.postFirstActiveLedger.nestedWorkers.length,0,'Nested lineage remains live');}for(const identity of r.first.identities)assert(r.postFirst.identities.includes(identity));
  phase='explicit-resume';await open(page);await page.locator('#tab-routes').click();r.preResumeStop=await measurement.stopIfSearching(page);r.resumeBase=await state(page);r.resumeAt=await page.evaluate(()=>performance.timeOrigin+performance.now());r.resumeStartHostMs=hostNow();await page.locator('#resumeSearch').click();r.resumeSlices=[];for(let slice=0;slice<4;slice++){const remain=100000-(hostNow()-r.resumeStartHostMs);if(remain<=0)break;const done=await wait(page,()=>cueLab.state.routeStatus!=='searching',Math.min(25000,remain)),s=await state(page);r.resumeSlices.push({slice,done,state:s});if(s.identities.some(x=>!r.resumeBase.identities.includes(x))||!done||!s.continuable||slice===3||hostNow()-r.resumeStartHostMs>=100000)break;await page.locator('#resumeSearch').click();}r.afterResume=await state(page);r.additionalIdentities=r.afterResume.identities.filter(x=>!r.resumeBase.identities.includes(x));r.additionalRecall=r.additionalIdentities.length>0;for(const identity of r.resumeBase.identities)assert(r.afterResume.identities.includes(identity));assert.deepEqual(r.afterResume.settings,r.settingsAtPromotion);assert.deepEqual(r.afterResume.options,r.optionsAtPromotion);
  r.resumeRetention=[];const resumeEvents=await audit(page);for(const entry of resumeEvents.filter(e=>e.scope===r.preparedWorkerId&&e.type==='service-resume-entry'&&e.at>=r.resumeAt)){const returned=resumeEvents.find(e=>e.scope===entry.scope&&e.type==='service-resume-return'&&e.at>=entry.at);assert(returned,'Missing Resume return');assert.equal(entry.searchId,returned.searchId,'Resume replaced search');assert.equal(entry.requestObjectId,returned.requestObjectId,'Resume replaced request');const keys=entry.completed||[],sameWave=entry.wave===returned.wave,committed=resumeEvents.some(e=>e.scope===entry.scope&&e.type==='service-completeWave-return'&&e.at>=entry.at&&e.at<=returned.at&&e.wave!==entry.wave);assert(keys.every(id=>sameWave&&returned.completed?.includes(id)||committed),'Completed outcomes lost without wave commit');const redispatched=resumeEvents.filter(e=>e.scope===entry.scope&&e.type==='worker-dispatch'&&e.messageType==='evaluate'&&e.at>entry.at&&keys.includes(e.jobId));assert.equal(redispatched.length,0,'Completed job dispatched again');r.resumeRetention.push({entry,returned,committed,redispatched});}assert(r.resumeRetention.length>0,'No observed service Resume entry');phase='stop-stale-restore';if(r.afterResume.status!=='searching'&&r.afterResume.continuable)await page.locator('#resumeSearch').click();r.finalStop=await measurement.stopIfSearching(page);r.actualStop=r.finalStop.clicked;if(!r.actualStop)r.uncovered.push('Actual Stop state not reached');r.beforeStale=await state(page);r.stale=await page.evaluate(id=>__promotionAudit.stale(id),r.preparedWorkerId);if(!r.stale.covered)r.uncovered.push('No provably stale old callback for final Stop');r.afterStale=await state(page);assert.deepEqual(r.afterStale.identities,r.beforeStale.identities,'Stale generation changed retained results');assert.deepEqual(r.afterStale.settings,r.beforeStale.settings);r.restoreReached=await wait(page,()=>!cueLab.state.predictionBusy&&!!cueLab.forecastReceipt,8000);r.restored=await state(page);assert(r.restoreReached,'Prediction not restored after Stop');r.restoreConsistency=await page.evaluate(()=>{const c=cueLab,q=c.forecastReceipt.request,a=c.lab.snapshot({trails:false});return __promotionAudit.captureValue({request:{...q,snapshot:{...q.snapshot,world:q.snapshot.world}},actual:{...a,world:a.world},key:c.requestKey,expectedKey:JSON.stringify([c.lab.steps,c.lab.revision,c.state.selectedId,c.state.settings,c.state.horizon,c.lab.params])});});assert.equal(hash(r.restoreConsistency.request.snapshot),hash(r.restoreConsistency.actual));assert.deepEqual(r.restoreConsistency.request.settings,r.restored.settings);assert.equal(r.restoreConsistency.request.selectedId,r.restored.selectedId);assert.equal(r.restoreConsistency.key,r.restoreConsistency.expectedKey);
  phase='independent-replay';r.replay=await page.evaluate(({request,rows,game})=>{request.snapshot.world=new Uint8Array(request.snapshot.world);return rows.map(row=>{const lab=PhysicsLab.fromSnapshot(RAPIER,request.snapshot),g=game.kind==='three'?new ThreeBallGame():new FourBallGame();try{g.restore(game);const before=g.scores[request.selectedId];lab.onEvent=e=>g.contact(e);g.begin(request.selectedId,{threeCushion:game.kind==='three'||!!request.options.fourBallThreeCushion});if(!lab.strike(request.selectedId,row.settings).ok)throw Error('Replay refused');let steps=0;while((lab.cue||lab.anyMotion())&&steps++<40000)lab.step();if(lab.cue||lab.anyMotion())throw Error('Replay not rested');g.finish();return {identity:LabRouteRules.successIdentity(row),scoreDelta:g.scores[request.selectedId]-before,steps,rested:true};}finally{lab.dispose();}});},{request:r.promotionRequest,rows:r.afterResume.results,game:r.atRest.game});assert(r.replay.length&&r.replay.every(v=>v.scoreDelta===1&&v.rested));phase='late-worker-cpu-capability-probe';  // Probe supported worker-target metrics separately; no profiler enabled.
  r.workerCPU={available:false,method:'Performance.getMetrics on dedicated worker target',reason:'Not yet attempted'};
  try{const targets=await cdp.send('Target.getTargets');assert(Array.isArray(targets.targetInfos)&&targets.targetInfos.length<=128,'Worker target count limit');for(const t of targets.targetInfos)assert(typeof t.targetId==='string'&&t.targetId.length<=256&&typeof t.url==='string'&&t.url.length<=8192,'Worker target metadata limit');r.workerCPU.probes=[];for(const target of targets.targetInfos.filter(t=>t.type==='worker')){const probe={targetId:target.targetId,url:target.url,method:'Performance.getMetrics'};r.workerCPU.probes.push(probe);let sessionId;try{({sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false}));const response=new Promise(resolve=>{const listener=e=>{if(e.sessionId===sessionId){let value;try{if(typeof e.message!=='string'||e.message.length>32768){recorder.fail('Worker metric message size limit');throw Error('Worker metric message size limit');}value=JSON.parse(e.message);if(value?.result?.metrics){assert(Array.isArray(value.result.metrics)&&value.result.metrics.length<=256,'Worker metric count limit');value=recorder.store.snapshot(value);}}catch(error){recorder.fail('Worker metric response incomplete');value={id:71,error:String(error)};}if(value?.id===71){clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);resolve(value);}}};const timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',listener);resolve({error:'Performance.getMetrics response timeout3000ms'});},3000);cdp.on('Target.receivedMessageFromTarget',listener);});await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:71,method:'Performance.getMetrics'})});probe.response=await response;}catch(e){probe.error=String(e);}finally{if(sessionId)await cdp.send('Target.detachFromTarget',{sessionId}).catch(()=>{});}}r.workerCPU.available=r.workerCPU.probes.some(p=>p.response?.result?.metrics?.length);r.workerCPU.reason='One-time capability probe only; no per-worker interval CPU attribution unless actual metrics establish it';}catch(e){recorder.fail('Worker capability probe incomplete');r.workerCPU.error=String(e);r.workerCPU.method='Target.getTargets';}
phase='settings-invalidation';r.beforeSettingsEdit=await state(page);await page.locator('#tab-shot').click();await page.locator('#angle').fill(String(r.beforeSettingsEdit.settings.angle+0.25));await page.locator('#angle').press('Enter');r.afterSettingsEdit=await state(page);assert.notEqual(r.afterSettingsEdit.settings.angle,r.beforeSettingsEdit.settings.angle);assert(!r.afterSettingsEdit.job||r.afterSettingsEdit.job.generation!==r.beforeSettingsEdit.job?.generation,'Settings retained old speculative job');r.settingsStale=await page.evaluate(id=>__promotionAudit.stale(id),r.preparedWorkerId);if(!r.settingsStale.covered)r.uncovered.push('No provably stale callback after settings edit');r.afterSettingsStale=await state(page);assert.deepEqual(r.afterSettingsStale.settings,r.afterSettingsEdit.settings);assert.deepEqual(r.afterSettingsStale.identities,r.afterSettingsEdit.identities);assert.equal(r.pageErrors.length,0);r.lifecycleCompleted=true;
 }catch(e){r.failures.push({phase,error:String(e),stack:e.stack});}finally{running=false;const stopped=processSampler?processSampler.stop():null;if(sampler)try{await deadline(()=>sampler,5000,'Page sampler shutdown');}catch(e){recorder.fail(String(e));r.failures.push({phase:'sampler-shutdown',error:String(e)});}if(stopped){r.processCPU=await stopped;r.cpuSamplerStats=processSampler.stats();}if(processCDP)try{await deadline(()=>processCDP.detach(),5000,'CPU CDP detach');}catch(e){recorder.fail(String(e));}try{r.clockAfter=await deadline(()=>measurement.calibrate({readPageEpoch:()=>page.evaluate(()=>performance.timeOrigin+performance.now())}),5000,'Final clock calibration');r.clockEnvelope=measurement.clockEnvelope(r.clockBefore,r.clockAfter);r.independentPostFirstCPU=measurement.windowEvidence(r.processCPU||[],r.firstAt,r.firstAt===undefined?undefined:r.firstAt+8000,r.clockEnvelope);}catch(e){r.clockCalibrationError=String(e);}try{await deadline(async()=>{await page.evaluate(()=>__promotionAudit.flushSources());r.events=await audit(page);r.events=r.events.map(e=>{if(e.source){const sourceSHA=hash(e.source);const {source,...rest}=e;return {...rest,sourceSHA,sourceBytes:Buffer.byteLength(source)};}return e;});r.final=await state(page);await capture('final');},10000,'Final bounded capture');}catch(e){recorder.fail('Final capture incomplete: '+String(e));r.failures.push({phase:'capture',error:String(e)});}r.workerErrors=r.events.filter(e=>e.type==='worker-error'||(['worker-post','worker-receive'].includes(e.type)&&(e.messageType==='error'||!!e.error)));if(r.workerErrors.length)r.failures.push({phase:'worker-errors',errors:r.workerErrors});if(r.pageErrors.length&&!r.failures.some(f=>f.phase==='page-errors'))r.failures.push({phase:'page-errors',errors:r.pageErrors});r.invalidCacheReconciliation={covered:false,reason:'Settings edit proves cancellation/stale isolation only; no forced mismatching cache reconciliation was performed'};for(const[key,value]of Object.entries(r)){if(['events','processCPU','cpu'].includes(key))continue;recorder.record('case-field',{key,value});}const recording=recorder.close(),summary=classifyCase(r,recording);summary.rawFile=id+'.raw.ndjson';writeCompact(path.join(out,id+'.summary.json'),summary);report.cases.push(summary);stopAfterRecordingFailure(report,summary);if(context)await deadline(()=>context.close(),5000,'Context close');writeCompact(path.join(out,'checkpoint-'+report.cases.length+'.json'),{fixture,cases:report.cases});console.log(JSON.stringify({type:'case-progress',id:summary.id,recordedCases:report.cases.length,functional:summary.functional.status,lifecycle:summary.lifecycle.status,recording:summary.recording.complete,cpuEligible:summary.cpu.eligible,primaryRecall:summary.recall.primaryStatus,additionalRecall:summary.recall.additionalStatus,fullRestReplayRows:summary.replay.primary.count,fatal:report.fatal||null}));}

}
}catch(e){report.fatal=String(e);}finally{if(browser)try{await deadline(()=>browser.close(),5000,'Browser close');}catch(e){report.fatal=report.fatal||String(e);}report.pairs=qualifiedPairs(report.cases);Object.assign(report,reportVerdicts(report));report.finished=new Date().toISOString();writeCompact(path.join(out,'summary.json'),report);console.log(JSON.stringify({ok:report.ok,functional:report.functional,cpu:report.cpu,cases:report.cases.map(r=>({id:r.id,ok:r.ok,firstCount:r.firstCount,additionalRecall:r.additionalRecall,lifecycle:r.lifecycle.status,functional:r.functional.status,recall:r.recall,recording:r.recording.complete,cpuEligible:r.cpu.eligible,failures:r.failures})),fatal:report.fatal},null,2));if(!report.exitOk)process.exitCode=1;}
})();


}
module.exports={assertPageRecordingReady,stopAfterRecordingFailure,deadline,inspectPreflight,verifyPreflight,preflightStatus,createCaseRecorder,reconstructCaseFields,collectAudit,startBoundedProcessSampler,classifyCase,qualifiedPairs,reportVerdicts,main};
if(require.main===module)main().catch(e=>{console.error(String(e.stack||e));process.exitCode=1;});
