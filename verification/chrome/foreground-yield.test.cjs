'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const patched=fs.readFileSync(path.join(__dirname,'../../src/optimizer-service.js'),'utf8');
const original=fs.readFileSync(path.join(__dirname,'baseline-optimizer-service.js'),'utf8');
function fixture({source=patched,background=false,coordinator=true,count=40,blocks=1,cost=2,algorithm='cpu-event-window-inverse'}={}){
 let now=0,result=null;const timers=[],yieldLog=[],begins=[],finishes=[],commits=[],disposed=[],errors=[];
 const req={snapshot:{dt:1/120},options:{searchAlgorithm:algorithm,mode:'three',methods:['any'],budget:count}};
 const api={createStagedSearch:()=>({req,n:0,finished:false}),planWave:s=>[{id:s.n,kind:'inverse-constraint',req,topology:s.n,settings:{}}],commitWave:(s,rows)=>{assert.equal(rows.length,1);assert.equal(rows[0].id,s.n);assert.equal(rows[0].outcome.id,s.n);commits.push(rows[0].outcome);s.n++;s.finished=s.n===count;},stagedResult:s=>({tested:s.n,physicsSteps:s.n*blocks,results:[],elapsedMs:now}),pause:s=>{s.paused=true;},resume:s=>{s.paused=false;return true;}};
 const evaluator={begin:(_r,_req,id)=>{begins.push(id);return{id,n:0,steps:0};},advance:e=>{now+=cost;e.n++;e.steps++;return e.n===blocks;},finish:e=>{finishes.push(e.id);return{id:e.id,steps:e.steps};},dispose:e=>disposed.push(e.id)};
 const ctx={performance:{now:()=>now},navigator:{hardwareConcurrency:1},setTimeout:(fn,delay)=>{timers.push(fn);yieldLog.push({at:now,delay,committed:commits.length});return timers.length;},clearTimeout:()=>{},LabCPUEventWindowPlanner:api,LabCPUEventPlanner:api,LabInversePlanner:api,LabOptimizer:api,LabInverseEvents:evaluator};vm.createContext(ctx);vm.runInContext(source,ctx);
 const service=new ctx.OptimizerService(()=>{},r=>{result=r;},e=>errors.push(e),{background,coordinator});
 if(!coordinator)service.startExecution=function(r,id){this.mode='cooperative';this.actualWorkers=0;this.fallback(r,id);};
 async function tick(){assert.ok(timers.length,'pending timer');timers.shift()();for(let i=0;i<5;i++)await Promise.resolve();}
 async function drain(){for(let i=0;timers.length&&i<1000;i++)await tick();assert.equal(timers.length,0);assert.deepEqual(errors,[]);}
 return{service,start:()=>service.request(req),tick,drain,timers,yieldLog,begins,finishes,commits,disposed,errors,get result(){return result;}};
}
test('foreground short waves coalesce to 32ms and preserve every outcome',async()=>{
 const a=fixture(),b=fixture({source:original});a.start();b.start();await a.drain();await b.drain();
 assert.deepEqual(a.commits,b.commits);assert.equal(a.result.tested,40);assert.equal(a.yieldLog.length,2);assert.equal(b.yieldLog.length,39);
 assert.deepEqual(a.yieldLog.map(x=>x.at),[32,64]);assert.ok(a.yieldLog.every(x=>x.delay===0));assert.equal(new Set(a.begins).size,40);
});
test('shared slice bounds work across multi-block candidate boundaries',async()=>{
 const h=fixture({count:10,blocks:5,cost:3});h.start();await h.drain();let last=0;
 for(const y of h.yieldLog){assert.ok(y.at-last>=32&&y.at-last<35);last=y.at;}
 assert.equal(h.result.tested,10);assert.equal(h.finishes.length,10);
});
test('background timer delays and scheduling are exactly unchanged',async()=>{
 for(const blocks of [1,7]){const a=fixture({background:true,blocks}),b=fixture({source:original,background:true,blocks});a.start();b.start();await a.drain();await b.drain();assert.deepEqual(a.yieldLog,b.yieldLog);assert.deepEqual(a.commits,b.commits);assert.ok(a.yieldLog.every(y=>y.delay===4));}
});
test('main-thread fallback scheduling is exactly unchanged',async()=>{
 const a=fixture({coordinator:false,blocks:7}),b=fixture({source:original,coordinator:false,blocks:7});a.start();b.start();await a.drain();await b.drain();assert.deepEqual(a.yieldLog,b.yieldLog);assert.deepEqual(a.commits,b.commits);
});
test('cancel at wave yield prevents later evaluation and final result',async()=>{
 const h=fixture();h.start();assert.equal(h.commits.length,16);h.service.cancel();await h.drain();assert.equal(h.commits.length,16);assert.equal(h.begins.length,16);assert.equal(h.result,null);
});
test('cancel within candidate disposes once and does not commit it',async()=>{
 const h=fixture({blocks:30});h.start();assert.equal(h.commits.length,0);h.service.cancel();await h.drain();assert.deepEqual(h.disposed,[0]);assert.equal(h.commits.length,0);assert.equal(h.result,null);
});
test('suspend and promote retains exact in-flight candidate without duplication',async()=>{
 const h=fixture({background:true,blocks:20});h.start();const evaluation=h.service.cooperativeState.evaluation;assert.equal(evaluation.steps,4);assert.equal(h.service.suspend(),true);await h.tick();assert.equal(h.service.cooperativeState.evaluation,evaluation);assert.equal(evaluation.steps,4);assert.equal(h.service.promoteToForeground(),true);for(let i=0;i<5;i++)await Promise.resolve();await h.drain();assert.equal(h.result.tested,40);assert.equal(h.begins.length,40);assert.equal(new Set(h.begins).size,40);assert.deepEqual(h.finishes,h.begins);assert.equal(h.disposed.length,0);assert.equal(h.result.cooperativeRetention.continuedInPlace,true);assert.equal(h.result.cooperativeRetention.promotionSteps,4);
});
test('all dependency algorithms preserve traces under coalescing',async()=>{
 for(const algorithm of ['inverse-constraints','cpu-event-inverse','cpu-event-window-inverse']){const a=fixture({algorithm}),b=fixture({algorithm,source:original});a.start();b.start();await a.drain();await b.drain();assert.deepEqual(a.commits,b.commits);assert.equal(a.yieldLog.length,2);}
});
test('non-dependency coordinator pacing remains unchanged',async()=>{
 const a=fixture({algorithm:'other',blocks:7}),b=fixture({algorithm:'other',blocks:7,source:original});a.start();b.start();await a.drain();await b.drain();assert.deepEqual(a.yieldLog,b.yieldLog);assert.deepEqual(a.commits,b.commits);
});
test('request replacement ignores stale timer and completes only new generation',async()=>{
 const h=fixture();h.start();assert.equal(h.commits.length,16);h.start();await h.drain();assert.equal(h.commits.length,56);assert.equal(h.result.tested,40);assert.equal(h.begins.length,56);assert.deepEqual(h.commits.slice(16).map(x=>x.id),Array.from({length:40},(_,i)=>i));
});
