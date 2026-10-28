import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {plain} from '../src/browser-initial-import/exact-data.mjs';
import {admitThreeBallHost,projectThreeBallCreatedRegistration,threeBallCreatedNumericInputs,requireThreeBallResidentOwner} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {createThreeBallCreatedInitializationPlan,assertThreeBallCreatedInitializationPlan,executeThreeBallCreatedInitializationForTest} from '../src/resident-candidate/three-ball-created-initialization.mjs';
import {SCENE_LAYOUT as S,decodeSceneActivation,generateSceneActivationWGSL} from '../src/resident-candidate/scene-activation.mjs';
import {SCENE_INITIALIZATION_LAYOUT as I,sceneInitializationTestKernels,generateSceneInitializationWGSL} from '../src/resident-candidate/scene-initialization.mjs';
import {compileGraph} from '../src/resident-candidate/numeric-program.mjs';
import * as C from '../src/experimental-cue-initialization.js';
import * as A from '../src/experimental-arithmetic-graph.js';
const Cue=C.default??globalThis.LabCueInitializationExperimental,Graph=A.default??globalThis.LabArithmeticGraphExperimental;
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex'),key=h=>h.index+':'+h.generation,bits=x=>new Uint32Array(Float32Array.from(x).buffer);
let tmp,decoder,rows;const fixtures=[];
const absent=()=>{for(const name of ['RAPIER','PhysicsLab','LabController'])assert.equal(globalThis[name],undefined,'HOST source plan must not load engine/controller '+name);};
before(async()=>{
 absent();tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-init-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));rows=data.rows;assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of rows){const receipt=await admitThreeBallHost(decoder,row.raw),registration=await projectThreeBallCreatedRegistration(receipt),plan=createThreeBallCreatedInitializationPlan(registration);fixtures.push({row,receipt,registration,plan});}absent();
});
after(()=>{absent();if(tmp)fs.rmSync(tmp,{recursive:true});});
test('authentic 22/5/25 plan compiles the unchanged cue graph and invokes existing registration source only',()=>{
 for(const {row,registration,plan}of fixtures){
  assertThreeBallCreatedInitializationPlan(plan);assert.equal(plan.kind,'resident-three-ball-created-initialization-plan-v1');
  assert.equal(plan.initialWords[S.header.bodySlots],22);assert.equal(plan.initialWords[plan.layout.initialization+I.header.colliderCount],25);
  assert.equal(plan.control.roster.dynamicBindings.length,5);
  assert.deepEqual(plan.program,compileGraph(Cue.buildPlan()).program);assert.equal(plan.capability.nativeRegistrationBoundaryVerified,false);
  assert.equal(plan.capability.preCollisionOnly,true);assert.equal(plan.capability.runtimeIntegrated,false);assert.equal(plan.capability.gpuQualified,false);
  assert.deepEqual(plan.initialWords.slice(0,S.words),plan.control.sceneWords);assert.deepEqual(plan.initialWords.slice(plan.layout.initialization,plan.layout.initialization+I.words),plan.control.initializationWords);
  assert.ok(plan.initialWords.slice(plan.layout.numericOutputs).every(x=>x===0));assert.deepEqual(plan.history,registration.history);
  assert.equal(plan.sourceIdentity,hash(row.raw.snapshot));assert.equal(row.expectedNativeMass.sourceSnapshotSha256,plan.sourceIdentity);assert.equal(row.expectedNativeMass.worldSteps,0);
  assert.equal(row.expectedNativeMass.internalRegistrationBoundaryObserved,false);
  assert.match(plan.code,/rc_scene_created_initialize\(0u,i,/);assert.doesNotMatch(plan.code,/fn rc_scene_(?:collisions_done|finish_application|energy)/);
  for(const [text,name]of [[generateSceneInitializationWGSL(),'rc_scene_created_initialize'],[generateSceneActivationWGSL(),'rc_scene_capacity'],[generateSceneActivationWGSL(),'rc_scene_merge']]){const source=text.match(new RegExp('fn '+name+'\\([\\s\\S]*?\\n\\}'))?.[0];assert.ok(source&&plan.code.includes(source),'exact unchanged emitted '+name+' function text');}
 }
});
test('HOST lowered f32 + unchanged integer kernel equals complete established three-ball source initializer',()=>{
 for(const {registration,plan,receipt}of fixtures){
  const before=plan.initialWords.slice(),out=executeThreeBallCreatedInitializationForTest(plan,{testOnly:true}),inputs=threeBallCreatedNumericInputs(registration);
  const oracle=Cue.initializeLiveRegisteredThreeBallUserChanges(registration.record,Object.fromEntries(inputs.map(x=>[x.role,Cue.initializeReference(x)])));
  assert.deepEqual(out.initialized,oracle,'entire manager/free-list/queues/body data/collider poses/joint journal, not only counts');
  assert.deepEqual(plan.initialWords,before);assert.deepEqual(out.history,plan.history);assert.equal(out.initialized.jointEventJournal.length,13);
  assert.equal(out.words[S.header.bodySlots],22);assert.equal(out.words[S.header.jointCount],2);assert.equal(out.words[S.header.removalCount],4);
  assert.equal(out.words[plan.layout.completion],1);assert.equal(out.words[plan.layout.initialization+I.header.numericReady],7);assert.equal(out.words[S.header.phase],1);assert.equal(out.words[S.header.modifiedCount],0);assert.equal(out.words[S.header.consumedCount],3);
  const scene=decodeSceneActivation(out.words,plan.control.template);assert.equal(scene.bodies.length,22);assert.equal(scene.bodies.filter(b=>b.type==='Dynamic').length,5);
  assert.ok(out.words.slice(S.bodyOffset+22*S.bodyStride,S.bodyOffset+32*S.bodyStride).every(x=>x===0),'unused capacity is not a body');
  assert.ok(out.words.slice(plan.layout.initialization+I.colliderOffset+25*I.colliderStride,plan.layout.initialization+I.colliderOffset+27*I.colliderStride).every(x=>x===0),'unused capacity is not a collider');
  for(let role=0;role<3;role++){
   const raw=plan.initialWords.slice(plan.layout.numericInputs+role*40,plan.layout.numericInputs+(role+1)*40);
   assert.deepEqual(out.words.slice(plan.layout.numericOutputs+role*30,plan.layout.numericOutputs+(role+1)*30),bits(Graph.execute(new Float32Array(raw.buffer),Cue.buildPlan())),'no source node pruning/reassociation');
  }
  assert.throws(()=>requireThreeBallResidentOwner(receipt),e=>e.code==='three-ball-resident-owner-unavailable');
 }
});
test('numeric values agree with independent ORIGINAL zero-step native mass/pose API, not a native manager-boundary claim',async t=>{
 const comparisons=[];
 for(const {row,registration,plan}of fixtures){
  const native=plain((await decoder.decodeSnapshot(row.expectedNativeMass.snapshot)).state),restored=plain((await decoder.decodeSnapshot(row.expectedNativeMass.restoredSnapshot)).state),original=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state),arena=(s,name)=>s[name][name].items.flatMap((x,index)=>x?.value?[{handle:{index,generation:x.generation},...x.value}]:[]),bodies=arena(native,'bodies'),colliders=arena(native,'colliders');
  assert.deepEqual(arena(restored,'bodies'),arena(original,'bodies'),'all 22 native bodies retain exact fields before API calls');
  const restoredBodies=arena(restored,'bodies');for(const [role,b]of Object.entries(registration.record.created.bodies))assert.deepEqual(restoredBodies.find(x=>key(x.handle)===key(registration.record.roles[role])),b,'native restore retains complete source role data before API calls');
  assert.deepEqual(arena(restored,'colliders'),registration.record.created.colliders,'native restore retains every source collider field');
  const out=executeThreeBallCreatedInitializationForTest(plan,{testOnly:true});let compared=0,maxAbs=0,bitDifferences=0;
  const compare=(actual,expected,label)=>{assert.equal(actual.length,expected.length);const a=bits(actual),b=bits(expected);for(let i=0;i<actual.length;i++){const error=Math.abs(actual[i]-expected[i]);maxAbs=Math.max(maxAbs,error);compared++;if(a[i]!==b[i])bitDifferences++;assert.equal(a[i],b[i],label+'['+i+']: exact native f32 bits required');}};
  for(const [i,role]of ['shaft','head','guide'].entries()){
   const b=bodies.find(b=>key(b.handle)===key(registration.record.roles[role])),m=b.mprops,n=Array.from(new Float32Array(out.words.slice(plan.layout.numericOutputs+i*30,plan.layout.numericOutputs+(i+1)*30).buffer));
   assert.deepEqual(m.local_mprops,registration.record.created.bodies[role].mprops.local_mprops,'unchanged native attachment-fold local mass');
   compare(n.slice(0,3),m.world_com,role+'.COM');compare(n.slice(3,6),m.effective_inv_mass,role+'.mass');compare(n.slice(6,12),['m11','m12','m13','m22','m23','m33'].map(k=>m.effective_world_inv_inertia[k]),role+'.inertia');compare(n.slice(12,14),[m.max_extent,b.ccd.ccd_thickness],role+'.extent/thickness');
   b.colliders.forEach((h,j)=>{const c=colliders.find(c=>key(c.handle)===key(h));compare(n.slice(14+j*7,21+j*7),[...c.pos.translation,...c.pos.rotation],role+'.pose');});
  }
  comparisons.push({name:row.name,compared,maxAbs,bitDifferences,restoredSnapshotByteEqual:hash(row.raw.snapshot)===hash(row.expectedNativeMass.restoredSnapshot),nativeMassApiSteps:0,nativeRegistrationBoundaryVerified:false});
 }
 t.diagnostic(JSON.stringify({processTmpdir:os.tmpdir(),comparisons}));
});
test('source plan brands/seals reject forged, future and changed numeric/program input; execution stays test-only',()=>{
 const {registration,plan}=fixtures[0];assert.throws(()=>createThreeBallCreatedInitializationPlan(copy(registration)));assert.throws(()=>threeBallCreatedNumericInputs(copy(registration)));
 assert.throws(()=>executeThreeBallCreatedInitializationForTest(plan));assert.throws(()=>executeThreeBallCreatedInitializationForTest(copy(plan),{testOnly:true}));
 assert.throws(()=>executeThreeBallCreatedInitializationForTest(plan,{testOnly:true,numericOutputs:[]}),/injection/);
 assert.throws(()=>{threeBallCreatedNumericInputs(registration)[0].translation[0]+=1;},TypeError);
 for(const field of ['initialWords','program']){const bad=createThreeBallCreatedInitializationPlan(registration);bad[field][field==='initialWords'?bad.layout.numericInputs:0]^=1;assert.throws(()=>executeThreeBallCreatedInitializationForTest(bad,{testOnly:true}),/mutated/);}
 const detached=createThreeBallCreatedInitializationPlan(registration);structuredClone(detached.program.buffer,{transfer:[detached.program.buffer]});assert.throws(()=>assertThreeBallCreatedInitializationPlan(detached),/detached/);
 const out=executeThreeBallCreatedInitializationForTest(plan,{testOnly:true});assert.throws(()=>createThreeBallCreatedInitializationPlan(out));
 for(const mode of ['missing-numeric','replay','joint-chain']){const words=out.words.slice(),i=plan.layout.initialization;if(mode!=='replay'){words.set(plan.control.sceneWords);words.set(plan.control.initializationWords,i);}if(mode==='joint-chain')words[i+I.nodeOffset+2]=7;assert.equal(sceneInitializationTestKernels(words).rc_scene_created_initialize(0,i,plan.layout.numericOutputs,mode==='missing-numeric'?3:7),false);assert.equal(words[S.header.status],4);}
});
