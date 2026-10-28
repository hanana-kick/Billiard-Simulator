import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallInitialBroadPlan,assertThreeBallInitialBroadPlan,executeThreeBallInitialBroadForTest,executeThreeBallInitialBroadWordsForTest,THREE_BALL_INITIAL_BROAD_LAYOUT as L} from '../src/resident-candidate/three-ball-initial-broad.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {BVH_LAYOUT as V,BVH_HEADER as H,generateBvhWGSL} from '../src/resident-candidate/bvh.mjs';
import {WORLD_BROAD_LAYOUT as B,generateWorldBroadWGSL} from '../src/resident-candidate/world-broad.mjs';
import {SCENE_LAYOUT as S} from '../src/resident-candidate/scene-activation.mjs';
import Broad from '../src/experimental-cue-broad-phase.js';
import Cue from '../src/experimental-cue-created-stroke-stage.js';
import Journal from '../src/experimental-contact-graph-journal.js';
import Bridge from '../src/experimental-ccd-bvh-world-bridge.js';
import First from '../src/experimental-cue-bvh-insertion.js';
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,fixtures=[];let tmp;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-resident-broad-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file)),provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 const decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),owner=await packThreeBallCreatedOwnerTemplate(seed),plan=createThreeBallInitialBroadPlan(owner),out=await executeThreeBallInitialBroadForTest(plan,{testOnly:true});
  // Independent original source owners consume only the already-owned current
  // preparation boundary, never resident broad/tree/journal outputs.
  const token={},cue=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:'original-js-number-v1'});cue.claim(token);const broad=await Broad.createLiveRegisteredThreeBallReferenceStage(seed.cueBroadSeed),bridge=await Bridge.createReferenceStage(seed.cueBroadSeed);broad.claim(token);const journal=Journal.createReferenceStageWithLiveThreeBallCue(seed.contactGraphSeed,broad);journal.claim(token);
  try{const selected=seed.sourceOrigin.selectedIndex,pre=await cue.prepareApplication({selected:copy(seed.balls[selected].state),others:seed.balls.filter((_,i)=>i!==selected).map(b=>copy(b.state))},token),m=pre.metadata;for(const role of ['shaft','head']){const {torque,...current}=m.preSolveBodies[role];assert.deepEqual(out.boundary.metadata.preSolveBodies[role],current,'every published current cue field; lateral diagnostic torque is not a Joint/body64 input');}const manager=m.initialization.manager,poses=seed.balls.map(b=>({body:copy(b.body),translation:copy(b.state.translation),rotation:copy(b.state.rotation)})),own={cue:copy(m.preSolveBodies),balls:poses,removedBodies:[],activeBodyOrder:manager.awake_island===null?[]:copy(manager.islands.v[manager.awake_island].bodies)};
   const receipt=await broad.prepare(own,token),sourceBroad=Broad.readReceipt(receipt),graph=await journal.prepare(poses.map(({body,translation})=>({body,translation})),token,receipt),sourceJournal=journal.narrowTransitions([],token);Journal.assertInitialLiveThreeBallCollisionOwned(graph.receipt,'cpu-reference');
   bridge.begin();await bridge.collision(own);const sourceBvh=copy(bridge.stage.preview()),candidates=First.sourceTreeCandidates(sourceBvh.tree).candidates;
   fixtures.push({row,seed,owner,plan,out,sourceBroad,sourceJournal,sourceBvh,candidates});
  }finally{bridge.abort();bridge.dispose();journal.abort(token);journal.release(token);journal.dispose();broad.abort(token);broad.release(token);broad.dispose();cue.abort(token);cue.release(token);cue.dispose();}
 }
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});
test('actual emitted resident kernels produce the full genuine-three pending BVH and ordered journal from t0',t=>{
 for(const {row,plan,out,sourceBroad,sourceJournal,sourceBvh,candidates}of fixtures){
  assert.deepEqual(out.bvh,sourceBvh,'all tree nodes/parents/free allocator/flags/frame/deferred optimizer words');
  assert.deepEqual(out.bvh.tree,sourceBroad.after.initialTree,'independent original firstInsert owner');
  const {proxies,cueProxies,...journalState}=sourceJournal.after;assert.deepEqual(out.journal.state,journalState,'dense edges, lifetimes, full ordered adjacency and clocks');
  const proxy=h=>{const p=out.bvh.tree.leaf_node_indices.v[h.index],node=out.bvh.tree.nodes[Math.floor(p/2)][p%2?'right':'left'];return{min:node.mins,max:node.maxs};};
  assert.deepEqual(proxies,plan.template.seed.contactGraphSeed.bodies.map(b=>proxy(b.primary)),'all source journal sphere proxies reside in the exact BVH');
  assert.deepEqual(cueProxies,sourceBroad.after.proxies.filter(p=>plan.template.seed.contactGraphSeed.cueColliders.some(h=>h.index===p.collider.index&&h.generation===p.collider.generation)).map(p=>({collider:p.collider,...proxy(p.collider)})),'all source cue proxy values and order');
  for(const k of ['changes','operations','contactEvents','broadPhaseEvents','removedColliders'])assert.deepEqual(out.journal[k],sourceJournal[k]??[],k);
  const a=out.words,j=plan.layout.journal;assert.deepEqual(Array.from(a.slice(j+J.pairOffset,j+J.pairOffset+candidates.length*2)),candidates.flat(),'source changed-tree BVTT order');
  assert.equal(out.journal.status,0);assert.equal(out.journal.phase,3);assert.equal(out.journal.fromSequence,0);assert.equal(out.journal.state.sequence,1);assert.equal(out.bvh.tree.leaf_node_indices.n,25);assert.equal(a[plan.layout.bvh+H.first],0);
  for(const collider of plan.template.seed.nativeColliders)assert.equal(a[plan.layout.bvh+1787+collider.handle.index],collider.handle.generation,'actual native BVH collider generation');
  if(row.name==='immutable-after-turn'){assert.deepEqual(plan.template.seed.contactGraphSeed.cueColliders.map(h=>h.generation),[3,3,3]);assert.deepEqual(Array.from({length:3},(_,i)=>a[plan.layout.broad+B.updatesOffset+i*8]),[22,24,23],'recycled source parent order is not sorted');}
  assert.equal(a[plan.layout.broad+B.header.phase],2);assert.equal(a[plan.layout.broad+B.header.cursor],3);assert.equal(a[plan.layout.control+L.header.evaluations],3);
  assert.deepEqual(out.words.slice(plan.layout.bodies,plan.layout.bodies+320),out.before.slice(plan.layout.bodies,plan.layout.bodies+320),'broad never modifies privately admitted current cue/sphere body rows');
  for(const[role,i]of[['shaft',0],['head',1]]){const at=plan.layout.bodies+(3+i)*64,raw=new Float32Array(a.buffer),m=out.boundary.metadata.preSolveBodies[role],init=plan.template.registration.layout.numericOutputs;for(const[name,off]of[['linear',0],['angular',3],['translation',6],['rotation',9],['invMass',13],['localCom',56],['worldCom',59]])assert.deepEqual(Array.from(raw.slice(at+off,at+off+m[name].length)),m[name],'current owned cue '+role+' '+name);assert.deepEqual(a.slice(at+62,at+64),a.slice(init+i*30+12,init+i*30+14),'initialized original CCD extent and thickness');}
  assert.equal(out.boundary.cuePreResident,false);assert.equal(out.capability.nativeBoundaryVerified,false);assert.equal(out.capability.gpuQualified,false);
  t.diagnostic(JSON.stringify({fixture:row.name,sourceIdentity:out.sourceIdentity,bvhLeaves:25,initialLeaves:22,freshOrder:Array.from(a.slice(plan.layout.broad+B.updatesOffset,plan.layout.broad+B.updatesOffset+24)).filter((_,i)=>i%8===0),bvttPairs:candidates.length,appendCount:out.journal.changes.length,wholeH:false,native:false}));
 }
});
test('producer uses original source functions and separate numeric stage; never packs a future reference receipt',()=>{
 for(const {plan}of fixtures){assert.equal(plan.stages.length,5);assert.deepEqual(plan.commands,[{stage:0},{stages:[1,2,3],cycles:25},{stage:4}]);assert.ok(Object.isFrozen(plan.commands[1].stages));assert.match(plan.source,/fn rc_bvh_bvtt/);assert.match(plan.source,/fn rc_world_broad_commit_collision/);assert.match(plan.source,/fn rc_journal_prepare_bvh/);assert.match(plan.source,/fn rc_journal_narrow/);assert.doesNotMatch(plan.stages[0].code,/fn rc_num_eval/);assert.match(plan.stages[2].code,/fn rc_num_eval/);assert.doesNotMatch(plan.stages[4].code,/fn rc_num_eval/);for(const name of['rc_bvh_bvtt','rc_world_broad_commit_collision']){const all=name.startsWith('rc_bvh')?generateBvhWGSL():generateWorldBroadWGSL(),start=all.indexOf('fn '+name+'(');let end=all.indexOf('{',start),depth=1;while(depth){end++;if(all[end]==='{')depth++;if(all[end]==='}')depth--;}assert.ok(plan.source.includes(all.slice(start,end+1)),'exact unmodified '+name);}}
 const text=fs.readFileSync(new URL('../src/resident-candidate/three-ball-initial-broad.mjs',import.meta.url),'utf8');assert.doesNotMatch(text,/encodeContactJournal|Broad\.readReceipt|Journal\.create|firstInsert\(|Cue\.createReference|Joint\.pack|sourceExpected/);assert.match(text,/assertThreeBallInitialCuePrefixResult/);
});
test('missing admission, wrong generations/registries and replay fail closed, not ordinary physical miss',async()=>{
 const {plan,out}=fixtures[0],d=plan.layout;
 const changes={missingCuePre:a=>a[d.control+4]=0,missingRigid:a=>a[d.control+5]=0,missingFloor:a=>a[d.control+6]=3,fourSphere:a=>a[S.header.bodyCount]=24,wrongGeneration:a=>a[d.journal+J.colliderOffset+1]++,missingLeaf:a=>a[d.bvh+H.leaves]=21,futureSequence:a=>a[d.journal+J.header.sequence]=1,wrongFresh:a=>a[d.broad+B.freshOffset]=0};
 for(const[name,change]of Object.entries(changes)){const a=out.before.slice();change(a);await executeThreeBallInitialBroadWordsForTest(plan,a,{testOnly:true});assert.equal(a[d.control+2],4,name);assert.notEqual(a[d.control+3],2,name);}
 const replay=out.words.slice();await executeThreeBallInitialBroadWordsForTest(plan,replay,{testOnly:true});assert.equal(replay[d.control+2],4);
});
test('unowned plans, injected state/receipts and mutated initial words never enter the public test producer',async()=>{
 const{plan,owner}=fixtures[0];assertThreeBallInitialBroadPlan(plan);assert.throws(()=>createThreeBallInitialBroadPlan(copy(owner)));assert.throws(()=>createThreeBallInitialBroadPlan(owner,{}));await assert.rejects(executeThreeBallInitialBroadForTest(plan));await assert.rejects(executeThreeBallInitialBroadForTest(plan,{testOnly:true,journal:[]}));await assert.rejects(executeThreeBallInitialBroadForTest(copy(plan),{testOnly:true}));const bad=createThreeBallInitialBroadPlan(owner);bad.initialWords[0]++;assert.throws(()=>assertThreeBallInitialBroadPlan(bad),/mutated/);
});

test('first scene consumes generated resident journal/BVH, with original receipts retained only as expected evidence',async()=>{
 const {createThreeBallFirstScenePlan,executeThreeBallFirstSceneForTest}=await import('../src/resident-candidate/three-ball-scene-first-collision.mjs');
 for(const {owner}of fixtures){const plan=createThreeBallFirstScenePlan(owner),out=await executeThreeBallFirstSceneForTest(plan,{testOnly:true}),b=out.broadProducer;
  assert.equal(out.capability.collisionInputBackend,'resident-source-kernels-host-test-only');assert.equal(out.capability.cuePreResident,false);
  assert.deepEqual(out.words.slice(plan.layout.journal,plan.layout.journal+J.words),b.words.slice(plan.layout.journal,plan.layout.journal+J.words),'scene consumes untouched generated journal');
  assert.deepEqual(out.words.slice(plan.initialBroad.layout.bvh,plan.initialBroad.layout.bvh+V.words),b.words.slice(plan.initialBroad.layout.bvh,plan.initialBroad.layout.bvh+V.words),'resident tree survives scene boundary');
  assert.deepEqual(out.initialized,out.sourceExpected.initialized,'unchanged complete source scene boundary');
 }
 const source=fs.readFileSync(new URL('../src/resident-candidate/three-ball-scene-first-collision.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/packCollisionJournal|encodeContactJournal/);assert.match(source,/words\.set\(broadProducer\.words\)/);
});
