// HOST MOCK LIFETIME CHECK ONLY. Does not execute or qualify GPU/physics.
import assert from 'node:assert/strict';
import test from 'node:test';
import{createParallelIntegerTransport}from'../src/canonical-integer-transport/parallel-runner.mjs';
import{compileMicrocodeWGSL}from'../src/resident-candidate/microcode-compiler.mjs';
globalThis.GPUBufferUsage={STORAGE:128,COPY_SRC:4,COPY_DST:8,MAP_READ:1};globalThis.GPUShaderStage={COMPUTE:4};globalThis.GPUMapMode={READ:1};
const device={limits:{maxStorageBuffersPerShaderStage:10},createBuffer({size,usage}){return{size,usage,destroyed:false,destroy(){this.destroyed=true},async mapAsync(){},unmap(){},getMappedRange(_offset=0,size=this.size){const a=new Uint32Array(size/4);for(let i=0;i<a.length;i+=4)a[i]=2;return a.buffer}}},createBindGroupLayout(){return{}},createPipelineLayout(){return{}},createShaderModule(){return{async getCompilationInfo(){return{messages:[]}}}},async createComputePipelineAsync(){return{}},createBindGroup({entries}){for(const e of entries)assert(!e.resource.buffer.destroyed,'BUG: binding destroyed pooled buffer');return{}},createCommandEncoder(){return{beginComputePass(){return{setBindGroup(){},setPipeline(){},dispatchWorkgroups(){},end(){}}},copyBufferToBuffer(){},finish(){return{}}}},queue:{writeBuffer(b){assert(!b.destroyed,'BUG: writing destroyed pooled buffer')},submit(){},async onSubmittedWorkDone(){}}};
test('HOST MOCK ONLY: rejected pool growth preserves prior buffers and aggregate byte ceiling',async()=>{
const c=compileMicrocodeWGSL('@group(0) @binding(0) var<storage,read_write> out:array<u32>; @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){var a:array<u32,128>;a[0u]=gid.x;out[0u]=a[0u];}',{sourceStoragePolicy:[{name:'out',binding:0,scalar:'u32',access:'read_write'}]});
const vm=await createParallelIntegerTransport(device,{arenaWords:1,atomicWords:1});const views=[{binding:0,offset:0,length:1}];await vm.execute(c,views,{globalSize:[1,1,1]});await assert.rejects(()=>vm.execute(c,views,{globalSize:[65536,1,1]}),/eight MiB/);const before=vm.ownedBytes;assert((await vm.execute(c,views,{globalSize:[1,1,1]})).complete);assert.equal(vm.ownedBytes,before);assert(vm.ownedBytes<=8*1024*1024);await vm.dispose();assert.equal(vm.ownedBytes,0);
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
function observedDevice(){const buffers=[];const d={...device,queue:{...device.queue},createBuffer(desc){const b=device.createBuffer(desc);buffers.push(b);return b;}};return{d,buffers};}
test('HOST MOCK ONLY: constructor rejection destroys every already-owned buffer',async()=>{
 const {d,buffers}=observedDevice();d.createComputePipelineAsync=async()=>{throw Error('pipeline rejected')};await assert.rejects(()=>createParallelIntegerTransport(d,{arenaWords:1,atomicWords:1}),/pipeline rejected/);assert.equal(buffers.length,4);assert(buffers.every(b=>b.destroyed));
});
test('HOST MOCK ONLY: readback locks uploads and disposal through pending fence and cleans read failure',async()=>{
 const {d,buffers}=observedDevice(),vm=await createParallelIntegerTransport(d,{arenaWords:1,atomicWords:1}),fence=deferred();d.queue.onSubmittedWorkDone=()=>fence.promise;
 const reading=vm.readback();assert.throws(()=>vm.upload(Uint32Array.of(1)),/busy/);await assert.rejects(()=>vm.dispose(),/executing/);assert(!buffers.some(b=>b.destroyed));
 fence.resolve();await reading;assert(buffers.at(-1).destroyed);d.queue.onSubmittedWorkDone=async()=>{};vm.upload(Uint32Array.of(1));await vm.dispose();assert(buffers.every(b=>b.destroyed));
});
test('HOST MOCK ONLY: disposal locks concurrent use and releases buffers even when fence rejects',async()=>{
 const {d,buffers}=observedDevice(),vm=await createParallelIntegerTransport(d,{arenaWords:1,atomicWords:1}),fence=deferred();d.queue.onSubmittedWorkDone=()=>fence.promise;
 const disposing=vm.dispose();assert.throws(()=>vm.upload(Uint32Array.of(1)),/busy/);await assert.rejects(()=>vm.readback(),/busy/);fence.reject(Error('device lost'));await assert.rejects(()=>disposing,/device lost/);assert(buffers.every(b=>b.destroyed));assert.equal(vm.ownedBytes,0);assert.throws(()=>vm.upload(Uint32Array.of(1)),/Closed/);await vm.dispose();
});
test('HOST MOCK ONLY: map failure releases transient readback and unlocks owner',async()=>{
 const {d,buffers}=observedDevice(),vm=await createParallelIntegerTransport(d,{arenaWords:1,atomicWords:1}),before=vm.ownedBytes;const make=d.createBuffer.bind(d);d.createBuffer=desc=>{const b=make(desc);b.mapAsync=async()=>{throw Error('map rejected')};return b;};await assert.rejects(()=>vm.readback(),/map rejected/);assert(buffers.at(-1).destroyed);assert.equal(vm.ownedBytes,before);vm.upload(Uint32Array.of(1));await vm.dispose();
});
