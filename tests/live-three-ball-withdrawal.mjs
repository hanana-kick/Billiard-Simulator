// SPDX-License-Identifier: Apache-2.0
// Event-bounded original cue withdrawal and 64-to-1 cadence discovery.
// All native rows are assertion-only; candidate receives initial capture only.
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
// The original snapshots its subdivisions at outer-loop entry. Removal inside
// an outer call must not prematurely switch the remaining substeps to dt=1/960.
// Buffer at most one original outer call (64 snapshots), never a full trace.
async function* originalWithdrawalBoundary(name,raw,application){
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.repairRouteTargets();
 try{
  if(name==='after-turn'){assert.equal(c.fire(),true);let steps=0;while((c.lab.cue||c.lab.objects.some(o=>!o.body.isSleeping()))&&steps<20000){c.lab.step();steps++;}assert.equal(steps,5875);c.finishGameShot();c.pause(true);const delay=Math.ceil(c.cooldownUntil-performance.now());if(delay>=0)await new Promise(r=>setTimeout(r,delay+1));c.changeSettings(raw.capture.preStrikeApplication.controller.settings);}
  assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot);
  const step=c.lab.world.step,patch=c.lab.angularPatchResistance,tip=c.lab.compliantTipContact;
  let rows=[],pre,phase,h=0,outer=0,substep=0,subdivisions=64,removalFrame=null,removalOuter=null,removalOuterEnd=null,done=false;
  c.lab.compliantTipContact=function(...args){const wasPresent=!!this.cue;Reflect.apply(tip,this,args);phase={cuePresent:!!this.cue,removed:wasPresent&&!this.cue,events:copy(this.events.filter(e=>e.kind==='contact'&&e.label?.endsWith(' ↔ 큐 팁')))};};
  c.lab.world.step=function(...args){Reflect.apply(step,this,args);pre=this.takeSnapshot();};
  c.lab.angularPatchResistance=function(...args){Reflect.apply(patch,this,args);h++;substep++;if(phase.removed){assert.equal(removalFrame,null,'One actual cue removal');removalFrame=h;removalOuter=outer;console.log(JSON.stringify({name,originalCueRemovalFrame:h,outer,substep,subdivisions}));}rows.push({h,pre,post:this.world.takeSnapshot(),time:this.time,phase:copy(phase),outer,substep,subdivisions,dt:args[0],removalFrame,removalOuter,outerEnd:substep===subdivisions});};
  try{
   while(!done&&h<M.WITHDRAWAL_CAPABILITY.maximumSteps){
    rows=[];substep=0;subdivisions=c.lab.cue?c.lab.strokeSubsteps:1;const sourceSteps=c.lab.steps;
    c.lab.step();assert.equal(c.lab.steps,sourceSteps+1);assert.equal(rows.length,subdivisions,'Original outer call must finish its entry-selected cadence');
    if(removalOuter===outer){assert.equal(subdivisions,64);removalOuterEnd=h;}
    if(removalOuter!==null&&outer===removalOuter+1){assert.equal(subdivisions,1);assert.equal(h,removalOuterEnd+1);done=true;}
    for(const row of rows)yield {...row,removalOuterEnd,complete:done&&row.outerEnd};outer++;
   }
   assert.ok(removalFrame!==null,'Actual source must remove cue within bounded horizon');assert.ok(done,'Finish removal outer and first complete no-cue outer');
  }finally{c.lab.world.step=step;c.lab.angularPatchResistance=patch;c.lab.compliantTipContact=tip;}
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
}
const normalizeCache=(rows,backend)=>rows.map(r=>{const x=copy(r);assert.equal(x.cache.backend,backend);assert.ok(backend==='webgpu'?x.cache.actualDispatches>0:x.cache.actualDispatches===0);delete x.cache.backend;delete x.cache.actualDispatches;return x;});
function compareBackends(a,b,ballResiduals){
 try{
 // Existing native body criteria, not a new bit-identity requirement for floats.
 // Compare every remaining ball/cache/discrete field exactly, without writeback.
 const fields={translation:1e-6,rotation:1e-6,linear:3e-6,angular:3e-6,invInertia:3e-6};
 assert.equal(a.balls.length,b.balls.length);
 for(let i=0;i<b.balls.length;i++){
  const aa=copy(a.balls[i]),bb=copy(b.balls[i]);
  for(const [field,tolerance]of Object.entries(fields)){
   const x=aa.state[field],y=bb.state[field];near(x,y,tolerance,'Owned ball '+i+'.'+field);
   x.forEach((v,k)=>{const residual=Math.abs(v-y[k]);ballResiduals.maximum[field]=Math.max(ballResiduals.maximum[field]??0,residual);if(!Object.is(v,y[k])&&ballResiduals.firstDifferences.length<10){const entry={frame:a.frame,ball:i,field,component:k,gpu:v,cpu:y[k],absoluteResidual:residual};ballResiduals.firstDifferences.push(entry);console.log(JSON.stringify({rawBallDifference:entry}));}});
   delete aa.state[field];delete bb.state[field];
  }
  assert.deepEqual(aa,bb,'Exact remaining ball identity/cache/discrete state');
 }
 for(const k of ['scene','contactGraph','ownedBvh'])assert.deepEqual(a[k],b[k],'Exact withdrawal CPU/WGSL '+k);
 for(const k of ['emptyCuePairs','emptyCueConvexPairs'])assert.deepEqual(normalizeCache(a[k],'webgpu'),normalizeCache(b[k],'cpu-reference'),'Exact owned cache recurrence '+k);
 if(b.cue===null){assert.equal(a.cue,null);return 0;}
 let max=0;for(const role of ['shaft','head'])for(const field of ['linear','angular','translation','rotation','invInertia']){const x=a.cue[role][field],y=b.cue[role][field];near(x,y,3e-6*(field==='invInertia'?Math.max(1,...y.map(Math.abs)):1),'Recurrent cue parity');x.forEach((v,i)=>max=Math.max(max,Math.abs(v-y[i])));}near(a.cue.impulses,b.cue.impulses,2e-6,'Recurrent cue impulses');return max;
 }catch(error){error.message='h'+a.frame+': '+error.message;throw error;}
}
function compareCadence(out,row,projection){
 assert.equal(out.cueMetadata.cuePresent,row.phase.cuePresent,'Native cue presence at actual h');
 assert.equal(out.cueMetadata.sourceH,row.dt,'Cadence belongs to original outer entry, not current cue presence');
 assert.equal(out.outerStep,row.outer+(row.outerEnd?1:0),'Completed source outer calls');assert.equal(out.outerSubstep,row.outerEnd?0:row.substep,'Position inside original outer call');
 assert.equal(out.stepSubdivisions,row.subdivisions);assert.equal(out.subdivisions,row.outerEnd&&!row.phase.cuePresent?1:row.subdivisions);assert.equal(out.withdrawalFrame,row.removalFrame);for(const b of out.balls)assert.equal(b.state.dt,Math.fround(row.dt));
 assert.equal(out.eventBoundary.complete,row.complete,'No early completion at removal or its remaining64 boundary');
 const want=row.phase.events.filter(e=>e.time>=projection.application.time);assert.equal(out.tipEvents.length,want.length);
 for(let i=0;i<want.length;i++){const a=out.tipEvents[i],b=want[i];for(const k of ['kind','label','time'])assert.equal(a[k],b[k]);near(['x','y','z'].map(k=>a.position[k]),['x','y','z'].map(k=>b.position[k]),3e-6,'Native tip event');assert.equal(a.selectedIndex,projection.sourceOrigin.selectedIndex);assert.equal(a.selectedId,projection.sourceOrigin.selectedId);assert.deepEqual(a.body,projection.sourceOrigin.selectedBody);}
 if(!row.phase.cuePresent){assert.equal(out.cue,null);assert.deepEqual(out.emptyCuePairs,[]);assert.deepEqual(out.emptyCueConvexPairs,[]);for(const field of ['shaft','head','guide']){const h=projection.application.cue[field];assert.equal(out.scene.bodies.some(b=>b.handle.index===h.index&&b.handle.generation===h.generation),false,'Removed cue '+field+' cannot survive in manager roster');}}
}
for(const name of ['default','after-turn'])test(name+' actual cue withdrawal retains current64 cadence then completes first no-cue1 outer',async t=>{
 const raw=v8.deserialize(fs.readFileSync('/tmp/three-ball-live-evidence-20261025/capture.'+name+'.v8')),{projection}=await importLiveThreeBallInitialization(decoder,raw),reference=await M.createReferenceWithdrawalOwner(decoder,raw);let actual,last=null,maximumCueResidual=0,removalFrame=null,removalOuterEnd=null;const ballResiduals={maximum:{},firstDifferences:[]};
 try{
  if(device)actual=await M.createGpuWithdrawalOwner(device,decoder,raw);
  for await(const row of originalWithdrawalBoundary(name,raw,projection.application)){
   const expected={h:row.h,time:row.time,pre:await decode(row.pre,projection.application,row.h),post:await decode(row.post,projection.application,row.h)},before=reference.snapshot(),boundary=row.phase.removed||row.removalOuter===row.outer&&row.outerEnd||row.complete;
   if(boundary){const cancel=new AbortController();cancel.abort(new Error('cancel withdrawal boundary'));await assert.rejects(reference.prepare({signal:cancel.signal}),/cancel withdrawal boundary/);assert.deepEqual(reference.snapshot(),before);}
   const prepared=await reference.prepare();comparePrepared(prepared,expected,projection);compareCadence(prepared,row,projection);assert.deepEqual(reference.snapshot(),before);assert.deepEqual(prepared.sourceOrigin,projection.sourceOrigin);
   if(boundary){reference.abort();assert.deepEqual(reference.snapshot(),before);assert.deepEqual(await reference.prepare(),prepared,'Removal/cadence rollback must retry identically');}
   reference.commit();assert.deepEqual(reference.snapshot(),prepared);
   if(actual){const gpuBefore=actual.snapshot();if(boundary){const cancel=new AbortController(),pending=actual.prepare({signal:cancel.signal});cancel.abort(new Error('cancel submitted withdrawal boundary'));await assert.rejects(pending,/cancel submitted withdrawal boundary/);assert.deepEqual(actual.snapshot(),gpuBefore);}const gpuPrepared=await actual.prepare();comparePrepared(gpuPrepared,expected,projection);compareCadence(gpuPrepared,row,projection);maximumCueResidual=Math.max(maximumCueResidual,compareBackends(gpuPrepared,prepared,ballResiduals));if(boundary){actual.abort();assert.deepEqual(actual.snapshot(),gpuBefore);assert.deepEqual(await actual.prepare(),gpuPrepared);}actual.commit();assert.deepEqual(actual.snapshot(),gpuPrepared);}
   last=prepared;removalFrame=row.removalFrame;removalOuterEnd=row.removalOuterEnd;if(row.outerEnd)console.log(JSON.stringify({name,progressSubsteps:row.h,removalFrame,outer:row.outer,subdivisions:row.subdivisions,actualGpu:!!device}));
  }
  assert.ok(last.eventBoundary.complete);assert.equal(last.frame,removalOuterEnd+1);assert.ok(removalFrame<=removalOuterEnd);const final=reference.snapshot();await assert.rejects(reference.prepare(),/Bounded/);assert.deepEqual(reference.snapshot(),final);if(actual)await assert.rejects(actual.prepare(),/Bounded/);
  t.diagnostic(JSON.stringify({name,selectedIndex:projection.sourceOrigin.selectedIndex,removalFrame,removalOuterEnd,completedSubsteps:last.frame,actualGpu:!!device,maximumCueResidual,ballResiduals,wholeShot:false}));
 }finally{actual?.dispose();reference.dispose();}
});
