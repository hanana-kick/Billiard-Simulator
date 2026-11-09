'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const support=fs.existsSync(path.join(__dirname,'audit.js'))?__dirname:path.resolve(__dirname,'../assembled/verification/promotion-stop-corrected');
const auditFile=path.join(support,'audit.js'),A=require(auditFile),C=require('./chrome.cjs');
const M=require(path.join(support,'measurement.cjs')),P=require(path.join(support,'cpu-preflight.cjs')),G=require(path.join(support,'check-preflight.cjs'));
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function output(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'prepared-comparison-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return path.join(d,'case.ndjson');}
function pageFor(store,events){return {evaluate:async(fn,arg)=>{const saved=global.__promotionAudit;global.__promotionAudit={read(offset){return {events:events.slice(offset,offset+32),next:Math.min(offset+32,events.length),total:events.length,status:store.status(),payloads:[...store.payloads.keys()]};},payloadPart(id,offset){const text=store.payloads.get(id);return {text:text.slice(offset,offset+8192),length:text.length};}};try{return fn(arg);}finally{global.__promotionAudit=saved;}}};}
function passingCase(){return {id:'default3-candidate-0',fixture:'default3',arm:'candidate',repeat:0,failures:[],uncovered:[],lifecycleCompleted:true,primaryFirst:true,additionalRecall:true,promotionRequestHash:'a'.repeat(64),postFirstCPUWindow:{start:100,end:8100},independentPostFirstCPU:{qualified:true,clock:{width:5},maxGapMs:100,maxAcquisitionMs:5,bracketWidthsMs:[110,110],inner:{cpuSecondsLowerBound:1},outer:{cpuSecondsLowerBound:2}}};}
test('imports are inert and CLI requires verified preflight before browser load',()=>{assert.throws(()=>C.verifyPreflight({}),/Missing PREFLIGHT_SUMMARY/);const code=fs.readFileSync(require.resolve('./chrome.cjs'),'utf8');assert(code.indexOf('const preflight=verifyPreflight()')<code.indexOf("const {chromium}=require"));});
test('synchronous SHA256 matches Node for empty, ASCII, Unicode, lone-surrogate, and multiblock inputs',()=>{const s=A.createCaptureStore();for(const v of ['', 'abc','한글😀','\ud800','x'.repeat(10000)])assert.equal(s.sha256(v),digest(v));});
test('typed world bytes round trip and immutable request deduplication uses SHA256',()=>{const s=A.createCaptureStore(),request={snapshot:{world:new Uint8Array([1,2,255])},options:{}};const a=s.capture({type:'dispatch',request}),b=s.capture({type:'promote',request});assert.deepEqual(a.request,b.request);assert.equal(s.payloads.size,1);request.snapshot.world[0]=99;assert.equal(JSON.parse(s.payloads.get(a.request.$payload)).snapshot.world[0],1);assert.notEqual(s.capture({request}).request.$payload,a.request.$payload);});
test('source deduplication preserves full original source once',()=>{const s=A.createCaptureStore();const source='OptimizerService\n'.repeat(100);const a=s.capture({source}),b=s.capture({source});assert.deepEqual(a.source,b.source);assert.equal(JSON.parse(s.payloads.get(a.source.$payload)),source);assert.equal(s.payloads.size,1);});
test('capture overflow is sticky and never truncates to a passing record',()=>{const s=A.createCaptureStore({maxEvents:1});assert(s.capture({a:1}));assert.equal(s.capture({a:2}),null);assert.equal(s.capture({a:3}),null);assert.equal(s.status().complete,false);assert.equal(s.status().events,1);});
test('bounded capture rejects huge arrays before visiting their elements',()=>{const s=A.createCaptureStore({maxArray:3});const a=[1,2,3,4];Object.defineProperty(a,0,{get(){throw Error('getter was visited');}});assert.equal(s.capture({a}),null);assert.match(s.status().failure,/array limit/);});
test('capture rejects cycles, accessors and nonfinite counters',()=>{for(const make of [()=>{const a={};a.a=a;return a;},()=>Object.defineProperty({},'x',{get(){throw Error('must not execute');},enumerable:true}),()=>({x:Infinity})]){const s=A.createCaptureStore();assert.equal(s.capture(make()),null);assert.equal(s.status().complete,false);}});
test('byte limits and payload import corruption fail closed',()=>{const s=A.createCaptureStore({maxValueBytes:20});assert.equal(s.capture({source:'x'.repeat(21)}),null);const x=A.createCaptureStore();assert.equal(x.importPayload('a'.repeat(64),'{}'),false);assert.equal(x.status().complete,false);});
test('incremental audit reads each event once and one decoded request is shared',async t=>{const file=output(t),rec=C.createCaseRecorder(file),store=A.createCaptureStore();const events=Array.from({length:70},(_,i)=>store.capture({type:'dispatch',at:i,request:{snapshot:{world:[1,2,3]},options:{}}}));const page=pageFor(store,events),cache=[];await C.collectAudit(page,rec,cache);assert.equal(cache.length,70);assert.strictEqual(cache[0].request,cache[69].request);await C.collectAudit(page,rec,cache);assert.equal(cache.length,70);const status=rec.close();assert.equal(status.complete,true);const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows.filter(r=>r.type==='audit-event').length,70);assert.equal(rows.filter(r=>r.type==='payload-part').length,1);});
test('payload chunks reassemble with original SHA256 and exact bytes',async t=>{const file=output(t),rec=C.createCaseRecorder(file),store=A.createCaptureStore();const source='/* 한글 */\n'.repeat(2000),event=store.capture({source});await C.collectAudit(pageFor(store,[event]),rec,[]);assert(rec.close().complete);const rows=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse),parts=rows.filter(x=>x.type==='payload-part'),text=parts.map(x=>x.text).join('');assert(parts.length>1);assert.equal(digest(text),event.source.$payload);assert.equal(JSON.parse(text),source);});
test('capture incompleteness propagates independently of lifecycle',async t=>{const rec=C.createCaseRecorder(output(t)),store=A.createCaptureStore({maxEvents:0});store.capture({type:'event'});await C.collectAudit(pageFor(store,[]),rec,[]);const status=rec.close(),s=C.classifyCase(passingCase(),status);assert.equal(s.lifecycle.pass,true);assert.equal(s.recording.complete,false);assert.equal(s.cpu.eligible,false);assert.equal(s.ok,false);});
test('failed writer preserves explicit incompleteness',t=>{const rec=C.createCaseRecorder(output(t),{writer:{append:()=>false,close(){},stats:()=>({complete:false,reason:'DISK_FULL'})}});assert.equal(rec.record('state',{x:1}),false);rec.setPageStatus({complete:true});assert.equal(rec.close().complete,false);assert.match(rec.status().failure,/DISK_FULL/);});
test('CPU sampling has no overlapping calls and enforces fixed 100ms cadence',async t=>{const rec=C.createCaseRecorder(output(t),{maxSamples:3});rec.setPageStatus({complete:true});let now=0,active=0,maxActive=0,calls=0;const sampler=C.startBoundedProcessSampler({recorder:rec,now:()=>now,sleep:async ms=>{assert.equal(ms,95);now+=ms;},cdp:{async send(){active++;maxActive=Math.max(maxActive,active);calls++;await Promise.resolve();now+=5;active--;return {processInfo:[{id:1,type:'browser',cpuTime:calls/10}]};}}});while(rec.samples.length<3)await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));await sampler.stop();assert.equal(calls,3);assert.equal(maxActive,1);assert.equal(rec.samples.length,3);assert.deepEqual(rec.samples.map(s=>s.start),[0,100,200]);assert.equal(rec.close().complete,false);assert.match(rec.status().failure,/sample count/);});
test('pending acquisition is not replaced and invalidates recording at shutdown',async t=>{const rec=C.createCaseRecorder(output(t));rec.setPageStatus({complete:true});let calls=0;const sampler=C.startBoundedProcessSampler({recorder:rec,cdp:{send(){calls++;return new Promise(()=>{});}}});await sampler.stop({timeoutMs:1});assert.equal(calls,1);assert.equal(rec.close().complete,false);assert.match(rec.status().failure,/pending/);});
test('CPU criterion is checked independently for every actual 8 second window',()=>{const r=passingCase(),recording={complete:true};assert.equal(C.classifyCase(r,recording).cpu.eligible,true);for(const [key,value]of [['maxGapMs',251],['maxAcquisitionMs',251],['bracketWidthsMs',[10,251]],['qualified',false]]){const copy=structuredClone(r);copy.independentPostFirstCPU[key]=value;const s=C.classifyCase(copy,recording);assert.equal(s.cpu.eligible,false);assert.equal(s.ok,false);assert.equal(s.cpu.claim,null);}r.postFirstCPUWindow.end--;assert.equal(C.classifyCase(r,recording).cpu.eligible,false);});
test('diagnostic success cannot overwrite primary miss or missing additional recall',()=>{const r=passingCase();r.primaryFirst=false;r.primaryRecallFailure=true;r.continuationDiagnostic={foundIdentity:true};r.failures.push({phase:'primary-recall',error:'miss'});const s=C.classifyCase(r,{complete:true});assert.equal(s.recall.primary,false);assert.equal(s.recall.diagnostic,true);assert.equal(s.cpu.eligible,false);assert.equal(s.ok,false);assert.equal(s.failures.length,1);});
test('pairing requires both qualified lifecycle states and exact promoted request hash',()=>{const a=C.classifyCase({...passingCase(),arm:'baseline'},{complete:true}),b=C.classifyCase(passingCase(),{complete:true});assert.equal(C.qualifiedPairs([a,b])[0].eligible,true);b.promotionRequestHash='b'.repeat(64);assert.equal(C.qualifiedPairs([a,b])[0].eligible,false);b.promotionRequestHash=a.promotionRequestHash;b.cpu.eligible=false;assert.equal(C.qualifiedPairs([a,b])[0].eligible,false);});
test('all reference assertion messages and fixed budgets remain',()=>{const reference=path.join(__dirname,'../reference/chrome.cjs'),old=fs.existsSync(reference)?fs.readFileSync(reference,'utf8'):fs.readFileSync(require.resolve('./chrome.cjs'),'utf8'),next=fs.readFileSync(require.resolve('./chrome.cjs'),'utf8');const messages=[...old.matchAll(/assert(?:\.\w+)?\([^;]*?,('(?:[^'\\]|\\.)*')\)/g)].map(x=>x[1]);assert(messages.length>20);for(const required of ['Wrong embedded ','Actual fixed-input shot did not score','Prepared worker lineage replaced','Natural reconcile invariants failed','Predicted/rest fixture cache mismatched','Original request goal unexpectedly set','Promotion mutated request goal','Wrong service-local promotion policy','Promotion mutated admitted request','Nested evaluation workers remain live','Physical evaluations remain active','Nested lineage remains live','Resume replaced search','Resume replaced request','Completed outcomes lost without wave commit','Completed job dispatched again','No observed service Resume entry','Stale generation changed retained results','Prediction not restored after Stop','Replay refused','Replay not rested','Settings retained old speculative job','Diagnostic replay refused','Diagnostic replay not rested'])assert(next.includes(required),required);for(const m of messages)assert(next.includes(m),m);for(const marker of ['forecast:15000','prepared:8000','restPromotion:60000','firstAfterPromotion:60000','postFirst:8000','resume:100000','resumeSlices:4','restore:8000','replaySteps:40000','cpuQualificationUncertaintyMs:250','diagnosticDeadlineMs:100000'])assert(next.includes(marker),marker);});
test('state polling is compact, original aggregate JSON writes removed',()=>{const s=fs.readFileSync(require.resolve('./chrome.cjs'),'utf8');assert(!s.includes('JSON.stringify(report'));assert(!s.includes('JSON.stringify(r,null'));assert(!s.includes('measurement.startProcessSampler'));assert(!s.includes('s=await state(page),metrics'));assert(s.includes(".record('milestone-state'"));assert(s.includes("recorder.record('case-field'"));});
// An actual worker is never constructed. This VM uses synchronous in-memory fakes.
function fakeRealm(){const context=vm.createContext({crypto:crypto.webcrypto,TextEncoder,TextDecoder,performance:{timeOrigin:1000,now:()=>5},Uint8Array,console});vm.runInContext(`class FakeBlob {constructor(parts){this.parts=parts;}}; class FakeWorker {constructor(){this.listeners={};this.posted=[];}addEventListener(t,fn){this.listeners[t]=fn;}postMessage(v){this.posted.push(v);}terminate(){}receive(data){this.listeners.message({data,stopImmediatePropagation(){}});}};globalThis.Blob=FakeBlob;globalThis.Worker=FakeWorker;globalThis.URL={createObjectURL:()=>"blob:"+Math.random()};`,context);vm.runInContext(fs.readFileSync(auditFile,'utf8'),context);return context;}
test('worker wrapper source injection preserves original and carries bounded factory',()=>{const c=fakeRealm();vm.runInContext(`const blob=new Blob(['class OptimizerService {}']);globalThis.injected=blob.parts.join('');globalThis.w=new Worker(URL.createObjectURL(blob));`,c);assert(c.injected.includes('class OptimizerService {}'));assert(c.injected.includes('function createCaptureStore'));assert.equal(vm.runInContext('__promotionAudit.store.status().complete',c),true);});
test('fake worker deduplicates source and request, captures stale callback at injection',()=>{const c=fakeRealm();vm.runInContext(`const b=new Blob(['class OptimizerService {}']);const w=new Worker(URL.createObjectURL(b));const req={snapshot:{world:[1,2,3]},options:{}};w.postMessage({type:'request',req});w.postMessage({type:'request',req});globalThis.cueLab={optimizer:{worker:w,version:2},nextShot:{}};let received=null;w.onmessage=e=>{received=e.data;};w.receive({type:'result',requestId:1,value:{results:[{a:1}]}});globalThis.staleResult=__promotionAudit.stale(w.__promotionId);globalThis.received=received;`,c);assert(c.staleResult.covered);assert.equal(c.received.requestId,1);assert.equal(vm.runInContext('__promotionAudit.store.status().complete',c),true);assert.equal(vm.runInContext('__promotionAudit.events.filter(e=>e.type==="worker-dispatch")[0].request.$payload===__promotionAudit.events.filter(e=>e.type==="worker-dispatch")[1].request.$payload',c),true);});
test('fake worker overflow is forwarded and invalidates root evidence',()=>{const c=fakeRealm();vm.runInContext(`const w=new Worker(URL.createObjectURL(new Blob(['class OptimizerService {}'])));w.receive({__promotionOverflow:true,reason:'worker raw overflow'});`,c);assert.equal(vm.runInContext('__promotionAudit.store.status().complete',c),false);});
test('representative 5 MiB worker source is recorded only as its full digest',async()=>{const c=fakeRealm();vm.runInContext(`globalThis.original='class OptimizerService {}\\n'+'x'.repeat(5*1024*1024);const blob=new Blob([original]);new Worker(URL.createObjectURL(blob));`,c);await vm.runInContext('__promotionAudit.flushSources()',c);vm.runInContext(`globalThis.sourceEvent=__promotionAudit.events.find(e=>e.type==='worker-source');`,c);assert.equal(c.sourceEvent.sourceSHA,digest(c.original));assert.equal(c.sourceEvent.sourceBytes,Buffer.byteLength(c.original));assert(!Object.hasOwn(c.sourceEvent,'source'));assert.equal(vm.runInContext('__promotionAudit.store.payloads.size',c),0);assert(JSON.stringify(c.sourceEvent).length<1000);assert.equal(vm.runInContext('__promotionAudit.store.status().complete',c),true);});
test('over-limit worker source is not silently accepted',()=>{const c=fakeRealm();vm.runInContext(`new Worker(URL.createObjectURL(new Blob(['class OptimizerService {}'+'x'.repeat(8*1024*1024)])));`,c);assert.equal(vm.runInContext('__promotionAudit.store.status().complete',c),false);});
test('worker bootstrap parses and propagates ready payloads without socket/worker use',()=>{const c=fakeRealm();vm.runInContext(`const blob=new Blob(['class OptimizerService {}']);globalThis.injected=blob.parts.join('');`,c);new vm.Script(c.injected);});
test('late callback after bounded teardown cannot turn failed evidence into a pass',async t=>{const rec=C.createCaseRecorder(output(t));rec.setPageStatus({complete:true});let resolve;const pending=new Promise(r=>{resolve=r;});await assert.rejects(C.deadline(()=>pending,1,'fake page sampler'),/no replacement query/);rec.fail('Page sampler shutdown incomplete');assert.equal(rec.close().complete,false);resolve();await pending;assert.equal(rec.record('late',{x:1}),false);assert.equal(C.classifyCase(passingCase(),rec.status()).ok,false);});
test('terminal payload cap failure returns no accepted event',()=>{const store=A.createCaptureStore({maxPayloads:0});assert.equal(store.capture({request:{options:{},snapshot:{world:[1]}}}),null);assert.equal(store.status().complete,false);});
test('terminal worker payload failure emits overflow even with no later app message',()=>{const sent=[];const context=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Uint8Array,performance:{timeOrigin:100,now:()=>1},postMessage:value=>sent.push(value),onmessage(){},URL:{createObjectURL:()=>''},Worker:class{},Blob:class{}});vm.runInContext(`globalThis.module={exports:{}};${fs.readFileSync(auditFile,'utf8')}\nmodule.exports.installPromotionAudit('w',true,()=>module.exports.createCaptureStore({maxPayloads:0}));onmessage({data:{__promotionInit:true,scope:'page.w1'}});class DummyService{};`,context);
 // The injected worker API emits request summaries through the same send path.
 vm.runInContext(`const b=new Blob(['class OptimizerService {}']);`,context); // No actual Worker/browser.
 // Use a real service wrapper in a second realm so its final promotion event
 // attempts to capture a request after its payload budget is exhausted.
 const code=fs.readFileSync(auditFile,'utf8'),c=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Uint8Array,performance:{timeOrigin:100,now:()=>1},postMessage:value=>sent.push(value),onmessage(){},URL:{createObjectURL:()=>''},Worker:class{},Blob:class{}});
 vm.runInContext(`globalThis.module={exports:{}};${code}\nclass OptimizerService {constructor(){this.latest={snapshot:{world:[1]},options:{}};}promoteToForeground(){return true;}};globalThis.OptimizerService=OptimizerService;module.exports.installPromotionAudit('w',true,()=>module.exports.createCaptureStore({maxPayloads:0}));onmessage({data:{__promotionInit:true,scope:'page.w2'}});new OptimizerService().promoteToForeground();`,c);
 assert(sent.some(x=>x.__promotionOverflow&&x.scope==='page.w2'));assert(!sent.some(x=>x.scope==='page.w2'&&x.type==='service-promoteToForeground-entry'&&x.request?.$missing));
});
test('unresolved source hash prevents otherwise complete recording',t=>{const rec=C.createCaseRecorder(output(t));rec.setPageStatus({complete:true,pendingSources:1});assert(rec.record('marker',{x:1}));assert.equal(rec.close().complete,false);assert.match(rec.status().failure,/Unresolved worker source/);});
test('native worker construction does not wait for full-source digest',async()=>{const c=fakeRealm();let resolveDigest,calls=0;const pending=new Promise(resolve=>{resolveDigest=resolve;});c.crypto={subtle:{digest(){calls++;return pending;}}};vm.runInContext(`const b=new Blob(['class OptimizerService {}']);globalThis.createdWorker=new Worker(URL.createObjectURL(b));globalThis.beforeDigest=__promotionAudit.read(0).status;`,c);assert(c.createdWorker);assert.equal(c.beforeDigest.complete,true);assert.equal(c.beforeDigest.pendingSources,1);assert.equal(calls,0,'Digest must be scheduled after native Worker construction');await Promise.resolve();assert.equal(calls,1);const bytes=crypto.createHash('sha256').update('class OptimizerService {}').digest();resolveDigest(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));await vm.runInContext('__promotionAudit.flushSources()',c);assert.equal(vm.runInContext('__promotionAudit.read(0).status.pendingSources',c),0);});
test('repeated source URLs after a cap failure do not grow pending metadata',async()=>{const c=fakeRealm();c.crypto={subtle:{digest:()=>new Promise(()=>{})}};vm.runInContext(`const b=new Blob(['class OptimizerService {}']);for(let i=0;i<300;i++)URL.createObjectURL(b);globalThis.capStatus=__promotionAudit.read(0).status;`,c);assert.equal(c.capStatus.complete,false);assert.equal(c.capStatus.pendingSources,128);assert.match(c.capStatus.failure,/URL count/);});
test('source creation before worker identity fails closed before allocating an ambiguous source ID',()=>{const sent=[],c=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Uint8Array,performance:{timeOrigin:100,now:()=>1},postMessage:value=>sent.push(value),onmessage(){},URL:{createObjectURL:()=>''},Worker:class{},Blob:class{}});vm.runInContext(`globalThis.module={exports:{}};${fs.readFileSync(auditFile,'utf8')}\nmodule.exports.installPromotionAudit('pending',true);URL.createObjectURL(new Blob(['class OptimizerService {}']));onmessage({data:{__promotionInit:true,scope:'page.w1'}});`,c);assert(sent.some(x=>x.__promotionOverflow&&/unique audit identity/.test(x.reason)));assert(!sent.some(x=>x.type==='worker-source-pending'));});
test('terminated child leaves pending source proof unresolved at final capture',async()=>{const c=fakeRealm();vm.runInContext(`const w=new Worker(URL.createObjectURL(new Blob(['class OptimizerService {}'])));w.receive({__promotionAudit:true,type:'worker-source-pending',sourceId:'page.w1.source1',sourceBytes:100,scope:'page.w1',at:1});w.terminate();`,c);await vm.runInContext('__promotionAudit.flushSources()',c);assert.equal(vm.runInContext('__promotionAudit.read(0).status.pendingSources',c),1);});

