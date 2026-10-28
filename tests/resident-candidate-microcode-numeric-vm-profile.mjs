// Source-only component configuration. It is NOT a physical-world seed or an
// accepted numerical profile, and contains no CPU future/expected state.
import {createHash} from 'node:crypto';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {sourceIntrinsicNativeWGSL} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
import {microcodeVmLayout,generateMicrocodeVmWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_NUMERIC_CONTINUATION as Q,microcodeNumericContinuationDescriptor} from '../src/resident-candidate/microcode-numeric-continuation.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function createNumericVmComponentProfile({testOnly=false,workgroupSize}={}){
 if(testOnly!==true||![1,64].includes(workgroupSize))throw new TypeError('Explicit TEST-only WGS1 or WGS64 component configuration required');
 const source='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;'+sourceIntrinsicNativeWGSL('source-numeric-v1')+'fn main(pb:u32,sb:u32)->u32{return rc_num_eval(pb,sb);}';
 const compiled=compileMicrocodeWGSL(source,{entry:'main',intrinsics:'source-numeric-v1',intrinsicFunctions:['rc_num_eval']});
 const options={count:2,localWords:compiled.localWords,stackCapacity:Math.max(1,compiled.callDepth),instructionCount:compiled.instructions.length/8,entryPc:compiled.entryPc,instructionBudget:65536,workgroupSize,controlMode:'invocation-cache-v1',vmStateDisjoint:true,numericContinuation:Q.mode,intrinsics:'source-numeric-v1',intrinsicFunctions:['rc_num_eval']};
 const layout=microcodeVmLayout(options);options.numericContinuationDescriptor=microcodeNumericContinuationDescriptor({candidateCount:layout.count,vmStride:layout.stride,tailOffset:layout.numericTailOffset});
 const shader=generateMicrocodeVmWGSL(options),bytecode=Buffer.from(compiled.instructions.buffer,compiled.instructions.byteOffset,compiled.instructions.byteLength);
 return{compiled,configuration:options,shader,report:{kind:'resident-phased-numeric-vm-component-source-v1',scope:'source-only two-lane rc_num_eval wrapper; not h192 or a physical trajectory',sourceSha256:sha(source),sourceBytes:Buffer.byteLength(source),bytecodeSha256:sha(bytecode),bytecodeBytes:bytecode.byteLength,configuration:options,layout,workgroups:Math.ceil(options.count/workgroupSize),shaderSha256:sha(shader),shaderBytes:Buffer.byteLength(shader),sourceApproval:options.numericContinuationDescriptor.sourceApproval,capability:{hostSourceDifferentialOnly:true,nativeCompiled:false,nativeNumericalQualified:false,physicalFullPathQualified:false,hardwarePerformance:false}}};
}
