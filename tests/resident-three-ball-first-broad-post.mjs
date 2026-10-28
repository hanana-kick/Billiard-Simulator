import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import v8 from 'node:v8';import {spawnSync} from 'node:child_process';
import * as D from '../tools/rapier-snapshot-decoder/browser.mjs';
import {admitThreeBallHost,createThreeBallCreatedOwnerSeed} from '../src/resident-candidate/three-ball-host-admission.mjs';
import {packThreeBallCreatedOwnerTemplate} from '../src/resident-candidate/three-ball-created-owner.mjs';
import {createThreeBallFirstScenePlan} from '../src/resident-candidate/three-ball-scene-first-collision.mjs';
import {createThreeBallFirstNumericalPlan} from '../src/resident-candidate/three-ball-first-numerical.mjs';
import {createThreeBallFirstCuePlan} from '../src/resident-candidate/three-ball-first-cue.mjs';
import {createThreeBallFirstSpherePlan} from '../src/resident-candidate/three-ball-first-sphere.mjs';
import {createThreeBallFirstPostPlan} from '../src/resident-candidate/three-ball-first-post.mjs';
import {createThreeBallFirstBroadPostPlan,createThreeBallFirstPhysicalBroadPostPlan,createThreeBallFirstFinalMassBroadPostPlan,executeThreeBallFirstFinalMassBroadPostForTest,assertThreeBallFirstFinalMassBroadPostResult,assertThreeBallFirstPhysicalBroadPostResult,assertThreeBallFirstBroadPostResult,assertThreeBallFirstBroadPostPlan,executeThreeBallFirstBroadPostForTest,executeThreeBallFirstBroadPostWordsForTest,assertThreeBallFirstBroadPostReceipt} from '../src/resident-candidate/three-ball-first-broad-post.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from '../src/resident-candidate/contact-journal.mjs';
import {CONTACT_ROSTER_LAYOUT as R} from '../src/resident-candidate/contact-roster.mjs';
import {WORLD_BROAD_LAYOUT as B,generateWorldBroadWGSL} from '../src/resident-candidate/world-broad.mjs';
import {SCENE_LAYOUT as S} from '../src/resident-candidate/scene-activation.mjs';
import Broad from '../src/experimental-cue-broad-phase.js';
import Journal from '../src/experimental-contact-graph-journal.js';
import Bridge from '../src/experimental-ccd-bvh-world-bridge.js';
import Cue from '../src/experimental-cue-created-stroke-stage.js';
const finalMass=process.env.THREE_BALL_BROAD_POST_PROFILE==='final-mass',physical=finalMass||process.env.THREE_BALL_BROAD_POST_PROFILE==='physical';assert.ok([undefined,'physical','final-mass'].includes(process.env.THREE_BALL_BROAD_POST_PROFILE));
const createPlan=finalMass?createThreeBallFirstFinalMassBroadPostPlan:physical?createThreeBallFirstPhysicalBroadPostPlan:createThreeBallFirstBroadPostPlan;
const root=path.resolve(import.meta.dirname,'..'),copy=structuredClone,key=h=>h.index+':'+h.generation,fixtures=[];let tmp;
before(async()=>{
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'three-broad-post-'));const file=path.join(tmp,'original.v8');
 const child=spawnSync(process.execPath,['tests/resident-three-ball-initialization-source-fixture.cjs',file],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
 const data=v8.deserialize(fs.readFileSync(file)),provenance=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.join(root,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 const decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(root,'vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(provenance.wasmPath)),provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const row of data.rows){const admission=await admitThreeBallHost(decoder,row.raw),seed=await createThreeBallCreatedOwnerSeed(admission),owner=await packThreeBallCreatedOwnerTemplate(seed),first=createThreeBallFirstScenePlan(owner),numeric=createThreeBallFirstNumericalPlan(first),cuePlan=createThreeBallFirstCuePlan(numeric),sphere=createThreeBallFirstSpherePlan(cuePlan),postPlan=createThreeBallFirstPostPlan(sphere),plan=createPlan(postPlan),out=await executeThreeBallFirstBroadPostForTest(plan,{testOnly:true});
  if(!out.available){fixtures.push({row,seed,owner,plan,out});continue;}
  // Entire expected broad/journal transaction is a separate original owner.
  // Only ORIGINAL source numerical expectations are used here, never actual
  // resident current/next pose words, graph outputs or broad update traces.
  const token={},cue=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:'original-js-number-v1'}),broad=await Broad.createLiveRegisteredThreeBallReferenceStage(seed.cueBroadSeed),bridge=await Bridge.createReferenceStage(seed.cueBroadSeed);cue.claim(token);broad.claim(token);const journal=Journal.createReferenceStageWithLiveThreeBallCue(seed.contactGraphSeed,broad);journal.claim(token);
  try{const selected=seed.sourceOrigin.selectedIndex,pre=await cue.prepareApplication({selected:copy(seed.balls[selected].state),others:seed.balls.filter((_,i)=>i!==selected).map(b=>copy(b.state))},token),m=pre.metadata,manager=m.initialization.manager;
   const poses=seed.balls.map(b=>({body:copy(b.body),translation:copy(b.state.translation),rotation:copy(b.state.rotation)})),initial={cue:copy(m.preSolveBodies),balls:poses,removedBodies:[],activeBodyOrder:manager.awake_island===null?[]:copy(manager.islands.v[manager.awake_island].bodies)};
   const preReceipt=await broad.prepare(initial,token);await journal.prepare(poses.map(({body,translation})=>({body,translation})),token,preReceipt);journal.narrowTransitions([],token);bridge.begin();await bridge.collision(initial);
   const expected=physical?{states:out.post.cue.numerical.sourceExpected.sphereSolve.map(x=>x.state),scene:out.post.cue.numerical.sourceExpected.observed.context}:out.post.cue.numerical.sourceExpected.postApplication,sourceJoint=out.post.cue.sourceExpected.joint,context=expected.scene,awake=context.manager.awake_island;
   const after={cue:{shaft:copy(sourceJoint.shaft),head:copy(sourceJoint.head)},balls:expected.states.map((s,i)=>({body:copy(seed.balls[i].body),translation:copy(s.translation),rotation:copy(s.rotation)})),removedBodies:[],activeBodyOrder:awake===null?[]:copy(context.manager.islands.v[awake].bodies)};
   const postReceipt=await broad.postSolve(after,token);const sourceBroad=Broad.readReceipt(postReceipt);await journal.postSolve(after.balls.map(({body,translation})=>({body,translation})),token,postReceipt);journal.assertPrepared(token);journal.commit(token);broad.assertPrepared(token);broad.commit(token);await bridge.moved(after);bridge.commit();
   fixtures.push({row,seed,owner,plan,out,sourceAwake:after.activeBodyOrder,sourceBroad,sourceJournal:journal.snapshot(),sourceBvh:bridge.snapshot(),sourceUpdateOrder:after.activeBodyOrder.flatMap(h=>seed.cueBroadSeed.bodyColliders.find(b=>key(b.body)===key(h)).colliders).map(h=>h.index)});
  }finally{bridge.abort();bridge.dispose();journal.abort(token);journal.release(token);journal.dispose();broad.abort(token);broad.release(token);broad.dispose();cue.abort(token);cue.release(token);cue.dispose();}
 }
});
after(()=>{if(tmp)fs.rmSync(tmp,{recursive:true});});

