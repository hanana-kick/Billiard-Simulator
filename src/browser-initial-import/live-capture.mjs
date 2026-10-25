// Initial-only live source observation. No decoder, physics formulas or stepping
// continuation. Patterns mirror tests/four-ball-created-fixture.cjs, but this
// synchronous path ends immediately after the original controller.fire returns.
const copy = value => structuredClone(value);
const active = new WeakSet();
const BODY_METHODS = ['setLinvel', 'setAngvel', 'setTranslation', 'setRotation', 'wakeUp', 'sleep',
  'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'resetForces', 'resetTorques',
  'recomputeMassPropertiesFromColliders'];
const MODE = ['createRigidBody', 'createCollider', 'createCollider'];
const STRIKE = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
const CONSTRUCTOR = [...Array.from({length:16}, () => ['createRigidBody','createCollider']).flat(),
  ...Array.from({length:3}, () => MODE).flat(), ...Array(72).fill('step'), 'propagateModifiedBodyPositionsToColliders'];
const SETTINGS = {angle:0,elevation:8,tipX:0,tipY:0,speed:2};
const PARAMS = {gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,
  cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,
  tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,
  cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035};
const fail = message => { throw new Error('Unsupported live initial capture: ' + message); };
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
      settings:copy(c.state.settings),undoCount:c.undoStack.length,redoCount:c.redoStack.length},game:copy(c.game?.snapshot()||null),
    cue:cue?{shaft:parts(cue.body.handle),head:parts(cue.head.handle),guide:parts(cue.guide.handle),
      shaftCollider:parts(cue.shaft.handle),tipCollider:parts(cue.tip.handle),neckCollider:parts(cue.neck.handle),
      flex:parts(cue.flex.handle),prismatic:parts(cue.joint.handle),selectedId:cue.selectedId,pose:copy(cue.pose),
      started:cue.started,contacted:cue.contacted,contacts:copy([...cue.contacts]),obstructions:copy([...cue.obstructions]),stats:copy(cue.stats)}:null};
}
/**
 * The engine must already be initialized. Owns a NEW original controller/lab;
 * never observes an existing or animated world. No awaits, timers or first h.
 * Caller owns the returned live controller and must call dispose when done.
 * Capture bytes/data are owned copies, not aliases to that controller.
 */
