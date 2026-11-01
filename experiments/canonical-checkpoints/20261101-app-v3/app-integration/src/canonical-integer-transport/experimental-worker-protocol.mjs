import {snapshotOwnedBytes} from './owned-bytes.mjs';
/** Explicit experimental assembly only; does NOT replace the sealed Worker entry.
 * Existing RPC lifecycle stays intact. Private metadata projections account VM
 * frames/code/status buffers without relabeling original InputContract brands. */
import {assertExperimentalCompiledLibrary,assertExperimentalCompiledEntry} from './compiled-program-library.mjs';
import {prepareExperimentalCompiledInputOwner} from './experimental-input-owner.mjs';
import {createWorkerOwnerProtocol} from '../wasm-gpu/worker-owner-protocol.mjs';
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
export async function createExperimentalCompiledWorkerProtocol({library,moduleBytes,requestDevice,send,initialGeneration=null,getDeviceDiagnostics}={}){
 assertExperimentalCompiledLibrary(library);
 if(typeof requestDevice!=='function'||typeof send!=='function'||!(moduleBytes instanceof Uint8Array)||!(moduleBytes.buffer instanceof ArrayBuffer))throw TypeError('Owned scheduler and Worker callbacks required');
 const scheduler=snapshotOwnedBytes(moduleBytes,2*1024*1024);if(await sha(scheduler)!==library.schedulerSHA256)throw Error('Compiled Worker scheduler closure mismatch');
 const projected=new WeakMap();let cached=null;
 const facade=Object.freeze({sourceRevision:library.sourceRevision,manifest:Object.freeze({structuralBounds:Object.freeze({profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:4,maximumSteps:2048,maxWorldSteps:128})}),getScheduler:()=>Object.freeze({moduleBytes:scheduler.slice()}),
  async lookupProgram(selector,options){const entry=assertExperimentalCompiledEntry(await library.lookupProgram(selector,options));if(cached)return cached;
   const engine=Object.freeze({...entry.engine,resources:entry.resources});projected.set(engine,entry);
   cached=Object.freeze({engine,rawEngine:entry.rawEngine});return cached;
  },lookupSelectedProgram(){return Promise.reject(Error('Compiled selected Worker is not qualified'));},
 });
 return createWorkerOwnerProtocol({initialGeneration,expectedRevision:library.sourceRevision,loadLibrary:async()=>facade,requestDevice,send,getDeviceDiagnostics,
  prepareSearch:async args=>{const entry=projected.get(args.engine);if(!entry||entry.rawEngine!==args.rawEngine)throw Error('Owned compiled Worker metadata projection required');assertExperimentalCompiledEntry(entry);if(entry.resources.totalOwnedBytes>args.maximumOwnedBytes)throw Error('Compiled Worker VM resource bound');return prepareExperimentalCompiledInputOwner({entry,device:args.device,moduleBytes:args.moduleBytes,signal:args.signal});},
  prepareSelected:async()=>{throw Error('Compiled selected Worker is not qualified');},
  // The resident transport never releases a pending native preparation waiter:
  // prepare/failed-prepare cleanup settles before the protocol operation ends.
  // It owns no legacy pipeline cache. Active owner drain remains in protocol.
  drainPreparation:async()=>{},releaseCache:async()=>{},
 });
}
