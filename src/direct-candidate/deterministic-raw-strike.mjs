import {compileLiveWorldPipeline} from './experimental-live-world-pipeline-cache.mjs';
/** GPU-canonical bounded raw strike. This is the source compliant material law
 * with ideal axial/angular cue constraints, NOT a fitted impulse, source Rapier
 * equivalence, or a whole-world clearance/cloth solver. See accompanying doc.
 * All numerical work after packing is integer; positions/v/q use Q24 and
 * angles use degrees*2^16. h=2^-16 seconds (16 Q20 ticks).
 */
import {createContactMath,CONTACT_MATH_WGSL} from './deterministic-contact-math.mjs';
import {multiplyWide} from './deterministic-axial.mjs';
export const STRIKE_VERSION=0x53545201,STRIKE_Q=2**24,STRIKE_INPUT_WORDS=16,STRIKE_OUTPUT_WORDS=128;
const Q=STRIKE_Q,A=65536,NONE=0xffffffff;
export const STRIKE_MATERIAL_PROFILE='physicslab-defaults-v1';
export const STRIKE_REASON=Object.freeze({none:0,domain:1,clearance:2,clothCoupling:3,budget:4,numeric:5,miscueEnvelope:6,noContact:7});
export const STRIKE_CAPABILITY=Object.freeze({profile:'canonical-compliant-ideal-guide-isolated-v1',source:'src/physics.js pose/strike/compliantTipContact',ballRadius:.03075,ballMass:.210,cueMass:.54,tipEndMass:.012,tipRadius:.006,timeStep:1/65536,maximumSteps:4096,angleEncoding:'Q16 degrees',stateEncoding:'Q24 p/v/q; q=Rω',speedRange:[.5,4.5],maximumTipRadius:.6,maximumElevation:85,clothCoupling:'persistent flat-plane support; lift/relanding unsupported',otherDynamicBodies:false,miscueModel:false,sourceRapierEquivalent:false,completeRawDomain:false,completeGeometryDomain:false});
const C=Object.freeze({r:Math.round(.03075*Q),rt:Math.round(.006*Q),shaftR:Math.round(.011*Q),neckR:Math.round(.0058*Q),length:Math.round(1.35*Q),flex:Math.round(.12*Q),retract:Math.round(.012*Q),guard:256,clothMu:Math.round(.2*Q),rolling:Math.round(2.5*.00045/.03075*Q),spin:Math.round(2.5*.00035/.03075*Q),
 kn:Math.round(1e6/65536/.210*Q),dn:Math.round(110/65536/.210*Q),kt:Math.round(4e5/65536/.210*Q),dt:Math.round(10/65536/.210*Q),mu:Math.round(.7*Q),kl:Math.round(1200/65536/.012*Q),dl:Math.round(1/65536/.012*Q),cueMassRatio:Math.round(.54/.210*Q),headMassRatio:Math.round(.012/.210*Q),shaftMassRatio:Math.round(.528/.210*Q),shaftOffset:Math.round((.006+.12+(1.35-.12)/2)*Q),headRatio:Math.round(.210/.012*Q),axialRatio:Math.round(.210/.54*Q),gravityStep:Math.round(9.81/65536*Q)});
const atan=Object.freeze(Array.from({length:24},(_,i)=>Math.round(Math.atan(2**-i)*180/Math.PI*A)));
const add=(c,a,b)=>a.map((x,i)=>c.add(x,b[i])),sub=(c,a,b)=>a.map((x,i)=>c.add(x,-b[i])),vec=(s,b)=>Array.from(s.subarray(b,b+3));
function encode(x,scale=Q){const n=Math.round(x*scale);if(!Number.isFinite(x)||!Number.isSafeInteger(n)||Math.abs(n)>0x7fffffff)throw RangeError('Finite no-wrap strike encoding');return n;}
export function packRawStrikes(cases){if(!Array.isArray(cases)||!cases.length||cases.length>4096)throw RangeError('1..4096 raw strikes');const w=new Uint32Array(cases.length*16),s=new Int32Array(w.buffer);const ids=new Set();cases.forEach((x,i)=>{if(!x||Object.keys(x).some(k=>!['id','angle','elevation','speed','tipX','tipY','maximumSteps'].includes(k)))throw RangeError('Unsupported raw strike setting');if(!Number.isInteger(x.id)||x.id<0||x.id>NONE||ids.has(x.id))throw RangeError('Unique u32 strike IDs');ids.add(x.id);if(!Number.isInteger(x.maximumSteps??4096)||(x.maximumSteps??4096)<1||(x.maximumSteps??4096)>4096)throw RangeError('Integer strike step budget');const b=i*16;w.set([x.id,STRIKE_VERSION,x.maximumSteps??4096,0],b);s.set([encode(x.angle,A),encode(x.elevation,A),encode(x.speed),encode(x.tipX),encode(x.tipY)],b+4);});validateRawStrikes(w);return w;}
export function validateRawStrikes(w){if(!(w instanceof Uint32Array)||!w.length||w.length%16||w.length>4096*16||(typeof SharedArrayBuffer!=='undefined'&&w.buffer instanceof SharedArrayBuffer))throw TypeError('Owned complete raw-strike rows');const ids=new Set(),s=new Int32Array(w.buffer,w.byteOffset,w.length);for(let b=0;b<w.length;b+=16){if(ids.has(w[b])||w[b+1]!==STRIKE_VERSION||w[b+2]<1||w[b+2]>4096)throw RangeError('Raw strike ABI/version/budget');ids.add(w[b]);if(w[b+3]||Array.from(w.subarray(b+9,b+16)).some(Boolean))throw RangeError('Reserved strike words');for(let j=4;j<9;j++)if(s[b+j]===-2147483648)throw RangeError('INT_MIN unsupported');}return w;}
/** Fixed boxes only, with complete roster explicitly declared. A missing roster
 * cannot be treated as clearance; selected sphere is tested separately on GPU.
 * No adapter from a general live Rapier world is asserted by this component. */
