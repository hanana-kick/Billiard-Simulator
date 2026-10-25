// TEST ONLY: one source instruction at a time, full state/scratch comparisons.
// Future source snapshots are assertions only; this is not GPU qualification.
import assert from 'node:assert/strict';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {sourceIntrinsicNativeWGSL} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
import {generateNumericContinuationWGSL} from '../src/resident-candidate/numeric-continuation.mjs';
import {compileGraph} from '../src/resident-candidate/numeric-program.mjs';
import {SourceNumberProgramBuilder,compileSourceNumberProgram} from '../src/resident-candidate/raw-strike.mjs';
import {createSourceNumberContinuationForTest} from '../src/resident-candidate/source-number-continuation.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',source=prefix+sourceIntrinsicNativeWGSL('source-continuations-v1')+'fn rc_micro_cont_test(kind:u32,pb:u32,sb:u32,cb:u32)->u32{if(kind==0u){return rc_num_cont_instruction(cb);}return rc_source_program_instruction(pb,sb,cb);}',cache=new Map();
export function compilation(entry,fast=false){const key=entry+fast;if(!cache.has(key))cache.set(key,compileMicrocodeWGSL(entry==='rc_num_cont_begin'?prefix+generateNumericContinuationWGSL():source,{entry,intrinsics:fast?'source-continuations-v1':'none'}));return cache.get(key);}
export function run(entry,args,bindings,fast=false,{budget=65536,resume=false}={}){
 const p=compilation(entry,fast),root=p.functions.find(f=>f.name===entry),options={testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,bindings,intrinsics:p.intrinsicProfile,intrinsicHandler:microcodeIntrinsicReference,initialSlots:args.map((value,i)=>({slot:root.params[i].slot,value}))};let vm=createMicrocodeVmReferenceForTest(options);vm.begin();let status=1,n=0;
 while(status===1){status=vm.advance(0,budget);assert.ok(++n<10000,'bounded source instruction');if(resume&&n===1)vm=createMicrocodeVmReferenceForTest({...options,state:vm.state.slice()});}assert.equal(status,2,entry+' VM source completion');return{status:vm.local(0,root.returnSlot),steps:vm.state[6]};
}
const clone=b=>b.map(x=>x.slice());
export function compare(entry,args,b,label,options){const a=clone(b),c=clone(b),slow=run(entry,args,a,false,options),fast=run(entry,args,c,true,options);assert.equal(fast.status,slow.status,label+' status');assert.deepEqual(c,a,label+' every binding word');return{bindings:a,status:slow.status,slowSteps:slow.steps,fastSteps:fast.steps};}
export function numericFixture(plan,input){const g=compileGraph(plan),pb=3,sb=5,cb=7,program=new Uint32Array(g.program.length+pb+3).fill(0x77777777);program.set(g.program,pb);const state=new Uint32Array(32).fill(0x31415926),scratch=new Uint32Array(g.scratchWords+sb+4).fill(0x12345678);scratch.set(input,sb);const bindings=[state,program,new Uint32Array(3),scratch,new Uint32Array(4)];run('rc_num_cont_begin',[pb,sb,cb],bindings);return{g,pb,sb,cb,bindings};}
export function sourceFixture(rows,values=[2,-1,3,-0],{cap=64,stack=4}={}){const b=new SourceNumberProgramBuilder();b.alloc(values.length);b.constants=values.map((x,i)=>[i,...numberWords(x)]);b.code=rows.map(x=>x.slice());b.maxCallDepth=stack;const p=compileSourceNumberProgram(b,{inputs:[],outputs:[[0,0,0]],outputWords:2,maximumInstructions:cap}),pb=5,sb=7,cb=sb+p.registerWords+3,program=new Uint32Array(pb+p.words.length+4).fill(0x99999999);program.set(p.words,pb);const state=new Uint32Array(cb+p.controlWords+4).fill(0x12345678),bindings=[state,program,new Uint32Array(2),new Uint32Array(3),new Uint32Array(4)];createSourceNumberContinuationForTest(program,state,{testOnly:true}).init(pb,sb,cb);return{p,pb,sb,cb,bindings};}
/** Native callers consume only row.bindings as input, never row.expected.
 * The expected full buffers are produced by scalar source WGSL lowering, not
 * the intrinsic callback, before the independent native gate is launched. */
export function createMicrocodeContinuationFixture(){
 const entry='rc_micro_cont_test',rows=[],add=(name,kind,f)=>{const args=[kind,f.pb,f.sb,f.cb],bindings=clone(f.bindings),expectedBindings=clone(bindings),result=run(entry,args,expectedBindings);rows.push({name,args,bindings,expected:{bindings:expectedBindings,status:result.status,steps:result.steps}});};
 const normal={inputFloats:2,nodes:[{kind:'add',args:[0,1]},{kind:'mul',args:[2,1]}],outputs:[3,0,3]};
 for(const [name,input]of[['normal',Uint32Array.of(0x3f800000,0x40000000)],['subnormal',Uint32Array.of(1,0)],['signed-zero',Uint32Array.of(0x80000000,0)]]){const f=numericFixture(normal,input);add('numeric-'+name+'-first',0,f);run('rc_num_cont_instruction',[f.cb],f.bindings);add('numeric-'+name+'-final',0,f);run('rc_num_cont_instruction',[f.cb],f.bindings);add('numeric-'+name+'-prior-terminal',0,f);}
 const domain=numericFixture({inputFloats:2,nodes:[{kind:'div',args:[0,1]}],outputs:[0]},Uint32Array.of(0x3f800000,0));add('numeric-domain',0,domain);
 const badOutput=numericFixture(normal,Uint32Array.of(0x3f800000,0x40000000));run('rc_num_cont_instruction',[badOutput.cb],badOutput.bindings);badOutput.bindings[1][badOutput.pb+badOutput.g.program[8]]=99;add('numeric-final-output-malformed',0,badOutput);
 const reserved=numericFixture(normal,Uint32Array.of(1,1));reserved.bindings[0][reserved.cb+6]=1;add('numeric-reserved-control',0,reserved);
 for(let opcode=0;opcode<=28;opcode++){const f=sourceFixture([[opcode,0,1,2],[27,0,0,0]],opcode===21?[2,-1,0,-0]:[2,-1,3,-0]);if(opcode===26){f.bindings[0][f.cb+3]=1;f.bindings[0][f.cb+4]=1;}add('source-op-'+opcode,1,f);}
 const sourceRows=[['cap',f=>{f.bindings[0][f.cb+2]=f.p.maximumInstructions;}],['bad-pc',f=>{f.bindings[0][f.cb]=f.p.instructionCount;}],['prior-terminal',f=>{f.bindings[0][f.cb+1]=3;}]];
 for(const[name,mutate]of sourceRows){const f=sourceFixture([[0,0,1,0]]);mutate(f);add('source-'+name,1,f);}
 const f=sourceFixture([[25,2,0,0],[27,0,0,0],[1,0,0,2],[26,0,0,0]]);for(let step=0;step<4;step++){add('source-call-return-'+step,1,f);run('rc_source_program_instruction',[f.pb,f.sb,f.cb],f.bindings);}
 return{kind:'source-continuation-scalar-oracle-fixture-v1',entry,compiled:compilation(entry,true),scalarCompilation:compilation(entry),rows,scope:'one original source instruction per row; source state and scratch oracle only',gpuQualified:false};
}
