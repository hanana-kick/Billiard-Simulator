import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: resident ordered solver.
 * Source equations: experimental-coupled-contact-math.js:47-89, adapted from
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177 / Parry 0.31.1.
 * See vendor/RAPIER-LICENSE.txt; quaternion formulas retain glam notices there.
 * NUMERICAL SOLVER ONLY: no geometry, activation, CCD or full-world claim.
 * Sixteen shared arithmetic programs; topology/order/iteration loops execute on
 * the GPU, without host-selected permutations or per-h source buildPlan calls.
 */
import {compileGraph, executeLowered, NUMERIC_STATUS} from './numeric-program.mjs';

const COMMON = 64, BODY = 64, CONTACT = 32, COEFFICIENT = 128, INPUTS = 352;
const B0 = 64, B1 = 128, RAW = 192, CO = 224, NONE = 0xffffffff;
const PROGRAM_NAMES = Object.freeze(['preparePair', 'prepareCloth', 'prepareConvex', 'force', 'gyro',
  'updatePair', 'updateFixed', 'biasedPair', 'biasedFixed', 'integrate', 'relaxPair', 'relaxFixed',
  'bouncePair', 'bounceFixed', 'cache', 'finalize']);
const KIND = Object.freeze({'dynamic-sphere': 0, cloth: 1, 'static-convex': 2});
export const COUPLED_BODY_OFFSETS = Object.freeze({linear:0,angular:3,translation:6,rotation:9,
  invMass:13,invInertia:16,principalInertia:25,invPrincipalInertia:28,principalFrame:31,
  userForce:35,userTorque:38,gravityScale:41,linearDamping:42,angularDamping:43,
  gyroscopic:44,allowFastRotation:45,radius:46,force:47,linearIncrement:50,angularIncrement:53});
export const COUPLED_CONTACT_OFFSETS = Object.freeze({normal:0,anchor1:3,anchor2:6,dp1:9,dp2:12,
  warmWorld:15,warmImpulse:18,impulse:19,friction:20,restitution:21,warmTangent:22});
export const COUPLED_LAYOUT = Object.freeze({commonWords: COMMON, bodyWords: BODY, contactWords: CONTACT,
  coefficientWords: COEFFICIENT, maxBodies: 4, maxContacts: 27, inputWords: INPUTS,
  forceOffset: 47, linearIncrementOffset: 50, angularIncrementOffset: 53,
  trace: Object.freeze({calls:13,phase:14,substep:15,sweep:16,item:17,advanceMagic:18}),
  phases: Object.freeze(['prepare','force','gyro','warm','biased','integrate','relax','bounce','cache','finalize','complete']),
  coefficient: Object.freeze({normal: 0, separationNormal: 3, tangent1: 6, tangent2: 9,
    actionTangent1: 12, actionTangent2: 15, local1: 18, local2: 21,
    torqueN1: 24, torqueN2: 27, iiN1: 30, iiN2: 33,
    torqueT11: 36, torqueT12: 39, torqueT21: 42, torqueT22: 45,
    iiT11: 48, iiT12: 51, iiT21: 54, iiT22: 57,
    inverseNormalMass: 60, tangentK1: 61, tangentK2: 62, tangentK12: 63, inverseDeterminant: 64,
    baseDistance: 65, restitutionSeed: 66, erp: 67, cfm: 68, maxCorrection: 69,
    impulse: 70, accumulatedImpulse: 71, tangentImpulse: 72, rhs: 74, softness: 75,
    basisSign: 76, friction: 77, inverseSubDt: 78, warmstartCoefficient: 79,
    rawCacheOutput: 80, basisOutput: 87}),
  roster: Object.freeze({headerWords: 8, descriptorWords: 4, bodyCount: 0, contactCount: 1,
    orderCount: 2, substeps: 3, pgsIterations: 4, stabilizationIterations: 5, status: 6,
    kinds: KIND}), programNames: PROGRAM_NAMES});

// The scalar expression builder intentionally mirrors the existing source graph
// (including strict inv epsilon, unary negation and the two quaternion rotates).
function builder() {
  const nodes = [], outputs = [], writes = [];
  const op = (kind, ...args) => { nodes.push({kind, args}); return INPUTS + nodes.length - 1; };
  const c = x => op('const', Math.fround(x)), z = c(0), one = c(1), two = c(2), half = c(.5);
  const add = (a,b) => op('add',a,b), sub = (a,b) => op('sub',a,b), mul = (a,b) => op('mul',a,b), div = (a,b) => op('div',a,b);
  const neg = a => op('negate',a), choose = (p,a,b) => op('choose',p,a,b), v = (i,n=3) => Array.from({length:n},(_,j)=>i+j);
  const va = (a,b) => a.map((x,i)=>add(x,b[i])), vs = (a,b) => a.map((x,i)=>sub(x,b[i]));
  const vm = (a,s) => a.map(x=>mul(x,s)), vc = (a,b) => a.map((x,i)=>mul(x,b[i]));
  const dot = (a,b) => add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
  const cross = (a,b) => [sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))];
  const norm = a => op('sqrt',dot(a,a)), iv = x => op('inv',x), sel = (p,a,b) => a.map((x,i)=>choose(p,x,b[i]));
  const qm = (a,b) => [sub(add(add(mul(a[3],b[0]),mul(a[0],b[3])),mul(a[1],b[2])),mul(a[2],b[1])),
    add(add(sub(mul(a[3],b[1]),mul(a[0],b[2])),mul(a[1],b[3])),mul(a[2],b[0])),
    add(sub(add(mul(a[3],b[2]),mul(a[0],b[1])),mul(a[1],b[0])),mul(a[2],b[3])),
    sub(sub(sub(mul(a[3],b[3]),mul(a[0],b[0])),mul(a[1],b[1])),mul(a[2],b[2]))];
  const qi = q => [...q.slice(0,3).map(neg),q[3]];
  const rotate = (q,a) => { const b=q.slice(0,3); return va(va(vm(a,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(a,b),two))),vm(cross(b,a),mul(q[3],two))); };
  const sr = (q,a) => {const t=vm(cross(q.slice(0,3),a),two);return va(va(vm(t,q[3]),cross(q.slice(0,3),t)),a);};
  const matrix = (m,a) => [dot(m.slice(0,3),a),dot(m.slice(3,6),a),dot(m.slice(6,9),a)];
  const write = (group,offset,values) => { for(const [i,id] of values.entries()){outputs.push(id);writes.push([group,offset+i]);} };
  const finish = () => ({plan:{inputFloats:INPUTS,nodes,outputs},writes});
  const body = base => ({base,linear:v(base),angular:v(base+3),position:v(base+6),rotation:v(base+9,4),im:v(base+13),ii:v(base+16,9)});
  return {nodes,op,c,z,one,two,half,add,sub,mul,div,neg,choose,v,va,vs,vm,vc,dot,cross,norm,iv,sel,qm,qi,rotate,sr,matrix,write,finish,body};
}

