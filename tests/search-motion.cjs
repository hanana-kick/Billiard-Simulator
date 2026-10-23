'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const n of ['math','physics','route-rules','route-sampler','optimizer-core'])require('../src/'+n+'.js');
before(async()=>R.init());
test('moving-object exclusion rejects physical contacts without freezing objects',()=>{
 const lab=new PhysicsLab(R);
 try{
  lab.get(2).body.setLinvel({x:.03,y:0,z:0},true);
  const snapshot=lab.snapshot({trails:false}),settings={angle:-3.1,elevation:8,speed:2.6,tipX:0,tipY:0};
  const outcomes=[];
  for(const allowMovingTargets of [true,false]){
   const req={snapshot,selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,budget:48,horizon:8,objective:'shortest',spin:false,allowMovingTargets}};
   const s=ShotSearchCore.createSearch(R,req),t=ShotSearchCore.beginTrial(s,settings);assert.ok(t);
   while(!ShotSearchCore.stepTrial(s,t,960));
   const final=t.lab.get(2).body.translation();outcomes.push({position:{...final},result:ShotSearchCore.finishTrial(s,t)});
  }
  assert.equal(outcomes[0].result.success,true);assert.equal(outcomes[1].result.success,false);
  assert.ok(outcomes[1].result.movingTargetContacts.some(e=>e.id===2));
  assert.deepEqual(outcomes[0].position,outcomes[1].position);
  assert.equal(lab.shots,0);
 }finally{lab.dispose();}
});
