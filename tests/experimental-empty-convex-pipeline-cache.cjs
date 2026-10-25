'use strict';
// Orchestration-only fake-device tests. No shader executes, no native decoder or
// engine runs, and the explicit topology stub is NOT native hull/parity evidence.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const Module=require('node:module');
const file=require.resolve('../src/experimental-cue-empty-convex-cache');
const source=fs.readFileSync(file,'utf8');
const nativeRequire=Module.createRequire(file);
const Runtime=require('../src/experimental-stage-runtime');
const LABELS=['empty convex cache recurrence','empty convex init','empty convex gjk','empty convex finish'];
const SIGNATURES=[
  [2252,'36abe5c8998b9024eae7265e2d52cfc550406c118b4287300170ff42109839d0'],
  [10038,'d954e48891bac2338d23c32b205772b56124c350cb92530612404451c06a4343'],
  [11442,'2daf24854b70277548c9dd3cf7dfa4d221ac3cd17a03933f6c2e3f0d31612e77'],
  [1977,'223b82dc968f82f7b44f3976138b6731cef58882827d56bee6187aa8282609bc'],
];
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({text=source,runtime=Runtime,inspectCache=false}={}){
  const admitted=new WeakSet(),m=new Module(file,module);
  m.filename=file;m.paths=module.paths;
  m.require=id=>id==='./experimental-cue-convex-topology'?{
    assertNativeHull(hull){assert.ok(admitted.has(hull),'Explicit orchestration-only topology fixture');},
  }:id==='./experimental-stage-runtime'?runtime:nativeRequire(id);
  // Private inspection exists only in this isolated test module, never production.
  if(inspectCache)text=text.replace('const api=Object.freeze({CAPABILITY','const api=Object.freeze({pipelineCacheForTest:devicePipelineCaches,CAPABILITY');
  m._compile(text,file);
  function hull(index=9){const h={snapshot:{inputSha256:'orchestration-only'},handle:{index,generation:0},points:[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]};admitted.add(h);return h;}
  return{E:m.exports,hull,cache:m.exports.pipelineCacheForTest};
}
function fakeDevice({shader,pipeline,info}={}){
  const lost=deferred(),modules=[],pipelines=[],buffers=[],writes=[];
  const device={
    lost:lost.promise,
    createShaderModule(descriptor){
      modules.push(descriptor);if(shader)shader(descriptor,modules.length);
      return{...descriptor,getCompilationInfo:()=>info?info(descriptor,modules.length):Promise.resolve({messages:[]})};
    },
    createComputePipelineAsync(descriptor){
      pipelines.push(descriptor);
      return pipeline?pipeline(descriptor,pipelines.length):Promise.resolve({descriptor,getBindGroupLayout:i=>({descriptor,index:i})});
    },
    createBuffer(descriptor){const buffer={descriptor,destroyed:false,destroy(){this.destroyed=true;}};buffers.push(buffer);return buffer;},
    queue:{writeBuffer(buffer,offset,data){writes.push({buffer,offset,bytes:Buffer.from(new Uint8Array(data.buffer,data.byteOffset,data.byteLength))});}},
  };
  return{device,lost,modules,pipelines,buffers,writes};
}
const create=(E,d,h)=>E.createGpuStage(d.device,{hull:h});
function assertDescriptors(d){
  assert.deepEqual(d.modules.map(x=>x.label),LABELS);
  d.modules.forEach((descriptor,i)=>{
    assert.equal(Buffer.byteLength(descriptor.code),SIGNATURES[i][0]);
    assert.equal(crypto.createHash('sha256').update(descriptor.code).digest('hex'),SIGNATURES[i][1]);
    const p=d.pipelines[i];assert.deepEqual(Object.keys(p).sort(),['compute','layout']);
    assert.equal(p.layout,'auto');assert.deepEqual(Object.keys(p.compute).sort(),['entryPoint','module']);
    assert.equal(p.compute.entryPoint,'main');assert.equal(p.compute.module.code,descriptor.code);assert.equal(p.compute.module.label,descriptor.label);
  });
}
function assertOwned(E,d,stages,hulls){
  assert.equal(d.buffers.length,stages.length*2);assert.equal(new Set(d.buffers).size,d.buffers.length);
  for(let i=0;i<stages.length;i++){
    assert.equal(E.isStage(stages[i],'webgpu',hulls[i]),true);
    if(hulls[(i+1)%hulls.length]!==hulls[i])assert.equal(E.isStage(stages[i],'webgpu',hulls[(i+1)%hulls.length]),false);
    for(let j=0;j<2;j++){
      const at=i*2+j;assert.equal(d.writes[at].buffer,d.buffers[at]);assert.deepEqual(d.writes[at].bytes,d.writes[j].bytes);
      assert.equal(d.buffers[at].descriptor.usage,136);assert.equal(d.buffers[at].descriptor.size,d.writes[at].bytes.length);
    }
  }
}