function prepare(pair, cloth=false) {
  const g=builder(),{op,c,z,one,two,half,add,sub,mul,div,neg,choose,v,va,vs,vm,vc,dot,cross,iv,qm,qi,sr,matrix,write,finish,body}=g;
  const a=body(B0),b=body(B1),dt=div(0,63),invDt=div(one,dt),values=Array(COEFFICIENT).fill(z);
  const put=(offset,items)=>items.forEach((id,i)=>values[offset+i]=id);
  let n,forceDir,t1,t2,local,torqueN,iiN,torqueT,iiT,k,k12,rN,invDet,baseDist,seed,erp,cfm,sign;
  const softness=(frequency,damping)=>{const omega=mul(frequency,c(2*Math.PI)),e=div(omega,add(mul(dt,omega),mul(two,damping))),scaled=mul(dt,e),aa=sub(div(one,scaled),one),f=div(one,add(one,div(mul(aa,aa),mul(mul(mul(add(one,aa),c(4)),damping),damping))));return{erp:e,cfm:f};};
  if(pair){
    const bodies=[a,b],arms=[v(RAW+9),v(RAW+12)],anchors=[v(RAW+3),v(RAW+6)];
    n=v(RAW).map(neg);forceDir=n;sign=op('signbitSign',n[2]);
    const ba=div(neg(one),add(sign,n[2])),bb=mul(mul(n[0],n[1]),ba);
    t1=[bb,add(sign,mul(mul(n[1],n[1]),ba)),neg(n[1])];t2=cross(n,t1);
    const tangents=[t1,t2],points=bodies.map((bb,i)=>va(bb.position,arms[i]));
    local=points.map((p,i)=>sr(qi(bodies[i].rotation),vs(p,bodies[i].position)));
    const live=dot(vs(va(sr(a.rotation,anchors[0]),a.position),va(sr(b.rotation,anchors[1]),b.position)),n);
    baseDist=sub(live,dot(vs(points[0],points[1]),n));const imsum=va(a.im,b.im);
    torqueN=bodies.map((bb,i)=>cross(arms[i],i?n.map(neg):n));iiN=bodies.map((bb,i)=>matrix(bb.ii,torqueN[i]));
    rN=iv(add(add(dot(n,vc(imsum,n)),dot(iiN[0],torqueN[0])),dot(iiN[1],torqueN[1])));
    const frictionDp=points.map((p,i)=>vs(p,bodies[i].position));
    torqueT=bodies.map((bb,i)=>tangents.map(t=>cross(frictionDp[i],i?t.map(neg):t)));
    iiT=bodies.map((bb,i)=>torqueT[i].map(t=>matrix(bb.ii,t)));
    k=tangents.map((t,j)=>add(add(dot(t,vc(imsum,t)),dot(iiT[0][j],torqueT[0][j])),dot(iiT[1][j],torqueT[1][j])));
    k12=mul(mul(two,add(dot(iiT[0][0],torqueT[0][1]),dot(iiT[1][0],torqueT[1][1]))),half);
    invDet=iv(sub(mul(k[0],k[1]),mul(k12,k12)));
    const velocities=bodies.map((bb,i)=>va(bb.linear,cross(bb.angular,arms[i]))),isNew=op('le',RAW+19,z);
    const bouncy=choose(isNew,op('gt',RAW+21,z),op('le',one,RAW+21));
    seed=mul(mul(bouncy,RAW+21),dot(vs(velocities[0],velocities[1]),n));
    ({erp,cfm}=softness(3,4));put(12,t1);put(15,t2);
  }else{
    n=v(RAW);forceDir=n.map(neg);sign=op('signbitSign',forceDir[2]);
    const ba=div(neg(one),add(sign,forceDir[2])),bb=mul(mul(forceDir[0],forceDir[1]),ba);
    t1=cloth?[z,z,one]:[bb,add(sign,mul(mul(forceDir[1],forceDir[1]),ba)),neg(forceDir[1])];t2=cross(forceDir,t1);
    const td=[t1.map(neg),t2.map(neg)],anchor1=v(RAW+3),anchor2=v(RAW+6),dp1=v(RAW+9),dp2=v(RAW+12);
    const frozenPoint=va(b.position,dp2),frictionDp=vs(frozenPoint,b.position);
    local=[dp1,sr(qi(b.rotation),vs(frozenPoint,b.position))];
    const live=dot(vs(anchor1,va(sr(b.rotation,anchor2),b.position)),forceDir);
    baseDist=sub(live,dot(vs(dp1,frozenPoint),forceDir));
    torqueN=[[z,z,z],cross(dp2,n)];iiN=[[z,z,z],matrix(b.ii,torqueN[1])];
    rN=iv(add(dot(n,vc(b.im,n)),dot(iiN[1],torqueN[1])));
    torqueT=[[[z,z,z],[z,z,z]],td.map(t=>cross(frictionDp,t))];
    iiT=[[[z,z,z],[z,z,z]],torqueT[1].map(t=>matrix(b.ii,t))];
    k=td.map((t,j)=>add(dot(t,vc(b.im,t)),dot(iiT[1][j],torqueT[1][j])));
    k12=mul(mul(two,dot(iiT[1][0],torqueT[1][1])),half);invDet=iv(sub(mul(k[0],k[1]),mul(k12,k12)));
    const isNew=op('le',RAW+19,z),bouncy=choose(isNew,op('gt',RAW+21,z),op('le',one,RAW+21));
    seed=mul(mul(bouncy,RAW+21),dot(va(b.linear,cross(b.angular,dp2)),n));
    const dyn=softness(3,4),stat=softness(5,6);cfm=add(dyn.cfm,sub(stat.cfm,dyn.cfm));erp=add(dyn.erp,sub(stat.erp,dyn.erp));
    put(12,td[0]);put(15,td[1]);
  }
  put(0,n);put(3,forceDir);put(6,t1);put(9,t2);put(18,local[0]);put(21,local[1]);
  put(24,torqueN[0]);put(27,torqueN[1]);put(30,iiN[0]);put(33,iiN[1]);
  put(36,torqueT[0][0]);put(39,torqueT[0][1]);put(42,torqueT[1][0]);put(45,torqueT[1][1]);
  put(48,iiT[0][0]);put(51,iiT[0][1]);put(54,iiT[1][0]);put(57,iiT[1][1]);
  put(60,[rN,...k,k12,invDet,baseDist,seed,erp,cfm,mul(8,1),RAW+18,neg(RAW+18),
    dot(v(RAW+15),t1),dot(v(RAW+15),t2),z,one,sign,RAW+20,invDt,7]);
  write(4,0,values.slice(0,80));return finish();
}