test('actual post-solved poses and source awake/parent order produce exact full BVH and sealed journal',t=>{
 for(const {row,plan,out,sourceBroad,sourceJournal,sourceBvh,sourceUpdateOrder}of fixtures){
  if(!out.available){assert.equal(row.name,'selected-1');assert.equal(out.reason,'current-cue-empty-manifold-owner-unavailable');continue;}
  const a=out.words,d=plan.layout;assertThreeBallFirstBroadPostReceipt(out.receipt);if(physical){assertThreeBallFirstPhysicalBroadPostResult(out,{plan});assert.equal(a[S.header.phase],6);assert.equal(a[d.postControl+3],1);assert.equal(a[d.postControl+4],0);assert.equal(a[d.postControl+6],0);assert.equal(a[d.postControl+7],0);assert.equal(a[d.postControl+5],a[d.postControl+12]);}else{assert.equal(a[S.header.phase],3);assert.throws(()=>assertThreeBallFirstPhysicalBroadPostResult(out,{plan}));}assert.deepEqual(out.bvh,sourceBvh,'all source nodes, parent/free allocator, fat boxes and pending queues');
  const {proxies,cueProxies,...graph}=sourceJournal;assert.deepEqual(out.journal.state,graph,'all ordered adjacency, edges, generations, lifetimes and clocks');
  const proxy=h=>{const p=out.bvh.tree.leaf_node_indices.v[h.index],node=out.bvh.tree.nodes[Math.floor(p/2)][p%2?'right':'left'];return{min:node.mins,max:node.maxs};};
  assert.deepEqual(proxies,plan.template.seed.contactGraphSeed.bodies.map(b=>proxy(b.primary)));assert.deepEqual(cueProxies,sourceBroad.after.proxies.filter(p=>plan.template.seed.contactGraphSeed.cueColliders.some(h=>key(h)===key(p.collider))).map(p=>({collider:p.collider,...proxy(p.collider)})));
  const count=a[d.broad+B.header.updateCount];assert.deepEqual(Array.from({length:count},(_,i)=>a[d.broad+B.updatesOffset+i*8]),sourceUpdateOrder,'current source awake and parent.collider order, not sorted arena slots');assert.equal(a[d.control+4],count);assert.equal(a[d.control+6],1);
  assert.equal(out.journal.phase,0);assert.equal(out.journal.status,0);assert.equal(out.journal.state.sequence,1);assert.equal(a[d.journal+J.header.rosterApplied],1);assert.equal(a[d.broad+B.header.phase],0);
  for(const name of[...(finalMass?[]:['bodies']),'cue','roster','floorCaches']){const q=plan.template.segments[name];assert.deepEqual(a.slice(q.offset,q.offset+q.words),out.before.slice(q.offset,q.offset+q.words),name+' is not rewritten by post broad/owner seal');}assert.deepEqual(a.slice(0,S.words),out.before.slice(0,S.words),'scene queues and clock untouched');
  assert.equal(out.receipt.worldCommitted,false);assert.equal(out.capability.nativeBoundaryVerified,false);assert.equal(out.capability.wholeH,false);
  t.diagnostic(JSON.stringify({fixture:row.name,profile:finalMass?'native-final-mass':physical?'physical-pre-application':'legacy-post-application',updates:count,sourceUpdateOrder,pendingAabbs:out.bvh.pending_set_aabb,journalSequence:1,broadOwnerSealed:true,worldCommitted:false,native:false}));
 }
});
test('finished roster must match graph provenance, generations, lifetimes and awake order before acknowledgement',async()=>{
 const {plan,out}=fixtures.find(x=>x.out.available),d=plan.layout;
 const cases={sequence:a=>a[d.roster+R.header.sequence]=0,revision:a=>a[d.roster+R.header.revision]=1,rosterPhase:a=>a[d.roster+R.header.phase]=2,lifetime:a=>a[d.roster+R.edgeOffset+R.edge.lifeLo]++,generation:a=>a[d.roster+R.edgeOffset+R.edge.c2Generation]++,awake:a=>a[d.roster+R.awakeOffset]=0,activeEpoch:a=>a[d.roster+R.header.activeEpoch]++,journalTransitions:a=>a[d.journal+J.header.changes]=1,prematureAck:a=>a[d.journal+J.header.rosterApplied]=1,missingPost:a=>{if(physical)a[d.postControl+6]=1;else a[d.postControl+7]=0;},missingCcd:a=>a[d.sphereControl+6]=0,staleInitial:a=>a[d.initialBroadControl+3]=0};
 for(const[name,change]of Object.entries(cases)){const a=out.before.slice();change(a);const j=a[d.journal+J.header.rosterApplied];await executeThreeBallFirstBroadPostWordsForTest(plan,a,{testOnly:true});assert.equal(a[d.control+2],4,name);assert.equal(a[d.journal+J.header.phase],3,name);assert.equal(a[d.journal+J.header.rosterApplied],j,name+' cannot forge completed acknowledgement');}
 const wrongBoundary=out.before.slice();wrongBoundary[S.header.phase]=physical?3:6;wrongBoundary[d.postControl+3]=physical?2:1;wrongBoundary[d.postControl+7]=physical?1:0;await executeThreeBallFirstBroadPostWordsForTest(plan,wrongBoundary,{testOnly:true});assert.equal(wrongBoundary[d.control+2],4,'post-application and physical receipts cannot be relabeled');
 const replay=out.words.slice();await executeThreeBallFirstBroadPostWordsForTest(plan,replay,{testOnly:true});assert.equal(replay[d.control+2],4);
});
test('exact generic source mutators and standalone evaluator are reused without new physical equations',()=>{
 for(const{plan}of fixtures){assert.equal(plan.stages.length,finalMass?8:5);assert.deepEqual(plan.commands,[{stage:0},{stages:finalMass?[1,2,3,4,5,6]:[1,2,3],cycles:25},{stage:finalMass?7:4}]);assert.doesNotMatch(plan.stages[0].code,/fn rc_num_eval/);assert.match(plan.stages[2].code,/fn rc_num_eval/);assert.doesNotMatch(plan.stages[finalMass?7:4].code,/fn rc_num_eval/);if(finalMass){assert.doesNotMatch(plan.stages[4].code,/fn rc_num_eval/);assert.match(plan.stages[5].code,/fn rc_num_eval/);assert.doesNotMatch(plan.stages[6].code,/fn rc_num_eval/);}
  for(const name of['rc_world_broad_begin_post','rc_world_broad_commit_post','rc_world_broad_finish']){const all=generateWorldBroadWGSL(),start=all.indexOf('fn '+name+'(');let end=all.indexOf('{',start),depth=1;while(depth){end++;if(all[end]==='{')depth++;if(all[end]==='}')depth--;}assert.ok(plan.source.includes(all.slice(start,end+1)),name+' source bytes');}
 }
});
test('only original plan and privately completed solver chain can yield a local partial-owner receipt',async()=>{
 const {plan,out}=fixtures.find(x=>x.out.available);assertThreeBallFirstBroadPostPlan(plan);assert.throws(()=>createPlan(copy(plan.post)));assert.throws(()=>createPlan(plan.post,{}));await assert.rejects(executeThreeBallFirstFinalMassBroadPostForTest({...plan},{testOnly:true}));if(!finalMass)await assert.rejects(executeThreeBallFirstFinalMassBroadPostForTest(plan,{testOnly:true}));await assert.rejects(executeThreeBallFirstBroadPostForTest(plan));await assert.rejects(executeThreeBallFirstBroadPostForTest(plan,{testOnly:true,poses:[]}));assert.throws(()=>assertThreeBallFirstBroadPostReceipt(copy(out.receipt)));const bad=createPlan(plan.post);bad.initialWords[0]++;assert.throws(()=>assertThreeBallFirstBroadPostPlan(bad),/mutated/);
  assertThreeBallFirstBroadPostResult(out,{plan});assert.throws(()=>assertThreeBallFirstBroadPostResult({...out},{plan}),/identity/);assert.throws(()=>assertThreeBallFirstBroadPostResult(out,{plan:createPlan(plan.post)}),/identity/);if(physical){assertThreeBallFirstPhysicalBroadPostResult(out,{plan});const saved=out.post.words[0];out.post.words[0]++;assert.throws(()=>assertThreeBallFirstPhysicalBroadPostResult(out,{plan}),/mutated/);out.post.words[0]=saved;assertThreeBallFirstPhysicalBroadPostResult(out,{plan});}
  const at=plan.layout.bvh,old=out.words[at];out.words[at]++;assert.throws(()=>assertThreeBallFirstBroadPostReceipt(out.receipt),/mutated/);out.words[at]=old;assertThreeBallFirstBroadPostReceipt(out.receipt);
});


