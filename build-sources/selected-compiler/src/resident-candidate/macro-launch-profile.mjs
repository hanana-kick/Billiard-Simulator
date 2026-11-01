/* SPDX-License-Identifier: Apache-2.0
 * HOST/source-only launch adapter. No device, numerical execution or altered
 * source body. A launch profile is not physical admission or a runtime port.
 */
import {createHash} from './source-sha256.mjs';
import {macroLaunchDataSha256} from './macro-launch-data.mjs';
export {macroLaunchDataSha256} from './macro-launch-data.mjs';
import {parseMicrocodeWGSL,tokenizeMicrocodeWGSL} from './microcode-parser.mjs';
import {sourceMacroNativeWGSL,MICROCODE_SOURCE_MACROS} from './microcode-source-macros.mjs';
import {generateMicrocodeExternalWGSL,generateMicrocodeVmWGSL,microcodeVmLayout} from './microcode-vm.mjs';
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
import {isOwnedUint32Array,unpackCandidates,PARAMETER_KEYS,INPUT_WORDS} from './abi.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../source-event-history.mjs';

export const MACRO_LAUNCH_PROFILE='resident-four-macro-candidate-launch-v1';
export const MACRO_LAUNCH_GENERATOR_PROFILE='resident-preparation-disabled-integrated-isa-source-v1';
export const MIXED_MACRO_RUNTIME='resident-mixed-six-four-macro-initial-only-runtime-v1';
export const MACRO_LAUNCH_WORKGROUPS=Object.freeze([1,8,32,64]);
export const MACRO_LAUNCH_CAPABILITY=Object.freeze({sourceOnly:true,sourceBodiesUnchanged:true,coreWorkgroupSize:64,
 numericalGpuExecuted:false,nativeLaunchQualified:false,fullRestQualified:false,native1024Qualified:false,hardwarePerformanceMeasured:false,defaultBackend:false});
const need=(ok,message)=>{if(!ok)throw new TypeError('Macro launch profile: '+message);};
const uint=(value,label,zero=false)=>{need(Number.isSafeInteger(value)&&value>=(zero?0:1)&&value<=0xffffffff,label+' bounded u32');return value;};
const sha=value=>createHash('sha256').update(typeof value==='string'?value:new Uint8Array(value.buffer,value.byteOffset,value.byteLength)).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const walk=(value,visit)=>{if(!value||typeof value!=='object')return;visit(value);for(const child of Object.values(value))if(Array.isArray(child))child.forEach(x=>walk(x,visit));else walk(child,visit);};
const rootName=value=>value?.kind==='name'?value.name:['index','member'].includes(value?.kind)?rootName(value.object):null;
const LIMIT_KEYS=['maxStorageBufferBindingSize','maxBufferSize','maxStorageBuffersPerShaderStage','maxBindingsPerBindGroup','maxBindGroups','maxComputeInvocationsPerWorkgroup','maxComputeWorkgroupSizeX','maxComputeWorkgroupsPerDimension'];
const limitsCopy=value=>{need(value&&typeof value==='object','explicit declared device limits required');return Object.fromEntries(LIMIT_KEYS.map(key=>{need(Number.isSafeInteger(value[key])&&value[key]>0,key+' positive safe integer');return[key,value[key]];}));};

/** Inspect the actual four canonical dependency closures, not macro names.
 * Source mutable addresses remain argument-based: this audit does NOT prove
 * every argument points into its owning candidate. Exact immutable source and
 * later independent mixed-lane parity remain mandatory for that authority. */
export function auditSourceMacroLaunchClosures(){
 return freeze(MICROCODE_SOURCE_MACROS.map(spec=>{
  const code=sourceMacroNativeWGSL(spec.name),ast=parseMicrocodeWGSL(code),tokens=tokenizeMicrocodeWGSL(code),forbidden=tokens.filter(t=>/^(?:atomic|subgroup)/.test(t.text)||['workgroup','workgroupBarrier','storageBarrier','textureBarrier','workgroupUniformLoad','local_invocation_id','local_invocation_index','workgroup_id','num_workgroups'].includes(t.text)).map(t=>t.text);
  need(!forbidden.length,'workgroup/shared/subgroup/barrier/atomic dependency in '+spec.name);need(ast.globals.every(g=>g.mode==='const'&&g.storage===null),'no mutable module/private/workgroup state in '+spec.name);
  const storage=new Set(),writes=new Set();walk(ast,node=>{if(node.kind==='index'){const root=rootName(node);if(root?.startsWith('rc_'))storage.add(root);}if(node.kind==='assign'||node.kind==='update'){const root=rootName(node.left??node.arg??node.target);if(root?.startsWith('rc_'))writes.add(root);}});
  need([...storage].every(name=>['rc_state','rc_program','rc_scratch'].includes(name)),'known exact source storage views');need([...writes].every(name=>name==='rc_state'||name==='rc_scratch'),'no readonly/shared storage writes');
  const root=ast.functions.find(f=>f.name===spec.name);need(root&&root.params.length===spec.parameterWords.length,'exact canonical root signature');
  return{id:spec.id,name:spec.name,nativeSourceSha256:sha(code),sourceBytes:code.length,functions:ast.functions.length,immutableGlobals:ast.globals.map(g=>g.name),storageViews:[...storage].sort(),writableViews:[...writes].sort(),parameters:root.params.map(p=>p.name),resultWords:spec.resultWords,collectiveDependencies:[],mutableModuleState:false,sourcePointerLocality:'not-proven-by-launch-audit'};
 }));
}

