import{test}from'node:test';import assert from'node:assert/strict';
import{compileGraph,executeLowered,generateNumericLibraryWGSL}from'../src/resident-candidate/numeric-program.mjs';
import{sourceNumberReference as N}from'../src/resident-candidate/source-number.mjs';
import Graph from'../src/experimental-arithmetic-graph.js';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{createCueProgramBundle,packCueInitialState,executeCueForTest}from'../src/resident-candidate/cue-orchestration.mjs';
import{COUPLED_BODY_OFFSETS as O}from'../src/resident-candidate/coupled-solver.mjs';
const one=new Uint32Array(1),flt=new Float32Array(one.buffer),number=w=>(one[0]=w,flt[0]),bits=x=>(flt[0]=x,one[0]),SIGN=0x80000000;
const length=n=>n===0n?0:n.toString(2).length;
function decode(w){const e=w>>>23&255;return{sign:w>>>31,m:BigInt(w&0x7fffff)+(e?1n<<23n:0n),scale:e?e-150:-149};}
function compareScaled(n,d,e){return e>=0?(n<<BigInt(e))<d:-1;}
// Independent exact rational -> binary32 RN-even, no JS floating arithmetic.
function roundRational(n,d,scale,sign=0){
 if(n===0n)return(sign?SIGN:0)>>>0;
 let e=length(n)-length(d)+scale;
 const less=(power)=>scale-power>=0?(n<<BigInt(scale-power))<d:n<(d<<BigInt(power-scale));
 if(less(e))e--;while(!less(e+1))e++;
 const step=Math.max(e-23,-149),shift=scale-step,nn=shift>=0?n<<BigInt(shift):n,dd=shift<0?d<<BigInt(-shift):d;
 let q=nn/dd;const rem=nn%dd;if(rem*2n>dd||rem*2n===dd&&(q&1n))q++;
 if(q===0n)return(sign?SIGN:0)>>>0;
 const size=length(q),exponent=size-1+step;if(exponent>127)return((sign?SIGN:0)|0x7f800000)>>>0;
 if(exponent< -126)return((sign?SIGN:0)|Number(q))>>>0;
 if(size>24)q>>=BigInt(size-24);else if(size<24)q<<=BigInt(24-size);
 return((sign?SIGN:0)|((exponent+127)<<23)|Number(q&0x7fffffn))>>>0;
}
function isqrt(n){if(n===0n)return 0n;let x=1n<<BigInt(Math.ceil(length(n)/2));for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function direct(op,aw,bw=0){let a=decode(aw),b=decode(bw);
 if(op==='add'||op==='sub'){if(op==='sub')b={...b,sign:b.sign^1};const scale=Math.min(a.scale,b.scale),x=(a.sign?-a.m:a.m)<<BigInt(a.scale-scale),y=(b.sign?-b.m:b.m)<<BigInt(b.scale-scale),sum=x+y;return roundRational(sum<0n?-sum:sum,1n,scale,sum===0n?(!a.m&&!b.m?a.sign&b.sign:0):+(sum<0n));}
 if(op==='mul')return roundRational(a.m*b.m,1n,a.scale+b.scale,a.sign^b.sign);
 if(op==='div'){if(!b.m)return !a.m?0x7fc00000:((a.sign^b.sign?SIGN:0)|0x7f800000)>>>0;return roundRational(a.m,b.m,a.scale-b.scale,a.sign^b.sign);}
 if(op==='sqrt'){
  if(!a.m)return aw;if(a.sign)return 0x7fc00000;const exponent=Math.floor((length(a.m)-1+a.scale)/2),step=exponent-23,shift=a.scale-2*step;assert.ok(shift>=0);
  const radicand=a.m<<BigInt(shift);let q=isqrt(radicand),mid=2n*q+1n;const cmp=4n*radicand-mid*mid;if(cmp>0n||cmp===0n&&(q&1n))q++;return roundRational(q,1n,step,0);
 }
 throw Error(op);
}
function soft(op,a,b=0){const x=N.fromF32(a),y=N.fromF32(b);return N.toF32(op==='sqrt'?N.sqrt(x):N[op](x,y));}
const boundary=[0,0x80000000,1,2,3,5,0x7fffff,0x800000,0x800001,0x800003,0x807fffff,0x80800000,0x00800001,0x3f000000,0x3f000001,0x3f7fffff,0x3f800000,0x3f800001,0x40000000,0x7f7fffff,0xff7fffff];
test('bounded f32 -> exact binary64 -> f32 division/sqrt agrees with independent exact rational rounding',()=>{
 for(const op of['add','sub','mul','div'])for(const a of boundary)for(const b of boundary){if(op==='div'&&(b&0x7fffffff)===0)continue;assert.equal(soft(op,a,b),direct(op,a,b),op+' '+a.toString(16)+' '+b.toString(16));}
 for(const a of boundary.filter(x=>!(x&SIGN)))assert.equal(soft('sqrt',a),direct('sqrt',a));
 let seed=0x9e30d15a;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
 for(let i=0;i<12000;i++){const a=random(),b=random();if((a&0x7f800000)===0x7f800000||(b&0x7f800000)===0x7f800000)continue;
  for(const op of['add','sub','mul','div'])if(op!=='div'||(b&0x7fffffff)!==0)assert.equal(soft(op,a,b),direct(op,a,b),op+' exact random');
  assert.equal(soft('sqrt',a&0x7fffffff),direct('sqrt',a&0x7fffffff),'sqrt exact random');
 }
 // Exact half-min-subnormal ties, odd/even neighbors, normal/subnormal boundary.
 for(const[a,b,w]of[[1,0x40000000,0],[3,0x40000000,2],[5,0x40000000,2],[0x80000001,0x40000000,0x80000000],[0x00800001,0x40000000,0x00400000],[0x00800003,0x40000000,0x00400002]])assert.equal(soft('div',a,b),w);
});
let actualCue;
async function actualCueGraph(){if(actualCue)return actualCue;const{seed}=await originalRegisteredFixture(),B=createCueProgramBundle(),bodies=seed.balls.map(({state:s})=>{const a=new Uint32Array(64),f=new Float32Array(a.buffer);for(const[k,i]of Object.entries(O))if(s[k]!==undefined)f.set(Array.isArray(s[k])?s[k]:[+s[k]],i);return a;});const app=executeCueForTest(B,packCueInitialState(seed.cueInitial,B),{ball:bodies[seed.selectedIndex],others:bodies.filter((_,i)=>i!==seed.selectedIndex),testOnly:true});return actualCue={plan:B.entries[3].plan,compiled:B.entries[3].compiled,input:new Float32Array(app.state.buffer).slice(64,208)};}
function graphTrace(input,plan,{ftz=false}={}){const values=new Float32Array(input.length+plan.nodes.length);values.set(input);const operations=Object.fromEntries(Graph.OPERATIONS.map(o=>[o.name,o.cpu]));let first=null,count=0;for(const[i,node]of plan.nodes.entries()){const args=node.kind==='const'?node.args:node.args.map(id=>values[id]);let x=Math.fround(operations[node.kind](...args)),w=bits(x);if((w&0x7f800000)===0&&(w&0x7fffffff)!==0){count++;first??={node:i,kind:node.kind,args:args.slice(),word:w};if(ftz&&!['const','choose','min','max','negate','signbitSign'].includes(node.kind))x=number(w&SIGN);}values[input.length+i]=x;}return{output:Float32Array.from(plan.outputs,id=>values[id]),first,count};}
test('actual created cue joint graph proves intermediate underflow requirement, not an output tolerance',async()=>{
 const{plan,input}=await actualCueGraph(),exact=graphTrace(input,plan),flushed=graphTrace(input,plan,{ftz:true}),at=plan.bodyLayout[1]+2;
 assert.equal(exact.first.node,4069);assert.equal(exact.first.kind,'mul');assert.equal(exact.count,1386);assert.equal(exact.first.word,5188916);
 assert.equal(bits(exact.output[at]),68354048);assert.equal(bits(flushed.output[at]),2195062784);
 assert.notDeepEqual(new Uint32Array(exact.output.buffer),new Uint32Array(flushed.output.buffer));
 const code=generateNumericLibraryWGSL({preserveSubnormals:true});assert.match(code,/rc_num_soft_required/);assert.match(code,/rc_num_lt_bits/);assert.doesNotMatch(code,/if \(b==0.0\)/);assert.match(code,/rc_f64_to_f32_bits/);
});
const arity={add:2,sub:2,mul:2,div:2,sqrt:1,min:2,max:2,inv:1,cap:2,choose:3,lt:2,le:2,gt:2,negate:1,signbitSign:1};
function primitiveRows(){const rows=[];for(const op of Object.keys(arity)){for(const[a,b,c]of[[1,2,0x3f800000],[0x80000001,1,0xbf800000],[0x800000,1,0],[0x800001,0x3f000000,0],[3,0x40000000,0],[0x80000001,0x40000000,0],[0,1,0x3f800000],[0x80000000,0x80000001,0],[0x3f800000,0x7f7fffff,0],[0x7fffff,0x800000,0]]){
  if(op==='div'&&(b&0x7fffffff)===0||op==='sqrt'&&(a&SIGN)!==0&&(a&0x7fffffff)!==0||op==='cap'&&(a&0x7fffffff)===0&&number(b)<0)continue;
  const input=Float32Array.of(number(a),number(b),number(c)),plan={inputFloats:3,nodes:[{kind:op,args:Array.from({length:arity[op]},(_,i)=>i)}],outputs:[3]},compiled=compileGraph(plan);
  let expected;try{expected=executeLowered(compiled,input,{testOnly:true});}catch{continue;}rows.push({name:op+' '+a.toString(16)+' '+b.toString(16),input,compiled,expected});
 }}return rows;}
test('actual native preserved-subnormal primitives and actual full cue graph retain strict source bits',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const{createNativeOwner,dispatchWords}=await import('./resident-candidate-gpu-support.mjs');const cue=await actualCueGraph(),rows=primitiveRows();rows.splice(11,0,{name:'original created cue graph',...cue,expected:executeLowered(cue.compiled,cue.input,{testOnly:true})});
 let pn=0,inn=0,sn=0,on=0;const jobs=[];for(const row of rows){row.pb=pn;pn+=row.compiled.program.length;row.ib=inn;inn+=row.input.length;row.sb=sn+1;sn+=row.compiled.scratchWords+2;row.ob=on;on+=row.compiled.outputCount+1;jobs.push(row.pb,row.ib,row.sb,row.ob);}
 const program=new Uint32Array(pn),inputs=new Uint32Array(inn),scratch=new Uint32Array(sn),GUARD=0xfacefeed;for(const row of rows){program.set(row.compiled.program,row.pb);inputs.set(new Uint32Array(row.input.buffer,row.input.byteOffset,row.input.length),row.ib);scratch[row.sb-1]=GUARD;scratch[row.sb+row.compiled.scratchWords]=GUARD;}
 const code=`
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateNumericLibraryWGSL({preserveSubnormals:true})}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/4u){return;}let j=row*4u;let p=rc_jobs[j];let s=rc_jobs[j+2u];let o=rc_jobs[j+3u];for(var i=0u;i<rc_program[p+3u];i++){rc_scratch[s+i]=rc_inputs[rc_jobs[j+1u]+i];}let status=rc_num_eval(p,s);let count=rc_program[p+4u];rc_results[o+count]=status;if(status!=1u){return;}for(var i=0u;i<count;i++){rc_results[o+i]=rc_scratch[s+rc_program[p+rc_program[p+8u]+i]];}}
`;
 const owner=await createNativeOwner('source-preserved-subnormal-numeric');try{const[,,work,,actual]=await dispatchWords(owner,{code,buffers:[{input:program},{input:inputs},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:on,readback:true}],workgroups:Math.ceil(rows.length/32),label:'strict-source-subnormal-cue-and-primitives'});for(const row of rows){assert.equal(actual[row.ob+row.compiled.outputCount],1,row.name+' complete');assert.deepEqual(actual.slice(row.ob,row.ob+row.compiled.outputCount),new Uint32Array(row.expected.buffer,row.expected.byteOffset,row.expected.length),row.name+' raw bits');assert.equal(work[row.sb-1],GUARD);assert.equal(work[row.sb+row.compiled.scratchWords],GUARD);}t.diagnostic(JSON.stringify({gate:'source-preserved-subnormal',rows:rows.length,actualCueNodes:cue.plan.nodes.length,strictBits:true,adapterInfo:owner.adapterInfo}));}finally{owner.release();}
});
