/* SPDX-License-Identifier: Apache-2.0
 * Bounded allocation / terminal transport only. No physical producer, source
 * compiler, CPU forward fallback, diagnostic state readback, or qualification.
 * GPUBuffer handles are an INTERNAL integration seam, not execution authority.
 */
import {INPUT_WORDS,RESULT_WORDS,STATUS,REASON,UNSET,initialResults,decodeResults,isOwnedUint32Array} from './abi.mjs';
import {planResidentMicrocodeAllocation,snapshotMicrocodeDeviceLimits} from './microcode-resources.mjs';

export const RESIDENT_BATCH_PROTOCOL_CAPABILITY=Object.freeze({experimentalOptIn:true,allocationLifecycle:true,compactProtocol:true,
 physicalProducerAvailable:false,sourceRowsAdmitted:false,originalFullRestQualified:false,native1024TrajectoriesQualified:false,
 numericallyQualified:false,hardwarePerformanceMeasured:false,hostForwardFallback:false,defaultBackend:false});
const need=(ok,message)=>{if(!ok)throw new TypeError('Resident batch protocol: '+message);};
const identityKeys=['sourceIdentity','preStrikeIdentity','generationIdentity'];
function identityCopy(value){
 need(value&&Object.getPrototypeOf(value)===Object.prototype,'plain source/generation identity required');const d=Object.getOwnPropertyDescriptors(value);
 need(Reflect.ownKeys(d).length===identityKeys.length&&identityKeys.every(k=>d[k]&&Object.hasOwn(d[k],'value')&&typeof d[k].value==='string'&&d[k].value.length>0&&d[k].value.length<=512),'exact nonempty sourceIdentity, preStrikeIdentity, generationIdentity required');
 return Object.freeze(Object.fromEntries(identityKeys.map(k=>[k,d[k].value])));
}
const sameIdentity=(a,b)=>identityKeys.every(k=>a[k]===b[k]);
function inputCopy(input){
 need(isOwnedUint32Array(input)&&input.length>0&&input.length%INPUT_WORDS===0&&input.length/INPUT_WORDS<=4096,'owned bounded whole input ABI records required');
 const words=input.slice(),ids=[];for(let i=0;i<words.length;i+=INPUT_WORDS)ids.push(words[i]);
 need(ids.every(id=>id!==UNSET)&&new Set(ids).size===ids.length,'distinct input IDs required');return{words,ids:Object.freeze(ids)};
}
function failureResults(ids,status,reason){const words=new Uint32Array(ids.length*RESULT_WORDS);ids.forEach((id,i)=>words.set([id,status,UNSET,reason],i*RESULT_WORDS));return Object.freeze(decodeResults(words,ids));}
export class ResidentBatchProtocolError extends Error{
 constructor(message,{status=STATUS.FAILED,reason=REASON.INCOMPLETE_COMMIT,ids=[],identity,cause}={}){super(message,{cause});this.name='ResidentBatchProtocolError';this.status=status;this.reason=reason;this.outcome=Object.freeze({results:failureResults(ids,status,reason),evidence:Object.freeze({...identity,physicalProducerAvailable:false,numericallyQualified:false,committed:false})});}
}

/** Host aggregation journal. Receipts mean ONLY bank ownership; neither the
 * caller nor this journal can use them to bless physics. PASS/MISS are rejected
 * until a separate source-bound physical producer/admission actually exists.
 * No terminal rows become observable until every bank validates and commit's
 * final synchronous identity check succeeds. Caller data is copied, never held.
 */
