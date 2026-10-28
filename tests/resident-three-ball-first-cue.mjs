import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallFirstScenePlan,assertThreeBallFirstScenePlan,executeThreeBallFirstSceneForTest,threeBallFirstSceneTestKernels,THREE_BALL_FIRST_SCENE_LAYOUT as L} from '../src/resident-candidate/three-ball-scene-first-collision.mjs';
import {SCENE_LAYOUT as S,generateSceneActivationWGSL} from '../src/resident-candidate/scene-activation.mjs';
import {encodeSceneWorld,generateSceneWorldWGSL} from '../src/resident-candidate/scene-world.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I,generateSceneInitializationWGSL} from '../src/resident-candidate/scene-initialization.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,key=h=>h.index+':'+h.generation;
import {createThreeBallFirstNumericalPlan,assertThreeBallFirstNumericalPlan,executeThreeBallFirstNumericalForTest,requireThreeBallFirstNumericalContinuation} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {THREE_BALL_SOLVER_LAYOUT as L3} from '../src/resident-candidate/three-ball-solver.mjs';
import {SCENE_WORLD_LAYOUT as W} from '../src/resident-candidate/scene-world.mjs';
import {createThreeBallFirstCuePlan,executeThreeBallFirstCueForTest,assertThreeBallFirstCuePlan,threeBallFirstCueTestKernels,requireThreeBallAfterCueContinuation,THREE_BALL_FIRST_CUE_HEADER as CH} from '../src/resident-candidate/three-ball-first-cue.mjs';
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),numerical=createThreeBallFirstNumericalPlan(plan),cue=createThreeBallFirstCuePlan(numerical),out=await executeThreeBallFirstCueForTest(cue,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,numerical,cue,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

test('genuine deferred two-dynamic cue owner follows energy/roster with actual source pre/post inactive CCD',t=>{
 for(const {row,seed,cue:p,out}of fixtures){
  assertThreeBallFirstCuePlan(p);assert.equal(out.capability.actualCueDynamicCount,2);assert.equal(out.capability.actualCueFixedCount,1);assert.equal(out.capability.actualCueJointCount,2);
  assert.equal(out.capability.generalCcdPassAuthority,false);assert.equal(out.capability.sphereSolveDispatched,false);assert.equal(out.capability.wholeH,false);assert.throws(()=>requireThreeBallAfterCueContinuation(p),{code:'three-ball-after-cue-continuation-unavailable'});
  if(row.name==='selected-1'){assert.equal(out.available,false);assert.equal(out.reason,'current-cue-empty-manifold-owner-unavailable');continue;}
  assert.equal(out.available,true);const d=p.layout;assert.equal(out.words[d.control+CH.completed],1);assert.equal(out.words[d.control+CH.ccdMask],3);assert.equal(out.checks.length,2);assert.ok(out.checks.every(c=>c.admitted&&!c.active));
  assert.deepEqual(out.history,seed.history);assert.deepEqual(out.words.slice(d.bodies,d.bodies+192),out.beforeSolve.slice(d.bodies,d.bodies+192));assert.deepEqual(out.decoded.impulses,out.sourceExpected.joint.impulses);
  assert.equal(out.sourceExpected.pendingApplicationTime,seed.application.time+seed.application.dt/seed.application.strokeSubsteps);
  t.diagnostic(JSON.stringify({fixture:row.name,joints:out.jointIdentities.map(j=>j.handle),postCcd:out.checks.map(c=>({role:c.body,active:c.active,motion:c.motion,threshold:c.threshold})),sphereSolve:false}));
 }
});
test('current cue tail uses actual registered maxExtent and source CCD thickness with distinct COM lanes',()=>{
 for(const {cue:p,out}of fixtures){if(!out.available)continue;const d=p.layout,init=p.numerical.first.template.registration.layout.numericOutputs;
  for(let role=0;role<2;role++){const at=d.bodies+(3+role)*64,saved=d.saved+role*64;
   assert.equal(out.beforeSolve[at+62],out.beforeSolve[init+role*30+12]);assert.equal(out.beforeSolve[at+63],out.beforeSolve[init+role*30+13]);assert.equal(out.beforeSolve[saved+62],out.beforeSolve[at+62]);
   for(const start of[56,59])assert.deepEqual(out.words.slice(at+start,at+start+3),out.beforeSolve.slice(at+start,at+start+3),'cue J output does not invent COM cache updates');
   assert.notDeepEqual(out.beforeSolve.slice(at+56,at+59),out.beforeSolve.slice(at+59,at+62));
  }
 }
});
test('no external/future numeric input or incorrect role/epoch/completion can enter cue writeback',async()=>{
 const a=fixtures.find(f=>f.out.available),p=a.cue,d=p.layout;assert.throws(()=>createThreeBallFirstCuePlan(copy(a.numerical)));assert.throws(()=>createThreeBallFirstCuePlan(a.numerical,{}));
 await assert.rejects(executeThreeBallFirstCueForTest(p));await assert.rejects(executeThreeBallFirstCueForTest(p,{testOnly:true,dt:1}));
 const bad=createThreeBallFirstCuePlan(a.numerical);bad.programs.joint[0]++;assert.throws(()=>assertThreeBallFirstCuePlan(bad),/mutated/);
 for(const mutate of[x=>x[d.control+CH.numericReady]=0,x=>x[S.header.epoch]++,x=>x[d.control+CH.phase]=3]){
  const x=a.out.beforeSolve.slice(),before=x.slice(d.bodies,d.bodies+320);mutate(x);assert.equal(threeBallFirstCueTestKernels(p,x).rc_scene_three_cue_scatter(0,d.bodies,d.control,d.output),false);assert.deepEqual(x.slice(d.bodies,d.bodies+320),before);
 }
});
test('joint/guide generations, initial registration tail and every post-CCD completion remain fail-closed',()=>{
 const {cue:p,out}=fixtures.find(f=>f.out.available),d=p.layout,init=p.numerical.first.template.registration.layout.numericOutputs;
 for(const mutate of[a=>a[d.control+25]++,a=>a[d.control+29]++,a=>a[d.control+23]=5,a=>a[init+12]=0]){
  const a=out.beforeSolve.slice();a[d.control+CH.phase]=0;mutate(a);assert.equal(threeBallFirstCueTestKernels(p,a).rc_scene_three_cue_gather(0,d.journal,d.energy,d.bodies,d.control,d.input,d.saved,init),false);assert.equal(a[d.control+CH.completed],0);
 }
 for(const invalid of ['active','unsupported','staleEpoch','repeated']){
  const a=out.words.slice();a[d.control+CH.completed]=0;a[d.control+CH.phase]=2;a[d.control+CH.ccdMask]=invalid==='repeated'?1:0;
  if(invalid==='active')a[d.ccdOutput+17]=0x3f800000;if(invalid==='unsupported')a[d.ccdOutput+18]=0;if(invalid==='staleEpoch')a[S.header.epoch]++;
  assert.equal(threeBallFirstCueTestKernels(p,a).rc_scene_three_cue_ccd_finish(0,d.control,d.ccdOutput,0),false,invalid);assert.equal(a[d.control+CH.completed],0);
 }
});
