/** Private adapter host tests: genuine source-owned input packing, mock owner.
 * No GPU adapter, GPU execution, CPU dynamics, or successful trajectory fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalRequest,createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {captureWasmGpuWorldInputPlan} from '../src/wasm-gpu/world-input-manifest-builder.mjs';
import {lowerLiveWorldPlans} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {captureRawWorldResourceFacts} from '../src/direct-candidate/experimental-live-world-raw-resources.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
import {createWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact-builder.mjs';
import {loadWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact.mjs';
import {prepareWasmGpuInputs} from '../src/wasm-gpu/world-inputs.mjs';
import {createWasmGpuCompactSearchBackendHarness} from '../src/wasm-gpu/compact-search-backend.mjs';
const sourceRevision='private-compact-host-harness-only';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const base=mmq2RawFixture();
function current({epoch=7,width=1,angle=0,x,worldSteps=2}={}){
 const original=x===undefined?base:mmq2RawFixture({x});const r=original.request;
 const request=createCanonicalRequest({scene:r.scene,epoch,requestId:epoch+10,selectedId:r.selectedId,purpose:'search',executionProfile:r.profileId,budget:r.budget,rules:{...r.rules,search:false}});
 const rawBinding=prepareRawWorldBinding(request,{absoluteTick:1000+epoch,sceneKey:11+epoch,requestKey:23+epoch});
 const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:rawBinding.sceneKey,requestKey:rawBinding.requestKey,durationTicks:8192,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:worldSteps,enableCushionContinuation:true,mixedMotionRevision:'mmq2'});
 const candidates=Array.from({length:width},(_,i)=>createCanonicalCandidate(request,100+epoch+i,{...base.candidate.settings,angle:angle+i}));
 return{request,rawBinding,binding,candidates,maximumSteps:2048,preparation:'wasm-program',strikeBackend:'staged',profile:'mmq2-cushion',faultPolicy:'atomic-per-access',expectedBuildRevision:sourceRevision};
}
const first=current(),single=prepareRawWorldBatch(first.rawBinding,first.candidates,{maximumSteps:2048});
const capture=await captureWasmGpuWorldInputPlan({binding:first.binding,batch:single});
const programs=new Map();
for(const count of [1,3]){
 const c=current({width:count}),batch=prepareRawWorldBatch(c.rawBinding,c.candidates,{maximumSteps:2048});
 const lowered=await lowerLiveWorldPlans(Array(count).fill(capture.plan),{candidateLocalAllocations:capture.candidateLocalAllocations});
 const structuralConfig={profile:'mmq2-cushion',strikeBackend:'staged',uploadManifest:capture.uploadManifest};
 const {artifact}=await createWasmGpuEngineArtifact({lowered,count,sourceRevision,structuralConfig,rawAllocations:await captureRawWorldResourceFacts(batch)});
 const engine=await loadWasmGpuEngineArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:count});
 const {artifact:rawArtifact}=await createWasmGpuRawArtifact({batch,sourceRevision});
 const rawEngine=await loadWasmGpuRawArtifact(rawArtifact,{expectedArtifactSha256:rawArtifact.sha256,expectedSourceRevision:sourceRevision,expectedCount:count,expectedMaximumSteps:2048});
 programs.set(count,{engine,rawEngine});
}
function harness({lookupProgram=selector=>programs.get(selector.count),onRun,malformed=false,backendOptions={}}={}){
 const records={prepared:[],runs:[],disposed:0,cancelled:0};let lose;const device={lost:new Promise(r=>lose=r)};
 const backend=createWasmGpuCompactSearchBackendHarness({lookupProgram,sourceRevision,moduleBytes:new Uint8Array([0]),maximumOwnedBytes:64*1024*1024,...backendOptions,
  async prepareEngine(args){records.prepared.push(args);return{requiresExclusiveDevice:true,ownsRaw:true,
   async run(input){records.runs.push(structuredClone({candidateIds:input.candidateIds,rawUploads:input.rawUploads,initialUploads:input.initialUploads}));await onRun?.(input);if(input.signal.aborted){const e=Error('mock drained cancellation');e.name='AbortError';throw e;}
    // Explicit mock UNSUPPORTED packets, never successful physics evidence.
    return{result:Uint32Array.from([...input.candidateIds].flatMap(id=>[malformed?id+1:id,4,4,0x80000000]))};},
   cancel(){records.cancelled++;},async dispose(){records.disposed++;}};}});
 return{backend,device,records,lose:()=>lose({message:'test loss'})};
}
function expectedInput(context){const batch=prepareRawWorldBatch(context.rawBinding,context.candidates,{maximumSteps:2048}),singleBatches=context.candidates.map(c=>prepareRawWorldBatch(context.rawBinding,[c],{maximumSteps:2048}));return prepareWasmGpuInputs({...programs.get(context.candidates.length),binding:context.binding,batch,singleBatches});}

test('private harness uses actual source input helper and preserves compact/source/request/candidate identities',async()=>{
 const h=harness(),c=current({width:3}),view=await h.backend.createEngine(h.device,c),result=await view.run();
 assert.deepEqual(h.records.runs[0],expectedInput(c));assert.deepEqual(result.candidateKeys,c.candidates.map(c=>c.candidateKey));assert.equal(result.epoch,c.request.epoch);assert.equal(result.requestIdentity,c.request.requestKey);assert.equal(result.sceneIdentity,c.request.sceneId);assert.equal(result.metrics.readbackBytes,48);assert.equal(result.compact.length,12);
 assert.equal(result.preparation,'wasm-program');assert.equal(result.gpuExecutionQualified,false);assert.equal(view.provenance,'injected-program-library-harness');assert.equal(h.backend.productionEnabled,false);assert.equal(h.backend.requiresExclusiveDevice,true);await h.backend.dispose();
});
test('persistent program arena is reused across candidate replacement and new search epochs/scenes, with fresh inputs every run',async()=>{
 const h=harness(),a=current(),view=await h.backend.createEngine(h.device,a);await view.run();
 const changedCandidates=[createCanonicalCandidate(a.request,999,{...base.candidate.settings,angle:45})];await view.run({candidates:changedCandidates});assert.deepEqual(h.records.runs[1],expectedInput({...a,candidates:changedCandidates}));
 const b=current({epoch:22,angle:77,x:1.25}),next=await h.backend.createEngine(h.device,b),result=await next.run();assert.equal(h.records.prepared.length,1);assert.equal(result.epoch,22);assert.deepEqual(h.records.runs[2],expectedInput(b));assert.notDeepEqual(h.records.runs[0].rawUploads,h.records.runs[2].rawUploads);await h.backend.dispose();assert.equal(h.records.disposed,1);
});
test('N1/N3 program variants cache independently; staged/shape/source/width mismatches fail closed',async()=>{
 const h=harness();await h.backend.createEngine(h.device,current());await h.backend.createEngine(h.device,current({width:3}));assert.equal(h.records.prepared.length,2);
 for(const patch of [{maximumSteps:3},{preparation:'sealed-uploads'},{strikeBackend:'chunked-16'},{profile:'mmq1-no-cushion'},{expectedBuildRevision:'caller-other'},{validationProfile:'qualified'}])await assert.rejects(h.backend.createEngine(h.device,{...current(),...patch}));
 await assert.rejects(h.backend.createEngine(h.device,current({width:2})),/N1\/N3/);await assert.rejects(h.backend.createEngine(h.device,current({worldSteps:3})),/structural/);assert.equal(h.records.runs.length,0);await h.backend.dispose();
});
test('cloned/unbranded program lookup receipts never become trusted from a matching sourceRevision',async()=>{
 const h=harness({lookupProgram:()=>({...programs.get(1),engine:{...programs.get(1).engine}})});await assert.rejects(h.backend.createEngine(h.device,current()),/Owned/);assert.equal(h.records.prepared.length,0);await h.backend.dispose();
});
test('runs serialize globally and queued cancellation never touches owner or stale results',async()=>{
 const gate=deferred(),started=deferred(),h=harness({onRun:async()=>{started.resolve();await gate.promise;}}),view=await h.backend.createEngine(h.device,current());
 const first=view.run(),firstReject=assert.rejects(first,{name:'AbortError'});await started.promise;const queued=view.run(),queuedReject=assert.rejects(queued,{name:'AbortError'});h.backend.cancel();await tick();assert.equal(h.records.runs.length,1);gate.resolve();await Promise.all([firstReject,queuedReject]);await h.backend.dispose();
});
test('AbortSignal cancellation waits owner drain and view disposal suppresses result publication',async()=>{
 const gate=deferred(),started=deferred(),h=harness({onRun:async()=>{started.resolve();await gate.promise;}}),view=await h.backend.createEngine(h.device,current()),abort=new AbortController();
 const run=view.run({signal:abort.signal}),rejected=assert.rejects(run,{name:'AbortError'});await started.promise;abort.abort();const disposal=h.backend.dispose();await tick();assert.equal(h.records.disposed,0);gate.resolve();await rejected;await disposal;assert.equal(h.records.disposed,1);await assert.rejects(view.run(),/disposed/);
});
test('device loss is terminal for cached programs and never falls back to another owner',async()=>{
 const gate=deferred(),started=deferred(),h=harness({onRun:async()=>{started.resolve();await gate.promise;}}),view=await h.backend.createEngine(h.device,current());const run=view.run(),rejected=assert.rejects(run);await started.promise;h.lose();await tick();gate.resolve();await rejected;await assert.rejects(h.backend.createEngine(h.device,current()),/device lost/);assert.equal(h.records.prepared.length,1);await h.backend.dispose();
});
test('wrong compact candidate IDs poison cached owner instead of publishing synthetic identities',async()=>{
 const h=harness({malformed:true}),view=await h.backend.createEngine(h.device,current());await assert.rejects(view.run(),/compact16/);await assert.rejects(view.run(),/compact16/);assert.equal(h.records.runs.length,1);await h.backend.dispose();
});
test('candidate/request epoch mismatch and async callbacks reject with no fabricated result',async()=>{
 const h=harness(),view=await h.backend.createEngine(h.device,current());await assert.rejects(view.run({candidates:current({epoch:9}).candidates}));
 await assert.rejects(view.run({onPhase:async()=>{}}),/Synchronous/);assert.equal(h.records.runs.length,0);await h.backend.dispose();
});

test('persistent cache obeys an aggregate byte budget and a bounded program count',async()=>{
 for(const backendOptions of [{maximumCachedPrograms:1},{maximumOwnedBytes:programs.get(3).engine.resources.totalOwnedBytes}]){
  const h=harness({backendOptions});await h.backend.createEngine(h.device,current());
  await assert.rejects(h.backend.createEngine(h.device,current({width:3})),/aggregate byte budget/);assert.equal(h.records.prepared.length,1);await h.backend.dispose();
 }
});