export function packStrikeScene(scene){if(!scene||scene.materialProfile!==STRIKE_MATERIAL_PROFILE||Object.keys(scene).some(k=>!['kind','complete','materialProfile','support','center','floorTop','obstacles','gravity'].includes(k)))throw RangeError('Explicit supported default material profile; no ignored material/settings overrides');if(scene?.kind!=='complete-isolated-sphere-fixed-aabbs'||scene.complete!==true||!Array.isArray(scene.obstacles)||scene.obstacles.length>128)throw RangeError('Explicit complete isolated sphere / fixed AABB scene');const w=new Uint32Array(16+scene.obstacles.length*8),s=new Int32Array(w.buffer);if(!Number.isFinite(scene.gravity??9.81)||(scene.gravity??9.81)<0||(scene.gravity??9.81)>20)throw RangeError('Gravity must be in0..20m/s² before encoding');if(!['cloth','free-flight'].includes(scene.support))throw RangeError('Explicit cloth or free-flight support mode');w.set([STRIKE_VERSION,scene.obstacles.length,1,scene.support==='cloth'?1:0]);if(!Array.isArray(scene.center)||scene.center.length!==3)throw RangeError('Three-component center');s.set(scene.center.map(x=>encode(x)),4);s[7]=encode(scene.floorTop??0);s.set([encode((scene.gravity??9.81)/65536),32,0],8);s.set([0,0,0],12);scene.obstacles.forEach((x,i)=>{if(!x||Object.keys(x).some(k=>!['min','max'].includes(k)))throw RangeError('Only immutable fixed AABB bounds supported');if(!Array.isArray(x.min)||!Array.isArray(x.max)||x.min.length!==3||x.max.length!==3)throw RangeError('Complete fixed obstacle AABB');const b=16+i*8;s.set(x.min.map(v=>{const q=Math.floor(v*Q);if(!Number.isFinite(v)||Math.abs(q)>8*Q)throw RangeError('Obstacle bounds');return q;}),b);s.set(x.max.map(v=>{const q=Math.ceil(v*Q);if(!Number.isFinite(v)||Math.abs(q)>8*Q)throw RangeError('Obstacle bounds');return q;}),b+4);});validateStrikeScene(w);return w;}
export function validateStrikeScene(w){if(!(w instanceof Uint32Array)||w.length<16||w.length!==16+w[1]*8||w[1]>128||w[0]!==STRIKE_VERSION||w[2]!==1||w[3]>1||(typeof SharedArrayBuffer!=='undefined'&&w.buffer instanceof SharedArrayBuffer))throw RangeError('Immutable complete strike scene');const s=new Int32Array(w.buffer,w.byteOffset,w.length);for(let j=4;j<=7;j++)if(Math.abs(s[j])>8*Q)throw RangeError('Scene position bounds');if(s[8]<0||s[8]>Math.round(20/65536*Q)||w[3]===1&&s[5]!==s[7]+C.r)throw RangeError('Supported ball must start at exact encoded cloth top + radius; bounded gravity');if(w[9]!==32)throw RangeError('Exact immutable division bit count32 required');for(let j=10;j<16;j++)if(w[j])throw RangeError('Only initially stationary ball; reserved fields zero');for(let b=16;b<w.length;b+=8){if(w[b+3]||w[b+7])throw RangeError('AABB reserved');for(let j=0;j<3;j++)if(Math.abs(s[b+j])>8*Q||Math.abs(s[b+4+j])>8*Q||s[b+j]>s[b+4+j])throw RangeError('Outward AABB bounds');}return w;}
function trig(angle){let a=((angle+180*A)%(360*A)+360*A)%(360*A)-180*A;let sign=1;if(a>90*A){a-=180*A;sign=-1;}if(a< -90*A){a+=180*A;sign=-1;}if(a===0)return[0,sign*Q];if(a===90*A)return[Q,0];if(a===-90*A)return[-Q,0];let x=10188014,y=0,z=a;for(let i=0;i<24;i++){const d=z>=0?1:-1,nx=x-d*(y>>i);y+=d*(x>>i);x=nx;z-=d*atan[i];}return[y*sign,x*sign];}
function sqrtq(v){if(v<0)return 0;const [lo,hi]=multiplyWide(v,Q);let l=0,h=Q;while(l<h){const m=l+Math.ceil((h-l)/2),[a,b]=multiplyWide(m,m);if(b<hi||(b===hi&&a<=lo))l=m;else h=m-1;}return l;}
function step(x){return x<0?-Math.floor((-x+32768)/65536):Math.floor((x+32768)/65536);}
function capsuleSphere(c,a,b,r,p){const ab=sub(c,b,a),ap=sub(c,p,a),den=c.dot(ab,ab),t=den?Math.max(0,Math.min(Q,c.div(c.dot(ap,ab),den))):0,near=add(c,a,c.scale(ab,t));return c.norm(sub(c,p,near))>r+C.guard;}
function clear(c,scene,p,head,shaft,motion){const floor=scene[7],margin=C.guard+motion;if(scene[3]===0&&p[1]-C.r<=floor+margin||scene[3]===1&&p[1]!==floor+C.r)return 3;
 const parts=[[sub(c,shaft,c.scale(c.axis,C.rt+C.length)),sub(c,shaft,c.scale(c.axis,C.rt+C.flex)),C.shaftR],[sub(c,head,c.scale(c.axis,C.rt+C.flex)),sub(c,head,c.scale(c.axis,C.rt)),C.neckR],[head,head,C.rt]];
 for(let k=0;k<3;k++){const [a,b,r]=parts[k];if(Math.min(a[1],b[1])-r<=floor+margin)return 2;if(k<2&&!capsuleSphere(c,a,b,r+C.r+2*motion,p))return 2;}
 for(let b=16;b<scene.length;b+=8){const lo=vec(scene,b),hi=vec(scene,b+4);for(const [a,z,r] of [...parts,[p,p,C.r]]){let separate=false;for(let j=0;j<3;j++)if(Math.max(a[j],z[j])+r+margin<lo[j]||Math.min(a[j],z[j])-r-margin>hi[j])separate=true;if(!separate)return 2;}}
 return 0;}
function strikeMath(){const c=createContactMath(),originalAdd=c.add;c.addOverflow=false;c.add=(a,b)=>{const sum=a+b;if(!Number.isSafeInteger(sum)||sum< -2147483647||sum>2147483647)c.addOverflow=true;return originalAdd(a,b);};c.dot=(a,b)=>a.reduce((sum,x,i)=>c.add(sum,c.mul(x,b[i])),0);c.cross=(a,b)=>[c.add(c.mul(a[1],b[2]),-c.mul(a[2],b[1])),c.add(c.mul(a[2],b[0]),-c.mul(a[0],b[2])),c.add(c.mul(a[0],b[1]),-c.mul(a[1],b[0]))];return c;}
function cueMomentum(c,vs,du){return add(c,c.scale(c.scale(c.axis,vs),C.cueMassRatio),c.scale(du,C.headMassRatio));}
function cueMoment(c,head,shaft,vs,du){const sv=c.scale(c.axis,vs),sc=sub(c,sub(c,shaft,c.origin),c.scale(c.axis,C.shaftOffset));return add(c,c.cross(sc,c.scale(sv,C.shaftMassRatio)),c.cross(sub(c,head,c.origin),c.scale(add(c,sv,du),C.headMassRatio)));}
/** Speculative no-contact prefix. A failed proof changes no model state/counters.
 * Unit-axis rounded affine points deviate by <2 quanta; 64-quanta contact slack
 * and 32-quanta sweep slack cover those roundings. The existing inflated capsule
 * check proves the whole prefix and every reference per-step clearance check.
 * Counters remain reference-equivalent, not measured optimized operation counts. */
