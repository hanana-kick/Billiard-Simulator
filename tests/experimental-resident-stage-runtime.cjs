'use strict';
// Host doubles below test ownership, not GPU performance or WGSL parity. The
// separately gated native test executes the unchanged WGSL on a real device.
const {test}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const Graph=require('../src/experimental-arithmetic-graph'),Runtime=require('../src/experimental-stage-runtime');
const PLAN={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'sub',args:[0,1]},{kind:'mul',args:[0,1]},{kind:'negate',args:[0]},{kind:'signbitSign',args:[0]}],outputs:[2,3,4,5,6]};
const packed=(n,offset=0)=>Float32Array.from(Array.from({length:n},(_,i)=>[(i+offset+1)*.125,2]).flat());
const expected=(input,p=PLAN)=>Float32Array.from(Array.from({length:input.length/p.inputFloats},(_,i)=>[...Graph.execute(input.slice(i*p.inputFloats,(i+1)*p.inputFloats),p),1]).flat());
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fakeDevice(){
 const control={},loss=deferred(),pending=[],buffers=[],groups=[],calls={modules:0,pipelines:0,writes:0,submits:0,dispatches:0,clears:[],unmaps:0,scopes:0};
 function fail(name){if(control[name]){control[name]=false;throw Error(name);}}
 class Buffer{
  constructor(d){this.size=d.size;this.usage=d.usage;this.bytes=new ArrayBuffer(d.size);this.mapState='unmapped';this.destroyed=false;this.destroyCalls=0;this.label=d.label;}
  mapAsync(mode,offset=0,size=this.size){fail('mapSyncError');if(control.mapReject){control.mapReject=false;return Promise.reject(Error('mapReject'));}this.mapState='pending';const d=deferred();this.pending=d;const complete=()=>{if(this.destroyed)return d.reject(Error('destroyed mapping'));this.mapState='mapped';d.resolve();};if(control.holdMaps)pending.push(complete);else complete();return d.promise;}
  getMappedRange(offset=0,size=this.size){fail('rangeError');assert.equal(this.mapState,'mapped');return this.bytes.slice(offset,offset+size);}
  unmap(){fail('unmapError');calls.unmaps++;this.mapState='unmapped';this.pending?.reject(Error('mapping unmapped'));this.pending=null;}
  destroy(){fail('destroyError');this.destroyCalls++;this.destroyed=true;this.unmap();}
 }
 const device={lost:loss.promise,limits:{maxStorageBufferBindingSize:1<<24,maxBufferSize:1<<24},
  createBuffer(d){if(control.createAt===buffers.length+1)throw Error('createAt');fail('createError');const b=new Buffer(d);buffers.push(b);return b;},
  createShaderModule({code}){calls.modules++;return{code,async getCompilationInfo(){if(control.compilationHold)await control.compilationHold;return{messages:control.shaderError?[{type:'error',message:'shaderError'}]:[]};}};},
  async createComputePipelineAsync({compute}){calls.pipelines++;if(control.pipelineHold)await control.pipelineHold;fail('pipelineError');return{module:compute.module,getBindGroupLayout(){return{};}};},
  createBindGroup(d){fail('groupError');for(const e of d.entries){assert.equal(e.resource.offset,0);assert.ok(e.resource.size>0&&e.resource.size<=e.resource.buffer.size);}groups.push(d);return d;},
  pushErrorScope(){calls.scopes++;},popErrorScope(){calls.scopes--;assert.ok(calls.scopes>=0);const e=control.scopeError;control.scopeError=false;return Promise.resolve(e?{message:'scopeError'}:null);},
  queue:{writeBuffer(b,offset,a){fail('writeError');assert.equal(b.destroyed,false);calls.writes++;new Uint8Array(b.bytes,offset,a.byteLength).set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));},submit(commands){fail('submitError');calls.submits++;for(const list of commands)for(const run of list)run();}},
  createCommandEncoder(){fail('encoderError');const commands=[];return{
   clearBuffer(b,offset,size){commands.push(()=>{new Uint8Array(b.bytes,offset,size).fill(0);calls.clears.push({size,capacity:b.size});});},
   beginComputePass(){let group,workgroups;return{setPipeline(){},setBindGroup(_,g){group=g;},dispatchWorkgroups(n){workgroups=n;},end(){commands.push(()=>{
    calls.dispatches++;if(control.skipCompute)return;
    const e=group.entries.map(x=>x.resource),input=new Float32Array(e[0].buffer.bytes,0,e[0].size/4),words=new Uint32Array(e[1].buffer.bytes,0,e[1].size/4),indices=new Uint32Array(e[3].buffer.bytes,0,e[3].size/4),nodes=[];
    for(let i=0;i<words.length;i+=4){const op=Graph.OPERATIONS[words[i]],kind=op.name,args=kind==='const'?[new Float32Array(Uint32Array.of(words[i+1]).buffer)[0]]:Array.from(words.slice(i+1,i+1+op.arity));nodes.push({kind,args});}
    const width=PLAN.inputFloats,n=input.length/width,p={inputFloats:width,nodes,outputs:Array.from(indices)};assert.equal(workgroups,Math.ceil(n/32));assert.equal(e[2].size,(width+nodes.length)*n*4);assert.equal(e[4].size,(indices.length+1)*n*4);
    new Float32Array(e[4].buffer.bytes,0,e[4].size/4).set(expected(input,p));
   });}};},
   copyBufferToBuffer(a,from,b,to,size){commands.push(()=>new Uint8Array(b.bytes,to,size).set(new Uint8Array(a.bytes,from,size)));},finish(){return commands;}
  };}
 };
 return{device,control,buffers,groups,calls,flush(){pending.splice(0).forEach(fn=>fn());},lose(){loss.resolve({reason:'destroyed',message:'test loss'});}};
}
function allDestroyed(f){assert.ok(f.buffers.every(b=>b.destroyed));assert.ok(f.buffers.every(b=>b.destroyCalls===1));assert.equal(f.calls.scopes,0);}