test('orchestration: eight concurrent stages share four in-flight descriptor-identical compilations',async()=>{
  const {E,hull}=fixture(),shaderReady=deferred(),pipelineReady=deferred();
  const d=fakeDevice({info:(descriptor,n)=>n===1?shaderReady.promise:Promise.resolve({messages:[]}),pipeline:(descriptor,n)=>n===1?pipelineReady.promise:Promise.resolve({descriptor})});
  const hulls=Array.from({length:8},(_,i)=>hull(9+i));
  const pending=hulls.map(h=>create(E,d,h));
  assert.equal(d.modules.length,1);assert.equal(d.pipelines.length,0);assert.equal(d.buffers.length,0);
  shaderReady.resolve({messages:[]});await turn();
  assert.equal(d.modules.length,1);assert.equal(d.pipelines.length,1);assert.equal(d.buffers.length,0);
  pipelineReady.resolve({firstPipeline:true});const stages=await Promise.all(pending);
  assertDescriptors(d);assertOwned(E,d,stages,hulls);
  stages[0].dispose();assert.equal(E.isStage(stages[0],'webgpu'),false);
  assert.deepEqual(d.buffers.map(b=>b.destroyed),[true,true,...Array(14).fill(false)]);
  for(let i=1;i<stages.length;i++){assert.equal(E.isStage(stages[i],'webgpu',hulls[i]),true);stages[i].dispose();}
  const again=await create(E,d,hulls[0]);assert.equal(d.modules.length,4);assert.equal(d.pipelines.length,4);
  assert.equal(d.buffers.length,18);again.dispose();assert.ok(d.buffers.every(b=>b.destroyed));
});

test('orchestration: sequential stages and distinct hulls share programs, not their brands or buffers',async()=>{
  const {E,hull}=fixture(),d=fakeDevice(),hulls=[],stages=[];
  for(let i=0;i<8;i++){hulls.push(hull(9+i));stages.push(await create(E,d,hulls[i]));}
  assertDescriptors(d);assertOwned(E,d,stages,hulls);stages.forEach(s=>s.dispose());
});

test('orchestration: exact device objects, including scoped facades, have isolated caches',async()=>{
  const {E,hull}=fixture(),h=hull(),a=fakeDevice(),b=fakeDevice();
  const stages=await Promise.all(Array.from({length:8},()=>create(E,a,h)).concat(Array.from({length:8},()=>create(E,b,h))));
  assertDescriptors(a);assertDescriptors(b);assert.notEqual(a.pipelines[0].compute.module,b.pipelines[0].compute.module);
  stages.forEach(s=>s.dispose());
  const underlying=fakeDevice(),facadeA={...underlying.device},facadeB={...underlying.device};
  const x=await E.createGpuStage(facadeA,{hull:h}),y=await E.createGpuStage(facadeB,{hull:h});
  assert.equal(underlying.modules.length,8,'Distinct facades are intentionally not unwrapped');x.dispose();y.dispose();
});

test('orchestration: shader diagnostics reject all concurrent waiters, evict failure, and retry',async()=>{
  const {E,hull}=fixture(),ready=deferred(),d=fakeDevice({info:(descriptor,n)=>n===1?ready.promise:Promise.resolve({messages:[]})}),h=hull();
  const pending=Array.from({length:8},()=>create(E,d,h)),settled=Promise.allSettled(pending);
  ready.resolve({messages:[{type:'error',message:'forced shader diagnostics'}]});
  for(const out of await settled){assert.equal(out.status,'rejected');assert.match(out.reason.message,/forced shader diagnostics/);}
  assert.equal(d.modules.length,1);assert.equal(d.pipelines.length,0);assert.equal(d.buffers.length,0);
  const stage=await create(E,d,h);assert.deepEqual(d.modules.map(x=>x.label),[LABELS[0],...LABELS]);assert.equal(d.pipelines.length,4);stage.dispose();
});

test('orchestration: pipeline rejection evicts only that descriptor and retains completed programs for retry',async()=>{
  const {E,hull}=fixture(),ready=deferred(),d=fakeDevice({pipeline:(descriptor,n)=>n===3?ready.promise:Promise.resolve({descriptor})}),h=hull();
  const pending=Array.from({length:8},()=>create(E,d,h)),settled=Promise.allSettled(pending);
  await turn();assert.equal(d.pipelines.length,3);ready.reject(Error('forced pipeline failure'));
  for(const out of await settled){assert.equal(out.status,'rejected');assert.match(out.reason.message,/forced pipeline failure/);}
  assert.equal(d.buffers.length,0);
  const stages=await Promise.all(Array.from({length:8},()=>create(E,d,h)));
  assert.deepEqual(d.modules.map(x=>x.label),[LABELS[0],LABELS[1],LABELS[2],LABELS[2],LABELS[3]]);
  assert.equal(d.pipelines.length,5);stages.forEach(s=>s.dispose());
});

for(const boundary of ['shader','pipeline'])test('orchestration: synchronous '+boundary+' exception is evicted and retryable',async()=>{
  const {E,hull}=fixture(),h=hull(),error=Error('forced synchronous '+boundary);
  const d=fakeDevice({[boundary]:(descriptor,n)=>{if(n===1)throw error;if(boundary==='pipeline')return Promise.resolve({descriptor});}});
  const settled=await Promise.allSettled(Array.from({length:8},()=>create(E,d,h)));
  for(const out of settled){assert.equal(out.status,'rejected');assert.equal(out.reason,error);}
  assert.equal(d.modules.length,1);assert.equal(d.buffers.length,0);
  const stage=await create(E,d,h);assert.equal(d.modules.length,5);assert.equal(d.pipelines.length,boundary==='shader'?4:5);stage.dispose();
});

