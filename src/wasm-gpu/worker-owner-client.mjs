import {snapshotWorkerOwnerInputs} from './worker-owner-protocol.mjs';
/** Private sealed transport. An endpoint is not a GPUDevice and never enters a native GPU API. */
import{WASM_GPU_BUILD_CONFIGURATION as programs}from'./build-configuration.mjs';
import{WASM_GPU_WORKER_BUILD_CONFIGURATION as descriptor}from'./worker-build-configuration.mjs';
import{createCanonicalPreparationScope}from'../direct-candidate/canonical-page-preparation.mjs';
const endpoints=new WeakSet();let nextGeneration=0;
export function assertWorkerOwnerEndpoint(endpoint){if(!endpoints.has(endpoint))throw TypeError('Owned sealed Worker endpoint required');return endpoint;}
const aborted=reason=>Object.assign(Error(String(reason??'Worker operation cancelled')),{name:'AbortError'});
function configuration(){if(!descriptor||Object.keys(descriptor).sort().join(',')!=='byteLength,file,programManifestSha256,sha256,sourceRevision'||descriptor.file!=='wasm-gpu-compute-worker.mjs'||descriptor.sourceRevision!==programs?.sourceRevision||descriptor.programManifestSha256!==programs?.manifestSha256||!/^[a-f0-9]{64}$/.test(descriptor.sha256)||!Number.isSafeInteger(descriptor.byteLength)||descriptor.byteLength<1||descriptor.byteLength>4*1024*1024)throw Error('Verified Worker build configuration required');return descriptor;}
export async function createSealedWorkerOwnerEndpoint({signal}={}){
 const spec=configuration(),scope=createCanonicalPreparationScope({signal});let worker=null,blobURL=null;
 try{
  scope.check();const url=new URL(spec.file,import.meta.url);if(url.origin!==globalThis.location.origin)throw Error('Same-origin sealed Worker required');
  const response=await fetch(url,{signal:scope.signal,cache:'no-store'});if(!response.ok)throw Error('Worker asset fetch failed');const chunks=[];let length=0;const reader=response.body?.getReader();if(!reader)throw Error('Bounded Worker response stream required');try{for(;;){const {done,value}=await reader.read();scope.check();if(done)break;length+=value.byteLength;if(length>spec.byteLength)throw Error('Worker asset length bound exceeded');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let cursor=0;for(const part of chunks){bytes.set(part,cursor);cursor+=part.byteLength;}chunks.length=0;scope.check();if(bytes.byteLength!==spec.byteLength)throw Error('Worker asset length mismatch');const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');scope.check();if(digest!==spec.sha256)throw Error('Worker asset digest mismatch');
  if(nextGeneration>=0xffffffff)throw Error('Worker generation exhausted');const generation=++nextGeneration;blobURL=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));worker=new Worker(blobURL,{type:'module',name:'billiard-compute-'+generation});
  let sequence=0,dead=false,closed=false,cleanup=null,acknowledged=false,active=null,resolveLost,resolveReady,rejectReady;const descriptors=new Set(),pending=new Map(),lost=new Promise(resolve=>{resolveLost=resolve;}),ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const errorOf=value=>{const error=Error(value?.message??'Worker operation failed');error.name=value?.name??'Error';if(value?.deviceLoss)error.deviceLoss=value.deviceLoss;return error;};
  function terminateWorker(){const old=worker;worker=null;if(old){old.onmessage=null;old.onerror=null;old.onmessageerror=null;old.terminate();}}
  function fail(error){
   if(dead)return;dead=true;
   // Local reference cleanup is safe after terminal failure, but is not an
   // acknowledgement that native GPU work drained or its device was destroyed.
   for(const clear of descriptors)clear();descriptors.clear();
   const info={reason:error.deviceLoss?.reason??'unknown',message:error.message,cleanupVerified:false};resolveLost(info);rejectReady(error);for(const item of pending.values()){clearTimeout(item.timer);item.finish();item.reject(error);}pending.clear();terminateWorker();
  }
  function invalid(message){const error=Error(message);fail(error);throw error;}
  function cancelRequest(id){const item=pending.get(id);if(!item||item.cancelSent)return;item.cancelSent=true;void request('cancel',{target:id}).catch(fail);}
  function request(op,fields={},options={}){
   if(dead||closed)return Promise.reject(Error('Worker endpoint unavailable'));if(pending.size>=3)return Promise.reject(Error('Bounded Worker pending request limit'));if(sequence>=0xffffffff)return Promise.reject(Error('Worker request IDs exhausted'));
   const id=++sequence;return new Promise((resolve,reject)=>{
    const relay=()=>{if(op==='prepare'||op==='run')cancelRequest(id);};
    const item={op,resolve,reject,onProgress:options.onProgress,onExecutionPhase:options.onExecutionPhase,finish:()=>options.signal?.removeEventListener('abort',relay),timer:null};pending.set(id,item);
    item.timer=setTimeout(()=>fail(Object.assign(Error('Worker '+op+' acknowledgement timeout'),{cleanupVerified:false})),op==='dispose'||op==='release'?30000:600000);
    options.signal?.addEventListener('abort',relay,{once:true});
    try{worker.postMessage({v:1,generation,id,op,...fields},options.transfers??[]);if(options.signal?.aborted)relay();}catch(error){fail(error);}
   });
  }
  worker.onerror=event=>{event.preventDefault?.();fail(Error(event.message??'Compute Worker crashed'));};worker.onmessageerror=()=>fail(Error('Compute Worker message decoding failed'));
  worker.onmessage=event=>{const m=event.data;try{
   if(m?.event==='boot-error')throw errorOf(m.error);
   if(!m||m.v!==1||m.generation!==generation)throw Error('Worker protocol identity mismatch');
   if(m.event==='ready'){if(m.sourceRevision!==spec.sourceRevision||m.manifestSha256!==spec.programManifestSha256)throw Error('Worker boot provenance mismatch');resolveReady();return;}
   if(m.event==='lost')throw errorOf(m.error);
   const item=pending.get(m.id);if(!item)throw Error('Unexpected stale Worker reply');
   if(m.event==='progress'||m.event==='execution'){if(item.callbackError)return;try{const value=(m.event==='execution'?item.onExecutionPhase:item.onProgress)?.(m.detail);if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});throw TypeError('Synchronous Worker progress callback required');}}catch(error){item.callbackError=Object.assign(new Error(error?.message??String(error),{cause:error}),{name:error?.name??'Error'});cancelRequest(m.id);}return;}
   if(m.op!==item.op||typeof m.ok!=='boolean')throw Error('Worker reply operation mismatch');pending.delete(m.id);clearTimeout(item.timer);item.finish();if(item.callbackError){if(m.ok)item.callbackError.workerReply=m;item.reject(item.callbackError);}else if(m.ok)item.resolve(m);else item.reject(errorOf(m.error));
  }catch(error){fail(error);}};
  const abortBoot=()=>rejectReady(aborted(scope.signal.reason));scope.signal.addEventListener('abort',abortBoot,{once:true});const bootTimer=setTimeout(()=>rejectReady(Error('Worker boot timeout')),30000);
  try{worker.postMessage({v:1,generation,op:'init',programBaseURL:new URL(programs.relativeBase,import.meta.url).href});if(scope.signal.aborted)abortBoot();await ready;scope.check();}finally{clearTimeout(bootTimer);scope.signal.removeEventListener('abort',abortBoot);URL.revokeObjectURL(blobURL);blobURL=null;}
  const dispose=()=>{if(cleanup)return cleanup;cleanup=(async()=>{const result=await request('dispose');if(!result.drained||!result.disposed||!result.destroyed||result.ownedBytes!==0)throw Error('Worker cleanup acknowledgement incomplete');acknowledged=true;})();return cleanup;};
  const endpoint=Object.freeze({kind:'sealed-worker-owner-endpoint-v1',lost,
   async prepare(args){assertWorkerOwnerEndpoint(endpoint);if(active)throw Error('Worker operation already active');const program=args.rawEngine?'search':'selected',width=args.rawEngine?args.engine.count:1;let response;try{active={id:sequence+1};response=await request('prepare',{program,width},{signal:args.signal,onProgress:args.onPrepareProgress});}catch(error){if(error.workerReply?.ok){const handle=error.workerReply.handle;try{const released=await request('release',{handle});if(released.released!==true)throw Error('Prepared owner callback cleanup failed');}catch(cleanup){fail(cleanup);throw new AggregateError([error,cleanup],'Worker prepare callback cleanup failed');}}throw error;}finally{active=null;}
    if(response.artifactSha256!==args.engine.artifactSha256||args.rawEngine&&response.rawArtifactSha256!==args.rawEngine.artifactSha256)invalid('Worker owner artifact identity mismatch');const handle=response.handle;if(handle!==program+'-N'+width)invalid('Worker owner handle mismatch');let released=false,releasing=null;const clearDescriptor=()=>{released=true;args=null;};descriptors.add(clearDescriptor);
    return Object.freeze({requiresExclusiveDevice:true,ownsRaw:true,...(program==='selected'?{selected:true}:{}),
     async run(input){if(released||active)throw Error('Worker owner disposed or active');const owned=snapshotWorkerOwnerInputs({program,width,engine:args.engine,rawEngine:args.rawEngine},input),fields={handle,...owned},transfers=[];for(const list of[owned.initialUploads,owned.rawUploads??[]])for(const upload of list)transfers.push(upload.initial.buffer);if(owned.candidateIds)transfers.push(owned.candidateIds.buffer);let reply;try{active={id:sequence+1,handle};reply=await request('run',fields,{signal:input.signal,onProgress:input.onProgress,onExecutionPhase:input.onExecutionPhase,transfers});}finally{active=null;}if(input.signal?.aborted)throw aborted(input.signal.reason);const result=reply.result;if(program==='search'){if(!(result instanceof Uint32Array)||result.length!==width*4)invalid('Exact Worker compact readback required');}else if(!(result?.world instanceof Uint32Array)||result.world.byteLength!==args.engine.outputs.world.bytes||!(result?.trace instanceof Uint32Array)||result.trace.byteLength!==args.engine.outputs.trace.bytes)invalid('Exact Worker selected readbacks required');return{result};},
     cancel(){if(!released&&active?.handle===handle)cancelRequest(active.id);},
     dispose(){if(releasing)return releasing;released=true;releasing=request('release',{handle}).then(result=>{if(result.released!==true)throw Error('Worker owner release not acknowledged');clearDescriptor();descriptors.delete(clearDescriptor);});return releasing;},
     status:()=>({disposed:released,remote:true,descriptorRetained:args!==null}),
    });
   },
   async destroy(){if(closed)return;try{await dispose();if(!acknowledged)throw Error('Unverified Worker cleanup');closed=true;for(const clear of descriptors)clear();descriptors.clear();terminateWorker();resolveLost({reason:'destroyed',message:'Acknowledged Worker compute retirement'});}catch(error){fail(error);throw error;}},
   status:()=>({generation,dead,closed,acknowledged,pending:pending.size,workerRetained:worker!==null}),
  });endpoints.add(endpoint);return endpoint;
 }catch(error){worker?.terminate();throw error;}finally{if(blobURL)URL.revokeObjectURL(blobURL);scope.dispose();}
}
