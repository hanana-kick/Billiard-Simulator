// SPDX-License-Identifier: Apache-2.0
// Direct native-f32 port of PhysicsLab.compliantTipContact (physics.js:174-209).
// Native velocity/impulse boundaries follow Rapier b716d375; see vendor/RAPIER-LICENSE.txt.
// No bytecode, graph executor, target ball velocity, or whole-world claim.
import {CUE_LAYOUT, DIRECT_REASON, DIRECT_STATUS, NO_PASS} from './layout.mjs';
export const CUE_SLICE_PRECISION = Object.freeze({
  profile: 'native-f32-direct-compliant-tip-component-v1',
  unitRoundoff: 2 ** -24, branchGuardUnits: 16,
  branchGuardIsProof: false, physicalAcceptance: false,
  nearThreshold: 'unsupported; unchanged semantic input',
  sourceJsNumberApproximation: true,
  observableTolerance: Object.freeze({relative: 2e-4, linearAbsolute: 2e-5, angularAbsolute: 2e-4, tangentAbsolute: 2e-8}),
});
const BODY_WGSL = `
struct DcBody { position:vec3<f32>, worldCom:vec3<f32>, linear:vec3<f32>, angular:vec3<f32>, invMass:vec3<f32>, ii0:vec3<f32>, ii1:vec3<f32> }
struct DcContact { tangent:vec3<f32>, engaged:u32, normalForce:f32, compression:f32, sliding:u32 }
@group(0) @binding(0) var<storage,read> dc_material:array<u32>;
@group(0) @binding(1) var<storage,read_write> dc_rows:array<u32>;
fn dc_f(at:u32)->f32{return bitcast<f32>(dc_rows[at]);}
fn dc_v(at:u32)->vec3<f32>{return vec3<f32>(dc_f(at),dc_f(at+1u),dc_f(at+2u));}
fn dc_store(at:u32,v:vec3<f32>){dc_rows[at]=bitcast<u32>(v.x);dc_rows[at+1u]=bitcast<u32>(v.y);dc_rows[at+2u]=bitcast<u32>(v.z);}
fn dc_dot(a:vec3<f32>,b:vec3<f32>)->f32{return (a.x*b.x+a.y*b.y)+a.z*b.z;}
fn dc_cross(a:vec3<f32>,b:vec3<f32>)->vec3<f32>{return vec3<f32>(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
fn dc_length(v:vec3<f32>)->f32{return sqrt(dc_dot(v,v));}
fn dc_finite(x:f32)->bool{return (bitcast<u32>(x)&0x7f800000u)!=0x7f800000u;}
fn dc_finite3(v:vec3<f32>)->bool{return dc_finite(v.x)&&dc_finite(v.y)&&dc_finite(v.z);}
fn dc_body(at:u32)->DcBody{return DcBody(dc_v(at),dc_v(at+4u),dc_v(at+8u),dc_v(at+12u),dc_v(at+16u),dc_v(at+20u),dc_v(at+23u));}
fn dc_velocity(b:DcBody,p:vec3<f32>)->vec3<f32>{return b.linear+dc_cross(b.angular,p-b.worldCom);}
fn dc_apply_linear(body:DcBody,q:vec3<f32>)->DcBody{var b=body;if(any(q!=vec3<f32>(0.0))){b.linear=b.linear+q*b.invMass;}return b;}
fn dc_apply_point(body:DcBody,q:vec3<f32>,p:vec3<f32>)->DcBody{
 var b=dc_apply_linear(body,q);let torque=dc_cross(p-b.worldCom,q);
 if(any(torque!=vec3<f32>(0.0))){
  let change=vec3<f32>(dc_dot(b.ii0,torque),dc_dot(vec3<f32>(b.ii0.y,b.ii1.x,b.ii1.y),torque),dc_dot(vec3<f32>(b.ii0.z,b.ii1.y,b.ii1.z),torque));
  b.angular=b.angular+change;
 }return b;
}
fn dc_reject(base:u32,reason:u32,mask:u32){dc_rows[base+1u]=4u;dc_rows[base+2u]=reason;dc_rows[base+3u]=0xffffffffu;dc_rows[base+10u]=mask;}
`;
export function generateDirectCueWGSL({workgroupSize = 32} = {}) {
  if (![1,8,16,32,64].includes(workgroupSize)) throw new RangeError('Explicit direct candidate workgroup size');
  return BODY_WGSL + `
@compute @workgroup_size(${workgroupSize}) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let base=gid.x*256u;if(gid.x>=arrayLength(&dc_rows)/256u){return;}
 if(dc_rows[base+1u]!=0u){return;}
 if(arrayLength(&dc_material)!=16u||dc_rows[base+6u]!=4u||dc_rows[base+11u]>=4u||dc_rows[base+4u]>1u||dc_rows[base+5u]>1u){dc_reject(base,14u,0u);return;}
 for(var i=0u;i<8u;i++){let p=bitcast<f32>(dc_material[i]);if(!dc_finite(p)||p<0.0){dc_reject(base,14u,0u);return;}}
 let tipRadius=bitcast<f32>(dc_material[0]);let kn=bitcast<f32>(dc_material[1]);let dn=bitcast<f32>(dc_material[2]);
 let kt=bitcast<f32>(dc_material[3]);let dt=bitcast<f32>(dc_material[4]);let mu=bitcast<f32>(dc_material[5]);
 let kl=bitcast<f32>(dc_material[6]);let dl=bitcast<f32>(dc_material[7]);let axis=dc_v(base+12u);let h=dc_f(base+16u);
 if(!dc_finite3(axis)||!dc_finite(h)||h<=0.0||tipRadius<=0.0||abs(dc_dot(axis,axis)-1.0)>0.00001){dc_reject(base,14u,0u);return;}
 var bodies:array<DcBody,6>;var contacts:array<DcContact,4>;
 for(var i=0u;i<6u;i++){
  let p=base+32u+i*32u;let b=dc_body(p);
  if(!dc_finite3(b.position)||!dc_finite3(b.worldCom)||!dc_finite3(b.linear)||!dc_finite3(b.angular)||!dc_finite3(b.invMass)||!dc_finite3(b.ii0)||!dc_finite3(b.ii1)||any(b.invMass<vec3<f32>(0.0))){dc_reject(base,14u,0u);return;}
  bodies[i]=b;
 }
 for(var i=0u;i<4u;i++){
  let p=base+224u+i*8u;let engaged=dc_rows[p+3u];let radius=dc_f(base+32u+i*32u+26u);
  if(engaged>1u||(engaged==1u&&dc_rows[base+5u]==0u)||!dc_finite3(dc_v(p))||!dc_finite(radius)||radius<=0.0){dc_reject(base,14u,0u);return;}
  contacts[i]=DcContact(dc_v(p),engaged,0.0,0.0,0u);
 }
 var contacted=dc_rows[base+5u];var births=0u;var obstructions=0u;var remove=0u;
 if(dc_rows[base+4u]!=0u){
  // Complete lateral prefix precedes every sphere and affects subsequent tip velocity.
  let a=bodies[4u].position;let d=a-bodies[5u].position;let lateral=d-axis*dc_dot(d,axis);
  let rv=dc_velocity(bodies[4u],a)-dc_velocity(bodies[5u],a);let vl=rv-axis*dc_dot(rv,axis);
  let spring=(lateral*(-kl)+vl*(-dl))*h;
  bodies[4u]=dc_apply_linear(bodies[4u],spring);bodies[5u]=dc_apply_point(bodies[5u],-spring,a);
  var touching=false;
  for(var i=0u;i<4u;i++){
   let radius=dc_f(base+32u+i*32u+26u);let delta=bodies[i].position-a;let distance=dc_length(delta);
   let compression=(radius+tipRadius)-distance;
   if(!dc_finite(distance)||!dc_finite(compression)){dc_reject(base,5u,0u);return;}
   // Explicit conservative local guard; not a global error theorem.
   let compressionGuard=0.00000095367431640625*(abs(radius)+abs(tipRadius)+abs(distance));
   if(abs(compression)<=compressionGuard||distance<=0.000000002){dc_reject(base,13u,1u<<i);return;}
   contacts[i].compression=compression;
   if(compression<=0.0||distance<0.000000001){contacts[i].engaged=0u;contacts[i].tangent=vec3<f32>(0.0);continue;}
   touching=true;let n=delta*(1.0/distance);let point=a+n*(tipRadius-compression*0.5);
   if(contacts[i].engaged==0u){contacts[i].tangent=vec3<f32>(0.0);contacts[i].engaged=1u;contacted=1u;births|=1u<<i;if(i!=dc_rows[base+11u]){obstructions|=1u<<i;}}
   let relative=dc_velocity(bodies[i],point)-dc_velocity(bodies[4u],point);let vn=dc_dot(relative,n);let vt=relative-n*vn;
   let elastic=kn*compression;let damp=dn*vn;let normal=max(0.0,elastic-damp);
   let normalGuard=0.00000095367431640625*(abs(elastic)+abs(damp));
   if(abs(elastic-damp)<=normalGuard&&normalGuard>0.0){dc_reject(base,13u,16u<<i);return;}
   var tangent=(contacts[i].tangent-n*dc_dot(contacts[i].tangent,n))+vt*h;
   var ft=tangent*(-kt)+vt*(-dt);let limit=mu*normal;let magnitude=dc_length(ft);
   if(!dc_finite(normal)||!dc_finite(limit)||!dc_finite(magnitude)){dc_reject(base,5u,0u);return;}
   let slipGuard=0.00000095367431640625*(abs(magnitude)+abs(limit));
   if(abs(magnitude-limit)<=slipGuard&&slipGuard>0.0){dc_reject(base,13u,256u<<i);return;}
   if(magnitude>limit){
    if(magnitude>0.0){ft=ft*(limit/magnitude);}else{ft=vec3<f32>(0.0);}
    if(kt>0.0){tangent=(ft+vt*dt)*(-1.0/kt);}else{tangent=vec3<f32>(0.0);}
    contacts[i].sliding=1u;
   }
   let impulse=(n*normal+ft)*h;
   bodies[i]=dc_apply_point(bodies[i],impulse,point);bodies[4u]=dc_apply_point(bodies[4u],-impulse,point);
   contacts[i].normalForce=normal;contacts[i].tangent=tangent;
  }
  if(contacted!=0u&&!touching){remove=1u;}
 }
 // Transactional semantic commit: failure never leaks partly updated bodies.
 for(var i=0u;i<6u;i++){if(!dc_finite3(bodies[i].linear)||!dc_finite3(bodies[i].angular)){dc_reject(base,5u,0u);return;}}
 for(var i=0u;i<4u;i++){if(!dc_finite3(contacts[i].tangent)){dc_reject(base,5u,0u);return;}}
 for(var i=0u;i<6u;i++){let p=base+32u+i*32u;dc_store(p+8u,bodies[i].linear);dc_store(p+12u,bodies[i].angular);}
 for(var i=0u;i<4u;i++){let p=base+224u+i*8u;dc_store(p,contacts[i].tangent);dc_rows[p+3u]=contacts[i].engaged;dc_rows[p+4u]=bitcast<u32>(contacts[i].normalForce);dc_rows[p+5u]=bitcast<u32>(contacts[i].compression);dc_rows[p+6u]=contacts[i].sliding;}
 dc_rows[base+5u]=contacted;dc_rows[base+7u]=births;dc_rows[base+8u]=obstructions;dc_rows[base+9u]=remove;
 // A removal request is not a completed joint/world transaction; cuePresent stays unchanged.
 dc_rows[base+1u]=5u;dc_rows[base+2u]=6u;dc_rows[base+3u]=0xffffffffu;
}
`;
}

