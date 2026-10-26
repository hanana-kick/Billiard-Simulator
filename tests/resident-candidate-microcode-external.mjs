// Protocol gates only. Native/source numerical qualification is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MICROCODE_ISA as I,microcodeInstruction as ins} from '../src/resident-candidate/microcode-isa.mjs';
import {createMicrocodeVmReferenceForTest as create,generateMicrocodeVmWGSL,generateMicrocodeExternalWGSL} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_SOURCE_MACROS as M,sourceMacroNativeWGSL,approveSourceMacros} from '../src/resident-candidate/microcode-source-macros.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
const C=I.control,S=I.status,E=I.error,code=(...rows)=>Uint32Array.from(rows.flatMap(x=>[...x]));
const bindingsDeclaration='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
const externalFunctions=M.filter(x=>x.id<2).map(spec=>({id:spec.id,name:spec.name,entryPc:spec.id===0?7:5,params:spec.parameterWords.map((words,slot)=>({slot,words})),returnSlot:spec.id===0?11:10,returnWords:1,approval:approveSourceMacros(bindingsDeclaration+sourceMacroNativeWGSL(spec.name),{functionNames:[spec.name]}).entries[0]}));
const program=()=>code(ins('SET',0,42),ins('SET',1,31),ins('CALL',0,5),ins('MOV',8,10),ins('HALT'),ins('EXTERNAL_CALL',0,1),ins('RET'),ins('EXTERNAL_CALL',0,0),ins('RET'));
const setup=(options={})=>create({testOnly:true,localWords:32,stackCapacity:4,code:program(),externalFunctions,...options});
const pending=options=>{const v=setup(options);v.begin();assert.equal(v.advance(),S.waiting);return v;};

test('external stub pauses without a consumed step; service consumes one then ordinary RET owns the stack',()=>{
 const v=pending();assert.equal(v.state[C.pc],5);assert.equal(v.state[C.sp],1);assert.equal(v.state[C.pendingMacro],2);assert.equal(v.state[C.stepsLow],3);assert.equal(v.state[C.yields],0);
 const before=v.state.slice();assert.equal(v.advance(),S.waiting);assert.deepEqual(v.state,before);assert.equal(v.serviceExternal(0,0,()=>{throw Error('wrong valid macro must be inert');}),S.waiting);assert.deepEqual(v.state,before);
 let calls=0;assert.equal(v.serviceExternal(0,1,(d,args,{bindings})=>{calls++;assert.equal(d.name,'rc_num_eval');assert.deepEqual(args.map(x=>[...x]),[[42],[31]]);args[0][0]=99;bindings[3][0]=77;return Uint32Array.of(2);}),S.ready);assert.equal(calls,1);assert.equal(v.local(0,0),42);assert.equal(v.local(0,10),2,'source status2 is not VM failure');assert.equal(v.state[C.sp],1);assert.equal(v.state[C.pc],6);assert.equal(v.state[C.stepsLow],4);assert.equal(v.state[C.pendingMacro],0);
 const served=v.state.slice();assert.equal(v.serviceExternal(0,1,()=>{throw Error('duplicate must be inert');}),S.ready);assert.deepEqual(v.state,served);
 v.advance(0,1);assert.equal(v.state[C.sp],0);assert.equal(v.state[C.pc],3);assert.equal(v.state[C.stepsLow],5);assert.equal(v.advance(),S.complete);assert.equal(v.local(0,8),2);assert.equal(v.bindings[3][0],77);assert.equal(v.state[C.stepsLow],7);assert.equal(v.serviceExternal(0,0,()=>{throw Error('terminal must be inert');}),S.complete);
});

test('pending source macro authority survives copied VM state and candidate lanes remain independent',()=>{
 const first=pending({count:2});first.begin(1);const copy=setup({count:2,state:first.state.slice(),bindings:first.bindings.map(x=>x.slice())});copy.serviceExternal(0,1,()=>Uint32Array.of(9));assert.equal(copy.advance(0),S.complete);assert.equal(copy.state[copy.layout.stride+C.status],S.ready);assert.equal(first.state[C.status],S.waiting);
 assert.equal(copy.advance(1),S.waiting);copy.serviceExternal(1,1,()=>Uint32Array.of(17));assert.equal(copy.advance(1),S.complete);assert.equal(copy.local(0,8),9);assert.equal(copy.local(1,8),17);
 const entry=setup({entryPc:5});entry.begin();assert.equal(entry.advance(),S.waiting);assert.equal(entry.state[C.sp],0);entry.serviceExternal(0,1,()=>Uint32Array.of(1));assert.equal(entry.advance(),S.complete,'only configured entry stub admits zero-depth stack');
});