test('resident allocations are bounded, binding ranges follow logical rows, and results stay detached',async()=>{
 const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN,{maxRows:64});
 assert.equal(f.buffers.length,2);assert.equal(stage.snapshot().capacity,0);
 const first=await stage.run(packed(35));assert.deepEqual(first,expected(packed(35)));const saved=first.slice();
 assert.equal(f.buffers.length,6);assert.equal(stage.snapshot().capacity,64);assert.equal(f.groups.length,1);
 for(const n of[1,2,35,2,1,35])assert.deepEqual(await stage.run(packed(n,4)),expected(packed(n,4)));
 assert.equal(f.buffers.length,6);assert.equal(f.groups.length,3);assert.deepEqual(first,saved);
 assert.equal(f.groups[1].entries[0].resource.size,8);assert.equal(f.groups[1].entries[4].resource.size,24);
 assert.equal(f.calls.clears[1].size,24);assert.ok(f.calls.clears[1].capacity>24);
 assert.equal(stage.snapshot().dispatches,7);assert.equal(stage.snapshot().cachedBindGroups,3);
 stage.dispose();stage.dispose();assert.equal(stage.snapshot().liveBuffers,0);allDestroyed(f);
 await assert.rejects(stage.run(packed(1)),/disposed/);
});

test('growth retires complete generations while persistent program and indices survive',async()=>{
 const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN,{maxRows:64});
 for(const n of[1,3,2,33,1])assert.deepEqual(await stage.run(packed(n)),expected(packed(n)));
 assert.equal(stage.snapshot().generations,3);assert.equal(f.buffers.length,14);assert.equal(stage.snapshot().liveBuffers,6);
 assert.equal(f.buffers[0].destroyed,false);assert.equal(f.buffers[1].destroyed,false);assert.ok(f.buffers.slice(2,10).every(b=>b.destroyed));
 stage.dispose();allDestroyed(f);
});

test('stage lease rejects overlap/dispose, snapshots offset inputs before yielding, and isolates devices',async()=>{
 const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN);f.control.holdMaps=true;
 const backing=Float32Array.of(999,.25,2,999),view=backing.subarray(1,3),pending=stage.run(view);backing[1]=42;
 assert.equal(stage.snapshot().busy,true);assert.throws(()=>stage.dispose(),/busy/);await assert.rejects(stage.run(packed(1)),/busy/);
 const other=fakeDevice(),otherStage=await Runtime.createResidentGraph(other.device,PLAN);assert.deepEqual(await otherStage.run(packed(1)),expected(packed(1)));otherStage.dispose();allDestroyed(other);
 f.flush();assert.deepEqual(await pending,expected(Float32Array.of(.25,2)));assert.equal(stage.snapshot().busy,false);
 stage.dispose();allDestroyed(f);
});

