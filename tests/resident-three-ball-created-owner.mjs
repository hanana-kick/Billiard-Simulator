import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed,assertThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate,assertThreeBallCreatedOwnerTemplate,requireThreeBallOneHOwner,THREE_BALL_ONE_H_MISSING_LINKS} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {decodeContactRoster} from '../src/resident-candidate/contact-roster.mjs';
import {decodeContactJournal} from '../src/resident-candidate/contact-journal.mjs';
import {unpackBvhState} from '../src/resident-candidate/bvh.mjs';
import {WORLD_BROAD_LAYOUT as B} from '../src/resident-candidate/world-broad.mjs';
import Guard from '../src/experimental-cue-rigid-exclusion.js';
import {compileGraph} from '../src/resident-candidate/numeric-program.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,key=h=>h.index+':'+h.generation;
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const plan=await packThreeBallCreatedOwnerTemplate(seed);fixtures.push({row,admission,seed,native,plan});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('authentic created native state, 22-body real solver roster, full warmstarts and genuine 18-row geometry catalog',()=>{
 for(const {seed,native,admission}of fixtures){
  assertThreeBallCreatedOwnerSeed(seed);assert.deepEqual(seed.nativeInitial,native);assert.equal(seed.balls.length,3);assert.equal(seed.nativeBodies.length,22);assert.equal(seed.nativeColliders.length,25);
  assert.equal(seed.solverContactRoster.bodies.length,22);assert.notEqual(seed.solverContactRoster,true);assert.equal(seed.solverContactRoster.bodies.filter(b=>b.type==='Dynamic').length,5);
  const r=seed.solverContactRoster,np=native.narrow_phase;
  assert.deepEqual(r.bodySolverColorMasks,np.body_solver_color_masks.map(x=>BigInt(x).toString()));assert.deepEqual(r.buckets,np.solver_contact_graph.buckets);
  assert.deepEqual(r.pairs.map(p=>p.hint),np.pair_solver_hints);assert.deepEqual(r.pairs.map(p=>p.solverColorBodies),np.contact_graph.graph.edges.map(e=>e.weight.contacts.value.solver_color_bodies));
  assert.deepEqual(r.pairs.map(p=>p.manifolds),np.contact_graph.graph.edges.map(e=>e.weight.contacts.value.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:m.data.solver_body_ids,graphPos:m.data.graph_pos}))));
  const awake=native.islands.awake_island;assert.deepEqual(r.awakeBodies,awake===null?[]:native.islands.islands.v[awake].bodies.map(body=>({body,activeSetId:native.bodies.bodies.items[body.index].value.ids.active_set_id})));
  assert.deepEqual(seed.geometryCatalog.map(x=>x.kind),[...Array(3).fill('floor'),...Array(3).fill('pair'),...Array(12).fill('cushion')]);
  const existing=seed.geometryCatalog.filter(c=>c.edgeId!==null);assert.equal(existing.length,np.contact_graph.graph.edges.length);
  for(const c of existing){const pair=np.contact_graph.graph.edges[c.edgeId].weight;assert.deepEqual(c.cache.sourcePair,pair);assert.deepEqual(c.collider1,pair.collider1);assert.deepEqual(c.collider2,pair.collider2);assert.equal(c.cache.pairSolverHint,np.pair_solver_hints[c.edgeId]);}
  for(const c of seed.geometryCatalog.filter(c=>c.edgeId===null))assert.deepEqual(c.cache,{pairPresent:0,pointPresent:0,active:0,recycleValid:0,solverColor:255});
  assert.deepEqual(seed.history,admission.history);assert.deepEqual(seed.game,admission.gameCreated);assert.equal(seed.capability.wholeH,false);assert.equal(seed.capability.nativeRegistrationBoundaryVerified,false);
  const cueHandles=seed.contactGraphSeed.cueColliders,objects=seed.application.registry.objects,order=[...seed.application.registry.statics.map(s=>s.collider),...objects.flatMap(o=>[o.collider,o.pairCollider])];
  const expected=[];for(const c of seed.nativeColliders.filter(c=>cueHandles.some(h=>key(h)===key(c.handle))))for(const h of order){const o=seed.nativeColliders.find(o=>key(o.handle)===key(h)),a=c.flags.collision_groups,b=o.flags.collision_groups;if((a.memberships&b.filter)&&(b.memberships&a.filter))expected.push({cueCollider:c.handle,obstacleCollider:o.handle});}
  assert.deepEqual(seed.cueGuard.pairs.map(({initialInputs,...p})=>p),expected);assert.equal(expected.length,54);assert.equal(seed.cueGuard.contactDecisionAvailable,false);
  assert.equal(seed.cueEmptyConvexHulls.length,8);assert.equal(seed.geometryCatalog.filter(x=>x.kind==='cushion').every(x=>x.hull.points.length>0),true);
  assert.deepEqual(seed.bodyColliderOrder,seed.nativeBodies.map(b=>({body:b.handle,colliders:b.colliders})));
 }
});
test('private owner provenance rejects copies, altered projections, boolean roster and future-shaped inputs',async()=>{
 const {admission,seed}=fixtures[0];assert.throws(()=>assertThreeBallCreatedOwnerSeed(copy(seed)));await assert.rejects(createThreeBallCreatedOwnerSeed(copy(admission)));await assert.rejects(createThreeBallCreatedOwnerSeed(admission,{future:[]}));
 for(const fake of [copy(seed),{...seed,solverContactRoster:true},{...seed,boundary:'post-first-h'}])assert.throws(()=>assertThreeBallCreatedOwnerSeed(fake));
 assert.throws(()=>{seed.solverContactRoster.bodySolverColorMasks[0]='0';},TypeError);assert.throws(()=>{seed.nativeInitial.islands.active_set_epoch++;},TypeError);
 assert.equal(globalThis.RAPIER,undefined);assert.equal(globalThis.PhysicsLab,undefined);
});
test('immutable ready-world after-turn input retains actual recycled cue generations and complete history',t=>{
 const f=fixtures.find(x=>x.row.name==='immutable-after-turn');if(!f){t.skip('immutable historical capture prefix not supplied');return;}
 const {seed,admission}=f;assert.deepEqual(['shaft','head','guide'].map(k=>seed.cueBroadSeed.roles[k]),[{index:21,generation:3},{index:19,generation:3},{index:20,generation:3}]);
 assert.deepEqual(seed.contactGraphSeed.cueColliders,[{index:22,generation:3},{index:24,generation:3},{index:23,generation:3}]);
 assert.deepEqual(seed.nativeBodies.map(b=>b.handle),admission.native.bodyOrder);assert.equal(seed.history.createdEvents.length,8);
 assert.deepEqual(seed.history.createdEvents,seed.application.events);assert.equal(new Set(seed.solverContactRoster.bodies.map(b=>key(b.handle))).size,22);
});