// Portable small fixture reproduces the late-only endpoint miss without a
// browser, sockets, a remote artifact download, or timing-sensitive wall clocks.
function syntheticPreflight({qualified=false}={}){
 const browser={product:'Chrome/fixture',revision:'fixture',jsVersion:'1',protocolVersion:'1.3'};
 const samples=Array.from({length:96},(_,i)=>({type:'sample',phase:i<10?'idle':i<93?'load':'post',start:1000+i*100,end:1005+i*100+(i===91&&!qualified?46:0),processes:[{id:'1',type:'browser',cpuTime:i/100}]}));
 const calibration=start=>{const rounds=Array.from({length:5},(_,i)=>{const a=start+i*2,end=a+1,pageEpoch=1000000+end;return {start:a,end,pageEpoch,low:1000000,high:1000001,width:1};});return {rounds,best:rounds[0]};};
 const clockBefore=calibration(900),clockAfter=calibration(10600),clock=M.clockEnvelope(clockBefore,clockAfter),load={workers:4,durationRequestedMs:8000,description:'10 ms numerical work / 30 ms yield, at most 4 generic workers; not Rapier or app search',observedPageMs:8000,startEpoch:1002001,endEpoch:1010001,workersRemaining:0};
 const raw=[{type:'metadata',browser},...samples].map(x=>JSON.stringify(x)+'\n').join(''),window=P.compactWindow(M.windowEvidence(samples,load.startEpoch,load.endEpoch,clock));
 assert.equal(window.qualified,qualified);
 return {raw,summary:{schema:'promotion-cpu-capability-v1',kind:'generic-worker-load-capability-only',pass:qualified,criterionMs:250,actualAppQualified:false,actualComparisonsStarted:0,phase:qualified?'capability-qualified':'failed',failure:qualified?null:'Loaded CPU window failed unchanged 250 ms qualification',shutdown:{detached:true,closed:true},limits:P.LIMITS,startupTiming:['Chrome launch','Context creation','Page creation','Blank page','Independent browser CDP session'].map(stage=>({stage,ms:100,completed:true})),browser,clockBefore,load,clockAfter,clockEnvelope:{low:clock.low,high:clock.high,width:clock.width,qualified:clock.qualified,driftIntervalMs:clock.driftIntervalMs},window,processDiagnostics:{exits:[],newIds:[],resets:[],invalidCounters:[]},recording:{complete:true,bytes:Buffer.byteLength(raw),records:97,failures:0,reason:null,closed:true},sampleCount:96,acquisitionPendingAtFailure:false,wallMs:10000,limitsAndCaveats:['Capability pass is not actual-app or paired-CPU qualification.','CPU values are observed shared-process lower bounds, not total CPU savings.','Exited-process final increments and same-type PID reuse can remain unknown.','No actual comparison is started even on a pass.'],source:{gitCommit:'a'.repeat(40),runId:'42568936991',runAttempt:'1',measurementSHA256:G.MEASUREMENT_SHA256},rawSHA256:digest(raw)}};
}
function preflightFiles(t,{qualified=false,real=false,mutate}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'separate-preflight-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const realDir=path.resolve(__dirname,'../results',typeof real==='string'?real:'42568936991');let fixture=real&&fs.existsSync(path.join(realDir,'summary.json'))?{summary:JSON.parse(fs.readFileSync(path.join(realDir,'summary.json'),'utf8')),raw:fs.readFileSync(path.join(realDir,'samples.ndjson'),'utf8')}:syntheticPreflight({qualified});
 if(mutate)mutate(fixture);const summary=path.join(dir,'summary.json'),raw=path.join(dir,'samples.ndjson');fs.writeFileSync(summary,JSON.stringify(fixture.summary)+'\n');fs.writeFileSync(raw,fixture.raw);
 return {dir,fixture,env:{PREFLIGHT_SUMMARY:summary,PREFLIGHT_RAW:raw,GITHUB_SHA:fixture.summary.source.gitCommit,GITHUB_RUN_ID:fixture.summary.source.runId,GITHUB_RUN_ATTEMPT:fixture.summary.source.runAttempt,VALIDATION_MODE:'functional-with-separate-cpu'}};
}
function updateRaw(fixture,mutate){const rows=fixture.raw.trimEnd().split('\n').map(JSON.parse);mutate(rows);fixture.raw=rows.map(x=>JSON.stringify(x)+'\n').join('');fixture.summary.rawSHA256=digest(fixture.raw);fixture.summary.recording.bytes=Buffer.byteLength(fixture.raw);fixture.summary.recording.records=rows.length;fixture.summary.sampleCount=rows.length-1;}
test('real failed preflight (portable fallback) is functionally ready but CPU remains failed',t=>{
 const {env}=preflightFiles(t,{real:true}),s=C.inspectPreflight(env);assert.equal(s.evidenceValid,true);assert.equal(s.functionalReady,true);assert.equal(s.cpuQualified,false);assert.equal(s.capabilityQualified,false);assert.equal(s.actualAppQualified,false);assert.equal(s.preflightPass,false);assert.equal(s.preflightPhase,'failed');assert.equal(s.cpuTimingOnlyFailure,true);assert.equal(s.sampleCount,96);assert.deepEqual(s.failedCriteria.map(x=>x.criterion),['end-bracket']);assert(s.failedCriteria[0].valueMs>250);assert.equal(C.verifyPreflight(env).preflightPass,false);
 assert.throws(()=>C.verifyPreflight({...env,VALIDATION_MODE:'strict'}),/gate closed/);assert.equal(C.inspectPreflight({...env,VALIDATION_MODE:'strict'}).functionalReady,false);assert.throws(()=>C.verifyPreflight({...env,VALIDATION_MODE:undefined}),/gate closed/);
});
test('synthetic late-only timing failure also validates without optional artifacts',t=>{const {env}=preflightFiles(t);assert.deepEqual(C.inspectPreflight(env).failedCriteria,[{criterion:'end-bracket',valueMs:251,limitMs:250}]);});
test('qualified generic preflight retains scope and does not qualify actual app',t=>{const {env}=preflightFiles(t,{qualified:true}),s=C.verifyPreflight({...env,VALIDATION_MODE:'strict'});assert.equal(s.functionalReady,true);assert.equal(s.cpuQualified,true);assert.equal(s.actualAppQualified,false);assert.deepEqual(s.failedCriteria,[]);});
test('source, run and attempt binding mismatches fail closed',t=>{const {env}=preflightFiles(t);for(const patch of [{GITHUB_SHA:'b'.repeat(40)},{GITHUB_RUN_ID:'2'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ID:''},{VALIDATION_MODE:'ignore-failure'}]){assert.throws(()=>C.inspectPreflight({...env,...patch}));assert.equal(C.preflightStatus({...env,...patch}).result.functionalReady,false);}});
test('missing and tampered raw evidence fails closed before browser use',t=>{
 const {env}=preflightFiles(t);fs.appendFileSync(env.PREFLIGHT_RAW,'{}\n');assert.throws(()=>C.inspectPreflight(env),/Raw byte count mismatch/);fs.unlinkSync(env.PREFLIGHT_RAW);assert.throws(()=>C.inspectPreflight(env),/ENOENT/);fs.unlinkSync(env.PREFLIGHT_SUMMARY);assert.throws(()=>C.inspectPreflight(env),/ENOENT/);
});
test('unknown failures, startup faults, cleanup loss and forged qualification fail closed',t=>{
 for(const mutate of [s=>s.failure='Unknown generic worker error',s=>s.phase='startup-failed',s=>s.startupTiming[2].completed=false,s=>s.startupTiming.pop(),s=>s.startupTiming[0].ms=15001,s=>s.startupTiming.forEach(v=>v.ms=5000),s=>s.shutdown.closed=false,s=>s.shutdown.detachError='lost transport',s=>s.recording.closed=false,s=>s.recording.complete=false,s=>s.recording.failures=1,s=>s.acquisitionPendingAtFailure=true,s=>s.wallMs=30001,s=>s.pass=true,s=>s.window.qualified=true,s=>s.window.bracketWidthsMs[1]=250,s=>s.source.measurementSHA256='b'.repeat(64),s=>s.unknownError='fatal',s=>s.sampleCount--,s=>s.limits={...s.limits,criterionMs:251},s=>s.load.workersRemaining=1]){
  const {env}=preflightFiles(t,{mutate:f=>mutate(f.summary)});assert.throws(()=>C.inspectPreflight(env));const x=C.preflightStatus(env);assert.equal(x.result.functionalReady,false);assert.equal(x.result.cpuQualified,false);assert.equal(x.exitCode,1);
 }
});
test('rehashing malformed, lost or unknown raw records cannot make them acceptable',t=>{
 for(const change of [rows=>rows.splice(1,1),rows=>rows[1].error='CDP lost',rows=>rows[1].processes[0].unknown='hidden',rows=>rows[1].processes[0].cpuTime=-1,rows=>rows[1].phase='post',rows=>rows[2].start=rows[1].start,rows=>rows[0].browser.product='Chrome/forged',rows=>rows[1].processes=[],rows=>rows.at(-1).type='unexpected']){
  const {env}=preflightFiles(t,{mutate:f=>updateRaw(f,change)});assert.throws(()=>C.inspectPreflight(env));
 }
});
test('CLI status is bounded JSON and workflow booleans, never loading Playwright',t=>{
 const {env,dir}=preflightFiles(t),output=path.join(dir,'output'),status=C.preflightStatus({...env,GITHUB_OUTPUT:output});assert.equal(status.exitCode,0);assert(Buffer.byteLength(status.json)<=8192);assert.deepEqual(fs.readFileSync(output,'utf8'),'functional_ready=true\ncpu_qualified=false\n');
 const {spawnSync}=require('node:child_process'),modulePath=require.resolve('./chrome.cjs');
 const guard=`const Module=require('node:module'),old=Module._load;Module._load=function(id,...args){if(/playwright|^(node:)?(net|http|https|child_process)$/.test(id))throw Error('Prohibited browser/socket load: '+id);return old.call(this,id,...args)};process.argv.push('--preflight-status');require(${JSON.stringify(modulePath)}).main().catch(e=>{console.error(e);process.exitCode=1});`;
 const child=spawnSync(process.execPath,['-e',guard],{env:{...process.env,...env,GITHUB_OUTPUT:path.join(dir,'cli-output')},encoding:'utf8'});assert.equal(child.status,0,child.stderr);const json=JSON.parse(child.stdout);assert.equal(json.functionalReady,true);assert.equal(json.cpuQualified,false);assert.equal(json.actualComparisonsStarted,0);assert.equal(fs.readFileSync(path.join(dir,'cli-output'),'utf8'),'functional_ready=true\ncpu_qualified=false\n');
 const strict=spawnSync(process.execPath,[modulePath,'--preflight-status'],{env:{...process.env,...env,VALIDATION_MODE:'strict',GITHUB_OUTPUT:path.join(dir,'strict-output')},encoding:'utf8'});assert.equal(strict.status,1);assert.equal(JSON.parse(strict.stdout).functionalReady,false);
});
test('actual window qualification stays independent in both directions',t=>{
 const {env}=preflightFiles(t),preflight=C.inspectPreflight(env);assert.equal(preflight.cpuQualified,false);
 const good=C.classifyCase({...passingCase(),preflight},{complete:true});assert.equal(good.functional.pass,true);assert.equal(good.cpu.eligible,true);
 const passedPreflight={...preflight,cpuQualified:true};for(const change of [r=>delete r.independentPostFirstCPU,r=>r.independentPostFirstCPU.bracketWidthsMs[1]=250.0001,r=>r.independentPostFirstCPU.maxAcquisitionMs=251,r=>r.independentPostFirstCPU.maxGapMs=251,r=>r.independentPostFirstCPU.clock.width=251,r=>r.postFirstCPUWindow.end=8101]){const r={...passingCase(),preflight:passedPreflight};change(r);const c=C.classifyCase(r,{complete:true});assert.equal(c.functional.pass,true);assert.equal(c.cpu.eligible,false);assert.equal(c.ok,false);assert.equal(c.cpu.claim,null);}
});
test('missing recall and unreachable lifecycle remain separate from CPU ineligibility',()=>{
 const r=passingCase();r.primaryFirst=undefined;r.additionalRecall=undefined;r.lifecycleCompleted=false;r.uncovered.push('Natural prepared coordinator not reached');delete r.independentPostFirstCPU;const c=C.classifyCase(r,{complete:true});assert.equal(c.lifecycle.status,'unreached');assert.equal(c.functional.status,'unreached');assert.equal(c.recall.primaryStatus,'unreached');assert.equal(c.recall.additionalStatus,'unreached');assert.equal(c.cpu.status,'ineligible');assert.equal(c.ok,false);assert.equal(c.lifecycle.uncovered.length,1);
 r.primaryFirst=false;r.primaryRecallFailure=true;r.failures.push({phase:'primary-recall',error:'primary deadline miss'});r.continuationDiagnostic={foundIdentity:true};const failed=C.classifyCase(r,{complete:true});assert.equal(failed.functional.status,'failed');assert.equal(failed.recall.primaryStatus,'failed');assert.equal(failed.recall.additionalStatus,'unreached');assert.equal(failed.lifecycle.status,'unreached');assert.equal(failed.failures.length,1);
});
test('report keeps functional success, CPU ineligibility and exit policy separate',()=>{
 const cases=Array.from({length:8},(_,i)=>{const r={...passingCase(),id:'case-'+i,arm:i%2?'candidate':'baseline',repeat:Math.floor(i/2)};r.independentPostFirstCPU.bracketWidthsMs=[10,251];return C.classifyCase(r,{complete:true});});
 const report={cases,preflight:{mode:'functional-with-separate-cpu',cpuQualified:false}},v=C.reportVerdicts(report);assert.equal(v.functional.pass,true);assert.equal(v.cpu.qualified,false);assert.equal(v.ok,false);assert.equal(v.exitOk,true);assert.equal(v.cpu.claim,null);assert.equal(C.reportVerdicts({...report,preflight:{mode:'strict'}}).exitOk,false);
 const empty=C.reportVerdicts({cases:[],preflight:report.preflight});assert.equal(empty.functional.status,'unreached');assert.equal(empty.functional.unreachedCases,8);assert.equal(empty.cpu.qualified,false);assert.equal(empty.exitOk,false);
 const failed={...passingCase(),additionalRecall:false};cases[0]=C.classifyCase(failed,{complete:true});const miss=C.reportVerdicts(report);assert.equal(miss.functional.pass,false);assert.equal(miss.exitOk,false);assert.equal(miss.functional.failedCases,1);
});