export function captureLiveInitialFourBall(options={}) {
  check(options && typeof options==='object' && Object.keys(options).every(k=>['R','PhysicsLab','LabController','signal'].includes(k)), 'unknown capture option');
  const {R,PhysicsLab=globalThis.PhysicsLab,LabController=globalThis.LabController,signal}=options;
  const proto=R?.World?.prototype;
  check(proto && typeof PhysicsLab==='function' && typeof LabController==='function','original engine and constructors required');
  check(!active.has(proto),'overlapping source observations');
  const cancelled=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Capture cancelled','AbortError');};
  cancelled(); active.add(proto);
  const restores=[],apiJournal=[],references=new WeakMap();
  let c,lab,world,phase='constructor',nativeSteps=0,complete=false,disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;if(c){clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);}if(lab)lab.dispose();else world?.free();};
  const reference=(value,kind)=>{check(value && typeof value==='object','created native reference');
    references.set(value,{kind,...(typeof value.handle==='number'?{handle:parts(value.handle)}:{})});return value;};
  const argument=(value,seen=new Set())=>{
    if(value===null||typeof value!=='object'){check(typeof value!=='function'&&typeof value!=='symbol','unexpected callable/symbol argument');return value;}
    if(references.has(value))return copy(references.get(value));
    check(!seen.has(value),'cyclic descriptor');seen.add(value);
    try {
      if(ArrayBuffer.isView(value)) {check(!(value instanceof DataView),'unexpected DataView');return {kind:dataProperty(dataProperty(value,'constructor'),'name'),values:Array.from(value)};}
      if(Array.isArray(value))return value.map(x=>argument(x,seen));
      const fields={};
      check(Object.getOwnPropertySymbols(value).length===0,'symbol descriptor fields');
      for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value))){check('value' in d,'descriptor accessor: '+key);Object.defineProperty(fields,key,{value:argument(d.value,seen),enumerable:true,writable:true,configurable:true});}
      return {kind:'descriptor',className:dataProperty(dataProperty(value,'constructor'),'name')||null,fields};
    } finally {seen.delete(value);}
  };
  const phaseMethods=()=>phase==='constructor'?CONSTRUCTOR:phase==='modeCreation'?MODE:['propagateModifiedBodyPositionsToColliders',...STRIKE];
  let phaseCount=0;
  const observeApi=(object,method,createdKind)=>{
    restores.push(observeMethod(object,method,{
      before(receiver,args){
        cancelled();
        check(phaseCount<phaseMethods().length&&phaseMethods()[phaseCount]===method,'unexpected '+phase+' method/order: '+method);
        if(object===proto){if(!world)world=receiver;check(receiver===world,'foreign native world');}
        if(method==='step')check(phase==='constructor'&&args.length===0&&nativeSteps<72,'only original constructor steps allowed');
        const row={order:apiJournal.length,phase,target:copy(references.get(receiver)||{kind:'World'}),method,
          args:args.map(x=>argument(x)),nativeStepsBefore:nativeSteps};
        apiJournal.push(row);phaseCount++;return row;
      },
      after(receiver,args,result,row){
        if(method==='step')nativeSteps++;
        if(createdKind)reference(result,createdKind);
        row.result=argument(result);row.nativeStepsAfter=nativeSteps;
        if(createdKind==='RigidBody')for(const name of BODY_METHODS)observeApi(result,name);
        if(createdKind==='ImpulseJoint')for(const name of ['setContactsEnabled','setLimits'])if(typeof dataProperty(result,name)==='function')observeApi(result,name);
      }
    }));
  };
  const nextPhase=name=>{check(phaseCount===phaseMethods().length,'incomplete '+phase+' API journal');cancelled();phase=name;phaseCount=0;};
  try {
    for(const [method,kind]of [['createRigidBody','RigidBody'],['createCollider','Collider'],['createImpulseJoint','ImpulseJoint']])observeApi(proto,method,kind);
    for(const name of ['propagateModifiedBodyPositionsToColliders','removeRigidBody','step'])observeApi(proto,name);
    c=new LabController(); c.lab=new PhysicsLab(R);lab=c.lab;
    check(lab.world===world&&nativeSteps===72&&lab.objects.length===3&&lab.statics.length===16,'original constructor boundary');
    reference(lab.world,'World');reference(lab.queue,'EventQueue');
    exactScalars(lab.params,PARAMS,'nondefault physical parameters');exactScalars(c.state.settings,SETTINGS,'nondefault strike settings');
    check(lab.dt===1/960&&lab.strokeSubsteps===64&&lab.time===0&&lab.steps===0&&lab.shots===0,'noninitial source settings/state');
    check(c.state.selectedId===lab.objects[0].id,'original selected object required');
    nextPhase('modeCreation');c.state.gameMode='four';c.setupGame();
    check(lab.objects.length===4&&nativeSteps===72,'four-ball mode boundary');
    exactScalars(c.state.settings,SETTINGS,'changed strike settings');
    nextPhase('strikeCreation');check(c.fire()===true,'original default fire did not succeed');
    check(phaseCount===phaseMethods().length&&nativeSteps===72&&lab.time===0&&lab.steps===0&&lab.shots===1,'strike-created pre-first-h boundary');
    cancelled();
    // This is one synchronous boundary. Snapshot API and application getters do
    // not advance physics, and browser tasks/animation cannot interleave here.
    const snapshot=lab.world.takeSnapshot();
    check(snapshot instanceof Uint8Array&&snapshot.length>0,'native snapshot bytes required');
    const capture={boundary:'strikeCreated',candidateInput:true,nativeSteps,apiJournalLength:apiJournal.length,
      application:applicationState(c),modeCreationJournal:apiJournal.filter(e=>e.phase==='modeCreation'),
      strikeCreationJournal:apiJournal.filter(e=>e.phase==='strikeCreation'&&e.method!=='propagateModifiedBodyPositionsToColliders')};
    const owned={controller:c,snapshot:snapshot.slice(),capture:copy(capture),apiJournal:copy(apiJournal),dispose};
    cancelled();complete=true;return owned;
  } finally {
    try {while(restores.length)restores.pop()();}
    finally {active.delete(proto);if(!complete)dispose();}
  }
}

