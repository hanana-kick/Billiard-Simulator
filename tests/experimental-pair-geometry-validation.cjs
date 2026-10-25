'use strict';
// Validation-only controlled descriptor edits. No prepared native state is used
// to seed the initial-only candidate world or to advance its recurrence.
const{test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./four-ball-created-fixture.cjs'),E=require('./four-ball-world-seed.cjs'),C=require('../src/experimental-world-stepper');
test('geometry configuration preserves sleeping descriptors without numerical admission',()=>{
 const{record}=F.loadArtifact(process.env.FOUR_BALL_CREATION_V8??'/tmp/billiard-original-four-ball-created-canonical-v1.v8');const seed=E.exportInitialSeed({strikeCreated:record.boundaries.strikeCreated,modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal}),flat={...structuredClone(seed.balls[0].state),kind:'sphere-fixed-floor-continuous',contactCount:1,sleeping:true};
 const geometry=C.validateGeometryConfiguration(flat);assert.equal(geometry.sleeping,true);assert.deepEqual(geometry.translation,flat.translation);assert.deepEqual(geometry.linear,flat.linear);assert.throws(()=>C.validateConfiguration(flat),/Unsupported world domain/);assert.throws(()=>C.validatePrepared({...geometry,activationPhase:'source-observed-awake',ccdPhase:'source-prediction-inactive'}),/Unsupported world domain/);assert.throws(()=>C.stepPreparedReference({...geometry,activationPhase:'source-observed-awake',ccdPhase:'source-prediction-inactive'}),/Unsupported world domain/);assert.throws(()=>C.validateGeometryConfiguration({...flat,sleeping:1}),/Unsupported world domain/);assert.throws(()=>C.validateGeometryConfiguration({...flat,contactCount:0}),/Unsupported world domain/);assert.throws(()=>C.validateGeometryConfiguration({...flat,noPendingShapeChanges:false}),/source eligibility/);
});

test('active-wake arithmetic plan rejects a fabricated floor-disable request',()=>{
 const I=require('../src/experimental-cloth-island-world'),P=require('../src/experimental-pair-contact-stage');
 for(const forged of[{}, {kind:'source-active-wake-floor-selection'}, {floorOrder:[0],entryAwake:[true,false],sourceFloorHintSelection:'entry-asleep-count-cleared-until-next-narrow'}]){assert.throws(()=>I.createReferenceSourceWakeMathStage(forged),/Private source active-wake geometry receipt/);assert.throws(()=>P.assertSourceWakeReceipt(forged,'cpu-reference'),/Private source active-wake geometry receipt/);}
});