export function createResidentCompactTransaction({input,banks,identity,getIdentity}={}){
 const {ids}=inputCopy(input),source=identityCopy(identity);need(typeof getIdentity==='function','live identity getter required');
 need(Array.isArray(banks)&&banks.length>0,'complete ordered bank ranges required');let next=0;
 const ranges=banks.map((b,index)=>{need(b&&b.first===next&&Number.isSafeInteger(b.count)&&b.count>0&&b.count<=512*8,'contiguous bounded bank ranges required');next+=b.count;return Object.freeze({index,first:b.first,count:b.count});});need(next===ids.length,'banks must cover every input exactly once');
 const ownership=new WeakMap(),receipts=Object.freeze(ranges.map(range=>{const token=Object.freeze(Object.create(null));ownership.set(token,range);return token;}));
 let phase='collecting',staged=new Map();
 const error=(message,reason=REASON.INCOMPLETE_COMMIT)=>new ResidentBatchProtocolError(message,{ids,identity:source,reason});
 const invalidate=e=>{phase='invalid';staged.clear();throw e;};
 const check=()=>{need(phase==='collecting','transaction is not collecting');let current;try{current=identityCopy(getIdentity());}catch(cause){invalidate(new ResidentBatchProtocolError('Identity lease cannot be read',{ids,identity:source,cause}));}if(!sameIdentity(source,current))invalidate(error('Stale generation/source cannot publish',REASON.STALE_SOURCE));};
 return Object.freeze({identity:source,ids,bankReceipts:receipts,get phase(){return phase;},
  stage(receipt,words){
   check();try{const range=ownership.get(receipt);need(range,'bank receipt is not owned by this transaction');need(!staged.has(range.index),'bank may be staged only once');
    need(isOwnedUint32Array(words),'owned compact ABI words required');const copy=words.slice(),rows=decodeResults(copy,ids.slice(range.first,range.first+range.count));
    if(rows.some(r=>r.status==='pass'||r.status==='miss'))throw error('Physical PASS/MISS producer is unavailable',REASON.NUMERIC);
    staged.set(range.index,rows);return Object.freeze({bank:range.index,count:range.count,terminalRowsValidated:true,physicalProducerAvailable:false});
   }catch(cause){invalidate(cause instanceof ResidentBatchProtocolError?cause:new ResidentBatchProtocolError('Invalid compact bank: '+cause.message,{ids,identity:source,cause}));}
  },
  commit(){check();if(staged.size!==ranges.length)invalidate(error('Cannot publish a partial candidate wave'));const rows=Object.freeze(ranges.flatMap(r=>staged.get(r.index)));check();phase='committed';staged.clear();return Object.freeze({results:rows,evidence:Object.freeze({...source,candidateCount:ids.length,banks:ranges.length,compactBytes:ids.length*RESULT_WORDS*4,committed:true,physicalProducerAvailable:false,numericallyQualified:false})});},
  abort(reason=REASON.CANCELLED){need(phase!=='committed','committed transaction cannot be aborted');need([REASON.CANCELLED,REASON.STALE_SOURCE,REASON.DEVICE_LOST,REASON.INCOMPLETE_COMMIT,REASON.CAPACITY].includes(reason),'explicit lifecycle failure reason');phase='aborted';staged.clear();return new ResidentBatchProtocolError('Candidate wave aborted',{ids,identity:source,status:reason===REASON.CANCELLED?STATUS.CANCELLED:STATUS.FAILED,reason}).outcome;}
 });
}

const deviceOwners=new WeakMap(),deviceLifecycles=new WeakMap();
// One permanent device.lost subscription per device, not one captured wave per
// allocation. Closed owners unsubscribe; completed drains remove loss waiters.
function deviceLifecycle(device){
 let lifecycle=deviceLifecycles.get(device);if(lifecycle)return lifecycle;
 lifecycle={lost:null,listeners:new Set()};deviceLifecycles.set(device,lifecycle);
 const lost=info=>{lifecycle.lost=info??{reason:'unknown'};for(const listener of lifecycle.listeners)listener(lifecycle.lost);lifecycle.listeners.clear();};
 Promise.resolve(device.lost).then(lost,lost);return lifecycle;
}
/** Allocate the COMPLETE plan atomically, then expose one serialized owner.
 * This reserves actual source-sized resources and uploads only exact raw input
 * plus PENDING compact rows. Source readonly words, CCD initialization, shaders
 * and a terminal physical producer are deliberately NOT supplied by this API.
 * Internal integration may encode with these handles, but cannot publish a
 * PASS/MISS or assert physics qualification. Never pass an adapter as device.
 *
 * No other user of this GPUDevice may interleave queue/error-scope operations.
 * All submissions must go through submit(); continuation receipts are one-use,
 * owner-local and valid only AFTER queue drain + all error scopes have cleared.
 */
