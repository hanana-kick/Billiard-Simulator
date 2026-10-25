'use strict';
// SPDX-License-Identifier: Apache-2.0
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./elevated-flight-original-fixture.cjs'),G=require('./elevated-flight-original-controller.cjs');
test('elevated-flight input is original UI-valid geometry, not ball velocity injection',()=>{
 G.validateInput(C.INPUT);assert.deepEqual(G.SETTINGS,{angle:0,elevation:20,tipX:0,tipY:-.88,speed:2});
 assert.ok(G.SETTINGS.speed>=.25&&G.SETTINGS.speed<=5);assert.ok(G.SETTINGS.elevation>=0&&G.SETTINGS.elevation<=85);assert.ok(Math.hypot(G.SETTINGS.tipX,G.SETTINGS.tipY)<=.92);
 assert.equal(C.GEOMETRY.placementY,C.GEOMETRY.radius+.00005);
 const e=G.SETTINGS.elevation*Math.PI/180,y=G.SETTINGS.tipY,surfaceY=y*Math.cos(e)+Math.sqrt(1-y*y)*Math.sin(e);
 assert.ok(surfaceY<0,'Original contact normal points partly upward');
 assert.ok(.03068251721560955+(C.GEOMETRY.radius+C.GEOMETRY.tipRadius)*surfaceY>C.GEOMETRY.tipRadius,'Derived swept tip clears cloth; actual controller clearance still required');
 assert.ok(C.SOURCES.every(p=>!p.includes('experimental')&&!p.includes('import')));
});
test('floor lifecycle projection distinguishes retained empty pair from deleted pair',()=>{
 const contact=(points,active,positive)=>({kind:'cloth',ids:[1],active,positive,manifolds:[{points}]});
 assert.deepEqual(C.targetState([contact(1,true,true)]),{pair:true,points:1,active:true,positive:true});
 assert.deepEqual(C.targetState([contact(0,false,false)]),{pair:true,points:0,active:false,positive:false});
 assert.deepEqual(C.targetState([]),{pair:false,points:0,active:false,positive:false});
 assert.deepEqual(C.selectedHs({record:{hCount:10},maxHeight:{h:5},milestones:{departure:{h:3}},sleepTransitions:[{h:10}]}),[1,2,3,4,5,6,9,10]);
});
test('original elevated stroke proves cloth cache death/rebirth, native landing, untouched application impulses and native game rest',{skip:!process.env.ELEVATED_FLIGHT_ORACLE},()=>{
 const p=C.load(process.env.ELEVATED_FLIGHT_ORACLE),r=p.record,initial=r.boundaries.goalStrikeCreated;
 assert.equal(initial.snapshotSha256,'bade93c4b1021ffc1531057cbbf35e18fa368e586ec2654a01093e304a52ccfb');assert.equal(p.rows.length,75);
 assert.equal(p.manifest.probe,false);assert.equal(p.observerAgreement.independentOriginalRecreations,3);assert.equal(p.observerAgreement.unobservedOriginalAgreement,true);
 assert.deepEqual(r.placements.map(x=>[x.id,x.method,x.accepted,x.position.y]),[1,2,3,4].map(id=>[id,'LabController.move',true,.0308]));
 assert.deepEqual(r.placements.map(x=>x.after.translation),C.INPUT.placements.map(x=>[x.x,.0308,x.z].map(Math.fround)));
 assert.deepEqual(r.settings,G.SETTINGS);assert.equal(r.control.clearance.clear,true);assert.equal(r.control.clearance.distance,.00026291701942682266);assert.deepEqual(p.setterCalls,[]);
 const expected={firstImpulseLoss:377,firstActiveDeath:425,firstPointDeath:425,cueWithdrawal:464,firstPairDeath:515,firstPairBirthAfterFlight:677,firstPointBirthAfterFlight:680,firstActiveBirthAfterFlight:680,firstPositiveLanding:680};
 assert.deepEqual(Object.fromEntries(Object.entries(p.milestones).map(([k,m])=>[k,m.h])),expected);
 assert.equal(p.milestones.firstActiveDeath.cuePresent,true);assert.equal(p.milestones.firstPairDeath.cuePresent,false);assert.equal(p.milestones.firstPositiveLanding.cuePresent,false);
 assert.equal(p.maxHeight.h,594);assert.equal(p.maxHeight.ball.translation[1],.0681011751294136);
 assert.equal(p.milestones.firstPositiveLanding.ballBeforeWorld.linear[1],-.8645118474960327);assert.equal(p.milestones.firstPositiveLanding.ball.linear[1],.17290237545967102);
 const initialFloor=p.initialContacts.find(C.isTarget),at=h=>p.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-postWorld')),pair=h=>C.nativeContact(at(h),initialFloor),parts=c=>c.contacts.value.manifolds.map(m=>[m.points.length,m.data.solver_contacts.length]);
 assert.deepEqual(parts(pair(425)),[[0,0]]);assert.equal(pair(515),undefined);assert.deepEqual(parts(pair(677)),[[0,0]]);assert.deepEqual(parts(pair(680)),[[1,1]]);
 assert.equal(r.settleOuter,484);assert.equal(r.firstRestOuter,4842);assert.equal(r.hCount,5346);assert.deepEqual(r.score,{cueId:1,delta:0,nextCue:2});
 assert.deepEqual(p.sleepTransitions.map(s=>[s.h,s.sleeping.map(x=>x[1])]),[[377,[false,true,true,true]],[5346,[true,true,true,true]]]);
 assert.deepEqual(r.strikeCreationJournal.map(x=>x.method),G.CUE_METHODS);assert.ok(r.strikeCreationJournal.every(x=>x.nativeStepsBefore===initial.nativeSteps&&x.nativeStepsAfter===initial.nativeSteps));
 const obstruction=r.events.filter(e=>e.event.kind==='cue-obstruction');assert.equal(obstruction.length,1);assert.equal(obstruction[0].hCountBeforeApplication+1,389);assert.equal(obstruction[0].event.part,'tip');assert.equal(obstruction[0].event.label,'테이블 천');assert.equal(obstruction[0].event.impulse,.02441287226974964);
 // UI-domain acceptance is not search validity: the original optimizer rejects this event.
 assert.deepEqual(r.boundaries.physicalRest.snapshot,r.boundaries.controllerFinished.snapshot);assert.equal(r.boundaries.controllerFinished.application.game.pending,null);
});