test('malformed pending protocol is rejected before invoking source handler or touching source/local result words',()=>{
 for(const[label,mutate,error]of[
  ['pending zero',v=>v.state[C.pendingMacro]=0,E.externalProtocol],['unknown ID',v=>v.state[C.pendingMacro]=88,E.externalProtocol],
  ['wrong PC',v=>v.state[C.pc]=3,E.externalProtocol],['missing CALL',v=>v.state[C.sp]=0,E.externalProtocol],['stack capacity',v=>v.state[C.sp]=5,E.malformedControl],
  ['wrong last opcode',v=>v.state[C.lastOpcode]=I.opcodes.SET,E.externalProtocol],['prior error',v=>v.state[C.error]=E.sourceDomain,E.externalProtocol],
  ['reserved word',v=>v.state[C.reservedStart]=1,E.malformedControl],['bad caller',v=>v.state[v.layout.stackOffset]=99,E.externalProtocol],
  ['counter overflow',v=>{v.state[C.stepsLow]=v.state[C.stepsHigh]=0xffffffff;},E.counterOverflow],
  ['changed stub ID',v=>v.code[5*8+2]=0,E.externalProtocol],['changed RET',v=>v.code[6*8]=I.opcodes.HALT,E.externalProtocol],['caller unused operand',v=>v.code[2*8+3]=1,E.externalProtocol]
 ]){
  const words=program(),v={...pending({code:words}),code:words};mutate(v);const source=v.bindings.map(x=>x.slice()),locals=v.state.slice(v.layout.localsOffset,v.layout.stackOffset);let called=false;assert.equal(v.serviceExternal(0,1,()=>{called=true;return Uint32Array.of(999);}),S.invalid,label);assert.equal(v.state[C.error],error,label);assert.equal(called,false,label);assert.deepEqual(v.bindings,source,label+' source untouched');assert.deepEqual(v.state.slice(v.layout.localsOffset,v.layout.stackOffset),locals,label+' locals untouched');
 }
});


test('external admission rejects unapproved metadata and default VM has no implicit handler or waiting state',()=>{
 const bad=(change,pattern)=>{const rows=structuredClone(externalFunctions);change(rows);assert.throws(()=>setup({externalFunctions:rows}),pattern);};
 bad(rows=>rows[0].approval.bodySha256='wrong',/approval/);bad(rows=>rows[0].params[0].slot=32,/parameter span/);bad(rows=>rows[0].returnSlot=32,/return span/);bad(rows=>rows[0].entryPc=8,/stub and RET/);bad(rows=>rows[0].name='invented',/approved/);bad(rows=>rows.push(rows[0]),/Unique/);bad(rows=>rows[0].returnWords=2,/signature/);
 const none=setup({externalFunctions:[]});none.begin();assert.equal(none.advance(),S.unsupported);assert.equal(none.state[C.error],E.unsupportedPrimitive);
 const noHandler=pending();assert.equal(noHandler.serviceExternal(0,1),S.unsupported);assert.equal(noHandler.state[C.error],E.unsupportedPrimitive);assert.equal(noHandler.state[C.stepsLow],3);
 const dirty=setup();dirty.begin();dirty.state[C.pendingMacro]=1;assert.equal(dirty.advance(),S.invalid);assert.equal(dirty.state[C.error],E.externalProtocol);
 const unknown=pending();assert.equal(unknown.serviceExternal(0,99,()=>{throw Error('not called');}),S.invalid);
 const carry=pending();carry.state[C.stepsLow]=0xffffffff;carry.serviceExternal(0,1,()=>Uint32Array.of(1));assert.equal(carry.state[C.stepsLow],0);assert.equal(carry.state[C.stepsHigh],1);
});

