// Lean source-owned admission. No compiler, WGSL generator, original oracle,
// or forward physics import; no old count2/h192 metadata is rewritten.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const MIXED_SIX_BUDGET_PROOF=Object.freeze({
 kind:'resident-mixed-six-coupled-budget-source-proof-v1',
 runtimeSha256:'780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de',
 runtimeDataSha256:'5a114404df0eb616c8b112b553f484d837171bdfbef9f9b7c138686b30aaf958',
 sourceSha256:'c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20',
 bytecodeSha256:'30f7e7aae2258d01bdcb98811024f314592351f83ced1ffadfde2cda36c825e4',
 descriptorsSha256:'0157d62557e895a1007d749fab2cb9914d18edc3d56dc3683f7800ec83d1c548',
 transportSha256:'fad788059d2d4475dd96b5017a1959b68b6b446c6db829ffb6fa73c0ac3a6099',
 coupledClosureSha256:'a0f505125ff256e4d0ef12493ca9770e54ffa9d26260b631b771edaeef204742',
 coupledSignatureSha256:'c81c76839fef9fc3597b905ec5da394f208db1b11352d49e1ccea886bc31d045',
 coupledBodySha256:'489de183316fa5e0e2742b32921853a89a83983809e3a31b74b15275138bb758',
 count:6,frames:2,sourceInstructionBudget:32768,sourceMaximumInstructionBudget:1000000,
 bankWords:62976,scratchWords:13632,budgetOffset:62744,guardLoadPC:40016,guardBranchPC:40019,
 argumentReloadPC:40065,argumentSlot:2968,coupledCallPC:40072,coupledEntryPC:40076,
 sourceBudgetStorePC:97346,cueCallPC:43200,cueEntryPC:43203,
 sourceOnlyProof:true,physicalExecution:false,nativeQualified:false,fullRestQualified:false,
});
/** This narrow gate pins the COMPLETE newly compiled code and descriptors, not
 * a name or caller-supplied hash. Native runner must ALSO bind actual runtime
 * bytes/profile/initializer roster to its plan; this does not replace those
 * independent admission checks or establish arbitrary pointer safety. */
export function assertMixedSixCoupledBudget(runtime){
 const p=MIXED_SIX_BUDGET_PROOF,v=runtime?.vm,o=runtime?.original;
 assert.equal(runtime?.kind,'resident-mixed-six-four-macro-initial-only-runtime-v1');assert.equal(o?.count,6);assert.equal(o.frames,2);assert.equal(o.pc.count,6);assert.equal(o.pc.maxH,2);assert.equal(o.pc.stateWords,p.bankWords);assert.equal(o.pc.scratchWords,p.scratchWords);assert.equal(o.pc.totalStateWords,379496);
 assert.equal(runtime.identity.sourceSha256,p.sourceSha256);assert.equal(runtime.identity.bytecodeSha256,p.bytecodeSha256);assert.equal(runtime.sourcePreparation.preparation,false);assert.equal(runtime.sourcePreparation.coupledBudgetAdmission,false,'immutable preparation metadata remains unchanged; this separate proof grants only source-budget admission');assert.equal(runtime.sourcePreparation.generatorProfile,'resident-preparation-disabled-integrated-isa-source-v1');assert.equal(runtime.sourcePreparation.historyProfile,'source-full-application-history-v1');
 assert.equal(v.intrinsics,'none');assert.deepEqual(v.intrinsicFunctions,[]);assert.equal(v.macroProfile,'source-four-macros-mixed-six-preparation-v1');assert.equal(v.localWords,7783);assert.equal(v.stackCapacity,15);assert.equal(v.instructionCount,131112);assert.equal(v.instructionBudget,65536);assert.equal(v.dispatchChunks,512);
 assert.ok(v.code instanceof Uint32Array&&v.code.length===v.instructionCount*I.instructionWords);assert.equal(sha(v.code),p.bytecodeSha256,'actual complete six-row bytecode proof');assert.equal(sha(JSON.stringify(v.externalFunctions)),p.descriptorsSha256,'actual complete source-order descriptors/slots/closure proof');
 assert.deepEqual([...v.externalFunctions].sort((a,b)=>a.id-b.id).map(d=>[d.id,d.name]),[[0,'rc_cue_flat_advance'],[1,'rc_num_eval'],[2,'rc_world_broad_commit_collision'],[3,'rc_coupled_transport_advance']]);
 const d=v.externalFunctions.find(d=>d.id===3);assert.equal(d.entryPc,p.coupledEntryPC);assert.equal(d.params[5].slot,p.argumentSlot);assert.equal(d.approval.closureSha256,p.coupledClosureSha256);assert.equal(d.approval.signatureSha256,p.coupledSignatureSha256);assert.equal(d.approval.bodySha256,p.coupledBodySha256);
 assert.deepEqual(o.identity.sourceCaps,{cueJobs:640,energyJobs:25,broadRows:27,coupledJobs:2130,inactiveCcdJobs:16,activeCcdJobs:4096,ccdPasses:4});assert.equal(sha(JSON.stringify(o.transport)),p.transportSha256,'original fixed caps/iterations/transport bounds');assert.equal(o.identity.options.numericProfile,'source-f32-preserved-v1');assert.equal(o.identity.options.initialHistoryProfile,'source-full-application-history-v1');
 const row=pc=>Array.from(v.code.subarray(pc*8,pc*8+8));assert.deepEqual(row(40016),[I.opcodes.LOAD,2921,0,2920,0,0,0,0]);assert.deepEqual(row(40017),[I.opcodes.SET,2922,32768,0,0,0,0,0]);assert.deepEqual(row(40019),[I.opcodes.BRANCH,0,2923,40020,40027,0,0,0]);assert.deepEqual(row(40065),[I.opcodes.LOAD,2961,0,2960,0,0,0,0]);assert.deepEqual(row(40071),[I.opcodes.MOV,2968,2961,0,0,0,0,0]);assert.deepEqual(row(40072),[I.opcodes.CALL,0,40076,0,0,0,0,0]);assert.deepEqual(row(40076),[I.opcodes.EXTERNAL_CALL,0,3,0,0,0,0,0]);assert.deepEqual(row(40077),[I.opcodes.RET,0,0,0,0,0,0,0]);
 const calls=[];for(let pc=0;pc<v.instructionCount;pc++)if(v.code[pc*8]===I.opcodes.CALL&&v.code[pc*8+2]===p.coupledEntryPC)calls.push(pc);assert.deepEqual(calls,[p.coupledCallPC],'sole source-coupled CALL path');
 return p;
}
