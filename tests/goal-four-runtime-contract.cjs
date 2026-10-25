'use strict';
// SPDX-License-Identifier: Apache-2.0
// Light fail-closed origin contracts. No native capture/restore, source artifact,
// numerical stepping, GPU dispatch, or positive numerical-admission claim.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Init=require('../src/experimental-cue-initialization'),Broad=require('../src/experimental-cue-broad-phase'),Journal=require('../src/experimental-contact-graph-journal'),Pair=require('../src/experimental-pair-contact-stage'),Cushion=require('../src/experimental-cushion-contact-stage');
const text=name=>fs.readFileSync(require.resolve('../src/'+name),'utf8');
test('genuine placed-goal factories exist independently of the second-turn factories',()=>{
 for(const [api,names]of[[Init,['initializePlacedGoalFourBallUserChanges','finishPlacedGoalFourBallCollisionPhase','initializeSettledFourBallUserChanges','finishSettledFourBallCollisionPhase']],[Broad,['validatePlacedGoalFourBall','createPlacedGoalFourBallReferenceStage','createPlacedGoalFourBallGpuStage','validateSettledFourBall']],[Journal,['assertInitialPlacedGoalCollisionOwned','createReferenceStageWithPlacedGoalFourBallCue','createGpuStageWithPlacedGoalFourBallCue','assertInitialSettledCollisionOwned']],[Pair,['createReferencePlacedGoalFourBallStage','createGpuPlacedGoalFourBallStage','createReferenceSettledFourBallStage']],[Cushion,['createReferencePlacedGoalFourBallStage','createGpuPlacedGoalFourBallStage','createReferenceSettledFourBallStage']]])for(const name of names)assert.equal(typeof api[name],'function',name);
});
test('each broad origin rejects the other origin before accepting any geometry',()=>{
 for(const [validate,kind,phase]of[[Broad.validatePlacedGoalFourBall,'source-created-settled-four-ball-cue-broad-phase','original-settled-four-turn-created-before-first-h'],[Broad.validateSettledFourBall,'source-created-placed-goal-four-ball-cue-broad-phase','original-placed-goal-four-created-before-first-h'],[Broad.validateInitialFourBall,'source-created-placed-goal-four-ball-cue-broad-phase','original-placed-goal-four-created-before-first-h'],[Broad.validateInitial,'source-created-placed-goal-four-ball-cue-broad-phase','original-placed-goal-four-created-before-first-h']])assert.throws(()=>validate({kind,phase,sourceRevision:Init.SOURCE}),/Explicit original creation phase/);
 const base={kind:'source-created-placed-goal-four-ball-cue-broad-phase',phase:'original-placed-goal-four-created-before-first-h',sourceRevision:Init.SOURCE,sourceNativeSteps:556,sourceApplicationTime:.5,sourceApplicationSteps:484,sourceShots:1,sourceSelectedId:1,sourceSelectedIndex:0,initialSnapshotSha256:'a'.repeat(64),createdSnapshotSha256:'a'.repeat(64)};
 for(const change of[s=>s.sourceShots=2,s=>s.sourceSelectedId=2,s=>s.sourceSelectedIndex=1,s=>s.sourceApplicationSteps=483]){const bad=structuredClone(base);change(bad);assert.throws(()=>Broad.validatePlacedGoalFourBall(bad),/Genuine placement-settled first-shot/);}
});
test('created source identities cannot cross initializer or unbranded collision receipt boundaries',()=>{
 const created={sourceRevision:Init.SOURCE,boundary:'goalStrikeCreated',originalPlacedGoalFourBallCreation:true,sourceNativeSteps:556,sourceApplicationSteps:484,sourceApplicationTime:.5,sourceShots:1,sourceSelectedId:1,sourceSelectedIndex:0},record={created,roles:{},events:[]};
 assert.throws(()=>Init.initializeUserChanges(record,{}),/Placed-goal.*distinct initializer/);
 assert.throws(()=>Init.initializeFourBallUserChanges(record,{}),/Placed-goal.*distinct initializer/);
 assert.throws(()=>Init.initializeSettledFourBallUserChanges(record,{}),/Explicit actual settled-four/);
 for(const change of[s=>s.created.boundary='secondStrikeCreated',s=>s.created.sourceShots=2,s=>s.created.sourceSelectedId=2,s=>s.created.sourceNativeSteps++]){const bad=structuredClone(record);change(bad);assert.throws(()=>Init.initializePlacedGoalFourBallUserChanges(bad,{}),/Explicit actual placed-goal first-shot/);}
 for(const fn of[Init.finishPlacedGoalFourBallCollisionPhase,Init.finishSettledFourBallCollisionPhase])assert.throws(()=>fn({}, {},'cpu-reference'),/Exact own/);
 for(const fn of[Journal.assertInitialPlacedGoalCollisionOwned,Journal.assertInitialSettledCollisionOwned])assert.throws(()=>fn({},'cpu-reference'),/Branded original/);
});
test('shared world preserves unsupported coupled-contact, rigid-cue, CCD and transaction guards',()=>{
 const world=text('experimental-four-ball-world'),cue=text('experimental-cue-created-stroke-stage'),broad=text('experimental-cue-broad-phase');
 for(const guard of['retained.length>1','Simultaneous dynamic pair and cushion requires a larger coupled source solver','Recurring rigid-cue geometry guard is required','Unsupported source pre-solve CCD','Unsupported source solved-pose CCD','scene.assertPrepared(token)','stages.cue.abort(token)','stages.journal.abort(token)'])assert.ok(world.includes(guard),guard);
 assert.ok(world.includes('Init.finishPlacedGoalFourBallCollisionPhase'));
 assert.ok(cue.includes('Init.initializePlacedGoalFourBallUserChanges'));
 assert.ok(broad.includes("goal?'placedGoalFourBallOrigin':'settledFourBallOrigin'"));
 assert.doesNotMatch([world,cue,broad].join('\n'),/\.boundary\s*=\s*['"]secondStrikeCreated|goalStrikeCreated\s*:\s*.*secondStrikeCreated/);
});
