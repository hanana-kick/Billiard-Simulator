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
