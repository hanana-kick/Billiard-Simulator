import {createComputeGenerationFacade} from './compute-generation-facade.mjs';
/** Inert until the verified bundler replaces both independent build stubs.
 * Public callers cannot inject a seal, program library, source revision or owner.
 * A stable branded facade owns one drained compute-device generation per mode.
 */
import {WASM_GPU_BUILD_CONFIGURATION} from './build-configuration.mjs';
import {LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION} from '../direct-candidate/experimental-live-world-build-seal.mjs';
import {createWasmGpuInputLibrary,assertIntegrityVerifiedWasmGpuInputLibrary} from './input-library.mjs';
import {createWasmGpuWorkerCoordinator} from './device-coordinator.mjs';
import {createSealedWorkerOwnerEndpoint,assertWorkerOwnerEndpoint} from './worker-owner-client.mjs';
import {createWasmGpuCompactSearchBackendHarness} from './compact-search-backend.mjs';
import {createWasmGpuSelectedSessionBackendHarness} from './selected-session-backend.mjs';
import {createCanonicalPreparationScope} from '../direct-candidate/canonical-page-preparation.mjs';
const runtimes=new WeakMap(),MiB=1024*1024;
const abortError=reason=>{const e=Error(String(reason??'WASM runtime preparation cancelled'));e.name='AbortError';return e;};
export function assertWasmGpuProductionRuntime(runtime,device){const owned=runtimes.get(runtime);if(!owned||device&&owned.device!==device)throw TypeError('Owned sealed WASM GPU production runtime required');return runtime;}
function configuration(){
 const c=WASM_GPU_BUILD_CONFIGURATION;
 if(!LIVE_WORLD_UPLOAD_SOURCE_SEALED||!c||Object.keys(c).sort().join(',')!=='manifestSha256,relativeBase,sourceRevision'||typeof c.sourceRevision!=='string'||c.sourceRevision!==LIVE_WORLD_UPLOAD_SOURCE_REVISION||!/^[a-f0-9]{64}$/.test(c.manifestSha256??'')||c.relativeBase!=='wasm-gpu-programs/')throw Error('WASM program runtime requires verified matching static build configuration and source seal');
 return c;
}
async function createWorkerGenerationRuntime(options={},shared={}){
 const config=configuration();
 if(Object.keys(options).some(k=>!['device','signal','onProgress'].includes(k)))throw TypeError('WASM runtime has no caller seal/library/owner override');
 const {device,signal,onProgress}=options;
 assertWorkerOwnerEndpoint(device); // Private lifecycle endpoint; never a native GPUDevice.
 if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const check=()=>{if(signal?.aborted)throw abortError(signal.reason);};
 const startedAt=Date.now();let lastProgress=null;
 const progress=detail=>{check();lastProgress=Object.freeze({...detail,elapsedMs:Math.max(0,Date.now()-startedAt)});const result=onProgress?.(lastProgress);if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Synchronous preparation progress callback required');}check();};
 check();progress({phase:'loading',program:'manifest'});
 const library=shared.library??assertIntegrityVerifiedWasmGpuInputLibrary(await createWasmGpuInputLibrary({baseURL:new URL(config.relativeBase,import.meta.url).href,expectedManifestSha256:config.manifestSha256,expectedSourceRevision:config.sourceRevision,signal}));
 shared.library=library;check();if(library.sourceRevision!==config.sourceRevision||library.manifestSha256!==config.manifestSha256||library.manifest.sourceVerification!=='reviewed-source-snapshot'||library.manifest.structuralBounds.maxWorldSteps!==128||!library.manifest.selectedProgram)throw Error('Sealed current N1/N3/selected program library mismatch');
 const sourceRevision=config.sourceRevision,coordinator=createWasmGpuWorkerCoordinator({endpoint:device,maximumOwnedBytes:16*MiB,groupBudgets:{search:8*MiB,selected:12*MiB}}),pool=new Map();
 let search,selected,disposed=false,disposal=null,searchGeneration=0,selectedGeneration=0;
 const creations=new Set();
 // This queue is deliberately OUTSIDE the device coordinator. Backend owner
 // disposal enters that coordinator itself and must never be nested in its lock.
 let modeTail=Promise.resolve(),residentMode=null,modeEpoch=0,retirementFailure=null;
 const withMode=(group,work,{epoch,check=()=>{}}={})=>{
  const result=modeTail.then(async()=>{
   open(device);check();if(retirementFailure)throw retirementFailure;
   if(epoch!==undefined&&epoch!==modeEpoch)throw abortError('GPU mode changed; create a fresh search view');
   if(residentMode!==group){
    const previous=residentMode;
    try{if(previous)await(previous==='search'?search:selected).releaseOwners();}
    catch(error){retirementFailure=error;throw error;}
    residentMode=group;modeEpoch++;
   }
   open(device);check();return work(modeEpoch);
  });modeTail=result.catch(()=>{});return result;
 };
 const keyOf=({engine,rawEngine})=>rawEngine?`${engine.artifactSha256}:${rawEngine.artifactSha256}`:engine.artifactSha256;
 const destroy=async item=>{if(item.destroyed)return;await item.owner?.dispose();item.destroyed=true;item.reservation.release();if(pool.get(item.key)===item)pool.delete(item.key);};
 const wrap=item=>Object.freeze({requiresExclusiveDevice:true,ownsRaw:true,...(item.group==='selected'?{selected:true}:{}),
  run(args){if(item.destroyed)throw Error('WASM program owner disposed');return coordinator.run(({signal})=>item.owner.run({...args,signal}),{signal:args.signal,onCancel:reason=>item.owner.cancel(reason)});},
  cancel(reason){return item.owner.cancel(reason);},
  dispose(){if(item.destroyed)return Promise.resolve();return coordinator.run(()=>destroy(item),{cleanup:true});},
  status:()=>item.owner.status(),
 });
 // Search and selected programs are prepared only for the active mode. The
 // other mode is drained, disposed and removed from the native pipeline cache.
 // No selected shader is speculatively compiled for an ordinary search.
 const demandOwner=async args=>{
  if(args.device!==device)throw Error('Only same-device sealed programs may execute');
  const key=keyOf(args),group=args.rawEngine?'search':'selected',name=group==='search'?`search-N${args.engine.count}`:'selected';
  const scope=createCanonicalPreparationScope({signal:args.signal}),began=Date.now();let last=null,created=null;
  const report=detail=>{scope.check();last=Object.freeze({phase:'preparing',program:name,...detail,elapsedMs:Math.max(0,Date.now()-began)});const result=args.onPrepareProgress?.(last);if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Synchronous preparation progress callback required');}scope.check();};
  try{return await coordinator.run(async({signal:operationSignal})=>{
   scope.check();scope.check();const existing=pool.get(key);if(existing&&!existing.destroyed)return existing.wrapper;
   scope.check();if(operationSignal.aborted)throw abortError(operationSignal.reason);
   const bytes=group==='search'?args.engine.resources.totalOwnedBytes:args.engine.resourcePlan.totalOwnedBytes;
   const item={key,group,name,owner:null,destroyed:false,reservation:coordinator.reserve({key,group,bytes})};created=item;pool.set(key,item);
   try{report({stage:'prepare'});item.owner=await device.prepare({...args,signal:operationSignal,onPrepareProgress:report});scope.check();if(operationSignal.aborted)throw abortError(operationSignal.reason);item.wrapper=wrap(item);return item.wrapper;}
   catch(error){await destroy(item);throw error;}
  },{signal:scope.signal});}
  catch(error){
   const diagnostic=Object.freeze({...last,...error?.gpuPreparation,program:name,elapsedMs:Math.max(0,Date.now()-began),...(error?.deviceLoss?{deviceLoss:error.deviceLoss}:{})});
   // A cancellation immediately after owner creation must not leave an owner
   // outside the backend cache. Cleanup is serialized, never nested in its lock.
   if(created&&!created.destroyed&&!coordinator.status().disposing&&!coordinator.status().disposed)await coordinator.run(()=>destroy(created),{cleanup:true}).catch(()=>{});
   if(error?.name==='AbortError')throw error;
   const failure=new Error(`GPU 준비 실패 [${diagnostic.program} · ${diagnostic.stage??'prepare'}${diagnostic.pipelineIndex?` · ${diagnostic.pipelineIndex}/${diagnostic.totalPipelines}`:''}${diagnostic.shaderBytes?` · ${diagnostic.shaderBytes} bytes · ${diagnostic.entryPoint??'main'}`:''} · ${diagnostic.elapsedMs} ms]: ${error?.message??String(error)}`,{cause:error});failure.gpuPreparation=diagnostic;if(error?.deviceLoss)failure.deviceLoss=error.deviceLoss;throw failure;
  }finally{scope.dispose();}
 };
 search=createWasmGpuCompactSearchBackendHarness({sourceRevision,workerEndpoint:device,maximumOwnedBytes:8*MiB,maximumCachedPrograms:2,lookupProgram:(selector,options)=>library.lookupProgram(selector,options),prepareEngine:demandOwner});
 selected=createWasmGpuSelectedSessionBackendHarness({device,sourceRevision,workerEndpoint:device,maximumOwnedBytes:12*MiB,lookupProgram:(selector,options)=>library.lookupSelectedProgram(selector,options),prepareEngine:demandOwner});
 try{progress({phase:'ready',program:'runtime',allocatedBytes:0,preparation:'on-demand'});}catch(error){await search.dispose();await selected.dispose();await coordinator.dispose();throw error;}
 const open=otherDevice=>{if(disposed)throw Error('WASM production runtime disposed');if(otherDevice!==device)throw Error('WASM runtime cannot change its exclusive device');};
 function cancelSearch(reason){searchGeneration++;for(const abort of creations)abort.abort(reason);search.cancel(reason);}
 function cancelSelected(reason){selectedGeneration++;selected.cancel(reason);}
 function cancel(reason='WASM runtime cancelled'){cancelSearch(reason);cancelSelected(reason);coordinator.cancel(reason);}
 function dispose(){if(disposal)return disposal;disposed=true;cancel('WASM runtime disposed');disposal=(async()=>{await modeTail;const errors=[];for(const backend of [search,selected])try{await backend.dispose();}catch(e){errors.push(e);}try{await coordinator.dispose(async()=>{for(const item of pool.values())try{await destroy(item);}catch(e){errors.push(e);}});}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'WASM runtime disposal failed');})();return disposal;}
 const runtime=Object.freeze({sourceRevision,expectedPreparation:'wasm-program',requiresExclusiveDevice:true,experimental:true,productionEnabled:false,gpuExecutionQualified:false,buildSealed:true,
  async createSearchEngine(otherDevice,args){
   open(otherDevice);const creation=searchGeneration,abort=new AbortController(),relay=()=>abort.abort(args?.signal?.reason);creations.add(abort);let view,viewEpoch;
   const scope=createCanonicalPreparationScope({signal:abort.signal});
   const prepareProgress=detail=>{
    for(const [fn,value] of [[args?.onPrepareProgress,detail],[['compile-start','compile'].includes(detail.stage)?args?.onCompilePhase:undefined,{stage:detail.stage==='compile-start'?'start':'end',compileOrdinal:(detail.stage==='compile-start'?detail.pipelineIndex:detail.completedPipelines)-1,total:detail.totalPipelines,elapsedMs:detail.elapsedMs,preparation:'wasm-program'}]]){
     if(fn===undefined)continue;if(typeof fn!=='function')throw TypeError('Synchronous preparation progress callback required');const result=fn(Object.freeze(value));if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Synchronous preparation progress callback required');}
    }
   };
   try{args?.signal?.addEventListener('abort',relay,{once:true});if(args?.signal?.aborted)relay();scope.check();view=await withMode('search',async epoch=>{viewEpoch=epoch;return search.createEngine(device,{...args,signal:scope.signal,onPrepareProgress:prepareProgress});},{check:()=>{scope.check();if(creation!==searchGeneration)throw abortError();}});open(device);scope.check();if(creation!==searchGeneration){view.dispose();throw abortError();}}
   catch(error){view?.dispose();throw error;}finally{args?.signal?.removeEventListener('abort',relay);scope.dispose();creations.delete(abort);}let released=false;
   return Object.freeze({...view,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-program',dispose(){released=true;return view.dispose();},async run(options){if(released)throw Error('Search view disposed');const ticket=searchGeneration,scope=createCanonicalPreparationScope({signal:options?.signal});try{scope.check();const result=await withMode('search',()=>view.run({...options,signal:scope.signal}),{epoch:viewEpoch,check:()=>{scope.check();if(released||ticket!==searchGeneration)throw abortError();}});open(device);scope.check();if(released||ticket!==searchGeneration)throw abortError();return Object.freeze({...result,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-program',coverage:'experimental-current-source-mmq2-N1-N3-wasm-program',gpuExecutionQualified:false});}finally{scope.dispose();}}});
  },
  async createSelectedEngine(otherDevice,binding,{request,candidate,strikeBackend='staged'}={}){
   open(otherDevice);if(strikeBackend!=='staged'||!request||!candidate)throw Error('Current owned selected request/candidate and staged backend required');let released=false,active=null;
   return Object.freeze({buildRevision:sourceRevision,preparation:'wasm-program-selected',requiresExclusiveDevice:true,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',
    async runRaw(batch,{signal,selectedTrace,selectedTraceMaxRecords}={}){
     open(device);if(released||active)throw Error('Selected view disposed or active');if(selectedTrace!==true||selectedTraceMaxRecords!==256)throw Error('Exact selected trace256 capsule required');
     const ticket=selectedGeneration,abort=new AbortController(),relay=()=>abort.abort(signal.reason),scope=createCanonicalPreparationScope({signal:abort.signal});active=abort;
     try{signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();scope.check();const result=await withMode('selected',()=>selected.evaluate({request,candidate,binding,batch,maximumRecords:256,signal:scope.signal}),{check:()=>{scope.check();if(released||ticket!==selectedGeneration)throw abortError();}});open(device);scope.check();if(released||ticket!==selectedGeneration||abort.signal.aborted)throw abortError(abort.signal.reason);return Object.freeze({...result,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',gpuExecutionQualified:false});}finally{try{signal?.removeEventListener('abort',relay);}finally{scope.dispose();active=null;}}
    },
    dispose(){released=true;active?.abort('Selected view disposed');},
   });
  },
  cancelSearch,cancelSelected,cancel,dispose,status:()=>Object.freeze({disposed,sourceRevision,residentMode,modeEpoch,coordinator:coordinator.status()}),
 });
 runtimes.set(runtime,{device});return runtime;
}

