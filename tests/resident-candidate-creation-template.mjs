import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {authenticateCreationTemplate,assertCreationTemplate,assertCreationVariantForTest,verifyCreationArenaTransition,CREATION_METHODS,CREATION_SOURCE,CREATION_OVERWRITE_REQUIREMENTS} from '../src/resident-candidate/creation-template.mjs';
const require=createRequire(import.meta.url),H=require('./cue-obstacle-fixtures.cjs'),R=H.R;
let pending;async function fixture(){return pending??=(async()=>{const source=await originalRegisteredFixture(),result=await authenticateCreationTemplate(source.decoder,source.raw);return{...source,...result};})();}
function nativeHandle(h){const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);}
function restoreOriginal(raw){const a=raw.capture.preStrikeApplication;const bind=o=>({...o,bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]});const lab=globalThis.PhysicsLab.fromSnapshot(R,{...a,world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});lab.world.step=()=>{throw Error('Creation proof must never advance native physics');};return lab;}
function variants(){let x=0x50524f4f;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};return[{angle:0,elevation:0,speed:.5,tipX:0,tipY:0},{angle:359.999,elevation:85,speed:4.5,tipX:.5,tipY:-.2},{angle:-180,elevation:42.5,speed:2.5,tipX:-.4,tipY:.4},...Array.from({length:29},()=>({angle:rand()*720-360,elevation:rand()*85,speed:.5+rand()*4,tipX:(rand()-.5)*.8,tipY:(rand()-.5)*.8}))];}
test('authenticated original free-list and 13-call proof preserves exact native allocation order, not a fabricated allocator',async()=>{
 const{receipt}=await fixture();assert.equal(assertCreationTemplate(receipt),receipt);assert.equal(receipt.callCount,13);assert.equal(receipt.nativeStepCount,0);assert.equal(receipt.sourceStructureVerified,true);assert.equal(receipt.nativeAllocation,false);assert.equal(receipt.perCandidateNumericCoverage,false);
 assert.deepEqual(receipt.arenas.bodies.allocated,[{index:22,generation:3},{index:20,generation:3},{index:21,generation:3}]);assert.deepEqual(receipt.arenas.colliders.allocated,[{index:24,generation:3},{index:26,generation:3},{index:25,generation:3}]);assert.deepEqual(receipt.arenas.joints.allocated,[{index:1,generation:2},{index:0,generation:2}]);assert.deepEqual(Object.values(receipt.arenas).map(a=>a.headAfter),[23,27,2]);
 assert.deepEqual(receipt.graph.nodes.map(n=>n.weight),[receipt.roles.shaft,receipt.roles.head,receipt.roles.guide]);assert.deepEqual(receipt.graph.edges.map(e=>e.node),[[0,1],[2,0]]);assert.equal(receipt.nativeVariableFields.length,93);
 // The nontrivial source attachment eigensystem is retained, never replaced by
 // isotropic mass just because the tip collider is spherical.
 assert.deepEqual(receipt.invariantAttachmentMass.head.principal_inertia_local_frame,[.7071068286895752,0,0,-.7071068286895752]);assert.ok(Object.isFrozen(receipt.arenas.bodies));assert.throws(()=>assertCreationTemplate(structuredClone(receipt)),/authentic/);
});
test('source control-flow and mutation count is pinned to original accepted strike implementation',()=>{
 const code=readFileSync(new URL('../src/physics.js',import.meta.url));assert.equal(createHash('sha256').update(code).digest('hex'),CREATION_SOURCE.physicsSha256,'review template dependencies if original source changes');const strike=code.toString().split(' strike(id,settings,')[1].split('\n removeCue(){')[0];
 const calls=[...strike.matchAll(/\.(createRigidBody|createCollider|createImpulseJoint|setContactsEnabled|setLimits|setLinvel)\(/g)].map(m=>m[1]);assert.deepEqual(calls,CREATION_METHODS);assert.ok(strike.indexOf('const p=this.pose')<strike.indexOf('createRigidBody'));
 assert.deepEqual(CREATION_OVERWRITE_REQUIREMENTS.map(x=>x.phase),['before-first-lateral','before-first-lateral','before-first-lateral','before-first-collider-read','before-first-lateral','after-first-tip-before-first-collision']);
});
test('32 original no-step creations from same real prestrike preserve EVERY native leaf outside enumerated pose/mass/velocity fields',async()=>{
 await R.init();const{receipt,raw,decoder}=await fixture();const changed=new Set();let snapshots=0;
 for(const settings of variants()){const lab=restoreOriginal(raw);try{
  // Test-only structural comparison. Obstruction is independently owned by raw
  // admission; ignoring it here does not admit an uncleared production row.
  assert.equal(lab.strike(raw.capture.preStrikeApplication.controller.selectedId,settings,{ignoreObstruction:true,saveSnapshot:false}).ok,true);
  const decoded=await decoder.decodeSnapshot(lab.world.takeSnapshot()),state=plain(decoded.state);assert.deepEqual(assertCreationVariantForTest(receipt,state,{testOnly:true}),{checkedNativeVariableFields:93,nativeAllocation:false});snapshots++;
  for(const path of receipt.nativeVariableFields){const keys=path.split('.');let value=state;for(const k of keys)value=value[k];changed.add(path+':'+Object.is(value,-0)+':'+value);}
 }finally{lab.dispose();}}
 assert.equal(snapshots,32);assert.ok(changed.size>500,'varied fields are actually exercised, not a copied native fixture');
});
test('whole-tree variant mask does not excuse local mass, sleep history, allocator or collider metadata corruption',async()=>{
 const{receipt,decoder,raw}=await fixture(),state=plain((await decoder.decodeSnapshot(raw.snapshot)).state);assert.throws(()=>assertCreationVariantForTest(receipt,state),/test-only/);
 const changes=[s=>s.bodies.bodies.items[20].value.mprops.local_mprops.principal_inertia_local_frame[0]=0,s=>s.bodies.bodies.items[22].value.activation.sleep_prev_pose.translation[0]=1,s=>s.colliders.colliders.items[25].value.material.friction=0,s=>s.bodies.bodies.free_list_head=24,s=>s.impulse_joints.joint_graph.graph.nodes[0].next.reverse(),s=>s.bodies.bodies.items[21].value.mprops.world_com[0]=1];
 for(const change of changes){const next=structuredClone(state);change(next);assert.throws(()=>assertCreationVariantForTest(receipt,next,{testOnly:true}),/non-parameter/);}
 const nonfinite=structuredClone(state);nonfinite.bodies.bodies.items[22].value.pos.position.translation[0]=NaN;assert.throws(()=>assertCreationVariantForTest(receipt,nonfinite,{testOnly:true}),/finite source f32/);
});
test('arena proof rejects growth, wrong generations/order, cycles, orphan free slots, and mutation of retained native entries',()=>{
 const before={items:[{generation:0,value:{v:1}},{next_free:2},{next_free:3},{next_free:null}],generation:4,free_list_head:1,len:1},after={items:[{generation:0,value:{v:1}},{generation:4,value:11},{generation:4,value:22},{next_free:null}],generation:4,free_list_head:3,len:3},handles=[{index:1,generation:4},{index:2,generation:4}];assert.equal(verifyCreationArenaTransition(before,after,handles).headAfter,3);
 assert.throws(()=>verifyCreationArenaTransition(before,after,[...handles].reverse()),/handle\/generation order/);assert.throws(()=>verifyCreationArenaTransition(before,after,[{index:1,generation:5},handles[1]]),/handle\/generation order/);
 for(const change of[a=>a.items[0].value.v=2,a=>a.items.push({next_free:null}),a=>a.generation++,a=>a.items[3].next_free=3,a=>a.free_list_head=null]){const next=structuredClone(after);change(next);assert.throws(()=>verifyCreationArenaTransition(before,next,handles));}
 const full={items:[{generation:0,value:1}],generation:0,free_list_head:null,len:1};assert.throws(()=>verifyCreationArenaTransition(full,full,[{index:1,generation:0}]),/slow path unsupported/);
});
test('source authentication cannot be bypassed with a journal mutation or nonzero captured native steps',async()=>{
 const{raw,decoder}=await fixture();for(const mutate of[r=>r.capture.strikeCreationJournal[0].captureNativeStepsAfter=1,r=>r.capture.strikeCreationJournal[9].method='setContactsEnabled']){const changed=structuredClone(raw);mutate(changed);await assert.rejects(authenticateCreationTemplate(decoder,changed));}
});
