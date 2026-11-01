/** Lazy compiled app owner: search widths and selected remain distinct immutable
 * profiles. One original mode/device lifetime, original RPC handles and ordering. */
import{assertIntegrityVerifiedWasmGpuInputLibrary}from'../wasm-gpu/input-library.mjs';
import{snapshotOwnedBytes}from'./owned-bytes.mjs';
import{assertCompiledFrontendResourcePolicy,compiledResourceProfile}from'./frontend-resource-policy.mjs';
import{assertCompiledPlanResources}from'./compiled-plan-resource-admission.mjs';
import{assertExperimentalCompiledLibrary,assertExperimentalCompiledEntry}from'./compiled-program-library.mjs';
import{assertCompiledSelectedLibrary,assertCompiledSelectedEntry}from'./selected-program-library.mjs';
import{prepareExperimentalCompiledInputOwner}from'./experimental-input-owner.mjs';
import{prepareCompiledSelectedInputOwner}from'./selected-input-owner.mjs';
import{createCompiledAppPolicyProtocol}from'./compiled-app-policy-protocol.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function createCompiledAppWorkerProtocol({inputLibrary,resourcePolicy,moduleBytes,loadCompiledLibrary,requestDevice,send,initialGeneration=null,getDeviceDiagnostics}={}){
 assertIntegrityVerifiedWasmGpuInputLibrary(inputLibrary);assertCompiledFrontendResourcePolicy(resourcePolicy);
 if(inputLibrary.sourceRevision!==resourcePolicy.physicsSourceRevision||inputLibrary.manifestSha256!==resourcePolicy.inputManifestSHA256||typeof loadCompiledLibrary!=='function'||typeof requestDevice!=='function'||typeof send!=='function')throw Error('Compiled app sealed input/loader identity required');
 const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==resourcePolicy.schedulerSHA256)throw Error('Compiled app scheduler closure mismatch');const libraries=new Map(),byEngine=new WeakMap();
 async function libraryFor(key,options){let library=libraries.get(key);if(library)return library;library=await loadCompiledLibrary(key,options);if(key==='selected-N1')assertCompiledSelectedLibrary(library);else assertExperimentalCompiledLibrary(library);if(library.manifestSHA256!==compiledResourceProfile(resourcePolicy,key).compiledManifestSHA256||library.sourceRevision!==resourcePolicy.physicsSourceRevision||library.runtimeRevision!==resourcePolicy.runtimeRevision||library.schedulerSHA256!==resourcePolicy.schedulerSHA256)throw Error('One compiled app source/runtime/scheduler closure required');if(options?.signal?.aborted)throw Object.assign(Error(String(options.signal.reason)),{name:'AbortError'});libraries.set(key,library);return library;}
 const facade={sourceRevision:resourcePolicy.physicsSourceRevision,manifest:inputLibrary.manifest,getScheduler:()=>({moduleBytes:scheduler.slice()}),
  async lookupProgram(selector,options){const library=await libraryFor('search-N'+selector.count,options),entry=assertExperimentalCompiledEntry(await library.lookupProgram(selector,options));const fact=assertCompiledPlanResources(resourcePolicy,entry);byEngine.set(entry.engine,{entry,fact});return{engine:entry.engine,rawEngine:entry.rawEngine};},
  async lookupSelectedProgram(selector,options){const library=await libraryFor('selected-N1',options),entry=assertCompiledSelectedEntry(await library.lookupSelectedProgram(selector,options));const fact=assertCompiledPlanResources(resourcePolicy,entry);byEngine.set(entry.engine,{entry,fact});return entry.engine;}
 };
 const owned=p=>{const item=byEngine.get(p.engine);if(!item||item.entry.rawEngine!==p.rawEngine)throw Error('Owned compiled app entry required');assertCompiledPlanResources(resourcePolicy,item.entry);return item;};
 return createCompiledAppPolicyProtocol({resourcePolicy,initialGeneration,expectedRevision:resourcePolicy.physicsSourceRevision,loadLibrary:async()=>facade,requestDevice,send,getDeviceDiagnostics,selectedConfig:{count:1,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128,maximumRecords:256},drainPreparation:async()=>{},releaseCache:async()=>{},getResourceFact:p=>owned(p).fact,
  prepareSearch:args=>{const{entry,fact}=owned(args);if(args.maximumOwnedBytes!==fact.allocationCeilingBytes)throw Error('Compiled search owner cap mismatch');return prepareExperimentalCompiledInputOwner({entry,device:args.device,moduleBytes:args.moduleBytes,signal:args.signal});},
  prepareSelected:args=>{const{entry,fact}=owned(args);if(args.maximumOwnedBytes!==fact.allocationCeilingBytes)throw Error('Compiled selected owner cap mismatch');return prepareCompiledSelectedInputOwner({entry,device:args.device,moduleBytes:args.moduleBytes,signal:args.signal});}
 });
}
