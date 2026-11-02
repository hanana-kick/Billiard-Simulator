import {isNativePrefixCancellationCapability} from './native-selected-prefix-protocol.mjs';
import {snapshotOwnedBytes} from './owned-bytes.mjs';
/** Explicit experimental width-profile owner over owned input-only metadata + compiledpack.
 * Not wired into Worker defaults. No original WGSL graph or compiler is loaded. */
import {assertNativeSelectedEntry} from './native-selected-library.mjs';
import {createNativeSelectedTransport} from './native-selected-runner.mjs';
import {prepareNativeBatchedOwner} from './native-batched-owner-core.mjs';
import{NATIVE_COMPLETION_POLICY,nativeBatchEnd}from'./native-completion-batch.mjs';

import {snapshotSelectedInputs} from './selected-input-snapshot.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function prepareNativeSelectedInputOwner(options={}){
 if(Object.keys(options).some(k=>!['entry','device','moduleBytes','signal','onPrepareProgress'].includes(k)))throw Error('No caller resource budget, graph or transport override');
 const {entry,device,moduleBytes,signal,onPrepareProgress}=options;assertNativeSelectedEntry(entry);
 const {program,engine}=entry;const plan=program;
 if(!(moduleBytes instanceof Uint8Array)||!(moduleBytes.buffer instanceof ArrayBuffer))throw Error('Owned scheduler module bytes required');
 const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==entry.schedulerSHA256)throw Error('Scheduler module/runtime closure mismatch');
 if(signal?.aborted)throw Object.assign(Error(String(signal.reason)),{name:'AbortError'});
 const transport=await createNativeSelectedTransport(device,{program,signal,onPrepareProgress});
 let executionRecord=null;
 let active=null,terminal=null,lastGeneration=0,pendingGeneration=0,coreStartedGeneration=0;const bridgeCancellations=new WeakSet();
 const guard=g=>{if(terminal)throw terminal;if(!active||active.g!==g||active.cancelled){const error=Object.assign(Error('Cancelled compiled owner'),{name:'AbortError'});bridgeCancellations.add(error);throw error;}};
 const bridge={isCancellationError:error=>bridgeCancellations.has(error)||transport.isCancellationError(error),commandCount:plan.commandCount,completedSourceOrdinal:()=>transport.status().diagnostics.fencedSourceBoundary,
  async beginRun({generation,initialUploads,onPrefix,isOwnedPrefixCancellation,prefixCancellation}){if(active||!Number.isSafeInteger(generation)||generation<=lastGeneration)throw Error('Fresh drained compiled generation required');if(terminal)throw terminal;pendingGeneration=lastGeneration=generation;try{await transport.reset({initialUploads});active={g:generation,cursor:0,cancelled:false,onPrefix,isOwnedPrefixCancellation,prefixCancellation};}finally{pendingGeneration=0;}},
  async encodeChunk(handles,g){guard(g);if(!(handles instanceof Uint32Array)||!handles.length||handles.length!==nativeBatchEnd(active.cursor,plan.commandCount)-active.cursor||handles.some((h,i)=>h!==active.cursor+i+1||h>plan.commandCount))throw Error('Exact contiguous compiled source handles required');const result=await transport.runTo(handles[handles.length-1],{onPrefix:active.onPrefix,isOwnedPrefixCancellation:active.isOwnedPrefixCancellation,prefixCancellation:active.prefixCancellation});guard(g);if(result.completedOrdinal!==handles[handles.length-1])throw Error('GPU source cursor did not reach chunk goal');active.cursor=result.completedOrdinal;},
  async finish(g){guard(g);if(active.cursor!==plan.commandCount)throw Error('Incomplete compiled source graph');const result=await transport.finish();guard(g);if(!(result.world instanceof Uint32Array)||result.world.byteLength!==engine.outputs.world.bytes||!(result.trace instanceof Uint32Array)||result.trace.byteLength!==engine.outputs.trace.bytes||result.status.completedOrdinal!==plan.commandCount||result.status.final!==true)throw Error('Exact GPU full selected outputs required');active=null;return{world:result.world,trace:result.trace};},
  cancel(g){if(active?.g===g||pendingGeneration===g||coreStartedGeneration===g){if(active)active.cancelled=true;transport.cancel();}},lose(error){terminal??=error instanceof Error?error:Error(String(error));transport.cancel();},
  async drain(){await transport.drain();if(active?.cancelled)active=null;},dispose:()=>transport.dispose(),
  diagnostics(){const s=transport.status();return s.diagnostics?Object.freeze({...s.diagnostics,generation:active?.g??lastGeneration}):null;},
 };
 const core=await prepareNativeBatchedOwner({moduleBytes:scheduler,device,bridge,chunkSize:256,signal,metadata:{selected:true,nativeTransport:true,sourceRevision:program.sourceRevision,runtimeRevision:entry.runtimeRevision,totalOwnedBytes:entry.resources.totalOwnedBytes},snapshotRun(input){
  assertNativeSelectedEntry(entry);const current=snapshotSelectedInputs(engine,input);if(input.onPrefix!==undefined&&typeof input.onPrefix!=='function')throw Error('Native prefix callback required');const record=executionRecord;const isOwnedPrefixCancellation=record?.prefixCancellation?error=>executionRecord===record&&reserved===record&&record.cancelRequested===true&&record.generation===coreStartedGeneration&&record.prefixCancellation.isCancellationError(error)===true:undefined;return{begin:{initialUploads:current.initialUploads,onPrefix:input.onPrefix,isOwnedPrefixCancellation,prefixCancellation:record?.prefixCancellation}};
 }});
 const nativeResetIdentity=Object.freeze({nativeProgramSHA256:program.artifactSHA256,transformRevision:program.transformRevision,runtimeRevision:entry.runtimeRevision,sourceRevision:program.sourceRevision,artifactSHA256:engine.artifactSha256,ownedBytes:program.resources.totalOwnedBytes,retainedBuffers:234,retainedPipelines:109});
 let running=false,resetting=false,closing=false,lastCancelledGeneration=0,lastResetSequence=0,lastInvocationId=0,lastSettlementSequence=0,reserved=null;
 const {resetCancelledSchedule,runObserved,...publicCore}=core;
 const observe=record=>facts=>{if(facts.stage==='started'){record.generation=coreStartedGeneration=facts.generation;}else{record.settled=true;record.disposition=facts.disposition;record.failure=facts.failure;if(facts.disposition==='started-cancelled')lastCancelledGeneration=facts.generation;}};
 async function execute(input,record){if(closing||resetting||running)throw Error('Native owner lifecycle busy');running=true;executionRecord=record;lastCancelledGeneration=0;try{return await runObserved(input,observe(record));}finally{executionRecord=null;running=false;}}
 const healthy=()=>{const state=transport.status();if(closing||running||core.status().state!=='ready'||!state.healthy||state.disposed||state.mapsOpen)throw Error('Healthy settled native owner required');return state;};
 async function resetCancelled(targetRunGeneration,resetSequence){
  if(closing||running||resetting||core.status().state!=='ready'||!Number.isSafeInteger(targetRunGeneration)||targetRunGeneration<1||targetRunGeneration!==lastCancelledGeneration||targetRunGeneration!==core.status().generation||resetSequence!==lastResetSequence+1)throw Error('Settled cancelled native generation and fresh reset sequence required');
  resetting=true;try{const result=await transport.resetAfterCancellation({resetSequence});if(closing||running||core.status().state!=='ready')throw Error('Native owner reset interrupted');resetCancelledSchedule(targetRunGeneration);lastResetSequence=resetSequence;lastCancelledGeneration=0;return Object.freeze({...nativeResetIdentity,...result,kind:'native-selected-reset-receipt-v1',targetRunGeneration,runSettled:true});}finally{resetting=false;}
 }

 return Object.freeze({...publicCore,nativeResetIdentity,nativeExecutionPolicy:NATIVE_COMPLETION_POLICY,
  async run(input={}){if(reserved&&!reserved.consumed)throw Error('Reserved native invocation exists');return execute(input,{});},
  reserveSupersedableRun({invocationId}={}){healthy();if(resetting||reserved&&!reserved.consumed&&reserved.disposition!=='complete'||!Number.isSafeInteger(invocationId)||invocationId<=lastInvocationId)throw Error('Fresh exclusive native invocation required');lastInvocationId=invocationId;reserved={invocationId,generation:null,invoked:false,settled:false,cancelRequested:false,consumed:false,disposition:'reserved'};},
  failSupersedableReservation({invocationId,error}={}){if(!reserved||reserved.invocationId!==invocationId||reserved.invoked||reserved.consumed)throw Error('Current uninvoked reservation required');reserved.settled=true;reserved.disposition='failure';reserved.failure=error;},
  async runSupersedable(input={}, {invocationId,prefixCancellation}={}){const record=reserved;if(!record||record.invocationId!==invocationId||record.invoked||record.consumed||record.disposition==='failure')throw Error('Owned native reservation required');if(record.cancelRequested){record.settled=true;record.disposition='not-started';throw Object.assign(Error('Reserved native invocation cancelled before start'),{name:'AbortError'});}if(prefixCancellation!==undefined&&!isNativePrefixCancellationCapability(prefixCancellation))throw TypeError('Owned prefix cancellation capability required');record.prefixCancellation=prefixCancellation;record.invoked=true;return execute(input,record);},
  cancel(reason){if(reserved&&!reserved.consumed)reserved.cancelRequested=true;const accepted=core.cancel(reason);if(accepted){transport.cancel();}return accepted||!!(reserved&&!reserved.consumed&&!reserved.invoked);},
  async resetAfterCancellation({targetRunGeneration,resetSequence}={}){const record=reserved;const receipt=await resetCancelled(targetRunGeneration,resetSequence);if(record&&reserved===record&&record.settled&&record.disposition==='started-cancelled'&&record.generation===targetRunGeneration)record.consumed=true;return receipt;},
  async settleSupersededRun({invocationId,settlementSequence}={}){
   const record=reserved;if(!record||record.invocationId!==invocationId||record.consumed||(!record.cancelRequested&&record.disposition!=='complete')||settlementSequence!==lastSettlementSequence+1||resetting||running)throw Error('Current cancelled settled invocation required');
   if(record.disposition==='failure')throw record.failure;
   if(!record.invoked){record.settled=true;record.disposition='not-started';}
   if(!record.settled||!['not-started','complete','started-cancelled'].includes(record.disposition))throw Error('Native invocation disposition unavailable');
   healthy();let reset=null;
   if(record.disposition==='started-cancelled')reset=await resetCancelled(record.generation,lastResetSequence+1);
   else{resetting=true;try{await transport.drain();healthy();}finally{resetting=false;}}
   healthy();if(reserved!==record||record.consumed)throw Error('Native settlement superseded');record.consumed=true;lastSettlementSequence=settlementSequence;
   return Object.freeze({...nativeResetIdentity,kind:'native-selected-superseded-settlement-v1',invocationId,settlementSequence,disposition:reset?'cancelled-reset':record.disposition==='complete'?'completed':'not-started',targetRunGeneration:record.generation,resetPerformed:!!reset,resetSequence:lastResetSequence,runSettled:true,gpuFenced:true,mapsOpen:0,needsFullInputUpload:true,disposed:false,destroyed:false,...(reset?{mutableStateReset:true}:{})});
  },
  dispose(){closing=true;return core.dispose();},
 });
}

