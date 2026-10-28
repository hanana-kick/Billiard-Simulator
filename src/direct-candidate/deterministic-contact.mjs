/** Prepared isolated pair + flat cloth instantaneous impact, XY / omegaZ only.
 * Q24 normalized impulses J/m and c=-R*omegaZ. One common pair point and real
 * centered cloth arms; no position projection or finite-time resistance step.
 * Numerical convergence is NOT shot/physical acceptance.
 *64-word row: header0..3; R,xA,xB,y,pairX,clothY,e,muPair,muCloth,
 * overlap at4..13; time bracket14..15; vxA,vyA,cA,vxB,vyB,cB,mass16..22.
 * Output: id/status/reason/iterations; NO_PASS23; residual24; six accumulated
 * impulses25..30; liftoff mask31; arm ratios/Ks/bounce32..37; work38..39.
 * Status1 means numerical convergence only,4 unsupported,5 incomplete.
 * Remaining words reservedzero. Material coefficients are already combined.
 */
import {multiplyWide} from './deterministic-axial.mjs';
const Q=2**24,NONE=0xffffffff,STATE_LIMIT=16*Q,IMPULSE_LIMIT=32*Q;
export function divideWide(lo,hi,denominator){
 if(![lo,hi].every(x=>Number.isInteger(x)&&x>=0&&x<=NONE)||!Number.isInteger(denominator)||denominator<=0||denominator>NONE||hi>=denominator)return {valid:false,quotient:0,remainder:0};
 let remainder=hi>>>0,quotient=0;
 for(let bit=31;bit>=0;bit--){const carry=remainder>>>31;remainder=((remainder<<1)|((lo>>>bit)&1))>>>0;
  if(carry||remainder>=denominator){remainder=(remainder-denominator)>>>0;quotient=(quotient|(1<<bit))>>>0;}}
 return {valid:true,quotient,remainder};
}
function arithmetic(){
 const ctx={invalid:false,divisions:0,multiplications:0};
 ctx.mul=(a,b)=>{ctx.multiplications++;const [lo,hi]=multiplyWide(Math.abs(a),Math.abs(b));
  if(hi>=0x800000){ctx.invalid=true;return 0;}let q=((hi<<8)|(lo>>>24))>>>0;if((lo&0xffffff)>=0x800000)q++;
  if(q>0x7fffffff){ctx.invalid=true;return 0;}return (a<0)!==(b<0)?-q:q;};
 ctx.cone=(a,b)=>{ctx.multiplications++;const [lo,hi]=multiplyWide(a,b);return ((hi<<8)|(lo>>>24))>>>0;};
 ctx.div=(a,b)=>{ctx.divisions++;if(b<=0||a===-2147483648){ctx.invalid=true;return 0;}
  const [lo,hi]=multiplyWide(Math.abs(a),Q),d=divideWide(lo,hi,b);if(!d.valid){ctx.invalid=true;return 0;}
  const q=d.quotient+(d.remainder>=Math.ceil(b/2)?1:0);if(q>0x7fffffff){ctx.invalid=true;return 0;}return a<0?-q:q;};
 return ctx;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function packPairClothContacts(cases){
 if(!Array.isArray(cases)||!cases.length||cases.length>4096)throw RangeError('1..4096 contact candidates');
 const rows=new Uint32Array(cases.length*64),signed=new Int32Array(rows.buffer),ids=new Set(),provenance=[];
 for(let k=0;k<cases.length;k++){
  const c=cases[k],a=c.bodies?.[0],b=c.bodies?.[1],base=k*64;
  if(!Number.isInteger(c.id)||c.id<0||c.id>NONE||ids.has(c.id)||c.bodies?.length!==2)throw RangeError('Contact identity/pair');ids.add(c.id);
  if(c.provenance!=='prepared-isolated-pair-and-cloth'||!a||!b||a.mass!==b.mass||a.radius!==b.radius||a.y!==b.y||a.x>=b.x||[a,b].some(x=>x.vy!==0||x.omegaX!==0||x.omegaY!==0))throw RangeError('Unsupported contact mode');
  if(![a.x,b.x,a.y,a.radius,a.mass,a.vx,b.vx,a.vy,b.vy,a.omegaZ,b.omegaZ,c.restitution,c.pairFriction,c.clothFriction,c.overlapBudget].every(Number.isFinite)||a.radius<=0||a.mass<=0||c.overlapBudget<0||![c.restitution,c.pairFriction,c.clothFriction].every(x=>x>=0&&x<=1))throw RangeError('Finite physical material/state');
  const pairOverlap=2*a.radius-(b.x-a.x),clothOverlap=a.radius-a.y;
  if(pairOverlap<0||pairOverlap>c.overlapBudget||clothOverlap<0||clothOverlap>c.overlapBudget||a.y<=a.radius/2)throw RangeError('Contact gap/overlap outside declared budget');
  const iterations=c.maxIterations??64,residual=c.residualBudgetQuanta??16;
  if(!Number.isInteger(iterations)||iterations<1||iterations>128||!Number.isInteger(residual)||residual<1||residual>256)throw RangeError('Explicit bounded solver budget');
  const values=[a.radius,a.x,b.x,a.y,c.restitution,c.pairFriction,c.clothFriction,c.overlapBudget,a.vx,a.vy,-a.radius*a.omegaZ,b.vx,b.vy,-b.radius*b.omegaZ,a.mass].map(x=>Math.round(x*Q));
  if(values.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>STATE_LIMIT)||values[0]<=0||values[14]<=0)throw RangeError('Contact integer domain');
  const [r,xa,xb,y,e,muP,muC,overlap,vxa,vya,ca,vxb,vyb,cb,mass]=values;
  // Deterministic common points from encoded geometry; never move sphere centers.
  const cx=xa+Math.floor((xb-xa)/2),cy=Math.floor((y-r)/2);
  rows.set([c.id,iterations,residual,1],base);signed.set([r,xa,xb,y,cx,cy,e,muP,muC,overlap],base+4);
  const times=c.timeBracket??[0,0];
  if(!Array.isArray(times)||times.length!==2||!times.every(x=>Number.isInteger(x)&&x>=0&&x<=NONE)||times[0]>times[1]||times[1]-times[0]>1)throw RangeError('At most one encoded time tick');
  rows.set(times,base+14);
  signed.set([vxa,vya,ca,vxb,vyb,cb,mass],base+16);
  provenance.push({id:c.id,physicalAcceptance:false,positionProjection:false,contactPointPolicy:'encoded midpoint of closest feature points',pairOverlap,clothOverlap,coefficientQuantum:1/Q,instantaneousImpact:true,finiteTimeResistanceIncluded:false});
 }return {rows,provenance};
}
export function validateContactRows(rows){if(!(rows instanceof Uint32Array)||!rows.length||rows.length%64||rows.length/64>4096)throw TypeError('Complete64-word contact rows');}
function normalResidual(impulse,gapVelocity){return impulse>0?Math.abs(gapVelocity):Math.max(0,-gapVelocity);}
function tangentResidual(impulse,limit,slip){
 if(limit===0)return Math.abs(impulse);
 return Math.max(0,Math.abs(impulse)-limit,impulse>=limit?slip:impulse<=-limit?-slip:Math.abs(slip));
}
export function runPairClothCPU(rows){
 validateContactRows(rows);const output=rows.slice(),s=new Int32Array(rows.buffer,rows.byteOffset,rows.length),out=new Int32Array(output.buffer);
 for(let b=0;b<rows.length;b+=64){
  const calc=arithmetic(),v=Array.from(s.slice(b+16,b+22)),p=[0,0,0,0,0,0];
  const [r,xa,xb,y,cx,cy,e,muP,muC,overlap]=Array.from(s.slice(b+4,b+14)),max=rows[b+1],tolerance=rows[b+2];
  let status=5,reason=2,iterations=0,residual=NONE;
  let invalid=max<1||max>128||tolerance<1||tolerance>256||rows[b+3]!==1||r<4096||s[b+22]<=0||xa>=xb||cx!==xa+Math.floor((xb-xa)/2)||cy!==Math.floor((y-r)/2)||y<=0||y>r||2*y<=r||cy>0||cy<y-r||2*r-(xb-xa)<0||2*r-(xb-xa)>overlap||r-y>overlap||overlap<0||e<0||e>Q||muP<0||muP>Q||muC<0||muC>Q||rows[b+14]>rows[b+15]||rows[b+15]-rows[b+14]>1||v[1]!==0||v[4]!==0;
  for(let j=4;j<14;j++)if(Math.abs(s[b+j])>STATE_LIMIT)invalid=true;
  for(let j=16;j<23;j++)if(Math.abs(s[b+j])>STATE_LIMIT)invalid=true;
  for(let j=23;j<64;j++)if(rows[b+j]!==0)invalid=true;
  let sa=0,sb=0,sc=0,ka=0,kb=0,kc=0,kt=0,kfloor=0,bounce=0;
  if(invalid){status=4;reason=1;}
  else{
   sa=calc.div(cx-xa,r);sb=calc.div(xb-cx,r);sc=calc.div(y-cy,r);
   ka=calc.mul(5*Q/2,sa);kb=calc.mul(5*Q/2,sb);kc=calc.mul(5*Q/2,sc);
   kt=2*Q+calc.mul(ka,sa)+calc.mul(kb,sb);kfloor=Q+calc.mul(kc,sc);
   bounce=-calc.mul(e,Math.min(v[3]-v[0],0));
   const good=()=>!calc.invalid&&v.every(x=>Math.abs(x)<=STATE_LIMIT)&&p.every(x=>Math.abs(x)<=IMPULSE_LIMIT);
   solve: for(let iteration=0;iteration<max;iteration++){
    iterations++;
    let next=Math.max(0,p[0]+calc.div(bounce-(v[3]-v[0]),2*Q)),delta=next-p[0];p[0]=next;if(!good()){status=4;reason=3;break;}v[0]-=delta;v[3]+=delta;
    if(!good()){status=4;reason=3;break;}
    let slip=v[4]-v[1]+calc.mul(sa,v[2])+calc.mul(sb,v[5]),limit=calc.cone(muP,p[0]);
    next=clamp(p[1]+calc.div(-slip,kt),-limit,limit);delta=next-p[1];p[1]=next;v[1]-=delta;v[4]+=delta;v[2]+=calc.mul(ka,delta);v[5]+=calc.mul(kb,delta);
    if(!good()){status=4;reason=3;break;}
    for(let i=0;i<2;i++){
     const at=i*3,pi=2+i*2;next=Math.max(0,p[pi]-v[at+1]);delta=next-p[pi];p[pi]=next;if(!good()){status=4;reason=3;break solve;}v[at+1]+=delta;
     if(!good()){status=4;reason=3;break solve;}
     slip=v[at]-calc.mul(sc,v[at+2]);limit=calc.cone(muC,p[pi]);next=clamp(p[pi+1]+calc.div(-slip,kfloor),-limit,limit);delta=next-p[pi+1];p[pi+1]=next;v[at]+=delta;v[at+2]-=calc.mul(kc,delta);
     if(!good()){status=4;reason=3;break solve;}
    }
    if(calc.invalid||v.some(x=>Math.abs(x)>STATE_LIMIT)||p.some(x=>Math.abs(x)>IMPULSE_LIMIT)){status=4;reason=3;break;}
    residual=Math.max(normalResidual(p[0],v[3]-v[0]-bounce),normalResidual(p[2],v[1]),normalResidual(p[4],v[4]),
     tangentResidual(p[1],calc.cone(muP,p[0]),v[4]-v[1]+calc.mul(sa,v[2])+calc.mul(sb,v[5])),
     tangentResidual(p[3],calc.cone(muC,p[2]),v[0]-calc.mul(sc,v[2])),tangentResidual(p[5],calc.cone(muC,p[4]),v[3]-calc.mul(sc,v[5])));
    if(calc.invalid){status=4;reason=3;break;}
    if(residual<=tolerance){status=1;reason=0;break;}
   }
  }
  output.set([rows[b],status,reason,iterations],b);out.set(v,b+16);output[b+23]=NONE;output[b+24]=residual;out.set(p,b+25);
  output[b+31]=(v[1]>tolerance&&p[2]===0?1:0)|(v[4]>tolerance&&p[4]===0?2:0);
  out.set([sa,sb,sc,kt,kfloor,bounce],b+32);output[b+38]=calc.divisions;output[b+39]=calc.multiplications;
 }return output;
}
export const CONTACT_DIVISION_WGSL=`
fn wide(a:u32,b:u32)->vec2<u32>{let a0=a&65535u;let a1=a>>16u;let b0=b&65535u;let b1=b>>16u;let w0=a0*b0;let t=a1*b0+(w0>>16u);let w1=a0*b1+(t&65535u);return vec2<u32>((w1<<16u)+(w0&65535u),a1*b1+(t>>16u)+(w1>>16u));}
fn divideWide(lo:u32,hi:u32,d:u32)->vec3<u32>{
 if(d==0u||hi>=d){return vec3<u32>(0u);}var rem=hi;var quotient=0u;
 for(var bit=31i;bit>=0;bit--){let carry=rem>>31u;rem=(rem<<1u)|((lo>>u32(bit))&1u);if(carry!=0u||rem>=d){rem-=d;quotient|=1u<<u32(bit);}}
 return vec3<u32>(quotient,rem,1u);
}
`;
export const CONTACT_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read_write> output:array<u32>;
var<private> numeric:bool;var<private> divisions:u32;var<private> multiplications:u32;
var<private> v:array<i32,6>;var<private> p:array<i32,6>;
const Q:i32=16777216;
${CONTACT_DIVISION_WGSL}
fn mul(a:i32,b:i32)->i32{
 multiplications++;let w=wide(u32(abs(a)),u32(abs(b)));if(w.y>=0x800000u){numeric=true;return 0;}
 var q=(w.y<<8u)|(w.x>>24u);if((w.x&0xffffffu)>=0x800000u){q++;}if(q>0x7fffffffu){numeric=true;return 0;}
 return select(i32(q),-i32(q),(a<0)!=(b<0));
}
fn cone(a:i32,b:i32)->i32{multiplications++;let w=wide(u32(a),u32(b));return i32((w.y<<8u)|(w.x>>24u));}
fn divide(a:i32,b:i32)->i32{
 divisions++;if(b<=0||a==bitcast<i32>(0x80000000u)){numeric=true;return 0;}
 let w=wide(u32(abs(a)),16777216u);let d=divideWide(w.x,w.y,u32(b));if(d.z==0u){numeric=true;return 0;}
 if(d.x>0x7fffffffu){numeric=true;return 0;}let q=d.x+select(0u,1u,d.y>=(u32(b)>>1u)+(u32(b)&1u));if(q>0x7fffffffu){numeric=true;return 0;}return select(i32(q),-i32(q),a<0);
}
fn good()->bool{if(numeric){return false;}for(var i=0u;i<6u;i++){if(v[i]< -268435456||v[i]>268435456||p[i]< -536870912||p[i]>536870912){return false;}}return true;}
fn nr(impulse:i32,gap:i32)->i32{if(impulse>0){return abs(gap);}return max(0,-gap);}
fn tr(impulse:i32,limit:i32,slip:i32)->i32{if(limit==0){return abs(impulse);}var residual=abs(slip);if(impulse>=limit){residual=slip;}else if(impulse<= -limit){residual= -slip;}return max(max(0,abs(impulse)-limit),residual);}
fn value(at:u32)->i32{return bitcast<i32>(rows[at]);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*64u;if(b>=arrayLength(&rows)){return;}for(var j=0u;j<64u;j++){output[b+j]=rows[b+j];}
 for(var i=0u;i<6u;i++){v[i]=value(b+16u+i);p[i]=0;}
 let r=value(b+4u);let xa=value(b+5u);let xb=value(b+6u);let y=value(b+7u);let cx=value(b+8u);let cy=value(b+9u);
 let e=value(b+10u);let muP=value(b+11u);let muC=value(b+12u);let overlap=value(b+13u);let maxIterations=rows[b+1u];let tolerance=rows[b+2u];
 var status=5u;var reason=2u;var iterations=0u;var residual=0xffffffffu;
 var invalid=maxIterations<1u||maxIterations>128u||tolerance<1u||tolerance>256u||rows[b+3u]!=1u;
 for(var j=4u;j<14u;j++){let x=value(b+j);if(x< -268435456||x>268435456){invalid=true;}}
 for(var j=16u;j<23u;j++){let x=value(b+j);if(x< -268435456||x>268435456){invalid=true;}}
 for(var j=23u;j<64u;j++){if(rows[b+j]!=0u){invalid=true;}}
 if(!invalid){
  // Integer floor for the negative midpoint, unlike signed truncating division.
  let floorY=(y-r)>>1u;
  invalid=r<4096||value(b+22u)<=0||xa>=xb||cx!=xa+(xb-xa)/2||cy!=floorY||y<=0||y>r||2*y<=r||2*r-(xb-xa)<0||2*r-(xb-xa)>overlap||r-y>overlap||overlap<0||e<0||e>Q||muP<0||muP>Q||muC<0||muC>Q||rows[b+14u]>rows[b+15u]||rows[b+15u]-rows[b+14u]>1u||v[1]!=0||v[4]!=0;
 }
 var sa=0;var sb=0;var sc=0;var ka=0;var kb=0;var kc=0;var kt=0;var kfloor=0;var bounce=0;
 if(invalid){status=4u;reason=1u;}
 else{
  sa=divide(cx-xa,r);sb=divide(xb-cx,r);sc=divide(y-cy,r);ka=mul(41943040,sa);kb=mul(41943040,sb);kc=mul(41943040,sc);
  kt=2*Q+mul(ka,sa)+mul(kb,sb);kfloor=Q+mul(kc,sc);bounce= -mul(e,min(v[3]-v[0],0));
  for(var iteration=0u;iteration<maxIterations;iteration++){
   iterations++;var next=max(0,p[0]+divide(bounce-(v[3]-v[0]),2*Q));var delta=next-p[0];p[0]=next;
   if(!good()){status=4u;reason=3u;break;}v[0]-=delta;v[3]+=delta;if(!good()){status=4u;reason=3u;break;}
   var slip=v[4]-v[1]+mul(sa,v[2])+mul(sb,v[5]);var limit=cone(muP,p[0]);next=clamp(p[1]+divide(-slip,kt),-limit,limit);delta=next-p[1];p[1]=next;v[1]-=delta;v[4]+=delta;v[2]+=mul(ka,delta);v[5]+=mul(kb,delta);
   if(!good()){status=4u;reason=3u;break;}
   var failed=false;
   for(var i=0u;i<2u;i++){
    let at=i*3u;let pi=2u+i*2u;next=max(0,p[pi]-v[at+1u]);delta=next-p[pi];p[pi]=next;
    if(!good()){failed=true;break;}v[at+1u]+=delta;if(!good()){failed=true;break;}
    slip=v[at]-mul(sc,v[at+2u]);limit=cone(muC,p[pi]);next=clamp(p[pi+1u]+divide(-slip,kfloor),-limit,limit);delta=next-p[pi+1u];p[pi+1u]=next;v[at]+=delta;v[at+2u]-=mul(kc,delta);
    if(!good()){failed=true;break;}
   }
   if(failed||!good()){status=4u;reason=3u;break;}
   var res=max(nr(p[0],v[3]-v[0]-bounce),max(nr(p[2],v[1]),nr(p[4],v[4])));
   res=max(res,tr(p[1],cone(muP,p[0]),v[4]-v[1]+mul(sa,v[2])+mul(sb,v[5])));
   res=max(res,tr(p[3],cone(muC,p[2]),v[0]-mul(sc,v[2])));res=max(res,tr(p[5],cone(muC,p[4]),v[3]-mul(sc,v[5])));residual=u32(res);
   if(numeric){status=4u;reason=3u;break;}if(residual<=tolerance){status=1u;reason=0u;break;}
  }
 }
 output[b]=rows[b];output[b+1u]=status;output[b+2u]=reason;output[b+3u]=iterations;for(var i=0u;i<6u;i++){output[b+16u+i]=bitcast<u32>(v[i]);output[b+25u+i]=bitcast<u32>(p[i]);}
 output[b+23u]=0xffffffffu;output[b+24u]=residual;output[b+31u]=select(0u,1u,v[1]>i32(tolerance)&&p[2]==0)|select(0u,2u,v[4]>i32(tolerance)&&p[4]==0);
 output[b+32u]=bitcast<u32>(sa);output[b+33u]=bitcast<u32>(sb);output[b+34u]=bitcast<u32>(sc);output[b+35u]=bitcast<u32>(kt);output[b+36u]=bitcast<u32>(kfloor);output[b+37u]=bitcast<u32>(bounce);output[b+38u]=divisions;output[b+39u]=multiplications;
}
@compute @workgroup_size(32)
fn divisionCheck(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*64u;if(b>=arrayLength(&rows)){return;}
 for(var j=0u;j<64u;j++){output[b+j]=rows[b+j];}
 let d=divideWide(rows[b],rows[b+1u],rows[b+2u]);output[b]=d.x;output[b+1u]=d.y;output[b+2u]=d.z;
}
`;
export const createPairClothGPU=device=>createContactGPU(device,'main');
export const createContactArithmeticGPU=device=>createContactGPU(device,'divisionCheck');
async function createContactGPU(device,entryPoint){
 device.pushErrorScope('validation');const start=performance.now();let pipeline;
 try{const module=device.createShaderModule({code:CONTACT_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint}});}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(CONTACT_WGSL).length,async run(rows){
  validateContactRows(rows);const buffers=[];const allocate=(usage)=>{const b=device.createBuffer({size:rows.byteLength,usage});buffers.push(b);return b;};
  device.pushErrorScope('validation');
  try{
   const input=allocate(128|8),output=allocate(128|4),read=allocate(1|8);device.queue.writeBuffer(input,0,rows);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,output].map((buffer,binding)=>({binding,resource:{buffer}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/64/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength);
   const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-start;
   await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   return {result,metrics:{candidates:rows.length/64,inputBytes:rows.byteLength,outputBytes:rows.byteLength,readbackBytes:rows.byteLength,allocatedBytes:3*rows.byteLength,submitToDoneMs,hardwareSpeedClaim:false,physicalAcceptance:false}};
  }finally{buffers.forEach(x=>x.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}