function contactPhase(pair,phase) {
  const g=builder(),{op,z,one,add,sub,mul,neg,choose,v,va,vs,vm,vc,dot,sr,sel,write,finish,body}=g;
  const bodies=[body(B0),body(B1)],n=v(CO),sn=v(CO+3),t=[v(CO+12),v(CO+15)],local=[v(CO+18),v(CO+21)];
  const tn=[v(CO+24),v(CO+27)],iin=[v(CO+30),v(CO+33)],tt=[[v(CO+36),v(CO+39)],[v(CO+42),v(CO+45)]],iit=[[v(CO+48),v(CO+51)],[v(CO+54),v(CO+57)]];
  let impulse=CO+70,acc=CO+71,ti=v(CO+72,2),rhs=CO+74,soft=CO+75;
  const applyN=change=>{for(const i of pair?[0,1]:[1]){const b=bodies[i];b.linear=va(b.linear,vm(vc(n,b.im),pair&&i?neg(change):change));b.angular=va(b.angular,vm(iin[i],change));}};
  const applyT=change=>{for(const i of pair?[0,1]:[1]){const b=bodies[i],lc=pair&&i?change.map(neg):change;b.linear=va(b.linear,vc(va(vm(t[0],lc[0]),vm(t[1],lc[1])),b.im));b.angular=va(b.angular,va(vm(iit[i][0],change[0]),vm(iit[i][1],change[1])));}};
  const dv=(dir,torques)=>pair?add(sub(add(dot(dir,bodies[0].linear),dot(torques[0],bodies[0].angular)),dot(dir,bodies[1].linear)),dot(torques[1],bodies[1].angular)):add(dot(dir,bodies[1].linear),dot(torques[1],bodies[1].angular));
  const separation=()=>{const p1=pair?va(sr(bodies[0].rotation,local[0]),bodies[0].position):local[0],p2=va(sr(bodies[1].rotation,local[1]),bodies[1].position);return add(CO+65,dot(vs(p1,p2),sn));};
  const solve=(r,s,friction)=>{const next=mul(s,op('max',sub(impulse,mul(CO+60,add(dv(n,tn),r))),z));applyN(sub(next,impulse));impulse=next;
    const d=t.map((td,j)=>dv(td,[tt[0][j],tt[1][j]])),nt=[sub(ti[0],mul(sub(mul(CO+62,d[0]),mul(CO+63,d[1])),CO+64)),sub(ti[1],mul(sub(mul(CO+61,d[1]),mul(CO+63,d[0])),CO+64))];
    const length=op('sqrt',add(mul(nt[0],nt[0]),mul(nt[1],nt[1]))),clamped=vm(nt,op('cap',length,mul(CO+77,impulse))),chosen=sel(friction,clamped,ti);applyT(vs(chosen,ti));ti=chosen;};
  if(phase==='update'){const dist=separation();rhs=add(mul(op('max',dist,z),CO+78),op('min',op('max',mul(dist,CO+67),neg(CO+69)),z));soft=choose(op('le',dist,z),CO+68,one);acc=add(acc,impulse);impulse=mul(impulse,CO+79);ti=vm(ti,CO+79);applyN(impulse);applyT(ti);}
  else if(phase==='biased')solve(rhs,soft,z);
  else if(phase==='relax')solve(mul(op('max',separation(),z),CO+78),one,one);
  else if(phase==='bounce'){const gate=mul(op('lt',CO+66,z),op('gt',add(acc,impulse),z)),next=choose(gate,op('max',sub(impulse,mul(CO+60,add(dv(n,tn),CO+66))),z),impulse);applyN(sub(next,impulse));impulse=next;}
  else throw new RangeError('Unknown source contact phase');
  for(const i of pair?[0,1]:[1])write(i+1,0,[...bodies[i].linear,...bodies[i].angular]);
  write(4,70,[impulse,acc,...ti,rhs,soft]);return finish();
}

