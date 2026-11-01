/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet.
 * Modified 2026: shared four-body prepared-contact arithmetic graph.
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177; Parry 0.31.1.
 * Source: dynamics/solver/contact_constraint/contact_with_twist_friction.rs,
 * contact_constraint_element.rs, and the staged solver solve.rs/worker.rs.
 * Derived from the source-ordered experimental-cloth-island-world.js and
 * experimental-cushion-roster-world.js ports. Upstream license notices:
 * vendor/RAPIER-LICENSE.txt; glam MIT/Apache-2.0.
 *
 * NUMERICAL PHASE ONLY. The owner supplies already prepared one-point manifolds
 * and persistent native bucket order. This module does not discover contacts,
 * assign solver colors, certify topology/activation/CCD, or admit a whole world.
 * Every constraint references the SAME mutable graph body records. Forces,
 * gyroscopic correction and integration occur exactly once per body/substep;
 * damping and inverse-inertia writeback occur once at the end of the outer h.
 */
(function(G){'use strict';
const A=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const R=typeof module!=='undefined'&&module.exports?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental;
const f=Math.fround,BODY_STRIDE=64,CONTACT_STRIDE=32,COMMON_FLOATS=64;
const S=Object.freeze({dt:0,lengthUnit:1,normalizedMaxLinearVelocity:2,dynamicFrequency:3,dynamicDamping:4,staticFrequency:5,staticDamping:6,warmstartCoefficient:7,normalizedMaxCorrectiveVelocity:8,frictionInBiasPass:9,gravity:10});
const BODY=Object.freeze({linear:[0,3],angular:[3,3],translation:[6,3],rotation:[9,4],invMass:[13,3],invInertia:[16,9],principalInertia:[25,3],invPrincipalInertia:[28,3],principalFrame:[31,4],userForce:[35,3],userTorque:[38,3]});
const BODY_SCALARS=Object.freeze({gravityScale:41,linearDamping:42,angularDamping:43,gyroscopic:44,allowFastRotation:45,radius:46});
const CONTACT_VECTORS=Object.freeze({normal:0,anchor1:3,anchor2:6,dp1:9,dp2:12,warmWorld:15});
const CONTACT_SCALARS=Object.freeze({warmImpulse:18,impulse:19,friction:20,restitution:21});
const CAPABILITY=Object.freeze({wholeWorld:false,preparedManifoldsOnly:true,maxBodies:4,maxContacts:64,singlePointManifolds:true,sharedVelocityRoster:true,sourceBucketOrderRequired:true,cloth:true,staticConvex:true,dynamicSphere:true,ccd:false,activation:false,geometry:false});

function validateConfig(input){
 if(!input||!Number.isSafeInteger(input.bodyCount)||input.bodyCount<1||input.bodyCount>CAPABILITY.maxBodies)throw RangeError('One to four dynamic solver bodies required');
 const config={bodyCount:input.bodyCount};
 for(const [key,min,max]of[['substeps',1,32],['pgsIterations',1,32],['stabilizationIterations',1,32]]){
  const n=input[key];if(!Number.isSafeInteger(n)||n<min||n>max)throw RangeError('Unsupported source iteration count: '+key);config[key]=n;
 }
 if(!Array.isArray(input.contacts)||input.contacts.length>CAPABILITY.maxContacts)throw RangeError('Bounded prepared contact roster required');
 const bodyIndex=n=>Number.isSafeInteger(n)&&n>=0&&n<config.bodyCount;
 config.contacts=input.contacts.map((x,index)=>{
  if(!x||!['cloth','static-convex','dynamic-sphere'].includes(x.kind)||!bodyIndex(x.body2))throw RangeError('Invalid contact descriptor '+index);
  if(x.kind==='dynamic-sphere'?(!bodyIndex(x.body1)||x.body1===x.body2):x.body1!==null)throw RangeError('Explicit source contact sides required at '+index);
  return Object.freeze({kind:x.kind,body1:x.body1,body2:x.body2});
 });
 if(!Array.isArray(input.contactOrder)||new Set(input.contactOrder).size!==input.contactOrder.length||input.contactOrder.some(i=>!Number.isSafeInteger(i)||i<0||i>=config.contacts.length))throw RangeError('Unique native ordered active contact indexes required');
 config.contactOrder=Object.freeze(input.contactOrder.slice());config.contacts=Object.freeze(config.contacts);
 return Object.freeze(config);
}

function builder(INPUT_FLOATS){const nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return INPUT_FLOATS+nodes.length-1;},c=x=>op('const',f(x)),z=c(0),one=c(1),two=c(2),half=c(.5),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),div=(a,b)=>op('div',a,b),neg=a=>op('negate',a),choose=(p,a,b)=>op('choose',p,a,b),v=(i,n=3)=>Array.from({length:n},(_,j)=>i+j),va=(a,b)=>a.map((x,i)=>add(x,b[i])),vs=(a,b)=>a.map((x,i)=>sub(x,b[i])),vm=(a,s)=>a.map(x=>mul(x,s)),vc=(a,b)=>a.map((x,i)=>mul(x,b[i])),dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),cross=(a,b)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))],norm=a=>op('sqrt',dot(a,a)),iv=x=>op('inv',x),sel=(p,a,b)=>a.map((x,i)=>choose(p,x,b[i]));
 const qm=(a,b)=>[sub(add(add(mul(a[3],b[0]),mul(a[0],b[3])),mul(a[1],b[2])),mul(a[2],b[1])),add(add(sub(mul(a[3],b[1]),mul(a[0],b[2])),mul(a[1],b[3])),mul(a[2],b[0])),add(sub(add(mul(a[3],b[2]),mul(a[0],b[1])),mul(a[1],b[0])),mul(a[2],b[3])),sub(sub(sub(mul(a[3],b[3]),mul(a[0],b[0])),mul(a[1],b[1])),mul(a[2],b[2]))],qi=q=>[...q.slice(0,3).map(neg),q[3]],rotate=(q,a)=>{const b=q.slice(0,3);return va(va(vm(a,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(a,b),two))),vm(cross(b,a),mul(q[3],two)));},sr=(q,a)=>{const t=vm(cross(q.slice(0,3),a),two);return va(va(vm(t,q[3]),cross(q.slice(0,3),t)),a);},matrix=(m,a)=>[dot(m.slice(0,3),a),dot(m.slice(3,6),a),dot(m.slice(6,9),a)],qdot=(a,b)=>add(add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),mul(a[3],b[3]));
 const finish=fields=>{const outputs=[],layout={};for(const[k,ids]of Object.entries(fields)){layout[k]={offset:outputs.length,length:ids.length};outputs.push(...ids);}return{inputFloats:INPUT_FLOATS,nodes,outputs,layout};};return{nodes,op,c,z,one,two,half,add,sub,mul,div,neg,choose,v,va,vs,vm,vc,dot,cross,norm,iv,sel,qm,qi,rotate,sr,matrix,qdot,finish};}