/** Structural source-history requirement, not a replacement for the locally
 * authenticated prestrike producer. Legacy h2/h8 payloads without the actual
 * successful-stroke helper/call must fail even if their profile is relabeled. */
export function assertMacroLaunchInitialHistory(original){
 need(original?.identity?.options?.initialHistoryProfile===SOURCE_EVENT_HISTORY_PROFILE,'authenticated full initial-history profile required; legacy payload cannot be relabeled');
 const code=original?.init?.stages?.['creation-finish']?.code;need(typeof code==='string','complete original creation-finish source');
 need(code.includes('fn rc_world_initial_history_commit(bank:u32)->bool{')&&code.includes('if(!rc_world_initial_history_commit(bank)){rc_state[bank+2u]=4u;rc_state[bank+3u]=11u;return;}rc_state[c+5u]=3u;rc_state[bank+2u]=1u;'),'actual guarded accepted-stroke commit before RUNNING required');
 need(original.identity.pipelineIdentity?.initializer?.['creation-finish']===sha(code),'creation-finish source identity');
 return Object.freeze({profile:SOURCE_EVENT_HISTORY_PROFILE,structuralCommitPresent:true,authenticatedProducerStillRequired:true});
}
function resourceLayout(p,vm,audit){
 const r=p.init.resources,n=p.count,pc=p.pc,upload=p.init.initialUploads;
 need(p.init.count===n&&r.inputs===n*INPUT_WORDS&&r.inputs===p.input.length,'exact initializer input/count');
 need(Array.isArray(upload)&&upload.length===1&&upload[0].resource==='worldState'&&isOwnedUint32Array(upload[0].data),'one immutable initial fixed-CCD upload');
 need(upload[0].offsetWords===n*pc.stateWords&&r.worldState===n*pc.stateWords+upload[0].data.length&&pc.controlTailBase===r.worldState,'world / fixed-CCD / control layout');
 need(pc.controlWords===80&&pc.requestWordsPerCandidate===24&&pc.requestTailBase===pc.controlTailBase+n*80&&pc.totalStateWords===pc.requestTailBase+n*24,'complete source PC/request tails');
 need(pc.programBase===r.worldProgram.length&&p.program.length===r.worldProgram.length+pc.bytecode.length,'complete immutable world/PC program');
 need(r.rawState%n===0&&r.rawScratch%n===0&&r.numericScratch%n===0&&p.init.scratchAlias.rawScratch==='numericScratch'&&p.init.scratchAlias.words===Math.max(r.rawScratch,r.numericScratch),'exact initializer and source scratch alias');
 const words={rawProgram:r.rawProgram.length,rawGeometry:r.rawGeometry.length,worldTemplate:r.worldTemplate.length,worldProgram:p.program.length,worldGeometry:p.sharedGeometry.length,worldState:pc.totalStateWords,rawState:r.rawState,scratch:p.init.scratchAlias.words,inputs:r.inputs,microcode:vm.code.length,vmState:vm.totalWords,...(audit?{eventAudit:audit.totalWords}:{})};
 for(const[name,value]of Object.entries(words))uint(value,name+' words');
 return{buffers:Object.fromEntries(Object.entries(words).map(([name,wordCount])=>[name,{words:wordCount,bytes:wordCount*4}])),sourceSpans:{world:{count:n,strideWords:pc.stateWords,offsetWords:0},fixedCcd:{offsetWords:upload[0].offsetWords,words:upload[0].data.length},pc:{offsetWords:pc.controlTailBase,strideWords:80,count:n},request:{offsetWords:pc.requestTailBase,strideWords:24,count:n},scratch:{strideWords:words.scratch/n,count:n},rawInitialization:{strideWords:r.rawState/n,count:n},inputs:{strideWords:INPUT_WORDS,count:n},vm:{strideWords:vm.stride,count:n,controlWords:I.control.words,localWords:vm.localWords,stackWords:vm.stackCapacity}},gpuBufferDisjointness:'must-be-checked-at-allocation'};
}
function validatedRuntime(runtime){
 need(runtime&&[MIXED_MACRO_RUNTIME,'resident-raw-tip-impact-microcode-runtime-v1'].includes(runtime.kind),'explicit versioned four-macro initial-only runtime required');
 const p=runtime.original,vm=runtime.vm,audit=runtime.audit,n=p?.count;uint(n,'source count');const mixed=runtime.kind===MIXED_MACRO_RUNTIME;
 need(mixed?n===6&&p.frames===2&&p.kind==='resident-raw-pc-full-history-six-initial-only-runtime-v1':n===2&&p.frames===192&&p.kind==='resident-raw-tip-impact-initial-only-runtime-v1','exact source-specialized count/h profile');need(p.pc.count===n&&p.pc.maxH===p.frames&&p.identity.count===n&&p.identity.frames===p.frames,'count/h cannot be relabeled');assertMacroLaunchInitialHistory(p);
 need(isOwnedUint32Array(p.input)&&p.input.length===n*INPUT_WORDS&&isOwnedUint32Array(vm.code)&&vm.code.length===vm.instructionCount*I.instructionWords,'complete immutable input/bytecode');
 need(p.identity.rawInputSha256===sha(p.input)&&p.identity.programSha256===sha(p.program)&&p.identity.sharedGeometrySha256===sha(p.sharedGeometry),'exact immutable source uploads');
 const rows=unpackCandidates(p.input);need(Array.isArray(p.identity.rawRows)&&p.identity.rawRows.length===n&&new Set(rows.map(r=>r.id)).size===n,'all distinct source rows retained');for(let i=0;i<n;i++)need(rows[i].id===p.identity.rawRows[i].id&&PARAMETER_KEYS.every(key=>Object.is(rows[i].settings[key],p.identity.rawRows[i].settings[key])),'raw IDs/order/binary64 parameters preserved');
 need(runtime.identity?.originalGeneration===p.identity.generationIdentity&&runtime.identity.bytecodeSha256===sha(vm.code)&&runtime.identity.vmShaderSha256===sha(vm.shader),'exact generation/bytecode/core identity');need(/^[a-f0-9]{64}$/.test(runtime.identity.sourceSha256),'original source digest');
 need(vm.workgroupSize===64&&vm.intrinsics==='none'&&vm.intrinsicFunctions.length===0&&vm.vmStateDisjoint===true,'unchanged disjoint WGS64 scalar core without added intrinsics');
 const layout=microcodeVmLayout({count:n,localWords:vm.localWords,stackCapacity:vm.stackCapacity});need(layout.stride===vm.stride&&layout.totalWords===vm.totalWords,'complete candidate-owned VM slabs');
 need(mixed?!vm.eventAudit&&!audit:vm.eventAudit===true&&!!audit,'audit binding cannot be silently removed/added');if(audit)need(audit.count===n&&audit.sourceStateWords===p.pc.totalStateWords&&audit.bytes===audit.totalWords*4,'exact mandatory audit source allocation');
 need(Array.isArray(vm.externalFunctions)&&vm.externalFunctions.length===4&&Array.isArray(vm.handlers)&&vm.handlers.length===4,'all four exact source macros required');
 const slots=vm.entrySlots;need(Array.isArray(slots)&&slots.length===3&&slots[0].candidateStride===1&&slots[0].value===0&&slots.slice(1).every((s,i)=>s.slot===slots[0].slot+i+1&&(s.candidateStride??0)===0&&s.value===0),'exact candidate gid.x entry-slot initialization');
 const config={count:n,localWords:vm.localWords,stackCapacity:vm.stackCapacity,instructionCount:vm.instructionCount,entryPc:vm.entryPc,instructionBudget:vm.instructionBudget,initialSlots:vm.entrySlots,workgroupSize:64,intrinsics:vm.intrinsics,intrinsicFunctions:vm.intrinsicFunctions,externalFunctions:vm.externalFunctions,controlMode:vm.controlMode,vmStateDisjoint:vm.vmStateDisjoint,eventAudit:vm.eventAudit===true};
 need(generateMicrocodeVmWGSL(config)===vm.shader,'exact unchanged canonical core source');need(!/\brc_geometry_numeric_prepare\b|\brc_gp_\w*/.test(vm.shader),'preparation helper closure/call must be absent from baseline core');if(mixed)need(runtime.sourcePreparation?.generatorProfile===MACRO_LAUNCH_GENERATOR_PROFILE&&runtime.sourcePreparation.preparation===false,'explicit new preparation-disabled generator source version');
 const sorted=[...vm.externalFunctions].sort((a,b)=>a.id-b.id),spans=[];
 for(let i=0;i<4;i++){
  const d=sorted[i],spec=MICROCODE_SOURCE_MACROS[i],h=vm.handlers[i];need(d.id===i&&d.name===spec.name&&h.id===i&&h.name===d.name&&h.workgroupSize===1,'exact original WGS1 macro roster/order');
  const at=d.entryPc*8;need(at+16<=vm.code.length&&vm.code[at]===I.opcodes.EXTERNAL_CALL&&vm.code[at+2]===i&&vm.code[at+8]===I.opcodes.RET,'exact external stub/RET');for(let k=1;k<8;k++)need((k===2||vm.code[at+k]===0)&&vm.code[at+8+k]===0,'canonical external stub words');
  const baseline=generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:i});need(baseline===h.code,'original handler must equal current exact source generator');
  const slot=x=>{need(x.words===1&&Number.isInteger(x.slot)&&x.slot>=0&&x.slot+x.words<=vm.localWords,'candidate-local parameter span');return{offsetWords:I.control.words+x.slot,words:x.words};};
  need(d.returnWords===spec.resultWords&&(d.returnWords?d.returnSlot+d.returnWords<=vm.localWords:d.returnSlot===0),'candidate-local return span');
  spans.push({id:i,name:d.name,parameters:d.params.map(slot),return:d.returnWords?{offsetWords:I.control.words+d.returnSlot,words:d.returnWords}:null,candidateStrideWords:vm.stride});
 }
 return{p,vm,config,layout:resourceLayout(p,vm,audit),spans,rows};
}
function assertLimits(requirements,limits){
 for(const[key,required]of Object.entries(requirements.limits))need(limits[key]>=required,key+' below exact launch/resource requirement');
 for(const[name,b]of Object.entries(requirements.buffers))need(b.bytes<=limits.maxBufferSize&&b.bytes<=limits.maxStorageBufferBindingSize,name+' exceeds actual supplied storage/buffer limit');
}