function bodyPhase(phase) {
  const g=builder(),{op,c,z,one,two,half,add,sub,mul,div,neg,choose,v,va,vm,vc,dot,cross,norm,iv,sel,qm,qi,rotate,matrix,write,finish,body}=g;
  const b=body(B1),dt=div(0,63);
  if(phase==='force'){
    const force=va(v(B1+35),vm(vc(v(10),b.im.map(iv)),B1+41)),dl=vm(vc(force,b.im),dt),da=vm(matrix(b.ii,v(B1+38)),dt);
    write(2,47,[...force,...dl,...da]);
  }else if(phase==='gyro'){
    b.linear=va(b.linear,v(B1+50));b.angular=va(b.angular,v(B1+53));
    const axes=qm(b.rotation,v(B1+31,4)),w=rotate(qi(axes),b.angular),momentum=vc(v(B1+25),w),total=va(momentum,vm(cross(w,momentum).map(neg),dt)),sq=dot(total,total),scale=op('sqrt',div(dot(momentum,momentum),choose(sq,sq,one))),corrected=rotate(axes,vc(v(B1+28),vm(total,scale)));
    b.angular=sel(B1+44,sel(sq,corrected,b.angular),b.angular);write(2,0,[...b.linear,...b.angular]);
  }else if(phase==='integrate'){
    b.linear=vm(b.linear,op('cap',norm(b.linear),mul(2,1)));
    b.angular=vm(b.angular,choose(B1+45,one,op('cap',norm(b.angular),mul(c(Math.PI/4),div(one,0)))));
    const q=qm([...vm(b.angular,mul(dt,half)),one],b.rotation),ql=op('sqrt',add(add(add(mul(q[0],q[0]),mul(q[1],q[1])),mul(q[2],q[2])),mul(q[3],q[3])));
    b.rotation=vm(q,div(one,ql));b.position=va(b.position,vm(b.linear,dt));write(2,0,[...b.linear,...b.angular,...b.position,...b.rotation]);
  }else if(phase==='finalize'){
    b.linear=vm(b.linear,div(one,add(one,mul(0,B1+42))));b.angular=vm(b.angular,div(one,add(one,mul(0,B1+43))));
    const q=qm(b.rotation,v(B1+31,4)),x2=add(q[0],q[0]),y2=add(q[1],q[1]),z2=add(q[2],q[2]),xx=mul(q[0],x2),xy=mul(q[0],y2),xz=mul(q[0],z2),yy=mul(q[1],y2),yz=mul(q[1],z2),zz=mul(q[2],z2),wx=mul(q[3],x2),wy=mul(q[3],y2),wz=mul(q[3],z2);
    const cols=[[sub(one,add(yy,zz)),add(xy,wz),sub(xz,wy)],[sub(xy,wz),sub(one,add(xx,zz)),add(yz,wx)],[add(xz,wy),sub(yz,wx),sub(one,add(xx,yy))]];
    const term=(j,k)=>add(add(mul(mul(cols[0][j],B1+28),cols[0][k]),mul(mul(cols[1][j],B1+29),cols[1][k])),mul(mul(cols[2][j],B1+30),cols[2][k]));
    const m11=term(0,0),m12=term(0,1),m13=term(0,2),m22=term(1,1),m23=term(1,2),m33=term(2,2);
    write(2,0,[...b.linear,...b.angular]);write(2,16,[m11,m12,m13,m12,m22,m23,m13,m23,m33]);
  }else throw new RangeError('Unknown source body phase');
  return finish();
}

function cachePhase() {
  const g=builder(),{add,v,va,vm,write,finish}=g,t1=v(CO+6),t2=v(CO+9),ti=v(CO+72,2);
  const cache=[add(CO+71,CO+70),CO+70,...ti,...va(vm(t1,ti[0]),vm(t2,ti[1]))];
  write(4,80,cache);write(4,87,[CO+76,...v(CO+3),...t1]);
  write(3,19,[cache[0]]);write(3,18,[cache[1]]);write(3,22,cache.slice(2,4));write(3,15,cache.slice(4,7));
  return finish();
}

function sourceLocation(index) {
  if(index<64)return[0,index];if(index<128)return[1,index-64];if(index<192)return[2,index-128];
  if(index<224)return[3,index-192];return[4,index-224];
}

/** Once-only numerical library compilation, independent of any candidate roster. */
export function createCoupledProgramBundle() {
  const stages=[prepare(true),prepare(false,true),prepare(false),bodyPhase('force'),bodyPhase('gyro'),
    contactPhase(true,'update'),contactPhase(false,'update'),contactPhase(true,'biased'),contactPhase(false,'biased'),
    bodyPhase('integrate'),contactPhase(true,'relax'),contactPhase(false,'relax'),contactPhase(true,'bounce'),
    contactPhase(false,'bounce'),cachePhase(),bodyPhase('finalize')];
  const entries=stages.map((stage,index)=>{
    const needed=new Set(stage.plan.outputs.filter(id=>id<INPUTS));
    for(const node of stage.plan.nodes)if(node.kind!=='const')for(const arg of node.args)if(arg<INPUTS)needed.add(arg);
    const reads=[...needed].sort((a,b)=>a-b).map(id=>[id,...sourceLocation(id)]);
    return {...stage,name:PROGRAM_NAMES[index],compiled:compileGraph(stage.plan),reads};
  });
  const chunks=[],header=new Uint32Array(4+entries.length*6);header.set([0x52434353,1,entries.length,4]);let length=header.length;
  for(const [i,entry]of entries.entries()){
    const numerical=entry.compiled.program,inputMap=Uint32Array.from(entry.reads.flat()),outputMap=Uint32Array.from(entry.writes.flat());
    header.set([length,length+numerical.length,entry.reads.length,length+numerical.length+inputMap.length,entry.writes.length,entry.compiled.scratchWords],4+i*6);
    chunks.push(numerical,inputMap,outputMap);length+=numerical.length+inputMap.length+outputMap.length;
  }
  const program=new Uint32Array(length);program.set(header);let at=header.length;for(const chunk of chunks){program.set(chunk,at);at+=chunk.length;}
  return Object.freeze({program,entries:Object.freeze(entries.map(Object.freeze)),scratchWords:Math.max(...entries.map(x=>x.compiled.scratchWords)),programCount:entries.length});
}

export function coupledStateLayout(bodyCount,contactCount) {
  if(!Number.isInteger(bodyCount)||bodyCount<1||bodyCount>4||!Number.isInteger(contactCount)||contactCount<0||contactCount>27)
    throw new RangeError('Resident coupled solver supports one to four bodies and zero to 27 contacts');
  const contactBase=COMMON+BODY*bodyCount,coefficientBase=contactBase+CONTACT*contactCount,rosterBase=coefficientBase+COEFFICIENT*contactCount;
  return Object.freeze({stateBase:0,contactBase,coefficientBase,rosterBase,stateWords:rosterBase+8+5*contactCount,
    descriptorBase:rosterBase+8,orderBase:rosterBase+8+4*contactCount,bodyCount,contactCount});
}

