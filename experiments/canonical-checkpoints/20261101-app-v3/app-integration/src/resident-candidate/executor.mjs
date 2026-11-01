/* SPDX-License-Identifier: Apache-2.0
 * Experimental residency/lifetime owner. No default application import, CPU
 * forward fallback, candidate generator, or per-h state readback exists here.
 * Physical terminal results remain numerically UNQUALIFIED until an independent
 * whole-path admission is implemented; running the kernels is not that proof.
 */
import {assertWorldInitializationPlan,packWorldInitializationRows,buildWorldInitializationCommands,planWorldInitializationBanks} from './world-initialization.mjs';
import {generateWorldHPlan,worldHCommands} from './world-h.mjs';
import {compileWorldDevicePc,worldDevicePcCommands,WORLD_DEVICE_PC} from './world-device-pc.mjs';
import {NUMERIC_PROFILE,NUMERIC_DEPENDENCY_MASK,generateNumericAdmissionWGSL} from './numeric-profile.mjs';
import {STATUS,REASON,UNSET,decodeResults} from './abi.mjs';

export const EXECUTOR_CAPABILITY=Object.freeze({experimentalOptIn:true,rawRows:true,
  residentBetweenH:true,compactResultsOnly:true,hostForwardFallback:false,
  originalFullRestQualified:false,native1024TrajectoriesQualified:false,
  hardwarePerformanceMeasured:false,defaultBackend:false});
const STORAGE=128,COPY_SRC=4,COPY_DST=8,MAP_READ=1,PC_CONTROL_WORDS=WORLD_DEVICE_PC.headerWords+16*WORLD_DEVICE_PC.frameWords;
const need=(v,m)=>{if(!v)throw new RangeError('Resident executor: '+m);};
const finalWords=(ids,status,reason)=>{const out=new Uint32Array(ids.length*4);ids.forEach((id,i)=>out.set([id,status,UNSET,reason],i*4));return out;};
const transportOptions=(executionTransport,devicePcSweeps,worldTransports)=>{
 need(executionTransport==='staged'||executionTransport==='device-pc','explicit known execution transport');
 if(executionTransport==='staged'){need(devicePcSweeps===undefined&&worldTransports===undefined,'PC-only configuration is not valid for staged transport');return Object.freeze({executionTransport});}
 need(Number.isInteger(devicePcSweeps)&&devicePcSweeps>0&&devicePcSweeps<=0xffffffff,'explicit positive total device-PC sweep budget required');
 const allowed={coupledTransport:['micro'],cueTransport:['flat'],applicationTransport:['staged','flat'],ccdTransport:['staged','flat'],queryTransport:['staged']};
 need(worldTransports&&Object.getPrototypeOf(worldTransports)===Object.prototype,'explicit complete device-PC world transports required');
 const descriptors=Object.getOwnPropertyDescriptors(worldTransports),keys=Reflect.ownKeys(descriptors);need(keys.length===Object.keys(allowed).length&&keys.every(k=>typeof k==='string'&&Object.hasOwn(allowed,k)),'exact known world transport keys required');
 const copied={};for(const[key,values]of Object.entries(allowed)){const d=descriptors[key];need(d&&Object.hasOwn(d,'value')&&values.includes(d.value),'explicit admitted '+key);copied[key]=d.value;}
 return Object.freeze({executionTransport,devicePcSweeps,worldTransports:Object.freeze(copied)});
};
// This is a transport-contract guard, not a numerical qualification. In
// particular a READY cursor wins over any stale terminal-looking bank word.
function pcPublicationGuard(pc){if(!pc)return'';const h=WORLD_DEVICE_PC.header,ps=WORLD_DEVICE_PC.status;
 return `let cb=${pc.controlTailBase}u+gid.x*${pc.controlWords}u;let pcs=rc_state[cb+${h.status}u];let done=rc_state[cb+${h.completedH}u];let initial=rc_state[cb+${h.initialH}u];
 if(rc_state[cb]!=${WORLD_DEVICE_PC.magic}u||rc_state[cb+${h.version}u]!=${WORLD_DEVICE_PC.version}u||rc_state[cb+${h.requestedH}u]!=${pc.maxH}u||done>${pc.maxH}u||rc_state[cb+${h.error}u]!=0u||pcs<${ps.ready}u||pcs>=${ps.invalid}u){status=4u;reason=11u;}
 else if(pcs==${ps.ready}u){status=5u;reason=11u;}
 else if(rc_state[b+5u]!=initial+done){status=4u;reason=11u;}
 else if(pcs==${ps.complete}u){if(done!=${pc.maxH}u||status!=1u){status=4u;reason=11u;}else{status=5u;reason=11u;}}
 else if(pcs==${ps.worldTerminal}u&&status<2u){status=4u;reason=11u;}`;
}
export class ResidentExecutionCancelled extends Error{constructor(reason=REASON.CANCELLED){super('Resident wave publication cancelled');this.reason=reason;}}