/** Stable service identity; compute devices are private mode generations. */
export async function createWasmGpuProductionRuntime(options={}){
 const config=configuration();if(Object.keys(options).some(k=>!['signal','onProgress'].includes(k)))throw TypeError('WASM runtime has no caller Worker/device/seal/library/owner override');
 const {signal,onProgress}=options,shared={};let first=true,endpoint=null;
 try{
  endpoint=await createSealedWorkerOwnerEndpoint({signal});
  const facade=await createComputeGenerationFacade({device:endpoint,signal,requestDevice:createSealedWorkerOwnerEndpoint,createGeneration:(nextEndpoint,nextSignal)=>{const progress=first?onProgress:undefined;first=false;return createWorkerGenerationRuntime({device:nextEndpoint,signal:nextSignal,onProgress:progress},shared);}});
  const runtime=Object.freeze({...facade,sourceRevision:config.sourceRevision,expectedPreparation:'wasm-program',requiresExclusiveDevice:true,experimental:true,productionEnabled:false,gpuExecutionQualified:false,buildSealed:true});runtimes.set(runtime,{device:facade.identity});endpoint=null;return runtime;
 }catch(error){if(endpoint)try{await endpoint.destroy();}catch(cleanup){throw new AggregateError([error,cleanup],'Initial Worker cleanup failed');}throw error;}
}
