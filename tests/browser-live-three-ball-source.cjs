// Initial capture and independent original CPU evidence, never a solver input.
'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const copy=value=>structuredClone(value),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const CONTINUE=process.env.THREE_BALL_LIVE_CONTINUATION==='1';
const SETTLED=CONTINUE||process.env.THREE_BALL_LIVE_SETTLED==='1';
const PREFIX=process.env.THREE_BALL_LIVE_CAPTURE_PREFIX;
let capture;
before(async()=>{await R.init();({captureLiveRegisteredThreeBall:capture}=await import('../src/browser-initial-import/live-three-ball-capture.mjs'));});
function parts(handle){const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,handle,true);return{index:b.getUint32(0,true),generation:b.getUint32(4,true)};}
// Deliberately independent application projection, matching the public raw
// capture contract rather than calling a production capture helper.
function application(c){
 const l=c.lab,q=l.cue;
 return {time:l.time,steps:l.steps,shots:l.shots,revision:l.revision,dt:l.dt,strokeSubsteps:l.strokeSubsteps,nextId:l.nextId,params:copy(l.params),events:copy(l.events),
  registry:{staticCount:l.statics.length,objects:l.objects.map((o,index)=>({index,id:o.id,label:o.label,kind:o.kind,shape:o.shape,radius:o.radius,mass:o.mass,body:parts(o.body.handle),collider:parts(o.collider.handle),pairCollider:parts(o.pairCollider.handle)})),
   statics:l.statics.map((o,index)=>({index,label:o.label,kind:o.kind,body:parts(o.body.handle),collider:parts(o.collider.handle)}))},
  controller:{gameMode:c.state.gameMode,selectedId:c.state.selectedId,paused:c.state.paused,settings:copy(c.state.settings),routeOptions:copy(c.state.routeOptions),undoCount:c.undoStack.length,redoCount:c.redoStack.length},game:copy(c.game?.snapshot()||null),
  cue:q?{shaft:parts(q.body.handle),head:parts(q.head.handle),guide:parts(q.guide.handle),shaftCollider:parts(q.shaft.handle),tipCollider:parts(q.tip.handle),neckCollider:parts(q.neck.handle),flex:parts(q.flex.handle),prismatic:parts(q.joint.handle),selectedId:q.selectedId,pose:copy(q.pose),started:q.started,contacted:q.contacted,contacts:copy([...q.contacts]),obstructions:copy([...q.obstructions]),stats:copy(q.stats)}:null};
}
function sourceState(c){
 return {physics:copy(c.lab.snapshot()),state:copy(c.state),game:c.game.snapshot(),gameUndo:copy(c.gameUndo),undo:copy(c.undoStack),redo:copy(c.redoStack),
  cooldownUntil:c.cooldownUntil,requestKey:c.requestKey,accumulator:c.accumulator,windup:copy(c.windup),dirty:c.dirty,inputPending:c.inputPending};
}
function counter(){
 const proto=R.World.prototype,descriptor=Object.getOwnPropertyDescriptor(proto,'step'),original=proto.step,counts=new WeakMap();let total=0;
 Object.defineProperty(proto,'step',{...descriptor,value:function(...args){const result=Reflect.apply(original,this,args);total++;counts.set(this,(counts.get(this)||0)+1);return result;}});
 return {get total(){return total;},forWorld:w=>counts.get(w)||0,close(){Object.defineProperty(proto,'step',descriptor);}};
}
function createSource(){const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();return c;}
function disposeSource(c){if(!c)return;clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}
const resting=c=>!c.lab.cue&&c.lab.objects.every(o=>o.body.isSleeping());
function settle(c,limit){let outer=0;while(!resting(c)&&outer<limit){c.lab.step();outer++;}assert.ok(resting(c),`Original native source did not reach physical rest within ${limit} outer steps`);return outer;}
async function cooldown(c){const delay=Math.ceil((c.cooldownUntil||0)-performance.now());if(delay>=0)await new Promise(resolve=>setTimeout(resolve,delay+1));}

