// Bounded HOST diagnostic only. Fresh authenticated CREATED t0 -> first complete
// source h; no saved continuation, GPU input, optimization, or timing estimate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {assertWholeHCommitted} from './resident-candidate-whole-h-fixture.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
import {assertCreatedMacroSelection,assertMatchingMacroProfiles,COUPLED_MACRO_PROFILE} from './resident-candidate-macro-profile-contract.mjs';
import {decodeOwnedSegmentContinuation,createSegmentCostObserver} from './resident-candidate-tip-impact-segment-cost.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),C=I.control,S=I.status;
export const COUPLED_H1_INITIAL_SHA256='74c67de5efd476cbbe394678cfc927ac5ed6d70a3b38c5e24697dd735895eb75';
export function assertCoupledH1Initial(bytes){
 assert.equal(sha(bytes),COUPLED_H1_INITIAL_SHA256,'exact authenticated fresh CREATED t0 input; no evolved input');
 const initial=decodeOwnedSegmentContinuation(bytes);
 assert.equal(initial.kind,'resident-tip-impact-created-t0-host-initial-v1');assert.equal(initial.createdInput,true);assert.equal(initial.rawInput,false);assert.equal(initial.noGpuAdmission,true);assert.equal(Object.hasOwn(initial,'vmState'),false);
 assert.equal(assertMatchingMacroProfiles(initial,initial.identity),COUPLED_MACRO_PROFILE);assertCreatedMacroSelection(initial);
 assert.equal(initial.configuration.count,2);assert.equal(initial.configuration.eventAudit,true);assert.equal(initial.configuration.instructionBudget,65536);assert.equal(initial.identity.historyProfile,'source-full-application-history-v1');
 assert.equal(initial.bindings.length,6);assert.equal(initial.bindings[0][5],0);assert.equal(initial.bindings[0][4],219);
 const b=initial.pc.controlTailBase;assert.equal(initial.bindings[0][b+PC.header.initialH],0);assert.equal(initial.bindings[0][b+PC.header.completedH],0);assert.equal(initial.bindings[0][b+PC.header.requestedH],192);
 for(const [index,key] of [[1,'programSha256'],[2,'geometrySha256'],[4,'inputSha256']])assert.equal(sha(initial.bindings[index]),initial.identity[key]);
 assert.equal(sha(initial.compiled.instructions),initial.identity.bytecodeSha256);return initial;
}
export function originalOwnerReturnPCs(compiled){
 const fs=[...compiled.functions].sort((a,b)=>a.entryPc-b.entryPc),result=new Map();
 for(let i=0;i<fs.length;i++)if(/^rc_micro_original_owner_\d+$/.test(fs[i].name))for(let pc=fs[i].entryPc;pc<(fs[i+1]?.entryPc??compiled.instructions.length/8);pc++)if(compiled.instructions[pc*8]===I.opcodes.RET)result.set(pc,fs[i].name);
 assert.ok(result.size>0,'actual original owner RET sites required');return result;
}
export function assertFirstCommittedBoundary({initial,words,lane,returnPc,ownerReturns}){
 if(lane!==0||!ownerReturns.has(returnPc))return false;
 const at=initial.pc.controlTailBase;if(words[5]!==1||words[at+PC.header.completedH]!==1)return false;
 assert.equal(words[at+PC.header.initialH],0);assert.equal(words[at+PC.header.requestedH],192);assert.equal(words[at+PC.header.status],PC.status.ready);assert.equal(words[at+PC.header.error],0);
 assertWholeHCommitted({words,base:0,template:initial.template,frame:1});return true;
}
export function profileCoupledFirstH({initialPath,outPath,maxInstructions=8000000,maxWallMs=120000}){
 assert.ok(Number.isSafeInteger(maxInstructions)&&maxInstructions>0&&maxInstructions<=8000000);assert.ok(Number.isSafeInteger(maxWallMs)&&maxWallMs>0&&maxWallMs<=120000);assert.notEqual(resolve(initialPath),resolve(outPath));
 const bytes=readFileSync(initialPath),initial=assertCoupledH1Initial(bytes),p=initial.compiled,c=initial.configuration,bindings=initial.bindings,ownerReturns=originalOwnerReturnPCs(p);
 const bootstrap=createMicrocodeVmReferenceForTest({testOnly:true,...c,code:p.instructions,bindings});bootstrap.begin(0);bootstrap.begin(1);
 const observer=createSegmentCostObserver({compiled:p,configuration:c,state:bootstrap.state});let boundary=null,advanceCalls=0,macros={},nativeBodyWorkExcluded=true;
 const onReturn=event=>{observer.onReturn(event);if(assertFirstCommittedBoundary({initial,words:bindings[0],lane:event.lane,returnPc:event.pc,ownerReturns})){assert.equal(boundary,null);boundary={owner:ownerReturns.get(event.pc),returnPc:event.pc,targetPc:event.targetPc,sourceH:bindings[0][5],sourceControl:Array.from(bindings[0].slice(initial.pc.controlTailBase,initial.pc.controlTailBase+initial.pc.controlWords))};}};
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,...c,code:p.instructions,bindings,state:bootstrap.state,pcCounters:observer.pcCounters,onCall:observer.onCall,onReturn});
 const handler=(d,args)=>{macros[d.name]=(macros[d.name]??0)+1;return microcodeExternalReference(d,args,{bindings:bindings.slice(0,5),macroProfile:COUPLED_MACRO_PROFILE});};
 const start=performance.now();while(!boundary&&advanceCalls<maxInstructions&&performance.now()-start<maxWallMs){let status=vm.advance(0,1);advanceCalls++;if(status===S.waiting)status=vm.serviceExternal(0,vm.state[C.pendingMacro]-1,handler);assert.ok([S.ready,S.waiting].includes(status),'first source h must precede completion; unsupported/invalid is not miss');}
 const costs=observer.finish();assert.equal(costs.end[1].steps,0,'rejected lane remains unexecuted; this diagnostic profiles accepted lane only');
 const result={kind:'resident-coupled-created-t0-first-h-cost-v1',status:boundary?'first-h-committed':'resource-bound-incomplete',diagnosticOnly:true,noGpuAdmission:true,createdInput:true,rawInput:false,gpuExecuted:false,queryComplete:false,fullRest:false,hardwarePerformance:false,wallSpeedCalibration:false,initialSha256:sha(bytes),sourceSha256:initial.identity.sourceSha256,bytecodeSha256:initial.identity.bytecodeSha256,macroProfile:COUPLED_MACRO_PROFILE,requestedHUnchanged:192,profiledLane:0,unexecutedLane:1,sourceEnd:{h:bindings[0][5],pc:bindings[0][initial.pc.controlTailBase+PC.header.pc]},boundary,advanceCalls,transportBudgetPerAdvance:1,originalConfiguredInstructionBudget:c.instructionBudget,physicsCapsUnchanged:true,nativeBodyWorkExcluded,macros,costs,retention:{oneMutableSourceBank:true,oneVmState:true,fixedPcCounters:p.instructions.length/8,fullStateSnapshots:0,fullPerCallTrace:false},timingScope:'Concurrent independent lead HOST recurrence; no speed/calibration inference'};
 if(boundary){assert.equal(vm.state[C.lastOpcode],I.opcodes.RET);assert.equal(vm.state[C.pc],boundary.targetPc,'stop after the actual owner RET commits, before another source operation');assert.equal(vm.state[C.error],0);assert.equal(vm.state[C.pendingMacro],0);assert.ok(bindings[5].subarray(0,initial.layout.auditWords).every(x=>x===0),'no post-t0 emissions at this boundary');}
 for(const [index,key] of [[1,'programSha256'],[2,'geometrySha256'],[4,'inputSha256']])assert.equal(sha(bindings[index]),initial.identity[key],'readonly source binding preserved');assert.equal(sha(p.instructions),initial.identity.bytecodeSha256);assert.equal(sha(bytes),COUPLED_H1_INITIAL_SHA256,'owned decoding never mutates serialized authority');assert.equal(sha(readFileSync(initialPath)),COUPLED_H1_INITIAL_SHA256,'input file unchanged');
 writeFileSync(outPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const[initialPath,outPath]=process.argv.slice(2);const r=profileCoupledFirstH({initialPath,outPath});console.log(JSON.stringify({status:r.status,boundary:r.boundary,steps:r.costs.successfulInstructions,macros:r.macros,topExclusive:r.costs.functions.slice(0,12),topInclusive:[...r.costs.functions].sort((a,b)=>b.fullInvocationInclusive-a.fullInvocationInclusive).slice(0,12),memory:r.costs.sourceMemoryInstructions}));if(r.status!=='first-h-committed')process.exitCode=2;}catch(error){console.error(error);process.exitCode=1;}}