function approachCount(c,scene,p,initial,head,displacement,vs,remaining){
 const saved=[c.muls,c.divs,c.norms,c.bad,c.addOverflow];let result=0;
 const stride=step(vs),axisNorm=c.norm(c.axis),gap=c.norm(sub(c,p,head))-C.r-C.rt-64;
 let count=Math.min(remaining,Math.floor(Math.max(0,gap)/(stride+4)));
 if(stride>0&&axisNorm<=Q+2)for(let trial=0;trial<4&&count>=8;trial++,count=Math.floor(count/2)){
  const nextS=displacement+count*stride,motion=count*(stride+4)+32,next=add(c,initial,c.scale(c.axis,nextS));
  if(nextS<=Math.round(.13*Q)&&next.every(z=>Math.abs(z)<=32*Q)&&c.dot(sub(c,p,next),c.axis)>C.guard&&clear(c,scene,p,next,next,motion)===0&&!c.bad){result=count;break;}
 }
 [c.muls,c.divs,c.norms,c.bad,c.addOverflow]=saved;return result;
}
export function runRawStrikeCPU(scene,rows){validateStrikeScene(scene);validateRawStrikes(rows);const si=new Int32Array(scene.buffer,scene.byteOffset,scene.length),ri=new Int32Array(rows.buffer,rows.byteOffset,rows.length),out=new Uint32Array(rows.length/16*128),oi=new Int32Array(out.buffer);
 for(let b=0;b<rows.length;b+=16){const o=b*8,c=strikeMath(),yaw=ri[b+4],elevation=ri[b+5],speed=ri[b+6],x=ri[b+7],y=ri[b+8];let status=5,reason=4,steps=0,contacts=0,slips=0,normalSum=0,maxCompression=0,engaged=false,ever=false;let p=vec(si,4),v=[0,0,0],q=[0,0,0],u=[0,0,0],du=[0,0,0],s=0,vs=speed,tangent=[0,0,0],net=[0,0,0],torque=[0,0,0],cloth=[0,0,0],clothTorque=[0,0,0],resistance=[0,0,0],guideImpulse=[0,0,0],guideTorque=[0,0,0],tipWorld=[0,0,0],gravityWorld=[0,0,0],clothWorld=[0,0,0],patchWorld=[0,0,0],axis=[0,0,0],surface=[0,0,0],initial=[0,0,0],head=[0,0,0],shaft=[0,0,0];
 c.origin=vec(si,4);const reject=r=>{status=4;reason=r;};
 if(Math.abs(yaw)>3600*A||elevation<0||elevation>85*A||speed<Q/2||speed>Q*4.5||Math.abs(x)>Q||Math.abs(y)>Q)reject(1);
 else if(c.dot([x,y,0],[x,y,0])>Math.round(.36*Q))reject(6);
 else {const a=trig(yaw),e=trig(elevation);axis=c.unit([c.mul(a[1],e[1]),-e[0],c.mul(a[0],e[1])]);const side=c.unit([-a[0],0,a[1]]),up=c.unit(c.cross(side,axis)),radial=Q-c.mul(x,x)-c.mul(y,y);surface=add(c,add(c,c.scale(side,x),c.scale(up,y)),c.scale(axis,-sqrtq(radial)));initial=sub(c,add(c,p,c.scale(surface,C.r+C.rt)),c.scale(axis,C.retract));head=initial.slice();shaft=initial.slice();c.axis=axis;
  for(;steps<rows[b+2];){
   // RAW_APPROACH_CPU_BEGIN
   if(!c.bad&&si[3]===1&&!ever&&!engaged&&[...v,...q,...u,...du].every(z=>z===0)&&p.every((z,j)=>z===c.origin[j])){
    const skipped=approachCount(c,si,p,initial,head,s,vs,rows[b+2]-steps);
    if(skipped){const counts=[c.muls,c.divs,c.norms];s+=skipped*step(vs);shaft=add(c,initial,c.scale(axis,s));head=shaft.slice();cloth[1]+=skipped*si[8];steps+=skipped;[c.muls,c.divs,c.norms]=counts.map((n,j)=>n+skipped*[173,6,10][j]);if(steps>=rows[b+2])break;}
   }
   // RAW_APPROACH_CPU_END
   if(c.bad){reject(5);break;}const geometry=clear(c,si,p,head,shaft,0);if(geometry){reject(geometry);break;}
   // Source transverse spring prefix, in its ideal guided/angular-locked limit.
   const oldCueP=cueMomentum(c,vs,du),oldCueL=cueMoment(c,head,shaft,vs,du);let applied=[0,0,0],appliedWorld=[0,0,0],finished=false;const lateral=add(c,c.scale(u,-C.kl),c.scale(du,-C.dl));du=add(c,du,lateral);du=sub(c,du,c.scale(axis,c.dot(du,axis)));
   const delta=sub(c,p,head),distance=c.norm(delta),compression=C.r+C.rt-distance;
   if(compression>0){if(distance<1||compression>C.r/4){reject(5);break;}if(!engaged)tangent=[0,0,0];engaged=true;ever=true;contacts++;maxCompression=Math.max(maxCompression,compression);
    const n=c.unit(delta),point=add(c,head,c.scale(n,C.rt-Math.floor(compression/2))),arm=sub(c,point,p).map(z=>c.div(z,C.r)),headV=add(c,c.scale(axis,vs),du),relative=sub(c,add(c,v,c.cross(q,arm)),headV),vn=c.dot(relative,n),vt=sub(c,relative,c.scale(n,vn)),jn=Math.max(0,c.add(c.mul(C.kn,compression),-c.mul(C.dn,vn)));
    tangent=add(c,sub(c,tangent,c.scale(n,c.dot(tangent,n))),vt.map(step));let jt=add(c,c.scale(tangent,-C.kt),c.scale(vt,-C.dt));const mag=c.norm(jt),limit=c.cone(C.mu,jn);if(mag>limit){slips++;jt=c.scale(jt,c.div(limit,mag,true));tangent=add(c,jt,c.scale(vt,C.dt)).map(z=>-c.div(z,C.kt));}
    const impulse=add(c,c.scale(n,jn),jt);applied=impulse;appliedWorld=c.cross(sub(c,point,c.origin),impulse);tipWorld=add(c,tipWorld,appliedWorld);const ang=c.cross(arm,impulse);v=add(c,v,impulse);q=add(c,q,c.scale(ang,5*Q/2));net=add(c,net,impulse);torque=add(c,torque,ang);normalSum=c.add(normalSum,jn);const axial=c.dot(impulse,axis);vs=c.add(vs,-c.mul(C.axialRatio,axial));du=sub(c,du,c.scale(sub(c,impulse,c.scale(axis,axial)),C.headRatio));du=sub(c,du,c.scale(axis,c.dot(du,axis)));
   }else {engaged=false;tangent=[0,0,0];if(ever)finished=true;}
   guideImpulse=add(c,guideImpulse,add(c,sub(c,cueMomentum(c,vs,du),oldCueP),applied));guideTorque=add(c,guideTorque,add(c,sub(c,cueMoment(c,head,shaft,vs,du),oldCueL),appliedWorld));if(c.bad){reject(5);break;}if(finished){status=1;reason=0;break;}
   // Source cue gravity scale is zero; only the sphere sees gravity.
   v[1]=c.add(v[1],-si[8]);gravityWorld=add(c,gravityWorld,c.cross(sub(c,p,c.origin),[0,-si[8],0]));
   if(si[3]===1){if(v[1]>0){reject(3);break;}const jn=-v[1],slip=[c.add(v[0],q[2]),c.add(v[2],-q[0])],jt=c.disk(slip.map(z=>-c.div(z,7*Q/2)),c.cone(C.clothMu,jn)),ji=[jt[0],jn,jt[1]],arm=[0,-Q,0],ang=c.cross(arm,ji);v=add(c,v,ji);q=add(c,q,c.scale(ang,5*Q/2));cloth=add(c,cloth,ji);clothTorque=add(c,clothTorque,ang);clothWorld=add(c,clothWorld,c.cross(sub(c,[p[0],si[7],p[2]],c.origin),ji));
    const load=Math.min(jn,si[8]),horizontal=[q[0],0,q[2]],mag=c.norm(horizontal),roll=Math.min(mag,c.mul(load,C.rolling)),twist=Math.min(Math.abs(q[1]),c.mul(load,C.spin));let change=mag?c.scale(horizontal,-c.div(roll,mag)):[0,0,0];change[1]=q[1]<0?twist:-twist;q=add(c,q,change);resistance=add(c,resistance,change);patchWorld=add(c,patchWorld,c.scale(change,Math.round(.4*C.r)));
   }
   const oldP=p,oldHead=head,oldShaft=shaft;p=add(c,p,v.map(step));s=c.add(s,step(vs));u=add(c,u,du.map(step));u=sub(c,u,c.scale(axis,c.dot(u,axis)));shaft=add(c,initial,c.scale(axis,s));head=add(c,shaft,u);steps++;
   if([p,v,q,head,du].flat().some(z=>Math.abs(z)>32*Q)||Math.abs(vs)>32*Q||s>Math.round(.13*Q)||s< -Math.round(.08*Q)||c.bad){reject(5);break;}
   // Enclose this complete short sweep, not just its endpoints.
   const motion=Math.max(c.norm(sub(c,p,oldP)),c.norm(sub(c,head,oldHead)),c.norm(sub(c,shaft,oldShaft))),nextClear=clear(c,si,p,head,shaft,motion);if(nextClear){reject(nextClear);break;}
  }
  if(status===5&&!ever)reason=7;
 }
 const finalHeadV=add(c,c.scale(axis,vs),du);if(c.bad)reject(5);out.set([rows[b],status,reason,steps,contacts,slips,STRIKE_VERSION,steps*16],o);oi.set(p,o+8);oi.set(v,o+12);oi.set(q,o+16);oi.set(axis,o+20);oi.set(surface,o+24);oi.set(initial,o+28);oi.set(head,o+32);oi.set(finalHeadV,o+36);oi[o+40]=vs;oi[o+41]=normalSum;oi[o+42]=maxCompression;oi.set(net,o+44);oi.set(torque,o+48);oi.set(du,o+52);oi.set(u,o+56);oi[o+60]=s;out.set(rows.subarray(b,b+16),o+64);out.set([c.muls,c.divs,c.norms],o+80);oi.set(cloth,o+84);oi.set(clothTorque,o+88);oi.set(resistance,o+92);out[o+96]=si[3];out[o+97]=+c.addOverflow;oi.set(guideImpulse,o+100);oi.set(guideTorque,o+104);oi.set(tipWorld,o+108);oi.set(gravityWorld,o+112);oi.set(clothWorld,o+116);oi.set(patchWorld,o+120);out[o+124]=[...v,...q].some(z=>Math.abs(z)>4*Q)?1:0;oi.set(c.origin,o+125);
 }return out;}
