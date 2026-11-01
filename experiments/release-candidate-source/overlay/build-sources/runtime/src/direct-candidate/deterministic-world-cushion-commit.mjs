/** Commit an already qualified finite-cushion response; never suppress its next clearance check. */
import {CONTACT_MATH_WGSL} from './deterministic-contact-math.mjs';
import {validateCushionHull} from './deterministic-cushion-geometry.mjs';
import {canonicalPositionWithin,canonicalVelocitySpinWithin,CANONICAL_STATE_DOMAIN_WGSL} from './deterministic-state-domain.mjs';
const NONE=0xffffffff,VERSION=0x43524d01,MAX=0x7fffffff;
const own=(x,n)=>x instanceof Uint32Array&&x.length===n&&Object.prototype.toString.call(x.buffer)!=='[object SharedArrayBuffer]';
/** Derive rail identity from complete finite-hull placement, not array order or contact normal. */
export function packVerifiedCushionRailMap(hulls,clothBounds){
 if(!Array.isArray(hulls)||hulls.length!==4||!Array.isArray(clothBounds)||clothBounds.length!==4||clothBounds.some(x=>!Number.isInteger(x)||Math.abs(x)>2**26)||clothBounds[0]>=clothBounds[1]||clothBounds[2]>=clothBounds[3])throw RangeError('Four actual hulls and canonical cloth bounds');
 const out=new Uint32Array(16),s=new Int32Array(out.buffer),rails=new Set(),ids=new Set();out.set([VERSION,4]);s.set(clothBounds,10);
 const [xm,xp,zm,zp]=clothBounds;
 hulls.forEach((h,i)=>{validateCushionHull(h);if(ids.has(h[1]))throw RangeError('Unique hull identities');ids.add(h[1]);const b=Array.from(new Int32Array(h.buffer,h.byteOffset,h.length).slice(8,14)),poss=[];
  if(Math.abs(b[0]-xp)<=2&&b[4]<=zm+2&&b[5]>=zp-2)poss.push(1);
  if(Math.abs(b[1]-xm)<=2&&b[4]<=zm+2&&b[5]>=zp-2)poss.push(2);
  if(Math.abs(b[4]-zp)<=2&&b[0]<=xm+2&&b[1]>=xp-2)poss.push(3);
  if(Math.abs(b[5]-zm)<=2&&b[0]<=xm+2&&b[1]>=xp-2)poss.push(4);
  if(poss.length!==1||rails.has(poss[0]))throw RangeError('Unambiguous complete finite rail geometry');rails.add(poss[0]);out[2+2*i]=h[1];out[3+2*i]=poss[0];
 });return out;
}
function validateInputs(current,cushion,context,railMap){
 if(!own(current.state,256)||!own(current.dense,256)||!own(cushion.entry,128)||!own(cushion.state,160)||!own(cushion.response,128)||!own(context,160)||!own(railMap,16))throw TypeError('Owned fixed-layout world/cushion/clock/rail packets');
}
export function commitMixedCushionWorldCPU(current,cushion,context,railMap){
 validateInputs(current,cushion,context,railMap);const state=current.state.slice(),s=new Int32Array(state.buffer),dense=current.dense.slice(),d=new Int32Array(dense.buffer),p=cushion.state,v=new Int32Array(p.buffer,p.byteOffset,p.length),e=cushion.entry,r=cushion.response,c=new Int32Array(context.buffer,context.byteOffset,context.length),m=new Int32Array(railMap.buffer),n=state[3];
 if(state[1]!==7||![6,7].includes(state[2]))return{state,dense,committed:false,requiresCushionRelease:false};
 const fail=reason=>{state[1]=7;state[2]=reason;return{state,dense,committed:false,requiresCushionRelease:false};};
 if(n<3||n>4||state[6]!==NONE||state[8]!==state[5]||e[1]!==1||p[1]!==8||r[1]!==1||e[2]>=n||e[3]>=4||p[3]!==n||p[2]!==e[5]||!e[5]||e[5]>state[4])return fail(90);
 if(railMap[0]!==VERSION||railMap[1]!==4||m.slice(10,14).some((x,i)=>x!==c[9+i])||r[73]!==railMap[2+2*e[3]])return fail(91);
 const rail=railMap[3+2*e[3]],next=state[5]+e[5];if(rail<1||rail>4||next>MAX||next>context[24]||state[61]>=MAX)return fail(92);
 const modes=[];for(let i=0;i<n;i++){const b=64+i*48,z=16+i*32,pos=v.slice(z+1,z+4),vel=v.slice(z+4,z+7),q=v.slice(z+7,z+10);if(p[z]!==state[b]||p[z+10]!==state[b+22]||p[z+11]!==state[b+23]||!canonicalPositionWithin(pos)||!canonicalVelocitySpinWithin(vel,q))return fail(93);const gap=pos[1]-c[8]-v[z+10];if(gap<0||gap===0&&vel[1]<0)return fail(94);let mode=0;if(gap>0||vel[1]>0)mode=2;else if(vel[0]||vel[2]||q[0]||q[2])mode=q[0]===vel[2]&&q[2]===-vel[0]&&2*c[6]<=7*c[5]?3:1;modes.push(mode);}
 const selected=16+e[2]*32;if(r[0]!==p[selected]||r.subarray(8,14).some((x,j)=>x!==p[selected+4+j]))return fail(95);
 dense.fill(0);state[1]=1;state[2]=0;state[5]=next;state[8]=next;state[6]=NONE;state[7]=0;state[40]=0;state[61]++;state[62]=next;state[63]=e[2]*8+rail;
 for(let i=0;i<n;i++){const b=64+i*48,z=16+i*32,k=i*64;s.set(v.slice(z+1,z+10),b+24);s.fill(0,b+9,b+15);state[b+39]=1;state[b+40]=modes[i];state[7]|=modes[i]<<(2*i);d[k]=modes[i];d[k+1]=s[b+22];d.set(s.slice(b+24,b+27),k+4);d.set(s.slice(b+24,b+27),k+16);d.set(s.slice(b+27,b+30),k+20);d.set(s.slice(b+30,b+33),k+24);d.set(s.slice(b+27,b+30),k+48);d[k+41]=2;}
 return{state,dense,committed:true,requiresCushionRelease:true,rail,body:e[2],globalReceiptCertified:false,referenceKind:'new-canonical-finite-cushion-impact-anchor'};
}
export const WORLD_CUSHION_COMMIT_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read_write> dense:array<u32>;
@group(0) @binding(2) var<storage,read> entry:array<u32>;
@group(0) @binding(3) var<storage,read> advanced:array<u32>;
@group(0) @binding(4) var<storage,read> response:array<u32>;
@group(0) @binding(5) var<storage,read> ctx:array<i32>;
@group(0) @binding(6) var<storage,read> rails:array<u32>;
${CONTACT_MATH_WGSL}
${CANONICAL_STATE_DOMAIN_WGSL}
fn fail(reason:u32){state[1]=7u;state[2]=reason;}
fn av(i:u32)->i32{return bitcast<i32>(advanced[i]);}
@compute @workgroup_size(1) fn main(){if(state[1]!=7u||(state[2]!=6u&&state[2]!=7u)){return;}let n=state[3];if(n<3u||n>4u||state[6]!=0xffffffffu||state[8]!=state[5]||entry[1]!=1u||advanced[1]!=8u||response[1]!=1u||entry[2]>=n||entry[3]>=4u||advanced[3]!=n||advanced[2]!=entry[5]||entry[5]==0u||entry[5]>state[4]){fail(90u);return;}
var same=rails[0]==0x43524d01u&&rails[1]==4u&&response[73]==rails[2u+2u*entry[3]];for(var j=0u;j<4u;j++){same=same&&bitcast<i32>(rails[10u+j])==ctx[9u+j];}if(!same){fail(91u);return;}let rail=rails[3u+2u*entry[3]];if(rail<1u||rail>4u||state[5]>2147483647u-entry[5]||state[5]+entry[5]>u32(ctx[24])||state[61]>=2147483647u){fail(92u);return;}let next=state[5]+entry[5];var modes:array<u32,4>;
for(var i=0u;i<n;i++){let b=64u+48u*i;let z=16u+32u*i;let p=vec3<i32>(av(z+1u),av(z+2u),av(z+3u));let v=vec3<i32>(av(z+4u),av(z+5u),av(z+6u));let q=vec3<i32>(av(z+7u),av(z+8u),av(z+9u));if(advanced[z]!=state[b]||advanced[z+10u]!=state[b+22u]||advanced[z+11u]!=state[b+23u]||!canonicalPositionWithin(p,67108864)||!canonicalVelocitySpinWithin(v,q)){fail(93u);return;}let gap=p.y-ctx[8]-av(z+10u);if(gap<0||(gap==0&&v.y<0)){fail(94u);return;}var mode=0u;if(gap>0||v.y>0){mode=2u;}else if(v.x!=0||v.z!=0||q.x!=0||q.z!=0){mode=1u;if(q.x==v.z&&q.z== -v.x&&2*ctx[6]<=7*ctx[5]){mode=3u;}}modes[i]=mode;}
let selected=16u+entry[2]*32u;var matches=response[0]==advanced[selected];for(var j=0u;j<6u;j++){matches=matches&&response[8u+j]==advanced[selected+4u+j];}if(!matches){fail(95u);return;}
for(var j=0u;j<256u;j++){dense[j]=0u;}state[1]=1u;state[2]=0u;state[5]=next;state[8]=next;state[6]=0xffffffffu;state[7]=0u;state[40]=0u;state[61]++;state[62]=next;state[63]=entry[2]*8u+rail;
for(var i=0u;i<n;i++){let b=64u+48u*i;let z=16u+32u*i;let k=i*64u;for(var j=0u;j<9u;j++){state[b+24u+j]=advanced[z+1u+j];}for(var j=9u;j<15u;j++){state[b+j]=0u;}state[b+39u]=1u;state[b+40u]=modes[i];state[7]|=modes[i]<<(2u*i);dense[k]=modes[i];dense[k+1u]=state[b+22u];dense[k+41u]=2u;for(var j=0u;j<3u;j++){dense[k+4u+j]=state[b+24u+j];dense[k+16u+j]=state[b+24u+j];dense[k+20u+j]=state[b+27u+j];dense[k+24u+j]=state[b+30u+j];dense[k+48u+j]=state[b+27u+j];}}
}
`;
export async function createWorldCushionCommitGPU(device){const module=device.createShaderModule({code:WORLD_CUSHION_COMMIT_WGSL}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});return {encode(encoder,buffers){const pass=encoder.beginComputePass(),group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();}};}
