import{test}from'node:test';import assert from'node:assert/strict';
import{generateIntegerF32WGSL,INTEGER_F32_CAPABILITY}from'../src/resident-candidate/integer-f32.mjs';
import{NUMERIC_PROFILE as P,generateProfiledNumericWGSL}from'../src/resident-candidate/numeric-profile.mjs';
import{compileGraph,executeLowered}from'../src/resident-candidate/numeric-program.mjs';
import{generateNumericContinuationWGSL}from'../src/resident-candidate/numeric-continuation.mjs';
import{generateCoupledFlatWGSL,executeCoupledFlatForTest}from'../src/resident-candidate/coupled-flat.mjs';
import{createCoupledProgramBundle,packCoupledInitialState,COUPLED_BODY_OFFSETS as O}from'../src/resident-candidate/coupled-solver.mjs';
import{sourceNumberReference as N}from'../src/resident-candidate/source-number.mjs';
import Graph from'../src/experimental-arithmetic-graph.js';import Source from'../src/experimental-coupled-contact-math.js';
import{largestFixture}from'./resident-candidate-coupled-flat-fixtures.mjs';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{createCueProgramBundle,packCueInitialState,executeCueForTest}from'../src/resident-candidate/cue-orchestration.mjs';
const SIGN=0x80000000,raw=a=>new Uint32Array(a.buffer,a.byteOffset,a.length),one=new Uint32Array(1),flt=new Float32Array(one.buffer),number=w=>(one[0]=w,flt[0]),bits=x=>(flt[0]=x,one[0]);
const finite=w=>(w&0x7f800000)!==0x7f800000,zero=w=>(w&0x7fffffff)===0;
const equal=(a,b)=>(a>>>0)===(b>>>0)||zero(a)&&zero(b),less=(a,b)=>{a>>>=0;b>>>=0;return equal(a,b)?false:(a>>>31)!==(b>>>31)?!!(a>>>31):(a>>>31)?a>b:a<b;};
const length=n=>n===0n?0:n.toString(2).length;
function decode(w){const e=w>>>23&255;return{sign:w>>>31,m:BigInt(w&0x7fffff)+(e?1n<<23n:0n),scale:e?e-150:-149};}
// Independent exact rational -> binary32, no source Number implementation and
// no floating arithmetic. The sqrt oracle compares squared integer midpoints.
function round(n,d,scale,sign=0){
 if(!n)return(sign?SIGN:0)>>>0;
 let e=length(n)-length(d)+scale;const below=p=>scale-p>=0?(n<<BigInt(scale-p))<d:n<(d<<BigInt(p-scale));if(below(e))e--;while(!below(e+1))e++;
 const step=Math.max(e-23,-149),shift=scale-step,nn=shift>=0?n<<BigInt(shift):n,dd=shift<0?d<<BigInt(-shift):d;let q=nn/dd;const r=nn%dd;if(r*2n>dd||r*2n===dd&&(q&1n))q++;
 if(!q)return(sign?SIGN:0)>>>0;const size=length(q),exponent=size-1+step;if(exponent>127)return((sign?SIGN:0)|0x7f800000)>>>0;if(exponent< -126)return((sign?SIGN:0)|Number(q))>>>0;
 if(size>24)q>>=BigInt(size-24);else if(size<24)q<<=BigInt(24-size);return((sign?SIGN:0)|((exponent+127)<<23)|Number(q&0x7fffffn))>>>0;
}
function isqrt(n){if(!n)return 0n;let x=1n<<BigInt(Math.ceil(length(n)/2));for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function rational(op,aw,bw=0){let a=decode(aw),b=decode(bw);
 if(op===1||op===2){if(op===2)b={...b,sign:b.sign^1};const scale=Math.min(a.scale,b.scale),x=(a.sign?-a.m:a.m)<<BigInt(a.scale-scale),y=(b.sign?-b.m:b.m)<<BigInt(b.scale-scale),sum=x+y;return round(sum<0n?-sum:sum,1n,scale,sum===0n?(!a.m&&!b.m?a.sign&b.sign:0):+(sum<0n));}
 if(op===3)return round(a.m*b.m,1n,a.scale+b.scale,a.sign^b.sign);
 if(op===4){if(!b.m)return !a.m?0x7fc00000:((a.sign^b.sign?SIGN:0)|0x7f800000)>>>0;return round(a.m,b.m,a.scale-b.scale,a.sign^b.sign);}
 if(op===7){if(!a.m)return aw;if(a.sign)return 0x7fc00000;const exponent=Math.floor((length(a.m)-1+a.scale)/2),step=exponent-23,shift=a.scale-2*step;assert.ok(shift>=0);const n=a.m<<BigInt(shift);let q=isqrt(n),m=2n*q+1n,cmp=4n*n-m*m;if(cmp>0n||cmp===0n&&(q&1n))q++;return round(q,1n,step);}
 throw Error('Not arithmetic');
}
function software(op,a,b){const x=N.fromF32(a),y=N.fromF32(b),name={1:'add',2:'sub',3:'mul',4:'div'}[op];return N.toF32(name?N[name](x,y):op===7?N.sqrt(x):op===8?N.div(N.fromF32(0x3f800000),x):N.div(y,x));}
// Execute the actual generated opcode branch as an integer-only JS dialect.
// This test adapter is never imported by any production module.
function actualOpcode(){const code=generateIntegerF32WGSL(),start=code.indexOf('    switch opcode {',code.indexOf('fn rc_num_eval(')),end=code.indexOf('\n    if (!rc_num_finite(word))',start);let body=code.slice(start,end).replace(/\b(0x[0-9a-f]+|\d+)u\b/gi,'$1').replace('switch opcode','switch (opcode)').replace(/case (\d+),(\d+),(\d+):/,'case $1: case $2: case $3:').replace(/}\n\s*(case|default)/g,'break;}\n$1').replace(/\blet\b/g,'const');
 return new Function('rc_num_soft_arithmetic','rc_num_lt_bits','rc_num_eq_bits','rc_num_zero','select','rc_num_fail',`return function(opcode,aw=0,bw=0,cw=0,aa=0){let word=0;const scratchBase=0,registers=0;${body};return word>>>0;}`)(software,less,equal,zero,(a,b,c)=>c?b:a,(_b,_s,status)=>{throw Object.assign(new Error('Numeric status'),{numericStatus:status});});}