/** Initial/test packing only. Future body/manifold/order state must remain on GPU. */
export function packCoupledInitialState(config,packed) {
  const layout=coupledStateLayout(config?.bodyCount,config?.contacts?.length);
  if(!(packed instanceof Float32Array)||packed.length!==layout.coefficientBase)throw new TypeError('Exact source initial packed numerical layout required');
  if(packed.some(x=>!Number.isFinite(x)))throw new RangeError('Finite initial source numerical state required');
  if(!Array.isArray(config.contactOrder)||new Set(config.contactOrder).size!==config.contactOrder.length||config.contactOrder.some(i=>!Number.isInteger(i)||i<0||i>=layout.contactCount))throw new RangeError('Exact unique source contact order required');
  for(const key of['substeps','pgsIterations','stabilizationIterations'])if(!Number.isInteger(config[key])||config[key]<1||config[key]>32)throw new RangeError('Source iteration range required');
  const state=new Uint32Array(layout.stateWords);state.set(new Uint32Array(packed.buffer,packed.byteOffset,packed.length));
  state.set([layout.bodyCount,layout.contactCount,config.contactOrder.length,config.substeps,config.pgsIterations,config.stabilizationIterations,0,0],layout.rosterBase);
  config.contacts.forEach((contact,i)=>{
    const kind=KIND[contact.kind],a=contact.body1,b=contact.body2;
    if(kind===undefined||!Number.isInteger(b)||b<0||b>=layout.bodyCount||(kind===0?(!Number.isInteger(a)||a<0||a>=layout.bodyCount||a===b):a!==null))throw new RangeError('Exact resident contact endpoints required');
    state.set([kind,a===null?NONE:a,b,0],layout.descriptorBase+i*4);
  });
  state.set(config.contactOrder,layout.orderBase);
  return {state,layout};
}

/** Read back a completed numerical solve; no geometry or forward calculation. */
export function unpackCoupledState(state,layout,{stateBase=0}={}) {
  if(!(state instanceof Uint32Array)||!Number.isSafeInteger(stateBase)||stateBase<0||layout.stateWords>state.length-stateBase)
    throw new RangeError('Complete resident coupled state required');
  if(state[stateBase+layout.rosterBase+6]!==NUMERIC_STATUS.COMPLETE)throw new RangeError('Coupled numerical solve is not complete');
  const floats=new Float32Array(state.buffer,state.byteOffset,state.length),values=(at,n)=>Array.from(floats.subarray(stateBase+at,stateBase+at+n));
  const out={bodies:[],contacts:Array(layout.contactCount).fill(null),rawContactOutputs:Array(layout.contactCount).fill(null)};
  for(let i=0;i<layout.bodyCount;i++){
    const at=COMMON+i*BODY,x=[...values(at,13),...values(at+16,9),...values(at+47,3)];out['body'+i]=x;
    out.bodies.push({linear:x.slice(0,3),angular:x.slice(3,6),translation:x.slice(6,9),rotation:x.slice(9,13),invInertia:x.slice(13,22),force:x.slice(22,25)});
  }
  const count=state[stateBase+layout.rosterBase+2];
  for(let j=0;j<count;j++){
    const i=state[stateBase+layout.orderBase+j],at=layout.contactBase+i*CONTACT,c=layout.coefficientBase+i*COEFFICIENT;
    const x=[...values(at+19,1),...values(at+18,1),...values(at+22,2),...values(at+15,3)],basis=values(c+87,7);
    out['contact'+i]=x;out['basis'+i]=basis;out.rawContactOutputs[i]=values(c+80,7);
    out.contacts[i]={impulse:x[0],warmImpulse:x[1],warmTangent:x.slice(2,4),warmWorld:x.slice(4,7),basis};
  }
  return out;
}

/** TEST ONLY: staging oracle for the same fixed microprogram schedule.
 * Production must invoke rc_coupled_step; this function refuses implicit use.
 */
