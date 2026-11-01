import {solveContact3DBridgeCPU} from './deterministic-contact-3d-bridge.mjs';
/** Subsequent isolated supported pair response. Private resident-chain packets. */
import {multiplyWide} from './deterministic-axial.mjs';
import {runPairClothCPU} from './deterministic-contact.mjs';
import {qMath,deriveSupportedQMode,Q_MATH_WGSL} from './deterministic-q-continuation.mjs';
const Q=2**24,NONE=0xffffffff,{mul,divide,term,interval,compare,sqsum,minabs}=qMath;
export const Q_PAIR_VERSION=0x51500401;
const add=(a,b)=>{const lo=(a[0]+b[0])>>>0;return [lo,(a[1]+b[1]+(lo<a[0]?1:0))>>>0];};
const crossed=(v,rate,t)=>v!==0&&rate!==0&&Math.sign(v)!==Math.sign(rate)&&compare(multiplyWide(Math.abs(rate),t),multiplyWide(Math.abs(v),2**20))>=0;
function polynomialSign(gap,velocity,acceleration,t){const p=multiplyWide(Math.abs(velocity),t),v=[(p[0]<<21)>>>0,((p[1]<<21)|(p[0]>>>11))>>>0],a=multiplyWide(Math.abs(acceleration),t*t),height=[0,(gap*512)>>>0];let positive=height,negative=[0,0];if(velocity>=0)positive=add(positive,v);else negative=add(negative,v);if(acceleration>=0)positive=add(positive,a);else negative=add(negative,a);return compare(positive,negative);}
export function buildQPairCPU(state,scene){
 const packets=new Uint32Array(state.length/160*64),p=new Int32Array(packets.buffer),s=new Int32Array(state.buffer),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let b=0;b<state.length;b+=160){const packet=b/160*64;packets[packet]=state[b+1];if(state[b+2]!==7||state[b+3]!==0||state[b+7]!==1)continue;
  const n=state[b+4],pair=state[b+10],ia=pair>>>2,ib=pair&3,oldLo=state[b+8]-state[b+5],candidateHi=state[b+9]-state[b+5];let invalid=ia>=n||ib>=n||ia>=ib;
  if(invalid){state[b+2]=4;state[b+3]=10;continue;}
  const left=s[b+32+ia*32]<=s[b+32+ib*32]?ia:ib,right=left===ia?ib:ia,A=b+32+left*32,B=b+32+right*32,gap=s[B]-s[A]-2*sc[2],velocity=s[B+3]-s[A+3],acceleration=s[B+9]-s[A+9],limit=Math.min(state[b+14],candidateHi+64);
  if(gap<0||gap>Q/8||Math.abs(velocity)>Q||Math.abs(acceleration)>32*Q||velocity>=0||velocity+term(acceleration,limit,20)>=0||polynomialSign(gap,velocity,acceleration,oldLo)<0||polynomialSign(gap,velocity,acceleration,limit)>0){state[b+2]=4;state[b+3]=10;continue;}
  let l=oldLo,u=limit;while(l<u){const mid=(l+u)>>>1;if(polynomialSign(gap,velocity,acceleration,mid)<=0)u=mid;else l=mid+1;}const hi=l,lo=polynomialSign(gap,velocity,acceleration,hi)===0?hi:hi-1;
  const values=[];for(let i=0;i<n;i++){
   const a=b+32+i*32,v=[];for(let j=0;j<3;j++){v[j]=s[a+j]+term(s[a+3+j],hi,20)+term(s[a+9+j],hi*hi,41);v[j+3]=s[a+3+j]+term(s[a+9+j],hi,20);v[j+6]=s[a+6+j]+term(s[a+12+j],hi,20);}if(s[a+15]===3)v[8]=-v[3];values.push(v);
   if(![0,1,3].includes(s[a+15])||s[a+1]!==sc[6]+sc[2]||s[a+2]!==sc[5]||s[a+4]!==0||s[a+5]!==0||s[a+6]!==0||s[a+7]!==0||s[a+25]!==sc[2]||s[a+26]!==sc[2]||s[a+27]!==sc[3])invalid=true;
   if((s[a+15]===1&&(crossed(s[a+3]+s[a+8],s[a+9]+s[a+14],hi)||crossed(s[a+8],s[a+14],hi)))||(s[a+15]===3&&crossed(s[a+3],s[a+9],hi)))invalid=true;
   const slip=s[a+3]+s[a+8],nextSlip=v[3]+v[8];if((s[a+15]===1&&((slip!==0&&Math.sign(slip)!==Math.sign(nextSlip))||(s[a+8]!==0&&Math.sign(s[a+8])!==Math.sign(v[8]))))||(s[a+15]===3&&Math.sign(s[a+3])!==Math.sign(v[3])))invalid=true;
   const x=interval(s[a],s[a+3],s[a+9],oldLo,hi),radius=sc[2]+4,y=sc[6]+sc[2],z=sc[5];if(x[0]-radius<=sc[7]||x[1]+radius>=sc[8]||z-radius<=sc[9]||z+radius>=sc[10])invalid=true;
   for(let j=0;j<scene[16];j++){const box=32+j*6;if(!(x[1]+radius<sc[box]||x[0]-radius>sc[box+1]||y+radius<sc[box+2]||y-radius>sc[box+3]||z+radius<sc[box+4]||z-radius>sc[box+5]))invalid=true;}
  }
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(i===ia&&j===ib)continue;const a=b+32+i*32,c=b+32+j*32,x=interval(s[c]-s[a],s[c+3]-s[a+3],s[c+9]-s[a+9],oldLo,hi);if(x[0]<=2*sc[2]+8&&x[1]>=-2*sc[2]-8)invalid=true;}
  const xA=values[left][0],xB=values[right][0],speed=Math.abs(velocity)+term(Math.abs(acceleration),hi,20,true),bound=term(speed,hi-lo,20,true)+4,overlap=2*sc[2]-(xB-xA);
  if(overlap<0||overlap>bound||values[right][3]-values[left][3]>=0)invalid=true;
  if(invalid){state[b+2]=4;state[b+3]=10;continue;}
  packets.set([state[b+1],scene[14],scene[15],1],packet);p.set([sc[2],xA,xB,sc[2],xA+Math.floor((xB-xA)/2),0,sc[11],sc[12],sc[13],bound,lo,hi,values[left][3],0,-values[left][8],values[right][3],0,-values[right][8],sc[3]],packet+4);
  for(let i=0;i<n;i++)s.set(values[i],b+32+i*32+16);
  state[b+2]=0;state[b+6]=hi;state[b+8]=state[b+5]+lo;state[b+9]=state[b+5]+hi;state[b+18]=Q_PAIR_VERSION;state[b+19]=state[b+5]+lo;state[b+20]=state[b+5]+hi;state[b+21]=left*4+right;state[b+22]=overlap;state[b+23]=bound;
 }
 return packets;
}
export function mergeQPairCPU(state,responses,scene){
 const s=new Int32Array(state.buffer),rs=new Int32Array(responses.buffer),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let b=0;b<state.length;b+=160){if(state[b+2]!==0||state[b+18]!==Q_PAIR_VERSION)continue;const packet=b/160*64;if(responses[packet+1]!==1){state[b+2]=responses[packet+1]===5?5:4;state[b+3]=11;continue;}
  const row=state.slice(b,b+160),r=new Int32Array(row.buffer),left=row[21]>>>2,right=row[21]&3;let invalid=false,positiveVy=0;
  try{const friction=mul(sc[13],sc[18]),rolling=mul(5*Q/2,divide(mul(Math.min(sc[18],sc[19]),sc[21]),sc[2]));for(let i=0;i<row[4];i++){
   const a=32+i*32,selected=i===left||i===right,at=packet+(i===left?16:19);if(selected){r[a+19]=rs[at];r[a+20]=rs[at+1];r[a+24]=-rs[at+2];r[a+28]=rs[packet+(i===left?27:29)];r[a+29]=rs[packet+(i===left?28:30)];r[a+30]=Q_PAIR_VERSION;r[a+31]=row[20];}
   for(let j=0;j<9;j++)r[a+j]=r[a+16+j];if([r[a+3],r[a+4],r[a+8]].some(x=>Math.abs(x)>16*Q))throw RangeError('Pair state range');let mode=0,ax=0,ay=0,dq=0;
   if(r[a+4]>sc[15]&&selected&&r[a+28]===0){mode=2;ay=-sc[18];positiveVy|=1<<i;}else if(r[a+4]===0){({mode,a:ax,dq}=deriveSupportedQMode(r[a+3],r[a+8],friction,rolling));}else throw RangeError('Pair mode residual');r.set([ax,ay,0,0,0,dq,mode],a+9);
  }}catch{invalid=true;}
  if(invalid||row[20]>NONE-row[14]){state[b+2]=4;state[b+3]=11;continue;}
  row[5]=row[20];row[6]=0;row[7]=0;row[8]=row[5];row[9]=row[5];row[10]=NONE;row[11]=0;row[15]=positiveVy;row[16]=row[21];row[17]=0;row[24]=responses[packet+3];row[25]=responses[packet+24];row[26]=responses[packet+38];row[27]=responses[packet+39];row[28]=1;row[29]=responses[packet+25];row[30]=responses[packet+26];row[31]=1;state.set(row,b);
 }
}
export function respondQPairCPU(state,scene,{contact3D=false,clothRestitutionQ=0}={}){const packets=buildQPairCPU(state,scene),three=contact3D?solveContact3DBridgeCPU(packets,scene,clothRestitutionQ):null,responses=three?three.responses:runPairClothCPU(packets);mergeQPairCPU(state,responses,scene);return {packets,responses,...(three?three:{})};}
export const Q_PAIR_BUILD_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read_write> packets:array<u32>;
${Q_MATH_WGSL}
fn v(i:u32)->i32{return bitcast<i32>(state[i]);}fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
fn crossed(value:i32,rate:i32,t:u32)->bool{return value!=0&&rate!=0&&signInt(value)!=signInt(rate)&&cmp(wide(u32(abs(rate)),t),wide(u32(abs(value)),1048576u))>=0;}
fn polynomialSign(gap:i32,velocity:i32,acceleration:i32,t:u32)->i32{let p=wide(u32(abs(velocity)),t);let vel=vec2<u32>(p.x<<21u,(p.y<<21u)|(p.x>>11u));let a=wide(u32(abs(acceleration)),t*t);var positive=vec2<u32>(0u,u32(gap)*512u);var negative=vec2<u32>(0u);if(velocity>=0){positive=addWide(positive,vel);}else{negative=addWide(negative,vel);}if(acceleration>=0){positive=addWide(positive,a);}else{negative=addWide(negative,a);}return cmp(positive,negative);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let b=id.x*160u;if(b>=arrayLength(&state)){return;}let packet=id.x*64u;for(var j=0u;j<64u;j++){packets[packet+j]=0u;}packets[packet]=state[b+1u];if(state[b+2u]!=7u||state[b+3u]!=0u||state[b+7u]!=1u){return;}
 let n=state[b+4u];let pair=state[b+10u];let ia=pair>>2u;let ib=pair&3u;let oldLo=state[b+8u]-state[b+5u];let candidateHi=state[b+9u]-state[b+5u];if(ia>=n||ib>=n||ia>=ib){state[b+2u]=4u;state[b+3u]=10u;return;}
 let left=select(ib,ia,v(b+32u+ia*32u)<=v(b+32u+ib*32u));let right=select(ia,ib,left==ia);let A=b+32u+left*32u;let B=b+32u+right*32u;let gap=v(B)-v(A)-2*sv(2u);let velocity=v(B+3u)-v(A+3u);let acceleration=v(B+9u)-v(A+9u);let limit=min(state[b+14u],candidateHi+64u);
 if(gap<0||gap>2097152||abs(velocity)>16777216||abs(acceleration)>536870912||velocity>=0||velocity+term(acceleration,limit,20u,false)>=0||polynomialSign(gap,velocity,acceleration,oldLo)<0||polynomialSign(gap,velocity,acceleration,limit)>0){state[b+2u]=4u;state[b+3u]=10u;return;}
 var l=oldLo;var u=limit;loop{if(l>=u){break;}let mid=(l+u)>>1u;if(polynomialSign(gap,velocity,acceleration,mid)<=0){u=mid;}else{l=mid+1u;}}let hi=l;let lo=select(hi-1u,hi,polynomialSign(gap,velocity,acceleration,hi)==0);
 var values:array<array<i32,9>,4>;var invalid=false;
 for(var i=0u;i<n;i++){
  let a=b+32u+i*32u;for(var j=0u;j<3u;j++){values[i][j]=v(a+j)+term(v(a+3u+j),hi,20u,false)+term(v(a+9u+j),hi*hi,41u,false);values[i][j+3u]=v(a+3u+j)+term(v(a+9u+j),hi,20u,false);values[i][j+6u]=v(a+6u+j)+term(v(a+12u+j),hi,20u,false);}if(state[a+15u]==3u){values[i][8]= -values[i][3];}
  let mode=state[a+15u];if((mode!=0u&&mode!=1u&&mode!=3u)||v(a+1u)!=sv(6u)+sv(2u)||v(a+2u)!=sv(5u)||v(a+4u)!=0||v(a+5u)!=0||v(a+6u)!=0||v(a+7u)!=0||v(a+25u)!=sv(2u)||v(a+26u)!=sv(2u)||v(a+27u)!=sv(3u)){invalid=true;}
  if((mode==1u&&(crossed(v(a+3u)+v(a+8u),v(a+9u)+v(a+14u),hi)||crossed(v(a+8u),v(a+14u),hi)))||(mode==3u&&crossed(v(a+3u),v(a+9u),hi))){invalid=true;}
  let slip=v(a+3u)+v(a+8u);let nextSlip=values[i][3]+values[i][8];if((mode==1u&&((slip!=0&&signInt(slip)!=signInt(nextSlip))||(v(a+8u)!=0&&signInt(v(a+8u))!=signInt(values[i][8]))))||(mode==3u&&signInt(v(a+3u))!=signInt(values[i][3]))){invalid=true;}
  let x=bound(v(a),v(a+3u),v(a+9u),oldLo,hi);let radius=sv(2u)+4;let y=sv(6u)+sv(2u);let z=sv(5u);if(x.x-radius<=sv(7u)||x.y+radius>=sv(8u)||z-radius<=sv(9u)||z+radius>=sv(10u)){invalid=true;}
  for(var j=0u;j<scene[16];j++){let box=32u+j*6u;if(!(x.y+radius<sv(box)||x.x-radius>sv(box+1u)||y+radius<sv(box+2u)||y-radius>sv(box+3u)||z+radius<sv(box+4u)||z-radius>sv(box+5u))){invalid=true;}}
 }
 for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){if(i==ia&&j==ib){continue;}let a=b+32u+i*32u;let c=b+32u+j*32u;let x=bound(v(c)-v(a),v(c+3u)-v(a+3u),v(c+9u)-v(a+9u),oldLo,hi);if(x.x<=2*sv(2u)+8&&x.y>= -2*sv(2u)-8){invalid=true;}}}
 let xA=values[left][0];let xB=values[right][0];let speed=abs(velocity)+term(abs(acceleration),hi,20u,true);let overlapBound=term(speed,hi-lo,20u,true)+4;let overlap=2*sv(2u)-(xB-xA);
 if(overlap<0||overlap>overlapBound||values[right][3]-values[left][3]>=0){invalid=true;}if(invalid){state[b+2u]=4u;state[b+3u]=10u;return;}
 packets[packet]=state[b+1u];packets[packet+1u]=scene[14];packets[packet+2u]=scene[15];packets[packet+3u]=1u;packets[packet+4u]=scene[2];packets[packet+5u]=bitcast<u32>(xA);packets[packet+6u]=bitcast<u32>(xB);packets[packet+7u]=scene[2];packets[packet+8u]=bitcast<u32>(xA+((xB-xA)>>1));packets[packet+9u]=0u;packets[packet+10u]=scene[11];packets[packet+11u]=scene[12];packets[packet+12u]=scene[13];packets[packet+13u]=u32(overlapBound);packets[packet+14u]=lo;packets[packet+15u]=hi;packets[packet+16u]=bitcast<u32>(values[left][3]);packets[packet+18u]=bitcast<u32>(-values[left][8]);packets[packet+19u]=bitcast<u32>(values[right][3]);packets[packet+21u]=bitcast<u32>(-values[right][8]);packets[packet+22u]=scene[3];
 for(var i=0u;i<n;i++){for(var j=0u;j<9u;j++){state[b+32u+i*32u+16u+j]=bitcast<u32>(values[i][j]);}}
 state[b+2u]=0u;state[b+6u]=hi;state[b+8u]=state[b+5u]+lo;state[b+9u]=state[b+5u]+hi;state[b+18u]=0x51500401u;state[b+19u]=state[b+5u]+lo;state[b+20u]=state[b+5u]+hi;state[b+21u]=left*4u+right;state[b+22u]=u32(overlap);state[b+23u]=u32(overlapBound);
}`;
export const Q_PAIR_MERGE_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> responses:array<u32>;
@group(0) @binding(2) var<storage,read> scene:array<u32>;
${Q_MATH_WGSL}
var<private> row:array<u32,160>;
fn v(i:u32)->i32{return bitcast<i32>(row[i]);}fn rv(i:u32)->i32{return bitcast<i32>(responses[i]);}fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 let b=id.x*160u;if(b>=arrayLength(&state)||state[b+2u]!=0u||state[b+18u]!=0x51500401u){return;}let packet=id.x*64u;if(responses[packet+1u]!=1u){state[b+2u]=select(4u,5u,responses[packet+1u]==5u);state[b+3u]=11u;return;}
 for(var j=0u;j<160u;j++){row[j]=state[b+j];}let left=row[21]>>2u;let right=row[21]&3u;var invalid=false;var positiveVy=0u;let friction=qmul(sv(13u),sv(18u));let rolling=qmul(41943040,qdiv(qmul(min(sv(18u),sv(19u)),sv(21u)),sv(2u)));
 for(var i=0u;i<row[4];i++){
  let a=32u+i*32u;let selected=i==left||i==right;let at=packet+select(19u,16u,i==left);
  if(selected){row[a+19u]=responses[at];row[a+20u]=responses[at+1u];row[a+24u]=bitcast<u32>(-rv(at+2u));row[a+28u]=responses[packet+select(29u,27u,i==left)];row[a+29u]=responses[packet+select(30u,28u,i==left)];row[a+30u]=0x51500401u;row[a+31u]=row[20];}
  for(var j=0u;j<9u;j++){row[a+j]=row[a+16u+j];}let vx=v(a+3u);let vy=v(a+4u);let q=v(a+8u);if(abs(vx)>268435456||abs(vy)>268435456||abs(q)>268435456){invalid=true;break;}var mode=0u;var ax=0;var ay=0;var dq=0;
  if(vy>sv(15u)&&selected&&row[a+28u]==0u){mode=2u;ay= -sv(18u);positiveVy|=1u<<i;}else if(vy==0){if(vx!=0||q!=0){let u=vx+q;if(u==0&&2*rolling<=7*friction){mode=3u;ax= -signInt(vx)*qdiv(2*rolling,117440512);dq= -ax;}else{mode=1u;ax= -signInt(select(vx,u,u!=0))*friction;let drive=qmul(41943040,ax);dq=select(drive-signInt(q)*rolling,signInt(drive)*max(0,abs(drive)-rolling),q==0);if(u==0&&ax+dq==0){invalid=true;}}}}else{invalid=true;}
  row[a+9u]=bitcast<u32>(ax);row[a+10u]=bitcast<u32>(ay);row[a+11u]=0u;row[a+12u]=0u;row[a+13u]=0u;row[a+14u]=bitcast<u32>(dq);row[a+15u]=mode;
 }
 if(bad||invalid||row[20]>0xffffffffu-row[14]){state[b+2u]=4u;state[b+3u]=11u;return;}
 row[5]=row[20];row[6]=0u;row[7]=0u;row[8]=row[5];row[9]=row[5];row[10]=0xffffffffu;row[11]=0u;row[15]=positiveVy;row[16]=row[21];row[17]=0u;row[24]=responses[packet+3u];row[25]=responses[packet+24u];row[26]=responses[packet+38u];row[27]=responses[packet+39u];row[28]=1u;row[29]=responses[packet+25u];row[30]=responses[packet+26u];row[31]=1u;
 for(var j=0u;j<160u;j++){state[b+j]=row[j];}
}`;
