/** MMQ2 original rolling regime endpoint. A stop is not an impulse or REST verdict. */
import {validateMixedMotionV2,runMixedWorldQueryV2CPU,sampleMixedMotionV2CPU,validateMixedWorldQueryV2Input} from './deterministic-mixed-motion-v2.mjs';
import {MIXED_V2_MATH_WGSL,MIXED_V2_QUERY_WGSL} from './deterministic-mixed-motion-v2-gpu.mjs';
import {CONTACT_MATH_WGSL} from './deterministic-contact-math.mjs';
const V=0x53545632,MMQ2=0x4d4d5102,NONE=0xffffffff;
const ints=x=>new Int32Array(x.buffer,x.byteOffset,x.length);
function tasks(rows,scene){const n=rows.length/80,t=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)t.push([1,i,j]);for(let i=0;i<n;i++)for(let j=0;j<scene[1];j++)t.push([j<4?2:3,i,j]);for(let i=0;i<n;i++)t.push([4,i,0],[5,i,0]);const base=t.length;for(let i=0;i<n;i++)if(rows[i*80+1]===3)t.push([6,i,0],[6,i,1]);return{t,base};}
export function proveWorldRollingStopV2CPU(current,rows,query,scene,context){
 const state=current.state??current,n=state[3],H=state[4],proof=new Uint32Array(32);proof.set([V,6,0,NONE,0,1,state[5],state[5],n,H]);const fail=why=>{proof[5]=why;return proof;};
 if(state.length!==256||context.length!==160||rows.length!==n*80||n<3||n>4||H<1||H>65535||!(state[1]===1||state[1]===7&&(state[2]===6||state[2]===7))||state[6]!==NONE||state[8]!==state[5]||state[40]!==0||context[13]!==1||state[56]>=0x7fffffff||scene[1]<4||scene[1]>20||scene[3]!==context[8]||[0,1,2,3].some(i=>scene[4+i]!==context[9+i]))return fail(1);
 try{validateMixedMotionV2(rows);}catch{return fail(1);}const r=ints(rows),s=ints(state),c=ints(context);for(let i=0;i<n;i++){const a=64+48*i,b=80*i;if(rows[b]!==MMQ2||rows[b+1]!==state[a+40]||rows[b+1]>3||rows[b+2]!==H||rows[b+3]!==state[a]||rows[b+4]!==state[a+22]||rows[b+5]!==1||rows[b+6]!==state[5]||rows[b+7]!==i||rows[b+17]!==state[a+23]||rows[b+48]!==context[4]||rows[b+49]!==context[8]||rows[b+50]!==context[7]||r.slice(b+8,b+17).some((x,k)=>x!==s[a+24+k]))return fail(1);if(rows[b+1]===3&&(r[b+24]!==c[6]||r[b+25]||r[b+26]||r[b+27]||r[b+28]||[c[16],c[17],Math.min(c[18],c[19]),Math.min(c[20],c[21]),c[22]].some((x,k)=>x!==r[b+29+k])||2*c[6]>7*c[5]))return fail(1);}
 const{t,base}=tasks(rows,scene);if(query.length!==1056||query[0]!==MMQ2||query[1]!==6||query[2]!==H||query[8]!==t.length||query[9]!==base||t.length>128)return fail(2);
 let selected=NONE,firstStop=NONE,minPrefix=H,nodeSum=0;for(let k=0;k<t.length;k++){const z=32+8*k,[kind,i,j]=t[k],status=query[z+3],lo=query[z+4],hi=query[z+5],prefix=query[z+7];if(t[k].some((x,j)=>query[z+j]!==x)||![2,4,5,6].includes(status)||lo>hi||hi>H||prefix>lo)return fail(2);if(status===2&&(lo!==H||hi!==H||prefix!==H))return fail(2);if(query[z+6]>32768||nodeSum>32768-query[z+6])return fail(2);nodeSum+=query[z+6];minPrefix=Math.min(minPrefix,prefix);if(status!==2&&(selected===NONE||lo<query[32+8*selected+4]))selected=k;
  if(kind===6){const b=80*i,l=rows[b+72+2*j],u=rows[b+73+2*j],active=l!==NONE&&u>0&&l<=H,expected=active?6:2;if(status!==expected||lo!==(active?l:H)||hi!==(active?Math.min(u,H):H)||prefix!==(active?l:H)||query[z+6]!==0)return fail(2);if(active&&(firstStop===NONE||l<query[32+8*firstStop+4]))firstStop=k;}
 }
 if(selected===NONE||query[4]!==selected||query[10]!==firstStop||query[5]!==query[32+8*selected+4]||query[6]!==query[32+8*selected+5]||query[7]!==nodeSum||query[11]!==minPrefix||t[selected][0]!==6)return fail(3);
 const[_,body,sub]=t[selected],h=rows[body*80+73+2*sub];if(h<1||h>H||h===NONE||state[5]>0x7fffffff-h||state[5]+h>context[24])return fail(6);let count=0,mask=0;
 for(let k=0;k<t.length;k++){const z=32+8*k,[kind,i,j]=t[k];if(kind!==6){if(query[z+3]!==2&&(query[z+3]!==6||query[z+4]<=h||query[z+7]<h))return fail(4);}else if(query[z+3]!==2&&query[z+4]<=h){if(rows[i*80+73+2*j]>h)return fail(5);count++;mask|=1<<(2*i+j);}}
 proof.set([V,1,h,selected,count,0,state[5],state[5]+h,n,H,mask]);return proof;
}
export function commitWorldRollingStopV2CPU(current,rows,query,scene,context){const proof=proveWorldRollingStopV2CPU(current,rows,query,scene,context),state=current.state.slice(),dense=current.dense.slice(),samples=new Uint32Array(512);const done=committed=>({state,dense,proof,samples,committed,kind:'rolling-stop-v2',globalReceiptCertified:false});if(proof[1]!==1)return done(false);for(let i=0;i<state[3];i++)samples.set(sampleMixedMotionV2CPU(rows,i,proof[2]),i*128);if(Array.from({length:state[3]},(_,i)=>samples[i*128+1]).some(x=>x!==1))return done(false);const p=ints(samples),s=ints(state),d=ints(dense),r=ints(rows),c=ints(context);for(let i=0;i<state[3];i++)if(p[i*128+65]<c[8]+s[64+i*48+22])return done(false);
 dense.fill(0);state[4]=proof[2];state[5]=proof[7];state[8]=state[5];state[1]=1;state[2]=0;state[6]=NONE;state[7]=0;state[40]=0;state[56]++;state[60]=0;
 for(let i=0;i<state[3];i++){const a=64+i*48,b=i*80,k=i*64,z=i*128;s.set(p.slice(z+64,z+73),a+24);s.fill(0,a+9,a+15);state[a+39]=1;let mode=rows[b+1];if(mode===3)mode=samples[z+88];else if(mode!==2){mode=p[z+67]||p[z+69]||p[z+70]||p[z+72]?1:0;if(mode===1&&p[z+70]===p[z+69]&&p[z+72]===-p[z+67]&&2*c[6]<=7*c[5])mode=3;}state[a+40]=mode;state[7]|=mode<<(2*i);d[k]=mode;d[k+1]=s[a+22];for(let j=0;j<3;j++){d[k+4+j]=d[k+16+j]=p[z+64+j];d[k+20+j]=d[k+48+j]=p[z+67+j];d[k+24+j]=p[z+70+j];d[k+28+j]=Math.max(p[z+64+j]-p[z+32+2*j],p[z+33+2*j]-p[z+64+j]);d[k+32+j]=Math.max(p[z+67+j]-p[z+40+2*j],p[z+41+2*j]-p[z+67+j]);}d[k+36]=rows[b+1]===3?p[z+84]:r[b+44];d[k+37]=rows[b+1]===3?p[z+86]:r[b+46];d[k+38]=rows[b+1]===3?p[z+85]:r[b+45];d[k+40]=rows[b+1]===3?p[z+87]:r[b+47];d[k+41]=1;}
 return done(true);
}
export function runWorldRollingStopV2CPU(current,rows,scene,context,options={}){const query=runMixedWorldQueryV2CPU(rows,scene,options).output;return{...commitWorldRollingStopV2CPU(current,rows,query,scene,context),query};}
export const WORLD_ROLLING_STOP_V2_PROOF_WGSL=`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read> rows:array<u32>;
@group(0) @binding(2) var<storage,read> query:array<u32>;
@group(0) @binding(3) var<storage,read> scene:array<u32>;
@group(0) @binding(4) var<storage,read> ctx:array<u32>;
@group(0) @binding(5) var<storage,read_write> proof:array<u32>;
${CONTACT_MATH_WGSL}
fn ms(i:u32)->i32{return bitcast<i32>(rows[i]);}
// Exact original rolling-bounds cache arithmetic; endpoint sampling is a separate stage.
fn stopBracket(value:u32,den:u32)->vec2<u32>{var result=vec2<u32>(0xffffffffu);if(value==0u){return vec2<u32>(0u);}if(den!=0u){let w=wide(value,1048576u);let r=divideWide(w.x,w.y,den);if(r.z!=0u&&r.x<=67108864u){result.x=r.x;let hi=r.x+select(0u,1u,r.y!=0u);if(hi<=67108864u){result.y=hi;}}}return result;}

fn fail(why:u32){proof[5]=why;}
@compute @workgroup_size(1) fn main(){for(var j=0u;j<32u;j++){proof[j]=0u;}let n=source[3];let H=source[4];proof[0]=0x53545632u;proof[1]=6u;proof[3]=0xffffffffu;proof[5]=1u;proof[6]=source[5];proof[7]=source[5];proof[8]=n;proof[9]=H;
if(n<3u||n>4u||H<1u||H>65535u||arrayLength(&rows)!=n*80u||!(source[1]==1u||(source[1]==7u&&(source[2]==6u||source[2]==7u)))||source[6]!=0xffffffffu||source[8]!=source[5]||source[40]!=0u||ctx[13]!=1u||source[56]>=2147483647u||scene[1]<4u||scene[1]>20u||scene[3]!=ctx[8]){return;}
// Accumulate source predicates without nested exits around checked arithmetic.
// All invalid source cases retain the original default failure receipt (reason 1).
var sourceValid=true;
for(var j=0u;j<4u;j++){sourceValid=sourceValid & (scene[4u+j]==ctx[9u+j]);}
for(var i=0u;i<n;i++){
 let a=64u+48u*i;let b=80u*i;
 sourceValid=sourceValid & (rows[b]==0x4d4d5102u);
 sourceValid=sourceValid & (rows[b+1u]==source[a+40u]);
 sourceValid=sourceValid & (rows[b+1u]<=3u);
 sourceValid=sourceValid & (rows[b+2u]==H);
 sourceValid=sourceValid & (rows[b+3u]==source[a]);
 sourceValid=sourceValid & (rows[b+4u]==source[a+22u]);
 sourceValid=sourceValid & (rows[b+5u]==1u);
 sourceValid=sourceValid & (rows[b+6u]==source[5]);
 sourceValid=sourceValid & (rows[b+7u]==i);
 sourceValid=sourceValid & (rows[b+17u]==source[a+23u]);
 sourceValid=sourceValid & (rows[b+48u]==ctx[4]);
 sourceValid=sourceValid & (rows[b+49u]==ctx[8]);
 sourceValid=sourceValid & (rows[b+50u]==ctx[7]);
 for(var j=0u;j<9u;j++){sourceValid=sourceValid & (rows[b+8u+j]==source[a+24u+j]);}
 if(rows[b+1u]==3u){
  sourceValid=sourceValid & (rows[b+24u]==ctx[6]);
  sourceValid=sourceValid & (rows[b+25u]==0u);
  sourceValid=sourceValid & (rows[b+26u]==0u);
  sourceValid=sourceValid & (rows[b+27u]==0u);
  sourceValid=sourceValid & (rows[b+28u]==0u);
  sourceValid=sourceValid & (2u*ctx[6]<=7u*ctx[5]);
  sourceValid=sourceValid & (rows[b+34u]==0x52545001u);
  let budgets=array<u32,5>(ctx[16],ctx[17],min(ctx[18],ctx[19]),min(ctx[20],ctx[21]),ctx[22]);
  for(var j=0u;j<5u;j++){sourceValid=sourceValid & (rows[b+29u+j]==budgets[j]);}
  for(var j=35u;j<48u;j++){sourceValid=sourceValid & (rows[b+j]==0u);}
  for(var j=51u;j<64u;j++){sourceValid=sourceValid & (rows[b+j]==0u);}
  for(var j=76u;j<80u;j++){sourceValid=sourceValid & (rows[b+j]==0u);}
  sourceValid=sourceValid & (ms(b+9u)==ms(b+49u)+ms(b+4u));
  sourceValid=sourceValid & (ms(b+12u)==0);
  sourceValid=sourceValid & (ms(b+14u)==ms(b+13u));
  sourceValid=sourceValid & (ms(b+16u)== -ms(b+11u));
 }
}
if(!sourceValid){return;}
// Keep exact original cache arithmetic, but carry its verdict out of the loop.
var cacheValid=true;
for(var i=0u;i<n;i++){
 let b=80u*i;
 if(rows[b+1u]==3u){
  bad=false;
  let nh=norm(vec3<i32>(ms(b+11u),ms(b+13u),0));
  let nl=nh-select(1,0,equalSquare(vec3<i32>(ms(b+11u),ms(b+13u),0),nh));
  var translation=stopBracket(u32(7*nh),2u*rows[b+24u]);
  if(nh!=0&&rows[b+24u]!=0u){let w=wide(u32(7*nl),1048576u);let result=divideWide(w.x,w.y,2u*rows[b+24u]);translation.x=0xffffffffu;if(result.z!=0u&&result.x<=67108864u){translation.x=result.x;}}
  let spin=stopBracket(u32(abs(ms(b+15u))),rows[b+50u]);
  cacheValid=cacheValid & !bad;
  let cache=array<u32,12>(rows[b+4u],rows[b+24u],rows[b+8u],rows[b+10u],rows[b+11u],rows[b+13u],u32(nl),u32(nh),translation.x,translation.y,spin.x,spin.y);
  for(var j=0u;j<12u;j++){cacheValid=cacheValid & (rows[b+64u+j]==cache[j]);}
 }
}
if(!cacheValid){return;}
var task:array<vec3<u32>,128>;var count=0u;for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){task[count]=vec3<u32>(1u,i,j);count++;}}for(var i=0u;i<n;i++){for(var j=0u;j<scene[1];j++){task[count]=vec3<u32>(select(3u,2u,j<4u),i,j);count++;}}for(var i=0u;i<n;i++){task[count]=vec3<u32>(4u,i,0u);task[count+1u]=vec3<u32>(5u,i,0u);count+=2u;}let base=count;for(var i=0u;i<n;i++){if(rows[i*80u+1u]==3u){task[count]=vec3<u32>(6u,i,0u);task[count+1u]=vec3<u32>(6u,i,1u);count+=2u;}}
if(arrayLength(&query)!=1056u||query[0]!=0x4d4d5102u||query[1]!=6u||query[2]!=H||query[8]!=count||query[9]!=base||count>128u){fail(2u);return;}
var selected=0xffffffffu;var firstStop=0xffffffffu;var prefix=H;var nodes=0u;for(var k=0u;k<count;k++){let z=32u+8u*k;let t=task[k];let status=query[z+3u];let lo=query[z+4u];let hi=query[z+5u];let p=query[z+7u];if(query[z]!=t.x||query[z+1u]!=t.y||query[z+2u]!=t.z||(status!=2u&&status!=4u&&status!=5u&&status!=6u)||lo>hi||hi>H||p>lo||(status==2u&&(lo!=H||hi!=H||p!=H))){fail(2u);return;}if(query[z+6u]>32768u||nodes>32768u-query[z+6u]){fail(2u);return;}nodes+=query[z+6u];prefix=min(prefix,p);if(status!=2u&&(selected==0xffffffffu||lo<query[32u+8u*selected+4u])){selected=k;}if(t.x==6u){let b=80u*t.y;let l=rows[b+72u+2u*t.z];let u=rows[b+73u+2u*t.z];let boundaryActive=l!=0xffffffffu&&u>0u&&l<=H;if(status!=select(2u,6u,boundaryActive)||lo!=select(H,l,boundaryActive)||hi!=select(H,min(u,H),boundaryActive)||p!=select(H,l,boundaryActive)||query[z+6u]!=0u){fail(2u);return;}if(boundaryActive&&(firstStop==0xffffffffu||l<query[32u+8u*firstStop+4u])){firstStop=k;}}}
if(selected==0xffffffffu||query[4]!=selected||query[10]!=firstStop||query[5]!=query[32u+8u*selected+4u]||query[6]!=query[32u+8u*selected+5u]||query[7]!=nodes||query[11]!=prefix||task[selected].x!=6u){fail(3u);return;}
let chosen=task[selected];let h=rows[chosen.y*80u+73u+2u*chosen.z];if(h<1u||h>H||h==0xffffffffu||source[5]>2147483647u-h||source[5]+h>ctx[24]){fail(6u);return;}var grouped=0u;var mask=0u;for(var k=0u;k<count;k++){let z=32u+8u*k;let t=task[k];if(t.x!=6u){if(query[z+3u]!=2u&&(query[z+3u]!=6u||query[z+4u]<=h||query[z+7u]<h)){fail(4u);return;}}else if(query[z+3u]!=2u&&query[z+4u]<=h){if(rows[t.y*80u+73u+2u*t.z]>h){fail(5u);return;}grouped++;mask|=1u<<(2u*t.y+t.z);}}
proof[1]=1u;proof[2]=h;proof[3]=selected;proof[4]=grouped;proof[5]=0u;proof[7]=source[5]+h;proof[10]=mask;}
`;
export const WORLD_ROLLING_STOP_V2_SAMPLE_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> proof:array<u32>;
@group(0) @binding(2) var<storage,read_write> samples:array<u32>;
${MIXED_V2_MATH_WGSL}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i>=4u){return;}for(var j=0u;j<128u;j++){samples[i*128u+j]=0u;}if(proof[0]!=0x53545632u||proof[1]!=1u||i>=proof[8]||proof[2]==0u||proof[2]>rows[2]){return;}bad=false;let result=sampleV2(i,proof[2]);for(var j=0u;j<128u;j++){samples[i*128u+j]=result[j];}}
`;
export const WORLD_ROLLING_STOP_V2_COMMIT_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> samples:array<u32>;
@group(0) @binding(2) var<storage,read> source:array<u32>;
@group(0) @binding(3) var<storage,read> oldDense:array<u32>;
@group(0) @binding(4) var<storage,read> proof:array<u32>;
@group(0) @binding(5) var<storage,read> ctx:array<u32>;
@group(0) @binding(6) var<storage,read_write> state:array<u32>;
@group(0) @binding(7) var<storage,read_write> dense:array<u32>;
fn sampleI(i:u32)->i32{return bitcast<i32>(samples[i]);}
@compute @workgroup_size(1) fn main(){for(var j=0u;j<256u;j++){state[j]=source[j];dense[j]=oldDense[j];}if(proof[0]!=0x53545632u||proof[1]!=1u||proof[2]==0u||proof[6]!=source[5]||proof[7]!=source[5]+proof[2]||proof[7]>ctx[24]||proof[8]!=source[3]){return;}for(var i=0u;i<source[3];i++){let z=i*128u;if(samples[z+1u]!=1u||samples[z+3u]!=source[64u+48u*i]||samples[z+4u]!=proof[2]||sampleI(z+65u)<bitcast<i32>(ctx[8])+bitcast<i32>(source[64u+48u*i+22u])){return;}}
for(var j=0u;j<256u;j++){dense[j]=0u;}state[4]=proof[2];state[5]=proof[7];state[8]=state[5];state[1]=1u;state[2]=0u;state[6]=0xffffffffu;state[7]=0u;state[40]=0u;state[56]++;state[60]=0u;
for(var i=0u;i<state[3];i++){let a=64u+i*48u;let b=i*80u;let k=i*64u;let z=i*128u;for(var j=0u;j<9u;j++){state[a+24u+j]=samples[z+64u+j];}for(var j=9u;j<15u;j++){state[a+j]=0u;}state[a+39u]=1u;var mode=rows[b+1u];if(mode==3u){mode=samples[z+88u];}else if(mode!=2u){mode=select(0u,1u,sampleI(z+67u)!=0||sampleI(z+69u)!=0||sampleI(z+70u)!=0||sampleI(z+72u)!=0);if(mode==1u&&sampleI(z+70u)==sampleI(z+69u)&&sampleI(z+72u)== -sampleI(z+67u)&&2u*ctx[6]<=7u*ctx[5]){mode=3u;}}state[a+40u]=mode;state[7]|=mode<<(2u*i);dense[k]=mode;dense[k+1u]=state[a+22u];for(var j=0u;j<3u;j++){dense[k+4u+j]=samples[z+64u+j];dense[k+16u+j]=samples[z+64u+j];dense[k+20u+j]=samples[z+67u+j];dense[k+48u+j]=samples[z+67u+j];dense[k+24u+j]=samples[z+70u+j];dense[k+28u+j]=u32(max(sampleI(z+64u+j)-sampleI(z+32u+2u*j),sampleI(z+33u+2u*j)-sampleI(z+64u+j)));dense[k+32u+j]=u32(max(sampleI(z+67u+j)-sampleI(z+40u+2u*j),sampleI(z+41u+2u*j)-sampleI(z+67u+j)));}dense[k+36u]=select(rows[b+44u],samples[z+84u],rows[b+1u]==3u);dense[k+37u]=select(rows[b+46u],samples[z+86u],rows[b+1u]==3u);dense[k+38u]=select(rows[b+45u],samples[z+85u],rows[b+1u]==3u);dense[k+40u]=select(rows[b+47u],samples[z+87u],rows[b+1u]==3u);dense[k+41u]=1u;}}
`;
/** Resident encode stages: 0 original query, 1 source/stop proof, 2 original samples (4 groups), 3 endpoint commit. */
export async function createWorldRollingStopV2GPU(device){const start=performance.now(),codes=[MIXED_V2_QUERY_WGSL,WORLD_ROLLING_STOP_V2_PROOF_WGSL,WORLD_ROLLING_STOP_V2_SAMPLE_WGSL,WORLD_ROLLING_STOP_V2_COMMIT_WGSL],pipelines=[];for(const code of codes){const module=device.createShaderModule({code}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}const encode=(e,index,buffers,count=index===2?4:1)=>{const p=pipelines[index],g=device.createBindGroup({layout:p.getBindGroupLayout(0),entries:buffers.map((b,binding)=>({binding,resource:b.buffer?b:{buffer:b}}))}),pass=e.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,g);pass.dispatchWorkgroups(count);pass.end();};return{compileMs:performance.now()-start,encode,async run(current,rows,scene,context,options={}){const{h,cap}=validateMixedWorldQueryV2Input(rows,scene,options),owned=[],alloc=(x,usage=128|4|8)=>{const b=device.createBuffer({size:typeof x==='number'?x:x.byteLength,usage});owned.push(b);if(typeof x!=='number')device.queue.writeBuffer(b,0,x);return b;};try{const r=alloc(rows),sc=alloc(scene),ctx=alloc(context),source=alloc(current.state),oldDense=alloc(current.dense),config=alloc(new Uint32Array([h,cap])),query=alloc(4224),proof=alloc(128),samples=alloc(2048),state=alloc(1024),dense=alloc(1024),read=alloc(2112*4,1|8),e=device.createCommandEncoder();if(options.query)device.queue.writeBuffer(query,0,options.query);else encode(e,0,[r,sc,config,query]);encode(e,1,[source,r,query,sc,ctx,proof]);encode(e,2,[r,proof,samples]);encode(e,3,[r,samples,source,oldDense,proof,ctx,state,dense]);let at=0;for(const b of[query,proof,samples,state,dense]){e.copyBufferToBuffer(b,0,read,at,b.size);at+=b.size;}device.queue.submit([e.finish()]);await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();return{query:words.slice(0,1056),proof:words.slice(1056,1088),samples:words.slice(1088,1600),state:words.slice(1600,1856),dense:words.slice(1856),words,metrics:{dispatches:options.query?3:4,intermediateReadbacks:0}};}finally{owned.forEach(b=>b.destroy());}}};}
