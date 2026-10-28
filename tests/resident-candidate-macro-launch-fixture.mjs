/* HOST SOURCE PREPARATION ONLY. No GPU, forward physics, expected future or
 * automatic full compilation. Legacy six-row payload supplies RAW INPUTS ONLY;
 * current authenticated initialization must regenerate the actual source. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {assertWorldInitializationPlan,buildWorldInitializationCommands,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import {validateWorldHistoryInitialization,packRawWorldHistoryClone} from '../src/resident-candidate/world-initial-history.mjs';
import {generateWorldHPlan,WORLD_H_BOUNDS} from '../src/resident-candidate/world-h.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {compileWorldSourceOwners} from '../src/resident-candidate/world-owners.mjs';
import {composeWorldMicrocodeSource} from '../src/resident-candidate/world-microcode-source.mjs';
import {RULE_LAYOUT as R,RULE_METHOD} from '../src/resident-candidate/physical-rules.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../src/source-event-history.mjs';
import {unpackCandidates,isOwnedUint32Array} from '../src/resident-candidate/abi.mjs';
import {generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL,microcodeVmLayout} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeUsedIntrinsicFunctions} from '../src/resident-candidate/microcode-isa.mjs';
import {MIXED_MACRO_RUNTIME,MACRO_LAUNCH_GENERATOR_PROFILE,macroLaunchDataSha256,assertMacroLaunchInitialHistory,MACRO_LAUNCH_CAPABILITY} from '../src/resident-candidate/macro-launch-profile.mjs';

export const MIXED_LAUNCH_SOURCE_KIND='resident-six-lane-full-history-macro-launch-source-v1';
export const MIXED_LAUNCH_RAW_KIND='resident-raw-pc-full-history-six-initial-only-runtime-v1';
export const MIXED_LAUNCH_INPUT_RUNTIME_SHA256='4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc';
const sha=value=>createHash('sha256').update(typeof value==='string'?value:ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):value).digest('hex');
const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze({id:row.id,settings:Object.freeze({...row.settings})})));
export const MIXED_LAUNCH_ROWS=freezeRows([
 {id:17,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0}},
 {id:118,settings:{angle:23,elevation:37,speed:1.7,tipX:.2,tipY:-.1}},
 {id:219,settings:{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1}},
 {id:320,settings:{angle:180,elevation:37,speed:.5,tipX:-.3,tipY:.15}},
 {id:421,settings:{angle:180,elevation:8,speed:2,tipX:0,tipY:0}},
 {id:522,settings:{angle:9,elevation:8,speed:0,tipX:0,tipY:0}},
]);
export const MIXED_LAUNCH_PREPARATION=Object.freeze({count:6,frames:2,coreWorkgroupSize:64,baselineMacroWorkgroupSize:1,
 macroIds:Object.freeze([0,1,2,3]),numericProfile:NUMERIC_PROFILE.PRESERVED_F32,intrinsics:'none',allocation:'call-frames-v1',
 laterGate:'all six original raw rows; multiple independently admitted valid lanes plus blocked/invalid lanes; no row reduction',
 oldSourceRuntimeReusable:false,fullCompilationRun:false,numericalGpuExecuted:false,fullRestQualified:false,native1024Qualified:false});
const ownedInputs=new WeakSet(),ownedSources=new WeakSet();

/** Opens ONLY supplied initial-runtime bytes. Its obsolete history/source is
 * deliberately not returned, composed, patched or admitted as a fresh runtime.
 * Retain the exact historical six raw rows; outcomes are not runtime inputs. */
export function mixedLaunchInputsFromLegacyInitial(bytes){
 assert.equal(sha(bytes),MIXED_LAUNCH_INPUT_RUNTIME_SHA256,'pinned legacy initial-only input provenance');const p=deserialize(bytes);
 assert.equal(p.kind,'resident-raw-pc-initial-only-runtime-v1');assert.equal(p.count,6);assert.equal(p.frames,2);assert.deepEqual(p.identity.rawRows,MIXED_LAUNCH_ROWS);
 const raw=unpackCandidates(p.input);assert.deepEqual(raw.map(({id,settings})=>({id,settings})),MIXED_LAUNCH_ROWS);
 assert.notEqual(p.identity.options?.initialHistoryProfile,SOURCE_EVENT_HISTORY_PROFILE,'this old payload is explicitly not current full-history authority');assert.equal(p.init.stages['creation-finish'].code.includes('rc_world_initial_history_commit'),false);
 const result=Object.freeze({kind:'resident-mixed-six-raw-input-provenance-v1',legacyInitialRuntimeSha256:MIXED_LAUNCH_INPUT_RUNTIME_SHA256,rows:freezeRows(p.identity.rawRows),sourceIdentity:p.identity.sourceIdentity,preStrikeIdentity:p.identity.preStrikeIdentity,sourceArtifactSha256:p.identity.sourceArtifactSha256,rawInputSha256:sha(p.input),rule:Object.freeze({...p.identity.rule}),legacySourceRejected:'missing full prestrike-event-history and accepted-stroke commit; raw rows only'});ownedInputs.add(result);return result;
}