test('sealed actual 3+2 owner bank roundtrips native BVH, full contact roster/journal, body and cue identities',()=>{
 for(const {plan,seed,native}of fixtures){
  assertThreeBallCreatedOwnerTemplate(plan);const read=name=>{const s=plan.segments[name];return plan.initialWords.slice(s.offset,s.offset+s.words);};
  assert.equal(plan.segments.bodies.words,320);assert.deepEqual(plan.bindings.map(b=>b.canonicalIndex),[0,1,2,3,4,null]);
  assert.deepEqual(plan.bindings.slice(0,3).map(b=>b.body),seed.balls.map(b=>b.body));assert.deepEqual(plan.bindings.slice(3).map(b=>b.body),['shaft','head','guide'].map(k=>seed.cueBroadSeed.roles[k]));
  assert.deepEqual(read('registration'),plan.registration.initialWords);assert.deepEqual(unpackBvhState(read('bvh')),plan.sourceBvhInitial);const {deferred_optimize_pending,...serialized}=plan.sourceBvhInitial;assert.equal(deferred_optimize_pending,false);assert.deepEqual({...serialized,pairs:plan.nativeBroadPairs,pair_adjacency:plan.nativeBroadAdjacency},native.broad_phase);
  const roster=decodeContactRoster(read('roster'),{initialSnapshotSha256:seed.initialSnapshotSha256,backend:'host-initial-only'}).snapshot;delete roster.backend;assert.deepEqual(roster,seed.solverContactRoster);
  const journal=decodeContactJournal(read('journal'));assert.deepEqual(journal.state.edges,seed.contactGraphSeed.edges);assert.deepEqual(journal.state.adjacency,seed.contactGraphSeed.adjacency);assert.deepEqual(journal.state.liveColliders,seed.contactGraphSeed.colliders.map(c=>c.handle));
  const broad=read('broad');assert.equal(broad[B.header.colliders],25);assert.equal(broad[B.header.bodies],6);assert.deepEqual(Array.from(broad.slice(B.freshOffset,B.freshOffset+3)),seed.cueBroadSeed.modifiedColliders.map(h=>seed.nativeColliders.findIndex(c=>key(c.handle)===key(h))));
  const bodyFloats=new Float32Array(read('bodies').buffer);for(const [i,binding]of plan.bindings.slice(0,5).entries()){
   const b=seed.nativeBodies.find(b=>key(b.handle)===key(binding.body)),f=Array.from(bodyFloats.slice(i*64,(i+1)*64));
   assert.deepEqual(f.slice(0,3),b.vels.linvel);assert.deepEqual(f.slice(3,6),b.vels.angvel);assert.deepEqual(f.slice(6,9),b.pos.position.translation);assert.deepEqual(f.slice(9,13),b.pos.position.rotation);
   assert.deepEqual(f.slice(13,16),b.mprops.effective_inv_mass);const m=b.mprops.effective_world_inv_inertia;assert.deepEqual(f.slice(16,25),[m.m11,m.m12,m.m13,m.m12,m.m22,m.m23,m.m13,m.m23,m.m33]);
   if(i>=3){assert.deepEqual(f.slice(56,59),b.mprops.local_mprops.local_com);assert.deepEqual(f.slice(59,62),b.mprops.world_com);assert.equal(f[62],0);assert.equal(f[63],b.ccd.ccd_thickness);}
  }
  const cue=read('cue');assert.deepEqual(cue.slice(20,22),Uint32Array.from(numberWords(seed.application.time)));assert.deepEqual(cue.slice(24,26),Uint32Array.from(numberWords(seed.application.dt/seed.application.strokeSubsteps)));
  assert.deepEqual(read('cueGuardInputs'),new Uint32Array(Float32Array.from(seed.cueGuard.pairs.flatMap(p=>p.initialInputs)).buffer));assert.deepEqual(plan.programs.cueGuard,compileGraph(Guard.buildPlan()).program);assert.equal(plan.counts.cueFilterPairs,54);
  assert.equal(plan.counts.sphereGeometryRows,18);assert.equal(plan.capability.completeOneHSourcePlan,false);assert.equal(plan.capability.preCollisionOnly,true);
  assert.throws(()=>requireThreeBallOneHOwner(plan),e=>e.code==='three-ball-one-h-owner-unavailable'&&e.missingLinks===THREE_BALL_ONE_H_MISSING_LINKS);
 }
});
test('copied, mutated and detached banks cannot become source owners or numerical misses',async()=>{
 const {plan,seed}=fixtures[0];await assert.rejects(packThreeBallCreatedOwnerTemplate(copy(seed)));await assert.rejects(packThreeBallCreatedOwnerTemplate(seed,{solverContactRoster:true}));assert.throws(()=>assertThreeBallCreatedOwnerTemplate(copy(plan)));
 const bad=await packThreeBallCreatedOwnerTemplate(seed);bad.initialWords[bad.segments.bodies.offset]^=1;assert.throws(()=>requireThreeBallOneHOwner(bad),e=>e.code==='three-ball-created-owner-contract');
 const detached=await packThreeBallCreatedOwnerTemplate(seed);structuredClone(detached.programs.broad.buffer,{transfer:[detached.programs.broad.buffer]});assert.throws(()=>assertThreeBallCreatedOwnerTemplate(detached),/detached/);
});