function recomputeLoadVerdict(fixture){
 const s=fixture.summary,samples=fixture.raw.trimEnd().split('\n').map(JSON.parse).filter(x=>x.type==='sample');
 s.load.observedPageMs=s.load.endEpoch-s.load.startEpoch;s.window=P.compactWindow(M.windowEvidence(samples,s.load.startEpoch,s.load.endEpoch,M.clockEnvelope(s.clockBefore,s.clockAfter)));
 s.pass=s.window.qualified;s.phase=s.pass?'capability-qualified':'failed';s.failure=s.pass?null:'Loaded CPU window failed unchanged 250 ms qualification';
}
test('unchanged raw hash cannot support load endpoints shifted outside producer chronology',t=>{
 for(const real of [false,true])for(const shift of [-900,150]){
  let originalRaw,originalDigest;
  const {env,fixture}=preflightFiles(t,{real,mutate:f=>{originalRaw=f.raw;originalDigest=f.summary.rawSHA256;f.summary.load.startEpoch+=shift;f.summary.load.endEpoch+=shift;recomputeLoadVerdict(f);assert.equal(f.summary.pass,true,'Exploit should otherwise recompute as a qualified window');}});
  assert.equal(fixture.raw,originalRaw);assert.equal(fixture.summary.rawSHA256,originalDigest);
  assert.throws(()=>C.inspectPreflight(env),/Load start contradicts raw idle\/load chronology/);
  const status=C.preflightStatus(env);assert.equal(status.result.functionalReady,false);assert.equal(status.result.cpuQualified,false);
 }
});
test('wall time cannot understate the complete recorded calibration and sample trace',t=>{
 for(const real of [false,true])for(const wallMs of [0,9000]){
  const {env}=preflightFiles(t,{real,mutate:f=>{f.summary.wallMs=wallMs;recomputeLoadVerdict(f);}});
  assert.throws(()=>C.inspectPreflight(env),/Wall time shorter than recorded/);
 }
});
test('historical qualified and failed artifacts both preserve their original verdicts',t=>{
 for(const [real,qualified]of [['42561360368',true],['42568936991',false]]){
  const {env}=preflightFiles(t,{real,qualified}),status=C.inspectPreflight(env);assert.equal(status.functionalReady,true);assert.equal(status.cpuQualified,qualified);assert.equal(status.preflightPass,qualified);
 }
});
test('8300 ms producer loop rejects impossible phase timing despite internally recomputed windows',t=>{
 const {env}=preflightFiles(t,{mutate:f=>{updateRaw(f,rows=>{for(const r of rows)if(r.type==='sample'&&r.phase==='post'){r.start-=50;r.end-=50;}});recomputeLoadVerdict(f);}});
 assert.throws(()=>C.inspectPreflight(env),/8300 ms producer loop/);
});

