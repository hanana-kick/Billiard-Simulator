// HOST source/admission/protocol gates. Native component evidence is separate.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {MICROCODE_SOURCE_MACROS as M,MICROCODE_NUMBER_PROGRAM_MACRO as N,sourceMacroNativeWGSL,approveSourceMacros} from '../src/resident-candidate/microcode-source-macros.mjs';
import {generateMicrocodeExternalWGSL,generateMicrocodeVmWGSL,createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {generateNumberProgramMacroAdmissionWGSL,assertNumberProgramMacroViews} from '../src/resident-candidate/number-program-macro-admission.mjs';
import {auditSourceMacroLaunchClosures} from '../src/resident-candidate/macro-launch-profile.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {compileCanonicalNumberProgramCall} from './resident-candidate-number-program-handoff.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const bindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',native=sourceMacroNativeWGSL(N.name);
const view={stateWordsPerCandidate:64,totalStateWords:128,programWords:32},guard=generateNumberProgramMacroAdmissionWGSL(view,{count:2,vmStateDisjoint:true});
const gatedSource=bindings+native+guard+'fn gate(lane:u32,pb:u32,sb:u32,cb:u32,budget:u32)->u32{if(!rc_vm_number_admit(lane,pb,sb,cb,budget)){return 0u;}rc_raw_program_step(pb,sb,cb,budget);return 1u;}',gated=allocateMicrocodeLocals(compileMicrocodeWGSL(gatedSource,{entry:'gate',allocationMetadata:true}),{mode:'call-frames-v1'}),root=gated.functions.find(f=>f.name==='gate');
function sample(lane=0){const state=new Uint32Array(128).fill(0xdeadbeef),program=new Uint32Array(32),sb=lane*64,cb=sb+20;state.fill(0,cb,cb+5);program[3]=1;program[4]=1;program[5]=16;program[12]=1;program[13]=100;program[16]=27;return {state,program,args:[lane,0,sb,cb,20000]};}
function run(input){const b=[input.state.slice(),input.program.slice(),Uint32Array.of(17),Uint32Array.of(19,23),Uint32Array.of(29)],before=b.slice(1).map(x=>x.slice());const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:gated.instructions,localWords:gated.localWords,stackCapacity:gated.callDepth,entryPc:gated.entryPc,bindings:b,initialSlots:root.params.map((p,i)=>({slot:p.slot,value:input.args[i]}))});vm.begin();let status=I.status.ready,chunks=0;while(status===I.status.ready&&chunks++<64)status=vm.advance(0,65536);assert.equal(status,I.status.complete);assert.deepEqual(b.slice(1),before);return{admitted:vm.local(0,root.returnSlot),state:b[0]};}
test('the qualified four-macro registry, approval, handler/core bytes and launch audit are unchanged',()=>{
 const fixture=JSON.parse(readFileSync(new URL('fixtures/resident-four-macro-before-number.json',import.meta.url),'utf8'));assert.equal(hash(M),fixture.registrySha256);assert.equal(hash(auditSourceMacroLaunchClosures()),fixture.launchAuditSha256);
 for(const row of fixture.rows){const spec=M.find(x=>x.id===row.id),source=sourceMacroNativeWGSL(spec.name),approval=approveSourceMacros(bindings+source,{functionNames:[spec.name]}).entries[0],d={id:spec.id,name:spec.name,entryPc:2,params:spec.parameterWords.map((words,slot)=>({slot,words})),returnSlot:spec.resultWords?16:0,returnWords:spec.resultWords,approval},o={count:2,localWords:32,stackCapacity:4,instructionCount:4,entryPc:0,externalFunctions:[d],macroId:spec.id};assert.equal(hash(source),row.nativeSourceSha256);assert.equal(hash(approval),row.approvalSha256);assert.equal(hash(generateMicrocodeExternalWGSL(o)),row.handlerSha256);assert.equal(hash(generateMicrocodeVmWGSL(o)),row.coreSha256);}
});
test('optional id4 is exactly the native-tested original Number closure, including every helper AST and declaration',()=>{
 const approval=approveSourceMacros(bindings+native,{functionNames:[N.name]}).entries[0],a=parseMicrocodeWGSL(native),b=parseMicrocodeWGSL(compileCanonicalNumberProgramCall().source);
 assert.deepEqual(a.functions,b.functions);assert.deepEqual(a.aliases,b.aliases);assert.deepEqual(a.structs,b.structs);assert.deepEqual(a.globals,b.globals.filter(g=>g.storage!=='storage'));
 assert.equal(approval.id,4);assert.equal(approval.resultWords,0);assert.deepEqual(approval.parameterWords,[1,1,1,1]);assert.equal(a.functions.length,36);assert.equal(Object.keys(approval.dependencies).length,36);assert.equal(approval.nativeSourceSha256,'80431e49dfff86f3ba26fd579cf3ff819d4f829518342761755052076a0f5978');assert.equal(approval.numericProfile,'original-source-number-software-binary64-v1');assert.deepEqual(approveSourceMacros(bindings+native).entries,[]);assert.equal(M.length,4);
});
test('Number approval rejects changed arithmetic, control order, signature and readonly/address-space bindings',()=>{
 for(const [before,after]of [['step<budget','step<20000u'],['cb+2u]++','cb+2u]+=2u'],['pb:u32,sb:u32','pb:i32,sb:u32'],['rc_state[cb]=pc;rc_state[cb+3u]=sp;','rc_state[cb+3u]=sp;rc_state[cb]=pc;'],['let s=a[i]+b[i];','let s=a[i]-b[i];'],['var<storage,read> rc_program','var<storage,read_write> rc_program'],['@binding(0)','@binding(2)']]){const changed=(bindings+native).replace(before,after);assert.notEqual(changed,bindings+native);assert.throws(()=>approveSourceMacros(changed,{functionNames:[N.name]}));}
});
test('both candidate banks execute exact halt effects and leave neighbor/dirty/readonly words intact',()=>{
 for(const lane of[0,1]){const input=sample(lane),expected=input.state.slice(),cb=input.args[3];expected[cb]=1;expected[cb+1]=1;expected[cb+2]=1;const actual=run(input);assert.equal(actual.admitted,1);assert.deepEqual(actual.state,expected);}
});
test('terminal fast return and zero budget keep original source no-op semantics',()=>{
 for(const lane of[0,1])for(const prior of[0,1,2,3]){const input=sample(lane);input.state[input.args[3]+1]=prior;input.args[4]=0;if(prior){input.args[1]=0xffffffff;input.args[2]=0xffffffff;input.args[4]=0xffffffff;}const actual=run(input);assert.equal(actual.admitted,1);assert.deepEqual(actual.state,input.state);}
});
test('exact generated admission rejects neighbor, overlap, negative/wrapping, malformed span/cap and budget before writes',()=>{
 const edits=[x=>x.args[0]=2,x=>x.args[1]=0xffffffff,x=>x.args[1]=20,x=>x.args[2]=0xffffffff,x=>x.args[2]=64,x=>x.args[2]=20,x=>x.args[3]=0xffffffff,x=>x.args[3]=64,x=>x.args[3]=63,x=>x.args[4]=20001,x=>x.program[3]=0xffffffff,x=>x.program[3]=33,x=>x.program[4]=0xffffffff,x=>x.program[5]=0xffffffff,x=>x.program[12]=0xffffffff,x=>x.state[23]=2,x=>x.state=x.state.slice(0,127),x=>x.program=x.program.slice(0,31)];
 for(const edit of edits){const input=sample();edit(input);const actual=run(input);assert.equal(actual.admitted,0,edit.toString());assert.deepEqual(actual.state,input.state,'guard makes no partial source write');}
});
test('id4 external protocol retains CALL/RET/counters and requires explicit disjoint original views',()=>{
 const source=bindings+native+'fn gate(){rc_raw_program_step(0u,0u,20u,20000u);}',p=allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry:'gate',externalFunctions:[N.name],allocationMetadata:true}),{mode:'call-frames-v1'}),input=sample(),b=[input.state,input.program,Uint32Array.of(17),Uint32Array.of(19),Uint32Array.of(23)];
 const options={count:2,localWords:p.localWords,stackCapacity:p.callDepth,instructionCount:p.instructions.length/8,entryPc:p.entryPc,externalFunctions:p.externalFunctions,controlMode:'storage-v1',vmStateDisjoint:true};
 const shader=generateMicrocodeExternalWGSL({...options,macroId:4,numberProgramViews:view});parseMicrocodeWGSL(shader);assert.ok(shader.includes(native));assert.ok(shader.indexOf('if(!rc_vm_number_admit(gid.x')<shader.lastIndexOf('rc_raw_program_step(rc_vm_state'));assert.match(shader,/rc_vm_external_fail\(base,5u\);return;/);assert.doesNotMatch(generateMicrocodeVmWGSL(options),/fn rc_raw_program_step/);
 for(const bad of[undefined,{...view,programWords:0},{...view,totalStateWords:127},{...view,unexpected:1}])assert.throws(()=>generateMicrocodeExternalWGSL({...options,macroId:4,numberProgramViews:bad}));assert.throws(()=>assertNumberProgramMacroViews(view,{count:2,vmStateDisjoint:false}));
 const vm=createMicrocodeVmReferenceForTest({testOnly:true,...options,count:1,code:p.instructions,bindings:b});vm.begin();assert.equal(vm.advance(0,4096),I.status.waiting);const waiting=vm.state.slice();assert.equal(vm.advance(0,4096),I.status.waiting);assert.deepEqual(vm.state,waiting);let called=0;vm.serviceExternal(0,4,(d,args)=>{called++;assert.equal(d.name,N.name);assert.deepEqual(args.map(x=>x[0]),[0,0,20,20000]);return new Uint32Array(0);});const served=vm.state.slice();vm.serviceExternal(0,4,()=>{throw Error('duplicate');});assert.deepEqual(vm.state,served);assert.equal(called,1);assert.equal(vm.advance(0,4096),I.status.complete);
});
