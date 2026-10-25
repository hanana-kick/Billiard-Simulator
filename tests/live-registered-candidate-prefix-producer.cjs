'use strict';
// Isolated original-engine producer. Future frames are assertion-only outputs.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/render-cadence.js');require('../src/physics.js');require('../src/game-rules.js');require('../src/controller.js');
const copy=structuredClone;
function parts(handle){const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,handle,true);return{index:d.getUint32(0,true),generation:d.getUint32(4,true)};}
function application(c){
 const l=c.lab,q=l.cue;
 return {time:l.time,steps:l.steps,shots:l.shots,revision:l.revision,dt:l.dt,strokeSubsteps:l.strokeSubsteps,nextId:l.nextId,params:copy(l.params),events:copy(l.events),
  registry:{staticCount:l.statics.length,objects:l.objects.map((o,index)=>({index,id:o.id,label:o.label,kind:o.kind,shape:o.shape,radius:o.radius,mass:o.mass,body:parts(o.body.handle),collider:parts(o.collider.handle),pairCollider:parts(o.pairCollider.handle)})),
   statics:l.statics.map((o,index)=>({index,label:o.label,kind:o.kind,body:parts(o.body.handle),collider:parts(o.collider.handle)}))},
  controller:{gameMode:c.state.gameMode,selectedId:c.state.selectedId,paused:c.state.paused,settings:copy(c.state.settings),undoCount:c.undoStack.length,redoCount:c.redoStack.length},game:copy(c.game?.snapshot()||null),
  cue:q?{shaft:parts(q.body.handle),head:parts(q.head.handle),guide:parts(q.guide.handle),shaftCollider:parts(q.shaft.handle),tipCollider:parts(q.tip.handle),neckCollider:parts(q.neck.handle),flex:parts(q.flex.handle),prismatic:parts(q.joint.handle),selectedId:q.selectedId,pose:copy(q.pose),started:q.started,contacted:q.contacted,contacts:copy([...q.contacts]),obstructions:copy([...q.obstructions]),stats:copy(q.stats)}:null};
}
function sampleBody(b){
 const m=b.effectiveWorldInvInertia(),invInertia=[m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33];
 const v=b.translation(),translation=[v.x,v.y,v.z],r=b.rotation(),rotation=[r.x,r.y,r.z,r.w],l=b.linvel(),linear=[l.x,l.y,l.z],a=b.angvel(),angular=[a.x,a.y,a.z];
 return {translation,rotation,linear,angular,invInertia,sleeping:b.isSleeping()};
}

(async()=>{
 await R.init();const {captureLiveRegisteredFourBall:capture}=await import('../src/browser-initial-import/live-capture.mjs');
 const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();
 try{
  let steps=0;while(!c.lab.objects.every(o=>o.body.isSleeping())&&steps++<2000)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  const source=copy(c.lab.snapshot()),results=[];
  for(const [speed,three]of [[1.25,false],[2.75,true]]){
   const candidate={settings:{...c.state.settings,speed},rules:{fourBallThreeCushion:three}},captured=capture({controller:c,candidate});
   try{
    const raw={snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture};
    const native=captured.controller,lab=native.lab,frames=[],checkpoints=[],original=lab.angularPatchResistance;let outer=0,substep=0,firstMovingH=null;
    lab.angularPatchResistance=function(h){
     const result=original.call(this,h);substep++;const hCount=frames.length+1,outerStep=substep===64?outer+1:outer,outerSubstep=substep===64?0:substep;
     frames.push({hCount,h,time:lab.time,outerStep,outerSubstep,cuePresent:!!lab.cue,
      balls:lab.objects.map(o=>({id:o.id,...sampleBody(o.body)})),cue:lab.cue?{shaft:sampleBody(lab.cue.body),head:sampleBody(lab.cue.head)}:null,events:copy(lab.events),game:native.game.snapshot()});
     if(firstMovingH===null&&frames.at(-1).balls.some(b=>b.linear.some(v=>v!==0)))firstMovingH=hCount;
     if(firstMovingH!==null&&hCount===firstMovingH+8)checkpoints.push({hCount,outerStep,outerSubstep,reasons:['impact-prefix'],row:{boundary:'expected-only-source-impact-prefix',candidateInput:false,snapshot:lab.world.takeSnapshot().slice(),application:application(native)}});
     if(hCount===1)checkpoints.push({hCount,outerStep,outerSubstep,reasons:['first-h'],row:{boundary:'expected-only-source-firstH.postApplication',candidateInput:false,snapshot:lab.world.takeSnapshot().slice(),application:application(native)}});
     return result;
    };
    for(;outer<12&&(firstMovingH===null||frames.length<=firstMovingH+8);outer++){substep=0;lab.step();assert.equal(substep,64);if(outer===0)checkpoints.push({hCount:64,outerStep:1,outerSubstep:0,reasons:['prefix-outer'],row:{boundary:'expected-only-source-prefix-outer',candidateInput:false,snapshot:lab.world.takeSnapshot().slice(),application:application(native)}});}
    assert.ok(firstMovingH!==null);assert.ok(frames.length>firstMovingH+8);
    results.push({candidate,raw,provenance:captured.candidateProvenance,record:{frames,checkpoints,firstMovingH,prefixH:firstMovingH+8}});
    assert.deepEqual(c.lab.snapshot(),source,'Original visible source is unchanged even after private reference continuation');
   }finally{captured.dispose();}
  }
  fs.writeFileSync(process.argv[2],v8.serialize(results),{flag:'wx'});
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