test('different stage leases on one device have independent buffers and nonoverlapping validation scopes',async()=>{
 const f=fakeDevice(),a=await Runtime.createResidentGraph(f.device,PLAN),b=await Runtime.createResidentGraph(f.device,PLAN);f.control.holdMaps=true;
 const pa=a.run(packed(1)),pb=b.run(packed(3));assert.equal(f.calls.scopes,0);assert.equal(f.buffers.length,12);f.flush();
 assert.deepEqual(await pa,expected(packed(1)));assert.deepEqual(await pb,expected(packed(3)));a.dispose();b.dispose();allDestroyed(f);
});

test('cancelled pending mapping retires its lease; pre-cancellation does not allocate; retry is fresh',async()=>{
 const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN),early=new AbortController();early.abort();
 await assert.rejects(stage.run(packed(1),{signal:early.signal}),{name:'AbortError'});assert.equal(f.buffers.length,2);
 f.control.holdMaps=true;const controller=new AbortController(),pending=stage.run(packed(3),{signal:controller.signal});controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(stage.snapshot().capacity,0);assert.equal(stage.snapshot().liveBuffers,2);assert.equal(stage.snapshot().busy,false);
 f.control.holdMaps=false;assert.deepEqual(await stage.run(packed(1,8)),expected(packed(1,8)));f.flush();
 assert.equal(stage.snapshot().generations,2);stage.dispose();allDestroyed(f);
});

test('device loss invalidates pending and idle stage leases and denies future construction',async()=>{
 const f=fakeDevice(),a=await Runtime.createResidentGraph(f.device,PLAN),b=await Runtime.createResidentGraph(f.device,PLAN);await b.run(packed(1));f.control.holdMaps=true;
 const pending=a.run(packed(2));f.lose();await assert.rejects(pending,/device lost/);await assert.rejects(b.run(packed(1)),/device lost/);
 await assert.rejects(Runtime.createResidentGraph(f.device,PLAN),/device lost/);assert.equal(a.snapshot().liveBuffers,0);assert.equal(b.snapshot().liveBuffers,0);a.dispose();b.dispose();f.flush();allDestroyed(f);
});

test('partial allocation, bind, upload, submit, mapping, validation and mapped-range failures clean up and recover',async()=>{
 for(const fault of['createAt','groupError','writeError','encoderError','submitError','mapSyncError','mapReject','scopeError','rangeError']){
  const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN);if(fault==='createAt')f.control.createAt=5;else f.control[fault]=true;
  await assert.rejects(stage.run(packed(2)),new RegExp(fault));assert.equal(stage.snapshot().busy,false,fault);assert.equal(stage.snapshot().liveBuffers,2,fault);assert.equal(stage.snapshot().capacity,0,fault);assert.equal(f.calls.scopes,0,fault);
  f.control.createAt=undefined;assert.deepEqual(await stage.run(packed(1,8)),expected(packed(1,8)),fault);stage.dispose();allDestroyed(f);
 }
});

test('growth failure retires prior generation, and incomplete dispatch cannot reuse an old success marker',async()=>{
 const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN);await stage.run(packed(1));f.control.createAt=9;
 await assert.rejects(stage.run(packed(4)),/createAt/);assert.equal(stage.snapshot().liveBuffers,2);f.control.createAt=undefined;
 await stage.run(packed(1));f.control.skipCompute=true;await assert.rejects(stage.run(packed(1)),/Incomplete/);assert.equal(stage.snapshot().capacity,0);
 f.control.skipCompute=false;assert.deepEqual(await stage.run(packed(1,4)),expected(packed(1,4)));stage.dispose();allDestroyed(f);
});

test('cleanup exceptions preserve the original failure and always release the busy lease',async()=>{
 for(const secondary of['unmapError','destroyError']){
  const f=fakeDevice(),stage=await Runtime.createResidentGraph(f.device,PLAN);f.control.rangeError=true;f.control[secondary]=true;
  await assert.rejects(stage.run(packed(1)),e=>e.message==='rangeError'&&e.cleanupError?.message===secondary);
  assert.equal(stage.snapshot().busy,false);assert.deepEqual(await stage.run(packed(1)),expected(packed(1)));stage.dispose();allDestroyed(f);
 }
});

