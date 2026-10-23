'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../src/optimizer-service.js'),'utf8');
function environment(extra={}){
 const workers=[],urls=[];class Worker{constructor(url){this.url=url;workers.push(this);}postMessage(data){this.sent=data;}terminate(){this.terminated=true;}}
 const ctx={performance,Blob,setTimeout,clearTimeout,navigator:{hardwareConcurrency:2},matchMedia:()=>({matches:false}),document:{getElementById:()=>({textContent:''})},URL:{createObjectURL:()=>{urls.push('blob:pool');return 'blob:pool';},revokeObjectURL:url=>urls.push('revoked:'+url)},Worker,...extra};vm.createContext(ctx);vm.runInContext(source,ctx);return{ctx,workers,urls};
}
const req={snapshot:{dt:1/960},settings:{},options:{budget:48,mode:'direct',methods:['any'],workers:2,objective:'shortest'}};
const row=(angle=0,distance=2)=>({settings:{angle,elevation:0,speed:2,tipX:0,tipY:0},method:'direct',firstId:2,secondId:3,distance,success:true});
const part=(results=[])=>({tested:24,total:24,evaluated:24,rejected:0,found:results.length,results});
test('automatic maximum uses all reported cores subject only to useful work and explicit resource guards',()=>{
 const {ctx}=environment(),f=ctx.OptimizerPool.workerLimit,p=ctx.OptimizerPool.workerPlan;
 assert.equal(f(1,{navigator:{hardwareConcurrency:16},matchMedia:()=>({matches:true})}),16);
 assert.equal(f(4,{navigator:{hardwareConcurrency:16,deviceMemory:2}}),8);
 assert.equal(f(4,{navigator:{hardwareConcurrency:2}}),2);
 assert.equal(f(0,{navigator:{hardwareConcurrency:8}}),8);
 assert.equal(p({options:{budget:12}},{navigator:{hardwareConcurrency:128}}).requestedWorkers,12);
 assert.equal(p({options:{budget:960}},{navigator:{hardwareConcurrency:1024}}).requestedWorkers,64);
 assert.equal(f(0,{navigator:{hardwareConcurrency:Infinity}}),2);
});
test('workers receive distinct deterministic partitions and one shared code URL is revoked',()=>{
 const {ctx,workers,urls}=environment();const service=new ctx.OptimizerService(()=>{},()=>{},()=>{});service.request(req);
 assert.deepEqual(workers.map(w=>({...w.sent.partition})),[{index:0,count:2},{index:1,count:2}]);assert.equal(urls.length,2);assert.equal(urls[1],'revoked:blob:pool');service.dispose();assert.ok(workers.every(w=>w.terminated));
});
test('arrival order does not affect results and duplicates are merged',()=>{
 function run(reverse){const {ctx,workers}=environment();let result;const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail);service.request(req);const messages=[part([row(1,3),row(2,2)]),part([row(2,2),row(3,1)])];for(const i of reverse?[1,0]:[0,1])workers[i].onmessage({data:{requestId:service.version,result:messages[i]}});assert.ok(workers.every(w=>w.terminated));return result;}
 const a=run(false),b=run(true);assert.deepEqual(JSON.parse(JSON.stringify(a.results)),JSON.parse(JSON.stringify(b.results)));assert.equal(a.tested,48);assert.equal(a.results.length,3);assert.equal(a.results[0].settings.angle,3);assert.equal(a.workerCount,2);assert.equal(a.globalOptimal,false);
});
test('cancellation and new request ignore late messages from terminated workers',()=>{
 const {ctx,workers}=environment();let calls=0;const service=new ctx.OptimizerService(()=>calls++,()=>calls++,()=>calls++);service.request(req);const old=workers.slice(),id=service.version;service.request(req);for(const w of old)w.onmessage({data:{requestId:id,result:part()}});assert.equal(calls,0);service.cancel();for(const w of workers.slice(2))w.onmessage({data:{requestId:service.version-1,result:part()}});assert.equal(calls,0);
});
test('worker failure restarts once cooperatively and ignores stale pool results',async()=>{
 let created=0,results=0;const {ctx,workers}=environment({RAPIER:{},LabOptimizer:{createSearch:()=>{created++;return{};},advanceSearch:()=>true,progress:()=>part(),previewSearch:()=>part(),finishSearch:()=>part(),disposeSearch:()=>{}}});const service=new ctx.OptimizerService(()=>{},()=>results++,assert.fail);service.request(req);const id=service.version;workers[0].onerror({preventDefault(){}});workers[1].onerror({preventDefault(){}});workers[0].onmessage({data:{requestId:id,result:part()}});await new Promise(r=>setTimeout(r,0));assert.equal(created,1);assert.equal(results,1);assert.equal(service.mode,'cooperative');assert.ok(workers.every(w=>w.terminated));
});
test('synchronous worker construction failure uses cooperative fallback',()=>{
 let result;const {ctx}=environment({Worker:class{constructor(){throw Error('blocked');}},RAPIER:{},LabOptimizer:{createSearch:()=>({}),advanceSearch:()=>true,progress:()=>part(),previewSearch:()=>part(),finishSearch:()=>part(),disposeSearch:()=>{}}});const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail);service.request(req);assert.equal(result.executionMode,'cooperative');assert.equal(result.workerCount,0);
});
test('merged free-path metadata reports actual explored depth rather than a fixed ceiling',()=>{
 const {ctx}=environment(),q={...req,options:{...req.options,mode:'three',methods:['any']}};
 const a={...part([row()]),seedMaxOrder:7,physicsSteps:80,solverStats:{probes:4,steps:1,accepted:1,rejected:0},terminationReason:'candidate-budget-exhausted'},b={...part(),seedMaxOrder:9,physicsSteps:100,terminationReason:'candidate-budget-exhausted'};
 const result=ctx.OptimizerPool.mergeResults([a,b],q,1,2,'worker-pool');
 assert.deepEqual(Array.from(result.seedCushionRange),[3,9]);assert.equal(result.seedMaxOrder,9);assert.equal(result.physicsSteps,180);assert.equal(result.solverStats.steps,1);assert.equal(result.exhaustive,false);assert.equal(result.feasibilityStatus,'verified-feasible-shot');
});
test('input strategy and independent analytical diagnostics survive the worker contract',()=>{
 const {ctx,workers}=environment();let result;const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail),q={...req,options:{...req.options,inputStrategy:'analytic'}};service.request(q);
 assert.ok(workers.every(w=>w.sent.options.inputStrategy==='analytic'));
 for(let i=0;i<2;i++)workers[i].onmessage({data:{requestId:service.version,result:{...part(i?[row()]:[]),analyticStats:{proposed:3,feasible:2,evaluated:2,rejectedReasons:['required-cue-speed-outside-range']},analyticDiagnostics:[{success:false,geometricResidual:1e-16,physicalResidualNorm:.3,failureReason:'insufficient-cushions'}],firstSuccessCost:i?{tested:9,physicsSteps:100,elapsedMs:200}:null}}});
 assert.equal(result.inputStrategy,'analytic');assert.equal(result.analyticStats.evaluated,4);assert.equal(result.analyticDiagnostics.length,2);assert.equal(result.analyticDiagnostics[0].physicalResidualNorm,.3);assert.equal(result.firstSuccessCost.scope,'worker-local');assert.equal(result.firstSuccessCost.tested,9);
});

