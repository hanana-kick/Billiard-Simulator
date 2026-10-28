import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {threeBallFixture} from './fixtures/canonical-three-ball-source.mjs';
import {createCanonicalSessionService} from '../src/direct-candidate/canonical-session-service.mjs';
import {runCanonicalRawWorldContinuationCPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {selectedTraceWorldBoundary} from '../src/direct-candidate/canonical-selected-trace.mjs';
test('actual three-ball service retains both targets and zero-cushion MISS through physical REST',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
  const f=threeBallFixture('two-target'),reference=runCanonicalRawWorldContinuationCPU(f.binding,f.batch).continuation;
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
  const {scene,requestId,selectedId,purpose,rules,budget,profileId}=f.request;
  const service=createCanonicalSessionService({device});
  try{
    const result=await service.runSelected({request:{scene,requestId,selectedId,purpose,rules,budget,executionProfile:profileId},candidateId:f.candidate.candidateId,settings:f.candidate.settings,
      raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},
      continuation:{durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128},maximumRecords:128});
    assert.equal(result.implementation,'webgpu-selected-v1');assert.deepEqual(result.readCompact(),reference.compactResult);assert.deepEqual(result.readFinalState(),reference.state);
    assert.equal(reference.state[3],3);assert.equal(reference.ruleState[0],3);assert.equal(reference.ruleState[1],0);assert.equal(reference.ruleState[13],1);assert.deepEqual(Array.from(reference.compactResult),[100,2,1,0]);assert.equal(result.physicsResultComplete,true);assert.equal(result.captureComplete,true);assert.equal(result.samplingComplete,false);
    assert.deepEqual(result.sample(reference.state[5]).state,selectedTraceWorldBoundary(reference.state));
    assert.equal(result.cumulativeWorkBudgetEnforced,false);assert.equal(result.cumulativeEventBudgetEnforced,false);assert.equal(result.physicalHardwareVerified,false);
    t.diagnostic(JSON.stringify({bodyCount:3,targetMask:reference.ruleState[0],cushions:reference.ruleState[1],threeCushionGoal:false,compact:Array.from(result.readCompact()),exactStateWords:reference.state.length,compactWords:4,sourceRecordCount:result.sourceRecordCount,implementation:result.implementation,physicalHardwareVerified:false}));
    service.cancel();assert.throws(()=>result.readCompact(),{code:'CANCELLED'});
  }finally{service.dispose();device.destroy();gpu.destroy?.();}
});
