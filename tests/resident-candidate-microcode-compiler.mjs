import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as ISA} from '../src/resident-candidate/microcode-isa.mjs';
import {generateSourceNumberWGSL,numberWords,sourceNumberReference as N} from '../src/resident-candidate/source-number.mjs';
function execute(compilation,args,{budget=4096,bindings=Array.from({length:5},()=>new Uint32Array(1)),resume=false}={}){
 const entry=compilation.functions.find(x=>x.name===compilation.entryFunction),initialSlots=args.flatMap((words,i)=>Array.from(words,(value,j)=>({slot:entry.params[i].slot+j,value}))),options={testOnly:true,code:compilation.instructions,count:1,localWords:compilation.localWords,stackCapacity:compilation.callDepth,entryPc:compilation.entryPc,bindings,initialSlots};
 let vm=createMicrocodeVmReferenceForTest(options);vm.begin();let status=1,chunks=0;
 while(status===1){status=vm.advance(0,budget);assert.ok(++chunks<100000,'bounded test instruction budget');if(resume&&chunks===1)vm=createMicrocodeVmReferenceForTest({...options,state:vm.state.slice()});}
 assert.equal(status,ISA.status.complete,'source lowering must finish without unsupported/error');
 return{words:Uint32Array.from({length:entry.returnWords},(_,i)=>vm.local(0,entry.returnSlot+i)),vm,chunks};
}
const f64=generateSourceNumberWGSL(),compiled=new Map(),program=name=>{if(!compiled.has(name))compiled.set(name,compileMicrocodeWGSL(f64,{entry:name}));return compiled.get(name);};
test('actual source binary64 functions lower without native heavy helper inlining and match exact word oracles',()=>{
 const pairs=[[0,-0],[-0,-0],[1.25,-.5],[Number.MIN_VALUE,Number.MIN_VALUE],[1,2**-53],[1+2**-52,2**-53],[Number.MAX_VALUE,2],[2**-1022,1-2**-52],[Infinity,1],[Infinity,-Infinity],[NaN,1],[3.141592653589793,Math.E],[0xffffffff,0x100000001]];
 for(const[name,reference]of[['add',N.add],['sub',N.sub],['mul',N.mul],['div',N.div]]){const p=program('rc_f64_'+name);assert.ok(p.functions.length>3);assert.ok(p.instructions.length/8<3000,'shared source functions, not inlined call trees');assert.ok(p.instructions.some((x,i)=>i%8===0&&x===ISA.opcodes.CALL));for(const pair of pairs){const args=pair.map(numberWords),a=execute(p,args);assert.deepEqual(a.words,reference(...args),name+' '+pair);}}
 for(const value of[0,-0,Number.MIN_VALUE,2**-1022,.25,2,Math.PI,Number.MAX_VALUE,Infinity,-1,NaN])assert.deepEqual(execute(program('rc_f64_sqrt'),[numberWords(value)]).words,N.sqrt(numberWords(value)));
});
test('f64 predicates/conversions retain source NaN, signed zero and subnormal behavior',()=>{
 for(const value of[0,-0,Number.MIN_VALUE,2**-149,2**-126,1,1+2**-24,Number.MAX_VALUE,Infinity,-Infinity,NaN]){
  assert.deepEqual(execute(program('rc_f64_to_f32_bits'),[numberWords(value)]).words,Uint32Array.of(N.toF32(numberWords(value))));
  for(const other of[0,-0,1,Infinity,NaN])for(const[name,fn]of[['eq',N.eq],['lt',N.lt]])assert.deepEqual(execute(program('rc_f64_'+name),[numberWords(value),numberWords(other)]).words,Uint32Array.of(+fn(numberWords(value),numberWords(other))));
 }
 for(const word of[0,0x80000000,1,0x007fffff,0x00800000,0x3f800000,0x7f800000,0xff800000,0x7fc00000])assert.deepEqual(execute(program('rc_f64_from_f32_bits'),[Uint32Array.of(word)]).words,N.fromF32(word));
});
test('function-local pointer mutations, private globals and source short circuits survive saved-state yields',()=>{
 const source=`struct Pair {x:u32,y:u32} var<private> shared:u32;
 fn bump(p:ptr<function,Pair>)->u32{(*p).x+=3u;(*p).y=(*p).x+1u;return (*p).y;}
 fn touch()->bool{shared++;return true;}
 fn main(a:u32)->u32{var p=Pair(a,2u);let r=bump(&p);let no=false&&touch();let yes=true||touch();var total=0u;for(var i=0u;i<7u;i++){if(i==2u){continue;}if(i==6u){break;}total+=i;}switch total{case 13u:{total=100u;}default:{total=999u;}}return p.x*1000u+r*100u+shared+total;}`;
 const p=compileMicrocodeWGSL(source),run=execute(p,[Uint32Array.of(4)],{budget:7,resume:true});assert.equal(run.words[0],7900);assert.ok(run.chunks>1);
 assert.equal(p.sourceSha256,createHash('sha256').update(source).digest('hex'));
});
test('storage references and call argument evaluation are source ordered, not aliases to later writes',()=>{
 const source=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;var<private> x:u32;
 fn mutate()->u32{x=9u;rc_state[0u]=7u;return 2u;}fn sum(a:u32,b:u32)->u32{return a*10u+b;}
 fn main()->u32{x=3u;let result=sum(x,mutate());rc_state[1u]=result;return result+arrayLength(&rc_state);}`;
 const bindings=Array.from({length:5},()=>new Uint32Array(3)),r=execute(compileMicrocodeWGSL(source),[],{bindings});assert.equal(r.words[0],35);assert.deepEqual(bindings[0],Uint32Array.of(7,32,0));
});
test('unsupported constructs, recursion and readonly storage never produce approximate bytecode',()=>{
 assert.throws(()=>compileMicrocodeWGSL('fn main()->f32{return sin(1.0);}'),/Unsupported builtin/);
 assert.throws(()=>compileMicrocodeWGSL('fn main()->u32{return main();}'),/Recursive/);
 assert.throws(()=>compileMicrocodeWGSL('@group(0) @binding(1) var<storage,read> rc_program:array<u32>;fn main(){rc_program[0u]=1u;}'),/readonly/);
 assert.throws(()=>compileMicrocodeWGSL('var<workgroup> x:u32;fn main(){}'),/address space/);
 assert.throws(()=>compileMicrocodeWGSL('fn main(){let x=1u;x=2u;}'),/immutable/);
});
test('authentic composed dynamic owner source compiles with all original closures, if coordinator artifact exists',t=>{
 const path='/tmp/resident-microcode-dynamic-world.wgsl';if(!existsSync(path))return t.skip('Coordinator composed source artifact not present');const source=readFileSync(path,'utf8'),p=compileMicrocodeWGSL(source,{entry:'rc_micro_world_run'});assert.equal(p.functions.length,837);assert.ok(p.localWords>0);assert.equal(p.sourceSha256,createHash('sha256').update(source).digest('hex'));assert.equal(p.capability.nativeQualified,false);t.diagnostic(JSON.stringify({sourceCompilationOnly:true,functions:p.functions.length,instructions:p.instructions.length/8,localWords:p.localWords,callDepth:p.callDepth,gpuExecution:false}));
});
test('numeric bool constructors normalize and abstract constant arithmetic fails closed',()=>{
 for(const v of[0,1,2,0xffffffff])assert.equal(execute(compileMicrocodeWGSL('fn main(a:u32)->bool{return bool(a)==true;}'),[Uint32Array.of(v)]).words[0],+(v!==0));
 assert.throws(()=>compileMicrocodeWGSL('var<private> result:f32;fn main(){result=16777217.0-16777216.0;}'),/Abstract constant arithmetic/);
});
test('local aggregate index guards reject positive and negative escape before neighboring words change',()=>{
 for(const index of['1u','0xffffffffu','-1']){
  const code=`var<private> before:u32=7u;var<private> a:array<u32,1>;var<private> victim:u32=11u;fn main(){let i=${index};a[i]=99u;}`;
  const p=compileMicrocodeWGSL(code),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:1,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc});vm.begin();assert.equal(vm.advance(0,10000),ISA.status.unsupported);assert.equal(vm.state[3],ISA.error.sourceDomain);for(const[name,want]of[['before',7],['victim',11]])assert.equal(vm.local(0,p.globals.find(g=>g.name===name).slot),want);
 }
 const source=`struct S{v:array<vec2<u32>,2>}fn bad(p:ptr<function,S>){(*p).v[1u][2u]=99u;}fn main(){var s=S();bad(&s);}`;
 const p=compileMicrocodeWGSL(source),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,count:1,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc});vm.begin();assert.equal(vm.advance(0,10000),ISA.status.unsupported);assert.equal(vm.state[3],ISA.error.sourceDomain);
});

test('array constructors retain whole vector and nested array element types',()=>{
 const source=`alias RcF64=vec2<u32>;fn main()->u32{let x=array<RcF64,3>(RcF64(1u,2u),RcF64(3u,4u),RcF64(5u,6u));let y=array<array<RcF64,3>,2>(x,x);return y[1u][2u].y*100u+y[0u][0u].x;}`;
 assert.equal(execute(compileMicrocodeWGSL(source),[],{budget:13,resume:true}).words[0],601);
 assert.throws(()=>compileMicrocodeWGSL('fn main(){let x=array<vec2<u32>,2>(1u,2u,3u,4u);}'),/Aggregate constructor element/);
});
