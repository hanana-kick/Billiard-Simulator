'use strict';
// SPDX-License-Identifier: Apache-2.0
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const O=require('./elevated-flight-original-cue-removal-events.cjs'),C=require('./elevated-flight-original-fixture.cjs'),F=require('./four-ball-created-fixture.cjs');
test('original raw cue-withdrawal observer covers the immediately adjacent native steps',()=>assert.deepEqual(O.HS,[463,464]));
test('original drain emits only ordered cloth-tip stop on withdrawal, without observable native flag claims',{skip:!process.env.ELEVATED_FLIGHT_REMOVAL_EVENTS_ORACLE},()=>{
 const file=process.env.ELEVATED_FLIGHT_REMOVAL_EVENTS_ORACLE,bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json')),p=v8.deserialize(bytes);assert.equal(F.hash(bytes),manifest.sha256);assert.equal(bytes.length,manifest.bytes);assert.deepEqual(p.identity,C.identity());assert.equal(p.observerSha256,F.hash(fs.readFileSync(require.resolve('./elevated-flight-original-cue-removal-events.cjs'))));assert.equal(p.nativeRemovedFlagExposed,false);assert.equal(p.candidateInput,false);assert.equal(p.classification,'reachable-ui-accepted-actually-obstructed-stroke');
 assert.deepEqual(p.observerAgreement,{threeOriginalRecreations:true,queueInspectionOnOffSnapshotsByteIdentical:true,unobservedOriginalBoundariesByteIdentical:true,applicationEventsAndGameExact:true});
 assert.deepEqual(p.summary.targetDrains,[{h:463,order:462,events:[]},{h:464,order:463,events:[{h:464,order:2,drainOrder:463,orderWithinDrain:0,collider1:{index:0,generation:0},collider2:{index:25,generation:0},started:false}]}]);
 assert.ok(p.events.every(e=>!Object.hasOwn(e,'flags')&&!Object.hasOwn(e,'removed')));assert.equal(p.summary.initialSnapshotSha256,'bade93c4b1021ffc1531057cbbf35e18fa368e586ec2654a01093e304a52ccfb');assert.equal(p.summary.hCount,5346);assert.equal(p.summary.firstRestOuter,4842);assert.deepEqual(p.summary.score,{cueId:1,delta:0,nextCue:2});
 const row=(h,phase)=>p.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-'+phase));assert.equal(p.rows.length,8);for(const r of p.rows){assert.equal(r.candidateInput,false);assert.equal(F.hash(r.snapshot),r.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(r.typedState),Buffer.from(r.snapshot));}
 for(const h of O.HS){assert.deepEqual(row(h,'postWorld').snapshot,row(h,'postDrain').snapshot);assert.deepEqual(row(h,'postDrain').snapshot,row(h,'postApplication').snapshot);}
 assert.deepEqual(row(464,'preWorld').queues.removedColliders.map(h=>h.index),[25,26,24]);assert.deepEqual(row(464,'postWorld').queues.removedColliders,[]);
 assert.equal(row(463,'postApplication').state.narrow_phase.body_solver_color_masks[21],1n<<127n);assert.equal(row(464,'postApplication').state.narrow_phase.body_solver_color_masks[21],1n<<127n);
});