export function decodeRawStrike(words,index=0){const o=index*128,s=new Int32Array(words.buffer,words.byteOffset,words.length),vector=b=>vec(s,o+b).map(x=>x/Q);return{id:words[o],status:words[o+1],reason:words[o+2],steps:words[o+3],contactSteps:words[o+4],slidingSteps:words[o+5],time:words[o+7]/2**20,position:vector(8),velocity:vector(12),q:vector(16),direction:vector(20),surface:vector(24),initialTip:vector(28),head:vector(32),headVelocity:vector(36),axialSpeed:s[o+40]/Q,normalImpulsePerBallMass:s[o+41]/Q,maxCompression:s[o+42]/Q,impulsePerBallMass:vector(44),torquePerBallMassRadius:vector(48),headTransverseVelocity:vector(52),headTransverseDisplacement:vector(56),axialDisplacement:s[o+60]/Q,clothImpulsePerBallMass:vector(84),clothTorquePerBallMassRadius:vector(88),resistanceDeltaQ:vector(92),supported:words[o+96]===1,guideImpulsePerBallMass:vector(100),guideTorquePerBallMass:vector(104),tipTorquePerBallMass:vector(108),gravityTorquePerBallMass:vector(112),clothTorqueAboutOriginPerBallMass:vector(116),patchTorquePerBallMass:vector(120),outsideDownstreamFourMetresPerSecond:words[o+124]===1,torqueOrigin:vector(125)};}
// Same checked-sum semantics as c.add. Branchless overflow detection avoids
// exponential compiler CFG duplication when checked vector helpers are inlined.
// any(vec<bool>) deliberately avoids WGSL short-circuit ||/&& control flow.
// Private error bits persist in owned state only at stage boundaries.
const STRIKE_CONTACT_MATH_WGSL=CONTACT_MATH_WGSL.replace('for(var bit=31i;bit>=0;bit--)', 'for(var bit=i32(scene[9u])-1;bit>=0;bit--)').replace(/^fn safeAdd.*$/m,`fn safeAdd(a:i32,b:i32)->i32{let sum=a+b;let overflow=any(vec2<bool>(((a^sum)&(b^sum))<0,sum==bitcast<i32>(0x80000000u)));bad=select(bad,true,overflow);addBad=addBad|select(0u,1u,overflow);return select(sum,0,overflow);}`);
export const RAW_STRIKE_WGSL=`
@group(0) @binding(0) var<storage,read> scene:array<u32>;
@group(0) @binding(1) var<storage,read> rows:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
var<private> errorIndex:u32;var<private> addBad:u32;
${STRIKE_CONTACT_MATH_WGSL}
${Object.entries(C).map(([k,v])=>`const ${k}:i32=${v};`).join('\n')}
const angles:array<i32,24>=array<i32,24>(${atan.join(',')});
var<private> direction:vec3<i32>;var<private> origin:vec3<i32>;
fn numericBad()->bool{return bad;}
fn scalar(i:u32)->i32{return bitcast<i32>(rows[i]);}
fn sceneI(i:u32)->i32{return bitcast<i32>(scene[i]);}
fn sceneV(i:u32)->vec3<i32>{return vec3<i32>(sceneI(i),sceneI(i+1u),sceneI(i+2u));}
fn addv(a:vec3<i32>,b:vec3<i32>)->vec3<i32>{return vec3<i32>(safeAdd(a.x,b.x),safeAdd(a.y,b.y),safeAdd(a.z,b.z));}
fn subv(a:vec3<i32>,b:vec3<i32>)->vec3<i32>{return addv(a,-b);}
fn strikeCross(a:vec3<i32>,b:vec3<i32>)->vec3<i32>{return vec3<i32>(safeAdd(mul(a.y,b.z),-mul(a.z,b.y)),safeAdd(mul(a.z,b.x),-mul(a.x,b.z)),safeAdd(mul(a.x,b.y),-mul(a.y,b.x)));}
fn dotq(a:vec3<i32>,b:vec3<i32>)->i32{return safeAdd(safeAdd(mul(a.x,b.x),mul(a.y,b.y)),mul(a.z,b.z));}
fn scaleq(a:vec3<i32>,s:i32)->vec3<i32>{return vec3<i32>(mul(a.x,s),mul(a.y,s),mul(a.z,s));}
fn stepq(v:i32)->i32{return select((abs(v)+32768)>>16,-((abs(v)+32768)>>16),v<0);}
fn stepv(v:vec3<i32>)->vec3<i32>{return vec3<i32>(stepq(v.x),stepq(v.y),stepq(v.z));}
fn trig(angle:i32)->vec2<i32>{var a=((angle+11796480)%23592960+23592960)%23592960-11796480;var sign=1i;if(a>5898240){a-=11796480;sign=-1;}if(a< -5898240){a+=11796480;sign=-1;}if(a==0){return vec2<i32>(0,sign*Q);}if(a==5898240){return vec2<i32>(Q,0);}if(a== -5898240){return vec2<i32>(-Q,0);}var x=10188014i;var y=0i;var z=a;for(var i=0u;i<24u;i++){let d=select(-1i,1i,z>=0);let nx=x-d*(y>>i);y+=d*(x>>i);x=nx;z-=d*angles[i];}return vec2<i32>(y*sign,x*sign);}
fn sqrtq(v:i32)->i32{if(v<0){return 0;}let p=wide(u32(v),16777216u);var low=0u;var high=16777216u;loop{if(low>=high){break;}let m=low+((high-low)>>1u)+((high-low)&1u);let w=wide(m,m);if(w.y<p.y||(w.y==p.y&&w.x<=p.x)){low=m;}else{high=m-1u;}}return i32(low);}
fn capsuleSphere(a:vec3<i32>,b:vec3<i32>,radius:i32,p:vec3<i32>)->bool{let ab=subv(b,a);let ap=subv(p,a);let den=dotq(ab,ab);var t=0i;if(den!=0){t=clamp(divide(dotq(ap,ab),den,false),0,Q);}let near=addv(a,scaleq(ab,t));return norm(subv(p,near))>radius+guard;}
fn clearance(p:vec3<i32>,head:vec3<i32>,shaft:vec3<i32>,motion:i32)->u32{let floor=sceneI(7u);let margin=guard+motion;if((scene[3u]==0u&&p.y-r<=floor+margin)||(scene[3u]==1u&&p.y!=floor+r)){return 3u;}var a:array<vec3<i32>,4>;var z:array<vec3<i32>,4>;var radii:array<i32,4>;a[0]=subv(shaft,scaleq(direction,rt+length));z[0]=subv(shaft,scaleq(direction,rt+flex));radii[0]=shaftR;a[1]=subv(head,scaleq(direction,rt+flex));z[1]=subv(head,scaleq(direction,rt));radii[1]=neckR;a[2]=head;z[2]=head;radii[2]=rt;a[3]=p;z[3]=p;radii[3]=r;
 for(var k=0u;k<3u;k++){if(min(a[k].y,z[k].y)-radii[k]<=floor+margin){return 2u;}if(k<2u&&!capsuleSphere(a[k],z[k],radii[k]+r+2*motion,p)){return 2u;}}
 for(var b=16u;b<arrayLength(&scene);b+=8u){let lower=sceneV(b);let upper=sceneV(b+4u);for(var k=0u;k<4u;k++){let lo=subv(min(a[k],z[k]),vec3<i32>(radii[k]+margin));let hi=addv(max(a[k],z[k]),vec3<i32>(radii[k]+margin));if(!any(hi<lower)&&!any(lo>upper)){return 2u;}}}return 0u;}
fn cueMomentum(vs:i32,du:vec3<i32>)->vec3<i32>{return addv(scaleq(scaleq(direction,vs),cueMassRatio),scaleq(du,headMassRatio));}
fn cueMoment(head:vec3<i32>,shaft:vec3<i32>,vs:i32,du:vec3<i32>)->vec3<i32>{let sv=scaleq(direction,vs);let sc=subv(subv(shaft,origin),scaleq(direction,shaftOffset));return addv(strikeCross(sc,scaleq(sv,shaftMassRatio)),strikeCross(subv(head,origin),scaleq(addv(sv,du),headMassRatio)));}
fn approachCount(p:vec3<i32>,initial:vec3<i32>,head:vec3<i32>,displacement:i32,vs:i32,remaining:u32)->u32{
 let saved=vec3<u32>(muls,divs,norms);let savedBad=bad;let savedAdd=addBad;var result=0u;
 let stride=stepq(vs);let axisNorm=norm(direction);let gap=norm(subv(p,head))-r-rt-64;
 var count=min(remaining,u32(max(0,gap)/(stride+4)));
 if(stride>0&&axisNorm<=Q+2){for(var trial=0u;trial<4u&&count>=8u;trial++){let nextS=displacement+i32(count)*stride;let motion=i32(count)*(stride+4)+32;let next=addv(initial,scaleq(direction,nextS));
  if(nextS<=2181038&&all(abs(next)<=vec3<i32>(536870912))&&dotq(subv(p,next),direction)>guard){if(clearance(p,next,next,motion)==0u&&!numericBad()){result=count;break;}}count/=2u;
 }}muls=saved.x;divs=saved.y;norms=saved.z;bad=savedBad;addBad=savedAdd;return result;
}
fn put(base:u32,v:vec3<i32>){output[base]=bitcast<u32>(v.x);output[base+1u]=bitcast<u32>(v.y);output[base+2u]=bitcast<u32>(v.z);}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*16u;if(b>=arrayLength(&rows)){return;}let o=id.x*128u;for(var j=0u;j<128u;j++){output[o+j]=0u;}bad=false;addBad=0u;errorIndex=o+97u;muls=0u;divs=0u;norms=0u;direction=vec3<i32>(0);origin=sceneV(4u);
 let yaw=scalar(b+4u);let elevation=scalar(b+5u);let speed=scalar(b+6u);let x=scalar(b+7u);let y=scalar(b+8u);var status=5u;var reason=4u;var steps=0u;var contacts=0u;var slips=0u;var normalSum=0i;var maxCompression=0i;var engaged=false;var ever=false;var p=sceneV(4u);var v=vec3<i32>(0);var q=vec3<i32>(0);var u=vec3<i32>(0);var du=vec3<i32>(0);var displacement=0i;var vs=speed;var tangent=vec3<i32>(0);var net=vec3<i32>(0);var torque=vec3<i32>(0);var cloth=vec3<i32>(0);var clothTorque=vec3<i32>(0);var resistance=vec3<i32>(0);var guideImpulse=vec3<i32>(0);var guideTorque=vec3<i32>(0);var tipWorld=vec3<i32>(0);var gravityWorld=vec3<i32>(0);var clothWorld=vec3<i32>(0);var patchWorld=vec3<i32>(0);var surface=vec3<i32>(0);var initial=vec3<i32>(0);var head=vec3<i32>(0);var shaft=vec3<i32>(0);
 if(abs(yaw)>235929600||elevation<0||elevation>5570560||speed<Q/2||speed>75497472||abs(x)>Q||abs(y)>Q){status=4u;reason=1u;}
 else if(dotq(vec3<i32>(x,y,0),vec3<i32>(x,y,0))>6039798){status=4u;reason=6u;}
 else{let a=trig(yaw);let e=trig(elevation);direction=unit(vec3<i32>(mul(a.y,e.y),-e.x,mul(a.x,e.y)));let side=unit(vec3<i32>(-a.x,0,a.y));let up=unit(strikeCross(side,direction));let radial=Q-mul(x,x)-mul(y,y);surface=addv(addv(scaleq(side,x),scaleq(up,y)),scaleq(direction,-sqrtq(radial)));initial=subv(addv(p,scaleq(surface,r+rt)),scaleq(direction,retract));head=initial;shaft=initial;
 for(;steps<rows[b+2u];){
  // RAW_APPROACH_WGSL_BEGIN
  if(!numericBad()&&scene[3u]==1u&&!ever&&!engaged&&all(v==vec3<i32>(0))&&all(q==vec3<i32>(0))&&all(u==vec3<i32>(0))&&all(du==vec3<i32>(0))&&all(p==origin)){
   let skipped=approachCount(p,initial,head,displacement,vs,rows[b+2u]-steps);
   if(skipped!=0u){let counts=vec3<u32>(muls,divs,norms);displacement+=i32(skipped)*stepq(vs);shaft=addv(initial,scaleq(direction,displacement));head=shaft;cloth.y+=i32(skipped)*sceneI(8u);steps+=skipped;muls=counts.x+skipped*173u;divs=counts.y+skipped*6u;norms=counts.z+skipped*10u;if(steps>=rows[b+2u]){reason=7u;break;}}
  }
  // RAW_APPROACH_WGSL_END
  if(numericBad()){status=4u;reason=5u;break;}let geometry=clearance(p,head,shaft,0);if(geometry!=0u){status=4u;reason=geometry;break;}
  let oldCueP=cueMomentum(vs,du);let oldCueL=cueMoment(head,shaft,vs,du);var applied=vec3<i32>(0);var appliedWorld=vec3<i32>(0);var finished=false;let lateral=addv(scaleq(u,-kl),scaleq(du,-dl));du=addv(du,lateral);du=subv(du,scaleq(direction,dotq(du,direction)));let delta=subv(p,head);let distance=norm(delta);let compression=r+rt-distance;
  if(compression>0){if(distance<1||compression>r/4){status=4u;reason=5u;break;}if(!engaged){tangent=vec3<i32>(0);}engaged=true;ever=true;contacts++;maxCompression=max(maxCompression,compression);let n=unit(delta);let point=addv(head,scaleq(n,rt-compression/2));let armRaw=subv(point,p);let arm=vec3<i32>(divide(armRaw.x,r,false),divide(armRaw.y,r,false),divide(armRaw.z,r,false));let headV=addv(scaleq(direction,vs),du);let relative=subv(addv(v,strikeCross(q,arm)),headV);let vn=dotq(relative,n);let vt=subv(relative,scaleq(n,vn));let jn=max(0,safeAdd(mul(kn,compression),-mul(dn,vn)));tangent=addv(subv(tangent,scaleq(n,dotq(tangent,n))),stepv(vt));var jt=addv(scaleq(tangent,-kt),scaleq(vt,-dt));let mag=norm(jt);let limit=cone(mu,jn);if(mag>limit){slips++;jt=scaleq(jt,divide(limit,mag,true));let tr=addv(jt,scaleq(vt,dt));tangent= -vec3<i32>(divide(tr.x,kt,false),divide(tr.y,kt,false),divide(tr.z,kt,false));}
   let impulse=addv(scaleq(n,jn),jt);applied=impulse;appliedWorld=strikeCross(subv(point,origin),impulse);tipWorld=addv(tipWorld,appliedWorld);let ang=strikeCross(arm,impulse);v=addv(v,impulse);q=addv(q,scaleq(ang,41943040));net=addv(net,impulse);torque=addv(torque,ang);normalSum=safeAdd(normalSum,jn);let axial=dotq(impulse,direction);vs=safeAdd(vs,-mul(axialRatio,axial));du=subv(du,scaleq(subv(impulse,scaleq(direction,axial)),headRatio));du=subv(du,scaleq(direction,dotq(du,direction)));
  }else{engaged=false;tangent=vec3<i32>(0);if(ever){finished=true;}}
  guideImpulse=addv(guideImpulse,addv(subv(cueMomentum(vs,du),oldCueP),applied));guideTorque=addv(guideTorque,addv(subv(cueMoment(head,shaft,vs,du),oldCueL),appliedWorld));if(numericBad()){status=4u;reason=5u;break;}if(finished){status=1u;reason=0u;break;}
  v.y=safeAdd(v.y,-sceneI(8u));gravityWorld=addv(gravityWorld,strikeCross(subv(p,origin),vec3<i32>(0,-sceneI(8u),0)));
  if(scene[3u]==1u){if(v.y>0){status=4u;reason=3u;break;}let jn= -v.y;let slip=vec2<i32>(safeAdd(v.x,q.z),safeAdd(v.z,-q.x));let jt=disk(-vec2<i32>(divide(slip.x,58720256,false),divide(slip.y,58720256,false)),cone(clothMu,jn));let ji=vec3<i32>(jt.x,jn,jt.y);let ang=strikeCross(vec3<i32>(0,-Q,0),ji);v=addv(v,ji);q=addv(q,scaleq(ang,41943040));cloth=addv(cloth,ji);clothTorque=addv(clothTorque,ang);clothWorld=addv(clothWorld,strikeCross(subv(vec3<i32>(p.x,sceneI(7u),p.z),origin),ji));let load=min(jn,sceneI(8u));let horizontal=vec3<i32>(q.x,0,q.z);let mag=norm(horizontal);let roll=min(mag,mul(load,rolling));let twist=min(abs(q.y),mul(load,spin));var change=vec3<i32>(0);if(mag!=0){change=scaleq(horizontal,-divide(roll,mag,false));}change.y=select(-twist,twist,q.y<0);q=addv(q,change);resistance=addv(resistance,change);patchWorld=addv(patchWorld,scaleq(change,${Math.round(.4*C.r)}));
  }
  let oldP=p;let oldHead=head;let oldShaft=shaft;p=addv(p,stepv(v));displacement=safeAdd(displacement,stepq(vs));u=addv(u,stepv(du));u=subv(u,scaleq(direction,dotq(u,direction)));shaft=addv(initial,scaleq(direction,displacement));head=addv(shaft,u);steps++;
  if(any(abs(p)>vec3<i32>(536870912))||any(abs(v)>vec3<i32>(536870912))||any(abs(q)>vec3<i32>(536870912))||any(abs(head)>vec3<i32>(536870912))||any(abs(du)>vec3<i32>(536870912))||abs(vs)>536870912||displacement>2181038||displacement< -1342177||numericBad()){status=4u;reason=5u;break;}
  let motion=max(norm(subv(p,oldP)),max(norm(subv(head,oldHead)),norm(subv(shaft,oldShaft))));let nextClear=clearance(p,head,shaft,motion);if(nextClear!=0u){status=4u;reason=nextClear;break;}
 }if(status==5u&&!ever){reason=7u;}}
 let finalHeadV=addv(scaleq(direction,vs),du);if(numericBad()){status=4u;reason=5u;}output[o]=rows[b];output[o+1u]=status;output[o+2u]=reason;output[o+3u]=steps;output[o+4u]=contacts;output[o+5u]=slips;output[o+6u]=${STRIKE_VERSION}u;output[o+7u]=steps*16u;put(o+8u,p);put(o+12u,v);put(o+16u,q);put(o+20u,direction);put(o+24u,surface);put(o+28u,initial);put(o+32u,head);put(o+36u,finalHeadV);output[o+40u]=bitcast<u32>(vs);output[o+41u]=bitcast<u32>(normalSum);output[o+42u]=bitcast<u32>(maxCompression);put(o+44u,net);put(o+48u,torque);put(o+52u,du);put(o+56u,u);output[o+60u]=bitcast<u32>(displacement);for(var j=0u;j<16u;j++){output[o+64u+j]=rows[b+j];}output[o+80u]=muls;output[o+81u]=divs;output[o+82u]=norms;put(o+84u,cloth);put(o+88u,clothTorque);put(o+92u,resistance);output[o+96u]=scene[3u];output[o+97u]=addBad;put(o+100u,guideImpulse);put(o+104u,guideTorque);put(o+108u,tipWorld);put(o+112u,gravityWorld);put(o+116u,clothWorld);put(o+120u,patchWorld);output[o+124u]=select(0u,1u,any(abs(v)>vec3<i32>(67108864))||any(abs(q)>vec3<i32>(67108864)));put(o+125u,origin);
}`;
/** Smaller resident stages avoid the compiler live-state explosion of a
 * monolithic fully checked 4096-step shader. Dispatch control is host-only;
 * every pose/contact/cloth/geometry/state operation remains on the device. */
