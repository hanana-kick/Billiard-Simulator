// SPDX-License-Identifier: Apache-2.0
// A separate source observer for current ThreeBallGame controllers. This does
// not broaden any four-ball or legacy three-ball numerical-owner contract.
import * as importedOrigin from '../experimental-live-three-ball-origin.js';
const Origin=importedOrigin.default??globalThis.LabLiveThreeBallOriginExperimental;
const copy = value => structuredClone(value);
const BODY_METHODS = ['setLinvel', 'setAngvel', 'setTranslation', 'setRotation', 'wakeUp', 'sleep',
  'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'resetForces', 'resetTorques',
  'recomputeMassPropertiesFromColliders'];
const STRIKE = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
const fail = message => { throw new Error('Unsupported live three-ball capture: ' + message); };
const check = (condition, message) => { if (!condition) fail(message); };
function exactScalars(actual, expected, label) {
  check(actual && Object.keys(actual).sort().join(',') === Object.keys(expected).sort().join(',') &&
    Object.keys(expected).every(k => Object.is(actual[k], expected[k])), label);
}
function parts(handle) {
  check(typeof handle === 'number', 'native handle required');
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, handle, true);
  return {index:bytes.getUint32(0,true), generation:bytes.getUint32(4,true)};
}
// No accessor is evaluated while journaling a descriptor, including constructor.
function dataProperty(value, key) {
  for (let object=value; object; object=Object.getPrototypeOf(object)) {
    const d=Object.getOwnPropertyDescriptor(object,key);
    if(d){check('value' in d,'descriptor accessor: '+key);return d.value;}
  }
}
function observeMethod(object, method, {before, after} = {}) {
  const own=Object.getOwnPropertyDescriptor(object,method), original=dataProperty(object,method);
  check(typeof original==='function','source method missing: '+method);
  Object.defineProperty(object,method,{...(own||{configurable:true,enumerable:false,writable:true}),
    value:function(...args){
      const token=before?.(this,args);
      const result=Reflect.apply(original,this,args);
      after?.(this,args,result,token);
      return result;
    }});
  return ()=>{if(own)Object.defineProperty(object,method,own);else delete object[method];};
}
function objectRegistry(lab) {
  return {staticCount:lab.statics.length,
    objects:lab.objects.map((o,index)=>({index,id:o.id,label:o.label,kind:o.kind,shape:o.shape,
      radius:o.radius,mass:o.mass,body:parts(o.body.handle),collider:parts(o.collider.handle),pairCollider:parts(o.pairCollider.handle)})),
    statics:lab.statics.map((o,index)=>({index,label:o.label,kind:o.kind,body:parts(o.body.handle),collider:parts(o.collider.handle)}))};
}
function applicationState(c) {
  const lab=c.lab,cue=lab.cue;
  return {time:lab.time,steps:lab.steps,shots:lab.shots,revision:lab.revision,dt:lab.dt,
    strokeSubsteps:lab.strokeSubsteps,nextId:lab.nextId,params:copy(lab.params),events:copy(lab.events),registry:objectRegistry(lab),
    controller:{gameMode:c.state.gameMode,selectedId:c.state.selectedId,paused:c.state.paused,
      settings:copy(c.state.settings),routeOptions:copy(c.state.routeOptions),undoCount:c.undoStack.length,redoCount:c.redoStack.length},game:copy(c.game?.snapshot()||null),
    cue:cue?{shaft:parts(cue.body.handle),head:parts(cue.head.handle),guide:parts(cue.guide.handle),
      shaftCollider:parts(cue.shaft.handle),tipCollider:parts(cue.tip.handle),neckCollider:parts(cue.neck.handle),
      flex:parts(cue.flex.handle),prismatic:parts(cue.joint.handle),selectedId:cue.selectedId,pose:copy(cue.pose),
      started:cue.started,contacted:cue.contacted,contacts:copy([...cue.contacts]),obstructions:copy([...cue.obstructions]),stats:copy(cue.stats)}:null};
}
function nativeArgument(value,references,seen=new Set()) {
  if(value===null||typeof value!=='object') {
    check(typeof value!=='function'&&typeof value!=='symbol','unexpected callable/symbol argument');return value;
  }
  if(references.has(value))return copy(references.get(value));
  check(!seen.has(value),'cyclic descriptor');seen.add(value);
  try {
    if(ArrayBuffer.isView(value)) {check(!(value instanceof DataView),'unexpected DataView');return {kind:dataProperty(dataProperty(value,'constructor'),'name'),values:Array.from(value)};}
    if(Array.isArray(value))return value.map(x=>nativeArgument(x,references,seen));
    check(Object.getOwnPropertySymbols(value).length===0,'symbol descriptor fields');
    const fields={};
    for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      check('value' in d,'descriptor accessor: '+key);
      Object.defineProperty(fields,key,{value:nativeArgument(d.value,references,seen),enumerable:true,writable:true,configurable:true});
    }
    return {kind:'descriptor',className:dataProperty(dataProperty(value,'constructor'),'name')||null,fields};
  } finally {seen.delete(value);}
}
/**
 * Nonmutating candidate capture for an already existing three-ball source.
 * PhysicsLab.fork restores the source's actual native snapshot; it does not
 * reconstruct a constructor/default layout and never advances physics. Only
 * the private fork's original controller fires. This distinct origin must not
 * be relabelled as constructor, placed-first-shot or settled-second-shot data.
 *
 * No native step total is guessed from application.steps. The importer preserves
 * the decoded native frame index, which is not a historical native step count.
 * Consequently these
 * raw API rows intentionally omit nativeStepsBefore/nativeStepsAfter too.
 * Caller owns the returned candidate and must dispose it when done. Any failure
 * frees only that private fork, never the supplied controller/lab/world.
 */
