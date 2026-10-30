import {assertLiveWorldPreparationUsable} from '../direct-candidate/experimental-live-world-pipeline-cache.mjs';
/** One device-global operation queue and memory ledger for search + selected.
 * A cancelled task retains the lock until its owner has actually drained. */
const coordinators=new WeakSet(),devices=new WeakMap();
const abortError=reason=>{const e=Error(String(reason??'GPU operation cancelled'));e.name='AbortError';return e;};
export function assertWasmGpuDeviceCoordinator(value,device){if(!coordinators.has(value)||device&&value.device!==device)throw TypeError('Owned matching GPU device coordinator required');return value;}
export function createWasmGpuDeviceCoordinator({device,maximumOwnedBytes=16*1024*1024,groupBudgets={search:8*1024*1024,selected:12*1024*1024}}={}){
 if(!device||typeof device.lost?.then!=='function')throw TypeError('GPU device loss promise required');
 if(devices.has(device))throw Error('Device already has a live WASM coordinator');
 if(!Number.isSafeInteger(maximumOwnedBytes)||maximumOwnedBytes<1||maximumOwnedBytes>16*1024*1024||['search','selected'].some(g=>!Number.isSafeInteger(groupBudgets[g])||groupBudgets[g]<1||groupBudgets[g]>(g==='search'?8:12)*1024*1024))throw RangeError('Explicit bounded aggregate/group GPU budgets required');
 const limits=Object.freeze({search:groupBudgets.search,selected:groupBudgets.selected}),reservations=new Map(),groupBytes={search:0,selected:0};
 let allocatedBytes=0,tail=Promise.resolve(),active=null,cancellation=0,closing=false,closed=false,disposal=null,lost=null;
 const alive=()=>{if(closing||closed)throw Error('GPU coordinator disposed');if(lost)throw lost;assertLiveWorldPreparationUsable(device);};
 const notifyCancel=(token,reason)=>{if(!token)return;token.abort.abort(reason);try{token.onCancel?.(reason);}catch(error){token.cancelError=error;}};
 const cancel=(reason='GPU coordinator cancelled')=>{cancellation++;notifyCancel(active,reason);};
 const onLoss=reason=>{lost=reason instanceof Error?reason:Error('GPU device lost: '+(reason?.message??String(reason)));cancel(lost.message);};
 Promise.resolve(device.lost).then(onLoss,onLoss);
 function run(work,{signal,onCancel,cleanup=false}={}){
  if(typeof work!=='function'||onCancel!==undefined&&typeof onCancel!=='function')return Promise.reject(TypeError('GPU task/cancel callback required'));
  if(signal&&(typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))return Promise.reject(TypeError('AbortSignal required'));
  if(closing||closed)return Promise.reject(Error('GPU coordinator disposed'));
  if(!cleanup){try{alive();}catch(error){return Promise.reject(error);}}
  const ticket=cancellation;
  const promise=tail.then(async()=>{
   if(!cleanup){alive();if(ticket!==cancellation||signal?.aborted)throw abortError(signal?.reason);}
   const abort=new AbortController(),token={abort,onCancel},relay=()=>notifyCancel(token,signal.reason);active=token;
   try{
    signal?.addEventListener('abort',relay,{once:true});if(signal?.aborted)relay();
    const value=await work({signal:abort.signal});
    if(!cleanup){if(token.cancelError)throw token.cancelError;if(lost)throw lost;if(closing||ticket!==cancellation||abort.signal.aborted)throw abortError(abort.signal.reason);}
    return value;
   }finally{try{signal?.removeEventListener('abort',relay);}finally{if(active===token)active=null;}}
  });tail=promise.catch(()=>{});return promise;
 }
 function reserve({key,group,bytes}={}){
  alive();if(typeof key!=='string'||!key||!Object.hasOwn(limits,group)||!Number.isSafeInteger(bytes)||bytes<1)throw TypeError('Named exact GPU reservation required');
  if(reservations.has(key))throw Error('Duplicate GPU reservation');
  if(allocatedBytes+bytes>maximumOwnedBytes||groupBytes[group]+bytes>limits[group])throw RangeError('Aggregate or group GPU byte budget exceeded');
  const record={group,bytes};reservations.set(key,record);allocatedBytes+=bytes;groupBytes[group]+=bytes;let released=false;
  return Object.freeze({key,group,bytes,release(){if(released)return;released=true;if(reservations.get(key)===record){reservations.delete(key);allocatedBytes-=bytes;groupBytes[group]-=bytes;}}});
 }
 function dispose(cleanup=async()=>{}){
  if(disposal)return disposal;if(typeof cleanup!=='function')return Promise.reject(TypeError('Cleanup function required'));
  closing=true;cancel('GPU coordinator disposed');
  disposal=tail.then(async()=>{let clean=false;try{await cleanup();if(reservations.size)throw Error('GPU reservations remain after disposal');clean=true;}finally{closed=true;if(clean)devices.delete(device);}});tail=disposal.catch(()=>{});return disposal;
 }
 const coordinator=Object.freeze({device,run,reserve,cancel,dispose,status:()=>Object.freeze({allocatedBytes,groupBytes:Object.freeze({...groupBytes}),maximumOwnedBytes,reservations:reservations.size,active:!!active,lost:!!lost,disposed:closed,disposing:closing&&!closed})});
 coordinators.add(coordinator);devices.set(device,coordinator);return coordinator;
}
