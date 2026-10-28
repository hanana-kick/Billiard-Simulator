import {CONTACT_3D_WGSL} from './deterministic-contact-3d.mjs';
import {rememberContact3DCPU,CONTACT_3D_BRIDGE_BUILD_WGSL,CONTACT_3D_BRIDGE_MERGE_WGSL} from './deterministic-contact-3d-bridge.mjs';
import {finalizeCandidatesCPU,CANDIDATE_FINALIZER_WGSL} from './deterministic-candidate-finalizer.mjs';
/** Bounded prepared q-state recurrence. No renderer, scoring, or raw-cue authority. */
import {multiplyWide,AXIAL_INTEGER_WGSL,validateAxialRows} from './deterministic-axial.mjs';
import {divideWide,CONTACT_WGSL} from './deterministic-contact.mjs';
import {RESIDENT_BUILD_WGSL,validateResidentScene} from './deterministic-resident-transition.mjs';
import {runQContinuationCPU,landQStateCPU,queryQStateCPU,deriveSupportedQMode,qMath,Q_MATH_WGSL,Q_ADMIT_WGSL,Q_QUERY_WGSL,Q_LANDING_WGSL,Q_LANDING_VERSION} from './deterministic-q-continuation.mjs';
import {respondQPairCPU,Q_PAIR_VERSION,Q_PAIR_BUILD_WGSL,Q_PAIR_MERGE_WGSL} from './deterministic-q-pair.mjs';
import {packPhysicalRuleConfig,initialPhysicalRulesCPU,commitPhysicalRulesCPU,finishPhysicalRulesCPU,terminatePhysicalQueryCPU,PHYSICAL_RULE_INIT_WGSL,PHYSICAL_RULE_EVENT_WGSL} from './deterministic-physical-rules.mjs';
const Q=2**24,NONE=0xffffffff,{mul,divide,term,interval,compare,sqsum,minabs}=qMath;
export const Q_RECURRENCE_VERSION=0x51520302;
function ratio(a,b,d){if(b<0||d<=0)throw RangeError('Event ratio');const [lo,hi]=multiplyWide(Math.abs(a),b),r=divideWide(lo,hi,d);const x=r.quotient+(r.remainder>=Math.ceil(d/2)?1:0);if(!r.valid||x>0x7fffffff)throw RangeError('Event ratio range');return Math.sign(a)*x;}
function optionsOf(o){const {maxEvents=64,horizonTicks=65535,maxNodes=2048,clothRestitution,maxPositionCorrectionQuanta=64,maxStateCorrectionQuanta=256,contact3D=false}=o??{};
 if(typeof contact3D!=='boolean')throw TypeError('Explicit contact profile');
 if(!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>128||!Number.isInteger(horizonTicks)||horizonTicks<1||horizonTicks>65535||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>8192||!Number.isFinite(clothRestitution)||clothRestitution<0||clothRestitution>1||![maxPositionCorrectionQuanta,maxStateCorrectionQuanta].every(x=>Number.isInteger(x)&&x>=1&&x<=256))throw RangeError('Explicit bounded recurrence options');
 return {maxEvents,horizonTicks,maxNodes,contact3D,config:[Q_LANDING_VERSION,Math.round(clothRestitution*Q),maxPositionCorrectionQuanta],stateBudget:maxStateCorrectionQuanta};}
