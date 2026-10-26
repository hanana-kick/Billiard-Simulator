// TEST ONLY lean native transport. No CPU world, oracle, source compiler or
// expected future is imported. Existing raw initialization remains unchanged;
// only the resident owner pump is replaced by fixed-budget scalar-VM chunks.
import assert from 'node:assert/strict';
import {assertSerializedRawPcRuntime,assertSerializedRawPcRecurrenceRuntime} from './resident-candidate-isolated-runtime.mjs';
import {createRetainedNativePipelineCache,nativeCacheDelta} from './resident-candidate-native-session.mjs';
import {MICROCODE_ISA as I,microcodeUsedIntrinsicFunctions} from '../src/resident-candidate/microcode-isa.mjs';

const bindings=['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'];
const positive=(n,name)=>assert.ok(Number.isSafeInteger(n)&&n>0&&n<=0xffffffff,name+' bounded positive integer');
export function assertMicrocodeWorldRuntime(plan){return assertMicrocodeRuntime(plan,'resident-raw-microcode-runtime-v1',assertSerializedRawPcRuntime);}
export function assertMicrocodeWorldRecurrenceRuntime(plan){return assertMicrocodeRuntime(plan,'resident-raw-microcode-recurrence-runtime-v1',assertSerializedRawPcRecurrenceRuntime);}
function assertAdmittedMicrocodeRuntime(plan){return plan?.kind==='resident-raw-microcode-recurrence-runtime-v1'?assertMicrocodeWorldRecurrenceRuntime(plan):assertMicrocodeWorldRuntime(plan);}
function assertMicrocodeRuntime(plan,kind,assertOriginal){
 assert.equal(plan?.kind,kind);
 assert.deepEqual(Object.keys(plan).sort(),['kind','original','vm','identity'].sort());
 assertOriginal(plan.original);
 const vm=plan.vm,explicitMode=Object.hasOwn(vm,'controlMode'),explicitDisjoint=Object.hasOwn(vm,'vmStateDisjoint');assert.equal(explicitMode,explicitDisjoint,'complete VM control/disjointness contract');if(explicitMode){assert.ok(['storage-v1','invocation-cache-v1'].includes(vm.controlMode),'known VM control mode');assert.equal(typeof vm.vmStateDisjoint,'boolean','explicit VM disjointness boolean');if(vm.controlMode==='invocation-cache-v1')assert.equal(vm.vmStateDisjoint,true,'cached VM requires disjoint source banks');}assert.deepEqual(Object.keys(vm).sort(),['version','code','shader','instructionCount','instructionBudget','dispatchChunks','localWords','stackCapacity','entryPc','entrySlots','stride','totalWords','workgroupSize','intrinsics','intrinsicFunctions','externalFunctions','handlers',...(explicitMode?['controlMode','vmStateDisjoint']:[])].sort());
 assert.ok(['none','source-f64-v1','source-numeric-v1','source-continuations-v1'].includes(vm.intrinsics),'explicit intrinsic profile');assert.ok([1,64].includes(vm.workgroupSize),'explicit candidate SIMD width');
 assert.equal(vm.version,I.version);assert.ok(vm.code instanceof Uint32Array);assert.equal(vm.code.length,vm.instructionCount*I.instructionWords);assert.equal(typeof vm.shader,'string');assert.ok(vm.shader.length>0&&vm.shader.length<131072,'compact primitive shader, not compiled whole source');
 assert.ok(Array.isArray(vm.intrinsicFunctions));assert.deepEqual(vm.intrinsicFunctions,[...microcodeUsedIntrinsicFunctions(vm.code)],'native helper roots exactly match immutable emitted opcodes');
 for(const key of['instructionCount','instructionBudget','dispatchChunks','localWords','stackCapacity','stride','totalWords'])positive(vm[key],key);
 assert.ok(vm.instructionBudget<=1048576&&vm.dispatchChunks<=65536,'explicit bounded transport request');
 assert.ok(Number.isInteger(vm.entryPc)&&vm.entryPc>=0&&vm.entryPc<vm.instructionCount);assert.equal(vm.stride,I.control.words+vm.localWords+vm.stackCapacity);assert.equal(vm.totalWords,vm.stride*plan.original.count);
 assert.equal(vm.entrySlots.length,3);assert.equal(vm.entrySlots[0].candidateStride,1);assert.deepEqual(vm.entrySlots.slice(1).map(x=>x.value),[0,0]);
 assert.ok(Array.isArray(vm.externalFunctions)&&Array.isArray(vm.handlers),'explicit external macro descriptors/handlers');
 const macroNames=['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision'],ids=new Set(),pcs=new Set();
 for(const d of vm.externalFunctions){
  assert.ok(Number.isInteger(d.id)&&d.id>=0&&d.id<macroNames.length&&!ids.has(d.id),'unique production macro ID');ids.add(d.id);assert.equal(d.name,macroNames[d.id]);assert.ok(Number.isInteger(d.entryPc)&&d.entryPc>=0&&d.entryPc+1<vm.instructionCount&&!pcs.has(d.entryPc),'unique external stub PC');pcs.add(d.entryPc);
  assert.equal(d.params.length,[8,2,3][d.id]);for(const a of d.params){assert.equal(a.words,1);assert.ok(Number.isInteger(a.slot)&&a.slot>=0&&a.slot<vm.localWords,'external parameter slot');}assert.equal(d.returnWords,d.id===2?0:1);if(d.returnWords===0)assert.equal(d.returnSlot,0,'void source macro has no return slot');else assert.ok(Number.isInteger(d.returnSlot)&&d.returnSlot>=0&&d.returnSlot<vm.localWords,'external return slot');
  assert.equal(d.approval?.id,d.id);assert.equal(d.approval?.name,d.name);for(const key of['signatureSha256','bodySha256','closureSha256','nativeSourceSha256'])assert.match(d.approval[key],/^[a-f0-9]{64}$/,'source-bound macro '+key);
  assert.deepEqual([...vm.code.subarray(d.entryPc*8,d.entryPc*8+16)],[I.opcodes.EXTERNAL_CALL,0,d.id,0,0,0,0,0,I.opcodes.RET,0,0,0,0,0,0,0],'exact immutable external stub/RET');
 }
 for(let pc=0;pc<vm.instructionCount;pc++)if(vm.code[pc*8]===I.opcodes.EXTERNAL_CALL)assert.ok(vm.externalFunctions.some(d=>d.entryPc===pc&&d.id===vm.code[pc*8+2]),'every external opcode has exact metadata');
 assert.deepEqual(vm.handlers.map(h=>h.id),vm.externalFunctions.map(d=>d.id).sort((a,b)=>a-b),'fixed production handler order by approved macro ID');
 for(const h of vm.handlers){assert.deepEqual(Object.keys(h).sort(),['id','name','code','workgroupSize'].sort());assert.equal(h.name,macroNames[h.id]);assert.equal(h.workgroupSize,1,'separate macro first gate preserves proven WGS1');assert.equal(typeof h.code,'string');assert.ok(h.code.length>0&&h.code.length<131072,'bounded independent macro shader');}
 if(vm.externalFunctions.length){assert.equal(vm.intrinsics,'none','macro transport core contains no nested native intrinsic tree');assert.deepEqual(vm.intrinsicFunctions,[]);}
 assert.deepEqual(Object.keys(plan.identity).sort(),['originalGeneration','sourceSha256','bytecodeSha256','vmShaderSha256'].sort());assert.equal(plan.identity.originalGeneration,plan.original.identity.generationIdentity);for(const key of['sourceSha256','bytecodeSha256','vmShaderSha256'])assert.match(plan.identity[key],/^[a-f0-9]{64}$/);
 return plan;
}

