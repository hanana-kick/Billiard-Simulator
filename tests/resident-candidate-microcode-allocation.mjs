// HOST-only frame allocator gates. Existing default microcode remains the oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
import {sourceIntrinsicNativeWGSL} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
function execute(p,args=[],{budget=17,bindings=Array.from({length:5},()=>new Uint32Array(8)),save=true}={}){
 const root=p.functions.find(f=>f.name===p.entryFunction),options={testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,intrinsics:p.intrinsicProfile,intrinsicHandler:microcodeIntrinsicReference,bindings,initialSlots:args.flatMap((a,i)=>Array.from(a,(value,j)=>({slot:root.params[i].slot+j,value})))};let vm=createMicrocodeVmReferenceForTest(options);vm.begin();let status=1,n=0;
 while(status===1){status=vm.advance(0,budget);assert.ok(++n<100000);if(save&&n===1)vm=createMicrocodeVmReferenceForTest({...options,state:vm.state.slice()});}
 return{status,error:vm.state[3],steps:[vm.state[6],vm.state[7]],output:Uint32Array.from({length:root.returnWords},(_,i)=>vm.local(0,root.returnSlot+i)),globals:p.globals.filter(g=>!g.storage).map(g=>({name:g.name,words:Uint32Array.from({length:g.words},(_,i)=>vm.local(0,g.slot+i))})),bindings};
}
function pair(code,args=[],options={}){const scalar=compileMicrocodeWGSL(code,{allocationMetadata:true,...options}),packed=allocateMicrocodeLocals(scalar,{mode:'call-frames-v1'});assert.equal(packed.instructions.length,scalar.instructions.length);for(let pc=0;pc<scalar.instructions.length/8;pc++)assert.equal(packed.instructions[pc*8],scalar.instructions[pc*8]);assert.deepEqual(execute(packed,args),execute(scalar,args));return{scalar,packed};}
test('metadata and frame overlap are opt-in; default bytecode is unchanged and all code ordering remains',()=>{
 const code='fn a(x:u32)->u32{return x+1u;}fn b(x:u32)->u32{return x*2u;}fn main(x:u32)->u32{return a(x)+b(x);}';
 const original=compileMicrocodeWGSL(code),metadata=compileMicrocodeWGSL(code,{allocationMetadata:true});assert.deepEqual(metadata.instructions,original.instructions);assert.equal(original.allocationMetadata,undefined);assert.throws(()=>allocateMicrocodeLocals(original,{mode:'call-frames-v1'}),/metadata/);assert.throws(()=>allocateMicrocodeLocals(metadata),/opt-in/);const{scalar,packed}=pair(code,[Uint32Array.of(7)]);assert.ok(packed.localWords<scalar.localWords);assert.equal(packed.allocation.nativeQualified,false);
 const frames=new Map(packed.allocation.frames.map(f=>[f.name,f]));assert.equal(frames.get('a').base,frames.get('b').base);assert.ok(frames.get('a').base>=frames.get('main').base+frames.get('main').words);
});
test('caller locals, aggregate addresses, nested pointer mutations and private globals survive calls and saved yields',()=>{
 const code=`struct S{a:array<vec2<u32>,2>}var<private> shared:u32;
 fn bump(p:ptr<function,S>,i:u32)->u32{(*p).a[i][1u]+=3u;return (*p).a[i][1u];}
 fn leaf(x:u32)->u32{var scratch=array<u32,4>(1u,2u,3u,4u);shared++;return scratch[x%4u]+x;}
 fn left(p:ptr<function,S>,x:u32)->u32{let live=leaf(x);return bump(p,1u)+live;}
 fn right(x:u32)->u32{return leaf(x+1u);}
 fn main(x:u32)->u32{var s=S(array<vec2<u32>,2>(vec2<u32>(2u,4u),vec2<u32>(6u,8u)));var total=0u;for(var i=0u;i<3u;i++){total+=left(&s,x)+right(x);}return total+s.a[1u][1u]+shared;}`;
 for(const x of[0,2,5])pair(code,[Uint32Array.of(x)]);
});
test('argument evaluation and post-return copies remain protected when sibling frames overlap',()=>{
 const code=`var<private> v:u32;fn mutate()->u32{v=9u;return 4u;}fn sum(a:u32,b:u32)->u32{return a*100u+b;}fn other(x:u32)->u32{return x+11u;}fn main()->u32{v=3u;let r=sum(v,mutate());return r*100u+other(2u)+v;}`;pair(code);
});
test('local address constants relocate only from compiler metadata, never by numeric coincidence',()=>{
 const code='fn leaf(a:u32)->u32{return a+1u;}fn main()->u32{var v=array<u32,2>(17u,19u);let n=leaf(1u);return v[n-1u]+17u;}';const{scalar,packed}=pair(code);const addressed=new Set(scalar.allocationMetadata.addressConstants.map(x=>x.pc));let count=0;
 for(let pc=0;pc<scalar.instructions.length/8;pc++)if(scalar.instructions[pc*8]===I.opcodes.SET&&!addressed.has(pc)){assert.equal(packed.instructions[pc*8+2],scalar.instructions[pc*8+2]);count++;}assert.ok(addressed.size>0&&count>0);
});
test('pointer escapes, stale proof, foreign references and cross-function branches fail closed',()=>{
 for(const code of['fn bad(p:ptr<function,u32>)->ptr<function,u32>{return p;}fn main(){var x=1u;let y=bad(&x);}', 'struct Escape{p:ptr<function,u32>}fn bad(p:ptr<function,u32>)->Escape{return Escape(p);}fn main(){var x=1u;let y=bad(&x);}', 'var<private> p:ptr<function,u32>;fn main(){}', 'fn main()->u32{var x=1u;return bitcast<u32>(&x);}']){const p=compileMicrocodeWGSL(code,{allocationMetadata:true});assert.throws(()=>allocateMicrocodeLocals(p,{mode:'call-frames-v1'}),/Escaping pointer/);}
 const p=compileMicrocodeWGSL('fn a(x:u32)->u32{return x+1u;}fn main(x:u32)->u32{return a(x);}',{allocationMetadata:true});const changed=p.instructions.slice();changed[2]^=1;assert.throws(()=>allocateMicrocodeLocals({...p,instructions:changed},{mode:'call-frames-v1'}),/Bytecode changed/);
 const noProof={...p,allocationMetadata:{...p.allocationMetadata,foreignMoves:[]}};assert.throws(()=>allocateMicrocodeLocals(noProof,{mode:'call-frames-v1'}),/Unexplained foreign/);
 const address=p.functions[0].entryPc;const branch=p.instructions.slice();branch[0]=I.opcodes.JUMP;branch[1]=0;branch[2]=address;assert.throws(()=>allocateMicrocodeLocals({...p,instructions:branch,allocationMetadata:{...p.allocationMetadata,bytecodeSha256:hash(branch)}},{mode:'call-frames-v1'}),/Cross-function branch/);
});
test('exact f64 source and opt-in intrinsic paths retain numerical words after frame overlap',()=>{
 const source=sourceIntrinsicNativeWGSL('source-f64-v1');for(const intrinsics of['none','source-f64-v1'])for(const entry of['rc_f64_add','rc_f64_div','rc_f64_sqrt'])for(const value of[0,-0,Number.MIN_VALUE,Math.PI,Infinity,NaN])pair(source,entry==='rc_f64_sqrt'?[numberWords(value)]:[numberWords(value),numberWords(2)],{entry,intrinsics});
});
test('full original owner source static frame bound is source-backed, not a throughput claim',t=>{
 const path='/tmp/resident-microcode-dynamic-world.wgsl';if(!existsSync(path))return t.skip('Coordinator composed source artifact unavailable');const p=compileMicrocodeWGSL(readFileSync(path,'utf8'),{entry:'rc_micro_world_run',intrinsics:'source-continuations-v1',allocationMetadata:true}),q=allocateMicrocodeLocals(p,{mode:'call-frames-v1'});assert.ok(q.localWords<p.localWords);assert.equal(q.sourceSha256,p.sourceSha256);assert.equal(q.instructions.length,p.instructions.length);t.diagnostic(JSON.stringify({beforeWords:p.localWords,afterWords:q.localWords,pinnedWords:q.allocation.pinnedWords,functions:q.functions.length,perCandidateBytes:q.localWords*4,localBytesFor1024:q.localWords*4*1024,sourceCompileOnly:true,nativeQualified:false}));
});
