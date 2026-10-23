'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('../vendor/rapier.cjs');for(const f of ['math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer'])require('../src/'+f+'.js');
const {V,len,sub}=LabMath;let lab,base,request,targetResult,caromResult;const metrics=[];
const options=(p={})=>({mode:'target',targetId:2,secondId:3,budget:48,horizon:16,objective:'shortest',spin:true,...p});
const run=(req)=>{const s=LabOptimizer.createSearch(R,req);try{while(!LabOptimizer.advanceSearch(s,8000));return LabOptimizer.finishSearch(s)}finally{LabOptimizer.disposeSearch(s)}};
const trial=(req,settings)=>{const s=LabOptimizer.createSearch(R,req),t=LabOptimizer.beginTrial(s,settings);assert.ok(t);try{while(!LabOptimizer.stepTrial(s,t,8000));return LabOptimizer.finishTrial(s,t)}catch(e){t.lab.dispose();throw e}};
before(async()=>{await R.init();lab=new PhysicsLab(R);base=lab.snapshot({trails:false});request={snapshot:base,selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:options()}});
after(()=>{lab.dispose();if(process.env.OPTIMIZER_REPORT)fs.writeFileSync(process.env.OPTIMIZER_REPORT,JSON.stringify({metrics},null,2))});
test('search validates distinct source and target bodies, finite limits and budgets',()=>{
 for(const o of [{mode:'oops'},{targetId:1},{targetId:999},{mode:'carom',secondId:2},{horizon:60},{budget:100},{spin:'true'}])assert.throws(()=>LabOptimizer.validate({...request,options:options(o)}));
 assert.throws(()=>LabOptimizer.validate({...request,settings:{...request.settings,elevation:NaN}}));
 assert.throws(()=>LabOptimizer.validate({...request,settings:{...request.settings,elevation:81}}));
});
test('target search returns successful ranked physical shots without mutating the original world',()=>{
 const bytes=Buffer.from(lab.world.takeSnapshot()),settings=JSON.stringify(request.settings);targetResult=run(request);
 assert.ok(targetResult.results.length>=1);assert.equal(targetResult.globalOptimal,false);assert.equal(targetResult.tested,48);assert.equal(targetResult.evaluated+targetResult.rejected,48);
 assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);assert.equal(lab.shots,0);assert.equal(JSON.stringify(request.settings),settings);
 const values=targetResult.results.map(r=>r.distance);assert.deepEqual(values,[...values].sort((a,b)=>a-b));
 for(const r of targetResult.results){assert.equal(r.success,true);assert.equal(r.contacts.find(e=>e.kind==='object').id,2);assert.equal(r.settings.elevation,8)}
 metrics.push({name:'default-target',result:targetResult});
});
test('a recommended shot is independently reproduced by the same prediction engine',()=>{
 const selected=targetResult.results[0],prediction=LabForecast.predict(R,{snapshot:base,selectedId:1,settings:selected.settings,horizon:16});
 const replay=PhysicsLab.fromSnapshot(R,base);try{assert.equal(replay.strike(1,selected.settings).ok,true);replay.step(prediction.iterations);let error=0;for(const o of prediction.final)error=Math.max(error,len(sub(o.position,replay.get(o.id).body.translation())));assert.equal(error,0);const contact=prediction.events.find(e=>(e.a?.id===1&&e.b?.id===2)||(e.a?.id===2&&e.b?.id===1));assert.ok(contact);assert.ok(Math.abs(contact.time-selected.seconds)<replay.dt);metrics.push({name:'recommended-replay',maxErrorM:error})}finally{replay.dispose()}
});
test('two-object search verifies the specified contact order',()=>{
 caromResult=run({...request,options:options({mode:'carom'})});assert.ok(caromResult.results.length);for(const r of caromResult.results){const ids=r.contacts.filter(x=>x.kind==='object').map(x=>x.id);assert.equal(ids[0],2);assert.equal(ids.at(-1),3);assert.ok(r.seconds<=16)}metrics.push({name:'default-carom',result:caromResult});
});
test('a two-ball success without three cushions is not falsely labelled a three-cushion success',()=>{
 const r=caromResult.results.find(r=>r.cushions<3);assert.ok(r);const test=trial({...request,options:options({mode:'three'})},r.settings);assert.equal(test.success,false);
});
test('the wrong first object invalidates the candidate',()=>{
 const result=trial({...request,options:options({targetId:3})},targetResult.results[0].settings);assert.equal(result.success,false);assert.equal(result.contacts[0].id,2);
});
test('turning off spin generates only centre-point candidate settings',()=>{
 const req={...request,testBudget:true,options:options({budget:12,spin:false})},s=LabOptimizer.createSearch(R,req);try{while(!LabOptimizer.advanceSearch(s,8000));assert.ok(s.pool.length);for(const r of s.pool){assert.equal(r.settings.tipX,0);assert.equal(r.settings.tipY,0)}}finally{LabOptimizer.disposeSearch(s)}
});
test('gentle priority ranks valid results by lower cue speed',()=>{
 const r=run({...request,testBudget:true,options:options({budget:12,objective:'gentle'})});assert.ok(r.results.length);const v=r.results.map(x=>x.settings.speed);assert.deepEqual(v,[...v].sort((a,b)=>a-b));
});
test('a failed bounded search returns an empty result, not a fabricated successful route',()=>{
 const r=run({...request,testBudget:true,options:options({budget:1,targetId:3})});assert.equal(r.results.length,0);assert.equal(r.globalOptimal,false);assert.equal(r.nearest.success,false);
});
test('cancel disposal frees an active cloned world and leaves the source intact',()=>{
 const bytes=Buffer.from(lab.world.takeSnapshot()),s=LabOptimizer.createSearch(R,request);LabOptimizer.advanceSearch(s,1);assert.ok(s.active);LabOptimizer.disposeSearch(s);assert.equal(s.active,null);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);
});
test('repeat searches use the same deterministic candidates and results',()=>{
 const req={...request,testBudget:true,options:options({budget:10})},a=run(req),b=run(req);assert.deepEqual(a.results,b.results);
});
test('three-cushion goal is validated from actual contacts before the second target',()=>{
 // Fixture found by the 320-candidate exploratory search, not a path shortcut.
 const settings={angle:-1.09069,elevation:8,speed:4.5,tipX:0,tipY:.15};
 const req={...request,settings,testBudget:true,options:options({mode:'three',budget:1})},r=run(req);assert.equal(r.results.length,1);const hit=r.results[0];assert.equal(hit.cushions,3);assert.deepEqual(hit.contacts.map(c=>c.kind==='cushion'?'c':c.id),[2,'c','c','c',3]);assert.ok(hit.seconds<16);metrics.push({name:'three-cushion-contact-order',result:hit});
});