test('orchestration: device loss drops programs, rejects reuse, and leaves stage buffer ownership alone',async()=>{
  const {E,hull,cache}=fixture({inspectCache:true}),h=hull(),d=fakeDevice(),stage=await create(E,d,h),entries=cache.get(d.device);
  assert.equal(entries.size,4);d.lost.resolve({reason:'destroyed',message:'forced loss'});await turn();
  assert.equal(cache.has(d.device),false);assert.equal(entries.size,0);
  await assert.rejects(()=>create(E,d,h),/GPUDevice lost/);assert.equal(d.modules.length,4);assert.equal(d.buffers.length,2);
  assert.ok(d.buffers.every(b=>!b.destroyed),'Cache does not take over stage buffer lifetime');stage.dispose();assert.ok(d.buffers.every(b=>b.destroyed));
  const replacement=fakeDevice(),fresh=await create(E,replacement,h);assertDescriptors(replacement);fresh.dispose();
});

test('orchestration: loss while compilation is pending cannot publish a stale pipeline or allocate stage buffers',async()=>{
  const {E,hull}=fixture(),h=hull(),ready=deferred(),d=fakeDevice({pipeline:()=>ready.promise});
  const pending=Array.from({length:8},()=>create(E,d,h)),settled=Promise.allSettled(pending);
  await turn();assert.equal(d.pipelines.length,1);d.lost.resolve({reason:'unknown'});await turn();ready.resolve({stale:true});
  for(const out of await settled){assert.equal(out.status,'rejected');assert.match(out.reason.message,/GPUDevice lost/);}
  await assert.rejects(()=>create(E,d,h),/GPUDevice lost/);assert.equal(d.modules.length,1);assert.equal(d.buffers.length,0);
});

test('orchestration: a rejected loss notification is handled conservatively without unhandled rejection',async()=>{
  const {E,hull}=fixture(),h=hull(),d=fakeDevice(),stage=await create(E,d,h);
  d.lost.reject(Error('forced loss notification rejection'));await turn();
  await assert.rejects(()=>create(E,d,h),/GPUDevice lost/);assert.equal(d.modules.length,4);stage.dispose();
});

test('orchestration: different exact shader bytes never alias the same label',async()=>{
  let suffix='';const {E,hull}=fixture({runtime:{shaderForInputFloats:n=>Runtime.shaderForInputFloats(n)+suffix}}),h=hull(),d=fakeDevice();
  const a=await create(E,d,h);suffix='\n// distinct test-only descriptor\n';const b=await create(E,d,h),c=await create(E,d,h);
  assert.equal(d.modules.length,5);assert.equal(d.pipelines.length,5);assert.equal(d.modules[4].label,LABELS[0]);
  assert.notEqual(d.modules[0].code,d.modules[4].code);[a,b,c].forEach(s=>s.dispose());
});

// Optional reproducible frozen-source comparison. The supplied source must be
// extracted from dded16d; it is never accepted as a native execution fixture.
const baselinePath=process.env.EMPTY_CONVEX_PIPELINE_BASELINE_SOURCE;
test('orchestration: exact frozen factory requests 32 modules/pipelines versus four, retaining all owned buffer bytes',{skip:!baselinePath},async()=>{
  const beforeText=fs.readFileSync(baselinePath,'utf8');
  assert.equal(crypto.createHash('sha256').update(beforeText).digest('hex'),'bc0198f2c21e5cb3e364b8419b997163a31cfb9fd91a19ad33628f93f3c9d21e');
  assert.equal(source.slice(source.indexOf(' const owned=[]')),beforeText.slice(beforeText.indexOf(' const owned=[]')),'Every allocation, binding, dispatch/readback, step and dispose line is unchanged');
  const old=fixture({text:beforeText}),now=fixture(),before=fakeDevice(),after=fakeDevice();
  const a=await Promise.all(Array.from({length:8},(_,i)=>create(old.E,before,old.hull(9+i))));
  const b=await Promise.all(Array.from({length:8},(_,i)=>create(now.E,after,now.hull(9+i))));
  assert.equal(before.modules.length,32);assert.equal(before.pipelines.length,32);assert.equal(after.modules.length,4);assert.equal(after.pipelines.length,4);
  assert.deepEqual(after.buffers.map(x=>x.descriptor),before.buffers.map(x=>x.descriptor));
  assert.deepEqual(after.writes.map(x=>[x.offset,x.bytes]),before.writes.map(x=>[x.offset,x.bytes]));
  for(const label of LABELS){const descriptors=before.modules.filter(x=>x.label===label);assert.equal(descriptors.length,8);for(const d of descriptors)assert.deepEqual(d,after.modules.find(x=>x.label===label));}
  a.concat(b).forEach(s=>s.dispose());
});
