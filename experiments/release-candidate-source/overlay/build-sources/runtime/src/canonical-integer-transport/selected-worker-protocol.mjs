/** Explicit selected compiled Worker assembly. Never selected→search fallback. */
import{snapshotOwnedBytes}from'./owned-bytes.mjs';
import{assertCompiledSelectedLibrary,assertCompiledSelectedEntry}from'./selected-program-library.mjs';
import{prepareCompiledSelectedInputOwner}from'./selected-input-owner.mjs';
import{createSelectedCompiledPolicyOwnerProtocol}from'./selected-policy-owner-protocol.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function createCompiledSelectedWorkerProtocol({library,moduleBytes,requestDevice,send,initialGeneration=null,getDeviceDiagnostics}={}){
 assertCompiledSelectedLibrary(library);if(typeof requestDevice!=='function'||typeof send!=='function')throw TypeError('Worker callbacks required');const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==library.schedulerSHA256)throw Error('Selected scheduler closure mismatch');const projections=new WeakMap(),cache=new WeakMap();
 const facade={sourceRevision:library.sourceRevision,getScheduler:()=>({moduleBytes:scheduler.slice()}),async lookupSelectedProgram(selector,options){const entry=assertCompiledSelectedEntry(await library.lookupSelectedProgram(selector,options));let engine=cache.get(entry);if(!engine){engine=Object.freeze({...entry.engine,resourcePlan:Object.freeze({totalOwnedBytes:entry.resources.totalOwnedBytes})});cache.set(entry,engine);projections.set(engine,entry);}return engine;}};
 const selectedConfig=Object.freeze({count:1,profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128,maximumRecords:256});
 return createSelectedCompiledPolicyOwnerProtocol({initialGeneration,expectedRevision:library.sourceRevision,selectedConfig,loadLibrary:async()=>facade,requestDevice,send,getDeviceDiagnostics,drainPreparation:async()=>{},releaseCache:async()=>{},
  getCompiledEntry:p=>{const entry=projections.get(p.engine);if(!entry)throw Error('Owned selected projection required');return entry;},
  prepareSelected:args=>{const entry=projections.get(args.engine);if(!entry||args.maximumOwnedBytes!==entry.resources.allocationCeilingBytes)throw Error('Owned selected preparation policy required');return prepareCompiledSelectedInputOwner({entry,device:args.device,moduleBytes:args.moduleBytes,signal:args.signal});},prepareSearch:async()=>{throw Error('Selected compiled Worker does not support search');}
 });
}
