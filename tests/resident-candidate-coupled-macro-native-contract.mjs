import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {assertCoupledComponentInput,buildCoupledComponentProgram,prepareCoupledComponent,executeCoupledComponent} from './resident-candidate-coupled-macro-native.mjs';
const dir=process.env.RESIDENT_COUPLED_COMPONENT_INPUT;
const load=()=>deserialize(readFileSync(join(dir,'call-inputs.v8')));

test('coupled component GPU role requires explicit coordinator opt-in before touching artifacts',async()=>{
 const old=process.env.RUN_RESIDENT_COUPLED_MACRO_GPU;delete process.env.RUN_RESIDENT_COUPLED_MACRO_GPU;
 try{await assert.rejects(()=>executeCoupledComponent('/not-opened-without-opt-in'),/serialized numerical slot/);}finally{if(old===undefined)delete process.env.RUN_RESIDENT_COUPLED_MACRO_GPU;else process.env.RUN_RESIDENT_COUPLED_MACRO_GPU=old;}
});
test('exact three captured-call inputs compile to one admitted source macro, not numeric-node dispatches',{skip:!dir},()=>{
 const input=load(),p=buildCoupledComponentProgram(input);assert.equal(p.config.intrinsics,'none');assert.deepEqual(p.config.intrinsicFunctions,[]);assert.equal(p.config.externalFunctions.length,1);assert.equal(p.config.externalFunctions[0].id,3);assert.equal(p.config.count,1);assert.equal(p.config.instructionBudget,4096);assert.equal(p.config.initialSlots.at(-1).value,32768,'original source budget differs from core transport budget');assert.equal(Object.keys(p.approval.dependencies).length,41);
 assert.equal(p.descriptors.length,3);for(const d of p.descriptors)parseMicrocodeWGSL(d.code);assert.ok(p.descriptors[0].code.includes('fn rc_coupled_transport_advance('));assert.doesNotMatch(p.descriptors[0].code,/fn rc_vm_step/);assert.doesNotMatch(p.descriptors[2].code,/fn rc_coupled_transport_advance/);
});
test('actual call-return protocol and duplicate handlers preserve every VM word for all three statuses',{skip:!dir},()=>{
 const input=load(),p=buildCoupledComponentProgram(input);
 for(const result of[0,0,1]){
  const v=createMicrocodeVmReferenceForTest({testOnly:true,...p.config,code:p.code});v.begin();assert.equal(v.advance(),I.status.waiting);let calls=0;
  assert.equal(v.serviceExternal(0,3,(d,args)=>{calls++;assert.equal(d.name,input.root);assert.deepEqual(args.map(x=>x[0]),input.cases[0].args);return Uint32Array.of(result);}),I.status.ready);assert.equal(v.advance(),I.status.complete);assert.equal(v.local(0,p.root.returnSlot),result);
  const terminal=v.state.slice();v.serviceExternal(0,3,()=>{throw Error('not called again');});assert.equal(v.advance(),I.status.complete);assert.equal(calls,1);assert.deepEqual(v.state,terminal);assert.equal(v.state[I.control.error],0);assert.equal(v.state[I.control.sp],0);assert.equal(v.state[I.control.pendingMacro],0);
 }
});
test('native payload rejects expected outputs, changed budgets, scope claims and source identities',{skip:!dir},()=>{
 for(const change of[p=>p.expected={},p=>p.cases[1].after=p.cases[1].before,p=>p.cases[0].args[5]=32767,p=>p.rawWorldInput=true,p=>p.worldResidentSequenceQualified=true,p=>p.sourceSha256='0'.repeat(64),p=>p.canonicalSource+=' ']){const p=load();change(p);assert.throws(()=>assertCoupledComponentInput(p));}
});
test('prepare emits input-only immutable program manifest and refuses a reused run directory',{skip:!dir},()=>{
 const base=mkdtempSync(join(tmpdir(),'coupled-component-contract-')),out=join(base,'run');
 try{const m=prepareCoupledComponent(dir,out);assert.equal(m.sourceBudget,32768);assert.equal(m.passes,2);assert.equal(m.cases,3);assert.equal(m.dispatchesPerCase,6);assert.equal(m.expectedFilesRuntimeAuthority,false);assert.equal(m.rawToImpact,false);assert.throws(()=>prepareCoupledComponent(dir,out),/fresh component/);}finally{rmSync(base,{recursive:true,force:true});}
});
