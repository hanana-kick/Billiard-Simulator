/** Host lifecycle only: deliberately no GPU/CPU physics is evaluated. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixtures/canonical-selected-source.mjs';
import {createCanonicalCandidate} from '../src/direct-candidate/canonical-engine-contract.mjs';
import {createExperimentalLiveWorldBatchGPU} from '../src/direct-candidate/experimental-live-world-batch.mjs';
function fakeDevice(){
 const buffers=[],groups=[];let pipelineId=0,throwWorld=false,onDone=()=>{},submits=0;
 const device={lost:new Promise(()=>{}),limits:{maxBufferSize:268435456,maxStorageBufferBindingSize:134217728,maxBindGroups:4,maxBindingsPerBindGroup:1000,maxStorageBuffersPerShaderStage:10,maxComputeWorkgroupsPerDimension:65535,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupSizeY:256,maxComputeWorkgroupSizeZ:64,maxComputeInvocationsPerWorkgroup:256,minStorageBufferOffsetAlignment:256},pushErrorScope(){},async popErrorScope(){return null;},createShaderModule(){return{async getCompilationInfo(){return{messages:[]};}};},createBindGroupLayout:x=>x,createPipelineLayout:x=>x,
 async createComputePipelineAsync(){const id=pipelineId++,layout={id};return{id,getBindGroupLayout:()=>layout};},
 createBuffer({size,usage}){const b={size,usage,dead:false,bytes:new ArrayBuffer(size),destroy(){b.dead=true;},async mapAsync(){},getMappedRange(){return b.bytes;},unmap(){}};buffers.push(b);return b;},
 createBindGroup({layout,entries}){if(throwWorld&&layout.id===0)throw Error('Injected world binding failure');for(const e of entries)assert.equal(e.resource.buffer.dead,false);const g={layout,entries:entries.map(e=>({...e,resource:{...e.resource}}))};groups.push(g);return g;},
 createCommandEncoder(){return{beginComputePass(){return{setPipeline(){},setBindGroup(i,g){for(const e of g.entries)assert.equal(e.resource.buffer.dead,false,'Never use a group from a disposed run');},dispatchWorkgroups(){},end(){}};},clearBuffer(){},copyBufferToBuffer(){},finish(){return{};}};},
 queue:{writeBuffer(){},submit(){submits++;},async onSubmittedWorkDone(){onDone();}}
 };return{device,buffers,groups,setThrow:x=>{throwWorld=x;},setDone:x=>{onDone=x;},get submits(){return submits;}};
}
for(const n of [1,3])test('N'+n+' host runs reuse within run and release all buffers on success/error/cancel',async()=>{
 const f=fixture(),fake=fakeDevice(),candidates=Array.from({length:n},(_,i)=>createCanonicalCandidate(f.request,100+i,f.candidate.settings));
 const engine=await createExperimentalLiveWorldBatchGPU(fake.device,{binding:f.binding,rawBinding:f.batch.binding,candidates});
 const first=await engine.run({diagnostic:true});assert.ok(first.metrics.bindGroups.reused>1000);assert.ok(first.metrics.bindGroups.created<1000);assert.ok(fake.buffers.every(b=>b.dead));const priorGroups=new Set(fake.groups),groupCount=fake.groups.length;
 const second=await engine.run({diagnostic:true});assert.deepEqual(second.metrics.bindGroups,first.metrics.bindGroups);assert.ok(fake.groups.slice(groupCount).every(g=>!priorGroups.has(g)));assert.ok(fake.buffers.every(b=>b.dead));
 fake.setThrow(true);await assert.rejects(()=>engine.run({diagnostic:true}),/Injected world binding failure/);assert.ok(fake.buffers.every(b=>b.dead));fake.setThrow(false);
 const abort=new AbortController();fake.setDone(()=>abort.abort());await assert.rejects(()=>engine.run({diagnostic:true,signal:abort.signal}),{name:'AbortError'});assert.ok(fake.buffers.every(b=>b.dead));fake.setDone(()=>{});
 const after=await engine.run({diagnostic:true});assert.deepEqual(after.metrics.bindGroups,first.metrics.bindGroups);assert.ok(fake.buffers.every(b=>b.dead));
});
