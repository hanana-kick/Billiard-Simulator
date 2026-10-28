// Independent native endpoint is EXPECTED ONLY. It never enters admission,
// owner initialWords, a candidate component, or the application plan.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {flatBalls} from '../src/browser-initial-import/initial-cloth.mjs';
import {exportCueJoints} from '../src/browser-initial-import/cue-joints.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallFirstHPlan,executeThreeBallFirstHForTest,assertThreeBallFirstHResult} from '../src/resident-candidate/three-ball-first-h.mjs';
import {decodeThreeBallFirstCueWordsForTest} from '../src/resident-candidate/three-ball-first-application.mjs';
import {decodeThreeBallRetainedTapeForTest} from '../src/resident-candidate/three-ball-retained-tape.mjs';
import {decodeSceneActivation} from '../src/resident-candidate/scene-activation.mjs';
import {unpackBvhState,BVH_LAYOUT as V} from '../src/resident-candidate/bvh.mjs';
import {decodeContactJournal,CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {decodeContactRoster,CONTACT_ROSTER_LAYOUT as R} from '../src/resident-candidate/contact-roster.mjs';
import {packFloorNarrow} from '../src/resident-candidate/narrowphase.mjs';
import Floor from '../src/experimental-world-lifecycle.js';
import {wordsNumber} from '../src/resident-candidate/source-number.mjs';
const root=path.resolve(import.meta.dirname,'..'),key=h=>h.index+':'+h.generation,copy=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex');
const floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
let tmp,data,seed,owner,plan,out,decoded,native,bodies,colliders;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-first-native-h-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-first-application-native-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json'))),decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 const admission=await admitThreeBallHost(decoder,data.raw);seed=await createThreeBallCreatedOwnerSeed(admission);owner=await packThreeBallCreatedOwnerTemplate(seed);
 plan=createThreeBallFirstHPlan(owner);const result=await executeThreeBallFirstHForTest(plan,{testOnly:true});assert.equal(result.available,true,JSON.stringify(Array.from(result.words.slice(plan.layout.control,plan.layout.control+8))));assertThreeBallFirstHResult(result,{plan});
 const d=plan.layout,w=result.words,tape=decodeThreeBallRetainedTapeForTest(plan.tape,w.slice(d.tape,d.tape+plan.tape.stateWords),{testOnly:true});
 // Every projection below decodes the actual candidate bank, after completion.
 // Immutable metadata comes only from authenticated t0, never native h1.
 out={...result,cue:decodeThreeBallFirstCueWordsForTest(plan.application,w,{testOnly:true}),history:tape.history,
 application:{time:wordsNumber(w.slice(d.applicationControl+20,d.applicationControl+22)),steps:wordsNumber(w.slice(d.applicationControl+18,d.applicationControl+20)),dt:seed.application.dt,events:tape.events,game:tape.game,cuePresent:w[d.cue+4]===1},
 postApplication:{scene:decodeSceneActivation(w,owner.registration.control.template)},physical:{bvh:unpackBvhState(w.slice(d.bvh,d.bvh+V.words)),journal:decodeContactJournal(w.slice(d.journal,d.journal+J.words))}};
 // Decode original h1 only AFTER candidate has completed from original t0.
 decoded=await decoder.decodeSnapshot(data.expected.snapshot);native=plain(decoded.state);
 const arena=a=>a.items.flatMap((slot,index)=>slot?.value?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
 bodies=arena(native.bodies.bodies);colliders=arena(native.colliders.colliders);
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('original observed inner-h provenance, unchanged outer bookkeeping and exact full application history',()=>{
 assert.equal(data.expected.sourceSnapshotSha256,hash(data.raw.snapshot));assert.equal(seed.initialSnapshotSha256,data.expected.sourceSnapshotSha256);assert.equal(data.expected.nativeWorldSteps,1);assert.equal(data.expected.completedInnerSubsteps,1);assert.equal(data.expected.completedOuterSteps,0);assert.equal(data.expected.latchedSubdivisions,64);
 const a=data.expected.after;for(const k of ['time','steps','dt','events','game','cuePresent'])assert.deepEqual(out.application[k],a[k],k);assert.deepEqual(a.outerObjects,data.expected.before.outerObjects);assert.equal(a.nativeDt,Math.fround(seed.application.dt/64));assert.deepEqual(data.expected.events,[]);
 assert.deepEqual(out.history.createdEvents,a.events);assert.equal(out.capability.nativeWholeHVerified,false);assert.equal(out.capability.wholeH,false);assert.equal(out.words[plan.layout.applicationControl+8],1);assert.equal(out.words[plan.layout.applicationControl+7],64);
});
test('all five actual native dynamic body poses, velocities, mass, inertia and force slots are exact',()=>{
 assert.equal(bodies.length,22);assert.equal(colliders.length,25);assert.equal(bodies.filter(b=>b.body_type==='Dynamic').length,5);
 for(const binding of owner.bindings.slice(0,5)){
  const b=bodies.find(b=>key(b.handle)===key(binding.body)),at=plan.layout.bodies+binding.canonicalIndex*64,i=b.mprops.effective_world_inv_inertia;
  for(const [label,offset,expected]of [['linear',0,b.vels.linvel],['angular',3,b.vels.angvel],['translation',6,b.pos.position.translation],['rotation',9,b.pos.position.rotation],['invMass',13,b.mprops.effective_inv_mass],['invInertia',16,[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33]],['force',47,b.forces.force],['worldCom',59,b.mprops.world_com]])assert.deepEqual(floats(out.words.subarray(at+offset,at+offset+expected.length)),expected,key(binding.body)+'.'+label);
 }
});
test('native scene manager, complete body activation/ids and modified-body queue match',()=>{
 const s=out.postApplication.scene;assert.deepEqual(s.manager,native.islands);assert.deepEqual(s.modifiedBodies,native.bodies.modified_bodies[0]);
 for(const row of s.bodies){const b=bodies.find(b=>key(b.handle)===key(row.handle));assert.ok(b);for(const field of ['changes','ids','activation'])assert.deepEqual(row[field],b[field],key(row.handle)+'.'+field);assert.equal(row.maxExtent,b.mprops.max_extent);}
});
test('native final broad tree and exact current contact-pair graph match',()=>{
 const b=copy(out.physical.bvh);delete b.deferred_optimize_pending;const expected=copy(native.broad_phase);delete expected.pairs;delete expected.pair_adjacency;assert.deepEqual(b,expected);
 const graph=native.narrow_phase.contact_graph.graph,edges=graph.edges.map(e=>{const p=e.weight;return{collider1:p.collider1,collider2:p.collider2,body1:colliders.find(c=>key(c.handle)===key(p.collider1)).parent.handle,body2:colliders.find(c=>key(c.handle)===key(p.collider2)).parent.handle,active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};});assert.deepEqual(out.physical.journal.state.edges,edges);assert.deepEqual(out.physical.journal.contactEvents,[]);
});
test('complete current native solver colors, hints, graph buckets and awake order match',()=>{
 const roster=decodeContactRoster(out.words.subarray(plan.layout.roster,plan.layout.roster+R.words),{initialSnapshotSha256:seed.initialSnapshotSha256,backend:'expected-native-comparison'}).snapshot,np=native.narrow_phase;
 assert.deepEqual(roster.bodySolverColorMasks,np.body_solver_color_masks.map(x=>BigInt(x).toString()));assert.deepEqual(roster.buckets,np.solver_contact_graph.buckets);
 assert.deepEqual(roster.pairs,np.contact_graph.graph.edges.map((e,i)=>{const r=e.weight.contacts.value;return{hint:np.pair_solver_hints[i],solverColor:r.solver_color,solverColorBodies:r.solver_color_bodies,manifolds:r.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:m.data.solver_body_ids,graphPos:m.data.graph_pos}))};}));
 for(const [k,field]of [['solverGraphValid','solver_graph_valid'],['solverGraphEpoch','solver_graph_epoch'],['solverGraphMultibodyEpoch','solver_graph_mb_epoch']])assert.deepEqual(roster[k],np[field],k);
 assert.equal(roster.activeSetEpoch,native.islands.active_set_epoch);const awake=native.islands.awake_island,rows=awake===null?[]:native.islands.islands.v[awake].bodies;assert.deepEqual(roster.awakeBodies,rows.map(body=>({body,activeSetId:bodies.find(b=>key(b.handle)===key(body)).ids.active_set_id})));
});
test('all native floor cache words plus original prepare sidecars match independently',async()=>{
 const roles={floor:seed.application.registry.statics.find(s=>s.kind==='cloth').body,...Object.fromEntries(seed.balls.map((b,i)=>['ball'+i,b.body]))},record={roles,objects:seed.application.registry.objects,endpoint:{integration:native.integration_parameters,colliders,bodies:Object.fromEntries(Object.entries(roles).map(([r,h])=>[r,bodies.find(b=>key(b.handle)===key(h))]))}};
 const floor=seed.application.registry.statics.find(s=>s.kind==='cloth').collider;
 for(const [i,b]of flatBalls(record,'endpoint',decoded,seed.application.dt/64).entries()){
  const pair=native.narrow_phase.contact_graph.graph.edges.map(e=>e.weight).find(p=>key(p.collider1)===key(floor)&&key(p.collider2)===key(b.collider)),m=pair.contacts.value.manifolds[0];b.state.localN1=copy(m.local_n1);b.state.topology.manifoldPresent=true;
  const want=packFloorNarrow(b.state);if(!seed.balls[i].state.sleeping){const token={},stage=Floor.createReferenceSettledContactStage(seed.balls[i].state);stage.claim(token);try{const prepared=await stage.prepare(copy(seed.balls[i].state),token);want[138]=+prepared.metadata.geometryRefreshed;want[139]=+prepared.metadata.oldActive;}finally{stage.abort(token);stage.release(token);stage.dispose();}}assert.deepEqual(out.words.slice(plan.layout.caches+i*144,plan.layout.caches+(i+1)*144),want,'all144 native payload + original source sidecars '+i);
 }
});
test('same-bank current cue/joints and final mass match independent native h1',async()=>{
 const number=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);},c=seed.application.cue;
 const exported=await exportCueJoints(decoded,Object.fromEntries(Object.entries({shaftBody:c.shaft,headBody:c.head,guideBody:c.guide,flex:c.flex,prismatic:c.prismatic}).map(([k,h])=>[k,number(h)])),D);
 for(let i=0;i<2;i++)for(const field of ['kind','handle','localFrame1','localFrame2','masks','limits','impulses','limitImpulses'])assert.deepEqual(out.cue.cue.joints[i][field],exported.joints[i][field],'joint '+i+' '+field);
 for(const [role,i]of [['shaft',0],['head',1]]){const nativeBody=exported.joints[0][i?'body2':'body1'];for(const field of ['localCom','worldCom','invMass','invInertia','principalFrame','invPrincipalInertia','userForce','userTorque'])assert.deepEqual(out.cue.cue[role][field],nativeBody[field],role+'.'+field);}
 const before=data.expected.before.cue,after=data.expected.after.cue;assert.deepEqual(after,before,'native no-contact application fields unchanged');assert.equal(out.cue.contacted,after.contacted);assert.equal(out.cue.active,after.contacts.length>0);assert.equal(out.cue.contactEpisodes,after.stats.contactEpisodes);assert.equal(out.cue.firstContact,after.stats.firstContact);assert.equal(out.cue.lastContact,after.stats.lastContact);
 assert.equal(out.words[plan.layout.applicationControl+9],1);assert.equal(out.words[plan.layout.massState+5],1);assert.equal(out.words[plan.layout.control+6],1);
});
