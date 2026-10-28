/** Load only after explicit confirmation. Cancellation during import never starts a game. */
export async function loadAndStartCanonicalPractice(controller,signal,load=()=>{
 const url=new URL('./canonical-controller-assets/canonical-controller.mjs',document.baseURI).href;
 return import(url);
},selectedWorldProfile='mmq1-ball-ball') {
 const check=()=>{if(signal?.aborted)throw new DOMException('GPU 연습 시작을 취소했습니다.','AbortError');};
 check();if(!['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile))throw Error('지원하지 않는 GPU 프로필입니다.');const api=await load();check();
 if(typeof api.startCanonicalPractice!=='function')throw Error('GPU 연습 시작 모듈이 준비되지 않았습니다.');
 return api.startCanonicalPractice(controller,{signal,selectedWorldProfile});
}
