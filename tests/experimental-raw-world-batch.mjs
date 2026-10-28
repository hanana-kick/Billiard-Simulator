import test from 'node:test';
import assert from 'node:assert/strict';
import {RAW_WORLD_BATCH_SOURCES} from '../src/direct-candidate/experimental-raw-world-batch-sources.mjs';
import {rawWorldBatchPhaseSpecs,liftRawWorldBatchPhase,rawWorldBatchPhaseSpec} from '../src/direct-candidate/experimental-raw-world-batch-phases.mjs';
import {verifyRawWorldBatchSources,verifyRawWorldBatchSchedule} from '../src/direct-candidate/experimental-raw-world-batch-audit.mjs';
import {buildRawWorldBatchSchedule} from '../src/direct-candidate/experimental-raw-world-batch-schedule.mjs';
test('frozen full raw-world source manifest is separate and rejects source drift',async()=>{
 await verifyRawWorldBatchSources();assert.equal(RAW_WORLD_BATCH_SOURCES.length,80);
 const changed=RAW_WORLD_BATCH_SOURCES.map((s,i)=>i===64?{...s,source:s.source+'\n'}:s);
 await assert.rejects(verifyRawWorldBatchSources(changed),/Unreviewed/);
});
test('all 86 variants pass strict lift, including exact journal entrypoint adapter',()=>{
 const specs=rawWorldBatchPhaseSpecs();assert.equal(specs.length,86);
 for(const s of specs){const code=liftRawWorldBatchPhase(s);assert.match(code,/batchCandidate/);assert.equal((code.match(/@compute/g)??[]).length,1);}
 const j=rawWorldBatchPhaseSpec('journal',0,{entryPoint:'initialize'});assert.equal(j.ownership[1],192);
 assert.throws(()=>liftRawWorldBatchPhase({...j,source:j.source.replace('fn finish()','fn changed()')}),/Journal entrypoint source drift/);
 assert.throws(()=>liftRawWorldBatchPhase({...specs[3],source:specs[3].source+'\nvar<workgroup> shared:u32;'}),/shared-state audit/);
 assert.throws(()=>rawWorldBatchPhaseSpec('world',3,{combinedInput:true}),/Unreviewed/);
});
test('N1 source schedule and every local view agree with no-alias manifest',()=>{
 for(const bodyCount of[3,4])for(const maxWorldSteps of[1,2,3,66]){
  const plan=buildRawWorldBatchSchedule({bodyCount,maxWorldSteps});
  assert.equal(verifyRawWorldBatchSchedule(plan,{bodyCount}),true);
  assert.equal(plan.dispatches,87+192*maxWorldSteps);
  assert.equal(plan.microBanks,Math.min(maxWorldSteps,3));
  assert.equal(plan.commands.at(-1).bytesPerCandidate,16);
  assert.equal(plan.commands.filter(x=>x.kind==='readback').length,1);
  assert.ok(plan.allocations.find(x=>x.name==='rctx'&&!x.shared));
  assert.ok(plan.allocations.find(x=>x.name==='config'&&!x.shared));
 }
 const wrong=buildRawWorldBatchSchedule({maxWorldSteps:1});wrong.commands.find(x=>x.family==='contextReset').list[1]='config';assert.throws(()=>verifyRawWorldBatchSchedule(wrong),/utility binding/);
 const plan=buildRawWorldBatchSchedule({maxWorldSteps:1});plan.allocations.find(x=>x.name==='rctx').shared=true;
 assert.throws(()=>verifyRawWorldBatchSchedule(plan),/incorrectly lifted/);
});
test('compact-only allocation preflight caps tiles before device allocation',async()=>{
 const {rawWorldBatchAllocationEnvelope:envelope}=await import('../src/direct-candidate/experimental-raw-world-batch-schedule.mjs');
 const plan=buildRawWorldBatchSchedule({maxWorldSteps:64,tailBytes:1024});
 for(const n of[1,3,31,32,33,256,1024]){const e=envelope(plan,n,{rawSceneBytes:512});assert.equal(e.readbackBytes,n*16);assert.ok(e.allocatedBytes<=256*1024*1024);}
 assert.throws(()=>envelope(plan,2048,{rawSceneBytes:512}),/Bounded/);
 assert.throws(()=>envelope(plan,1024,{rawSceneBytes:512,maxStorageBufferBindingSize:1024}),/device buffer/);
 const large=buildRawWorldBatchSchedule({journalCapacity:1024});assert.throws(()=>envelope(large,1024,{rawSceneBytes:512,maxBufferSize:1024}),/device buffer/);
 const inflated={allocations:[{name:'hostile',bytes:256*1024*1024,shared:false}]};assert.throws(()=>envelope(inflated,1,{rawSceneBytes:512}),/256 MiB/);
});

test('host128 domain is explicit and changes schedule budget only',async()=>{
 const {rawWorldBatchPrefixLimit}=await import('../src/direct-candidate/experimental-raw-world-batch-revision.mjs');
 assert.equal(rawWorldBatchPrefixLimit(),66);assert.equal(rawWorldBatchPrefixLimit('0850a4d+host128-v1'),128);
 assert.throws(()=>buildRawWorldBatchSchedule({maxWorldSteps:128}),/bounded/);
 assert.throws(()=>buildRawWorldBatchSchedule({maxWorldSteps:128,pipelineRevision:'latest'}),/revision/);
 const extended=buildRawWorldBatchSchedule({maxWorldSteps:128,pipelineRevision:'0850a4d+host128-v1'});assert.equal(extended.dispatches,87+192*128);assert.equal(verifyRawWorldBatchSchedule(extended),true);assert.equal(extended.microBanks,3);
 await verifyRawWorldBatchSources();
});
