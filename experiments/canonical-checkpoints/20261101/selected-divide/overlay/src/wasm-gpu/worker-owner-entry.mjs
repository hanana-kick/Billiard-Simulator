import{snapshotGPUEnvironment}from'./gpu-execution-diagnostics.mjs';
/** Sealed compute-only Worker. No caller shader, fixture, physics fallback or UI state. */
import{WASM_GPU_BUILD_CONFIGURATION as config}from'./build-configuration.mjs';
import{LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION}from'../direct-candidate/experimental-live-world-build-seal.mjs';
import{createWasmGpuProgramLibrary}from'./program-library.mjs';
import{prepareWasmGpuEngine}from'./engine.mjs';
import{prepareWasmGpuSelectedEngine}from'./selected-engine.mjs';
import{WASM_GPU_SELECTED_CONFIG}from'./selected-artifact.mjs';
import{drainLiveWorldPreparation,releaseLiveWorldPipelineCache}from'../direct-candidate/experimental-live-world-pipeline-cache.mjs';
import{createWorkerOwnerProtocol}from'./worker-owner-protocol.mjs';
const send=message=>{const transfers=[];const visit=x=>{if(!x||typeof x!=='object')return;if(ArrayBuffer.isView(x)){if(x.buffer instanceof ArrayBuffer&&!transfers.includes(x.buffer))transfers.push(x.buffer);return;}for(const v of Object.values(x))visit(v);};visit(message);self.postMessage(message,transfers);};
let protocol=null,initialized=false,initializing=false,deviceDiagnostics=null;
self.onmessage=async event=>{
 if(initialized){void protocol.handle(event.data);return;}
 try{
  if(initializing)throw Error('Worker initialization already pending');initializing=true;
  const m=event.data;if(!m||Object.keys(m).sort().join(',')!=='generation,op,programBaseURL,v'||m.v!==1||m.op!=='init'||!Number.isSafeInteger(m.generation)||m.generation<1||m.generation>0xffffffff)throw Error('Exact worker initialization required');
  if(!LIVE_WORLD_UPLOAD_SOURCE_SEALED||!config||config.sourceRevision!==LIVE_WORLD_UPLOAD_SOURCE_REVISION||config.relativeBase!=='wasm-gpu-programs/'||!/^[a-f0-9]{64}$/.test(config.manifestSha256))throw Error('Sealed worker configuration required');
  const base=new URL(m.programBaseURL);if(base.origin!==self.location.origin||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/wasm-gpu-programs/'))throw Error('Owned same-origin program delivery base required');
  if(!navigator.gpu)throw Error('Worker WebGPU unavailable');let probe=await navigator.gpu.requestAdapter();if(!probe||probe.limits.maxStorageBuffersPerShaderStage<10)throw Error('Worker requires ten storage bindings');probe=null;
  protocol=createWorkerOwnerProtocol({initialGeneration:m.generation,expectedRevision:config.sourceRevision,selectedConfig:WASM_GPU_SELECTED_CONFIG,send,getDeviceDiagnostics:()=>deviceDiagnostics,
   loadLibrary:signal=>createWasmGpuProgramLibrary({baseURL:base.href,expectedManifestSha256:config.manifestSha256,expectedSourceRevision:config.sourceRevision,signal}),
   requestDevice:async signal=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(!navigator.gpu)throw Error('Worker WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter();if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(!adapter||adapter.limits.maxStorageBuffersPerShaderStage<10)throw Error('Worker requires ten storage bindings');const requiredLimits={maxStorageBuffersPerShaderStage:10},device=await adapter.requestDevice({requiredLimits});deviceDiagnostics=snapshotGPUEnvironment({navigator,adapter,device,requiredLimits,sourceRevision:config.sourceRevision,manifestSha256:config.manifestSha256});return device;},
   prepareSearch:prepareWasmGpuEngine,prepareSelected:prepareWasmGpuSelectedEngine,drainPreparation:drainLiveWorldPreparation,releaseCache:releaseLiveWorldPipelineCache});
  initialized=true;send({v:1,generation:m.generation,event:'ready',sourceRevision:config.sourceRevision,manifestSha256:config.manifestSha256});
 }catch(error){send({v:1,event:'boot-error',error:{name:error.name,message:error.message}});}
};
