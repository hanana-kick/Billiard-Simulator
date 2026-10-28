import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalStateApplicationAdapter} from '../src/direct-candidate/canonical-application-adapter.mjs';
import {createCanonicalStateStore} from '../src/direct-candidate/canonical-state-store.mjs';
import {createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
test('actual raw MMQ2 cushion REST commits through owned adapter and preserves every next-source position word',
  {skip:process.env.REQUIRE_WEBGPU!=='1',timeout:240000},async t=>{
  const f=mmq2RawFixture(),profile='mmq2-cushion',store=createCanonicalStateStore({scene:f.request.scene,selectedWorldProfile:profile});
  const context={selectedId:50,settings:f.candidate.settings,game:{kind:'four',cueIds:[50,19],redIds:[8,300],threeCushion:false,pending:null}};
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),gpuAdapter=await gpu.requestAdapter(),device=await gpuAdapter.requestDevice();
  const adapter=createCanonicalStateApplicationAdapter({stateStore:store,selectedWorldProfile:profile,readContext:()=>context,device});
  try {
    const options={purpose:'manual',requestId:17,candidateId:100,executionProfile:'canonical-local-v1',budget:f.request.budget,
      raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},
      continuation:{durationTicks:8192,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128},maximumRecords:256};
    const result=await adapter.runSelected(options),words=result.readFinalState();
    assert.equal(result.physicsResultComplete,true);assert.equal(words[61],1);assert.equal(store.readRevision(),0);
    const metadata=result.commitState();assert.deepEqual(store.readFinalState(),words);assert.equal(metadata.scoreAndTurnCommitted,false);
    assert.equal(metadata.identity.selectedWorldProfile,profile);assert.equal(metadata.revision,2);
    // Packing only: this does not run, or claim qualification of, a second shot.
    const request=createCanonicalRequest({scene:store.readScene(),epoch:1,requestId:18,selectedId:50,purpose:'manual',executionProfile:'canonical-local-v1',budget:f.request.budget,rules:{...f.request.rules,search:false}});
    const binding=prepareRawWorldBinding(request,options.raw),candidate=createCanonicalCandidate(request,101,context.settings),packed=snapshotRawWorldBatch(prepareRawWorldBatch(binding,[candidate]));
    for(let i=0;i<4;i++){
      assert.equal(packed.template[32+40*i],words[64+48*i]);
      assert.deepEqual(packed.template.slice(36+40*i,39+40*i),words.slice(88+48*i,91+48*i));
    }
    adapter.cancel();assert.deepEqual(store.readFinalState(),words);assert.equal(metadata.provenance.absoluteTick,words[5]);
    t.diagnostic(JSON.stringify({stateWords:256,nextSourcePositionWords:12,cushionEvents:words[61],scoreAndTurnCommitted:false,secondShotExecuted:false,physicalHardwareVerified:false}));
  } finally {adapter.dispose();device.destroy();gpu.destroy?.();}
});
