// SPDX-License-Identifier: Apache-2.0
// Genuine controller oracle is assertion-only; owners receive only initial capture.
import {test,before,after} from 'node:test';
import fs from 'node:fs';import v8 from 'node:v8';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {assert,near,comparePrepared} from './live-three-ball-native-assertions.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
globalThis.RAPIER=R;for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,root=path.resolve(import.meta.dirname,'..');
let decoder,device,gpu,M;
before(async()=>{
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 await R.init();M=await import('../src/browser-initial-import/live-three-ball-first-step.mjs');
 if(process.env.REQUIRE_WEBGPU==='1'){
  assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit actual native WebGPU module required');const mod=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE));Object.assign(globalThis,mod.globals);gpu=mod.create(['backend=vulkan']);const adapter=await gpu.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();
 }
});
after(()=>device?.destroy());
const arena=a=>a.items.flatMap((slot,index)=>slot&&typeof slot==='object'&&Object.hasOwn(slot,'generation')?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
async function decodeExpected(bytes,application){
 const state=plain((await decoder.decodeSnapshot(bytes)).state),bodies=arena(state.bodies.bodies),colliders=arena(state.colliders.colliders);
 return {candidateInput:false,boundary:'expected-only-h1-postApplication',state,bodies,colliders,application,contactPairs:state.narrow_phase.contact_graph.graph.edges.map(e=>e.weight),queues:{modifiedBodies:state.bodies.modified_bodies[0]}};
}
// Reproduce source continuously: restoring the source alone would omit the
// original application mutable-body calls and is not an equivalent oracle.
async function originalFirstStep(name,raw){
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();
 try{
  if(name==='after-turn'){
   assert.equal(c.fire(),true);let steps=0;while((c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()))&&steps<20000){c.lab.step();steps++;}
   assert.equal(steps,5875);c.finishGameShot();c.pause(true);const delay=Math.ceil(c.cooldownUntil-performance.now());if(delay>=0)await new Promise(r=>setTimeout(r,delay+1));c.changeSettings(raw.capture.preStrikeApplication.controller.settings);
  }
  assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot,'Continuous original created bytes must match the actual captured source');
  const worldStep=c.lab.world.step,patch=c.lab.angularPatchResistance,stop=Symbol('first postapplication h');let preBytes,postBytes,nativeSteps=0;
  c.lab.world.step=function(...args){nativeSteps++;Reflect.apply(worldStep,this,args);preBytes=this.takeSnapshot();};
  c.lab.angularPatchResistance=function(...args){Reflect.apply(patch,this,args);postBytes=this.world.takeSnapshot();throw stop;};
  try{c.lab.step();assert.fail('Expected first-substep observation');}catch(e){if(e!==stop)throw e;}finally{c.lab.world.step=worldStep;c.lab.angularPatchResistance=patch;}
  assert.equal(nativeSteps,1);assert.ok(preBytes&&postBytes);
  const application={...copy(raw.capture.createdApplication??raw.capture.application??{}),time:c.lab.time,events:copy(c.lab.events),registry:{objects:c.lab.objects.map((o,i)=>({id:o.id,index:i})),cue:copy(raw.capture.createdApplication?.cue??{})}};
  // Use exact imported source registry (handles are unchanged through this h).
  const sourceApplication=raw.capture.createdApplication??raw.capture.application;
  if(sourceApplication?.registry)application.registry=copy(sourceApplication.registry);
  return {h:1,pre:await decodeExpected(preBytes,application),post:await decodeExpected(postBytes,application),time:c.lab.time};
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
}
for(const name of ['default','after-turn'])test(name+' complete first original live three-ball h with rollback and actual WGSL parity',async t=>{
 const raw=v8.deserialize(fs.readFileSync((process.env.THREE_BALL_LIVE_CAPTURE_PREFIX??'/tmp/three-ball-live-evidence-20261025/capture')+'.'+name+'.v8'));
 const {importLiveThreeBallInitialization}=await import('../src/browser-initial-import/live-three-ball-initialization.mjs');const {projection}=await importLiveThreeBallInitialization(decoder,raw);
 assert.equal(projection.sourceOrigin.selectedIndex,name==='default'?0:1);assert.deepEqual(projection.application.game.pending.targets,name==='default'?[2,3]:[1,3]);
 const {importLiveThreeBallStepSeed}=await import('../src/browser-initial-import/live-three-ball-step-seed.mjs'),source=await importLiveThreeBallStepSeed(decoder,raw),Cue=require('../src/experimental-cue-created-stroke-stage.js');
 assert.doesNotThrow(()=>Cue.validate(source.cueInitial));
 for(const mutate of [s=>s.application.selectedIndex=(s.application.selectedIndex+1)%3,s=>s.application.selectedId=999,s=>s.application.strikeSettings.speed+=.1,s=>s.sourceOrigin.selectedIndex=(s.sourceOrigin.selectedIndex+1)%3,s=>s.application.environmentContract='original-three-ball-constructor-layout',s=>s.application.environmentContract='original-controller-live-registered-four-ball-layout']){const changed=copy(source.cueInitial);mutate(changed);assert.throws(()=>Cue.validate(changed),'Source selection/settings/provenance and family cannot be substituted');}
 const expected=await originalFirstStep(name,raw),owner=await M.createReferenceFirstStepOwner(decoder,raw);let gpuOwner;
 try{
  const initial=owner.snapshot(),cancel=new AbortController();cancel.abort(new Error('cancel before prepare'));await assert.rejects(owner.prepare({signal:cancel.signal}),/cancel before prepare/);assert.deepEqual(owner.snapshot(),initial);
  const prepared=await owner.prepare();assert.deepEqual(owner.snapshot(),initial,'Preparation remains private');comparePrepared(prepared,expected,projection);await assert.rejects(owner.prepare(),/pending|prior|prepared/i);owner.abort();assert.deepEqual(owner.snapshot(),initial);
  assert.deepEqual(await owner.prepare(),prepared,'Retry consumes identical original source');owner.commit();comparePrepared(owner.snapshot(),expected,projection);
  if(device){
   gpuOwner=await M.createGpuFirstStepOwner(device,decoder,raw);const initialGpu=gpuOwner.snapshot(),cancelled=new AbortController(),pending=gpuOwner.prepare({signal:cancelled.signal});cancelled.abort(new Error('cancel submitted GPU work'));await assert.rejects(pending,/cancel submitted GPU work/);assert.deepEqual(gpuOwner.snapshot(),initialGpu);
   const actual=await gpuOwner.prepare();comparePrepared(actual,expected,projection);
   for(const field of ['balls','scene','contactGraph','ownedBvh'])assert.deepEqual(actual[field],prepared[field],'Exact CPU/WGSL '+field);
   for(const field of ['emptyCuePairs','emptyCueConvexPairs']){const normalize=(rows,backend)=>rows.map(r=>{const x=copy(r);assert.equal(x.cache.backend,backend);assert.ok(backend==='webgpu'?x.cache.actualDispatches>0:x.cache.actualDispatches===0);delete x.cache.backend;delete x.cache.actualDispatches;return x;});assert.deepEqual(normalize(actual[field],'webgpu'),normalize(prepared[field],'cpu-reference'),'Exact native cache arithmetic '+field);}
   assert.equal(actual.cue.backend,'webgpu');assert.equal(prepared.cue.backend,'cpu-reference');const {backend:actualBackend,...actualCue}=actual.cue,{backend:referenceBackend,...referenceCue}=prepared.cue;// The original component gates are numerical, not universal bit identity.
   // Preserve raw signed-zero/tiny residuals; never normalize either backend.
   let maxCueResidual=0,cueDifferences=0,signedZeroDifferences=0;
   const compareCue=(a,b,tol,label)=>{if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((x,i)=>compareCue(a[i],x,tol,label+'['+i+']'));return;}near(a,b,tol,label);const residual=Math.abs(a-b);maxCueResidual=Math.max(maxCueResidual,residual);if(!Object.is(a,b)){if(a===0&&b===0)signedZeroDifferences++;else cueDifferences++;}};
   for(const role of ['shaft','head'])for(const field of ['linear','angular','translation','rotation','invInertia'])compareCue(actualCue[role][field],referenceCue[role][field],3e-6*(field==='invInertia'?Math.max(1,...referenceCue[role][field].map(Math.abs)):1),'CPU/WGSL cue.'+role+'.'+field);
   compareCue(actualCue.impulses,referenceCue.impulses,2e-6,'CPU/WGSL joint impulses');assert.equal(actualCue.traces.length,referenceCue.traces.length);for(let i=0;i<actualCue.traces.length;i++){assert.equal(actualCue.traces[i].step,referenceCue.traces[i].step);compareCue(actualCue.traces[i].values,referenceCue.traces[i].values,3e-6,'CPU/WGSL cue trace');}
   t.diagnostic(JSON.stringify({name,crossBackendCueMaximumAbsoluteResidual:maxCueResidual,cueDifferences,signedZeroDifferences,rawHeadLinearZ:{cpu:prepared.cue.head.linear[2],gpu:actual.cue.head.linear[2]},criterion:'unchanged original cue/component numerical tolerances; not bit identity'}));
   gpuOwner.abort();assert.deepEqual(gpuOwner.snapshot(),initialGpu);await gpuOwner.prepare();gpuOwner.commit();comparePrepared(gpuOwner.snapshot(),expected,projection);
  }
  t.diagnostic(JSON.stringify({name,selectedIndex:projection.sourceOrigin.selectedIndex,firstSubstepComplete:true,nativeManagerExact:true,nativeBvhExact:true,actualGpu:!!device}));
 }finally{gpuOwner?.dispose();owner.dispose();}
});
