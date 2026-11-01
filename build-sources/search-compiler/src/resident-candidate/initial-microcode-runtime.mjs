/* SPDX-License-Identifier: Apache-2.0
 * Opt-in source construction only: authenticated common t0 + raw parameters ->
 * immutable initial uploads and exact resident microcode/handler sources.
 * No test import, device request, CPU stepping, future-state input or publisher.
 */
import {assertWorldInitializationPlan,buildWorldInitializationCommands,packWorldInitializationRows} from './world-initialization.mjs';
import {validateWorldHistoryInitialization,packRawWorldHistoryClone} from './world-initial-history.mjs';
import {generateWorldHPlan,WORLD_H_BOUNDS} from './world-h.mjs';
import {compileWorldDevicePc} from './world-device-pc.mjs';
import {compileWorldSourceOwners} from './world-owners.mjs';
import {composeWorldMicrocodeSource} from './world-microcode-source.mjs';
import {compileMicrocodeWGSL} from './microcode-compiler.mjs';
import {allocateMicrocodeLocals} from './microcode-allocation.mjs';
import {generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL,microcodeVmLayout} from './microcode-vm.mjs';
import {MICROCODE_ISA as I,microcodeUsedIntrinsicFunctions} from './microcode-isa.mjs';
import {inspectInitialMicrocodeBudget} from './initial-microcode-budget.mjs';
import {macroLaunchDataSha256} from './macro-launch-data.mjs';
import {MACRO_LAUNCH_GENERATOR_PROFILE} from './macro-launch-profile.mjs';
import {RULE_LAYOUT as R,RULE_METHOD} from './physical-rules.mjs';
import {createHash} from './source-sha256.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../source-event-history.mjs';
import {unpackCandidates,isOwnedUint32Array} from './abi.mjs';
export const INITIAL_MICROCODE_RUNTIME_KIND='resident-owned-initial-microcode-runtime-v1';
export const INITIAL_MICROCODE_CAPABILITY=Object.freeze({sourceConstructionOnly:true,initialOnly:true,experimentalOptIn:true,arbitraryRawRows:true,hostForwardFallback:false,automaticDeviceRequest:false,numericallyQualified:false,originalFullRestQualified:false,native1024TrajectoriesQualified:false,hardwarePerformanceMeasured:false,defaultBackend:false});
const transports=Object.freeze({coupledTransport:'micro',cueTransport:'flat',applicationTransport:'staged',ccdTransport:'staged',queryTransport:'staged'}),macros=Object.freeze(['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision','rc_coupled_transport_advance']),owned=new WeakMap();
const need=(ok,message)=>{if(!ok)throw new RangeError('Initial microcode runtime: '+message);},sha=x=>createHash('sha256').update(x).digest('hex');
const typedPrototype=Object.getPrototypeOf(Uint32Array.prototype),getter=key=>Object.getOwnPropertyDescriptor(typedPrototype,key).get,viewBuffer=getter('buffer'),viewOffset=getter('byteOffset'),viewLength=getter('byteLength'),bufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
function freezeData(value,views,seen=new WeakSet()){
 if(!value||typeof value!=='object'||seen.has(value))return value;seen.add(value);
 if(ArrayBuffer.isView(value)){need(isOwnedUint32Array(value),'owned initial u32 view');const buffer=viewBuffer.call(value),offset=viewOffset.call(value),length=viewLength.call(value),backingLength=bufferLength.call(buffer),bytes=new Uint8Array(buffer,offset,length).slice();views.push(Object.freeze({value,buffer,offset,length,backingLength,bytes}));Object.preventExtensions(value);return value;}
 for(const item of Object.values(value))freezeData(item,views,seen);return Object.freeze(value);
}
function assertViews(views){
 for(const p of views){let bytes;try{if(viewBuffer.call(p.value)===p.buffer&&viewOffset.call(p.value)===p.offset&&viewLength.call(p.value)===p.length&&bufferLength.call(p.buffer)===p.backingLength)bytes=new Uint8Array(p.buffer,p.offset,p.length);}catch{/* Detached/resized/shared backing is not the admitted span. */}
  need(bytes&&bytes.length===p.bytes.length,'owned runtime contents changed: backing span');for(let i=0;i<bytes.length;i++)if(bytes[i]!==p.bytes[i])need(false,'owned runtime contents changed: typed bytes');
 }
}
function optionsOf(options){
 need(options&&Object.getPrototypeOf(options)===Object.prototype,'explicit plain options required');const d=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(d),allowed=['experimental','maxHSteps','dispatchChunks','instructionBudget'];
 need(!keys.includes('eventAudit')&&!keys.includes('observation')&&!keys.includes('observer')&&!keys.includes('audit'),'mandatory audit/observer transport is not supported by this seven-binding constructor');
 need(keys.every(k=>typeof k==='string'&&allowed.includes(k)&&Object.hasOwn(d[k],'value')),'only declared data options; no numerical qualification override');need(d.experimental?.value===true,'explicit experimental opt-in required');
 const maxHSteps=d.maxHSteps?.value,dispatchChunks=d.dispatchChunks?.value,instructionBudget=d.instructionBudget?.value??65536;need(Number.isInteger(maxHSteps)&&maxHSteps>=1&&maxHSteps<=0xffffffff,'explicit source h ceiling required');need(Number.isInteger(dispatchChunks)&&dispatchChunks>=1&&dispatchChunks<=65536,'explicit independent VM pump budget required');need(instructionBudget===65536,'unchanged baseline VM instruction budget 65536 required');return{maxHSteps,dispatchChunks,instructionBudget};
}
/** Synchronous and source-only. A worker must already own a genuinely admitted
 * initialization plan; a deserialized fixture/hash/receipt cannot replace it.
 * Count admission here is SOURCE generation, not actual device/scale admission.
 */
