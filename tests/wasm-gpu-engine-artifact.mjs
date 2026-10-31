import test from 'node:test';
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {captureLiveWorldPlan,sha256Text} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {lowerLiveWorldPlans} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {captureRawWorldResourceFacts} from '../src/direct-candidate/experimental-live-world-raw-resources.mjs';
import {validateLiveWorldResources} from '../src/direct-candidate/experimental-live-world-resources.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact,canonicalEngineArtifactJSON} from '../src/wasm-gpu/engine-artifact.mjs';
const f=mmq2RawFixture(),plan=await captureLiveWorldPlan(f.binding,f.batch,{profile:'mmq2-cushion'}),lowered=await lowerLiveWorldPlans([plan]);
const structuralConfig={profile:'mmq2-cushion',strikeBackend:'staged',maximumSteps:f.batch.effectiveMaximumSteps,bodyCount:4,faultPolicy:'atomic-per-access',options:{durationTicks:65535}};
const input={lowered,count:1,sourceRevision:'test-current-source-capture',structuralConfig,rawAllocations:await captureRawWorldResourceFacts(f.batch)};
const {artifact:fullArtifact,initialUploads}=await createWasmGpuEngineArtifact(input);
if(process.env.WASM_GPU_TEST_ARTIFACT_EXPORT){const fs=await import('node:fs/promises');await fs.writeFile(process.env.WASM_GPU_TEST_ARTIFACT_EXPORT,JSON.stringify(fullArtifact));await fs.writeFile(process.env.WASM_GPU_TEST_ARTIFACT_EXPORT+'.manifest.json',JSON.stringify({expectedArtifactSha256:fullArtifact.sha256,expectedSourceRevision:input.sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:1}));}
// Small schema-only unit graph for the destructive matrix. Never GPU evidence.
const allocations=[768,64,32].map((size,i)=>({size,usage:136,external:i===0?'prepared':i===1?'status':null,initial:new Uint8Array(size)}));
const entries=allocations.map((a,i)=>({binding:i,buffer:i,offset:0,size:a.size}));
const source=entries.map((e,i)=>`@group(0) @binding(${i}) var<storage,${i===2?'read_write':'read'}> b${i}:array<u32>;`).join('')+'@compute @workgroup_size(32) fn main(){}';
const smallPlan={kind:plan.kind,strikeBackend:'staged',allocations,definitions:[{source,ownership:entries.map(e=>({stride:e.size/4,base:0,length:e.size/4})),entryPoint:'main',label:'unit-only',layout:'auto'}],commands:[{kind:'dispatch',definition:0,x:1,entries}],readback:2,sourceQualified:false,nativeQualified:false};
const smallLowered={identity:'unit-only-not-execution-evidence',sourcePlan:smallPlan,shared:[false,false,false],definitions:[{code:source+'@group(0) @binding(3) var<storage,read_write> fault:array<atomic<u32>>;',layout:'auto',faultBinding:3}],commands:smallPlan.commands,ownershipReport:{requiredStorageBuffersPerShaderStage:7}};
const {artifact}=await createWasmGpuEngineArtifact({...input,lowered:smallLowered});
const expected={expectedArtifactSha256:artifact.sha256,expectedSourceRevision:input.sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:1};
const clone=x=>x instanceof Uint8Array?x.slice():x&&typeof x==='object'?(Array.isArray(x)?x.map(clone):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,clone(v)]))):x;
const hash=x=>sha256Text(canonicalEngineArtifactJSON(x));
test('genuine nonexecuting MMQ2 capture round trips exact WGSL/layout/command/ownership',async()=>{
 const result=await loadWasmGpuEngineArtifact(JSON.stringify(fullArtifact),{...expected,expectedArtifactSha256:fullArtifact.sha256});
 assert.deepEqual(result.lowered.definitions,lowered.definitions);assert.deepEqual(result.lowered.commands,lowered.commands);
 assert.deepEqual(result.lowered.sourcePlan.definitions,plan.definitions);assert.deepEqual(result.lowered.sourcePlan.commands,plan.commands);
 assert.deepEqual(result.lowered.shared,lowered.shared);assert.ok(result.lowered.definitions.length>80);assert.ok(result.lowered.commands.length>1000);
 assert.ok(Object.isFrozen(result.lowered.commands[0]));assert.equal(result.resources.gpuExecutionQualified,false);
 for(const [i,a]of result.lowered.sourcePlan.allocations.entries()){assert.equal(Object.hasOwn(a,'initial'),false);assert.deepEqual(initialUploads[i].initial,plan.allocations[i].initial);}
 assert.doesNotThrow(()=>validateLiveWorldResources(result.resources,{...result.resources.requiredLimits,minStorageBufferOffsetAlignment:256},{maximumOwnedBytes:result.resources.totalOwnedBytes}));
 assert.throws(()=>validateLiveWorldResources(clone(result.resources),{},{}),/Owned/);
});
test('mutable initial upload bytes are separate and cannot alter packaged structure',async()=>{
 const before=JSON.stringify(fullArtifact);initialUploads[0].initial[0]^=255;
 assert.equal(JSON.stringify(fullArtifact),before);assert.notDeepEqual(initialUploads[0].initial,plan.allocations[0].initial);

});
test('missing trust root, stale revision, altered width/config/digest and tamper fail closed',async()=>{
 await assert.rejects(()=>loadWasmGpuEngineArtifact(artifact),/Independent/);
 for(const change of [{expectedSourceRevision:'stale'},{expectedCount:3},{expectedStructuralConfig:{...structuralConfig,maximumSteps:1}},{expectedArtifactSha256:'0'.repeat(64)}])await assert.rejects(()=>loadWasmGpuEngineArtifact(artifact,{...expected,...change}),/mismatch/);
 for(const mutate of [a=>a.payload.lowered.definitions[0].code+=' ',a=>a.payload.lowered.commands.dictionary[0].x++,a=>a.payload.sourceRevision='other',a=>a.payload.count=3,a=>a.payload.lowered.sourcePlan.allocations[0].size+=4]){const a=clone(artifact);mutate(a);await assert.rejects(()=>loadWasmGpuEngineArtifact(a,expected),/hash mismatch/);}
});
test('malformed refs, views, layouts, ownership and receipt injection reject even with freshly signed envelope',async()=>{
 for(const mutate of [
 p=>p.lowered.commands.bindings[0][0].buffer=999999,
 p=>p.lowered.commands.bindings[0][0].size=3,
 p=>p.lowered.commands.dictionary.find(c=>c.kind==='dispatch').x=0,
 p=>p.lowered.definitions[0].layout={bindGroupLayouts:[]},
 p=>p.lowered.sourcePlan.allocations[0].size=3,
 p=>p.lowered.sourcePlan.allocations[0].initial=[0],
 p=>p.lowered.sourcePlan.definitions[0].ownership[0].stride++,
 p=>p.lowered.shared[p.lowered.sourcePlan.readback]=true,
 p=>p.lowered.ownershipReport.requiredStorageBuffersPerShaderStage=1,
 p=>p.resources={totalOwnedBytes:1},
 p=>p.lowered.commands.indices[0]=999999,
 p=>p.lowered.commands.indices=Array(65537).fill(0),
 p=>p.lowered.commands.dictionary.push(p.lowered.commands.dictionary[0]),
 p=>p.lowered.commands.bindings.push(p.lowered.commands.bindings[0]),
 p=>p.count=33,
 p=>p.rawAllocations.allocations[0].bytes+=4,
 ]){
  const a=clone(artifact);mutate(a.payload);a.payload.sourceHashes.plan=await hash(a.payload.lowered.sourcePlan);a.sha256=await hash(a.payload);
  await assert.rejects(()=>loadWasmGpuEngineArtifact(a,{...expected,expectedArtifactSha256:a.sha256}));
 }
});
test('JSON parser rejects unsupported values and aliased source hash claims',async()=>{
 for(const x of [{a:undefined},{a:NaN},{a:new Uint8Array(2)},[,,]])assert.throws(()=>canonicalEngineArtifactJSON(x));
 let reads=0;const accessor=[];Object.defineProperty(accessor,'0',{get(){reads++;return 0;},enumerable:true});assert.throws(()=>canonicalEngineArtifactJSON(accessor),/accessor/);assert.equal(reads,0);
 const a=clone(artifact);a.payload.sourceHashes.original[0]='0'.repeat(64);a.sha256=await hash(a.payload);
 await assert.rejects(()=>loadWasmGpuEngineArtifact(a,{...expected,expectedArtifactSha256:a.sha256}),/source hash mismatch/);
});