function buildPlan(input){
 const config=validateConfig(input),contactBase=COMMON_FLOATS+config.bodyCount*BODY_STRIDE,INPUT_FLOATS=contactBase+config.contacts.length*CONTACT_STRIDE;
 const {substeps,pgsIterations,stabilizationIterations}=config;
 const g=builder(INPUT_FLOATS),{op,c,z,one,two,half,add,sub,mul,div,neg,choose,v,va,vs,vm,vc,dot,cross,norm,iv,sel,qm,qi,rotate,sr,matrix,finish}=g,dt=div(S.dt,c(substeps)),invDt=div(one,dt);
 const bodies=Array.from({length:config.bodyCount},(_,i)=>{const base=COMMON_FLOATS+i*BODY_STRIDE;return{base,linear:v(base),angular:v(base+3),position:v(base+6),rotation:v(base+9,4),im:v(base+13),ii:v(base+16,9)};});
 function pairConstraint(index,spec){
 const base=contactBase+index*CONTACT_STRIDE,pairBodies=[bodies[spec.body1],bodies[spec.body2]],arms=[v(base+9),v(base+12)],anchors=[v(base+3),v(base+6)];
 const normal=v(base).map(neg),sign=op('signbitSign',normal[2]),basisA=div(neg(one),add(sign,normal[2])),basisB=mul(mul(normal[0],normal[1]),basisA),t1=[basisB,add(sign,mul(mul(normal[1],normal[1]),basisA)),neg(normal[1])],t2=cross(normal,t1),tangents=[t1,t2];
 const point=pairBodies.map((b,i)=>va(b.position,arms[i])),local=point.map((p,i)=>sr(qi(pairBodies[i].rotation),vs(p,pairBodies[i].position))),live=dot(vs(va(sr(pairBodies[0].rotation,anchors[0]),pairBodies[0].position),va(sr(pairBodies[1].rotation,anchors[1]),pairBodies[1].position)),normal),baseDist=sub(live,dot(vs(point[0],point[1]),normal)),imsum=va(pairBodies[0].im,pairBodies[1].im);
 const torqueN=pairBodies.map((b,i)=>cross(arms[i],i?normal.map(neg):normal)),iiN=pairBodies.map((b,i)=>matrix(b.ii,torqueN[i])),rN=iv(add(add(dot(normal,vc(imsum,normal)),dot(iiN[0],torqueN[0])),dot(iiN[1],torqueN[1]))),frictionDp=point.map((p,i)=>vs(p,pairBodies[i].position)),torqueT=pairBodies.map((b,i)=>tangents.map(t=>cross(frictionDp[i],i?t.map(neg):t))),iiT=pairBodies.map((b,i)=>torqueT[i].map(t=>matrix(b.ii,t))),k=tangents.map((t,j)=>add(add(dot(t,vc(imsum,t)),dot(iiT[0][j],torqueT[0][j])),dot(iiT[1][j],torqueT[1][j]))),k12=mul(mul(two,add(dot(iiT[0][0],torqueT[0][1]),dot(iiT[1][0],torqueT[1][1]))),half),invDet=iv(sub(mul(k[0],k[1]),mul(k12,k12)));
 let impulse=(base+18),acc=neg((base+18)),ti=[dot(v(base+15),t1),dot(v(base+15),t2)];const velocities=pairBodies.map((b,i)=>va(b.linear,cross(b.angular,arms[i]))),isNew=op('le',(base+19),z),bouncy=choose(isNew,op('gt',(base+21),z),op('le',one,(base+21))),seed=mul(mul(bouncy,(base+21)),dot(vs(velocities[0],velocities[1]),normal));
 const omega=mul(S.dynamicFrequency,c(2*Math.PI)),erp=div(omega,add(mul(dt,omega),mul(two,S.dynamicDamping))),erpScaled=mul(dt,erp),a=sub(div(one,erpScaled),one),cfm=div(one,add(one,div(mul(a,a),mul(mul(mul(add(one,a),c(4)),S.dynamicDamping),S.dynamicDamping)))),maxCorrect=mul(S.normalizedMaxCorrectiveVelocity,S.lengthUnit);
 const applyN=change=>pairBodies.forEach((b,i)=>{b.linear=va(b.linear,vm(vc(normal,b.im),i?neg(change):change));b.angular=va(b.angular,vm(iiN[i],change));});
 const applyT=change=>pairBodies.forEach((b,i)=>{const changeLinear=i?change.map(neg):change;b.linear=va(b.linear,vc(va(vm(t1,changeLinear[0]),vm(t2,changeLinear[1])),b.im));b.angular=va(b.angular,va(vm(iiT[i][0],change[0]),vm(iiT[i][1],change[1])));});
 const dv=(dir,torques)=>add(sub(add(dot(dir,pairBodies[0].linear),dot(torques[0],pairBodies[0].angular)),dot(dir,pairBodies[1].linear)),dot(torques[1],pairBodies[1].angular));
 const solve=(rhs,soft,friction)=>{const next=mul(soft,op('max',sub(impulse,mul(rN,add(dv(normal,torqueN),rhs))),z));applyN(sub(next,impulse));impulse=next;const d=tangents.map((t,j)=>dv(t,[torqueT[0][j],torqueT[1][j]])),nt=[sub(ti[0],mul(sub(mul(k[1],d[0]),mul(k12,d[1])),invDet)),sub(ti[1],mul(sub(mul(k[0],d[1]),mul(k12,d[0])),invDet))],length=op('sqrt',add(mul(nt[0],nt[0]),mul(nt[1],nt[1]))),limit=mul((base+20),impulse),clamped=vm(nt,op('cap',length,limit)),chosen=sel(friction,clamped,ti);applyT(vs(chosen,ti));ti=chosen;};
 const separation=()=>add(baseDist,dot(vs(va(sr(pairBodies[0].rotation,local[0]),pairBodies[0].position),va(sr(pairBodies[1].rotation,local[1]),pairBodies[1].position)),normal));

 let rhs=z,soft=one;return{update(){const dist=separation();rhs=add(mul(op('max',dist,z),invDt),op('min',op('max',mul(dist,erp),neg(maxCorrect)),z));soft=choose(op('le',dist,z),cfm,one);acc=add(acc,impulse);impulse=mul(impulse,S.warmstartCoefficient);ti=vm(ti,S.warmstartCoefficient);applyN(impulse);applyT(ti);},biased(){solve(rhs,soft,z);},relax(){solve(mul(op('max',separation(),z),invDt),one,one);},bounce(){
 const bounceGate=mul(op('lt',seed,z),op('gt',add(acc,impulse),z)),bounce=choose(bounceGate,op('max',sub(impulse,mul(rN,add(dv(normal,torqueN),seed))),z),impulse);applyN(sub(bounce,impulse));impulse=bounce;
},fields(){return {['contact'+index]:[add(acc,impulse),impulse,...ti,...va(vm(t1,ti[0]),vm(t2,ti[1]))],['basis'+index]:[sign,...normal,...t1]};
}};}
 function fixedConstraint(index,spec){const b=bodies[spec.body2],base=contactBase+index*CONTACT_STRIDE,n=v(base),forceDir=n.map(neg),sign=op('signbitSign',forceDir[2]),ba=div(neg(one),add(sign,forceDir[2])),bb=mul(mul(forceDir[0],forceDir[1]),ba),t1=spec.kind==='cloth'?[z,z,one]:[bb,add(sign,mul(mul(forceDir[1],forceDir[1]),ba)),neg(forceDir[1])],t2=cross(forceDir,t1),td=[t1.map(neg),t2.map(neg)],anchor1=v(base+3),anchor2=v(base+6),dp1=v(base+9),dp2=v(base+12),frozenPoint=va(b.position,dp2),frictionDp=vs(frozenPoint,b.position),lp2=sr(qi(b.rotation),vs(frozenPoint,b.position)),lp1=dp1,liveDistance=dot(vs(anchor1,va(sr(b.rotation,anchor2),b.position)),forceDir),baseDist=sub(liveDistance,dot(vs(dp1,frozenPoint),forceDir));
 const torqueN=cross(dp2,n),iiN=matrix(b.ii,torqueN),rN=iv(add(dot(n,vc(b.im,n)),dot(iiN,torqueN))),torqueT=td.map(t=>cross(frictionDp,t)),iiT=torqueT.map(t=>matrix(b.ii,t)),k=td.map((t,j)=>add(dot(t,vc(b.im,t)),dot(iiT[j],torqueT[j]))),k12=mul(mul(two,dot(iiT[0],torqueT[1])),half),invDet=iv(sub(mul(k[0],k[1]),mul(k12,k12)));
 let impulse=base+18,acc=neg(impulse),ti=[dot(v(base+15),t1),dot(v(base+15),t2)];const isNew=op('le',base+19,z),bouncy=choose(isNew,op('gt',base+21,z),op('le',one,base+21)),seed=mul(mul(bouncy,base+21),dot(va(b.linear,cross(b.angular,dp2)),n));
 const softness=(freq,damp)=>{const w=mul(freq,c(2*Math.PI)),erp=div(w,add(mul(dt,w),mul(two,damp))),e=mul(dt,erp),a=sub(div(one,e),one),cfm=div(one,add(one,div(mul(a,a),mul(mul(mul(add(one,a),c(4)),damp),damp))));return{erp,cfm};},dyn=softness(S.dynamicFrequency,S.dynamicDamping),stat=softness(S.staticFrequency,S.staticDamping),cfm=add(dyn.cfm,sub(stat.cfm,dyn.cfm)),erp=add(dyn.erp,sub(stat.erp,dyn.erp)),maxCorrect=mul(S.normalizedMaxCorrectiveVelocity,S.lengthUnit);
 const applyN=change=>{b.linear=va(b.linear,vm(vc(n,b.im),change));b.angular=va(b.angular,vm(iiN,change));},applyT=change=>{b.linear=va(b.linear,vc(va(vm(td[0],change[0]),vm(td[1],change[1])),b.im));b.angular=va(b.angular,va(vm(iiT[0],change[0]),vm(iiT[1],change[1])));};
 const solve=(rhs,soft,friction)=>{const dv=add(add(dot(n,b.linear),dot(torqueN,b.angular)),rhs),next=mul(soft,op('max',sub(impulse,mul(rN,dv)),z));applyN(sub(next,impulse));impulse=next;const d=td.map((t,j)=>add(dot(t,b.linear),dot(torqueT[j],b.angular))),nt=[sub(ti[0],mul(sub(mul(k[1],d[0]),mul(k12,d[1])),invDet)),sub(ti[1],mul(sub(mul(k[0],d[1]),mul(k12,d[0])),invDet))],length=op('sqrt',add(mul(nt[0],nt[0]),mul(nt[1],nt[1]))),clamped=vm(nt,op('cap',length,mul(base+20,impulse))),chosen=sel(friction,clamped,ti);applyT(vs(chosen,ti));ti=chosen;};
 const separation=()=>add(baseDist,dot(vs(lp1,va(sr(b.rotation,lp2),b.position)),forceDir));let rhs=z,soft=one;return{index,update(){const dist=separation();rhs=add(mul(op('max',dist,z),invDt),op('min',op('max',mul(dist,erp),neg(maxCorrect)),z));soft=choose(op('le',dist,z),cfm,one);acc=add(acc,impulse);impulse=mul(impulse,S.warmstartCoefficient);ti=vm(ti,S.warmstartCoefficient);applyN(impulse);applyT(ti);},biased(){solve(rhs,soft,z);},relax(){solve(mul(op('max',separation(),z),invDt),one,one);},bounce(){const gate=mul(op('lt',seed,z),op('gt',add(acc,impulse),z)),next=choose(gate,op('max',sub(impulse,mul(rN,add(add(dot(n,b.linear),dot(torqueN,b.angular)),seed))),z),impulse);applyN(sub(next,impulse));impulse=next;},fields(){return{['contact'+index]:[add(acc,impulse),impulse,...ti,...va(vm(t1,ti[0]),vm(t2,ti[1]))],['basis'+index]:[sign,...forceDir,...t1]};}};}

 // Prepare every constraint, including restitution seeds, before any force/warm-start.
 const constraints=config.contactOrder.map(index=>{const spec=config.contacts[index];return spec.kind==='dynamic-sphere'?pairConstraint(index,spec):fixedConstraint(index,spec);});
 for(const b of bodies){b.force=va(v(b.base+35),vm(vc(v(S.gravity),b.im.map(iv)),b.base+41));b.dl=vm(vc(b.force,b.im),dt);b.da=vm(matrix(b.ii,v(b.base+38)),dt);}
 for(let step=0;step<substeps;step++){
  for(const b of bodies){b.linear=va(b.linear,b.dl);b.angular=va(b.angular,b.da);const axes=qm(b.rotation,v(b.base+31,4)),w=rotate(qi(axes),b.angular),momentum=vc(v(b.base+25),w),total=va(momentum,vm(cross(w,momentum).map(neg),dt)),sq=dot(total,total),scale=op('sqrt',div(dot(momentum,momentum),choose(sq,sq,one))),corrected=rotate(axes,vc(v(b.base+28),vm(total,scale)));b.angular=sel(b.base+44,sel(sq,corrected,b.angular),b.angular);}
 for(const q of constraints)q.update();for(let j=0;j<pgsIterations;j++)for(const q of constraints)q.biased();
  for(const b of bodies){b.linear=vm(b.linear,op('cap',norm(b.linear),mul(S.normalizedMaxLinearVelocity,S.lengthUnit)));b.angular=vm(b.angular,choose(b.base+45,one,op('cap',norm(b.angular),mul(c(Math.PI/4),div(one,S.dt)))));const q=qm([...vm(b.angular,mul(dt,half)),one],b.rotation),ql=op('sqrt',add(add(add(mul(q[0],q[0]),mul(q[1],q[1])),mul(q[2],q[2])),mul(q[3],q[3])));b.rotation=vm(q,div(one,ql));b.position=va(b.position,vm(b.linear,dt));}
 for(let j=0;j<stabilizationIterations;j++)for(const q of constraints)q.relax();}
 for(const q of constraints)q.bounce();const fields={};for(const q of constraints)Object.assign(fields,q.fields());
 bodies.forEach((b,i)=>{b.linear=vm(b.linear,div(one,add(one,mul(S.dt,b.base+42))));b.angular=vm(b.angular,div(one,add(one,mul(S.dt,b.base+43))));const q=qm(b.rotation,v(b.base+31,4)),x2=add(q[0],q[0]),y2=add(q[1],q[1]),z2=add(q[2],q[2]),xx=mul(q[0],x2),xy=mul(q[0],y2),xz=mul(q[0],z2),yy=mul(q[1],y2),yz=mul(q[1],z2),zz=mul(q[2],z2),wx=mul(q[3],x2),wy=mul(q[3],y2),wz=mul(q[3],z2),cols=[[sub(one,add(yy,zz)),add(xy,wz),sub(xz,wy)],[sub(xy,wz),sub(one,add(xx,zz)),add(yz,wx)],[add(xz,wy),sub(yz,wx),sub(one,add(xx,yy))]],term=(j,k)=>add(add(mul(mul(cols[0][j],b.base+28),cols[0][k]),mul(mul(cols[1][j],b.base+29),cols[1][k])),mul(mul(cols[2][j],b.base+30),cols[2][k])),m11=term(0,0),m12=term(0,1),m13=term(0,2),m22=term(1,1),m23=term(1,2),m33=term(2,2);fields['body'+i]=[...b.linear,...b.angular,...b.position,...b.rotation,m11,m12,m13,m12,m22,m23,m13,m23,m33,...b.force];});const plan=finish(fields);plan.config=config;plan.contactBase=contactBase;A.validatePlan(plan);return plan;}

