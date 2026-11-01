// Importing this bundle is inert: no adapter, device, fetch, or mode activation.
import {createCanonicalPreparationScope} from './canonical-page-preparation.mjs';
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

/** Explicit confirmation installs the verified Worker-owned runtime. Programs
 * remain on-demand; no native GPU objects or fallback live on this thread. */
export function startCanonicalPractice(controller,{signal,onProgress,selectedWorldProfile='mmq2-cushion'}={}){
 if(selectedWorldProfile!=='mmq2-cushion')throw TypeError('GPU 새 게임은 공·쿠션 통합 모드만 지원합니다.');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const scope=createCanonicalPreparationScope({signal});signal=scope.signal;
 let productionRuntime;
 // The runtime alone owns Worker/native lifetimes, including failed creation.
 // Entry cleanup waits for its drain/destroy acknowledgement; an opaque public
 // identity must never be treated as a GPUDevice or destroyed independently.
 const disposeDevice=()=>productionRuntime.dispose();
 return startCanonicalPracticeInternal(controller,{install:(c,options)=>installCanonicalController(c,{...options,productionRuntime}),disposeDevice,getDeviceLoss:()=>productionRuntime.lost,signal,selectedWorldProfile,requestDevice:async()=>{
  scope.check();productionRuntime=await createWasmGpuProductionRuntime({signal,onProgress});
  // Cancellation can win immediately after successful creation. Do not publish
  // the identity or finish rejection until that late runtime is fully disposed.
  try{scope.check();return productionRuntime.identity;}
  catch(error){await disposeDevice();throw error;}
 }}).finally(()=>scope.dispose());
}
