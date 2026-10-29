// Importing this bundle is inert: no adapter, device, fetch, or mode activation.
import {startCanonicalPracticeInternal} from './canonical-practice-entry.mjs';
import {installCanonicalController as install} from './canonical-controller-integration.mjs';
import {createCanonicalWasmCompactSearchService} from './canonical-compact-search-service.mjs';
import {createWasmGpuProductionRuntime,assertWasmGpuProductionRuntime} from '../wasm-gpu/production-runtime.mjs';
export {createCanonicalStateStore} from './canonical-state-store.mjs';
/** Public installer owns both services. Caller service injection is never accepted. */
export function installCanonicalController(controller,options={}){
 if(['searchService','session','sessionService'].some(key=>Object.hasOwn(options,key)))throw TypeError('Browser installer owns the verified WASM GPU services');
 const productionRuntime=assertWasmGpuProductionRuntime(options.productionRuntime,options.device);
 const searchService=options.searchOptions===undefined?undefined:createCanonicalWasmCompactSearchService({productionRuntime,device:options.device,selectedWorldProfile:options.selectedWorldProfile,maximumCandidates:options.searchOptions?.maximumCandidates??4096});
 try{return install(controller,{...options,productionRuntime,...(searchService?{searchService}:{})});}
 catch(error){searchService?.dispose();throw error;}
}

/** Explicit confirmation prepares all bundled programs before controller install.
 * No missing-build, unsupported-device, or preparation failure falls back. */
export function startCanonicalPractice(controller,{signal,onProgress,selectedWorldProfile='mmq2-cushion'}={}){
 if(selectedWorldProfile!=='mmq2-cushion')throw TypeError('GPU 새 게임은 공·쿠션 통합 모드만 지원합니다.');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const bindings=10;let productionRuntime;
 const current=()=>{if(signal?.aborted)throw new DOMException('GPU 연습 시작을 취소했습니다.','AbortError');};
 const disposeDevice=async device=>{try{await productionRuntime?.dispose();}finally{device.destroy();}};
 return startCanonicalPracticeInternal(controller,{install:(c,options)=>installCanonicalController(c,{...options,productionRuntime}),disposeDevice,signal,selectedWorldProfile,requestDevice:async()=>{
  current();
  if(!globalThis.isSecureContext||!globalThis.navigator?.gpu)throw Error('이 브라우저에서 안전한 WebGPU 연결을 사용할 수 없습니다.');
  const adapter=await navigator.gpu.requestAdapter();current();if(!adapter)throw Error('WebGPU 장치를 찾지 못했습니다. 기존 엔진으로 대신 실행하지 않습니다.');
  if(adapter.limits.maxStorageBuffersPerShaderStage<bindings)throw Error(`이 GPU는 현재 실험에 필요한 저장 버퍼 ${bindings}개를 지원하지 않습니다.`);
  const device=await adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:bindings}});
  // Internal entry cannot own this device until requestDevice resolves: failures
  // during async prewarm must drain/destroy here, not leak an unreturned device.
  try{current();productionRuntime=await createWasmGpuProductionRuntime({device,signal,onProgress});current();return device;}
  catch(error){await disposeDevice(device);throw error;}
 }});
}
