/** Experimental GPU-resident source scheduler. No compiler, CPU physics, source
 * command interpretation or production activation. Progress is GPU readback. */
import {assertResidentSchedulerPlan,SCHEDULER_MAGIC} from './resident-scheduler-plan.mjs';
import {residentSchedulerKernelWGSL} from './resident-scheduler-kernel.mjs';
import {subscribeDeviceLoss} from '../wasm-gpu/device-loss-subscriptions.mjs';
import {createDeviceLossWaiters} from '../wasm-gpu/device-loss-waiters.mjs';
// Retain uncertain native arenas for the device lifetime; never silently reuse
// or report disposal after an unacknowledged drain. Actual loss releases them.
const quarantines=new WeakMap();
const abort=reason=>Object.assign(Error(String(reason??'Resident scheduler cancelled')),{name:'AbortError'});
const words=(value,length)=>{if(!(value instanceof Uint32Array)||!(value.buffer instanceof ArrayBuffer)||value.length!==length)throw TypeError('Complete nonshared arena words required');return value.slice();};
export async function createResidentSchedulerTransport(device,{plan,signal,initialArena,initialAtomicArena}={}){
 assertResidentSchedulerPlan(plan);
 if(quarantines.has(device))throw Error('Device has unacknowledged resident scheduler cleanup');
 if(!(device?.limits?.maxStorageBuffersPerShaderStage>=10)||typeof device?.lost?.then!=='function'||typeof device.pushErrorScope!=='function'||typeof device.popErrorScope!=='function')throw Error('Resident scheduler requires the existing ten-storage-buffer device contract and device loss');
 if(signal?.aborted)throw abort(signal.reason);
 const maximum=8*1024*1024,expected=plan.bufferBytes.reduce((a,b)=>a+b,0)+plan.readbackBytes;
 if(expected!==plan.totalOwnedBytes||expected>maximum||plan.bufferBytes.length!==9)throw Error('Exact aggregate eight MiB scheduler budget');
 let allocated=0,closed=false,closing=false,operation=null,disposal=null,cancelled=false,terminal=null,cursor=0,final=false,latest=null,quarantined=false;
 const made=[],pipelines=[],waiters=createDeviceLossWaiters();
 const unsubscribe=subscribeDeviceLoss(device,info=>{terminal=Error('GPU device lost: '+(info?.message??String(info)));waiters.deviceLost(terminal);const held=quarantines.get(device);if(held){for(const b of held)b.destroy();quarantines.delete(device);}});
 const alive=()=>{if(closed||closing)throw Error('Resident scheduler disposed');if(terminal)throw terminal;};
 const fence=()=>waiters.wait(device.queue.onSubmittedWorkDone());
 const scoped=async fn=>{let depth=0,result,failure;try{for(const kind of ['validation','internal','out-of-memory']){device.pushErrorScope(kind);depth++;}result=await fn();}catch(error){failure=error;}while(depth--){try{const error=await waiters.wait(device.popErrorScope());if(error)failure??=Error('Resident scheduler GPU error: '+error.message);}catch(error){failure??=error;}}if(failure)throw failure;return result;};
 const allocate=(size,usage)=>{if(!Number.isSafeInteger(size)||size<4||size%4||allocated>maximum-size)throw Error('Resident scheduler allocation ceiling');const buffer=device.createBuffer({size,usage});made.push(buffer);allocated+=size;return buffer;};
 let buffers,read,group;
 async function cleanup(){try{await fence();}catch(error){if(!terminal){quarantined=true;quarantines.set(device,made.slice());throw Object.assign(Error('Native drain unacknowledged; scheduler resources retained and device quarantined',{cause:error}),{cleanupVerified:false});}}for(const b of made)b.destroy();made.length=0;allocated=0;closed=true;unsubscribe();}
 try{await scoped(async()=>{
  const U=GPUBufferUsage;
  buffers=plan.bufferBytes.map((size,i)=>allocate(size,U.STORAGE|U.COPY_DST|([2,4,8].includes(i)?U.COPY_SRC:0)));
  read=allocate(plan.readbackBytes,U.COPY_DST|U.MAP_READ);
  if(allocated!==expected)throw Error('Scheduler owned accounting mismatch');
  const bgl=device.createBindGroupLayout({entries:buffers.map((_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:[0,7].includes(binding)?'read-only-storage':'storage'}}))});
  const layout=device.createPipelineLayout({bindGroupLayouts:[bgl]}),module=device.createShaderModule({code:residentSchedulerKernelWGSL(),label:'experimental-resident-integer-scheduler'});
  const info=await waiters.wait(module.getCompilationInfo());if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));
  for(const entryPoint of ['setup','initialize','advance','commit']){if(signal?.aborted)throw abort(signal.reason);pipelines.push(await waiters.wait(device.createComputePipelineAsync({layout,compute:{module,entryPoint}})));}
  group=device.createBindGroup({layout:bgl,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer,size:buffer.size}}))});
  if(signal?.aborted)throw abort(signal.reason);
  upload(initialArena??plan.arena,initialAtomicArena??plan.atomicArena);
 });}catch(error){try{await cleanup();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Resident scheduler preparation cleanup failed');}throw error;}
 function upload(arena,atomic){const a=words(arena,plan.arena.length),b=words(atomic,plan.atomicArena.length);assertResidentSchedulerPlan(plan);for(const[i,value]of[[0,plan.code],[2,a],[4,b],[7,plan.tables],[8,plan.control]])device.queue.writeBuffer(buffers[i],0,value);cursor=0;final=false;cancelled=false;latest=null;}
 async function mapped(source,offset,length){if(length*4>read.size)throw Error('Readback exceeds owned staging');const e=device.createCommandEncoder();e.copyBufferToBuffer(source,offset*4,read,0,length*4);device.queue.submit([e.finish()]);await fence();await waiters.wait(read.mapAsync(GPUMapMode.READ,0,length*4));try{return new Uint32Array(read.getMappedRange(0,length*4).slice(0));}finally{read.unmap();}}
 const checkSignal=s=>{alive();if(cancelled||signal?.aborted||s?.aborted)throw abort(s?.reason??signal?.reason);};
 function exclusive(fn){try{alive();if(operation)throw Error('Resident scheduler operation already active');}catch(error){return Promise.reject(error);}const p=Promise.resolve().then(()=>scoped(fn));operation=p;return p.finally(()=>{if(operation===p)operation=null;});}
 async function advance(goal,{signal:runSignal,onProgress}={},finishing=false){
  checkSignal(runSignal);if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous scheduler progress callback required');
  if(!Number.isSafeInteger(goal)||goal<=cursor||(!finishing&&(goal>plan.commandCount||goal>cursor+256))||(finishing&&(cursor!==plan.commandCount||goal!==plan.finalCursor)))throw Error('Exact bounded source goal required');
  device.queue.writeBuffer(buffers[8],12,Uint32Array.of(goal));
  try{while(cursor<goal){checkSignal(runSignal);const e=device.createCommandEncoder();
   // Fixed bounded batch. No cross-workgroup barrier assumption: each scheduler
   // stage is a distinct pass; after reaching goal remaining cycles are no-ops.
   for(let cycle=0;cycle<64;cycle++)for(let stage=0;stage<4;stage++){const pass=e.beginComputePass();pass.setPipeline(pipelines[stage]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(stage===0||stage===3?1:plan.dispatchWorkgroups,1,1);pass.end();}
   device.queue.submit([e.finish()]);await fence();checkSignal(runSignal);
   const state=await mapped(buffers[8],0,32);checkSignal(runSignal);
   if(state[0]!==SCHEDULER_MAGIC||state[1]!==1||state[14]!==1||state[11]!==plan.commandCount||state[3]!==goal||state[17]!==goal||state[2]<cursor||state[2]>goal||state[6]!==0||state[10]!==0||state[4]>4||state[8]>plan.maxSlices||state[12]<=(latest?.cycles??0)||state[12]>(latest?.cycles??0)+64||(state[2]===goal&&state[4]!==0))throw Object.assign(Error('GPU resident scheduler status failure'),{schedulerStatus:state.slice()});
   cursor=state[2];final=state[13]===1;if(final!== (cursor===plan.finalCursor))throw Error('GPU scheduler final marker mismatch');
   latest=Object.freeze({nativeStage:'resident-scheduler-progress',completedOrdinal:cursor,confirmedCommands:Math.min(cursor,plan.commandCount),goal,phase:state[4],remaining:state[5],slices:state[8],cycles:state[12],final});
   const value=onProgress?.(latest);if(value&&typeof value.then==='function'){Promise.resolve(value).catch(()=>{});throw TypeError('Synchronous scheduler progress callback required');}
   checkSignal(runSignal);
  }return latest;}catch(error){cancelled=true;throw error;}
 }
 function cancel(){cancelled=true;}
 function dispose(){if(disposal)return disposal;closing=true;cancel();const pending=operation;disposal=Promise.resolve().then(async()=>{if(pending)await pending.catch(()=>{});await cleanup();});return disposal;}
 return Object.freeze({experimental:true,productionEnabled:false,
  runTo:(goal,options)=>exclusive(()=>advance(goal,options)),
  finish:options=>exclusive(async()=>{await advance(plan.finalCursor,options,true);checkSignal(options?.signal);const compact=await mapped(buffers[2],plan.compact.offset,plan.compact.words);checkSignal(options?.signal);return Object.freeze({compact,status:latest});}),
  readFullResult:()=>exclusive(async()=>{if(!final||cancelled)throw Error('Completed final gate and copy required');const result=await mapped(buffers[2],plan.fullResult.offset,plan.fullResult.words);checkSignal();return result;}),
  reset:({arena,atomicArena}={})=>exclusive(async()=>{await fence();alive();upload(arena,atomicArena);}),
  cancel,drain:()=>exclusive(fence),dispose,
  status:()=>Object.freeze({closed,closing,quarantined,cleanupVerified:closed&&!quarantined,active:!!operation,cancelled,ownedBytes:allocated,completedOrdinal:cursor,final,diagnostics:latest}),
 });
}