/** Lean descriptor-only preflight for one or several mode variants. No source
 * compiler, oracle, GPU allocation or numerical execution occurs here. */
export function microcodeWorldPipelineDescriptors(plan){
 assertAdmittedMicrocodeRuntime(plan);const{original:{init,pc},vm}=plan;
 const initialDescriptors=Object.fromEntries(Object.entries(init.stages).map(([name,s])=>[name,{...s,name:'initialize '+name}])),handlerDescriptors=vm.handlers.map(h=>({name:'external macro '+h.id+' '+h.name,code:h.code,bindingTypes:bindings,entryPoint:'main'}));
 const descriptors=[{name:'microcode begin',code:vm.shader,bindingTypes:bindings,entryPoint:'begin'},{name:'microcode bounded pump',code:vm.shader,bindingTypes:bindings,entryPoint:'main'},{...pc.begin,bindingTypes:pc.bindingTypes},...Object.values(initialDescriptors),...handlerDescriptors];
 return{descriptors,handlerDescriptors,initialDescriptors};
}

/** The caller owns the one globally serialized numerical slot and live device.
 * Every run is independently initialized. Pipeline caching alone is shared.
 * Fixed chunk count is a transport budget, never a physics miss/horizon result.
 * World and VM diagnostics are copied/mapped only after ALL submitted work.
 */
