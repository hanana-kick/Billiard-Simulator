/** Prepared original-law axial arithmetic, identical integer contract on CPU/WGSL.
 * Row: id,count,horizonTicks,nodeBudget,4 reserved; four10-word body records:
 * x,vx,halfAx (Q24), wx/wy/wz and angular rates (Q20), collision radius (Q24).
 * Output header: id,status,reason,lowerTick,upperTick,pairCode,nodes,NO_PASS.
 * Status1 entering bracket;2 observation horizon;4 unsupported;5 incomplete.
 * Reasons1 invalid;2 overlapping event brackets;3 grazing/uncertain;4 budget.
 * Brackets certify ONLY encoded polynomial/radii, not original continuum roots.
 * No quaternion, collision response, static-world certificate or scoring authority.
 */
import {prepareCollinearSegment} from './source-law-collinear-segment.mjs';
export const AXIAL_INTEGER = Object.freeze({positionScale:2**24,angularScale:2**20,timeScale:2**20,maxTicks:65535,rowWords:48,bodyStride:10,maxCandidates:4096,physicalAcceptance:false,originalContinuumContactCertified:false,attitudeComplete:false});
const Q=2**24,W=2**20,T=2**20,NONE=0xffffffff,LIMIT=2**28;
// Exact unsigned32 multiplication, with16-bit partial products. No software float.
export function multiplyWide(a,b){
 const a0=a&65535,a1=a>>>16,b0=b&65535,b1=b>>>16,w0=a0*b0;
 const t=a1*b0+(w0>>>16),w1=a0*b1+(t&65535);
 return [(((w1&65535)*65536)+(w0&65535))>>>0,(a1*b1+(t>>>16)+(w1>>>16))>>>0];
}
function term(x,t,shift,ceil=false){
 const [lo,hi]=multiplyWide(Math.abs(x),t);let q,rem;
 if(shift===20){q=((hi<<12)|(lo>>>20))>>>0;rem=(lo&0xfffff)!==0;}
 else {q=hi>>>8;rem=lo!==0||(hi&255)!==0;}
 return x<0?-(q+(!ceil&&rem?1:0)):q+(ceil&&rem?1:0);
}
function interval(p,v,a,lo,hi){
 return [p+term(v,v<0?hi:lo,20)+term(a,a<0?hi*hi:lo*lo,40),
 p+term(v,v<0?lo:hi,20,true)+term(a,a<0?lo*lo:hi*hi,40,true)];
}
// Shared scalar primitives for a resident upper-tick handoff; original anchors
// remain the inputs. This helper does not choose an event or change a regime.
export const axialIntegerInterval=interval;
export function advanceAxialIntegerBody(words,at,tick){
 const body=Array.from(words.slice(at,at+10));
 body[0]+=term(body[1],tick,20)+term(body[2],tick*tick,40);
 body[1]+=term(2*body[2],tick,20);
 for(let j=3;j<6;j++)body[j]+=term(body[j+3],tick,20);
 return body;
}
export function packSourceAxialCandidates(candidates){
 if(!Array.isArray(candidates)||!candidates.length||candidates.length>4096)throw RangeError('1..4096 candidates');
 const rows=new Uint32Array(candidates.length*48),s=new Int32Array(rows.buffer),ids=new Set(),provenance=[];
 candidates.forEach((c,k)=>{
  if(!Number.isInteger(c.id)||c.id<0||c.id>NONE||ids.has(c.id)||![3,4].includes(c.bodies?.length))throw RangeError('Candidate identity/bodies');ids.add(c.id);
  if(c.geometryProvenance!=='prepared-no-static-contact-interval'||!Number.isFinite(c.geometryHorizon)||c.geometryHorizon<c.duration)throw RangeError('Explicit prepared static-geometry horizon required');
  const h=Math.floor(c.duration*T),budget=c.maxNodes??2048;
  if(!Number.isInteger(h)||h<1||h>65535||!Number.isInteger(budget)||budget<1||budget>8192)throw RangeError('Bounded duration/nodes');
  const base=k*48;rows.set([c.id,c.bodies.length,h,budget,0,0,0,0],base);
  const y=c.bodies[0].position[1],z=c.bodies[0].position[2],segments=[];
  for(let i=0;i<c.bodies.length;i++)for(let j=i+1;j<c.bodies.length;j++)if(Math.abs(c.bodies[i].position[0]-c.bodies[j].position[0])<=(c.bodies[i].collisionRadius??c.bodies[i].radius)+(c.bodies[j].collisionRadius??c.bodies[j].radius))throw RangeError('Initial source contact/overlap');
  c.bodies.forEach((b,i)=>{
   if(b.radius!==c.bodies[0].radius||b.position[1]!==y||b.position[2]!==z||b.velocity[1]!==0||b.velocity[2]!==0||b.angular[0]!==0)throw RangeError('Same X lane only; off-axis/grazing unsupported');
   const collisionRadius=b.collisionRadius??b.radius;
   if(!Number.isFinite(collisionRadius)||collisionRadius<=0)throw RangeError('Positive collision radius');
   const segment=prepareCollinearSegment(b,c.material);
   if(!segment.eligible||h/T>=segment.horizon||segment.acceleration[1]!==0||segment.acceleration[2]!==0)throw RangeError('Unqualified or crossed source-law regime');
   const values=[b.position[0]*Q,b.velocity[0]*Q,segment.acceleration[0]*Q/2,...b.angular.map(x=>x*W),...segment.angularAcceleration.map(x=>x*W),collisionRadius*Q].map(Math.round);
   if(values.some((x,j)=>!Number.isSafeInteger(x)||Math.abs(x)>(j>=3&&j<=8?2**30:LIMIT))||values[9]<=0)throw RangeError('Integer coefficient domain/overflow');
   s.set(values,base+8+i*10);segments.push({regime:segment.regime,horizon:segment.horizon});
  });
  provenance.push({id:c.id,segments,duration:h/T,physicalAcceptance:false,originalContinuumContactCertified:false,staticGeometryCertificate:'caller-prepared-only',coefficientQuantization:{positionVelocityHalfAcceleration:0.5/Q,angularAngularAcceleration:0.5/W},endpointPositionErrorBound:(.5*(1+h/T+(h/T)**2)+2)/Q,endpointVelocityErrorBound:(1.5+h/T)/Q,endpointAngularErrorBound:(.5*(1+h/T)+1)/W});
 });return {rows,provenance};
}
export function validateAxialRows(rows){
 if(!(rows instanceof Uint32Array)||!rows.length||rows.length%48||rows.length/48>4096)throw TypeError('Complete bounded48-word rows');
}
export function runAxialIntegerCPU(rows){
 validateAxialRows(rows);const out=rows.slice(),s=new Int32Array(rows.buffer,rows.byteOffset,rows.length),o=new Int32Array(out.buffer);
 for(let b=0;b<rows.length;b+=48){
  const n=rows[b+1],h=rows[b+2],budget=rows[b+3];let status=2,reason=0,low=h,high=h,event=NONE,nodes=0;
  let invalid=!(n===3||n===4)||h<1||h>65535||budget<1||budget>8192||rows.slice(b+4,b+8).some(x=>x!==0);
  for(let i=0;i<4;i++)for(let j=0;j<10;j++){const value=s[b+8+i*10+j];if(Math.abs(value)>(j>=3&&j<=8?2**30:LIMIT)||(i<n&&j===9&&value<=0))invalid=true;}
  if(!invalid)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(s[b+8+i*10]-s[b+8+j*10])<=s[b+17+i*10]+s[b+17+j*10])invalid=true;
  const stack=[[0,h]];
  if(invalid){status=4;reason=1;low=0;high=0;}
  while(!invalid&&stack.length){
   if(nodes>=budget){status=5;reason=4;low=0;high=0;break;}
   const [l,u]=stack.pop();nodes++;let count=0,first=NONE;
   for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const a=b+8+i*10,c=b+8+j*10,r=s[a+9]+s[c+9],range=interval(s[c]-s[a],s[c+1]-s[a+1],s[c+2]-s[a+2],l,u);
    if(range[0]<=r&&range[1]>=-r){count++;first=i*4+j;}
   }
   if(count===0)continue;
   if(u-l>1){const m=(l+u)>>>1;stack.push([m,u],[l,m]);continue;}
   low=l;high=u;event=first;
   if(count>1){status=4;reason=2;low=0;event=NONE;break;}
   const a=b+8+(first>>>2)*10,c=b+8+(first&3)*10,r=s[a+9]+s[c+9];
   const left=interval(s[c]-s[a],s[c+1]-s[a+1],s[c+2]-s[a+2],l,l),right=interval(s[c]-s[a],s[c+1]-s[a+1],s[c+2]-s[a+2],u,u);
   const derivative=interval(s[c+1]-s[a+1],2*(s[c+2]-s[a+2]),0,l,u);
   if((derivative[0]>0||derivative[1]<0)&&(left[0]>r||left[1]<-r)&&right[0]>=-r&&right[1]<=r){status=1;reason=0;}
   else {status=4;reason=3;low=0;event=NONE;}break;
  }
  if(status===1||status===2)for(let i=0;i<n;i++){
   const a=b+8+i*10;o[a]=s[a]+term(s[a+1],low,20)+term(s[a+2],low*low,40);o[a+1]=s[a+1]+term(2*s[a+2],low,20);
   for(let j=3;j<6;j++)o[a+j]=s[a+j]+term(s[a+j+3],low,20);
  }
  out.set([rows[b],status,reason,low,high,event,nodes,NONE],b);
 }return out;
}
export const AXIAL_INTEGER_KERNEL_WGSL=`
var<private> segmentInput:array<u32,48>;
var<private> segmentOutput:array<u32,48>;
fn wide(a:u32,b:u32)->vec2<u32>{
 let a0=a&65535u;let a1=a>>16u;let b0=b&65535u;let b1=b>>16u;let w0=a0*b0;
 let t=a1*b0+(w0>>16u);let w1=a0*b1+(t&65535u);
 return vec2<u32>((w1<<16u)+(w0&65535u),a1*b1+(t>>16u)+(w1>>16u));
}
fn term(x:i32,t:u32,shift:u32,ceiling:bool)->i32{
 let p=wide(u32(abs(x)),t);var q:u32;var remainder:bool;
 if(shift==20u){q=(p.y<<12u)|(p.x>>20u);remainder=(p.x&0xfffffu)!=0u;}
 else{q=p.y>>8u;remainder=p.x!=0u||(p.y&255u)!=0u;}
 if(x<0){return -i32(q+select(0u,1u,!ceiling&&remainder));}
 return i32(q+select(0u,1u,ceiling&&remainder));
}
fn bounds(p:i32,v:i32,a:i32,lo:u32,hi:u32)->vec2<i32>{
 return vec2<i32>(p+term(v,select(lo,hi,v<0),20u,false)+term(a,select(lo*lo,hi*hi,a<0),40u,false),
 p+term(v,select(hi,lo,v<0),20u,true)+term(a,select(hi*hi,lo*lo,a<0),40u,true));
}
fn value(at:u32)->i32{return bitcast<i32>(segmentInput[at]);}
fn solveAxialSegment(){
 let b=0u;
 for(var j=0u;j<48u;j++){segmentOutput[b+j]=segmentInput[b+j];}
 let n=segmentInput[b+1u];let h=segmentInput[b+2u];let budget=segmentInput[b+3u];
 var status=2u;var reason=0u;var low=h;var high=h;var event=0xffffffffu;var nodes=0u;
 var invalid=(n!=3u&&n!=4u)||h<1u||h>65535u||budget<1u||budget>8192u;
 for(var j=4u;j<8u;j++){if(segmentInput[b+j]!=0u){invalid=true;}}
 for(var i=0u;i<4u;i++){for(var j=0u;j<10u;j++){
  let x=value(b+8u+i*10u+j);let limit=select(268435456,1073741824,j>=3u&&j<=8u);
  if(x< -limit||x>limit||(i<n&&j==9u&&x<=0)){invalid=true;}
 }}
 if(!invalid){for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){
  if(abs(value(b+8u+i*10u)-value(b+8u+j*10u))<=value(b+17u+i*10u)+value(b+17u+j*10u)){invalid=true;}
 }}}
 var stackLo:array<u32,17>;var stackHi:array<u32,17>;var size=1u;stackLo[0]=0u;stackHi[0]=h;
 if(invalid){status=4u;reason=1u;low=0u;high=0u;}
 loop{
  if(invalid||size==0u){break;}
  if(nodes>=budget){status=5u;reason=4u;low=0u;high=0u;break;}
  size--;let l=stackLo[size];let u=stackHi[size];nodes++;var count=0u;var first=0xffffffffu;
  for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){
   let a=b+8u+i*10u;let c=b+8u+j*10u;let radius=value(a+9u)+value(c+9u);
   let range=bounds(value(c)-value(a),value(c+1u)-value(a+1u),value(c+2u)-value(a+2u),l,u);
   if(range.x<=radius&&range.y>= -radius){count++;first=i*4u+j;}
  }}
  if(count==0u){continue;}
  if(u-l>1u){let m=(l+u)>>1u;stackLo[size]=m;stackHi[size]=u;stackLo[size+1u]=l;stackHi[size+1u]=m;size+=2u;continue;}
  low=l;high=u;event=first;
  if(count>1u){status=4u;reason=2u;low=0u;event=0xffffffffu;break;}
  let a=b+8u+(first>>2u)*10u;let c=b+8u+(first&3u)*10u;let radius=value(a+9u)+value(c+9u);
  let left=bounds(value(c)-value(a),value(c+1u)-value(a+1u),value(c+2u)-value(a+2u),l,l);
  let right=bounds(value(c)-value(a),value(c+1u)-value(a+1u),value(c+2u)-value(a+2u),u,u);
  let derivative=bounds(value(c+1u)-value(a+1u),2*(value(c+2u)-value(a+2u)),0,l,u);
  if((derivative.x>0||derivative.y<0)&&(left.x>radius||left.y< -radius)&&right.x>= -radius&&right.y<=radius){status=1u;reason=0u;}
  else{status=4u;reason=3u;low=0u;event=0xffffffffu;}break;
 }
 if(status==1u||status==2u){for(var i=0u;i<n;i++){
  let a=b+8u+i*10u;segmentOutput[a]=bitcast<u32>(value(a)+term(value(a+1u),low,20u,false)+term(value(a+2u),low*low,40u,false));
  segmentOutput[a+1u]=bitcast<u32>(value(a+1u)+term(2*value(a+2u),low,20u,false));
  for(var j=3u;j<6u;j++){segmentOutput[a+j]=bitcast<u32>(value(a+j)+term(value(a+j+3u),low,20u,false));}
 }}
 segmentOutput[b]=segmentInput[b];segmentOutput[b+1u]=status;segmentOutput[b+2u]=reason;segmentOutput[b+3u]=low;segmentOutput[b+4u]=high;segmentOutput[b+5u]=event;segmentOutput[b+6u]=nodes;segmentOutput[b+7u]=0xffffffffu;
}`;
export const AXIAL_INTEGER_WGSL=`
@group(0) @binding(0) var<storage,read> input:array<u32>;
@group(0) @binding(1) var<storage,read_write> output:array<u32>;
${AXIAL_INTEGER_KERNEL_WGSL}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*48u;if(b>=arrayLength(&input)){return;}
 for(var j=0u;j<48u;j++){segmentInput[j]=input[b+j];}
 solveAxialSegment();
 for(var j=0u;j<48u;j++){output[b+j]=segmentOutput[j];}
}`;
export async function createAxialIntegerGPU(device){
 device.pushErrorScope('validation');const start=performance.now();let pipeline;
 try{const module=device.createShaderModule({code:AXIAL_INTEGER_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(AXIAL_INTEGER_WGSL).length,async run(rows){
  validateAxialRows(rows);const buffers=[];const allocate=(usage)=>{const b=device.createBuffer({size:rows.byteLength,usage});buffers.push(b);return b;};
  device.pushErrorScope('validation');
  try{
   const input=allocate(128|8),output=allocate(128|4),read=allocate(1|8);device.queue.writeBuffer(input,0,rows);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,output].map((buffer,binding)=>({binding,resource:{buffer}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/48/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength);
   const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-start;
   await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   return {result,metrics:{candidates:rows.length/48,inputBytes:rows.byteLength,outputBytes:rows.byteLength,readbackBytes:rows.byteLength,allocatedBytes:3*rows.byteLength,submitToDoneMs,hardwareSpeedClaim:false,physicalAcceptance:false}};
  }finally{buffers.forEach(x=>x.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}