test('construction pressure halves the pool before dispatching any candidate',()=>{
 let live=0,attempts=0;const accepted=[];class LimitedWorker{constructor(){attempts++;if(live>=3)throw Error('memory');live++;accepted.push(this);}postMessage(data){this.sent=data;}terminate(){if(!this.terminated)live--;this.terminated=true;}}
 const {ctx}=environment({navigator:{hardwareConcurrency:8},Worker:LimitedWorker});const service=new ctx.OptimizerService(()=>{},assert.fail,assert.fail);service.request(req);
 assert.equal(service.workers.length,2);assert.equal(service.plan.requestedWorkers,8);assert.equal(accepted.filter(w=>w.sent).length,2);assert.ok(accepted.filter(w=>w.terminated).every(w=>!w.sent));assert.ok(attempts<20);service.dispose();assert.equal(live,0);
});
test('archive is not limited to two or six results and retry preserves earlier successes',async()=>{
 let result;const {ctx,workers}=environment({RAPIER:{},LabOptimizer:{createSearch:()=>({}),advanceSearch:()=>true,progress:()=>part(),previewSearch:()=>part(),finishSearch:()=>part([row(100)]),disposeSearch:()=>{}}});
 const rows=Array.from({length:30},(_,i)=>row(i));const merged=ctx.OptimizerPool.mergeResults([part(rows)],req,1,1,'worker');assert.equal(merged.resultCount,30);assert.equal(merged.resultLimit,null);
 const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail);service.request(req);workers[0].onmessage({data:{requestId:service.version,progress:{...part(rows),partialResult:part(rows)}}});workers[1].onerror({preventDefault(){}});await new Promise(r=>setTimeout(r,0));assert.equal(result.results.length,31);assert.equal(result.retryOverhead.tested,24);assert.equal(result.restartedAfterWorkerFailure,true);
});

test('completed recovery keeps final progress complete and reports retries separately',async()=>{
 let result;const complete={...part([row(99)]),tested:48,total:48,physicsSteps:200,terminationReason:'candidate-budget-exhausted'};
 const {ctx,workers}=environment({RAPIER:{},LabOptimizer:{createSearch:()=>({}),advanceSearch:()=>true,progress:()=>complete,previewSearch:()=>complete,finishSearch:()=>complete,disposeSearch:()=>{}}});
 const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail);service.request(req);workers[0].onmessage({data:{requestId:service.version,progress:{...part([row(1)]),physicsSteps:100,terminationReason:'partial'}}});workers[1].onerror({preventDefault(){}});await new Promise(r=>setTimeout(r,0));assert.equal(result.results.length,2);assert.equal(result.tested,48);assert.equal(result.total,48);assert.equal(result.terminationReason,'candidate-budget-exhausted');assert.equal(result.physicsSteps,200);assert.equal(result.retryOverhead.tested,24);assert.equal(result.workAttemptTotal.tested,72);assert.equal(result.workAttemptTotal.physicsSteps,300);
});

test('silent startup and stalled progress recover finitely and cancellation clears watchdogs',()=>{
 for(const started of [false,true]){const timers=new Map();let next=1,result;
  const {ctx,workers}=environment({setTimeout:(fn,ms)=>{const id=next++;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),RAPIER:{},LabOptimizer:{createSearch:()=>({}),advanceSearch:()=>true,progress:()=>part(),previewSearch:()=>part(),finishSearch:()=>part(),disposeSearch:()=>{}}});
  const service=new ctx.OptimizerService(()=>{},r=>result=r,assert.fail);service.request(req);assert.equal(timers.size,2);assert.equal([...timers.values()][0].ms,45000);
  if(started)workers[0].onmessage({data:{requestId:service.version,progress:part()}});
  const timer=[...timers.values()].find(t=>t.ms===(started?30000:45000));timer.fn();assert.equal(result.workerFallbackReason,started?'worker-progress-timeout':'worker-startup-timeout');assert.equal(result.executionMode,'cooperative');assert.equal(timers.size,0);
  service.request(req);service.cancel();assert.equal(timers.size,0);
 }
});
