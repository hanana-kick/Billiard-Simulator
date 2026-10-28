/* SPDX-License-Identifier: Apache-2.0
 * Integer transport publication only. No physical producer qualification.
 * Four ABI words per row; unqualified physical PASS/MISS stays unsupported.
 */
import {assertInitialMicrocodeRuntime} from './initial-microcode-runtime.mjs';
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
import {WORLD_DEVICE_PC as P} from './world-device-pc.mjs';
import {NUMERIC_PROFILE,NUMERIC_DEPENDENCY_MASK,generateNumericAdmissionWGSL} from './numeric-profile.mjs';
import {STATUS as S,REASON as R} from './abi.mjs';
export function generateInitialMicrocodePublication(runtime){
 assertInitialMicrocodeRuntime(runtime);const {original:o,vm}=runtime,h=P.header,c=I.control;
 const fail=`rc_mc_publish(row,id,${S.FAILED}u,${R.INCOMPLETE_COMMIT}u);return;`,incomplete=`rc_mc_publish(row,id,${S.INCOMPLETE}u,${R.INCOMPLETE_COMMIT}u);return;`;
 const code=`@group(0) @binding(0) var<storage,read> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_vm_state:array<u32>;
@group(0) @binding(2) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(3) var<storage,read> rc_code:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateNumericAdmissionWGSL({numericProfile:NUMERIC_PROFILE.PRESERVED_F32,qualifiedMask:0})}
fn rc_mc_publish(row:u32,id:u32,status:u32,reason:u32){
 let result=rc_numeric_guard_result(vec4<u32>(id,status,0xffffffffu,reason),${NUMERIC_DEPENDENCY_MASK}u);
 rc_results[row*4u]=result.x;rc_results[row*4u+1u]=result.y;rc_results[row*4u+2u]=result.z;rc_results[row*4u+3u]=result.w;
}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let row=gid.x;if(row>=${o.count}u||arrayLength(&rc_results)!=${o.count*4}u){return;}
 if(arrayLength(&rc_inputs)!=${o.input.length}u){rc_mc_publish(row,0xffffffffu,${S.FAILED}u,${R.INCOMPLETE_COMMIT}u);return;}
 let id=rc_inputs[row*16u];if(arrayLength(&rc_state)!=${o.pc.totalStateWords}u||arrayLength(&rc_vm_state)!=${vm.totalWords}u||arrayLength(&rc_code)!=${vm.code.length}u){${fail}}
 let b=row*${o.pc.stateWords}u;let v=row*${vm.stride}u;let p=${o.pc.controlTailBase}u+row*${o.pc.controlWords}u;
 let vs=rc_vm_state[v+${c.status}u];let ve=rc_vm_state[v+${c.error}u];let vpc=rc_vm_state[v+${c.pc}u];let sp=rc_vm_state[v+${c.sp}u];let pending=rc_vm_state[v+${c.pendingMacro}u];
 if(rc_vm_state[v+${c.magicWord}u]!=${c.magic}u||rc_vm_state[v+${c.versionWord}u]!=${c.version}u||rc_vm_state[v+${c.entryPc}u]!=${vm.entryPc}u||vpc>=${vm.instructionCount}u||sp>${vm.stackCapacity}u||vs<1u||vs>5u){${fail}}
 for(var k=${c.reservedStart}u;k<${c.words}u;k++){if(rc_vm_state[v+k]!=0u){${fail}}}
 if(vs==${I.status.unsupported}u){if(ve==${I.error.sourceDomain}u||ve==${I.error.unsupportedPrimitive}u){rc_mc_publish(row,id,${S.UNSUPPORTED}u,${R.NUMERIC}u);}else{${fail}}return;}
 if(vs==${I.status.invalid}u||ve!=0u){${fail}}
 if(rc_state[b]!=0x52435753u||rc_state[b+1u]!=1u||rc_state[b+4u]!=id||rc_state[b+2u]>${S.REJECTED}u||rc_state[b+3u]>${R.CUE_CONTINUATION_PROFILE}u||rc_state[p+${h.magic}u]!=${P.magic}u||rc_state[p+${h.version}u]!=${P.version}u||rc_state[p+${h.requestedH}u]!=${o.frames}u||rc_state[p+${h.initialH}u]!=0u||rc_state[p+${h.completedH}u]>${o.frames}u||rc_state[p+${h.error}u]!=0u||rc_state[p+${h.depth}u]>16u||rc_state[p+${h.pc}u]>=${o.pc.instructions}u){${fail}}
 let ps=rc_state[p+${h.status}u];if(ps<${P.status.ready}u||ps>${P.status.worldTerminal}u){${fail}}
 if(vs==${I.status.ready}u||vs==${I.status.waiting}u){if((vs==${I.status.ready}u&&pending!=0u)||(vs==${I.status.waiting}u&&(pending<1u||pending>4u||rc_code[vpc*8u]!=${I.opcodes.EXTERNAL_CALL}u||rc_code[vpc*8u+2u]+1u!=pending))){${fail}}${incomplete}}
 if(vs!=${I.status.complete}u||sp!=0u||pending!=0u||(rc_code[vpc*8u]!=${I.opcodes.RET}u&&rc_code[vpc*8u]!=${I.opcodes.HALT}u)){${fail}}
 if(ps==${P.status.ready}u){${incomplete}}
 if(rc_state[b+5u]!=rc_state[p+${h.completedH}u]){${fail}}
 if(ps==${P.status.complete}u){if(rc_state[p+${h.completedH}u]!=${o.frames}u||rc_state[b+2u]!=${S.RUNNING}u){${fail}}rc_mc_publish(row,id,${S.INCOMPLETE}u,${R.HORIZON}u);return;}
 if(rc_state[b+2u]<${S.PASS}u){${fail}}rc_mc_publish(row,id,rc_state[b+2u],rc_state[b+3u]);
}`;
 return Object.freeze({name:'initial microcode compact publication',phase:'compact-publication',entryPoint:'main',code,bindingTypes:Object.freeze(['read-only-storage','read-only-storage','read-only-storage','read-only-storage','storage']),resources:Object.freeze(['worldState','vmState','inputs','microcode','compactResults']),workgroups:Math.ceil(o.count/32)});
}