function finite(value,label){
 if(typeof value!=='number'||!Number.isFinite(f(value)))throw TypeError('Finite f32 value required: '+label);
 return f(value);
}
function vector(value,length,label){
 if(!Array.isArray(value)&&!(value instanceof Float32Array))throw TypeError('Explicit vector required: '+label);
 if(value.length!==length)throw RangeError('Wrong vector length: '+label);
 return Array.from(value,(x,i)=>finite(x,label+'['+i+']'));
}
function zeroVectorIfPresent(value,label){
 if(value!==undefined&&vector(value,3,label).some(x=>x!==0))throw RangeError('Unsupported nonzero '+label);
}
// Geometry is not reconstructed here. The two anchor conventions intentionally
// match native identity/world-attached solver poses, not fixed collider poses.
function pack(prepared,plan){
 const config=plan.config;
 if(!prepared||!Array.isArray(prepared.bodies)||prepared.bodies.length!==config.bodyCount||!Array.isArray(prepared.contacts)||prepared.contacts.length!==config.contacts.length)throw RangeError('Exact prepared body and contact rosters required');
 const packed=new Float32Array(plan.inputFloats);
 for(const [key,index]of Object.entries(S)){
  if(key==='gravity'){packed.set(vector(prepared.gravity,3,'gravity'),index);continue;}
  if(key==='frictionInBiasPass'){
   if(prepared[key]!==false&&prepared[key]!==0)throw RangeError('Source frictionInBiasPass=false required');
   packed[index]=0;continue;
  }
  packed[index]=finite(prepared[key],key);
 }
 for(const key of['dt','lengthUnit','normalizedMaxLinearVelocity','dynamicFrequency','dynamicDamping','staticFrequency','staticDamping'])if(!(packed[S[key]]>0))throw RangeError('Positive source parameter required: '+key);
 if(packed[S.warmstartCoefficient]<0||packed[S.warmstartCoefficient]>1||packed[S.normalizedMaxCorrectiveVelocity]<0)throw RangeError('Unsupported source warm-start/correction parameters');
 for(const key of['substeps','pgsIterations','stabilizationIterations'])if(prepared[key]!==undefined&&prepared[key]!==config[key])throw RangeError('Source iteration count changed: '+key);
 prepared.bodies.forEach((body,i)=>{
  if(!body)throw TypeError('Missing solver body '+i);
  const base=COMMON_FLOATS+i*BODY_STRIDE;
  zeroVectorIfPresent(body.localCom,'body'+i+'.localCom');
  for(const [key,[offset,length]]of Object.entries(BODY))packed.set(vector(body[key],length,'body'+i+'.'+key),base+offset);
  for(const [key,offset]of Object.entries(BODY_SCALARS)){
   const value=body[key];
   if(key==='gyroscopic'||key==='allowFastRotation'){
    if(![true,false,0,1].includes(value))throw TypeError('Explicit source body flag required: '+key);
    packed[base+offset]=Number(value);
   }else packed[base+offset]=finite(value,'body'+i+'.'+key);
  }
  if(packed[base+46]<=0||packed[base+42]<0||packed[base+43]<0)throw RangeError('Invalid sphere radius or damping');
  for(const offset of[13,14,15,25,26,27,28,29,30])if(packed[base+offset]<0)throw RangeError('Negative body mass/inertia');
  for(const offset of[9,31]){
   const q=packed.subarray(base+offset,base+offset+4),length=Math.hypot(...q);
   if(Math.abs(length-1)>1e-4)throw RangeError('Unit source body rotation required');
  }
 });
 const active=new Set(config.contactOrder);
 prepared.contacts.forEach((contact,i)=>{
  // Retained but inactive native manifolds have no numerical effect. Their
  // owner preserves their old caches; the result exposes null at these indexes.
  if(!active.has(i))return;
  if(!contact)throw TypeError('Missing active prepared contact '+i);
  const base=plan.contactBase+i*CONTACT_STRIDE,spec=config.contacts[i];
  if(contact.kind!==undefined&&contact.kind!==spec.kind)throw RangeError('Contact kind changed at '+i);
  for(const key of['body1','body2'])if(contact[key]!==undefined&&contact[key]!==spec[key])throw RangeError('Contact body mapping changed at '+i);
  zeroVectorIfPresent(contact.tangentVelocity,'contact'+i+'.tangentVelocity');
  for(const [key,offset]of Object.entries(CONTACT_VECTORS))packed.set(vector(contact[key],3,'contact'+i+'.'+key),base+offset);
  for(const [key,offset]of Object.entries(CONTACT_SCALARS)){
   packed[base+offset]=finite(contact[key],'contact'+i+'.'+key);
   if(packed[base+offset]<0)throw RangeError('Negative source contact '+key);
  }
  const n=packed.subarray(base,base+3);
  if(Math.abs(Math.hypot(...n)-1)>1e-4)throw RangeError('Unit prepared contact normal required');
  if(spec.kind==='cloth'&&(n[0]!==0||n[1]!==1||n[2]!==0))throw RangeError('Cloth contact requires upward source normal');
 });
 return packed;
}