test('native final mass runs once after each original awake parent collider harvest, before BVH publication',async()=>{
 if(!finalMass){for(const {plan,out}of fixtures){assert.equal(plan.finalMass,false);assert.doesNotMatch(plan.source,/fn rc_three_final_mass_/);if(out.available)assert.throws(()=>assertThreeBallFirstFinalMassBroadPostResult(out,{plan}));}return;}
 const {compileMicrocodeWGSL}=await import('../src/resident-candidate/microcode-compiler.mjs'),{createMicrocodeVmReferenceForTest}=await import('../src/resident-candidate/microcode-vm.mjs');
 for(const {plan,out,seed,sourceAwake}of fixtures){if(!out.available)continue;assertThreeBallFirstFinalMassBroadPostResult(out,{plan});const d=plan.layout,a=out.before.slice(),trace=[],compiled=compileMicrocodeWGSL(plan.source,{entry:'rc_three_broad_post_run'}),names=new Map(compiled.functions.map(f=>[f.entryPc,f.name]));
  const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:compiled.instructions,count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,bindings:[a,plan.program,new Uint32Array(1),new Uint32Array(plan.scratchWords),new Uint32Array(1)],onCall({targetPc}){const name=names.get(targetPc);if(name==='rc_world_broad_gather'&&a[d.broad+B.header.cursor]<a[d.broad+B.header.updateCount]){const slot=a[d.broad+B.updatesOffset+a[d.broad+B.header.cursor]*8],p=d.broad+B.colliderOffset+slot*B.colliderStride;trace.push(['bounds',a[p],a[p+1]]);}if(name==='rc_three_final_mass_gather'){const p=S.bodyOffset+a[d.control+10]*S.bodyStride;trace.push(['mass',a[p+S.body.index],a[p+S.body.generation]]);}if(name==='rc_bvh_set_aabbs')trace.push(['publish']);}});vm.begin();let status=1,chunks=0;while(status===1){status=vm.advance(0,65536);assert.ok(++chunks<=4096);}assert.equal(status,2);assert.deepEqual(a,out.words,'traced unchanged emitted-source run');
  const expected=sourceAwake.flatMap(body=>[...seed.cueBroadSeed.bodyColliders.find(b=>key(b.body)===key(body)).colliders.map(c=>['bounds',c.index,c.generation]),['mass',body.index,body.generation]]);expected.push(['publish']);assert.deepEqual(trace,expected,'source active_bodies/parent collider order, not grouped mass after all bounds');assert.equal(a[d.massState+2],1);assert.equal(a[d.massState+3],3);assert.equal(a[d.massState+4],sourceAwake.length);assert.equal(a[d.massState+5],1);assert.equal(a[d.control+11],sourceAwake.length);
  for(let row=0;row<5;row++)for(let k=0;k<64;k++)if(!((k>=13&&k<=24)||(k>=59&&k<=61)))assert.equal(a[d.bodies+row*64+k],out.before[d.bodies+row*64+k],'only native mass/COM fields may change');assert.notDeepEqual(a.slice(d.bodies+3*64+59,d.bodies+3*64+62),out.before.slice(d.bodies+3*64+59,d.bodies+3*64+62),'native final shaft COM differs from deliberately stale component boundary');
  for(const mutate of [w=>w[d.control+9]=1,w=>w[d.massState+2]=4,w=>w[d.massState+4]=1,w=>w[d.massState+5]=1]){const bad=out.before.slice();mutate(bad);await executeThreeBallFirstBroadPostWordsForTest(plan,bad,{testOnly:true});assert.equal(bad[d.control+2],4);assert.equal(bad[d.journal+J.header.phase],3);}
 }
});
