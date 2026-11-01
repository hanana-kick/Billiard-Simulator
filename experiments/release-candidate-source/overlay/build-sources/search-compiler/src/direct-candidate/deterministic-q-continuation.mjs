/** Explicit v2 sufficient sphere state: q=R*omega, p/v/q allQ24. No quaternion.
 * Header32 + four32-word bodies. Each body: anchor p/v/q(9), A(3),qRate(3),
 * mode; current p/v/q(9), physicalR,collisionR,mass, reserved4.
 * Actual acceleration uses shift41 in position and20 in velocity. V1 untouched.
 */
import {multiplyWide,AXIAL_INTEGER_WGSL,validateAxialRows} from './deterministic-axial.mjs';
import {divideWide,CONTACT_DIVISION_WGSL,CONTACT_WGSL} from './deterministic-contact.mjs';
import {runResidentTransitionCPU,RESIDENT_BUILD_WGSL,validateResidentScene} from './deterministic-resident-transition.mjs';
const Q=2**24,T=2**20,NONE=0xffffffff;
export const Q_STATE_VERSION=0x51563201;
// Initial |omega|,|rate|<=2^30 and t<1/16; include the outward endpoint.
export const Q_OMEGA_ENDPOINT_LIMIT=17*2**26;
const sign=x=>x<0?-1:x>0?1:0;
const mul=(a,b)=>{const [lo,hi]=multiplyWide(Math.abs(a),Math.abs(b));const q=hi*256+(lo>>>24)+((lo&0xffffff)>=0x800000?1:0);if(q>0x7fffffff)throw RangeError('q arithmetic');return sign(a)*sign(b)*q;};
const divide=(a,b)=>{const [lo,hi]=multiplyWide(Math.abs(a),Q),r=divideWide(lo,hi,b);const q=r.quotient+(r.remainder>=Math.ceil(b/2)?1:0);if(!r.valid||q>0x7fffffff)throw RangeError('q division');return sign(a)*q;};
function floorQ24(a,b){if(a<0||b<0)throw RangeError('Positive material product');const [lo,hi]=multiplyWide(a,b);const value=hi*256+(lo>>>24);if(value>0x7fffffff)throw RangeError('Material product range');return value;}
function term(a,t,shift,ceil=false){if(shift!==20&&shift!==41)throw RangeError('Time product shift');const [lo,hi]=multiplyWide(Math.abs(a),t);const q=shift===20?hi*4096+(lo>>>20):hi>>>9,rem=shift===20?(lo&0xfffff)!==0:lo!==0||(hi&511)!==0;return a<0?-(q+(!ceil&&rem?1:0)):q+(ceil&&rem?1:0);}
export function boundedOmegaToQ(omega,radius){
 if(!Number.isInteger(omega)||Math.abs(omega)>Q_OMEGA_ENDPOINT_LIMIT||!Number.isInteger(radius)||radius<=0||radius>16*Q)throw RangeError('q conversion domain');
 const [lo,hi]=multiplyWide(Math.abs(omega),radius);
 if(hi>65536||(hi===65536&&lo!==0))throw RangeError('q conversion range');
 return term(omega,radius,20);
}
const interval=(p,v,a,l,h)=>[p+term(v,v<0?h:l,20)+term(a,a<0?h*h:l*l,41),p+term(v,v<0?l:h,20,true)+term(a,a<0?l*l:h*h,41,true)];
const compare=(a,b)=>a[1]===b[1]?Math.sign(a[0]-b[0]):Math.sign(a[1]-b[1]);
function boundary(value,rate,h){
 if(value===0||rate===0||sign(value)===sign(rate))return null;
 const target=multiplyWide(Math.abs(value),T),r=Math.abs(rate);if(compare(multiplyWide(r,h),target)<0)return null;
 let l=1,u=h;while(l<u){const m=(l+u)>>>1;if(compare(multiplyWide(r,m),target)>=0)u=m;else l=m+1;}
 return [compare(multiplyWide(r,l),target)===0?l:l-1,l];
}
const addWide=(a,b)=>{const lo=(a[0]+b[0])>>>0;return [lo,(a[1]+b[1]+(lo<a[0]?1:0))>>>0];};
function sqrtWideFloor(value){let l=0,u=0x7fffffff;while(l<u){const m=Math.floor((l+u+1)/2);if(compare(multiplyWide(m,m),value)<=0)l=m;else u=m-1;}return l;}
export function landingSpeed(vy,gravity,gap){if(gap<0||gap>Q/8||Math.abs(vy)>Q)throw RangeError('Landing speed domain');const potential=multiplyWide(gravity,gap);return sqrtWideFloor(addWide(multiplyWide(Math.abs(vy),Math.abs(vy)),addWide(potential,potential)));}
export function ballisticBoundary(gap,vy,gravity,h){
 if(![gap,vy,gravity,h].every(Number.isInteger)||h<1||h>65535)return false;
 // Explicit bounded domain makes exact sign evaluation fit unsigned 64 bits.
 if(gap<0||gap>Q/8||Math.abs(vy)>Q||gravity<=0||gravity>16*Q||(gap===0&&vy<=0))return false;
 const signAt=t=>{const vt=multiplyWide(Math.abs(vy),t),vterm=[(vt[0]<<21)>>>0,((vt[1]<<21)|(vt[0]>>>11))>>>0],height=[0,(gap*512)>>>0],fall=multiplyWide(gravity,t*t);return compare(vy>=0?addWide(height,vterm):height,vy>=0?fall:addWide(fall,vterm));};
 if(signAt(h)>0)return null;let l=1,u=h;while(l<u){const m=(l+u)>>>1;if(signAt(m)<=0)u=m;else l=m+1;}return [signAt(l)===0?l:l-1,l];
}
function sqsum(x,y){const a=multiplyWide(x,x),b=multiplyWide(y,y),lo=(a[0]+b[0])>>>0;return [lo,(a[1]+b[1]+(lo<a[0]?1:0))>>>0];}
const minabs=([a,b])=>a<=0&&b>=0?0:Math.min(Math.abs(a),Math.abs(b));
export function deriveSupportedQMode(v,q,friction,rollingRate){
 if(![v,q,friction,rollingRate].every(Number.isInteger)||Math.abs(v)>16*Q||Math.abs(q)>16*Q||friction<0||friction>16*Q||rollingRate<0||rollingRate>16*Q)throw RangeError('q mode domain');
 if(v===0&&q===0)return {mode:0,a:0,dq:0};
 const u=v+q;
 if(u===0&&2*rollingRate<=7*friction){const a=-sign(v)*divide(2*rollingRate,7*Q);return {mode:3,a:a||0,dq:(-a)||0};}
 const a=-sign(u||v)*friction,drive=mul(5*Q/2,a);
 const dq=q===0?sign(drive)*Math.max(0,Math.abs(drive)-rollingRate):drive-sign(q)*rollingRate;
 if(u===0&&a+dq===0)throw RangeError('unresolved slip onset');return {mode:1,a:a||0,dq:dq||0};
}
export function runQContinuationCPU(original,scene,{horizonTicks=16384,maxNodes=2048,deferQuery=false,contact3D=false,clothRestitutionQ=undefined}={}){
 if(!Number.isInteger(horizonTicks)||horizonTicks<1||horizonTicks>65535||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>8192)throw RangeError('Bounded v2 query');
 const stages=runResidentTransitionCPU(original,scene,{merge:false,contact3D,clothRestitutionQ}),out=new Uint32Array(original.length/48*160),s=new Int32Array(out.buffer),old=new Int32Array(stages.state.buffer),response=new Int32Array(stages.responses.buffer),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let k=0;k<original.length/48;k++){
  const b=k*160,previous=k*128,contact=k*64,n=stages.state[previous+14],epoch=stages.state[previous+13],pair=stages.state[previous+5],left=pair>>>2,right=pair&3;
  out.set([Q_STATE_VERSION,stages.state[previous],4,1,n,epoch,0,0,epoch,epoch,NONE,0,NONE,maxNodes,horizonTicks],b);
  if(stages.state[previous+1]!==0||stages.responses[contact+1]!==1){if(stages.state[previous+1]===5||stages.responses[contact+1]===5)out[b+2]=5;continue;}
  let invalid=epoch>NONE-horizonTicks;
  try{
   const friction=mul(sc[13],sc[18]),rollingRate=mul(5*Q/2,divide(mul(Math.min(sc[18],sc[19]),sc[21]),sc[2]));if(friction>16*Q||rollingRate>16*Q)throw RangeError('force domain');
   for(let i=0;i<n;i++){
    const at=b+32+i*32,from=previous+16+i*12,selected=i===left||i===right,ci=contact+(i===left?16:19);
    const vx=selected?response[ci]:old[from+3],vy=selected?response[ci+1]:0,q=selected?-response[ci+2]:boundedOmegaToQ(old[from+8],sc[2]),normal=selected?response[contact+(i===left?27:29)]:0;
    if(![vx,vy,q].every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=16*Q)||[old[from],old[from+1],old[from+2]].some(x=>Math.abs(x)>32*Q))throw RangeError('v2 state range');
    s.set([old[from],old[from+1],old[from+2],vx,vy,0,0,0,q],at);s.set([sc[2],sc[2],sc[3]],at+25);
    const gap=old[from+1]-sc[6]-sc[2];let mode=0,a=0,ay=0,dq=0;
    if(gap!==0)throw RangeError('unresolved support gap');
    if(vy>sc[15]&&normal===0){mode=2;ay=-sc[18];}
    else if(vy===0){({mode,a,dq}=deriveSupportedQMode(vx,q,friction,rollingRate));}
    else throw RangeError('residual contact mode');
    if(Math.abs(dq)>64*Q||Math.abs(a)>16*Q)throw RangeError('rate domain');
    s.set([a,ay,0,0,0,dq,mode],at+9);s.set(Array.from(s.slice(at,at+9)),at+16);
   }
  }catch{invalid=true;}
  if(invalid){out[b+3]=2;continue;}
  out[b+2]=0;out[b+3]=0;out[b+16]=pair;
 }
 if(!deferQuery)queryQStateCPU(out,scene);
 return {...stages,qState:out};
}
export function queryQStateCPU(out,scene){
 const s=new Int32Array(out.buffer,out.byteOffset,out.length),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 rowsLoop:for(let b=0;b<out.length;b+=160){
  if(out[b+2]!==0)continue;
  const n=out[b+4],epoch=out[b+5],horizonTicks=out[b+14],maxNodes=out[b+13],left=out[b+16]>>>2,right=out[b+16]&3;
  if(Array.from({length:n},(_,i)=>b+32+i*32).every(a=>s[a+15]===0&&[3,4,5,6,7,8].every(j=>s[a+j]===0))){out[b+2]=3;out[b+6]=0;out[b+7]=0;out[b+8]=epoch;out[b+9]=epoch;continue;}
  // Earliest scalar boundary, derived from the freshly admitted q-mode.
  let end=horizonTicks,eventKind=0,eventLo=end,eventHi=end,eventCode=NONE,ambiguous=false;
  for(let i=0;i<n;i++){
   const at=b+32+i*32,mode=s[at+15],entries=mode===2?[[2,ballisticBoundary(s[at+1]-sc[6]-sc[2],s[at+4],-s[at+10],horizonTicks)]]:mode===3?[[3,boundary(s[at+3],s[at+9],horizonTicks)]]:mode===1?[[3,boundary(s[at+3]+s[at+8],s[at+9]+s[at+14],horizonTicks)],[4,boundary(s[at+8],s[at+14],horizonTicks)]]:[];
   if(entries.some(x=>x[1]===false)){out[b+2]=4;out[b+3]=7;continue rowsLoop;}
   for(const [kind,range] of entries)if(range){const [lo,hi]=range;if(eventKind===0||hi<eventLo){eventKind=kind;eventLo=lo;eventHi=hi;eventCode=i;ambiguous=false;}else if(lo<=eventHi){eventLo=Math.min(eventLo,lo);eventHi=Math.max(eventHi,hi);ambiguous=true;}}
  }
  end=eventLo;
  // Resolved contact must exit monotonically; its prior bounded overlap is not
  // treated as a new impact, nor ignored when accelerations turn it inward.
  if(out[b+16]!==NONE){
  const a=b+32+left*32,c=b+32+right*32,dx=s[c]-s[a],dv=s[c+3]-s[a+3],da=s[c+9]-s[a+9],dyv=s[c+4]-s[a+4],dya=s[c+10]-s[a+10],r=2*sc[2]+8;
  if(dv<=sc[15]||Math.min(dv,dv+term(da,eventHi,20))<=sc[15]||end===0){out[b+2]=4;out[b+3]=3;continue;}
  let clear=1,clearHi=end;
  if(interval(dx,dv,da,clearHi,clearHi)[0]<=r){out[b+2]=4;out[b+3]=3;continue;}
  while(clear<clearHi){const m=(clear+clearHi)>>>1;if(interval(dx,dv,da,m,m)[0]>r)clearHi=m;else clear=m+1;}
  if(dyv!==0&&sign(dyv+term(dya,clear,20))!==sign(dyv)){out[b+2]=4;out[b+3]=3;continue;}
  out[b+17]=clear;
  }
  const r=2*sc[2]+8;
  const possible=(l,h)=>{
   let count=0,kind=0,code=NONE;
   for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    if((i===left&&j===right)||(i===right&&j===left))continue;
    const aa=b+32+i*32,cc=b+32+j*32,x=interval(s[cc]-s[aa],s[cc+3]-s[aa+3],s[cc+9]-s[aa+9],l,h),y=interval(s[cc+1]-s[aa+1],s[cc+4]-s[aa+4],s[cc+10]-s[aa+10],l,h);
    if(compare(sqsum(minabs(x),minabs(y)),multiplyWide(r,r))<=0){count++;kind=1;code=i*4+j;}
   }
   for(let i=0;i<n;i++){
    const at=b+32+i*32,x=interval(s[at],s[at+3],s[at+9],l,h),y=interval(s[at+1],s[at+4],s[at+10],l,h),radius=sc[2]+4,z=s[at+2];
    if(x[0]-radius<=sc[7]||x[1]+radius>=sc[8]||z-radius<=sc[9]||z+radius>=sc[10]){count++;kind=5;code=i;}
    for(let j=0;j<scene[16];j++){const box=32+j*6;if(!(x[1]+radius<sc[box]||x[0]-radius>sc[box+1]||y[1]+radius<sc[box+2]||y[0]-radius>sc[box+3]||z+radius<sc[box+4]||z-radius>sc[box+5])){count++;kind=5;code=i;}}
   }return {count,kind,code};
  };
  const stack=[[0,end]];let nodes=0,found=false;
  while(stack.length){if(nodes>=maxNodes){out[b+2]=5;out[b+3]=4;found=true;break;}const [l,h]=stack.pop();nodes++;const p=possible(l,h);if(p.count===0)continue;
   if(h-l>1){const mid=(l+h)>>>1;stack.push([mid,h],[l,mid]);continue;}
   eventLo=l;eventHi=h;eventKind=p.count===1?p.kind:6;eventCode=p.code;end=l;ambiguous=p.count>1;found=true;break;
  }
  out[b+11]=nodes;if(out[b+2]===5)continue;
  if(!found&&eventKind!==0&&possible(eventLo,eventHi).count>0)ambiguous=true;
  for(let i=0;i<n;i++){
   const at=b+32+i*32;
   for(let j=0;j<3;j++){s[at+16+j]=s[at+j]+term(s[at+3+j],end,20)+term(s[at+9+j],end*end,41);s[at+19+j]=s[at+3+j]+term(s[at+9+j],end,20);s[at+22+j]=s[at+6+j]+term(s[at+12+j],end,20);}
   if(s[at+15]===3)s[at+24]=-s[at+19];
  }
  out[b+2]=eventKind===0?2:7;out[b+3]=ambiguous?5:0;out[b+6]=end;out[b+7]=ambiguous?6:eventKind;out[b+8]=epoch+eventLo;out[b+9]=epoch+eventHi;out[b+10]=eventCode;
 }
 return out;
}