// Registration is deliberately not an attach-to-an-arbitrary-existing-world API:
// an already advanced world cannot provide an observed constructor step count.
const observations = new WeakMap();
const CONFIGURED_BOUNDARIES = {goalStrikeCreated:'goalStrikeCreation',secondStrikeCreated:'secondStrikeCreation'};
function validateConfiguredSettings(settings) {
  check(settings && Object.keys(settings).sort().join(',')===Object.keys(SETTINGS).sort().join(',') &&
    Object.values(settings).every(Number.isFinite) && Math.hypot(settings.tipX,settings.tipY)<1 &&
    settings.speed>0 && settings.speed<=10 && settings.elevation>=0 && settings.elevation<=85,
  'PhysicsLab.strike finite control ranges required');
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
 * Construct and register the actual original source ONCE, before any caller
 * setup, placement, animation or settling. The returned controller/lab are the
 * source: capture never replaces either one or prepares a hidden fresh layout.
 *
 * Constructor prototype wrappers are synchronous and immediately restored.
 * Thereafter wrappers belong only to this controller, lab and native objects;
 * unrelated worlds remain unaffected. Every successful native step is counted,
 * including cue substeps. Only constructor and capture API descriptors are kept,
 * not an unbounded journal of the caller's ordinary preparation/first-shot work.
 *
 * close() removes observation only and never frees the source. dispose() is an
 * explicit convenience for freeing this factory-owned lab after closing it.
 * Failed captures do neither. A closed observer cannot be reattached to invent
 * missing history. The optional signal controls installation, not later play.
 */
export function installLiveFourBallObservation(options={}) {
  check(options && typeof options==='object' && Object.keys(options).every(k=>['R','PhysicsLab','LabController','signal'].includes(k)), 'unknown observation option');
  const {R,PhysicsLab=globalThis.PhysicsLab,LabController=globalThis.LabController,signal}=options;
  const proto=R?.World?.prototype;
  check(proto && typeof PhysicsLab==='function' && typeof LabController==='function','original engine and constructors required');
  check(!active.has(proto),'overlapping source observations');
  const cancelled=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Capture cancelled','AbortError');};
  cancelled();active.add(proto);
  const s={controller:null,lab:null,world:null,phase:'constructor',phaseCount:0,nativeSteps:0,
    applicationNativeSteps:0,applicationSteps:0,applicationTime:0,applicationDepth:0,successfulFires:0,
    apiJournal:[],references:new WeakMap(),guards:[],closed:false,disposed:false,invalid:false,capturing:false};
  const prototypeGuards=[];
  const reference=(value,kind)=>{
    check(value && typeof value==='object','created native reference');
    s.references.set(value,{kind,...(typeof value.handle==='number'?{handle:parts(value.handle)}:{})});
  };
  // Restore only our own shadow. Closing must not overwrite a caller's later
  // explicit replacement, but such a replacement invalidates capture admission.
  const restore=guard=>{if(Object.getOwnPropertyDescriptor(guard.object,guard.method)?.value===guard.wrapped){
    if(guard.own)Object.defineProperty(guard.object,guard.method,guard.own);else delete guard.object[guard.method];
  }};
  const install=(object,method,invoke,guards=s.guards)=>{
    const own=Object.getOwnPropertyDescriptor(object,method),original=dataProperty(object,method);
    check(typeof original==='function','source method missing: '+method);
    const wrapped=function(...args){return invoke(this,args,original);};
    Object.defineProperty(object,method,{...(own||{configurable:true,enumerable:false,writable:true}),value:wrapped});
    guards.push({object,method,own,wrapped});
  };
  const observeApi=(object,method,createdKind,guards=s.guards)=>install(object,method,(receiver,args,original)=>{
    if(object===proto){
      if(!s.world)s.world=receiver;
      check(receiver===s.world,'foreign native constructor world');
    } else check(receiver===object,'foreign native receiver');
    const recording=s.phase==='constructor'||s.capturing;
    if(recording) {
      if(s.phase==='constructor')cancelled();else s.captureCancelled();
      const methods=s.phase==='constructor'?CONSTRUCTOR:['propagateModifiedBodyPositionsToColliders',...STRIKE];
      check(s.phaseCount<methods.length&&methods[s.phaseCount]===method,'unexpected '+s.phase+' method/order: '+method);
    }
    if(method==='step') {
      check(!s.capturing,'no native step during configured capture');
      check(Number.isSafeInteger(s.nativeSteps+1),'native step counter overflow');
      if(s.phase==='constructor')check(args.length===0&&s.nativeSteps<72,'only original constructor steps allowed');
      else if(s.applicationDepth!==1||args.length!==1||args[0]!==s.lab.queue)s.invalid=true;
    }
    const row=recording?{order:s.apiJournal.length,phase:s.phase,target:copy(s.references.get(receiver)||{kind:'World'}),method,
      args:args.map(x=>nativeArgument(x,s.references)),nativeStepsBefore:s.nativeSteps}:null;
    if(row){s.apiJournal.push(row);s.phaseCount++;}
    let result;
    try {result=Reflect.apply(original,receiver,args);} catch(error) {s.invalid=true;throw error;}
    if(method==='step'){s.nativeSteps++;if(s.phase!=='constructor'&&s.applicationDepth===1)s.applicationNativeSteps++;}
    if(createdKind)reference(result,createdKind);
    if(row){row.result=nativeArgument(result,s.references);row.nativeStepsAfter=s.nativeSteps;}
    if(createdKind==='RigidBody')for(const name of BODY_METHODS)observeApi(result,name);
    if(createdKind==='ImpulseJoint')for(const name of ['setContactsEnabled','setLimits'])if(typeof dataProperty(result,name)==='function')observeApi(result,name);
    return result;
  },guards);
  const close=()=>{
    check(!s.capturing,'cannot close observer during capture');
    if(s.closed)return;s.closed=true;
    while(s.guards.length)restore(s.guards.pop());
  };
  const dispose=()=>{
    if(s.disposed)return;close();s.disposed=true;
    if(s.controller){clearTimeout(s.controller.noticeTimer);clearTimeout(s.controller.predictionTimer);}
    if(s.lab)s.lab.dispose();else s.world?.free();
  };
  let complete=false;
  try {
    for(const [method,kind]of [['createRigidBody','RigidBody'],['createCollider','Collider'],['createImpulseJoint','ImpulseJoint']])observeApi(proto,method,kind,prototypeGuards);
    for(const method of ['propagateModifiedBodyPositionsToColliders','removeRigidBody','step'])observeApi(proto,method,undefined,prototypeGuards);
    s.controller=new LabController();s.controller.lab=new PhysicsLab(R);s.lab=s.controller.lab;
    const c=s.controller,lab=s.lab;
    check(lab.world===s.world&&s.nativeSteps===72&&s.phaseCount===CONSTRUCTOR.length&&lab.objects.length===3&&lab.statics.length===16,'original constructor boundary');
    exactScalars(lab.params,PARAMS,'nondefault physical parameters');exactScalars(c.state.settings,SETTINGS,'nondefault constructor strike settings');
    check(lab.dt===1/960&&lab.strokeSubsteps===64&&lab.time===0&&lab.steps===0&&lab.shots===0&&!lab.cue,'noninitial constructor state');
    check(lab.objects.every((o,i)=>o.id===i+1)&&c.state.selectedId===1,'original constructor selection and object IDs required');
    s.initialObjects=lab.objects.slice();s.initialStatics=lab.statics.slice();
    s.initialBodyReferences=[...lab.objects,...lab.statics].map(o=>({object:o,body:o.body,collider:o.collider,pairCollider:o.pairCollider}));
    reference(lab.world,'World');reference(lab.queue,'EventQueue');s.queue=lab.queue;
    while(prototypeGuards.length)restore(prototypeGuards.pop());active.delete(proto);
    s.phase='preparation';s.phaseCount=0;
    for(const [method,kind]of [['createRigidBody','RigidBody'],['createCollider','Collider'],['createImpulseJoint','ImpulseJoint']])observeApi(lab.world,method,kind);
    for(const method of ['propagateModifiedBodyPositionsToColliders','removeRigidBody','step'])observeApi(lab.world,method);
    install(lab,'step',(receiver,args,original)=>{
      check(receiver===lab,'foreign application step receiver');
      check(!s.capturing,'no application step during configured capture');
      if(s.applicationDepth||lab.steps!==s.applicationSteps||lab.time!==s.applicationTime)s.invalid=true;
      const before=lab.steps;s.applicationDepth++;
      try {return Reflect.apply(original,receiver,args);}
      catch(error){s.invalid=true;throw error;}
      finally {s.applicationDepth--;s.applicationSteps+=lab.steps-before;s.applicationTime=lab.time;}
    });
    install(c,'setupGame',(receiver,args,original)=>{
      check(receiver===c,'foreign controller setup receiver');
      const result=Reflect.apply(original,receiver,args);
      if(c.state.gameMode==='four'&&lab.objects.length===4&&!s.fourObjects){
        s.fourObjects=lab.objects.map(o=>({object:o,body:o.body,collider:o.collider,pairCollider:o.pairCollider}));
      }
      return result;
    });
    install(c,'fire',(receiver,args,original)=>{
      check(receiver===c,'foreign controller fire receiver');
      if(c.lab!==lab||lab.world!==s.world||lab.shots!==s.successfulFires)s.invalid=true;
      const before=lab.shots;
      let result;
      try {result=Reflect.apply(original,receiver,args);}catch(error){s.invalid=true;throw error;}
      if(result===true){s.successfulFires++;if(lab.shots!==before+1)s.invalid=true;}
      else if(lab.shots!==before)s.invalid=true;
      return result;
    });
    s.assertIntact=()=>{
      check(!s.closed&&!s.disposed,'observation is closed');
      check(!s.invalid,'unobserved or failed source history');
      check(c.lab===lab&&lab.world===s.world&&lab.queue===s.queue,'source controller/lab/world/queue was replaced');
      check(s.guards.every(g=>Object.getOwnPropertyDescriptor(g.object,g.method)?.value===g.wrapped),'source observer method was replaced');
      check(s.initialObjects.every((o,i)=>lab.objects[i]===o)&&s.initialStatics.every((o,i)=>lab.statics[i]===o)&&
        s.initialBodyReferences.every(r=>r.object.body===r.body&&r.object.collider===r.collider&&r.object.pairCollider===r.pairCollider),
      'original source objects were replaced');
      check(s.fourObjects&&s.fourObjects.every((r,i)=>lab.objects[i]===r.object&&r.object.body===r.body&&
        r.object.collider===r.collider&&r.object.pairCollider===r.pairCollider),'original four-ball setup references required');
      check(lab.steps===s.applicationSteps&&lab.time===s.applicationTime&&lab.shots===s.successfulFires&&
        s.nativeSteps===72+s.applicationNativeSteps,'unobserved application history');
    };
    cancelled();
    const observation=Object.freeze({controller:c,lab,get nativeSteps(){return s.nativeSteps;},close,dispose});
    observations.set(observation,s);complete=true;return observation;
  } finally {
    while(prototypeGuards.length)restore(prototypeGuards.pop());active.delete(proto);
    if(!complete)dispose();
  }
}
/**
 * Synchronously fire the supplied, registered original controller and capture
 * the post-creation/pre-first-h boundary. This intentionally mutates shot state,
 * but never constructs a replacement world, moves balls, settles or calls step.
 * The caller must prepare the same source naturally before invoking this API.
 * Bytes, application state and journals are owned copies. The caller's lab and
 * observation remain alive on success, rejected fire, cancellation and errors.
 * Awake-ready sources are not admitted without a byte-verified readiness path.
 */
export function captureLiveConfiguredFourBall(options={}) {
  check(options && typeof options==='object' && Object.keys(options).every(k=>['controller','observation','boundary','signal'].includes(k)), 'unknown configured capture option');
  const {controller:c,observation,boundary,signal}=options,s=observations.get(observation);
  check(s&&c===s.controller,'registered original controller and observation required');
  check(Object.hasOwn(CONFIGURED_BOUNDARIES,boundary),'unsupported configured boundary');
  check(!s.capturing,'overlapping configured capture');
  const cancelled=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Capture cancelled','AbortError');};
  cancelled();s.assertIntact();
  const lab=s.lab,goal=boundary==='goalStrikeCreated',expectedShots=goal?0:1;
  exactScalars(lab.params,PARAMS,'nondefault physical parameters');
  check(lab.dt===1/960&&lab.strokeSubsteps===64,'nondefault source integration settings');
  check(lab.objects.length===4&&lab.statics.length===16&&lab.objects.every((o,i)=>o.id===i+1&&o.kind==='ball'&&o.shape==='sphere'&&o.radius===.03075&&o.mass===.210),
  'original four-ball object registry required');
  check(c.state.gameMode==='four'&&c.state.selectedId===(goal?1:2)&&lab.shots===expectedShots,'configured boundary selection/shot history');
  check(!lab.cue&&!c.windup&&c.game&&c.game.pending===null,'source has an unfinished stroke/turn');
  check(Number.isSafeInteger(lab.steps)&&lab.steps>0&&Number.isFinite(lab.time)&&lab.time>0&&s.nativeSteps>72,'source needs observed original application steps');
  if(goal)check(s.nativeSteps===72+lab.steps,'first-shot origin permits only original placement/application settling');
  validateConfiguredSettings(c.state.settings);
  if(!goal)exactScalars(c.state.settings,SETTINGS,'second-shot default strike settings required');
  check(lab.objects.every(o=>o.body.isSleeping()===true),'configured capture requires all original balls asleep');
  const before={nativeSteps:s.nativeSteps,time:lab.time,steps:lab.steps,settings:copy(c.state.settings)};
  const journalStart=s.apiJournal.length;
  s.capturing=true;s.captureCancelled=cancelled;s.phase=CONFIGURED_BOUNDARIES[boundary];s.phaseCount=0;
  try {
    check(c.fire()===true,'original configured fire did not succeed');
    check(s.phaseCount===STRIKE.length+1&&s.nativeSteps===before.nativeSteps&&lab.time===before.time&&lab.steps===before.steps&&lab.shots===expectedShots+1,
    'configured strike-created pre-first-h boundary');
    s.assertIntact();exactScalars(c.state.settings,before.settings,'source settings changed during fire');
    check(lab.objects.every(o=>o.body.isSleeping()===true),'fire changed original ball readiness');
    check(lab.cue&&lab.cue.selectedId===c.state.selectedId&&lab.cue.started===lab.time&&lab.cue.contacted===false&&lab.cue.contacts.size===0&&lab.cue.obstructions.size===0,
    'original newly created cue boundary');
    cancelled();
    const snapshot=lab.world.takeSnapshot();
    check(snapshot instanceof Uint8Array&&snapshot.length>0,'native snapshot bytes required');
    const capture={boundary,candidateInput:true,nativeSteps:s.nativeSteps,apiJournalLength:s.apiJournal.length,
      application:applicationState(c),strikeCreationJournal:s.apiJournal.slice(journalStart).filter(e=>e.method!=='propagateModifiedBodyPositionsToColliders')};
    const owned={controller:c,snapshot:snapshot.slice(),capture:copy(capture),apiJournal:copy(s.apiJournal)};
    cancelled();return owned;
  } finally {s.capturing=false;s.captureCancelled=null;s.phase='preparation';s.phaseCount=0;}
}

// Candidate controls are a closed data contract, not a search request. Read
// descriptors before cloning so accessors/symbols/extra fields cannot execute or
// silently disappear. In particular never clamp or restore a proposed setting.
function candidateRecord(value, keys, label) {
  check(value && typeof value==='object' &&
    [Object.prototype,null].includes(Object.getPrototypeOf(value)), label+' must be plain data');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  check(Reflect.ownKeys(descriptors).length===keys.length && keys.every(key=>
    Object.hasOwn(descriptors,key) && 'value' in descriptors[key] && descriptors[key].enumerable),
  label+' exact own data fields required');
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}
function candidateInput(value) {
  const input=candidateRecord(value,['settings','rules'],'candidate');
  const settings=candidateRecord(input.settings,Object.keys(SETTINGS),'candidate settings');
  validateConfiguredSettings(settings);
  const rules=candidateRecord(input.rules,['fourBallThreeCushion'],'candidate rules');
  check(typeof rules.fourBallThreeCushion==='boolean','candidate rule must be boolean');
  return {settings,rules};
}

/**
 * Nonmutating candidate capture for an already existing four-ball source.
 * Optional candidate={settings,rules:{fourBallThreeCushion}} is exact owned
 * data applied only to the fork. See docs/live-registered-candidate-capture.md.
 * This is not a search-request validator or an elevation-restoration API.
 * PhysicsLab.fork restores the source's actual native snapshot; it does not
 * reconstruct a constructor/default layout and never advances physics. Only
 * the private fork's original controller fires. This distinct origin must not
 * be relabelled as constructor, placed-first-shot or settled-second-shot data.
 *
 * No native step total is guessed from application.steps: the importer derives
 * it from the byte-verified pre/post native manager state. Consequently these
 * raw API rows intentionally omit nativeStepsBefore/nativeStepsAfter too.
 * Caller owns the returned candidate and must dispose it when done. Any failure
 * frees only that private fork, never the supplied controller/lab/world.
 */
export function captureLiveRegisteredFourBall(options={}) {
  check(options && typeof options==='object' && Object.keys(options).every(k=>['controller','LabController','FourBallGame','signal','candidate'].includes(k)), 'unknown registered capture option');
  const {controller:source,LabController=globalThis.LabController,FourBallGame=globalThis.FourBallGame,signal}=options;
  check(source?.lab&&typeof LabController==='function'&&typeof FourBallGame==='function','existing original controller and constructors required');
  const cancelled=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Capture cancelled','AbortError');};
  cancelled();
  const candidate=Object.hasOwn(options,'candidate')?candidateInput(options.candidate):null;
  const sourceLab=source.lab;
  check(source.state.gameMode==='four'&&source.game&&source.game.pending===null&&!sourceLab.cue&&!source.windup,'source has an unfinished stroke/turn or is not four-ball');
  check(sourceLab.objects.length===4&&sourceLab.statics.length===16,'registered four-ball source registry required');
  check(sourceLab.anyMotion()===false,'source balls are still moving');validateConfiguredSettings(source.state.settings);
  const sourceApplication=candidate?applicationState(source):null;
  const sourceRule=candidate?source.state.routeOptions.fourBallThreeCushion:null;
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
        check(phaseCount<methods.length&&methods[phaseCount]===method,'unexpected liveRegisteredStrikeCreation method/order: '+method);
        const row={order:apiJournal.length,phase:'liveRegisteredStrikeCreation',target:copy(references.get(receiver)||{kind:'World'}),method,
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
    c.game=new FourBallGame();c.game.restore(copy(source.game.snapshot()));
    c.gameUndo=copy(source.gameUndo);c.cooldownUntil=source.cooldownUntil;c.requestKey=source.requestKey;
    lab.onEvent=event=>c.game?.contact(event);
    if(candidate){
      c.state.settings=copy(candidate.settings);
      c.state.routeOptions.fourBallThreeCushion=candidate.rules.fourBallThreeCushion;
    }
    check(!lab.cue&&c.game.pending===null&&lab.anyMotion()===false,'restored source is not ready');
    const preStrikeApplication=applicationState(c),preStrikeSnapshot=lab.world.takeSnapshot();
    check(preStrikeSnapshot instanceof Uint8Array&&preStrikeSnapshot.length>0,'native pre-strike snapshot bytes required');
    const ownedPreStrikeSnapshot=preStrikeSnapshot.slice(),bodies=readinessBodies();
    let candidateAdmission;
    if(candidate){
      // Separate from the thirteen-call strike journal: original geometric
      // query only, on this exact private pre-strike world. No native step is
      // allowed even through a replaced query implementation.
      const stopStep=()=>fail('no physics step during candidate admission');
      const queryRestores=[observeMethod(lab.world,'step',{before:stopStep}),observeMethod(lab,'step',{before:stopStep})];
      let measured;
      const querySettings=copy(candidate.settings);
      try{cancelled();measured=lab.cueClearance(lab.get(c.state.selectedId),querySettings);cancelled();}
      finally{while(queryRestores.length)queryRestores.pop()();}
      exactScalars(querySettings,candidate.settings,'admission query settings mutated');
      exactScalars(c.state.settings,candidate.settings,'admission candidate settings mutated');
      check(c.state.selectedId===preStrikeApplication.controller.selectedId&&
        c.state.routeOptions.fourBallThreeCushion===candidate.rules.fourBallThreeCushion,
      'admission selection/rules mutated');
      check(JSON.stringify(applicationState(c))===JSON.stringify(preStrikeApplication),'admission changed pre-strike application');
      const afterQuery=lab.world.takeSnapshot();
      check(afterQuery.length===ownedPreStrikeSnapshot.length&&afterQuery.every((v,i)=>v===ownedPreStrikeSnapshot[i]),'admission changed pre-strike native identity');
      const fields=measured&&Object.getOwnPropertyDescriptors(measured);
      check(fields&&['clear','distance'].every(k=>fields[k]&&'value' in fields[k]),'original admission clearance data required');
      const clearance={clear:fields.clear.value,distance:fields.distance.value};
      check(clearance.clear===true&&Number.isFinite(clearance.distance)&&clearance.distance>=0,'original candidate clearance refused or nonfinite');
      candidateAdmission={kind:'original-prestrike-cue-clearance',selectedId:c.state.selectedId,
        settings:copy(candidate.settings),rules:copy(candidate.rules),time:lab.time,sourceApplicationSteps:lab.steps,
        sourceRevision:lab.revision,sourceShots:lab.shots,selectedBody:parts(lab.get(c.state.selectedId).body.handle),
        clearance,strikeAccepted:false,
        historyContactCount:lab.events.filter(e=>e.kind==='contact').length};
    }
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
    const capture={boundary:'liveRegisteredStrikeCreated',candidateInput:true,apiJournalLength:apiJournal.length,
      application:applicationState(c),strikeCreationJournal:apiJournal.filter(e=>e.method!=='propagateModifiedBodyPositionsToColliders'),nativeRestoreUsed:true,
      preStrikeApplication,readiness:{cueAbsent:true,pendingAbsent:true,anyMotion:false,fireAccepted:true,bodies}};
    const owned={controller:c,snapshot:snapshot.slice(),preStrikeSnapshot:ownedPreStrikeSnapshot,capture:copy(capture),apiJournal:copy(apiJournal),dispose};
    if(candidate){
      exactScalars(c.state.settings,candidate.settings,'candidate settings changed during fire');
      check(c.state.routeOptions.fourBallThreeCushion===candidate.rules.fourBallThreeCushion &&
        c.game.pending?.threeCushion===candidate.rules.fourBallThreeCushion,'candidate rules changed during fire');
      check(c.state.selectedId===candidateAdmission.selectedId&&lab.revision===candidateAdmission.sourceRevision+1,
        'admission selection/revision changed during fire');
      // Accepted only after the original fire and all capture guards succeed.
      owned.candidateAdmission=copy({...candidateAdmission,strikeAccepted:true});
      // Kept outside capture: existing strict raw importer contract is unchanged.
      owned.candidateProvenance=copy({schema:'live-registered-candidate-v1',sourceApplication,
        sourceRules:{fourBallThreeCushion:sourceRule},requested:candidate,
        applied:{settings:c.state.settings,rules:{fourBallThreeCushion:c.game.pending.threeCushion}},
        selectedId:c.state.selectedId,clearancePolicy:'original-fire-no-settings-restoration',
        captureNativeSteps:0});
    }
    cancelled();complete=true;return owned;
  } finally {
    try {while(restores.length)restores.pop()();}
    finally {if(!complete)dispose();}
  }
}
