'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const n of ['math','physics','route-rules','route-sampler','optimizer-core'])require('../src/'+n+'.js');
before(async()=>R.init());
test('first impact with a moving object is not a kiss and does not change physics',()=>{
 const lab=new PhysicsLab(R);
 try{
  lab.get(2).body.setLinvel({x:.03,y:0,z:0},true);
  const snapshot=lab.snapshot({trails:false}),settings={angle:-3.1,elevation:8,speed:2.6,tipX:0,tipY:0};
  const outcomes=[];
  for(const allowKiss of [true,false]){
   const req={snapshot,selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,budget:48,horizon:8,objective:'shortest',spin:false,allowKiss}};
   const s=ShotSearchCore.createSearch(R,req),t=ShotSearchCore.beginTrial(s,settings);assert.ok(t);
   while(!ShotSearchCore.stepTrial(s,t,960));
   const final=t.lab.get(2).body.translation();outcomes.push({position:{...final},result:ShotSearchCore.finishTrial(s,t)});
  }
  assert.equal(outcomes[0].result.success,true);assert.equal(outcomes[1].result.success,true);
  assert.deepEqual(outcomes[1].result.kissContacts,[]);
  assert.deepEqual(outcomes[0].position,outcomes[1].position);
  assert.equal(lab.shots,0);
 }finally{lab.dispose();}
});
test('a physical cushion-return double kiss is detected below UI contact debounce',()=>{
 const lab=new PhysicsLab(R);
 try{
  for(const [id,x,z] of [[1,.9,0],[2,1.36,0],[3,-.8,.4]]){const o=lab.get(id);o.body.setTranslation({x,y:o.radius+.00005,z},true);o.body.setLinvel({x:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:0},true);}
  lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:0,elevation:8,speed:2.6,tipX:0,tipY:0},req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'carom',targetId:2,secondId:3,budget:48,horizon:8,objective:'shortest',spin:false,allowKiss:true}};
  const s=ShotSearchCore.createSearch(R,req),t=ShotSearchCore.beginTrial(s,settings);assert.ok(t);
  try{
   for(let i=0;i<1920&&!t.kisses.contacts.length;i++)ShotSearchCore.stepTrial(s,t,1);
   assert.ok(t.kisses.contacts.length,'actual repeat collision');assert.equal(t.kisses.contacts[0].id,2);assert.equal(t.invalid,false);
   const forbidden=ShotSearchCore.createSearch(R,{...req,options:{...req.options,allowKiss:false}}),copy=ShotSearchCore.beginTrial(forbidden,settings);
   try{for(let i=0;i<1920&&!copy.invalid;i++)ShotSearchCore.stepTrial(forbidden,copy,1);assert.equal(copy.invalid,true);assert.deepEqual(copy.lab.get(1).body.translation(),t.lab.get(1).body.translation());}finally{copy.lab.dispose();}
  }
  finally{t.lab.dispose();}
 }finally{lab.dispose();}
});

test('completed target shots do not inspect or invalidate post-goal collisions',()=>{
 const trial={success:true,invalid:false,kisses:{contacts:[{id:2,time:2}]},hitTime:1};
 assert.equal(ShotSearchCore.stepTrial({req:{options:{allowKiss:false}}},trial),true);
 assert.equal(trial.invalid,false);
});
