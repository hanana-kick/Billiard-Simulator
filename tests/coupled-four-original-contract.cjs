'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./coupled-four-original-fixture.cjs'),G=require('./four-ball-goal-fixture.cjs'),F=require('./four-ball-created-fixture.cjs');
test('coupled hypothesis derives from original margins and accepted controller settings',()=>{
 G.validateInput(C.INPUT);assert.deepEqual(F.SETTINGS,{angle:0,elevation:8,tipX:0,tipY:0,speed:2});
 assert.ok(C.GEOMETRY.redSeparation>C.GEOMETRY.diameter+2*C.GEOMETRY.predictionDistance);
 assert.equal(C.INPUT.placements[2].x,C.INPUT.placements[3].x);assert.equal(C.INPUT.placements[2].z,-C.INPUT.placements[3].z);
 assert.ok(C.GEOMETRY.centerlineFirstContactX<0);assert.equal(C.SCHEMA,'original-controller-coupled-four-ball-oracle-v1');
});
test('frozen original has real shared active contacts, full rest, source cache/order and initial-only input',{skip:!process.env.COUPLED_FOUR_REPLAY},()=>{
 const p=C.load(process.env.COUPLED_FOUR_REPLAY),r=p.record;
 assert.equal(p.manifest.probe,false);assert.equal(p.observerAgreement.independentOriginalRecreations,3);assert.equal(p.observerAgreement.unobservedOriginalAgreement,true);
 assert.deepEqual(r.placements.map(x=>[x.id,x.method,x.accepted]),[1,2,3,4].map(i=>[i,'LabController.move',true]));
 assert.deepEqual(r.settings,F.SETTINGS);assert.deepEqual(p.setterCalls,[]);
 assert.equal(p.firstRetained.h,546);assert.equal(p.firstActive.h,555);
 assert.deepEqual(p.firstRetained.pairs.map(x=>[x.ids,x.active]),[[[1,3],false],[[1,4],false]]);
 assert.deepEqual(p.firstActive.pairs.map(x=>[x.ids,x.active]),[[[1,3],true],[[1,4],true]]);
 for(const pair of p.firstActive.pairs){assert.equal(pair.manifolds[0].solverContacts,1);assert.ok(pair.manifolds[0].impulses[0]>0);}
 assert.deepEqual(r.score,{cueId:1,delta:1,nextCue:1});assert.equal(r.hCount,5491);assert.equal(r.firstRestOuter,5050);
 assert.equal(r.outcome.opponentEventOrder,null);assert.ok(r.boundaries.physicalRest.application.time>r.outcome.goalTime);
 assert.equal(r.boundaries.physicalRest.application.game.pending.reds.length,2);assert.equal(r.boundaries.controllerFinished.application.game.pending,null);
 assert.deepEqual(r.boundaries.physicalRest.snapshot,r.boundaries.controllerFinished.snapshot,'Scoring never changes actual physics');
 assert.deepEqual(Object.values(r.boundaries).filter(x=>x.candidateInput).map(x=>x.boundary),['goalStrikeCreated']);
 assert.equal(p.rows.length,18);assert.ok(p.rows.every(x=>!x.candidateInput));assert.deepEqual(p.assertions,p.rows.map(C.projection));
 const E=require('./goal-four-world-seed.cjs'),input={goalStrikeCreated:r.boundaries.goalStrikeCreated,strikeCreationJournal:r.strikeCreationJournal};
 const seed=E.exportInitialSeed(input,E.placementProvenanceFromRecord(r));assert.equal(seed.globalEdges.length,4);
 assert.equal(seed.initialSnapshotSha256,p.manifest.initialSnapshotSha256);assert.ok(seed.pairSeeds.every(x=>x.seed.pair.pairPresent===0));
 assert.throws(()=>E.exportInitialSeed({...input,expected:p.rows[0]}));assert.throws(()=>E.exportInitialSeed({...input,goalStrikeCreated:p.rows[0]}));
});
