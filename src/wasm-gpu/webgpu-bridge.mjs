import {awaitCanonicalPreparation} from '../direct-candidate/canonical-page-preparation.mjs';
/** Experimental GPU-only execution bridge. No capture, CPU physics or public activation.
 * Artifact initial data is intentionally not trusted/stored: callers supply every
 * internal arena's complete bytes for every run. With rawEngine, the same arena
 * executes raw GPU production before world commands; without it, genuine raw
 * GPU outputs are borrowed explicitly and never fabricated.
 * EXCLUSIVE DEVICE CONTRACT: the caller must serialize all operations on this
 * GPUDevice (including raw producers and other bridges) across each awaited
 * bridge method. WebGPU error-scope stacks are device-global; this bridge's
 * per-instance lock is not a shared-device scheduler.
 */
import {assertLoadedWasmGpuRawArtifact} from './raw-artifact.mjs';
import {assertLoadedWasmGpuEngineArtifact} from './engine-artifact.mjs';
import {validateLiveWorldResources} from '../direct-candidate/experimental-live-world-resources.mjs';
import {compileLiveWorldPipeline} from '../direct-candidate/experimental-live-world-pipeline-cache.mjs';
import {createLiveWorldRunBindGroups} from '../direct-candidate/experimental-live-world-bind-groups.mjs';

// Byte-identical to the canonical generator; tested without a runtime factory import.
export function liveBoundsResultGateSource(stride){if(!Number.isInteger(stride)||stride<4)throw RangeError('Complete result stride');return `@group(0) @binding(0) var<storage,read_write> fault:array<atomic<u32>>;@group(0) @binding(1) var<storage,read_write> result:array<u32>;@group(0) @binding(2) var<storage,read> ids:array<u32>;@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let c=id.x;if(c>=arrayLength(&ids)){return;}if(atomicLoad(&fault[c])!=0u){let b=(c+1u)*${stride}u-4u;result[b]=ids[c];result[b+1u]=4u;result[b+2u]=4u;result[b+3u]=0x80000000u;}}`;}

export function encodeWasmGpuClear(encoder,buffer,{offset,size},stride,count){
 if(![offset,size,stride,count].every(Number.isSafeInteger)||offset<0||size<4||stride<4||count<1||offset%4||size%4||stride%4||offset+size>stride||stride*count!==buffer.size)throw RangeError('Exact candidate-local clear range required');
 if(offset===0&&size===stride){encoder.clearBuffer(buffer,0,buffer.size);return;}
 for(let i=0;i<count;i++)encoder.clearBuffer(buffer,i*stride+offset,size);
}

export function validateWasmGpuCommandCount(worldCount,rawCount=0){
 if(!Number.isSafeInteger(worldCount)||worldCount<1||!Number.isSafeInteger(rawCount)||rawCount<0||worldCount+rawCount>65536)throw RangeError('Bounded combined command table required');
 return worldCount+rawCount;
}

