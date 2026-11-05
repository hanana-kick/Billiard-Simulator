'use strict';
// Source-only integration contracts. No native physics, browser, or build.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const request=(algorithm='cpu-event-window-inverse')=>({snapshot:{dt:1/960,objects:[]},selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{searchAlgorithm:algorithm,mode:'three',objective:'shortest',solveTimeMs:20000}});
function fakePlanner(label,flag){return{label,createStagedSearch(_R,req){return{req:structuredClone(req),pending:[],finished:false,committed:[]};},planWave(s){s.pending=[{id:7,kind:'inverse-constraint',purpose:'jacobian',topology:{id:'b'},req:s.req,settings:{...s.req.settings},eventPrefixOnly:true,...(flag===undefined?{}:{prefixMismatchWindow:flag})}];return structuredClone(s.pending);},commitWave(s,outs){s.committed.push(...structuredClone(outs));s.pending=[];s.finished=true;},stagedResult(s){return{results:[],tested:s.committed.length,found:0,physicsSteps:s.committed.length,elapsedMs:13,continuable:true};},pause(s){s.paused=true;},resume(s){s.paused=false;s.finished=false;return true;}};}
function environment(options={}){
 const {workerFailure=false,advanceHook=null,finishHook=null}=options,flag=Object.hasOwn(options,'flag')?options.flag:true;
 const workers=[],sources=[],records=[],errors=[],results=[],progress=[];let service,tick=0;
 class Worker{constructor(){if(workerFailure)throw Error('mock Worker unavailable');workers.push(this);}postMessage(data){this.sent=data;}terminate(){this.terminated=true;}}
 function evaluator(owner){return{begin(_R,req,topology,settings,options){const e={owner,req,topology,settings,options,trial:{steps:0},steps:0};records.push({owner,method:'begin',options:plain(options)});return e;},advance(e,n){records.push({owner,method:'advance',batch:n});e.trial.steps++;return advanceHook?advanceHook(owner,e,service):true;},finish(e){records.push({owner,method:'finish'});if(finishHook)return finishHook(owner,e,service);return{id:e.topology.id,purpose:e.options.purpose,settings:e.settings,steps:e.trial.steps,verified:false};},dispose(e){records.push({owner,method:'dispose'});e.disposed=true;}};}
 const original=evaluator('original'),window=evaluator('window'),baseline=fakePlanner('v5'),fast=fakePlanner('window',flag),inverse=fakePlanner('inverse');
 const timers=new Map();let nextTimer=1;
 const context={structuredClone,performance:{now:()=>tick+=10},Blob,navigator:{hardwareConcurrency:8},Worker,document:{getElementById(id){sources.push(id);return{textContent:'// '+id};}},URL:{createObjectURL:()=> 'blob:mock',revokeObjectURL(){}},setTimeout(fn,ms){if(ms===0)return setTimeout(fn,0);const id=nextTimer++;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},RAPIER:{},LabCPUEventPlanner:baseline,LabCPUEventWindowPlanner:fast,LabInversePlanner:inverse,LabOptimizer:fakePlanner('legacy'),LabInverseEvents:original,LabInverseEventsWindow:window};
 vm.createContext(context);vm.runInContext(read('src/optimizer-service.js'),context);service=new context.OptimizerService(p=>progress.push(p),r=>results.push(r),e=>errors.push(e));
 return{context,service,workers,sources,records,errors,results,progress,timers,baseline,fast,inverse};
}
function plannerHarness(){
 let now=100;
 const core={create(_R,req){return{req:structuredClone(req),roots:[{state:{iterations:0}}],dormant:[],results:[],started:now,evaluations:0,physicsSteps:0,nextId:0,domain:{},admitted:1,epoch:0};},next(s){if(s.paused||s.cancelled)return null;return{id:s.nextId++,purpose:s.evaluations%2?'verify':'residual',settings:{angle:s.epoch,elevation:8,speed:2,tipX:0,tipY:0},topology:{id:'b'+s.epoch},req:s.req};},accept(s,_id,out){s.evaluations++;s.physicsSteps+=10;s.roots[0].state.iterations++;if(out.verified){s.results.push({method:'any',settings:{angle:s.epoch,elevation:8,speed:2,tipX:0,tipY:0},distance:1,firstId:2,secondId:3,success:true});s.roots=[];}},result(s){return{results:structuredClone(s.results),evaluations:s.evaluations,physicsSteps:s.physicsSteps,unsupportedBranches:0,unresolvedBranches:0};},resume(s){if(s.cancelled)return false;s.paused=false;if(!s.roots.length){s.epoch++;s.roots.push({state:{iterations:0}});s.admitted++;}return true;},cancel(s){s.cancelled=true;}};
 const ctx={structuredClone,performance:{now:()=>now},LabCPUEventSearch:core,LabCPUEventSearchWindow:core,LabInversePlanner:{validate:()=>({})},LabRouteRules:{successIdentity:r=>JSON.stringify(r.settings),byId:new Map([['any',{label:'Any'}]])}};vm.createContext(ctx);vm.runInContext(read('src/cpu-event-planner.js'),ctx);vm.runInContext(read('src/cpu-event-window-planner.js'),ctx);return{ctx,api:ctx.LabCPUEventWindowPlanner,old:ctx.LabCPUEventPlanner,advanceTime(n){now+=n;}};
}

