// Bounded owned-HOST post-impact diagnostic. Not raw input or native authority.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {microcodeVmLayout,createMicrocodeVmReferenceForTest,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeNumericContinuationDescriptor,MICROCODE_NUMERIC_CONTINUATION as N} from '../src/resident-candidate/microcode-numeric-continuation.mjs';
import {createMicrocodeNumericContinuationReferenceForTest} from './resident-candidate-microcode-numeric-continuation-reference.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {COUPLED_MACRO_PROFILE} from './resident-candidate-macro-profile-contract.mjs';
export const PHASED_GRAPH_PILOT='owned-host-post-impact-phased-graph-wg1-v1';
export const PHASED_GRAPH_PINS=Object.freeze({initial:'c83e9d8a897d97f7ebb9bb591107e44c4b8c66a606e0691ca66d12381429d2de',bytecode:'6fab6001ef5839ea03d98b0536eca8577acf09d988a8fb17e4bf8be76857c6ff',baselineFinal:'69a7c58a8a93e6939d761509215806b618816414981ac8b736c0dbd2afb365d1',originalSource:'5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7'});
const sha=x=>createHash('sha256').update(x).digest('hex'),C=I.control,S=I.status;
const read=(p,pin)=>{const b=readFileSync(p);assert.equal(sha(b),pin,'immutable diagnostic input '+p);return deserialize(b);};
const log=x=>console.log(JSON.stringify(x));
export function preparePhasedGraphPilot({initialPath,baselineFinalPath,outDir}){
 assert.equal(existsSync(outDir),false,'fresh isolated directory');const original=read(initialPath,PHASED_GRAPH_PINS.initial);
 assert.equal(original.kind,'owned-host-post-impact-inline-graph-only-v1');assert.equal(original.rawInput,false);assert.equal(original.bindings[0][5],192);assert.equal(original.configuration.count,2);assert.equal(original.configuration.instructionBudget,65536);assert.equal(original.compiled.sourceSha256,PHASED_GRAPH_PINS.originalSource);assert.equal(sha(original.compiled.instructions),PHASED_GRAPH_PINS.bytecode);
 assert.equal(sha(readFileSync(baselineFinalPath)),PHASED_GRAPH_PINS.baselineFinal,'only hash, do not decode future comparator');
 const c={...original.configuration,numericContinuation:N.mode,workgroupSize:1},layout=microcodeVmLayout(c),old=microcodeVmLayout(original.configuration);
 assert.equal(layout.numericTailOffset,old.stride);assert.equal(layout.numericTailWords,16);assert.equal(layout.stride,old.stride+16);for(const k of['localsOffset','stackOffset','localWords','stackCapacity'])assert.equal(layout[k],old[k]);
 const configuration={...c,numericContinuationDescriptor:microcodeNumericContinuationDescriptor({candidateCount:layout.count,vmStride:layout.stride,tailOffset:layout.numericTailOffset})},core=generateMicrocodeVmWGSL(configuration),wgs64=generateMicrocodeVmWGSL({...configuration,workgroupSize:64});
 assert.equal(core.replaceAll('@workgroup_size(1)','@workgroup_size(64)'),wgs64,'only declared launch annotations differ');
 assert.equal(/fn rc_num_eval\(/.test(core),false,'no complete graph evaluation loop in the core');
 const handlers=original.compiled.externalFunctions.toSorted((a,b)=>a.id-b.id).map(d=>({id:d.id,name:d.name,code:generateMicrocodeExternalWGSL({...configuration,macroId:d.id})}));assert.deepEqual(handlers.map(x=>x.id),[0,2,3]);
 const initial={kind:PHASED_GRAPH_PILOT,pins:PHASED_GRAPH_PINS,configuration,layout,core,handlers,compiled:original.compiled,bindings:original.bindings,template:original.template,pc:original.pc,diagnosticT0H:192,additionalH:1,rawInput:false,gpuAdmission:false};assert.equal(Object.hasOwn(initial,'vmState'),false,'fresh zero VM, never reshape old state');
 mkdirSync(outDir,{recursive:false});const bytes=serialize(initial);writeFileSync(join(outDir,'initial.v8'),bytes,{flag:'wx'});
 const manifest={kind:PHASED_GRAPH_PILOT,initialSha256:sha(bytes),pins:PHASED_GRAPH_PINS,initialBindingSha256:initial.bindings.map(sha),sourceBytecodeUnchanged:true,originalLocalsAndStackUnchanged:true,freshZeroVm:true,layout,core:{sha256:sha(core),bytes:Buffer.byteLength(core),workgroupSize:1,workgroups:2},wgs64CompileNotQualified:{sha256:sha(wgs64),bytes:Buffer.byteLength(wgs64),workgroupSize:64,workgroups:1},descriptor:configuration.numericContinuationDescriptor,handlers:handlers.map(({code,...x})=>({...x,sha256:sha(code),bytes:Buffer.byteLength(code)})),baselineFinalPath:resolve(baselineFinalPath),sourceInstructionBudget:65536,rawInput:false,gpuExecuted:false};
 writeFileSync(join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});log({stage:'phased-graph-prepared',...manifest,descriptor:{...manifest.descriptor,sourceApproval:undefined}});return manifest;
}
export function runPhasedGraphPilot(dir,{maxPumps=2048,maxWallMs=240000}={}){
 assert.ok(Number.isInteger(maxPumps)&&maxPumps>0&&maxPumps<=2048);assert.ok(Number.isInteger(maxWallMs)&&maxWallMs>0&&maxWallMs<=240000);
 const m=JSON.parse(readFileSync(join(dir,'manifest.json'))),initial=read(join(dir,'initial.v8'),m.initialSha256);assert.equal(initial.kind,PHASED_GRAPH_PILOT);assert.deepEqual(initial.pins,PHASED_GRAPH_PINS);assert.deepEqual(initial.bindings.map(sha),m.initialBindingSha256);
 const bindings=initial.bindings.map(x=>x.slice()),calls={},handlerCache=new WeakMap();
 const numericContinuationHandler=(operation,args,{state,configuration})=>{let helper=handlerCache.get(state);if(!helper){helper=createMicrocodeNumericContinuationReferenceForTest({testOnly:true,candidateCount:configuration.count,vmStride:configuration.stride,tailOffset:configuration.numericTailOffset,vmState:state,program:bindings[1],scratch:bindings[3]});handlerCache.set(state,helper);}if(operation==='start')calls.rc_num_eval=(calls.rc_num_eval??0)+1;return helper[operation](...args);};
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,...initial.configuration,code:initial.compiled.instructions,bindings,numericContinuationHandler});for(let lane=0;lane<2;lane++)vm.begin(lane);
 const started=performance.now();let pumps=0;while(![0,1].every(lane=>vm.state[lane*vm.layout.stride+C.status]===S.complete)){
  assert.ok(pumps++<maxPumps,'bounded diagnostic pumps');assert.ok(performance.now()-started<maxWallMs,'bounded HOST-only wall cap, not physical horizon');
  for(let lane=0;lane<2;lane++){vm.advance(lane,65536);for(const d of initial.compiled.externalFunctions.toSorted((a,b)=>a.id-b.id))vm.serviceExternal(lane,d.id,(desc,args)=>{calls[desc.name]=(calls[desc.name]??0)+1;return microcodeExternalReference(desc,args,{bindings:bindings.slice(0,5),macroProfile:COUPLED_MACRO_PROFILE});});assert.ok(![S.invalid,S.unsupported].includes(vm.state[lane*vm.layout.stride+C.status]),'unexpected VM failure is not miss');}
 }
 const hostWallMs=performance.now()-started;assert.equal(bindings[0][5],193);assert.equal(bindings[0][initial.template.state.length+5],0);assert.equal(calls.rc_num_eval,77);
 const baseline=read(m.baselineFinalPath,PHASED_GRAPH_PINS.baselineFinal);assert.deepEqual(bindings,baseline.bindings,'every source binding including dirty words/audit exact');
 const steps=[0,1].map(lane=>Number((BigInt(vm.state[lane*vm.layout.stride+C.stepsHigh])<<32n)+BigInt(vm.state[lane*vm.layout.stride+C.stepsLow]))),microSteps=[0,1].map(lane=>{const t=lane*vm.layout.stride+vm.layout.numericTailOffset;assert.deepEqual(Array.from(vm.state.slice(t,t+14)),Array(14).fill(0),'completed graph cursor clears without changing source state');return Number((BigInt(vm.state[t+15])<<32n)+BigInt(vm.state[t+14]));});assert.deepEqual(steps,[2751871,2511],'source instructions commit once, not per numeric microstep');
 const bytes=serialize({kind:PHASED_GRAPH_PILOT,initialSha256:m.initialSha256,bindings,vmState:vm.state});writeFileSync(join(dir,'final.v8'),bytes,{flag:'wx'});
 const result={kind:PHASED_GRAPH_PILOT,status:'pass',initialSha256:m.initialSha256,finalSha256:sha(bytes),pins:PHASED_GRAPH_PINS,pumps,coreSteps:steps,numericMicroSteps:microSteps,calls,hostWallMs,theoreticalFixedCommands:pumps*4,allSixFinalBindingWordsEqual:true,sourceOpcodeCountersExact:true,workgroupSize:1,workgroups:2,rawInput:false,gpuExecuted:false,fullRestQualified:false,nativePhysicsLabH193Qualified:false};writeFileSync(join(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});log({stage:'phased-graph-host-terminal',...result});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[mode,...args]=process.argv.slice(2);if(mode==='prepare'){assert.equal(args.length,3);preparePhasedGraphPilot({initialPath:resolve(args[0]),baselineFinalPath:resolve(args[1]),outDir:resolve(args[2])});}else if(mode==='run'){assert.equal(args.length,1);runPhasedGraphPilot(resolve(args[0]));}else throw Error('Explicit prepare or run');}