export function generateRawStrikePhases(){
 const mainAt=RAW_STRIKE_WGSL.indexOf('@compute'),header=RAW_STRIKE_WGSL.slice(0,mainAt)+`
@group(0) @binding(3) var<storage,read_write> scratch:array<u32>;
fn scratchV(at:u32)->vec3<i32>{return vec3<i32>(bitcast<i32>(scratch[at]),bitcast<i32>(scratch[at+1u]),bitcast<i32>(scratch[at+2u]));}
fn ov(at:u32)->vec3<i32>{return vec3<i32>(bitcast<i32>(output[at]),bitcast<i32>(output[at+1u]),bitcast<i32>(output[at+2u]));}
`,main=RAW_STRIKE_WGSL.slice(mainAt),slice=(from,to)=>{const a=main.indexOf(from),b=main.indexOf(to,a);if(a<0||b<0)throw Error('Versioned strike phase marker missing');return main.slice(a,b);};
 const prefix=`@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let b=id.x*16u;if(b>=arrayLength(&rows)){return;}let o=id.x*128u;let z=id.x*32u;errorIndex=o+97u;`;
 const uints={status:1,reason:2,steps:3,contacts:4,slips:5},ints={vs:40,normalSum:41,maxCompression:42,displacement:60},vectors={p:8,v:12,q:16,surface:24,initial:28,head:32,net:44,torque:48,du:52,u:56,cloth:84,clothTorque:88,resistance:92,guideImpulse:100,guideTorque:104,tipWorld:108,gravityWorld:112,clothWorld:116,patchWorld:120};
 const load=`bad=scratch[z+3u]!=0u;addBad=output[o+97u];muls=output[o+80u];divs=output[o+81u];norms=output[o+82u];direction=ov(o+20u);origin=ov(o+125u);`+Object.entries(uints).map(([k,n])=>`var ${k}=output[o+${n}u];`).join('')+Object.entries(ints).map(([k,n])=>`var ${k}=bitcast<i32>(output[o+${n}u]);`).join('')+Object.entries(vectors).map(([k,n])=>`var ${k}=ov(o+${n}u);`).join('')+`var shaft=vec3<i32>(bitcast<i32>(scratch[z+4u]),bitcast<i32>(scratch[z+5u]),bitcast<i32>(scratch[z+6u]));var engaged=scratch[z]!=0u;var ever=scratch[z+1u]!=0u;var tangent=vec3<i32>(bitcast<i32>(scratch[z+8u]),bitcast<i32>(scratch[z+9u]),bitcast<i32>(scratch[z+10u]));`;
 const store=Object.entries(uints).map(([k,n])=>`output[o+${n}u]=${k};`).join('')+Object.entries(ints).map(([k,n])=>`output[o+${n}u]=bitcast<u32>(${k});`).join('')+Object.entries(vectors).map(([k,n])=>`put(o+${n}u,${k});`).join('')+`put(o+20u,direction);put(o+125u,origin);output[o+80u]=muls;output[o+81u]=divs;output[o+82u]=norms;output[o+97u]=addBad;scratch[z]=select(0u,1u,engaged);scratch[z+1u]=select(0u,1u,ever);scratch[z+3u]=select(0u,1u,bad);for(var k=0u;k<3u;k++){scratch[z+8u+k]=bitcast<u32>(tangent[k]);scratch[z+4u+k]=bitcast<u32>(shaft[k]);}`;
 const initDeclarations=slice(' let yaw=',' if(abs(yaw)'),initPose=slice(' if(abs(yaw)',' for(;steps<rows[b+2u];){')+'}',preclear=slice('  // RAW_APPROACH_WGSL_BEGIN','  let oldCueP='),contact=slice('  let oldCueP=','  v.y=safeAdd'),advance=slice('  v.y=safeAdd','  let motion='),postclear=slice('  let motion=',' }if(status==5u&&!ever)'),final=slice(' let finalHeadV=','\n}');
 return Object.freeze([
  {name:'initialize',code:header+prefix+`for(var k=0u;k<128u;k++){output[o+k]=0u;}for(var k=0u;k<32u;k++){scratch[z+k]=0u;}bad=false;addBad=0u;muls=0u;divs=0u;norms=0u;direction=vec3<i32>(0);origin=sceneV(4u);`+initDeclarations+initPose+store+`if(status!=5u){scratch[z+2u]=1u;}}`},
  {name:'clearance_pre',code:header+prefix+`if(scratch[z+2u]!=0u){return;}`+load+`loop{`+preclear+`break;}for(var k=0u;k<3u;k++){scratch[z+16u+k]=bitcast<u32>(p[k]);scratch[z+20u+k]=bitcast<u32>(head[k]);scratch[z+24u+k]=bitcast<u32>(shaft[k]);}`+store+`if(status!=5u||steps>=rows[b+2u]){scratch[z+2u]=1u;}}`},
  {name:'cue_contact',code:header+prefix+`if(scratch[z+2u]!=0u){return;}`+load+`loop{`+contact+`break;}`+store+`if(status!=5u){scratch[z+2u]=1u;}}`},
  {name:'cloth_advance',code:header+prefix+`if(scratch[z+2u]!=0u){return;}`+load+`loop{`+advance+`break;}`+store+`if(status!=5u){scratch[z+2u]=1u;}}`},
  {name:'clearance_post',code:header+prefix+`if(scratch[z+2u]!=0u){return;}`+load+`let oldP=scratchV(z+16u);let oldHead=scratchV(z+20u);let oldShaft=scratchV(z+24u);loop{`+postclear+`break;}if(status==5u&&steps>=rows[b+2u]){reason=select(7u,4u,ever);scratch[z+2u]=1u;}`+store+`if(status!=5u){scratch[z+2u]=1u;}}`},
  {name:'finalize',code:header+prefix+`if(scratch[z+2u]!=1u){return;}`+load+final+`scratch[z+2u]=2u;}`},
 ]);
}
async function compileRawStrikePhase(device,phase,preflightShader,signal,reusePipelines){
 if(reusePipelines&&typeof device?.lost?.then==='function')return compileLiveWorldPipeline(device,{code:phase.code,label:'canonical-strike-'+phase.name,preflightShader,signal});
 if(preflightShader!==undefined)throw TypeError('Native device required for owned preflight receipt');
 const module=device.createShaderModule({code:phase.code,label:'canonical-strike-'+phase.name}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(phase.name+': '+info.messages.map(x=>x.message).join('\n'));
 return device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
}
export async function createRawStrikeGPU(device,{onCompileStage=()=>{},preflightShaders,signal,reusePipelines=false}={}){if(typeof reusePipelines!=='boolean')throw TypeError('Explicit pipeline reuse flag');if(typeof onCompileStage!=='function')throw TypeError('Compile diagnostic callback');const start=performance.now(),phases=generateRawStrikePhases(),compiled=[],compileStages=[];for(const phase of phases){onCompileStage({name:phase.name,phase:'start',milliseconds:performance.now()});const phaseStart=performance.now(),pipeline=await compileRawStrikePhase(device,phase,preflightShaders?.get(phase.name),signal,reusePipelines);compiled.push(pipeline);compileStages.push({name:phase.name,compileMs:performance.now()-phaseStart,shaderBytes:new TextEncoder().encode(phase.code).length});onCompileStage({...compileStages.at(-1),phase:'complete',milliseconds:performance.now()});}return Object.freeze({compileMs:performance.now()-start,compileStages,shaderBytes:compileStages.reduce((sum,x)=>sum+x.shaderBytes,0),
 createBank(scene,rows){validateStrikeScene(scene);validateRawStrikes(rows);const owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;},count=rows.length/16,shared=make(scene.byteLength,136),input=make(rows.byteLength,136),result=make(count*128*4,132),scratchBuffer=make(count*32*4,128),groups=compiled.map(pipeline=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[shared,input,result,scratchBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))}));device.queue.writeBuffer(shared,0,scene);device.queue.writeBuffer(input,0,rows);let disposed=false,maxSteps=0;for(let b=0;b<rows.length;b+=16)maxSteps=Math.max(maxSteps,rows[b+2]);const dispatch=(encoder,index)=>{const pass=encoder.beginComputePass();pass.setPipeline(compiled[index]);pass.setBindGroup(0,groups[index]);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();};
 // Both encoders consume the identical pass order. Submission boundaries never
 // change shader code, step counts, bindings, or resident-buffer contents.
 function* phases(){yield 0;for(let step=0;step<maxSteps;step++)for(let phase=1;phase<compiled.length-1;phase++)yield phase;yield compiled.length-1;}
 const current=signal=>{if(disposed)throw Error('Disposed raw strike bank');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
 return Object.freeze({count,resultBuffer:result,resultWordStride:128,maximumSteps:maxSteps,dispatches:2+(compiled.length-2)*maxSteps,
 encode(encoder){current();for(const phase of phases())dispatch(encoder,phase);},
 async encodeCooperatively({getEncoder,afterCommand,signal}={}){
  if(typeof getEncoder!=='function'||typeof afterCommand!=='function')throw TypeError('Owned encoder and completed-command callback required');
  current(signal);for(const phase of phases()){current(signal);dispatch(getEncoder(),phase);await afterCommand();current(signal);}
 },dispose(){if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}});},
 async run(scene,rows){const bank=this.createBank(scene,rows),read=device.createBuffer({size:bank.count*128*4,usage:9});try{const encoder=device.createCommandEncoder();bank.encode(encoder);encoder.copyBufferToBuffer(bank.resultBuffer,0,read,0,read.size);const start=performance.now();device.queue.submit([encoder.finish()]);await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return{result,metrics:{candidates:bank.count,dispatches:bank.dispatches,scratchBytes:bank.count*32*4,submitToReadMs:performance.now()-start,exactInteger:true,hostPhysicsBetweenPhases:false,rawInputUploads:1,sceneUploads:1}};}finally{read.destroy();bank.dispose();}}
 });}