export function executeCoupledForTest(bundle,initial,{stateBase=0,coefficientBase,rosterBase,testOnly=false,trace,maximumOperations=Infinity}={}) {
  if(testOnly!==true)throw new TypeError('Resident coupled host execution is TEST-ONLY');
  if(trace!==undefined&&!Array.isArray(trace))throw new TypeError('TEST-ONLY trace must be an array');
  if(maximumOperations!==Infinity&&(!Number.isInteger(maximumOperations)||maximumOperations<1))throw new RangeError('Positive bounded operation count required');
  if(!(initial instanceof Uint32Array)||!bundle?.entries)throw new TypeError('Compiled bundle and owned state words required');
  const state=initial.slice(),floatState=new Float32Array(state.buffer);
  const fail=message=>{const error=new RangeError(message);error.numericStatus=NUMERIC_STATUS.MALFORMED;throw error;};
  if(!Number.isSafeInteger(stateBase)||stateBase<0||!Number.isSafeInteger(rosterBase)||rosterBase<0||state.length-rosterBase<8)fail('Invalid coupled state bases');
  const [bc,cc,oc,steps,pgs,relax]=state.subarray(rosterBase,rosterBase+6);
  const layout=coupledStateLayout(bc,cc),descriptors=rosterBase+8,order=descriptors+4*cc;
  if(oc>cc||state[rosterBase+7]!==0||state.length-order<cc||[steps,pgs,relax].some(n=>n<1||n>32)||state.length-stateBase<layout.coefficientBase||!Number.isSafeInteger(coefficientBase)||coefficientBase<0||state.length-coefficientBase<cc*128)fail('Invalid coupled resident capacity or iterations');
  const overlaps=(a,n,b,m)=>n>0&&m>0&&a<b+m&&b<a+n;
  if(overlaps(stateBase,layout.coefficientBase,rosterBase,8+cc*5)||overlaps(stateBase,layout.coefficientBase,coefficientBase,cc*128)||overlaps(rosterBase,8+cc*5,coefficientBase,cc*128))fail('Coupled resident regions must not overlap');
  if(floatState[stateBase+9]!==0)fail('Source frictionInBiasPass=false is required');
  const chosen=Array.from(state.subarray(order,order+oc));if(new Set(chosen).size!==oc||chosen.some(i=>i>=cc))fail('Invalid ordered contact indexes');
  for(let i=0;i<cc;i++){const[k,a,b,reserved]=state.subarray(descriptors+4*i,descriptors+4*i+4);if(k>2||b>=bc||reserved!==0||(k===0?(a>=bc||a===b):a!==NONE))fail('Invalid resident contact endpoints');}
  if(maximumOperations!==Infinity&&state[rosterBase+6]!==0)return state;
  state[rosterBase+6]=0;
  function micro(index,a=NONE,b=NONE,contact=NONE,coefficient=NONE){
    const entry=bundle.entries[index],packed=new Float32Array(INPUTS),words=new Uint32Array(packed.buffer),bases=[stateBase,a,b,contact,coefficient];
    for(const[slot,group,offset]of entry.reads){if(group===0&&offset===63){packed[slot]=steps;continue;}const address=bases[group];if(address===NONE||address+offset>=state.length)fail('Missing source microprogram input');words[slot]=state[address+offset];}
    const result=executeLowered(entry.compiled,packed,{testOnly:true}),raw=new Uint32Array(result.buffer,result.byteOffset,result.length);
    entry.writes.forEach(([group,offset],j)=>{const address=bases[group];if(address===NONE||address+offset>=state.length)fail('Missing source microprogram output');const word=raw[j];state[address+offset]=group===3&&(word&0x7fffffff)===0?0:word;});
  }
  try{
    let phase=0,step=0,sweep=0,item=0,calls=0,advanced=0;
    if(maximumOperations!==Infinity&&state[stateBase+18]===0x52434341){[calls,phase,step,sweep,item]=state.subarray(stateBase+13,stateBase+18);if(phase>10||step>steps||sweep>32||item>27)fail('Invalid resident advance control');}
    else if(maximumOperations!==Infinity&&state[stateBase+18]!==0)fail('Invalid resident advance marker');
    else {state[stateBase+13]=0;if(maximumOperations!==Infinity)state[stateBase+18]=0x52434341;}

    while(phase!==10){
      const bodyPhase=[1,2,5,9].includes(phase),limit=bodyPhase?bc:oc;
      if(item>=limit){
        item=0;
        if(phase===4||phase===6){sweep++;if(sweep<(phase===6?relax:pgs))continue;sweep=0;}
        if(phase===6){step++;phase=step<steps?2:7;}else phase++;
        continue;
      }
      let a=NONE,b=NONE,raw=NONE,coeff=NONE,program;
      if(bodyPhase){b=stateBase+COMMON+item*BODY;program=({1:3,2:4,5:9,9:15})[phase];}
      else{
        const index=chosen[item],at=descriptors+4*index,kind=state[at],pair=kind===0;
        if(pair)a=stateBase+COMMON+state[at+1]*BODY;
        b=stateBase+COMMON+state[at+2]*BODY;raw=stateBase+layout.contactBase+index*CONTACT;coeff=coefficientBase+index*COEFFICIENT;
        program=phase===0?(pair?0:kind===1?1:2):({3:pair?5:6,4:pair?7:8,6:pair?10:11,7:pair?12:13,8:14})[phase];
      }
      state.set([phase,step,sweep,item],stateBase+14);
      trace?.push({phase,step,sweep,item,program});
      micro(program,a,b,raw,coeff);state[stateBase+13]=++calls;item++;
      if(++advanced>=maximumOperations){state[stateBase+17]=item;return state;}
    }
    state[stateBase+14]=10;
    state[rosterBase+6]=1;return state;
  }catch(error){state[rosterBase+6]=error.numericStatus??NUMERIC_STATUS.MALFORMED;throw error;}
}

/** Caller supplies rc_state:array<u32> read_write, rc_program:array<u32> read,
 * and disjoint candidate slices of rc_scratch:array<u32> read_write.
 * Program bundle offsets, state, coefficients, roster and scratch bases are
 * independent. One invocation serially owns a candidate; there are no barriers.
 * boundedAdvance=true emits rc_coupled_advance: up to advanceOperations source
 * microprograms per call (default64, diagnostic minimum1),
 * status 0 while pending. Keep all storage on-device between fixed dispatches.
 * At each new h the owner resets common[18] and roster[6] to zero. Other trace
 * slots are then reset by the first advance; no CPU future-state input is used.
 * On any error the candidate is invalid and partial numerical writes MUST NOT
 * be committed as a world h. The outer owner controls world transaction commit.
 */