// Simplified/twist source writeback does NOT change ContactData.tangent_impulse.
// The owner must retain that field; only the seven cache fields below are written.
function unpack(raw,plan){
 if(!(raw instanceof Float32Array)||raw.length!==plan.outputs.length||raw.some(x=>!Number.isFinite(x)))throw RangeError('Exact finite contact solve output required');
 const result={bodies:[],contacts:Array.from({length:plan.config.contacts.length},()=>null)};
 // Native writeback canonicalizes cache zero signs, but never body or basis bits.
 for(const [key,field]of Object.entries(plan.layout)){const cache=key.startsWith('contact');result[key]=Array.from(raw.subarray(field.offset,field.offset+field.length),x=>cache&&x===0?0:x);}
 for(let i=0;i<plan.config.bodyCount;i++){
  const x=result['body'+i];result.bodies.push({linear:x.slice(0,3),angular:x.slice(3,6),translation:x.slice(6,9),rotation:x.slice(9,13),invInertia:x.slice(13,22),force:x.slice(22,25)});
 }
 for(const i of plan.config.contactOrder){
  const x=result['contact'+i];result.contacts[i]={impulse:x[0],warmImpulse:x[1],warmTangent:x.slice(2,4),warmWorld:x.slice(4,7),basis:result['basis'+i].slice()};
 }
 return result;
}