export function captureLiveRegisteredThreeBall(options={}) {
  check(options && typeof options==='object' && Object.keys(options).every(k=>['controller','LabController','ThreeBallGame','signal'].includes(k)), 'unknown registered capture option');
  const {controller:source,LabController=globalThis.LabController,ThreeBallGame=globalThis.ThreeBallGame,signal}=options;
  check(source?.lab&&typeof LabController==='function'&&typeof ThreeBallGame==='function','existing original controller and constructors required');
  const cancelled=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Capture cancelled','AbortError');};
  cancelled();
  const sourceLab=source.lab;
  check(source.state.gameMode==='free'&&source.game instanceof ThreeBallGame&&source.game.snapshot().kind==='three'&&source.game&&source.game.pending===null&&!sourceLab.cue&&!source.windup,'source has an unfinished stroke/turn or is not three-ball');
  check(sourceLab.objects.length===3&&sourceLab.statics.length===16,'registered three-ball source registry required');
  check(sourceLab.anyMotion()===false,'source balls are still moving');Origin.validateSettings(source.state.settings);Origin.validateFixedParams(sourceLab.params);
  const restores=[],references=new WeakMap(),apiJournal=[];
  let c,lab,phaseCount=0,complete=false,disposed=false;
  // Local observation starts after fork restoration. Any attempted step is
  // rejected before invocation, so these observed capture-local counts stay 0.
  const captureNativeSteps=0;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    if(c){clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);}
    lab?.dispose();
  };
  const reference=(value,kind)=>{
    check(value&&typeof value==='object','native reference required');
    references.set(value,{kind,...(typeof value.handle==='number'?{handle:parts(value.handle)}:{})});
  };
  const observeApi=(object,method,createdKind)=>{
    restores.push(observeMethod(object,method,{
      before(receiver,args){
        cancelled();check(receiver===object,'foreign candidate receiver');
        check(method!=='step','no native step during registered capture');
        const methods=['propagateModifiedBodyPositionsToColliders',...STRIKE];
        check(phaseCount<methods.length&&methods[phaseCount]===method,'unexpected liveRegisteredThreeBallStrikeCreation method/order: '+method);
        const row={order:apiJournal.length,phase:'liveRegisteredThreeBallStrikeCreation',target:copy(references.get(receiver)||{kind:'World'}),method,
          args:args.map(value=>nativeArgument(value,references)),captureNativeStepsBefore:captureNativeSteps};
        apiJournal.push(row);phaseCount++;return row;
      },
      after(receiver,args,result,row){
        if(createdKind)reference(result,createdKind);
        row.result=nativeArgument(result,references);row.captureNativeStepsAfter=captureNativeSteps;
        if(createdKind==='RigidBody')for(const name of BODY_METHODS)observeApi(result,name);
        if(createdKind==='ImpulseJoint')for(const name of ['setContactsEnabled','setLimits'])if(typeof dataProperty(result,name)==='function')observeApi(result,name);
      }
    }));
  };
  const readinessBodies=()=>lab.objects.map(o=>{
    // Each native scratch vector is copied before the next getter is invoked.
    const linear=o.body.linvel(),linearCopy=[linear.x,linear.y,linear.z];
    const angular=o.body.angvel(),angularCopy=[angular.x,angular.y,angular.z];
    check([...linearCopy,...angularCopy].every(Number.isFinite),'finite native readiness velocities required');
    return {body:parts(o.body.handle),sleeping:o.body.isSleeping(),linear:linearCopy,angular:angularCopy};
  });
  try {
    c=new LabController();
    // This is the original source fork path, not new PhysicsLab(), setupGame(),
    // restoreHistory() on the visible controller, or manual native reconstruction.
    const forked=sourceLab.fork();
    check(forked&&forked!==sourceLab&&forked.world!==sourceLab.world,'source fork must own a distinct native world');
    lab=forked;c.lab=lab;
    c.state=copy(source.state);c.undoStack=copy(source.undoStack);c.redoStack=copy(source.redoStack);
    c.game=new ThreeBallGame();c.game.restore(copy(source.game.snapshot()));
    c.gameUndo=copy(source.gameUndo);c.cooldownUntil=source.cooldownUntil;c.requestKey=source.requestKey;
    lab.onEvent=event=>c.game?.contact(event);
    check(!lab.cue&&c.game.pending===null&&lab.anyMotion()===false,'restored source is not ready');
    const preStrikeApplication=applicationState(c),preStrikeSnapshot=lab.world.takeSnapshot();
    check(preStrikeSnapshot instanceof Uint8Array&&preStrikeSnapshot.length>0,'native pre-strike snapshot bytes required');
    const ownedPreStrikeSnapshot=preStrikeSnapshot.slice(),bodies=readinessBodies();
    reference(lab.world,'World');reference(lab.queue,'EventQueue');
    for(const o of [...lab.objects,...lab.statics]){
      reference(o.body,'RigidBody');reference(o.collider,'Collider');if(o.pairCollider)reference(o.pairCollider,'Collider');
      for(const name of BODY_METHODS)observeApi(o.body,name);
    }
    for(const [method,kind]of [['createRigidBody','RigidBody'],['createCollider','Collider'],['createImpulseJoint','ImpulseJoint']])observeApi(lab.world,method,kind);
    for(const method of ['propagateModifiedBodyPositionsToColliders','removeRigidBody','step'])observeApi(lab.world,method);
    cancelled();check(c.fire()===true,'original registered candidate fire did not succeed');
    check(phaseCount===STRIKE.length+1&&lab.steps===preStrikeApplication.steps&&lab.time===preStrikeApplication.time&&lab.shots===preStrikeApplication.shots+1,
    'registered strike-created pre-first-h boundary');
    check(lab.cue&&lab.cue.selectedId===c.state.selectedId&&lab.cue.started===lab.time&&lab.cue.contacted===false&&lab.cue.contacts.size===0&&lab.cue.obstructions.size===0,
    'original registered newly created cue boundary');
    exactScalars(c.state.settings,preStrikeApplication.controller.settings,'source settings changed during fire');
    check(JSON.stringify(readinessBodies())===JSON.stringify(bodies),'candidate fire changed source ball readiness');
    const snapshot=lab.world.takeSnapshot();
    check(snapshot instanceof Uint8Array&&snapshot.length>0,'native snapshot bytes required');
    const capture={boundary:'liveRegisteredThreeBallStrikeCreated',candidateInput:true,apiJournalLength:apiJournal.length,
      application:applicationState(c),strikeCreationJournal:apiJournal.filter(e=>e.method!=='propagateModifiedBodyPositionsToColliders'),nativeRestoreUsed:true,
      preStrikeApplication,readiness:{cueAbsent:true,pendingAbsent:true,anyMotion:false,fireAccepted:true,bodies}};
    const owned={controller:c,snapshot:snapshot.slice(),preStrikeSnapshot:ownedPreStrikeSnapshot,capture:copy(capture),apiJournal:copy(apiJournal),dispose};
    cancelled();complete=true;return owned;
  } finally {
    try {while(restores.length)restores.pop()();}
    finally {if(!complete)dispose();}
  }
}
