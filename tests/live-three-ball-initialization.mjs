import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import v8 from 'node:v8';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import * as M from '../src/browser-initial-import/live-three-ball-initialization.mjs';
const require=createRequire(import.meta.url),I=require('../src/experimental-cue-initialization.js'),R=require('../vendor/rapier.cjs');
const copy=x=>structuredClone(x),root=path.resolve(import.meta.dirname,'..');
let decoder,device,gpu;
before(async()=>{
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 await R.init();
 if(process.env.REQUIRE_WEBGPU==='1'){
  assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit actual native WebGPU module required');
  const mod=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE));Object.assign(globalThis,mod.globals);gpu=mod.create(['backend=vulkan']);const adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();
 }
});
after(()=>device?.destroy());
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
function near(a,b,tol,label){a=Array.isArray(a)?a:[a];b=Array.isArray(b)?b:[b];assert.equal(a.length,b.length);a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<=tol,`${label}[${i}]: ${x} vs ${b[i]}`));}
for(const name of ['default','after-turn'])test(name+' genuine source pre-collision initialization, cancellation and unsupported first-step guards',async()=>{
 const raw=v8.deserialize(fs.readFileSync((process.env.THREE_BALL_LIVE_CAPTURE_PREFIX??'/tmp/three-ball-live-evidence-20261025/capture')+'.'+name+'.v8'));
 const {seed,projection}=await M.importLiveThreeBallInitialization(decoder,raw);
 assert.equal(seed.provenance.sourceOrigin.selectedIndex,name==='default'?0:1);
 assert.deepEqual(seed.userChanges.created.islands,projection.created.state.islands);
 assert.deepEqual(projection.application.game.pending.targets,name==='default'?[2,3]:[1,3]);
 // Original native mass API is assertion-only. It never feeds candidate input.
 const world=R.World.restoreSnapshot(raw.snapshot);let expected;
 try{for(const role of ['shaft','head','guide'])world.getRigidBody(nativeHandle(seed.userChanges.roles[role])).recomputeMassPropertiesFromColliders();world.propagateModifiedBodyPositionsToColliders();expected=plain((await decoder.decodeSnapshot(world.takeSnapshot())).state);}finally{world.free();}
 const assertNumeric=numeric=>numeric.forEach((n,i)=>{
  const role=seed.numericInputs[i].role,h=seed.userChanges.roles[role],b=expected.bodies.bodies.items[h.index].value,m=b.mprops;
  near(n.worldCom,m.world_com,3e-6,role+'.worldCom');near(n.invMass,m.effective_inv_mass,2e-6,role+'.invMass');
  near(n.invInertia,['m11','m12','m13','m22','m23','m33'].map(k=>m.effective_world_inv_inertia[k]),3e-6,role+'.invInertia');near(n.maxExtent,m.max_extent,2e-6,role+'.maxExtent');near(n.ccdThickness,b.ccd.ccd_thickness,2e-6,role+'.ccdThickness');
  b.colliders.forEach((h,j)=>{const c=expected.colliders.colliders.items[h.index].value;for(const k of ['translation','rotation'])near(n.colliders[j][k],c.pos[k],3e-6,role+'.'+k);});
 });
 const numeric=seed.numericInputs.map(I.initializeReference);assertNumeric(numeric);
 assert.throws(()=>I.initializeUserChanges(seed.userChanges,Object.fromEntries(numeric.map((n,i)=>[seed.numericInputs[i].role,n]))),/distinct initializer/);
 assert.throws(()=>I.initializeLiveRegisteredFourBallUserChanges(seed.userChanges,{}));
 for(const mutate of [s=>s.userChanges.created.sourceSelectedIndex=0,s=>s.userChanges.roles.otherBall1=s.userChanges.roles.ball,s=>s.userChanges.created.sourceOrigin.targetIds.reverse()]){
  if(name==='default'&&mutate.toString().includes('sourceSelectedIndex'))continue;const bad=copy(seed);mutate(bad);assert.throws(()=>I.initializeLiveRegisteredThreeBallUserChanges(bad.userChanges,{}));
 }
 const owner=await M.createReferenceInitializationOwner(decoder,raw);let gpuOwner;
 try{
  const initial=owner.snapshot(),cancel=new AbortController();cancel.abort(new Error('explicit cancellation'));
  await assert.rejects(owner.prepare({signal:cancel.signal}),/explicit cancellation/);assert.deepEqual(owner.snapshot(),initial);
  const prepared=await owner.prepare();assert.deepEqual(owner.snapshot(),initial);assertNumeric(prepared.numeric);
  for(const result of [copy(prepared.result)]){assert.throws(()=>I.finishCollisionPhase(result,{kind:'owned-first-h-collision-admission',newCueSolverContacts:0,allOriginalBallPairsOwned:true}));delete result.pendingCollisionWork;assert.throws(()=>I.finishCollisionPhase(result,{kind:'owned-first-h-collision-admission',newCueSolverContacts:0,allOriginalBallPairsOwned:true}));}
  owner.abort();assert.deepEqual(owner.snapshot(),initial);
  const again=await owner.prepare();assert.deepEqual(again,prepared);const committed=owner.commit();assert.equal(committed.capability.firstSubstepComplete,false);
  assert.deepEqual(committed.initialNative,projection.created.state);assert.deepEqual(committed.application,projection.application);
  assert.throws(()=>owner.step(),error=>error.code==='three-ball-live-first-substep-unavailable');await assert.rejects(owner.prepare(),/One initial/);
  for(const role of ['ball','otherBall1','otherBall2'])assert.deepEqual(prepared.result.bodies.find(b=>b.role===role).raw,seed.userChanges.created.bodies[role]);
  if(device){
   gpuOwner=await M.createGpuInitializationOwner(device,decoder,raw);
   const gpuInitial=gpuOwner.snapshot(),inFlightCancel=new AbortController(),cancelled=gpuOwner.prepare({signal:inFlightCancel.signal});
   inFlightCancel.abort(new Error('cancel after submission'));await assert.rejects(cancelled,/cancel after submission/);assert.deepEqual(gpuOwner.snapshot(),gpuInitial);
   const g=await gpuOwner.prepare();assertNumeric(g.numeric);
   assert.deepEqual(g.result,prepared.result,'Exact host-u32 registration and original states match both numerical backends');
   for(let i=0;i<3;i++){const {backend,...a}=g.numeric[i],{backend:_,...b}=prepared.numeric[i];assert.deepEqual(a,b,'Actual WGSL cue arithmetic equals f32 reference');}
   gpuOwner.abort();assert.equal(gpuOwner.snapshot().initialization,null);await gpuOwner.prepare();gpuOwner.commit();
  }
 }finally{gpuOwner?.dispose();owner.dispose();}
});
test('GPU owner never accepts a fake device',async()=>{await assert.rejects(M.createGpuInitializationOwner({},decoder,{}),/Actual same-realm/);});