export async function createMicrocodeWorldSession({owner,cache=createRetainedNativePipelineCache(owner),plan,maxCaptures=1,trace=()=>{}}){
 assertAdmittedMicrocodeRuntime(plan);positive(maxCaptures,'diagnostic capture capacity');assert.ok(maxCaptures<=64,'bounded diagnostic capture capacity');const frozenPlan=structuredClone(plan),{original:p,vm}=frozenPlan,{init,pc,count}=p,device=owner.device,resources=new Map(),owned=[],before=cache.stats();let scoped=true,submitted=false,sealed=false,initialized=false,finished=false,disposed=false,busy=false,failed=false,executionAt=0,captureWallMs=0;const captures=[];
 assert.equal(cache.device,device,'pipeline cache belongs to this device');
 assert.ok(device.limits.maxStorageBuffersPerShaderStage>=7,'seven actual storage bindings required');assert.ok(vm.workgroupSize<=device.limits.maxComputeInvocationsPerWorkgroup&&vm.workgroupSize<=device.limits.maxComputeWorkgroupSizeX,'actual candidate workgroup capacity');
 const stats={dispatches:0,submissions:0,initialWrites:0,copies:0,mappings:0,encodeWallMs:0,submitWallMs:0,queueDrainWallMs:0,executionGroups:[],externalHandlerDispatches:0,pumpCycles:0};
 const allocate=(name,words,usage=128|8|4)=>{positive(words,name);const size=words*4;assert.ok(size<=device.limits.maxBufferSize,name+' max buffer');if(usage&128)assert.ok(size<=device.limits.maxStorageBufferBindingSize,name+' max storage binding');const buffer=device.createBuffer({size,usage,label:name});owned.push(buffer);const row={buffer,words};resources.set(name,row);return row;};
 const write=(name,at,data)=>{assert.equal(sealed,false,'initial-only uploads already sealed');const r=resources.get(name);assert.ok(r&&data instanceof Uint32Array&&at>=0&&at+data.length<=r.words);device.queue.writeBuffer(r.buffer,at*4,data);stats.initialWrites++;};
 const submit=async encoder=>{let at=performance.now();device.queue.submit([encoder.finish()]);submitted=true;stats.submissions++;stats.submitWallMs+=performance.now()-at;at=performance.now();await device.queue.onSubmittedWorkDone();stats.queueDrainWallMs+=performance.now()-at;};
 const dispatch=async(stages)=>{let encoder,pass,n=0;const flush=async()=>{if(!n)return;pass.end();await submit(encoder);n=0;};for(const s of stages){const at=performance.now();if(!n){encoder=device.createCommandEncoder();pass=encoder.beginComputePass();}pass.setPipeline(s.pipeline);pass.setBindGroup(0,s.group);pass.dispatchWorkgroups(s.workgroups);stats.dispatches++;if(s.external)stats.externalHandlerDispatches++;n++;stats.encodeWallMs+=performance.now()-at;if(n===1024)await flush();}await flush();};
 const group=async(name,fn)=>{const before={...stats},at=performance.now();await fn();const row={name,wallMs:performance.now()-at,...Object.fromEntries(['dispatches','submissions','encodeWallMs','submitWallMs','queueDrainWallMs','externalHandlerDispatches','pumpCycles'].map(k=>[k,stats[k]-before[k]]))};stats.executionGroups.push(row);trace({stage:'execution-group-ready',...row,timingKind:'host-wall-not-gpu-timestamp'});};
 const dispose=async()=>{if(disposed)return;assert.equal(busy,false,'cannot dispose an active session operation');disposed=true;if(scoped){scoped=false;try{await device.popErrorScope();}catch{}}if(submitted)try{await device.queue.onSubmittedWorkDone();}catch{}for(const buffer of owned){try{buffer.unmap();}catch{}buffer.destroy();}};
 const operate=async fn=>{assert.equal(disposed,false,'session disposed');assert.equal(failed,false,'session failed; disposal required');assert.equal(busy,false,'one session operation at a time');busy=true;try{return await fn();}catch(error){failed=true;throw error;}finally{busy=false;}};
 device.pushErrorScope('validation');
 try{
  const{descriptors,handlerDescriptors,initialDescriptors}=microcodeWorldPipelineDescriptors(frozenPlan);
  await cache.validateAll(descriptors);
  // Compile the independently bounded source kernels first, without oracle or
  // source/VM buffers occupying the compiler's peak-memory window. Every shader
  // has already passed preflight; no source state is uploaded until all compile.
  const compiledDescriptors=new Map();for(const descriptor of[...handlerDescriptors,...descriptors.filter(d=>!handlerDescriptors.includes(d))])compiledDescriptors.set(descriptor,await cache.compile(descriptor));
  allocate('scratch',init.scratchAlias.words);
  for(const[name,initial]of Object.entries(init.resources)){
   if(name==='rawScratch'||name==='numericScratch'){resources.set(name,resources.get('scratch'));continue;}
   const value=name==='worldState'?pc.totalStateWords:name==='worldProgram'?p.program:initial;
   allocate(name,typeof value==='number'?value:value.length);if(value instanceof Uint32Array)write(name,0,value);
  }
  allocate('worldGeometry',p.sharedGeometry.length);write('worldGeometry',0,p.sharedGeometry);write('inputs',0,p.input);for(const u of init.initialUploads)write(u.resource,u.offsetWords,u.data);
  allocate('microcode',vm.code.length);write('microcode',0,vm.code);allocate('vmState',vm.totalWords);
  // Runtime-owned GPUBuffer identity enforces the declared authority boundary,
  // including code and initializer resources; source scratch aliases are valid.
  const vmBuffer=resources.get('vmState').buffer;for(const[name,row]of resources)if(name!=='vmState')assert.notEqual(row.buffer,vmBuffer,'VM GPUBuffer must not alias source/code resource '+name);
  const captureWords=pc.totalStateWords+vm.totalWords,read=allocate('final-only-diagnostics',captureWords*maxCaptures,1|8);
  const stage=async(descriptor,names,workgroups)=>{const compiled=compiledDescriptors.get(descriptor);assert.ok(compiled,'preflighted compiled descriptor');return{pipeline:compiled.pipeline,group:device.createBindGroup({layout:compiled.groupLayout,entries:names.map((name,binding)=>({binding,resource:{buffer:resources.get(name).buffer}}))}),workgroups};};
  const names=['worldState','worldProgram','worldGeometry','scratch','inputs'],vmNames=[...names,'microcode','vmState'];
  const beginVm=await stage(descriptors[0],vmNames,Math.ceil(count/vm.workgroupSize)),pumpVm=await stage(descriptors[1],vmNames,Math.ceil(count/vm.workgroupSize)),beginWorld=await stage(descriptors[2],names,count),initial={};
  for(const[name,s]of Object.entries(init.stages))initial[name]=await stage(initialDescriptors[name],s.resources,s.workgroups);
  const handlers=[];for(let i=0;i<handlerDescriptors.length;i++)handlers.push({...await stage(handlerDescriptors[i],vmNames,Math.ceil(count/vm.handlers[i].workgroupSize)),external:true});
  // There is no post-seal upload API. All operations retain these same banks.
  sealed=true;await device.queue.onSubmittedWorkDone();
  return Object.freeze({
   async initialize(){assert.equal(initialized,false,'initialize exactly once; no VM/source reset');assert.equal(finished,false,'session finished');return operate(async()=>{initialized=true;executionAt=performance.now();await group('initialize',()=>dispatch((function*(){for(const c of init.commands)for(let n=0;n<c.repeat;n++)yield initial[c.stage];yield beginWorld;yield beginVm;})()));});},
   async pump(cycles=vm.dispatchChunks){assert.equal(initialized,true,'initialize first');assert.equal(finished,false,'session finished');positive(cycles,'fixed pump cycles');assert.ok(cycles<=vm.dispatchChunks-stats.pumpCycles,'immutable cumulative pump budget');return operate(async()=>{await group('pump',()=>dispatch((function*(){for(let n=0;n<cycles;n++){stats.pumpCycles++;yield pumpVm;for(const handler of handlers)yield handler;}})()));return Object.freeze({pumpCycles:stats.pumpCycles,hostStateContinuation:false});});},
   async capture(name){assert.equal(initialized,true,'initialize first');assert.equal(finished,false,'session finished');assert.ok(typeof name==='string'&&name.length>0&&name.length<=128,'bounded diagnostic label');assert.ok(!captures.some(c=>c.name===name),'unique diagnostic label');assert.ok(captures.length<maxCaptures,'predeclared diagnostic capture capacity');return operate(async()=>{const at=performance.now(),offset=captures.length*captureWords*4,encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(resources.get('worldState').buffer,0,read.buffer,offset,pc.totalStateWords*4);encoder.copyBufferToBuffer(resources.get('vmState').buffer,0,read.buffer,offset+pc.totalStateWords*4,vm.totalWords*4);stats.copies+=2;await submit(encoder);captureWallMs+=performance.now()-at;const receipt=Object.freeze({name,pumpCycles:stats.pumpCycles});captures.push(receipt);trace({stage:'microcode-checkpoint-copied',...receipt,mapped:false,physicalBoundary:'unqualified-fixed-cycle-diagnostic'});return receipt;});},
   async finish(){assert.equal(initialized,true,'initialize first');assert.equal(finished,false,'finish exactly once');assert.ok(captures.length,'at least one diagnostic capture');assert.equal(captures.at(-1).pumpCycles,stats.pumpCycles,'final diagnostic capture must follow the last pump');return operate(async()=>{finished=true;const at=performance.now();await read.buffer.mapAsync(1);stats.mappings++;const all=new Uint32Array(read.buffer.getMappedRange().slice(0));read.buffer.unmap();stats.readbackWallMs=captureWallMs+performance.now()-at;
    const validation=await device.popErrorScope();scoped=false;assert.equal(validation,null,'microcode world native validation');stats.cache=nativeCacheDelta(cache.stats(),before);stats.steadyEndToEndWallMs=performance.now()-executionAt;stats.steadyEndToEndScope='after compilation/bindings/upload drain through initialization, pump, final diagnostics map and validation';
    const checkpoints=captures.map((receipt,i)=>{const offset=i*captureWords,words=all.slice(offset,offset+pc.totalStateWords),vmWords=all.slice(offset+pc.totalStateWords,offset+captureWords),controls=Array.from({length:count},(_,lane)=>Array.from(vmWords.slice(lane*vm.stride,lane*vm.stride+I.control.words)));return{...receipt,words,vmWords,controls};});
    trace({stage:'microcode-final-mapped',controls:checkpoints.at(-1).controls,captures:checkpoints.length,hostStateContinuation:false,sourceParity:'pending'});return{checkpoints,stats:structuredClone(stats)};
   });},
   dispose
  });
 }catch(error){await dispose();throw error;}
}

/** Existing strict two-h gate: initialization once, its complete fixed pump,
 * one diagnostic capture/map, then destruction. Recurrence uses the session
 * API with its separate fixed-eight-h admission, never this wrapper. */
export async function runMicrocodeWorld(options){
 assertMicrocodeWorldRuntime(options.plan);const session=await createMicrocodeWorldSession({...options,maxCaptures:1});
 try{await session.initialize();await session.pump();await session.capture('final');const{checkpoints:[last],stats}=await session.finish();return{words:last.words,vmWords:last.vmWords,controls:last.controls,stats};}finally{await session.dispose();}
}