function legalClearSettings(c){
  const original=copy(c.state.settings);
  const candidates=[original,...[8,15,25,40,60,80].flatMap(elevation=>[0,90,-90,180,45,-45,135,-135].map(angle=>({...original,angle,elevation})))];
  for(const settings of candidates){c.changeSettings(settings);if(c.lab.cueClearance(c.lab.get(c.state.selectedId),c.state.settings).clear)return;}
  assert.fail('Original second cue cannot clear within explicit finite original-control inputs');
}
for(const kind of ['default','after-turn'])test('original three-ball '+kind+' preserves source and equals independent continuous fire',{
  skip:kind==='after-turn'&&!SETTLED?'Set THREE_BALL_LIVE_SETTLED=1 for genuine original full-shot preparation':false
},async t=>{
  const counts=counter();let c,result;
  try{
    c=createSource();let precedingShotSteps=0;
    if(kind==='after-turn'){
      assert.equal(c.fire(),true);
      precedingShotSteps=settle(c,20000);c.finishGameShot();
      assert.equal(c.lab.shots,1);assert.equal(c.game.pending,null);assert.equal(c.state.selectedId,2);assert.equal(c.game.activeCue,2);
      assert.deepEqual(new Set([c.state.routeOptions.targetId,c.state.routeOptions.secondId]),new Set([1,3]));
      c.pause(true);await cooldown(c);legalClearSettings(c);
    }
    const identities={lab:c.lab,world:c.lab.world,state:c.state,game:c.game,undo:c.undoStack,redo:c.redoStack,objects:c.lab.objects.slice()};
    const state=sourceState(c),before=application(c),nativeBefore=c.lab.world.takeSnapshot(),nativeCalls=counts.total;
    const prototype=Object.getOwnPropertyDescriptors(R.World.prototype),worldDescriptors=Object.getOwnPropertyDescriptors(c.lab.world);
    result=capture({controller:c});
    assert.equal(counts.total,nativeCalls,'Capture cannot step either world, including during fork');
    assert.equal(counts.forWorld(result.controller.lab.world),0);
    for(const k of ['lab','state','game'])assert.equal(c[k],identities[k]);
    assert.equal(c.lab.world,identities.world);assert.equal(c.undoStack,identities.undo);assert.equal(c.redoStack,identities.redo);
    assert.ok(c.lab.objects.every((o,i)=>o===identities.objects[i]));
    assert.deepEqual(sourceState(c),state);assert.deepEqual(Object.getOwnPropertyDescriptors(R.World.prototype),prototype);
    assert.deepEqual(Object.getOwnPropertyDescriptors(c.lab.world),worldDescriptors);
    assert.deepEqual(result.preStrikeSnapshot,nativeBefore);assert.deepEqual(result.capture.preStrikeApplication,before);
    assert.equal(result.capture.boundary,'liveRegisteredThreeBallStrikeCreated');assert.equal(result.capture.nativeRestoreUsed,true);
    assert.equal(Object.hasOwn(result.capture,'nativeSteps'),false);assert.equal(result.capture.strikeCreationJournal.length,13);
    assert.ok(result.apiJournal.every(r=>r.captureNativeStepsBefore===0&&r.captureNativeStepsAfter===0));
    assert.deepEqual(result.capture.application.registry.objects.map(o=>o.id),[1,2,3]);
    assert.deepEqual(result.capture.application.game.pending.targets,kind==='default'?[2,3]:[1,3]);
    assert.equal(result.capture.application.game.pending.threeCushion,true);
    assert.deepEqual(result.controller.state.routeOptions,c.state.routeOptions);
    const raw={snapshot:result.snapshot,preStrikeSnapshot:result.preStrikeSnapshot,capture:result.capture};
    if(PREFIX){
      assert.ok(path.isAbsolute(PREFIX));fs.mkdirSync(path.dirname(PREFIX),{recursive:true});
      fs.writeFileSync(PREFIX+'.'+kind+'.v8',v8.serialize(raw),{flag:'wx'});
    }
    assert.equal(c.fire(),true);assert.equal(counts.total,nativeCalls);
    assert.deepEqual(result.snapshot,c.lab.world.takeSnapshot(),'Fork creation is byte-identical to independent continuous original fire');
    assert.deepEqual(result.capture.application,application(c));
    let continuationSteps=0;
    if(CONTINUE){
      for(;continuationSteps<64;continuationSteps++){
        c.lab.step();result.controller.lab.step();
        assert.deepEqual(result.controller.lab.world.takeSnapshot(),c.lab.world.takeSnapshot(),'Exact native bytes at outer step '+(continuationSteps+1));
        assert.deepEqual(application(result.controller),application(c),'Exact application state at outer step '+(continuationSteps+1));
      }
    }
    t.diagnostic(JSON.stringify({kind,sourceSnapshotSha256:hash(result.preStrikeSnapshot),createdSnapshotSha256:hash(result.snapshot),
      captureNativeSteps:0,sourceUnchanged:true,independentContinuousFireByteEqual:true,precedingShotSteps,continuationSteps,selectedId:result.capture.application.controller.selectedId,
      targets:result.capture.application.game.pending.targets,gpuWork:false,wholeShotParity:false}));
  }finally{result?.dispose();disposeSource(c);counts.close();}
});
test('reject missing rules, four-ball, pending game, active cue and unready sources without touching the source',()=>{
  for(const mode of ['missing-game','four-ball','pending','windup','invalid-settings']){
    const c=createSource();try{
      if(mode==='missing-game')c.game=null;
      if(mode==='four-ball')c.state.gameMode='four';
      if(mode==='pending')c.game.begin(1);
      if(mode==='windup')c.windup={};
      if(mode==='invalid-settings')c.state.settings.speed=0;
      const before=c.lab.world.takeSnapshot(),state=copy(c.state);
      assert.throws(()=>capture({controller:c}),/three-ball|unfinished|ranges/);
      assert.deepEqual(c.lab.world.takeSnapshot(),before);assert.deepEqual(c.state,state);
    }finally{disposeSource(c);}
  }
});
test('capture cannot force native movement or default a different rule set',()=>{
  const c=createSource();try{
    assert.equal(c.fire(),true);const bytes=c.lab.world.takeSnapshot();
    assert.throws(()=>capture({controller:c}),/unfinished/);assert.deepEqual(c.lab.world.takeSnapshot(),bytes);
  }finally{disposeSource(c);}
});
test('cancellation and rejected original fire never dispose or modify the supplied source',()=>{
  for(const kind of ['aborted','cooldown']){
    const c=createSource();try{
      const options={controller:c};
      if(kind==='aborted'){const controller=new AbortController();controller.abort(new Error('Explicit capture cancellation'));options.signal=controller.signal;}
      else c.cooldownUntil=performance.now()+10000;
      const state=sourceState(c),world=c.lab.world,descriptor=Object.getOwnPropertyDescriptors(world);
      assert.throws(()=>capture(options),kind==='aborted'?/Explicit capture cancellation/:/fire did not succeed/);
      assert.equal(c.lab.world,world);assert.deepEqual(sourceState(c),state);assert.deepEqual(Object.getOwnPropertyDescriptors(world),descriptor);
    }finally{disposeSource(c);}
  }
});
