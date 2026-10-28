// TEST ONLY genuine initial fixture plus noncomputing WebGPU lifecycle double.
import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {createInitialMicrocodeRuntime} from '../src/resident-candidate/initial-microcode-runtime.mjs';
const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};let pending;
export const fixture=()=>pending??=(async()=>{const f=await originalRegisteredFixture(),plan=await createWorldInitializationPlan({decoder:f.decoder,input:f.raw,rule:{cueId:2,firstId:3,secondId:4,opponentId:1,method:'none',threeCushion:false,allowKiss:true,maxOuterSteps:15360}});const rows=Array.from({length:6},(_,i)=>({id:17+i*101,settings:{...settings}}));const runtime=createInitialMicrocodeRuntime(plan,rows,{experimental:true,maxHSteps:2,dispatchChunks:2});return{runtime,rows,plan};})();
export const identityFor=r=>Object.fromEntries(['sourceIdentity','preStrikeIdentity','generationIdentity'].map(k=>[k,r.original.identity[k]]));
export const optionsFor=(r,extra={})=>({macroWorkgroupSize:8,identity:identityFor(r),getIdentity:()=>identityFor(r),...extra});
export const LIMITS={maxStorageBufferBindingSize:128*1024*1024,maxBufferSize:256*1024*1024,maxStorageBuffersPerShaderStage:8,maxBindingsPerBindGroup:8,maxBindGroups:4,maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupsPerDimension:65535};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{resolve,reject,promise};};
export function fakeDevice({rows=[],limits={},hooks={}}={}){
 const loss=deferred(),log={buffers:[],preflights:[],pipelines:[],submissions:[],copies:[],maps:[],writes:[],waits:0,scopes:0,groups:[],destroyDevice:0},device={limits:{...LIMITS,...limits},lost:loss.promise};
 device.pushErrorScope=()=>{log.scopes++;};device.popErrorScope=async()=>{assert.ok(log.scopes>0);log.scopes--;return await hooks.scope?.(log)??null;};
 device.createShaderModule=({code,label})=>({code,label,async getCompilationInfo(){log.preflights.push(label);await hooks.preflight?.(label,log);return{messages:hooks.shaderErrors?.(label)??[]};}});
 device.createBindGroupLayout=x=>x;device.createPipelineLayout=x=>x;device.createComputePipelineAsync=async d=>{assert.ok(log.preflights.length>=26,'all unique module preflights before pipelines');log.pipelines.push(d.label);await hooks.pipeline?.(d.label,log);return{...d,code:d.compute.module.code};};
 device.createBuffer=d=>{hooks.beforeAllocate?.(d,log);const b={...d,data:new Uint8Array(d.size),destroyed:false,mapped:false,destroy(){this.destroyed=true;this.data=new Uint8Array(0);},unmap(){this.mapped=false;},async mapAsync(){assert.ok(!this.destroyed);log.maps.push({name:this.label,size:this.size});await hooks.map?.(this,log);this.mapped=true;},getMappedRange(){assert.ok(this.mapped);return this.data.buffer;}};log.buffers.push(b);hooks.allocate?.(b,log);return b;};
 device.createBindGroup=d=>{for(const e of d.entries){assert.ok(e.resource.buffer);assert.equal(e.resource.offset,0);assert.equal(e.resource.size,e.resource.buffer.size,'exact logical view, not physical suffix');}log.groups.push(d);return d;};
 device.createCommandEncoder=()=>{const commands=[];return{beginComputePass(){let pipeline,group;return{setPipeline:p=>pipeline=p,setBindGroup:(_,g)=>group=g,dispatchWorkgroups:n=>commands.push({type:'compute',pipeline,group,n}),end(){}};},copyBufferToBuffer:(from,fo,to,toff,n)=>commands.push({type:'copy',from,fo,to,toff,n}),finish:()=>commands};};
 device.queue={writeBuffer(buffer,offset,data){assert.ok(log.buffers.filter(b=>!b.destroyed).length===13,'ALL source/output allocations precede first upload');const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);buffer.data.set(bytes,offset);log.writes.push({name:buffer.label,offset,bytes:bytes.length});hooks.write?.(log);},submit(lists){const commands=lists.flat();log.submissions.push({dispatches:commands.filter(c=>c.type==='compute').length,labels:commands.filter(c=>c.type==='compute').map(c=>c.pipeline.label)});for(const c of commands){if(c.type==='copy'){c.to.data.set(c.from.data.subarray(c.fo,c.fo+c.n),c.toff);log.copies.push({from:c.from.label,to:c.to.label,bytes:c.n});}else if(c.pipeline.label==='initial microcode compact publication'){
 // Transport injection ONLY, not execution of any WGSL/physics. Separate tests
 // interpret the actual emitted integer publisher, never this fake shader.
 const result=c.group.entries[4].resource.buffer;new Uint32Array(result.data.buffer).set(rows.flat());
 }}hooks.submit?.(log);},async onSubmittedWorkDone(){log.waits++;await hooks.wait?.(log.waits,log);}};
 device.destroy=()=>{log.destroyDevice++;};return{device,log,lose:info=>loss.resolve(info??{reason:'unknown',message:'TEST loss'}),loss};
}
export function released(log){assert.equal(log.scopes,0);assert.ok(log.buffers.every(b=>b.destroyed));assert.equal(log.destroyDevice,0,'borrowed device not destroyed');}
