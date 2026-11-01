/** Ordered bounded submissions. No shader, command order, or state reduction.
 * Cancellation only prevents the next submission; already submitted work drains
 * before its buffers may be destroyed. Device loss is terminal, not CPU fallback.
 */
export function createLiveWorldSubmissionQueue(device,{signal,onPhase=()=>{}}={}){
 let submittedChunks=0,waitMs=0,lostError=null;
 const current=()=>{if(lostError)throw lostError;if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
 const lost=device.lost?.then(info=>{lostError=Error('GPU device lost: '+(info?.message||info?.reason||'unknown'));throw lostError;});
 // A device may be lost before the first submission. Keep the rejection handled.
 lost?.catch(()=>{});
 return Object.freeze({stats:()=>({submittedChunks,waitMs}),async submit(encoder){
  current();const command=encoder.finish();current();device.queue.submit([command]);submittedChunks++;
  const start=performance.now(),completion=device.queue.onSubmittedWorkDone(),drained=lost?Promise.race([completion,lost]):completion;
  // Even a stale/throwing observer cannot release buffers while work is in flight.
  try{onPhase({phase:'submitted',submittedChunks});}finally{try{await drained;}finally{waitMs+=performance.now()-start;}}
  current();
 }});
}
