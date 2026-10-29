/** Genuine capsule + actual input/decoder seams. Mock output packets below are
 * ABI sentinels, NOT physics trajectories, qualification, or compact-derived state. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact-builder.mjs';
import {loadWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact.mjs';
import {prepareWasmGpuSelectedInputs} from '../src/wasm-gpu/selected-inputs.mjs';
import {createWasmGpuSelectedSessionBackendHarness} from '../src/wasm-gpu/selected-session-backend.mjs';
import {mock,deferred} from './helpers/wasm-gpu-selected-fixture.mjs';
const context=mmq2RawFixture({durationTicks:65535}),sourceRevision='selected-session-host-only';
const {artifact}=await createWasmGpuSelectedArtifact({...context,sourceRevision});
const engine=await loadWasmGpuSelectedArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision});
const moduleBytes=await readFile(new URL('../artifacts/wasm-gpu-runtime.wasm',import.meta.url));
function packet(c=context,{ready=false,wrong=false}={}){
 const world=new Uint32Array(2916),trace=new Uint32Array(1048592),b=c.batch.binding,id=c.candidate.candidateId;
 world[2848]=wrong?id+1:id;world[2849]=ready?1:4;world[2856]=b.sceneKey;world[2857]=b.requestKey;
 trace[0]=0x53574702;trace[2]=256;trace[7]=id;trace[8]=b.sceneKey;trace[9]=b.requestKey;trace[10]=4;trace[11]=0x4d4d5102;
 if(ready){world[0]=id;world[1]=9;world[3]=4;world[5]=b.absoluteTick+10;world[41]=b.sceneKey;world[42]=b.requestKey;c.request.slotToId.forEach((id,i)=>world[64+i*48]=id);world[256]=0x12345678;world[512]=0x87654321;world[2912]=id;world[2913]=4;world[2914]=4;world[2915]=0x80000000;}
 return{world,trace};
}
function harness({output=()=>packet(),runHook,lookupProgram=()=>engine}={}){
 const m=mock(engine),records={prepared:0,runs:[],disposed:0};
 const backend=createWasmGpuSelectedSessionBackendHarness({device:m.device,moduleBytes,lookupProgram,sourceRevision,maximumOwnedBytes:12*1024*1024,
  async prepareEngine(){records.prepared++;return{requiresExclusiveDevice:true,selected:true,async run(input){records.runs.push(input.initialUploads);await runHook?.(input);if(input.signal.aborted){const e=Error('mock drained cancellation');e.name='AbortError';throw e;}return{result:output()};},cancel(){},async dispose(){records.disposed++;}};}});
 return{backend,m,records};
}
test('selected adapter uses every current source upload and returns original nonready raw result without manufacturing continuation',async()=>{
 const h=harness(),result=await h.backend.evaluate(context);assert.equal(result.continuation,null);assert.equal(result.rawHandoffStatus[0],100);assert.equal(result.gpuExecutionQualified,false);assert.equal(result.metrics.readbackBytes,4206032);assert.deepEqual(h.records.runs[0],prepareWasmGpuSelectedInputs({engine,...context}).initialUploads);await h.backend.evaluate(context);assert.equal(h.records.prepared,1);await h.backend.dispose();
});
test('full ABI sentinel decode preserves dense/pair/state and source receipt, never reconstructs from compact',async()=>{
 const raw=packet(context,{ready:true}),h=harness({output:()=>raw}),result=await h.backend.evaluate(context);const c=result.continuation;
 assert.equal(c.state[0],100);assert.equal(c.dense[0],0x12345678);assert.equal(c.firstPairEntry[0],0x87654321);assert.equal(c.elapsedTicks,10);assert.equal(c.nominalRest,true);assert.equal(c.gameplayVerdict,null);assert.equal(c.selectedTraceGPU.recordCount,0);assert.equal(c.selectedTraceGPU.captureComplete,false);assert.equal(result.candidateKey,context.candidate.candidateKey);assert.equal(result.epoch,context.request.epoch);await h.backend.dispose();
});
test('wrong identities, all-zero trace readback and mismatched current capsule reject without synthetic success',async()=>{
 for(const output of [()=>packet(context,{wrong:true}),()=>({world:new Uint32Array(2916),trace:new Uint32Array(1048592)})]){const h=harness({output});await assert.rejects(h.backend.evaluate(context));assert.equal(h.records.disposed,1);await assert.rejects(h.backend.evaluate(context));assert.equal(h.records.runs.length,1);await h.backend.dispose();}
 const h=harness();await assert.rejects(h.backend.evaluate({...context,maximumRecords:128}),/256/);await assert.rejects(h.backend.evaluate({...context,candidate:{...context.candidate,candidateId:999}}));await h.backend.dispose();
});
test('selected cancellation serializes drain before disposal; queued evaluations become stale',async()=>{
 const started=deferred(),fence=deferred(),h=harness({runHook:async()=>{started.resolve();await fence.promise;}});
 const first=h.backend.evaluate(context),firstReject=assert.rejects(first);await started.promise;const second=h.backend.evaluate(context),secondReject=assert.rejects(second);const disposal=h.backend.dispose();await new Promise(r=>setImmediate(r));assert.equal(h.records.disposed,0);assert.equal(h.records.runs.length,1);fence.resolve();await Promise.all([firstReject,secondReject]);await disposal;assert.equal(h.records.disposed,1);
});
test('selected library branding and explicit aggregate12MiB cap remain fail-closed harness boundaries',async()=>{
 const h=harness({lookupProgram:()=>({...engine})});await assert.rejects(h.backend.evaluate(context),/Owned/);assert.equal(h.records.prepared,0);await h.backend.dispose();
 assert.throws(()=>createWasmGpuSelectedSessionBackendHarness({device:mock(engine).device,lookupProgram:()=>engine,sourceRevision,moduleBytes,maximumOwnedBytes:13*1024*1024}),/12MiB/);
});
test('genuine226-buffer selected capsule runs through actual WASM/concrete bridge and zero mock output fails original trace decoder',{timeout:120000},async()=>{
 const m=mock(engine),backend=createWasmGpuSelectedSessionBackendHarness({device:m.device,moduleBytes,lookupProgram:()=>engine,sourceRevision,maximumOwnedBytes:12*1024*1024,chunkSize:4096});
 await assert.rejects(backend.evaluate(context),/Complete final selected GPU source readback/);
 assert.equal(m.buffers.length,226);assert.equal(m.events.filter(e=>Array.isArray(e)&&e[0]==='submit').reduce((n,e)=>n+e[1].length,0),55403);assert.ok(m.buffers.every(b=>b.dead&&!b.mapped));await backend.dispose();
});

test('persistent selected owner receives regenerated current candidate rows and trace identity on every evaluation',async()=>{
 let live=context;const h=harness({output:()=>packet(live)});await h.backend.evaluate(live);
 const candidate=createCanonicalCandidate(context.request,777,{...context.candidate.settings,angle:45}),batch=prepareRawWorldBatch(context.batch.binding,[candidate],{maximumSteps:2048});live={...context,candidate,batch};
 const result=await h.backend.evaluate(live);assert.equal(result.rawHandoffStatus[0],777);assert.equal(result.candidateKey,candidate.candidateKey);assert.equal(h.records.prepared,1);assert.deepEqual(h.records.runs[1],prepareWasmGpuSelectedInputs({engine,...live}).initialUploads);assert.notDeepEqual(h.records.runs[0],h.records.runs[1]);await h.backend.dispose();
});