// Direct scalar f32 mirror for fast component tests only, never a runtime fallback.
export function evaluateCueSliceF32ForTest(shared, input, {testOnly = false} = {}) {
  if (!testOnly) throw new Error('TEST-ONLY direct scalar mirror');
  if (!(shared instanceof Uint32Array) || shared.length !== 16 || !(input instanceof Uint32Array) || input.length % 256) throw new TypeError('Direct component buffers');
  const out = input.slice(), view = new Float32Array(out.buffer), m = new Float32Array(shared.buffer,shared.byteOffset,16), f=Math.fround;
  const add=(a,b)=>a.map((x,i)=>f(x+b[i])), sub=(a,b)=>a.map((x,i)=>f(x-b[i])), scale=(a,s)=>a.map(x=>f(x*s));
  const dot=(a,b)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
  const cross=(a,b)=>[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
  const length=a=>f(Math.sqrt(dot(a,a))), finite=a=>a.every(Number.isFinite), neg=a=>a.map(x=>-x);
  const velocity=(b,p)=>add(b.linear,cross(b.angular,sub(p,b.worldCom)));
  const apply=(b,q,p)=>{
    if(q.some(x=>x!==0))b.linear=add(b.linear,q.map((x,i)=>f(x*b.invMass[i])));
    if(p){const t=cross(sub(p,b.worldCom),q);if(t.some(x=>x!==0)){const ii=b.invInertia;b.angular=add(b.angular,[[0,1,2],[1,3,4],[2,4,5]].map(r=>dot(r.map(i=>ii[i]),t)));}}
  };
  for(let base=0;base<out.length;base+=256){
    if(out[base+1]!==0)continue;
    const reject=(reason,mask=0)=>{out[base+1]=4;out[base+2]=reason;out[base+3]=NO_PASS;out[base+10]=mask;};
    const get=(at,n=3)=>Array.from(view.subarray(base+at,base+at+n));
    const axis=get(12),h=view[base+16];
    if(out[base+6]!==4||out[base+11]>=4||out[base+4]>1||out[base+5]>1||!Array.from(m.slice(0,8)).every(x=>Number.isFinite(x)&&x>=0)||m[0]<=0||!finite(axis)||!Number.isFinite(h)||h<=0||Math.abs(f(dot(axis,axis)-1))>f(.00001)){reject(14);continue;}
    const bs=Array.from({length:6},(_,i)=>Object.fromEntries(['position','worldCom','linear','angular','invMass','invInertia'].map(k=>[k,get(32+i*32+CUE_LAYOUT.body[k],k==='invInertia'?6:3)])));
    const cs=Array.from({length:4},(_,i)=>({tangent:get(224+i*8),active:out[base+227+i*8],normalForce:0,compression:0,sliding:0}));
    if(bs.some(b=>Object.values(b).some(v=>!finite(v))||b.invMass.some(x=>x<0))||cs.some((c,i)=>c.active>1||(c.active&&!out[base+5])||!finite(c.tangent)||!Number.isFinite(view[base+58+i*32])||view[base+58+i*32]<=0)){reject(14);continue;}
    let contacted=out[base+5],births=0,obstructions=0,remove=0,failed=false;
    if(out[base+4]){
      const a=bs[4].position,d=sub(a,bs[5].position),lateral=sub(d,scale(axis,dot(d,axis))),rv=sub(velocity(bs[4],a),velocity(bs[5],a)),vl=sub(rv,scale(axis,dot(rv,axis)));
      const spring=scale(add(scale(lateral,-m[6]),scale(vl,-m[7])),h);apply(bs[4],spring);apply(bs[5],neg(spring),a);let touching=false;
      for(let i=0;i<4;i++){
        const radius=view[base+58+i*32],delta=sub(bs[i].position,a),distance=length(delta),compression=f(f(radius+m[0])-distance),guard=f((2**-20)*f(f(Math.abs(radius)+Math.abs(m[0]))+Math.abs(distance)));
        if(!Number.isFinite(distance)||!Number.isFinite(compression)){reject(5);failed=true;break;}
        if(Math.abs(compression)<=guard||distance<=f(2e-9)){reject(13,1<<i);failed=true;break;}
        cs[i].compression=compression;
        if(compression<=0||distance<f(1e-9)){cs[i].active=0;cs[i].tangent=[0,0,0];continue;}
        touching=true;const n=scale(delta,f(1/distance)),point=add(a,scale(n,f(m[0]-f(compression*.5))));
        if(!cs[i].active){cs[i].tangent=[0,0,0];cs[i].active=1;contacted=1;births|=1<<i;if(i!==out[base+11])obstructions|=1<<i;}
        const relative=sub(velocity(bs[i],point),velocity(bs[4],point)),vn=dot(relative,n),vt=sub(relative,scale(n,vn)),elastic=f(m[1]*compression),damp=f(m[2]*vn),normal=Math.max(0,f(elastic-damp)),ng=f((2**-20)*f(Math.abs(elastic)+Math.abs(damp)));
        if(Math.abs(f(elastic-damp))<=ng&&ng>0){reject(13,16<<i);failed=true;break;}
        let tangent=add(sub(cs[i].tangent,scale(n,dot(cs[i].tangent,n))),scale(vt,h)),ft=add(scale(tangent,-m[3]),scale(vt,-m[4]));
        const limit=f(m[5]*normal),magnitude=length(ft),sg=f((2**-20)*f(Math.abs(magnitude)+Math.abs(limit)));
        if(![normal,limit,magnitude].every(Number.isFinite)){reject(5);failed=true;break;}
        if(Math.abs(f(magnitude-limit))<=sg&&sg>0){reject(13,256<<i);failed=true;break;}
        if(magnitude>limit){ft=magnitude>0?scale(ft,f(limit/magnitude)):[0,0,0];tangent=m[3]>0?scale(add(ft,scale(vt,m[4])),f(-1/m[3])):[0,0,0];cs[i].sliding=1;}
        const impulse=scale(add(scale(n,normal),ft),h);apply(bs[i],impulse,point);apply(bs[4],neg(impulse),point);cs[i].normalForce=normal;cs[i].tangent=tangent;
      }
      if(contacted&&!touching)remove=1;
    }
    if(failed)continue;
    if(bs.some(b=>!finite(b.linear)||!finite(b.angular))||cs.some(c=>!finite(c.tangent))){reject(5);continue;}
    bs.forEach((b,i)=>{view.set(b.linear,base+40+i*32);view.set(b.angular,base+44+i*32);});
    cs.forEach((c,i)=>{const p=base+224+i*8;view.set(c.tangent,p);out[p+3]=c.active;view[p+4]=c.normalForce;view[p+5]=c.compression;out[p+6]=c.sliding;});
    out[base+5]=contacted;out[base+7]=births;out[base+8]=obstructions;out[base+9]=remove;out[base+1]=DIRECT_STATUS.incomplete;out[base+2]=DIRECT_REASON.physicsScope;out[base+3]=NO_PASS;
  }
  return out;
}
