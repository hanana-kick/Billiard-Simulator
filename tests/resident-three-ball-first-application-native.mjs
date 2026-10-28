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
import {createThreeBallFirstScenePlan} from '../src/resident-candidate/three-ball-scene-first-collision.mjs';
import {createThreeBallFirstNumericalPlan} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {createThreeBallFirstCuePlan} from '../src/resident-candidate/three-ball-first-cue.mjs';
import {createThreeBallFirstSpherePlan} from '../src/resident-candidate/three-ball-first-sphere.mjs';
import {createThreeBallFirstPostPlan} from '../src/resident-candidate/three-ball-first-post.mjs';
import {createThreeBallFirstPhysicalBroadPostPlan,createThreeBallFirstFinalMassBroadPostPlan} from '../src/resident-candidate/three-ball-first-broad-post.mjs';
import {createThreeBallFirstApplicationPlan,createThreeBallFirstFinalMassApplicationPlan,executeThreeBallFirstApplicationForTest,assertThreeBallFirstApplicationResult,threeBallFirstApplicationTestKernels,THREE_BALL_FIRST_APPLICATION_HEADER as A} from '../src/resident-candidate/three-ball-first-application.mjs';
import {packFloorNarrow} from '../src/resident-candidate/narrowphase.mjs';
import {decodeContactRoster,CONTACT_ROSTER_LAYOUT as R} from '../src/resident-candidate/contact-roster.mjs';
import {createThreeBallFirstFinalMassPlan,assertThreeBallFirstFinalMassPlan,executeThreeBallFirstFinalMassWordsForTest} from '../src/resident-candidate/three-ball-first-final-mass.mjs';
const root=path.resolve(import.meta.dirname,'..'),key=h=>h.index+':'+h.generation,copy=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex');
const floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
let tmp,data,seed,owner,plan,out,decoded,native,bodies,colliders;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-first-native-h-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-first-application-native-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json'))),decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 const admission=await admitThreeBallHost(decoder,data.raw);seed=await createThreeBallCreatedOwnerSeed(admission);owner=await packThreeBallCreatedOwnerTemplate(seed);
 const scene=createThreeBallFirstScenePlan(owner),numeric=createThreeBallFirstNumericalPlan(scene),cue=createThreeBallFirstCuePlan(numeric),sphere=createThreeBallFirstSpherePlan(cue),post=createThreeBallFirstPostPlan(sphere),broad=createThreeBallFirstPhysicalBroadPostPlan(post);plan=createThreeBallFirstApplicationPlan(broad);out=await executeThreeBallFirstApplicationForTest(plan,{testOnly:true});assert.equal(out.available,true);assertThreeBallFirstApplicationResult(out,{plan});
 // Decode original h1 only AFTER candidate has completed from original t0.
 decoded=await decoder.decodeSnapshot(data.expected.snapshot);native=plain(decoded.state);
 const arena=a=>a.items.flatMap((slot,index)=>slot?.value?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
 bodies=arena(native.bodies.bodies);colliders=arena(native.colliders.colliders);
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('original observed inner-h provenance, unchanged outer bookkeeping and exact full application history',()=>{
 assert.equal(data.expected.sourceSnapshotSha256,hash(data.raw.snapshot));assert.equal(seed.initialSnapshotSha256,data.expected.sourceSnapshotSha256);assert.equal(data.expected.nativeWorldSteps,1);assert.equal(data.expected.completedInnerSubsteps,1);assert.equal(data.expected.completedOuterSteps,0);assert.equal(data.expected.latchedSubdivisions,64);
 const a=data.expected.after;for(const k of ['time','steps','dt','events','game','cuePresent'])assert.deepEqual(out.application[k],a[k],k);assert.deepEqual(a.outerObjects,data.expected.before.outerObjects);assert.equal(a.nativeDt,Math.fround(seed.application.dt/64));assert.deepEqual(data.expected.events,[]);
 assert.deepEqual(out.history.createdEvents,a.events);assert.equal(out.capability.nativeWholeHVerified,false);assert.equal(out.capability.wholeH,false);assert.equal(out.capability.completedOuterSteps,0);
});
test('all five actual native dynamic body poses, velocities, mass, inertia and force slots are exact',()=>{
 assert.equal(bodies.length,22);assert.equal(colliders.length,25);assert.equal(bodies.filter(b=>b.body_type==='Dynamic').length,5);
 for(const binding of owner.bindings.slice(0,5)){
  const b=bodies.find(b=>key(b.handle)===key(binding.body)),at=plan.layout.bodies+binding.canonicalIndex*64,i=b.mprops.effective_world_inv_inertia;
  for(const [label,offset,expected]of [['linear',0,b.vels.linvel],['angular',3,b.vels.angvel],['translation',6,b.pos.position.translation],['rotation',9,b.pos.position.rotation],['invMass',13,b.mprops.effective_inv_mass],['invInertia',16,[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33]],['force',47,b.forces.force]])assert.deepEqual(floats(out.words.subarray(at+offset,at+offset+expected.length)),expected,key(binding.body)+'.'+label);
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
test('native joint/metadata fields match, while missing final COM refresh remains an explicit unsupported witness',async(t)=>{
 const number=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);},c=seed.application.cue;
 const exported=await exportCueJoints(decoded,Object.fromEntries(Object.entries({shaftBody:c.shaft,headBody:c.head,guideBody:c.guide,flex:c.flex,prismatic:c.prismatic}).map(([k,h])=>[k,number(h)])),D);
 for(let i=0;i<2;i++)for(const field of ['kind','handle','localFrame1','localFrame2','masks','limits','impulses','limitImpulses'])assert.deepEqual(out.cue.cue.joints[i][field],exported.joints[i][field],'joint '+i+' '+field);
 for(const [role,i]of [['shaft',0],['head',1]]){
  const nativeBody=exported.joints[0][i?'body2':'body1'];for(const field of ['localCom','invMass','invInertia','principalFrame','invPrincipalInertia','userForce','userTorque'])assert.deepEqual(out.cue.cue[role][field],nativeBody[field],role+'.'+field);
  // Do not suppress the discovered mismatch or label this a native whole-h
  // pass. The component intentionally retains pre-solve COM; native final
  // mass-properties must become a separate correctly ordered owner next.
  const at=plan.layout.bodies+(3+i)*64+59,stale=floats(out.words.subarray(at,at+3));assert.deepEqual(out.cue.cue[role].worldCom,stale);assert.notDeepEqual(stale,nativeBody.worldCom,'known unsupported final COM refresh must not silently become qualified');
  t.diagnostic(JSON.stringify({scope:'unsupported-native-final-world-com',role,sourceComponent:stale,nativeFirstH:nativeBody.worldCom,nativeWholeHVerified:out.capability.nativeWholeHVerified}));
 }
 const before=data.expected.before.cue,after=data.expected.after.cue;assert.deepEqual(after,before,'original no-contact first h preserves every cue application field');assert.equal(out.cue.contacted,after.contacted);assert.equal(out.cue.active,after.contacts.length>0);assert.equal(out.cue.contactEpisodes,after.stats.contactEpisodes);assert.equal(out.cue.firstContact,after.stats.firstContact);assert.equal(out.cue.lastContact,after.stats.lastContact);
});
test('all 144 words of each original native floor cache match independently decoded expected state',()=>{
 const roles={floor:seed.application.registry.statics.find(s=>s.kind==='cloth').body,...Object.fromEntries(seed.balls.map((b,i)=>['ball'+i,b.body]))},record={roles,objects:seed.application.registry.objects,endpoint:{integration:native.integration_parameters,colliders,bodies:Object.fromEntries(Object.entries(roles).map(([r,h])=>[r,bodies.find(b=>key(b.handle)===key(h))]))}};
 const floor=seed.application.registry.statics.find(s=>s.kind==='cloth').collider;
 for(const [i,b]of flatBalls(record,'endpoint',decoded,seed.application.dt/64).entries()){
  const pair=native.narrow_phase.contact_graph.graph.edges.map(e=>e.weight).find(p=>key(p.collider1)===key(floor)&&key(p.collider2)===key(b.collider)),m=pair.contacts.value.manifolds[0];b.state.localN1=copy(m.local_n1);b.state.topology.manifoldPresent=true;
  assert.deepEqual(out.words.slice(plan.layout.caches+i*144,plan.layout.caches+(i+1)*144),packFloorNarrow(b.state),'native floor '+i+' complete packed payload');
 }
});
test('unchanged source mass-prefix component closes native COM values without claiming AABB-harvest placement',async()=>{
 const mass=createThreeBallFirstFinalMassPlan(owner),stateBase=Math.ceil(out.physical.words.length/64)*64,at={stateBase,programBase:0,scratchBase:0,testOnly:true},input=new Uint32Array(stateBase+mass.stateWords);input.set(out.physical.words);input.set(mass.initialWords,stateBase);const words=input.slice();
 await executeThreeBallFirstFinalMassWordsForTest(mass,words,at);assert.equal(words[stateBase+2],1);assert.equal(words[stateBase+5],1);assert.equal(words[stateBase+4],5);assert.equal(words[stateBase+6],31);
 for(const binding of owner.bindings.slice(0,5)){const b=bodies.find(b=>key(b.handle)===key(binding.body)),base=plan.layout.bodies+binding.canonicalIndex*64,i=b.mprops.effective_world_inv_inertia;
  for(const [offset,expected]of [[59,b.mprops.world_com],[13,b.mprops.effective_inv_mass],[16,[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33]]])assert.deepEqual(floats(words.subarray(base+offset,base+offset+expected.length)),expected,'native final mass '+key(binding.body)+' @'+offset);
 }
 const cue=owner.segments.cue;assert.deepEqual(words.subarray(cue.offset,cue.offset+cue.words),input.subarray(cue.offset,cue.offset+cue.words),'source cue component metadata is not relabeled by native mass component');
 await executeThreeBallFirstFinalMassWordsForTest(mass,words,at);assert.equal(words[stateBase+2],4,'repeated native finalization rejected');
 const corrupted=input.slice();corrupted[stateBase+mass.layout.params+4]^=1;await executeThreeBallFirstFinalMassWordsForTest(mass,corrupted,at);assert.equal(corrupted[stateBase+2],4);assert.equal(corrupted[stateBase+6],0,'mutated original local mass cannot publish first body');
 assert.throws(()=>createThreeBallFirstFinalMassPlan(copy(owner)));const old=mass.program[0];mass.program[0]^=1;assert.throws(()=>assertThreeBallFirstFinalMassPlan(mass),/mutated/);mass.program[0]=old;assertThreeBallFirstFinalMassPlan(mass);assert.equal(mass.capability.wholeH,false);
});
test('distinct source-ordered final-mass application matches original native first-h COM without relabeling source cue',async()=>{
 const physical=createThreeBallFirstFinalMassBroadPostPlan(plan.physical.post),p=createThreeBallFirstFinalMassApplicationPlan(physical),n=await executeThreeBallFirstApplicationForTest(p,{testOnly:true});assert.equal(n.available,true);assertThreeBallFirstApplicationResult(n,{plan:p});
 assert.deepEqual(n.sourceComponentCue,out.cue,'old complete source component comparison remains exact and separate');assert.deepEqual(n.application,out.application);assert.deepEqual(n.history,out.history);assert.deepEqual(n.postApplication,out.postApplication);assert.deepEqual(n.physical.bvh,out.physical.bvh);assert.deepEqual(n.physical.journal,out.physical.journal);
 for(const binding of owner.bindings.slice(0,5)){const b=bodies.find(b=>key(b.handle)===key(binding.body)),base=p.layout.bodies+binding.canonicalIndex*64,i=b.mprops.effective_world_inv_inertia;
  for(const [offset,expected]of [[0,b.vels.linvel],[3,b.vels.angvel],[6,b.pos.position.translation],[9,b.pos.position.rotation],[59,b.mprops.world_com],[13,b.mprops.effective_inv_mass],[16,[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33]],[47,b.forces.force]])assert.deepEqual(floats(n.words.subarray(base+offset,base+offset+expected.length)),expected,'composed native body '+key(binding.body)+' @'+offset);
 }
 for(const role of ['shaft','head']){const b=bodies.find(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role]));assert.deepEqual(n.cue.cue[role].worldCom,b.mprops.world_com);assert.notDeepEqual(n.sourceComponentCue.cue[role].worldCom,n.cue.cue[role].worldCom);}
 assert.equal(n.words[p.layout.applicationControl+A.finalMassAdopted],1);assert.equal(n.capability.nativeFinalMassProjection,true);assert.equal(n.capability.nativeWholeHVerified,false);assert.equal(n.capability.wholeH,false);assert.equal(Object.isFrozen(n.sourceComponentCue.cue.shaft),true);
 assert.throws(()=>createThreeBallFirstApplicationPlan(physical),/distinct/);assert.throws(()=>createThreeBallFirstFinalMassApplicationPlan(plan.physical),/distinct/);assert.throws(()=>assertThreeBallFirstApplicationResult({...n},{plan:p}));assert.throws(()=>assertThreeBallFirstApplicationResult(n,{plan}));
 // The current mass may only be adopted after the existing joint output and
 // exactly once; a missing native mass completion fails before clock/patch.
 for(const change of[w=>w[p.layout.massState+5]=0,w=>w[p.layout.applicationControl+A.finalMassAdopted]=1]){const w=n.before.slice(),k=threeBallFirstApplicationTestKernels(p,w);assert.equal(k.rc_scene_three_app_adopt(p.layout.applicationControl,p.layout.cue,p.layout.cueControl,p.layout.input,p.layout.output),true);change(w);assert.equal(k.rc_scene_three_app_final_mass(),false);}
});
