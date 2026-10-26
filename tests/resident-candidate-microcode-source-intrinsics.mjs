import test from 'node:test';import assert from 'node:assert/strict';
import {approveSourceIntrinsics,sourceIntrinsicNativeWGSL} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
import {compileGraph} from '../src/resident-candidate/numeric-program.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as ISA,MICROCODE_INTRINSIC_ROOTS,microcodeUsedIntrinsicFunctions} from '../src/resident-candidate/microcode-isa.mjs';
import {MICROCODE_SOURCE_INTRINSICS} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
const f64=()=>sourceIntrinsicNativeWGSL('source-f64-v1');
const bindings='@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
test('lean transport intrinsic names exactly match source descriptor ABI and immutable opcode usage',()=>{
 for(const row of MICROCODE_SOURCE_INTRINSICS)assert.equal(MICROCODE_INTRINSIC_ROOTS[ISA.opcodes[row.opcode]],row.name);
 const code=new Uint32Array(4*ISA.instructionWords);code[0]=ISA.opcodes.NUM_CONT_INSTRUCTION;code[8]=ISA.opcodes.RET;code[16]=ISA.opcodes.F64_FROM_F32;code[24]=ISA.opcodes.NUM_CONT_INSTRUCTION;
 assert.deepEqual(microcodeUsedIntrinsicFunctions(code),['rc_num_cont_instruction','rc_f64_from_f32_bits']);assert.throws(()=>microcodeUsedIntrinsicFunctions(Uint32Array.of(0)));code[0]=0xffffffff;assert.throws(()=>microcodeUsedIntrinsicFunctions(code),/Unknown/);
});
test('source intrinsics approve exact signature/body/transitive dependencies, not a matching name',()=>{
 const code=f64(),a=approveSourceIntrinsics(code,{profile:'source-f64-v1',functionNames:['rc_f64_add']});assert.equal(a.entries.length,1);const entry=a.entries[0];assert.equal(entry.name,'rc_f64_add');assert.deepEqual(entry.parameterWords,[2,2]);assert.equal(entry.resultWords,2);assert.ok(Object.keys(entry.dependencies).length>10);assert.match(entry.closureSha256,/^[a-f0-9]{64}$/);
 for(const changed of[code.replace('let s=a[i]+b[i];','let s=a[i]-b[i];'),code.replace('exponent: i32','exponent: u32'),code.replace('fn rc_f64_add(a:RcF64,b:RcF64)','fn rc_f64_add(a:RcF64,b:RcU128)')]){assert.notEqual(changed,code);assert.throws(()=>approveSourceIntrinsics(changed,{profile:'source-f64-v1',functionNames:['rc_f64_add']}),/mismatch/);}
 assert.deepEqual(approveSourceIntrinsics(code,{profile:'none'}).entries,[]);assert.equal(sourceIntrinsicNativeWGSL('none'),'');
});
test('numeric graph intrinsic retains exact profile/guard code and source address spaces',()=>{
 const code=bindings+sourceIntrinsicNativeWGSL('source-numeric-v1'),a=approveSourceIntrinsics(code,{profile:'source-numeric-v1',functionNames:['rc_num_eval']});assert.equal(a.entries.length,1);assert.equal(a.entries[0].opcode,'NUM_EVAL');assert.ok(Object.keys(a.entries[0].dependencies).includes('rc_num_soft_arithmetic'));
 for(const bad of[code.replace('RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=2u','RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=1u'),code.replace('opcode>15u','opcode>16u'),code.replace('var<storage,read_write> rc_scratch','var<storage,read> rc_scratch')]){assert.notEqual(bad,code);assert.throws(()=>approveSourceIntrinsics(bad,{profile:'source-numeric-v1',functionNames:['rc_num_eval']}));}
 assert.throws(()=>approveSourceIntrinsics(code,{profile:'source-numeric-v1',functionNames:['rc_num_eval'],storageBindings:{rc_program:2,rc_scratch:3}}),/address-space/);
});
test('continuation intrinsics pin original one-instruction caps, control writes and state address space',()=>{
 const state='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;',code=state+bindings+sourceIntrinsicNativeWGSL('source-continuations-v1'),names=['rc_num_cont_instruction','rc_source_program_instruction'];
 const approval=approveSourceIntrinsics(code,{profile:'source-continuations-v1',functionNames:names});assert.deepEqual(approval.entries.map(x=>x.name),names);assert.deepEqual(approval.entries.map(x=>x.parameterWords),[[1],[1,1,1]]);
 assert.ok(approval.entries[0].dependencies.rc_num_cont_instruction_inner);assert.ok(approval.entries[1].dependencies.rc_rsp_scalbn);
 for(const changed of[code.replace('rc_state[control+3u]=i+1u','rc_state[control+3u]=i+2u'),code.replace('rc_state[cb+2u]>=rc_program[pb+13u]','rc_state[cb+2u]>rc_program[pb+13u]'),code.replace('var<storage,read_write> rc_state','var<storage,read> rc_state')]){assert.notEqual(changed,code);assert.throws(()=>approveSourceIntrinsics(changed,{profile:'source-continuations-v1',functionNames:names}),/mismatch|declaration/);}
 assert.throws(()=>approveSourceIntrinsics(code,{profile:'source-continuations-v1',functionNames:names,storageBindings:{rc_state:2,rc_program:1,rc_scratch:3}}),/address-space/);
 assert.deepEqual(approveSourceIntrinsics(code,{profile:'source-numeric-v1',functionNames:names}).entries,[],'older profile never silently enables new opcodes');
});
test('native intrinsic allowlist removes only unreachable helper closures and keeps exact source bodies',()=>{
 const names=['rc_num_cont_instruction','rc_source_program_instruction'],full=sourceIntrinsicNativeWGSL('source-continuations-v1'),code=sourceIntrinsicNativeWGSL('source-continuations-v1',{functionNames:names});
 assert.ok(code.length<full.length);assert.ok(!code.includes('fn rc_num_eval('));assert.ok(code.includes('fn rc_f64_add('),'reachable dependency retained');assert.ok(code.includes('fn rc_f64_div('),'reachable dependency retained');
 const state='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;',a=approveSourceIntrinsics(state+bindings+code,{profile:'source-continuations-v1',functionNames:names}),b=approveSourceIntrinsics(state+bindings+full,{profile:'source-continuations-v1',functionNames:names});assert.deepEqual(a.entries,b.entries,'source signatures/bodies/transitive closure hashes unchanged');
 assert.equal(sourceIntrinsicNativeWGSL('source-continuations-v1',{functionNames:[]}), '');
 for(const functionNames of[['unknown'],[names[0],names[0]],null])assert.throws(()=>sourceIntrinsicNativeWGSL('source-continuations-v1',{functionNames}));
 assert.throws(()=>sourceIntrinsicNativeWGSL('source-numeric-v1',{functionNames:names}),/outside explicit profile/);
});
test('independent TEST f64 intrinsic model returns exact words and preserves graph scratch on malformed header',()=>{
 const a=approveSourceIntrinsics(f64(),{profile:'source-f64-v1'}),add=a.entries.find(x=>x.name==='rc_f64_add');assert.deepEqual(microcodeIntrinsicReference(add,[numberWords(1),numberWords(2)]),numberWords(3));
 const spec={name:'rc_num_eval'},data=[new Uint32Array(1),new Uint32Array(12),new Uint32Array(1),Uint32Array.of(7,8,9,10),new Uint32Array(1)],before=data[3].slice();assert.equal(microcodeIntrinsicReference(spec,[Uint32Array.of(0),Uint32Array.of(0)],{bindings:data})[0],2);assert.deepEqual(data[3],before);
});
test('TEST graph handler matches scalar source lowering including dirty scratch, partial writes and failure status',()=>{
 const source=bindings+sourceIntrinsicNativeWGSL('source-numeric-v1'),scalar=compileMicrocodeWGSL(source,{entry:'rc_num_eval'}),params=scalar.functions.find(x=>x.name==='rc_num_eval').params;
 const graph=compileGraph({inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'mul',args:[2,1]}],outputs:[3]}),program=new Uint32Array(graph.program.length+3);program.set(graph.program,3);
 for(const input of[Uint32Array.of(0x3f800000,0x40000000),Uint32Array.of(1,0),Uint32Array.of(0x7f800000,0),Uint32Array.of(0x80000000,0)]){
  const scratch=new Uint32Array(graph.scratchWords+10).fill(0x12345678);scratch.set(input,5);const arrays=[new Uint32Array(1),program,new Uint32Array(1),scratch,new Uint32Array(1)],other=arrays.map(x=>x.slice());
  const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:scalar.instructions,localWords:scalar.localWords,stackCapacity:scalar.callDepth,entryPc:scalar.entryPc,bindings:arrays,initialSlots:[{slot:params[0].slot,value:3},{slot:params[1].slot,value:5}]});vm.begin();let count=0;while(vm.advance(0,4096)===1)assert.ok(++count<100,'bounded scalar graph model');assert.equal(vm.state[2],2);
  const status=microcodeIntrinsicReference({name:'rc_num_eval'},[Uint32Array.of(3),Uint32Array.of(5)],{bindings:other})[0];assert.equal(status,vm.local(0,scalar.functions.find(x=>x.name==='rc_num_eval').returnSlot));assert.deepEqual(other[3],arrays[3],'every scratch word and surrounding sentinels');
 }
});