/** This API intentionally has no unchecked `qualifiedMask` override. The
 * current source-level implementation cannot turn bounded component evidence
 * into universal PASS/MISS authority. Acceptance tests compare resident banks
 * independently; the public compact publisher stays fail-closed meanwhile.
 * evaluate's devicePcSweeps is a TOTAL fixed sweep budget per tile, never
 * multiplied by maxHSteps. That requested physical-h ceiling stays separate. */
export function createResidentCandidateExecutor(device,initialization,{experimental=false,maxDispatchesPerSubmission=1024,onProgress}={}){
 need(experimental===true,'explicit experimental opt-in required');assertWorldInitializationPlan(initialization);
 need(device&&typeof device.createBuffer==='function'&&typeof device.createComputePipelineAsync==='function'&&device.queue,'actual WebGPU device required');
 need(Number.isInteger(maxDispatchesPerSubmission)&&maxDispatchesPerSubmission>=1&&maxDispatchesPerSubmission<=4096,'bounded command submission required');
 if(onProgress!==undefined&&typeof onProgress!=='function')throw new TypeError('Progress observer must be a function');
 let busy=false,disposed=false,lost=null;Promise.resolve(device.lost).then(info=>{if(info)lost=info;},error=>{lost=error;});
 const report=value=>{if(onProgress)onProgress(Object.freeze(value));};
 const api={capability:EXECUTOR_CAPABILITY,
  async evaluate(rows,{maxHSteps,signal,sourceRevision,getSourceRevision,executionTransport='staged',devicePcSweeps,worldTransports}={}){
   need(!busy&&!disposed,'one live wave per device owner');need(Number.isInteger(maxHSteps)&&maxHSteps>=1&&maxHSteps<=0xffffffff,'explicit finite resident h budget required');
   need(sourceRevision===initialization.preStrikeIdentity&&typeof getSourceRevision==='function','source revision lease must be the authenticated prestrike identity');
   const transport=transportOptions(executionTransport,devicePcSweeps,worldTransports),pcEnabled=transport.executionTransport==='device-pc',inputs=packWorldInitializationRows(initialization,rows),ids=rows.map(r=>r.id);busy=true;
   const allocations=[],pipelineCache=new Map();const bindingLimit=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize,128*1024*1024);let submitted=false,scoped=false,read=null;
   const check=()=>{if(lost)throw new Error('Resident device lost');if(signal?.aborted)throw new ResidentExecutionCancelled();if(getSourceRevision()!==sourceRevision)throw new ResidentExecutionCancelled(REASON.STALE_SOURCE);};
   const allocate=(words,usage,label,data)=>{need(Number.isSafeInteger(words)&&words>0,'whole nonempty resource');need(words*4<=device.limits.maxBufferSize&&(!(usage&STORAGE)||words*4<=bindingLimit),'resource exceeds exact device binding limit');const buffer=device.createBuffer({size:words*4,usage,label});allocations.push(buffer);if(data)device.queue.writeBuffer(buffer,0,data);return buffer;};
   const compile=async(code,bindingTypes,label)=>{check();const key=bindingTypes.join(',')+'\n'+code;if(pipelineCache.has(key))return pipelineCache.get(key);report({phase:'compiling',label});const layout=device.createBindGroupLayout({entries:bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),module=device.createShaderModule({code,label}),info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(label+': '+errors.map(m=>m.lineNum+':'+m.linePos+' '+m.message).join('\n'));const pipeline=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),compute:{module,entryPoint:'main'}});const value={pipeline,layout};pipelineCache.set(key,value);return value;};
   const bind=(compiled,buffers)=>({pipeline:compiled.pipeline,group:device.createBindGroup({layout:compiled.layout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))})});
   const submitCommands=async function*(commands){let encoder=null,pass=null,n=0,total=0;const close=async()=>{if(!n)return;pass.end();device.queue.submit([encoder.finish()]);submitted=true;await device.queue.onSubmittedWorkDone();check();total+=n;n=0;encoder=null;pass=null;};for(const command of commands){check();if(!pass){encoder=device.createCommandEncoder();pass=encoder.beginComputePass();}pass.setPipeline(command.pipeline);pass.setBindGroup(0,command.group);pass.dispatchWorkgroups(command.workgroups);n++;if(n===maxDispatchesPerSubmission){await close();yield total;}}await close();yield total;};
   const drain=async commands=>{for await(const ignored of submitCommands(commands)){void ignored;}};
   try{
    check();device.pushErrorScope('validation');scoped=true;
    const t=initialization.template,plan=planWorldInitializationBanks(initialization,ids.length,{maxStorageBufferBindingSize:device.limits.maxStorageBufferBindingSize,maxBufferSize:device.limits.maxBufferSize,perCandidateTailWords:pcEnabled?PC_CONTROL_WORDS:0});
    // ALL world tiles are allocated before the first candidate evolves and are
    // retained until the single compact terminal read. Scratch is reused only
    // after the previous tile's submitted work has drained.
    const tiles=plan.tiles.map(tile=>{const packed=inputs.slice(tile.first*16,(tile.first+tile.count)*16),state=allocate(tile.stateBytes/4,STORAGE|COPY_SRC|COPY_DST,'resident worlds '+tile.first);device.queue.writeBuffer(state,tile.count*t.state.byteLength,t.fixedCcd);return{...tile,state,input:allocate(packed.length,STORAGE|COPY_DST,'raw candidates '+tile.first,packed)};});
    const raw=initialization.raw,maxCount=plan.tileCandidates,shared={rawProgram:allocate(raw.program.words.length,STORAGE|COPY_DST,'original raw program',raw.program.words),rawGeometry:allocate(raw.geometry.words.length,STORAGE|COPY_DST,'original raw geometry',raw.geometry.words),worldProgram:allocate(t.program.length,STORAGE|COPY_DST,'original world programs',t.program),worldTemplate:allocate(initialization.clone.length,STORAGE|COPY_DST,'original created template',initialization.clone),worldGeometry:allocate(t.sharedGeometry.length,STORAGE|COPY_DST,'original world geometry',t.sharedGeometry),rawState:allocate(maxCount*raw.layout.stateWords,STORAGE|COPY_DST,'reused raw state'),scratch:allocate(maxCount*Math.max(raw.layout.scratchWords,t.numericScratchWords),STORAGE,'liveness-bounded scratch')};
    const results=allocate(ids.length*4,STORAGE|COPY_SRC,'compact terminal results');read=allocate(ids.length*4,MAP_READ|COPY_DST,'compact result readback');
    let dispatches=0;
    for(const tile of tiles){
     check();const init=buildWorldInitializationCommands(initialization,tile.count),resource={...shared,inputs:tile.input,worldState:tile.state,rawScratch:shared.scratch,numericScratch:shared.scratch},initialPipelines={};
     // Raw owner state is scratch for this tile, so reset it without inspecting
     // any prior candidate. World state itself is cloned by the device owner.
     device.queue.writeBuffer(shared.rawState,0,new Uint32Array(tile.count*raw.layout.stateWords));
     for(const[name,stage]of Object.entries(init.stages)){const compiled=await compile(stage.code,stage.bindingTypes,'initialization '+name);initialPipelines[name]={...bind(compiled,stage.resources.map(k=>resource[k])),workgroups:stage.workgroups};}
     const initialCommands=function*(){for(const command of init.commands)for(let i=0;i<command.repeat;i++)yield initialPipelines[command.stage];};await drain(initialCommands());dispatches+=init.dispatches;
     // Revalidate code-generation views after initialization's asynchronous
     // observer/queue boundaries; the complete h plan is then built synchronously.
     check();assertWorldInitializationPlan(initialization);
     const h=generateWorldHPlan(t,{count:tile.count,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,...transport.worldTransports});
     const pc=pcEnabled?compileWorldDevicePc(h,{programBase:t.program.length,controlTailBase:tile.count*t.state.length+t.fixedCcd.length,maxH:maxHSteps}):null;
     let worldProgram=shared.worldProgram;
     if(pc){
      need(pc.controlWords===PC_CONTROL_WORDS&&pc.totalStateWords*4===tile.stateBytes,'exact device-PC control-tail layout');
      // The program tail is known only from the authenticated generated source
      // schedule. Validate the complete binding before allocating/uploading it.
      planWorldInitializationBanks(initialization,tile.count,{maxStorageBufferBindingSize:device.limits.maxStorageBufferBindingSize,maxBufferSize:device.limits.maxBufferSize,perCandidateTailWords:pc.controlWords,programTailWords:pc.bytecode.length});
      const words=new Uint32Array(t.program.length+pc.bytecode.length);words.set(t.program);words.set(pc.bytecode,t.program.length);worldProgram=allocate(words.length,STORAGE|COPY_DST,'device-PC world programs '+tile.first,words);
     }
     const hp=[],stages=pc?pc.pipelines:h.pipelines,bindingTypes=pc?pc.bindingTypes:h.bindingTypes,worldBuffers=[tile.state,worldProgram,shared.worldGeometry,shared.scratch,tile.input];
     for(const stage of stages){const compiled=await compile(stage.code,bindingTypes,'world '+stage.name);hp.push({...bind(compiled,worldBuffers),workgroups:tile.count});}
     if(pc){
      const start={...bind(await compile(pc.begin.code,pc.bindingTypes,'world '+pc.begin.name),worldBuffers),workgroups:tile.count};
      await drain((function*(){for(const index of worldDevicePcCommands(pc,{sweeps:transport.devicePcSweeps}))yield index===-1?start:hp[index];})());
      dispatches+=1+transport.devicePcSweeps*hp.length;report({phase:'resident-pc-sweeps-submitted',first:tile.first,count:tile.count,submittedSweeps:transport.devicePcSweeps,maxHSteps,stateReadbacks:0});
     }else{
      const commands=[...worldHCommands(h)];
      for(let step=0;step<maxHSteps;step++){check();await drain((function*(){for(const index of commands)yield hp[index];})());dispatches+=commands.length;report({phase:'resident-h-submitted',first:tile.first,count:tile.count,submittedH:step+1,maxHSteps,stateReadbacks:0});}
     }
     // Remaining RUNNING lanes are incomplete, not misses. Numeric admission
     // applies to both PASS and MISS before either can be published.
     const code=`@group(0) @binding(0) var<storage,read> rc_state:array<u32>;@group(0) @binding(1) var<storage,read_write> rc_results:array<vec4<u32>>;\n${generateNumericAdmissionWGSL({numericProfile:NUMERIC_PROFILE.PRESERVED_F32,qualifiedMask:0})}\n@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${tile.count}u){return;}let b=gid.x*${t.state.length}u;var status=rc_state[b+2u];var reason=rc_state[b+3u];var pass=0xffffffffu;${pcPublicationGuard(pc)}if(status<2u){status=5u;reason=11u;}if(status==2u){pass=1u;}else if(status==3u){pass=0u;}rc_results[${tile.first}u+gid.x]=rc_numeric_guard_result(vec4<u32>(rc_state[b+4u],status,pass,reason),${NUMERIC_DEPENDENCY_MASK}u);}`;
     const publication=bind(await compile(code,['read-only-storage','storage'],'fail-closed compact publication'),[tile.state,results]);await drain([{...publication,workgroups:Math.ceil(tile.count/32)}]);
    }
    check();const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(results,0,read,0,ids.length*16);device.queue.submit([encoder.finish()]);submitted=true;await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange().slice(0));read.unmap();check();const validation=await device.popErrorScope();scoped=false;if(validation)throw new Error(validation.message);check();
    return Object.freeze({results:decodeResults(words,ids),evidence:Object.freeze({candidateCount:ids.length,tiles:tiles.length,...(pcEnabled?{requestedHPerTile:maxHSteps,submittedSweepsPerTile:transport.devicePcSweeps,worldTransports:transport.worldTransports}:{submittedHPerTile:maxHSteps}),executionTransport:transport.executionTransport,dispatches,intermediateStateReadbacks:0,readbackBytes:words.byteLength,sourceIdentity:t.sourceIdentity,numericallyQualified:false,hardwarePerformanceMeasured:false})});
   }catch(error){
    if(error instanceof ResidentExecutionCancelled){if(submitted&&!lost){try{await device.queue.onSubmittedWorkDone();}catch(drainError){if(!lost)throw drainError;}}if(lost)return Object.freeze({results:decodeResults(finalWords(ids,STATUS.FAILED,REASON.DEVICE_LOST),ids),evidence:Object.freeze({deviceLost:true,numericallyQualified:false})});return Object.freeze({results:decodeResults(finalWords(ids,error.reason===REASON.STALE_SOURCE?STATUS.FAILED:STATUS.CANCELLED,error.reason),ids),evidence:Object.freeze({cancelled:true,intermediateStateReadbacks:0,numericallyQualified:false})});}
    if(lost)return Object.freeze({results:decodeResults(finalWords(ids,STATUS.FAILED,REASON.DEVICE_LOST),ids),evidence:Object.freeze({deviceLost:true,numericallyQualified:false})});
    throw error;
   }finally{
    if(scoped){try{await device.popErrorScope();}catch{}}
    if(submitted&&!lost){try{await device.queue.onSubmittedWorkDone();}catch{}}
    for(const buffer of allocations){try{buffer.unmap();}catch{}buffer.destroy();}pipelineCache.clear();busy=false;
   }
  },
  dispose(){need(!busy,'drain current wave before disposal');disposed=true;}
 };
 return Object.freeze(api);
}
