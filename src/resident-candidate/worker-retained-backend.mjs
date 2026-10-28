/* SPDX-License-Identifier: Apache-2.0
 * Genuine retained owner adapter. Receipts, plans and typed views stay private in
 * this realm. Only explicit experimental begin may request a device; public
 * evaluate is unqualified and never routes here. No CPU-forward fallback.
 */
import {need,exact,positive,copyOwnedWorkerData,WorkerUnavailable} from './worker-protocol.mjs';
export function createResidentWorkerBackend({runtime,decoder,sourceVersion,capability}){
 let executor=null,device=null,receipt=null,identity=null,closed=false;const listeners=new Set();
 const summary=()=>Object.freeze({...receipt,submittedCycles:[...receipt.submittedCycles],remainingCycles:[...receipt.remainingCycles]});
 async function release(){let failure;try{await executor?.dispose();}catch(e){failure=e;}finally{executor=null;receipt=null;identity=null;const ownedDevice=device;device=null;ownedDevice?.destroy();}if(failure)throw failure;}
 return Object.freeze({sourceVersion,capability,
  onDeviceLost(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  async begin(message,context){
   need(!closed&&!executor&&!device,'one fresh retained session');need(message.execution==='explicit-unqualified-retained-microcode-v1','explicit experimental execution only');
   const caps=exact(message.caps,['bankCounts','maxHSteps','chunkCycles','maxTotalCycles','macroWorkgroupSize','maxLiveBytes','maxDispatchesPerSubmission'],'caps');
   need(Array.isArray(caps.bankCounts)&&caps.bankCounts.length&&caps.bankCounts.every((n,i)=>Object.hasOwn(caps.bankCounts,i)&&positive(n)&&n<=512)&&Object.keys(caps.bankCounts).length===caps.bankCounts.length&&caps.bankCounts.reduce((a,b)=>a+b,0)===message.rows.length,'complete explicit <=512-row bank partition, no shrinking');
   need(positive(caps.maxHSteps)&&caps.maxHSteps<=0xffffffff&&positive(caps.chunkCycles)&&caps.chunkCycles<=65536&&positive(caps.maxTotalCycles)&&caps.maxTotalCycles>=caps.chunkCycles&&caps.maxTotalCycles<=0xffffffff,'finite explicit physical/chunk/total caps');need([1,8].includes(caps.macroWorkgroupSize)&&positive(caps.maxLiveBytes)&&positive(caps.maxDispatchesPerSubmission)&&caps.maxDispatchesPerSubmission<=4096,'explicit launch/allocation/submission caps');
   const input=copyOwnedWorkerData(message.input),rule=copyOwnedWorkerData(message.rule);context.check();
   const initialization=await runtime.createWorldInitializationPlan({decoder,input,rule,ruleId:message.ruleId});context.check();
   if(!globalThis.navigator?.gpu)throw new WorkerUnavailable('worker-webgpu-unavailable');const adapter=await navigator.gpu.requestAdapter();context.check();if(!adapter)throw new WorkerUnavailable('worker-webgpu-adapter-unavailable');device=await adapter.requestDevice();
   const created=device;device.lost.then(info=>{if(device===created&&!closed)for(const fn of listeners)fn(info);},error=>{if(device===created&&!closed)for(const fn of listeners)fn({reason:'unknown',message:String(error)});});
   try{context.check();let first=0;const banks=[];for(const count of caps.bankCounts){banks.push(runtime.createRetainedInitialMicrocodeRuntime(initialization,message.rows.slice(first,first+count),{experimental:true,maxHSteps:caps.maxHSteps,chunkCycles:caps.chunkCycles,maxTotalCycles:caps.maxTotalCycles}));first+=count;context.check();}
    const plan=runtime.createRetainedInitialMicrocodeBatchPlan(banks,{orderedIds:message.rows.map(r=>r.id),count:message.rows.length,macroWorkgroupSize:caps.macroWorkgroupSize,limits:device.limits,maxLiveBytes:caps.maxLiveBytes});identity=plan.identity;context.setIdentity({...identity});
    executor=runtime.createRetainedInitialMicrocodeBatchExecutor(device,{experimental:true,maxDispatchesPerSubmission:caps.maxDispatchesPerSubmission});receipt=await executor.begin(plan,{identity,getIdentity:()=>{context.check();return identity;},signal:context.signal});context.check();return summary();
   }catch(e){await release();throw e;}
  },
  async advance(sequence,cyclesByBank,context){need(receipt&&receipt.sequence===sequence,'current locally owned work receipt sequence');context.check();receipt=await executor.advance(receipt,{cyclesByBank});context.check();return summary();},
  async finalize(sequence,context){need(receipt&&receipt.sequence===sequence,'current locally owned publication receipt');context.check();try{const result=await executor.finalize(receipt);receipt=null;context.check();return result;}finally{await release();}},
  async cancel(){try{await executor?.cancel();}finally{await release();}},
  async dispose(){closed=true;await release();listeners.clear();}
 });
}
