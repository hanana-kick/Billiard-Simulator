'use strict';
// Observer lifecycle/forwarding unit tests use small JS doubles, never Rapier.
// Native-source equality and admission are tested in the actual browser page.
const {test,before}=require('node:test'),assert=require('node:assert/strict');
let capture;before(async()=>({captureLiveInitialFourBall:capture}=await import('../src/browser-initial-import/live-capture.mjs')));
const SETTINGS={angle:0,elevation:8,tipX:0,tipY:0,speed:2};
const PARAMS={gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035};
const bodyMethods=['setLinvel','setAngvel','setTranslation','setRotation','wakeUp','sleep','applyImpulse','applyImpulseAtPoint','applyTorqueImpulse','resetForces','resetTorques','recomputeMassPropertiesFromColliders'];
const nativeHandle=index=>{const bytes=new DataView(new ArrayBuffer(8));bytes.setUint32(0,index,true);bytes.setUint32(4,7,true);return bytes.getFloat64(0,true);};
function doubles({onCreate,onConstruct,onSetup,onFire,steps=72}={}){
 const calls=[],bodies=[],joints=[],sourceBytes=new Uint8Array([1,2,3]),all=[];let next=0,freeCount=0;
 class Body{constructor(){this.handle=nativeHandle(next++);bodies.push(this);}}
 for(const method of bodyMethods)Body.prototype[method]=function(...args){calls.push({receiver:this,method,args});};
 class Joint{constructor(){this.handle=nativeHandle(next++);joints.push(this);}setContactsEnabled(...args){calls.push({receiver:this,method:'setContactsEnabled',args});}setLimits(...args){calls.push({receiver:this,method:'setLimits',args});}}
 class World{
  createRigidBody(...args){const result=new Body();calls.push({receiver:this,method:'createRigidBody',args,result});onCreate?.(this,args,result);return result;}
  createCollider(...args){const result={handle:nativeHandle(next++)};calls.push({receiver:this,method:'createCollider',args,result});return result;}
  createImpulseJoint(...args){const result=new Joint();calls.push({receiver:this,method:'createImpulseJoint',args,result});return result;}
  step(...args){calls.push({receiver:this,method:'step',args});}
  propagateModifiedBodyPositionsToColliders(){}
  removeRigidBody(){}
  takeSnapshot(){return sourceBytes;}
  free(){freeCount++;}
 }
 class Lab{
  constructor(R){this.world=new R.World();this.queue={};this.params={...PARAMS};this.dt=1/960;this.strokeSubsteps=64;this.time=0;this.steps=0;this.shots=0;this.revision=0;this.nextId=91;this.events=[];this.objects=[];this.statics=[];all.push(this);
   for(let i=0;i<16;i++){const body=this.world.createRigidBody({x:-0,u:undefined,n:123n,typed:new Float64Array([-0,1])});this.statics.push({body,collider:this.world.createCollider({},body),kind:i?'wall':'cloth'});}
   for(let i=0;i<3;i++)this.add();for(let i=0;i<steps;i++)this.world.step();this.world.propagateModifiedBodyPositionsToColliders();onConstruct?.(this);
  }
  add(){const body=this.world.createRigidBody({}),collider=this.world.createCollider({},body),pairCollider=this.world.createCollider({},body);this.objects.push({id:this.nextId++,body,collider,pairCollider,shape:'sphere',radius:.03075,mass:.210,kind:'ball'});}
  dispose(){this.world.free();}
 }
 class Controller{
  constructor(){this.state={settings:{...SETTINGS},selectedId:91,paused:true};this.undoStack=[];this.redoStack=[];}
  setupGame(){this.lab.add();this.game={snapshot:()=>({actualSource:'game snapshot'})};onSetup?.(this);}
  fire(){const l=this.lab,w=l.world;w.propagateModifiedBodyPositionsToColliders();const body=w.createRigidBody({}),shaft=w.createCollider({},body),head=w.createRigidBody({}),tip=w.createCollider({},head),neck=w.createCollider({},head),flex=w.createImpulseJoint({},body,head,true);flex.setContactsEnabled(false);const guide=w.createRigidBody({}),joint=w.createImpulseJoint({},guide,body,true);joint.setLimits(-.08,.13);joint.setContactsEnabled(false);body.setLinvel({x:2,y:-0,z:0},true);head.setLinvel({x:2,y:-0,z:0},true);l.cue={body,shaft,head,tip,neck,flex,guide,joint,selectedId:this.state.selectedId,pose:{unchanged:'source'},started:0,contacted:false,contacts:new Map(),obstructions:new Set(),stats:{exact:'source'}};l.shots=1;l.events.push({kind:'stroke',time:0});this.state.paused=false;onFire?.(this);return true;}
 }
 const R={World},options={R,PhysicsLab:Lab,LabController:Controller};
 const descriptors=Object.getOwnPropertyDescriptors(World.prototype);
 const restored=()=>{assert.deepEqual(Object.getOwnPropertyDescriptors(World.prototype),descriptors);for(const b of bodies)for(const m of bodyMethods)assert.equal(Object.hasOwn(b,m),false);for(const j of joints)for(const m of ['setLimits','setContactsEnabled'])assert.equal(Object.hasOwn(j,m),false);};
 return {options,calls,bodies,joints,sourceBytes,all,restored,get freeCount(){return freeCount;}};
}
test('forwards original receiver, original argument references and exact native results; copies before mutation',()=>{
 const seen=[];const d=doubles({onCreate(receiver,args,result){seen.push({receiver,args,result});args[0].changedAfterEntry=true;}}),r=capture(d.options);d.restored();
 assert.equal(r.capture.nativeSteps,72);assert.equal(r.capture.apiJournalLength,131);assert.equal(r.capture.application.registry.objects[0].id,91);assert.equal(r.capture.application.game.actualSource,'game snapshot');assert.deepEqual(r.capture.application.registry.statics[0].body,{index:0,generation:7});
 assert.equal(seen[0].receiver,r.controller.lab.world);assert.equal(seen[0].result,r.controller.lab.statics[0].body);assert.equal(seen[0].args[0],d.calls[0].args[0]);
 const f=r.apiJournal[0].args[0].fields;assert.equal(Object.hasOwn(f,'changedAfterEntry'),false);assert.ok(Object.is(f.x,-0));assert.equal(f.u,undefined);assert.equal(f.n,123n);assert.ok(Object.is(f.typed.values[0],-0));
 r.snapshot.fill(9);assert.deepEqual(d.sourceBytes,new Uint8Array([1,2,3]));r.controller.lab.events[0].kind='mutated';assert.equal(r.capture.application.events[0].kind,'stroke');r.dispose();r.dispose();assert.equal(d.freeCount,1);
});
test('repeated captures remove inherited shadows and restore identical prototype descriptors',()=>{const d=doubles();for(let i=0;i<3;i++){const r=capture(d.options);d.restored();r.dispose();}assert.equal(d.freeCount,3);});
test('pre-cancel and in-constructor cancellation restore wrappers and discard native owner',()=>{
 const abort=new AbortController();abort.abort();const d=doubles();assert.throws(()=>capture({...d.options,signal:abort.signal}),{name:'AbortError'});d.restored();assert.equal(d.calls.length,0);
 const mid=new AbortController(),e=doubles({onCreate(){mid.abort();}});assert.throws(()=>capture({...e.options,signal:mid.signal}),{name:'AbortError'});e.restored();assert.equal(e.freeCount,1);
});
test('original native throw identity propagates and wrappers restore',()=>{const expected=Error('native failure'),d=doubles({onCreate(){throw expected;}});assert.throws(()=>capture(d.options),e=>e===expected);d.restored();assert.equal(d.freeCount,1);});
test('reject changed counts/settings and unexpected source API without keeping wrappers',()=>{
 for(const change of [{steps:71},{steps:73},{onConstruct:l=>l.params.gravity=0},{onSetup:c=>c.state.settings.angle=1},{onSetup:c=>c.lab.world.removeRigidBody({})},{onFire:c=>c.lab.world.step()}]){const d=doubles(change);assert.throws(()=>capture(d.options),/Unsupported live initial capture/);d.restored();assert.equal(d.freeCount,1);}
});
test('never invokes descriptor accessors, including constructor getter',()=>{
 for(const key of ['hidden','constructor']){let invoked=0;const d=doubles({onConstruct:l=>{const old=l.world.createRigidBody;l.world.createRigidBody=function(desc){Object.defineProperty(desc,key,{get(){invoked++;return null;}});return Reflect.apply(old,this,[desc]);};}});
 assert.throws(()=>capture(d.options),/descriptor accessor/);assert.equal(invoked,0);d.restored();}
});
test('partial observer installation and nested capture are cleaned up',()=>{
 const d=doubles();const original=d.options.R.World.prototype.step;Object.defineProperty(d.options.R.World.prototype,'step',{value:original,writable:false,configurable:false});const before=Object.getOwnPropertyDescriptors(d.options.R.World.prototype);
 assert.throws(()=>capture(d.options),/Cannot redefine/);assert.deepEqual(Object.getOwnPropertyDescriptors(d.options.R.World.prototype),before);
 let denied=0;const e=doubles({onCreate(){try{capture(e.options);}catch(error){assert.match(error.message,/overlapping/);denied++;}}});const r=capture(e.options);assert.ok(denied>0);e.restored();r.dispose();
});

test('unknown options reject before source construction',()=>{const d=doubles();assert.throws(()=>capture({...d.options,settings:{speed:3}}),/unknown capture option/);assert.equal(d.calls.length,0);d.restored();});