const opcode=actualOpcode();
const edges=[0,0x80000000,1,2,3,5,0x7ffffe,0x7fffff,0x800000,0x800001,0x800003,0x80000001,0x807fffff,0x80800000,507307271,507307272,507307273,2654790919,2654790920,2654790921,0x3effffff,0x3f000000,0x3f000001,0x3f7fffff,0x3f800000,0x3f800001,0x40000000,0x40000001,0x7f7ffffe,0x7f7fffff,0xff7fffff];
test('integer profile actual opcode equations match independent rational/tie/sqrt oracle over finite f32 domain samples',()=>{
 for(const a of edges)for(const b of edges)for(const op of[1,2,3,4]){if(op===4&&zero(b))continue;assert.equal(opcode(op,a,b),rational(op,a,b),`${op} ${a.toString(16)} ${b.toString(16)}`);}
 let seed=0xced51431;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 for(let i=0;i<16000;i++){const a=random(),b=random();if(!finite(a)||!finite(b))continue;for(const op of[1,2,3,4])if(op!==4||!zero(b))assert.equal(opcode(op,a,b),rational(op,a,b),'random rational');const positive=a&0x7fffffff;assert.equal(opcode(7,positive),rational(7,positive),'random integer sqrt');}
 // Halfway add and subnormal division/multiply ties, even/odd endpoints and
 // normal/subnormal boundary. Expected words do not come from the f64 model.
 for(const[op,a,b,w]of[[1,0x3f800000,0x33800000,0x3f800000],[1,0x3f800001,0x33800000,0x3f800002],[4,1,0x40000000,0],[4,3,0x40000000,2],[4,5,0x40000000,2],[4,0x80000001,0x40000000,0x80000000],[4,0x800001,0x40000000,0x400000],[4,0x800003,0x40000000,0x400002],[3,1,0x3f000000,0],[3,3,0x3f000000,2]])assert.equal(opcode(op,a,b),w,'known tie');
});
test('all sixteen actual opcode branches retain original eager/sign/threshold/domain semantics',()=>{
 for(const[op,source]of Graph.OPERATIONS.entries())for(const a of edges)for(const b of edges){const c=0x80000001;if(op===4&&zero(b)||op===7&&(a&SIGN)&&!zero(a)){assert.throws(()=>opcode(op,a,b,c,a),e=>e.numericStatus===4);continue;}const expected=bits(source.cpu(...(op===0?[number(a)]:[number(a),number(b),number(c)])));assert.equal(opcode(op,a,b,c,a),expected,source.name+' source bits');}
 assert.throws(()=>opcode(16),e=>e.numericStatus===2);
});
function integerGraph(compiled,input){const words=new Uint32Array(compiled.registerCount);words.set(raw(input));for(let i=0;i<compiled.nodeCount;i++){const at=12+i*5,[op,d,a,b,c]=compiled.program.slice(at,at+5);const w=opcode(op,words[a],words[b],words[c],a);if(!finite(w))throw Object.assign(new Error('Nonfinite'),{numericStatus:3});words[d]=w;}return Uint32Array.from(compiled.outputSlots,i=>words[i]);}
let corpus;
async function productionRows(){if(corpus)return corpus;const rows=[],B=createCoupledProgramBundle(),fx=largestFixture(),p=Source.buildPlan(fx.spec),initial=packCoupledInitialState(fx.spec,Source.pack(fx.input,p)),seen=new Set();
 executeCoupledFlatForTest(B,initial.state,{testOnly:true,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase,onProgram:r=>{if(seen.has(r.programBase))return;seen.add(r.programBase);const index=B.entries.findIndex((_,i)=>B.program[4+i*6]===r.programBase),entry=B.entries[index];rows.push({name:'coupled '+index,compiled:entry.compiled,input:r.input});}});assert.equal(rows.length,16);
 const{seed}=await originalRegisteredFixture(),cue=createCueProgramBundle(),bodies=seed.balls.map(({state:s})=>{const a=new Uint32Array(64),f=new Float32Array(a.buffer);for(const[k,i]of Object.entries(O))if(s[k]!==undefined)f.set(Array.isArray(s[k])?s[k]:[+s[k]],i);return a;}),app=executeCueForTest(cue,packCueInitialState(seed.cueInitial,cue),{ball:bodies[seed.selectedIndex],others:bodies.filter((_,i)=>i!==seed.selectedIndex),testOnly:true});
 rows.push({name:'original full 72546-node cue',compiled:cue.entries[3].compiled,input:new Float32Array(app.state.buffer).slice(64,208)});return corpus=rows;
}
test('integer opcode path retains actual source full cue and all sixteen live coupled microprogram outputs',async()=>{for(const row of await productionRows())assert.deepEqual(integerGraph(row.compiled,row.input),raw(executeLowered(row.compiled,row.input,{testOnly:true})),row.name);});
test('integer implementation contains no hardware float expression and continuation inherits it without baseline change',()=>{
 const code=generateProfiledNumericWGSL(P.INTEGER_F32),clean=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');assert.doesNotMatch(clean,/\bf32\b|\bf16\b|\d+\.\d+/);assert.match(code,/PROFILE:u32=3u/);assert.doesNotMatch(code,/wordResult|bitcast<f32>|result=a[+*/-]b/);
 for(const next of[generateNumericContinuationWGSL({numericProfile:P.INTEGER_F32}),generateCoupledFlatWGSL({numericProfile:P.INTEGER_F32})]){assert.match(next,/PROFILE:u32=3u/);assert.match(next,/word=rc_num_soft_arithmetic\(opcode,aw,bw\)/);assert.doesNotMatch(next,/fn rc_num_eval\(/);}
 assert.match(generateProfiledNumericWGSL(P.PRESERVED_F32),/PROFILE:u32=2u/);assert.match(generateProfiledNumericWGSL(P.PRESERVED_F32),/result=a\/b/);assert.equal(INTEGER_F32_CAPABILITY.nativeQualified,false);
});
function primitiveRows(){const rows=[],pairs=[[0,0],[0x80000000,0x80000000],[1,2],[0x80000001,1],[0x800000,1],[3,0x40000000],[0x3f800000,0x33800000],[0x3f800001,0x33800000],[0x3f800001,0x3f7fffff],[0x7f7fffff,0x3f800001],[0x7fffff,0x800000],[507307271,0x3f800000],[507307272,0x3f800000],[507307273,0xbf800000],[2654790920,0x3f800000],[0xbf800000,0],[0x7f800000,0x3f800000]];
 for(const[op,source]of Graph.OPERATIONS.entries())for(const[a,b]of pairs){const input=new Float32Array(Uint32Array.of(a,b,0x80000001).buffer),compiled=compileGraph({inputFloats:3,nodes:[{kind:source.name,args:op===0?[-0]:Array.from({length:source.arity},(_,i)=>i)}],outputs:[3]});rows.push({name:source.name+' '+a.toString(16)+'/'+b.toString(16),input,compiled});}
 const bad=compileGraph({inputFloats:1,nodes:[{kind:'sqrt',args:[0]}],outputs:[1]});bad.program[12]=99;rows.push({name:'malformed instruction isolation',input:Float32Array.of(4),compiled:bad});return rows;
}
test('actual native integer-only f32 primitives, all coupled programs and full cue preserve raw source bits',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const{createNativeOwner,dispatchWords}=await import('./resident-candidate-gpu-support.mjs'),rows=[...primitiveRows(),...await productionRows()];
 let pn=0,inn=0,sn=0,on=0;const jobs=[];for(const row of rows){try{row.expected=raw(executeLowered(row.compiled,row.input,{testOnly:true}));row.status=1;}catch(e){row.status=e.numericStatus;assert.ok(row.status);}row.pb=pn;pn+=row.compiled.program.length;row.ib=inn;inn+=row.input.length;row.sb=sn+1;sn+=row.compiled.scratchWords+2;row.ob=on;on+=row.compiled.outputCount+1;jobs.push(row.pb,row.ib,row.sb,row.ob);}
 const program=new Uint32Array(pn),inputs=new Uint32Array(inn),scratch=new Uint32Array(sn),guard=0xfacefeed;for(const row of rows){program.set(row.compiled.program,row.pb);inputs.set(raw(row.input),row.ib);scratch[row.sb-1]=guard;scratch[row.sb+row.compiled.scratchWords]=guard;}
 const code=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateProfiledNumericWGSL(P.INTEGER_F32)}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/4u){return;}let j=row*4u;let p=rc_jobs[j];let s=rc_jobs[j+2u];let o=rc_jobs[j+3u];for(var i=0u;i<rc_program[p+3u];i++){rc_scratch[s+i]=rc_inputs[rc_jobs[j+1u]+i];}let status=rc_num_eval(p,s);let count=rc_program[p+4u];rc_results[o+count]=status;if(status!=1u){return;}for(var i=0u;i<count;i++){rc_results[o+i]=rc_scratch[s+rc_program[p+rc_program[p+8u]+i]];}}`;
 const owner=await createNativeOwner('source-integer-f32');try{const[,,work,,actual]=await dispatchWords(owner,{code,buffers:[{input:program},{input:inputs},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{input:new Uint32Array(on).fill(guard),readback:true}],workgroups:Math.ceil(rows.length/32),label:'integer-f32-all-opcodes-coupled-and-full-cue'});for(const row of rows){assert.equal(actual[row.ob+row.compiled.outputCount],row.status,row.name+' completion');assert.deepEqual(actual.slice(row.ob,row.ob+row.compiled.outputCount),row.status===1?row.expected:new Uint32Array(row.compiled.outputCount).fill(guard),row.name+' raw bits/error leaves output');assert.equal(work[row.sb-1],guard);assert.equal(work[row.sb+row.compiled.scratchWords],guard);}t.diagnostic(JSON.stringify({gate:'integer-f32',rows:rows.length,productionPrograms:17,fullCueNodes:72546,strictBits:true,hardwarePerformance:false,adapterInfo:owner.adapterInfo}));}finally{owner.release();}
});
