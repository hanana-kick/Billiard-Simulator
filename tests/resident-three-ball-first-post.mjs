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
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),numerical=createThreeBallFirstNumericalPlan(plan),cue=createThreeBallFirstCuePlan(numerical),sphere=createThreeBallFirstSpherePlan(cue),postPlan=createThreeBallFirstPostPlan(sphere),out=await executeThreeBallFirstPostForTest(postPlan,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,numerical,cue,sphere,postPlan,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});


import {createThreeBallFirstPostPlan,executeThreeBallFirstPostForTest,executeThreeBallFirstPostPhysicalForTest,assertThreeBallFirstPostPhysicalReceipt,assertThreeBallFirstPostPhysicalResult,assertThreeBallFirstPostPlan,threeBallFirstPostTestKernels,THREE_BALL_FIRST_POST_HEADER as AH,requireThreeBallFirstPostWorldCommit} from '../src/resident-candidate/three-ball-first-post.mjs';
import {createApplicationPrograms} from '../src/resident-candidate/application.mjs';
import {executeSourceNumberProgramReference} from '../src/resident-candidate/raw-strike.mjs';
import {wordsNumber,numberWords} from '../src/resident-candidate/source-number.mjs';
import {executeLowered} from '../src/resident-candidate/numeric-program.mjs';
import Patch from '../src/experimental-angular-patch.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/physics.js');
const f=Math.fround,asVec=a=>({x:a[0],y:a[1],z:a[2]}),array=v=>[v.x,v.y,v.z],bits=a=>Array.from(new Uint32Array(Float32Array.from(a).buffer));

test('authentic initial post-fat → sphere CCD → original Number patch → complete scene mutation queue',t=>{
 for(const {row,seed,postPlan:p,out}of fixtures){assertThreeBallFirstPostPlan(p);assert.equal(out.capability.collisionInputBackend,'owned-host-source-component-test-only');assert.equal(out.capability.wholeH,false);assert.equal(out.capability.worldCommits,0);assert.throws(()=>requireThreeBallFirstPostWorldCommit(p),{code:'three-ball-first-post-world-commit-unavailable'});
  if(row.name==='selected-1'){assert.equal(out.available,false);assert.equal(out.reason,'current-cue-empty-manifold-owner-unavailable');continue;}
  assert.equal(out.available,true);assert.equal(out.words[p.layout.postControl+AH.completed],1);assert.equal(out.words[S.header.phase],3);assertThreeBallInitialInactiveWhileCueReceipt(out.receipt);assert.deepEqual(out.history,seed.history);
  t.diagnostic(JSON.stringify({fixture:row.name,awake:out.cue.numerical.gathered.bodyCount,postFatMask:out.words[p.layout.postControl+AH.fatMask],modified:out.postApplication.scene.modifiedBodies,scope:'post-application-queue-not-BVH-journal-world-commit'}));
 }
});
test('post adapter rejects forged plans, altered h/programs and supplied future state',async()=>{
 const a=fixtures.find(x=>x.out.available),p=a.postPlan;assert.throws(()=>createThreeBallFirstPostPlan(copy(a.sphere)));assert.throws(()=>createThreeBallFirstPostPlan(a.sphere,{}));await assert.rejects(executeThreeBallFirstPostForTest(p,{testOnly:true,post:{}}));
 const bad=createThreeBallFirstPostPlan(a.sphere);bad.initialWords[bad.layout.postControl+AH.sourceH]++;assert.throws(()=>assertThreeBallFirstPostPlan(bad),/mutated/);const program=createThreeBallFirstPostPlan(a.sphere);program.programs.angular[0]++;assert.throws(()=>assertThreeBallFirstPostPlan(program),/mutated/);
});
test('source fat/CCD/patch phase ordering is mandatory before queue publication',()=>{
 const {postPlan:p,out}=fixtures.find(x=>x.out.available&&x.out.cue.numerical.gathered.bodyCount===3),d=p.layout;
 for(const change of [a=>a[d.sphereControl+PH.postMask]=0,a=>a[d.postControl+AH.fatMask]=0,a=>a[d.patchOutputs+38]=0,a=>a[d.postControl+AH.cursor]=1,a=>a[S.header.epoch]++]){
  const a=out.words.slice();a[S.header.phase]=6;a[d.postControl+AH.phase]=1;a[d.postControl+AH.completed]=0;a[d.postControl+AH.cursor]=0;change(a);const before=a.slice(d.bodies,d.bodies+320);assert.equal(threeBallFirstPostTestKernels(p,a).rc_scene_three_post_patch(0,d.sphereControl,d.postControl,d.bodies,d.patchOutputs,0),false);assert.deepEqual(a.slice(d.bodies,d.bodies+320),before);
 }
 const early=out.beforeSolve.slice();assert.equal(threeBallFirstPostTestKernels(p,early).rc_scene_three_post_complete(0,d.sphereControl,d.postControl),false);
});
test('sealed physical-only boundary completes every dynamic CCD/fat before any application queue or patch',async()=>{
 for(const {postPlan:p,row}of fixtures){const out=await executeThreeBallFirstPostPhysicalForTest(p,{testOnly:true});if(row.name==='selected-1'){assert.equal(out.available,false);assert.equal(out.physicalReceipt,undefined);continue;}
  assertThreeBallFirstPostPhysicalResult(out,{plan:p});assertThreeBallFirstPostPhysicalReceipt(out.physicalReceipt,{plan:p});const d=p.layout,a=out.words;assert.equal(a[S.header.phase],6);assert.equal(a[d.sphereControl+PH.completed],1);assert.equal(a[d.postControl+AH.cursor],0);assert.equal(a[d.postControl+AH.patchMask],0);assert.equal(a[d.postControl+AH.completed],0);assert.equal(a[d.postControl+AH.fatMask],a[d.postControl+AH.requiredMask]);assert.equal(out.postApplication,undefined);assert.equal(out.capability.applicationNotStarted,true);
  assert.throws(()=>assertThreeBallFirstPostPhysicalResult({...out},{plan:p}));const at=d.bodies+3,old=a[at];a[at]^=1;assert.throws(()=>assertThreeBallFirstPostPhysicalReceipt(out.physicalReceipt,{plan:p}),/mutated/);a[at]=old;assertThreeBallFirstPostPhysicalReceipt(out.physicalReceipt,{plan:p});
  if(a[d.postControl+AH.requiredMask]!==0){const bad=a.slice();bad[d.sphereControl+PH.completed]=0;assert.equal(threeBallFirstPostTestKernels(p,bad).rc_scene_three_post_patch(0,d.sphereControl,d.postControl,d.bodies,d.patchOutputs,0),false);}
 }
});

