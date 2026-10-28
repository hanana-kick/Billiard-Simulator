/** Private certified axial-contact -> full 3D impulse -> planar-motion admission.
 * Geometry/TOI authority stays with the resident event builders. Never used as a
 * general 3D geometry or motion certificate. Full responses retain every v/q.
 */
import {CONTACT_3D_VERSION,runContacts3DCPU} from './deterministic-contact-3d.mjs';
import {canonicalVelocitySpinWithin,CANONICAL_STATE_DOMAIN_WGSL} from './deterministic-state-domain.mjs';
import {CONTACT_DIVISION_WGSL} from './deterministic-contact.mjs';
const Q=2**24,NONE=0xffffffff;
export function buildContact3DBridgeCPU(packets,scene,clothRestitutionQ){const rows=new Uint32Array(packets.length),s=new Int32Array(rows.buffer),p=new Int32Array(packets.buffer,packets.byteOffset,packets.length),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let b=0;b<packets.length;b+=64){rows[b]=packets[b];if(packets[b+3]!==1)continue;const r=p[b+4],y=p[b+7]+sc[6];if(r<4096||r>Q||p[b+22]<=0||p[b+22]>4*Q||packets[b+1]<1||packets[b+1]>256||packets[b+2]<16||packets[b+2]>1024||p[b+13]<0||p[b+13]>r/8||[p[b+5],p[b+6],y,sc[5],sc[6]].some(x=>Math.abs(x)>8*Q)||!canonicalVelocitySpinWithin([p[b+16],p[b+17],0],[0,0,p[b+18]])||!canonicalVelocitySpinWithin([p[b+19],p[b+20],0],[0,0,p[b+21]])||[p[b+10],p[b+11],p[b+12],clothRestitutionQ].some(x=>!Number.isInteger(x)||x<0||x>Q))continue;
 rows.set([packets[b],CONTACT_3D_VERSION,packets[b+1],packets[b+2]],b);s.set([r,p[b+22],sc[6],p[b+13],p[b+10],p[b+11],clothRestitutionQ,p[b+12],3],b+4);s.set([p[b+5],y,sc[5],p[b+6],y,sc[5],p[b+16],p[b+17],0,0,0,-p[b+18],p[b+19],p[b+20],0,0,0,-p[b+21]],b+16);
 }return rows;}