export function generateCoupledSolverWGSL({includeNumericLibrary=true,boundedAdvance=false,advanceOperations=64,numericProfile}={}) {
  if(!Number.isInteger(advanceOperations)||advanceOperations<1||advanceOperations>256)throw new RangeError('Bounded advance operation budget must be 1..256');
  return (includeNumericLibrary?generateProfiledNumericWGSL(numericProfile):'')+`
fn rc_cs_failure(roster:u32,status:u32)->u32 { rc_state[roster+6u]=status;return status; }
fn rc_cs_overlap(a:u32,n:u32,b:u32,m:u32)->bool { return n>0u && m>0u && a<b+m && b<a+n; }
fn rc_cs_micro(bundle:u32, index:u32, commonBase:u32, body0:u32, body1:u32, contact:u32, coefficient:u32, substeps:u32, scratch:u32)->u32 {
  let programLength=arrayLength(&rc_program);let stateLength=arrayLength(&rc_state);let scratchLength=arrayLength(&rc_scratch);
  if(bundle>programLength || programLength-bundle<100u || rc_program[bundle]!=0x52434353u || rc_program[bundle+1u]!=1u || rc_program[bundle+2u]!=16u || index>=16u) { return 2u; }
  let entry=bundle+4u+index*6u;let np=bundle+rc_program[entry];let reads=bundle+rc_program[entry+1u];let readCount=rc_program[entry+2u];
  let writes=bundle+rc_program[entry+3u];let writeCount=rc_program[entry+4u];let scratchWords=rc_program[entry+5u];
  if(scratch>scratchLength || scratchLength-scratch<scratchWords || scratchWords<353u ||
     reads>programLength || readCount>(programLength-reads)/3u || writes>programLength || writeCount>(programLength-writes)/2u) { return 2u; }
  for(var i=0u;i<352u;i++) { rc_scratch[scratch+i]=0u; }
  for(var i=0u;i<readCount;i++) {
    let at=reads+i*3u;let slot=rc_program[at];let group=rc_program[at+1u];let offset=rc_program[at+2u];
    if(slot>=352u || group>4u) { return 2u; }
    if(group==0u && offset==63u) { rc_scratch[scratch+slot]=bitcast<u32>(f32(substeps));continue; }
    var source=commonBase;switch group {case 1u:{source=body0;}case 2u:{source=body1;}case 3u:{source=contact;}case 4u:{source=coefficient;}default:{}}
    if(source>=stateLength || offset>=stateLength-source) { return 2u; }
    rc_scratch[scratch+slot]=rc_state[source+offset];
  }
  let status=rc_num_eval(np,scratch);if(status!=1u) { return status; }
  let outMap=np+rc_program[np+8u];
  if(rc_program[np+4u]!=writeCount) { return 2u; }
  for(var i=0u;i<writeCount;i++) {
    let group=rc_program[writes+i*2u];let offset=rc_program[writes+i*2u+1u];
    var destination=commonBase;switch group {case 1u:{destination=body0;}case 2u:{destination=body1;}case 3u:{destination=contact;}case 4u:{destination=coefficient;}default:{return 2u;}}
    if(destination>=stateLength || offset>=stateLength-destination) { return 2u; }
    var word=rc_scratch[scratch+rc_program[outMap+i]];
    if(group==3u && (word&0x7fffffffu)==0u) { word=0u; }
    rc_state[destination+offset]=word;
  }
  return 1u;
}
fn ${boundedAdvance?'rc_coupled_advance':'rc_coupled_step'}(commonBase:u32, coefficient:u32, roster:u32, bundle:u32, scratch:u32)->u32 {
  let length=arrayLength(&rc_state);
  if(roster>length || length-roster<8u) { return 2u; }
  ${boundedAdvance?'if(rc_state[roster+6u]!=0u){return rc_state[roster+6u];}':''}
  rc_state[roster+6u]=0u;
  let bodies=rc_state[roster];let contacts=rc_state[roster+1u];let count=rc_state[roster+2u];
  let substeps=rc_state[roster+3u];let pgs=rc_state[roster+4u];let relax=rc_state[roster+5u];
  if(bodies<1u || bodies>4u || contacts>27u || count>contacts || substeps<1u || substeps>32u || pgs<1u || pgs>32u || relax<1u || relax>32u || rc_state[roster+7u]!=0u) { return rc_cs_failure(roster,2u); }
  if(commonBase>length || length-commonBase<64u+bodies*64u+contacts*32u || coefficient>length || length-coefficient<contacts*128u || length-roster<8u+contacts*5u) { return rc_cs_failure(roster,2u); }
  let commonWords=64u+bodies*64u+contacts*32u;let coefficientWords=contacts*128u;let rosterWords=8u+contacts*5u;
  if(rc_cs_overlap(commonBase,commonWords,coefficient,coefficientWords) || rc_cs_overlap(commonBase,commonWords,roster,rosterWords) || rc_cs_overlap(coefficient,coefficientWords,roster,rosterWords)) { return rc_cs_failure(roster,2u); }
  if(bitcast<f32>(rc_state[commonBase+9u])!=0.0) { return rc_cs_failure(roster,2u); }
  let descriptors=roster+8u;let order=descriptors+contacts*4u;var seen=0u;
  for(var i=0u;i<contacts;i++) {
    let at=descriptors+i*4u;let kind=rc_state[at];let a=rc_state[at+1u];let b=rc_state[at+2u];
    if(kind>2u || b>=bodies || rc_state[at+3u]!=0u || (kind==0u && (a>=bodies || a==b)) || (kind!=0u && a!=0xffffffffu)) { return rc_cs_failure(roster,2u); }
  }
  for(var i=0u;i<count;i++) {let index=rc_state[order+i];if(index>=contacts) {return rc_cs_failure(roster,2u);}let bit=1u<<index;if((seen&bit)!=0u){return rc_cs_failure(roster,2u);}seen|=bit;}
  // One interpreter call site prevents driver inlining from cloning the VM for
  // every stage. Phase transitions only select addresses/program; they do not
  // regroup contacts. Prepare ALL constraints before force/gyro/warm start.
  var phase=0u;var step=0u;var sweep=0u;var item=0u;var calls=0u;var advanced=0u;
  ${boundedAdvance?`if(rc_state[commonBase+18u]==0x52434341u){
    calls=rc_state[commonBase+13u];phase=rc_state[commonBase+14u];step=rc_state[commonBase+15u];sweep=rc_state[commonBase+16u];item=rc_state[commonBase+17u];
    if(phase>10u || step>substeps || sweep>32u || item>27u){return rc_cs_failure(roster,2u);}
  }else{if(rc_state[commonBase+18u]!=0u){return rc_cs_failure(roster,2u);}rc_state[commonBase+13u]=0u;rc_state[commonBase+18u]=0x52434341u;}`:'rc_state[commonBase+13u]=0u;'}
  loop {
    if(phase==10u) { break; }
    let bodyPhase=phase==1u || phase==2u || phase==5u || phase==9u;
    let limit=select(count,bodies,bodyPhase);
    if(item>=limit) {
      item=0u;
      if(phase==4u || phase==6u) {
        sweep++;let sweeps=select(pgs,relax,phase==6u);
        if(sweep<sweeps) { continue; }sweep=0u;
      }
      if(phase==6u) {step++;phase=select(7u,2u,step<substeps);}
      else {phase++;}
      continue;
    }
    var a=0xffffffffu;var b=0xffffffffu;var raw=0xffffffffu;var coeff=0xffffffffu;var program=0u;
    if(bodyPhase) {
      b=commonBase+64u+item*64u;
      switch phase {case 1u:{program=3u;}case 2u:{program=4u;}case 5u:{program=9u;}default:{program=15u;}}
    } else {
      let index=rc_state[order+item];let row=descriptors+index*4u;let kind=rc_state[row];let pair=kind==0u;
      if(pair) {a=commonBase+64u+rc_state[row+1u]*64u;}
      b=commonBase+64u+rc_state[row+2u]*64u;
      raw=commonBase+64u+bodies*64u+index*32u;coeff=coefficient+index*128u;
      switch phase {
        case 0u:{program=select(select(2u,1u,kind==1u),0u,pair);}
        case 3u:{program=select(6u,5u,pair);}
        case 4u:{program=select(8u,7u,pair);}
        case 6u:{program=select(11u,10u,pair);}
        case 7u:{program=select(13u,12u,pair);}
        default:{program=14u;}
      }
    }
    rc_state[commonBase+14u]=phase;rc_state[commonBase+15u]=step;
    rc_state[commonBase+16u]=sweep;rc_state[commonBase+17u]=item;
    let status=rc_cs_micro(bundle,program,commonBase,a,b,raw,coeff,substeps,scratch);
    if(status!=1u) {return rc_cs_failure(roster,status);}
    calls++;rc_state[commonBase+13u]=calls;item++;
    ${boundedAdvance?`rc_state[commonBase+17u]=item;advanced++;if(advanced>=${advanceOperations}u){return 0u;}`:''}
  }
  rc_state[commonBase+14u]=10u;
  rc_state[roster+6u]=1u;return 1u;
}
`;
}

