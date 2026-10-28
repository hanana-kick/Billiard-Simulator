import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallSecondPrefixPlan,assertThreeBallSecondPrefixPlan,executeThreeBallSecondPrefixForTest,executeThreeBallSecondPrefixWordsForTest,assertThreeBallSecondPrefixResult} from '../src/resident-candidate/three-ball-second-prefix.mjs';
import {executeThreeBallFirstApplicationForTest} from '../src/resident-candidate/three-ball-first-application.mjs';
import {decodeSceneActivation,SCENE_LAYOUT as S} from '../src/resident-candidate/scene-activation.mjs';
import {decodeThreeBallRetainedTapeForTest} from '../src/resident-candidate/three-ball-retained-tape.mjs';
import {wordsNumber} from '../src/resident-candidate/source-number.mjs';
import Scene from '../src/experimental-scene-activation.js';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,key=h=>h.index+':'+h.generation,floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
let tmp,data,owner,plan,out,preNative,h1Native,h2Native,expectedFirst,wall;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-second-prefix-'));const file=path.join(tmp,'original.v8'),child=spawnSync(process.execPath,['tests/resident-three-ball-two-h-native-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);data=v8.deserialize(fs.readFileSync(file));
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json'))),decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 const admission=await admitThreeBallHost(decoder,data.raw),seed=await createThreeBallCreatedOwnerSeed(admission);owner=await packThreeBallCreatedOwnerTemplate(seed);plan=createThreeBallSecondPrefixPlan(owner);const started=performance.now();out=await executeThreeBallSecondPrefixForTest(plan,{testOnly:true});wall=performance.now()-started;
 assert.equal(out.available,true,JSON.stringify({top:Array.from(out.words.slice(plan.layout.secondControl,plan.layout.secondControl+12)),first:Array.from(out.words.slice(plan.layout.control,plan.layout.control+12)),cue:Array.from(out.words.slice(plan.layout.cue,plan.layout.cue+64)),scene:Array.from(out.words.slice(0,64))}));
 // Actual observations are decoded only after execution; they never seed it.
 preNative=plain((await decoder.decodeSnapshot(data.expected.prefixes[1].snapshot)).state);h1Native=plain((await decoder.decodeSnapshot(data.expected.endpoints[0].snapshot)).state);h2Native=plain((await decoder.decodeSnapshot(data.expected.endpoints[1].snapshot)).state);
 expectedFirst=await executeThreeBallFirstApplicationForTest(plan.first.application,{testOnly:true});
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('authentic t0 advances unchanged first h and current second prefix in one bank',t=>{
 assertThreeBallSecondPrefixResult(out,{plan});assert.deepEqual(plan.initialWords.slice(0,plan.first.layout.words),plan.first.initialWords);assert.equal(data.temporaryRoot,os.tmpdir());assert.equal(data.expected.nativeWorldSteps,2);assert.equal(data.expected.completedOuterSteps,0);assert.equal(out.capability.secondH,false);assert.equal(out.capability.completedInnerH,1);
 const d=plan.layout,w=out.words;assert.equal(w[d.cue+7],2);assert.equal(w[d.cue+8],2);assert.equal(w[d.cue+12],1,'second actual joint remains deferred');assert.equal(w[S.header.phase],4);assert.equal(w[d.control+3],11,'first profile state is not reset');
 assert.deepEqual(decodeThreeBallRetainedTapeForTest(plan.first.tape,w.slice(d.tape,d.tape+plan.first.tape.stateWords),{testOnly:true}),{history:owner.seed.history,game:owner.seed.game,events:owner.seed.application.events});
 assert.equal(wordsNumber(w.slice(d.cue+20,d.cue+22)),data.expected.prefixes[1].application.time+owner.seed.application.dt/64,'source pending cue clock, not prematurely published PhysicsLab clock');assert.equal(wordsNumber(w.slice(d.applicationControl+20,d.applicationControl+22)),data.expected.prefixes[1].application.time);
 t.diagnostic(JSON.stringify({endpoint:out.capability.endpoint,sourceT0ThroughPrefixMillis:wall,words:plan.initialWords.length,programWords:plan.program.length,nativeFixture:data.timing}));
});
test('current cue and all three spheres match actual second pre-world native body values exactly',()=>{
 const bodies=preNative.bodies.bodies.items.flatMap((slot,index)=>slot?.value?[{handle:{index,generation:slot.generation},...slot.value}]:[]);assert.equal(bodies.filter(b=>b.body_type==='Dynamic').length,5);
 for(const binding of owner.bindings.slice(0,5)){const b=bodies.find(b=>key(b.handle)===key(binding.body)),at=plan.layout.bodies+binding.canonicalIndex*64,i=b.mprops.effective_world_inv_inertia;
  for(const [label,offset,want]of [['linear',0,b.vels.linvel],['angular',3,b.vels.angvel],['translation',6,b.pos.position.translation],['rotation',9,b.pos.position.rotation],['invMass',13,b.mprops.effective_inv_mass],['invInertia',16,[i.m11,i.m12,i.m13,i.m12,i.m22,i.m23,i.m13,i.m23,i.m33]],['userForce',35,b.forces.user_force],['userTorque',38,b.forces.user_torque],['worldCom',59,b.mprops.world_com]])assert.deepEqual(floats(out.words.subarray(at+offset,at+offset+want.length)),want,key(binding.body)+'.'+label);
 }
});
test('original source scene consumes actual native FIFO in order with no epoch/reset shortcut',()=>{
 const first=expectedFirst.postApplication.scene,stage=Scene.createReferenceStage(first),token={};stage.claim(token);let expected;
 try{expected=stage.beginFrame({apiCalls:[{body:first.roles.head,strongWake:false},{body:first.roles.shaft,strongWake:false}],removedBodies:[]},token);}finally{stage.abort(token);stage.release(token);stage.dispose();}
 const actual=decodeSceneActivation(out.words,owner.registration.control.template);for(const k of ['phase','manager','bodies','modifiedBodies','consumedModifiedBodies'])assert.deepEqual(actual[k],expected[k],k);
 assert.deepEqual(actual.consumedModifiedBodies,preNative.bodies.modified_bodies[0]);assert.equal(actual.manager.active_set_epoch,h1Native.islands.active_set_epoch+actual.consumedModifiedBodies.length);assert.equal(actual.manager.active_set_epoch,h2Native.islands.active_set_epoch);
});
test('native h2 empty cue manifold remains a real missing downstream owner, not MISS or invented contact',()=>{
 const first=h1Native.narrow_phase.contact_graph.graph.edges.map(e=>e.weight),second=h2Native.narrow_phase.contact_graph.graph.edges.map(e=>e.weight);assert.equal(first.length,3);assert.equal(second.length,4);const edge=second.find(p=>!first.some(a=>key(a.collider1)===key(p.collider1)&&key(a.collider2)===key(p.collider2)));assert.deepEqual([edge.collider1,edge.collider2],[{index:16,generation:0},{index:22,generation:0}]);assert.equal(edge.contacts.value.manifolds.length,1);assert.deepEqual(edge.contacts.value.manifolds[0].points,[]);assert.deepEqual(edge.contacts.value.manifolds[0].data.solver_contacts,[]);assert.deepEqual(data.expected.events,[]);
 assert.equal(out.capability.secondCollision,false);assert.equal(out.capability.secondH,false);assert.equal(out.words[plan.layout.journal+8],plan.first.initialWords[plan.layout.journal+8]);
});
test('no caller future values, replay, forged completion or altered tape can advance this prefix',async()=>{
 assert.throws(()=>createThreeBallSecondPrefixPlan(structuredClone(owner)));await assert.rejects(executeThreeBallSecondPrefixForTest(plan,{testOnly:true,next:{}}));
 const replay=out.words.slice();await executeThreeBallSecondPrefixWordsForTest(plan,replay,{testOnly:true,secondOnly:true});assert.equal(replay[plan.layout.secondControl+2],4);
 const bad=plan.initialWords.slice();bad[plan.layout.control+2]=1;bad[plan.layout.control+3]=11;bad[plan.layout.control+5]=bad[plan.layout.control+6]=1;await executeThreeBallSecondPrefixWordsForTest(plan,bad,{testOnly:true,secondOnly:true});assert.equal(bad[plan.layout.secondControl+2],4);assert.equal(bad[plan.layout.cue+7],0);
 const x=plan.initialWords[plan.layout.secondControl];plan.initialWords[plan.layout.secondControl]^=1;assert.throws(()=>assertThreeBallSecondPrefixPlan(plan));plan.initialWords[plan.layout.secondControl]=x;assertThreeBallSecondPrefixPlan(plan);
});