/** Regeneration must be byte-identical to the original WGS1 handler except for
 * its SINGLE workgroup annotation. Dispatch padding is guarded before the VM
 * base or any candidate-owned access. No source budget or arithmetic changes. */
export function createMacroLaunchProfile(runtime,{macroWorkgroupSize,limits}={}){
 need(MACRO_LAUNCH_WORKGROUPS.includes(macroWorkgroupSize),'explicit WGS1/8/32/64 launch profile required');const declared=limitsCopy(limits),before=macroLaunchDataSha256(runtime),{p,vm,config,layout,spans,rows}=validatedRuntime(runtime),audit=auditSourceMacroLaunchClosures();
 const geometry=size=>({workgroupSize:size,workgroups:Math.ceil(p.count/size),invocations:Math.ceil(p.count/size)*size,paddingLanes:Math.ceil(p.count/size)*size-p.count});
 const handlers=vm.handlers.map(h=>{const code=generateMicrocodeExternalWGSL({...config,workgroupSize:macroWorkgroupSize,macroId:h.id});need(h.code.split('@workgroup_size(1)').length===2&&code===h.code.replace('@workgroup_size(1)',`@workgroup_size(${macroWorkgroupSize})`),'only exact workgroup annotation may differ');const guard=`if(gid.x>=${p.count}u||arrayLength(&rc_vm_state)!=${vm.totalWords}u){return;}let base=gid.x*${vm.stride}u;`;need(code.includes(guard),'padding/VM span guard precedes candidate access');return{id:h.id,name:h.name,code,baselineShaderSha256:sha(h.code),shaderSha256:sha(code),...geometry(macroWorkgroupSize),paddingGuard:guard};});
 const initializer=Object.entries(p.init.stages).map(([name,s])=>({name,shaderSha256:sha(s.code),workgroups:uint(s.workgroups,'source initializer '+name)})),sourceBegin={name:p.pc.begin.name,shaderSha256:sha(p.pc.begin.code),workgroups:p.count};
 const storageBindings=vm.eventAudit?8:7,requirements={buffers:layout.buffers,limits:{maxStorageBuffersPerShaderStage:storageBindings,maxBindingsPerBindGroup:storageBindings,maxBindGroups:1,maxComputeInvocationsPerWorkgroup:Math.max(64,macroWorkgroupSize),maxComputeWorkgroupSizeX:Math.max(64,macroWorkgroupSize),maxComputeWorkgroupsPerDimension:Math.max(p.count,Math.ceil(p.count/64),Math.ceil(p.count/macroWorkgroupSize),...initializer.map(s=>s.workgroups))}};assertLimits(requirements,declared);
 const payload={kind:MACRO_LAUNCH_PROFILE,version:1,source:{runtimeKind:runtime.kind,generatorProfile:runtime.sourcePreparation?.generatorProfile??'historical-h192-source-profile',runtimeDataSha256:before,sourceIdentity:p.identity.sourceIdentity,preStrikeIdentity:p.identity.preStrikeIdentity,generationIdentity:p.identity.generationIdentity,sourceSha256:runtime.identity.sourceSha256,bytecodeSha256:runtime.identity.bytecodeSha256,coreShaderSha256:runtime.identity.vmShaderSha256,rawInputSha256:p.identity.rawInputSha256,count:p.count,frames:p.frames,orderedIds:rows.map(r=>r.id),initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE},geometry:{core:geometry(64),macros:geometry(macroWorkgroupSize)},initializer,sourceBegin,handlers,sourceClosures:audit,vmArgumentSpans:spans,sourceSpans:layout.sourceSpans,requirements,planningLimits:declared,capability:MACRO_LAUNCH_CAPABILITY,gates:{exactOriginalCountRetained:true,sourceInitializationUnchanged:true,sourceBudgetUnchangedByLaunch:true,sourcePointerLocality:'inherited-source-authority; independent mixed-lane parity still required',actualGpuBufferDisjointness:'not-checked',coupledBudgetProof:'must-be-validated-for-this-exact-source; not-inferred-from-count2-h192',nativeCompilation:'not-run',physicalEvaluation:'unavailable'}};
 need(macroLaunchDataSha256(runtime)===before,'source runtime changed during launch preparation');return freeze({...payload,profileSha256:macroLaunchDataSha256(payload)});
}
export function verifyMacroLaunchProfile(runtime,profile,{limits}={}){
 need(profile?.kind===MACRO_LAUNCH_PROFILE&&profile.version===1,'known separately versioned launch profile');const {profileSha256,...payload}=profile;need(profileSha256===macroLaunchDataSha256(payload),'complete launch profile identity');
 const expected=createMacroLaunchProfile(runtime,{macroWorkgroupSize:profile.geometry?.macros?.workgroupSize,limits:profile.planningLimits});need(expected.profileSha256===profileSha256,'profile bound to exact original source/count/arguments/launch geometry');assertLimits(expected.requirements,limitsCopy(limits));return expected;
}
/** Source descriptors only; existing WGS1 runtime validators intentionally do
 * not accept this envelope. A lead-owned serialized native gate must integrate
 * the profile explicitly, validate GPUBuffer identity, and retain all rows. */