// BEGIN ENDPOINT-AWARE SAMPLER CONTRACTS
// Append inside the existing comparison-contract.test.cjs after its other tests.
// Uses its existing test/assert/fs/path/C bindings. No additional remote file.
{
const start = C.startBoundedProcessSampler;
const M = require(fs.existsSync(path.join(__dirname, 'measurement.cjs'))
  ? './measurement.cjs' : '../verification/promotion-stop-corrected/measurement.cjs');
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function virtualTime() {
  let time = 0, serial = 0;
  const timers = new Map();
  function sleep(ms, { signal } = {}) {
    return new Promise(resolve => {
      const id = ++serial;
      const finish = () => { timers.delete(id); signal?.removeEventListener('abort', finish); resolve(); };
      if (signal?.aborted) return finish();
      timers.set(id, { at: time + ms, finish });
      signal?.addEventListener('abort', finish, { once: true });
    });
  }
  async function advanceTo(target) {
    assert(target >= time);
    await tick();
    let steps = 0;
    while (true) {
      const due = [...timers.values()].filter(x => x.at <= target).sort((a,b) => a.at-b.at)[0];
      if (!due) break;
      assert(++steps < 10000, 'bounded virtual scheduler');
      time = due.at; due.finish(); await tick();
    }
    time = target; await tick();
  }
  const setTimer = (fn, ms) => { const id = ++serial; timers.set(id, { at: time + ms, finish() { timers.delete(id); fn(); } }); return id; };
  const clearTimer = id => timers.delete(id);
  return { now: () => time, sleep, advanceTo, timers, setTimer, clearTimer };
}
function recorder(maxSamples = 6000) {
  const r = { samples: [], records: [], maxSamples, failure: null };
  r.fail = value => { r.failure ||= value; return false; };
  r.record = (type, value) => { if (r.failure) return false; r.records.push({ type, value: structuredClone(value) }); return true; };
  r.sample = row => { if (r.failure) return false; if (r.samples.length >= maxSamples) return r.fail('sample limit');
    r.samples.push(structuredClone(row)); return r.record('process-cpu', row); };
  return r;
}
function harness({ duration = () => 5, maxSamples = 6000, result = null } = {}) {
  const clock = virtualTime(), rec = recorder(maxSamples), calls = [];
  let active = 0, maxActive = 0;
  const sampler = start({ recorder: rec, now: clock.now, sleep: clock.sleep, setTimer: clock.setTimer, clearTimer: clock.clearTimer, cdp: {
    async send(method) {
      assert.equal(method, 'SystemInfo.getProcessInfo');
      const entry = { start: clock.now() }; calls.push(entry); active++; maxActive = Math.max(active, maxActive);
      await clock.sleep(duration(entry.start, calls.length));
      active--; entry.end = clock.now();
      return result || { processInfo: [{ id: 1, type: 'browser', cpuTime: clock.now() / 1000 }] };
    },
  } });
  return { clock, rec, calls, sampler, maxActive: () => maxActive };
}
const before = (low = 0, high = 0) => ({ best: { low, high } });
async function stop(h, timeoutMs = 5000) {
  const result = h.sampler.stop({ timeoutMs }); await tick(); return result;
}

test('no registered window: original 100 ms starts, single owner, no remaining timers', async () => {
  const h = harness(); await h.clock.advanceTo(350); await stop(h);
  assert.deepEqual(h.calls.map(c => c.start), [0,100,200,300]);
  assert.equal(h.maxActive(), 1); assert.equal(h.sampler.stats().counts.extra, 0);
  assert.equal(h.clock.timers.size, 0);
});
test('exactly two predeclared end queries preserve normal cadence and qualify synthetic window', async () => {
  const h = harness(); await h.clock.advanceTo(20);
  const plan = h.sampler.setWindow(50, 8050, before());
  assert.equal(plan.registeredAt, 20); assert.equal(plan.startAlreadyElapsed, false);
  assert.deepEqual(plan.hints.map(x => x.targetAt), [7975,8075]);
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.sampler.stats().counts.extra, 2);
  assert.deepEqual(h.calls.filter(c => c.start % 100 !== 0).map(c => c.start), [7975,8075]);
  assert.deepEqual(h.calls.filter(c => c.start % 100 === 0).map(c => c.start), Array.from({length:83},(_,i)=>i*100));
  assert.equal(h.maxActive(), 1); assert.equal(h.sampler.stats().counts.overlap, 0);
  assert.equal(h.clock.timers.size, 0);
  const clock = M.clockEnvelope(before(), before());
  assert.equal(M.windowEvidence(h.rec.samples,50,8050,clock).qualified,true);
});
test('unknown clock disables hints without failing normal sampling', async () => {
  const h = harness(); await h.clock.advanceTo(20);
  const plan = h.sampler.setWindow(50,8050,null);
  assert.equal(plan.armed,false); assert.match(plan.reason,/unknown/);
  await h.clock.advanceTo(250); await stop(h);
  assert.equal(h.rec.failure,null); assert.equal(h.sampler.stats().counts.extra,0);
  assert.deepEqual(h.calls.map(c=>c.start),[0,100,200]);
});
test('wide, reversed and nonfinite before clocks cannot arm hints', async () => {
  for (const c of [before(0,251),before(1,0),before(NaN,0),before(0,Infinity)]) {
    const h=harness(); await h.clock.advanceTo(10);
    assert.equal(h.sampler.setWindow(50,8050,c).armed,false); await stop(h);
    assert.equal(h.rec.failure,null);
  }
});
test('wrong duration is recorded and does not create a replacement window', async () => {
  const h=harness(); await h.clock.advanceTo(10);
  assert.equal(h.sampler.setWindow(50,8051,before()).accepted,false);
  assert.throws(()=>h.sampler.setWindow(50,8050,before()),/already registered/); await stop(h);
});
test('late registration never retroactively issues elapsed hints', async () => {
  const h=harness(); await h.clock.advanceTo(8100);
  const plan=h.sampler.setWindow(50,8050,before());
  assert.equal(plan.startAlreadyElapsed,true); assert.equal(plan.registeredAt,8100);
  assert.deepEqual(h.sampler.stats().hints.map(x=>[x.state,x.reason]),[
    ['missed','target-precedes-registration'],['missed','target-precedes-registration']]);
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.sampler.stats().counts.extra,0); assert.equal(h.sampler.stats().counts.missed,2);
});
test('registration just after pre-hint misses it even inside lateness allowance', async () => {
  const h=harness(); await h.clock.advanceTo(7980);
  h.sampler.setWindow(50,8050,before());
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.sampler.stats().counts.extra,1);
  assert.equal(h.sampler.stats().hints[0].reason,'target-precedes-registration');
  assert.equal(h.sampler.stats().hints[1].state,'issued');
});
test('duplicate or changed registration cannot add queries or raw records', async () => {
  const h=harness(); await h.clock.advanceTo(10);
  h.sampler.setWindow(50,8050,before()); const count=h.rec.records.length;
  for(let i=0;i<100;i++) assert.throws(()=>h.sampler.setWindow(50+i,8050+i,before()),/replacement forbidden/);
  assert.equal(h.rec.records.length,count); await stop(h);
});
test('normal query wins a coincident hint and retains its next scheduled time', async () => {
  const h=harness(); await h.clock.advanceTo(10);
  h.sampler.setWindow(75,8075,before()); // Targets 8000 and 8100 exactly.
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.sampler.stats().counts.extra,0);
  assert.equal(h.sampler.stats().counts.coalesced,2);
  assert.equal(h.calls.filter(c=>c.start===8000).length,1);
  assert.equal(h.calls.filter(c=>c.start===8100).length,1);
});
test('multiple hints during one pending query expire without a catch-up burst', async () => {
  const h=harness({duration:at=>at===7900?300:5}); await h.clock.advanceTo(10);
  h.sampler.setWindow(50,8050,before()); await h.clock.advanceTo(8305); await stop(h);
  assert.equal(h.sampler.stats().counts.extra,0); assert.equal(h.sampler.stats().counts.missed,2);
  assert(h.sampler.stats().hints.every(x=>x.reason==='acquisition-pending-at-target'));
  assert.deepEqual(h.calls.filter(c=>c.start>=7900).map(c=>c.start),[7900,8200,8300]);
  assert.equal(h.maxActive(),1);
});
test('endpoint query may delay but cannot starve an already-due normal poll', async () => {
  const h=harness({duration:at=>at===7975?140:5}); await h.clock.advanceTo(10);
  h.sampler.setWindow(50,8050,before()); await h.clock.advanceTo(8220); await stop(h);
  assert.deepEqual(h.calls.filter(c=>c.start>=7900).map(c=>c.start),[7900,7975,8115,8215]);
  assert.equal(h.sampler.stats().counts.extra,1); assert.equal(h.sampler.stats().counts.missed,1);
  assert.equal(h.maxActive(),1);
});
test('before calibration is only a hint; widened final clock still fails unchanged measurement', async () => {
  const h=harness(); await h.clock.advanceTo(10); h.sampler.setWindow(50,8050,before());
  await h.clock.advanceTo(8205); await stop(h);
  const c=M.clockEnvelope(before(),before(-500,500));
  assert.equal(M.windowEvidence(h.rec.samples,50,8050,c).qualified,false);
});
test('acquisition above 250 ms remains in raw rows and fails original windowEvidence', async () => {
  const h=harness({duration:at=>at===4000?251:5}); await h.clock.advanceTo(10);
  h.sampler.setWindow(50,8050,before()); await h.clock.advanceTo(8300); const stopping=h.sampler.stop();
  await h.clock.advanceTo(8310); await stopping;
  assert(h.rec.samples.some(s=>s.end-s.start===251));
  const w=M.windowEvidence(h.rec.samples,50,8050,M.clockEnvelope(before(),before()));
  assert.equal(w.maxAcquisitionMs,251); assert.equal(w.qualified,false);
});
test('sample cap is unchanged; no over-cap request is even issued', async () => {
  const h=harness({maxSamples:3}); await h.clock.advanceTo(350); await stop(h);
  assert.equal(h.calls.length,3); assert.equal(h.rec.samples.length,3); assert.match(h.rec.failure,/sample count/);
});
test('stop deadline records incomplete row before sticky failure; late reply cannot mutate frozen output', async () => {
  const h=harness({duration:()=>1000}); await h.clock.advanceTo(1);
  const first=h.sampler.stop({timeoutMs:20}); assert.strictEqual(h.sampler.stop(),first);
  await h.clock.advanceTo(21); const rows=await first;
  assert.equal(rows.length,1); assert.equal(rows[0].incomplete,true);
  assert.equal(rows[0].start,0); assert.equal(rows[0].end,21);
  assert.match(h.rec.failure,/pending at shutdown/); const recordCount=h.rec.records.length;
  await h.clock.advanceTo(3000);
  assert.equal(h.calls.length,1); assert.deepEqual(h.rec.samples,rows);
  assert.equal(h.rec.records.length,recordCount); assert.equal(h.clock.timers.size,0);
});
test('per-request timeout is terminal; no replacement and late reply is contained', async () => {
  const h=harness({duration:()=>3000}); await h.clock.advanceTo(2000);
  const rows=await stop(h); assert.equal(rows[0].incomplete,true);
  assert.match(h.rec.failure,/acquisition timeout/); await h.clock.advanceTo(4000);
  assert.equal(h.calls.length,1); assert.equal(h.rec.samples.length,1); assert.equal(h.clock.timers.size,0);
});
test('stop while waiting wakes immediately and cancels both scheduler and deadline timers', async () => {
  const h=harness(); await h.clock.advanceTo(20); h.sampler.setWindow(50,8050,before()); await tick();
  await stop(h); assert.equal(h.clock.now(),20); assert.equal(h.clock.timers.size,0);
  assert.equal(h.sampler.stats().hints.filter(x=>x.state==='cancelled').length,2);
  assert.throws(()=>h.sampler.setWindow(0,8000,before()),/already registered/);
});
test('stop that waits for a pending success records that single reply and no replacement', async () => {
  const h=harness({duration:()=>50}); await h.clock.advanceTo(10);
  const stopped=h.sampler.stop({timeoutMs:100}); await h.clock.advanceTo(50); const rows=await stopped;
  assert.equal(rows.length,1); assert.equal(rows[0].end,50); assert.equal(h.rec.failure,null);
  assert.equal(h.calls.length,1); assert.equal(h.clock.timers.size,0);
});
test('invalid process list is recorded as a terminal acquisition error', async () => {
  const h=harness({result:{processInfo:[]}}); await h.clock.advanceTo(500); await stop(h);
  assert.equal(h.calls.length,1); assert.match(h.rec.samples[0].error,/process-list/);
  assert.match(h.rec.failure,/acquisition failure/);
});
test('record overflow stops acquisition instead of emitting unrecorded extra work', async () => {
  const clock=virtualTime(), rec=recorder(); let calls=0;
  rec.record=()=>false;
  const s=start({recorder:rec,now:clock.now,sleep:clock.sleep,setTimer:clock.setTimer,clearTimer:clock.clearTimer,cdp:{send(){calls++;}}});
  await s.stop(); assert.equal(calls,0); assert.match(rec.failure,/metadata/);
});
test('stop budget cannot silently expand beyond bounded 5 seconds', async () => {
  const h=harness(); await h.clock.advanceTo(10);
  for(const ms of [0,-1,5001,Infinity,NaN]) assert.throws(()=>h.sampler.stop({timeoutMs:ms}),/5000/);
  await stop(h);
});

test('legacy injected now/sleep remains cadence-only; deadline timers do not advance that fake clock', async () => {
  let time=0,calls=0;
  const rec=recorder(3);
  const s=start({recorder:rec,now:()=>time,sleep:async ms=>{assert.equal(ms,95);time+=ms;},
    cdp:{async send(){calls++;await Promise.resolve();time+=5;return {processInfo:[{id:1,type:'browser',cpuTime:calls}]};}}});
  while(calls<3) await new Promise(resolve=>setImmediate(resolve));
  await s.stop();
  assert.deepEqual(rec.samples.map(x=>x.start),[0,100,200]); assert.equal(calls,3);
});
test('late rejected transport promise after shutdown is observed without new raw records', async () => {
  const clock=virtualTime(),rec=recorder(); let reject,calls=0;
  const s=start({recorder:rec,now:clock.now,sleep:clock.sleep,setTimer:clock.setTimer,clearTimer:clock.clearTimer,
    cdp:{send(){calls++;return new Promise((_,r)=>{reject=r;});}}});
  const stopped=s.stop({timeoutMs:10}); await clock.advanceTo(10); const rows=await stopped;
  const count=rec.records.length; reject(Error('late closed transport')); await tick();
  assert.equal(calls,1); assert.equal(rec.records.length,count); assert.deepEqual(rec.samples,rows);
  assert.equal(clock.timers.size,0);
});
test('end hints do not fabricate a missing observation before an already elapsed start', async () => {
  const h=harness(); await h.clock.advanceTo(20); h.sampler.setWindow(0,8000,before());
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.sampler.stats().registration.startAlreadyElapsed,true);
  const w=M.windowEvidence(h.rec.samples,0,8000,M.clockEnvelope(before(),before()));
  assert.equal(w.qualified,false); assert.equal(w.outer,null); assert.equal(w.bracketWidthsMs,null);
});
test('first eligibility registration during a pending query records the real registration time without overlap', async () => {
  const h=harness({duration:(at,index)=>index===1?50:5}); await h.clock.advanceTo(10);
  assert.equal(h.calls[0].end,undefined);
  const plan=h.sampler.setWindow(50,8050,before());
  assert.equal(plan.registeredAt,10); assert.equal(h.calls.length,1);
  await h.clock.advanceTo(8205); await stop(h);
  assert.equal(h.maxActive(),1); assert.equal(h.sampler.stats().counts.extra,2);
  assert.equal(M.windowEvidence(h.rec.samples,50,8050,M.clockEnvelope(before(),before())).qualified,true);
});
test('longer case cannot generate more than the two predeclared extra queries', async () => {
  const h=harness(); await h.clock.advanceTo(10); h.sampler.setWindow(50,8050,before());
  await h.clock.advanceTo(20005); await stop(h);
  assert.equal(h.sampler.stats().counts.extra,2);
  assert.equal(h.sampler.stats().hints.length,2);
  assert.equal(h.calls.length,201+2); assert.equal(h.maxActive(),1);
});

}
// END ENDPOINT-AWARE SAMPLER CONTRACTS


