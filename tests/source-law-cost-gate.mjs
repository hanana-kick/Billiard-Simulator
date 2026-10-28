import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePreparedAxialPrefix} from '../src/direct-candidate/source-law-axial-advance.mjs';
import {evaluatePreparedSourceLawCandidate} from '../src/direct-candidate/source-law-candidate-evaluator.mjs';
import {loadCostFixture,makeCostFixture,observeCostFixture} from './source-law-cost-fixture.mjs';
const native={skip:!process.env.DIRECT_CUE_RAPIER_PATH};
test('cost gate is validated and opt-in; it rejects before extra envelope work without mutation',native,async()=>{
 const source=await loadCostFixture(),lab=makeCostFixture(source,'near-rail');
 try{
  const before=observeCostFixture(lab);
  const denied=advancePreparedAxialPrefix(lab,96,{preparedBoundary:true,minAnalyticFrames:97});
  assert.equal(denied.reason,'short-prefix-original-window');assert.equal(denied.boundEvaluations,0);assert.equal(denied.pairBoundTests,0);assert.equal(denied.staticBoundTests,0);assert.deepEqual(observeCostFixture(lab),before);
  for(const value of [-1,1.5,NaN,Infinity,4097])assert.throws(()=>evaluatePreparedSourceLawCandidate(lab,{frames:96,minAnalyticFrames:value}),/Bounded/);
  const allowed=advancePreparedAxialPrefix(lab,96,{preparedBoundary:true});assert.equal(allowed.advanced,true);
 }finally{lab.dispose();}
});
test('high cost gate invokes unchanged whole-window fallback exactly once, with identical source output',native,async()=>{
 const source=await loadCostFixture(),lab=makeCostFixture(source,'near-rail'),reference=source.PhysicsLab.fromSnapshot(source.R,lab.snapshot());
 try{
  const calls=[],step=lab.step.bind(lab);lab.step=n=>{calls.push(n);return step(n);};
  const result=evaluatePreparedSourceLawCandidate(lab,{frames:96,enabled:true,preparedBoundary:true,advanceTranslation:true,minAnalyticFrames:97,diagnostics:true});
  reference.step(96);assert.deepEqual(calls,[96]);assert.equal(result.counters.axialAttempts,1);assert.equal(result.counters.axialFrames,0);assert.equal(result.counters.actualWorldStepCalls,96);assert.equal(result.counters.costGateFallbacks,1);
  assert.equal(result.records.at(-1).reason,'short-prefix-original-window');assert.deepEqual(observeCostFixture(lab),observeCostFixture(reference));
 }finally{lab.dispose();reference.dispose();}
});
test('short-prefix rejection after useful prefixes executes all remaining source frames with no retry loop',native,async()=>{
 const source=await loadCostFixture(),lab=makeCostFixture(source,'near-rail');let reference;
 try{
  const calls=[],step=lab.step.bind(lab);lab.step=n=>{calls.push(n);reference=source.PhysicsLab.fromSnapshot(source.R,lab.snapshot());reference.step(n);return step(n);};
  const result=evaluatePreparedSourceLawCandidate(lab,{frames:96,enabled:true,preparedBoundary:true,advanceTranslation:true,minAnalyticFrames:16,diagnostics:true});
  assert.equal(calls.length,1);assert.ok(result.counters.axialFrames>0);assert.equal(calls[0]+result.counters.axialFrames,96);assert.equal(result.counters.costGateFallbacks,1);assert.equal(result.counters.actualWorldStepCalls,calls[0]);assert.equal(result.records.at(-1).reason,'short-prefix-original-window');
  assert.deepEqual(observeCostFixture(lab),observeCostFixture(reference));
 }finally{lab.dispose();reference?.dispose();}
});