test('device loss interrupts construction before a pending compilation completes',async()=>{
 const f=fakeDevice(),compilation=deferred();f.control.compilationHold=compilation.promise;
 const pending=Runtime.createResidentGraph(f.device,PLAN);f.lose();await assert.rejects(pending,/device lost/);assert.equal(f.buffers.length,0);compilation.resolve();allDestroyed(f);
});

test('invalid/empty input cannot acquire buffers, plans are captured, and constructor failures clean up',async()=>{
 const f=fakeDevice(),p=structuredClone(PLAN),stage=await Runtime.createResidentGraph(f.device,p,{maxRows:2});p.outputs[0]=0;p.nodes[0].kind='sub';p.inputFloats=99;
 assert.deepEqual(await stage.run(new Float32Array(0)),new Float32Array(0));assert.equal(f.buffers.length,2);
 for(const bad of[[1,2],Float32Array.of(1),packed(3),Float32Array.of(NaN,1),Float32Array.of(Infinity,1),new Float32Array(new SharedArrayBuffer(8))])await assert.rejects(stage.run(bad));
 assert.equal(f.buffers.length,2);assert.deepEqual(await stage.run(packed(1)),expected(packed(1)));stage.dispose();allDestroyed(f);
 for(const fault of['shaderError','pipelineError','createAt','writeError','scopeError']){const f=fakeDevice();f.control[fault]=fault==='createAt'?2:true;await assert.rejects(Runtime.createResidentGraph(f.device,PLAN),new RegExp(fault));allDestroyed(f);}
 const small=fakeDevice();small.device.limits.maxStorageBufferBindingSize=128;const bounded=await Runtime.createResidentGraph(small.device,PLAN,{maxRows:64});
 assert.deepEqual(await bounded.run(packed(4)),expected(packed(4)));await assert.rejects(bounded.run(packed(5)),/storage limits/);bounded.dispose();allDestroyed(small);
});

async function transient(device,plan,input){
 const module=device.createShaderModule({code:Runtime.shaderForInputFloats(plan.inputFloats)}),pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 const program=Graph.encode(plan),indices=Uint32Array.from(plan.outputs),rows=input.length/plan.inputFloats,size=rows*(plan.outputs.length+1)*4,owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};
 try{const source=make(input.byteLength,136),pb=make(program.byteLength,136),scratch=make(rows*(plan.inputFloats+plan.nodes.length)*4,128),ib=make(indices.byteLength,136),output=make(size,132),read=make(size,9);
  device.queue.writeBuffer(source,0,input);device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[source,pb,scratch,ib,output].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,size);device.queue.submit([encoder.finish()]);await read.mapAsync(1);const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();return raw;
 }finally{owned.forEach(b=>b.destroy());}
}
test('actual WGSL resident and transient dispatches match CPU and raw GPU bits across growth/shrink/reuse',{skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1',timeout:120000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE);const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice(),release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'resident arithmetic lifecycle');
 let stage;try{
  stage=await Runtime.createResidentGraph(device,PLAN,{maxRows:64});
  for(const n of[1,35,2,35,1,64,3,64]){const input=packed(n,n),actual=await stage.run(input),old=await transient(device,PLAN,input);assert.deepEqual(new Uint32Array(actual.buffer),new Uint32Array(old.buffer));assert.deepEqual(actual,expected(input));}
  const before=stage.snapshot();for(let i=0;i<50;i++)assert.deepEqual(await stage.run(packed(3,i)),expected(packed(3,i)));const after=stage.snapshot();
  assert.equal(after.buffersCreated,before.buffersCreated);assert.equal(after.bindGroupsCreated,before.bindGroupsCreated);assert.equal(after.liveBuffers,6);assert.equal(after.dispatches-before.dispatches,50);
  const abort=new AbortController(),cancelled=stage.run(packed(4),{signal:abort.signal});abort.abort();await assert.rejects(cancelled,{name:'AbortError'});
  assert.deepEqual(await stage.run(packed(1,7)),expected(packed(1,7)));
  const division={inputFloats:2,nodes:[{kind:'div',args:[0,1]}],outputs:[2]},failureStage=await Runtime.createResidentGraph(device,division,{maxRows:1});
  try{assert.deepEqual(await failureStage.run(Float32Array.of(4,2)),Float32Array.of(2,1));await assert.rejects(failureStage.run(Float32Array.of(4,0)),/Incomplete/);assert.deepEqual(await failureStage.run(Float32Array.of(8,2)),Float32Array.of(4,1));}finally{failureStage.dispose();}
  stage.dispose();assert.equal(stage.snapshot().liveBuffers,0);assert.equal(stage.snapshot().buffersCreated,stage.snapshot().buffersDestroyed);
  t.diagnostic(JSON.stringify({backend:'actual-webgpu',softwareOnly:true,bitwiseTransientParity:true,exactCpuCases:59,cancellationRecovery:true,invalidIntermediateRecovery:true,steadyStateRuns:50,newBuffersAfterWarmup:0,newBindGroupsAfterWarmup:0,dispatchesStillPerRun:1,readbacksStillPerRun:1,stats:stage.snapshot()}));
 }finally{stage?.dispose();release();}
});


