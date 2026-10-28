import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {finalizeCandidateCPU,CANDIDATE_FINALIZER_WGSL,NULL_CANDIDATE_SCORE} from '../src/direct-candidate/deterministic-candidate-finalizer.mjs';
import {packRuleConfig} from '../src/direct-candidate/deterministic-rules.mjs';
const config=packRuleConfig({first:1,second:2,opponent:3,search:true});
function row({rest=1,game=1,search=1,foul=0,proof=0}={}){const r=new Uint32Array(32);r[13]=rest;r[18]=game;r[19]=search;r[3]=foul;r[29]=proof;return r;}
const fixtures=[
 [3,row(),[1,0,1]], [3,row({search:4}),[4,5,1]],
 [5,row({rest:0,game:3,search:3}),[3,3,NULL_CANDIDATE_SCORE]],
 [4,row({rest:0,game:4,search:4}),[4,4,NULL_CANDIDATE_SCORE]],
 [3,row({game:2,search:2,foul:1}),[2,1,0xffffffff]],
 [3,row({game:2,search:4,foul:1}),[2,1,0xffffffff]],
 [3,row({search:2}),[2,2,1]],
 [4,row({rest:0,game:4,search:4,proof:1}),[5,7,NULL_CANDIDATE_SCORE],true],
 [5,row({rest:0,game:3,search:3,proof:1}),[5,7,NULL_CANDIDATE_SCORE],true],
];
test('compact combined verdict never promotes unknown search or budget to pass/fail',()=>{for(const [p,r,w,condition]of fixtures){const c=config.slice();c[10]=condition?1:0;assert.deepEqual(Array.from(finalizeCandidateCPU(42,p,r,c)),[42,...w]);}assert.notEqual(NULL_CANDIDATE_SCORE,0xffffffff);});
test('compact finalizer all words match native, including retained negative proof',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async()=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:CANDIDATE_FINALIZER_WGSL}),entryPoint:'main'}});
 for(const [physical,r,,condition]of fixtures){const buffers=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};try{const s=new Uint32Array(160);s[1]=42;s[2]=physical;const c=config.slice();c[10]=condition?1:0;const sb=make(640,128|8),rb=make(128,128|8),cb=make(48,128|8),out=make(16,128|4),read=make(16,1|8);device.queue.writeBuffer(sb,0,s);device.queue.writeBuffer(rb,0,r);device.queue.writeBuffer(cb,0,c);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[sb,rb,cb,out].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,16);device.queue.submit([encoder.finish()]);await read.mapAsync(1);assert.deepEqual(new Uint32Array(read.getMappedRange()).slice(),finalizeCandidateCPU(42,physical,r,c));read.unmap();}finally{buffers.forEach(b=>b.destroy());}}
 }finally{device.destroy();}
});
