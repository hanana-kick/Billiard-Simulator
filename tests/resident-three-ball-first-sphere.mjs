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
import {createThreeBallFirstSpherePlan,executeThreeBallFirstSphereForTest,assertThreeBallFirstSpherePlan,assertThreeBallInitialInactiveWhileCueReceipt,requireThreeBallAfterSphereWorldCommit,threeBallFirstSphereTestKernels,THREE_BALL_FIRST_SPHERE_HEADER as PH} from '../src/resident-candidate/three-ball-first-sphere.mjs';
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),numerical=createThreeBallFirstNumericalPlan(plan),cue=createThreeBallFirstCuePlan(numerical),sphere=createThreeBallFirstSpherePlan(cue),out=await executeThreeBallFirstSphereForTest(sphere,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,numerical,cue,sphere,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

test('actual cue-before-sphere numerical owner chain and all required inactive CCD predicates execute from original t0',t=>{
 for(const {row,seed,sphere:p,out}of fixtures){assertThreeBallFirstSpherePlan(p);assert.equal(out.capability.realSphereCount,3);assert.equal(out.capability.realCueDynamicCount,2);assert.equal(out.capability.worldCommits,0);assert.equal(out.capability.wholeH,false);
  assert.throws(()=>requireThreeBallAfterSphereWorldCommit(p),{code:'three-ball-first-sphere-world-commit-unavailable'});
  if(row.name==='selected-1'){assert.equal(out.available,false);assert.equal(out.reason,'current-cue-empty-manifold-owner-unavailable');assert.equal(out.receipt,undefined);continue;}
  assert.equal(out.available,true);assertThreeBallInitialInactiveWhileCueReceipt(out.receipt);assert.equal(out.receipt.generalCcdPass,false);assert.equal(out.receipt.worldCommitted,false);assert.deepEqual(out.history,seed.history);
  assert.equal(out.words[p.layout.sphereControl+PH.completed],1);assert.ok(out.post.every(c=>c.skippedSleeping||c.admitted&&!c.active));
  t.diagnostic(JSON.stringify({fixture:row.name,awakeSpheres:out.cue.numerical.gathered.bodyCount,contacts:out.cue.numerical.gathered.contactCount,cuePostChecks:out.cue.checks.length,spherePostChecks:out.post.filter(c=>!c.skippedSleeping).length,scope:'all-body-numerical-CCD-phase-not-world-commit'}));
 }
});
test('no external body, timestep, result, forged receipt or mutated completed draft can become inactive authority',async()=>{
 const a=fixtures.find(f=>f.out.available),p=a.sphere;assert.throws(()=>createThreeBallFirstSpherePlan(copy(a.cue)));assert.throws(()=>createThreeBallFirstSpherePlan(a.cue,{}));
 await assert.rejects(executeThreeBallFirstSphereForTest(p));await assert.rejects(executeThreeBallFirstSphereForTest(p,{testOnly:true,dt:1}));
 assert.throws(()=>assertThreeBallInitialInactiveWhileCueReceipt(copy(a.out.receipt)));assert.throws(()=>assertThreeBallInitialInactiveWhileCueReceipt({kind:'source-ccd-pass-capability'}));
 const old=a.out.words[p.layout.bodies];a.out.words[p.layout.bodies]^=1;assert.throws(()=>assertThreeBallInitialInactiveWhileCueReceipt(a.out.receipt),/mutated/);a.out.words[p.layout.bodies]=old;assertThreeBallInitialInactiveWhileCueReceipt(a.out.receipt);
 const bad=createThreeBallFirstSpherePlan(a.cue);bad.programs.coupled[0]++;assert.throws(()=>assertThreeBallFirstSpherePlan(bad),/mutated/);
});
test('sphere solve cannot begin before cue completion or with changed original dt, three-body roster or generations',()=>{
 const {sphere:p,out}=fixtures.find(f=>f.out.available&&f.out.cue.numerical.gathered.bodyCount===3),d=p.layout;
 for(const change of[a=>a[d.cueControl+CH.completed]=0,a=>a[d.coupled]++,a=>a[d.solver+2]=4,a=>a[d.sphereControl+17]++,a=>a[d.journal+J.header.sequence]++]){
  const a=out.beforeSolve.slice();a[d.sphereControl+PH.phase]=0;change(a);const bodies=a.slice(d.bodies,d.bodies+320);assert.equal(threeBallFirstSphereTestKernels(p,a).rc_scene_three_sphere_begin(0,d.journal,d.cueControl,d.solver,d.sphereControl,d.coupled),false);assert.deepEqual(a.slice(d.bodies,d.bodies+320),bodies);
 }
});
test('missing, active, unsupported and stale post-predicates cannot yield completion even with solved body words',()=>{
 const {sphere:p,out}=fixtures.find(f=>f.out.available&&f.out.cue.numerical.gathered.bodyCount===3),d=p.layout;
 for(const kind of ['missing','active','angle','epoch','replay']){
  const a=out.words.slice();a[d.sphereControl+PH.completed]=0;a[d.sphereControl+PH.phase]=1;a[d.sphereControl+PH.postMask]=kind==='replay'?1:0;
  if(kind==='active')a[d.sphereCcdOutputs+17]=0x3f800000;if(kind==='angle')a[d.sphereCcdOutputs+18]=0;if(kind==='epoch')a[S.header.epoch]++;
  const k=threeBallFirstSphereTestKernels(p,a);if(kind!=='missing')assert.equal(k.rc_scene_three_sphere_post_finish(0,d.sphereControl,d.sphereCcdOutputs,0),false,kind);
  assert.equal(k.rc_scene_three_sphere_complete(0,d.journal,d.solver,d.sphereControl),false,kind);assert.equal(a[d.sphereControl+PH.completed],0,kind);
 }
});