test.after(()=>console.log(JSON.stringify({artifactBytes:Buffer.byteLength(JSON.stringify(fullArtifact)),maxRSSKiB:process.resourceUsage().maxRSS,sourceCommands:fullArtifact.payload.lowered.sourcePlan.commands.indices.length,sourceUniqueCommands:fullArtifact.payload.lowered.sourcePlan.commands.dictionary.length,loweredUniqueCommands:fullArtifact.payload.lowered.commands.dictionary.length,sourceDefinitionsBytes:Buffer.byteLength(JSON.stringify(fullArtifact.payload.lowered.sourcePlan.definitions)),loweredDefinitionsBytes:Buffer.byteLength(JSON.stringify(fullArtifact.payload.lowered.definitions))})));

// Regression: hashing an owned normalized snapshot must retain the public
// canonical byte contract, admission checks and caller-mutation isolation.
test('canonical serializer preserves numeric keys, Unicode, shared values and negative zero',()=>{
 const shared={z:1,a:'한글\ud800'};
 assert.equal(canonicalEngineArtifactJSON({'10':'a','2':'b','01':shared,z:-0,a:[shared,shared]}),JSON.stringify({'2':'b','10':'a','01':{a:'한글\ud800',z:1},a:[{a:'한글\ud800',z:1},{a:'한글\ud800',z:1}],z:0}));
 assert.equal(canonicalEngineArtifactJSON(Object.assign(Object.create(null),{z:2,a:1})),'{"a":1,"z":2}');
 let reads=0;const accessor={};Object.defineProperty(accessor,'a',{enumerable:true,get(){reads++;return 1;}});
 const cycle={};cycle.self=cycle;
 for(const value of [accessor,cycle,Infinity,()=>1,new Date()])assert.throws(()=>canonicalEngineArtifactJSON(value));
 assert.equal(reads,0);
});
test('loader owns its normalized snapshot before asynchronous digest verification',async()=>{
 const caller=clone(artifact),code=caller.payload.lowered.definitions[0].code;
 const pending=loadWasmGpuEngineArtifact(caller,expected);
 caller.payload.lowered.definitions[0].code='tampered after call';
 caller.payload.lowered.sourcePlan.commands.dictionary.length=0;
 const loaded=await pending;
 assert.equal(loaded.lowered.definitions[0].code,code);
 assert.deepEqual(loaded.lowered.sourcePlan.commands,smallPlan.commands);
 assert.ok(Object.isFrozen(loaded.lowered.sourcePlan));
 assert.deepEqual(await loadWasmGpuEngineArtifact(JSON.stringify(artifact),expected),loaded);
});
