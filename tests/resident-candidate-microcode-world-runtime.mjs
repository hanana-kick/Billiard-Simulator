// TEST ONLY lean native transport. No CPU world, oracle, source compiler or
// expected future is imported. Existing raw initialization remains unchanged;
// only the resident owner pump is replaced by fixed-budget scalar-VM chunks.
import assert from 'node:assert/strict';
import {assertSerializedRawPcRuntime} from './resident-candidate-isolated-runtime.mjs';
import {createRetainedNativePipelineCache,nativeCacheDelta} from './resident-candidate-native-session.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';

const bindings=['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'];
const positive=(n,name)=>assert.ok(Number.isSafeInteger(n)&&n>0&&n<=0xffffffff,name+' bounded positive integer');
export function assertMicrocodeWorldRuntime(plan){
 assert.equal(plan?.kind,'resident-raw-microcode-runtime-v1');
 assert.deepEqual(Object.keys(plan).sort(),['kind','original','vm','identity'].sort());
 assertSerializedRawPcRuntime(plan.original);
 const vm=plan.vm;assert.deepEqual(Object.keys(vm).sort(),['version','code','shader','instructionCount','instructionBudget','dispatchChunks','localWords','stackCapacity','entryPc','entrySlots','stride','totalWords','workgroupSize','intrinsics'].sort());
 assert.ok(['none','source-f64-v1','source-numeric-v1','source-continuations-v1'].includes(vm.intrinsics),'explicit intrinsic profile');assert.ok([1,64].includes(vm.workgroupSize),'explicit candidate SIMD width');
 assert.equal(vm.version,I.version);assert.ok(vm.code instanceof Uint32Array);assert.equal(vm.code.length,vm.instructionCount*I.instructionWords);assert.equal(typeof vm.shader,'string');assert.ok(vm.shader.length>0&&vm.shader.length<131072,'compact primitive shader, not compiled whole source');
 for(const key of['instructionCount','instructionBudget','dispatchChunks','localWords','stackCapacity','stride','totalWords'])positive(vm[key],key);
 assert.ok(vm.instructionBudget<=1048576&&vm.dispatchChunks<=65536,'explicit bounded transport request');
 assert.ok(Number.isInteger(vm.entryPc)&&vm.entryPc>=0&&vm.entryPc<vm.instructionCount);assert.equal(vm.stride,I.control.words+vm.localWords+vm.stackCapacity);assert.equal(vm.totalWords,vm.stride*plan.original.count);
 assert.equal(vm.entrySlots.length,3);assert.equal(vm.entrySlots[0].candidateStride,1);assert.deepEqual(vm.entrySlots.slice(1).map(x=>x.value),[0,0]);
 assert.deepEqual(Object.keys(plan.identity).sort(),['originalGeneration','sourceSha256','bytecodeSha256','vmShaderSha256'].sort());assert.equal(plan.identity.originalGeneration,plan.original.identity.generationIdentity);for(const key of['sourceSha256','bytecodeSha256','vmShaderSha256'])assert.match(plan.identity[key],/^[a-f0-9]{64}$/);
 return plan;
}

/** The caller owns the one globally serialized numerical slot and live device.
 * Every run is independently initialized. Pipeline caching alone is shared.
 * Fixed chunk count is a transport budget, never a physics miss/horizon result.
 * World and VM diagnostics are copied/mapped only after ALL submitted work.
 */
