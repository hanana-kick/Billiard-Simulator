/** Load only after explicit confirmation. Cancellation during import never starts a game. */
export async function loadAndStartCanonicalPractice(controller,signal,load=()=>{
 const url=new URL('./canonical-controller-assets/canonical-controller.mjs',document.baseURI).href;
 return import(url);
},selectedWorldProfile='mmq2-cushion',onProgress) {
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const check=()=>{if(signal?.aborted)throw new DOMException('GPU 연습 시작을 취소했습니다.','AbortError');};
 check();if(selectedWorldProfile!=='mmq2-cushion')throw Error('GPU 새 게임은 공·쿠션 통합 모드만 지원합니다.');const api=await load();check();
 if(typeof api.startCanonicalPractice!=='function')throw Error('GPU 연습 시작 모듈이 준비되지 않았습니다.');
 let active=true;
 const progress=onProgress===undefined?undefined:detail=>{if(active&&!signal?.aborted)return onProgress(detail);};
 try{return await api.startCanonicalPractice(controller,{signal,selectedWorldProfile,...(progress?{onProgress:progress}:{})});}
 finally{active=false;}
}
