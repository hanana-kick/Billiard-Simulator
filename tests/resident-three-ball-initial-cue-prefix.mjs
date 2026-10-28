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
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),prefix=createThreeBallInitialCuePrefixPlan(owner),out=await executeThreeBallInitialCuePrefixForTest(prefix,{testOnly:true});fixtures.push({row,admission,seed,native,owner,prefix,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});


import {createThreeBallInitialCuePrefixPlan,executeThreeBallInitialCuePrefixForTest,assertThreeBallInitialCuePrefixPlan,assertThreeBallInitialCuePrefixBoundary,assertThreeBallInitialCuePrefixResult,threeBallInitialCuePrefixTestKernels,THREE_BALL_INITIAL_CUE_PREFIX_HEADER as H} from '../src/resident-candidate/three-ball-initial-cue-prefix.mjs';
import {CUE_LAYOUT as C} from '../src/resident-candidate/cue.mjs';

test('unchanged numerical source programs produce actual three-ball cue prefix, full current bodies, registration and clocks',t=>{
 for(const {row,seed,owner,prefix:p,out}of fixtures){assertThreeBallInitialCuePrefixPlan(p);assert.equal(assertThreeBallInitialCuePrefixBoundary(out.receipt,owner),out);assert.equal(assertThreeBallInitialCuePrefixResult(out,{template:owner}),out);assert.equal(out.capability.jointSolveDeferred,true);assert.equal(out.capability.sourceReferenceInput,false);assert.equal(out.capability.wholeH,false);assert.equal(out.words[p.layout.control+H.completed],1);assert.equal(out.words[p.layout.cue+C.header.needsSolve],1);assert.deepEqual(out.history,seed.history);
  const r=owner.segments.registration;assert.deepEqual(out.words.subarray(r.offset,r.offset+r.words),owner.initialWords.subarray(r.offset,r.offset+r.words),'scene registration region not silently advanced');assert.deepEqual(out.words.subarray(p.layout.bodies,p.layout.bodies+192),owner.initialWords.subarray(p.layout.bodies,p.layout.bodies+192),'only real cue body rows change');
  t.diagnostic(JSON.stringify({fixture:row.name,selected:seed.sourceOrigin.selectedIndex,otherCount:2,clock:out.clock,roles:seed.cueBroadSeed.roles,scope:'initial-numerical-cue-prefix-no-joint-solve'}));
 }
});
test('prefix rejects forged inputs, other template identity, mutation and physical/clock overrides',async()=>{
 const a=fixtures[0],p=a.prefix;assert.throws(()=>createThreeBallInitialCuePrefixPlan(copy(a.owner)));assert.throws(()=>createThreeBallInitialCuePrefixPlan(a.owner,{}));await assert.rejects(executeThreeBallInitialCuePrefixForTest(p));await assert.rejects(executeThreeBallInitialCuePrefixForTest(p,{testOnly:true,preSolveBodies:{}}));assert.throws(()=>assertThreeBallInitialCuePrefixBoundary(copy(a.out.receipt),a.owner));
 const other=await packThreeBallCreatedOwnerTemplate(a.seed);assert.throws(()=>assertThreeBallInitialCuePrefixBoundary(a.out.receipt,other));const at=p.layout.bodies+192,old=a.out.words[at];a.out.words[at]^=1;assert.throws(()=>assertThreeBallInitialCuePrefixBoundary(a.out.receipt,a.owner),/mutated/);a.out.words[at]=old;assertThreeBallInitialCuePrefixBoundary(a.out.receipt,a.owner);
 const bad=createThreeBallInitialCuePrefixPlan(a.owner);bad.program[0]++;assert.throws(()=>assertThreeBallInitialCuePrefixPlan(bad),/mutated/);
 assert.throws(()=>assertThreeBallInitialCuePrefixResult({...a.out},{template:a.owner}));assert.throws(()=>assertThreeBallInitialCuePrefixResult(a.out,{template:a.owner,expected:{}}));
});
test('distinct bridge rejects dummy fourth body, missing initialization, touch/removal and premature joint completion',()=>{
 const {prefix:p,out}=fixtures[0],d=p.layout;
 for(const mutate of[a=>a[d.control+H.ballCount]=4,a=>a[d.control+H.otherCount]=3,a=>a[d.cue+C.header.initialNumericMask]=3,a=>a[d.cue+C.header.needsSolve]=0,a=>a[d.cue+C.header.active]=1,a=>a[d.cue+C.header.present]=0,a=>a[d.cue+C.header.frame]=2]){
  const a=out.beforeBridge.slice();mutate(a);const bodies=a.slice(d.bodies,d.bodies+320);assert.equal(threeBallInitialCuePrefixTestKernels(p,a).rc_scene_three_prefix_bridge(d.control,d.cue,d.bodies),false);assert.deepEqual(a.slice(d.bodies,d.bodies+320),bodies);
 }
 const replay=out.words.slice();assert.equal(threeBallInitialCuePrefixTestKernels(p,replay).rc_scene_three_prefix_bridge(d.control,d.cue,d.bodies),false);
});
