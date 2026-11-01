/** New explicit compiled N1/N3 policy. No mutation of original transport limits,
 * no caller budget override, and no selected fallback. Not production activated. */
import {snapshotOwnedBytes} from './owned-bytes.mjs';
import {assertExperimentalCompiledLibrary,assertExperimentalCompiledEntry} from './compiled-program-library.mjs';
import {admitCompiledResourcePolicy} from './compiled-resource-policy.mjs';
import {prepareExperimentalCompiledInputOwner} from './experimental-input-owner.mjs';
import {createCompiledPolicyOwnerProtocol} from './compiled-policy-owner-protocol.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function createExperimentalWidthWorkerProtocol({libraries,moduleBytes,requestDevice,send,initialGeneration=null,getDeviceDiagnostics}={}){
 if(!libraries||Object.keys(libraries).length<1||Object.keys(libraries).some(k=>!['1','3'].includes(k)))throw Error('Explicit independently pinned compiled width libraries required');
 const libs=new Map();for(const [key,library]of Object.entries(libraries))libs.set(Number(key),assertExperimentalCompiledLibrary(library));const first=libs.values().next().value;
 for(const lib of libs.values())if(lib.sourceRevision!==first.sourceRevision||lib.runtimeRevision!==first.runtimeRevision||lib.schedulerSHA256!==first.schedulerSHA256)throw Error('One compiled runtime/source/scheduler closure per Worker required');
 if(typeof requestDevice!=='function'||typeof send!=='function')throw TypeError('Worker callbacks required');const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==first.schedulerSHA256)throw Error('Compiled Worker scheduler closure mismatch');
 const projected=new WeakMap(),cache=new Map();const facade=Object.freeze({sourceRevision:first.sourceRevision,manifest:Object.freeze({structuralBounds:Object.freeze({profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128})}),getScheduler:()=>Object.freeze({moduleBytes:scheduler.slice()}),
  async lookupProgram(selector,options){const lib=libs.get(selector.count);if(!lib)throw Error('Compiled width has no pinned library');const entry=assertExperimentalCompiledEntry(await lib.lookupProgram(selector,options));if(entry.pack.count!==selector.count)throw Error('Compiled width entry mismatch');let value=cache.get(entry);if(!value){const policy=admitCompiledResourcePolicy(entry),engine=Object.freeze({...entry.engine,resources:entry.resources});projected.set(engine,{entry,policy});value=Object.freeze({engine,rawEngine:entry.rawEngine});cache.set(entry,value);}return value;},
  lookupSelectedProgram(){return Promise.reject(Error('Compiled selected Worker is not qualified'));},
 });
 return createCompiledPolicyOwnerProtocol({initialGeneration,expectedRevision:first.sourceRevision,loadLibrary:async()=>facade,requestDevice,send,getDeviceDiagnostics,
  getResourcePolicy:p=>{const item=projected.get(p.engine);if(!item||item.entry.rawEngine!==p.rawEngine)throw Error('Owned compiled projection required');return item.policy;},
  prepareSearch:async args=>{const item=projected.get(args.engine);if(!item||item.entry.rawEngine!==args.rawEngine||args.maximumOwnedBytes!==item.policy.allocationCeilingBytes)throw Error('Owned compiled width preparation policy required');return prepareExperimentalCompiledInputOwner({entry:item.entry,device:args.device,moduleBytes:args.moduleBytes,signal:args.signal});},
  prepareSelected:async()=>{throw Error('Compiled selected Worker is not qualified');},drainPreparation:async()=>{},releaseCache:async()=>{},
 });
}
