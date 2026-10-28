import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {stopFixture} from './fixtures/world-rolling-stop-v2.mjs';
import {runMixedWorldQueryV2CPU} from '../src/direct-candidate/deterministic-mixed-motion-v2.mjs';
import {proveWorldRollingStopV2CPU,WORLD_ROLLING_STOP_V2_PROOF_WGSL} from '../src/direct-candidate/deterministic-world-rolling-stop-v2.mjs';

const base=stopFixture();
base.query=runMixedWorldQueryV2CPU(base.rows,base.scene).output;
const cases=[base];
for(const [field,indices] of [
 ['rows',[...Array.from({length:18},(_,i)=>i),...Array.from({length:56},(_,i)=>24+i)]],
 ['state',[3,4,5,6,8,40,56,64,86,87,...Array.from({length:9},(_,i)=>88+i),104]],
 ['context',[4,6,7,8,9,10,11,12,13,16,17,18,19,20,21,22]],
 ['scene',[3,4,5,6,7]],
])for(const index of indices){const f=structuredClone(base),array=field==='state'?f.current.state:f[field];array[index]=(array[index]+1)>>>0;f.label=`${field}[${index}]`;const expected=proveWorldRollingStopV2CPU(f.current,f.rows,f.query,f.scene,f.context);if(expected[1]!==1)cases.push(f);}

test('stop proof preserves every source predicate and exact rejection receipts',()=>{
 assert.ok(cases.length>=100);
 for(const f of cases.slice(1))assert.equal(proveWorldRollingStopV2CPU(f.current,f.rows,f.query,f.scene,f.context)[1],6,f.label);
 const sourceLoop=WORLD_ROLLING_STOP_V2_PROOF_WGSL.split('var sourceValid=true;')[1].split('if(!sourceValid)')[0];
 const cacheLoop=WORLD_ROLLING_STOP_V2_PROOF_WGSL.split('var cacheValid=true;')[1].split('if(!cacheValid)')[0];
 assert.ok(!sourceLoop.includes('return;'),'source predicates accumulate outside loop exits');
 assert.ok(!cacheLoop.includes('return;'),'cache arithmetic accumulates outside loop exits');
});

test('native accumulated stop proof matches original CPU for source and cache tampering',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();
 try{
  const begin=performance.now(),module=device.createShaderModule({code:WORLD_ROLLING_STOP_V2_PROOF_WGSL}),info=await module.getCompilationInfo();
  assert.deepEqual(info.messages.filter(x=>x.type==='error'),[]);
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),compileMs=performance.now()-begin;
  let words=0;
  for(const f of cases){const owned=[],alloc=(data,usage=128|4|8)=>{const b=device.createBuffer({size:typeof data==='number'?data:data.byteLength,usage});owned.push(b);if(typeof data!=='number')device.queue.writeBuffer(b,0,data);return b;};try{
   const buffers=[f.current.state,f.rows,f.query,f.scene,f.context].map(x=>alloc(x)),proof=alloc(128),read=alloc(128,1|8);buffers.push(proof);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
   pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(proof,0,read,0,128);device.queue.submit([encoder.finish()]);await read.mapAsync(1);
   const got=new Uint32Array(read.getMappedRange()).slice();read.unmap();assert.deepEqual(got,proveWorldRollingStopV2CPU(f.current,f.rows,f.query,f.scene,f.context),f.label);words+=got.length;
  }finally{owned.forEach(b=>b.destroy());}}
  t.diagnostic(JSON.stringify({cases:cases.length,words,compileMs,exactCPUAndGPU:true,scope:'stop proof only'}));
 }finally{device.destroy();gpu.destroy?.();}
});
