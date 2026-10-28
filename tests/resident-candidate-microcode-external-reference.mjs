// TEST ONLY source-lowered macro oracle. Never imported by GPU submission.
// NUM_EVAL uses the existing independent scratch/status model. Cue macro uses
// unchanged source WGSL lowered to the scalar VM, with the already differential-
// tested one-instruction references. Its helper bits are not independent proof;
// Broad commit uses its unchanged integer/f32 source closure without numeric
// intrinsics. Whole-world qualification still uses the actual original CPU comparator.
import {COUPLED_MACRO_PROFILE,THREE_MACRO_PROFILE,selectedSourceMacroNames} from './resident-candidate-macro-profile-contract.mjs';
import {sourceMacroNativeWGSL} from '../src/resident-candidate/microcode-source-macros.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',cache=new Map();
export function microcodeExternalReference(descriptor,args,{bindings,macroProfile=THREE_MACRO_PROFILE}={}){
 selectedSourceMacroNames(macroProfile);
 if(descriptor.name==='rc_coupled_transport_advance'){if(macroProfile!==COUPLED_MACRO_PROFILE)throw new TypeError('Explicit coupled source macro profile required');if(args.length!==6||args.some(x=>!(x instanceof Uint32Array)||x.length!==1)||args[5][0]!==32768)throw new RangeError('Original coupled sixth argument budget32768 required');}
 if(descriptor.name==='rc_num_eval')return microcodeIntrinsicReference({name:'rc_num_eval'},args,{bindings});
 if(!['rc_cue_flat_advance','rc_world_broad_commit_collision','rc_coupled_transport_advance'].includes(descriptor.name))throw new TypeError('Unknown TEST source macro '+descriptor.name);
 let p=cache.get(descriptor.name);if(!p){p=allocateMicrocodeLocals(compileMicrocodeWGSL(prefix+sourceMacroNativeWGSL(descriptor.name),{entry:descriptor.name,intrinsics:descriptor.name==='rc_cue_flat_advance'?'source-continuations-v1':'none',intrinsicFunctions:descriptor.name==='rc_cue_flat_advance'?['rc_num_cont_instruction','rc_source_program_instruction']:undefined,allocationMetadata:true}),{mode:'call-frames-v1'});cache.set(descriptor.name,p);}
 const root=p.functions.find(f=>f.name===descriptor.name),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings,intrinsics:p.intrinsicProfile,intrinsicHandler:microcodeIntrinsicReference,initialSlots:args.flatMap((value,i)=>Array.from(value,(word,j)=>({slot:root.params[i].slot+j,value:word})))});
 vm.begin();let status=1,chunks=0;while(status===1&&chunks++<256)status=vm.advance(0,65536);
 // This is a TEST harness bound, not a changed source instructionBudget or a
 // published simulation result. All source args, caps and control words remain.
 if(status!==2)throw new Error('TEST original macro scalar oracle did not complete: status '+status);
 return Uint32Array.from({length:root.returnWords},(_,i)=>vm.local(0,root.returnSlot+i));
}
