// Explicit experimental component only. No production selection or CPU fallback.
import {generateDirectCueWGSL} from './cue-slice.mjs';
export const COMPACT_CUE_WGSL = `
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read_write> compact:array<vec4<u32>>;
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=arrayLength(&compact)){return;}let b=id.x*256u;
 compact[id.x]=vec4<u32>(rows[b],rows[b+1u],rows[b+3u],rows[b+2u]);
}`;
export async function createDirectCueComponent(device) {
 const shader=generateDirectCueWGSL(), started=performance.now();
 device.pushErrorScope('validation');
 let pipelines;
 try {
  const modules=[shader,COMPACT_CUE_WGSL].map(code=>device.createShaderModule({code}));
  for(const module of modules){const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(m=>m.message).join('\n'));}
  pipelines=await Promise.all(modules.map(module=>device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}})));
 } finally {const error=await device.popErrorScope();if(error)throw Error(error.message);}
 const compileMs=performance.now()-started;
 return Object.freeze({compileMs,shaderBytes:new TextEncoder().encode(shader).length,compactShaderBytes:new TextEncoder().encode(COMPACT_CUE_WGSL).length,
  async run(shared,rows,{diagnosticReadback=false}={}) {
   if(!(shared instanceof Uint32Array)||shared.length!==16||!(rows instanceof Uint32Array)||!rows.length||rows.length%256||rows.length/256>4096)throw new TypeError('Bounded component buffers required');
   const count=rows.length/256,buffers=[],sizes=[];
   const allocate=(size,usage)=>{const buffer=device.createBuffer({size,usage});buffers.push(buffer);sizes.push(size);return buffer;};
   // WebGPU standard flags; no ambient global dependency.
   const COPY_SRC=4,COPY_DST=8,STORAGE=128,MAP_READ=1;
   device.pushErrorScope('validation');
   try {
    const material=allocate(64,STORAGE|COPY_DST),state=allocate(rows.byteLength,STORAGE|COPY_DST|COPY_SRC),compact=allocate(count*16,STORAGE|COPY_SRC),read=allocate(count*16,MAP_READ|COPY_DST),diagnostic=diagnosticReadback?allocate(rows.byteLength,MAP_READ|COPY_DST):null;
    device.queue.writeBuffer(material,0,shared);device.queue.writeBuffer(state,0,rows);
    const groups=[device.createBindGroup({layout:pipelines[0].getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:material}},{binding:1,resource:{buffer:state}}]}),device.createBindGroup({layout:pipelines[1].getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:state}},{binding:1,resource:{buffer:compact}}]})];
    const encoder=device.createCommandEncoder();
    for(let i=0;i<2;i++){const pass=encoder.beginComputePass();pass.setPipeline(pipelines[i]);pass.setBindGroup(0,groups[i]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();}
    encoder.copyBufferToBuffer(compact,0,read,0,count*16);if(diagnostic)encoder.copyBufferToBuffer(state,0,diagnostic,0,rows.byteLength);
    const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-start;
    await read.mapAsync(MAP_READ);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();
    let actual=null;if(diagnostic){await diagnostic.mapAsync(MAP_READ);actual=new Uint32Array(diagnostic.getMappedRange()).slice();diagnostic.unmap();}
    return {compact:result,diagnostic:actual,metrics:{count,allocatedBufferBytes:sizes.reduce((a,b)=>a+b,0),bufferSizes:sizes,semanticPersistentBytes:64+rows.byteLength,readbackBytes:count*16+(diagnostic?rows.byteLength:0),submitToDoneMs,timingIncludesDispatchAndCopies:true,hardwareSpeedClaim:false,wholeWorld:false}};
   } finally {buffers.forEach(buffer=>buffer.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
  }
 });
}
