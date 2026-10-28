// Explicit local import only. No device request, scene admission/migration,
// controller activation or default UI change occurs when this module is imported.
import {startCanonicalPracticeInternal} from './canonical-practice-entry.mjs';
import {installCanonicalController as install} from './canonical-controller-integration.mjs';
import {createCanonicalCompactSearchService} from './experimental-live-world-sealed-entry.mjs';
export {createCanonicalStateStore} from './canonical-state-store.mjs';
/** The public installer owns its verified batch service; callers cannot inject it. */
export function installCanonicalController(controller,options={}){
 if(Object.hasOwn(options,'searchService'))throw TypeError('Browser installer owns the verified compact search service');
 const searchService=options.searchOptions===undefined?undefined:createCanonicalCompactSearchService({device:options.device,selectedWorldProfile:options.selectedWorldProfile,maximumCandidates:options.searchOptions?.maximumCandidates??4096});
 try{return install(controller,{...options,...(searchService?{searchService}:{})});}
 catch(error){searchService?.dispose();throw error;}
}

/** Explicit UI confirmation calls this; importing the bundle remains inert. */
export function startCanonicalPractice(controller,{signal,selectedWorldProfile='mmq1-ball-ball'}={}){
 if(!['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile))throw TypeError('지원하는 canonical 프로필을 선택하세요.');
 const bindings=selectedWorldProfile==='mmq2-cushion'?10:9;
 return startCanonicalPracticeInternal(controller,{install:installCanonicalController,signal,selectedWorldProfile,requestDevice:async()=>{
  if(!globalThis.isSecureContext||!globalThis.navigator?.gpu)throw Error('이 브라우저에서 안전한 WebGPU 연결을 사용할 수 없습니다.');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('WebGPU 장치를 찾지 못했습니다. 기존 엔진으로 대신 실행하지 않습니다.');
  if(adapter.limits.maxStorageBuffersPerShaderStage<bindings)throw Error(`이 GPU는 현재 실험에 필요한 저장 버퍼 ${bindings}개를 지원하지 않습니다.`);
  return adapter.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:bindings}});
 }});
}
