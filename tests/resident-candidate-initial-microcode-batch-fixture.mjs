// HOST ONLY genuine no-step source construction + noncomputing lifecycle double.
import assert from 'node:assert/strict';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {createInitialMicrocodeRuntime} from '../src/resident-candidate/initial-microcode-runtime.mjs';
import {createInitialMicrocodeBatchPlan} from '../src/resident-candidate/initial-microcode-batch-plan.mjs';
import {STATUS,REASON,UNSET} from '../src/resident-candidate/abi.mjs';
export const LIMITS={maxStorageBufferBindingSize:128*1024*1024,maxBufferSize:256*1024*1024,maxStorageBuffersPerShaderStage:8,maxBindingsPerBindGroup:8,maxBindGroups:4,maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256,maxComputeWorkgroupsPerDimension:65535};
const rule={cueId:2,firstId:3,secondId:4,opponentId:1,method:'none',threeCushion:false,allowKiss:true,maxOuterSteps:15360};let initialPending,smallPending;
export const initial=()=>initialPending??=(async()=>{const f=await originalRegisteredFixture(),initialization=await createWorldInitializationPlan({decoder:f.decoder,input:f.raw,rule});return{...f,initialization};})();
export const rows=(start,count)=>Array.from({length:count},(_,i)=>({id:start+i,settings:{angle:(i*17)%360,elevation:8,speed:2,tipX:0,tipY:0}}));
export const runtime=(initialization,start,count,{maxHSteps=2,dispatchChunks=2}={})=>createInitialMicrocodeRuntime(initialization,rows(start,count),{experimental:true,maxHSteps,dispatchChunks});
export const planOptions=(runtimes,extra={})=>({orderedIds:runtimes.flatMap(r=>r.original.identity.rawRows.map(x=>x.id)),count:runtimes.reduce((n,r)=>n+r.original.count,0),macroWorkgroupSize:8,limits:LIMITS,maxLiveBytes:512*1024*1024,...extra});
export const fixture=()=>smallPending??=(async()=>{const f=await initial(),runtimes=[runtime(f.initialization,10,2),runtime(f.initialization,20,2,{dispatchChunks:3})],plan=createInitialMicrocodeBatchPlan(runtimes,planOptions(runtimes));return{...f,runtimes,plan};})();
export const optionsFor=(plan,extra={})=>({identity:plan.identity,getIdentity:()=>plan.identity,...extra});
export function fakeBatchDevice(plan,{hooks={},rowFor,limits={}}={}){
 let lose;const lost=new Promise(r=>lose=r),log={buffers:[],preflights:[],pipelines:[],writes:[],maps:[],copies:[],submissions:0,waits:0,scopes:0,dispatches:0,counts:new Map(),tail:[],runs:[],destroyDevice:0},device={limits:{...LIMITS,...limits},lost};
 const preflightSources=new Set(),requiredSources=new Set(plan.banks.flatMap(b=>b.descriptors.map(d=>d.code)));
 const allLive=()=>{assert.equal(log.buffers.filter(b=>!b.destroyed).length,plan.allocations.length,'ALL banks allocated before any upload/dispatch/map');};
 device.pushErrorScope=()=>{log.scopes++;};device.popErrorScope=async()=>{assert.ok(log.scopes>0);log.scopes--;return await hooks.scope?.(log)??null;};
 device.createShaderModule=({code,label})=>({code,label,async getCompilationInfo(){log.preflights.push(label);preflightSources.add(code);await hooks.preflight?.(label,log);return{messages:hooks.shaderErrors?.(label)??[]};}});
 device.createBindGroupLayout=x=>x;device.createPipelineLayout=x=>x;device.createComputePipelineAsync=async d=>{assert.equal(preflightSources.size,requiredSources.size,'ALL unique sources preflight before any pipeline');log.pipelines.push(d.label);await hooks.pipeline?.(d.label,log);return{...d,code:d.compute.module.code};};
 device.createBuffer=d=>{hooks.beforeAllocate?.(d,log);const b={...d,data:new Uint8Array(d.size),destroyed:false,mapped:false,destroy(){this.destroyed=true;this.data=new Uint8Array(0);hooks.destroy?.(this,log);},unmap(){this.mapped=false;},async mapAsync(){allLive();assert.ok(!this.destroyed);log.maps.push({name:this.label,size:this.size});await hooks.map?.(this,log);this.mapped=true;},getMappedRange(){assert.ok(this.mapped);return this.data.buffer;}};log.buffers.push(b);hooks.allocate?.(b,log);return b;};
 device.createBindGroup=d=>{for(const e of d.entries){assert.ok(e.resource.buffer);assert.equal(e.resource.offset,0);assert.equal(e.resource.size,e.resource.buffer.size);}return d;};
 device.createCommandEncoder=()=>{const commands=[];return{beginComputePass(){let pipeline,group;return{setPipeline:p=>pipeline=p,setBindGroup:(_,g)=>group=g,dispatchWorkgroups:n=>commands.push({type:'compute',pipeline,group,n}),end(){}};},copyBufferToBuffer:(from,fo,to,toff,n)=>commands.push({type:'copy',from,fo,to,toff,n}),finish:()=>commands};};
 device.queue={writeBuffer(buffer,offset,data){allLive();buffer.data.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);log.writes.push({name:buffer.label,offset,bytes:data.byteLength});hooks.write?.(log);},submit(lists){allLive();log.submissions++;for(const c of lists.flat()){if(c.type==='copy'){c.to.data.set(c.from.data.subarray(c.fo,c.fo+c.n),c.toff);log.copies.push({from:c.from.label,to:c.to.label,offset:c.toff,bytes:c.n});}else{const bank=Number(c.group.entries[0].resource.buffer.label.split(' ')[2].split(':')[0]),label=c.pipeline.label,key=bank+':'+label;log.dispatches++;log.counts.set(key,(log.counts.get(key)??0)+1);log.tail.push({bank,label});if(log.tail.length>32)log.tail.shift();const last=log.runs.at(-1);if(last?.key===key)last.count++;else log.runs.push({key,count:1});if(label==='initial microcode compact publication'){
 // Explicit TEST transport injection; no source WGSL/physics executes here.
 const b=plan.banks[bank],result=c.group.entries[4].resource.buffer,words=b.runtime.original.identity.rawRows.flatMap((row,i)=>rowFor?.(bank,row,i)??[row.id,STATUS.INCOMPLETE,UNSET,REASON.HORIZON]);new Uint32Array(result.data.buffer).set(words);
 }}}hooks.submit?.(log);},async onSubmittedWorkDone(){log.waits++;await hooks.wait?.(log.waits,log);}};
 device.destroy=()=>{log.destroyDevice++;};return{device,log,lose:info=>lose(info??{reason:'unknown',message:'TEST loss'})};
}
export function released(log){assert.equal(log.scopes,0);assert.ok(log.buffers.every(b=>b.destroyed));assert.equal(log.destroyDevice,0);}
