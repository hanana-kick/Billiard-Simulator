import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import v8 from 'node:v8';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import * as M from '../src/browser-initial-import/live-three-ball-broad.mjs';
import * as C from '../src/browser-initial-import/live-three-ball-collision.mjs';
const Q=(await import('../src/experimental-cue-broad-phase.js')).default,J=(await import('../src/experimental-contact-graph-journal.js')).default;
const require=createRequire(import.meta.url),I=require('../src/experimental-cue-initialization.js'),R=require('../vendor/rapier.cjs');
globalThis.RAPIER=R;for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
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
for(const name of ['default','after-turn'])test(name+' native insertion topology, graph and guarded collision preparation',async t=>{
 const raw=v8.deserialize(fs.readFileSync('/tmp/three-ball-live-evidence-20261025/capture.'+name+'.v8'));
 const {seed,projection,broad}=await M.importLiveThreeBallBroad(decoder,raw);
 assert.equal(projection.sourceOrigin.selectedIndex,name==='default'?0:1);assert.deepEqual(projection.application.game.pending.targets,name==='default'?[2,3]:[1,3]);
 // Independent original controller: reproduce the actual source, then stop
 // immediately after its first unchanged native step (after original cue forces).
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();let native;
 try{
  if(name==='after-turn'){
   assert.equal(c.fire(),true);let steps=0;while((c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()))&&steps<20000){c.lab.step();steps++;}
   assert.equal(steps,5875);c.finishGameShot();c.pause(true);const delay=Math.ceil(c.cooldownUntil-performance.now());if(delay>=0)await new Promise(r=>setTimeout(r,delay+1));c.changeSettings(raw.capture.preStrikeApplication.controller.settings);
  }
  assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot,'Independent continuously existing source creation is byte-identical');
  const original=c.lab.world.step,stop=Symbol('first native substep');let bytes;
  c.lab.world.step=function(...args){Reflect.apply(original,this,args);bytes=this.takeSnapshot();throw stop;};
  try{c.lab.step();assert.fail('Expected first-native-step observation');}catch(e){if(e!==stop)throw e;}finally{c.lab.world.step=original;}
  native=plain((await decoder.decodeSnapshot(bytes)).state);
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}

 const q=await Q.createLiveRegisteredThreeBallReferenceStage(broad.broadSeed),j=J.createReferenceStageWithLiveThreeBallCue(broad.graphSeed,q),token={};q.claim(token);j.claim(token);
 try{
  assert.throws(()=>Q.validateLiveRegisteredFourBall(broad.broadSeed));
  assert.throws(()=>J.createReferenceStageWithLiveRegisteredFourBallCue(broad.graphSeed,q));
  const pre=await q.prepare(broad.own,token),view=Q.readReceipt(pre);
  // Native world.step has already integrated/refit bounds; compare only the
  // insertion topology this pre-collision component claims, never post-solve bounds/flags.
  for(const k of ['parents','leaf_node_indices','free_wide_nodes','optimization'])assert.deepEqual(view.after.initialTree[k],native.broad_phase.tree[k],'Exact native insertion topology '+k);
  assert.deepEqual(view.after.initialTree.nodes.map(n=>[n.left.children,n.right.children]),native.broad_phase.tree.nodes.map(n=>[n.left.children,n.right.children]));
  assert.equal(q.capability.fullBvhStateParity,false);
  const b=await j.prepare(broad.own.balls.map(({body,translation})=>({body,translation})),token,pre);
  assert.deepEqual(b.graph.edges.map(({collider1,collider2})=>({collider1,collider2})),native.narrow_phase.contact_graph.graph.edges.map(({weight:{collider1,collider2}})=>({collider1,collider2})),'Exact source dense contact graph order');
  assert.throws(()=>J.assertInitialLiveThreeBallCollisionOwned(b.receipt,'cpu-reference'),'Broad receipt is not narrow admission');
  j.narrowTransitions([],token);const r=J.assertInitialLiveThreeBallCollisionOwned(b.receipt,'cpu-reference');
  const initialized=I.initializeLiveRegisteredThreeBallUserChanges(seed.userChanges,Object.fromEntries(seed.numericInputs.map(x=>[x.role,I.initializeReference(x)])));
  assert.throws(()=>I.finishLiveThreeBallCollisionPhase(copy(initialized),b.receipt,'cpu-reference'));
  assert.throws(()=>I.finishLiveThreeBallCollisionPhase(initialized,b.receipt,'webgpu'));
  assert.equal(I.finishLiveThreeBallCollisionPhase(initialized,b.receipt,'cpu-reference').phase,'live-three-ball-collision-and-connectivity-complete-pre-energy');assert.deepEqual(r.sourceOrigin,projection.sourceOrigin);
  assert.throws(()=>J.assertInitialLiveRegisteredCollisionOwned(b.receipt,'cpu-reference'));assert.throws(()=>J.assertInitialLiveThreeBallCollisionOwned(copy(b.receipt),'cpu-reference'));
  j.abort(token);assert.throws(()=>J.assertInitialLiveThreeBallCollisionOwned(b.receipt,'cpu-reference'));
 }finally{j.abort(token);q.abort(token);j.release(token);q.release(token);j.dispose();q.dispose();}
 const owner=await C.createReferenceCollisionPreparation(decoder,raw);let gpuOwner;
 try{
  const initial=owner.snapshot(),cancel=new AbortController();cancel.abort(new Error('cancel preparation'));await assert.rejects(owner.prepare({signal:cancel.signal}),/cancel preparation/);assert.deepEqual(owner.snapshot(),initial);
  const prepared=await owner.prepare();assert.deepEqual(owner.snapshot(),initial);assert.equal(prepared.collision.phase,'live-three-ball-collision-and-connectivity-complete-pre-energy');assert.equal(prepared.exclusion.admitted,true);
  assert.deepEqual(prepared.initialContactOrigin.contactGraph,projection.created.state.narrow_phase.contact_graph);
  const expectedManager=copy(native.islands);expectedManager.persistent.sleep_scan_stamp=projection.created.state.islands.persistent.sleep_scan_stamp;
  assert.deepEqual(prepared.collision.manager,expectedManager,'Original native first-h manager before separate energy scan');
  assert.throws(()=>owner.commit(),e=>e.code==='three-ball-live-first-substep-unavailable');owner.abort();assert.deepEqual(owner.snapshot(),initial);assert.deepEqual(await owner.prepare(),prepared);owner.abort();
  if(device){
   gpuOwner=await C.createGpuCollisionPreparation(device,decoder,raw);const gpuInitial=gpuOwner.snapshot(),cancelled=new AbortController(),pending=gpuOwner.prepare({signal:cancelled.signal});cancelled.abort(new Error('cancel submitted work'));await assert.rejects(pending,/cancel submitted work/);assert.deepEqual(gpuOwner.snapshot(),gpuInitial);
   const actual=await gpuOwner.prepare();assert.deepEqual(actual.collision,prepared.collision,'Exact registration/collision manager across actual WGSL and reference');assert.deepEqual(actual.geometry.map(x=>x.state),prepared.geometry.map(x=>x.state),'Exact floor geometry across actual WGSL and reference');assert.deepEqual(actual.broad.after,prepared.broad.after,'Exact first-insertion tree/proxies/pairs across actual WGSL and reference');assert.equal(actual.exclusion.admitted,true);gpuOwner.abort();assert.deepEqual(gpuOwner.snapshot(),gpuInitial);
  }
  t.diagnostic(JSON.stringify({name,selectedIndex:projection.sourceOrigin.selectedIndex,sourceTargets:projection.sourceOrigin.targetIds,nativeInsertionTopologyExact:true,nativeGraphOrderExact:true,nativePreEnergyManagerExact:true,actualGpu:!!device,firstSubstepComplete:false}));
 }finally{gpuOwner?.dispose();owner.dispose();}
});
test('existing live four-ball factory provenance and initial receipts remain separate',async()=>{
 const {importLiveRegisteredFourBall}=await import('../src/browser-initial-import/live-registered-four-ball.mjs');
 for(const name of ['placed','settled','awake']){
  const raw=v8.deserialize(fs.readFileSync('/tmp/browser-live-registered-capture.'+name+'.v8')),seed=await importLiveRegisteredFourBall(decoder,raw);
  assert.throws(()=>Q.validateLiveRegisteredThreeBall(seed.cueBroadSeed));
  const q=await Q.createLiveRegisteredFourBallReferenceStage(seed.cueBroadSeed);let j;
  try{j=J.createReferenceStageWithLiveRegisteredFourBallCue(seed.contactGraphSeed,q);assert.throws(()=>J.createReferenceStageWithLiveThreeBallCue(seed.contactGraphSeed,q));assert.equal(q.capability.liveRegisteredFourBall,true);assert.equal(q.capability.liveRegisteredThreeBall,undefined);}
  finally{j?.dispose();q.dispose();}
 }
});
