/** Inert until the verified bundler replaces both independent build stubs.
 * Public callers cannot inject a seal, program library, source revision or owner.
 * One branded runtime reserves one device for BOTH search and selected lifetimes.
 */
import {WASM_GPU_BUILD_CONFIGURATION} from './build-configuration.mjs';
import {LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION} from '../direct-candidate/experimental-live-world-build-seal.mjs';
import {createWasmGpuProgramLibrary,assertIntegrityVerifiedWasmGpuProgramLibrary} from './program-library.mjs';
import {createWasmGpuDeviceCoordinator} from './device-coordinator.mjs';
import {prepareWasmGpuEngine} from './engine.mjs';
import {prepareWasmGpuSelectedEngine} from './selected-engine.mjs';
import {createWasmGpuCompactSearchBackendHarness} from './compact-search-backend.mjs';
import {createWasmGpuSelectedSessionBackendHarness} from './selected-session-backend.mjs';
import {WASM_GPU_SELECTED_CONFIG} from './selected-artifact.mjs';
const runtimes=new WeakMap(),MiB=1024*1024;
const abortError=reason=>{const e=Error(String(reason??'WASM runtime preparation cancelled'));e.name='AbortError';return e;};
export function assertWasmGpuProductionRuntime(runtime,device){const owned=runtimes.get(runtime);if(!owned||device&&owned.device!==device)throw TypeError('Owned sealed WASM GPU production runtime required');return runtime;}
function configuration(){
 const c=WASM_GPU_BUILD_CONFIGURATION;
 if(!LIVE_WORLD_UPLOAD_SOURCE_SEALED||!c||Object.keys(c).sort().join(',')!=='manifestSha256,relativeBase,sourceRevision'||typeof c.sourceRevision!=='string'||c.sourceRevision!==LIVE_WORLD_UPLOAD_SOURCE_REVISION||!/^[a-f0-9]{64}$/.test(c.manifestSha256??'')||c.relativeBase!=='wasm-gpu-programs/')throw Error('WASM program runtime requires verified matching static build configuration and source seal');
 return c;
}
export async function createWasmGpuProductionRuntime(options={}){
 const config=configuration();
 if(Object.keys(options).some(k=>!['device','signal','onProgress'].includes(k)))throw TypeError('WASM runtime has no caller seal/library/owner override');
 const {device,signal,onProgress}=options;
 if(!device||typeof device.lost?.then!=='function')throw TypeError('Exclusive GPU device required');
 if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous preparation progress callback required');
 const check=()=>{if(signal?.aborted)throw abortError(signal.reason);};
 const progress=detail=>{check();const result=onProgress?.(Object.freeze(detail));if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Synchronous preparation progress callback required');}check();};
 check();progress({phase:'loading',program:'manifest'});
 const library=assertIntegrityVerifiedWasmGpuProgramLibrary(await createWasmGpuProgramLibrary({baseURL:new URL(config.relativeBase,import.meta.url).href,expectedManifestSha256:config.manifestSha256,expectedSourceRevision:config.sourceRevision,signal}));
 check();if(library.sourceRevision!==config.sourceRevision||library.manifestSha256!==config.manifestSha256||library.manifest.sourceVerification!=='reviewed-source-snapshot'||library.manifest.structuralBounds.maxWorldSteps!==128||!library.manifest.selectedProgram)throw Error('Sealed current N1/N3/selected program library mismatch');
 const sourceRevision=config.sourceRevision,{moduleBytes}=library.getScheduler(),coordinator=createWasmGpuDeviceCoordinator({device,maximumOwnedBytes:16*MiB,groupBudgets:{search:8*MiB,selected:12*MiB}}),pool=new Map();
 let search,selected,disposed=false,disposal=null,searchGeneration=0,selectedGeneration=0;
 const keyOf=({engine,rawEngine})=>rawEngine?`${engine.artifactSha256}:${rawEngine.artifactSha256}`:engine.artifactSha256;
 const destroy=async item=>{if(item.destroyed)return;await item.owner?.dispose();item.destroyed=true;item.reservation.release();};
 const wrap=item=>Object.freeze({requiresExclusiveDevice:true,ownsRaw:true,...(item.group==='selected'?{selected:true}:{}),
  run(args){return coordinator.run(({signal})=>item.owner.run({...args,signal}),{signal:args.signal,onCancel:reason=>item.owner.cancel(reason)});},
  cancel(reason){return item.owner.cancel(reason);},
  dispose(){if(item.destroyed)return Promise.resolve();return coordinator.run(()=>destroy(item),{cleanup:true});},
  status:()=>item.owner.status(),
 });
 try{
  const loaded=[];
  for(const count of [3,1]){progress({phase:'loading',program:`search-N${count}`});const program=await library.lookupProgram({sourceRevision,count,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128},{signal});check();loaded.push({group:'search',name:`search-N${count}`,program,bytes:program.engine.resources.totalOwnedBytes});}
  progress({phase:'loading',program:'selected'});const selectedProgram=await library.lookupSelectedProgram({sourceRevision,...WASM_GPU_SELECTED_CONFIG},{signal});check();loaded.push({group:'selected',name:'selected',program:{engine:selectedProgram},bytes:selectedProgram.resourcePlan.totalOwnedBytes});
  // Admit the combined arena budget BEFORE compiling or allocating any owner.
  for(const item of loaded){const key=keyOf(item.program),reservation=coordinator.reserve({key,group:item.group,bytes:item.bytes});pool.set(key,{...item,reservation,owner:null,destroyed:false});}
  for(const item of pool.values()){
   progress({phase:'preparing',program:item.name});
   await coordinator.run(async({signal})=>{item.owner=await(item.group==='search'?prepareWasmGpuEngine:prepareWasmGpuSelectedEngine)({device,moduleBytes,...item.program,maximumOwnedBytes:item.group==='search'?8*MiB:12*MiB,signal,onPrepareProgress:detail=>progress({phase:'preparing',program:item.name,...detail})});return item.owner;},{signal});
   check();item.wrapper=wrap(item);
  }
  const cachedOwner=args=>{const item=pool.get(keyOf(args));if(!item||item.destroyed||args.device!==device)throw Error('Only prewarmed same-device sealed programs may execute');return item.wrapper;};
  search=createWasmGpuCompactSearchBackendHarness({sourceRevision,moduleBytes,maximumOwnedBytes:8*MiB,maximumCachedPrograms:2,lookupProgram:(selector,options)=>library.lookupProgram(selector,options),prepareEngine:cachedOwner});
  selected=createWasmGpuSelectedSessionBackendHarness({device,sourceRevision,moduleBytes,maximumOwnedBytes:12*MiB,lookupProgram:(selector,options)=>library.lookupSelectedProgram(selector,options),prepareEngine:cachedOwner});
  progress({phase:'ready',program:'all',allocatedBytes:coordinator.status().allocatedBytes});
 }catch(error){await coordinator.dispose(async()=>{const errors=[];for(const item of pool.values())try{await destroy(item);}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Preparation cleanup failed');}).catch(()=>{});throw error;}
 const open=otherDevice=>{if(disposed)throw Error('WASM production runtime disposed');if(otherDevice!==device)throw Error('WASM runtime cannot change its exclusive device');};
 function cancelSearch(reason){searchGeneration++;search.cancel(reason);}
 function cancelSelected(reason){selectedGeneration++;selected.cancel(reason);}
 function cancel(reason='WASM runtime cancelled'){cancelSearch(reason);cancelSelected(reason);coordinator.cancel(reason);}
 function dispose(){if(disposal)return disposal;disposed=true;cancel('WASM runtime disposed');disposal=(async()=>{const errors=[];for(const backend of [search,selected])try{await backend.dispose();}catch(e){errors.push(e);}try{await coordinator.dispose(async()=>{for(const item of pool.values())try{await destroy(item);}catch(e){errors.push(e);}});}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'WASM runtime disposal failed');})();return disposal;}
 const runtime=Object.freeze({sourceRevision,expectedPreparation:'wasm-program',requiresExclusiveDevice:true,experimental:true,productionEnabled:false,gpuExecutionQualified:false,buildSealed:true,
  async createSearchEngine(otherDevice,args){
   open(otherDevice);const creation=searchGeneration,view=await search.createEngine(device,args);open(device);if(creation!==searchGeneration){view.dispose();throw abortError();}let released=false;
   return Object.freeze({...view,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-program',dispose(){released=true;return view.dispose();},async run(options){if(released)throw Error('Search view disposed');const ticket=searchGeneration,result=await view.run(options);open(device);if(released||ticket!==searchGeneration||options?.signal?.aborted)throw abortError(options?.signal?.reason);return Object.freeze({...result,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-program',coverage:'experimental-current-source-mmq2-N1-N3-wasm-program',gpuExecutionQualified:false});}});
  },
  async createSelectedEngine(otherDevice,binding,{request,candidate,strikeBackend='staged'}={}){
   open(otherDevice);if(strikeBackend!=='staged'||!request||!candidate)throw Error('Current owned selected request/candidate and staged backend required');let released=false,active=null;
   return Object.freeze({buildRevision:sourceRevision,preparation:'wasm-program-selected',requiresExclusiveDevice:true,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',
    async runRaw(batch,{signal,selectedTrace,selectedTraceMaxRecords}={}){
     open(device);if(released||active)throw Error('Selected view disposed or active');if(selectedTrace!==true||selectedTraceMaxRecords!==256)throw Error('Exact selected trace256 capsule required');
     const ticket=selectedGeneration,abort=new AbortController(),relay=()=>abort.abort(signal.reason);active=abort;
     try{signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();const result=await selected.evaluate({request,candidate,binding,batch,maximumRecords:256,signal:abort.signal});open(device);if(released||ticket!==selectedGeneration||abort.signal.aborted)throw abortError(abort.signal.reason);return Object.freeze({...result,buildSealed:true,integrityVerified:true,provenance:'sealed-source-wasm-selected',gpuExecutionQualified:false});}finally{try{signal?.removeEventListener('abort',relay);}finally{active=null;}}
    },
    dispose(){released=true;active?.abort('Selected view disposed');},
   });
  },
  cancelSearch,cancelSelected,cancel,dispose,status:()=>Object.freeze({disposed,sourceRevision,coordinator:coordinator.status()}),
 });
 runtimes.set(runtime,{device});return runtime;
}
