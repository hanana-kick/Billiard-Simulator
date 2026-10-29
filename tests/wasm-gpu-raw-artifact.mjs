import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact-builder.mjs';
import {loadWasmGpuRawArtifact,assertLoadedWasmGpuRawArtifact,rawArtifactHash} from '../src/wasm-gpu/raw-artifact.mjs';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {createRawWorldGPU,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
const f=mmq2RawFixture(),revision='host-nonexecuting-current-source';
const expected=a=>({expectedArtifactSha256:a.sha256,expectedSourceRevision:revision,expectedCount:a.payload.count,expectedMaximumSteps:a.payload.maximumSteps});
const artifacts=[];
for(const count of [1,3])test(`N${count} exact original raw source/upload/command differential, no execution`,async()=>{
 const batch=prepareRawWorldBatch(f.batch.binding,Array.from({length:count},(_,i)=>createCanonicalCandidate(f.request,100+i,f.candidate.settings)),{maximumSteps:2048});
 const {artifact,initialUploads}=await createWasmGpuRawArtifact({batch,sourceRevision:revision});artifacts.push(artifact);const e=await loadWasmGpuRawArtifact(JSON.stringify(artifact),expected(artifact));
 const r=createLiveWorldCaptureDevice(),original=await createRawWorldGPU(r.device),bank=original.createBank(batch);try{bank.encode(r.device.createCommandEncoder());assert.equal(r.submits,0);assert.equal(e.commands.length,8195);assert.equal(e.definitions.length,7);assert.equal(e.allocations.length,10);
 for(let i=0;i<r.commands.length;i++){const c=r.commands[i],d=e.commands[i],p=r.pipelines[c.pipeline];assert.equal(e.definitions[d.definition].code,p.module.code);assert.equal(e.definitions[d.definition].entryPoint,p.entryPoint);assert.equal(e.definitions[d.definition].layout,p.layout);assert.deepEqual(d.entries,c.entries);assert.equal(d.x,c.x);assert.equal(d.x,1);}
 r.buffers.forEach((b,i)=>{assert.deepEqual(initialUploads[i],{index:i,initial:b.bytes});assert.equal(e.allocations[i].sourceUsage,b.usage);assert.equal(e.allocations[i].usage,b.usage|8);assert.equal(e.allocations[i].bytes,b.size);});
 assert.equal(e.outputs.prepared,bank.preparedWorldBuffer.id);assert.equal(e.outputs.status,bank.handoffStatusBuffer.id);assert.equal(e.totalOwnedBytes,count===1?3156:6364);assert.equal(e.gpuExecutionQualified,false);assert.equal(assertLoadedWasmGpuRawArtifact(e),e);assert.throws(()=>assertLoadedWasmGpuRawArtifact({...e}));
 const before=JSON.stringify(artifact);initialUploads[0].initial.fill(255);assert.equal(JSON.stringify(artifact),before);assert.ok(!JSON.stringify(artifact).includes('"initial"'));assert.ok(Object.isFrozen(e.commands));
 }finally{bank.dispose();}
});
test('independent trust root/config and malformed freshly signed structures reject',async()=>{
 const {artifact}=await createWasmGpuRawArtifact({batch:f.batch,sourceRevision:revision});await assert.rejects(()=>loadWasmGpuRawArtifact(artifact));
 for(const change of [{expectedCount:3},{expectedMaximumSteps:1},{expectedSourceRevision:'other'},{expectedArtifactSha256:'0'.repeat(64)}])await assert.rejects(()=>loadWasmGpuRawArtifact(artifact,{...expected(artifact),...change}));
 for(const mutate of [p=>p.commands.indices.reverse(),p=>p.commands.indices[1]=6,p=>p.commands.dictionary[0].x=3,p=>p.commands.dictionary[0].entries[0].size-=4,p=>p.allocations[0].usage=128,p=>p.allocations[1].role='scene',p=>p.outputs.prepared=p.outputs.status,p=>p.definitions[0].code+=' ',p=>p.commands.indices.push(0),p=>p.allocations[0].initial=[0],p=>p.definitions[0].entryPoint='wrong']){const a=structuredClone(artifact);mutate(a.payload);a.sha256=await rawArtifactHash(a.payload);await assert.rejects(()=>loadWasmGpuRawArtifact(a,expected(a)));}
 await assert.rejects(()=>createWasmGpuRawArtifact({batch:{...f.batch,count:2},sourceRevision:revision}));
 await assert.rejects(()=>createWasmGpuRawArtifact({batch:{...f.batch,effectiveMaximumSteps:0},sourceRevision:revision}));
});
test('runtime raw loader has no factory/generator/capture imports',async()=>{const text=await readFile(new URL('../src/wasm-gpu/raw-artifact.mjs',import.meta.url),'utf8');assert.doesNotMatch(text,/^import\s/m);assert.doesNotMatch(text,/createRawWorldGPU|generateRawStrikePhases|createLiveWorldCaptureDevice/);});
