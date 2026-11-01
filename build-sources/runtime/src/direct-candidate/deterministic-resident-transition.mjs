import {solveContact3DBridgeCPU} from './deterministic-contact-3d-bridge.mjs';
/** One GPU-resident prepared event -> real-arm contact -> full-state transition.
 * Scene is immutable and must include ALL other static bounds. No raw-shot,
 * arbitrary scene admission, projection, or continuation with stale coefficients.
 *128-word output: header16, four12-word bodies, diagnostic contact result64.
 * Header: id,status,reason,bracketLower,bracketUpper,pair,nodes,iterations,
 * NO_PASS,coefficientsDirtyMask,positiveVyMask,nextRegimeNeeded,residual,
 * stateTimeTick,ballCount,geometryChecks. Status7 is ONE transition pending
 * continuation, not full-shot completion. Positive vy is observed, not certified
 * flight: residual/contact impulses must also be checked by the next domain.
 * Body: x,y,z,vx,vy,vz,omegaX,omegaY,omegaZ,physicalR,collisionR,mass.
 * Motion coefficients are deliberately absent from resolved physical state.
 */
import {AXIAL_INTEGER_WGSL,AXIAL_INTEGER_KERNEL_WGSL,runAxialIntegerCPU,packSourceAxialCandidates,validateAxialRows,axialIntegerInterval,advanceAxialIntegerBody,multiplyWide} from './deterministic-axial.mjs';
import {CONTACT_WGSL,CONTACT_DIVISION_WGSL,runPairClothCPU,divideWide} from './deterministic-contact.mjs';
const Q=2**24,T=2**20,NONE=0xffffffff;
export function packResidentScene(scene){
 if(scene.provenance!=='prepared-finite-cloth-and-static-bounds'||![3,4].includes(scene.ballCount)||!Array.isArray(scene.staticBounds)||scene.staticBounds.length>16)throw RangeError('Explicit complete prepared scene');
 const rows=new Uint32Array(128),s=new Int32Array(rows.buffer),quantize=x=>{const v=Math.round(x*Q);if(!Number.isFinite(x)||!Number.isSafeInteger(v)||Math.abs(v)>16*Q)throw RangeError('Scene fixed-point domain');return v;};
 const values=[scene.radius,scene.mass,scene.y,scene.z,scene.clothTop,...scene.clothFootprint,scene.restitution,scene.pairFriction,scene.clothFriction].map(quantize);
 values[5]=Math.ceil(scene.clothFootprint[0]*Q);values[6]=Math.floor(scene.clothFootprint[1]*Q);values[7]=Math.ceil(scene.clothFootprint[2]*Q);values[8]=Math.floor(scene.clothFootprint[3]*Q);
 if(scene.clothFootprint?.length!==4||values[0]<4096||values[1]<=0||values[2]-values[4]>values[0]||2*(values[2]-values[4])<=values[0]||values[5]>=values[6]||values[7]>=values[8]||values.slice(9).some(x=>x<0||x>Q))throw RangeError('Scene support/material domain');
 const iterations=scene.maxIterations??64,tolerance=scene.residualBudgetQuanta??16;
 if(!Number.isInteger(iterations)||iterations<1||iterations>128||!Number.isInteger(tolerance)||tolerance<1||tolerance>256)throw RangeError('Contact work/residual budget');
 const motion=scene.motionMaterial;
 if(!motion||motion.clothFriction!==scene.clothFriction)throw RangeError('Explicit consistent motion material');
 const motionValues=[motion.gravity,motion.normalLoadGravity??motion.gravity,motion.patchCapGravity??motion.gravity,motion.clothFriction,motion.rollingLength,motion.spinLength].map(quantize);
 if(motionValues[0]<=0||motionValues[1]<=0||motionValues.slice(2).some(x=>x<0)||motionValues[3]>Q)throw RangeError('Motion material domain');
 rows.set([1,scene.ballCount],0);s.set(values,2);s.set(motionValues,17);rows[23]=1;rows[14]=iterations;rows[15]=tolerance;rows[16]=scene.staticBounds.length;
 scene.staticBounds.forEach((box,i)=>{
  if(!Array.isArray(box)||box.length!==3||box.some(axis=>!Array.isArray(axis)||axis.length!==2||!axis.every(Number.isFinite)||axis[0]>axis[1]))throw RangeError('Actual conservative static AABB');
  const b=box.flatMap(([lo,hi])=>[Math.floor(lo*Q),Math.ceil(hi*Q)]);if(b.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>16*Q))throw RangeError('Static integer domain');s.set(b,32+i*6);
 });return rows;
}
/** Public entry point: reject scene mismatches before axial packing discards
 * Y/Z/mass/material metadata. Low-level rows require this trusted producer contract.
 */
