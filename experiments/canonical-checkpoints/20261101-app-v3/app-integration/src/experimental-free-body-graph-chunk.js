/* SPDX-License-Identifier: Apache-2.0
 * Bounded experimental free-body command-buffer recurrence, 2026.
 * Transport only: the existing source graph and arithmetic shader are unchanged.
 * Not a whole-world solver or a production caller. No contact/CCD/activation.
 */
(function(G){'use strict';
const Free=typeof module!=='undefined'&&module.exports?require('./experimental-free-body'):G.LabFreeBodyExperimental;
const Graph=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const Runtime=typeof module!=='undefined'&&module.exports?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental;
const LIMITS=Object.freeze({maxRows:16,maxSteps:32,maxBytes:32*1024*1024,maxInstructions:4000000,wholeWorld:false});
// Existing controller's Object.assign(body, decode(output).body), then pack:
// worldCom is decoded but not a graph input; mass/localCOM/principal properties,
// force/torque/gravity/parameters stay immutable. decode canonicalizes -0.
const CARRY=Object.freeze([...Array.from({length:13},(_,i)=>[i,i]),...Array.from({length:9},(_,i)=>[19+i,13+i])].map(Object.freeze));
function carryShader(stride){return `
@group(0) @binding(0) var<storage,read> output:array<u32>;
@group(0) @binding(1) var<storage,read_write> input:array<u32>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let rows=arrayLength(&input)/68u;if(id.x>=rows){return;}
 let base=id.x*${stride}u;
 if(output[base+${stride-1}u]!=0x3f800000u){return;}
 for(var i=0u;i<${stride-1}u;i++){if((output[base+i]&0x7f800000u)==0x7f800000u){return;}}
 ${CARRY.map(([to,from])=>`{let bits=output[base+${from}u];input[id.x*68u+${to}u]=select(bits,0u,(bits&0x7fffffffu)==0u);}`).join('\n')}
}`;}
function bounded(plan,rows,steps,device){
 if(!Number.isSafeInteger(rows)||rows<1||rows>LIMITS.maxRows||!Number.isSafeInteger(steps)||steps<1||steps>LIMITS.maxSteps)throw RangeError('Bounded nonempty rows and steps required');
 const sizes=[plan.nodes.length*16,plan.outputs.length*4,rows*68*4,rows*(68+plan.nodes.length)*4,rows*(plan.outputs.length+1)*4,rows*(plan.outputs.length+1)*4*steps];
 if(rows*steps*plan.nodes.length>LIMITS.maxInstructions||sizes.reduce((a,b)=>a+b,0)>LIMITS.maxBytes)throw RangeError('Chunk instruction or byte budget exceeded');
 if(sizes.some(n=>n>(device?.limits?.maxBufferSize??Infinity))||sizes.slice(0,5).some(n=>n>(device?.limits?.maxStorageBufferBindingSize??Infinity)))throw RangeError('Chunk exceeds device limits');
 return Object.freeze(sizes);
}
function abortError(){const e=Error('Free-body chunk cancelled');e.name='AbortError';return e;}
async function create(device,substeps=1){
 if(!device?.createShaderModule||!device.queue?.onSubmittedWorkDone)throw TypeError('GPUDevice with queue drain required');
 const plan=Free.buildPlan(substeps);if(Free.INPUT_FLOATS!==68)throw Error('Free-body wire schema changed');plan.traceLayout.forEach(Object.freeze);
 const code=Runtime.shaderForInputFloats(68),carryCode=carryShader(plan.outputs.length+1);
 let busy=false,disposed=false,loss=null,rejectLoss;
 const lost=new Promise((_,reject)=>{rejectLoss=reject;});lost.catch(()=>{});
 Promise.resolve(device.lost).then(info=>{if(info){loss=Error('Free-body chunk device lost: '+String(info.message??info.reason));rejectLoss(loss);}},e=>{loss=e;rejectLoss(e);});
 const available=()=>{if(loss)throw loss;if(disposed)throw Error('Free-body chunk disposed');};
 async function compile(code){const module=device.createShaderModule({code}),info=await Promise.race([module.getCompilationInfo(),lost]);if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));return Promise.race([device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),lost]);}
 const arithmetic=await compile(code),carry=await compile(carryCode);available();
 const counts={chunks:0,submits:0,maps:0,arithmeticDispatches:0,carryDispatches:0,buffersCreated:0,buffersDestroyed:0};
 return Object.freeze({plan,code,carryCode,capability:LIMITS,
  async run(inputs,steps,{signal}={}){
   available();if(busy)throw Error('Free-body chunk busy');
   if(!Array.isArray(inputs))throw TypeError('Explicit singleton inputs required');
   const sizes=bounded(plan,inputs.length,steps,device);
   if(signal&&(typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw TypeError('AbortSignal required');
   if(signal?.aborted)throw abortError();
   // Validate and copy synchronously: caller mutations after run cannot enter GPU.
   const states=Array.from(inputs,input=>Free.validate(input));
   if(states.some(s=>s.parameters.substeps!==substeps))throw RangeError('Substep plan mismatch');
   const packed=new Float32Array(states.length*68);states.forEach((s,i)=>packed.set(Free.pack(s),i*68));
   busy=true;const owned=[];let scope=null,drain=null,mapping=null,read=null,scoped=false,cancelled=false;
   let rejectStop;const stopped=new Promise((_,reject)=>{rejectStop=reject;});stopped.catch(()=>{});
   const onAbort=()=>{cancelled=true;rejectStop(abortError());};
   const make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);counts.buffersCreated++;return b;};
   try{
    signal?.addEventListener('abort',onAbort,{once:true});available();if(signal?.aborted)throw abortError();
    device.pushErrorScope('validation');scoped=true;
    try{
     const [pb,ib,source,scratch,output,rb]=sizes.map((n,i)=>make(n,[136,136,136,128,140,9][i]));read=rb;
     device.queue.writeBuffer(pb,0,Graph.encode(plan));device.queue.writeBuffer(ib,0,Uint32Array.from(plan.outputs));device.queue.writeBuffer(source,0,packed);
     const bind=(pipeline,buffers)=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer,offset:0,size:buffer.size}}))});
     const ag=bind(arithmetic,[source,pb,scratch,ib,output]),cg=bind(carry,[output,source]),encoder=device.createCommandEncoder();
     const dispatch=(pipeline,group)=>{const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(states.length/32));pass.end();};
     for(let step=0;step<steps;step++){
      encoder.clearBuffer(output);dispatch(arithmetic,ag);
      // Each step's completion marker survives even if a later dispatch succeeds.
      encoder.copyBufferToBuffer(output,0,read,step*sizes[4],sizes[4]);
      if(step+1<steps)dispatch(carry,cg);
     }
     device.queue.submit([encoder.finish()]);counts.submits++;counts.arithmeticDispatches+=steps;counts.carryDispatches+=steps-1;
     drain=Promise.resolve(device.queue.onSubmittedWorkDone());drain.catch(()=>{});
     mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});counts.maps++;
    }finally{if(scoped){scoped=false;scope=Promise.resolve(device.popErrorScope());scope.catch(()=>{});}}
    const [,error]=await Promise.race([Promise.all([mapping,scope]),lost,stopped]);available();if(cancelled||signal?.aborted)throw abortError();if(error)throw Error(error.message);
    const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();
    const stride=plan.outputs.length+1,frames=[];
    // Admission is chunk-atomic. Reapply the source validator at EVERY original
    // step boundary before publishing any speculative device results.
    for(let step=0;step<steps;step++){
     const frame=[];
     for(let row=0;row<states.length;row++){
      Free.validate(states[row]);const out=raw.subarray((step*states.length+row)*stride,(step*states.length+row+1)*stride);
      if(out[stride-1]!==1||out.some(x=>!Number.isFinite(x)))throw Error('Incomplete/non-finite chunk step '+step+' row '+row);
      const decoded=Free.decode(out,plan);Object.assign(states[row].body,structuredClone(decoded.body));frame.push(decoded);
     }
     frames.push(frame);
    }
    counts.chunks++;return {backend:'webgpu',publication:'complete-chunk-only',steps,rows:states.length,frames,states,transport:{submits:1,maps:1,arithmeticDispatches:steps,carryDispatches:steps-1}};
   }finally{
    // Cancellation never publishes a prefix or allows overlapping work. Drain
    // already submitted work (or confirmed device loss) before releasing buffers.
    try{if(drain)await Promise.race([drain,lost]).catch(()=>{});}finally{
     let cleanupError=null;
     try{signal?.removeEventListener('abort',onAbort);}catch(e){cleanupError=e;}
     try{read?.unmap();}catch{}
     for(const b of owned)try{b.destroy();counts.buffersDestroyed++;}catch(e){cleanupError??=e;}
     busy=false;if(cleanupError)throw cleanupError;
    }
   }
  },
  snapshot:()=>Object.freeze({...counts,busy,disposed,deviceLost:!!loss,liveBuffers:counts.buffersCreated-counts.buffersDestroyed}),
  dispose(){if(busy)throw Error('Cannot dispose busy chunk; cancel and await drain');disposed=true;}
 });
}
const api=Object.freeze({LIMITS,CARRY,carryShader,bounded,create});G.LabFreeBodyGraphChunkExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