test('page observation preflight rejects sticky source failure before search work',async()=>{
 const status={complete:false,failure:'Unobserved worker source',pendingSources:0};let seen;
 await assert.rejects(C.assertPageRecordingReady({evaluate:async()=>status},{setPageStatus:s=>seen=s,status:()=>({failure:null,raw:{complete:false,closed:false,failures:0}}),store:{status:()=>({complete:true})}}),/Browser observation unavailable: Unobserved worker source/);assert.equal(seen,status);
});
test('page observation preflight permits pending source hashes without erasing final requirement',async()=>{
 const status={complete:true,failure:null,pendingSources:2};let seen;
 assert.equal(await C.assertPageRecordingReady({evaluate:async()=>status},{setPageStatus:s=>seen=s,status:()=>({failure:null,raw:{complete:false,closed:false,failures:0}}),store:{status:()=>({complete:true})}}),status);assert.equal(seen.pendingSources,2);
});
test('recording failure stops remaining repetitions and is not mistaken for completed validation',()=>{
 const report={cases:[],preflight:{mode:'functional-with-separate-cpu'}},summary=C.classifyCase(passingCase(),{complete:false,failure:'page capture incomplete: Unobserved worker source'});report.cases.push(summary);
 assert.equal(C.stopAfterRecordingFailure(report,summary),true);assert.match(report.fatal,/remaining cases not started/);const verdict=C.reportVerdicts(report);assert.equal(verdict.functional.recordedCases,1);assert.equal(verdict.functional.unreachedCases,7);assert.equal(verdict.exitOk,false);assert.equal(verdict.cpu.qualified,false);
});
test('ordinary recall failure does not stop balanced repetitions when recording remains complete',()=>{
 const report={},r=passingCase();r.primaryFirst=false;r.primaryRecallFailure=true;r.lifecycleCompleted=false;r.failures=[{phase:'primary-recall',error:'deadline miss'}];const summary=C.classifyCase(r,{complete:true});assert.equal(C.stopAfterRecordingFailure(report,summary),false);assert.equal(report.fatal,undefined);assert.equal(summary.functional.pass,false);
});
test('recording fail-fast is wired before app work and at each bounded case summary',()=>{
 const source=fs.readFileSync(require.resolve('./chrome.cjs'),'utf8');assert(source.indexOf("phase='observation-preflight';await assertPageRecordingReady(page,recorder)")<source.indexOf("phase='actual-ui-prediction'"));assert(source.includes('repeat<4&&!report.fatal'));assert(source.includes('if(report.fatal)break;'));assert(source.includes('report.cases.push(summary);stopAfterRecordingFailure(report,summary);'));assert(source.includes('if((pageStatus?.pendingSources??0)!==0)'));
});

test('failed host recorder prevents even page preflight without waiting for fixture work',async()=>{
 let pageCalls=0;const recorder={status:()=>({failure:null,raw:{complete:false,closed:false,failures:1,reason:'write-open denied'}}),fail(){return false;},store:{status:()=>({complete:true})},setPageStatus(){throw Error('should not set page');}};
 await assert.rejects(C.assertPageRecordingReady({evaluate:async()=>{pageCalls++;}},recorder),/Host observation unavailable: write-open denied/);assert.equal(pageCalls,0);
});