export async function allocateResidentMicrocodeBatch(device,{experimental=false,shape,input,identity,getIdentity,signal,bankRows=512,bindingPolicy='compatibility-128mib',maxLiveBytes=512*1024*1024}={}){
 need(experimental===true,'explicit experimental opt-in required');
 need(device&&typeof device.createBuffer==='function'&&typeof device.pushErrorScope==='function'&&typeof device.popErrorScope==='function'&&device.queue&&typeof device.queue.writeBuffer==='function'&&typeof device.queue.submit==='function'&&typeof device.queue.onSubmittedWorkDone==='function'&&typeof device.lost?.then==='function','actual device lifecycle interface required');
 need(!deviceOwners.has(device),'device already owned or poisoned by an undrained failure');
 const snapshot=inputCopy(input),source=identityCopy(identity);need(typeof getIdentity==='function','live source/generation identity getter required');
 const limits=snapshotMicrocodeDeviceLimits(device),plan=planResidentMicrocodeAllocation(shape,snapshot.ids.length,{limits,bankRows,bindingPolicy,maxLiveBytes}),ids=snapshot.ids;
 const protocolError=(message,reason=REASON.INCOMPLETE_COMMIT,cause)=>new ResidentBatchProtocolError(message,{ids,identity:source,status:reason===REASON.CANCELLED?STATUS.CANCELLED:STATUS.FAILED,reason,cause});
 if(!plan.fits)throw protocolError('Complete allocation plan exceeds device limit or explicit peak-live budget',REASON.CAPACITY);
 const tag=Object.freeze({}),buffers=new Map(),owned=[],scopeFilters=['validation','out-of-memory','internal'],lifecycle=deviceLifecycle(device),lossWaiters=new Set();deviceOwners.set(device,tag);
 let phase='allocating',lost=lifecycle.lost,stopReason=null,receipt=null,pendingWork=false,active=null,closePromise=null,closed=false,scopeFailure=null,ready=false,published=false;
 const lossError=()=>protocolError('Device lost; no terminal success may publish',REASON.DEVICE_LOST,lost);
 const check=()=>{if(lost)throw lossError();if(stopReason!==null||signal?.aborted)throw protocolError('Candidate wave cancelled',stopReason??REASON.CANCELLED);let current;try{current=identityCopy(getIdentity());}catch(cause){throw protocolError('Cannot read current source identity',REASON.INCOMPLETE_COMMIT,cause);}if(!sameIdentity(source,current))throw protocolError('Stale source/generation cannot continue',REASON.STALE_SOURCE);};
 const raceLoss=promise=>new Promise((resolve,reject)=>{const onLoss=()=>{lossWaiters.delete(onLoss);reject(lossError());};lossWaiters.add(onLoss);Promise.resolve(promise).then(value=>{lossWaiters.delete(onLoss);resolve(value);},error=>{lossWaiters.delete(onLoss);reject(error);});if(lost)onLoss();});
 const drain=async()=>{if(!pendingWork)return;if(lost){pendingWork=false;return;}try{await raceLoss(device.queue.onSubmittedWorkDone());pendingWork=false;}catch(error){if(lost){pendingWork=false;throw lossError();}throw error;}};
 const scopes=async fn=>{let depth=0,value,failure;try{for(const filter of scopeFilters){device.pushErrorScope(filter);depth++;}value=await fn();}catch(error){failure=error;}finally{while(depth){depth--;try{const error=await device.popErrorScope();if(error&&!failure)failure=protocolError('Device '+scopeFilters[depth]+' error: '+error.message,scopeFilters[depth]==='out-of-memory'?REASON.CAPACITY:REASON.INCOMPLETE_COMMIT,error);}catch(error){scopeFailure??=error;failure??=error;}}}if(failure)throw failure;return value;};
 const normalize=error=>lost?lossError():error instanceof ResidentBatchProtocolError?error:protocolError('Resident allocation/transport failed: '+error.message,REASON.INCOMPLETE_COMMIT,error);
 const destroy=async()=>{
  if(closed)return;closed=true;ready=false;receipt=null;const errors=scopeFailure?[scopeFailure]:[];
  if(pendingWork&&!lost)try{await drain();}catch(error){errors.push(error);}else if(lost)pendingWork=false;
  for(const buffer of owned){try{buffer.unmap();}catch(error){errors.push(error);}try{buffer.destroy();}catch(error){errors.push(error);}}
  const destroyedBuffers=owned.length;owned.length=0;buffers.clear();phase='closed';signal?.removeEventListener('abort',onAbort);lifecycle.listeners.delete(onDeviceLost);
  // Unknown drain rejection poisons reuse: destroying handles is not proof
  // that the queue drained. A fresh device/explicit external recovery is needed.
  if(!pendingWork&&!errors.length)deviceOwners.delete(device);
  if(errors.length)throw protocolError('Resource cleanup/drain failed; device owner remains poisoned',REASON.INCOMPLETE_COMMIT,new AggregateError(errors));
  return Object.freeze({destroyedBuffers,liveBufferBytes:0,queueDrained:!lost&&!pendingWork,deviceLost:!!lost});
 };
 const close=()=>closePromise??=(async()=>{if(active)try{await active;}catch{}return destroy();})();
 const onAbort=()=>{stopReason=REASON.CANCELLED;if(ready)void close().catch(()=>{});};
 const onDeviceLost=info=>{lost=info;for(const waiter of [...lossWaiters])waiter();if(ready)void close().catch(()=>{});};lifecycle.listeners.add(onDeviceLost);
 const token=()=>receipt=Object.freeze(Object.create(null));
 const requireReceipt=value=>{need(ready&&!closed&&!active,'one idle live owner required');need(value===receipt&&value!==null,'current owner-local drained continuation receipt required');check();};
 const handles=()=>Object.freeze({common:Object.freeze(Object.fromEntries(Object.entries(plan.common).map(([key,a])=>[key,buffers.get(a.key)]))),banks:Object.freeze(plan.banks.map(bank=>{const row=Object.fromEntries(Object.entries(bank.resources).map(([key,a])=>[key,buffers.get(a.key)]));row.rawScratch=row.scratch;row.numericScratch=row.scratch;return Object.freeze(row);})),compactResults:buffers.get('compactResults')});
 const operate=(value,fn,issueContinuation=false)=>{
  try{requireReceipt(value);}catch(error){if(ready&&value===receipt)void close().catch(()=>{});return Promise.reject(error);}
  receipt=null;phase='operating';
  active=(async()=>{try{const result=await scopes(fn);check();phase='ready';return issueContinuation?token():result;}catch(error){throw normalize(error);}})();
  // The public promise settles only after failure cleanup; never leave a live
  // bank behind when a caller catches an operation error and walks away.
  const task=active;return task.then(result=>{active=null;return result;},async error=>{active=null;try{await close();}catch(cleanup){throw protocolError('Operation and cleanup both failed',error.reason,new AggregateError([error,cleanup]));}throw error;});
 };
 try{
  check();await scopes(async()=>{
   for(const allocation of plan.allocations){check();let buffer;try{buffer=device.createBuffer({label:allocation.key,size:allocation.bytes,usage:allocation.usage});}catch(error){throw protocolError('Atomic buffer allocation failed at '+allocation.key,REASON.CAPACITY,error);}need(buffer&&typeof buffer.destroy==='function'&&typeof buffer.unmap==='function','GPUBuffer lifecycle required');owned.push(buffer);buffers.set(allocation.key,buffer);}
   // No evolution/submission and no handle publication before ALL allocations.
   for(const bank of plan.banks){pendingWork=true;device.queue.writeBuffer(buffers.get(bank.resources.inputs.key),0,snapshot.words.subarray(bank.first*INPUT_WORDS,(bank.first+bank.count)*INPUT_WORDS));}
   pendingWork=true;device.queue.writeBuffer(buffers.get('compactResults'),0,initialResults(snapshot.words));await drain();check();
  });check();ready=true;phase='ready';token();signal?.addEventListener('abort',onAbort,{once:true});check();
 }catch(error){try{await destroy();}catch(cleanup){throw protocolError('Allocation and cleanup both failed',error.reason??REASON.INCOMPLETE_COMMIT,new AggregateError([error,cleanup]));}throw normalize(error);}
 const api={capability:RESIDENT_BATCH_PROTOCOL_CAPABILITY,plan,identity:source,ids,get phase(){return phase;},get continuation(){return receipt;},
  resources(value){try{requireReceipt(value);return handles();}catch(error){if(ready&&value===receipt)void close().catch(()=>{});throw error;}},
  submit(value,commandBuffers){return operate(value,async()=>{need(Array.isArray(commandBuffers)&&commandBuffers.length>0&&commandBuffers.length<=1024,'bounded pre-encoded command buffers required');check();pendingWork=true;device.queue.submit(commandBuffers);await drain();check();},true);},
  async collectCompact(value){
   const words=await operate(value,async()=>{check();need(typeof device.createCommandEncoder==='function','device command encoder required');const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(buffers.get('compactResults'),0,buffers.get('compactReadback'),0,ids.length*RESULT_WORDS*4);pendingWork=true;device.queue.submit([encoder.finish()]);await drain();check();const read=buffers.get('compactReadback');await raceLoss(read.mapAsync(1));let words;try{words=new Uint32Array(read.getMappedRange().slice(0));}finally{read.unmap();}check();return words;});
   const journal=createResidentCompactTransaction({input:snapshot.words,banks:plan.banks,identity:source,getIdentity});
   try{for(const bank of plan.banks)journal.stage(journal.bankReceipts[bank.index],words.subarray(bank.first*RESULT_WORDS,(bank.first+bank.count)*RESULT_WORDS));const cleanup=await close();check();const result=journal.commit();published=true;return Object.freeze({results:result.results,evidence:Object.freeze({...result.evidence,limitsSource:'queried-GPUDevice',readbackBytes:words.byteLength,intermediateStateReadbacks:0,peakLiveBufferBytes:plan.bytes.peakLive,...cleanup})});}catch(error){try{await close();}catch(cleanup){throw protocolError('Compact validation and cleanup both failed',error.reason??REASON.INCOMPLETE_COMMIT,new AggregateError([error,cleanup]));}throw normalize(error);}
  },
  async cancel(){need(!published&&(!closed||stopReason===REASON.CANCELLED||lost),'closed/committed wave cannot be reclassified as cancelled');stopReason=REASON.CANCELLED;await close();return protocolError('Candidate wave cancelled',lost?REASON.DEVICE_LOST:REASON.CANCELLED).outcome;},
  dispose:close,
  evaluate(){void close().catch(()=>{});throw protocolError('Physical microcode batch producer is unavailable',REASON.PHYSICS_SCOPE);}
 };
 return Object.freeze(api);
}
