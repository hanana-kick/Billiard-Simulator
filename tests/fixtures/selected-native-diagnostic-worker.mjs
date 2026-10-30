/** TEST ONLY: fresh unstepped public preset; exact sealed selected program.
 * No CPU trajectory or backend flags. Captured initial inputs retain explicit
 * origin uncertainty unless independently byte-equal to the fresh preset.
 * Baseline and instrumented bundles share this entry and input construction.
 */
import RAPIER from '../../vendor/rapier.cjs';
import '../../src/math.js';
import '../../src/physics.js';
import '../../src/game-rules.js';
import {createCanonicalPracticePreset} from '../../src/direct-candidate/canonical-practice-entry.mjs';
import {canonicalApplicationRules} from '../../src/direct-candidate/canonical-application-adapter.mjs';
import {createCanonicalRequest,createCanonicalCandidate} from '../../src/direct-candidate/canonical-engine-contract.mjs';
import {prepareRawWorldBinding,prepareRawWorldBatch} from '../../src/direct-candidate/deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from '../../src/direct-candidate/canonical-world-continuation.mjs';
import {createWasmGpuProgramLibrary} from '../../src/wasm-gpu/program-library.mjs';
import {WASM_GPU_SELECTED_CONFIG} from '../../src/wasm-gpu/selected-artifact.mjs';
import {prepareWasmGpuSelectedInputs} from '../../src/wasm-gpu/selected-inputs.mjs';
import {prepareWasmGpuSelectedEngine} from '../../src/wasm-gpu/selected-engine.mjs';
import {releaseLiveWorldPipelineCache} from '../../src/direct-candidate/experimental-live-world-pipeline-cache.mjs';
const REVISION='90ad6636d8768b56cb4e93153d1762d3594c6652ad4ae12da283d1249dd1d16f';
const ARTIFACT='e699ec35ef1f899ff6f6bafbb0eb7ec6372b7fc610c20afeec10370cb8c31a18';
const settings=Object.freeze({angle:-2,speed:.5,elevation:25,tipX:0,tipY:.2});
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const jsonHash=value=>sha(new TextEncoder().encode(JSON.stringify(value)));
const progress=detail=>self.postMessage({event:'progress',detail});
let started=false;
self.onmessage=async({data:m})=>{
 if(started){self.postMessage({event:'error',error:{name:'Error',message:'Single diagnostic run per Worker required'}});return;}started=true;
 let device,owner,adapterInfo=null,snapshots=null,result,inputProvenance,error;
 try{
  if(!m||!['manifestSha256,programBaseURL,sourceRevision','initialUploads,inputProvenance,manifestSha256,programBaseURL,sourceRevision'].includes(Object.keys(m).sort().join(','))||m.sourceRevision!==REVISION||!/^[a-f0-9]{64}$/.test(m.manifestSha256))throw Error('Exact frozen diagnostic input URLs/identity required');
  progress({stage:'load-program'});
  const library=await createWasmGpuProgramLibrary({baseURL:m.programBaseURL,expectedManifestSha256:m.manifestSha256,expectedSourceRevision:REVISION});
  const engine=await library.lookupSelectedProgram({sourceRevision:REVISION,...WASM_GPU_SELECTED_CONFIG});
  if(engine.artifactSha256!==ARTIFACT)throw Error('Frozen selected artifact digest required');
  await RAPIER.init();globalThis.RAPIER=RAPIER;
  const preset=createCanonicalPracticePreset(),o=preset.requestOptions;
  const rules=canonicalApplicationRules(new globalThis.FourBallGame([50,19],[8,300],{threeCushion:false}).snapshot(),50,preset.scene.slotToId);
  const request=createCanonicalRequest({scene:preset.scene,epoch:1,requestId:1,selectedId:50,purpose:'manual',rules,executionProfile:o.executionProfile,budget:o.budget});
  const raw=prepareRawWorldBinding(request,o.raw);
  const binding=prepareCanonicalWorldContinuation(request,raw.shotClock,{...o.continuation,sceneKey:o.raw.sceneKey,requestKey:o.raw.requestKey,mixedMotionRevision:'mmq2',enableCushionContinuation:true});
  const candidate=createCanonicalCandidate(request,2,settings),batch=prepareRawWorldBatch(raw,[candidate],{maximumSteps:o.raw.maximumSteps});
  let {initialUploads}=prepareWasmGpuSelectedInputs({engine,binding,batch});
  const freshUploads=initialUploads;let replayComparison=null;
  if(m.initialUploads!==undefined){
   if(!Array.isArray(m.initialUploads)||m.initialUploads.length!==engine.allocations.length)throw Error('Exact full captured upload set required');
   const seen=new Set();let totalBytes=0;const different=[];
   initialUploads=m.initialUploads.map(u=>{if(!u||Object.keys(u).sort().join(',')!=='index,initial'||!Number.isSafeInteger(u.index)||seen.has(u.index)||!(u.initial instanceof Uint8Array)||u.initial.byteLength!==engine.allocations[u.index]?.size)throw Error('Exact unique captured upload span required');seen.add(u.index);totalBytes+=u.initial.byteLength;const initial=u.initial.slice(),fresh=freshUploads.find(f=>f.index===u.index).initial;let count=0,first=-1;for(let i=0;i<initial.length;i++)if(initial[i]!==fresh[i]){count++;if(first<0)first=i;}if(count)different.push({index:u.index,differentBytes:count,firstDifferentByte:first});return {index:u.index,initial};});
   if(totalBytes>12*1024*1024)throw Error('Captured uploads exceed bounded native arena');
   initialUploads.sort((a,b)=>a.index-b.index);replayComparison={freshPresetByteIdentical:different.length===0,different,totalBytes,capturedProvenance:m.inputProvenance};
  }
  const uploadDigests=await Promise.all(initialUploads.map(async u=>({index:u.index,bytes:u.initial.byteLength,sha256:await sha(u.initial)})));
  inputProvenance={kind:replayComparison?'captured-app-input-selected-diagnostic-v1':'fresh-public-preset-selected-diagnostic-v1',inputOrigin:replayComparison?'captured-app-initial-uploads':'fresh-public-preset',freshPresetInputsByteEqual:replayComparison?replayComparison.freshPresetByteIdentical:true,freshPresetComparison:replayComparison,gpuConditionedInput:!replayComparison||replayComparison.freshPresetByteIdentical?false:null,cpuTrajectoryExecuted:false,sourceRevision:REVISION,artifactSha256:engine.artifactSha256,manifestSha256:m.manifestSha256,freshReference:{settings,candidateId:2,epoch:1,requestId:1,sceneSha256:await jsonHash(preset.scene),requestSha256:await jsonHash(request)},uploadsSha256:await jsonHash(uploadDigests),uploadDigests};
  progress({stage:'request-native-device',inputProvenance});
  if(!navigator.gpu)throw Error('Native Worker WebGPU unavailable');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('Native Worker adapter unavailable');
  const info=adapter.info??{};adapterInfo={vendor:info.vendor??'',architecture:info.architecture??'',device:info.device??'',description:info.description??'',isFallbackAdapter:info.isFallbackAdapter??adapter.isFallbackAdapter??null,limits:{}};
  for(const key of ['maxStorageBuffersPerShaderStage','maxBufferSize','maxStorageBufferBindingSize','maxComputeInvocationsPerWorkgroup','maxComputeWorkgroupSizeX','minStorageBufferOffsetAlignment'])adapterInfo.limits[key]=adapter.limits[key];
  if(adapter.limits.maxStorageBuffersPerShaderStage<10)throw Error('Native Worker requires ten storage bindings');
  device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:10}});
  device.addEventListener('uncapturederror',e=>self.postMessage({event:'gpu-error',error:{message:e.error.message}}));
  globalThis.__captureSelectedDiagnostic=value=>{if(snapshots||!(value?.words instanceof Uint32Array)||!value.plan)throw Error('One bounded snapshot capture required');snapshots=value;};
  owner=await prepareWasmGpuSelectedEngine({device,engine,moduleBytes:library.getScheduler().moduleBytes,maximumOwnedBytes:12*1024*1024,chunkSize:256,maxInFlight:1,onPrepareProgress:progress});
  result=(await owner.run({initialUploads,onProgress:progress,onExecutionPhase:progress})).result;
 }catch(e){error=e;}finally{
  try{if(owner)await owner.dispose();if(device)await releaseLiveWorldPipelineCache(device);}catch(e){error??=e;}
  if(device)device.destroy();delete globalThis.__captureSelectedDiagnostic;
 }
 if(error){self.postMessage({event:'error',error:{name:error.name,message:error.message,stack:error.stack},adapter:adapterInfo,inputProvenance});return;}
 const transfers=[result.world.buffer,result.trace.buffer];if(snapshots)transfers.push(snapshots.words.buffer);
 self.postMessage({event:'result',world:result.world,trace:result.trace,snapshots,adapter:adapterInfo,inputProvenance},transfers);
};
