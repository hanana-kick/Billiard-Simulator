// Lean source-bound component compiler. No capture, physics, or expected imports.
import assert from 'node:assert/strict';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {PREPARATION_DESCRIPTOR as D,PREPARATION_PROFILE,assertPreparationDescriptor,preparationSourceWGSL,approvePreparationSource} from '../src/resident-candidate/microcode-preparation.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {generateMicrocodeVmWGSL,microcodeVmLayout} from '../src/resident-candidate/microcode-vm.mjs';
import {assertPreparationComponentInput,preparationComponentSha as sha} from './resident-candidate-preparation-component-schema.mjs';
export const PREPARATION_STORAGE='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
export function buildPreparationComponentProgram(input){
 assertPreparationComponentInput(input);assertPreparationDescriptor(input.descriptor);assert.equal(sha(preparationSourceWGSL()),input.canonicalSourceSha256);
 const n=input.readonlyBindings[4].length,entry='rc_preparation_component',source=PREPARATION_STORAGE+'@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;'+preparationSourceWGSL()+`\nfn ${entry}(gid:vec3<u32>)->u32{if(gid.x!=0u){return 0u;}return rc_geometry_numeric_prepare(${Array.from({length:6},(_,i)=>`rc_inputs[${n+i}u]`).join(',')});}`;
 approvePreparationSource(source);const compiled=allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry,intrinsics:PREPARATION_PROFILE,allocationMetadata:true}),{mode:'call-frames-v1'}),root=compiled.functions.find(f=>f.name===entry),preparation=compiled.functions.find(f=>f.name===D.name);
 const config={count:2,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,instructionCount:compiled.instructions.length/8,instructionBudget:65536,workgroupSize:64,intrinsics:PREPARATION_PROFILE,preparationApproval:D,externalFunctions:[],eventAudit:true,controlMode:'invocation-cache-v1',vmStateDisjoint:true,initialSlots:[{slot:root.params[0].slot,candidateStride:1},{slot:root.params[0].slot+1,value:0},{slot:root.params[0].slot+2,value:0}]};
 const code=generateMicrocodeVmWGSL(config),bindingTypes=['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage','storage'],descriptors=['begin','main'].map(entryPoint=>({name:'source preparation component '+entryPoint,code,bindingTypes,entryPoint}));
 return{compiled,source,root,preparation,config,layout:microcodeVmLayout(config),descriptors,bytecodeSha256:sha(compiled.instructions)};
}