test('native macro wrappers are separate exact-source shaders with protocol guards and no core interpreter loop',()=>{
 const options={localWords:32,stackCapacity:4,instructionCount:9,externalFunctions,count:2,entryPc:0},core=generateMicrocodeVmWGSL(options);assert.doesNotMatch(core,/fn rc_cue_flat_advance|fn rc_num_eval/);assert.match(core,/rc_vm_external_valid/);parseMicrocodeWGSL(core);
 for(const d of externalFunctions){const shader=generateMicrocodeExternalWGSL({...options,macroId:d.id});assert.ok(shader.includes(sourceMacroNativeWGSL(d.name)));assert.equal((shader.match(/@binding\(/g)||[]).length,7);assert.match(shader,/@workgroup_size\(1\)/);assert.doesNotMatch(shader,/fn rc_vm_step|for\(var work=/);assert.match(shader,new RegExp('let result='+d.name+'\\('));assert.ok(shader.indexOf('if(pending==0u')<shader.indexOf('let result='));assert.doesNotMatch(shader,/rc_vm_state\[base\+5u\](?:--|=)/,'handler must not pop CALL stack');parseMicrocodeWGSL(shader);}
 assert.throws(()=>generateMicrocodeExternalWGSL({...options,macroId:99}),/macro ID/);
});


test('external PC diagnostics count service exactly once, not waiting retries or unmatched/duplicate handlers',()=>{
 const pcCounters=new Uint32Array(program().length/8),v=pending({pcCounters});assert.equal(pcCounters.reduce((n,x)=>n+x,0),3);assert.equal(pcCounters[5],0);v.advance();v.serviceExternal(0,0,()=>{throw Error('unselected');});assert.equal(pcCounters[5],0);v.serviceExternal(0,1,()=>Uint32Array.of(4));assert.equal(pcCounters[5],1);assert.equal(pcCounters.reduce((n,x)=>n+x,0),v.state[C.stepsLow]);v.serviceExternal(0,1,()=>{throw Error('duplicate');});v.advance();assert.equal(pcCounters[5],1);assert.equal(pcCounters.reduce((n,x)=>n+x,0),v.state[C.stepsLow]);
});


test('void exact-source macro preserves bare call and has no synthetic return value or local write',()=>{
 const spec=M.find(x=>x.name==='rc_world_broad_commit_collision'),d={id:spec.id,name:spec.name,entryPc:2,params:spec.parameterWords.map((words,slot)=>({slot,words})),returnSlot:0,returnWords:0,approval:approveSourceMacros(bindingsDeclaration+sourceMacroNativeWGSL(spec.name),{functionNames:[spec.name]}).entries[0]},instructions=code(ins('CALL',0,2),ins('HALT'),ins('EXTERNAL_CALL',0,spec.id),ins('RET')),options={testOnly:true,localWords:32,stackCapacity:4,code:instructions,externalFunctions:[d],initialSlots:[{slot:0,value:9},{slot:1,value:17},{slot:2,value:25}]},v=create(options);v.begin();assert.equal(v.advance(),S.waiting);const locals=v.state.slice(v.layout.localsOffset,v.layout.stackOffset);assert.equal(v.serviceExternal(0,spec.id,(descriptor,args,{bindings})=>{assert.equal(descriptor.returnWords,0);assert.deepEqual(args.map(x=>[...x]),[[9],[17],[25]]);bindings[0][0]=99;return new Uint32Array(0);}),S.ready);assert.deepEqual(v.state.slice(v.layout.localsOffset,v.layout.stackOffset),locals);assert.equal(v.state[C.sp],1);assert.equal(v.state[C.pc],3);assert.equal(v.advance(),S.complete);assert.equal(v.bindings[0][0],99);
 const shader=generateMicrocodeExternalWGSL({...options,instructionCount:4,macroId:spec.id});assert.ok(shader.includes(sourceMacroNativeWGSL(spec.name)));assert.match(shader,/;rc_world_broad_commit_collision\(rc_vm_state/);assert.doesNotMatch(shader,/let result=rc_world_broad_commit_collision|rc_vm_state\[lb\+\d+u\]=result/);parseMicrocodeWGSL(shader);assert.throws(()=>create({...options,externalFunctions:[{...d,returnSlot:1}]}),/no return slot/);
});
