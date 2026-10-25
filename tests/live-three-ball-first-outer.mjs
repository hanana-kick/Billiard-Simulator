// SPDX-License-Identifier: Apache-2.0
// Sixty-four independently observed original substeps; candidate never sees them.
import {test,before,after} from 'node:test';
import fs from 'node:fs';import v8 from 'node:v8';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {assert,near,comparePrepared} from './live-three-ball-native-assertions.mjs';
import {importLiveThreeBallInitialization} from '../src/browser-initial-import/live-three-ball-initialization.mjs';
import * as M from '../src/browser-initial-import/live-three-ball-first-step.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const root=path.resolve(import.meta.dirname,'..'),copy=x=>structuredClone(x);let decoder,device,gpu;
before(async()=>{const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});await R.init();if(process.env.REQUIRE_WEBGPU==='1'){assert.ok(process.env.GPU_NATIVE_MODULE);const mod=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE));Object.assign(globalThis,mod.globals);gpu=mod.create(['backend=vulkan']);device=await(await gpu.requestAdapter()).requestDevice();}});
after(()=>device?.destroy());
const arena=a=>a.items.flatMap((slot,index)=>slot&&typeof slot==='object'&&Object.hasOwn(slot,'generation')?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
async function decode(bytes,application,h){const state=plain((await decoder.decodeSnapshot(bytes)).state);return{candidateInput:false,boundary:'expected-only-h'+h+'-postApplication',state,bodies:arena(state.bodies.bodies),colliders:arena(state.colliders.colliders),application,contactPairs:state.narrow_phase.contact_graph.graph.edges.map(e=>e.weight),queues:{modifiedBodies:state.bodies.modified_bodies[0]}};}
async function originalOuter(name,raw,application){
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();
 try{
  if(name==='after-turn'){assert.equal(c.fire(),true);let steps=0;while((c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()))&&steps<20000){c.lab.step();steps++;}assert.equal(steps,5875);c.finishGameShot();c.pause(true);const delay=Math.ceil(c.cooldownUntil-performance.now());if(delay>=0)await new Promise(r=>setTimeout(r,delay+1));c.changeSettings(raw.capture.preStrikeApplication.controller.settings);}
  assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot);
  const step=c.lab.world.step,patch=c.lab.angularPatchResistance,rows=[];let pre;
  c.lab.world.step=function(...args){Reflect.apply(step,this,args);pre=this.takeSnapshot();};
  c.lab.angularPatchResistance=function(...args){Reflect.apply(patch,this,args);rows.push({pre,post:this.world.takeSnapshot(),time:this.time});};
  try{c.lab.step();}finally{c.lab.world.step=step;c.lab.angularPatchResistance=patch;}
  assert.equal(rows.length,64);return rows;
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
}
const normalizeCache=(rows,backend)=>rows.map(r=>{const x=copy(r);assert.equal(x.cache.backend,backend);assert.ok(backend==='webgpu'?x.cache.actualDispatches>0:x.cache.actualDispatches===0);delete x.cache.backend;delete x.cache.actualDispatches;return x;});
function compareBackends(a,b){for(const k of ['balls','scene','contactGraph','ownedBvh'])assert.deepEqual(a[k],b[k],'Exact recurrence CPU/WGSL '+k);for(const k of ['emptyCuePairs','emptyCueConvexPairs'])assert.deepEqual(normalizeCache(a[k],'webgpu'),normalizeCache(b[k],'cpu-reference'),'Exact owned cache recurrence '+k);let max=0;for(const role of ['shaft','head'])for(const field of ['linear','angular','translation','rotation','invInertia']){const x=a.cue[role][field],y=b.cue[role][field];near(x,y,3e-6*(field==='invInertia'?Math.max(1,...y.map(Math.abs)):1),'Recurrent cue parity');x.forEach((v,i)=>max=Math.max(max,Math.abs(v-y[i])));}near(a.cue.impulses,b.cue.impulses,2e-6,'Recurrent cue impulses');return max;}
for(const name of ['default','after-turn'])test(name+' owns64 original live-three substeps without source reset',async t=>{
 const raw=v8.deserialize(fs.readFileSync('/tmp/three-ball-live-evidence-20261025/capture.'+name+'.v8')),{projection}=await importLiveThreeBallInitialization(decoder,raw),observed=await originalOuter(name,raw,projection.application),reference=await M.createReferenceFirstOuterOwner(decoder,raw);let actual,maximumCueResidual=0;
 try{
  assert.equal(reference.capability.maximumSteps,64);await assert.rejects(reference.prepare({state:{frame:999}}),/state injection/);
  if(device)actual=await M.createGpuFirstOuterOwner(device,decoder,raw);
  // Stream every original checkpoint through both candidates, then discard it.
  // This retains every gate without keeping128 decoded worlds and64 trace copies.
  for(let h=1;h<=64;h++){
   const before=reference.snapshot();if(h===2){const changed=reference.snapshot();changed.balls[0].state.translation[0]+=1;changed.scene.manager.active_set_epoch++;changed.ownedBvh.frame_index++;changed.cue.head.linear[0]+=1;assert.deepEqual(reference.snapshot(),before,'Public checkpoint mutation cannot alter owned recurrence');}if([2,32,64].includes(h)){const cancel=new AbortController();cancel.abort(new Error('cancel recurrence'));await assert.rejects(reference.prepare({signal:cancel.signal}),/cancel recurrence/);assert.deepEqual(reference.snapshot(),before);}
   const expected={h,time:observed[h-1].time,pre:await decode(observed[h-1].pre,projection.application,h),post:await decode(observed[h-1].post,projection.application,h)};observed[h-1]=null;
   const prepared=await reference.prepare();assert.deepEqual(reference.snapshot(),before);comparePrepared(prepared,expected,projection);assert.equal(prepared.outerSubstep,h%64);assert.equal(prepared.outerStep,Math.floor(h/64));assert.deepEqual(prepared.sourceOrigin,projection.sourceOrigin);assert.equal(!!prepared.cueMetadata.initialization,h===1,'Only first h initializes source');
   if([2,32,64].includes(h)){reference.abort();assert.deepEqual(reference.snapshot(),before);assert.deepEqual(await reference.prepare(),prepared,'Exact recurrent retry');}
   reference.commit();assert.deepEqual(reference.snapshot(),prepared);
   if(actual){
    const gpuBefore=actual.snapshot();if([2,32,64].includes(h)){const cancel=new AbortController(),pending=actual.prepare({signal:cancel.signal});cancel.abort(new Error('cancel submitted recurrence'));await assert.rejects(pending,/cancel submitted recurrence/);assert.deepEqual(actual.snapshot(),gpuBefore);}
    const gpuPrepared=await actual.prepare();comparePrepared(gpuPrepared,expected,projection);maximumCueResidual=Math.max(maximumCueResidual,compareBackends(gpuPrepared,prepared));if(h===32){actual.abort();assert.deepEqual(actual.snapshot(),gpuBefore);assert.deepEqual(await actual.prepare(),gpuPrepared);}actual.commit();assert.deepEqual(actual.snapshot(),gpuPrepared);
   }
  }
  const final=reference.snapshot();await assert.rejects(reference.prepare(),/Bounded/);assert.deepEqual(reference.snapshot(),final);if(actual)await assert.rejects(actual.prepare(),/Bounded/);
  t.diagnostic(JSON.stringify({name,selectedIndex:projection.sourceOrigin.selectedIndex,sourceTargets:projection.sourceOrigin.targetIds,completedSubsteps:64,exactNativeManagersAndBvh:true,actualGpu:!!device,maximumCueResidual,wholeShot:false}));
 }finally{actual?.dispose();reference.dispose();}
});