export function macroLaunchPipelineDescriptors(runtime,profile,{limits}={}){
 const checked=verifyMacroLaunchProfile(runtime,profile,{limits}),bindingTypes=['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage',...(runtime.vm.eventAudit?['storage']:[])];
 return freeze([{name:'macro-launch core begin',code:runtime.vm.shader,entryPoint:'begin',bindingTypes,workgroups:checked.geometry.core.workgroups},{name:'macro-launch core pump',code:runtime.vm.shader,entryPoint:'main',bindingTypes,workgroups:checked.geometry.core.workgroups},...checked.handlers.map(h=>({name:'macro-launch '+h.id+' '+h.name,code:h.code,entryPoint:'main',bindingTypes,workgroups:h.workgroups}))]);
}

/** Complete staged preflight roster: original initialization and source-PC
 * begin, unchanged core begin/pump, then four selected launch handlers. This
 * emits descriptors only. The lead must preflight/compile EVERY entry before
 * any numerical dispatch, and stop on failure without WGS/profile fallback. */
export function macroLaunchAllPipelineDescriptors(runtime,profile,{limits}={}){
 const coreAndMacros=macroLaunchPipelineDescriptors(runtime,profile,{limits}),p=runtime.original;
 return freeze([...Object.entries(p.init.stages).map(([stage,s])=>({...s,name:'macro-launch initialize '+stage,phase:'initialize',stage})),{...p.pc.begin,name:'macro-launch source PC begin',phase:'source-begin',bindingTypes:p.pc.bindingTypes,workgroups:p.count},...coreAndMacros.map((d,i)=>({...d,phase:i<2?'core':'macro'}))]);
}
