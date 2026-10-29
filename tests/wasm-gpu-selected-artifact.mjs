/** Actual factories + nonexecuting recorder; never executes GPU/CPU physics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {captureWasmGpuSelectedProgram,createWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact-builder.mjs';
import {loadWasmGpuSelectedArtifact,assertLoadedWasmGpuSelectedArtifact,selectedArtifactHash,selectedArtifactJSON,packSelectedCommands,unpackSelectedCommands} from '../src/wasm-gpu/selected-artifact.mjs';
const f=mmq2RawFixture({durationTicks:65535}),sourceRevision='selected-source-host-only',built=await createWasmGpuSelectedArtifact({...f,sourceRevision}),expectations={expectedArtifactSha256:built.artifact.sha256,expectedSourceRevision:sourceRevision};
test('real selected program captures first submitted map boundary and roundtrips exact native graph',async()=>{
 const original=await captureWasmGpuSelectedProgram(f),loaded=await loadWasmGpuSelectedArtifact(built.artifact,expectations);assert.equal(original.stoppedAtFirstSubmittedMap,true);assert.equal(original.recorder.submits,1);assert.equal(loaded.commands.length,55403);assert.equal(loaded.allocations.length,226);assert.equal(loaded.resourcePlan.totalOwnedBytes,8772676);assert.deepEqual(loaded.commands,original.commands);assert.deepEqual(loaded.definitions,original.definitions);assert.deepEqual(loaded.outputs,original.outputs);assert.equal(loaded.outputs.world.bytes,11664);assert.equal(loaded.outputs.trace.bytes,4194368);assert.ok(loaded.definitions.some(d=>d.entryPoint==='snapshot'));assert.ok(loaded.commands.some(c=>c.indirect));assert.equal(assertLoadedWasmGpuSelectedArtifact(loaded),loaded);assert.throws(()=>assertLoadedWasmGpuSelectedArtifact(structuredClone(loaded)),/Owned/);
 for(let i=0;i<loaded.allocations.length;i++){assert.equal(loaded.allocations[i].sourceUsage,original.recorder.buffers[i].usage);assert.equal(loaded.allocations[i].usage,original.recorder.buffers[i].usage|8);assert.deepEqual(built.initialUploads[i].initial,original.recorder.buffers[i].bytes);}
});
test('complete manifest excludes request bytes; only source-owned trace phase headers are fixed',async()=>{
 const loaded=await loadWasmGpuSelectedArtifact(built.artifact,expectations);assert.equal(loaded.initialization.filter(x=>x.kind==='dynamic').length,54);assert.ok(loaded.initialization.some(x=>x.role==='trace-v2:control'));
 for(const m of loaded.initialization){if(m.kind==='zero')assert.ok(built.initialUploads[m.index].initial.every(x=>x===0));else if(m.kind==='fixed'){assert.match(m.role,/^trace-v2:phase:/);assert.deepEqual(Uint8Array.from(m.bytes),built.initialUploads[m.index].initial);}else assert.equal(Object.hasOwn(m,'bytes'),false);}
 const digest=built.artifact.sha256;built.initialUploads[0].initial[0]^=1;assert.equal(await selectedArtifactHash(built.artifact.payload),digest);
});
test('trusted digest/revision/config required and arbitrary capture errors are not swallowed',async()=>{
 await assert.rejects(()=>loadWasmGpuSelectedArtifact(built.artifact),/Independent/);await assert.rejects(()=>loadWasmGpuSelectedArtifact(built.artifact,{...expectations,expectedSourceRevision:'wrong'}),/mismatch/);const changed=structuredClone(built.artifact);changed.payload.definitions[0].code+=' ';await assert.rejects(()=>loadWasmGpuSelectedArtifact(changed,expectations),/digest/);
 const other=mmq2RawFixture({durationTicks:65535,x:1.2});await assert.rejects(()=>captureWasmGpuSelectedProgram({binding:f.binding,batch:other.batch}),/binding/);
});
test('resigned malformed output, buffer, command and initialization facts fail closed',async()=>{
 for(const mutate of [p=>p.commands.bindings[p.commands.dictionary.find(c=>c.kind==='dispatch').entries][0].size=3,p=>p.outputs.trace.bytes=64,p=>p.commands.indices[0]=999999,p=>p.initialization.find(m=>m.kind==='dynamic'&&m.role==='trace-v2:control').kind='zero',p=>p.initialization.find(m=>m.kind==='fixed').bytes[0]^=1]){
  const a=structuredClone(built.artifact);mutate(a.payload);a.sha256=await selectedArtifactHash(a.payload);await assert.rejects(()=>loadWasmGpuSelectedArtifact(a,{...expectations,expectedArtifactSha256:a.sha256}));
 }
});
test('binding-table codec preserves repeated command identity and immutable shared views',async()=>{
 const loaded=await loadWasmGpuSelectedArtifact(built.artifact,expectations),wire=built.artifact.payload.commands;assert.ok(wire.indices.length>wire.dictionary.length);assert.ok(wire.dictionary.length>wire.bindings.length);const first=new Map();let repeated=false;
 wire.indices.forEach((id,i)=>{if(first.has(id)){assert.equal(loaded.commands[i],loaded.commands[first.get(id)]);repeated=true;}else first.set(id,i);});assert.equal(repeated,true);assert.ok(Object.isFrozen(loaded.commands[0]));assert.ok(Object.isFrozen(loaded.commands[0].entries));
 const entries=[{binding:0,buffer:0,offset:0,size:4}],a={kind:'dispatch',definition:0,x:1,entries},b={...a,x:2};const packed=packSelectedCommands([a,a,b]),unpacked=unpackSelectedCommands(packed);assert.deepEqual(unpacked,[a,a,b]);assert.equal(unpacked[0],unpacked[1]);assert.equal(unpacked[0].entries,unpacked[2].entries);assert.equal(packed.bindings.length,1);
 for(const mutate of [p=>p.indices[0]=99,p=>p.dictionary[0].entries=99,p=>p.indices=Array(65537).fill(0),p=>p.bindings.push([]),p=>p.dictionary.push({...p.dictionary[0],x:4})]){const bad=structuredClone(packed);mutate(bad);assert.throws(()=>unpackSelectedCommands(bad));}
});
test('selected canonical JSON rejects nested array accessors without invoking them',async()=>{
 let reads=0;const array=[];Object.defineProperty(array,'0',{enumerable:true,get(){reads++;return 0;}});assert.throws(()=>selectedArtifactJSON({array}),/accessor/);assert.equal(reads,0);
 const modified={...built.artifact,payload:{...built.artifact.payload,sourceHashes:array}};await assert.rejects(()=>loadWasmGpuSelectedArtifact(modified,expectations),/accessor/);assert.equal(reads,0);
});
test('whitespace resource declarations cannot evade source admission and output ranges are deeply frozen',async()=>{
 const {SELECTED_WORLD_RANGES}=await import('../src/wasm-gpu/selected-artifact.mjs');assert.throws(()=>{SELECTED_WORLD_RANGES.state[0]=4;},TypeError);assert.equal(SELECTED_WORLD_RANGES.state[0],0);
 const {recognizeSelectedShader}=await import('../src/wasm-gpu/selected-shader-contract.mjs');
 assert.deepEqual(recognizeSelectedShader('@group (0) @binding (0) var < storage , read_write > words:array<u32>; @compute @workgroup_size ( 1 ) fn main(){}').entries,[{binding:0,access:'read_write'}]);
 for(const extra of ['@ group (1) @ binding (0) var < uniform > hidden:u32;','@group (1) @binding (0) var < storage, read_write > hidden:array<u32>;','@group (0) @binding (99) var<storage,read> hidden:array<u32>;','var < storage,read > hidden:array<u32>;','var < workgroup > hidden:array<u32,4>;','fn hidden(){workgroupBarrier ();}','fn hidden(){storageBarrier ();}','@group (0) @binding (0) var<uniform> hidden:u32;']){
  const a=structuredClone(built.artifact);a.payload.definitions[0].code+='\n'+extra;a.payload.sourceHashes[0]=await selectedArtifactHash(a.payload.definitions[0].code);a.sha256=await selectedArtifactHash(a.payload);await assert.rejects(()=>loadWasmGpuSelectedArtifact(a,{...expectations,expectedArtifactSha256:a.sha256}),/selected|Selected/);
 }
});