export function packResidentCandidates(candidates,sceneDefinition){
 const scene=packResidentScene(sceneDefinition),m=sceneDefinition.motionMaterial;
 const normalized=x=>[x.gravity,x.normalLoadGravity??x.gravity,x.patchCapGravity??x.gravity,x.clothFriction,x.rollingLength,x.spinLength];
 for(const c of candidates){
  if(c.bodies?.length!==sceneDefinition.ballCount||!c.material||normalized(c.material).some((x,i)=>x!==normalized(m)[i])||c.bodies.some(b=>b.position[1]!==sceneDefinition.y||b.position[2]!==sceneDefinition.z||b.mass!==sceneDefinition.mass||b.radius!==sceneDefinition.radius))throw RangeError('Candidate/immutable-scene mismatch');
 }
 return {...packSourceAxialCandidates(candidates),scene};
}
function validateScene(scene){
 if(!(scene instanceof Uint32Array)||scene.length!==128||scene[0]!==1||![3,4].includes(scene[1])||scene[16]>16)throw TypeError('Packed immutable scene');
 const s=new Int32Array(scene.buffer,scene.byteOffset,scene.length),r=s[2],height=s[4]-s[6];
 if(Array.from(s.slice(2,14)).some(x=>Math.abs(x)>16*Q)||r<4096||s[3]<=0||height>r||2*height<=r||s[7]>=s[8]||s[9]>=s[10]||Array.from(s.slice(11,14)).some(x=>x<0||x>Q)||scene[14]<1||scene[14]>128||scene[15]<1||scene[15]>256)throw RangeError('Invalid packed scene');
 if(Array.from(s.slice(17,23)).some(x=>x<0||x>16*Q)||s[17]<=0||s[18]<=0||s[20]!==s[13]||scene[23]!==1)throw RangeError('Packed motion material');
 for(let j=24;j<32;j++)if(scene[j]!==0)throw RangeError('Reserved scene word');
 for(let i=0;i<16;i++)for(let j=0;j<3;j++){const at=32+i*6+j*2;if(Math.abs(s[at])>16*Q||Math.abs(s[at+1])>16*Q||s[at]>s[at+1]||(i>=scene[16]&&(s[at]!==0||s[at+1]!==0)))throw RangeError('Packed static bounds');}
}
export {validateScene as validateResidentScene};
const ceilProduct=(a,t)=>{const [lo,hi]=multiplyWide(a,t);return ((hi<<12)|(lo>>>20))+(lo&0xfffff?1:0);};
function surface(w,r){const [lo,hi]=multiplyWide(Math.abs(w),r);if(hi>65536||(hi===65536&&lo!==0))return null;const magnitude=((hi<<12)|(lo>>>20))>>>0;return w>0?-(magnitude+((lo&0xfffff)!==0?1:0)):magnitude;}
function omega(c,r){const [lo,hi]=multiplyWide(Math.abs(c),T),d=divideWide(lo,hi,r);if(!d.valid)return null;const value=d.quotient+(d.remainder>=Math.ceil(r/2)?1:0);return value>0x7fffffff?null:c>0?-value:value;}
export function runResidentTransitionCPU(original,scene,{merge=true,contact3D=false,clothRestitutionQ=undefined}={}){
 if(contact3D&&(!Number.isInteger(clothRestitutionQ)||clothRestitutionQ<0||clothRestitutionQ>16777216))throw RangeError('Explicit Q24 cloth restitution required');
 if(contact3D&&merge)throw RangeError('3D contact requires q-state admission');
 validateAxialRows(original);validateScene(scene);const events=runAxialIntegerCPU(original),contacts=new Uint32Array(original.length/48*64),state=new Uint32Array(original.length/48*128),o=new Int32Array(original.buffer,original.byteOffset,original.length),e=new Int32Array(events.buffer),sc=new Int32Array(scene.buffer,scene.byteOffset,scene.length),f=new Int32Array(state.buffer),cp=new Int32Array(contacts.buffer);
 for(let k=0;k<original.length/48;k++){
  const b=k*48,out=k*128,packet=k*64,n=original[b+1],lower=events[b+3],upper=events[b+4];let reason=0,checks=0;
  state.set([original[b],4,1,lower,upper,events[b+5],events[b+6],0,NONE,0,0,0,NONE,lower,n,0],out);
  contacts[packet]=original[b]; // Invalid packet until every guard succeeds.
  for(let i=0;i<Math.min(n,4);i++){const at=b+8+i*10,to=out+16+i*12;f.set([e[at],sc[4],sc[5],e[at+1],0,0,e[at+3],e[at+4],e[at+5],sc[2],o[at+9],sc[3]],to);}
  if(events[b+1]!==1){if(events[b+1]===4||events[b+1]===5){state[out+1]=events[b+1];state[out+2]=events[b+2];}continue;}
  if(n!==scene[1]||upper-lower!==1||upper>original[b+2])reason=2;
  const pair=events[b+5],ia=pair>>>2,ib=pair&3;if(ia>=n||ib>=n||ia>=ib)reason=2;
  const r=sc[2],y=sc[4],z=sc[5],relY=y-sc[6];
  for(let i=0;i<n&&i<4;i++){
   const at=b+8+i*10;if(o[at+9]!==r||o[at+3]!==0||o[at+4]!==0||o[at+6]!==0||o[at+7]!==0)reason=3;
   const x=axialIntegerInterval(o[at],o[at+1],o[at+2],0,upper),lo=x[0]-r-4,hi=x[1]+r+4;checks++;
   if(lo<=sc[7]||hi>=sc[8]||z-r-4<=sc[9]||z+r+4>=sc[10])reason=4;
   for(let j=0;j<scene[16];j++){const at=32+j*6;checks++;if(!(hi<sc[at]||lo>sc[at+1]||y+r+4<sc[at+2]||y-r-4>sc[at+3]||z+r+4<sc[at+4]||z-r-4>sc[at+5]))reason=4;}
  }
  for(let i=0;i<n&&i<4;i++)for(let j=i+1;j<n;j++){if(i===ia&&j===ib)continue;const a=b+8+i*10,c=b+8+j*10,d=axialIntegerInterval(o[c]-o[a],o[c+1]-o[a+1],o[c+2]-o[a+2],0,upper);checks++;if(d[0]<=2*r+8&&d[1]>=-2*r-8)reason=5;}
  state[out+15]=checks;if(reason){state[out+2]=reason;continue;}
  const bodies=Array.from({length:n},(_,i)=>advanceAxialIntegerBody(o,b+8+i*10,upper)),a=bodies[ia],c=bodies[ib];
  const left=a[0]<=c[0]?ia:ib,right=left===ia?ib:ia,A=bodies[left],B=bodies[right];
  const dv=Math.abs(o[b+9+ib*10]-o[b+9+ia*10]),da=Math.abs(o[b+10+ib*10]-o[b+10+ia*10]);
  const speedBound=dv+ceilProduct(2*da,upper),penetrationBound=ceilProduct(speedBound,upper-lower)+4,penetration=2*r-(B[0]-A[0]);
  const ca=surface(A[5],r),cb=surface(B[5],r);
  if(penetration<0||penetration>penetrationBound||ca===null||cb===null){state[out+2]=6;continue;}
  for(let i=0;i<n;i++){const at=out+16+i*12;f[at]=bodies[i][0];f[at+3]=bodies[i][1];f[at+8]=bodies[i][5];}
  contacts.set([original[b],scene[14],scene[15],1],packet);cp.set([r,A[0],B[0],relY,A[0]+Math.floor((B[0]-A[0])/2),Math.floor((relY-r)/2),sc[11],sc[12],sc[13],Math.max(penetrationBound,r-relY)],packet+4);
  contacts.set([lower,upper],packet+14);cp.set([A[1],0,ca,B[1],0,cb,sc[3]],packet+16);
  state[out+1]=0;state[out+2]=0;state[out+5]=left*4+right;state[out+13]=upper;state[out+9]=(1<<left)|(1<<right);state[out+11]=1;
 }
 const three=contact3D?solveContact3DBridgeCPU(contacts,scene,clothRestitutionQ):null,responses=three?three.responses:runPairClothCPU(contacts),rs=new Int32Array(responses.buffer);
 if(!merge)return {state,events,contacts,responses,...(three?three:{})};
 for(let k=0;k<original.length/48;k++){
  const out=k*128,b=k*64;state.set(responses.subarray(b,b+64),out+64);if(state[out+1]!==0)continue;
  state[out+7]=responses[b+3];state[out+12]=responses[b+24];
  if(responses[b+1]!==1){state[out+1]=responses[b+1];state[out+2]=7;continue;}
  const left=state[out+5]>>>2,right=state[out+5]&3,wa=omega(rs[b+18],sc[2]),wb=omega(rs[b+21],sc[2]);
  if(wa===null||wb===null){state[out+1]=4;state[out+2]=8;continue;}
  for(const [i,index,w] of [[left,16,wa],[right,19,wb]]){const at=out+16+i*12;f[at+3]=rs[b+index];f[at+4]=rs[b+index+1];f[at+8]=w;if(rs[b+index+1]>0)state[out+10]|=1<<i;}
  state[out+1]=7;state[out+2]=9;state[out+9]=(1<<left)|(1<<right);state[out+11]=1;
 }return {state,events,contacts,responses};
}
export const RESIDENT_BUILD_WGSL=`
@group(0) @binding(0) var<storage,read> original:array<u32>;
@group(0) @binding(1) var<storage,read> events:array<u32>;
@group(0) @binding(2) var<storage,read> scene:array<u32>;
@group(0) @binding(3) var<storage,read_write> contacts:array<u32>;
@group(0) @binding(4) var<storage,read_write> state:array<u32>;
${AXIAL_INTEGER_KERNEL_WGSL}
fn ov(at:u32)->i32{return bitcast<i32>(original[at]);}
fn sv(at:u32)->i32{return bitcast<i32>(scene[at]);}
fn ev(at:u32)->i32{return bitcast<i32>(events[at]);}
fn surfaceC(w:i32,r:i32)->vec2<i32>{
 let p=wide(u32(abs(w)),u32(r));if(p.y>65536u||(p.y==65536u&&p.x!=0u)){return vec2<i32>(0,0);}
 return vec2<i32>(term(-w,u32(r),20u,false),1);
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*48u;if(b>=arrayLength(&original)){return;}let out=gid.x*128u;let packet=gid.x*64u;
 for(var j=0u;j<128u;j++){state[out+j]=0u;}for(var j=0u;j<64u;j++){contacts[packet+j]=0u;}
 let n=original[b+1u];let lower=events[b+3u];let upper=events[b+4u];var reason=0u;var checks=0u;
 state[out]=original[b];state[out+1u]=4u;state[out+2u]=1u;state[out+3u]=lower;state[out+4u]=upper;state[out+5u]=events[b+5u];state[out+6u]=events[b+6u];state[out+8u]=0xffffffffu;state[out+12u]=0xffffffffu;state[out+13u]=lower;state[out+14u]=n;contacts[packet]=original[b];
 for(var i=0u;i<min(n,4u);i++){
  let at=b+8u+i*10u;let to=out+16u+i*12u;state[to]=events[at];state[to+1u]=scene[4];state[to+2u]=scene[5];state[to+3u]=events[at+1u];state[to+6u]=events[at+3u];state[to+7u]=events[at+4u];state[to+8u]=events[at+5u];state[to+9u]=scene[2];state[to+10u]=original[at+9u];state[to+11u]=scene[3];
 }
 if(events[b+1u]!=1u){if(events[b+1u]==4u||events[b+1u]==5u){state[out+1u]=events[b+1u];state[out+2u]=events[b+2u];}return;}
 if(n!=scene[1]||upper-lower!=1u||upper>original[b+2u]){reason=2u;}
 let pair=events[b+5u];let ia=pair>>2u;let ib=pair&3u;if(ia>=n||ib>=n||ia>=ib){reason=2u;}
 let r=sv(2u);let y=sv(4u);let z=sv(5u);let relY=y-sv(6u);
 for(var i=0u;i<min(n,4u);i++){
  let at=b+8u+i*10u;if(ov(at+9u)!=r||ov(at+3u)!=0||ov(at+4u)!=0||ov(at+6u)!=0||ov(at+7u)!=0){reason=3u;}
  let x=bounds(ov(at),ov(at+1u),ov(at+2u),0u,upper);let lo=x.x-r-4;let hi=x.y+r+4;checks++;
  if(lo<=sv(7u)||hi>=sv(8u)||z-r-4<=sv(9u)||z+r+4>=sv(10u)){reason=4u;}
  for(var j=0u;j<scene[16];j++){let at=32u+j*6u;checks++;
   if(!(hi<sv(at)||lo>sv(at+1u)||y+r+4<sv(at+2u)||y-r-4>sv(at+3u)||z+r+4<sv(at+4u)||z-r-4>sv(at+5u))){reason=4u;}
  }
 }
 for(var i=0u;i<min(n,4u);i++){for(var j=i+1u;j<n;j++){
  if(i==ia&&j==ib){continue;}let a=b+8u+i*10u;let c=b+8u+j*10u;let d=bounds(ov(c)-ov(a),ov(c+1u)-ov(a+1u),ov(c+2u)-ov(a+2u),0u,upper);checks++;
  if(d.x<=2*r+8&&d.y>= -2*r-8){reason=5u;}
 }}
 state[out+15u]=checks;if(reason!=0u){state[out+2u]=reason;return;}
 var bodies:array<array<i32,10>,4>;
 for(var i=0u;i<n;i++){
  let at=b+8u+i*10u;for(var j=0u;j<10u;j++){bodies[i][j]=ov(at+j);}
  bodies[i][0]=ov(at)+term(ov(at+1u),upper,20u,false)+term(ov(at+2u),upper*upper,40u,false);
  bodies[i][1]=ov(at+1u)+term(2*ov(at+2u),upper,20u,false);
  for(var j=3u;j<6u;j++){bodies[i][j]=ov(at+j)+term(ov(at+j+3u),upper,20u,false);}
 }
 let left=select(ib,ia,bodies[ia][0]<=bodies[ib][0]);let right=select(ia,ib,left==ia);let a=bodies[left];let c=bodies[right];
 let dv=abs(ov(b+9u+ib*10u)-ov(b+9u+ia*10u));let da=abs(ov(b+10u+ib*10u)-ov(b+10u+ia*10u));
 let speedBound=dv+term(2*da,upper,20u,true);let penetrationBound=term(speedBound,upper-lower,20u,true)+4;let penetration=2*r-(c[0]-a[0]);
 let ca=surfaceC(a[5],r);let cb=surfaceC(c[5],r);
 if(penetration<0||penetration>penetrationBound||ca.y==0||cb.y==0){state[out+2u]=6u;return;}
 for(var i=0u;i<n;i++){let at=out+16u+i*12u;state[at]=bitcast<u32>(bodies[i][0]);state[at+3u]=bitcast<u32>(bodies[i][1]);state[at+8u]=bitcast<u32>(bodies[i][5]);}
 contacts[packet]=original[b];contacts[packet+1u]=scene[14];contacts[packet+2u]=scene[15];contacts[packet+3u]=1u;
 contacts[packet+4u]=scene[2];contacts[packet+5u]=bitcast<u32>(a[0]);contacts[packet+6u]=bitcast<u32>(c[0]);contacts[packet+7u]=bitcast<u32>(relY);
 contacts[packet+8u]=bitcast<u32>(a[0]+(c[0]-a[0])/2);contacts[packet+9u]=bitcast<u32>((relY-r)>>1u);
 contacts[packet+10u]=scene[11];contacts[packet+11u]=scene[12];contacts[packet+12u]=scene[13];contacts[packet+13u]=bitcast<u32>(max(penetrationBound,r-relY));contacts[packet+14u]=lower;contacts[packet+15u]=upper;
 contacts[packet+16u]=bitcast<u32>(a[1]);contacts[packet+18u]=bitcast<u32>(ca.x);contacts[packet+19u]=bitcast<u32>(c[1]);contacts[packet+21u]=bitcast<u32>(cb.x);contacts[packet+22u]=scene[3];
 state[out+1u]=0u;state[out+2u]=0u;state[out+5u]=left*4u+right;state[out+13u]=upper;state[out+9u]=(1u<<left)|(1u<<right);state[out+11u]=1u;
}`;
export const RESIDENT_MERGE_WGSL=`
@group(0) @binding(0) var<storage,read> responses:array<u32>;
@group(0) @binding(1) var<storage,read_write> state:array<u32>;
@group(0) @binding(2) var<storage,read> scene:array<u32>;
${CONTACT_DIVISION_WGSL}
fn toOmega(c:i32,r:u32)->vec2<i32>{
 let p=wide(u32(abs(c)),1048576u);let d=divideWide(p.x,p.y,r);if(d.z==0u||d.x>0x7fffffffu){return vec2<i32>(0,0);}
 let value=d.x+select(0u,1u,d.y>=(r>>1u)+(r&1u));if(value>0x7fffffffu){return vec2<i32>(0,0);}return vec2<i32>(select(i32(value),-i32(value),c>0),1);
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*64u;if(b>=arrayLength(&responses)){return;}let out=gid.x*128u;
 for(var j=0u;j<64u;j++){state[out+64u+j]=responses[b+j];}if(state[out+1u]!=0u){return;}
 state[out+7u]=responses[b+3u];state[out+12u]=responses[b+24u];if(responses[b+1u]!=1u){state[out+1u]=responses[b+1u];state[out+2u]=7u;return;}
 let left=state[out+5u]>>2u;let right=state[out+5u]&3u;let wa=toOmega(bitcast<i32>(responses[b+18u]),scene[2]);let wb=toOmega(bitcast<i32>(responses[b+21u]),scene[2]);
 if(wa.y==0||wb.y==0){state[out+1u]=4u;state[out+2u]=8u;return;}
 let a=out+16u+left*12u;let c=out+16u+right*12u;state[a+3u]=responses[b+16u];state[a+4u]=responses[b+17u];state[a+8u]=bitcast<u32>(wa.x);state[c+3u]=responses[b+19u];state[c+4u]=responses[b+20u];state[c+8u]=bitcast<u32>(wb.x);
 if(bitcast<i32>(responses[b+17u])>0){state[out+10u]|=1u<<left;}if(bitcast<i32>(responses[b+20u])>0){state[out+10u]|=1u<<right;}
 state[out+1u]=7u;state[out+2u]=9u;state[out+9u]=(1u<<left)|(1u<<right);state[out+11u]=1u;
}`;
export async function createResidentTransitionGPU(device){
 const shaders=[AXIAL_INTEGER_WGSL,RESIDENT_BUILD_WGSL,CONTACT_WGSL,RESIDENT_MERGE_WGSL],pipelines=[],start=performance.now();device.pushErrorScope('validation');
 try{for(const code of shaders){const module=device.createShaderModule({code}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:shaders.map(code=>new TextEncoder().encode(code).length),async run(original,scene,{diagnostic=false}={}){
  validateAxialRows(original);validateScene(scene);const count=original.length/48,buffers=[],alloc=(bytes,usage)=>{const b=device.createBuffer({size:bytes,usage});buffers.push(b);return b;};device.pushErrorScope('validation');
  try{
   const input=alloc(original.byteLength,128|8),event=alloc(count*192,128|4),context=alloc(512,128|8),contact=alloc(count*256,128|4),response=alloc(count*256,128|4),state=alloc(count*512,128|4);
   const readBytes=count*(diagnostic?1216:512),read=alloc(readBytes,1|8);
   device.queue.writeBuffer(input,0,original);device.queue.writeBuffer(context,0,scene);
   const resources=[[input,event],[input,event,context,contact,state],[contact,response],[response,state,context]],groups=resources.map((list,i)=>device.createBindGroup({layout:pipelines[i].getBindGroupLayout(0),entries:list.map((buffer,binding)=>({binding,resource:{buffer}}))}));
   const encoder=device.createCommandEncoder();
   for(let i=0;i<4;i++){const pass=encoder.beginComputePass();pass.setPipeline(pipelines[i]);pass.setBindGroup(0,groups[i]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();}
   encoder.copyBufferToBuffer(state,0,read,0,count*512);
   if(diagnostic){encoder.copyBufferToBuffer(event,0,read,count*512,count*192);encoder.copyBufferToBuffer(contact,0,read,count*704,count*256);encoder.copyBufferToBuffer(response,0,read,count*960,count*256);}
   const submitted=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-submitted;
   await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   return {state:words.slice(0,count*128),events:diagnostic?words.slice(count*128,count*176):null,contacts:diagnostic?words.slice(count*176,count*240):null,responses:diagnostic?words.slice(count*240):null,
    metrics:{count,dispatches:4,intermediateReadbacks:0,hostPhysicsBetweenPhases:0,finalReadbacks:1,immutableSceneBytes:512,allocatedBytes:512+count*(192+192+256+256+512)+readBytes,readbackBytes:readBytes,submitToDoneMs,physicalAcceptance:false,fullShot:false,hardwareSpeedClaim:false}};
  }finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}