/** This function can be expensive SOURCE generation, but never imports or runs
 * the scalar compiler or a CPU world/forward oracle. The lead coordinates its
 * invocation with the separate compiler worker, then hands source.code off.
 * Only a locally authenticated CURRENT initializationPlan is accepted. */
export function prepareMixedMacroLaunchSource({initializationPlan,inputProvenance,sourceHead,sourceHashes,sweeps=512}={}){
 assert.ok(ownedInputs.has(inputProvenance),'owned pinned raw-input provenance required');assert.match(sourceHead,/^[a-f0-9]{40}$/);assert.ok(sourceHashes&&Object.getPrototypeOf(sourceHashes)===Object.prototype&&Object.keys(sourceHashes).length);for(const hash of Object.values(sourceHashes))assert.match(hash,/^[a-f0-9]{64}$/);
 assert.ok(Number.isSafeInteger(sweeps)&&sweeps>0&&sweeps<=65536,'explicit bounded transport sweep budget');assertWorldInitializationPlan(initializationPlan);
 const t=initializationPlan.template,history=validateWorldHistoryInitialization(t);assert.equal(history.profile,SOURCE_EVENT_HISTORY_PROFILE);assert.deepEqual(initializationPlan.clone,packRawWorldHistoryClone(t),'exact prestrike raw clone, not created history');
 assert.equal(initializationPlan.sourceIdentity,inputProvenance.sourceIdentity);assert.equal(initializationPlan.preStrikeIdentity,inputProvenance.preStrikeIdentity);
 const count=6,frames=2,rows=inputProvenance.rows,transports={coupledTransport:'micro',cueTransport:'flat',applicationTransport:'staged',ccdTransport:'staged',queryTransport:'staged'};
 assert.deepEqual(rows,MIXED_LAUNCH_ROWS,'all six raw rows preserved without reduction');
 const init=buildWorldInitializationCommands(initializationPlan,count),h=generateWorldHPlan(t,{count,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,...transports}),phase=compileWorldDevicePc(h,{programBase:t.program.length,controlTailBase:init.resources.worldState,maxH:frames}),ownerPc=compileWorldSourceOwners(t,h,phase,{controlVisitPolicy:'single-call',controlPartition:'source-closures-v1'});
 const pc=Object.fromEntries(['kind','count','stateWords','scratchWords','programBase','controlTailBase','controlWords','totalStateWords','maxH','bytecode','instructions','begin','pipelines','sweep','bindingTypes','controlVisitPolicy','controlPartition','requestTailBase','requestWordsPerCandidate'].map(key=>[key,ownerPc[key]]));
 assert.deepEqual(pc.bytecode,phase.bytecode,'unchanged original PC schedule');assert.equal(pc.count,count);assert.equal(pc.maxH,frames);
 const program=new Uint32Array(t.program.length+pc.bytecode.length);program.set(t.program);program.set(pc.bytecode,pc.programBase);const input=packWorldInitializationRows(initializationPlan,rows);
 const options={sweeps,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,sourceMode:'owners',controlVisitPolicy:'single-call',controlPartition:'source-closures-v1',...transports,initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE};
 const ruleWords=t.state.subarray(t.segments.rules.offset,t.segments.rules.offset+t.segments.rules.words),method=Object.keys(RULE_METHOD).find(key=>RULE_METHOD[key]===ruleWords[R.method]);assert.ok(method);const rule={cueId:ruleWords[R.cueId],firstId:ruleWords[R.firstId],secondId:ruleWords[R.secondId],opponentId:ruleWords[R.opponentId],method,threeCushion:!!(ruleWords[R.options]&1),allowKiss:!!(ruleWords[R.options]&2),maxOuterSteps:ruleWords[R.maxSteps]};assert.ok(rule.maxOuterSteps>0);for(const[key,value]of Object.entries(inputProvenance.rule))assert.equal(rule[key],value,'unchanged original common rule '+key);
 const identity={sourceHead,sourceHashes:structuredClone(sourceHashes),sourceArtifactSha256:inputProvenance.sourceArtifactSha256,preStrikeIdentity:initializationPlan.preStrikeIdentity,sourceIdentity:t.sourceIdentity,rawRows:rows,rawInputSha256:sha(input),programSha256:sha(program),sharedGeometrySha256:sha(t.sharedGeometry),rule,frames,count,options,sourceCaps:WORLD_H_BOUNDS,pipelineIdentity:{initializer:Object.fromEntries(Object.entries(init.stages).map(([key,s])=>[key,sha(s.code)])),begin:sha(pc.begin.code),owners:pc.pipelines.map(p=>({name:p.name,sha256:sha(p.code)})),bytecodeSha256:sha(pc.bytecode),originalPhasePipelines:h.pipelines.length,sourceInstructions:pc.instructions,sweep:pc.sweep}};
 identity.generationIdentity=macroLaunchDataSha256(identity);
 const original={kind:MIXED_LAUNCH_RAW_KIND,identity,count,frames,sweeps,sourceMode:'owners',dispatches:init.dispatches+1+pc.sweep.length*sweeps,transport:h.transport,init,pc,program,input,sharedGeometry:t.sharedGeometry};
 assertMacroLaunchInitialHistory(original);const composed=composeWorldMicrocodeSource(pc);assert.ok(composed.code.includes('if(gid.x>=6u){return;}'),'fresh count-specialized six-row source guard');assertWorldInitializationPlan(initializationPlan);
 const fixture={kind:MIXED_LAUNCH_SOURCE_KIND,original,source:{entry:composed.entry,code:composed.code,sourceSha256:sha(composed.code)},initialHistory:structuredClone(history),inputProvenance:{legacyInitialRuntimeSha256:inputProvenance.legacyInitialRuntimeSha256,rawRowsSha256:macroLaunchDataSha256(rows),legacySourceReusable:false},configuration:MIXED_LAUNCH_PREPARATION};
 const result=Object.freeze({...fixture,sourceFixtureSha256:macroLaunchDataSha256(fixture)});ownedSources.add(result);return result;
}