{
'use strict';
// Browser-free: only in-memory VM Blob/Worker fakes; no browser, sockets, or processes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const auditFile=path.resolve(process.env.AUDIT_FILE||path.join(__dirname,'audit.js'));
const auditCode=fs.readFileSync(auditFile,'utf8');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const gitBlob=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
// Official GitHub fetch_file, exact production commit 277b3b7174e54b2bef16e09a9b7bfc0f5700b36d.
// Inline complete canonical fixtures keep this single test file portable and offline.
const PRODUCTION={
"src/render-service.js":{"sha":"012618dba622430a5261d98c7e52d9358823ffbc","content":"/* Main thread keeps UI/hit testing. One worker frame in flight, latest state wins. */\n(function(G){\n'use strict';\n// Private listeners receive only completed main-thread bitmap draws, never arrivals.\nconst presentationListeners=new WeakMap();\nclass WorkerRenderer {\n static async create(canvas){\n  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')throw Error('OffscreenCanvas unavailable');\n  const code=['math','renderer','render-worker'].map(n=>document.getElementById('source-'+n)?.textContent||'').join('\\n');\n  const url=URL.createObjectURL(new Blob(['globalThis.LabDimensions='+JSON.stringify(G.LabDimensions)+';\\n',code],{type:'text/javascript'}));let worker;\n  try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}\n  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Render worker startup timeout')),5000);worker.onmessage=({data})=>{clearTimeout(timer);data.type==='ready'?resolve():reject(Error(data.error||'Render worker failed'));};worker.onerror=e=>{clearTimeout(timer);e.preventDefault();reject(Error(e.message));};worker.postMessage({type:'init'});});return new WorkerRenderer(canvas,worker);}catch(e){worker.terminate();throw e;}\n }\n constructor(canvas,worker){this.canvas=canvas;this.worker=worker;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx){worker.terminate();throw Error('Bitmap presentation unavailable');}this.camera={yaw:.12,pitch:.86,zoom:1,size:1.20,projection:'perspective',target:G.LabMath.V(-.12,-.035,0)};this.workerMode=true;this.tracksPresentation=true;presentationListeners.set(this,new Set());this.sequence=0;this.inFlight=false;this.pending=null;this.metrics={frames:0,renderMs:0,serializeMs:0};\n worker.onmessage=({data})=>{if(this.disposed||this.hidden){data.bitmap?.close();clearTimeout(this.timer);this.inFlight=false;return;}if(data.type==='error'){this.fail(data.error);return;}if(data.type!=='frame')return;clearTimeout(this.timer);if(data.id!==this.sequence){data.bitmap?.close();return;}this.readyBitmap?.close();this.readyBitmap=data.bitmap;this.readySize=this.inFlightSize;this.readyInput=this.inFlightInput;this.readyTrace={...this.inFlightTrace,workerReturnedAt:performance.now(),workerRenderMs:data.renderMs,submittedSize:{...this.inFlightSize},actualBitmapWidth:data.bitmap?.width,actualBitmapHeight:data.bitmap?.height};this.metrics.renderMs=data.renderMs;this.inFlight=false;};\n worker.onerror=e=>{e.preventDefault();this.fail(e.message);};\n }\n subscribePresentation(callback){if(typeof callback!=='function'||this.disposed)throw TypeError('Live presentation callback required');const listeners=presentationListeners.get(this);listeners.add(callback);return()=>listeners.delete(callback);}\n get needsFrame(){return !this.hidden&&(!!this.readyBitmap||!!this.pending&&!this.inFlight);}\n setHidden(value){this.hidden=value;if(value){this.readyBitmap?.close();this.readyBitmap=null;this.readyInput=null;}else this.onInvalidate?.();}\n fail(reason){clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.readyBitmap?.close();this.readyBitmap=null;this.inFlight=false;this.workerMode=false;this.isFallback=true;this.fallbackReason=String(reason);this.fallback=new G.SoftwareRenderer(this.canvas);this.fallback.camera=this.camera;this.pending=this.lastFrame;this.onInvalidate?.();}\n render(lab,state,{update=true,input=null,presentationToken=null}={}){if(this.disposed||this.hidden)return;this.lastFrame=[lab,state];if(this.fallback){this.pending=null;this.fallback.camera=this.camera;this.fallback.render(lab,state);return{input};}\n  let presented,discardedInput=null;\n  if(this.readyBitmap){\n   // A size/DPR change may happen while the Worker renders. Never stretch an\n   // obsolete bitmap into the new backing store; admit the latest state below.\n   this.size();const expectedDpr=Math.min(G.devicePixelRatio||1,2),size=this.readySize;\n   if(!size||size.width!==this.width||size.height!==this.height||size.dpr!==expectedDpr||this.readyBitmap.width!==this.canvas.width||this.readyBitmap.height!==this.canvas.height){\n    discardedInput=input??this.pending?.[2]??this.readyInput??null;this.readyBitmap.close();this.readyBitmap=null;this.readyInput=null;this.readyTrace=null;this.readySize=null;this.pending=[lab,state,discardedInput,presentationToken];\n   }\n  }\n  if(this.readyBitmap){presented={input:this.readyInput,trace:{...this.readyTrace,bitmapDrawStartedAt:performance.now()}};this.ctx.drawImage(this.readyBitmap,0,0,this.canvas.width,this.canvas.height);presented.trace.bitmapDrawCompletedAt=performance.now();this.readyBitmap.close();this.readyBitmap=null;this.readyInput=null;this.readyTrace=null;this.metrics.frames++;const receipt=Object.freeze({...presented.trace,submittedSize:Object.freeze({...presented.trace.submittedSize})});for(const callback of presentationListeners.get(this)??[])callback(receipt);}\n  if(update)this.pending=[lab,state,input??discardedInput,presentationToken];if(this.inFlight||!this.pending)return presented;[lab,state,input,presentationToken]=this.pending;this.pending=null;\n  this.size();const started=performance.now(),serialize=o=>({id:o.id,kind:o.kind,label:o.label,shape:o.shape,color:o.color,radius:o.radius,half:o.half,vertices:o.vertices,indices:o.indices,position:{...o.body.translation()},rotation:{...o.body.rotation()},velocity:o.body.linvel?{...o.body.linvel()}:null,trail:state.paths?G.LabMath.visibleTrail(o,lab,state):[]});\n  const selected=lab.get(state.selectedId),preview=selected&&selected.shape==='sphere'&&state.previewCueVisible?lab.pose(selected,state.settings,.012+(state.cuePull||0)):null;\n  const message={type:'frame',id:++this.sequence,size:{width:this.width,height:this.height,dpr:Math.min(G.devicePixelRatio||1,2)},camera:this.camera,objects:lab.objects.map(serialize),preview,cue:lab.cue?{body:serialize({body:lab.cue.body}),head:serialize({body:lab.cue.head})}:null,debug:state.debug?lab.world.debugRender().vertices:null,state:{selectedId:state.selectedId,showCue:state.showCue,previewCueVisible:state.previewCueVisible,obstruction:state.obstruction,predict:state.predict,forecast:state.forecast,paths:state.paths,allPaths:true,debug:state.debug,vectors:state.vectors,settings:state.settings,cuePull:state.cuePull}};\n  if(this.staticLab!==lab){message.statics=lab.statics.map(serialize);this.staticLab=lab;}\n  this.metrics.serializeMs=performance.now()-started;this.inFlightInput=input;this.inFlightTrace={presentationToken,workerSequence:this.sequence,workerSubmittedAt:performance.now(),serializeMs:this.metrics.serializeMs};this.inFlightSize={...message.size};this.inFlight=true;this.timer=setTimeout(()=>this.fail('Render worker stalled'),5000);try{this.worker.postMessage(message);}catch(e){this.fail(e.message);}return presented;\n }\n dispose(){this.disposed=true;presentationListeners.get(this)?.clear();this.readyBitmap?.close();this.readyBitmap=null;clearTimeout(this.timer);this.worker?.terminate();this.worker=null;this.pending=this.lastFrame=null;}\n}\nfor(const key of ['size','project','ray','planePoint','pick','setView'])WorkerRenderer.prototype[key]=G.LabRenderer.prototype[key];\nG.WorkerRenderer=WorkerRenderer;\n})(globalThis);\n"},
"src/math.js":{"sha":"b61ae8edede8cfae43f75799490f6f7ac46b4aef","content":"/* Small, renderer-independent vector helpers. SI units throughout. */\n(function(G){\n'use strict';\nconst V=(x=0,y=0,z=0)=>({x,y,z});\nconst add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z), sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);\nconst mul=(a,s)=>V(a.x*s,a.y*s,a.z*s), dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;\nconst cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);\nconst len=a=>Math.hypot(a.x,a.y,a.z), norm=a=>mul(a,1/(len(a)||1));\nconst clamp=(x,a,b)=>Math.max(a,Math.min(b,x));\nconst qident=()=>({x:0,y:0,z:0,w:1});\nfunction rotate(q,v){const t=mul(cross(q,v),2);return add(v,add(mul(t,q.w),cross(q,t)));}\nfunction qfromY(v){v=norm(v);if(v.y<-.999999)return{x:1,y:0,z:0,w:0};const s=Math.sqrt((1+v.y)*2);return{x:v.z/s,y:0,z:-v.x/s,w:s/2};}\nfunction matrix(pos=V(),q=qident(),s=V(1,1,1)){\n const x=q.x,y=q.y,z=q.z,w=q.w,x2=x+x,y2=y+y,z2=z+z;\n return new Float32Array([(1-y*y2-z*z2)*s.x,(x*y2+w*z2)*s.x,(x*z2-w*y2)*s.x,0,\n (x*y2-w*z2)*s.y,(1-x*x2-z*z2)*s.y,(y*z2+w*x2)*s.y,0,\n (x*z2+w*y2)*s.z,(y*z2-w*x2)*s.z,(1-x*x2-y*y2)*s.z,0,pos.x,pos.y,pos.z,1]);\n}\nfunction multiply(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o;}\nfunction lookAt(eye,target,up=V(0,1,0)){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}\nfunction ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}\nfunction perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}\nfunction forecastGeometry(result){\n for(const track of result.tracks){\n  const p=track.points,segments=[];let phase=0,total=0;\n  for(let i=1;i<p.length;i++){\n   const a=p[i-1],delta=sub(p[i],a),distance=len(delta);if(distance<1e-10)continue;\n   let travel=0;\n   while(travel<distance-1e-10){const draw=phase<.032,remaining=(draw?.032:.054)-phase,step=Math.min(remaining,distance-travel);\n    if(draw&&step>1e-10){const s=add(a,mul(delta,travel/distance)),e=add(a,mul(delta,(travel+step)/distance));segments.push(s.x,s.y,s.z,e.x,e.y,e.z);}\n    travel+=step;phase+=step;if(phase>=.054-1e-10)phase=0;\n   }total+=distance;\n  }\n  track.segments=segments;track.distance=total;track.endRing=[];\n  if(total>.003){const end=p[p.length-1],r=track.radius||.035;for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;track.endRing.push(end.x+r*Math.cos(t),end.y,end.z+r*Math.sin(t));}}\n }\n return result;\n}\nconst trailViews=new WeakMap();\nfunction visibleTrail(object,lab,state){\n const points=object.trail||[];if(state.allPaths)return points;\n const last=points[points.length-1],cached=trailViews.get(object);\n if(cached&&cached.points===points&&cached.last===last&&cached.length===points.length&&cached.shot===lab.shots)return cached.result;\n const result=points.filter(p=>(p.shot??lab.shots)===lab.shots);trailViews.set(object,{points,last,length:points.length,shot:lab.shots,result});return result;\n}\nfunction aimGuide(position,angle,radius=.03075){const a=angle*Math.PI/180,d=V(Math.cos(a),0,Math.sin(a));return{start:add(position,mul(d,radius+.015)),end:add(position,mul(d,.9))};}\nG.LabMath={aimGuide,visibleTrail,forecastGeometry,V,add,sub,mul,dot,cross,len,norm,clamp,rotate,qident,qfromY,matrix,multiply,lookAt,ortho,perspective};\n})(globalThis);\n"},
"src/renderer.js":{"sha":"e21755eac10130c787ac5cb63bb4740be5998834","content":"/* WebGL2 renderer. Displays body transforms only; it does not calculate motion. */\n(function(G){\n'use strict';\nconst {V,add,sub,mul,dot,cross,len,norm,rotate,qident,qfromY,matrix,multiply,lookAt,ortho,perspective,clamp}=G.LabMath;\nconst D=G.LabDimensions;\nconst hex=s=>[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255];\nclass LabRenderer{\n constructor(canvas){\n  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});\n  if(!this.gl)throw new Error('WebGL 2를 지원하는 브라우저가 필요합니다. 하드웨어 가속 설정을 확인하세요.');\n  this.camera={yaw:.12,pitch:.86,zoom:1,size:1.20,projection:\"perspective\",target:V(-.12,-.035,0)};this.staticCache=new WeakMap();\n  this.init();\n }\n program(v,f){const gl=this.gl;function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}\n  const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;\n }\n init(){\n  const gl=this.gl;\n  this.main=this.program(`#version 300 es\n   precision highp float;\n   layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;\n   uniform mat4 uModel,uVP,uLight;uniform vec3 uScale;\n   out vec3 vNormal,vWorld,vLocal;out vec4 vShadow;\n   void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vLocal=aPosition;vNormal=normalize(mat3(uModel)*(aNormal/(uScale*uScale)));vShadow=uLight*p;gl_Position=uVP*p;}`,`#version 300 es\n   precision highp float;\n   in vec3 vNormal,vWorld,vLocal;in vec4 vShadow;\n   uniform vec3 uColor,uEye;uniform float uMaterial,uSelected;uniform sampler2D uShadow;\n   out vec4 frag;\n   float shadow(){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float vis=0.;float bias=max(.00012,.00045*(1.-dot(normalize(vNormal),normalize(vec3(3.,6.,4.)))));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(uShadow,p.xy+vec2(float(x),float(y))/1024.).r;vis+=p.z-bias>d?.32:1.;}return vis/9.;}\n   void main(){vec3 color=uColor;vec3 n=normalize(vNormal),l=normalize(vec3(3.,6.,4.));\n    if(uMaterial>0.5&&uMaterial<1.5){float grain=sin(vWorld.x*1800.)*sin(vWorld.z*1700.);color*=1.+grain*.025;}\n    if(uMaterial>1.5&&uMaterial<2.5){float m=max(abs(vLocal.x),max(abs(vLocal.y),abs(vLocal.z)));if(m>.983){color=mix(vec3(.93,.96,.88),vec3(.66,.23,.18),step(.70,uColor.b));}}\n    if(uMaterial>4.5&&uMaterial<5.5){float grain=sin((vWorld.x+vWorld.z)*160.+sin(vWorld.y*200.)*.6);color*=1.+grain*.035;}\\n    if(uMaterial>2.5&&uMaterial<3.5){vec2 grid=abs(fract(vWorld.xz*.5+.5)-.5);float line=1.-smoothstep(.003,.008,min(grid.x,grid.y));color=mix(color,color*1.16,line);}\n    float d=max(dot(n,l),0.);float sh=shadow();vec3 v=normalize(uEye-vWorld),h=normalize(l+v);float glossy=uMaterial>1.5&&uMaterial<2.5?90.:40.;float spec=pow(max(dot(n,h),0.),glossy)*(uMaterial>1.5&&uMaterial<2.5?.45:.10)*sh;\n    vec3 lit=color*(.48+.65*d*sh)+vec3(spec);lit+=uSelected*.035;frag=vec4(pow(max(lit,vec3(0.)),vec3(.88)),1.);\n   }`);\n  this.depth=this.program(`#version 300 es\n   layout(location=0) in vec3 aPosition;uniform mat4 uModel,uVP;void main(){gl_Position=uVP*uModel*vec4(aPosition,1.);}`,`#version 300 es\n   precision highp float;void main(){}`);\n  this.line=this.program(`#version 300 es\n   layout(location=0) in vec3 aPosition;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aPosition,1.);}`,`#version 300 es\n   precision highp float;uniform vec4 uColor;out vec4 frag;void main(){frag=uColor;}`);\n  this.locations=new Map();for(const p of [this.main,this.depth,this.line]){const out={};for(const n of ['uModel','uVP','uLight','uScale','uColor','uEye','uMaterial','uSelected','uShadow'])out[n]=gl.getUniformLocation(p,n);this.locations.set(p,out);}\n  this.sphere=this.makeSphere(28,18);this.box=this.makeBox();this.cylinder=this.makeCylinder(1,1,32);this.coneCue=this.makeCylinder(D.cueRadius/.011,D.cueRadius/.011,28);\n  this.lineVAO=gl.createVertexArray();this.lineBuffer=gl.createBuffer();gl.bindVertexArray(this.lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);\n  this.shadow=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);\n  this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadow,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('그림자 버퍼 초기화 실패');gl.bindFramebuffer(gl.FRAMEBUFFER,null);\n  this.light=multiply(ortho(-3.5,3.5,-3.5,3.5,.1,15),lookAt(V(3,6,4),V()));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);\n }\n mesh(vertices){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);return{vao,buffer,count:vertices.length/6};}\n triangle(out,a,b,c,n=null){n=n||norm(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])out.push(p.x,p.y,p.z,n.x,n.y,n.z);}\n makeBox(){const v=[],p=[V(-1,-1,-1),V(1,-1,-1),V(1,1,-1),V(-1,1,-1),V(-1,-1,1),V(1,-1,1),V(1,1,1),V(-1,1,1)];for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){this.triangle(v,p[f[0]],p[f[1]],p[f[2]]);this.triangle(v,p[f[0]],p[f[2]],p[f[3]]);}return this.mesh(v);}\n makeSphere(slices,stacks){const out=[],p=(i,j)=>V(Math.sin(Math.PI*j/stacks)*Math.cos(2*Math.PI*i/slices),Math.cos(Math.PI*j/stacks),Math.sin(Math.PI*j/stacks)*Math.sin(2*Math.PI*i/slices));for(let i=0;i<slices;i++)for(let j=0;j<stacks;j++){const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);for(const q of [a,c,b,a,d,c])out.push(q.x,q.y,q.z,q.x,q.y,q.z);}return this.mesh(out);}\n makeCylinder(rTop=1,rBottom=1,steps=24){const out=[];for(let i=0;i<steps;i++){const a=i/steps*2*Math.PI,b=(i+1)/steps*2*Math.PI,p=V(rBottom*Math.cos(a),-.5,rBottom*Math.sin(a)),q=V(rBottom*Math.cos(b),-.5,rBottom*Math.sin(b)),r=V(rTop*Math.cos(b),.5,rTop*Math.sin(b)),s=V(rTop*Math.cos(a),.5,rTop*Math.sin(a));this.triangle(out,p,s,r);this.triangle(out,p,r,q);this.triangle(out,V(0,.5,0),r,s,V(0,1,0));this.triangle(out,V(0,-.5,0),p,q,V(0,-1,0));}return this.mesh(out);}\n convexMesh(o){\n  if(this.staticCache.has(o))return this.staticCache.get(o);\n  const out=[],vertices=o.vertices,indices=o.indices;\n  for(let i=0;i<indices.length;i+=3){const p=indices.slice(i,i+3).map(index=>V(...vertices.slice(index*3,index*3+3)));this.triangle(out,...p);}\n  const mesh=this.mesh(out);this.staticCache.set(o,mesh);return mesh;\n }\n cushionMesh(o){if(this.staticCache.has(o))return this.staticCache.get(o);const p=[];for(let i=0;i<8;i++)p.push(V(...o.vertices.slice(i*3,i*3+3)));const out=[];for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){this.triangle(out,p[f[0]],p[f[1]],p[f[2]]);this.triangle(out,p[f[0]],p[f[2]],p[f[3]]);}const mesh=this.mesh(out);this.staticCache.set(o,mesh);return mesh;}\n size(){\n  const r=this.viewportSize||this.canvas.getBoundingClientRect(),dpr=Math.min(this.viewportSize?.dpr||globalThis.devicePixelRatio||1,2);if(r.width<1||r.height<1)return;\n  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}\n  this.width=r.width;this.height=r.height;this.aspect=r.width/r.height;\n  const c=this.camera,sp=Math.sin(c.pitch),cp=Math.cos(c.pitch);this.tanHalf=Math.tan(38*Math.PI/360);\n  this.distance=c.projection==='orthographic'?6:Math.max(3.9,2.00/(this.tanHalf*this.aspect))*(c.zoom||1);\n  this.eye=add(c.target,V(Math.sin(c.yaw)*cp*this.distance,sp*this.distance,Math.cos(c.yaw)*cp*this.distance));\n  this.forward=norm(sub(c.target,this.eye));this.right=norm(cross(this.forward,V(0,1,0)));this.up=cross(this.right,this.forward);\n  this.halfH=c.projection==='orthographic'?Math.max(1.0,1.91/this.aspect)*(c.zoom||1):this.distance*this.tanHalf;this.halfW=this.halfH*this.aspect;\n  const projection=c.projection==='orthographic'?ortho(-this.halfW,this.halfW,-this.halfH,this.halfH,.03,40):perspective(38*Math.PI/180,this.aspect,.03,40);\n  this.vp=multiply(projection,lookAt(this.eye,c.target));\n }\n project(pos){\n  const rel=sub(pos,this.eye),depth=dot(rel,this.forward),pers=this.camera.projection!=='orthographic';\n  const hh=pers?Math.max(.001,depth)*this.tanHalf:this.halfH,hw=hh*this.aspect;\n  return{x:(dot(rel,this.right)/hw*.5+.5)*this.width,y:(.5-dot(rel,this.up)/hh*.5)*this.height,depth,visible:depth>.03};\n }\n ray(x,y){\n  const nx=x/this.width*2-1,ny=1-y/this.height*2;\n  if(this.camera.projection!=='orthographic')return{origin:{...this.eye},direction:norm(add(this.forward,add(mul(this.right,nx*this.tanHalf*this.aspect),mul(this.up,ny*this.tanHalf))))};\n  const local=add(mul(this.right,nx*this.halfW),mul(this.up,ny*this.halfH));return{origin:add(this.eye,local),direction:this.forward};\n }\n planePoint(x,y,height){const ray=this.ray(x,y);if(Math.abs(ray.direction.y)<1e-6)return null;const t=(height-ray.origin.y)/ray.direction.y;if(t<0)return null;return add(ray.origin,mul(ray.direction,t));}\n pick(objects,x,y){let found=null,best=1e9;for(const o of objects){const pos=o.body.translation(),p=this.project(pos),e=this.project(add(pos,mul(this.right,o.radius||.05)));if(!p.visible)continue;const radius=Math.abs(e.x-p.x),d=Math.hypot(p.x-x,p.y-y);if(d<Math.max(radius+7,14)&&d<best){found=o;best=d;}}return found;}\n command(mesh,pos,rot,scale,color,material=0,selected=0){return{mesh,model:matrix(pos,rot,scale),scale,color:typeof color==='string'?hex(color):color,material,selected};}\n cueCommands(tip,rot,color,headTip=tip,headRot=rot){\n  const out=[],dir=rotate(rot,V(0,1,0)),at=d=>sub(tip,mul(dir,d)),headDir=rotate(headRot,V(0,1,0)),headAt=d=>sub(headTip,mul(headDir,d)),rear=D.cueLength-D.flexibleLength;\n  out.push(this.command(this.cylinder,at(D.tipRadius+D.flexibleLength+rear/2),rot,V(D.cueRadius,rear,D.cueRadius),color));\n  out.push(this.command(this.cylinder,at(D.tipRadius+D.cueLength*.86),rot,V(D.cueRadius*1.015,D.cueLength*.28,D.cueRadius*1.015),'#344a49'));\n  out.push(this.command(this.cylinder,headAt(D.tipRadius+D.flexibleLength/2),headRot,V(.0058,D.flexibleLength,.0058),color));\n  out.push(this.command(this.cylinder,headAt(D.tipRadius+.012),headRot,V(.0059,.022,.0059),'#e5e3d9'));\n  out.push(this.command(this.sphere,headTip,qident(),V(D.tipRadius,D.tipRadius,D.tipRadius),'#5f9faf'));return out;\n }\n drawCommands(cmds,program,vp){const gl=this.gl,u=this.locations.get(program);gl.useProgram(program);gl.uniformMatrix4fv(u.uVP,false,vp);if(program===this.main){gl.uniformMatrix4fv(u.uLight,false,this.light);gl.uniform3f(u.uEye,this.eye.x,this.eye.y,this.eye.z);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.shadow);gl.uniform1i(u.uShadow,0);}\n  for(const c of cmds){gl.uniformMatrix4fv(u.uModel,false,c.model);if(program===this.main){gl.uniform3f(u.uScale,c.scale.x,c.scale.y,c.scale.z);gl.uniform3fv(u.uColor,c.color);gl.uniform1f(u.uMaterial,c.material);gl.uniform1f(u.uSelected,c.selected);}gl.bindVertexArray(c.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,c.mesh.count);}\n }\n lines(points,color,strip=false,alpha=1){if(points.length<6)return;const gl=this.gl,u=this.locations.get(this.line);gl.useProgram(this.line);gl.uniformMatrix4fv(u.uVP,false,this.vp);const c=typeof color==='string'?hex(color):color;gl.uniform4f(u.uColor,c[0],c[1],c[2],alpha);gl.bindVertexArray(this.lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,points instanceof Float32Array?points:new Float32Array(points),gl.DYNAMIC_DRAW);gl.drawArrays(strip?gl.LINE_STRIP:gl.LINES,0,points.length/3);}\n render(lab,state){\n  this.size();const gl=this.gl,cmds=[];\n  for(const o of lab.statics){const material=o.kind==='cloth'?1:o.kind==='floor'?3:o.kind==='wood'?5:0;cmds.push(this.command(o.shape==='convex'?this.convexMesh(o):o.shape==='cushion'?this.cushionMesh(o):this.box,o.body.translation(),o.body.rotation(),o.half||V(1,1,1),o.color,material));}\n  for(const o of lab.objects){cmds.push(this.command(o.shape==='sphere'?this.sphere:this.box,o.body.translation(),o.body.rotation(),o.shape==='sphere'?V(o.radius,o.radius,o.radius):o.half,o.color,o.shape==='sphere'?2:0,o.id===state.selectedId?1:0));}\n  // Small inlays are visual decorations, not additional collision surfaces.\n  for(let i=1;i<8;i++)for(const z of [-D.depth/2-.11,D.depth/2+.11])cmds.push(this.command(this.sphere,V(-D.width/2+D.width*i/8,.071,z),qident(),V(.006,.001,.006),'#e4d4a5'));\n  for(let i=1;i<4;i++)for(const x of [-D.width/2-.11,D.width/2+.11])cmds.push(this.command(this.sphere,V(x,.071,-D.depth/2+D.depth*i/4),qident(),V(.006,.001,.006),'#e4d4a5'));\n  const selected=lab.get(state.selectedId);let preview=null;\n  if(lab.cue&&state.showCue){cmds.push(...this.cueCommands(lab.cue.body.translation(),lab.cue.body.rotation(),'#bb9969',lab.cue.head.translation(),lab.cue.head.rotation()));}\n  else if(selected&&selected.shape==='sphere'&&state.previewCueVisible){preview=lab.pose(selected,state.settings,.012+(state.cuePull||0));cmds.push(...this.cueCommands(preview.tip,preview.rotation,state.obstruction?'#b96353':'#c3a170'));cmds.push(this.command(this.sphere,preview.contact,qident(),V(.0024,.0024,.0024),'#c9f69d'));}\n  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,1024,1024);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,3);this.drawCommands(cmds,this.depth,this.light);gl.disable(gl.POLYGON_OFFSET_FILL);\n  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.032,.049,.077,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.drawCommands(cmds,this.main,this.vp);\n  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);\n  if(state.predict&&state.forecast)for(const track of state.forecast.tracks){this.lines(track.segments,track.color,false,.90);this.lines(track.endRing,track.color,true,.70);}\n  if(state.paths)for(const o of lab.objects)this.lines(G.LabMath.visibleTrail(o,lab,state).flatMap(p=>[p.x,p.y,p.z]),o.color,true,.72);\n  if(selected){const c=selected.body.translation(),r=(selected.radius||.045)+.012,points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;points.push(c.x+r*Math.cos(a),c.y-(selected.radius||selected.half.y)+.002,c.z+r*Math.sin(a));}this.lines(points,'#a7f3d0',true,.95);}\n  if(preview){const guide=G.LabMath.aimGuide(selected.body.translation(),state.settings.angle,selected.radius),a=guide.start,b=guide.end;this.lines([a.x,a.y,a.z,b.x,b.y,b.z],'#e7f9d3',true,.95);}\n  if(state.debug){const data=lab.world.debugRender();this.lines(data.vertices,'#8ccbe0',false,.8);}\n  if(state.vectors)for(const o of lab.objects){const p=o.body.translation(),end=add(p,mul(o.body.linvel(),.14));this.lines([p.x,p.y,p.z,end.x,end.y,end.z],'#a7f3d0',false,1);}\n  gl.depthMask(true);gl.disable(gl.BLEND);this.completedFrames=(this.completedFrames||0)+1;\n }\n setView(name){const c=this.camera;c.zoom=1;c.target=V(-.12,-.035,0);if(name==='top'){c.projection='orthographic';c.yaw=0;c.pitch=Math.PI/2-.0001;}else if(name==='side'){c.projection='perspective';c.yaw=0;c.pitch=.28;}else{c.projection='perspective';c.yaw=.12;c.pitch=.86;}this.size();}\n}\nG.LabRenderer=LabRenderer;\n})(globalThis);\n"},
"src/render-worker.js":{"sha":"8c1e0daa8e2e1919996810d99f15468995ac0b1f","content":"/* Rendering only: no simulation or gameplay decisions run here. */\nlet renderer,statics=[];\nconst body=s=>({translation:()=>s.position,rotation:()=>s.rotation,linvel:()=>s.velocity||{x:0,y:0,z:0}});\nconst object=s=>({...s,body:body(s)});\nonmessage=({data:m})=>{try{\n if(m.type==='init'){renderer=new LabRenderer(new OffscreenCanvas(1,1));postMessage({type:'ready'});return;}\n if(m.type!=='frame'||!renderer)return;\n const start=performance.now();renderer.viewportSize=m.size;renderer.camera=m.camera;\n if(m.statics)statics=m.statics.map(object);\n const objects=m.objects.map(object),lab={statics,objects,get:id=>objects.find(o=>o.id===id),pose:()=>m.preview,cue:m.cue?{body:body(m.cue.body),head:body(m.cue.head)}:null,world:{debugRender:()=>({vertices:m.debug||[]})}};\n renderer.render(lab,m.state);const bitmap=renderer.canvas.transferToImageBitmap();postMessage({type:'frame',id:m.id,bitmap,renderMs:performance.now()-start},[bitmap]);\n }catch(error){postMessage({type:'error',error:String(error.message||error)});}\n};\n"},
};


function realm({source=null,workerRealm=false,limits=null,hash='native'}={}) {
 const context=vm.createContext({TextEncoder,TextDecoder,Uint8Array,performance:{timeOrigin:1000,now:()=>5},crypto:hash==='native'?crypto.webcrypto:hash});
 vm.runInContext(`
  const blobs=new Map();let urlSerial=0;
  globalThis.nativeWorkers=[];globalThis.outgoing=[];globalThis.revoked=[];
  class FakeBlob {constructor(parts=[],options={}){this.parts=parts;this.options=options;}}
  class FakeWorker {
   constructor(url,options){this.url=String(url);this.options=options;this.blob=blobs.get(this.url);this.posted=[];this.listeners={};this.terminated=false;nativeWorkers.push(this);}
   addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
   postMessage(data,...transfer){this.posted.push({data,transfer});if(data?.type==='init')this.receive({type:'ready'});}
   receive(data){let stopped=false;const event={data,stopImmediatePropagation(){stopped=true;}};for(const fn of this.listeners.message||[]){fn(event);if(stopped)return;}this.onmessage?.(event);}
   error(message){const event={message,preventDefault(){}};for(const fn of this.listeners.error||[])fn(event);this.onerror?.(event);}
   terminate(){this.terminated=true;}
  }
  globalThis.Blob=FakeBlob;globalThis.Worker=FakeWorker;
  globalThis.URL={createObjectURL(blob){const url='blob:fake-'+(++urlSerial);blobs.set(url,blob);return url;},revokeObjectURL(url){revoked.push(url);blobs.delete(url);}};
  globalThis.postMessage=value=>outgoing.push(value);globalThis.onmessage=()=>{};
  globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
  globalThis.OffscreenCanvas=class{};globalThis.SoftwareRenderer=class{};
 `,context);
 if(source!==null) vm.runInContext(source,context);
 else if(workerRealm||limits) vm.runInContext(`globalThis.module={exports:{}};${auditCode}\nmodule.exports.installPromotionAudit(${JSON.stringify(workerRealm?'pending':'page')},${workerRealm},()=>module.exports.createCaptureStore(${JSON.stringify(limits||{})}));`,context);
 else vm.runInContext(auditCode,context);
 return context;
}
const run=(c,s)=>vm.runInContext(s,c);
const plain=x=>JSON.parse(JSON.stringify(x));
const status=c=>plain(run(c,'__promotionAudit.read(0).status'));
const events=c=>plain(run(c,'__promotionAudit.events'));
const flush=async c=>{await run(c,'__promotionAudit.flushSources()');return status(c);};
const init=(c,id)=>run(c,`onmessage({data:{__promotionInit:true,scope:${JSON.stringify(id)}}});`);
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));}
async function until(check){for(let i=0;i<500;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,1));}assert.fail('Bounded in-memory test condition did not settle');}
function forward(child,parent,workerIndex=0){for(const message of plain(child.outgoing.splice(0)))run(parent,`nativeWorkers[${workerIndex}].receive(${JSON.stringify(message)});`);}

