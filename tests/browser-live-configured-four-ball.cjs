'use strict';
// Lightweight observation/ownership tests, not substitutes for native browser
// snapshot equality, importer or GPU admission tests. No native engine is used.
const {test,before}=require('node:test'),assert=require('node:assert/strict');
let install,capture,registered;
before(async()=>({installLiveFourBallObservation:install,captureLiveConfiguredFourBall:capture,captureLiveRegisteredFourBall:registered}=await import('../src/browser-initial-import/live-capture.mjs')));
const SETTINGS={angle:0,elevation:8,tipX:0,tipY:0,speed:2};
const PARAMS={gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035};
const bodyMethods=['setLinvel','setAngvel','setTranslation','setRotation','wakeUp','sleep','applyImpulse','applyImpulseAtPoint','applyTorqueImpulse','resetForces','resetTorques','recomputeMassPropertiesFromColliders'];
const STRIKE=['createRigidBody','createCollider','createRigidBody','createCollider','createCollider','createImpulseJoint','setContactsEnabled','createRigidBody','createImpulseJoint','setLimits','setContactsEnabled','setLinvel','setLinvel'];
const handle=index=>{const b=new DataView(new ArrayBuffer(8));b.setUint32(0,index,true);b.setUint32(4,5,true);return b.getFloat64(0,true);};
const copy=x=>structuredClone(x),vec=(x=0,y=0,z=0)=>({x,y,z});
function doubles({onFire,onCreate,constructorSteps=72,onConstruct}={}){
 const calls=[],worlds=[],labs=[],controllers=[];let constructorCount=0,gameSetups=0;
 class Body{
  constructor(world,index){this.world=world;this.handle=handle(index);this.position=vec();this.linear=vec();this.angular=vec();this.sleeping=false;}
  translation(){return this.position;}linvel(){return this.linear;}angvel(){return this.angular;}isSleeping(){return this.sleeping;}
 }
 for(const method of bodyMethods)Body.prototype[method]=function(...args){calls.push({receiver:this,method,args});if(method==='setTranslation')this.position=copy(args[0]);if(method==='setLinvel')this.linear=copy(args[0]);if(method==='setAngvel')this.angular=copy(args[0]);if(method==='sleep')this.sleeping=true;if(method==='wakeUp')this.sleeping=false;};
 class Joint{constructor(world,index){this.world=world;this.handle=handle(index);}setContactsEnabled(...args){calls.push({receiver:this,method:'setContactsEnabled',args});}setLimits(...args){calls.push({receiver:this,method:'setLimits',args});}}
 class World{
  constructor(){this.next=0;this.bodies=[];this.colliders=[];this.joints=[];this.nativeSteps=0;this.freed=0;worlds.push(this);}
  createRigidBody(...args){const body=new Body(this,this.next++);this.bodies.push(body);calls.push({receiver:this,method:'createRigidBody',args,result:body});onCreate?.(this,args,body);return body;}
  createCollider(...args){const collider={handle:handle(this.next++)};this.colliders.push(collider);calls.push({receiver:this,method:'createCollider',args,result:collider});return collider;}
  createImpulseJoint(...args){const joint=new Joint(this,this.next++);this.joints.push(joint);calls.push({receiver:this,method:'createImpulseJoint',args,result:joint});return joint;}
  propagateModifiedBodyPositionsToColliders(){calls.push({receiver:this,method:'propagateModifiedBodyPositionsToColliders',args:[]});}
  removeRigidBody(body){this.bodies=this.bodies.filter(b=>b!==body);}
  step(...args){this.nativeSteps++;calls.push({receiver:this,method:'step',args});for(const body of this.bodies)body.sleeping=true;}
  takeSnapshot(){return new TextEncoder().encode(JSON.stringify({next:this.next,nativeSteps:this.nativeSteps,bodies:this.bodies.map(b=>({handle:b.handle,position:b.position,linear:b.linear,angular:b.angular,sleeping:b.sleeping})),colliders:this.colliders,joints:this.joints.map(j=>({handle:j.handle}))}));}
  static restoreSnapshot(bytes){const d=JSON.parse(new TextDecoder().decode(bytes)),w=new World();w.next=d.next;w.nativeSteps=d.nativeSteps;w.bodies=d.bodies.map(d=>Object.assign(new Body(w,0),d));w.colliders=d.colliders;w.joints=d.joints.map(d=>Object.assign(new Joint(w,0),d));return w;}
  free(){this.freed++;}
 }
 class Lab{
  constructor(R){constructorCount++;this.R=R;this.world=new R.World();this.queue={};this.params={...PARAMS};this.dt=1/960;this.strokeSubsteps=64;this.time=0;this.steps=0;this.shots=0;this.revision=0;this.nextId=1;this.events=[];this.objects=[];this.statics=[];this.cue=null;labs.push(this);
   for(let i=0;i<16;i++){const body=this.world.createRigidBody({typed:new Float32Array([1,-0]),data:undefined});this.statics.push({body,collider:this.world.createCollider({},body),kind:i?'wall':'cloth'});}
   for(let i=0;i<3;i++)this.add();for(let i=0;i<constructorSteps;i++)this.world.step();this.world.propagateModifiedBodyPositionsToColliders();onConstruct?.(this);
  }
  add(){const body=this.world.createRigidBody({}),collider=this.world.createCollider({},body),pairCollider=this.world.createCollider({},body);this.objects.push({id:this.nextId++,body,collider,pairCollider,shape:'sphere',radius:.03075,mass:.210,kind:'ball',label:'source ball'});}
  anyMotion(){return this.objects.some(o=>!o.body.isSleeping()&&(Math.hypot(...Object.values(o.body.linvel()))>.002||Math.hypot(...Object.values(o.body.angvel()))>.05));}
  step(n=1){for(let i=0;i<n;i++){const subdivisions=this.cue?64:1;for(let h=0;h<subdivisions;h++){this.world.step(this.queue);this.time+=this.dt/subdivisions;}this.steps++;}}
  removeCue(){if(this.cue)for(const key of ['body','head','guide'])this.world.removeRigidBody(this.cue[key]);this.cue=null;}
  fork(){const lab=Object.create(Lab.prototype);for(const k of ['params','dt','strokeSubsteps','time','steps','shots','revision','nextId','events'])lab[k]=copy(this[k]);lab.R=this.R;lab.world=World.restoreSnapshot(this.world.takeSnapshot());lab.queue={};lab.cue=null;const bind=o=>{const out={...o};for(const k of ['body','collider','pairCollider'])if(o[k])out[k]=(k==='body'?lab.world.bodies:lab.world.colliders).find(x=>x.handle===o[k].handle);return out;};lab.objects=this.objects.map(bind);lab.statics=this.statics.map(bind);labs.push(lab);return lab;}
  dispose(){this.removeCue();this.world.free();}
 }
 class Game{
  constructor(){this.cueIds=[1,2];this.redIds=[3,4];this.pending=null;this.scores={1:0,2:0};this.activeCue=1;}
  snapshot(){return copy({cueIds:this.cueIds,redIds:this.redIds,pending:this.pending,scores:this.scores,activeCue:this.activeCue});}
  restore(saved){Object.assign(this,copy(saved));}contact(){}
 }
 class Controller{
  constructor(){this.state={settings:{...SETTINGS},selectedId:1,paused:true,gameMode:'free'};this.undoStack=[];this.redoStack=[];controllers.push(this);}
  setupGame(){gameSetups++;this.lab.add();this.game=new Game();}
  move(id,position){this.lab.objects.find(o=>o.id===id).body.setTranslation(position,true);this.lab.revision++;this.undoStack.push({kind:'move',position:copy(position)});}
  changeSettings(patch){Object.assign(this.state.settings,patch);}
  fire(){const l=this.lab,w=l.world;if(l.cue||this.game.pending||l.anyMotion()||this.rejectFire)return false;w.propagateModifiedBodyPositionsToColliders();const body=w.createRigidBody({sourceSetting:this.state.settings.angle}),shaft=w.createCollider({},body),head=w.createRigidBody({}),tip=w.createCollider({},head),neck=w.createCollider({},head),flex=w.createImpulseJoint({},body,head,true);flex.setContactsEnabled(false);const guide=w.createRigidBody({}),joint=w.createImpulseJoint({},guide,body,true);joint.setLimits(-.08,.13);joint.setContactsEnabled(false);body.setLinvel(vec(this.state.settings.speed,-0,0),true);head.setLinvel(vec(this.state.settings.speed,-0,0),true);l.cue={body,shaft,head,tip,neck,flex,guide,joint,selectedId:this.state.selectedId,pose:{actualAngle:this.state.settings.angle},started:l.time,contacted:false,contacts:new Map(),obstructions:new Set(),stats:{actual:'source'}};l.shots++;l.events.push({kind:'stroke',time:l.time});this.state.paused=false;this.undoStack.push({kind:'shot'});this.redoStack=[];this.game.pending={cueId:this.state.selectedId,reds:[],foul:false};onFire?.(this);return true;}
  finishGameShot(){this.lab.removeCue();this.game.pending=null;this.game.activeCue=2;this.state.selectedId=2;}
 }
 const R={World},options={R,PhysicsLab:Lab,LabController:Controller},registeredOptions={LabController:Controller,FourBallGame:Game};
 const prototypeDescriptors=Object.getOwnPropertyDescriptors(World.prototype);
 const prototypesRestored=()=>assert.deepEqual(Object.getOwnPropertyDescriptors(World.prototype),prototypeDescriptors);
 const instancesRestored=()=>{for(const w of worlds)for(const m of ['createRigidBody','createCollider','createImpulseJoint','step','removeRigidBody','propagateModifiedBodyPositionsToColliders'])assert.equal(Object.hasOwn(w,m),false);for(const w of worlds)for(const b of w.bodies)for(const m of bodyMethods)assert.equal(Object.hasOwn(b,m),false);for(const c of controllers)for(const m of ['fire','setupGame'])assert.equal(Object.hasOwn(c,m),false);for(const l of labs)assert.equal(Object.hasOwn(l,'step'),false);};
 return {options,registeredOptions,calls,worlds,labs,controllers,prototypesRestored,instancesRestored,get constructorCount(){return constructorCount;},get gameSetups(){return gameSetups;}};
}
function prepared(d,steps=3){const observation=install(d.options),c=observation.controller;c.state.gameMode='four';c.setupGame();c.move(1,vec(-.5,.03075,.2));c.changeSettings({angle:17.125,tipX:.1,tipY:-.2,speed:3.25});c.lab.step(steps);return {observation,c};}
function take(observation,boundary='goalStrikeCreated'){return capture({controller:observation.controller,observation,boundary});}
function fingerprint(c){return {world:c.lab.world.takeSnapshot(),state:copy(c.state),game:c.game.snapshot(),undo:copy(c.undoStack),redo:copy(c.redoStack),events:copy(c.lab.events),steps:c.lab.steps,time:c.lab.time,shots:c.lab.shots};}

