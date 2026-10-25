// HOST-only stepwise scalar source differential gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compare,numericFixture,sourceFixture} from './resident-candidate-microcode-continuation-fixture.mjs';
test('numeric continuation preserves every word after each node, final output validation and copied VM yields',()=>{
 const plans=[{inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'mul',args:[2,1]}],outputs:[3,0,3]},{inputFloats:2,nodes:[{kind:'div',args:[0,1]}],outputs:[0]},{inputFloats:1,nodes:[],outputs:[0]}];
 for(const plan of plans)for(const input of[Uint32Array.of(0x3f800000,0x40000000),Uint32Array.of(1,0),Uint32Array.of(0x80000000,0)].map(x=>x.slice(0,plan.inputFloats))){const f=numericFixture(plan,input);let b=f.bindings;for(let n=0;n<plan.nodes.length+2;n++){const r=compare('rc_num_cont_instruction',[f.cb],b,'numeric step '+n,{budget:31,resume:true});b=r.bindings;if(r.status!==0){assert.deepEqual(compare('rc_num_cont_instruction',[f.cb],b,'terminal idempotence').bindings,b);break;}}}
});
test('numeric malformed control, cursor, operand, opcode and output retain original statuses and partial writes',()=>{
 const plan={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'mul',args:[2,1]}],outputs:[3]};
 const mutations=[f=>{f.bindings[0][f.cb]=0;},f=>{f.bindings[0][f.cb+6]=1;},f=>{f.bindings[0][f.cb+7]=1;},f=>{f.bindings[0][f.cb+5]=4;},f=>{f.bindings[0][f.cb+3]=3;},f=>{f.bindings[0][f.cb+4]=0;},f=>{f.bindings[1][f.pb+12]=99;},f=>{f.bindings[1][f.pb+13]=99;},f=>{f.bindings[1][f.pb+14]=99;},f=>{f.bindings[1][f.pb+f.g.program[8]]=99;}];
 for(const [i,mutate]of mutations.entries()){const f=numericFixture(plan,Uint32Array.of(0x3f800000,0x40000000));mutate(f);let b=f.bindings;for(let n=0;n<3;n++){const r=compare('rc_num_cont_instruction',[f.cb],b,'malformed '+i+'/'+n);b=r.bindings;if(r.status!==0)break;}}
 const f=numericFixture(plan,Uint32Array.of(1,1));compare('rc_num_cont_instruction',[f.bindings[0].length-7],f.bindings,'short control');
});
test('all29 original source opcodes preserve register/control/stack words, including NaN and signed zero',()=>{
 for(let op=0;op<=28;op++){const f=sourceFixture([[op,0,1,2],[27,0,0,0]],op===21?[2,-1,0,-0]:[2,-1,3,-0]);if(op===26){f.bindings[0][f.cb+3]=1;f.bindings[0][f.cb+4]=1;}const r=compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings,'source opcode '+op,{budget:37,resume:true});assert.equal(r.fastSteps,6);}
 for(const v of[Number.MIN_VALUE,Number.MAX_VALUE,Infinity,-Infinity,NaN,-0])for(const op of[1,2,3,4,5,6,7,8,9,10,11,12,18,19,28]){const f=sourceFixture([[op,0,1,2]], [2,v,.5,-0]);compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings,'source edge '+op+'/'+v);}
});
test('source continuation cap, malformed opcode/index/call, terminal prior and call-return sequence preserve source ordering',()=>{
 const rows=[[[99,0,0,0]],[[0,99,0,0]],[[21,0,2,1]],[[22,0,1,2]],[[26,0,0,0]],[[25,0,0,0]]];
 for(const [i,row]of rows.entries()){const f=sourceFixture(row);if(i===5)f.bindings[0][f.cb+3]=4;compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings,'source malformed '+i);}
 for(const mutate of[f=>{f.bindings[0][f.cb+2]=f.p.maximumInstructions;},f=>{f.bindings[0][f.cb]=f.p.instructionCount;},f=>{f.bindings[0][f.cb+1]=3;}]){const f=sourceFixture([[0,0,1,0]]);mutate(f);compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings,'source guard');}
 // u32 addition wraps in the SOURCE load/store address computation. The
 // earlier JS reference throws for this input; the scalar WGSL is authoritative.
 for(const row of[[21,0,1,1],[22,1,1,2]]){const f=sourceFixture([row]);compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings,'source wrapped index');}
 const f=sourceFixture([[25,2,0,0],[27,0,0,0],[1,0,0,2],[26,0,0,0]]);let b=f.bindings;for(let n=0;n<6;n++){const r=compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],b,'call return '+n);b=r.bindings;if(r.status!==0){assert.equal(r.status,1);assert.deepEqual(compare('rc_source_program_instruction',[f.pb,f.sb,f.cb],b,'halt prior').bindings,b);break;}}
});
