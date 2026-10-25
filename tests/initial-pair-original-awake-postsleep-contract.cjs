'use strict';
// SPDX-License-Identifier: Apache-2.0
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./initial-pair-original-awake-postsleep-fixture.cjs'),G=require('./initial-pair-original-awake-postsleep-controller.cjs'),F=require('./four-ball-created-fixture.cjs');
test('awake retained-pair oracle isolates the original stationarity gate without changing shot settings',()=>{
 G.validateInput(C.INPUT);assert.equal(G.SCHEMA,'original-controller-four-ball-awake-pair-holdout-v1');assert.equal(C.SCHEMA,'original-controller-awake-retained-pair-four-ball-oracle-v2');
 assert.equal(C.INPUT.requiredOutcome,'retained-pair-native-sleep');assert.deepEqual(F.SETTINGS,{angle:0,elevation:8,tipX:0,tipY:0,speed:2});
 const a=C.INPUT.placements.find(p=>p.id===3),b=C.INPUT.placements.find(p=>p.id===4),cue=C.INPUT.placements.find(p=>p.id===1);
 assert.ok(b.x-a.x>C.GEOMETRY.diameter);assert.ok(b.x-a.x<C.GEOMETRY.diameter+C.GEOMETRY.predictionDistance);assert.equal(a.z,b.z);assert.ok(Math.abs(cue.z-a.z)>.6);
 assert.ok(C.SOURCES.every(p=>!p.includes('experimental')&&!p.includes('import')));
});
test('actual original fire admits byte-backed awake stationarity and the retained pair naturally sleeps together and persists through two more original h',{skip:!process.env.INITIAL_PAIR_AWAKE_POSTSLEEP_ORACLE},()=>{
 const p=C.load(process.env.INITIAL_PAIR_AWAKE_POSTSLEEP_ORACLE),r=p.record,b=r.boundaries,initial=b.goalStrikeCreated,ready=initial.sourceReadiness;
 assert.equal(p.manifest.probe,false);assert.equal(r.status,'native-retained-pair-sleep-persistence-complete');assert.equal(r.requiredOutcomeObserved,true);
 assert.equal(r.settleOuter,4);assert.equal(initial.nativeSteps,76);assert.equal(initial.snapshotSha256,'fd896f235ab65f9e38ca45951b74ef9ccbd299dbc9d2279c34a95b93bc7783d6');
 assert.deepEqual(r.placements.map(x=>[x.id,x.accepted,x.position]),C.INPUT.placements.map(x=>[x.id,true,{x:x.x,y:.0308,z:x.z}]));assert.deepEqual(r.settings,F.SETTINGS);assert.deepEqual(r.control.settings,F.SETTINGS);
 assert.equal(r.control.fireAccepted,true);assert.equal(r.control.clearance.clear,true);assert.deepEqual(r.sourceMotionGate.observations,[{phase:'goalStrikeCreation',result:false}]);assert.equal(r.sourceMotionGate.sourceFunctionSha256,F.hash(PhysicsLab.prototype.anyMotion.toString()));
 assert.deepEqual(Object.keys(ready).sort(),['kind','sourceSchema','initialSnapshotSha256','anyMotion','fireAccepted','bodies'].sort());
 assert.equal(ready.kind,'original-controller-motionless-awake-fire');assert.equal(ready.sourceSchema,G.SCHEMA);assert.equal(ready.initialSnapshotSha256,initial.snapshotSha256);assert.equal(ready.anyMotion,false);assert.equal(ready.fireAccepted,true);
 assert.deepEqual(ready.bodies.map(x=>[x.body.index,x.sleeping,x.linear,x.angular]),[16,17,18,19].map(id=>[id,false,[0,0,0],[0,0,0]]));
 assert.deepEqual(initial.contactPairs.map(x=>[x.collider1.index,x.collider2.index]),[[0,16],[0,20],[0,18],[0,22],[21,23]]);
 const initialPair=initial.contactPairs.at(-1),m=initialPair.contacts.value.manifolds[0];assert.equal(m.points.length,1);assert.equal(m.data.solver_contacts.length,1);assert.equal(m.points[0].data.impulse,0);assert.ok(initialPair.contacts.value.recycle_state);
 assert.ok(p.transitions.every(t=>t.contacts.some(c=>C.isTarget(c)&&c.active)));assert.equal(p.milestones.cueWithdrawal.h,440);assert.equal(p.milestones.firstRetainedPairSleep.h,922);
 assert.deepEqual(p.sleepTransitions,[{h:922,sleeping:[[1,false],[2,true],[3,true],[4,true]],cuePresent:false}]);
 const end=b.retainedPairSleepPersistence,endPair=end.contactPairs.find(x=>x.collider1.index===21&&x.collider2.index===23),island=end.state.islands.persistent.islands.v.find(x=>x&&x.bodies.some(b=>b.index===18));
 assert.ok(endPair.contacts.value.manifolds[0].data.solver_contacts.length>0);assert.deepEqual(island.bodies.map(x=>x.index),[18,19]);assert.equal(island.sleeping,true);
 const persisted=p.rows.filter(row=>row.hCount>=922&&row.boundary.endsWith('-postApplication'));
 assert.deepEqual(persisted.map(row=>row.hCount),[922,923,924]);
 const caches=persisted.map(row=>row.contactPairs.find(x=>x.collider1.index===21&&x.collider2.index===23));
 assert.deepEqual(caches[1],caches[0]);assert.deepEqual(caches[2],caches[0],'Preserve the complete genuine dormant-contact cache, not just activity');
 for(const cache of caches){const rigid=cache.contacts.value,manifold=rigid.manifolds[0];
  assert.equal(cache.event_status,1);assert.equal(rigid.solver_color,0);assert.deepEqual(rigid.solver_color_bodies,[18,19]);assert.ok(rigid.recycle_state);
  assert.equal(manifold.data.graph_pos,0xffffffff,'Native sleep clears solver-graph membership');
  assert.deepEqual(manifold.data.solver_body_ids,[2,3],'Native sleep DOES NOT clear or rewrite cached pre-sleep solver-body hints');
  assert.equal(manifold.data.solver_contacts.length,1);assert.equal(manifold.points[0].data.impulse,0);
 }
 for(const row of persisted)assert.deepEqual(row.bodies.filter(x=>[18,19].includes(x.handle.index)).map(x=>[x.handle.index,x.activation.sleeping,x.ids.active_set_id]),[[18,true,0],[19,true,1]],'Sleeping-body storage compacts without rewriting cached solver hints');
 assert.equal(r.hCount,924);assert.equal(r.firstPairSleepH,922);assert.equal(r.pairSleepPersistenceH,924);assert.equal(r.outerSteps,483);assert.equal(r.firstPairSleepOuter,481);assert.equal(r.score,null);assert.equal(b.physicalRest,undefined);assert.equal(b.controllerFinished,undefined);assert.ok(end.application.game.pending,'Do not finalize the still-moving unrelated cue shot');
 assert.deepEqual(p.setterCalls,[]);assert.equal(r.nativeRestoreUsed,false);assert.equal(r.candidateStateUsed,false);assert.deepEqual(Object.values(b).filter(x=>x.candidateInput).map(x=>x.boundary),['goalStrikeCreated']);assert.ok(p.rows.every(x=>x.candidateInput===false));
 assert.deepEqual([...new Set(p.rows.map(x=>x.hCount))],[1,2,439,440,441,921,922,923,924]);assert.equal(p.rows.length,27);assert.deepEqual(p.assertions,p.rows.map(C.projection));
 assert.equal(p.observerAgreement.independentOriginalRecreations,3);assert.equal(p.observerAgreement.unobservedOriginalAgreement,true);assert.equal(p.observerAgreement.byteIdenticalBoundaryCount,Object.keys(b).length+p.rows.length);
});
test('bounded extension preserves every frozen v1 native boundary and existing assertion row',{skip:!process.env.INITIAL_PAIR_AWAKE_POSTSLEEP_ORACLE||!process.env.INITIAL_PAIR_AWAKE_V1_ORACLE},()=>{
 const fs=require('node:fs'),v8=require('node:v8'),read=file=>{const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(F.hash(bytes),manifest.sha256);return v8.deserialize(bytes);};
 const old=read(process.env.INITIAL_PAIR_AWAKE_V1_ORACLE),now=read(process.env.INITIAL_PAIR_AWAKE_POSTSLEEP_ORACLE);
 for(const [name,row]of Object.entries(old.record.boundaries)){assert.deepEqual(now.record.boundaries[name].snapshot,row.snapshot);assert.deepEqual(now.record.boundaries[name].application,row.application);}
 for(const row of old.rows){const found=now.rows.find(x=>x.boundary===row.boundary);assert.ok(found);assert.deepEqual(found.snapshot,row.snapshot);assert.deepEqual(found.application,row.application);}
 assert.deepEqual(now.record.boundaries.goalStrikeCreated.sourceReadiness,old.record.boundaries.goalStrikeCreated.sourceReadiness);
 assert.deepEqual(now.record.frames.slice(0,old.record.frames.length),old.record.frames);assert.deepEqual(now.applicationImpulseJournal.slice(0,old.applicationImpulseJournal.length),old.applicationImpulseJournal);
 assert.equal(old.record.hCount,922);assert.equal(now.record.hCount,924);
});