test('observes actual constructor and caller preparation; fires same configured instance without stepping',()=>{
 const d=doubles(),{observation,c}=prepared(d),originalLab=c.lab,world=c.lab.world,objects=c.lab.objects.slice(),steps=world.nativeSteps;
 d.prototypesRestored();const result=take(observation);
 assert.equal(result.controller,c);assert.equal(c.lab,originalLab);assert.equal(c.lab.world,world);assert.equal(d.constructorCount,1);assert.equal(d.gameSetups,1);assert.deepEqual(c.lab.objects,objects);
 assert.equal(world.nativeSteps,steps);assert.equal(result.capture.nativeSteps,75);assert.equal(result.capture.application.steps,3);assert.equal(result.capture.application.controller.settings.angle,17.125);assert.equal(c.lab.objects[0].body.translation().x,-.5);
 assert.deepEqual(Object.keys(result.capture).sort(),['boundary','candidateInput','nativeSteps','apiJournalLength','application','strikeCreationJournal'].sort());
 assert.deepEqual(result.capture.strikeCreationJournal.map(r=>r.method),STRIKE);assert.ok(result.capture.strikeCreationJournal.every(r=>r.phase==='goalStrikeCreation'&&r.nativeStepsBefore===75&&r.nativeStepsAfter===75));
 const sourceSnapshot=world.takeSnapshot();result.snapshot.fill(9);assert.deepEqual(world.takeSnapshot(),sourceSnapshot);c.lab.events[0].kind='mutated';assert.equal(result.capture.application.events[0].kind,'stroke');
 observation.close();observation.close();d.instancesRestored();d.prototypesRestored();assert.equal(world.freed,0);observation.dispose();observation.dispose();assert.equal(world.freed,1);
});
test('second-shot history counts actual cue substeps instead of guessed application steps',()=>{
 const d=doubles(),observation=install(d.options),c=observation.controller;c.state.gameMode='four';c.setupGame();c.lab.step();assert.equal(c.fire(),true);c.lab.step(2);c.finishGameShot();
 assert.equal(observation.nativeSteps,201);assert.equal(c.lab.steps,3);const count=c.lab.world.nativeSteps,result=take(observation,'secondStrikeCreated');
 assert.equal(result.capture.nativeSteps,201);assert.equal(c.lab.world.nativeSteps,count);assert.equal(result.capture.application.shots,2);assert.equal(result.capture.application.controller.selectedId,2);assert.ok(result.capture.strikeCreationJournal.every(r=>r.phase==='secondStrikeCreation'));observation.dispose();d.instancesRestored();
});
test('rejects unregistered, closed, substituted and unobserved history without disposing caller lab',()=>{
 for(const mutate of [o=>o.close(),o=>o.controller.lab={...o.lab},o=>o.lab.world=new o.lab.R.World(),o=>o.lab.steps++,o=>o.lab.world.step(o.lab.queue),o=>o.lab.world.step=function(){},o=>o.lab.objects[0]={...o.lab.objects[0]},o=>o.lab.objects[0].body={...o.lab.objects[0].body},o=>o.lab.objects[3]={...o.lab.objects[3]}]){
  const d=doubles(),{observation}=prepared(d),owned=observation.lab.world;mutate(observation);assert.throws(()=>take(observation),/Unsupported live initial capture/);assert.equal(owned.freed,0);observation.dispose();
 }
 assert.throws(()=>capture({controller:{},observation:{},boundary:'goalStrikeCreated'}),/registered/);
});
test('rejects awake bodies, invalid controls and wrong boundary before original fire',()=>{
 for(const mutate of [c=>c.lab.objects[0].body.wakeUp(),c=>c.state.settings.speed=11,c=>c.state.settings.tipX=1,c=>c.state.settings.elevation=86,c=>c.lab.params.gravity=0,c=>c.state.selectedId=2,c=>c.game.pending={},c=>c.lab.shots=2]){
  const d=doubles(),{observation,c}=prepared(d),before=c.lab.world.nativeSteps;mutate(c);assert.throws(()=>take(observation),/Unsupported live initial capture/);assert.equal(c.lab.world.nativeSteps,before);assert.equal(c.lab.world.freed,0);observation.dispose();
 }
});
test('cancelled/rejected/throwing captures keep caller source and restore capture mode',()=>{
 const abort=new AbortController();abort.abort();const d=doubles(),{observation,c}=prepared(d),before=fingerprint(c);assert.throws(()=>capture({controller:c,observation,boundary:'goalStrikeCreated',signal:abort.signal}),{name:'AbortError'});assert.deepEqual(fingerprint(c),before);
 c.rejectFire=true;assert.throws(()=>take(observation),/fire did not succeed/);assert.equal(c.lab.world.freed,0);c.rejectFire=false;take(observation);observation.dispose();
 const expected=Error('original failure'),e=doubles({onFire(){throw expected;}}),p=prepared(e);assert.throws(()=>take(p.observation),x=>x===expected);assert.equal(p.c.lab.world.freed,0);p.observation.close();e.instancesRestored();p.observation.dispose();
});
test('configured fire cannot advance native physics and ordinary unrelated worlds remain usable',()=>{
 const d=doubles({onFire:c=>c.lab.world.step(c.lab.queue)}),{observation,c}=prepared(d),before=c.lab.world.nativeSteps;
 const other=new d.options.R.World();other.step();assert.equal(other.nativeSteps,1);assert.equal(observation.nativeSteps,before);
 assert.throws(()=>take(observation),/unexpected|no native step/);assert.equal(c.lab.world.nativeSteps,before);assert.equal(c.lab.world.freed,0);observation.dispose();d.prototypesRestored();
});
test('installation cleanup restores prototypes and only disposes factory-owned failed construction',()=>{
 for(const options of [{constructorSteps:71},{constructorSteps:73},{onConstruct:l=>l.params.gravity=1}]){const d=doubles(options);assert.throws(()=>install(d.options),/Unsupported/);d.prototypesRestored();assert.equal(d.worlds[0].freed,1);}
 const d=doubles(),abort=new AbortController();abort.abort();assert.throws(()=>install({...d.options,signal:abort.signal}),{name:'AbortError'});assert.equal(d.worlds.length,0);
});
test('registered fork preserves visible source, actual layout/settings/history and uses no constructor or step',()=>{
 const d=doubles(),{observation,c}=prepared(d);observation.close();c.redoStack=[{kind:'previous redo',owned:new Uint8Array([3,2,1])}];const source=fingerprint(c),count=d.constructorCount,steps=d.calls.filter(x=>x.method==='step').length,setups=d.gameSetups;
 const result=registered({controller:c,...d.registeredOptions});d.prototypesRestored();d.instancesRestored();
 assert.notEqual(result.controller,c);assert.notEqual(result.controller.lab,c.lab);assert.notEqual(result.controller.lab.world,c.lab.world);assert.deepEqual(fingerprint(c),source);assert.equal(d.constructorCount,count);assert.equal(d.gameSetups,setups);assert.equal(d.calls.filter(x=>x.method==='step').length,steps);
 assert.deepEqual(result.preStrikeSnapshot,source.world);assert.deepEqual(result.capture.preStrikeApplication.controller.settings,c.state.settings);assert.equal(result.controller.lab.objects[0].body.translation().x,-.5);assert.deepEqual(result.capture.application.game.pending,{cueId:1,reds:[],foul:false});
 assert.deepEqual(Object.keys(result.capture).sort(),['boundary','candidateInput','apiJournalLength','application','strikeCreationJournal','nativeRestoreUsed','preStrikeApplication','readiness'].sort());assert.equal(result.capture.boundary,'liveRegisteredStrikeCreated');assert.equal(result.capture.nativeRestoreUsed,true);assert.equal(Object.hasOwn(result.capture,'nativeSteps'),false);
 assert.deepEqual(result.capture.strikeCreationJournal.map(r=>r.method),STRIKE);for(const r of result.apiJournal){assert.equal(r.phase,'liveRegisteredStrikeCreation');assert.equal(r.captureNativeStepsBefore,0);assert.equal(r.captureNativeStepsAfter,0);assert.equal(Object.hasOwn(r,'nativeStepsBefore'),false);assert.equal(Object.hasOwn(r,'nativeStepsAfter'),false);}
 assert.deepEqual(Object.keys(result.capture.readiness).sort(),['cueAbsent','pendingAbsent','anyMotion','fireAccepted','bodies'].sort());assert.equal(result.capture.preStrikeApplication.cue,null);assert.equal(result.capture.application.shots,c.lab.shots+1);
 result.snapshot.fill(0);result.preStrikeSnapshot.fill(0);result.capture.application.events[0].kind='changed';assert.deepEqual(fingerprint(c),source);result.dispose();result.dispose();assert.equal(c.lab.world.freed,0);assert.equal(result.controller.lab.world.freed,1);observation.dispose();
});
test('registered capture honestly accepts motionless awake source without a false sleep receipt',()=>{
 const d=doubles(),{observation,c}=prepared(d);observation.close();c.lab.objects[0].body.wakeUp();c.lab.objects[0].body.setLinvel(vec(.001,0,0),true);const source=fingerprint(c),result=registered({controller:c,...d.registeredOptions});
 assert.equal(result.capture.readiness.bodies[0].sleeping,false);assert.deepEqual(result.capture.readiness.bodies[0].linear,[.001,0,0]);assert.equal(result.capture.readiness.anyMotion,false);assert.deepEqual(fingerprint(c),source);result.dispose();observation.dispose();
});
test('registered failure disposes only fork and leaves visible source snapshots/history unchanged',()=>{
 for(const onFire of [c=>c.lab.world.step(c.lab.queue),()=>{throw Error('actual candidate fire failed');}]){
  const d=doubles({onFire}),{observation,c}=prepared(d);observation.close();const source=fingerprint(c);assert.throws(()=>registered({controller:c,...d.registeredOptions}),/no native step|actual candidate/);assert.deepEqual(fingerprint(c),source);assert.equal(c.lab.world.freed,0);assert.equal(d.worlds.at(-1).freed,1);d.instancesRestored();observation.dispose();
 }
 const d=doubles(),{observation,c}=prepared(d);observation.close();const source=fingerprint(c),abort=new AbortController();abort.abort();assert.throws(()=>registered({controller:c,...d.registeredOptions,signal:abort.signal}),{name:'AbortError'});assert.deepEqual(fingerprint(c),source);assert.equal(d.worlds.length,1);
 const fork=c.lab.fork;c.lab.fork=()=>c.lab;assert.throws(()=>registered({controller:c,...d.registeredOptions}),/distinct native world/);assert.equal(c.lab.world.freed,0);c.lab.fork=fork;observation.dispose();
});
