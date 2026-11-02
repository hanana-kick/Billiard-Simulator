import {snapshotGPULossDiagnostics} from '../wasm-gpu/gpu-execution-diagnostics.mjs';
/** One live compute-device generation. No renderer or canonical state ownership. */
const ownedAborts=new WeakSet();
const aborted=reason=>{const e=Error(String(reason??'Compute generation cancelled'));e.name='AbortError';ownedAborts.add(e);return e;};
export async function createComputeGenerationFacade(options={}){
 let{device,requestDevice,createGeneration,signal}=options;options=null;
 if(!device||typeof device.lost?.then!=='function'||typeof requestDevice!=='function'||typeof createGeneration!=='function')throw TypeError('Owned device generation factories required');
 const identity=Object.freeze({kind:'wasm-compute-identity-v1'}),versions={search:0,selected:0};let current=null,mode=null,epoch=0,tail=Promise.resolve(),active=null,closed=false,disposal=null,fatal=null,lossReported=false,draining=null,resetting=false,lastCoordinator=null,resolveLost;
 const speculative=new WeakMap();let speculativeCurrent=null;
 const lost=new Promise(resolve=>{resolveLost=resolve;});
 const devices=new WeakSet();let generationCount=0,activityRevision=0;
 const check=()=>{if(closed)throw Error('Compute generation facade disposed');if(fatal)throw fatal;};
 function cancelGroup(group,reason){versions[group]++;if(active?.group===group)active.abort.abort(reason);try{current?.child?.[group==='search'?'cancelSearch':'cancelSelected']?.(reason);}catch(error){fatal??=error;}}
 function cancel(reason='Compute generation cancelled'){cancelGroup('search',reason);cancelGroup('selected',reason);}
 function recordDevice(d){if(!d||typeof d.lost?.then!=='function')throw TypeError('Fresh GPU device required');if(devices.has(d))throw Error('Replacement must be a fresh compute device');const lossState={generation:++generationCount,intentional:false},r={device:d,child:null,lossState,destroyed:false,retirement:null};devices.add(d);const loss=info=>{if(lossState.intentional&&info?.reason==='destroyed')return;if(lossReported)return;lossReported=true;const value=Object.freeze({reason:info?.reason??'unknown',message:info?.message??String(info??'GPU device lost'),...(info?.cleanupVerified===false?{cleanupVerified:false}:{}),...(info?.diagnostics?{diagnostics:snapshotGPULossDiagnostics(info.diagnostics)}:{})});fatal=Error('GPU device lost: '+value.message);fatal.deviceLoss=value;resolveLost(value);cancel(fatal.message);};Promise.resolve(d.lost).then(loss,loss);d=null;return r;}
 async function destroy(r){if(r.destroyed)return;r.lossState.intentional=true;r.destroyed=true;await r.device.destroy();r.device=null;}
 function retire(r){if(!r)return Promise.resolve();if(r.retirement)return r.retirement;r.retirement=(async()=>{await r.child?.dispose();lastCoordinator=r.child?.status?.().coordinator??lastCoordinator;r.child=null;await destroy(r);})();return r.retirement;}
 async function initialize(d,operationSignal,{ownedOnFailure=true,requestedMode='selected'}={}){const r=recordDevice(d);try{if(operationSignal?.aborted)throw aborted(operationSignal.reason);r.child=await createGeneration(d,operationSignal,{mode:requestedMode});if(operationSignal?.aborted)throw aborted(operationSignal.reason);check();return r;}catch(error){try{if(ownedOnFailure)await retire(r);else await r.child?.dispose();}catch(cleanup){const failure=new AggregateError([error,cleanup],'Compute generation initialization cleanup failed');if(ownedOnFailure){current=r;fatal=failure;}throw failure;}throw error;}}
 try{current=await initialize(device,signal,{ownedOnFailure:false});}catch(error){closed=true;throw error;}finally{device=null;}const sourceRevision=current.child.sourceRevision;mode=current.child.status?.().residentMode??null;
 function runMode(group,work,{signal:operationSignal,expectedEpoch}={}){
  activityRevision++;
  try{check();if(draining)throw aborted('Compute cancellation is still draining');}catch(error){return Promise.reject(error);}const ticket=versions[group];
  const result=tail.then(async()=>{check();if(ticket!==versions[group]||operationSignal?.aborted)throw aborted(operationSignal?.reason);if(expectedEpoch!==undefined&&expectedEpoch!==epoch)throw aborted('Stale compute generation view');const abort=new AbortController(),relay=()=>abort.abort(operationSignal.reason);active={group,abort};
   const currentCheck=()=>{check();if(ticket!==versions[group]||abort.signal.aborted)throw aborted(abort.signal.reason);};
   try{operationSignal?.addEventListener('abort',relay,{once:true});if(operationSignal?.aborted)relay();currentCheck();
    if(mode!==null&&mode!==group){const previous=current;epoch++;try{await retire(previous);}catch(error){fatal=error;throw error;}current=null;mode=null;currentCheck();}
    if(!current){const d=await requestDevice({signal:abort.signal});try{currentCheck();}catch(error){const r=recordDevice(d);try{await destroy(r);}catch(cleanup){current=r;fatal=new AggregateError([error,cleanup],'Late compute generation cleanup failed');throw fatal;}throw error;}current=await initialize(d,abort.signal,{requestedMode:group});currentCheck();}
    mode=group;const generation=current,viewEpoch=epoch,value=await work(generation.child,generation.device,viewEpoch,abort.signal);currentCheck();if(current!==generation||epoch!==viewEpoch)throw aborted('Compute generation changed');return value;
   }finally{operationSignal?.removeEventListener('abort',relay);active=null;}
  });tail=result.catch(()=>{});return result;
 }
 // Cancellation acceptance is not cleanup. Retire only after queued work has
 // settled, and await the existing verified Worker drain/destroy acknowledgement.
 function cancelAndDrain(reason='Explicit compute cancellation'){
  if(draining&&!resetting)return draining;
  resetting=false;
  try{check();}catch(error){return Promise.reject(error);}
  cancel(reason);
  const result=tail.then(async()=>{check();epoch++;try{await retire(current);if(fatal)throw fatal;current=null;mode=null;}catch(error){fatal=error;throw error;}});
  draining=result;tail=result.catch(()=>{});
  result.then(()=>{if(draining===result)draining=null;},()=>{if(draining===result)draining=null;});
  return result;
 }
 // Explicit native-only reuse. Cancellation ACK alone never admits another run.
 function cancelAndReset(reason='Explicit reusable selected cancellation'){
  if(draining)return draining;
  try{check();}catch(error){return Promise.reject(error);}
  if(mode!=='selected'||current?.child?.nativeReusableCancellation!==true||typeof current.child.cancelAndReset!=='function')return cancelAndDrain(reason);
  const generation=current;resetting=true;cancel(reason);
  const result=tail.then(async()=>{
   epoch++;
   try{
    check();if(current!==generation)throw Error('Reusable reset generation changed');
    const receipt=await generation.child.cancelAndReset(reason);
    check();
    if(receipt?.kind!=='native-selected-reset-receipt-v1'||receipt.runSettled!==true||receipt.gpuFenced!==true||receipt.prefixDrained!==true||receipt.mapsOpen!==0||receipt.mutableStateReset!==true||receipt.needsFullInputUpload!==true||receipt.retainedPipelines!==109||receipt.retainedBuffers!==234||receipt.ownedBytes!==9051588||receipt.disposed!==false||receipt.destroyed!==false||!Number.isSafeInteger(receipt.resetSequence)||receipt.resetSequence<1||receipt.resetSequence<=(generation.resetSequence??0))throw Error('Invalid native selected reusable reset receipt');
    generation.resetSequence=receipt.resetSequence;
    return receipt;
   }catch(error){
    // Reuse is never a recovery from an unhealthy/ambiguous reset.
    try{await retire(generation);current=null;mode=null;}catch(cleanup){fatal=new AggregateError([error,cleanup],'Reusable reset retirement failed');throw fatal;}
    fatal??=error;throw error;
   }
  });
  draining=result;tail=result.catch(()=>{});
  const done=()=>{if(draining===result){draining=null;resetting=false;}};
  result.then(done,done);return result;
 }
 function reserveSpeculativeSelection(){
  check();if(draining||active||mode!=='selected'||!current||speculativeCurrent&&!speculativeCurrent.settled&&!(speculativeCurrent.executionSettled&&!speculativeCurrent.failurePresent))throw Error('Idle selected generation required for speculative reservation');
  const token=Object.freeze({kind:'owned-speculative-selection-v1'}),record={generation:current,epoch,version:versions.selected,activity:activityRevision,bound:false,closed:false,settled:false,target:null,promise:null,failurePresent:false,failure:null,settlement:null};speculative.set(token,record);speculativeCurrent=record;return token;
 }
 function isSpeculativeCancellationFailure(token,error){const record=speculative.get(token);return !!record?.settled&&record.failurePresent&&record.failure===error&&(ownedAborts.has(error)||record.generation.child?.isOwnedSelectedCancellation?.(error)===true||record.target?.acceptsCancellationFailure(error)===true);}
 function settleSupersededSelection(token,reason='Speculative selected request superseded'){
  const record=speculative.get(token);if(!record)return Promise.reject(Error('Owned speculative selection token required'));if(record.settlement)return record.settlement;
  try{check();if(draining||speculativeCurrent!==record||record.activity!==activityRevision||record.version!==versions.selected||record.generation!==current||record.epoch!==epoch)throw Error('Speculative generation is not current');}catch(error){return Promise.reject(error);}
  record.closed=true;resetting=true;cancelGroup('selected',reason);const generation=current;
  const result=tail.then(async()=>{
   try{check();if(current!==generation||generation.destroyed||generation.retirement)throw Error('Speculative selected owner retired');
    let receipt;
    if(record.target)receipt=await record.target.settle();
    else{const endpoint=generation.device?.status?.();if(!endpoint||endpoint.dead!==false||endpoint.closed!==false||endpoint.workerRetained!==true||endpoint.pending!==0)throw Error('No-target settlement requires healthy idle endpoint');receipt=Object.freeze({kind:'frontend-selected-no-worker-work-v1',invocationSettled:true,workerTargetAbsent:true});}
    if(record.failurePresent&&!ownedAborts.has(record.failure)&&generation.child?.isOwnedSelectedCancellation?.(record.failure)!==true&&record.target?.acceptsCancellationFailure(record.failure)!==true)throw record.failure;
    check();if(draining!==result||!resetting||current!==generation)throw aborted('Speculative settlement promoted to retirement');
    if(record.target){if(receipt?.kind!=='native-selected-superseded-settlement-v1'||!['not-started','completed','cancelled-reset'].includes(receipt.disposition)||receipt.runSettled!==true||receipt.gpuFenced!==true||receipt.prefixDrained!==true||receipt.mapsOpen!==0||receipt.needsFullInputUpload!==true||receipt.ownedBytes!==9051588||receipt.retainedBuffers!==234||receipt.retainedPipelines!==109||receipt.disposed!==false||receipt.destroyed!==false||receipt.resetPerformed!==(receipt.disposition==='cancelled-reset')||!Number.isSafeInteger(receipt.resetSequence)||receipt.resetSequence!==(generation.resetSequence??0)+(receipt.resetPerformed?1:0)||(receipt.resetPerformed&&receipt.mutableStateReset!==true)||(receipt.disposition==='not-started'?receipt.targetRunGeneration!==null:!Number.isSafeInteger(receipt.targetRunGeneration)||receipt.targetRunGeneration<1))throw Error('Invalid superseded selected settlement receipt');generation.resetSequence=receipt.resetSequence;}
    epoch++;record.settled=true;return receipt;
   }catch(error){try{await retire(generation);if(current===generation){current=null;mode=null;}}catch(cleanup){fatal=new AggregateError([error,cleanup],`${String(error?.message??error)}; speculative retirement failed`,{cause:error});throw fatal;}fatal??=error instanceof Error?error:new Error(String(error),{cause:error});throw error;}
  });record.settlement=result;draining=result;tail=result.catch(()=>{});const done=()=>{if(draining===result){draining=null;resetting=false;}};result.then(done,done);return result;
 }
 function dispose(){if(disposal)return disposal;closed=true;cancel('Compute generation facade disposed');disposal=tail.then(async()=>{await retire(current);current=null;mode=null;});tail=disposal.catch(()=>{});return disposal;}
 const open=other=>{check();if(draining)throw aborted('Compute cancellation is still draining');if(other!==identity)throw Error('Owned immutable compute identity required');};
 function captureSelectedResultGuard(){
  check();const record=current,version=versions.selected,ownedEpoch=epoch,activity=activityRevision;
  const assertCurrent=()=>{check();if(!record||current!==record||record.destroyed||record.retirement||mode!=='selected'||epoch!==ownedEpoch||versions.selected!==version||activityRevision!==activity||active||draining||resetting)throw aborted('Prepared selected result generation retired');const endpoint=record.device?.status?.();if(!endpoint||endpoint.dead!==false||endpoint.closed!==false||endpoint.workerRetained!==true||endpoint.pending!==0)throw Error('Prepared result requires a healthy settled owned Worker');};
  assertCurrent();return Object.freeze({kind:'canonical-selected-result-lease-guard-v1',assertCurrent});
 }
 return Object.freeze({identity,lost,captureSelectedResultGuard,reserveSpeculativeSelection,settleSupersededSelection,isSpeculativeCancellationFailure,
  async createSearchEngine(other,args){open(other);let view,viewEpoch;try{await runMode('search',async(child,d,e,s)=>{viewEpoch=e;view=await child.createSearchEngine(d,{...args,signal:s});},{signal:args?.signal});}catch(error){view?.dispose();throw error;}let released=false;return Object.freeze({...view,dispose(){released=true;return view.dispose();},run(options){if(released)return Promise.reject(Error('Search view disposed'));return runMode('search',(_child,_d,_e,s)=>view.run({...options,signal:s}),{signal:options?.signal,expectedEpoch:viewEpoch});}});},
  async createSelectedEngine(other,binding,args){open(other);let released=false,view=null,operation=null;return Object.freeze({buildRevision:sourceRevision,preparation:'wasm-program-selected',requiresExclusiveDevice:true,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',async runRaw(batch,options={}){
   if(released||operation)throw Error('Selected view disposed or active');const {speculativeSelection,...runOptions}=options,record=speculativeSelection===undefined?null:speculative.get(speculativeSelection);
   if(speculativeSelection!==undefined&&!record)throw Error('Owned speculative token required');
   if(record&&(record.bound||record.closed||speculativeCurrent!==record||record.activity!==activityRevision||record.version!==versions.selected||record.generation!==current||record.epoch!==epoch)){const error=aborted('Stale speculative selection');record.failurePresent=true;record.failure=error;throw error;}
   if(record){record.bound=true;record.activity=activityRevision+1;}const abort=new AbortController(),relay=()=>abort.abort(options.signal.reason);operation=abort;
   const work=(async()=>{try{options.signal?.addEventListener('abort',relay,{once:true});if(options.signal?.aborted)relay();return await runMode('selected',async(child,d,_e,s)=>{if(released||record?.closed)throw aborted('Selected view disposed or superseded');view=await child.createSelectedEngine(d,binding,args);try{if(released||s.aborted||record?.closed)throw aborted(s.reason);return await view.runRaw(batch,{...runOptions,signal:s,onOwnedSelectedTarget:record?target=>{if(record.target||typeof target?.settle!=='function'||typeof target?.acceptsCancellationFailure!=='function')throw Error('Single owned selected target required');record.target=target;}:undefined});}finally{view.dispose();view=null;}},{signal:abort.signal});}catch(error){if(record){record.failurePresent=true;record.failure=error;}throw error;}finally{options.signal?.removeEventListener('abort',relay);operation=null;if(record)record.executionSettled=true;}})();if(record)record.promise=work;return await work;
  },dispose(){released=true;operation?.abort('Selected view disposed');view?.dispose();}});},
  cancelSearch:reason=>cancelGroup('search',reason),cancelSelected:reason=>cancelGroup('selected',reason),cancel,cancelAndDrain,cancelAndReset,dispose,
  status:()=>Object.freeze({disposed:closed,residentMode:mode,modeEpoch:epoch,deviceGenerations:generationCount,coordinator:current?.child?.status?.().coordinator??lastCoordinator}),
 });
}
