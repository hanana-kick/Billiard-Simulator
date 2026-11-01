/** Native transport regression cases. Caller supplies an actual GPU runner.
 * No interpreter/mock may be used to qualify these checks. */
import assert from 'node:assert/strict';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {MICROCODE_ISA as ABI} from '../src/resident-candidate/microcode-isa.mjs';
import {admitIntegerProgram,initialIntegerState} from '../src/canonical-integer-transport/kernel-common-guards.mjs';
export async function verifyAdversarialIntegerTransport(vm) {
 const source='@group(0) @binding(0) var<storage,read_write> output:array<u32>; fn main(){output[0u]=77u;}';
 const compilation=compileMicrocodeWGSL(source,{sourceStoragePolicy:[{name:'output',binding:0,scalar:'u32',access:'read_write'}]});
 const layout=admitIntegerProgram(compilation), words=compilation.instructions;
 let pc=-1;for(let i=0;i<words.length;i+=8)if(words[i]===ABI.opcodes.STORE){pc=i/8;break;}
 assert(pc>=0,'fixture needs STORE');
 const seeded=()=>{const s=initialIntegerState(layout,{budget:1}),ip=pc*8,lb=16+layout.stack;s[4]=pc;s[lb+words[ip+3]]=0;s[lb+words[ip+4]]=77;return s;};
 const exhausted=seeded();exhausted[6]=0xffffffff;exhausted[7]=0xffffffff;
 const denied=await vm.run(compilation,{output:Uint32Array.of(123)},{initialState:exhausted,maxSlices:1});
 assert.equal(denied.status,3);assert.equal(denied.error,9);assert.deepEqual(denied.outputs.output,Uint32Array.of(123));assert.equal(denied.state[4],pc);assert.equal(denied.state[6],0xffffffff);assert.equal(denied.state[7],0xffffffff);
 const last=seeded();last[6]=0xfffffffe;last[7]=0xffffffff;
 const committed=await vm.run(compilation,{output:Uint32Array.of(123)},{initialState:last,maxSlices:1});
 assert.equal(committed.status,1);assert.equal(committed.error,0);assert.deepEqual(committed.outputs.output,Uint32Array.of(77));assert.equal(committed.state[4],pc+1);assert.equal(committed.state[6],0xffffffff);assert.equal(committed.state[7],0xffffffff);
 const carry=seeded();carry[6]=0xffffffff;carry[7]=1;
 const carried=await vm.run(compilation,{output:Uint32Array.of(123)},{initialState:carry,maxSlices:1});
 assert.equal(carried.status,1);assert.equal(carried.state[6],0);assert.equal(carried.state[7],2);assert.deepEqual(carried.outputs.output,Uint32Array.of(77));
 const bad={...compilation,instructions:words.slice()};bad.instructions[0]=0xffffffff;
 await assert.rejects(()=>vm.run(bad,{output:Uint32Array.of(123)}),/Owned canonical integer compilation required/);
 const over=await vm.run(compilation,{output:Uint32Array.of(123)},{budget:1,maxSlices:1});assert.equal(over.complete,false);assert.equal(over.status,1);
 const aliasSource='@group(0) @binding(0) var<storage,read> input:array<u32>; @group(0) @binding(1) var<storage,read_write> output:array<u32>; fn main(){output[0u]=91u;output[1u]=input[1u];output[2u]=arrayLength(&input);}';
 const aliasCompiled=compileMicrocodeWGSL(aliasSource,{sourceStoragePolicy:[{name:'input',binding:0,scalar:'u32',access:'read'},{name:'output',binding:1,scalar:'u32',access:'read_write'}]});
 const backing=Uint32Array.of(400,11,12,13,14,500),aliased=await vm.run(aliasCompiled,{input:backing.subarray(1,3),output:backing.subarray(2,5)},{budget:1});
 assert(aliased.complete);assert.deepEqual(aliased.outputs.output,Uint32Array.of(91,91,2));assert.deepEqual(aliased.arena,Uint32Array.of(400,11,91,91,2,500));assert.deepEqual(backing,Uint32Array.of(400,11,12,13,14,500));
 const privateSource='@group(0) @binding(0) var<storage,read_write> output:array<u32>; var<private> calls:u32; fn main(){calls++;output[0u]=calls;}';
 const fresh=compileMicrocodeWGSL(privateSource,{sourceStoragePolicy:compilation.sourceStoragePolicy});for(let i=0;i<2;i++){const r=await vm.run(fresh,{output:Uint32Array.of(123)},{budget:1});assert(r.complete);assert.deepEqual(r.outputs.output,Uint32Array.of(1));}
 return {scope:'actual GPU single invocation transport only; not source physics equivalence',cases:['exhausted counter STORE has no side effect','last counter step commits','low counter carry','unknown opcode host admission rejects','slice exhaustion remains incomplete','readonly alias observes RW view changes with exact offsets and lengths','fresh dispatch resets private state']};
}
