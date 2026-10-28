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
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),out=await executeThreeBallFirstSceneForTest(plan,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

const sceneView=s=>Object.fromEntries(['phase','sourceRevision','roles','manager','bodies','modifiedBodies','consumedModifiedBodies'].map(k=>[k,s[k]]));
test('authentic original-js-number application, deferred joint solve and current branded collision receipts feed the distinct scene step',t=>{
 for(const {plan,out,seed,row}of fixtures){
  assertThreeBallFirstScenePlan(plan);assert.equal(out.preparation.numberProfile,'original-js-number-v1');assert.equal(out.preparation.jointSolved,false);assert.equal(out.preparation.sourceH,seed.application.dt/seed.application.strokeSubsteps);
  assert.equal(out.preparation.initialTime,seed.application.time);assert.equal(out.preparation.pendingApplicationTime,seed.application.time+out.preparation.sourceH);
  assert.equal(out.preparation.exclusion.admitted,true);assert.equal(out.preparation.exclusion.pairs,54);assert.equal(out.preparation.sourceGeometryOnly,true);
  assert.equal(out.capability.nativeRegistrationBoundaryVerified,false);assert.equal(out.capability.nativeFirstCollisionBoundaryVerified,false);assert.equal(out.capability.numericalEnergyEvaluated,false);assert.equal(out.capability.physicalSteps,0);assert.equal(out.capability.wholeH,false);
  assert.deepEqual(out.history,seed.history);assert.equal(out.words[plan.layout.bridge+L.header.completed],1);assert.equal(out.words[S.header.phase],2);assert.equal(out.words[S.header.sourcePhase],2);assert.equal(out.words[S.header.incidenceValid],1);
  assert.equal(out.words[S.header.bodySlots],22);assert.equal(out.words[plan.layout.initialization+I.header.colliderCount],25);assert.equal(out.words[plan.layout.journal+J.header.colliders],25);
  assert.doesNotMatch(plan.code,/fn rc_scene_world_first_collision|rc_num_eval|fn rc_scene_begin_energy/);
  assert.match(plan.code,/fn rc_scene_three_first_collision/);assert.match(plan.code,/rc_scene_incidence_from_journal/);
  const generic=generateSceneActivationWGSL().match(/fn rc_scene_incidence_from_journal\([\s\S]*?\n\}/)[0];assert.ok(plan.code.includes(generic),'unchanged generic emitted scene incidence function');
  t.diagnostic(JSON.stringify({fixture:row.name,newInactiveCueEdges:out.sourceExpected.journal.changes.length,sourceNumberProfile:out.preparation.numberProfile,nativeInternalBoundaryVerified:false}));
 }
});
test('complete registration-to-first-collision manager, flags, queues, joints and scene equal the established genuine-three source owners',()=>{
 for(const {plan,out,seed}of fixtures){
  assert.deepEqual(out.initialized,out.sourceExpected.initialized,'full initialized body/raw/collider/manager/queue/joint-event object');
  assert.deepEqual(sceneView(out.scene),sceneView(out.sourceExpected.scene),'complete mutable scene context, not count-only');
  assert.equal(out.scene.bodies.length,22);assert.equal(out.scene.bodies.filter(b=>b.type==='Dynamic').length,5);assert.deepEqual(out.scene.manager.persistent.removal_journal,[]);
  const cue=out.scene.manager.persistent.islands.v.filter(x=>x?.joint_links.length);assert.equal(cue.length,1);assert.equal(cue[0].joint_links.length,2);assert.equal(cue[0].constraint_remove_count,2);
  assert.equal(out.words[S.header.removalCount],0);assert.equal(out.words[S.header.consumedCount],3,'finish boundary retains consumed queue until scene frame application');
  assert.equal(out.words[S.header.scan],out.beforeCollision[S.header.scan],'no energy scan advance');assert.equal(out.words[S.header.epoch],out.beforeCollision[S.header.epoch]);
  const a=plan.template.segments.bodies;assert.deepEqual(out.words.slice(a.offset,a.offset+a.words),out.beforeCollision.slice(a.offset,a.offset+a.words),'scene does not mutate admitted current canonical bodies');
  for(const c of out.initialized.consumedModifiedColliders)assert.equal(out.initialized.colliders.find(x=>key(x.handle)===key(c)).changes,0);
  const j=out.sourceExpected.journal;assert.equal(j.operations.length,0);assert.equal(j.contactEvents.length,0);assert.equal(j.before.edges.length,3);assert.ok(j.changes.every(c=>c.kind==='append'&&!c.edge.active));
  assert.deepEqual(seed.admission.native.bodyOrder,seed.nativeBodies.map(b=>b.handle));
 }
});
test('first-collision kernel fails closed on wrong roster, generations, active/new noncue contacts, future clocks and replay',()=>{
 const {plan,out}=fixtures[0],{initialization:i,journal:j,bridge:b}=plan.layout;
 const cases={fourthFloor:a=>a[b+L.header.initialCount]=4,missingBody:a=>a[S.header.bodySlots]=21,missingDynamic:a=>a[b+L.header.dynamics]=4,missingNumeric:a=>a[i+I.header.numericReady]=3,
  futureSequence:a=>a[j+J.header.fromSequence]=1,wrongRevision:a=>a[j+J.header.revision]=2,forgedCueTag:a=>a[j+J.colliderOffset+J.collider.cue]=1,wrongBodyQueue:a=>a[S.consumedOffset]=0,activeNewCue:a=>a[j+J.changeOffset+J.change.newActive]=1,wrongGeneration:a=>a[j+J.colliderOffset+1]++,noncueAppend:a=>{const p=j+J.changeOffset;a[p+J.change.collider1Slot]=0;a[p+J.change.collider2Slot]=16;},operations:a=>a[j+J.header.operations]=1,wrongCreationQueue:a=>a[i+I.header.consumedColliderCount]=2};
 for(const [name,change]of Object.entries(cases)){const a=out.beforeCollision.slice();change(a);assert.equal(threeBallFirstSceneTestKernels(a).rc_scene_three_first_collision(0,i,j,b),false,name);assert.equal(a[b+L.header.status],4,name);}
 assert.equal(threeBallFirstSceneTestKernels(out.words.slice()).rc_scene_three_first_collision(0,i,j,b),false,'already consumed boundary cannot replay');
});
test('public execution accepts only its sealed original plan and explicit test flag, never caller collision/future data',async()=>{
 const {owner,plan}=fixtures[0];assert.throws(()=>createThreeBallFirstScenePlan(copy(owner)));assert.throws(()=>createThreeBallFirstScenePlan(owner,{future:[]}));
 await assert.rejects(executeThreeBallFirstSceneForTest(plan));await assert.rejects(executeThreeBallFirstSceneForTest(plan,{testOnly:true,journal:[]}));await assert.rejects(executeThreeBallFirstSceneForTest(copy(plan),{testOnly:true}));
 const bad=createThreeBallFirstScenePlan(owner);bad.initialWords[bad.layout.bridge]++;assert.throws(()=>assertThreeBallFirstScenePlan(bad),/mutated/);
 const detached=createThreeBallFirstScenePlan(owner);structuredClone(detached.initialWords.buffer,{transfer:[detached.initialWords.buffer]});assert.throws(()=>assertThreeBallFirstScenePlan(detached),/detached/);
 assert.equal(globalThis.RAPIER,undefined);assert.equal(globalThis.PhysicsLab,undefined);
});

test('pre-existing four-ball scene gates and generated bytes remain unchanged from d1be2a3',()=>{
 const expected={activation:'6563bcf5be0ed2877c60d7f7a3ef9ebf71f7a6e1c689b0825176fc07299734a8',initialization:'a84a5bfca1dbc688986834f931cbdf58f4b032c0b06db2d6f158b8752149bb05',world:'9f7a4465c20e33a8a73928cceff5e045d47f1fdc10d64f7bdfc1b9b9c987a0c0'};
 for(const [name,text]of Object.entries({activation:generateSceneActivationWGSL(),initialization:generateSceneInitializationWGSL(),world:generateSceneWorldWGSL()}))assert.equal(createHash('sha256').update(text).digest('hex'),expected[name],name+' emitted source bytes');
 const {owner,seed}=fixtures[0];assert.throws(()=>encodeSceneWorld(owner.registration.control.template,{bodyBindings:owner.bindings.slice(0,5).map(b=>({handle:b.body,canonicalIndex:b.canonicalIndex})),gravity:seed.balls[0].state.gravity,lengthUnit:seed.balls[0].state.lengthUnit,initialEdges:seed.contactGraphSeed.edges}),/four original registered cloth edges/);
});
