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
const sha=x=>createHash('sha256').update(x).digest('hex');
test('actual public preset builds serial portable N1/N3 packages without input snapshots or execution qualification',{timeout:120000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wasm-program-assets-')),events=[];try{
 const manifest=await buildWasmGpuProgramAssets({outputDirectory:dir,sourceRevision:'explicit-unverified-host-test',onProgress:p=>events.push(p)});
 assert.deepEqual(events.map(x=>[x.stage,x.count??null]),[['capture-world',null],['package-width',1],['package-width',3],['package-selected',1],['complete',null]]);assert.deepEqual(manifest.widths,[1,3]);assert.equal(manifest.sourceVerification,'caller-supplied-unverified');assert.equal(manifest.gpuExecutionQualified,false);assert.equal(manifest.publicActivation,false);
 const preset=await createWasmGpuProgramPreset();assert.deepEqual(manifest.presetDefaults.settings,preset.settings);assert.deepEqual(manifest.presetDefaults.requestOptions,preset.requestOptions);assert.equal(manifest.structuralBounds.maximumSteps,2048);assert.equal(manifest.structuralBounds.maxWorldSteps,128);
 const decode=async info=>{const bytes=await readFile(join(dir,info.file));assert.equal(bytes.length,info.byteLength);assert.equal(sha(bytes),info.sha256);const json=gunzipSync(bytes);assert.equal(json.length,info.decodedByteLength);assert.equal(sha(json),info.decodedSha256);assert.doesNotMatch(json.toString(),/"initial"\s*:/);return JSON.parse(json);};
 for(const program of manifest.programs){
  const world=await decode(program.world),raw=await decode(program.raw);const engine=await loadWasmGpuEngineArtifact(world,{expectedArtifactSha256:program.world.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedCount:program.count,expectedStructuralConfig:world.payload.structuralConfig});const rawEngine=await loadWasmGpuRawArtifact(raw,{expectedArtifactSha256:program.raw.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedCount:program.count,expectedMaximumSteps:program.maximumSteps});
  assert.equal(engine.count,program.count);assert.equal(rawEngine.commands.length,8195);assert.equal(engine.lowered.commands.length+rawEngine.commands.length,program.commandCount);assert.ok(program.commandCount<=65536);assert.equal(engine.structuralConfig.uploadManifest.shape.bodyCount,4);
  for(const role of ['rules:identity','raw-prefix:identity']){const m=engine.structuralConfig.uploadManifest.allocations.filter(a=>a.role===role);assert.equal(m.length,1);assert.equal(engine.lowered.shared[m[0].index],false);}
 }
 const selectedInfo=manifest.selectedProgram,selected=await decode(selectedInfo.artifact);
 const selectedEngine=await loadWasmGpuSelectedArtifact(selected,{expectedArtifactSha256:selectedInfo.artifact.artifactSha256,expectedSourceRevision:manifest.sourceRevision,expectedStructuralConfig:WASM_GPU_SELECTED_CONFIG});
 assert.deepEqual(selectedEngine.structuralConfig,WASM_GPU_SELECTED_CONFIG);for(const [key,value] of Object.entries(WASM_GPU_SELECTED_CONFIG))assert.equal(selectedInfo[key],value);
 assert.equal(selectedInfo.commandCount,55403);assert.equal(selectedEngine.commands.length,selectedInfo.commandCount);assert.equal(selectedEngine.allocations.length,226);assert.equal(selectedInfo.totalOwnedBytes,selectedEngine.resourcePlan.totalOwnedBytes);assert.deepEqual(selectedInfo.outputs,selectedEngine.outputs);assert.equal(selectedInfo.outputs.world.bytes,11664);assert.equal(selectedInfo.outputs.trace.bytes,4194368);
 assert.equal(selected.payload.sourceRevision,manifest.sourceRevision);assert.ok(selected.payload.initialization.some(x=>x.kind==='dynamic'));for(const x of selected.payload.initialization)if(x.kind!=='fixed')assert.equal(Object.hasOwn(x,'bytes'),false);assert.equal(Object.hasOwn(selected,'initialUploads'),false);
 const scheduler=await verifyWasmGpuSchedulerBuild({wasmPath:join(dir,manifest.scheduler.file)});assert.equal(sha(scheduler.bytes),manifest.scheduler.sha256);assert.equal(scheduler.provenanceSha256,manifest.scheduler.provenanceSha256);assert.deepEqual(JSON.parse(await readFile(join(dir,'manifest.json'),'utf8')),manifest);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('scheduler provenance rejects modified binary and recorded source hashes before build',async()=>{const original=await verifyWasmGpuSchedulerBuild(),dir=await mkdtemp(join(tmpdir(),'wasm-provenance-'));try{const path=join(dir,'test.wasm');const changed=Buffer.from(original.bytes);changed[changed.length-1]^=1;await writeFile(path,changed);await writeFile(path+'.build.json',original.provenanceBytes);await assert.rejects(()=>verifyWasmGpuSchedulerBuild({wasmPath:path}),/binary mismatch/);await writeFile(path,original.bytes);const p=structuredClone(original.provenance);p.sourceSha256['src/lib.rs']='0'.repeat(64);await writeFile(path+'.build.json',JSON.stringify(p));await assert.rejects(()=>verifyWasmGpuSchedulerBuild({wasmPath:path}),/source hash mismatch/);}finally{await rm(dir,{recursive:true,force:true});}await assert.rejects(()=>buildWasmGpuProgramAssets({outputDirectory:dir}),/caller source revision/);});
test('builder source does not depend on fixtures or GPU device creation',async()=>{const s=await readFile(new URL('../tools/build-wasm-gpu-program-assets.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/from ['"][^'"]*tests\/|requestAdapter\(|requestDevice\(|\.queue\.submit\(/);});
