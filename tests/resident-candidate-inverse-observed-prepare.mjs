// HOST INITIAL-only preparation. No original CPU stepper, expected snapshots,
// Dawn/WebGPU execution or replay is imported. Compilation is not qualification.
import assert from 'node:assert/strict';
import {createHash} from '../src/resident-candidate/source-sha256.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../src/source-event-history.mjs';
import {assertWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {createInverseWorldObservationPlan} from '../src/resident-candidate/inverse-world-observation.mjs';
import {composeInverseAuditObservationSource} from '../src/resident-candidate/inverse-observation-storage.mjs';
import {createTipImpactSourcePlan} from './resident-candidate-tip-impact-source-plan.mjs';
import {serializeRawTipImpactPcRuntime} from './resident-candidate-isolated-runtime.mjs';
import {RAW_PC_SAFE_TRANSPORTS} from './resident-candidate-raw-world-pc-runner.mjs';
import {WORLD_H_BOUNDS} from '../src/resident-candidate/world-h.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {microcodeVmLayout,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {INVERSE_OBSERVED_RUNTIME_KIND,INVERSE_OBSERVED_MACRO_PROFILE,INVERSE_OBSERVED_TRANSPORT_KIND,inverseObservedDataSha256,inverseObservedRuntimeProof} from './resident-candidate-inverse-observed-runtime-profile.mjs';
import {assertMicrocodeInverseTipImpactRuntime} from './resident-candidate-microcode-world-runtime.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const macros=Object.freeze(['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision','rc_coupled_transport_advance']);
const limits=Object.freeze({maxStorageBufferBindingSize:128*1024*1024,maxBufferSize:256*1024*1024,maxStorageBuffersPerShaderStage:8});
const topology=Object.freeze({events:Object.freeze([{kind:'object',id:3},{kind:'object',id:4}].map(Object.freeze))});
/** Returns an UNADMITTED source compilation candidate. Only the separately
 * pinned prepare function below can pass the lean runtime admission. */
export function compileInverseTipImpactRuntimeCandidate({initializationPlan,sourceSeed,rows,sweeps,provenance}={}){
 const init=assertWorldInitializationPlan(initializationPlan);assert.equal(sourceSeed?.initialEventHistoryProfile,SOURCE_EVENT_HISTORY_PROFILE);assert.ok(Number.isSafeInteger(sweeps)&&sweeps>0&&sweeps<=65536,'explicit bounded transport, never physical cutoff');
 assert.deepEqual(Object.keys(provenance??{}).sort(),['sourceHead','sourceHashes','sourceArtifactSha256'].sort());assert.match(provenance.sourceHead,/^[a-f0-9]{40}$/);assert.match(provenance.sourceArtifactSha256,/^[a-f0-9]{64}$/);assert.ok(Object.keys(provenance.sourceHashes).length);for(const [name,digest]of Object.entries(provenance.sourceHashes)){assert.ok(typeof name==='string'&&name.length>0);assert.match(digest,/^[a-f0-9]{64}$/);}
 const g=createTipImpactSourcePlan({initializationPlan:init,rows,sweeps}),observer=createInverseWorldObservationPlan({seed:sourceSeed,template:g.template,topology,eventCapacity:256}).plan,source=composeInverseAuditObservationSource({observer,pc:g.pc,template:g.template,auditPlan:g.source,diagnostics:'tip-impact-128-192',limits});
 const options={sweeps,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,sourceMode:'owners',controlVisitPolicy:'single-call',controlPartition:'source-closures-v1',...RAW_PC_SAFE_TRANSPORTS,initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE};
 const identity={...structuredClone(provenance),preStrikeIdentity:init.preStrikeIdentity,sourceIdentity:g.template.sourceIdentity,rawRows:structuredClone(rows),rawInputSha256:sha(g.input),programSha256:sha(g.program),sharedGeometrySha256:sha(g.template.sharedGeometry),rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:15360},frames:192,count:2,options,sourceCaps:WORLD_H_BOUNDS,pipelineIdentity:{initializer:Object.fromEntries(Object.entries(g.init.stages).map(([k,v])=>[k,sha(v.code)])),begin:sha(g.pc.begin.code),owners:g.pc.pipelines.map(x=>({name:x.name,sha256:sha(x.code)})),bytecodeSha256:sha(g.pc.bytecode),originalPhasePipelines:g.source.pipelines.length,sourceInstructions:g.pc.instructions,sweep:g.pc.sweep}};identity.generationIdentity=inverseObservedDataSha256(identity);
 const original=serializeRawTipImpactPcRuntime(g,identity),compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(source.code,{entry:source.entry,storageBindings:{...I.bindings,rc_event_audit:5},intrinsics:'none',externalFunctions:macros,allocationMetadata:true}),{mode:'call-frames-v1'}),entry=compiled.functions.find(f=>f.name===source.entry);assert.equal(entry.params.length,1);assert.equal(entry.params[0].words,3);
 const entrySlots=[{slot:entry.params[0].slot,candidateStride:1,value:0},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],stackCapacity=Math.max(1,compiled.callDepth),layout=microcodeVmLayout({count:2,localWords:compiled.localWords,stackCapacity}),config={count:2,localWords:compiled.localWords,stackCapacity,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget:65536,initialSlots:entrySlots,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions,eventAudit:true},shader=generateMicrocodeVmWGSL(config),handlers=compiled.externalFunctions.toSorted((a,b)=>a.id-b.id).map(x=>({id:x.id,name:x.name,code:generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:x.id}),workgroupSize:1}));
 const vm={version:compiled.version,code:compiled.instructions,shader,instructionCount:config.instructionCount,instructionBudget:65536,dispatchChunks:sweeps,localWords:compiled.localWords,stackCapacity,entryPc:compiled.entryPc,entrySlots,stride:layout.stride,totalWords:layout.totalWords,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions,handlers,eventAudit:true,macroProfile:INVERSE_OBSERVED_MACRO_PROFILE};
 // `expected` is the immutable route target/event specification, never future
 // observations, expected source banks, or CPU-scored terminal results.
 const observation={kind:INVERSE_OBSERVED_TRANSPORT_KIND,profile:observer.kind,numberProfile:observer.layout.numberProfile,sourceIdentity:observer.sourceIdentity,storage:source.layout,segments:observer.segments,frameWords:observer.layout.frameWords,stateWords:observer.layout.stateWords,eventCapacity:observer.layout.eventCapacity,expected:observer.layout.expected,initialBoundary:'once-before-original-begin-outer',substepBoundary:'postsolve-before-original-begin-post-h',terminalJoinScheduled:false,diagnosticOnly:true};
 const runtime={kind:INVERSE_OBSERVED_RUNTIME_KIND,original,vm,audit:source.checkpointLayout,observation,identity:{originalGeneration:identity.generationIdentity,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(compiled.instructions),vmShaderSha256:sha(shader)}};
 return{runtime,source,compiled,observer,proof:inverseObservedRuntimeProof(runtime),scope:Object.freeze({sourceOnly:true,initialOnly:true,bornH:192,physicalHorizonSeconds:16,perHHostMaps:0,terminalJoinScheduled:false,gpuExecuted:false,qualified:false})};
}
export function prepareInverseTipImpactRuntime(input){const candidate=compileInverseTipImpactRuntimeCandidate(input);assertMicrocodeInverseTipImpactRuntime(candidate.runtime);return candidate;}