test('pipeline cache is explicit, exact-device/descriptor keyed, and not program/owner keyed',async()=>{
 const f=fakeDevice(),make=(plan=PLAN,options={})=>Runtime.createResidentGraph(f.device,plan,options);
 (await make()).dispose();(await make()).dispose();assert.equal(f.calls.pipelines,2);
 const a=await make(PLAN,{reusePipelines:true}),b=await make({...PLAN,outputs:[2]},{reusePipelines:true,maxRows:3});
 assert.equal(f.calls.modules,3);assert.equal(f.calls.pipelines,3);
 assert.deepEqual(await a.run(packed(1)),expected(packed(1)));assert.deepEqual(await b.run(packed(1)),expected(packed(1),{...PLAN,outputs:[2]}));
 assert.notEqual(f.groups[0],f.groups[1]);assert.ok(f.groups[0].entries.every((e,i)=>e.resource.buffer!==f.groups[1].entries[i].resource.buffer));
 a.dispose();assert.deepEqual(await b.run(packed(1)),expected(packed(1),{...PLAN,outputs:[2]}));b.dispose();
 (await make(PLAN,{reusePipelines:true,label:'distinct'})).dispose();assert.equal(f.calls.pipelines,4);
 (await make({...PLAN,inputFloats:3,nodes:[{kind:'add',args:[0,1]}],outputs:[3]},{reusePipelines:true})).dispose();assert.equal(f.calls.pipelines,5);
 const proxy=new Proxy(f.device,{});(await Runtime.createResidentGraph(proxy,PLAN,{reusePipelines:true})).dispose();assert.equal(f.calls.pipelines,6);
 (await make()).dispose();assert.equal(f.calls.pipelines,7);allDestroyed(f);
});

test('pipeline cache deduplicates concurrent initialization but not validation scopes or buffers',async()=>{
 const f=fakeDevice(),hold=deferred();f.control.compilationHold=hold.promise;
 const a=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),b=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true});
 assert.equal(f.calls.modules,1);assert.equal(f.buffers.length,0);hold.resolve();
 const stages=await Promise.all([a,b]);assert.equal(f.calls.pipelines,1);assert.equal(f.buffers.length,4);assert.equal(f.calls.scopes,0);
 stages.forEach(s=>s.dispose());allDestroyed(f);
});

test('pipeline cache evicts failed shader and pipeline promises, allowing clean retry',async()=>{
 for(const fault of ['shaderError','pipelineError']){
  const f=fakeDevice(),hold=deferred();f.control.compilationHold=hold.promise;f.control[fault]=true;
  const a=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),b=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true});hold.resolve();
  const result=await Promise.allSettled([a,b]);assert.ok(result.every(r=>r.status==='rejected'&&r.reason.message.includes(fault)));assert.equal(f.calls.modules,1);assert.notEqual(result[0].reason,result[1].reason);result[0].reason.cleanupError=Error('owner local');assert.equal(result[1].reason.cleanupError,undefined);
  f.control[fault]=false;(await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true})).dispose();assert.equal(f.calls.modules,2);allDestroyed(f);
 }
});

test('pipeline cache retains valid immutable compilation after owner-local initialization failure',async()=>{
 const f=fakeDevice();f.control.scopeError=true;
 await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),/scopeError/);
 const stage=await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true});assert.equal(f.calls.pipelines,1);stage.dispose();allDestroyed(f);
});

