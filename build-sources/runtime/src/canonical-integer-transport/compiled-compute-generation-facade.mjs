import {snapshotGPULossDiagnostics} from '../wasm-gpu/gpu-execution-diagnostics.mjs';
/** One live compute-device generation. No renderer or canonical state ownership. */
const aborted=reason=>{const e=Error(String(reason??'Compute generation cancelled'));e.name='AbortError';return e;};
export async function createComputeGenerationFacade(options={}){
 let{device,requestDevice,createGeneration,signal}=options;options=null;
 if(!device||typeof device.lost?.then!=='function'||typeof requestDevice!=='function'||typeof createGeneration!=='function')throw TypeError('Owned device generation factories required');
 const identity=Object.freeze({kind:'wasm-compute-identity-v1'}),versions={search:0,selected:0};let current=null,mode=null,epoch=0,tail=Promise.resolve(),active=null,closed=false,disposal=null,fatal=null,lossReported=false,draining=null,resetting=false,lastCoordinator=null,resolveLost;
 const lost=new Promise(resolve=>{resolveLost=resolve;});
 const devices=new WeakSet();let generationCount=0;
 const check=()=>{if(closed)throw Error('Compute generation facade disposed');if(fatal)throw fatal;};
 function cancelGroup(group,reason){versions[group]++;if(active?.group===group)active.abort.abort(reason);try{current?.child?.[group==='search'?'cancelSearch':'cancelSelected']?.(reason);}catch(error){fatal??=error;}}
 function cancel(reason='Compute generation cancelled'){cancelGroup('search',reason);cancelGroup('selected',reason);}
 function recordDevice(d){if(!d||typeof d.lost?.then!=='function')throw TypeError('Fresh GPU device required');if(devices.has(d))throw Error('Replacement must be a fresh compute device');const lossState={generation:++generationCount,intentional:false},r={device:d,child:null,lossState,destroyed:false,retirement:null};devices.add(d);const loss=info=>{if(lossState.intentional&&info?.reason==='destroyed')return;if(lossReported)return;lossReported=true;const value=Object.freeze({reason:info?.reason??'unknown',message:info?.message??String(info??'GPU device lost'),...(info?.cleanupVerified===false?{cleanupVerified:false}:{}),...(info?.diagnostics?{diagnostics:snapshotGPULossDiagnostics(info.diagnostics)}:{})});fatal=Error('GPU device lost: '+value.message);fatal.deviceLoss=value;resolveLost(value);cancel(fatal.message);};Promise.resolve(d.lost).then(loss,loss);d=null;return r;}
 async function destroy(r){if(r.destroyed)return;r.lossState.intentional=true;r.destroyed=true;await r.device.destroy();r.device=null;}
 function retire(r){if(!r)return Promise.resolve();if(r.retirement)return r.retirement;r.retirement=(async()=>{await r.child?.dispose();lastCoordinator=r.child?.status?.().coordinator??lastCoordinator;r.child=null;await destroy(r);})();return r.retirement;}
 async function initialize(d,operationSignal,{ownedOnFailure=true,requestedMode='selected'}={}){const r=recordDevice(d);try{if(operationSignal?.aborted)throw aborted(operationSignal.reason);r.child=await createGeneration(d,operationSignal,{mode:requestedMode});if(operationSignal?.aborted)throw aborted(operationSignal.reason);check();return r;}catch(error){try{if(ownedOnFailure)await retire(r);else await r.child?.dispose();}catch(cleanup){const failure=new AggregateError([error,cleanup],'Compute generation initialization cleanup failed');if(ownedOnFailure){current=r;fatal=failure;}throw failure;}throw error;}}
 try{current=await initialize(device,signal,{ownedOnFailure:false});}catch(error){closed=true;throw error;}finally{device=null;}const sourceRevision=current.child.sourceRevision;mode=current.child.status?.().residentMode??null;
 function runMode(group,work,{signal:operationSignal,expectedEpoch}={}){
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
    if(receipt?.kind!=='native-selected-reset-receipt-v1'||receipt.runSettled!==true||receipt.gpuFenced!==true||receipt.prefixDrained!==true||receipt.mapsOpen!==0||receipt.mutableStateReset!==true||receipt.needsFullInputUpload!==true||receipt.retainedPipelines!==109||receipt.retainedBuffers!==234||receipt.ownedBytes!==9048004||receipt.disposed!==false||receipt.destroyed!==false||!Number.isSafeInteger(receipt.resetSequence)||receipt.resetSequence<1||receipt.resetSequence<=(generation.resetSequence??0))throw Error('Invalid native selected reusable reset receipt');
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
 function dispose(){if(disposal)return disposal;closed=true;cancel('Compute generation facade disposed');disposal=tail.then(async()=>{await retire(current);current=null;mode=null;});tail=disposal.catch(()=>{});return disposal;}
 const open=other=>{check();if(draining)throw aborted('Compute cancellation is still draining');if(other!==identity)throw Error('Owned immutable compute identity required');};
 return Object.freeze({identity,lost,
  async createSearchEngine(other,args){open(other);let view,viewEpoch;try{await runMode('search',async(child,d,e,s)=>{viewEpoch=e;view=await child.createSearchEngine(d,{...args,signal:s});},{signal:args?.signal});}catch(error){view?.dispose();throw error;}let released=false;return Object.freeze({...view,dispose(){released=true;return view.dispose();},run(options){if(released)return Promise.reject(Error('Search view disposed'));return runMode('search',(_child,_d,_e,s)=>view.run({...options,signal:s}),{signal:options?.signal,expectedEpoch:viewEpoch});}});},
  async createSelectedEngine(other,binding,args){open(other);let released=false,view=null,operation=null;return Object.freeze({buildRevision:sourceRevision,preparation:'wasm-program-selected',requiresExclusiveDevice:true,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',async runRaw(batch,options={}){if(released||operation)throw Error('Selected view disposed or active');const abort=new AbortController(),relay=()=>abort.abort(options.signal.reason);operation=abort;try{options.signal?.addEventListener('abort',relay,{once:true});if(options.signal?.aborted)relay();return await runMode('selected',async(child,d,_e,s)=>{if(released)throw aborted('Selected view disposed');view=await child.createSelectedEngine(d,binding,args);try{if(released||s.aborted)throw aborted(s.reason);return await view.runRaw(batch,{...options,signal:s});}finally{view.dispose();view=null;}},{signal:abort.signal});}finally{options.signal?.removeEventListener('abort',relay);operation=null;}},dispose(){released=true;operation?.abort('Selected view disposed');view?.dispose();}});},
  cancelSearch:reason=>cancelGroup('search',reason),cancelSelected:reason=>cancelGroup('selected',reason),cancel,cancelAndDrain,cancelAndReset,dispose,
  status:()=>Object.freeze({disposed:closed,residentMode:mode,modeEpoch:epoch,deviceGenerations:generationCount,coordinator:current?.child?.status?.().coordinator??lastCoordinator}),
 });
}
