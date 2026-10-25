// SPDX-License-Identifier: Apache-2.0
// Event-bounded original tip-contact discovery; no reference state enters candidate.
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
// The continuously existing original advances one whole outer call at a time.
// At most64 raw checkpoints are buffered. The final actual contact+4 endpoint
// stops inside angularPatchResistance only after the unchanged method completes.
async function* originalTipBoundary(name,raw,application){
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();
 try{
  if(name==='after-turn'){assert.equal(c.fire(),true);let steps=0;while((c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()))&&steps<20000){c.lab.step();steps++;}assert.equal(steps,5875);c.finishGameShot();c.pause(true);const delay=Math.ceil(c.cooldownUntil-performance.now());if(delay>=0)await new Promise(r=>setTimeout(r,delay+1));c.changeSettings(raw.capture.preStrikeApplication.controller.settings);}
  assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot);
  const step=c.lab.world.step,patch=c.lab.angularPatchResistance,tip=c.lab.compliantTipContact,stop=Symbol('original first tip plus short aftermath');let rows=[],pre,phase,h=0,firstContactFrame=null,done=false;
  c.lab.compliantTipContact=function(...args){const beforeSleeping=this.objects.map(o=>o.body.isSleeping()),episodes=this.cue?.stats.contactEpisodes??0;Reflect.apply(tip,this,args);const q=this.cue;phase={beforeSleeping,afterSleeping:this.objects.map(o=>o.body.isSleeping()),birth:(q?.stats.contactEpisodes??episodes)>episodes,touching:!!q?.contacts.has(application.controller.selectedId),firstContactTime:q?.stats.firstContact??null,cuePresent:!!q,events:copy(this.events.filter(e=>e.kind==='contact'&&e.label?.endsWith(' ↔ 큐 팁')))};};
  c.lab.world.step=function(...args){Reflect.apply(step,this,args);pre=this.takeSnapshot();};
  c.lab.angularPatchResistance=function(...args){Reflect.apply(patch,this,args);h++;if(phase.birth&&firstContactFrame===null){firstContactFrame=h;console.log(JSON.stringify({name,originalFirstTipContactFrame:h,originalFirstTipContactTime:phase.firstContactTime}));}rows.push({h,pre,post:this.world.takeSnapshot(),time:this.time,phase:copy(phase),firstContactFrame});if(firstContactFrame!==null&&h===firstContactFrame+M.TIP_CONTACT_CAPABILITY.aftermathSubsteps)throw stop;};
  try{
   while(!done&&h<M.TIP_CONTACT_CAPABILITY.maximumSteps){rows=[];try{c.lab.step();}catch(e){if(e!==stop)throw e;done=true;}for(const row of rows)yield row;}
   assert.ok(firstContactFrame!==null,'Original must discover actual contact within the bounded horizon');assert.equal(h,firstContactFrame+M.TIP_CONTACT_CAPABILITY.aftermathSubsteps);
  }finally{c.lab.world.step=step;c.lab.angularPatchResistance=patch;c.lab.compliantTipContact=tip;}
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
}
const normalizeCache=(rows,backend)=>rows.map(r=>{const x=copy(r);assert.equal(x.cache.backend,backend);assert.ok(backend==='webgpu'?x.cache.actualDispatches>0:x.cache.actualDispatches===0);delete x.cache.backend;delete x.cache.actualDispatches;return x;});
function compareBackends(a,b){for(const k of ['balls','scene','contactGraph','ownedBvh'])assert.deepEqual(a[k],b[k],'Exact recurrence CPU/WGSL '+k);for(const k of ['emptyCuePairs','emptyCueConvexPairs'])assert.deepEqual(normalizeCache(a[k],'webgpu'),normalizeCache(b[k],'cpu-reference'),'Exact owned cache recurrence '+k);let max=0;for(const role of ['shaft','head'])for(const field of ['linear','angular','translation','rotation','invInertia']){const x=a.cue[role][field],y=b.cue[role][field];near(x,y,3e-6*(field==='invInertia'?Math.max(1,...y.map(Math.abs)):1),'Recurrent cue parity');x.forEach((v,i)=>max=Math.max(max,Math.abs(v-y[i])));}near(a.cue.impulses,b.cue.impulses,2e-6,'Recurrent cue impulses');return max;}
function compareEvent(out,row,projection,expected){
 assert.equal(out.cueMetadata.birth,row.phase.birth);assert.equal(out.cueMetadata.touching,row.phase.touching);assert.equal(out.firstTipContact?.frame??null,row.firstContactFrame);
 const nativeNewTipEvents=row.phase.events.filter(e=>e.time>=projection.application.time);
 assert.equal(out.tipEvents.length,nativeNewTipEvents.length,'Original selected tip episode count');
 for(let i=0;i<nativeNewTipEvents.length;i++){const a=out.tipEvents[i],b=nativeNewTipEvents[i];for(const k of ['kind','label','time'])assert.equal(a[k],b[k]);near(['x','y','z'].map(k=>a.position[k]),['x','y','z'].map(k=>b.position[k]),3e-6,'Original tip event position');assert.equal(a.selectedIndex,projection.sourceOrigin.selectedIndex);assert.equal(a.selectedId,projection.sourceOrigin.selectedId);assert.deepEqual(a.body,projection.sourceOrigin.selectedBody);}
 const expectedWake=projection.application.registry.objects.filter((o,i)=>row.phase.beforeSleeping[i]&&!expected.post.bodies.find(b=>b.handle.index===o.body.index&&b.handle.generation===o.body.generation).activation.sleeping).map(o=>o.body);assert.deepEqual(out.wokenBodies,expectedWake,'Wake derives from original impulse and native island propagation, never forced');if(row.phase.birth)assert.equal(row.phase.afterSleeping[projection.sourceOrigin.selectedIndex],false,'Original nonzero first-tip impulse wakes the selected body');
 assert.equal(out.eventBoundary.complete,row.firstContactFrame!==null&&row.h===row.firstContactFrame+M.TIP_CONTACT_CAPABILITY.aftermathSubsteps);
 if(row.firstContactFrame!==null){assert.equal(out.firstTipContact.time,row.phase.firstContactTime);assert.equal(out.firstTipContact.selectedId,projection.sourceOrigin.selectedId);}
}
for(const name of ['default','after-turn'])test(name+' discovers original first tip contact and owns its wake plus short aftermath',async t=>{
 const raw=v8.deserialize(fs.readFileSync('/tmp/three-ball-live-evidence-20261025/capture.'+name+'.v8')),{projection}=await importLiveThreeBallInitialization(decoder,raw),reference=await M.createReferenceTipContactOwner(decoder,raw);let actual,maximumCueResidual=0,last=null;
 try{
  if(device)actual=await M.createGpuTipContactOwner(device,decoder,raw);
  for await(const row of originalTipBoundary(name,raw,projection.application)){
   const expected={h:row.h,time:row.time,pre:await decode(row.pre,projection.application,row.h),post:await decode(row.post,projection.application,row.h)},before=reference.snapshot();
   const boundary=row.phase.birth||row.firstContactFrame!==null&&row.h===row.firstContactFrame+M.TIP_CONTACT_CAPABILITY.aftermathSubsteps;
   if(boundary){const cancel=new AbortController();cancel.abort(new Error('cancel tip boundary'));await assert.rejects(reference.prepare({signal:cancel.signal}),/cancel tip boundary/);assert.deepEqual(reference.snapshot(),before);}
   const prepared=await reference.prepare();comparePrepared(prepared,expected,projection);compareEvent(prepared,row,projection,expected);assert.deepEqual(reference.snapshot(),before);assert.equal(!!prepared.cueMetadata.initialization,row.h===1);assert.deepEqual(prepared.sourceOrigin,projection.sourceOrigin);
   if(boundary){reference.abort();assert.deepEqual(reference.snapshot(),before);assert.deepEqual(await reference.prepare(),prepared,'First-contact wake/event rollback must retry identically');}
   reference.commit();assert.deepEqual(reference.snapshot(),prepared);
   if(actual){const gpuBefore=actual.snapshot();if(boundary){const cancel=new AbortController(),pending=actual.prepare({signal:cancel.signal});cancel.abort(new Error('cancel submitted tip boundary'));await assert.rejects(pending,/cancel submitted tip boundary/);assert.deepEqual(actual.snapshot(),gpuBefore);}const gpuPrepared=await actual.prepare();comparePrepared(gpuPrepared,expected,projection);compareEvent(gpuPrepared,row,projection,expected);maximumCueResidual=Math.max(maximumCueResidual,compareBackends(gpuPrepared,prepared));assert.deepEqual(gpuPrepared.firstTipContact,prepared.firstTipContact);assert.deepEqual(gpuPrepared.wokenBodies,prepared.wokenBodies);if(boundary){actual.abort();assert.deepEqual(actual.snapshot(),gpuBefore);assert.deepEqual(await actual.prepare(),gpuPrepared);}actual.commit();assert.deepEqual(actual.snapshot(),gpuPrepared);}
   last=prepared;if(row.h%64===0)console.log(JSON.stringify({name,progressSubsteps:row.h,contactFrame:prepared.firstTipContact?.frame??null,actualGpu:!!device}));
  }
  assert.ok(last.eventBoundary.complete);assert.equal(last.frame,last.firstTipContact.frame+M.TIP_CONTACT_CAPABILITY.aftermathSubsteps);const final=reference.snapshot();await assert.rejects(reference.prepare(),/Bounded/);assert.deepEqual(reference.snapshot(),final);if(actual)await assert.rejects(actual.prepare(),/Bounded/);
  t.diagnostic(JSON.stringify({name,selectedIndex:projection.sourceOrigin.selectedIndex,firstContactFrame:last.firstTipContact.frame,completedSubsteps:last.frame,afterContactSubsteps:M.TIP_CONTACT_CAPABILITY.aftermathSubsteps,actualGpu:!!device,maximumCueResidual,wholeShot:false}));
 }finally{actual?.dispose();reference.dispose();}
});