export async function createWasmGpuWebGPUBridge(device,{engine,rawEngine,maximumOwnedBytes,maxInFlight=1,signal,onPrepareProgress}={}) {
 if(onPrepareProgress!==undefined&&typeof onPrepareProgress!=='function')throw TypeError('Synchronous preparation callback required');
 const checkPrepare=()=>{if(signal?.aborted)throw new DOMException(String(signal.reason??'GPU preparation cancelled'),'AbortError');};
 const progress=value=>{checkPrepare();const result=onPrepareProgress?.(Object.freeze(value));if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw TypeError('Preparation callback must be synchronous');}checkPrepare();};
 checkPrepare();
 if(typeof device?.pushErrorScope!=='function'||typeof device?.popErrorScope!=='function')throw TypeError('GPU error scopes required');
 if(typeof device?.lost?.then!=='function')throw TypeError('Device loss promise required');
 assertLoadedWasmGpuEngineArtifact(engine);
 if(!engine?.lowered||!Number.isInteger(engine.count)||engine.count<1)throw TypeError('Loaded engine artifact required');
 if(![1,2].includes(maxInFlight))throw RangeError('Bounded in-flight submissions must be 1 or 2');
 validateLiveWorldResources(engine.resources,device.limits,{maximumOwnedBytes});
 const {lowered,count}=engine,plan=lowered.sourcePlan,worldCommands=lowered.commands;
 if(rawEngine){
  assertLoadedWasmGpuRawArtifact(rawEngine);
  const facts=engine.rawAllocations;
  if(rawEngine.count!==count||rawEngine.sourceRevision!==engine.sourceRevision||rawEngine.strikeBackend!==plan.strikeBackend||rawEngine.strikeBackend!==facts.strikeBackend||rawEngine.maximumSteps!==facts.effectiveMaximumSteps||rawEngine.allocations.find(a=>a.role==='scene')?.bytes!==facts.sceneBytes)throw Error('Raw/world source, width, backend or configuration mismatch');
  for(const key of ['maximumSteps','effectiveMaximumSteps'])if(engine.structuralConfig[key]!==undefined&&engine.structuralConfig[key]!==rawEngine.maximumSteps)throw Error('Raw/world step configuration mismatch');
  if(facts.allocations.length!==rawEngine.allocations.length||rawEngine.allocations.some(a=>{const f=facts.allocations.find(f=>f.role===a.role);return !f||f.bytes!==a.bytes||f.usage!==a.sourceUsage;}))throw Error('Raw/world resource facts mismatch');
 }
 const rawCommands=rawEngine?.commands??[];validateWasmGpuCommandCount(worldCommands.length,rawCommands.length);
 const commands=[...rawCommands,...worldCommands];
 const pipelines=[],rawPipelines=[],totalPipelines=lowered.definitions.length+(rawEngine?.definitions.length??0)+1;let completedPipelines=0;
 const compile=async definition=>{checkPrepare();progress({stage:'compile-start',pipelineIndex:completedPipelines+1,totalPipelines,shaderBytes:new TextEncoder().encode(definition.code).byteLength,entryPoint:definition.entryPoint??'main',label:definition.label});const pipeline=await compileLiveWorldPipeline(device,{...definition,signal});checkPrepare();progress({stage:'compile',completedPipelines:++completedPipelines,totalPipelines});return pipeline;};
 for(const [index,definition] of lowered.definitions.entries())pipelines.push(await compile({code:definition.code,layout:definition.layout,label:`world-N${count}-${index+1}`}));
 if(rawEngine)for(const [index,definition] of rawEngine.definitions.entries())rawPipelines.push(await compile({code:definition.code,layout:definition.layout,label:`raw-N${count}-${index+1}`}));
 const stride=plan.allocations[plan.readback].size/4;
 const gate=await compile({code:liveBoundsResultGateSource(stride),preflight:false,label:`result-gate-N${count}`});
 const buffers=[],rawBuffers=[],owned=[],pending=[];
 const internalGroups=createLiveWorldRunBindGroups(device);let externalGroups=createLiveWorldRunBindGroups(device);
 let lost=null,disposed=false,active=null,lastGeneration=0,busy=false;
 const alive=()=>{if(disposed)throw Error('GPU bridge disposed');if(lost)throw lost;};
 // Device loss establishes that pending GPU work can no longer access resources.
 let rejectLost;const loss=new Promise((_,reject)=>{rejectLost=reject;});loss.catch(()=>{});
 const lose=(reason='GPU device lost')=>{if(!lost){lost=reason instanceof Error?reason:Error(String(reason));active=null;externalGroups.dispose();}};
 const deviceLost=reason=>{lose(reason);rejectLost(lost);};
 Promise.resolve(device.lost).then(info=>deviceLost('GPU device lost: '+(info?.message??'unknown')),deviceLost);
 const scoped=async(fn,preparation=false)=>{
  let result,failure,depth=0,gpuFailure;
  try{for(const kind of ['validation','internal','out-of-memory']){device.pushErrorScope(kind);depth++;}result=await fn();}catch(error){failure=error;}
  while(depth--){try{const error=await awaitCanonicalPreparation(device.popErrorScope(),preparation?signal:undefined);if(error&&!gpuFailure)gpuFailure=Error('GPU operation error: '+(error.message??String(error)));}catch(error){gpuFailure??=error;}}
  if(gpuFailure)lose(gpuFailure);if(failure)throw failure;if(gpuFailure)throw gpuFailure;return result;
 };
 const totalBuffers=(rawEngine?.allocations.length??0)+plan.allocations.filter(a=>!a.external).length+3;
 const allocated=()=>progress({stage:'allocate',allocatedBuffers:owned.length,totalBuffers});
 try {const prepared=await scoped(async()=>{
  checkPrepare();
  if(rawEngine)for(const a of rawEngine.allocations){checkPrepare();const b=device.createBuffer({size:a.bytes,usage:a.usage});rawBuffers.push(b);owned.push(b);allocated();}
  for(let i=0;i<plan.allocations.length;i++){
   const a=plan.allocations[i];if(a.external){buffers.push(rawEngine?rawBuffers[rawEngine.outputs[a.external]]:null);continue;}
   checkPrepare();const b=device.createBuffer({size:a.size*(lowered.shared[i]?1:count),usage:128|4|8});buffers.push(b);owned.push(b);allocated();
  }
  const make=(size,usage)=>{checkPrepare();const b=device.createBuffer({size,usage});owned.push(b);allocated();return b;};
  let fault=make(count*4,128|8),ids=make(count*4,128|8),read=make(count*16,1|8);
  if(rawEngine&&owned.reduce((sum,b)=>sum+b.size,0)!==engine.resources.totalOwnedBytes)throw Error('Combined raw/world allocation accounting mismatch');
  const guard=(generation)=>{alive();if(!active||active.generation!==generation||active.cancelled)throw Error('Stale or cancelled GPU generation');};
  const drain=async()=>{const work=pending.splice(0);const results=await Promise.allSettled(work);const failure=results.find(x=>x.status==='rejected');if(failure)throw failure.reason;};
  const releaseExternal=()=>{if(rawEngine)return;externalGroups.dispose();externalGroups=createLiveWorldRunBindGroups(device);for(let i=0;i<plan.allocations.length;i++)if(plan.allocations[i].external)buffers[i]=null;};
  const submit=async (encoder,generation)=>{
   alive();while(pending.length>=maxInFlight)await pending.shift();
   guard(generation);device.queue.submit([encoder.finish()]);
   const done=Promise.race([device.queue.onSubmittedWorkDone(),loss]);done.catch(lose);pending.push(done);
  };
  const exclusive=async (fn,after)=>{if(busy)throw Error('Concurrent GPU bridge operation');busy=true;try{const result=await scoped(fn);return after?after(result):result;}finally{busy=false;}};

  return Object.freeze({commandCount:commands.length,rawCommandCount:rawCommands.length,worldCommandCount:worldCommands.length,ownsRaw:!!rawEngine,count,experimental:true,productionEnabled:false,requiresExclusiveDevice:true,
   async beginRun({generation,initialUploads,externalBuffers,rawUploads,candidateIds}={}){return exclusive(async()=>{
    alive();if(active)throw Error('Prior GPU run must finish or cancel and drain');await drain();alive();
    if(!Number.isSafeInteger(generation)||generation<=lastGeneration||generation>0xffffffff)throw RangeError('Fresh positive u32 generation required');
    if(!(candidateIds instanceof Uint32Array)||candidateIds.length!==count||new Set(candidateIds).size!==count)throw TypeError('Distinct candidate IDs required');
    if(!Array.isArray(initialUploads))throw TypeError('Complete owned arena uploads required');
    const uploads=new Map();
    for(const u of initialUploads){if(!Number.isInteger(u?.index)||u.index<0||u.index>=buffers.length||plan.allocations[u.index].external||uploads.has(u.index)||!(u.initial instanceof Uint8Array)||u.initial.byteLength!==buffers[u.index].size)throw TypeError('Exact unique internal arena upload required');uploads.set(u.index,u.initial.slice());}
    if(uploads.size!==plan.allocations.filter(a=>!a.external).length)throw Error('Every internal arena must be reset');
    let rawReset;
    if(rawEngine){
     if(externalBuffers!==undefined||!Array.isArray(rawUploads))throw TypeError('Owned raw mode requires rawUploads, not external buffers');
     rawReset=new Map();for(const u of rawUploads){if(!Number.isInteger(u?.index)||u.index<0||u.index>=rawBuffers.length||rawReset.has(u.index)||!(u.initial instanceof Uint8Array)||u.initial.byteLength!==rawBuffers[u.index].size)throw TypeError('Exact unique full raw arena upload required');rawReset.set(u.index,u.initial.slice());}
     if(rawReset.size!==rawBuffers.length)throw Error('Every raw arena must be reset');
    }else{
     if(rawUploads!==undefined)throw TypeError('External mode does not accept raw uploads');
     const next=[];for(let i=0;i<plan.allocations.length;i++){const a=plan.allocations[i];if(!a.external)continue;const b=externalBuffers?.[a.external];if(!b||b.size!==a.size*count||!(b.usage&128))throw TypeError('Genuine exact-size raw storage buffer required: '+a.external);if(owned.includes(b))throw Error('External raw output aliases bridge storage');next.push([i,b]);}
     if(next.length!==2||next[0][1]===next[1][1])throw Error('Distinct prepared/status outputs required');
     if(next.some(([i,b])=>buffers[i]!==b))releaseExternal();for(const [i,b]of next)buffers[i]=b;
    }
    if(rawReset)for(const [i,bytes]of rawReset)device.queue.writeBuffer(rawBuffers[i],0,bytes);
    for(const [i,bytes]of uploads)device.queue.writeBuffer(buffers[i],0,bytes);
    device.queue.writeBuffer(fault,0,new Uint32Array(count));device.queue.writeBuffer(ids,0,candidateIds.slice());
    lastGeneration=generation;active={generation,cursor:0,cancelled:false};return generation;
   });},
   async encodeChunk(handles,generation){return exclusive(async()=>{
    guard(generation);if(!(handles instanceof Uint32Array)||handles.length<1||handles.length>4096)throw RangeError('Bounded owned u32 command chunk required');
    const copy=handles.slice(),start=active.cursor;
    for(let i=0;i<copy.length;i++)if(copy[i]!==start+i+1||copy[i]>commands.length)throw Error('Exact ordered command handles required');
    const encoder=device.createCommandEncoder();
    for(const handle of copy){
     const isRaw=handle<=rawCommands.length,c=commands[handle-1];
     if(c.kind==='clear'){if(isRaw)throw Error('Unsupported raw clear command');encodeWasmGpuClear(encoder,buffers[c.buffer],c,plan.allocations[c.buffer].size,count);continue;}
     if(c.kind!=='dispatch')throw Error('Unsupported command');
     const bank=isRaw?rawBuffers:buffers,p=(isRaw?rawPipelines:pipelines)[c.definition],entries=c.entries.map(e=>({binding:e.binding,resource:{buffer:bank[e.buffer],offset:e.offset,size:e.size}}));
     if(!isRaw){const binding=lowered.definitions[c.definition].faultBinding;if(binding!==null)entries.push({binding,resource:{buffer:fault}});}
     const cache=!rawEngine&&!isRaw&&c.entries.some(e=>plan.allocations[e.buffer].external)?externalGroups:internalGroups;
     const pass=encoder.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,cache.get(p,entries));pass.dispatchWorkgroups(c.x,isRaw?1:count,1);pass.end();
    }
    await submit(encoder,generation);guard(generation);active.cursor+=copy.length;return active.cursor;
   });},
   async finish(generation){return exclusive(async()=>{
    guard(generation);if(active.cursor!==commands.length)throw Error('Incomplete GPU command schedule');
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(gate);pass.setBindGroup(0,internalGroups.get(gate,[fault,buffers[plan.readback],ids].map((buffer,binding)=>({binding,resource:{buffer}}))));pass.dispatchWorkgroups(count);pass.end();
    for(let i=0;i<count;i++)encoder.copyBufferToBuffer(buffers[plan.readback],(i*stride+stride-4)*4,read,i*16,16);
    await submit(encoder,generation);await drain();guard(generation);let mapped=false;
    try{await Promise.race([read.mapAsync(1),loss]);mapped=true;guard(generation);const result=new Uint32Array(read.getMappedRange()).slice();return result;}finally{if(mapped)read.unmap();}
   },result=>{guard(generation);active=null;releaseExternal();return result;});},
   cancel(generation){if(active?.generation===generation)active.cancelled=true;},
   async drain(){return exclusive(async()=>{try{await drain();}finally{if(active?.cancelled){active=null;releaseExternal();}}});},
   lose,
   async dispose(){return exclusive(async()=>{if(disposed)return;try{await drain();}finally{disposed=true;active=null;externalGroups.dispose();internalGroups.dispose();for(const b of owned)b.destroy();buffers.length=0;rawBuffers.length=0;owned.length=0;pipelines.length=0;rawPipelines.length=0;fault=null;ids=null;read=null;}});},
  });
 },true);checkPrepare();return prepared;}catch(error){externalGroups.dispose();internalGroups.dispose();for(const b of owned)b.destroy();buffers.length=0;rawBuffers.length=0;owned.length=0;throw error;}
}