export function mergeContact3DBridgeCPU(packets,responses){const result=packets.slice(),p=new Int32Array(result.buffer),r=new Int32Array(responses.buffer,responses.byteOffset,responses.length);for(let b=0;b<packets.length;b+=64){const o=b*2;result.set([packets[b],responses[o+1],responses[o+2],responses[o+3]],b);result[b+23]=NONE;result[b+24]=responses[o+4];result[b+38]=responses[o+50];result[b+39]=responses[o+51];if(responses[o+1]!==1)continue;if([10,11,12,16,17,18].some(j=>r[o+j]!==0)){result[b+1]=4;result[b+2]=12;continue;}p.set([r[o+8],r[o+9],-r[o+13],r[o+14],r[o+15],-r[o+19]],b+16);p.set([r[o+20],-r[o+22],r[o+23],-r[o+25],r[o+26],-r[o+28]],b+25);result[b+31]=(r[o+9]>packets[b+2]&&r[o+23]===0?1:0)|(r[o+15]>packets[b+2]&&r[o+26]===0?2:0);}return result;}
export function solveContact3DBridgeCPU(packets,scene,clothRestitutionQ){const rows=buildContact3DBridgeCPU(packets,scene,clothRestitutionQ),responses3D=new Uint32Array(rows.length*2);for(let b=0;b<rows.length;b+=64){if(rows[b+1]===CONTACT_3D_VERSION)responses3D.set(runContacts3DCPU(rows.subarray(b,b+64)),b*2);else responses3D.set([rows[b],4,1,0,NONE,0,CONTACT_3D_VERSION,NONE],b*2);}return {responses:mergeContact3DBridgeCPU(packets,responses3D),contact3DRows:rows,contact3DResponses:responses3D};}
export const CONTACT_3D_BRIDGE_BUILD_WGSL=`
${CONTACT_DIVISION_WGSL}
${CANONICAL_STATE_DOMAIN_WGSL}
@group(0) @binding(0) var<storage,read> packets:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> config:array<u32>;
@group(0) @binding(3) var<storage,read_write> rows:array<u32>;
fn value(i:u32)->i32{return bitcast<i32>(packets[i]);}
fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*64u;if(b>=arrayLength(&packets)){return;}for(var j=0u;j<64u;j++){rows[b+j]=0u;}rows[b]=packets[b];if(packets[b+3u]!=1u){return;}let r=value(b+4u);let y=value(b+7u)+sv(6u);if(r<4096||r>16777216||value(b+22u)<=0||value(b+22u)>67108864||packets[b+1u]<1u||packets[b+1u]>256u||packets[b+2u]<16u||packets[b+2u]>1024u||value(b+13u)<0||value(b+13u)>r/8||abs(value(b+5u))>134217728||abs(value(b+6u))>134217728||abs(y)>134217728||abs(sv(5u))>134217728||abs(sv(6u))>134217728||config[3u]>16777216u){return;}if(!canonicalVelocitySpinWithin(vec3<i32>(value(b+16u),value(b+17u),0),vec3<i32>(0,0,value(b+18u)))||!canonicalVelocitySpinWithin(vec3<i32>(value(b+19u),value(b+20u),0),vec3<i32>(0,0,value(b+21u)))){return;}for(var j=10u;j<13u;j++){if(value(b+j)<0||value(b+j)>16777216){return;}}
 rows[b+1u]=0x33444301u;rows[b+2u]=packets[b+1u];rows[b+3u]=packets[b+2u];rows[b+4u]=packets[b+4u];rows[b+5u]=packets[b+22u];rows[b+6u]=scene[6u];rows[b+7u]=packets[b+13u];rows[b+8u]=packets[b+10u];rows[b+9u]=packets[b+11u];rows[b+10u]=config[3u];rows[b+11u]=packets[b+12u];rows[b+12u]=3u;
 rows[b+16u]=packets[b+5u];rows[b+17u]=bitcast<u32>(y);rows[b+18u]=scene[5u];rows[b+19u]=packets[b+6u];rows[b+20u]=bitcast<u32>(y);rows[b+21u]=scene[5u];rows[b+22u]=packets[b+16u];rows[b+23u]=packets[b+17u];rows[b+27u]=bitcast<u32>(-value(b+18u));rows[b+28u]=packets[b+19u];rows[b+29u]=packets[b+20u];rows[b+33u]=bitcast<u32>(-value(b+21u));}
`;
export const CONTACT_3D_BRIDGE_MERGE_WGSL=`
@group(0) @binding(0) var<storage,read> packets:array<u32>;
@group(0) @binding(1) var<storage,read> responses:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
@group(0) @binding(3) var<storage,read_write> history:array<u32>;
@group(0) @binding(4) var<storage,read> rows3d:array<u32>;
fn rv(i:u32)->i32{return bitcast<i32>(responses[i]);}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*64u;if(b>=arrayLength(&packets)){return;}let o=id.x*128u;if(packets[b+3u]==1u){for(var j=0u;j<128u;j++){history[o+j]=responses[o+j];}history[o+69u]=0u;let fields=array<u32,6>(10u,11u,12u,16u,17u,18u);for(var j=0u;j<6u;j++){if(responses[o+fields[j]]!=0u){history[o+69u]=fields[j];break;}}history[o+70u]=0x33444201u;for(var j=0u;j<6u;j++){history[o+72u+j]=rows3d[b+16u+j];}history[o+78u]=rows3d[b+4u];history[o+79u]=rows3d[b+5u];history[o+80u]=packets[b+14u];history[o+81u]=packets[b+15u];}for(var j=0u;j<64u;j++){output[b+j]=packets[b+j];}output[b+1u]=responses[o+1u];output[b+2u]=responses[o+2u];output[b+3u]=responses[o+3u];output[b+23u]=0xffffffffu;output[b+24u]=responses[o+4u];output[b+38u]=responses[o+50u];output[b+39u]=responses[o+51u];if(responses[o+1u]!=1u){return;}if(rv(o+10u)!=0||rv(o+11u)!=0||rv(o+12u)!=0||rv(o+16u)!=0||rv(o+17u)!=0||rv(o+18u)!=0){output[b+1u]=4u;output[b+2u]=12u;return;}
 output[b+16u]=responses[o+8u];output[b+17u]=responses[o+9u];output[b+18u]=bitcast<u32>(-rv(o+13u));output[b+19u]=responses[o+14u];output[b+20u]=responses[o+15u];output[b+21u]=bitcast<u32>(-rv(o+19u));output[b+25u]=responses[o+20u];output[b+26u]=bitcast<u32>(-rv(o+22u));output[b+27u]=responses[o+23u];output[b+28u]=bitcast<u32>(-rv(o+25u));output[b+29u]=responses[o+26u];output[b+30u]=bitcast<u32>(-rv(o+28u));output[b+31u]=select(0u,1u,rv(o+9u)>i32(packets[b+2u])&&rv(o+23u)==0)|select(0u,2u,rv(o+15u)>i32(packets[b+2u])&&rv(o+26u)==0);}
`;
export function rememberContact3DCPU(last,packets,rows,responses){for(let b=0;b<packets.length;b+=64){if(packets[b+3]!==1)continue;const at=b*2;last.set(responses.subarray(at,at+128),at);last[at+69]=[10,11,12,16,17,18].find(j=>responses[at+j]!==0)??0;last[at+70]=0x33444201;last.set(rows.subarray(b+16,b+22),at+72);last[at+78]=rows[b+4];last[at+79]=rows[b+5];last[at+80]=packets[b+14];last[at+81]=packets[b+15];}}
