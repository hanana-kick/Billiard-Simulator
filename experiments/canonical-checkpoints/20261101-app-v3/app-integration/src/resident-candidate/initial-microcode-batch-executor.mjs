/* SPDX-License-Identifier: Apache-2.0
 * Multi-bank, opt-in compact microcode execution/lifetime owner. A dedicated
 * borrowed device is required: no unrelated queue/error-scope user may overlap.
 * No adapter/device request, CPU physics, diagnostic state map or qualification.
 */
import {assertInitialMicrocodeBatchPlan,initialMicrocodeBatchInput} from './initial-microcode-batch-plan.mjs';
import {snapshotMicrocodeDeviceLimits} from './microcode-resources.mjs';
import {createResidentCompactTransaction,ResidentBatchProtocolError} from './batch-protocol.mjs';
import {initialResults,REASON as R} from './abi.mjs';
export const INITIAL_MICROCODE_BATCH_EXECUTOR_CAPABILITY=Object.freeze({experimentalOptIn:true,singleBank:false,simultaneousBanks:true,allBankResourcesBeforeExecution:true,residentBetweenH:true,compactResultsOnly:true,hostForwardFallback:false,automaticDeviceRequest:false,numericallyQualified:false,originalFullRestQualified:false,native1024TrajectoriesQualified:false,hardwarePerformanceMeasured:false,defaultBackend:false});
const STORAGE=128,COPY_SRC=4,COPY_DST=8,MAP_READ=1,owners=new WeakMap(),lifetimes=new WeakMap(),poisoned=new WeakSet();
const need=(ok,message)=>{if(!ok)throw new TypeError('Initial microcode batch executor: '+message);};
const identityKeys=['sourceIdentity','preStrikeIdentity','generationIdentity'];
function identityOf(value){need(value&&Object.getPrototypeOf(value)===Object.prototype,'exact identity lease required');const d=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(d).length===3&&identityKeys.every(k=>Object.hasOwn(d[k]??{},'value')&&typeof d[k].value==='string'&&d[k].value.length>0),'source/prestrike/generation data identity');return Object.freeze(Object.fromEntries(identityKeys.map(k=>[k,d[k].value])));}
const same=(a,b)=>identityKeys.every(k=>a[k]===b[k]);
function dataOptions(value,keys,label){need(value&&Object.getPrototypeOf(value)===Object.prototype,label+' plain data options');const d=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(d).every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(d[k],'value')),label+' unknown option/accessor');return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));}
class Stop extends Error{constructor(reason){super('Initial microcode operation interrupted');this.reason=reason;}}
function deviceLifetime(device){let value=lifetimes.get(device);if(value)return value;value={lost:null,listeners:new Set()};lifetimes.set(device,value);const lost=info=>{value.lost=info??{reason:'unknown'};for(const listener of value.listeners)listener(value.lost);value.listeners.clear();};Promise.resolve(device.lost).then(lost,lost);return value;}
/** device ownership is exclusive through dispose(), including cached pipelines.
 * ALL fresh banks are allocated for each evaluate; only immutable shader pipelines
 * are reused, keyed by COMPLETE source/entry/binding types on this device.
 */
