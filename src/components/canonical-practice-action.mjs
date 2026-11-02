/** Load only after explicit confirmation. Cancellation during import never starts a game. */
export async function loadAndStartCanonicalPractice(controller,signal,load=()=>{
 const url=new URL('./canonical-controller-assets/canonical-controller.mjs',document.baseURI).href;
 return import(url);
},selectedWorldProfile='mmq2-cushion',onProgress,manualPreparationEnabled=true) {
 if(typeof manualPreparationEnabled!=='boolean')throw TypeError('Explicit idle preparation preference required');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const check=()=>{if(signal?.aborted)throw new DOMException('GPU 연습 시작을 취소했습니다.','AbortError');};
 check();if(selectedWorldProfile!=='mmq2-cushion')throw Error('GPU 새 게임은 공·쿠션 통합 모드만 지원합니다.');const api=await load();check();
 if(typeof api.startCanonicalPractice!=='function')throw Error('GPU 연습 시작 모듈이 준비되지 않았습니다.');
 let active=true;
 const progress=onProgress===undefined?undefined:detail=>{if(active&&!signal?.aborted)return onProgress(detail);};
 try{const owner=await api.startCanonicalPractice(controller,{signal,selectedWorldProfile,...(progress?{onProgress:progress}:{})});check();
  if(controller.canonicalPlayback!==owner||typeof owner?.setManualPreparationEnabled!=='function')throw Error('GPU 게임은 시작됐지만 유휴 타격 준비 설정을 적용할 수 없습니다.');
  if(owner.setManualPreparationEnabled(manualPreparationEnabled)!==true)throw Error('GPU 게임은 시작됐지만 유휴 타격 준비 설정이 거부됐습니다.');return owner;}
 finally{active=false;}
}

/** UI action only; the installed owner remains the lifetime/health authority. */
export function setCanonicalManualPreparation(controller,enabled){
 if(typeof enabled!=='boolean')throw TypeError('Explicit idle preparation boolean required');
 const owner=controller?.canonicalPlayback;if(typeof owner?.setManualPreparationEnabled!=='function')return false;
 return owner.setManualPreparationEnabled(enabled)===true;
}