function scalarResponse(out,scene,stateBudget,positionBudget){
 const sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length);
 for(let b=0;b<out.length;b+=160){
  const observation=out[b+2]===2,kind=out[b+7];if(!observation&&!(out[b+2]===7&&out[b+3]===0&&(kind===3||kind===4)))continue;
  const row=out.slice(b,b+160),r=new Int32Array(row.buffer),n=row[4],target=row[10],lo=row[8]-row[5],hi=row[9]-row[5];let invalid=false;
  try{
   for(let i=0;i<n;i++){const a=32+i*32;for(let j=0;j<3;j++){r[a+16+j]=r[a+j]+term(r[a+3+j],hi,20)+term(r[a+9+j],hi*hi,41);r[a+19+j]=r[a+3+j]+term(r[a+9+j],hi,20);r[a+22+j]=r[a+6+j]+term(r[a+12+j],hi,20);}if(r[a+15]===3)r[a+24]=-r[a+19];}
   for(let i=0;i<n;i++)if(observation||i!==target){const a=32+i*32,mode=r[a+15],u=r[a+3]+r[a+8],nextU=r[a+19]+r[a+24];if((mode===1&&((u!==0&&Math.sign(u)!==Math.sign(nextU))||(r[a+8]!==0&&Math.sign(r[a+8])!==Math.sign(r[a+24]))))||(mode===3&&Math.sign(r[a+3])!==Math.sign(r[a+19])))throw RangeError('Rounded unhandled boundary');}
   let dp=0,dv=0,dq=0,eventMode=0;
   if(!observation){
    if(target>=n||hi-lo>1)throw RangeError('Scalar bracket');const a=32+target*32;eventMode=r[a+15];const oldx=r[a+16],oldv=r[a+19],oldq=r[a+24];
    if(kind===3&&eventMode===3){if(r[a+9]===0)throw RangeError('Rolling rate');r[a+16]=r[a]+ratio(r[a+3],Math.abs(r[a+3]),2*Math.abs(r[a+9]));r[a+19]=0;r[a+24]=0;}
    else if(eventMode===1){const value=kind===3?r[a+3]+r[a+8]:r[a+8],rate=kind===3?r[a+9]+r[a+14]:r[a+14];if(value===0||rate===0||Math.sign(value)===Math.sign(rate))throw RangeError('Scalar root');r[a+19]=r[a+3]+ratio(r[a+9],Math.abs(value),Math.abs(rate));r[a+24]=kind===3?-r[a+19]:0;}
    else throw RangeError('Unsupported scalar mode');
    dp=r[a+16]-oldx;dv=r[a+19]-oldv;dq=r[a+24]-oldq;
    if(Math.abs(dp)>positionBudget||Math.abs(dv)>stateBudget||Math.abs(dq)>stateBudget)throw RangeError('Event correction budget');
   }
   // Conservative bracket + conditioned-event envelopes, including every pair.
   const boxes=[];for(let i=0;i<n;i++){const a=32+i*32,x=interval(r[a],r[a+3],r[a+9],lo,hi),y=interval(r[a+1],r[a+4],r[a+10],lo,hi);x[0]=Math.min(x[0],r[a+16]);x[1]=Math.max(x[1],r[a+16]);boxes.push([x,y]);}
   const radius=sc[2]+4,diameter=2*radius;
   for(let i=0;i<n;i++){const [x,y]=boxes[i],z=r[32+i*32+2];if(x[0]-radius<=sc[7]||x[1]+radius>=sc[8]||z-radius<=sc[9]||z+radius>=sc[10])invalid=true;
    for(let j=0;j<scene[16];j++){const a=32+j*6;if(!(x[1]+radius<sc[a]||x[0]-radius>sc[a+1]||y[1]+radius<sc[a+2]||y[0]-radius>sc[a+3]||z+radius<sc[a+4]||z-radius>sc[a+5]))invalid=true;}
    for(let j=i+1;j<n;j++)if(compare(sqsum(minabs([boxes[j][0][0]-x[1],boxes[j][0][1]-x[0]]),minabs([boxes[j][1][0]-y[1],boxes[j][1][1]-y[0]])),multiplyWide(diameter,diameter))<=0)invalid=true;
   }
   if(invalid)throw RangeError('Scalar event geometry');
   const friction=mul(sc[13],sc[18]),rollingRate=mul(5*Q/2,divide(mul(Math.min(sc[18],sc[19]),sc[21]),sc[2]));
   for(let i=0;i<n;i++){const a=32+i*32;for(let j=0;j<9;j++)r[a+j]=r[a+16+j];if([r[a+3],r[a+4],r[a+8]].some(x=>Math.abs(x)>16*Q))throw RangeError('State range');const gap=r[a+1]-sc[6]-sc[2];let mode=0,ax=0,ay=0,dqRate=0;
    if(gap>0||(gap===0&&r[a+4]>0)){mode=2;ay=-sc[18];}else if(gap===0&&r[a+4]===0){({mode,a:ax,dq:dqRate}=deriveSupportedQMode(r[a+3],r[a+8],friction,rollingRate));}else throw RangeError('Mode gap');r.set([ax,ay,0,0,0,dqRate,mode],a+9);
   }
   row.set([Q_RECURRENCE_VERSION,row[8],row[9],target,dp>>>0,positionBudget,0,0,dv>>>0,dq>>>0,observation?0:kind,eventMode,row[11],1],18);
   row[5]=out[b+9];row[6]=0;row[2]=0;row[3]=0;row[7]=0;row[8]=row[5];row[9]=row[5];row[10]=NONE;row[11]=0;row[16]=NONE;row[17]=0;
   if(row[5]>NONE-row[14])throw RangeError('Clock overflow');out.set(row,b);
  }catch{out[b+2]=4;out[b+3]=8;}
 }
}
function rejectShared(...arrays){if(typeof SharedArrayBuffer!=='undefined'&&arrays.some(a=>a?.buffer instanceof SharedArrayBuffer))throw TypeError('Shared mutable candidate buffers unsupported');}
export function runQRecurrenceCPU(original,scene,options){
 rejectShared(original,scene,options?.ruleConfig);const signal=options?.signal;
 if(signal?.aborted)throw new DOMException('Candidate cancelled','AbortError');
 const o=optionsOf(options),ruleConfig=options?.ruleConfig?packPhysicalRuleConfig(options.ruleConfig,options.cueSlot??0,scene[1]):null,result=runQContinuationCPU(original,scene,{...o,deferQuery:true,clothRestitutionQ:o.config[1]}),rules=ruleConfig?initialPhysicalRulesCPU(result,ruleConfig):null,stats=new Uint32Array(original.length/48*24);let state=result.qState;const contact3DHistory=o.contact3D?new Uint32Array(original.length/48*128):null;if(contact3DHistory)rememberContact3DCPU(contact3DHistory,result.contacts,result.contact3DRows,result.contact3DResponses);if(rules)terminatePhysicalQueryCPU(rules,state,ruleConfig);queryQStateCPU(state,scene);
 for(let step=0;step<o.maxEvents;step++){
  if(signal?.aborted)throw new DOMException('Candidate cancelled','AbortError');
  const next=state.slice();for(let b=0;b<state.length;b+=160){const k=b/160*24;stats[k]=Q_RECURRENCE_VERSION;if(state[b+2]===2||(state[b+2]===7&&state[b+3]===0&&[1,2,3,4].includes(state[b+7]))){stats[k+1]++;const kind=state[b+7],body=state[b+10],rolling=kind===3&&state[b+32+body*32+15]===3;stats[k+(state[b+2]===2?2:kind===1?16:rolling?3:kind+2)]++;stats[k+7]+=state[b+11];}}
  scalarResponse(next,scene,o.stateBudget,o.config[2]);landQStateCPU(next,scene,[...o.config,o.stateBudget]);const solved=respondQPairCPU(next,scene,{contact3D:o.contact3D,clothRestitutionQ:o.config[1]});if(contact3DHistory)rememberContact3DCPU(contact3DHistory,solved.packets,solved.contact3DRows,solved.contact3DResponses);if(rules)commitPhysicalRulesCPU(rules,next,ruleConfig);
  for(let b=0;b<next.length;b+=160)if(next[b+2]===0){const k=b/160*24,signed=new Int32Array(next.buffer),landing=next[b+18]===Q_LANDING_VERSION,pair=next[b+18]===Q_PAIR_VERSION,dp=pair?0:Math.abs(signed[b+22]),dv=pair?0:Math.abs(signed[b+(landing?15:26)]),dq=landing||pair?0:Math.abs(signed[b+27]);if(pair){stats[k+17]++;stats[k+18]+=next[b+24];stats[k+19]+=next[b+26];stats[k+20]+=next[b+27];stats[k+21]=next[b+21];stats[k+22]=next[b+5];stats[k+23]=next[b+15];}stats[k+10]++;stats[k+11]+=dp;stats[k+12]+=dv;stats[k+13]+=dq;stats[k+14]=Math.max(stats[k+14],dv,dq);stats[k+15]=Math.max(stats[k+15],dp);}
  if(rules)terminatePhysicalQueryCPU(rules,next,ruleConfig);queryQStateCPU(next,scene);state=next;
 }
 for(let b=0;b<state.length;b+=160){const k=b/160*24;stats[k+7]+=state[b+11];if(state[b+2]===2||(state[b+2]===7&&state[b+3]===0&&[1,2,3,4].includes(state[b+7]))){state[b+2]=5;state[b+3]=9;}stats[k+8]=state[b+2];stats[k+9]=state[b+5]+state[b+6];}
 if(rules)finishPhysicalRulesCPU(rules,state,ruleConfig);
 return {...result,qState:state,stats,...(contact3DHistory?{contact3DHistory,contactProfile:"full3d-contact-planar-motion-v1"}:{}),...(rules?{rules,verdicts:finalizeCandidatesCPU(state,rules,ruleConfig)}:{} )};
}
export const Q_SCALAR_RESPONSE_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> options:array<u32>;
${Q_MATH_WGSL}
var<private> row:array<u32,160>;
fn rv(i:u32)->i32{return bitcast<i32>(row[i]);}fn sv(i:u32)->i32{return bitcast<i32>(scene[i]);}
fn ratio(a:i32,b:u32,d:u32)->i32{if(d==0u){bad=true;return 0;}let p=wide(u32(abs(a)),b);let r=divideWide(p.x,p.y,d);if(r.z==0u||r.x>0x7fffffffu){bad=true;return 0;}let x=r.x+select(0u,1u,r.y>=(d>>1u)+(d&1u));if(x>0x7fffffffu){bad=true;return 0;}return signInt(a)*i32(x);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*160u;if(b>=arrayLength(&state)){return;}let observation=state[b+2u]==2u;let kind=state[b+7u];if(!observation&&!(state[b+2u]==7u&&state[b+3u]==0u&&(kind==3u||kind==4u))){return;}
 for(var j=0u;j<160u;j++){row[j]=state[b+j];}let n=row[4];let body=row[10];let lo=row[8]-row[5];let hi=row[9]-row[5];var invalid=false;
 for(var i=0u;i<n;i++){let a=32u+i*32u;for(var j=0u;j<3u;j++){row[a+16u+j]=bitcast<u32>(rv(a+j)+term(rv(a+3u+j),hi,20u,false)+term(rv(a+9u+j),hi*hi,41u,false));row[a+19u+j]=bitcast<u32>(rv(a+3u+j)+term(rv(a+9u+j),hi,20u,false));row[a+22u+j]=bitcast<u32>(rv(a+6u+j)+term(rv(a+12u+j),hi,20u,false));}if(row[a+15u]==3u){row[a+24u]=bitcast<u32>(-rv(a+19u));}}
 for(var i=0u;i<n;i++){if(observation||i!=body){let a=32u+i*32u;let mode=row[a+15u];let u=rv(a+3u)+rv(a+8u);let nextU=rv(a+19u)+rv(a+24u);if((mode==1u&&((u!=0&&signInt(u)!=signInt(nextU))||(rv(a+8u)!=0&&signInt(rv(a+8u))!=signInt(rv(a+24u)))))||(mode==3u&&signInt(rv(a+3u))!=signInt(rv(a+19u)))){invalid=true;}}}
 var dp=0;var dv=0;var dq=0;var eventMode=0u;
 if(!observation){
  if(body>=n||hi-lo>1u){state[b+2u]=4u;state[b+3u]=8u;return;}let a=32u+body*32u;eventMode=row[a+15u];let oldx=rv(a+16u);let oldv=rv(a+19u);let oldq=rv(a+24u);
  if(kind==3u&&eventMode==3u){if(rv(a+9u)==0){invalid=true;}else{row[a+16u]=bitcast<u32>(rv(a)+ratio(rv(a+3u),u32(abs(rv(a+3u))),u32(2*abs(rv(a+9u)))));row[a+19u]=0u;row[a+24u]=0u;}}
  else if(eventMode==1u){let value=select(rv(a+8u),rv(a+3u)+rv(a+8u),kind==3u);let rate=select(rv(a+14u),rv(a+9u)+rv(a+14u),kind==3u);if(value==0||rate==0||signInt(value)==signInt(rate)){invalid=true;}else{row[a+19u]=bitcast<u32>(rv(a+3u)+ratio(rv(a+9u),u32(abs(value)),u32(abs(rate))));row[a+24u]=bitcast<u32>(select(0,-rv(a+19u),kind==3u));}}
  else{invalid=true;}
  dp=rv(a+16u)-oldx;dv=rv(a+19u)-oldv;dq=rv(a+24u)-oldq;if(abs(dp)>i32(options[4])||abs(dv)>i32(options[5])||abs(dq)>i32(options[5])){invalid=true;}
 }
 var xs:array<vec2<i32>,4>;var ys:array<vec2<i32>,4>;
 for(var i=0u;i<n;i++){let a=32u+i*32u;let x=bound(rv(a),rv(a+3u),rv(a+9u),lo,hi);xs[i]=vec2<i32>(min(x.x,rv(a+16u)),max(x.y,rv(a+16u)));ys[i]=bound(rv(a+1u),rv(a+4u),rv(a+10u),lo,hi);}
 let radius=sv(2u)+4;let diameter=2*radius;
 for(var i=0u;i<n;i++){let x=xs[i];let y=ys[i];let z=rv(32u+i*32u+2u);
  if(x.x-radius<=sv(7u)||x.y+radius>=sv(8u)||z-radius<=sv(9u)||z+radius>=sv(10u)){invalid=true;}
  for(var j=0u;j<scene[16];j++){let a=32u+j*6u;if(!(x.y+radius<sv(a)||x.x-radius>sv(a+1u)||y.y+radius<sv(a+2u)||y.x-radius>sv(a+3u)||z+radius<sv(a+4u)||z-radius>sv(a+5u))){invalid=true;}}
  for(var j=i+1u;j<n;j++){if(cmp(sqsum(minabs(vec2<i32>(xs[j].x-x.y,xs[j].y-x.x)),minabs(vec2<i32>(ys[j].x-y.y,ys[j].y-y.x))),wide(u32(diameter),u32(diameter)))<=0){invalid=true;}}
 }
 let friction=qmul(sv(13u),sv(18u));let rollingRate=qmul(41943040,qdiv(qmul(min(sv(18u),sv(19u)),sv(21u)),sv(2u)));
 for(var i=0u;i<n;i++){let a=32u+i*32u;for(var j=0u;j<9u;j++){row[a+j]=row[a+16u+j];}let vx=rv(a+3u);let vy=rv(a+4u);let q=rv(a+8u);if(abs(vx)>268435456||abs(vy)>268435456||abs(q)>268435456){invalid=true;break;}let gap=rv(a+1u)-sv(6u)-sv(2u);var mode=0u;var ax=0;var ay=0;var dqRate=0;
  if(gap>0||(gap==0&&vy>0)){mode=2u;ay= -sv(18u);}else if(gap==0&&vy==0){if(vx!=0||q!=0){let u=vx+q;if(u==0&&2*rollingRate<=7*friction){mode=3u;ax= -signInt(vx)*qdiv(2*rollingRate,117440512);dqRate= -ax;}else{mode=1u;ax= -signInt(select(vx,u,u!=0))*friction;let drive=qmul(41943040,ax);dqRate=select(drive-signInt(q)*rollingRate,signInt(drive)*max(0,abs(drive)-rollingRate),q==0);if(u==0&&ax+dqRate==0){invalid=true;}}}}else{invalid=true;}
  row[a+9u]=bitcast<u32>(ax);row[a+10u]=bitcast<u32>(ay);row[a+11u]=0u;row[a+12u]=0u;row[a+13u]=0u;row[a+14u]=bitcast<u32>(dqRate);row[a+15u]=mode;
 }
 if(bad||invalid||state[b+9u]>0xffffffffu-row[14]){state[b+2u]=4u;state[b+3u]=8u;return;}
 row[18]=0x51520302u;row[19]=state[b+8u];row[20]=state[b+9u];row[21]=body;row[22]=bitcast<u32>(dp);row[23]=options[4];row[24]=0u;row[25]=0u;row[26]=bitcast<u32>(dv);row[27]=bitcast<u32>(dq);row[28]=select(kind,0u,observation);row[29]=eventMode;row[30]=state[b+11u];row[31]=1u;
 row[5]=state[b+9u];row[6]=0u;row[2]=0u;row[3]=0u;row[7]=0u;row[8]=row[5];row[9]=row[5];row[10]=0xffffffffu;row[11]=0u;row[16]=0xffffffffu;row[17]=0u;
 for(var j=0u;j<160u;j++){state[b+j]=row[j];}
}`;
const ACCOUNT_WGSL=`
@group(0) @binding(0) var<storage,read_write> state:array<u32>;
@group(0) @binding(1) var<storage,read_write> stats:array<u32>;
fn eligible(b:u32)->bool{return state[b+2u]==2u||(state[b+2u]==7u&&state[b+3u]==0u&&(state[b+7u]==1u||state[b+7u]==2u||state[b+7u]==3u||state[b+7u]==4u));}
@compute @workgroup_size(32) fn account(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}let k=id.x*24u;stats[k]=0x51520302u;if(eligible(b)){stats[k+1u]++;var field=state[b+7u]+2u;if(state[b+2u]==2u){field=2u;}else if(state[b+7u]==1u){field=16u;}else if(state[b+7u]==3u&&state[b+32u+state[b+10u]*32u+15u]==3u){field=3u;}stats[k+field]++;stats[k+7u]+=state[b+11u];}}
@compute @workgroup_size(32) fn finish(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)){return;}let k=id.x*24u;stats[k+7u]+=state[b+11u];if(eligible(b)){state[b+2u]=5u;state[b+3u]=9u;}stats[k+8u]=state[b+2u];stats[k+9u]=state[b+5u]+state[b+6u];}
@compute @workgroup_size(32) fn record(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*160u;if(b>=arrayLength(&state)||state[b+2u]!=0u){return;}let k=id.x*24u;let landing=state[b+18u]==0x514c0101u;let pair=state[b+18u]==0x51500401u;let dp=select(u32(abs(bitcast<i32>(state[b+22u]))),0u,pair);let dv=select(u32(abs(bitcast<i32>(state[b+select(26u,15u,landing)]))),0u,pair);let dq=select(u32(abs(bitcast<i32>(state[b+27u]))),0u,landing||pair);if(pair){stats[k+17u]++;stats[k+18u]+=state[b+24u];stats[k+19u]+=state[b+26u];stats[k+20u]+=state[b+27u];stats[k+21u]=state[b+21u];stats[k+22u]=state[b+5u];stats[k+23u]=state[b+15u];}stats[k+10u]++;stats[k+11u]+=dp;stats[k+12u]+=dv;stats[k+13u]+=dq;stats[k+14u]=max(stats[k+14u],max(dv,dq));stats[k+15u]=max(stats[k+15u],dp);}