export const Q_LANDING_VERSION=0x514c0101;
function landingOptions(value){
 if(!value||!Number.isFinite(value.clothRestitution)||value.clothRestitution<0||value.clothRestitution>1||!Number.isInteger(value.maxCorrectionQuanta)||value.maxCorrectionQuanta<1||value.maxCorrectionQuanta>256)throw RangeError('Explicit cloth restitution and bounded landing correction required');
 return [Q_LANDING_VERSION,Math.round(value.clothRestitution*Q),value.maxCorrectionQuanta];
}
export function runQLandingCPU(original,scene,options={}){
 const config=landingOptions(options.landing),result=runQContinuationCPU(original,scene,options);
 landQStateCPU(result.qState,scene,config);queryQStateCPU(result.qState,scene);return result;
}
export function landQStateCPU(out,scene,config){
 const s=new Int32Array(out.buffer),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let b=0;b<out.length;b+=160){
  if(out[b+2]!==7||out[b+3]!==0||out[b+7]!==2)continue;
  const n=out[b+4],target=out[b+10],lo=out[b+8]-out[b+5],hi=out[b+9]-out[b+5],at=b+32+target*32;
  if(target>=n||hi-lo>1||hi>65535||s[at+15]!==2){out[b+2]=4;out[b+3]=6;continue;}
  const row=out.slice(b,b+160),r=new Int32Array(row.buffer),endY=sc[6]+sc[2];let invalid=false;
  for(let i=0;i<n;i++){
   const a=32+i*32;if(i!==target&&r[a+15]===2){invalid=true;break;}
   for(let j=0;j<3;j++){r[a+16+j]=r[a+j]+term(r[a+3+j],hi,20)+term(r[a+9+j],hi*hi,41);r[a+19+j]=r[a+3+j]+term(r[a+9+j],hi,20);r[a+22+j]=r[a+6+j]+term(r[a+12+j],hi,20);}
   if(r[a+15]===3)r[a+24]=-r[a+19];
  }
  for(let i=0;i<n;i++)if(i!==target){const a=32+i*32,mode=r[a+15],u=r[a+3]+r[a+8],nextU=r[a+19]+r[a+24];if((mode===1&&((u!==0&&Math.sign(u)!==Math.sign(nextU))||(r[a+8]!==0&&Math.sign(r[a+8])!==Math.sign(r[a+24]))))||(mode===3&&Math.sign(r[a+3])!==Math.sign(r[a+19])))invalid=true;}
  const t=32+target*32,upperVy=r[t+20],preVy=-landingSpeed(r[t+4],-r[t+10],r[t+1]-endY),correction=endY-r[t+17],vlo=r[t+4]+term(r[t+10],lo,20),bound=term(Math.abs(vlo),hi-lo,20,true)+term(Math.abs(r[t+10]),(hi-lo)**2,41,true)+2;
  if(upperVy>=0||preVy>=0||correction<0||correction>bound||correction>config[2]||(config[3]!==undefined&&Math.abs(preVy-upperVy)>config[3]))invalid=true;
  // Enclose the entire bracket AND the declared landing-only geometry correction.
  const boxes=[];for(let i=0;i<n;i++){const a=32+i*32,x=interval(r[a],r[a+3],r[a+9],lo,hi),y=interval(r[a+1],r[a+4],r[a+10],lo,hi);if(i===target){y[0]=Math.min(y[0],endY);y[1]=Math.max(y[1],endY);}boxes.push([x,y]);}
  const radius=sc[2]+4,diameter=2*radius;
  for(let i=0;i<n;i++){
   const [x,y]=boxes[i],z=r[32+i*32+2];
   if(x[0]-radius<=sc[7]||x[1]+radius>=sc[8]||z-radius<=sc[9]||z+radius>=sc[10])invalid=true;
   for(let j=0;j<scene[16];j++){const a=32+j*6;if(!(x[1]+radius<sc[a]||x[0]-radius>sc[a+1]||y[1]+radius<sc[a+2]||y[0]-radius>sc[a+3]||z+radius<sc[a+4]||z-radius>sc[a+5]))invalid=true;}
   for(let j=i+1;j<n;j++){const xx=[boxes[j][0][0]-x[1],boxes[j][0][1]-x[0]],yy=[boxes[j][1][0]-y[1],boxes[j][1][1]-y[0]];if(compare(sqsum(minabs(xx),minabs(yy)),multiplyWide(diameter,diameter))<=0)invalid=true;}
  }
  if(invalid){out[b+2]=4;out[b+3]=6;continue;}
  try{
   const normal=mul(Q+config[1],-preVy),slip=r[t+19]+r[t+24],limit=floorQ24(sc[13],normal),tangent=Math.max(-limit,Math.min(limit,divide(-slip,7*Q/2)));
   r[t+17]=endY;r[t+19]+=tangent;r[t+20]=preVy+normal;r[t+24]+=mul(5*Q/2,tangent);
   const friction=mul(sc[13],sc[18]),rollingRate=mul(5*Q/2,divide(mul(Math.min(sc[18],sc[19]),sc[21]),sc[2]));
   for(let i=0;i<n;i++){
    const a=32+i*32;for(let j=0;j<9;j++)r[a+j]=r[a+16+j];
    if([r[a+3],r[a+4],r[a+8]].some(x=>Math.abs(x)>16*Q))throw RangeError('landing state range');
    let mode=0,ax=0,ay=0,dq=0;
    if(r[a+4]>0){mode=2;ay=-sc[18];}else if(r[a+4]===0){({mode,a:ax,dq}=deriveSupportedQMode(r[a+3],r[a+8],friction,rollingRate));}else throw RangeError('landing residual');
    r.set([ax,ay,0,0,0,dq,mode],a+9);
   }
   row.set([config[0],out[b+8],out[b+9],target,correction,bound,normal,tangent>>>0,preVy>>>0,r[t+4],slip>>>0,(r[t+3]+r[t+8])>>>0,out[b+11],1],18);
   row[15]=(preVy-upperVy)>>>0;row[5]=out[b+9];row[6]=0;row[2]=0;row[3]=0;row[7]=0;row[8]=row[5];row[9]=row[5];row[10]=NONE;row[11]=0;row[16]=NONE;row[17]=0;
   if(row[5]>NONE-row[14])throw RangeError('clock overflow');out.set(row,b);
  }catch{out[b+2]=4;out[b+3]=6;}
 }
}
export const Q_MATH_WGSL=`
${CONTACT_DIVISION_WGSL}
var<private> bad:bool;
fn signInt(x:i32)->i32{return select(select(0,1,x>0),-1,x<0);}
fn qmul(a:i32,b:i32)->i32{let p=wide(u32(abs(a)),u32(abs(b)));if(p.y>=0x800000u){bad=true;return 0;}var q=(p.y<<8u)|(p.x>>24u);if((p.x&0xffffffu)>=0x800000u){q++;}if(q>0x7fffffffu){bad=true;return 0;}return signInt(a)*signInt(b)*i32(q);}
fn qdiv(a:i32,b:i32)->i32{if(b<=0){bad=true;return 0;}let p=wide(u32(abs(a)),16777216u);let d=divideWide(p.x,p.y,u32(b));if(d.z==0u||d.x>0x7fffffffu){bad=true;return 0;}let q=d.x+select(0u,1u,d.y>=(u32(b)>>1u)+(u32(b)&1u));if(q>0x7fffffffu){bad=true;return 0;}return signInt(a)*i32(q);}
fn floorQ24(a:i32,b:i32)->i32{if(a<0||b<0){bad=true;return 0;}let p=wide(u32(a),u32(b));if(p.y>=0x800000u){bad=true;return 0;}return i32((p.y<<8u)|(p.x>>24u));}
fn term(a:i32,t:u32,shift:u32,ceiling:bool)->i32{if(shift!=20u&&shift!=41u){bad=true;return 0;}let p=wide(u32(abs(a)),t);var q:u32;var rem:bool;if(shift==20u){q=(p.y<<12u)|(p.x>>20u);rem=(p.x&0xfffffu)!=0u;}else{q=p.y>>9u;rem=p.x!=0u||(p.y&511u)!=0u;}if(a<0){return -i32(q+select(0u,1u,!ceiling&&rem));}return i32(q+select(0u,1u,ceiling&&rem));}
fn bound(p:i32,v:i32,a:i32,l:u32,h:u32)->vec2<i32>{return vec2<i32>(p+term(v,select(l,h,v<0),20u,false)+term(a,select(l*l,h*h,a<0),41u,false),p+term(v,select(h,l,v<0),20u,true)+term(a,select(h*h,l*l,a<0),41u,true));}
fn cmp(a:vec2<u32>,b:vec2<u32>)->i32{if(a.y<b.y){return -1;}if(a.y>b.y){return 1;}if(a.x<b.x){return -1;}if(a.x>b.x){return 1;}return 0;}
fn boundary(v:i32,rate:i32,h:u32)->vec3<u32>{if(v==0||rate==0||signInt(v)==signInt(rate)){return vec3<u32>(0u);}let goal=wide(u32(abs(v)),1048576u);let r=u32(abs(rate));if(cmp(wide(r,h),goal)<0){return vec3<u32>(0u);}var l=1u;var u=h;loop{if(l>=u){break;}let mid=(l+u)>>1u;if(cmp(wide(r,mid),goal)>=0){u=mid;}else{l=mid+1u;}}return vec3<u32>(select(l-1u,l,cmp(wide(r,l),goal)==0),l,1u);}
fn addWide(a:vec2<u32>,b:vec2<u32>)->vec2<u32>{let lo=a.x+b.x;return vec2<u32>(lo,a.y+b.y+select(0u,1u,lo<a.x));}
fn sqrtWideFloor(value:vec2<u32>)->u32{var l=0u;var u=0x7fffffffu;loop{if(l>=u){break;}let m=l+((u-l+1u)>>1u);if(cmp(wide(m,m),value)<=0){l=m;}else{u=m-1u;}}return l;}
fn landingSpeed(vy:i32,g:i32,gap:i32)->i32{if(gap<0||gap>2097152||abs(vy)>16777216){bad=true;return 0;}let p=wide(u32(g),u32(gap));return i32(sqrtWideFloor(addWide(wide(u32(abs(vy)),u32(abs(vy))),addWide(p,p))));}
fn flightSign(gap:i32,vy:i32,g:i32,t:u32)->i32{let vt=wide(u32(abs(vy)),t);let velocity=vec2<u32>(vt.x<<21u,(vt.y<<21u)|(vt.x>>11u));let height=vec2<u32>(0u,u32(gap)*512u);let fall=wide(u32(g),t*t);if(vy>=0){return cmp(addWide(height,velocity),fall);}return cmp(height,addWide(fall,velocity));}
fn ballisticBoundary(gap:i32,vy:i32,g:i32,h:u32)->vec3<u32>{if(gap<0||gap>2097152||abs(vy)>16777216||g<=0||g>268435456||(gap==0&&vy<=0)){return vec3<u32>(0u,0u,2u);}if(flightSign(gap,vy,g,h)>0){return vec3<u32>(0u);}var l=1u;var u=h;loop{if(l>=u){break;}let m=(l+u)>>1u;if(flightSign(gap,vy,g,m)<=0){u=m;}else{l=m+1u;}}return vec3<u32>(select(l-1u,l,flightSign(gap,vy,g,l)==0),l,1u);}
fn sqsum(x:u32,y:u32)->vec2<u32>{let a=wide(x,x);let b=wide(y,y);let lo=a.x+b.x;return vec2<u32>(lo,a.y+b.y+select(0u,1u,lo<a.x));}
fn minabs(v:vec2<i32>)->u32{if(v.x<=0&&v.y>=0){return 0u;}return u32(min(abs(v.x),abs(v.y)));}
`;
export const Q_ADMIT_WGSL=`
@group(0) @binding(0) var<storage,read> legacy:array<u32>;
@group(0) @binding(1) var<storage,read> responses:array<u32>;
@group(0) @binding(2) var<storage,read> scene:array<u32>;
@group(0) @binding(3) var<storage,read> options:array<u32>;
@group(0) @binding(4) var<storage,read_write> state:array<u32>;
${Q_MATH_WGSL}
fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}fn old(i:u32)->i32{return bitcast<i32>(legacy[i]);}fn rv(i:u32)->i32{return bitcast<i32>(responses[i]);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let previous=gid.x*128u;if(previous>=arrayLength(&legacy)){return;}let b=gid.x*160u;let contact=gid.x*64u;let n=legacy[previous+14u];let epoch=legacy[previous+13u];let pair=legacy[previous+5u];let left=pair>>2u;let right=pair&3u;
 for(var j=0u;j<160u;j++){state[b+j]=0u;}state[b]=0x51563201u;state[b+1u]=legacy[previous];state[b+2u]=4u;state[b+3u]=1u;state[b+4u]=n;state[b+5u]=epoch;state[b+8u]=epoch;state[b+9u]=epoch;state[b+10u]=0xffffffffu;state[b+12u]=0xffffffffu;state[b+13u]=options[1];state[b+14u]=options[0];
 if(legacy[previous+1u]!=0u||responses[contact+1u]!=1u){if(legacy[previous+1u]==5u||responses[contact+1u]==5u){state[b+2u]=5u;}return;}
 var invalid=epoch>0xffffffffu-options[0];let friction=qmul(sv(13u),sv(18u));let rollingRate=qmul(41943040,qdiv(qmul(min(sv(18u),sv(19u)),sv(21u)),sv(2u)));
 if(bad||friction>268435456||rollingRate>268435456){state[b+3u]=2u;return;}
 for(var i=0u;i<n;i++){
  let at=b+32u+i*32u;let priorBody=previous+16u+i*12u;let selected=i==left||i==right;let ci=contact+select(19u,16u,i==left);
  var vx=old(priorBody+3u);var vy=0;var q=0;var normal=0;
  if(selected){vx=rv(ci);vy=rv(ci+1u);q= -rv(ci+2u);normal=rv(contact+select(29u,27u,i==left));}
  else{if(abs(old(priorBody+8u))>${Q_OMEGA_ENDPOINT_LIMIT}){invalid=true;break;}let product=wide(u32(abs(old(priorBody+8u))),scene[2]);if(product.y>65536u||(product.y==65536u&&product.x!=0u)){invalid=true;break;}q=term(old(priorBody+8u),scene[2],20u,false);}
  if(abs(vx)>268435456||abs(vy)>268435456||abs(q)>268435456||abs(old(priorBody))>536870912||abs(old(priorBody+1u))>536870912||abs(old(priorBody+2u))>536870912){invalid=true;break;}
  state[at]=legacy[priorBody];state[at+1u]=legacy[priorBody+1u];state[at+2u]=legacy[priorBody+2u];state[at+3u]=bitcast<u32>(vx);state[at+4u]=bitcast<u32>(vy);state[at+8u]=bitcast<u32>(q);state[at+25u]=scene[2];state[at+26u]=scene[2];state[at+27u]=scene[3];
  if(old(priorBody+1u)-sv(6u)-sv(2u)!=0){invalid=true;break;}
  var mode=0;var a=0;var ay=0;var dq=0;
  if(vy>sv(15u)&&normal==0){mode=2;ay= -sv(18u);}
  else if(vy==0){
   if(vx!=0||q!=0){let slip=vx+q;if(slip==0&&2*rollingRate<=7*friction){mode=3;a= -signInt(vx)*qdiv(2*rollingRate,117440512);dq= -a;}
    else{mode=1;a= -signInt(select(vx,slip,slip!=0))*friction;let drive=qmul(41943040,a);dq=select(drive-signInt(q)*rollingRate,signInt(drive)*max(0,abs(drive)-rollingRate),q==0);if(slip==0&&a+dq==0){invalid=true;break;}}
   }
  }else{invalid=true;break;}
  if(bad||abs(dq)>1073741824||abs(a)>268435456){invalid=true;break;}
  state[at+9u]=bitcast<u32>(a);state[at+10u]=bitcast<u32>(ay);state[at+14u]=bitcast<u32>(dq);state[at+15u]=u32(mode);for(var j=0u;j<9u;j++){state[at+16u+j]=state[at+j];}
 }
 if(invalid){state[b+3u]=2u;return;}state[b+2u]=0u;state[b+3u]=0u;state[b+16u]=pair;
}`;
export const Q_QUERY_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
${Q_MATH_WGSL}
fn v(at:u32)->i32{return bitcast<i32>(state[at]);}fn sv(at:u32)->i32{return bitcast<i32>(scene[at]);}
fn possible(b:u32,l:u32,h:u32)->vec3<u32>{
 let n=state[b+4u];let left=state[b+16u]>>2u;let right=state[b+16u]&3u;let radius=2*sv(2u)+8;var count=0u;var kind=0u;var code=0xffffffffu;
 for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){
  if((i==left&&j==right)||(i==right&&j==left)){continue;}let a=b+32u+i*32u;let c=b+32u+j*32u;let x=bound(v(c)-v(a),v(c+3u)-v(a+3u),v(c+9u)-v(a+9u),l,h);let y=bound(v(c+1u)-v(a+1u),v(c+4u)-v(a+4u),v(c+10u)-v(a+10u),l,h);
  if(cmp(sqsum(minabs(x),minabs(y)),wide(u32(radius),u32(radius)))<=0){count++;kind=1u;code=i*4u+j;}
 }}
 for(var i=0u;i<n;i++){
  let at=b+32u+i*32u;let x=bound(v(at),v(at+3u),v(at+9u),l,h);let y=bound(v(at+1u),v(at+4u),v(at+10u),l,h);let r=sv(2u)+4;let z=v(at+2u);
  if(x.x-r<=sv(7u)||x.y+r>=sv(8u)||z-r<=sv(9u)||z+r>=sv(10u)){count++;kind=5u;code=i;}
  for(var j=0u;j<scene[16];j++){let box=32u+j*6u;if(!(x.y+r<sv(box)||x.x-r>sv(box+1u)||y.y+r<sv(box+2u)||y.x-r>sv(box+3u)||z+r<sv(box+4u)||z-r>sv(box+5u))){count++;kind=5u;code=i;}}
 }return vec3<u32>(count,kind,code);
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*160u;if(b>=arrayLength(&state)||state[b+2u]!=0u){return;}let n=state[b+4u];let epoch=state[b+5u];let horizon=state[b+14u];let maxNodes=state[b+13u];let left=state[b+16u]>>2u;let right=state[b+16u]&3u;
 var resting=true;for(var i=0u;i<n;i++){let a=b+32u+i*32u;if(state[a+15u]!=0u){resting=false;}for(var j=3u;j<9u;j++){if(v(a+j)!=0){resting=false;}}}if(resting){state[b+2u]=3u;state[b+6u]=0u;state[b+7u]=0u;state[b+8u]=epoch;state[b+9u]=epoch;return;}
 var end=horizon;var eventKind=0u;var eventLo=end;var eventHi=end;var eventCode=0xffffffffu;var ambiguous=false;
 for(var i=0u;i<n;i++){
  let at=b+32u+i*32u;let mode=state[at+15u];var boundaries:array<vec3<u32>,2>;var kinds:array<u32,2>;boundaries[0]=vec3<u32>(0u);boundaries[1]=vec3<u32>(0u);kinds[0]=0u;kinds[1]=0u;
  if(mode==2u){boundaries[0]=ballisticBoundary(v(at+1u)-sv(6u)-sv(2u),v(at+4u),-v(at+10u),horizon);kinds[0]=2u;}
  else if(mode==3u){boundaries[0]=boundary(v(at+3u),v(at+9u),horizon);kinds[0]=3u;}
  else if(mode==1u){boundaries[0]=boundary(v(at+3u)+v(at+8u),v(at+9u)+v(at+14u),horizon);boundaries[1]=boundary(v(at+8u),v(at+14u),horizon);kinds[0]=3u;kinds[1]=4u;}
  for(var j=0u;j<2u;j++){let range=boundaries[j];if(range.z==2u){state[b+2u]=4u;state[b+3u]=7u;return;}if(range.z==0u){continue;}if(eventKind==0u||range.y<eventLo){eventKind=kinds[j];eventLo=range.x;eventHi=range.y;eventCode=i;ambiguous=false;}else if(range.x<=eventHi){eventLo=min(eventLo,range.x);eventHi=max(eventHi,range.y);ambiguous=true;}}
 }
 end=eventLo;if(state[b+16u]!=0xffffffffu){let a=b+32u+left*32u;let c=b+32u+right*32u;let dx=v(c)-v(a);let dv=v(c+3u)-v(a+3u);let da=v(c+9u)-v(a+9u);let dyv=v(c+4u)-v(a+4u);let dya=v(c+10u)-v(a+10u);let r=2*sv(2u)+8;
 if(dv<=sv(15u)||min(dv,dv+term(da,eventHi,20u,false))<=sv(15u)||end==0u){state[b+2u]=4u;state[b+3u]=3u;return;}
 var clear=1u;var clearHi=end;if(bound(dx,dv,da,clearHi,clearHi).x<=r){state[b+2u]=4u;state[b+3u]=3u;return;}
 loop{if(clear>=clearHi){break;}let mid=(clear+clearHi)>>1u;if(bound(dx,dv,da,mid,mid).x>r){clearHi=mid;}else{clear=mid+1u;}}
 if(dyv!=0&&signInt(dyv+term(dya,clear,20u,false))!=signInt(dyv)){state[b+2u]=4u;state[b+3u]=3u;return;}state[b+17u]=clear;}
 var stackL:array<u32,17>;var stackH:array<u32,17>;var size=1u;stackL[0]=0u;stackH[0]=end;var nodes=0u;var found=false;
 loop{
  if(size==0u){break;}if(nodes>=maxNodes){state[b+2u]=5u;state[b+3u]=4u;found=true;break;}size--;let l=stackL[size];let h=stackH[size];nodes++;let p=possible(b,l,h);if(p.x==0u){continue;}
  if(h-l>1u){let mid=(l+h)>>1u;stackL[size]=mid;stackH[size]=h;stackL[size+1u]=l;stackH[size+1u]=mid;size+=2u;continue;}
  eventLo=l;eventHi=h;eventKind=select(6u,p.y,p.x==1u);eventCode=p.z;end=l;ambiguous=p.x>1u;found=true;break;
 }
 state[b+11u]=nodes;if(state[b+2u]==5u){return;}if(!found&&eventKind!=0u&&possible(b,eventLo,eventHi).x>0u){ambiguous=true;}
 for(var i=0u;i<n;i++){let at=b+32u+i*32u;for(var j=0u;j<3u;j++){state[at+16u+j]=bitcast<u32>(v(at+j)+term(v(at+3u+j),end,20u,false)+term(v(at+9u+j),end*end,41u,false));state[at+19u+j]=bitcast<u32>(v(at+3u+j)+term(v(at+9u+j),end,20u,false));state[at+22u+j]=bitcast<u32>(v(at+6u+j)+term(v(at+12u+j),end,20u,false));}if(state[at+15u]==3u){state[at+24u]=bitcast<u32>(-v(at+19u));}}
 state[b+2u]=select(7u,2u,eventKind==0u);state[b+3u]=select(0u,5u,ambiguous);state[b+6u]=end;state[b+7u]=select(eventKind,6u,ambiguous);state[b+8u]=epoch+eventLo;state[b+9u]=epoch+eventHi;state[b+10u]=eventCode;
}`;
export const Q_LANDING_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> options:array<u32>;
${Q_MATH_WGSL}
var<private> row:array<u32,160>;
fn rv(i:u32)->i32{return bitcast<i32>(row[i]);}fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*160u;if(b>=arrayLength(&state)||state[b+2u]!=7u||state[b+3u]!=0u||state[b+7u]!=2u){return;}
 let n=state[b+4u];let landingBody=state[b+10u];let lo=state[b+8u]-state[b+5u];let hi=state[b+9u]-state[b+5u];let at=b+32u+landingBody*32u;
 if(landingBody>=n||hi-lo>1u||hi>65535u||state[at+15u]!=2u){state[b+2u]=4u;state[b+3u]=6u;return;}
 for(var j=0u;j<160u;j++){row[j]=state[b+j];}let endY=sv(6u)+sv(2u);var invalid=false;
 for(var i=0u;i<n;i++){
  let a=32u+i*32u;if(i!=landingBody&&row[a+15u]==2u){invalid=true;break;}
  for(var j=0u;j<3u;j++){row[a+16u+j]=bitcast<u32>(rv(a+j)+term(rv(a+3u+j),hi,20u,false)+term(rv(a+9u+j),hi*hi,41u,false));row[a+19u+j]=bitcast<u32>(rv(a+3u+j)+term(rv(a+9u+j),hi,20u,false));row[a+22u+j]=bitcast<u32>(rv(a+6u+j)+term(rv(a+12u+j),hi,20u,false));}if(row[a+15u]==3u){row[a+24u]=bitcast<u32>(-rv(a+19u));}
 }
 for(var i=0u;i<n;i++){if(i!=landingBody){let a=32u+i*32u;let mode=row[a+15u];let u=rv(a+3u)+rv(a+8u);let nextU=rv(a+19u)+rv(a+24u);if((mode==1u&&((u!=0&&signInt(u)!=signInt(nextU))||(rv(a+8u)!=0&&signInt(rv(a+8u))!=signInt(rv(a+24u)))))||(mode==3u&&signInt(rv(a+3u))!=signInt(rv(a+19u)))){invalid=true;}}}
 let t=32u+landingBody*32u;let upperVy=rv(t+20u);let preVy= -landingSpeed(rv(t+4u),-rv(t+10u),rv(t+1u)-endY);let correction=endY-rv(t+17u);let vlo=rv(t+4u)+term(rv(t+10u),lo,20u,false);let errorBound=term(abs(vlo),hi-lo,20u,true)+term(abs(rv(t+10u)),(hi-lo)*(hi-lo),41u,true)+2;
 if(upperVy>=0||preVy>=0||correction<0||correction>errorBound||correction>i32(options[4])||(options[5]!=0u&&abs(preVy-upperVy)>i32(options[5]))){invalid=true;}
 var xs:array<vec2<i32>,4>;var ys:array<vec2<i32>,4>;
 for(var i=0u;i<n;i++){let a=32u+i*32u;xs[i]=bound(rv(a),rv(a+3u),rv(a+9u),lo,hi);ys[i]=bound(rv(a+1u),rv(a+4u),rv(a+10u),lo,hi);if(i==landingBody){ys[i]=vec2<i32>(min(ys[i].x,endY),max(ys[i].y,endY));}}
 let radius=sv(2u)+4;let diameter=2*radius;
 for(var i=0u;i<n;i++){
  let x=xs[i];let y=ys[i];let z=rv(32u+i*32u+2u);
  if(x.x-radius<=sv(7u)||x.y+radius>=sv(8u)||z-radius<=sv(9u)||z+radius>=sv(10u)){invalid=true;}
  for(var j=0u;j<scene[16];j++){let a=32u+j*6u;if(!(x.y+radius<sv(a)||x.x-radius>sv(a+1u)||y.y+radius<sv(a+2u)||y.x-radius>sv(a+3u)||z+radius<sv(a+4u)||z-radius>sv(a+5u))){invalid=true;}}
  for(var j=i+1u;j<n;j++){let xx=vec2<i32>(xs[j].x-x.y,xs[j].y-x.x);let yy=vec2<i32>(ys[j].x-y.y,ys[j].y-y.x);if(cmp(sqsum(minabs(xx),minabs(yy)),wide(u32(diameter),u32(diameter)))<=0){invalid=true;}}
 }
 if(invalid){state[b+2u]=4u;state[b+3u]=6u;return;}
 let normal=qmul(16777216+i32(options[3]),-preVy);let slip=rv(t+19u)+rv(t+24u);let limit=floorQ24(sv(13u),normal);let tangent=clamp(qdiv(-slip,58720256),-limit,limit);
 row[t+17u]=bitcast<u32>(endY);row[t+19u]=bitcast<u32>(rv(t+19u)+tangent);row[t+20u]=bitcast<u32>(preVy+normal);row[t+24u]=bitcast<u32>(rv(t+24u)+qmul(41943040,tangent));
 let friction=qmul(sv(13u),sv(18u));let rollingRate=qmul(41943040,qdiv(qmul(min(sv(18u),sv(19u)),sv(21u)),sv(2u)));
 for(var i=0u;i<n;i++){
  let a=32u+i*32u;for(var j=0u;j<9u;j++){row[a+j]=row[a+16u+j];}
  if(abs(rv(a+3u))>268435456||abs(rv(a+4u))>268435456||abs(rv(a+8u))>268435456){invalid=true;break;}
  var mode=0u;var ax=0;var ay=0;var dq=0;let vx=rv(a+3u);let q=rv(a+8u);
  if(rv(a+4u)>0){mode=2u;ay= -sv(18u);}else if(rv(a+4u)==0){
   if(vx!=0||q!=0){let u=vx+q;if(u==0&&2*rollingRate<=7*friction){mode=3u;ax= -signInt(vx)*qdiv(2*rollingRate,117440512);dq= -ax;}
    else{mode=1u;ax= -signInt(select(vx,u,u!=0))*friction;let drive=qmul(41943040,ax);dq=select(drive-signInt(q)*rollingRate,signInt(drive)*max(0,abs(drive)-rollingRate),q==0);if(u==0&&ax+dq==0){invalid=true;break;}}
   }
  }else{invalid=true;break;}
  row[a+9u]=bitcast<u32>(ax);row[a+10u]=bitcast<u32>(ay);row[a+11u]=0u;row[a+12u]=0u;row[a+13u]=0u;row[a+14u]=bitcast<u32>(dq);row[a+15u]=mode;
 }
 if(bad||invalid||state[b+9u]>0xffffffffu-row[14]){state[b+2u]=4u;state[b+3u]=6u;return;}
 row[18]=options[2];row[19]=state[b+8u];row[20]=state[b+9u];row[21]=landingBody;row[22]=u32(correction);row[23]=u32(errorBound);row[24]=u32(normal);row[25]=bitcast<u32>(tangent);row[26]=bitcast<u32>(preVy);row[27]=row[t+4u];row[28]=bitcast<u32>(slip);row[29]=bitcast<u32>(rv(t+3u)+rv(t+8u));row[30]=state[b+11u];row[31]=1u;
 row[15]=bitcast<u32>(preVy-upperVy);row[5]=state[b+9u];row[6]=0u;row[2]=0u;row[3]=0u;row[7]=0u;row[8]=row[5];row[9]=row[5];row[10]=0xffffffffu;row[11]=0u;row[16]=0xffffffffu;row[17]=0u;
 for(var j=0u;j<160u;j++){state[b+j]=row[j];}
}`;
export async function createQContinuationGPU(device,{landing:landingEnabled=false}={}){
 const shaders=[AXIAL_INTEGER_WGSL,RESIDENT_BUILD_WGSL,CONTACT_WGSL,Q_ADMIT_WGSL,Q_QUERY_WGSL,...(landingEnabled?[Q_LANDING_WGSL,Q_QUERY_WGSL]:[])],pipelines=[],start=performance.now();device.pushErrorScope('validation');
 try{for(const code of shaders){const module=device.createShaderModule({code}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:shaders.map(x=>new TextEncoder().encode(x).length),async run(original,scene,{horizonTicks=16384,maxNodes=2048,landing}={}){
  if(!(original instanceof Uint32Array)||!original.length||original.length%48||original.length/48>4096||!(scene instanceof Uint32Array)||scene.length!==128||!Number.isInteger(horizonTicks)||horizonTicks<1||horizonTicks>65535||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>8192)throw RangeError('Packed v2 inputs/budgets');
  validateAxialRows(original);validateResidentScene(scene);
  const config=landingEnabled?landingOptions(landing):[0,0,0];if(!landingEnabled&&landing)throw RangeError('Landing pipeline not enabled');
  const count=original.length/48,buffers=[],allocate=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};device.pushErrorScope('validation');
  try{
   const input=allocate(original.byteLength,128|8),event=allocate(count*192,128),context=allocate(512,128|8),contact=allocate(count*256,128),response=allocate(count*256,128),legacy=allocate(count*512,128),options=allocate(32,128|8),state=allocate(count*640,128|4),read=allocate(count*640,1|8);
   device.queue.writeBuffer(input,0,original);device.queue.writeBuffer(context,0,scene);device.queue.writeBuffer(options,0,new Uint32Array([horizonTicks,maxNodes,...config,0,0,0]));
   const resources=[[input,event],[input,event,context,contact,legacy],[contact,response],[legacy,response,context,options,state],[state,context],...(landingEnabled?[[state,context,options],[state,context]]:[])];
   const groups=resources.map((list,i)=>device.createBindGroup({layout:pipelines[i].getBindGroupLayout(0),entries:list.map((buffer,binding)=>({binding,resource:{buffer}}))}));
   const encoder=device.createCommandEncoder();for(let i=0;i<pipelines.length;i++){const pass=encoder.beginComputePass();pass.setPipeline(pipelines[i]);pass.setBindGroup(0,groups[i]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();}encoder.copyBufferToBuffer(state,0,read,0,count*640);
   const submitted=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-submitted;
   await read.mapAsync(1);const qState=new Uint32Array(read.getMappedRange()).slice();read.unmap();return {qState,metrics:{count,dispatches:pipelines.length,intermediateReadbacks:0,hostPhysicsBetweenPhases:0,finalReadbacks:1,stateBytesPerCandidate:640,allocatedBytes:544+count*(192+192+256+256+512+640+640),submitToDoneMs,fullShot:false,physicalAcceptance:false,hardwareSpeedClaim:false}};
  }finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}

export const qMath = Object.freeze({mul,divide,term,interval,compare,sqsum,minabs,floorQ24});