function createReferenceMathStage(config){
 const plan=buildPlan(config);let disposed=false;
 return Object.freeze({capability:CAPABILITY,backend:'cpu-reference',config:plan.config,
  step(prepared){if(disposed)throw Error('Coupled math stage disposed');return unpack(A.execute(pack(prepared,plan),plan),plan);},
  dispose(){disposed=true;}
 });
}

async function createGpuMathStage(device,config){
 if(!device?.createShaderModule||!device?.queue)throw TypeError('Actual WebGPU device required');
 const plan=buildPlan(config),owned=[];
 let disposed=false,busy=false;
 const destroy=()=>{for(const buffer of owned)buffer.destroy();owned.length=0;};
 try{
  const shader=device.createShaderModule({label:'coupled-contact-f32-interpreter',code:R.shaderForInputFloats(plan.inputFloats)}),info=await shader.getCompilationInfo();
  if(info.messages.some(x=>x.type==='error'))throw Error('Coupled contact WGSL compile failure: '+info.messages.filter(x=>x.type==='error').map(x=>x.message).join('; '));
  const pipeline=await device.createComputePipelineAsync({label:'coupled-contact-shared-body-plan',layout:'auto',compute:{module:shader,entryPoint:'main'}}),program=A.encode(plan),indices=Uint32Array.from(plan.outputs);
  const make=(size,usage)=>{const buffer=device.createBuffer({size,usage});owned.push(buffer);return buffer;};
  const pb=make(program.byteLength,136),ib=make(indices.byteLength,136);
  device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);
  return Object.freeze({capability:CAPABILITY,backend:'webgpu',config:plan.config,
   async step(prepared){
    if(disposed||busy)throw Error('Coupled math stage unavailable');
    const input=pack(prepared,plan),temporary=[];
    busy=true;
    const buffer=(size,usage)=>{const value=device.createBuffer({size,usage});temporary.push(value);return value;};
    try{
     const source=buffer(input.byteLength,136),scratch=buffer((plan.inputFloats+plan.nodes.length)*4,128),size=(plan.outputs.length+1)*4,output=buffer(size,132),read=buffer(size,9);
     device.queue.writeBuffer(source,0,input);
     const bindings=[source,pb,scratch,ib,output].map((value,binding)=>({binding,resource:{buffer:value}}));
     const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:bindings}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
     pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
     encoder.copyBufferToBuffer(output,0,read,0,size);device.queue.submit([encoder.finish()]);
     await read.mapAsync(1);const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();
     if(raw.at(-1)!==1||raw.some(x=>!Number.isFinite(x)))throw Error('Incomplete coupled contact GPU stage');
     return unpack(raw.subarray(0,plan.outputs.length),plan);
    }finally{for(const value of temporary)value.destroy();busy=false;}
   },
   dispose(){if(busy)throw Error('Coupled math stage busy');if(disposed)return;disposed=true;destroy();}
  });
 }catch(error){destroy();throw error;}
}

const api=Object.freeze({CAPABILITY,validateConfig,buildPlan,pack,unpack,createReferenceMathStage,createGpuMathStage});
G.LabCoupledContactMathExperimental=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