export function createInitialMicrocodeRuntime(initializationPlan,rows,options){
 const {maxHSteps,dispatchChunks,instructionBudget}=optionsOf(options);assertWorldInitializationPlan(initializationPlan);macroLaunchDataSha256(rows);
 const input=packWorldInitializationRows(initializationPlan,rows),count=input.length/16,t=initializationPlan.template,history=validateWorldHistoryInitialization(t);
 need(t.state.length===62976&&t.numericScratchWords===13632,'current source-budget-admitted world/scratch layout only');need(history.profile===SOURCE_EVENT_HISTORY_PROFILE,'complete original history profile');need(sha(initializationPlan.clone)===sha(packRawWorldHistoryClone(t)),'exact prestrike clone, not created or evolved state');
 const init=buildWorldInitializationCommands(initializationPlan,count),sourcePlan=generateWorldHPlan(t,{count,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,...transports});need(sourcePlan.transport.instructionBudget===32768,'original source macro budget');
 const phase=compileWorldDevicePc(sourcePlan,{programBase:t.program.length,controlTailBase:init.resources.worldState,maxH:maxHSteps}),owners=compileWorldSourceOwners(t,sourcePlan,phase,{controlVisitPolicy:'single-call',controlPartition:'source-closures-v1'});
 const pc=Object.fromEntries(['kind','count','stateWords','scratchWords','programBase','controlTailBase','controlWords','totalStateWords','maxH','bytecode','instructions','begin','pipelines','sweep','bindingTypes','controlVisitPolicy','controlPartition','requestTailBase','requestWordsPerCandidate'].map(key=>[key,owners[key]]));need(sha(pc.bytecode)===sha(phase.bytecode),'original PC schedule unchanged');
 const program=new Uint32Array(t.program.length+pc.bytecode.length);program.set(t.program);program.set(pc.bytecode,pc.programBase);
 const source=composeWorldMicrocodeSource(pc),compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(source.code,{entry:source.entry,storageBindings:I.bindings,intrinsics:'none',externalFunctions:macros,allocationMetadata:true}),{mode:'call-frames-v1'});
 need(microcodeUsedIntrinsicFunctions(compiled.instructions).length===0,'no unqualified inline intrinsic');for(let i=0;i<compiled.instructions.length;i+=8)need(compiled.instructions[i]!==I.opcodes.GEOMETRY_NUMERIC_PREPARE,'preparation helper disabled');
 const budget=inspectInitialMicrocodeBudget({code:source.code,compiled,count,stateWords:pc.stateWords,scratchWords:pc.scratchWords}),entry=compiled.functions.find(f=>f.name===source.entry);need(entry?.params.length===1&&entry.params[0].words===3,'exact gid entry');
 const entrySlots=[{slot:entry.params[0].slot,candidateStride:1,value:0},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],stackCapacity=Math.max(1,compiled.callDepth),layout=microcodeVmLayout({count,localWords:compiled.localWords,stackCapacity}),config={count,localWords:compiled.localWords,stackCapacity,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget,initialSlots:entrySlots,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions};
 const shader=generateMicrocodeVmWGSL(config);need(!/\brc_geometry_numeric_prepare\b|\brc_gp_\w*/.test(shader),'preparation closure absent');const handlers=[...compiled.externalFunctions].sort((a,b)=>a.id-b.id).map(d=>({id:d.id,name:d.name,code:generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:d.id}),workgroupSize:1}));need(handlers.map(d=>d.id).join(',')==='0,1,2,3','four exact source macros');
 const vm={version:compiled.version,code:compiled.instructions,shader,instructionCount:config.instructionCount,instructionBudget,dispatchChunks,localWords:compiled.localWords,stackCapacity,entryPc:compiled.entryPc,entrySlots,stride:layout.stride,totalWords:layout.totalWords,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions,handlers,macroProfile:'source-four-macros-owned-initial-v1'};
 const ruleWords=t.state.subarray(t.segments.rules.offset,t.segments.rules.offset+t.segments.rules.words),method=Object.keys(RULE_METHOD).find(key=>RULE_METHOD[key]===ruleWords[R.method]);need(method!==undefined,'original rule method');
 const rule={cueId:ruleWords[R.cueId],firstId:ruleWords[R.firstId],secondId:ruleWords[R.secondId],opponentId:ruleWords[R.opponentId],method,threeCushion:!!(ruleWords[R.options]&1),allowKiss:!!(ruleWords[R.options]&2),maxOuterSteps:ruleWords[R.maxSteps]};
 const rawRows=unpackCandidates(input).map(({id,settings})=>({id,settings})),sourceIdentity={sourceIdentity:initializationPlan.sourceIdentity,preStrikeIdentity:initializationPlan.preStrikeIdentity,rawRows,rawInputSha256:sha(input),programSha256:sha(program),sharedGeometrySha256:sha(t.sharedGeometry),rule,count,frames:maxHSteps,options:{sweeps:dispatchChunks,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,sourceMode:'owners',controlVisitPolicy:'single-call',controlPartition:'source-closures-v1',...transports,initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE},sourceCaps:WORLD_H_BOUNDS,pipelineIdentity:{initializer:Object.fromEntries(Object.entries(init.stages).map(([key,s])=>[key,sha(s.code)])),begin:sha(pc.begin.code),owners:pc.pipelines.map(p=>({name:p.name,sha256:sha(p.code)})),bytecodeSha256:sha(pc.bytecode),originalPhasePipelines:sourcePlan.pipelines.length,sourceInstructions:pc.instructions,sweep:pc.sweep}};
 sourceIdentity.generationIdentity=macroLaunchDataSha256(sourceIdentity);
 const logicalViews={sourceState:pc.totalStateWords,sourceProgram:program.length,sourceGeometry:t.sharedGeometry.length,sourceScratch:init.scratchAlias.words,sourceInputs:input.length,microcode:compiled.instructions.length,vmState:layout.totalWords};
 const original={kind:'resident-owned-raw-pc-initial-only-v1',identity:sourceIdentity,count,frames:maxHSteps,sweeps:dispatchChunks,sourceMode:'owners',transport:sourcePlan.transport,init,pc,program,input,sharedGeometry:t.sharedGeometry};
 const runtime=structuredClone({kind:INITIAL_MICROCODE_RUNTIME_KIND,version:1,original,vm,identity:{originalGeneration:sourceIdentity.generationIdentity,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(compiled.instructions),vmShaderSha256:sha(shader),initialDataSha256:macroLaunchDataSha256(sourceIdentity),logicalViewsSha256:macroLaunchDataSha256(logicalViews)},source:{entry:source.entry,code:source.code},sourcePreparation:{generatorProfile:MACRO_LAUNCH_GENERATOR_PROFILE,preparation:false,eventAudit:false,observation:false,logicalViews,historyProfile:SOURCE_EVENT_HISTORY_PROFILE,budget,capability:INITIAL_MICROCODE_CAPABILITY}});
 assertWorldInitializationPlan(initializationPlan);const views=[];freezeData(runtime,views);owned.set(runtime,{initializationPlan,dataSha256:macroLaunchDataSha256(runtime),views:Object.freeze(views)});return runtime;
}
/** Do not pass a structured-cloned envelope as authority. Admission must be in
 * the same worker that authenticated initial input and generated this runtime.
 * Every current mutable byte/span (including unused/dirty words) is compared
 * against its immutable snapshot. Frozen metadata/strings cannot change and
 * need not be rehashed on each async continuation; the constructor hash remains.
 */
export function assertInitialMicrocodeRuntime(runtime){const proof=owned.get(runtime);need(proof,'locally constructed initial-only runtime required');assertWorldInitializationPlan(proof.initializationPlan);assertViews(proof.views);return runtime;}
