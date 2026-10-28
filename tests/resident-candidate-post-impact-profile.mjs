// HOST diagnostic only. The owned completed h192 bank is the declared t0;
// it is never a raw-shot initializer or a source of expected future values.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {COUPLED_MACRO_PROFILE} from './resident-candidate-macro-profile-contract.mjs';
import {sourceMacroNativeWGSL} from '../src/resident-candidate/microcode-source-macros.mjs';
import {generateNumberProgramMacroAdmissionWGSL} from '../src/resident-candidate/number-program-macro-admission.mjs';
import {requiredVmLocalOperands} from './resident-candidate-microcode-memory-access-audit.mjs';
export const POST_IMPACT_PROFILE='owned-host-h192-one-h-diagnostic-v1';
export const POST_IMPACT_PINS=Object.freeze({
 initialSourceRuntime:'7cf2c1be3dc3c6736ed07a89d5df92fb01df416df519e86532f1f008839c9f1e',
 fourInitial:'74c67de5efd476cbbe394678cfc927ac5ed6d70a3b38c5e24697dd735895eb75',
 fiveInitial:'58563faa553e52826dd9adb9d4b198301b4c164fdfa1b9d1f52160f92ecdf3d2',
 fourFinal:'51df3ee40d56d9cd9b5c27637d93655e491d78800c0bbcc9d80235abf531c605',
 fiveFinal:'fbadfa2b0342918c3faaf6b4c1a98e5ef95ed02cc3df33faeba1f2d61271ea98',
 fiveAssertion:'05461ffccc4195529a96a9254a6a19fa7f9f8e6033f7bcfd4994f799398db44e',
});
const sha=x=>createHash('sha256').update(x).digest('hex'),C=I.control,S=I.status;
const load=(file,pin)=>{const bytes=readFileSync(file);assert.equal(sha(bytes),pin,'immutable owned diagnostic input '+file);return deserialize(bytes);};
const log=x=>console.log(JSON.stringify(x));
function beginFromOriginal(code,bindings){
 const p=allocateMicrocodeLocals(compileMicrocodeWGSL(code,{entry:'main',storageBindings:{...I.bindings,rc_event_audit:5},allocationMetadata:true}),{mode:'call-frames-v1'}),f=p.functions.find(x=>x.name==='main');
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:2,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,eventAudit:true,bindings,initialSlots:[{slot:f.params[0].slot,candidateStride:1},{slot:f.params[0].slot+1,value:0},{slot:f.params[0].slot+2,value:0}]});
 for(let lane=0;lane<2;lane++){vm.begin(lane);let status=S.ready,n=0;while(status===S.ready&&n++<128)status=vm.advance(lane,65536);assert.equal(status,S.complete);assert.equal(vm.state[lane*vm.layout.stride+C.error],0);}
 return {sourceSha256:sha(code),bytecodeSha256:sha(p.instructions)};
}
export function oneHDiagnosticPcBegin(original){const old='rc_state[cb+6u]=192u;';assert.equal(original.split(old).length,2,'exact single original requested-h literal');return original.replace(old,'rc_state[cb+6u]=1u;');}
export function preparePostImpactProfile({artifactRoot,outDir}){
 assert.equal(existsSync(outDir),false,'new diagnostic directory required');const a=resolve(artifactRoot),four=load(join(a,'tip-impact-coupled-created-host-v1/initial.v8'),POST_IMPACT_PINS.fourInitial),five=load(join(a,'number-macro-created-host-v1/initial.v8'),POST_IMPACT_PINS.fiveInitial),f4=load(join(a,'tip-impact-coupled-created-host-v1/continuation.v8'),POST_IMPACT_PINS.fourFinal),f5=load(join(a,'number-macro-created-host-v1/continuation.v8'),POST_IMPACT_PINS.fiveFinal);
 const assertionBytes=readFileSync(join(a,'number-macro-created-host-v1/independent-assertion.json'));assert.equal(sha(assertionBytes),POST_IMPACT_PINS.fiveAssertion);const proof=JSON.parse(assertionBytes);assert.equal(proof.status,'pass');assert.equal(proof.allSixBindingWordsExact,true);assert.equal(proof.comparison.all11SourceGroups,true);assert.equal(proof.comparison.nativePhysicsLabOuter,true);assert.equal(proof.comparison.fullAcceptedEmissionTapeQualified,true);
 assert.deepEqual(f4.bindings,f5.bindings);assert.equal(f4.bindings[0][5],192);assert.equal(f4.bindings[0][four.template.state.length+5],0);assert.equal(f4.noGpuAdmission,true);assert.equal(f5.gpuAdmission,false);
 for(const p of[four,five]){assert.equal(p.noGpuAdmission,true);assert.equal(p.createdInput,true);assert.equal(p.rawInput,false);assert.equal(p.configuration.instructionBudget,65536);assert.equal(p.configuration.intrinsics,'none');}
 const sourceRuntime=load(join(a,'coupled-raw-impact-native-v1/runtime.v8'),POST_IMPACT_PINS.initialSourceRuntime),phase=sourceRuntime.original.pc;assert.equal(sourceRuntime.original.count,2);assert.equal(sourceRuntime.original.frames,192);assert.equal(phase.maxH,192);assert.equal(phase.controlTailBase,four.pc.controlTailBase);assert.equal(phase.controlWords,four.pc.controlWords);assert.deepEqual(phase.bytecode,f4.bindings[1].subarray(phase.programBase),'all source phase instructions/order/caps unchanged');
 const beginCode=oneHDiagnosticPcBegin(phase.begin.code),bindings=f4.bindings.map(x=>x.slice()),before=bindings.map(x=>x.slice()),begin={...beginFromOriginal(beginCode,bindings),originalSourceSha256:sha(phase.begin.code),change:'only declared diagnostic requestedH192→1; physical source instructions untouched'},allowed=new Set();
 for(let lane=0;lane<2;lane++){const cb=four.pc.controlTailBase+lane*four.pc.controlWords;for(let k=0;k<four.pc.controlWords;k++)allowed.add(cb+k);assert.equal(bindings[0][cb+PC.header.initialH],lane?0:192);assert.equal(bindings[0][cb+PC.header.requestedH],1);assert.equal(bindings[0][cb+PC.header.completedH],0);}
 for(let bi=0;bi<6;bi++)for(let k=0;k<before[bi].length;k++)if(bi!==0||!allowed.has(k))assert.equal(bindings[bi][k],before[bi][k],'no physical/scratch/audit/program/input t0 word edited');
 const initial={kind:POST_IMPACT_PROFILE,diagnosticT0H:192,requestedAdditionalH:1,expectedEndH:193,rawInput:false,gpuAdmission:false,noCpuFutureInput:true,sourceAdvanceCalls:0,pins:POST_IMPACT_PINS,begin,four,five,bindings};
 mkdirSync(outDir,{recursive:false});const bytes=serialize(initial);writeFileSync(join(outDir,'initial.v8'),bytes,{flag:'wx'});const manifest={kind:POST_IMPACT_PROFILE,initialSha256:sha(bytes),pins:POST_IMPACT_PINS,begin,initialBindingSha256:bindings.map(sha),coreBytecodeSha256:{four:sha(four.compiled.instructions),five:sha(five.compiled.instructions)},diagnosticT0H:192,requestedAdditionalH:1,expectedEndH:193,onlyOriginalPcBeginBookkeepingChanged:true,physicalStateWordsUnchanged:true,rawInput:false,gpuAdmission:false,noCpuFutureInput:true};writeFileSync(join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});log({stage:'post-impact-diagnostic-prepared',...manifest});return manifest;
}
function numberReference(initial,bindings){
 const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;',guard=generateNumberProgramMacroAdmissionWGSL(initial.five.numberProgramViews,{count:2,vmStateDisjoint:true}),code=prefix+sourceMacroNativeWGSL('rc_raw_program_step')+guard+'fn gate(lane:u32,pb:u32,sb:u32,cb:u32,budget:u32)->u32{if(!rc_vm_number_admit(lane,pb,sb,cb,budget)){return 0u;}rc_raw_program_step(pb,sb,cb,budget);return 1u;}',p=allocateMicrocodeLocals(compileMicrocodeWGSL(code,{entry:'gate',allocationMetadata:true}),{mode:'call-frames-v1'}),f=p.functions.find(x=>x.name==='gate');
 return(lane,args)=>{const values=[lane,...args.map(x=>{assert.equal(x.length,1);return x[0];})],vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,eventAudit:true,bindings,initialSlots:f.params.map((x,i)=>({slot:x.slot,value:values[i]}))});vm.begin();let status=S.ready,n=0;while(status===S.ready&&n++<64)status=vm.advance(0,65536);assert.equal(status,S.complete);assert.equal(vm.local(0,f.returnSlot),1);return new Uint32Array(0);};
}
export function summarizePostImpactCounters(compiled,counters){
 assert.equal(counters.length,compiled.instructions.length/8);const functions=[{name:'$module',entryPc:0},...compiled.functions.toSorted((a,b)=>a.entryPc-b.entryPc)],byFunction={},byOpcode={};let fi=0,total=0,sourceReads=0,sourceWrites=0,explicitLocalReads=0,indirectLocalReads=0,indirectLocalWrites=0;
 for(let pc=0;pc<counters.length;pc++){while(fi+1<functions.length&&pc>=functions[fi+1].entryPc)fi++;const n=counters[pc],op=I.names[compiled.instructions[pc*8]];if(!n)continue;total+=n;byFunction[functions[fi].name]=(byFunction[functions[fi].name]??0)+n;byOpcode[op]=(byOpcode[op]??0)+n;explicitLocalReads+=requiredVmLocalOperands(op).length*n;if(op==='LOAD')sourceReads+=n;if(op==='STORE')sourceWrites+=n;if(op==='LOCAL_LOAD')indirectLocalReads+=n;if(op==='LOCAL_STORE')indirectLocalWrites+=n;}
 const rank=x=>Object.entries(x).sort((a,b)=>b[1]-a[1]).map(([name,instructions])=>({name,instructions,fraction:instructions/total}));return{total,functions:rank(byFunction),opcodes:rank(byOpcode),memory:{sourceReads,sourceWrites,explicitLocalReads,indirectLocalReads,indirectLocalWrites,scope:'executed source opcodes and case-specific operand reads; excludes VM control/instruction fetch/stack/guard and native macro memory'}};
}
export function runPostImpactProfile(dir,{maxPumps=2048,maxWallMs=180000}={}){
 assert.ok(Number.isInteger(maxPumps)&&maxPumps>0&&maxPumps<=2048);assert.ok(Number.isInteger(maxWallMs)&&maxWallMs>0&&maxWallMs<=180000);const m=JSON.parse(readFileSync(join(dir,'manifest.json'))),initial=load(join(dir,'initial.v8'),m.initialSha256);assert.equal(initial.kind,POST_IMPACT_PROFILE);const runs=[],finals=[];
 for(const name of['four','five']){const source=initial[name],bindings=initial.bindings.map(x=>x.slice()),counters=new Uint32Array(source.compiled.instructions.length/8),vm=createMicrocodeVmReferenceForTest({testOnly:true,...source.configuration,code:source.compiled.instructions,bindings,pcCounters:counters}),number=name==='five'?numberReference(initial,bindings):null,ids=source.compiled.externalFunctions.toSorted((a,b)=>a.id-b.id),calls={},started=performance.now();for(let lane=0;lane<2;lane++)vm.begin(lane);let pumps=0;
  while(![0,1].every(lane=>vm.state[lane*vm.layout.stride+C.status]===S.complete)){
   assert.ok(pumps++<maxPumps,'bounded diagnostic pumps; no automatic extension');assert.ok(performance.now()-started<maxWallMs,'bounded HOST diagnostic wall time');
   for(let lane=0;lane<2;lane++){vm.advance(lane,65536);for(const d of ids)vm.serviceExternal(lane,d.id,(desc,args)=>{calls[desc.name]=(calls[desc.name]??0)+1;return desc.id===4?number(lane,args):microcodeExternalReference(desc,args,{bindings:bindings.slice(0,5),macroProfile:COUPLED_MACRO_PROFILE});});assert.ok(![S.invalid,S.unsupported].includes(vm.state[lane*vm.layout.stride+C.status]),'source transport remains supported');}
  }
  assert.equal(bindings[0][5],193);assert.equal(bindings[0][source.template.state.length+5],0);assert.equal(bindings[0][source.pc.controlTailBase+PC.header.initialH],192);assert.equal(bindings[0][source.pc.controlTailBase+PC.header.completedH],1);for(const bi of[1,2,4])assert.deepEqual(bindings[bi],initial.bindings[bi]);
  const summary=summarizePostImpactCounters(source.compiled,counters),steps=[0,1].map(lane=>Number((BigInt(vm.state[lane*vm.layout.stride+C.stepsHigh])<<32n)+BigInt(vm.state[lane*vm.layout.stride+C.stepsLow])));assert.equal(summary.total,steps[0]+steps[1]);const bytes=serialize({kind:POST_IMPACT_PROFILE,name,initialSha256:m.initialSha256,bindings,vmState:vm.state,counters});writeFileSync(join(dir,name+'-final.v8'),bytes,{flag:'wx'});const row={name,pumps,coreSteps:steps,calls,hostWallMs:performance.now()-started,theoreticalFixedCommands:pumps*(1+ids.length),actualGpuCommands:0,finalSha256:sha(bytes),summary};runs.push(row);finals.push(bindings);log({stage:'post-impact-diagnostic-profile-complete',...row,summary:{total:summary.total,functions:summary.functions.slice(0,12),opcodes:summary.opcodes,memory:summary.memory}});
 }
 assert.deepEqual(finals[0],finals[1],'all six final source bindings exactly equal');const report={kind:POST_IMPACT_PROFILE,status:'pass',initialSha256:m.initialSha256,pins:POST_IMPACT_PINS,runs,allSixFinalBindingWordsEqual:true,noCpuFutureInput:true,physicalT0Unchanged:true,rawInput:false,gpuExecuted:false,rawRecurrenceQualified:false,fullRestQualified:false};writeFileSync(join(dir,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});log({stage:'post-impact-diagnostic-terminal',status:'pass',allSixFinalBindingWordsEqual:true,runs:runs.map(({summary,...r})=>r)});return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[mode,a,b]=process.argv.slice(2);if(mode==='prepare')preparePostImpactProfile({artifactRoot:resolve(a),outDir:resolve(b)});else if(mode==='run')runPostImpactProfile(resolve(a));else throw Error('Explicit prepare or run diagnostic only');}
