'use strict';
// Independent native-source integration: shipped Rapier + original source only.
// No fixture snapshots, decoder, importer, candidate solver or future state is an
// input. Native preparation/continuation below is test-only original gameplay.
// Quick run: node --test tests/browser-live-registered-source.cjs
// Full default/placed/settled/awake continuation proof (explicitly expensive):
// BROWSER_LIVE_REGISTERED_CONTINUATION=1 node --test tests/browser-live-registered-source.cjs
// Settled capture alone: BROWSER_LIVE_REGISTERED_SETTLED=1 node --test tests/browser-live-registered-source.cjs
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs'),v8=require('node:v8'),path=require('node:path');
const R=require('../vendor/rapier.cjs');
globalThis.RAPIER=R;
require('../src/math.js');
require('../src/render-cadence.js');
require('../src/physics.js');
require('../src/game-rules.js');
require('../src/controller.js');
const copy=value=>structuredClone(value);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const CONTINUE=process.env.BROWSER_LIVE_REGISTERED_CONTINUATION==='1';
const SETTLED=CONTINUE||process.env.BROWSER_LIVE_REGISTERED_SETTLED==='1';
const MAX_SETTLE=2000,MAX_SHOT=16000;
const REFERENCE_SCHEMA='original-controller-live-registered-continuous-reference-v1';
const REFERENCE_PREFIX=process.env.BROWSER_LIVE_REGISTERED_REFERENCE_PREFIX;
if(REFERENCE_PREFIX){assert.ok(path.isAbsolute(REFERENCE_PREFIX),'Explicit absolute reference prefix required');assert.ok(CONTINUE,'Reference export requires BROWSER_LIVE_REGISTERED_CONTINUATION=1');}
const SETTINGS=Object.freeze({angle:0,elevation:8,tipX:0,tipY:0,speed:2});
let capture;
before(async()=>{await R.init();({captureLiveRegisteredFourBall:capture}=await import('../src/browser-initial-import/live-capture.mjs'));});
function parts(handle){const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,handle,true);return{index:b.getUint32(0,true),generation:b.getUint32(4,true)};}
// Deliberately independent application projection, matching the public raw
// capture contract rather than calling a production capture helper.
function application(c){
 const l=c.lab,q=l.cue;
 return {time:l.time,steps:l.steps,shots:l.shots,revision:l.revision,dt:l.dt,strokeSubsteps:l.strokeSubsteps,nextId:l.nextId,params:copy(l.params),events:copy(l.events),
  registry:{staticCount:l.statics.length,objects:l.objects.map((o,index)=>({index,id:o.id,label:o.label,kind:o.kind,shape:o.shape,radius:o.radius,mass:o.mass,body:parts(o.body.handle),collider:parts(o.collider.handle),pairCollider:parts(o.pairCollider.handle)})),
   statics:l.statics.map((o,index)=>({index,label:o.label,kind:o.kind,body:parts(o.body.handle),collider:parts(o.collider.handle)}))},
  controller:{gameMode:c.state.gameMode,selectedId:c.state.selectedId,paused:c.state.paused,settings:copy(c.state.settings),undoCount:c.undoStack.length,redoCount:c.redoStack.length},game:copy(c.game?.snapshot()||null),
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
function createSource(){const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();return c;}
function disposeSource(c){if(!c)return;clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}
const resting=c=>!c.lab.cue&&c.lab.objects.every(o=>o.body.isSleeping());
function settle(c,limit){let outer=0;while(!resting(c)&&outer<limit){c.lab.step();outer++;}assert.ok(resting(c),`Original native source did not reach physical rest within ${limit} outer steps`);return outer;}
async function cooldown(c){const delay=Math.ceil((c.cooldownUntil||0)-performance.now());if(delay>=0)await new Promise(resolve=>setTimeout(resolve,delay+1));}
function legalClearSettings(c){
 const candidates=[SETTINGS,...[15,25,40,60,80].flatMap(elevation=>[90,-90,180,45,-45,135,-135,0].map(angle=>({...SETTINGS,angle,elevation})))];
 for(const settings of candidates){c.changeSettings(settings);if(c.lab.cueClearance(c.lab.get(c.state.selectedId),c.state.settings).clear)return copy(c.state.settings);}
 assert.fail('No legal original-controller second-shot clearance within the declared finite control list');
}
async function prepare(c,kind){
 if(kind==='default')return{placementSteps:0,precedingShotSteps:0};
 if(kind==='three-cushion'){
  const placementSteps=settle(c,MAX_SETTLE);
  assert.equal(c.game.threeCushion,false,'Game setup default remains separate from the next-shot UI option');
  c.routeOption('fourBallThreeCushion',true);
  assert.equal(c.state.routeOptions.fourBallThreeCushion,true);assert.equal(c.game.threeCushion,false);
  return {placementSteps,precedingShotSteps:0,nextShotThreeCushion:true,gameSetupThreeCushion:c.game.threeCushion};
 }
 if(kind==='awake'){
  // First register every ball and cloth cache through genuine original native
  // settling. A normal same-position controller move then wakes the existing
  // selected body, without direct activation writes or replacement metadata.
  const placementSteps=settle(c,MAX_SETTLE),selected=c.lab.get(c.state.selectedId),position=copy(selected.body.translation());
  assert.equal(c.move(selected.id,position),true,'Original same-position move accepted');
  let awakePreparationSteps=0;
  do{c.lab.step();awakePreparationSteps++;}while(c.lab.anyMotion()&&awakePreparationSteps<MAX_SETTLE);
  assert.equal(c.lab.anyMotion(),false,'Actual original motionlessness gate passes');
  assert.ok(c.lab.objects.some(o=>!o.body.isSleeping()),'At least one genuine native body remains awake');
  const cloth=c.lab.statics.find(o=>o.kind==='cloth');assert.ok(cloth);
  const clothCacheCounts=c.lab.objects.map(o=>{
   let solverContacts=0;c.lab.world.contactPair(o.collider,cloth.collider,manifold=>{solverContacts+=manifold.numSolverContacts();});
   assert.ok(solverContacts>0,'Every existing ball retains a real registered native cloth cache');return solverContacts;
  });
  assert.equal(c.lab.shots,0);assert.equal(c.lab.cue,null);assert.equal(c.game.pending,null);
  return {placementSteps,awakePreparationSteps,clothCacheCounts,awakeBodies:c.lab.objects.filter(o=>!o.body.isSleeping()).map(o=>o.id),precedingShotSteps:0};
 }
 if(kind==='placed'){
  // These are source inputs, not successful-route claims or expected motion.
  const placements=[{id:1,x:-.5,z:0},{id:2,x:-.8,z:.4},{id:3,x:.0435,z:.0435},{id:4,x:.2615,z:-.2}];
  for(const p of placements)assert.equal(c.move(p.id,{x:p.x,y:c.lab.get(p.id).radius+.00005,z:p.z}),true,'Original collision-safe move accepted');
  c.changeSettings({angle:17.125,elevation:35,tipX:.17,tipY:-.23,speed:1.35});
  const placementSteps=settle(c,MAX_SETTLE);
  assert.ok(placementSteps>0);assert.equal(c.lab.shots,0);assert.equal(c.state.selectedId,1);
  assert.equal(c.lab.cueClearance(c.lab.get(1),c.state.settings).clear,true,'Changed legal source controls have genuine geometric clearance');
  return {placementSteps,precedingShotSteps:0};
 }
 assert.equal(kind,'settled');assert.equal(c.fire(),true,'Actual first source fire accepted');
 const precedingShotSteps=settle(c,MAX_SHOT);c.finishGameShot();
 assert.equal(c.lab.shots,1);assert.equal(c.game.pending,null);assert.equal(c.state.selectedId,2,'Original default shot finished and handed the turn to yellow');
 c.pause(true);await cooldown(c);const secondSettings=legalClearSettings(c);
 return {placementSteps:0,precedingShotSteps,secondSettings};
}
function sampleBody(b){
 const m=b.effectiveWorldInvInertia(),invInertia=[m.m11,m.m12,m.m13,m.m21,m.m22,m.m23,m.m31,m.m32,m.m33];
 const v=b.translation(),translation=[v.x,v.y,v.z],r=b.rotation(),rotation=[r.x,r.y,r.z,r.w],l=b.linvel(),linear=[l.x,l.y,l.z],a=b.angvel(),angular=[a.x,a.y,a.z];
 return {translation,rotation,linear,angular,invInertia,sleeping:b.isSleeping()};
}
function motion(c){const l=c.lab;return{time:l.time,steps:l.steps,shots:l.shots,balls:l.objects.map(o=>({id:o.id,...sampleBody(o.body)})),cue:l.cue?Object.fromEntries(['body','head','guide'].map(k=>[k,sampleBody(l.cue[k])])):null,events:copy(l.events),game:c.game.snapshot()};}
function observe(object,method,after){
 const own=Object.getOwnPropertyDescriptor(object,method),original=object[method];assert.equal(typeof original,'function');
 Object.defineProperty(object,method,{...(own||{configurable:true,enumerable:false,writable:true}),value:function(...args){
  const result=Reflect.apply(original,this,args);after(this,args,result);return result;
 }});
 return()=>{if(own)Object.defineProperty(object,method,own);else delete object[method];};
}
function replay(source,candidate,counts,reference){
 const baselineSource=counts.forWorld(source.lab.world),baselineCandidate=counts.forWorld(candidate.lab.world);
 const frames=[],checkpoints=[],restores=[];let outer=0,byteCheckpoints=0,hCount=0,currentSubstep=0,subdivisions=0,lastPresent=true,score=null;
 const keep=(boundary,reasons,outerStep=outer,outerSubstep=0)=>{
  if(!reference)return;
  checkpoints.push({hCount,outerStep,outerSubstep,reasons,row:{boundary,candidateInput:false,snapshot:source.lab.world.takeSnapshot().slice(),application:application(source)}});
 };
 try{
  if(reference){
   keep('expected-only-source-strikeCreated',['strike-created']);
   restores.push(observe(source.lab,'angularPatchResistance',(receiver,args)=>{
    assert.equal(receiver,source.lab);assert.equal(args.length,1);const [h]=args;
    hCount++;currentSubstep++;assert.ok(currentSubstep<=subdivisions);
    const present=!!source.lab.cue,separation=lastPresent&&!present;lastPresent=present;
    const outerStep=currentSubstep===subdivisions?outer+1:outer,outerSubstep=currentSubstep===subdivisions?0:currentSubstep;
    frames.push({hCount,h,time:source.lab.time,outerStep,outerSubstep,cuePresent:present,separation,
     balls:source.lab.objects.map(o=>({id:o.id,...sampleBody(o.body)})),
     cue:present?{shaft:sampleBody(source.lab.cue.body),head:sampleBody(source.lab.cue.head)}:null,
     events:copy(source.lab.events),game:source.game.snapshot()});
    if(hCount===1)keep('expected-only-source-firstH.postApplication',['first-h'],outerStep,outerSubstep);
    if(separation)keep('expected-only-source-cueWithdrawal.firstSubsequentH',['first-h-after-withdrawal'],outerStep,outerSubstep);
   }));
   restores.push(observe(source.lab,'removeCue',receiver=>{
    assert.equal(receiver,source.lab);
    if(!source.lab.cue)keep('expected-only-source-cueWithdrawal.postRemoval',['cue-withdrawal'],currentSubstep===subdivisions?outer+1:outer,currentSubstep===subdivisions?0:currentSubstep);
   }));
   restores.push(observe(source.game,'finish',(receiver,args,result)=>{
    assert.equal(receiver,source.game);assert.deepEqual(args,[]);score=copy(result);
   }));
  }
  for(;outer<MAX_SHOT;){
   subdivisions=source.lab.cue?source.lab.strokeSubsteps:1;currentSubstep=0;
   source.lab.step();candidate.lab.step();outer++;
   if(reference){assert.equal(currentSubstep,subdivisions);assert.equal(hCount,counts.forWorld(source.lab.world)-baselineSource);}
   assert.deepEqual(motion(candidate),motion(source),`Continuous vs native-fork every-outer-step state ${outer}`);
   assert.equal(counts.forWorld(source.lab.world)-baselineSource,counts.forWorld(candidate.lab.world)-baselineCandidate,'Both original worlds perform the same actual native substeps');
   assert.equal(resting(candidate),resting(source),'Both original worlds reach native sleep on the same outer boundary');
   if(outer<=2||outer%64===0||resting(source)){
    assert.deepEqual(candidate.lab.world.takeSnapshot(),source.lab.world.takeSnapshot(),`Continuous vs native-fork complete manager bytes at outer ${outer}`);byteCheckpoints++;
   }
   if(outer%128===0)keep('expected-only-source-outer-'+outer,['fixed-128-outer-grid']);
   if(resting(source))break;
  }
  assert.ok(resting(source)&&resting(candidate),'Both original worlds reached full physical rest');
  keep('expected-only-source-nativeFullRest',['native-full-rest']);
  source.finishGameShot();candidate.finishGameShot();
  assert.deepEqual(application(candidate),application(source),'Same original full-rest score, next turn, history counts and source state');
  assert.deepEqual(candidate.lab.world.takeSnapshot(),source.lab.world.takeSnapshot(),'Same original full-rest native manager bytes');
  keep('expected-only-source-controllerFinished',['controller-finished']);
  const summary={outerSteps:outer,nativeSteps:counts.forWorld(source.lab.world)-baselineSource,byteCheckpoints,fullRest:true,nextCue:source.state.selectedId,game:source.game.snapshot()};
  if(reference){
   assert.ok(score);assert.equal(frames.length,hCount);
   const artifact={schema:REFERENCE_SCHEMA,origin:reference.origin,initialRawCaptureSha256:reference.initialRawCaptureSha256,initialSnapshotSha256:reference.initialSnapshotSha256,
    candidateStateUsed:false,nativeRestoreUsed:false,originalSourceContinuous:true,forkEquivalenceChecked:true,
    frameBoundary:'after-original-angularPatchResistance-return; final controller game is separate in finalGame and controllerFinished checkpoint',
    frames,checkpoints,score,finalGame:source.game.snapshot(),status:'native-rest-complete',hCount,outerSteps:outer,firstRestOuter:outer,comparison:summary};
   const file=REFERENCE_PREFIX+'.'+reference.origin+'.v8',bytes=v8.serialize(artifact);
   assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite expected-only reference evidence; choose a new prefix');
   fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});
   const manifest={schema:REFERENCE_SCHEMA,origin:reference.origin,sha256:hash(bytes),bytes:bytes.length,initialRawCaptureSha256:reference.initialRawCaptureSha256,initialSnapshotSha256:reference.initialSnapshotSha256,
    candidateStateUsed:false,nativeRestoreUsed:false,originalSourceContinuous:true,status:artifact.status,hCount,outerSteps:outer,checkpoints:checkpoints.length,score,
    sources:Object.fromEntries(['src/math.js','src/physics.js','src/controller.js','src/game-rules.js','src/render-cadence.js','vendor/rapier.cjs','tests/browser-live-registered-source.cjs'].map(name=>[name,hash(fs.readFileSync(path.resolve(__dirname,'..',name)))]))};
   fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});summary.reference={file,sha256:manifest.sha256,frames:frames.length,checkpoints:checkpoints.length};
  }
  return summary;
 }finally{while(restores.length)restores.pop()();}
}
for(const kind of ['default','placed','settled','awake','three-cushion'])test(`native ${kind} source: nonmutating registered capture and independent original fire equality`,{skip:kind==='settled'&&!SETTLED?'Set BROWSER_LIVE_REGISTERED_SETTLED=1 or BROWSER_LIVE_REGISTERED_CONTINUATION=1 for original full-shot preparation':false},async t=>{
 const counts=counter();let c,result;
 try{
  c=createSource();const preparation=await prepare(c,kind);await cooldown(c);
  const original={lab:c.lab,world:c.lab.world,objects:c.lab.objects.slice(),bodies:c.lab.objects.map(o=>o.body),state:c.state,game:c.game,undo:c.undoStack,redo:c.redoStack};
  const before=sourceState(c),expectedApplication=application(c),beforeNativeSteps=counts.total;
  const sourcePrototype=Object.getOwnPropertyDescriptors(R.World.prototype),sourceWorld=Object.getOwnPropertyDescriptors(c.lab.world);
  if(kind==='settled'){
   for(const speed of [1.25,2.75]){
    const candidate={settings:{...c.state.settings,speed},rules:{fourBallThreeCushion:speed===2.75}};
    const changed=capture({controller:c,candidate});
    try{
     assert.deepEqual(changed.preStrikeSnapshot,before.physics.world,'Settled candidate retains actual preceding-shot native history');
     assert.deepEqual(changed.capture.application.controller.settings,candidate.settings);
     assert.equal(changed.capture.application.game.pending.threeCushion,candidate.rules.fourBallThreeCushion);
     assert.deepEqual(changed.candidateProvenance.sourceApplication,expectedApplication);
     assert.deepEqual(sourceState(c),before,'Each changed settled candidate leaves visible history and time intact');
     assert.equal(counts.total,beforeNativeSteps,'Changed settled candidate captures do not step');
    }finally{changed.dispose();}
   }
  }
  result=capture({controller:c});
  assert.equal(counts.total,beforeNativeSteps,'Capture itself performs zero actual native steps across every world, including constructor/fork paths');
  assert.equal(counts.forWorld(result.controller.lab.world),0,'Restored candidate has no native continuation before its captured boundary');
  assert.equal(c.lab,original.lab);assert.equal(c.lab.world,original.world);assert.equal(c.state,original.state);assert.equal(c.game,original.game);assert.equal(c.undoStack,original.undo);assert.equal(c.redoStack,original.redo);
  assert.ok(c.lab.objects.every((o,i)=>o===original.objects[i]&&o.body===original.bodies[i]),'Capture never substitutes visible source objects or bodies');
  assert.deepEqual(sourceState(c),before,'Visible complete snapshot, state, game, undo and redo are unchanged');
  assert.deepEqual(Object.getOwnPropertyDescriptors(R.World.prototype),sourcePrototype,'Engine prototype wrappers restored');
  assert.deepEqual(Object.getOwnPropertyDescriptors(c.lab.world),sourceWorld,'Source instance methods and fields remain unchanged');
  assert.deepEqual(result.preStrikeSnapshot,before.physics.world,'Fork preserves all actual pre-strike native manager bytes');
  assert.deepEqual(result.capture.preStrikeApplication,expectedApplication,'Fork preserves exact original application provenance');
  assert.equal(result.capture.boundary,'liveRegisteredStrikeCreated');assert.equal(result.capture.nativeRestoreUsed,true);assert.equal(Object.hasOwn(result.capture,'nativeSteps'),false);
  assert.ok(result.apiJournal.every(row=>row.captureNativeStepsBefore===0&&row.captureNativeStepsAfter===0&&!Object.hasOwn(row,'nativeStepsBefore')&&!Object.hasOwn(row,'nativeStepsAfter')),'Only truthful capture-local zero counters are supplied');
  assert.equal(result.capture.strikeCreationJournal.length,13);assert.ok(result.capture.strikeCreationJournal.every(row=>row.phase==='liveRegisteredStrikeCreation'));
  assert.equal(result.capture.application.controller.settings.angle,c.state.settings.angle);assert.equal(result.capture.application.controller.selectedId,c.state.selectedId);
  assert.ok(result.capture.readiness.bodies.every((b,i)=>b.sleeping===c.lab.objects[i].body.isSleeping()));
  if(kind==='awake')assert.ok(result.capture.readiness.bodies.some(b=>!b.sleeping),'Awake receipt remains truthful after fork and accepted fire');
  if(kind==='three-cushion'){
   assert.equal(result.controller.state.routeOptions.fourBallThreeCushion,true,'Private candidate preserves the actual original UI option');
   assert.equal(result.capture.preStrikeApplication.game.threeCushion,false,'Never overwrite setup default with the next-shot UI option');
   assert.equal(result.capture.application.game.pending.threeCushion,true,'Original fire freezes actual next-shot UI option into pending rule state');
   const reconstructed=new FourBallGame();reconstructed.restore(result.capture.preStrikeApplication.game);
   assert.equal(reconstructed.begin(result.capture.application.controller.selectedId,{threeCushion:result.capture.application.game.pending.threeCushion}),true);
   assert.deepEqual(reconstructed.snapshot(),result.capture.application.game,'Actual observed boolean reconstructs the complete original begin output');
  }
  const rawCaptureBytes=v8.serialize({snapshot:result.snapshot,preStrikeSnapshot:result.preStrikeSnapshot,capture:result.capture});
  if(process.env.BROWSER_LIVE_REGISTERED_ARTIFACT||process.env.BROWSER_LIVE_REGISTERED_CAPTURE_PREFIX){
   const prefix=process.env.BROWSER_LIVE_REGISTERED_CAPTURE_PREFIX;
   const destination=prefix?prefix+'.'+kind+'.v8':kind==='default'?process.env.BROWSER_LIVE_REGISTERED_ARTIFACT:process.env.BROWSER_LIVE_REGISTERED_ARTIFACT.replace(/\.v8$/,'')+'.'+kind+'.v8';
   if(prefix){assert.ok(path.isAbsolute(prefix),'Explicit absolute capture prefix required');fs.mkdirSync(path.dirname(destination),{recursive:true});}
   fs.writeFileSync(destination,rawCaptureBytes,prefix?{flag:'wx'}:{});
   t.diagnostic('Owned initial-only native capture artifact: '+destination);
  }
  const capturedHash=hash(result.snapshot),sourceHash=hash(result.preStrikeSnapshot),originalFireSteps=counts.total;
  // Independent ground truth: now fire the unmodified continuous original,
  // not a second capture helper, restored fixture or candidate implementation.
  assert.equal(c.fire(),true,'Independent continuous original controller fire succeeds');
  assert.equal(counts.total,originalFireSteps,'Independent original fire also performs zero native steps');
  assert.deepEqual(result.snapshot,c.lab.world.takeSnapshot(),'Captured candidate creation exactly equals independent continuous original fire bytes');
  assert.deepEqual(result.capture.application,application(c),'Captured application exactly equals independent continuous original fire');
  const continuation=CONTINUE&&kind!=='three-cushion'?replay(c,result.controller,counts,REFERENCE_PREFIX?{origin:kind,initialRawCaptureSha256:hash(rawCaptureBytes),initialSnapshotSha256:capturedHash}:null):{skipped:true,enable:'BROWSER_LIVE_REGISTERED_CONTINUATION=1',reason:'Capture-only smoke does not advance either captured shot'};
  t.diagnostic(JSON.stringify({origin:kind,sourceSnapshotSha256:sourceHash,capturedSnapshotSha256:capturedHash,captureNativeSteps:0,sourceUnchangedByCapture:true,independentOriginalFireEquality:true,preparation,continuation}));
 }finally{result?.dispose();disposeSource(c);counts.close();}
});
