import {selectedPrimaryFailure} from './selected-failure-preservation.mjs';
/** One complete MANUAL result lease. No GPU math, identity migration or early commit. */
export function withPreparedManualTicket(adapter,{snapshotContext,captureResultGuard,reserveSpeculativeSelection,settleSupersededSelection,isBenignStale=()=>false}={}){
 const entries=new WeakMap();let current=null,running=null,settling=null,version=0,closed=false,failureLatch=null;
 const error=(message,code='PREPARED_MANUAL_INVALID')=>Object.assign(Error(message),{code});
 const invalidate=reason=>{version++;if(current){current.state='invalidated';current.reason=String(reason);current.result=null;current.guard=null;current=null;}};
 const context=()=>{if(closed)throw error('Prepared manual adapter disposed');return snapshotContext();};
 const check=e=>{if(closed||current!==e||e.version!==version||e.context!==context())throw error('Prepared manual input or revision changed');e.guard?.assertCurrent();e.result?.assertCurrent();};
 // Runtime failure wins over ordinary stale input; an edit is a miss, not a
 // fatal health latch. Context includes the live revision, so ABA still misses.
 const refreshReady=e=>{e.guard?.assertCurrent();if(closed||current!==e||e.version!==version||e.context!==context()){e.state='invalidated';e.result=null;e.guard=null;if(current===e)current=null;return false;}e.result?.assertCurrent();return true;};
 const failEntry=(e,failure)=>{failureLatch??=failure;e.failure=failure;e.state='failed';e.result=null;e.guard=null;};
 const status=e=>{if(e.state==='ready'||e.state==='claimed'){try{if(e.state==='ready')refreshReady(e);else check(e);}catch(failure){failEntry(e,failure);}}return Object.freeze({state:e.state,requestId:e.requestId,candidateId:e.candidateId});};
 const fields=['kind','implementation','identity','purpose','physicsResultComplete','captureComplete','samplingComplete','scoreAndTurnCommitted'];
 const allowed=['purpose','requestId','candidateId','raw','continuation','budget','executionProfile','maximumRecords','strikeBackend','signal'];
 const api={...adapter,
  cancel(reason){invalidate(reason??'Manual preparation cancelled');return adapter.cancel(reason);},
  dispose(){invalidate('Manual preparation disposed');closed=true;return adapter.dispose();},
  runSelected(input){if(failureLatch)throw failureLatch;if(running||settling)throw error('Prepared computation must settle before replacement');invalidate('Explicit selected request replaces preparation');return adapter.runSelected(input);},
  prepareManual(input){
   if(closed)throw error('Prepared manual adapter disposed');if(failureLatch)throw failureLatch;if(typeof captureResultGuard!=='function')throw error('Owned runtime result health guard unavailable');
   if(!input||Object.keys(input).some(k=>!allowed.includes(k))||input.purpose!=='manual')throw error('Exact manual preparation request required');
   const max=input.maximumRecords??128;if(!Number.isSafeInteger(max)||max<1||max>256)throw error('Prepared result record capacity must be1..256');
   if(running||settling)throw error('Pending preparation requires settlement and cleanup before replacement');
   if(current?.state==='claimed')throw error('Claimed manual result still owns playback');
   invalidate('Manual preparation replaced');
   const signal=input.signal,owned=structuredClone(Object.fromEntries(Object.entries(input).filter(([k])=>k!=='signal'))),e={version,context:context(),requestId:owned.requestId,candidateId:owned.candidateId,state:'pending',result:null,guard:null,failure:null,localStale:false,selection:typeof reserveSpeculativeSelection==='function'?reserveSpeculativeSelection():null};current=e;running=e;
   let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
   e.ready=ready;const ticket=Object.freeze({kind:'canonical-prepared-manual-ticket-v1',ready,status:()=>status(e)});entries.set(ticket,e);
   // Exactly the original manual path; no prefix callback/presentation capability.
   Promise.resolve().then(()=>{if(e.localStale)return null;check(e);return adapter.runSelected({...owned,signal,speculativeSelection:e.selection??undefined});}).then(result=>{
    if(e.localStale){e.state='invalidated';if(current===e)current=null;if(running===e)running=null;resolveReady();return;}check(e);if(result?.kind!=='canonical-application-selected-v1'||result.purpose!=='manual'||result.physicsResultComplete!==true||result.captureComplete!==true||typeof result.samplingComplete!=='boolean'||typeof result.commitState!=='function')throw error('Complete validated manual capture required');
    const guard=captureResultGuard();if(guard?.kind!=='canonical-selected-result-lease-guard-v1'||typeof guard.assertCurrent!=='function')throw error('Owned selected result guard required');guard.assertCurrent();result.assertCurrent();check(e);
    e.guard=guard;e.result=result;e.state='ready';if(running===e)running=null;resolveReady();
   }).catch(failure=>{e.result=null;e.guard=null;if(e.superseding){e.hasFailure=true;e.failure=failure;e.state='settling';if(running===e)running=null;rejectReady(failure);return;}if(e.localStale&&isBenignStale(failure)){e.state='invalidated';if(current===e)current=null;if(running===e)running=null;resolveReady();}else{if(e.state!=='invalidated')failureLatch??=failure;e.failure=failure;if(e.state!=='invalidated')e.state='failed';if(running===e)running=null;rejectReady(failure);}}).finally(()=>{if(running===e)running=null;});
   return ticket;
  },
  supersedePreparedManual(ticket,reason='Superseded speculative input'){
   const e=entries.get(ticket);if(!e)throw error('Foreign prepared manual ticket');if(e.supersession)return e.supersession;
   if(e.state==='claimed'||e.state==='consumed')throw error('Claimed playback cannot be superseded as speculation');if(e.state==='failed')throw e.failure;
   if(!e.selection||typeof settleSupersededSelection!=='function')throw error('Owned speculative settlement unavailable');
   e.localStale=true;e.superseding=true;e.state='settling';version++;e.result=null;e.guard=null;settling=e;
   e.supersession=Promise.resolve().then(()=>settleSupersededSelection(e.selection,reason)).then(async owned=>{
    await e.ready.catch(()=>{});
    if(!owned||typeof owned.acceptsCancellationFailure!=='function'||!owned.receipt)throw error('Owned speculative settlement proof required');
    if(e.hasFailure&&!isBenignStale(e.failure)&&!owned.acceptsCancellationFailure(selectedPrimaryFailure(e.failure)))throw e.failure;
    e.state='invalidated';if(current===e)current=null;return owned.receipt;
   }).catch(failure=>{failureLatch??=failure;e.failure=failure;e.state='failed';throw failure;}).finally(()=>{if(settling===e)settling=null;if(running===e)running=null;});
   e.supersession.catch(()=>{});return e.supersession;
  },
  invalidatePreparedManual(ticket,reason='Manual input changed'){
   const e=entries.get(ticket);if(!e)throw error('Foreign prepared manual ticket');if(e.state==='claimed')throw error('Claimed playback requires ordinary cancellation');
   if(e.state==='failed')throw e.failure??error('Manual preparation failed');
   if(e.state==='invalidated'||e.state==='consumed')return;
   e.localStale=true;e.reason=String(reason);version++;e.result=null;e.guard=null;
   if(running===e)e.state='stale-pending';else{e.state='invalidated';if(current===e)current=null;}
  },
  claimPreparedManual(ticket){
   const e=entries.get(ticket);if(!e)throw error('Foreign prepared manual ticket');if(e.state==='failed')throw e.failure??error('Manual preparation failed');if(e.state!=='ready')return null;
   try{if(!refreshReady(e))return null;}catch(failure){failEntry(e,failure);throw failure;}
   e.state='claimed';let commitAttempted=false;
   const valid=()=>{if(e.state!=='claimed')throw error('Prepared manual result no longer claimed');check(e);if(!e.result)throw error('Prepared result released');};
   const out={};for(const k of fields)out[k]=structuredClone(e.result[k]);
   out.assertCurrent=valid;
   for(const name of['readSourceContext','readOutcome','readFinalState','sampleAt'])out[name]=(...args)=>{valid();const value=e.result[name](...args);valid();return value;};
   out.presentAt=(tick,present,options)=>{valid();if(typeof present!=='function')throw TypeError('Presentation callback required');const value=e.result.presentAt(tick,sample=>{valid();present(sample);valid();},options);valid();return value;};
   out.commitState=()=>{valid();if(commitAttempted)throw error('Prepared manual commit is single-use');commitAttempted=true;try{return e.result.commitState();}finally{e.state='consumed';e.result=null;e.guard=null;if(current===e)current=null;}};
   return Object.freeze(out);
  },
  preparedManualLeaseStatus(){return Object.freeze({maximumResults:1,retainedResults:current?.result?1:0,pending:running!==null||settling!==null,maximumRecords:256,rawTraceCapacityBytes:4194368,additionalTraceCopies:0,exactAggregateHostBytesKnown:false});},
 };
 return Object.freeze(api);
}
