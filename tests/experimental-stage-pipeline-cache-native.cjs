'use strict';
// Deliberately separate opt-in gate: host acceptance must never acquire a GPU.
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const Runtime=require('../src/experimental-stage-runtime'),Graph=require('../src/experimental-arithmetic-graph');
const PLAN={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'sub',args:[0,1]},{kind:'mul',args:[0,1]},{kind:'div',args:[0,1]},{kind:'negate',args:[0]},{kind:'signbitSign',args:[0]}],outputs:[2,3,4,5,6,7]};
const packed=n=>Float32Array.from(Array.from({length:n},(_,i)=>[(i+1)*.25,2]).flat());
const expected=input=>Float32Array.from(Array.from({length:input.length/2},(_,i)=>[...Graph.execute(input.slice(i*2,i*2+2),PLAN),1]).flat());
const bits=values=>new Uint32Array(values.buffer,values.byteOffset,values.length);
function observe(actual){
 const calls={modules:0,pipelines:0,buffers:0,groups:0,scopeDepth:0,maxScopeDepth:0},buffers=[],groups=[];
 // One stable passed identity throughout. All GPU objects remain native; the
 // proxy only observes successful calls and binds native methods to receivers.
 const device=new Proxy(actual,{get(target,key){
  if(key==='createShaderModule')return d=>{const result=target.createShaderModule(d);calls.modules++;return result;};
  if(key==='createComputePipelineAsync')return d=>target.createComputePipelineAsync(d).then(result=>{calls.pipelines++;return result;});
  if(key==='createBuffer')return d=>{const result=target.createBuffer(d);calls.buffers++;buffers.push(result);return result;};
  if(key==='createBindGroup')return d=>{const result=target.createBindGroup(d);calls.groups++;groups.push(d);return result;};
  if(key==='pushErrorScope')return filter=>{const result=target.pushErrorScope(filter);calls.scopeDepth++;calls.maxScopeDepth=Math.max(calls.maxScopeDepth,calls.scopeDepth);return result;};
  if(key==='popErrorScope')return()=>{const result=target.popErrorScope();calls.scopeDepth--;assert.ok(calls.scopeDepth>=0);return result;};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});return{device,calls,buffers,groups};
}
test('native explicit pipeline reuse preserves exact output and independent stage ownership',{
 skip:process.env.REQUIRE_STAGE_PIPELINE_CACHE_NATIVE!=='1',timeout:60000
},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE required by explicit native gate');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);
 const actual=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,actual,'pipeline cache acceptance');
 const observed=observe(actual),{device,calls,buffers,groups}=observed,stages=[],uncaptured=[];
 const onError=e=>uncaptured.push(String(e.error?.message??e.error));actual.addEventListener('uncapturederror',onError);
 try{
  // No default creation seeds the cache. Concurrent same-key opt-in creates one.
  const pending=[true,true,false,false].map(reusePipelines=>Runtime.createResidentGraph(device,PLAN,{reusePipelines,maxRows:4,label:'cache native acceptance'}).then(stage=>{stages.push(stage);return stage;}));
  const results=await Promise.allSettled(pending);for(const result of results)assert.equal(result.status,'fulfilled',result.reason?.stack);
  const [a,b,c,d]=results.map(r=>r.value);
  assert.equal(calls.modules,3);assert.equal(calls.pipelines,3);assert.equal(buffers.length,8);
  for(const n of [1,4,2]){
   const input=packed(n),settled=await Promise.allSettled([a,b,c,d].map(stage=>stage.run(input)));
   for(const result of settled)assert.equal(result.status,'fulfilled',result.reason?.stack);const outputs=settled.map(r=>r.value);
   for(const output of outputs){assert.deepEqual(output,expected(input));assert.deepEqual(bits(output),bits(outputs[2]));}
   assert.equal(new Set(outputs.map(output=>output.buffer)).size,4);
  }
  // First four groups are from each stage's first dispatch. They contain the
  // original native handles: no observer unwrapping or mock computation.
  const ownerBuffers=groups.slice(0,4).map(group=>new Set(group.entries.map(e=>e.resource.buffer)));
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok([...ownerBuffers[i]].every(buffer=>!ownerBuffers[j].has(buffer)));
  assert.equal(new Set(buffers).size,buffers.length);
  const bBefore=b.snapshot(),abort=new AbortController();
  const cancelled=a.run(packed(2),{signal:abort.signal}),sibling=b.run(packed(2));abort.abort();
  const cancellation=await Promise.allSettled([cancelled,sibling]);assert.equal(cancellation[0].status,'rejected');assert.equal(cancellation[0].reason.name,'AbortError');
  assert.equal(cancellation[1].status,'fulfilled');assert.deepEqual(cancellation[1].value,expected(packed(2)));
  assert.equal(a.snapshot().capacity,0);assert.equal(b.snapshot().capacity,bBefore.capacity);assert.equal(b.snapshot().buffersDestroyed,bBefore.buffersDestroyed);
  // A shader status error in one private output cannot contaminate its sibling.
  const failed=await Promise.allSettled([a.run(Float32Array.of(4,0)),b.run(Float32Array.of(4,2))]);
  assert.equal(failed[0].status,'rejected');assert.equal(failed[0].reason.code,'ARITHMETIC_GPU_ROW_STATUS');assert.equal(failed[1].status,'fulfilled');assert.deepEqual(failed[1].value,expected(Float32Array.of(4,2)));
  const recovered=await a.run(packed(1));assert.deepEqual(bits(recovered),bits(await c.run(packed(1))));assert.deepEqual(recovered,expected(packed(1)));
  a.dispose();assert.equal(a.snapshot().liveBuffers,0);assert.deepEqual(await b.run(packed(1)),expected(packed(1)));
  for(const stage of stages){stage.dispose();assert.equal(stage.snapshot().liveBuffers,0);assert.equal(stage.snapshot().buffersCreated,stage.snapshot().buffersDestroyed);}
  await actual.queue.onSubmittedWorkDone();assert.equal(calls.modules,3);assert.equal(calls.pipelines,3);assert.equal(calls.scopeDepth,0);assert.equal(calls.maxScopeDepth,1);assert.deepEqual(uncaptured,[]);
  t.diagnostic(JSON.stringify({backend:'actual-webgpu',adapter:adapter.info,cacheOptIn:true,bitwiseCachedUncached:true,exactCpuComponent:true,privateBuffers:true,cancellationAndRowErrorIsolation:true,calls,snapshots:stages.map(s=>s.snapshot()),memory:process.memoryUsage(),performanceClaim:false}));
 }finally{
  // All dispatch promises above settle before disposal, including failure paths.
  for(const stage of stages)if(!stage.snapshot().busy)stage.dispose();
  actual.removeEventListener('uncapturederror',onError);release();
 }
});
