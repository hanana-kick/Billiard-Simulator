import test from 'node:test';import assert from 'node:assert/strict';
import{compileMicrocodeWGSL}from'../src/resident-candidate/microcode-compiler.mjs';
import{createMicrocodeVmReferenceForTest}from'../src/resident-candidate/microcode-vm.mjs';
const code='@group(0) @binding(0) var<storage,read> input:array<i32>; @group(0) @binding(1) var<storage,read_write> output:array<i32>; fn main(){output[0u]=input[0u]/input[1u];output[1u]=input[0u]%input[1u];}';
const policy=[{name:'input',binding:1,scalar:'i32',access:'read'},{name:'output',binding:3,scalar:'i32',access:'read_write'}];
test('typed canonical storage opt-in preserves exact signed arithmetic word interpretation',()=>{
 const c=compileMicrocodeWGSL(code,{sourceStoragePolicy:policy});assert.equal(c.kind,'canonical-wgsl-microcode-v1');assert(Object.isFrozen(c.sourceStoragePolicy));
 const bindings=Array.from({length:5},()=>new Uint32Array(2));bindings[1].set(new Uint32Array(Int32Array.of(-17,5).buffer));
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:c.instructions,count:1,localWords:c.localWords,stackCapacity:c.callDepth,entryPc:c.entryPc,bindings});vm.begin();assert.equal(vm.advance(0,1024),2);assert.deepEqual(new Int32Array(bindings[3].buffer),Int32Array.of(-3,-2));
 assert.throws(()=>compileMicrocodeWGSL(code),/Only exact array<u32>/);
});
test('policy snapshots caller and rejects unknown, alias, readonly and type mismatches',()=>{
 const copy=structuredClone(policy),c=compileMicrocodeWGSL(code,{sourceStoragePolicy:copy});copy[0].scalar='u32';assert.equal(c.sourceStoragePolicy[0].scalar,'i32');
 for(const p of [[],[policy[0]], [...policy,policy[0]],policy.map(x=>({...x,binding:1})),policy.map(x=>({...x,scalar:'u32'})),policy.map(x=>({...x,access:'read'})),policy.map(x=>({...x,extra:1}))])assert.throws(()=>compileMicrocodeWGSL(code,{sourceStoragePolicy:p}));
 assert.throws(()=>compileMicrocodeWGSL(code.replace('output[0u]=','input[0u]='),{sourceStoragePolicy:policy}),/readonly/);
});
