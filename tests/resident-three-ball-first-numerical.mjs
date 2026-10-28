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
let tmp,decoder;const fixtures=[];
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-created-owner-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file));assert.equal(data.temporaryRoot,os.tmpdir());
 const provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),native=plain((await decoder.decodeSnapshot(row.raw.snapshot)).state);const owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallFirstScenePlan(owner),numerical=createThreeBallFirstNumericalPlan(plan),out=await executeThreeBallFirstNumericalForTest(numerical,{testOnly:true});fixtures.push({row,admission,seed,native,owner,plan,numerical,out});}
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

test('genuine original first phase executes force/energy and bounded solver preparation without cue/CCD solve substitution',t=>{
 for(const {row,seed,numerical:p,out}of fixtures){
  assertThreeBallFirstNumericalPlan(p);assert.equal(out.scene.bodies.length,22);assert.equal(p.geometryCatalog.length,18);assert.equal(p.catalog.length,18*16);
  assert.equal(out.words[p.layout.energy+W.header.canonicalCount],5);assert.equal(out.words[S.header.phase],6);assert.equal(out.capability.sphereSolveDispatched,false);assert.equal(out.capability.ccdPassAuthorityVerified,false);assert.equal(out.capability.wholeH,false);
  assert.equal(out.timing.dt,seed.balls[0].state.dt);assert.ok(out.ccd.every(c=>c.skippedSleeping||c.admitted));assert.deepEqual(out.history,seed.history);
  assert.doesNotMatch(p.code,/fn rc_scene_world_first_collision|rc_num_eval|fn rc_three_solver_scatter/);
  assert.throws(()=>requireThreeBallFirstNumericalContinuation(p),{code:'three-ball-first-numerical-continuation-unavailable'});
  for(let i=0;i<5;i++)for(let k=6;k<13;k++)assert.equal(out.words[p.layout.bodies+i*64+k],out.beforeEnergy[p.layout.bodies+i*64+k],'energy never integrates poses');
  t.diagnostic(JSON.stringify({fixture:row.name,evaluations:out.evaluations,gather:out.gathered.available,bodyCount:out.gathered.bodyCount,contactCount:out.gathered.contactCount,reason:out.gathered.reason}));
 }
});
test('future physical inputs, copied brands and mutation cannot enter numerical preparation',async()=>{
 const {plan,numerical:p}=fixtures[0];assert.throws(()=>createThreeBallFirstNumericalPlan(copy(plan)));assert.throws(()=>createThreeBallFirstNumericalPlan(plan,{}));
 await assert.rejects(executeThreeBallFirstNumericalForTest(p));await assert.rejects(executeThreeBallFirstNumericalForTest(p,{testOnly:true,solveDt:1}));
 const bad=createThreeBallFirstNumericalPlan(plan);bad.catalog[1]++;assert.throws(()=>assertThreeBallFirstNumericalPlan(bad),/mutated/);
 assert.equal(globalThis.RAPIER,undefined);assert.equal(globalThis.PhysicsLab,undefined);
});