/** Compiler-boundary diagnostic/portable staged driver. All source solver
 * microprograms, velocities, coefficients and ordering remain resident. The
 * immutable command schedule is gather -> evaluate -> scatter, repeated to a
 * source-operation capacity bound, with no intermediate host observation.
 * This is NOT a throughput claim: a later fused driver must pass the same gate.
 * Reset common[18], common[27], roster[6] at the beginning of each new world h.
 * common[19..27] is the internal pending-operation descriptor; never f32 data.
 */
export function generateCoupledStagedWGSL(stage,{numericProfile}={}) {
  if(!['gather','evaluate','scatter'].includes(stage))throw new RangeError('Exact coupled resident stage required');
  if(stage==='evaluate')return generateProfiledNumericWGSL(numericProfile)+`
fn rc_coupled_evaluate(commonBase:u32,roster:u32,scratch:u32)->u32 {
  let length=arrayLength(&rc_state);if(commonBase>length || length-commonBase<64u || roster>length || length-roster<8u){return 2u;}
  let prior=rc_state[roster+6u];if(prior!=0u){return prior;}
  if(rc_state[commonBase+27u]!=1u){rc_state[roster+6u]=2u;return 2u;}
  let status=rc_num_eval(rc_state[commonBase+19u],scratch);
  if(status!=1u){rc_state[roster+6u]=status;return status;}
  rc_state[commonBase+27u]=2u;return 0u;
}
`;
  let code=generateCoupledSolverWGSL({includeNumericLibrary:false,boundedAdvance:true,advanceOperations:1});
  const start=code.indexOf('fn rc_cs_micro('),driver=code.indexOf('fn rc_coupled_advance(');
  const micro=code.slice(start,driver),evaluation=micro.indexOf('  let status=rc_num_eval(');
  if(start<0||driver<0||evaluation<0)throw new Error('Coupled generated source boundary changed');
  if(stage==='gather'){
    const gather=micro.slice(0,evaluation).replace('fn rc_cs_micro(','fn rc_cs_gather(')+`
  rc_state[commonBase+19u]=np;rc_state[commonBase+20u]=body0;rc_state[commonBase+21u]=body1;
  rc_state[commonBase+22u]=contact;rc_state[commonBase+23u]=coefficient;
  rc_state[commonBase+24u]=writes;rc_state[commonBase+25u]=writeCount;
  rc_state[commonBase+26u]=scratchWords;rc_state[commonBase+27u]=1u;return 1u;
}
`;
    let owner=code.slice(driver).replace('fn rc_coupled_advance(','fn rc_coupled_gather(').replace('rc_cs_micro(','rc_cs_gather(');
    owner=owner.replace('  let commonWords=', '  if(rc_state[commonBase+27u]!=0u){return 0u;}\n  let commonWords=');
    const tail=owner.indexOf('    calls++;'),complete=owner.indexOf('  rc_state[commonBase+14u]=10u;');
    if(tail<0||complete<0)throw new Error('Coupled phase boundary changed');
    owner=owner.slice(0,tail)+'    return 0u;\n  }\n'+owner.slice(complete);
    return code.slice(0,start)+gather+owner;
  }
  // Copy the same original output-map/writeback loop; never reevaluate physics.
  const output=micro.slice(micro.indexOf('  let outMap='),micro.lastIndexOf('  return 1u;'));
  return `
fn rc_coupled_scatter(commonBase:u32,roster:u32,scratch:u32)->u32 {
  let stateLength=arrayLength(&rc_state);let programLength=arrayLength(&rc_program);let scratchLength=arrayLength(&rc_scratch);
  if(commonBase>stateLength || stateLength-commonBase<64u || roster>stateLength || stateLength-roster<8u){return 2u;}
  let prior=rc_state[roster+6u];if(prior!=0u){return prior;}
  if(rc_state[commonBase+27u]!=2u){rc_state[roster+6u]=2u;return 2u;}
  let np=rc_state[commonBase+19u];let body0=rc_state[commonBase+20u];let body1=rc_state[commonBase+21u];
  let contact=rc_state[commonBase+22u];let coefficient=rc_state[commonBase+23u];let writes=rc_state[commonBase+24u];let writeCount=rc_state[commonBase+25u];
  if(np>programLength || programLength-np<12u || writes>programLength || writeCount>(programLength-writes)/2u || scratch>scratchLength || rc_state[commonBase+26u]>scratchLength-scratch){rc_state[roster+6u]=2u;return 2u;}
${output.replaceAll('return 2u;','rc_state[roster+6u]=2u;return 2u;')}
  rc_state[commonBase+13u]++;rc_state[commonBase+17u]++;rc_state[commonBase+27u]=0u;return 0u;
}
`;
}
