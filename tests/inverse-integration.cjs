'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');for(const n of ['math','physics','route-rules','route-sampler','optimizer-core','optimizer'])require('../src/'+n+'.js');
before(()=>R.init());
test('default 48-candidate four-worker allocation executes physical numerical correction without changing source',()=>{
 const lab=new PhysicsLab(R);try{
  const snapshot=lab.snapshot({trails:false}),bytes=Buffer.from(lab.world.takeSnapshot());let total=0,steps=0,accepted=0;
  for(let index=0;index<4;index++){
   const req={snapshot,selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},partition:{index,count:4},options:{mode:'three',methods:['any'],order:'either',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',allowKiss:true}};
   const search=LabOptimizer.createSearch(R,req);
   try{while(!LabOptimizer.advanceSearch(search,960));const result=LabOptimizer.finishSearch(search);total+=result.tested;steps+=result.solverStats.steps;accepted+=result.solverStats.accepted;for(const r of result.results)assert.ok(LabRouteRules.evaluate(r.contacts,{method:'any',firstId:r.firstId,secondId:r.secondId}).success);}
   finally{LabOptimizer.disposeSearch(search);}
  }
  assert.equal(total,48);assert.ok(steps>0);assert.ok(accepted>0);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);assert.equal(lab.shots,0);
 }finally{lab.dispose();}
});
test('modern four-ball carom requests accept zero-cushion successes and start inverse depth at zero',()=>{
 const lab=new PhysicsLab(R);try{
  const snapshot=lab.snapshot({trails:false}),req={snapshot,selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'carom',methods:['any'],order:'either',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',allowKiss:true}};
  const search=LabOptimizer.createSearch(R,req);try{while(!LabOptimizer.advanceSearch(search,960));const result=LabOptimizer.finishSearch(search);assert.equal(result.tested,48);assert.equal(result.seedCushionRange[0],0);assert.ok(result.results.length);for(const r of result.results)assert.ok(LabRouteRules.evaluate(r.contacts,{method:'carom',firstId:r.firstId,secondId:r.secondId}).success);}finally{LabOptimizer.disposeSearch(search);}
 }finally{lab.dispose();}
});