test('pipeline cache bounds pending compilations and LRU retention independently',async()=>{
 const f=fakeDevice(),hold=deferred();f.control.compilationHold=hold.promise;
 const pending=[];for(let i=0;i<16;i++)pending.push(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry '+i}));
 // Repeated overflow neither compiles nor allocates; hits still join at capacity.
 for(let i=16;i<48;i++)await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry '+i}),/compilation limit/);
 pending.push(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry 0'}));assert.equal(f.calls.modules,16);assert.equal(f.buffers.length,0);
 hold.resolve();(await Promise.all(pending)).forEach(s=>s.dispose());
 (await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry 16'})).dispose();assert.equal(f.calls.modules,17);
 (await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry 0'})).dispose();assert.equal(f.calls.modules,17);
 (await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'entry 1'})).dispose();assert.equal(f.calls.modules,18);allDestroyed(f);
});

test('pipeline cache loss interrupts all compilation waiters and rejects subsequent use',async()=>{
 for(const phase of ['compilationHold','pipelineHold']){
  const f=fakeDevice(),hold=deferred();f.control[phase]=hold.promise;
  const pending=[Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true})];
  await Promise.resolve();await Promise.resolve();f.lose();
  assert.ok((await Promise.allSettled(pending)).every(r=>r.status==='rejected'&&/device lost/.test(r.reason.message)));
  await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),/device lost/);hold.resolve();allDestroyed(f);
 }
});

test('pipeline cache does not share cancellation or mutable stage state',async()=>{
 const f=fakeDevice(),a=await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true}),b=await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true});
 f.control.holdMaps=true;const abort=new AbortController(),pa=a.run(packed(1),{signal:abort.signal}),pb=b.run(packed(2));abort.abort();await assert.rejects(pa,{name:'AbortError'});f.flush();
 assert.deepEqual(await pb,expected(packed(2)));assert.equal(f.calls.pipelines,1);assert.equal(a.snapshot().capacity,0);assert.equal(b.snapshot().capacity,2);
 a.dispose();b.dispose();allDestroyed(f);
});

test('pipeline cache stale rejection cannot evict a newer matching entry',async()=>{
 const f=fakeDevice(),hold=deferred(),original=f.device.createShaderModule;let first=true;
 f.device.createShaderModule=d=>{const module=original(d);if(first){first=false;module.getCompilationInfo=()=>hold.promise;}return module;};
 const old=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'same'}),failed=assert.rejects(old,/old failure/);
 for(let i=0;i<16;i++)(await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'other '+i})).dispose();
 (await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'same'})).dispose();assert.equal(f.calls.modules,18);
 hold.reject(Error('old failure'));await failed;
 (await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'same'})).dispose();assert.equal(f.calls.modules,18);allDestroyed(f);
});

test('pipeline cache rejects ambiguous opt-in and scheduler facades without compiling',async()=>{
 const f=fakeDevice();
 await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:1}),/boolean/);
 await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:{}}),/string label/);
 const scope=Runtime.createPlanBatchScope(f.device),facade=scope.createDevice('owner');
 await assert.rejects(Runtime.createResidentGraph(facade,PLAN,{reusePipelines:true}),/not supported/);scope.dispose();assert.equal(f.calls.modules,0);allDestroyed(f);
});

test('pipeline cache admission counts evicted pending work until settlement',async()=>{
 const f=fakeDevice(),oldHold=deferred(),newHold=deferred(),original=f.device.createShaderModule;let first=true;
 f.device.createShaderModule=d=>{const module=original(d);if(first){first=false;module.getCompilationInfo=()=>oldHold.promise;}return module;};
 const old=Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'evicted pending'});
 for(let i=0;i<16;i++)(await Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'finished '+i})).dispose();
 f.control.compilationHold=newHold.promise;const pending=[];
 for(let i=0;i<15;i++)pending.push(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'pending '+i}));
 await assert.rejects(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'overflow'}),/compilation limit/);assert.equal(f.calls.modules,32);
 oldHold.resolve({messages:[]});(await old).dispose();
 pending.push(Runtime.createResidentGraph(f.device,PLAN,{reusePipelines:true,label:'overflow'}));assert.equal(f.calls.modules,33);
 newHold.resolve();(await Promise.all(pending)).forEach(s=>s.dispose());allDestroyed(f);
});
