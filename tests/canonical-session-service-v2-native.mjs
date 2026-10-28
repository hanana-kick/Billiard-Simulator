import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalSessionService} from '../src/direct-candidate/canonical-session-service.mjs';
import {runCanonicalRawWorldContinuationCPU} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {selectedTraceWorldBoundary} from '../src/direct-candidate/canonical-selected-trace.mjs';
test('actual opt-in MMQ2 raw cushion service retains exact CPU state and GPU source endpoint',
  {skip:process.env.REQUIRE_WEBGPU!=='1',timeout:240000},async t=>{
  const f=mmq2RawFixture(),reference=runCanonicalRawWorldContinuationCPU(f.binding,f.batch).continuation;
  assert.equal(reference.nominalRest,true);assert.equal(reference.state[61],1);
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
  const {scene,requestId,selectedId,purpose,rules,budget,profileId}=f.request;
  const service=createCanonicalSessionService({device,selectedWorldProfile:'mmq2-cushion'});
  try{
    const result=await service.runSelected({request:{scene,requestId,selectedId,purpose,rules,budget,executionProfile:profileId},candidateId:f.candidate.candidateId,settings:f.candidate.settings,
      raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},
      continuation:{durationTicks:8192,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128},maximumRecords:256});
    assert.equal(result.implementation,'webgpu-selected-v2');assert.equal(result.identity.selectedWorldProfile,'mmq2-cushion');
    assert.deepEqual(result.readCompact(),reference.compactResult);assert.deepEqual(result.readFinalState(),reference.state);
    assert.equal(result.physicsResultComplete,true);assert.equal(result.captureComplete,true);assert.equal(result.samplingComplete,false);
    assert.deepEqual(result.sample(reference.state[5]).state,selectedTraceWorldBoundary(reference.state));
    assert.equal(result.physicalHardwareVerified,false);service.cancel();assert.throws(()=>result.readFinalState(),{code:'CANCELLED'});
    t.diagnostic(JSON.stringify({exactStateWords:reference.state.length,compactWords:4,cushionEvents:reference.state[61],sourceRecordCount:result.sourceRecordCount,implementation:result.implementation,physicalHardwareVerified:false}));
  }finally{service.dispose();device.destroy();gpu.destroy?.();}
});