// This invokes the entire exact production render-service module, including its
// Blob construction, URL revocation and ready handshake. Rendering itself is not
// executed: the fake native Worker responds to the application's init message.
async function createProductionRenderer(c){
 const modules=Object.fromEntries(['math','renderer','render-worker'].map(n=>['source-'+n,PRODUCTION['src/'+n+'.js'].content]));
 c.productionSources=modules;
 run(c,`globalThis.LabDimensions={cueRadius:.01};globalThis.document={getElementById:id=>({textContent:productionSources[id]})};`);
 run(c,PRODUCTION['src/math.js'].content);
 run(c,PRODUCTION['src/renderer.js'].content);
 run(c,PRODUCTION['src/render-service.js'].content);
 await run(c,`WorkerRenderer.create({getContext:()=>({})}).then(value=>globalThis.renderService=value)`);
 return c.nativeWorkers[0];
}

test('complete embedded production render fixtures match official Git blob pins',()=>{
 for(const [name,file]of Object.entries(PRODUCTION))assert.equal(gitBlob(file.content),file.sha,name);
 for(const name of ['math','renderer','render-worker'])assert(!/LabForecast|OptimizerService|LabInverseEvents|__promotionAudit/.test(PRODUCTION['src/'+name+'.js'].content),name);
});

test('first production render worker is observed, unchanged, hashed and never privately initialized',async()=>{
 const c=realm(),worker=await createProductionRenderer(c);
 assert.equal(c.nativeWorkers.length,1);
 assert.equal((await flush(c)).complete,true);
 const original='globalThis.LabDimensions={"cueRadius":0.01};\n'+['math','renderer','render-worker'].map(n=>PRODUCTION['src/'+n+'.js'].content).join('\n');
 assert.equal(worker.blob.parts.join(''),original);
 assert.equal(worker.blob.__promotionOriginal,original);
 assert.equal(worker.blob.__promotionInstrumented,false);
 assert.deepEqual(plain(worker.posted.map(x=>x.data)),[{type:'init'}]);
 assert.deepEqual(plain(c.revoked),[worker.url]);
 const records=events(c),created=records.find(e=>e.type==='worker-created'),source=records.find(e=>e.type==='worker-source');
 assert.equal(created.observed,true);assert.equal(created.instrumented,false);
 assert.equal(source.sourceId,created.sourceId);assert.equal(source.sourceSHA,sha256(original));
 assert.equal(source.sourceBytes,Buffer.byteLength(original));assert.equal(source.sourceHashAlgorithm,'SHA-256');
 assert(!Object.hasOwn(source,'source'));assert.equal(status(c).payloads,0);
 assert(records.some(e=>e.type==='worker-dispatch'&&e.messageType==='init'));
 assert(records.some(e=>e.type==='worker-receive'&&e.messageType==='ready'));
 run(c,`renderService.dispose()`);
 assert.equal(worker.terminated,true);assert(events(c).some(e=>e.type==='worker-terminate'));
 assert.equal(run(c,'__promotionAudit.children.get(nativeWorkers[0].__promotionId).alive'),false);
});

test('ordinary worker errors remain recorded rather than suppressed',async()=>{
 const c=realm();await createProductionRenderer(c);run(c,`nativeWorkers[0].error('render fixture error')`);
 assert(events(c).some(e=>e.type==='worker-error'&&e.message==='render fixture error'));
 assert.equal((await flush(c)).complete,true);
});

test('unknown external, unregistered blob, binary and over-limit sources still fail closed',()=>{
 for(const expression of [
  `new Worker('https://example.invalid/unknown.js')`,
  `new Worker('blob:unknown')`,
  `new Worker(URL.createObjectURL(new Blob([new Uint8Array([1,2,3])],{type:'text/javascript'})))`,
  `new Worker(URL.createObjectURL(new Blob(Array(257).fill('x'))))`,
  `new Worker(URL.createObjectURL(new Blob(['x'.repeat(8*1024*1024+1)])))`
 ]){
  const c=realm();run(c,expression);assert.equal(status(c).complete,false,expression);assert.match(status(c).failure,/Unobserved worker source/);
  assert.equal(c.nativeWorkers[0].posted.length,0);assert.equal(status(c).events,0);
  run(c,`__promotionAudit.emit('later',{ok:true})`);assert.equal(status(c).events,0,'sticky failure cannot become passing evidence');
 }
});

