// Test-only native compute support. Caller owns the globally serialized GPU slot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export async function createNativeOwner(label) {
  assert.equal(process.env.REQUIRE_WEBGPU,'1','Actual compute must be explicitly requested; no CPU fallback');
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE??'/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js'));
  Object.assign(globalThis,globals);
  const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual WebGPU adapter required');
  const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,label);
  return {device,release,adapterInfo:Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info?.[k]??null]))};
}

/** Each row binds one storage buffer. Numeric input is copied before any await.
 * All requested readbacks occur after the one submitted compute dispatch.
 * This helper is not a production world runner and executes no CPU physics.
 */
export async function dispatchWords(owner,{code,buffers,workgroups=1,entryPoint='main',label='resident-native-test'}) {
  assert.ok(Array.isArray(buffers)&&buffers.length>0);
  const owned=buffers.map((row,binding)=>{
    const input=row.input===undefined?null:new Uint32Array(row.input);
    const words=row.words??input?.length;assert.ok(Number.isSafeInteger(words)&&words>0);
    assert.ok(!input||input.length<=words);
    return {binding,input,words,readback:!!row.readback};
  });
  const device=owner.device,resources=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};
  let scope=true,submitted=false;
  device.pushErrorScope('validation');
  try {
    const shader=device.createShaderModule({code,label}),info=await shader.getCompilationInfo();
    assert.deepEqual(info.messages.filter(x=>x.type==='error').map(x=>`${x.lineNum}:${x.linePos} ${x.message}`),[],label+' WGSL compilation');
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint}});
    const bound=owned.map(row=>{
      assert.ok(row.words*4<=device.limits.maxStorageBufferBindingSize,'Explicit storage-binding capacity');
      const buffer=make(row.words*4,128|8|4);if(row.input)device.queue.writeBuffer(buffer,0,row.input);
      return {...row,buffer,read:row.readback?make(row.words*4,1|8):null};
    });
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:bound.map(({binding,buffer,words})=>({binding,resource:{buffer,offset:0,size:words*4}}))});
    const encoder=device.createCommandEncoder({label}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(workgroups);pass.end();
    for(const row of bound)if(row.read)encoder.copyBufferToBuffer(row.buffer,0,row.read,0,row.words*4);
    device.queue.submit([encoder.finish()]);submitted=true;
    const errorPromise=device.popErrorScope();scope=false;
    const result=await Promise.all(bound.map(async row=>{if(!row.read)return null;await row.read.mapAsync(1);const data=new Uint32Array(row.read.getMappedRange().slice(0));row.read.unmap();return data;}));
    assert.equal(await errorPromise,null,label+' device validation');
    return result;
  } finally {
    if(scope)await device.popErrorScope();
    if(submitted)await device.queue.onSubmittedWorkDone();
    for(const resource of resources){try{resource.unmap();}catch{}resource.destroy();}
  }
}

/** Fixed device-stage chain, with no intermediate host readback or decision. */
export async function dispatchWordStages(owner,{stages,buffers,bindingTypes,workgroups=1,cycles=1,label='resident-native-stages'}){
 assert.ok(Array.isArray(stages)&&stages.length&&bindingTypes.length===buffers.length);assert.ok(Number.isSafeInteger(cycles)&&cycles>=1);
 const rows=buffers.map((row,binding)=>{const input=row.input===undefined?null:new Uint32Array(row.input),words=row.words??input?.length;assert.ok(Number.isSafeInteger(words)&&words>0&&(!input||input.length<=words));return{binding,input,words,readback:!!row.readback};});
 const device=owner.device,resources=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};let scoped=true,submitted=false;device.pushErrorScope('validation');
 try{
  const groupLayout=device.createBindGroupLayout({entries:bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))});const layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]});const pipelines=[];
  for(const[stageIndex,stage]of stages.entries()){console.log(JSON.stringify({stage:'compile-start',label,index:stageIndex,bytes:stage.code.length}));const shader=device.createShaderModule({code:stage.code,label:label+' stage '+stageIndex}),info=await shader.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error').map(x=>`${x.lineNum}:${x.linePos} ${x.message}`),[],label+' WGSL stage '+stageIndex);console.log(JSON.stringify({stage:'pipeline-start',label,index:stageIndex}));pipelines.push(await device.createComputePipelineAsync({layout,compute:{module:shader,entryPoint:stage.entryPoint??'main'}}));console.log(JSON.stringify({stage:'pipeline-ready',label,index:stageIndex}));}
  const bound=rows.map(row=>{assert.ok(row.words*4<=device.limits.maxStorageBufferBindingSize);const buffer=make(row.words*4,128|8|4);if(row.input)device.queue.writeBuffer(buffer,0,row.input);return{...row,buffer,read:row.readback?make(row.words*4,1|8):null};});
  const group=device.createBindGroup({layout:groupLayout,entries:bound.map(({binding,buffer,words})=>({binding,resource:{buffer,offset:0,size:words*4}}))}),encoder=device.createCommandEncoder({label});
  for(let cycle=0;cycle<cycles;cycle++)for(const[i,pipeline]of pipelines.entries())for(let repeat=0;repeat<(stages[i].repeat??1);repeat++){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(stages[i].workgroups??workgroups);pass.end();}
  for(const row of bound)if(row.read)encoder.copyBufferToBuffer(row.buffer,0,row.read,0,row.words*4);console.log(JSON.stringify({stage:'submit',label,stages:stages.length}));device.queue.submit([encoder.finish()]);submitted=true;const validation=device.popErrorScope();scoped=false;
  const result=await Promise.all(bound.map(async row=>{if(!row.read)return null;await row.read.mapAsync(1);const a=new Uint32Array(row.read.getMappedRange().slice(0));row.read.unmap();return a;}));assert.equal(await validation,null,label+' validation');return result;
 }finally{if(scoped)await device.popErrorScope();if(submitted)await device.queue.onSubmittedWorkDone();for(const r of resources){try{r.unmap();}catch{}r.destroy();}}
}
