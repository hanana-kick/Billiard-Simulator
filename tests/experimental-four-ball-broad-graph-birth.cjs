'use strict';
// Frozen original-controller artifact oracle; no native initialize/step/decode.
// Candidate consumes strikeCreated and creation journals only. PostWorld is
// assertion-only. Held initial poses are a component test, not rigid-body solve.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const Module=require('node:module'),loaded=new Map(),compile=Module.prototype._compile;
Module.prototype._compile=function(source,file){if(/\/(src\/experimental-|tests\/.*(?:fixture|seed|birth)\.cjs|tools\/rapier-snapshot-decoder)/.test(file))loaded.set(file,crypto.createHash('sha256').update(source).digest('hex'));return compile.call(this,source,file);};
const F=require('./four-ball-created-fixture.cjs'),E=require('./four-ball-broad-graph-seed.cjs'),C=require('../src/experimental-cue-broad-phase'),J=require('../src/experimental-contact-graph-journal'),B=require('../src/experimental-cue-bvh-insertion'),A=require('../src/experimental-arithmetic-graph');
const copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation,identity=({active,...e})=>e,poses=o=>o.balls.map(b=>({body:copy(b.body),translation:copy(b.translation)}));
let record,manifest,input,seeds,expected;
before(()=>{
 assert.ok(process.env.FOUR_BALL_CREATION_REPLAY,'Explicit frozen FOUR_BALL_CREATION_REPLAY required');
 ({record,manifest}=F.loadArtifact(process.env.FOUR_BALL_CREATION_REPLAY));
 assert.equal(manifest.sha256,'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187');
 input={strikeCreated:record.boundaries.strikeCreated,modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal};
 seeds=E.exportInitialSeeds(input);expected=E.graphView(record.boundaries['firstH.postWorld']);
});
after(()=>{for(const[file,hash]of loaded)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'source bytes frozen: '+file);Module.prototype._compile=compile;});
async function stages(device){const broad=device?await C.createInitialFourBallGpuStage(device,seeds.broadSeed):await C.createInitialFourBallReferenceStage(seeds.broadSeed),journal=device?await J.createGpuStageWithInitialFourBallCue(device,seeds.graphSeed,broad):J.createReferenceStageWithInitialFourBallCue(seeds.graphSeed,broad),token={};broad.claim(token);journal.claim(token);return{broad,journal,token,close(){journal.abort(token);broad.abort(token);journal.release(token);broad.release(token);journal.dispose();broad.dispose();}};}
async function allocation(device,t){const x=await stages(device),{broad,journal,token}=x;try{
 assert.equal(journal.snapshot().proxies[3],null);assert.equal(broad.snapshot().proxies.length,22);assert.equal(journal.snapshot().edges.length,3);
 const initial=journal.snapshot(),pre=await broad.prepare(copy(seeds.own),token),bv=C.readReceipt(pre);
 assert.deepEqual(bv.initialDiagnostics.inserted,[22,23,24,25,26]);assert.equal(bv.initialDiagnostics.finalLeafCount,27);assert.equal(bv.initialDiagnostics.rotations,6);assert.equal(bv.initialDiagnostics.candidateCount,7);
 assert.deepEqual(bv.events.map(e=>[e.collider1.index,e.collider2.index]),[[6,24],[5,24],[0,22]]);
 for(const key of['parents','leaf_node_indices','free_wide_nodes','optimization'])assert.deepEqual(bv.after.initialTree[key],record.boundaries['firstH.postWorld'].state.broad_phase.tree[key],'source insertion integer topology '+key);
 for(const index of[22,23]){const actual=bv.after.proxies.find(p=>p.collider.index===index),want=record.boundaries['firstH.postWorld'].proxies.find(p=>p.index===index);assert.deepEqual({min:actual.min,max:actual.max},{min:want.min,max:want.max},'new sphere exact first insertion bounds');}
 await assert.rejects(()=>journal.prepare(poses(seeds.own),token,copy(pre)),/origin-bound/);assert.deepEqual(journal.snapshot(),initial);
 const p=await journal.prepare(poses(seeds.own),token,pre);
 assert.deepEqual(p.graph.edges.map(identity),expected.edges.map(identity),'complete native dense graph identity and event order');assert.deepEqual(p.graph.adjacency,expected.adjacency,'source prepend adjacency');assert.equal(p.graph.edges[5].active,false,'allocation does not impersonate active native fourth cloth narrow phase');assert.equal(expected.edges[5].active,true,'native full first-h boundary additionally owns active fourth cloth');
 const rv=J.viewReceipt(p.receipt);assert.equal(rv.initialFourBallBirth.scope,'initial-broad-and-contact-graph-allocation-only');assert.equal(rv.initialFourBallBirth.postCollisionManagerComplete,false);assert.equal(rv.initialFourBallBirth.activeFourthClothCacheOwned,false);assert.deepEqual(rv.changes.map(c=>c.edgeId),[3,4,5]);
 journal.narrowTransitions([],token);const post=await broad.postSolve(copy(seeds.own),token),bad=poses(seeds.own),beforePost=J.viewReceipt(p.receipt).after;bad[3].translation[0]=Math.fround(bad[3].translation[0]+.2);
 await assert.rejects(()=>journal.postSolve(bad,token,post),/sphere fat proxy/);assert.deepEqual(J.viewReceipt(p.receipt).after,beforePost,'failed N4 post is atomic');await journal.postSolve(poses(seeds.own),token,post);journal.assertPrepared(token);broad.assertPrepared(token);journal.commit(token);broad.commit(token);
 assert.throws(()=>C.assertReceipt(pre,broad,device?'webgpu':'cpu-reference'),/origin-bound/);assert.equal(journal.snapshot().sequence,1);
 const secondPre=await broad.prepare(copy(seeds.own),token);assert.equal(C.readReceipt(secondPre).initialFourBallBirth,undefined,'initial birth provenance cannot recur');const second=await journal.prepare(poses(seeds.own),token,secondPre);assert.deepEqual(second.broadPhaseEvents,[]);assert.equal(J.viewReceipt(second.receipt).initialFourBallBirth,undefined);journal.narrowTransitions([],token);await journal.postSolve(poses(seeds.own),token,await broad.postSolve(copy(seeds.own),token));journal.commit(token);broad.commit(token);
 t.diagnostic(JSON.stringify({backend:device?'webgpu':'cpu-reference',initialProxies:22,insertedProxies:5,denseEdges:6,sourceNewEdgeOrder:[[6,24],[5,24],[0,22]],heldPoseComponentTransactions:2,scope:'initial broad and graph allocation; fourth active cloth cache and full first h NOT owned'}));
 }finally{x.close();}}
