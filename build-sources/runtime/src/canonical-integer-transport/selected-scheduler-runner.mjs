
/** Experimental GPU-resident source scheduler. No compiler, CPU physics, source
 * command interpretation or production activation. Progress is GPU readback. */
import {assertSelectedSchedulerPlan,SELECTED_SCHEDULER_CEILING} from './selected-scheduler-plan.mjs';
const SCHEDULER_MAGIC=0x43534348;
import {selectedSchedulerKernelWGSL} from './selected-scheduler-kernel.mjs';
import {subscribeDeviceLoss} from '../wasm-gpu/device-loss-subscriptions.mjs';
import {createDeviceLossWaiters} from '../wasm-gpu/device-loss-waiters.mjs';
// Retain uncertain native arenas for the device lifetime; never silently reuse
// or report disposal after an unacknowledged drain. Actual loss releases them.
const quarantines=new WeakMap();
const abort=reason=>Object.assign(Error(String(reason??'Resident scheduler cancelled')),{name:'AbortError'});
const words=(value,length)=>{if(!(value instanceof Uint32Array)||Object.getPrototypeOf(value)!==Uint32Array.prototype||!(value.buffer instanceof ArrayBuffer)||['buffer','byteOffset','byteLength','length'].some(k=>Object.hasOwn(value,k))||value.length!==length)throw TypeError('Complete plain nonshared arena words required');return new Uint32Array(value);};
export async function createSelectedSchedulerTransport(device,{plan,signal,initialArena,initialAtomicArena}={}){
 assertSelectedSchedulerPlan(plan);
 if(quarantines.has(device))throw Error('Device has unacknowledged resident scheduler cleanup');
 if(!(device?.limits?.maxStorageBuffersPerShaderStage>=10)||typeof device?.lost?.then!=='function'||typeof device.pushErrorScope!=='function'||typeof device.popErrorScope!=='function')throw Error('Resident scheduler requires the existing ten-storage-buffer device contract and device loss');
 if(signal?.aborted)throw abort(signal.reason);
 const maximum=SELECTED_SCHEDULER_CEILING,expected=plan.bufferBytes.reduce((a,b)=>a+b,0)+plan.readbackBytes;
 if(expected!==plan.totalOwnedBytes||expected>maximum||plan.bufferBytes.length!==10)throw Error('Exact count-profile scheduler budget');
 if(!Number.isSafeInteger(device.limits.maxBufferSize)||!Number.isSafeInteger(device.limits.maxStorageBufferBindingSize)||plan.bufferBytes.some(n=>n>device.limits.maxBufferSize||n>device.limits.maxStorageBufferBindingSize)||plan.readbackBytes>device.limits.maxBufferSize||!Number.isSafeInteger(device.limits.maxComputeWorkgroupsPerDimension)||plan.dispatchWorkgroups>device.limits.maxComputeWorkgroupsPerDimension)throw Error('Exact scheduler resources exceed granted device limits');
 let allocated=0,closed=false,closing=false,operation=null,disposal=null,cancelled=false,terminal=null,cursor=0,final=false,latest=null,quarantined=false;
 const made=[],pipelines=[],waiters=createDeviceLossWaiters();
 const unsubscribe=subscribeDeviceLoss(device,info=>{terminal=Error('GPU device lost: '+(info?.message??String(info)));waiters.deviceLost(terminal);const held=quarantines.get(device);if(held){for(const b of held)b.destroy();quarantines.delete(device);}});
 const alive=()=>{if(closed||closing)throw Error('Resident scheduler disposed');if(terminal)throw terminal;};
 const fence=()=>waiters.wait(device.queue.onSubmittedWorkDone());
 const scoped=async fn=>{let depth=0,result,failure;try{for(const kind of ['validation','internal','out-of-memory']){device.pushErrorScope(kind);depth++;}result=await fn();}catch(error){failure=error;}while(depth--){try{const error=await waiters.wait(device.popErrorScope());if(error)failure??=Error('Resident scheduler GPU error: '+error.message);}catch(error){failure??=error;}}if(failure)throw failure;return result;};
 const allocate=(size,usage)=>{if(!Number.isSafeInteger(size)||size<4||size%4||allocated>maximum-size)throw Error('Resident scheduler allocation ceiling');const buffer=device.createBuffer({size,usage});made.push(buffer);allocated+=size;return buffer;};
 let buffers,read,groups;
 async function cleanup(){try{await fence();}catch(error){if(!terminal){quarantined=true;quarantines.set(device,made.slice());throw Object.assign(Error('Native drain unacknowledged; scheduler resources retained and device quarantined',{cause:error}),{cleanupVerified:false});}}for(const b of made)b.destroy();made.length=0;allocated=0;closed=true;unsubscribe();}
 try{await scoped(async()=>{
  const U=GPUBufferUsage;
  buffers=plan.bufferBytes.map((size,i)=>allocate(size,U.STORAGE|U.COPY_DST|([2,4,8].includes(i)?U.COPY_SRC:0)|(i===9?U.INDIRECT:0)));
  read=allocate(plan.readbackBytes,U.COPY_DST|U.MAP_READ);
  if(allocated!==expected)throw Error('Scheduler owned accounting mismatch');
  // INDIRECT buffer is bound writable ONLY in setup's dispatch scope/layout.
  // It is absent from initialize/advance/commit bind groups, avoiding a storage
  // write / INDIRECT usage conflict even though all pipelines share one module.
  const makeLayout=n=>device.createBindGroupLayout({entries:buffers.slice(0,n).map((_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:[0,7].includes(binding)?'read-only-storage':'storage'}}))});
  const bgls=[makeLayout(10),makeLayout(9)],layouts=bgls.map(bgl=>device.createPipelineLayout({bindGroupLayouts:[bgl]})),module=device.createShaderModule({code:selectedSchedulerKernelWGSL(),label:'experimental-resident-integer-scheduler-active-domain'});
  const info=await waiters.wait(module.getCompilationInfo());if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));
  for(const entryPoint of ['setup','initialize','advance','commit']){if(signal?.aborted)throw abort(signal.reason);pipelines.push(await waiters.wait(device.createComputePipelineAsync({layout:layouts[entryPoint==='setup'?0:1],compute:{module,entryPoint,constants:{}}})));}
  groups=bgls.map((layout,i)=>device.createBindGroup({layout,entries:buffers.slice(0,i===0?10:9).map((buffer,binding)=>({binding,resource:{buffer,size:buffer.size}}))}));
  if(signal?.aborted)throw abort(signal.reason);
  upload(initialArena,initialAtomicArena??plan.atomicArena);
 });}catch(error){try{await cleanup();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Resident scheduler preparation cleanup failed');}throw error;}
 function upload(arena,atomic){const a=words(arena,plan.arena.length),b=words(atomic,plan.atomicArena.length);if(b.some(x=>x!==0))throw Error('Unused atomic arena must be zero');const bytes=new Uint8Array(a.buffer);for(const init of plan.initialization){const range=plan.arenaOffsets[init.index],part=bytes.subarray(range.offset*4,(range.offset+range.words)*4);if(init.kind==='zero'&&part.some(x=>x!==0)||init.kind==='fixed'&&part.some((x,i)=>x!==init.bytes[i]))throw Error('Exact selected reset bytes required');}assertSelectedSchedulerPlan(plan);for(const[i,value]of[[0,plan.code],[2,a],[4,b],[7,plan.tables],[8,plan.control]])device.queue.writeBuffer(buffers[i],0,value);device.queue.writeBuffer(buffers[9],0,new Uint32Array(4));cursor=0;final=false;cancelled=false;latest=null;}
 async function mapped(source,offset,length){if(length*4>read.size)throw Error('Readback exceeds owned staging');const e=device.createCommandEncoder();e.copyBufferToBuffer(source,offset*4,read,0,length*4);device.queue.submit([e.finish()]);await fence();await waiters.wait(read.mapAsync(GPUMapMode.READ,0,length*4));try{return new Uint32Array(read.getMappedRange(0,length*4).slice(0));}finally{read.unmap();}}
 const checkSignal=s=>{alive();if(cancelled||signal?.aborted||s?.aborted)throw abort(s?.reason??signal?.reason);};
 function exclusive(fn){try{alive();if(operation)throw Error('Resident scheduler operation already active');}catch(error){return Promise.reject(error);}const p=Promise.resolve().then(()=>scoped(fn));operation=p;return p.finally(()=>{if(operation===p)operation=null;});}
 async function advance(goal,{signal:runSignal,onProgress}={}){
  checkSignal(runSignal);if(onProgress!==undefined&&typeof onProgress!=='function')throw TypeError('Synchronous scheduler progress callback required');
  if(!Number.isSafeInteger(goal)||goal<=cursor||goal>plan.commandCount||goal>cursor+256)throw Error('Exact bounded source goal required');
  device.queue.writeBuffer(buffers[8],12,Uint32Array.of(goal));
  try{while(cursor<goal){checkSignal(runSignal);const e=device.createCommandEncoder();
   // Fixed bounded batch. Each compute dispatch is a separate WebGPU usage
   // scope; preserve all stage dispatches/order, with one enclosing compute pass.
   const pass=e.beginComputePass();for(let cycle=0;cycle<64;cycle++)for(let stage=0;stage<4;stage++){pass.setPipeline(pipelines[stage]);pass.setBindGroup(0,groups[stage===0?0:1]);if(stage===0||stage===3)pass.dispatchWorkgroups(1,1,1);else pass.dispatchWorkgroupsIndirect(buffers[9],0);}pass.end();
   device.queue.submit([e.finish()]);await fence();checkSignal(runSignal);
   const state=await mapped(buffers[8],0,32);checkSignal(runSignal);
   if(state[0]!==SCHEDULER_MAGIC||state[1]!==1||state[14]!==1||state[11]!==plan.commandCount||state[3]!==goal||state[17]!==goal||state[2]<cursor||state[2]>goal||state[6]!==0||state[10]!==0||state[4]>5||state[8]>plan.maxSlices||state[12]<=(latest?.cycles??0)||state[12]>(latest?.cycles??0)+64||(state[2]===goal&&state[4]!==0))throw Object.assign(Error('GPU resident scheduler status failure'),{schedulerStatus:state.slice()});
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
  finish:options=>exclusive(async()=>{checkSignal(options?.signal);if(cursor!==plan.commandCount||!final)throw Error('Full selected schedule required');const world=await mapped(buffers[2],plan.outputs.world.offset,plan.outputs.world.words);checkSignal(options?.signal);const trace=await mapped(buffers[2],plan.outputs.trace.offset,plan.outputs.trace.words);checkSignal(options?.signal);return Object.freeze({world,trace,status:latest});}),
  reset:({arena,atomicArena}={})=>exclusive(async()=>{await fence();alive();upload(arena,atomicArena);}),
  cancel,drain:()=>exclusive(fence),dispose,
  status:()=>Object.freeze({closed,closing,quarantined,cleanupVerified:closed&&!quarantined,active:!!operation,cancelled,ownedBytes:allocated,completedOrdinal:cursor,final,diagnostics:latest}),
 });
}