import MathSource from '../src/experimental-coupled-contact-math.js';
import {threeBallFirstEnergyTestKernels,threeBallSolverTestKernels} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {generateWorldSolverWGSL,encodeWorldSolver} from '../src/resident-candidate/world-solver.mjs';
import {generateGeometryWorldWGSL} from '../src/resident-candidate/geometry-world.mjs';
import {generateCoupledStagedWGSL} from '../src/resident-candidate/coupled-solver.mjs';
const U=0xffffffff;
test('source canonical awake compaction, persistent bucket order and every gathered numeric input match original three-body math packing',()=>{
 for(const {seed,numerical:p,out}of fixtures){if(!out.gathered.available)continue;
  const {words:a}=out,d=p.layout,C=L3.coupled,awake=seed.balls.flatMap((b,i)=>out.scene.bodies.find(s=>key(s.handle)===key(b.body)).activation.sleeping?[]:[i]);
  assert.equal(out.gathered.bodyCount,awake.length);assert.equal(a[d.coupled+C.rosterBase],awake.length);
  for(let i=0;i<3;i++)assert.equal(a[d.solver+L3.bodyOffset+i*8+L3.body.local],awake.includes(i)?awake.indexOf(i):U);
  if(!awake.length){assert.equal(out.gathered.contactCount,0);continue;}
  const rows=out.sourceExpected.solver.expected.contactOrder;
  const config={bodyCount:awake.length,substeps:seed.balls[0].state.substeps,pgsIterations:seed.balls[0].state.pgsIterations,stabilizationIterations:seed.balls[0].state.stabilizationIterations,
   contacts:rows.map(r=>({kind:'cloth',body1:null,body2:awake.findIndex(i=>key(seed.balls[i].body)===key(r.body2))})),contactOrder:rows.map((_,i)=>i)};
  const contacts=rows.map(r=>({...copy(out.preparedFloors[seed.balls.findIndex(b=>key(b.body)===key(r.body2))].state),kind:'cloth'}));
  const packed=MathSource.pack({...out.preparedFloors[awake[0]].state,bodies:awake.map(i=>out.preparedFloors[i].state),contacts},MathSource.buildPlan(config)),bits=new Uint32Array(packed.buffer);
  assert.deepEqual(a.slice(d.coupled,d.coupled+13),bits.slice(0,13),'all original common coefficients');
  for(let i=0;i<awake.length;i++)assert.deepEqual(a.slice(d.coupled+64+i*64,d.coupled+64+i*64+47),bits.slice(64+i*64,64+i*64+47),'all source body input words');
  for(let i=0;i<rows.length;i++){const q=64+awake.length*64+i*32;assert.deepEqual(a.slice(d.coupled+q,d.coupled+q+24),bits.slice(q,q+24),'all contact geometry/material/warmstart words');assert.equal(a[d.solver+L3.contactOffset+i*4],rows[i].edge);}
  assert.equal(a[d.solver+L3.header.phase],1,'no numeric solver entered');assert.equal(a[d.coupled+C.rosterBase+6],0,'solve not completed');
 }
});
test('wrong cue role mapping, new active cue edges and replay fail before energy; unfinished solve cannot write back',()=>{
 const {numerical:p,out}=fixtures[0],d=p.layout;
 for(const mutate of [a=>a[d.energy+W.header.canonicalCount]=6,a=>a[d.energy+W.bodyMapOffset+a[S.header.roleShaft]]=4,a=>a[d.journal+J.edgeOffset+3*8+2]=1,a=>a[d.journal+J.header.sequence]=2,a=>a[d.firstBridge+L.header.completed]=0]){
  const a=out.beforeEnergy.slice();mutate(a);assert.equal(threeBallFirstEnergyTestKernels(a).rc_scene_three_energy_begin(0,d.journal,d.firstBridge,d.energy),false);assert.deepEqual(a.slice(d.bodies,d.bodies+320),out.beforeEnergy.slice(d.bodies,d.bodies+320));
 }
 assert.equal(threeBallFirstEnergyTestKernels(out.words.slice()).rc_scene_three_energy_begin(0,d.journal,d.firstBridge,d.energy),false);
 const active=fixtures.find(f=>f.out.gathered.bodyCount===3),b=active.out.words.slice(),q=active.numerical.layout,body=b.slice(q.bodies,q.bodies+320);threeBallSolverTestKernels(b,active.numerical.catalog).rc_three_solver_scatter(q.solver,q.journal,q.roster,0,q.bodies,0,q.caches,q.coupled);assert.notEqual(b[q.solver],0);assert.deepEqual(b.slice(q.bodies,q.bodies+320),body);
});
test('old four-ball source emission and fixed-four admission are unchanged',()=>{
 const sources={solver:generateWorldSolverWGSL(),geometry:generateGeometryWorldWGSL(),coupled:['gather','evaluate','scatter'].map(generateCoupledStagedWGSL).join('')};
 const hashes={solver:'a9435f738a6e53d837a9ea3be3bbaed0d74f10830f45861412472758c9bd4caa',geometry:'8b32e17e09d43d8cd56c37cef912a4c27ce38c110ebdb254833236b045ecd22a',coupled:'9846608dc5ea61b518910c36f1be6083fce98d19b3c1bf5b637def5569a9144d'};
 for(const[name,s]of Object.entries(sources))assert.equal(createHash('sha256').update(s).digest('hex'),hashes[name]);
 assert.throws(()=>encodeWorldSolver(fixtures[0].seed,{sceneSlots:[16,17,18]}),/four original ball bindings/);
});
test('current gather rejects stale generation/epoch, inactive floor, nonfloor catalog and wrong awake slots without canonical publication',()=>{
 const f=fixtures.find(f=>f.out.gathered.bodyCount===3),d=f.numerical.layout;
 for(const kind of ['generation','epoch','inactiveFloor','nonfloor','awakeSlot']){
  const a=f.out.words.slice(),g=f.numerical.catalog.slice(),before=a.slice(d.bodies,d.bodies+320);a[d.solver+L3.header.phase]=0;
  if(kind==='generation')a[d.solver+L3.bodyOffset+1]++;
  if(kind==='epoch')a[S.header.epoch]++;
  if(kind==='inactiveFloor')a[d.caches+131]=0;
  if(kind==='nonfloor')g[0]=1;
  if(kind==='awakeSlot'){const slot=a[d.solver+L3.bodyOffset+L3.body.sceneSlot];a[S.bodyOffset+slot*S.bodyStride+S.body.activeIndex]=99;}
  threeBallSolverTestKernels(a,g).rc_three_solver_gather(d.solver,d.journal,d.roster,0,d.bodies,0,d.caches,d.coupled,new Uint32Array(Float32Array.of(f.out.timing.dt).buffer)[0],U);
  assert.notEqual(a[d.solver],0,kind);assert.deepEqual(a.slice(d.bodies,d.bodies+320),before,'unsupported gather leaves canonical draft unchanged');
 }
});
test('prepared cue body64 keeps actual localCOM56 and worldCOM59 distinct before future CCD ownership',()=>{
 for(const {seed,numerical:p,out}of fixtures)for(const [i,role]of ['shaft','head'].entries()){
  const expected=out.sourceExpected.preparedCue.find(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role])),at=p.layout.bodies+(3+i)*64;
  for(const [name,offset]of [['localCom',56],['worldCom',59]]){
   const bits=new Uint32Array(Float32Array.from(expected[name]).buffer);assert.deepEqual(out.beforeEnergy.slice(at+offset,at+offset+3),bits,role+' original '+name);
   assert.deepEqual(out.words.slice(at+offset,at+offset+3),bits,role+' energy must preserve '+name);
  }
  assert.notDeepEqual(expected.localCom,expected.worldCom,'fixture discriminates COM lanes');
 }
});
