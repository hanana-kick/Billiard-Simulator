import {WASM_GPU_COMMAND_CAPACITY,assertWasmGpuSchedulerLimits} from '../src/wasm-gpu/scheduler-limits.mjs';
/** Low-level, unsealed build tool. Source revision is caller supplied, not trust.
 * Captures original factories on a nonexecuting recorder; never requests GPU. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createCanonicalPracticePreset} from '../src/direct-candidate/canonical-practice-entry.mjs';
import {createCanonicalRequest,createCanonicalCandidate,CANONICAL_DEFAULT_PARAMETERS} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {captureWasmGpuWorldInputPlan} from '../src/wasm-gpu/world-input-manifest-builder.mjs';
import {lowerLiveWorldPlans} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {createWasmGpuInputContract} from '../src/wasm-gpu/input-contract-builder.mjs';
import {loadWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact.mjs';
import {loadWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact.mjs';
import {createWasmGpuEngineArtifact,loadWasmGpuEngineArtifact} from '../src/wasm-gpu/engine-artifact.mjs';
import {createWasmGpuSelectedArtifact} from '../src/wasm-gpu/selected-artifact-builder.mjs';
import {createWasmGpuRawArtifact} from '../src/wasm-gpu/raw-artifact-builder.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=x=>createHash('sha256').update(x).digest('hex');
/** Verifies scheduler bytes and recorded source content. Not a source-review seal. */
export async function verifyWasmGpuSchedulerBuild({wasmPath=resolve(root,'artifacts/wasm-gpu-runtime.wasm'),sourceDirectory=resolve(root,'tools/wasm-gpu-runtime')}={}){
 const bytes=await readFile(wasmPath),provenanceBytes=await readFile(wasmPath+'.build.json'),p=JSON.parse(provenanceBytes);
 if(p.schema!=='billiard-wasm-gpu-build-v1'||p.abiVersion!==1||p.target!=='wasm32-unknown-unknown'||p.profile!=='release'||p.offline!==true||p.locked!==true||p.byteLength!==bytes.length||p.sha256!==sha(bytes))throw Error('Scheduler build provenance/binary mismatch');
 const names=['Cargo.toml','Cargo.lock','src/lib.rs','build.mjs'];if(Object.keys(p.sourceSha256??{}).sort().join(',')!==names.sort().join(','))throw Error('Complete scheduler source hashes required');
 for(const name of names)if(sha(await readFile(resolve(sourceDirectory,name)))!==p.sourceSha256[name])throw Error('Scheduler source hash mismatch: '+name);
 const module=await WebAssembly.compile(bytes);if(JSON.stringify(WebAssembly.Module.imports(module))!==JSON.stringify(p.imports)||JSON.stringify(WebAssembly.Module.exports(module))!==JSON.stringify(p.exports))throw Error('Scheduler ABI provenance mismatch');
 const instance=await WebAssembly.instantiate(module,{bridge:{submit(){throw Error('Scheduler verification must not submit');}}});assertWasmGpuSchedulerLimits(instance.exports);
 if(p.imports.length!==1||p.imports[0].module!=='bridge'||p.imports[0].name!=='submit')throw Error('Unexpected scheduler imports');
 return {bytes,provenance:p,provenanceBytes,provenanceSha256:sha(provenanceBytes)};
}
export async function createWasmGpuProgramPreset(){
 const require=createRequire(import.meta.url),RAPIER=require('../vendor/rapier.cjs');await RAPIER.init();require('../src/math.js');require('../src/physics.js');
 return createCanonicalPracticePreset({PhysicsLab:globalThis.PhysicsLab,RAPIER,selectedWorldProfile:'mmq2-cushion'});
}
/** Bundled current public four-ball MMQ2 shape only; values are supplied at run.
 * Future reviewed-source entry should verify its context before calling here. */
