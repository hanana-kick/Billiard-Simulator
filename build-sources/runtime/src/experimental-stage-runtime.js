/* SPDX-License-Identifier: Apache-2.0
 * Reimplemented 2026: actual scalar WGSL interpreter for arithmetic graphs.
 * This is instruction transport, not a contact/island or complete world solver.
 */
(function(G){'use strict';
const Graph=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph.js'):G.LabArithmeticGraphExperimental;
function shaderForInputFloats(inputFloats){if(!Number.isInteger(inputFloats)||inputFloats<1||inputFloats>Graph.MAX_INPUTS)throw RangeError('Invalid graph input stride');const width=inputFloats+'u',cases=Graph.OPERATIONS.slice(1).map((op,i)=>`case ${i+1}u:{${op.wgsl}}`).join('\n');return `
@group(0) @binding(0) var<storage,read> inputs:array<f32>;
@group(0) @binding(1) var<storage,read> program:array<vec4<u32>>;
@group(0) @binding(2) var<storage,read_write> scratch:array<f32>;
@group(0) @binding(3) var<storage,read> result_indices:array<u32>;
@group(0) @binding(4) var<storage,read_write> outputs:array<f32>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let count=arrayLength(&inputs)/${width};if(id.x>=count){return;}
 if(arrayLength(&outputs)/count<arrayLength(&result_indices)+1u){return;}
 outputs[id.x*(arrayLength(&result_indices)+1u)+arrayLength(&result_indices)]=0.0;
 if(arrayLength(&inputs)%${width}!=0u){return;}
 if(arrayLength(&scratch)/count<${width}+arrayLength(&program)){return;}
 for(var i=0u;i<${width};i++){let value=inputs[id.x*${width}+i];if((bitcast<u32>(value)&0x7f800000u)==0x7f800000u){return;}scratch[i*count+id.x]=value;}
 for(var i=0u;i<arrayLength(&program);i++){
  let ins=program[i];var result=0.0;
  if(ins.x==0u){${Graph.OPERATIONS[0].wgsl}}else{
   if(ins.y>=${width}+i||ins.z>=${width}+i){return;}
   if(ins.x==10u&&ins.w>=${width}+i){return;}
   let a=scratch[ins.y*count+id.x];let b=scratch[ins.z*count+id.x];
   if(ins.x==4u&&b==0.0){return;}
   if(ins.x==7u&&a<0.0){return;}
   switch ins.x{
    ${cases}
    default:{return;}
   }
  }
  if((bitcast<u32>(result)&0x7f800000u)==0x7f800000u){return;}
  scratch[(${width}+i)*count+id.x]=result;
 }
 for(var i=0u;i<arrayLength(&result_indices);i++){
  if(result_indices[i]>=${width}+arrayLength(&program)){return;}
  outputs[id.x*(arrayLength(&result_indices)+1u)+i]=scratch[result_indices[i]*count+id.x];
 }
 outputs[id.x*(arrayLength(&result_indices)+1u)+arrayLength(&result_indices)]=1.0;
}`;}
// One device-loss observer per GPUDevice. Scratch generations belong to one
// stage only: no global buffer pool, cross-stage aliasing, or cross-device reuse.
const DEVICE_STATES=new WeakMap(),SCOPED_DEVICES=new WeakMap();
const PIPELINE_CACHE_LIMIT=16;
function createPlanBatchScope(device,options={}){
 if(SCOPED_DEVICES.has(device))throw TypeError('Nested arithmetic batch device scopes are not supported');
 const Scheduler=typeof module!=='undefined'&&module.exports?require('./experimental-plan-batch-scheduler.js'):G.LabPlanBatchSchedulerExperimental;
 if(!Scheduler)throw Error('Arithmetic plan batch scheduler module is required');
 const state=Scheduler.createScopeState(device,options);
 return Object.freeze({createDevice(ownerId){const facade=state.createDevice(ownerId);SCOPED_DEVICES.set(facade,(plan,options)=>state.createResidentGraph(facade,plan,options));return facade;},beginRound:state.beginRound,endRoundOwner:state.endRoundOwner,finishRound:state.finishRound,flush:state.flush,cancelOwner:state.cancelOwner,cancel:state.cancel,snapshot:state.snapshot,dispose:state.dispose});
}
function deviceState(device){
 let state=DEVICE_STATES.get(device);if(state)return state;
 let rejectLoss;const lost=new Promise((_,reject)=>{rejectLoss=reject;});lost.catch(()=>{});
 state={loss:null,lost,owners:new Set(),pipelines:new Map(),pipelineCreations:0};DEVICE_STATES.set(device,state);
 if(device.lost&&typeof device.lost.then==='function')Promise.resolve(device.lost).then(info=>{
  state.loss=Error('Arithmetic GPU device lost: '+String(info?.message??info?.reason??'unknown'));
  state.pipelines.clear();rejectLoss(state.loss);for(const stop of [...state.owners])stop(state.loss);state.owners.clear();
 },error=>{
  state.loss=Error('Arithmetic GPU device lost: '+String(error?.message??error));
  state.pipelines.clear();rejectLoss(state.loss);for(const stop of [...state.owners])stop(state.loss);state.owners.clear();
 });
 return state;
}
// The cache owns only immutable compilation results/promises. Graph programs,
// buffers, bind groups, validation scopes and cancellation remain stage-local.
// Exact passed device identity is intentional: never unwrap proxy/facade devices.
async function compilePipeline(device,state,code,label){
 if(state.loss)throw state.loss;
 const module=device.createShaderModule({code,label});
 const info=await Promise.race([module.getCompilationInfo(),state.lost]);
 if(state.loss)throw state.loss;
 const errors=info.messages.filter(m=>m.type==='error');
 if(errors.length)throw Error('Arithmetic WGSL compilation failed: '+errors.map(m=>m.message).join('\n'));
 const pipeline=await Promise.race([device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),state.lost]);
 if(state.loss)throw state.loss;
 return pipeline;
}
function reusablePipeline(device,state,code,label){
 // Include the diagnostic module label too: callers requesting distinct module
 // descriptors do not silently receive the first caller's label.
 const key=JSON.stringify([code,label,'auto','main']);
 const cached=state.pipelines.get(key);
 if(cached){state.pipelines.delete(key);state.pipelines.set(key,cached);return cached;}
 if(state.pipelineCreations>=PIPELINE_CACHE_LIMIT)return Promise.reject(RangeError('Arithmetic pipeline cache concurrent compilation limit (16) reached'));
 // Pending entries count toward the bound. Eviction drops only cache ownership;
 // it never cancels compilation or disrupts a stage already awaiting that entry.
 while(state.pipelines.size>=PIPELINE_CACHE_LIMIT)state.pipelines.delete(state.pipelines.keys().next().value);
 state.pipelineCreations++;
 const ready=compilePipeline(device,state,code,label).finally(()=>{state.pipelineCreations--;});state.pipelines.set(key,ready);
 ready.catch(()=>{if(state.pipelines.get(key)===ready)state.pipelines.delete(key);});
 return ready;
}
function abortError(){const error=Error('Arithmetic GPU dispatch cancelled');error.name='AbortError';return error;}
function rowStatusError(message){const error=Error(message);error.code='ARITHMETIC_GPU_ROW_STATUS';return error;}
/**
 * Reuses actual GPU input/scratch/output/readback storage, not CPU arithmetic.
 * The unchanged shader still executes one dispatch and one readback per run.
 * Every storage binding uses its logical byte range. Binding capacity instead
 * would change arrayLength(&inputs), row count, and scratch indexing in WGSL.
 */
async function createResidentGraph(device,plan,{maxRows=256,label='resident arithmetic',reusePipelines=false}={}){
 if(typeof reusePipelines!=='boolean')throw TypeError('reusePipelines must be boolean');
 const scoped=SCOPED_DEVICES.get(device);if(scoped){if(reusePipelines)throw TypeError('Pipeline reuse is not supported on arithmetic batch device scopes');return scoped(plan,{maxRows,label});}
 if(reusePipelines&&typeof label!=='string')throw TypeError('Pipeline reuse requires a string label');
 if(!device||typeof device.createShaderModule!=='function')throw TypeError('An actual GPUDevice is required');
 Graph.validatePlan(plan);
 if(!plan.nodes.length)throw RangeError('Resident arithmetic requires a nonempty program');
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>512)throw RangeError('Bounded 1..512 row capacity required');
 // Freeze the wire layout at construction; later caller edits cannot change it.
 const inputFloats=plan.inputFloats,nodeCount=plan.nodes.length,outputFloats=plan.outputs.length;
 const program=Graph.encode(plan),indices=Uint32Array.from(plan.outputs),stride=outputFloats+1;
 const widths=[inputFloats*4,(inputFloats+nodeCount)*4,stride*4,stride*4];
 const limit=device.limits?.maxStorageBufferBindingSize??Infinity,bufferLimit=device.limits?.maxBufferSize??Infinity;
 if([program.byteLength,indices.byteLength,...widths.slice(0,3)].some(n=>n>limit)||[program.byteLength,indices.byteLength,...widths].some(n=>n>bufferLimit))throw RangeError('Arithmetic graph exceeds device storage limits');
 const state=deviceState(device),owned=new Set(),counts={buffersCreated:0,buffersDestroyed:0,generations:0,bindGroupsCreated:0,dispatches:0,readbacks:0,reuses:0};
 let generation=null,pipeline=null,pb=null,ib=null,busy=false,disposed=false,loss=state.loss,interrupt=null;
 const make=(size,usage,suffix)=>{const b=device.createBuffer({size,usage,label:label+' '+suffix});owned.add(b);counts.buffersCreated++;return b;};
 const destroy=b=>{if(owned.has(b)){b.destroy();owned.delete(b);counts.buffersDestroyed++;}};
 const release=buffers=>{let error=null;for(const b of buffers)try{destroy(b);}catch(e){error??=e;}if(error)throw error;};
 const retire=()=>{if(generation){const old=generation;generation=null;old.groups.clear();release(old.buffers);}};
 const stop=error=>{loss=error;interrupt?.(error);try{retire();}catch(e){error.cleanupError??=e;}try{release([...owned]);}catch(e){error.cleanupError??=e;}};
 const available=()=>{if(loss||state.loss)throw loss??state.loss;if(disposed)throw Error('Arithmetic GPU stage disposed');};
 state.owners.add(stop);
 const pop=()=>Promise.resolve(device.popErrorScope());
 try{
  available();const code=shaderForInputFloats(inputFloats);
  try{pipeline=await (reusePipelines?reusablePipeline(device,state,code,label):compilePipeline(device,state,code,label));}
  catch(error){
   if(!reusePipelines)throw error;
   // Each waiter receives its own error for owner-local cleanup annotations.
   const isolated=Error(error.message,{cause:error});isolated.name=error.name;if(error.code!==undefined)isolated.code=error.code;throw isolated;
  }
  available();
  let scoped=false,scope;
  try{device.pushErrorScope('validation');scoped=true;pb=make(program.byteLength,136,'program');ib=make(indices.byteLength,136,'indices');device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);}
  finally{if(scoped){scope=pop();scope.catch(()=>{});}}
  const initError=await Promise.race([scope,state.lost]);if(initError)throw Error(initError.message);available();
 }catch(error){state.owners.delete(stop);try{release([...owned]);}catch(e){error.cleanupError??=e;}throw error;}
 function reserve(rows){
  if(generation&&generation.capacity>=rows){counts.reuses++;return generation;}
  let capacity=1;while(capacity<rows)capacity=Math.min(maxRows,capacity*2);
  // A legal logical row count must remain legal when geometrically grown.
  const allowed=Math.min(maxRows,...widths.slice(0,3).map(w=>Math.floor(limit/w)),...widths.map(w=>Math.floor(bufferLimit/w)));
  capacity=Math.min(capacity,allowed);if(capacity<rows)throw RangeError('Arithmetic batch exceeds device storage limits');
  const buffers=[];try{[136,128,140,9].forEach((usage,i)=>buffers.push(make(widths[i]*capacity,usage,['input','scratch','output','readback'][i])));}
  catch(error){try{release(buffers);}catch(e){error.cleanupError??=e;}throw error;}
  retire();generation={capacity,buffers,groups:new Map(),id:++counts.generations};return generation;
 }
 function groupFor(g,rows){
  if(g.groups.has(rows))return g.groups.get(rows);
  const [source,scratch,output]=g.buffers,buffers=[source,pb,scratch,ib,output];
  const sizes=[rows*widths[0],program.byteLength,rows*widths[1],indices.byteLength,rows*widths[2]];
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer,offset:0,size:sizes[binding]}}))});
  g.groups.set(rows,group);counts.bindGroupsCreated++;return group;
 }
 return Object.freeze({
  async run(packed,{signal}={}){
   available();if(busy)throw Error('Arithmetic GPU stage busy');
   if(!(packed instanceof Float32Array)||Object.prototype.toString.call(packed.buffer)==='[object SharedArrayBuffer]'||packed.length%inputFloats!==0||packed.length/inputFloats>maxRows)throw RangeError('Owned bounded Float32Array arithmetic rows required');
   if(signal&&(!('aborted'in signal)||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');
   if(signal?.aborted)throw abortError();
   // Copy synchronously, before the first await, including byte-offset views.
   const input=new Float32Array(packed),rows=input.length/inputFloats;
   if(input.some(x=>!Number.isFinite(x)))throw RangeError('Finite arithmetic input required');
   if(!rows)return new Float32Array(0);
   busy=true;let g=null,mapping=null,scope=null,scoped=false,success=false,failure=null,rejectStop;
   const stopped=new Promise((_,reject)=>{rejectStop=reject;});
   // Attach the handler immediately, including synchronous setup failures.
   stopped.catch(()=>{});
   interrupt=error=>{rejectStop(error);try{retire();}catch(e){error.cleanupError??=e;}};
   const onAbort=()=>interrupt?.(abortError());
   try{
    signal?.addEventListener('abort',onAbort,{once:true});
    available();if(signal?.aborted)throw abortError();
    device.pushErrorScope('validation');scoped=true;
    try{
     g=reserve(rows);const [source,,output,read]=g.buffers,size=rows*widths[2],group=groupFor(g,rows);
     device.queue.writeBuffer(source,0,input);
     const encoder=device.createCommandEncoder();
     // An incomplete/invalid dispatch can never reuse a prior success marker.
     encoder.clearBuffer(output,0,size);
     const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows/32));pass.end();
     encoder.copyBufferToBuffer(output,0,read,0,size);device.queue.submit([encoder.finish()]);counts.dispatches++;
     mapping=Promise.resolve(read.mapAsync(1,0,size));mapping.catch(()=>{});
    }finally{
     // Pop synchronously, before yielding. Other stages on this device cannot
     // nest their async validation scopes inside this stage's scope.
     if(scoped){scoped=false;scope=pop();scope.catch(()=>{});}
    }
    const [,error]=await Promise.race([Promise.all([mapping,scope]),stopped]);
    available();if(signal?.aborted)throw abortError();if(error)throw Error(error.message);
    const read=g.buffers[3],raw=new Float32Array(read.getMappedRange(0,rows*widths[2]).slice(0));read.unmap();counts.readbacks++;
    for(let row=0;row<rows;row++)if(raw[row*stride+outputFloats]!==1)throw rowStatusError('Incomplete arithmetic GPU dispatch');
    if(raw.some(x=>!Number.isFinite(x)))throw rowStatusError('Non-finite arithmetic GPU output');
    success=true;return raw;
   }catch(error){failure=error;throw error;}finally{
    let cleanupError=null;
    try{
     try{signal?.removeEventListener('abort',onAbort);}catch(e){cleanupError=e;}interrupt=null;
     if(!success){try{g?.buffers[3].unmap();}catch(e){cleanupError=e;}try{retire();}catch(e){cleanupError??=e;}try{release([...owned].filter(b=>b!==pb&&b!==ib));}catch(e){cleanupError??=e;}}
    }finally{busy=false;}
    if(cleanupError){if(failure)failure.cleanupError??=cleanupError;else throw cleanupError;}
   }
  },
  snapshot(){return Object.freeze({...counts,capacity:generation?.capacity??0,cachedBindGroups:generation?.groups.size??0,liveBuffers:owned.size,liveBytes:[...owned].reduce((n,b)=>n+b.size,0),busy,disposed,deviceLost:!!(loss||state.loss)});},
  dispose(){if(busy)throw Error('Cannot dispose a busy arithmetic GPU stage');disposed=true;state.owners.delete(stop);let error=null;try{retire();}catch(e){error=e;}try{release([...owned]);}catch(e){error??=e;}if(error)throw error;}
 });
}
// Retained for callers with the old 136-float stage wire layout. New callers
// should request a shader with an explicit input stride instead of replacement.
const WGSL=shaderForInputFloats(136),api=Object.freeze({OPS:Graph.OPS,WGSL,shaderForInputFloats,createResidentGraph,createPlanBatchScope});G.LabStageRuntimeExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
