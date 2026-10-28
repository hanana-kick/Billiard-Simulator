// TEST ONLY source-WGSL execution. Never imported by a production submission.
// Each call is reconstructed from supplied backing words, without hidden PC.
import {generateMicrocodeNumericContinuationWGSL,microcodeNumericSourcePartsForTest} from '../src/resident-candidate/microcode-numeric-continuation.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';

const cache=new Map();
const bindingsText='@group(0) @binding(0) var<storage,read_write> rc_vm_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;\n';
function compiled(layout,entry,original=false){
 const key=JSON.stringify([layout,entry,original]);if(cache.has(key))return cache.get(key);
 const source=bindingsText+(original?microcodeNumericSourcePartsForTest({testOnly:true}).source:generateMicrocodeNumericContinuationWGSL(layout));
 const p=compileMicrocodeWGSL(source,{entry,intrinsics:'source-f64-v1',storageBindings:{rc_vm_state:0,rc_program:1,rc_scratch:3}});
 const value={p,root:p.functions.find(f=>f.name===entry)};cache.set(key,value);return value;
}
function execute(layout,entry,args,words,original=false){
 const {p,root}=compiled(layout,entry,original);
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,
  stackCapacity:Math.max(1,p.callDepth),entryPc:p.entryPc,intrinsics:p.intrinsicProfile,
  bindings:[words.vmState,words.program,new Uint32Array(1),words.scratch,new Uint32Array(1)],
  intrinsicHandler:microcodeIntrinsicReference,initialSlots:args.map((value,i)=>({slot:root.params[i].slot,value}))});
 vm.begin();let status=1,n=0;while(status===1&&n++<128)status=vm.advance(0,65536);
 if(status!==2)throw Error('TEST source helper did not complete '+entry+': '+status);
 return vm.local(0,root.returnSlot);
}
export function createMicrocodeNumericContinuationReferenceForTest({testOnly=false,candidateCount,vmStride,tailOffset,vmState,program,scratch}={}){
 if(testOnly!==true)throw TypeError('TEST ONLY numeric continuation reference');
 if(![vmState,program,scratch].every(x=>x instanceof Uint32Array))throw TypeError('Exact TEST backing words required');
 const l={candidateCount,vmStride,tailOffset},words={vmState,program,scratch};
 return Object.freeze({start:(...args)=>execute(l,'rc_vm_num_start',args,words),step:base=>execute(l,'rc_vm_num_step',[base],words),clear:base=>execute(l,'rc_vm_num_clear',[base],words)});
}
export function executeOriginalNumericSourceForTest({testOnly=false,program,scratch,programBase=0,scratchBase=0}={}){
 if(testOnly!==true)throw TypeError('TEST ONLY original numeric source reference');
 return execute(null,'rc_num_eval',[programBase,scratchBase],{vmState:new Uint32Array(1),program,scratch},true);
}
