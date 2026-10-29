/** A page may suspend/revoke its GPU when hidden. Preparation is cancellable,
 * never resumed automatically, and never authorizes a device request in hiding. */
export const CANONICAL_PREPARATION_HIDDEN_MESSAGE='화면이 꺼지거나 다른 화면으로 전환되어 GPU 준비를 중단했습니다. 화면을 켠 뒤 다시 시작하세요.';
export function canonicalPreparationAbort(signal){
 const reason=signal?.reason;
 if(reason?.name==='AbortError'&&reason.message==='This operation was aborted')return new DOMException('GPU 준비를 취소했습니다.','AbortError');
 return reason?.name==='AbortError'?reason:new DOMException(reason instanceof Error?reason.message:String(reason??'GPU 준비를 취소했습니다.'),'AbortError');
}
export function createCanonicalPreparationScope({signal,document:doc=globalThis.document,window:win=globalThis.window}={}){
 const controller=new AbortController();let disposed=false;
 const relay=()=>controller.abort(canonicalPreparationAbort(signal));
 const hide=()=>controller.abort(new DOMException(CANONICAL_PREPARATION_HIDDEN_MESSAGE,'AbortError'));
 const visibility=()=>{if(doc?.hidden||doc?.visibilityState==='hidden')hide();};
 signal?.addEventListener('abort',relay,{once:true});doc?.addEventListener?.('visibilitychange',visibility);win?.addEventListener?.('pagehide',hide);
 if(signal?.aborted)relay();visibility();
 return Object.freeze({signal:controller.signal,check(){visibility();if(controller.signal.aborted)throw canonicalPreparationAbort(controller.signal);},dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',relay);doc?.removeEventListener?.('visibilitychange',visibility);win?.removeEventListener?.('pagehide',hide);}});
}
/** This only releases the JS waiter. Native compilation may still finish later;
 * consume its completion and never publish it into an aborted operation. */
export function awaitCanonicalPreparation(work,signal,onLate){
 const promise=Promise.resolve(work);
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(fn,value)=>{if(done)return false;done=true;signal.removeEventListener('abort',stop);fn(value);return true;};
  const stop=()=>finish(reject,canonicalPreparationAbort(signal));
  signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
  promise.then(value=>{if(!finish(resolve,value)&&onLate)Promise.resolve().then(()=>onLate(value)).catch(()=>{});},error=>{finish(reject,error);});
 });
}