export function createInitialMicrocodeBatchExecutor(device,options={}){
 const {experimental,maxDispatchesPerSubmission=1024,onProgress}=dataOptions(options,['experimental','maxDispatchesPerSubmission','onProgress'],'constructor');
 need(experimental===true,'explicit experimental opt-in');need(Number.isInteger(maxDispatchesPerSubmission)&&maxDispatchesPerSubmission>=1&&maxDispatchesPerSubmission<=4096,'bounded command submission');need(onProgress===undefined||typeof onProgress==='function','progress callback');
 need(device&&['createBuffer','createShaderModule','createComputePipelineAsync','createBindGroupLayout','createPipelineLayout','createBindGroup','createCommandEncoder','pushErrorScope','popErrorScope'].every(k=>typeof device[k]==='function')&&device.queue&&['writeBuffer','submit','onSubmittedWorkDone'].every(k=>typeof device.queue[k]==='function')&&typeof device.lost?.then==='function','actual borrowed device lifecycle interface');need(!owners.has(device)&&!poisoned.has(device),'device already owned or poisoned');
 const tag=Object.freeze({}),lifetime=deviceLifetime(device),cache=new Map(),modules=new Map(),lossWaiters=new Set();need(!lifetime.lost,'device already lost');owners.set(device,tag);
 let lost=lifetime.lost,closed=false,busy=false,failed=false,active=null,closePromise=null,cancelled=false;
 const lose=info=>{lost=info;cache.clear();modules.clear();for(const reject of [...lossWaiters])reject(new Stop(R.DEVICE_LOST));lossWaiters.clear();};lifetime.listeners.add(lose);
 const report=value=>{if(onProgress)onProgress(Object.freeze(value));};
 const raceLoss=promise=>new Promise((resolve,reject)=>{lossWaiters.add(reject);Promise.resolve(promise).then(value=>{lossWaiters.delete(reject);resolve(value);},error=>{lossWaiters.delete(reject);reject(error);});if(lost){lossWaiters.delete(reject);reject(new Stop(R.DEVICE_LOST));}});
 const scopes=async fn=>{let depth=0,value,error;const filters=['out-of-memory','validation','internal'];try{for(const f of filters){device.pushErrorScope(f);depth++;}value=await fn();}catch(e){error=e;}finally{while(depth){depth--;try{const e=await raceLoss(device.popErrorScope());if(e){poisoned.add(device);error??=new Error('GPU '+filters[depth]+': '+e.message);}}catch(e){if(!lost)poisoned.add(device);error??=e;}}}if(error)throw error;return value;};
 const api={capability:INITIAL_MICROCODE_BATCH_EXECUTOR_CAPABILITY,
  async evaluate(plan,options){
   need(!closed&&!busy&&!failed&&!lost&&!poisoned.has(device),'one live healthy idle owner');assertInitialMicrocodeBatchPlan(plan);
   const opt=dataOptions(options,['identity','getIdentity','signal'],'evaluate');need(typeof opt.getIdentity==='function','live identity getter required');need(opt.signal===undefined||typeof opt.signal.aborted==='boolean','abort signal');
   const identity=identityOf(opt.identity),source=identityOf(plan.identity);need(same(identity,source),'lease must match exact owned source/generation');
   const getIdentity=()=>identityOf(opt.getIdentity()),transaction=createResidentCompactTransaction({input:initialMicrocodeBatchInput(plan),banks:plan.banks.map(b=>({first:b.first,count:b.count})),identity,getIdentity});
   busy=true;cancelled=false;
   const run=async()=>{
    const buffers=new Map(),allocated=[],groups=new Map();let pendingWork=false,cleaned=false,limits,readback;
    const stats={dispatches:0,submissions:0,drains:0,mappings:0,copies:0,initialWrites:0,pipelinesCreated:0,preflightDescriptors:0,buffersCreated:0,buffersDestroyed:0,peakLiveBufferBytes:0};
    const check=()=>{if(lost)throw new Stop(R.DEVICE_LOST);if(closed||cancelled||opt.signal?.aborted)throw new Stop(R.CANCELLED);if(!same(identity,getIdentity()))throw new Stop(R.STALE_SOURCE);};
    const integrity=()=>{check();assertInitialMicrocodeBatchPlan(plan,limits?{limits}:{});check();};
    const drain=async()=>{if(!pendingWork)return;if(lost){pendingWork=false;return;}try{stats.drains++;await raceLoss(device.queue.onSubmittedWorkDone());pendingWork=false;}catch(e){if(lost){pendingWork=false;throw new Stop(R.DEVICE_LOST);}poisoned.add(device);throw e;}};
    const cleanup=async()=>{if(cleaned)return;cleaned=true;const errors=[];try{await drain();}catch(e){if(!lost)errors.push(e);}for(const b of allocated){try{b.unmap();}catch(e){errors.push(e);}try{b.destroy();stats.buffersDestroyed++;}catch(e){errors.push(e);}}buffers.clear();groups.clear();if(errors.length){poisoned.add(device);throw new AggregateError(errors,'Microcode cleanup/drain failed');}};
    const submit=async encoder=>{check();pendingWork=true;try{device.queue.submit([encoder.finish()]);stats.submissions++;await drain();}catch(e){if(!lost&&!(e instanceof Stop))poisoned.add(device);throw e;}check();};
    const dispatch=async indices=>{let encoder,pass,n=0;const flush=async()=>{if(!n)return;pass.end();await submit(encoder);n=0;integrity();};for(const index of indices){check();if(!n){encoder=device.createCommandEncoder();pass=encoder.beginComputePass();}const item=groups.get(index);need(item,'admitted dispatch descriptor');pass.setPipeline(item.pipeline);pass.setBindGroup(0,item.group);pass.dispatchWorkgroups(item.workgroups);stats.dispatches++;if(++n===maxDispatchesPerSubmission)await flush();}await flush();};
    try{
     check();limits=snapshotMicrocodeDeviceLimits(device);assertInitialMicrocodeBatchPlan(plan,{limits});const descriptors=plan.banks.flatMap(b=>b.descriptors.map(d=>({...d,bank:b.index,key:b.index+':'+d.index}))),allocations=plan.allocations,resultBytes=plan.compactBytes;stats.peakLiveBufferBytes=plan.totalBytes;
     const key=d=>JSON.stringify([d.entryPoint,d.bindingTypes,d.code]);
     // Keep only this request's exact immutable program. No unbounded cache of
     // historical waves/counts/scenes; previous request already drained/disposed.
     const currentKeys=new Set(descriptors.map(key)),currentSources=new Set(descriptors.map(d=>d.code));for(const k of cache.keys())if(!currentKeys.has(k))cache.delete(k);for(const k of modules.keys())if(!currentSources.has(k))modules.delete(k);
     // All banks / all logical descriptors preflight before ANY pipeline.
     await scopes(async()=>{for(const d of descriptors){integrity();let m=modules.get(d.code);if(!m){const module=device.createShaderModule({code:d.code,label:d.name}),info=await raceLoss(module.getCompilationInfo());integrity();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(d.name+': '+errors.map(m=>m.lineNum+':'+m.linePos+' '+m.message).join('\n'));m={module};modules.set(d.code,m);}stats.preflightDescriptors++;}integrity();});
     report({phase:'all-banks-preflight-complete',banks:plan.banks.length,descriptors:descriptors.length,pipelinesStarted:0});integrity();
     const compiled=new Map();for(const d of Array.from({length:27},(_,rank)=>plan.banks.map(b=>descriptors[b.index*27+b.compileOrder[rank]])).flat()){const index=d.key,k=key(d);let item=cache.get(k);if(!item){item=await scopes(async()=>{integrity();const layout=device.createBindGroupLayout({entries:d.bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),pipeline=await raceLoss(device.createComputePipelineAsync({label:d.name,layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),compute:{module:modules.get(d.code).module,entryPoint:d.entryPoint}}));integrity();return{layout,pipeline};});cache.set(k,item);stats.pipelinesCreated++;}compiled.set(index,item);report({phase:'pipeline-ready',index,name:d.name,bank:d.bank,ready:compiled.size,total:descriptors.length});integrity();}
     // Transactional ALL allocations, before any upload or compute submission.
     await scopes(async()=>{for(const a of allocations){check();const b=device.createBuffer({label:'resident batch '+a.bank+':'+a.name,size:a.bytes,usage:a.usage});need(b&&typeof b.destroy==='function'&&typeof b.unmap==='function','owned GPUBuffer lifecycle');need(!allocated.includes(b),'source/VM buffers must be disjoint');allocated.push(b);stats.buffersCreated++;need(b.size===a.bytes,'exact owned GPUBuffer size');buffers.set(a.bank+':'+a.name,b);}integrity();});
     const sizeByName=new Map(allocations.map(a=>[a.bank+':'+a.name,a.bytes]));for(const b of plan.banks)for(const alias of b.launch.aliases){const name=b.index+':'+alias.name,target=b.index+':'+alias.target;buffers.set(name,buffers.get(target));sizeByName.set(name,sizeByName.get(target));}readback=buffers.get('null:compactReadback');
     await scopes(async()=>{integrity();for(const b of plan.banks)for(const upload of[...b.launch.uploads,{name:'compactResults',offsetWords:0,data:initialResults(b.runtime.original.input)}]){const name=b.index+':'+upload.name;need(upload.offsetWords*4+upload.data.byteLength<=sizeByName.get(name),'exact initial upload span');pendingWork=true;device.queue.writeBuffer(buffers.get(name),upload.offsetWords*4,upload.data);stats.initialWrites++;}await drain();integrity();for(const d of descriptors){const c=compiled.get(d.key),group=device.createBindGroup({layout:c.layout,entries:d.resources.map((name,binding)=>({binding,resource:{buffer:buffers.get(d.bank+':'+name),offset:0,size:sizeByName.get(d.bank+':'+name)}}))});groups.set(d.key,{pipeline:c.pipeline,group,workgroups:d.workgroups});}integrity();});
     await scopes(async()=>{
      // Every bank was allocated/uploaded first. Source initializers may execute
      // bank by bank, but NO bank is released or spilled until global completion.
      await dispatch((function*(){for(const b of plan.banks)for(const c of b.launch.schedule.initialize)for(let n=0;n<c.repeat;n++)yield b.index+':'+c.descriptor;})());report({phase:'all-banks-initialized',banks:plan.banks.length,dispatches:stats.dispatches,sourceStateReadbacks:0});integrity();
      // Each complete core+four-macro cycle stays ordered within its bank.
      // Different explicit work caps are preserved; exhaustion is not a miss.
      await dispatch((function*(){const max=Math.max(...plan.banks.map(b=>b.workCycles));for(let n=0;n<max;n++)for(const b of plan.banks)if(n<b.workCycles)for(const i of b.launch.schedule.cycle)yield b.index+':'+i;})());integrity();report({phase:'all-bank-work-drained',banks:plan.banks.length});integrity();
      await dispatch(plan.banks.map(b=>b.index+':26'));const encoder=device.createCommandEncoder();for(const b of plan.banks){encoder.copyBufferToBuffer(buffers.get(b.index+':compactResults'),0,readback,b.first*16,b.compactBytes);stats.copies++;}await submit(encoder);integrity();
     });
     let words;await scopes(async()=>{check();stats.mappings++;try{await raceLoss(readback.mapAsync(MAP_READ));try{words=new Uint32Array(readback.getMappedRange().slice(0));}finally{readback.unmap();}}catch(e){if(!lost&&!(e instanceof Stop))poisoned.add(device);throw e;}integrity();});
     for(const b of plan.banks)transaction.stage(transaction.bankReceipts[b.index],words.subarray(b.first*4,(b.first+b.count)*4));await cleanup();integrity();const result=transaction.commit();return Object.freeze({results:result.results,evidence:Object.freeze({...result.evidence,...stats,executionTransport:'initial-only-multi-bank-compact-microcode-v1',planSha256:plan.planSha256,candidateCount:plan.count,requestedH:plan.requestedH,submittedVmCycles:Object.freeze(plan.banks.map(b=>b.workCycles)),sourceStateReadbacks:0,intermediateStateReadbacks:0,readbackBytes:resultBytes,limitsSource:'queried-GPUDevice',bindingPolicy:'compatibility-128mib',singleBank:false,simultaneousBanks:true,allBanksAllocatedBeforeUpload:true,mutableResourcesShared:false,immutableResourcesDeduplicated:false,allResourcesDestroyed:true,numericallyQualified:false,hardwarePerformanceMeasured:false})});
    }catch(error){let cleanupError;try{await cleanup();}catch(e){cleanupError=e;}if(cleanupError){failed=true;cache.clear();modules.clear();throw new AggregateError([error,cleanupError],'Microcode operation and cleanup failed');}if(lost)return transaction.abort(R.DEVICE_LOST);if(error instanceof Stop)return transaction.abort(error.reason);if(error instanceof ResidentBatchProtocolError&&error.reason===R.STALE_SOURCE)return transaction.abort(R.STALE_SOURCE);failed=true;cache.clear();modules.clear();throw error;}
   };
   active=run();try{return await active;}finally{active=null;busy=false;}
  },
  dispose(){return closePromise??=(async()=>{closed=true;cancelled=true;let failure;try{if(active)await active;}catch(e){failure=e;}cache.clear();modules.clear();lifetime.listeners.delete(lose);if(!poisoned.has(device)&&owners.get(device)===tag)owners.delete(device);if(failure)throw failure;return Object.freeze({disposed:true,deviceDestroyed:false});})();}
 };return Object.freeze(api);
}