export async function buildWasmGpuProgramAssets({outputDirectory,sourceRevision,wasmPath,onProgress=()=>{}}={}){
 if(typeof outputDirectory!=='string'||!outputDirectory||typeof sourceRevision!=='string'||!sourceRevision.trim()||typeof onProgress!=='function')throw TypeError('Explicit output directory and caller source revision required');
 const scheduler=await verifyWasmGpuSchedulerBuild({wasmPath}),preset=await createWasmGpuProgramPreset(),o=preset.requestOptions,ids=preset.scene.physical.bodies.map(b=>b.id),others=ids.filter(id=>id!==preset.selectedId);
 const request=createCanonicalRequest({scene:preset.scene,epoch:0,requestId:0,selectedId:preset.selectedId,purpose:'manual',executionProfile:o.executionProfile,budget:o.budget,rules:{game:4,firstId:others[0],secondId:others[1],opponentId:others[2],threeCushion:false,search:false,method:'carom',minCushions:0,allowKiss:true,kissFacts:false,conditionOnly:false}});
 const rawBinding=prepareRawWorldBinding(request,o.raw),binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{...o.continuation,sceneKey:o.raw.sceneKey,requestKey:o.raw.requestKey,enableCushionContinuation:true,mixedMotionRevision:'mmq2'}),candidates=[0,1,2].map(id=>createCanonicalCandidate(request,id,preset.settings)),single=prepareRawWorldBatch(rawBinding,[candidates[0]],{maximumSteps:o.raw.maximumSteps});
 await onProgress({stage:'capture-world'});const captured=await captureWasmGpuWorldInputPlan({binding,batch:single});
 const directory=resolve(outputDirectory);await mkdir(directory,{recursive:true});
 const packageFile=async(name,value)=>{const json=Buffer.from(JSON.stringify(value)),bytes=gzipSync(json,{level:9});await writeFile(resolve(directory,name),bytes);return {file:name,encoding:'gzip',byteLength:bytes.length,sha256:sha(bytes),decodedByteLength:json.length,decodedSha256:sha(json)};};
 const inputFile=async(name,kind,engine)=>{const contract=createWasmGpuInputContract(kind,engine),bytes=Buffer.from(JSON.stringify(contract));if(bytes.length<1||bytes.length>512*1024)throw Error('Bounded input contract required');await writeFile(resolve(directory,name),bytes);return {file:name,byteLength:bytes.length,sha256:sha(bytes)};};
 const programs=[];
 for(const count of [1,3]){
  await onProgress({stage:'package-width',count});
  const batch=prepareRawWorldBatch(rawBinding,candidates.slice(0,count),{maximumSteps:o.raw.maximumSteps});
  const {artifact:raw}=await createWasmGpuRawArtifact({batch,sourceRevision});
  const rawAllocations={strikeBackend:'staged',effectiveMaximumSteps:raw.payload.maximumSteps,sceneBytes:raw.payload.allocations.find(a=>a.role==='scene').bytes,allocations:raw.payload.allocations.map(a=>({role:a.role,bytes:a.bytes,usage:a.sourceUsage}))};
  const lowered=await lowerLiveWorldPlans(Array(count).fill(captured.plan),{faultPolicy:'atomic-per-access',candidateLocalAllocations:captured.candidateLocalAllocations});
  const structuralConfig={profile:'mmq2-cushion',strikeBackend:'staged',maximumSteps:batch.effectiveMaximumSteps,bodyCount:4,faultPolicy:'atomic-per-access',options:{...o.continuation,tailMaxNodes:256,enableCushionContinuation:true,mixedMotionRevision:'mmq2'},uploadManifest:captured.uploadManifest};
  const {artifact:world}=await createWasmGpuEngineArtifact({lowered,count,sourceRevision,structuralConfig,rawAllocations});
  const commandCount=raw.payload.commands.indices.length+world.payload.lowered.commands.indices.length;if(commandCount>WASM_GPU_COMMAND_CAPACITY)throw Error('Combined raw/world command capacity exceeded');
  // Neither artifact contains mutable scene/request/input bytes. Only descriptors,
  // source text, ordering and the upload-role manifest survive packaging.
  const rawFile=await packageFile(`raw-n${count}.json.gz`,raw),worldFile=await packageFile(`world-n${count}.json.gz`,world);
  // Projection is permitted only after full executable graph/resource validation.
  const loadedWorld=await loadWasmGpuEngineArtifact(world,{expectedArtifactSha256:world.sha256,expectedSourceRevision:sourceRevision,expectedCount:count,expectedStructuralConfig:structuralConfig}),loadedRaw=await loadWasmGpuRawArtifact(raw,{expectedArtifactSha256:raw.sha256,expectedSourceRevision:sourceRevision,expectedCount:count,expectedMaximumSteps:2048});
  const inputs={world:await inputFile(`input-world-n${count}.json`,'world',loadedWorld),raw:await inputFile(`input-raw-n${count}.json`,'raw',loadedRaw)};
  programs.push({count,profile:'mmq2-cushion',bodyCount:4,maximumSteps:batch.effectiveMaximumSteps,commandCount,inputs,world:{...worldFile,artifactSha256:world.sha256},raw:{...rawFile,artifactSha256:raw.sha256}});
 }
 await onProgress({stage:'package-selected',count:1});
 const {artifact:selected}=await createWasmGpuSelectedArtifact({binding,batch:single,sourceRevision});
 // Only immutable native command/source graph, role descriptors and fixed phase
 // constants ship. The builder's mutable initialUploads are deliberately dropped.
 const selectedFile=await packageFile('selected-n1.json.gz',selected);
 const loadedSelected=await loadWasmGpuSelectedArtifact(selected,{expectedArtifactSha256:selected.sha256,expectedSourceRevision:sourceRevision});
 const selectedInputs=await inputFile('input-selected-n1.json','selected',loadedSelected);
 const selectedProgram={...selected.payload.structuralConfig,inputs:selectedInputs,commandCount:selected.payload.commands.indices.length,totalOwnedBytes:selected.payload.allocations.reduce((n,a)=>n+a.size,0),outputs:selected.payload.outputs,artifact:{...selectedFile,artifactSha256:selected.sha256}};
 const wasmFile='wasm-gpu-runtime.wasm',provenanceFile=wasmFile+'.build.json';await writeFile(resolve(directory,wasmFile),scheduler.bytes);await writeFile(resolve(directory,provenanceFile),scheduler.provenanceBytes);
 const manifest={format:'wasm-gpu-program-assets-v1',sourceRevision,sourceVerification:'caller-supplied-unverified',gpuExecutionQualified:false,publicActivation:false,profile:'mmq2-cushion',bodyCount:4,widths:[1,3],programs,selectedProgram,scheduler:{file:wasmFile,byteLength:scheduler.bytes.length,sha256:sha(scheduler.bytes),provenanceFile,provenanceSha256:scheduler.provenanceSha256,sourceHashesVerified:true},presetDefaults:{settings:preset.settings,requestOptions:o,canonicalParameters:CANONICAL_DEFAULT_PARAMETERS},structuralBounds:{profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:single.effectiveMaximumSteps,maxWorldSteps:o.continuation.maxWorldSteps,maximumCommands:WASM_GPU_COMMAND_CAPACITY,widths:[1,3],mutableInputs:'Current positions, identities, rules and materials are packed per request; existing canonical admission, allocation shape and shared-input equality remain mandatory.'}};
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await onProgress({stage:'complete',programs:programs.length});return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [outputDirectory,sourceRevision]=process.argv.slice(2);buildWasmGpuProgramAssets({outputDirectory,sourceRevision,onProgress:p=>console.log(JSON.stringify(p))}).catch(error=>{console.error(error);process.exitCode=1;});}