test('component-only nonzero spin/roll witness uses direct original PhysicsLab and native zero-step torque application',async()=>{
 await R.init();const programs=createApplicationPrograms();let cases=0;
 for(const angular of [[10,20,-30],[1e-5,-1e-5,2e-5],[0,20,0],[10,0,-30]]){
  const world=new R.World({x:0,y:0,z:0});try{
   world.step=()=>assert.fail('No physical trajectory/step belongs to this component witness');const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setAngvel(asVec(angular))),collider=world.createCollider(R.ColliderDesc.ball(.03075).setMass(.210),body);body.recomputeMassPropertiesFromColliders();
   const m=body.effectiveWorldInvInertia(),inertia=[m.m11,m.m12,m.m13,m.m22,m.m23,m.m33],before=array(body.angvel()),impulses=[f(.002)],normal=[0,1,0],h=1/960/64,torques=[];
   const proxy={isSleeping:()=>body.isSleeping(),linvel:()=>body.linvel(),angvel:()=>body.angvel(),applyTorqueImpulse(v,wake){assert.equal(wake,false);torques.push(array(v));body.applyTorqueImpulse(v,wake);}};
   const other={handle:123},lab={dt:1/960,params:{gravity:9.81,rollingLength:.00045,spinLength:.00035},objects:[{shape:'sphere',body:proxy,collider,mass:.210,radius:.03075}],byCollider:new Map([[123,{kind:'cloth'}]]),world:{contactPairsWith(c,cb){assert.equal(c,collider);cb(other);},contactPair(c,o,cb){assert.equal(c,collider);assert.equal(o,other);cb({normal:()=>asVec(normal),numContacts:()=>1,contactImpulse:()=>impulses[0]},false);}}};
   globalThis.PhysicsLab.prototype.angularPatchResistance.call(lab,h);assert.equal(torques.length,1);
   const input={kind:'ordered-single-manifold-angular-patch',phase:'post-world-step-pre-angular-patch',bodyType:'dynamic',sleeping:false,isSphere:true,materialKind:'cloth',normal,angular:before,linear:[0,0,0],invInertia:inertia,impulses,mass:.210,radius:.03075,gravity:9.81,h,rollingLength:.00045,spinLength:.00035},source=Patch.sourceReference(input),args=[1,...normal,...before,0,.210,.03075,9.81,h,.00045,.00035,1,...impulses,...Array(31).fill(0)],out=executeSourceNumberProgramReference(programs.entries.angular.compiled,args);assert.equal(out.done,true);
   const torque=[0,1,2].map(j=>wordsNumber(out.raw.subarray(2+j*2,4+j*2)));assert.deepEqual(torque.flatMap(x=>Array.from(numberWords(x))),torques[0].flatMap(x=>Array.from(numberWords(x))),'exact original binary64 torque');assert.deepEqual(source.torque,torques[0]);
   const q=torque.map(f),native=Array.from(executeLowered(programs.entries.native.compiled,Float32Array.from([...before,...inertia,...q]),{testOnly:true}));assert.deepEqual(bits(native),bits(array(body.angvel())),'actual native f32 application');assert.deepEqual(bits(source.angular),bits(native));cases++;
  }finally{world.free();}
 }
 assert.equal(cases,4);
});
