import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createLinearEventGPU,packLinearEventBatch,LINEAR_GPU_PROFILE} from '../src/direct-candidate/event-linear-gpu.mjs';
import {runPreparedEvents} from '../src/direct-candidate/event-core.mjs';
const scene={width:20,height:10,radius:.1,restitution:1,maxTime:60};
const fixtures=[
 {id:11,balls:[[2,2,1,0],[5,2,-1,0],[3,8,.25,0]]},
 {id:12,balls:[[2,2,1,0],[8,2,0,0],[4,2,0,0],[3,8,0,0]]},
 {id:13,balls:[[18,2,1,0],[2,5,0,0],[4,7,0,0]]},
 {id:14,balls:[[18,8,1,1],[2,5,0,0],[4,7,0,0]]},
 {id:15,balls:[[.1,2,-1,0],[2,5,0,0],[4,7,0,0]]},
 {id:16,balls:[[2,2,0,0],[2,5,0,0],[4,7,0,0]]},
 {id:18,balls:[[2,8,1,1],[2,5,0,0],[4,7,0,0]]},
 {id:19,balls:[[4,7,0,0],[2,5,0,0],[2,8,1,1]]},
 {id:17,maxEvents:3,balls:[[2,2,1,0],[5,2,-1,0],[3,8,.25,0]]},
];
test('prepared linear GPU ABI is compact and rejects invalid input',()=>{
 assert.equal(packLinearEventBatch(fixtures).byteLength,96*fixtures.length);
 assert.throws(()=>packLinearEventBatch([fixtures[0],fixtures[0]]),/Unique u32/);
 assert.throws(()=>packLinearEventBatch([{...fixtures[0],id:-1}]),/Unique u32/);
 assert.throws(()=>packLinearEventBatch([{...fixtures[0],id:2**32}]),/Unique u32/);
 assert.throws(()=>packLinearEventBatch([{balls:[[NaN,2,0,0],[2,5,0,0],[4,7,0,0]]}]),/Finite/);
});
test('small real native GPU batch matches prepared linear scheduler, preserves candidate isolation',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit trusted native module required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const engine=await createLinearEventGPU(device),rows=packLinearEventBatch(fixtures);
  const bad=rows.slice();new Float32Array(bad.buffer)[8]=NaN;await assert.rejects(engine.run(scene,bad),/numeric domain/);
  const duplicate=rows.slice();duplicate[24]=duplicate[0];await assert.rejects(engine.run(scene,duplicate),/Unique u32/);
  await assert.rejects(engine.run({...scene,width:1e300},rows),/Invalid shared/);
  const result=await engine.run(scene,rows,{diagnostic:true});
  fixtures.forEach((f,index)=>{
   const original=f.balls.map(([x,y,vx,vy])=>({p:[x,y],v:[vx,vy],w:[-vy/.1,vx/.1,0],r:.1}));
   const cpu=runPreparedEvents({...scene,profile:'finite-rectangle-planar'},original,{gravity:10,slidingFriction:0,rollingDeceleration:0,spinDeceleration:0,ballRestitution:1,wallRestitution:1},{maxEvents:f.maxEvents??1,maxTime:60});
   const expectedStatus={'incomplete':5,'unsupported':4,'rest-unscored':6}[cpu.status];
   assert.equal(result.compact[index*4],f.id);assert.equal(result.compact[index*4+1],expectedStatus);assert.equal(result.compact[index*4+3],0xffffffff);
   const observed=result.observations.slice(index*24,(index+1)*24);
   assert.ok(Math.abs(observed[4]-cpu.time)<2e-4);
   cpu.balls.forEach((b,i)=>[...b.p,...b.v].forEach((value,k)=>assert.ok(Math.abs(value-observed[8+i*4+k])<2e-4,`${index}/${i}/${k}: ${value}, ${observed[8+i*4+k]}`)));
  });
  const altered=rows.slice();altered[3]=1;const isolated=await engine.run(scene,altered,{diagnostic:true});
  assert.deepEqual(isolated.compact.slice(4),result.compact.slice(4));assert.deepEqual(isolated.observations.slice(24),result.observations.slice(24));assert.equal(isolated.compact[1],4);
  const compact=await engine.run(scene,rows);assert.equal(compact.observations,null);assert.deepEqual(compact.compact,result.compact);
  const receipt={profile:LINEAR_GPU_PROFILE,adapter:Object.fromEntries(['vendor','architecture','device','description'].map(k=>[k,adapter.info[k]])),shaderBytes:engine.shaderBytes,compileMs:engine.compileMs,metrics:compact.metrics,preparedCases:fixtures.length,productionEnabled:false,rawShot:false,coulombOnGPU:false,rapierParity:false};
  t.diagnostic(JSON.stringify(receipt));
  if(process.env.DIRECT_EVENT_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DIRECT_EVENT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