test('default algorithm remains original; v5 modules, native evaluator, geometry and physics remain byte-identical',()=>{
 const hashes={"inverse-solver.js":"86195c73110b269bce942bf472a150c7b507c3dcd52e63723f792434bb5cee49","inverse-events.js":"a645a2c42c5dc4efecec8c4c7c5673f980c70890a7965af8a4fd51ee21d8ddae","inverse-geometry.js":"b2354534fafab01322b72852fa184669f8847fa97a093f4480bc5c8f9777044f","inverse-planner.js":"5e07803dd3e593fb015428366038446caa9aa46c5b449c99b0155408a0357100","physics.js":"a36f5297bd96901cc82e041e1879ac5e623384c0575963a50032d27f1e460c1d","inverse-event-search.js":"e71f84b46e8359b06359cae03e0c3f1b1873340cc3fb14d7fe1925cc73383c06","inverse-event-tail-search.js":"f8ba07b9471868d8adb4eccb411926fafbd6875a6da835ed0d3c92aafba26e3a","inverse-event-adaptive-search.js":"c17397f5c50e4842e8ca7e0b55c988cf2b39c5650ec1a543d944ff158b3f9ec1","cpu-event-planner.js":"5726fc18e40b6e730d7c54ec2e54e95a6881a0dc7e6651847d86df82c9e33f26"};
 for(const [name,hash]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(read('src/'+name)).digest('hex'),hash,name);
 assert.match(read('src/controller.js'),/searchAlgorithm:'inverse-constraints'/);const ui=read('src/components/route-planner.tsx');for(const value of ['inverse-constraints','cpu-event-inverse','cpu-event-window-inverse'])assert.equal(ui.split('value="'+value+'"').length-1,1);
 assert.equal(crypto.createHash('sha256').update(read('src/inverse-events-window.js')).digest('hex'),'809bb3e5579059acdd787ce1832a68a9866104ff9dc997ca834024180e6585c4');
});
test('window namespaces leave all captured v5 API globals intact',()=>{
 const ctx={LabEventInverseSearch:{v5:1},LabEventTailSearch:{v5:2},LabCPUEventSearch:{v5:3},LabCPUEventPlanner:{v5:4},LabInversePlanner:{}};const old={...ctx};vm.createContext(ctx);
 for(const name of ['inverse-event-window-search','inverse-event-window-tail-search','inverse-event-window-adaptive-search','cpu-event-window-planner'])vm.runInContext(read('src/'+name+'.js'),ctx);
 for(const key of ['LabEventInverseSearch','LabEventTailSearch','LabCPUEventSearch','LabCPUEventPlanner'])assert.equal(ctx[key],old[key]);
 for(const key of ['LabEventInverseSearchWindow','LabEventTailSearchWindow','LabCPUEventSearchWindow','LabCPUEventWindowPlanner'])assert.equal(typeof (ctx[key].create||ctx[key].createStagedSearch),'function');
});
test('build order makes both independent chains and evaluator APIs available before service',()=>{
 const build=read('build.cjs'),literal=build.match(/const modules=(\[[^;]+\]);/)[1],modules=vm.runInNewContext(literal),index=n=>modules.indexOf(n);
 for(const [first,second]of [['inverse-events','inverse-events-window'],['inverse-planner','inverse-event-window-search'],['inverse-event-window-search','inverse-event-window-tail-search'],['inverse-event-window-tail-search','inverse-event-window-adaptive-search'],['inverse-event-window-adaptive-search','cpu-event-window-planner'],['cpu-event-window-planner','optimizer-service'],['cpu-event-planner','cpu-event-window-planner']])assert.ok(index(first)>=0&&index(first)<index(second),first+' before '+second);
});
test('all three planner routes remain distinct and only window Worker embeds the wrapper',()=>{
 for(const algorithm of ['inverse-constraints','cpu-event-inverse','cpu-event-window-inverse']){
  const h=environment();h.service.request(request(algorithm));assert.equal(h.service.api,algorithm==='inverse-constraints'?h.inverse:algorithm==='cpu-event-inverse'?h.baseline:h.fast);
  assert.equal(h.workers.length,algorithm==='inverse-constraints'?8:1);assert.equal(h.sources.includes('source-inverse-events-window'),algorithm==='cpu-event-window-inverse');assert.ok(h.sources.includes('source-inverse-events'));
  if(algorithm==='cpu-event-window-inverse'){assert.ok(h.sources.indexOf('source-inverse-events')<h.sources.indexOf('source-inverse-events-window'));assert.ok(h.sources.indexOf('source-inverse-events-window')<h.sources.indexOf('source-optimizer-worker'));assert.equal(h.workers[0].sent.job.prefixMismatchWindow,true);}
  if(algorithm!=='inverse-constraints'){assert.equal(h.progress.length,1);assert.equal(h.progress[0].elapsedMs,13);assert.equal(h.progress[0].partialResult.continuable,true);}
  h.service.dispose();assert.equal(h.timers.size,0);
 }
});
test('window planner flags cloned jobs, stops on first result and retains cumulative removed-root iterations',()=>{
 const h=plannerHarness(),req=request(),before=plain(req),s=h.api.createStagedSearch(null,req);req.options.objective='gentle';assert.deepEqual(plain(s.req),before);
 const first=h.api.planWave(s);assert.equal(first.length,1);assert.equal(first[0].prefixMismatchWindow,true);assert.equal(first[0].eventPrefixOnly,true);assert.equal(first[0].kind,'inverse-constraint');first[0].settings.speed=99;assert.notEqual(s.pending[0].settings.speed,99);assert.throws(()=>h.api.planWave(s),/Commit/);
 h.api.commitWave(s,[{id:s.pending[0].id,outcome:{verified:false}}]);assert.equal(s.finished,false);const verify=h.api.planWave(s);assert.equal(verify[0].purpose,'verify');h.api.commitWave(s,[{id:verify[0].id,outcome:{verified:true}}]);const result=h.api.stagedResult(s);
 assert.equal(s.finished,true);assert.equal(result.terminationReason,'first-feasible-shot');assert.equal(result.inputStrategy,'cpu-event-window-inverse');assert.equal(result.rootIterations,2);assert.equal(h.api.stagedResult(s).rootIterations,2);assert.equal(result.results.length,1);assert.equal(result.candidatePlan.probeObservationPolicy,'first-mismatch-outer-step-v1');assert.deepEqual(plain(h.api.planWave(s)),[]);
 const elapsed=result.elapsedMs;h.advanceTime(10000);assert.equal(h.api.stagedResult(s).elapsedMs,elapsed);assert.equal(h.api.resume(s),true);assert.equal(h.api.stagedResult(s).results.length,1);
 const pending=h.api.planWave(s);h.api.pause(s);h.advanceTime(1000);assert.equal(h.api.resume(s),true);assert.deepEqual(plain(s.pending),plain(pending));assert.throws(()=>h.api.commitWave(s,[{id:-1,outcome:{}}]),/Incomplete/);assert.deepEqual(plain(s.pending),plain(pending));h.api.commitWave(s,[{id:pending[0].id,outcome:{verified:false}}]);assert.equal(h.api.stagedResult(s).rootIterations,3);
 const old=h.old.createStagedSearch(null,request('cpu-event-inverse')),oldJob=h.old.planWave(old)[0];assert.ok(!Object.hasOwn(oldJob,'prefixMismatchWindow'));h.api.disposeSearch(s);assert.equal(s.core.cancelled,true);
});
test('cooperative fallback uses window only for literal true and leaves original begin options unchanged otherwise',()=>{
 for(const flag of [true,false,undefined,'true']){
  const h=environment({flag,workerFailure:true});h.service.request(request());assert.deepEqual(h.errors,[]);assert.equal(h.results.length,1);const owner=flag===true?'window':'original';assert.deepEqual(h.records.map(r=>r.owner),[owner,owner,owner]);assert.deepEqual(h.records.map(r=>r.method),['begin','advance','finish']);
  assert.deepEqual(h.records[0].options,{purpose:'jacobian',eventPrefixOnly:true,...(flag===true?{prefixMismatchWindow:true}:{})});assert.equal(h.results[0].executionMode,'cooperative');assert.equal(h.results[0].workerCount,0);assert.equal(h.service.latest,null);h.service.dispose();
 }
});
test('worker recovery retains the explicit window job and counts failed work separately',()=>{
 const h=environment();h.service.request(request());const worker=h.workers[0],job=plain(worker.sent.job);worker.onmessage({data:{requestId:worker.sent.requestId,candidateId:7,steps:9}});worker.onerror({preventDefault(){}});
 assert.equal(h.results.length,1);assert.equal(h.results[0].executionMode,'cooperative');assert.equal(h.results[0].retryOverhead.physicsSteps,9);assert.equal(h.records[0].owner,'window');assert.deepEqual(h.service.search.committed[0].id,job.id);assert.equal(worker.terminated,true);h.service.dispose();
});
test('cancellation prevents stale worker results and resume retains the exact pending job',()=>{
 const h=environment();h.service.request(request());const old=h.workers[0],sent=old.sent,pending=plain(h.service.search.pending);h.service.cancel();assert.equal(h.service.search.paused,true);old.onmessage({data:{requestId:sent.requestId,candidateId:sent.candidateId,outcome:{verified:true}}});assert.equal(h.service.search.committed.length,0);assert.equal(h.results.length,0);
 assert.equal(h.service.resume(),true);assert.deepEqual(plain(h.service.search.pending),pending);const resumed=h.workers.at(-1);assert.equal(resumed.sent.job.prefixMismatchWindow,true);assert.notEqual(resumed.sent.requestId,sent.requestId);h.service.dispose();
});
test('fallback cancellation disposes through its captured evaluator after latest is cleared',async()=>{
 const h=environment({workerFailure:true,advanceHook(_owner,_e,service){service.cancel();return false;}});h.service.request(request());await new Promise(r=>setTimeout(r,5));assert.equal(h.service.latest,null);assert.equal(h.results.length,0);assert.deepEqual(h.errors,[]);assert.equal(h.records.filter(r=>r.method==='dispose').length,1);assert.equal(h.records.find(r=>r.method==='dispose').owner,'window');h.service.dispose();
});
test('fallback failure cleans up the captured evaluator and missing wrapper never falls back silently',()=>{
 const h=environment({workerFailure:true,advanceHook(){throw Error('mock advance error');}});h.service.request(request());assert.deepEqual(h.errors,['mock advance error']);assert.equal(h.records.find(r=>r.method==='dispose').owner,'window');h.service.dispose();
 const absent=environment({workerFailure:true});delete absent.context.LabInverseEventsWindow;absent.service.request(request());assert.deepEqual(absent.errors,['Requested inverse evaluator unavailable']);assert.equal(absent.records.length,0);absent.service.dispose();
});
test('the existing source-gameplay admission restriction is not broadened for either experiment',()=>{
 for(const algorithm of ['cpu-event-inverse','cpu-event-window-inverse']){const h=environment(),req=request(algorithm);h.context.LabSourceFinalizationRequest={admit(){assert.fail('unsupported experiment must not admit finalization');}};req.finalization={kind:'source-finalization-request-v1',policy:'source-gameplay-finalization-v1'};h.service.request(req);assert.deepEqual(h.errors,['Explicit source finalization requires the inverse source modules']);assert.equal(h.workers.length,0);h.service.dispose();}
});
