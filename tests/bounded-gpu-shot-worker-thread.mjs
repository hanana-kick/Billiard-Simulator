// ACTUAL NODE WORKER REALM, MOCKED PHYSICS. This is NOT browser or WGSL evidence.
import {parentPort,threadId} from 'node:worker_threads';
import {installWorkerHost} from '../src/bounded-gpu-shot/four-ball-worker-host.mjs';
import {doubleOwner} from './bounded-gpu-shot-worker-fixture.mjs';
const listeners=new Map(),port={postMessage:value=>parentPort.postMessage(value),
  addEventListener(type,fn){if(type==='message'){const wrapped=data=>fn({data});listeners.set(fn,wrapped);parentPort.on('message',wrapped);}},
  removeEventListener(type,fn){parentPort.off('message',listeners.get(fn));listeners.delete(fn);}};
const {owner}=doubleOwner();owner.capability={testDouble:true,workerThreadId:threadId,actualGpu:false};
installWorkerHost(port,async()=>owner);