/** Receive an actual separately compiled source artifact; never synthesize
 * bytecode or substitute fake physics. This is a PREPARATION envelope, not an
 * extension of the fixed count2/h192 coupled-budget admission. Lead-owned
 * compiler proof, resource, native mixed-lane parity gates are still required. */
export function attachMixedMacroLaunchCompilation(fixture,compiled,{instructionBudget=65536,dispatchChunks=512}={}){
 assert.ok(ownedSources.has(fixture),'owned fresh full-history source fixture required');const {sourceFixtureSha256,...sourceData}=fixture;assert.equal(macroLaunchDataSha256(sourceData),sourceFixtureSha256,'immutable source fixture unchanged');
 assert.equal(compiled.sourceSha256,fixture.source.sourceSha256,'compiler consumed exact regenerated full-history six-row source');assert.equal(compiled.entryFunction,fixture.source.entry);assert.ok(isOwnedUint32Array(compiled.instructions)&&compiled.instructions.length%8===0);assert.deepEqual([...compiled.externalFunctions].sort((a,b)=>a.id-b.id).map(x=>[x.id,x.name]),[[0,'rc_cue_flat_advance'],[1,'rc_num_eval'],[2,'rc_world_broad_commit_collision'],[3,'rc_coupled_transport_advance']]);assert.deepEqual(microcodeUsedIntrinsicFunctions(compiled.instructions),[],'no new native intrinsic authority');
 for(const n of[instructionBudget,dispatchChunks])assert.ok(Number.isSafeInteger(n)&&n>0&&n<=65536,'explicit bounded VM instruction/chunk budget');const entry=compiled.functions.find(f=>f.name===fixture.source.entry);assert.ok(entry&&entry.params.length===1&&entry.params[0].words===3,'exact original gid entry');
 const entrySlots=[{slot:entry.params[0].slot,candidateStride:1,value:0},{slot:entry.params[0].slot+1,value:0},{slot:entry.params[0].slot+2,value:0}],stackCapacity=Math.max(1,compiled.callDepth),layout=microcodeVmLayout({count:6,localWords:compiled.localWords,stackCapacity}),config={count:6,localWords:compiled.localWords,stackCapacity,instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget,initialSlots:entrySlots,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:compiled.externalFunctions};
 const shader=generateMicrocodeVmWGSL(config);assert.doesNotMatch(shader,/\brc_geometry_numeric_prepare\b|\brc_gp_\w*/,'preparation helper closure/call disabled in exact fresh core');const handlers=[...compiled.externalFunctions].sort((a,b)=>a.id-b.id).map(d=>({id:d.id,name:d.name,code:generateMicrocodeExternalWGSL({...config,workgroupSize:1,macroId:d.id}),workgroupSize:1}));
 const vm={version:compiled.version,code:compiled.instructions.slice(),shader,instructionCount:config.instructionCount,instructionBudget,dispatchChunks,localWords:compiled.localWords,stackCapacity,entryPc:compiled.entryPc,entrySlots,stride:layout.stride,totalWords:layout.totalWords,workgroupSize:64,intrinsics:'none',controlMode:'invocation-cache-v1',vmStateDisjoint:true,intrinsicFunctions:[],externalFunctions:structuredClone(compiled.externalFunctions),handlers,macroProfile:'source-four-macros-mixed-six-preparation-v1'};
 const runtime={kind:MIXED_MACRO_RUNTIME,original:structuredClone(fixture.original),vm,identity:{originalGeneration:fixture.original.identity.generationIdentity,sourceSha256:compiled.sourceSha256,bytecodeSha256:sha(vm.code),vmShaderSha256:sha(shader)},sourcePreparation:{generatorProfile:MACRO_LAUNCH_GENERATOR_PROFILE,preparation:false,sourceFixtureSha256,historyProfile:SOURCE_EVENT_HISTORY_PROFILE,coupledBudgetAdmission:false,capability:MACRO_LAUNCH_CAPABILITY}};
 assertMacroLaunchInitialHistory(runtime.original);assert.equal(runtime.original.count,6);assert.deepEqual(runtime.original.identity.rawRows,MIXED_LAUNCH_ROWS);return runtime;
}