export async function runMicrocodeWorld({owner,cache=createRetainedNativePipelineCache(owner),plan,trace=()=>{}}){
 assertMicrocodeWorldRuntime(plan);const {original:p,vm}=structuredClone(plan),{init,pc,count}=p,device=owner.device,resources=new Map(),owned=[],before=cache.stats();let scoped=true,submitted=false;
 assert.ok(device.limits.maxStorageBuffersPerShaderStage>=7,'seven actual storage bindings required');assert.ok(vm.workgroupSize<=device.limits.maxComputeInvocationsPerWorkgroup&&vm.workgroupSize<=device.limits.maxComputeWorkgroupSizeX,'actual candidate workgroup capacity');
 const stats={dispatches:0,submissions:0,initialWrites:0,copies:0,mappings:0,encodeWallMs:0,submitWallMs:0,queueDrainWallMs:0,executionGroups:[]};
 const allocate=(name,words,usage=128|8|4)=>{positive(words,name);const size=words*4;assert.ok(size<=device.limits.maxBufferSize,name+' max buffer');if(usage&128)assert.ok(size<=device.limits.maxStorageBufferBindingSize,name+' max storage binding');const buffer=device.createBuffer({size,usage,label:name});owned.push(buffer);const row={buffer,words};resources.set(name,row);return row;};
 const write=(name,at,data)=>{const r=resources.get(name);assert.ok(r&&data instanceof Uint32Array&&at>=0&&at+data.length<=r.words);device.queue.writeBuffer(r.buffer,at*4,data);stats.initialWrites++;};
 const submit=async encoder=>{let at=performance.now();device.queue.submit([encoder.finish()]);submitted=true;stats.submissions++;stats.submitWallMs+=performance.now()-at;at=performance.now();await device.queue.onSubmittedWorkDone();stats.queueDrainWallMs+=performance.now()-at;};
 const dispatch=async(stages)=>{let encoder,pass,n=0;const flush=async()=>{if(!n)return;pass.end();await submit(encoder);n=0;};for(const s of stages){const at=performance.now();if(!n){encoder=device.createCommandEncoder();pass=encoder.beginComputePass();}pass.setPipeline(s.pipeline);pass.setBindGroup(0,s.group);pass.dispatchWorkgroups(s.workgroups);stats.dispatches++;n++;stats.encodeWallMs+=performance.now()-at;if(n===1024)await flush();}await flush();};
 const group=async(name,fn)=>{const before={...stats},at=performance.now();await fn();const row={name,wallMs:performance.now()-at,...Object.fromEntries(['dispatches','submissions','encodeWallMs','submitWallMs','queueDrainWallMs'].map(k=>[k,stats[k]-before[k]]))};stats.executionGroups.push(row);trace({stage:'execution-group-ready',...row,timingKind:'host-wall-not-gpu-timestamp'});};
 device.pushErrorScope('validation');
 try{
  const descriptors=[{name:'microcode begin',code:vm.shader,bindingTypes:bindings,entryPoint:'begin'},{name:'microcode bounded pump',code:vm.shader,bindingTypes:bindings,entryPoint:'main'},{...pc.begin,bindingTypes:pc.bindingTypes},...Object.entries(init.stages).map(([name,s])=>({...s,name:'initialize '+name}))];
  await cache.validateAll(descriptors);
  allocate('scratch',init.scratchAlias.words);
  for(const[name,initial]of Object.entries(init.resources)){
   if(name==='rawScratch'||name==='numericScratch'){resources.set(name,resources.get('scratch'));continue;}
   const value=name==='worldState'?pc.totalStateWords:name==='worldProgram'?p.program:initial;
   allocate(name,typeof value==='number'?value:value.length);if(value instanceof Uint32Array)write(name,0,value);
  }
  allocate('worldGeometry',p.sharedGeometry.length);write('worldGeometry',0,p.sharedGeometry);write('inputs',0,p.input);for(const u of init.initialUploads)write(u.resource,u.offsetWords,u.data);
  allocate('microcode',vm.code.length);write('microcode',0,vm.code);allocate('vmState',vm.totalWords);
  const read=allocate('final-only-diagnostics',pc.totalStateWords+vm.totalWords,1|8);
  const stage=async(descriptor,names,workgroups)=>{const compiled=await cache.compile(descriptor);return{pipeline:compiled.pipeline,group:device.createBindGroup({layout:compiled.groupLayout,entries:names.map((name,binding)=>({binding,resource:{buffer:resources.get(name).buffer}}))}),workgroups};};
  const names=['worldState','worldProgram','worldGeometry','scratch','inputs'],vmNames=[...names,'microcode','vmState'];
  const beginVm=await stage(descriptors[0],vmNames,Math.ceil(count/vm.workgroupSize)),pumpVm=await stage(descriptors[1],vmNames,Math.ceil(count/vm.workgroupSize)),beginWorld=await stage(descriptors[2],names,count),initial={};
  for(const[name,s]of Object.entries(init.stages))initial[name]=await stage({...s,name:'initialize '+name},s.resources,s.workgroups);
  // Initial uploads are now sealed. There is no write path in either phase.
  await device.queue.onSubmittedWorkDone();
  const executionAt=performance.now();
  await group('initialize',()=>dispatch((function*(){for(const c of init.commands)for(let n=0;n<c.repeat;n++)yield initial[c.stage];yield beginWorld;yield beginVm;})()));
  await group('pump',()=>dispatch((function*(){for(let n=0;n<vm.dispatchChunks;n++)yield pumpVm;})()));
  const at=performance.now(),encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(resources.get('worldState').buffer,0,read.buffer,0,pc.totalStateWords*4);encoder.copyBufferToBuffer(resources.get('vmState').buffer,0,read.buffer,pc.totalStateWords*4,vm.totalWords*4);stats.copies+=2;await submit(encoder);
  await read.buffer.mapAsync(1);stats.mappings++;const all=new Uint32Array(read.buffer.getMappedRange().slice(0));read.buffer.unmap();stats.readbackWallMs=performance.now()-at;
  const validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'microcode world native validation');stats.cache=nativeCacheDelta(cache.stats(),before);stats.steadyEndToEndWallMs=performance.now()-executionAt;stats.steadyEndToEndScope='after compilation/bindings/upload drain through initialization, pump, final diagnostics map and validation';
  const words=all.slice(0,pc.totalStateWords),vmWords=all.slice(pc.totalStateWords),controls=Array.from({length:count},(_,i)=>Array.from(vmWords.slice(i*vm.stride,i*vm.stride+I.control.words)));
  trace({stage:'microcode-final-mapped',controls,hostStateContinuation:false,sourceParity:'pending'});
  return{words,vmWords,controls,stats};
 }finally{if(scoped)await device.popErrorScope();if(submitted)try{await device.queue.onSubmittedWorkDone();}catch{}for(const buffer of owned){try{buffer.unmap();}catch{}buffer.destroy();}}
}
