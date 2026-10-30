import {createWasmGpuInputContract} from '../src/wasm-gpu/input-contract-builder.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {buildWasmGpuProgramAssets,verifyWasmGpuSchedulerBuild,createWasmGpuProgramPreset} from '../tools/build-wasm-gpu-program-assets.mjs';
import {loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
import {loadWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact.mjs';
import {loadWasmGpuSelectedArtifact,WASM_GPU_SELECTED_CONFIG} from '../src/wasm-gpu/selected-artifact.mjs';
import {heavyFirstPipelineIndices} from '../src/wasm-gpu/pipeline-preparation-order.mjs';
import {compileLiveWorldPipeline,LIVE_WORLD_PIPELINE_CACHE_LIMITS} from '../src/direct-candidate/experimental-live-world-pipeline-cache.mjs';
import {liveBoundsResultGateSource} from '../src/wasm-gpu/webgpu-bridge.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('actual public preset builds serial portable N1/N3 packages without input snapshots or execution qualification',{timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wasm-program-assets-')),events=[];try{
 const manifest=await buildWasmGpuProgramAssets({outputDirectory:dir,sourceRevision:'explicit-unverified-host-test',onProgress:p=>events.push(p)});
 assert.deepEqual(events.map(x=>[x.stage,x.count??null]),[['capture-world',null],['package-width',1],['package-width',3],['package-selected',1],['complete',null]]);assert.deepEqual(manifest.widths,[1,3]);assert.equal(manifest.sourceVerification,'caller-supplied-unverified');assert.equal(manifest.gpuExecutionQualified,false);assert.equal(manifest.publicActivation,false);
 const preset=await createWasmGpuProgramPreset();assert.deepEqual(manifest.presetDefaults.settings,preset.settings);assert.deepEqual(manifest.presetDefaults.requestOptions,preset.requestOptions);assert.equal(manifest.structuralBounds.maximumSteps,2048);assert.equal(manifest.structuralBounds.maxWorldSteps,128);
 const decode=async info=>{const bytes=await readFile(join(dir,info.file));assert.equal(bytes.length,info.byteLength);assert.equal(sha(bytes),info.sha256);const json=gunzipSync(bytes);assert.equal(json.length,info.decodedByteLength);assert.equal(sha(json),info.decodedSha256);assert.doesNotMatch(json.toString(),/"initial"\s*:/);return JSON.parse(json);};
 const inputContract=async(info,kind,engine)=>{assert.deepEqual(Object.keys(info).sort(),['byteLength','file','sha256']);const data=await readFile(join(dir,info.file));assert.equal(data.length,info.byteLength);assert.ok(data.length<=512*1024);assert.equal(sha(data),info.sha256);assert.deepEqual(JSON.parse(data),createWasmGpuInputContract(kind,engine));assert.doesNotMatch(data.toString(),/"(?:definitions|commands|sourceHashes|rawAllocations)"\s*:/);return data.length;};
 const sidecarSizes=[];
 const primaryByWidth=[];
 for(const program of manifest.programs){
  const world=await decode(program.world),raw=await decode(program.raw);const engine=await loadWasmGpuEngineArtifact(world,{expectedArtifactSha256:program.world.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedCount:program.count,expectedStructuralConfig:world.payload.structuralConfig});const rawEngine=await loadWasmGpuRawArtifact(raw,{expectedArtifactSha256:program.raw.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedCount:program.count,expectedMaximumSteps:program.maximumSteps});
  sidecarSizes.push(await inputContract(program.inputs.world,'world',engine),await inputContract(program.inputs.raw,'raw',rawEngine));
  primaryByWidth.push([...engine.lowered.definitions,...rawEngine.definitions,{code:liveBoundsResultGateSource(engine.lowered.sourcePlan.allocations[engine.lowered.sourcePlan.readback].size/4),preflight:false}]);
  assert.equal(engine.count,program.count);assert.equal(rawEngine.commands.length,8195);assert.equal(engine.lowered.commands.length+rawEngine.commands.length,program.commandCount);assert.equal(program.commandCount,53623);assert.ok(program.commandCount<=131072);assert.equal(engine.structuralConfig.uploadManifest.shape.bodyCount,4);
  for(const role of ['rules:identity','raw-prefix:identity']){const m=engine.structuralConfig.uploadManifest.allocations.filter(a=>a.role===role);assert.equal(m.length,1);assert.equal(engine.lowered.shared[m[0].index],false);}
 }
 const selectedInfo=manifest.selectedProgram,selected=await decode(selectedInfo.artifact);
 const selectedEngine=await loadWasmGpuSelectedArtifact(selected,{expectedArtifactSha256:selectedInfo.artifact.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedStructuralConfig:WASM_GPU_SELECTED_CONFIG});
 sidecarSizes.push(await inputContract(selectedInfo.inputs,'selected',selectedEngine));assert.equal(sidecarSizes.length,5);
 const key=({code,layout='auto',preflight=true,entryPoint='main'})=>JSON.stringify([code,layout,preflight,entryPoint]);
 const keys=primaryByWidth.map(definitions=>new Set(definitions.map(key)));assert.deepEqual(keys[0],keys[1],'N1/N3 exact compile-key union remains one primary graph');assert.equal(keys[0].size,118);
 // Replay the actual immutable production definitions through the real cache,
 // using a native-device double. Live owners keep their pipeline references.
 // This is compilation-reuse evidence, not GPU execution qualification.
 const retained=[],native={count:0},device={lost:new Promise(()=>{}),createShaderModule(){return {getCompilationInfo:async()=>({messages:[]})};},createBindGroupLayout:x=>x,createPipelineLayout:x=>x,async createComputePipelineAsync(){return {nativeId:++native.count};}};
 const prepared=primary=>primary;
 const compileProgram=async definitions=>{const owner=[];for(const index of heavyFirstPipelineIndices(definitions))owner[index]=await compileLiveWorldPipeline(device,definitions[index]);retained.push(owner);return owner;};
 const n3=prepared(primaryByWidth[1]),n1=prepared(primaryByWidth[0]);
 const n3Owner=await compileProgram(n3);assert.equal(native.count,118);
 await compileProgram(selectedEngine.definitions);assert.equal(native.count,206);
 const union=new Set([...n3,...selectedEngine.definitions,...n1].map(key));assert.equal(union.size,206);assert.ok([...union].reduce((sum,k)=>sum+k.length*2,0)<=LIVE_WORLD_PIPELINE_CACHE_LIMITS.maximumKeyBytes);
 const n1Owner=await compileProgram(n1);assert.equal(native.count,206,'N1 must not recompile pipelines still retained by N3/selected');
 const identities=new Map(n3.map((definition,i)=>[key(definition),n3Owner[i]]));for(const [i,definition]of n1.entries())assert.equal(n1Owner[i],identities.get(key(definition)));
 assert.equal(retained.length,3);
 assert.deepEqual(selectedEngine.structuralConfig,WASM_GPU_SELECTED_CONFIG);for(const [key,value] of Object.entries(WASM_GPU_SELECTED_CONFIG))assert.equal(selectedInfo[key],value);
 assert.equal(selectedInfo.commandCount,66189);assert.equal(selectedEngine.commands.length,selectedInfo.commandCount);assert.equal(selectedEngine.allocations.length,232);assert.equal(selectedInfo.totalOwnedBytes,selectedEngine.resourcePlan.totalOwnedBytes);assert.deepEqual(selectedInfo.outputs,selectedEngine.outputs);assert.equal(selectedInfo.outputs.world.bytes,11664);assert.equal(selectedInfo.outputs.trace.bytes,4194368);
 assert.equal(selected.payload.sourceRevision,manifest.sourceRevision);assert.ok(selected.payload.initialization.some(x=>x.kind==='dynamic'));for(const x of selected.payload.initialization)if(x.kind!=='fixed')assert.equal(Object.hasOwn(x,'bytes'),false);assert.equal(Object.hasOwn(selected,'initialUploads'),false);
 const scheduler=await verifyWasmGpuSchedulerBuild({wasmPath:join(dir,manifest.scheduler.file)});assert.equal(sha(scheduler.bytes),manifest.scheduler.sha256);assert.equal(scheduler.provenanceSha256,manifest.scheduler.provenanceSha256);assert.deepEqual(JSON.parse(await readFile(join(dir,'manifest.json'),'utf8')),manifest);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('scheduler provenance rejects modified binary and recorded source hashes before build',async()=>{const original=await verifyWasmGpuSchedulerBuild(),dir=await mkdtemp(join(tmpdir(),'wasm-provenance-'));try{const path=join(dir,'test.wasm');const changed=Buffer.from(original.bytes);changed[changed.length-1]^=1;await writeFile(path,changed);await writeFile(path+'.build.json',original.provenanceBytes);await assert.rejects(()=>verifyWasmGpuSchedulerBuild({wasmPath:path}),/binary mismatch/);await writeFile(path,original.bytes);const p=structuredClone(original.provenance);p.sourceSha256['src/lib.rs']='0'.repeat(64);await writeFile(path+'.build.json',JSON.stringify(p));await assert.rejects(()=>verifyWasmGpuSchedulerBuild({wasmPath:path}),/source hash mismatch/);}finally{await rm(dir,{recursive:true,force:true});}await assert.rejects(()=>buildWasmGpuProgramAssets({outputDirectory:dir}),/caller source revision/);});
test('builder source does not depend on fixtures or GPU device creation',async()=>{const s=await readFile(new URL('../tools/build-wasm-gpu-program-assets.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/from ['"][^'"]*tests\/|requestAdapter\(|requestDevice\(|\.queue\.submit\(/);});
