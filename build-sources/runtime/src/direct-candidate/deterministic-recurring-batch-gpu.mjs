/** True candidate-parallel prepared recurrence. One phase bank, y = candidate.
 * No readback or host physics between phases; immutable geometry is shared.
 */
import {verifyRecurringBatchSources} from './deterministic-recurring-batch-audit.mjs';
import {recurringBatchPhaseSpecs} from './deterministic-recurring-batch-phases.mjs';
import {snapshotRecurringBatch,batchEnvelope,checkCancelled,ownedWords,RECURRING_DIAGNOSTIC_WORDS} from './deterministic-recurring-batch.mjs';
import {validateCushionHull} from './deterministic-cushion-geometry.mjs';
import {packLandingChainCloth} from './deterministic-landing-chain.mjs';
import {packTubePrefixContext} from './deterministic-tube-prefix.mjs';
import {packRollingTailScene} from './deterministic-rolling-tail.mjs';
const Q=2**24;
export const RECURRING_BATCH_ALLOCATION_LIMIT_BYTES=256*1024*1024;
const COMPACT_WGSL=`@group(0) @binding(0) var<storage,read> state:array<u32>;@group(0) @binding(1) var<storage,read_write> output:array<u32>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let i=id.x;let b=i*256u;if(b>=arrayLength(&state)){return;}let o=i*4u;output[o]=state[b];output[o+1u]=state[b+1u];output[o+2u]=state[b+2u];output[o+3u]=select(0u,1u,state[b+1u]==9u);}`;
const DIAGNOSTIC_WGSL=`@group(0) @binding(0) var<storage,read> state:array<u32>;@group(0) @binding(1) var<storage,read> dense:array<u32>;@group(0) @binding(2) var<storage,read> path:array<u32>;@group(0) @binding(3) var<storage,read> tail:array<u32>;@group(0) @binding(4) var<storage,read> refined:array<u32>;@group(0) @binding(5) var<storage,read_write> output:array<u32>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let c=id.y;let i=id.x;let o=c*2096u;if(i<256u){output[o+i]=state[c*256u+i];output[o+256u+i]=dense[c*256u+i];output[o+512u+i]=path[c*256u+i];}if(i<272u){output[o+768u+i]=tail[c*272u+i];}if(i<1056u){output[o+1040u+i]=refined[c*1056u+i];}}`;
export async function createRecurringBatchGPU(device,hulls,{bodyCount=4}={}){
 if(!Array.isArray(hulls)||hulls.length!==4||hulls.some(x=>!ownedWords(x)))throw TypeError('Owned actual hull assets');const assets=hulls.map(x=>x.slice());assets.forEach(validateCushionHull);
 const specs=recurringBatchPhaseSpecs(bodyCount),codes=[...specs.map(x=>x.code),COMPACT_WGSL,DIAGNOSTIC_WGSL],pipelines=[],start=performance.now();
 await verifyRecurringBatchSources(specs);
 const smoothLayout=device.createBindGroupLayout({entries:[0,1,2,3].map(binding=>({binding,visibility:4,buffer:{type:binding===0?'read-only-storage':'storage'}}))});
 const smoothPipelineLayout=device.createPipelineLayout({bindGroupLayouts:[smoothLayout]});
 device.pushErrorScope('validation');
 try{const modules=codes.map((code,i)=>device.createShaderModule({code,label:`prepared batch phase ${i}`}));for(let i=0;i<modules.length;i++){const info=await modules[i].getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(`Batch WGSL preflight phase ${i}: `+info.messages.map(x=>x.message).join('\n'));}for(let i=0;i<modules.length;i++)pipelines.push(await device.createComputePipelineAsync({layout:specs[i]?.smooth?smoothPipelineLayout:'auto',compute:{module:modules[i],entryPoint:'main'}}));}
 finally{const e=await device.popErrorScope();if(e)throw Error(e.message);}
 return {compileMs:performance.now()-start,shaderBytes:codes.map(x=>new TextEncoder().encode(x).length),async run(original,scene,options){
  const p=snapshotRecurringBatch(original,scene,options),{rows,count,signal}=p,sc=p.scene,o=p.options;
  if(sc[1]!==bodyCount)throw RangeError('Factory bodyCount must match immutable scene');
  if(count>device.limits.maxComputeWorkgroupsPerDimension)throw RangeError('Candidate dispatch dimension exceeds device limit');
  const setup=packLandingChainCloth(sc,{...o,cycles:1});setup.config[5]=o.tailMaxNodes;
  for(let i=0;i<count;i++)if(rows[i*96+8]!==setup.cloth[8])throw RangeError('One immutable cloth restitution');
  const context=packTubePrefixContext(sc,assets,setup.options);context[14]=setup.config[4];const recurContext=context.slice();recurContext[13]=o.executionProfile==='canonical-local-v1'?1:0;
  const c=new Int32Array(context.buffer),s=new Int32Array(sc.buffer),tailScene=packRollingTailScene({provenance:'actual-finite-table-roster',hulls:assets,staticBounds:Array.from({length:sc[16]},(_,i)=>Array.from(s.slice(32+i*6,38+i*6),x=>x/Q)),clothTop:c[8]/Q,clothFootprint:Array.from(c.slice(9,13),x=>x/Q)});
  const predictedBytes=count*(49640+bodyCount*256+(o.diagnostic==='all-words'?16768:0))+1248+tailScene.byteLength;
  if(predictedBytes>RECURRING_BATCH_ALLOCATION_LIMIT_BYTES)throw RangeError('Batch exceeds bounded 256 MiB allocation budget');
  let allocatedBytes=0;
  const buffers=[],alloc=(words,shared=false,usage=128|4|8)=>{const size=words*4*(shared?1:count);if(size>device.limits.maxBufferSize||(usage&128)&&size>device.limits.maxStorageBufferBindingSize)throw RangeError('Batch exceeds device storage allocation limits');if(allocatedBytes+size>RECURRING_BATCH_ALLOCATION_LIMIT_BYTES)throw RangeError('Batch exceeds bounded 256 MiB allocation budget');const b=device.createBuffer({size,usage});buffers.push(b);allocatedBytes+=size;return b;};
  try{
   const input=alloc(96),sceneBuffer=alloc(128,true),ctx=alloc(160),rctx=alloc(160,true),config=alloc(8,true),cloth=alloc(16,true),tailAsset=alloc(tailScene.length,true);
   const source=alloc(256),contacts=alloc(64),response=alloc(128),initialRows=alloc(256),initialState=alloc(256),initialDense=alloc(256),initialSmooth=alloc(256),initialScratch=alloc(256),initialCells=alloc(512),landingRows=alloc(128),landingRoots=alloc(256),landingResult=alloc(384),landState=alloc(256),landDense=alloc(256),landRows=alloc(256),landSmooth=alloc(256),landScratch=alloc(256),landCells=alloc(512);
   const contexts=new Uint32Array(160*count);for(let i=0;i<count;i++)contexts.set(context,i*160);
   for(const [buffer,data]of [[input,rows],[sceneBuffer,sc],[ctx,contexts],[rctx,recurContext],[config,setup.config],[cloth,setup.cloth],[tailAsset,tailScene]])device.queue.writeBuffer(buffer,0,data);
   const encoder=device.createCommandEncoder();let dispatches=0,clears=0;
   const dispatch=(index,list,x=1,y=count)=>{const group=device.createBindGroup({layout:specs[index]?.smooth?smoothLayout:pipelines[index].getBindGroupLayout(0),entries:list.map((buffer,binding)=>({binding,resource:{buffer}}))}),pass=encoder.beginComputePass();pass.setPipeline(pipelines[index]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(x,y);pass.end();dispatches++;};
   const initialLists=[[input,sceneBuffer,source],[source,sceneBuffer],[source,sceneBuffer,contacts],[contacts,response],[source,response],[source,response,ctx,initialRows,initialState,initialDense],[initialRows,initialSmooth,initialScratch,initialCells],[initialRows,initialSmooth,initialScratch,initialCells],[initialRows,initialSmooth,initialScratch,initialCells],[initialState,initialDense,initialSmooth,ctx]];
   initialLists.forEach((v,i)=>dispatch(i,v));dispatch(10,[initialState,ctx,config,landingRows]);dispatch(11,[landingRows,cloth,landingRoots]);dispatch(12,[initialState,initialDense,landingRoots,ctx,landState,landDense,landRows]);for(let i=6;i<=8;i++)dispatch(i,[landRows,landSmooth,landScratch,landCells]);dispatch(9,[landState,landDense,landSmooth,ctx]);dispatch(13,[landingRoots,landingResult]);dispatch(14,[landState,landDense,landingResult]);
   const states=[alloc(256),alloc(256)],dense=[alloc(256),alloc(256)],probeRows=alloc(256),proposed=alloc(256),probeScratch=alloc(256),probeCells=alloc(512),bridgeProbeRows=alloc(256),bridgeProbes=alloc(512),combinedRows=alloc(640),actualSmooth=alloc(256),actualScratch=alloc(256),actualCells=alloc(512),bridges=alloc(512),rolling=alloc(512),path=alloc(256),tailRows=alloc(bodyCount*32),tailBounds=alloc(bodyCount*32),tail=alloc(272),refConfig=alloc(2),refined=alloc(1056),compact=alloc(4);
   let previous=landState,oldDense=landDense;
   for(let iteration=0;iteration<o.maxPrefixes;iteration++){
    const next=states[iteration%2],nextDense=dense[iteration%2];
    for(const b of [proposed,probeScratch,probeCells,bridgeProbes,actualSmooth,actualScratch,actualCells,bridges,rolling]){encoder.clearBuffer(b);clears++;}
    dispatch(15,[previous,oldDense,rctx,probeRows]);for(let attempt=0;attempt<16;attempt++)for(let i=6;i<=8;i++)dispatch(i,[probeRows,proposed,probeScratch,probeCells]);
    dispatch(16,[probeRows,proposed,bridgeProbeRows]);dispatch(17,[bridgeProbeRows,bridgeProbes]);dispatch(18,[previous,oldDense,proposed,bridgeProbes,rctx,next,nextDense,combinedRows]);
    for(let i=29;i<=31;i++)dispatch(i,[combinedRows,actualSmooth,actualScratch,actualCells]);dispatch(32,[combinedRows,bridges]);dispatch(19,[next,combinedRows,rolling],4);
    dispatch(20,[next,nextDense,bridges,rolling,actualSmooth]);dispatch(33,[next,nextDense,actualSmooth,rctx]);dispatch(21,[previous,oldDense,rctx,next,nextDense,bridges,rolling,path]);
    dispatch(22,[next,nextDense,rctx,tailRows]);dispatch(23,[tailRows,tailAsset,tail]);dispatch(26,[next,tail,config,refConfig]);dispatch(28,[tailRows,tailBounds],bodyCount);dispatch(27,[tailRows,tailAsset,refConfig,refined,tailBounds]);dispatch(24,[next,nextDense,tail,rctx,refined]);previous=next;oldDense=nextDense;
   }
   dispatch(25,[previous]);dispatch(34,[previous,compact],Math.ceil(count/32),1);
   const read=alloc(4,false,1|8);encoder.copyBufferToBuffer(compact,0,read,0,count*16);
   let diagnosticRead;if(o.diagnostic==='all-words'){const diagnostic=alloc(RECURRING_DIAGNOSTIC_WORDS);diagnosticRead=alloc(RECURRING_DIAGNOSTIC_WORDS,false,1|8);dispatch(35,[previous,oldDense,path,tail,refined,diagnostic],33);encoder.copyBufferToBuffer(diagnostic,0,diagnosticRead,0,count*RECURRING_DIAGNOSTIC_WORDS*4);}
   if(allocatedBytes!==predictedBytes)throw Error('Batch allocation manifest drift');
   checkCancelled(signal);const began=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();checkCancelled(signal);
   const reads=diagnosticRead?[read,diagnosticRead]:[read];const mapped=await Promise.allSettled(reads.map(b=>b.mapAsync(1)));for(const r of mapped)if(r.status==='rejected')throw r.reason;checkCancelled(signal);
   const compactWords=new Uint32Array(read.getMappedRange()).slice(),words=diagnosticRead?new Uint32Array(diagnosticRead.getMappedRange()).slice():undefined;reads.forEach(b=>b.unmap());checkCancelled(signal);
   return {compact:compactWords,...(words?{words}:{}),envelope:batchEnvelope(count,o),metrics:{candidateCount:count,allocatedBytes:buffers.reduce((n,b)=>n+b.size,0),sharedImmutableBytes:sceneBuffer.size+rctx.size+config.size+cloth.size+tailAsset.size,dispatches,bufferClears:clears,submissions:1,intermediateReadbacks:0,hostPhysicsBetweenPhases:0,readbackBytes:count*(16+(words?RECURRING_DIAGNOSTIC_WORDS*4:0)),candidateDispatchAxis:'y',submitToDoneMs:performance.now()-began}};
  }finally{buffers.forEach(b=>b.destroy());}
 }};
}
