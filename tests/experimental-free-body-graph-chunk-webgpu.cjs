'use strict';
// Explicit opt-in ONLY after a shared GPU/native slot is granted. This is not
// the independent native-Rapier oracle gate; that existing gate stays intact.
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const C=require('../src/experimental-free-body-graph-chunk'),F=require('../src/experimental-free-body'),fixture=require('./free-body-graph-chunk-fixture.cjs');
test('chunk matches sequential original CPU component and original GPU component exactly',{skip:process.env.RUN_FREE_BODY_CHUNK_GPU!=='1',timeout:120000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit native GPU module required');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();const release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'free-body-graph-chunk');
 const counters={submits:0,maps:0,bytesCreated:0,liveBytes:0,peakLiveBytes:0};
 const submit=device.queue.submit.bind(device.queue);device.queue.submit=(...a)=>{counters.submits++;return submit(...a);};
 const createBuffer=device.createBuffer.bind(device);device.createBuffer=desc=>{const b=createBuffer(desc),map=b.mapAsync.bind(b),destroy=b.destroy.bind(b);counters.bytesCreated+=desc.size;counters.liveBytes+=desc.size;counters.peakLiveBytes=Math.max(counters.peakLiveBytes,counters.liveBytes);let dead=false;b.mapAsync=(...a)=>{counters.maps++;return map(...a);};b.destroy=()=>{if(!dead){dead=true;counters.liveBytes-=desc.size;}return destroy();};return b;};
 try{for(const substeps of [1,3,12]){
  const a=fixture();a.parameters.substeps=substeps;a.body.linear=[.125,-.25,.5];a.body.angular=[.25,.5,-.125];a.parameters.gravity=[0,-9.81,0];a.parameters.linearDamping=.125;a.parameters.angularDamping=.25;
  const b=structuredClone(a);b.body.localCom=[.125,-.0625,.03125];b.body.invInertia=[1,0,0,0,2,0,0,0,4];b.body.principalInertia=[1,.5,.25];b.body.invPrincipalInertia=[1,2,4];b.parameters.userTorque=[.01,-.02,.03];
  const inputs=[a,b],steps=8,chunk=await C.create(device,substeps),cpu=inputs.map(F.createReferenceStepper),sequential=await Promise.all(inputs.map(x=>F.createGpuStepper(device,x)));
  try{const before={...counters},start=performance.now(),result=await chunk.run(inputs,steps),chunkMs=performance.now()-start,afterChunk={...counters},seqStart=performance.now();
   for(let step=0;step<steps;step++)for(let row=0;row<inputs.length;row++){
    const c=await cpu[row].step(),g=await sequential[row].step();const {backend:cb,frame:cf,...expectedCpu}=c,{backend:gb,frame:gf,...expectedGpu}=g;
    assert.deepEqual(result.frames[step][row],expectedGpu,'exact original GPU step '+step+' row '+row);
    assert.deepEqual(result.frames[step][row],expectedCpu,'exact original CPU step '+step+' row '+row);
   }
   assert.equal(result.transport.submits,1);assert.equal(result.transport.maps,1);
   assert.equal(afterChunk.submits-before.submits,1);assert.equal(afterChunk.maps-before.maps,1);assert.equal(counters.submits-afterChunk.submits,16);assert.equal(counters.maps-afterChunk.maps,16);
   t.diagnostic(JSON.stringify({substeps,rows:2,steps,chunkSubmits:afterChunk.submits-before.submits,chunkMaps:afterChunk.maps-before.maps,sequentialOriginalGpuSubmits:counters.submits-afterChunk.submits,sequentialOriginalGpuMaps:counters.maps-afterChunk.maps,chunkMs,sequentialCpuAndGpuMs:performance.now()-seqStart,chunkAllocatedBytes:afterChunk.bytesCreated-before.bytesCreated,peakLiveBytes:counters.peakLiveBytes,processMemory:process.memoryUsage(),claim:'transport reduction only; no hardware speedup claim'}));
  }finally{chunk.dispose();cpu.forEach(s=>s.dispose());sequential.forEach(s=>s.dispose());}
 }}finally{release();}
});