let referencePassed=false;
test('original N4 first insertion owns exact native broad/graph birth without expected-state reseeding',async t=>{await allocation(null,t);referencePassed=true;});
test('actual WGSL N4 birth preserves independent native source event order and exact new proxy',{timeout:90000,skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1'},async t=>{assert.equal(referencePassed,true);assert.ok(process.env.GPU_NATIVE_MODULE);const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();try{await allocation(device,t);}finally{device.destroy();}});
test('old factories do not admit a fresh fourth sphere through aliases or invented proxy caches',async()=>{
 await assert.rejects(()=>C.createReferenceStage(seeds.broadSeed),/creation phase/);
 const b=await C.createInitialFourBallReferenceStage(seeds.broadSeed);try{
 assert.throws(()=>J.createReferenceStageWithCue(seeds.graphSeed,b),/elapsed-zero/);assert.throws(()=>J.createReferenceStage(seeds.graphSeed),/bounded three or four/);
 const changed=copy(seeds.graphSeed);Object.assign(changed.bodies[3],changed.bodies[0]);assert.throws(()=>J.createReferenceStageWithInitialFourBallCue(changed,b),/Distinct original dynamic|Unregistered dynamic/);
 const fabricated=copy(seeds.graphSeed);Object.assign(fabricated.bodies[3],{min:[0,0,0],max:[1,1,1]});assert.throws(()=>J.createReferenceStageWithInitialFourBallCue(fabricated,b),/genuinely absent/);
 const missing=copy(seeds.graphSeed);delete missing.bodies[3].proxyAbsent;assert.throws(()=>J.createReferenceStageWithInitialFourBallCue(missing,b),/genuinely absent/);
 const changedExisting=copy(seeds.graphSeed);changedExisting.bodies[0].min[0]=Math.fround(changedExisting.bodies[0].min[0]-.1);assert.throws(()=>J.createReferenceStageWithInitialFourBallCue(changedExisting,b),/proxy presence/);
 }finally{b.dispose();}
});
test('initial seed strictly excludes pre/post native first-h and verifies typed source state',()=>{
 assert.throws(()=>E.exportInitialSeeds({...input,strikeCreated:record.boundaries['firstH.preWorld']}),/strikeCreated/);assert.throws(()=>E.exportInitialSeeds({...input,strikeCreated:record.boundaries['firstH.postWorld']}),/strikeCreated/);
 const changed=copy(input);changed.strikeCreated.bodies[19].pos.position.translation[0]=0;assert.throws(()=>E.exportInitialSeeds(changed));
 const changedTyped=copy(input);const n=[...F.D.walk(changedTyped.strikeCreated.typedState)].find(n=>n.kind==='float');n.bits=n.bits==='00000000'?'3f800000':'00000000';assert.throws(()=>E.exportInitialSeeds(changedTyped));
});
test('creation journal, five insertion order, actual fourth identity and absent proxies are required',()=>{
 for(const mutate of[
  s=>s.modifiedColliders.reverse(),
  s=>s.initialFourBallBirth.modeCreationJournal[1].result.handle.generation++,
  s=>s.initialFourBallBirth.modeCreationJournal[1].args[0].fields.shape.fields.radius=.1,
  s=>s.initialFourBallBirth.strikeCreationJournal[0].nativeStepsBefore++,
  s=>s.initialFourBallBirth.modeCreationJournal.pop(),
  s=>s.initialFourBallBirth.body=s.roles.ball,
  s=>s.initialFourBallBirth.primary=s.modifiedColliders[2],
  s=>s.initialBroadPhase.tree.leaf_node_indices.n=27,
  s=>s.initialFourBallBirth.clothCollider={index:1,generation:0},
  s=>delete s.initialFourBallBirth
 ]){const altered=copy(seeds.broadSeed);mutate(altered);assert.throws(()=>C.validateInitialFourBall(altered));}
});
test('aborted and cross-origin broad receipts never authorize initial fourth birth',async()=>{
 const a=await stages(null),b=await stages(null);try{const pa=await a.broad.prepare(copy(seeds.own),a.token),pb=await b.broad.prepare(copy(seeds.own),b.token),initial=a.journal.snapshot();await assert.rejects(()=>a.journal.prepare(poses(seeds.own),a.token,pb),/origin-bound/);a.broad.abort(a.token);await assert.rejects(()=>a.journal.prepare(poses(seeds.own),a.token,pa),/origin-bound/);assert.deepEqual(a.journal.snapshot(),initial);}finally{a.close();b.close();}
});
test('unowned fourth cloth cannot activate or lose pending state by deleting labels',async()=>{
 const x=await stages(null),{broad,journal,token}=x;try{
  const projection=journal.createProjection(token);assert.throws(()=>J.assertFourthClothBirthOwned(projection,'cpu-reference'),/not owned/);
  const pre=await broad.prepare(copy(seeds.own),token),p=await journal.prepare(poses(seeds.own),token,pre),born=copy(p.graph.edges[5]),before=J.viewReceipt(p.receipt);
  delete p.graph.pendingCollisionBirth;born.active=true;const altered=J.viewReceipt(p.receipt);delete altered.initialFourBallBirth;delete altered.pendingCollisionBirth;delete altered.after.pendingCollisionBirth;
  assert.throws(()=>journal.narrowTransitions([born],token),/owned numerical birth receipt/);assert.deepEqual(J.viewReceipt(p.receipt),before,'rejected activation leaves every transaction field unchanged');
  const claimed={...born,activeFourthClothCacheOwned:true,postCollisionManagerComplete:true,cache:copy(record.boundaries['firstH.postWorld'].contactPairs.at(-1))};assert.throws(()=>journal.narrowTransitions([claimed],token),/owned numerical birth receipt/);assert.deepEqual(J.viewReceipt(p.receipt),before,'native expected cache cannot be injected as a transition');
  journal.narrowTransitions([],token);await journal.postSolve(poses(seeds.own),token,await broad.postSolve(copy(seeds.own),token));const advanced=J.projectReceipts([p.receipt],projection,'cpu-reference');delete advanced.state.pendingCollisionBirth;assert.throws(()=>J.assertFourthClothBirthOwned(advanced.projection,'cpu-reference'),/not owned/);assert.throws(()=>J.assertFourthClothBirthOwned(copy(advanced.projection),'cpu-reference'),/origin-bound/);
  journal.commit(token);broad.commit(token);const current=journal.createProjection(token),snapshot=J.projectionSnapshot(current);delete snapshot.pendingCollisionBirth;assert.throws(()=>J.assertFourthClothBirthOwned(current,'cpu-reference'),/not owned/);assert.equal(journal.snapshot().pendingCollisionBirth.postCollisionManagerComplete,false);
  const nextPre=await broad.prepare(copy(seeds.own),token),next=await journal.prepare(poses(seeds.own),token,nextPre);assert.equal(J.viewReceipt(next.receipt).pendingCollisionBirth.activeFourthClothCacheOwned,false);assert.throws(()=>journal.narrowTransitions([born],token),/owned numerical birth receipt/,'later sequences cannot bypass initial numerical ownership');
 }finally{x.close();}
});
test('later new noncue overlap remains rejected and never publishes graph state',async()=>{
 const x=await stages(null),{broad,journal,token}=x;try{let pre=await broad.prepare(copy(seeds.own),token);await journal.prepare(poses(seeds.own),token,pre);journal.narrowTransitions([],token);let moved=copy(seeds.own);moved.balls[3].translation=copy(moved.balls[2].translation);const post=await broad.postSolve(moved,token);await journal.postSolve(poses(moved),token,post);journal.commit(token);broad.commit(token);const beforeBroad=broad.snapshot(),beforeGraph=journal.snapshot();await assert.rejects(()=>broad.prepare(moved,token),/Unsupported new pair requires source-owned BVTT and exact contact owner/);assert.deepEqual(broad.snapshot(),beforeBroad);assert.deepEqual(journal.snapshot(),beforeGraph);}finally{x.close();}
});
test('five-insert source BVTT is geometric and preserves order under sparse leaf renaming',async()=>{
 const broad=await C.createInitialFourBallReferenceStage(seeds.broadSeed);try{const view=C.readReceipt(await broad.prepare(copy(seeds.own))),updates=seeds.broadSeed.modifiedColliders.map(h=>{const p=view.after.proxies.find(p=>same(p.collider,h));return{leaf:h.index,box:{min:p.min,max:p.max}};}),math={score:async rows=>rows.map(({a,b})=>A.execute(Float32Array.from([...a.min,...a.max,a.count,...b.min,...b.max,b.count]),C.PLANS.score)[0]),difference:async rows=>rows.map(r=>A.execute(Float32Array.from(r),C.PLANS.difference)[0])},original=await B.firstInsert(seeds.broadSeed.initialBroadPhase.tree,updates,math),map=new Map([[22,61],[23,59],[24,57],[25,55],[26,53]]),renamed=await B.firstInsert(seeds.broadSeed.initialBroadPhase.tree,updates.map(u=>({...u,leaf:map.get(u.leaf)})),math);assert.deepEqual(renamed.candidates,original.candidates.map(p=>p.map(h=>map.get(h)??h)));assert.deepEqual(renamed.diagnostics.inserted,[61,59,57,55,53]);assert.equal(renamed.diagnostics.rotations,original.diagnostics.rotations);}finally{broad.abort();broad.dispose();}
});