test('empty, ordinary and premarked source text are observable without reinstrumentation',async()=>{
 for(const text of ['',`onmessage=()=>{};`,`/* LabForecast __promotionAudit already present */ onmessage=()=>{};`]){
  const c=realm();run(c,`globalThis.original=${JSON.stringify(text)};new Worker(URL.createObjectURL(new Blob([original])));`);
  assert.equal((await flush(c)).complete,true);
  assert.equal(c.nativeWorkers[0].posted.length,0);
  assert.equal(c.nativeWorkers[0].blob.parts.join(''),text);
  assert.equal(events(c).find(e=>e.type==='worker-source').sourceSHA,sha256(text));
 }
});

test('all targeted solver markers still inject exactly one bootstrap and private init',async()=>{
 for(const marker of ['LabForecast','OptimizerService','LabInverseEvents']){
  const c=realm(),source=`/* ${marker} */ globalThis.appMessages=[];onmessage=e=>appMessages.push(e.data);`;
  run(c,`globalThis.original=${JSON.stringify(source)};new Worker(URL.createObjectURL(new Blob([original],{type:'text/javascript'})));`);
  const worker=c.nativeWorkers[0],injected=worker.blob.parts.join('');
  assert.equal(worker.blob.__promotionOriginal,source);assert.equal(worker.blob.__promotionInstrumented,true);
  assert(injected.startsWith(source));assert(injected.includes('function createCaptureStore'));
  assert.equal(worker.blob.parts.length,6);assert.equal(worker.blob.parts[1],'\n;(');
  assert.deepEqual(plain(worker.posted.map(x=>x.data)),[{__promotionInit:true,scope:worker.__promotionId}]);
  const child=realm({source:injected});init(child,worker.__promotionId);
  assert.equal(child.appMessages.length,0,'private init must be consumed before app handler');
  run(child,`onmessage({data:{type:'request',requestId:7}})`);
  assert.deepEqual(plain(child.appMessages),[{type:'request',requestId:7}]);
  assert(child.outgoing.some(e=>e.type==='worker-identity-ready'&&e.scope===worker.__promotionId));
  forward(child,c);assert.equal((await flush(c)).complete,true);
  assert.equal(events(c).find(e=>e.type==='worker-source').sourceSHA,sha256(source));
 }
});

test('ordinary first worker does not break later solver identity or request payload deduplication',async()=>{
 const c=realm();await createProductionRenderer(c);
 run(c,`const solver=new Worker(URL.createObjectURL(new Blob(['/* LabForecast */ onmessage=()=>{};'])));const req={snapshot:{world:new Uint8Array([1,2,255])},options:{}};solver.postMessage({type:'request',req});solver.postMessage({type:'request',req});req.snapshot.world[0]=99;`);
 assert.equal((await flush(c)).complete,true);
 const created=events(c).filter(e=>e.type==='worker-created');assert.equal(created.length,2);assert.notEqual(created[0].workerId,created[1].workerId);
 assert.equal(created[0].instrumented,false);assert.equal(created[1].instrumented,true);
 const dispatch=events(c).filter(e=>e.type==='worker-dispatch'&&e.messageType==='request');
 assert.equal(dispatch.length,2);assert.equal(dispatch[0].request.$payload,dispatch[1].request.$payload);
 const payload=run(c,`__promotionAudit.store.payloads.get(${JSON.stringify(dispatch[0].request.$payload)})`);
 assert.equal(sha256(payload),dispatch[0].request.$payload);assert.deepEqual(JSON.parse(payload).snapshot.world,[1,2,255]);
});

test('nested solver and ordinary child lineages retain unique identities and exact source hashes',async()=>{
 const c=realm();run(c,`new Worker(URL.createObjectURL(new Blob(['/* OptimizerService */ onmessage=()=>{};'])))`);
 const coordinator=c.nativeWorkers[0],child=realm({source:coordinator.blob.parts.join('')});init(child,coordinator.__promotionId);
 run(child,`new Worker(URL.createObjectURL(new Blob(['onmessage=()=>{};'])));new Worker(URL.createObjectURL(new Blob(['/* LabInverseEvents */ onmessage=()=>{};'])));`);
 const solver=child.nativeWorkers[1],leaf=realm({source:solver.blob.parts.join('')});init(leaf,solver.__promotionId);
 await until(()=>child.outgoing.filter(e=>e.type==='worker-source').length===2);forward(leaf,child,1);forward(child,c);
 assert.equal((await flush(c)).complete,true);assert.equal(status(c).pendingSources,0);
 const created=events(c).filter(e=>e.type==='worker-created'),ids=created.map(e=>e.workerId);assert.equal(new Set(ids).size,3);
 assert.equal(created[1].parent,coordinator.__promotionId);assert.equal(created[2].parent,coordinator.__promotionId);
 assert.equal(created[1].instrumented,false);assert.equal(created[2].instrumented,true);
 assert.equal(child.nativeWorkers[0].posted.length,0);assert.equal(child.nativeWorkers[1].posted[0].data.scope,created[2].workerId);
 const sources=events(c).filter(e=>e.type==='worker-source');assert.equal(sources.length,3);
 for(const event of created)assert(sources.some(s=>s.sourceId===event.sourceId));
 run(child,`nativeWorkers[0].terminate();nativeWorkers[1].terminate();`);forward(child,c);
 assert.equal(events(c).filter(e=>e.type==='worker-terminate').length,2);
});

test('nested ordinary and solver URL creation before unique identity remains fatal',()=>{
 for(const source of ['onmessage=()=>{};','/* OptimizerService */ onmessage=()=>{};']){
  const c=realm({workerRealm:true});run(c,`URL.createObjectURL(new Blob([${JSON.stringify(source)}]));`);init(c,'page.w2');
  assert(c.outgoing.some(e=>e.__promotionOverflow&&/unique audit identity/.test(e.reason)));
  assert(!c.outgoing.some(e=>e.type==='worker-source-pending'));
 }
});

test('nested unknown source and child count overflow propagate and invalidate root evidence',async()=>{
 for(const action of [`new Worker('https://example.invalid/unknown.js')`,`const url=URL.createObjectURL(new Blob(['onmessage=()=>{};']));for(let i=0;i<140;i++)new Worker(url);`]){
  const page=realm();run(page,`new Worker(URL.createObjectURL(new Blob(['/* OptimizerService */ onmessage=()=>{};'])))`);
  const worker=page.nativeWorkers[0],child=realm({source:worker.blob.parts.join('')});init(child,worker.__promotionId);run(child,action);
  await settle();forward(child,page);await flush(page);
  assert.equal(status(page).complete,false);
  assert.match(status(page).failure,action.includes('unknown.js')?/Unobserved worker source/:/worker count limit/);
  assert(events(page).filter(e=>e.type==='worker-created'&&e.parent===worker.__promotionId).length<=128);
 }
});

test('ordinary source URL and per-realm child counts retain existing 128-entry caps',async()=>{
 const urls=realm({hash:{subtle:{digest:()=>new Promise(()=>{})}}});
 run(urls,`const blob=new Blob(['onmessage=()=>{};']);for(let i=0;i<300;i++)URL.createObjectURL(blob);`);
 assert.equal(status(urls).complete,false);assert.match(status(urls).failure,/URL count limit/);assert.equal(status(urls).pendingSources,128);
 const workers=realm();run(workers,`const url=URL.createObjectURL(new Blob(['onmessage=()=>{};']));for(let i=0;i<300;i++)new Worker(url);`);
 assert.equal((await flush(workers)).complete,false);assert.match(status(workers).failure,/worker count limit/);
 assert.equal(run(workers,'__promotionAudit.children.size'),128);
});

test('UTF-8 source bytes, total unique source bytes and capture limits are unchanged',async()=>{
 const bytes=realm({limits:{maxSourceBytes:5}});run(bytes,`new Worker(URL.createObjectURL(new Blob(['한글'])));`);
 assert.equal(status(bytes).complete,false);assert.match(status(bytes).failure,/worker source byte limit/);
 const total=realm({limits:{maxSourceBytes:10000,maxBytes:1500}});
 run(total,`URL.createObjectURL(new Blob(['a'.repeat(800)]));URL.createObjectURL(new Blob(['b'.repeat(800)]));`);
 assert.equal(status(total).complete,false);assert.match(status(total).failure,/unique source hashing byte limit/);
 const payloads=realm({limits:{maxPayloads:0}});run(payloads,`const w=new Worker(URL.createObjectURL(new Blob(['onmessage=()=>{};'])));w.postMessage({type:'request',req:{snapshot:{world:[1]},options:{}}});`);
 assert.equal((await flush(payloads)).complete,false);assert.match(status(payloads).failure,/payload limit/);
});

test('missing or failed native digest remains fatal and pending hashes never count as complete proof',async()=>{
 for(const hash of [null,{subtle:{digest:()=>Promise.reject(Error('fixture digest failure'))}}]){
  const c=realm({hash});run(c,`new Worker(URL.createObjectURL(new Blob(['onmessage=()=>{};'])))`);
  assert.equal(status(c).pendingSources,1);assert.equal((await flush(c)).complete,false);assert.match(status(c).failure,/Source hash failed/);assert.equal(status(c).pendingSources,1);
 }
 let resolveDigest;const c=realm({hash:{subtle:{digest:()=>new Promise(resolve=>{resolveDigest=resolve;})}}});
 run(c,`new Worker(URL.createObjectURL(new Blob(['onmessage=()=>{};'])))`);
 assert.equal(c.nativeWorkers.length,1);assert.equal(status(c).pendingSources,1);assert.equal(status(c).complete,true);
 await Promise.resolve();const digest=crypto.createHash('sha256').update('onmessage=()=>{};').digest();resolveDigest(digest.buffer.slice(digest.byteOffset,digest.byteOffset+digest.byteLength));
 assert.equal((await flush(c)).pendingSources,0);assert.equal(status(c).complete,true);
});

test('production render frame messages, transfer arguments and returned bitmaps remain intact',async()=>{
 const c=realm();await createProductionRenderer(c);
 run(c,`globalThis.frame={type:'frame',id:1,objects:[],size:{width:64,height:64,dpr:1},state:{}};globalThis.transfers=[new Uint8Array([1,2]).buffer];nativeWorkers[0].postMessage(frame,transfers);renderService.sequence=1;renderService.inFlightSize=frame.size;globalThis.bitmap={width:64,height:64,close(){}};nativeWorkers[0].receive({type:'frame',id:1,bitmap,renderMs:2});`);
 assert.strictEqual(c.nativeWorkers[0].posted[1].data,c.frame);
 assert.strictEqual(c.nativeWorkers[0].posted[1].transfer[0],c.transfers);
 assert.strictEqual(c.renderService.readyBitmap,c.bitmap);assert.equal(c.renderService.metrics.renderMs,2);
 assert.equal(c.nativeWorkers[0].posted.length,2,'only application init/frame messages, no private init');
 assert.equal((await flush(c)).complete,true);
 assert(events(c).some(e=>e.type==='worker-dispatch'&&e.messageType==='frame'));
 assert(events(c).some(e=>e.type==='worker-receive'&&e.messageType==='frame'));
});

test('repeated ordinary source URLs share one digest while retaining separate source identities',async()=>{
 let calls=0;const c=realm({hash:{subtle:{digest(...args){calls++;return crypto.webcrypto.subtle.digest(...args);}}}});
 run(c,`const blob=new Blob(['onmessage=()=>{};']);new Worker(URL.createObjectURL(blob));new Worker(URL.createObjectURL(blob));`);
 assert.equal((await flush(c)).complete,true);assert.equal(calls,1);
 const sources=events(c).filter(e=>e.type==='worker-source');assert.equal(sources.length,2);
 assert.notEqual(sources[0].sourceId,sources[1].sourceId);assert.equal(sources[0].sourceSHA,sources[1].sourceSHA);
});

}

// Actual writer integration: an open healthy file is not yet final-complete.
test('real open recorder passes readiness while final completeness remains false until close',async t=>{
 const rec=C.createCaseRecorder(output(t));let pageCalls=0;assert.equal(rec.status().raw.complete,false);assert.equal(rec.status().raw.closed,false);assert.equal(rec.status().raw.failures,0);
 await C.assertPageRecordingReady({evaluate:async()=>{pageCalls++;return{complete:true,failure:null,pendingSources:1};}},rec);assert.equal(pageCalls,1);assert.equal(rec.status().failure,null);assert.equal(rec.status().raw.complete,false);assert.equal(rec.status().page.pendingSources,1);
 rec.setPageStatus({complete:true,failure:null,pendingSources:0});assert.equal(rec.record('proof',{realWriter:true}),true);assert.equal(rec.close().complete,true);assert.equal(rec.status().raw.closed,true);
});
test('real closed recorder fails readiness, makes failure sticky, and never calls page',async t=>{
 const rec=C.createCaseRecorder(output(t));rec.setPageStatus({complete:true,pendingSources:0});assert.equal(rec.close().complete,true);let pageCalls=0;
 await assert.rejects(C.assertPageRecordingReady({evaluate:async()=>{pageCalls++;}},rec),/Host observation unavailable/);assert.equal(pageCalls,0);assert.match(rec.status().failure,/Host observation unavailable/);assert.equal(rec.close().complete,false);const report={};assert.equal(C.stopAfterRecordingFailure(report,{recording:rec.status()}),true);
});
test('real failed-open recorder fails before page and stops fixture at final classification',async t=>{
 const root=path.dirname(output(t)),rec=C.createCaseRecorder(path.join(root,'missing-parent','raw.ndjson'));let pageCalls=0;assert(rec.status().raw.failures>0);
 await assert.rejects(C.assertPageRecordingReady({evaluate:async()=>{pageCalls++;}},rec),/Host observation unavailable/);assert.equal(pageCalls,0);assert.equal(rec.close().complete,false);assert.match(rec.status().failure,/Host observation unavailable/);const report={};assert.equal(C.stopAfterRecordingFailure(report,{recording:rec.status()}),true);
});
