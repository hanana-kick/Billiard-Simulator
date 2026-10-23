'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');for(const f of ['math','physics','route-rules','route-sampler','optimizer-core'])require('../src/'+f+'.js');
before(()=>R.init());
test('corner and rail poses restore elevation without removing obstruction geometry',()=>{
 for(const [x,z,angle] of [[-1.37,-.66,45],[1.37,-.66,135],[1.37,.66,-135],[-1.37,.66,-45],[-1.37,0,0],[1.37,0,180],[0,-.66,90],[0,.66,-90]]){
  const lab=new PhysicsLab(R);try{
   const cue=lab.get(1);cue.body.setTranslation({x,y:cue.radius+.00005,z},true);lab.world.propagateModifiedBodyPositionsToColliders();
   const settings={angle,elevation:0,speed:2,tipX:0,tipY:0},before=Buffer.from(lab.world.takeSnapshot());
   assert.equal(lab.cueClearance(cue,settings).clear,false);
   const result=lab.findCueFeasible(cue,settings,{minElevation:0,maxElevation:80});
   assert.ok(result.found,`${x},${z}`);assert.ok(result.settings.elevation<=80);assert.ok(lab.cueClearance(cue,result.settings).clear);
   assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),before);assert.ok(lab.strike(1,result.settings).ok);lab.step(480);
   assert.ok(Number.isFinite(cue.body.translation().x));
  }finally{lab.dispose();}
 }
});
test('fixed low elevation remains blocked and a bounded miss is not called impossible',()=>{
 const lab=new PhysicsLab(R);try{const cue=lab.get(1);cue.body.setTranslation({x:-1.37,y:cue.radius+.00005,z:-.66},true);lab.world.propagateModifiedBodyPositionsToColliders();
 const settings={angle:45,elevation:0,speed:2,tipX:0,tipY:0};assert.equal(lab.strike(1,settings).ok,false);
 const result=lab.findCueFeasible(cue,settings,{minElevation:0,maxElevation:5});assert.equal(result.found,false);assert.equal(result.reason,'not-found-within-geometric-budget');assert.equal(settings.elevation,0);
 }finally{lab.dispose();}
});
test('continuous finite-thickness sweep catches an obstacle clear of both endpoint tip poses',()=>{
 const lab=new PhysicsLab(R);try{
  const cue=lab.get(1);cue.body.setTranslation({x:.8,y:cue.radius+.00005,z:0},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:0,elevation:0,speed:2,tipX:0,tipY:0},p=lab.pose(cue,settings);assert.equal(lab.cueClearance(cue,settings).clear,true);
  const body=lab.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(p.tip.x+.006,p.tip.y+.00595,p.tip.z));
  const collider=lab.world.createCollider(R.ColliderDesc.ball(.00005),body);lab.statics.push({body,collider,label:'swept obstacle'});
  const shape=new R.Ball(LabDimensions.tipRadius),end=LabMath.add(p.tip,LabMath.mul(p.direction,.012));
  assert.equal(collider.intersectsShape(shape,p.tip,p.rotation),false);assert.equal(collider.intersectsShape(shape,end,p.rotation),false);
  const clearance=lab.cueClearance(cue,settings);assert.equal(clearance.clear,false);assert.equal(clearance.obstacle,'swept obstacle');assert.equal(clearance.swept,true);
 }finally{lab.dispose();}
});
test('actual stroke shaft/rail impulses are reported rather than hidden by the ball-only UI log',()=>{
 const lab=new PhysicsLab(R);try{
  const cue=lab.get(1);cue.body.setTranslation({x:-1.37,y:cue.radius+.00005,z:-.66},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const events=[];lab.onEvent=e=>events.push(e);
  // Deliberately enter an invalid pose only to exercise the physical observer.
  assert.ok(lab.strike(1,{angle:45,elevation:0,speed:2,tipX:0,tipY:0},{ignoreObstruction:true}).ok);
  lab.step(20);assert.ok(events.some(e=>e.kind==='cue-obstruction'&&e.impulse>0));
 }finally{lab.dispose();}
});
test('actual corner search restores a blocked pose and independently replays a target hit without cue obstruction',()=>{
 const lab=new PhysicsLab(R);try{
  const cue=lab.get(1);cue.body.setTranslation({x:-1.37,y:cue.radius+.00005,z:-.66},true);lab.get(2).body.setTranslation({x:-.7,y:cue.radius+.00005,z:.01},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:45,elevation:0,speed:2,tipX:0,tipY:0};assert.equal(lab.cueClearance(cue,settings).clear,false);
  const snapshot=lab.snapshot({trails:false}),bytes=Buffer.from(lab.world.takeSnapshot());
  const req={snapshot,selectedId:1,settings,options:{mode:'target',targetId:2,budget:48,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'search',minElevation:0,maxElevation:60}};
  const search=ShotSearchCore.createSearch(R,req);try{
   while(!ShotSearchCore.advanceSearch(search,960));const result=ShotSearchCore.finishSearch(search);assert.ok(result.feasibilityStats.restored>0);assert.ok(result.results.length);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);
   const replay=PhysicsLab.fromSnapshot(R,snapshot);try{const events=[];replay.onEvent=e=>events.push(e);assert.ok(replay.strike(1,result.results[0].settings).ok);replay.step(960);assert.ok(events.some(e=>e.kind==='contact'&&[e.a?.id,e.b?.id].includes(1)&&[e.a?.id,e.b?.id].includes(2)));assert.equal(events.some(e=>e.kind==='cue-obstruction'),false);}finally{replay.dispose();}
  }finally{ShotSearchCore.disposeSearch(search);}
 }finally{lab.dispose();}
});
test('a latched goal waits for cue separation without reconsidering later kisses',()=>{
 let ticks=0;const t={success:true,goalLatched:true,invalid:false,steps:0,lab:{dt:1/960,cue:{},step(){if(++ticks===3)this.cue=null;}},kisses:{contacts:[{id:2,time:2}]},hitTime:1};
 const s={req:{options:{horizon:8,allowKiss:false}}};assert.equal(ShotSearchCore.stepTrial(s,t,1),false);assert.equal(t.invalid,false);assert.equal(ShotSearchCore.stepTrial(s,t,10),true);assert.equal(ticks,3);assert.equal(t.invalid,false);
});
test('post-goal cue obstruction or unfinished cue tail cannot be certified as success',()=>{
 for(const obstruct of [true,false]){const t={success:true,goalLatched:true,invalid:false,steps:0,lab:{dt:1,cue:{},step(){if(obstruct)t.cueObstructed=true;}}};assert.equal(ShotSearchCore.stepTrial({req:{options:{horizon:1}}},t,1),true);assert.equal(t.invalid,true);if(!obstruct)assert.equal(t.verificationIncomplete,true);}
});
test('a real near-touching object hit is latched before actual cue separation and confirmed only afterward',()=>{
 const lab=new PhysicsLab(R);try{const cue=lab.get(1),p=cue.body.translation();lab.get(2).body.setTranslation({x:p.x+2*cue.radius+.00001,y:p.y,z:p.z},true);lab.world.propagateModifiedBodyPositionsToColliders();
 const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'target',targetId:2,budget:48,horizon:8,spin:false,objective:'shortest',allowKiss:false}};
 const search=ShotSearchCore.createSearch(R,req),trial=ShotSearchCore.beginTrial(search,settings);try{
  assert.equal(ShotSearchCore.stepTrial(search,trial,1),false);assert.equal(trial.success,true);assert.equal(trial.goalLatched,true);assert.ok(trial.lab.cue);const hitTime=trial.hitTime,contacts=JSON.stringify(trial.contacts);
  while(!ShotSearchCore.stepTrial(search,trial,1));assert.equal(trial.lab.cue,null);assert.equal(trial.invalid,false);assert.equal(trial.hitTime,hitTime);assert.equal(JSON.stringify(trial.contacts),contacts);
 }finally{trial.lab.dispose();}
 }finally{lab.dispose();}
});
test('engine upper supported elevation remains physically checked and produces finite motion when feasible',()=>{const lab=new PhysicsLab(R);try{const settings={angle:25,elevation:85,speed:1,tipX:0,tipY:0},clearance=lab.cueClearance(lab.get(1),settings),shot=lab.strike(1,settings);assert.notEqual(shot.reason,'유효하지 않은 타격 설정입니다.');assert.equal(shot.ok,clearance.clear);if(shot.ok){lab.step(120);for(const o of lab.objects){const p=o.body.translation();assert.ok(Number.isFinite(p.x+p.y+p.z));}}assert.equal(lab.strike(1,{...settings,elevation:85.01}).ok,false);}finally{lab.dispose();}});