`;
export async function createQRecurrenceGPU(device,{rules:rulesEnabled=false,contact3D:threeEnabled=false}={}){
 const codes=[AXIAL_INTEGER_WGSL,RESIDENT_BUILD_WGSL,CONTACT_WGSL,Q_ADMIT_WGSL,Q_QUERY_WGSL,Q_SCALAR_RESPONSE_WGSL,Q_LANDING_WGSL,ACCOUNT_WGSL,ACCOUNT_WGSL,ACCOUNT_WGSL,Q_PAIR_BUILD_WGSL,Q_PAIR_MERGE_WGSL,...(rulesEnabled?[PHYSICAL_RULE_INIT_WGSL,PHYSICAL_RULE_EVENT_WGSL,PHYSICAL_RULE_EVENT_WGSL,CANDIDATE_FINALIZER_WGSL,PHYSICAL_RULE_EVENT_WGSL]:[]),...(threeEnabled?[CONTACT_3D_BRIDGE_BUILD_WGSL,CONTACT_3D_WGSL,CONTACT_3D_BRIDGE_MERGE_WGSL]:[])],threeBase=rulesEnabled?17:12,pipelines=[],start=performance.now();device.pushErrorScope('validation');
 try{for(let i=0;i<codes.length;i++){const module=device.createShaderModule({code:codes[i]}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:threeEnabled&&i>=threeBase?'main':i===7?'account':i===8?'finish':i===9?'record':i===13?'commit':i===14?'finish':i===16?'terminate':'main'}}));}}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:codes.map(x=>new TextEncoder().encode(x).length),async run(original,scene,options){
  rejectShared(original,scene,options?.ruleConfig);const signal=options?.signal;
  if(signal?.aborted)throw new DOMException('Candidate cancelled','AbortError');
  validateAxialRows(original);validateResidentScene(scene);const o=optionsOf(options),ruleConfig=rulesEnabled?packPhysicalRuleConfig(options.ruleConfig,options.cueSlot??0,scene[1]):null,count=original.length/48,diagnostics=!rulesEnabled||options?.diagnostics===true,buffers=[],allocate=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};if(!rulesEnabled&&options?.ruleConfig)throw RangeError('RULE pipeline not enabled');if(o.contact3D!==threeEnabled)throw RangeError('Contact profile does not match pipeline');device.pushErrorScope('validation');
  try{
   const input=allocate(original.byteLength,128|8),event=allocate(count*192,128),context=allocate(512,128|8),contact=allocate(count*256,128),response=allocate(count*256,128),legacy=allocate(count*512,128),config=allocate(32,128|8),states=[allocate(count*640,128|4|8),allocate(count*640,128|4|8)],stats=allocate(count*96,128|4),read=allocate(count*(diagnostics?((rulesEnabled?880:736)+(threeEnabled?512:0)):16),1|8),threeRows=threeEnabled?allocate(count*256,128):null,threeResponses=threeEnabled?allocate(count*512,128):null,threeHistory=threeEnabled?allocate(count*512,128|4):null,verdictBuffer=rulesEnabled?allocate(count*16,128|4):null,ruleBuffer=rulesEnabled?allocate(count*128,128|4):null,ruleContext=rulesEnabled?allocate(64,128|8):null;
   if(rulesEnabled)device.queue.writeBuffer(ruleContext,0,ruleConfig);
   device.queue.writeBuffer(input,0,original);device.queue.writeBuffer(context,0,scene);device.queue.writeBuffer(config,0,new Uint32Array([o.horizonTicks,o.maxNodes,...o.config,o.stateBudget,0,0]));
   const bind=(p,list)=>device.createBindGroup({layout:pipelines[p].getBindGroupLayout(0),entries:list.map((buffer,binding)=>({binding,resource:{buffer}}))});
   const initial=[[input,event],[input,event,context,contact,legacy],[contact,response],[legacy,response,context,config,states[0]],[states[0],context]].map((x,i)=>bind(i,x));
   const per=states.map(state=>({scalar:bind(5,[state,context,config]),land:bind(6,[state,context,config]),query:bind(4,[state,context]),account:bind(7,[state,stats]),finish:bind(8,[state,stats]),record:bind(9,[state,stats]),pairBuild:bind(10,[state,context,contact]),pairMerge:bind(11,[state,response,context]),...(rulesEnabled?{ruleCommit:bind(13,[state,ruleContext,ruleBuffer]),ruleFinish:bind(14,[state,ruleContext,ruleBuffer]),verdict:bind(15,[state,ruleBuffer,ruleContext,verdictBuffer]),terminate:bind(16,[state,ruleContext,ruleBuffer])}:{})}));
   const threeGroups=threeEnabled?[[contact,context,config,threeRows],[threeRows,threeResponses],[contact,threeResponses,response,threeHistory,threeRows]].map((x,i)=>bind(threeBase+i,x)):null;
   const encoder=device.createCommandEncoder(),dispatch=(p,group)=>{const pass=encoder.beginComputePass();pass.setPipeline(pipelines[p]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();},solveContact=()=>{if(threeEnabled){for(let i=0;i<3;i++)dispatch(threeBase+i,threeGroups[i]);}else dispatch(2,initial[2]);};for(let i=0;i<5;i++){if(rulesEnabled&&i===4)dispatch(16,per[0].terminate);if(i===2)solveContact();else dispatch(i,initial[i]);if(rulesEnabled&&i===2)dispatch(12,bind(12,[legacy,response,event,ruleContext,ruleBuffer]));}let current=0;
   for(let j=0;j<o.maxEvents;j++){const next=1-current;encoder.copyBufferToBuffer(states[current],0,states[next],0,count*640);dispatch(7,per[next].account);dispatch(5,per[next].scalar);dispatch(6,per[next].land);dispatch(10,per[next].pairBuild);solveContact();dispatch(11,per[next].pairMerge);if(rulesEnabled)dispatch(13,per[next].ruleCommit);dispatch(9,per[next].record);if(rulesEnabled)dispatch(16,per[next].terminate);dispatch(4,per[next].query);current=next;}
   dispatch(8,per[current].finish);if(rulesEnabled){dispatch(14,per[current].ruleFinish);dispatch(15,per[current].verdict);}if(diagnostics){encoder.copyBufferToBuffer(states[current],0,read,0,count*640);encoder.copyBufferToBuffer(stats,0,read,count*640,count*96);if(rulesEnabled)encoder.copyBufferToBuffer(ruleBuffer,0,read,count*736,count*128);if(threeEnabled)encoder.copyBufferToBuffer(threeHistory,0,read,count*(rulesEnabled?880:736),count*512);}if(rulesEnabled)encoder.copyBufferToBuffer(verdictBuffer,0,read,diagnostics?count*864:0,count*16);
   const submit=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-submit;if(signal?.aborted)throw new DOMException('Candidate cancelled','AbortError');await read.mapAsync(1);const all=new Uint32Array(read.getMappedRange()).slice();read.unmap();if(signal?.aborted)throw new DOMException('Candidate cancelled','AbortError');return {...(diagnostics?{qState:all.slice(0,count*160),stats:all.slice(count*160,count*184),...(rulesEnabled?{rules:all.slice(count*184,count*216)}:{})}:{}),...(rulesEnabled?{verdicts:all.slice(diagnostics?count*216:0,diagnostics?count*220:count*4)}:{}),...(threeEnabled&&diagnostics?{contact3DHistory:all.slice(count*(rulesEnabled?220:184))}:{}),metrics:{contactProfile:threeEnabled?"full3d-contact-planar-motion-v1":"planar-contact-v1",count,maxEvents:o.maxEvents,dispatches:6+8*o.maxEvents+(rulesEnabled?4+2*o.maxEvents:0)+(threeEnabled?2*(o.maxEvents+1):0),ruleProducer:rulesEnabled,residentCopies:o.maxEvents,intermediateReadbacks:0,hostPhysicsBetweenPhases:0,finalReadbacks:1,finalReadbackBytes:read.size,diagnostics,allocatedBytes:buffers.reduce((sum,b)=>sum+b.size,0),submitToDoneMs,fullShot:false,hardwareSpeedClaim:false}};
  }finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}
