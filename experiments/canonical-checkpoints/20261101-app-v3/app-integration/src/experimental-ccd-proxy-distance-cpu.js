/* SPDX-License-Identifier: Apache-2.0
 * GENERATED from experimental-ccd-proxy-distance-kernel.js. DO NOT EDIT.
 * Source/attribution/license notices are preserved in that file.
 */
(function(G){'use strict';
function createKernel(pointsA) {
const f=Math.fround, fadd=(a,b)=>f(a+b), fsub=(a,b)=>f(a-b), fmul=(a,b)=>f(a*b), fdiv=(a,b)=>f(a/b), fsqrt=a=>f(Math.sqrt(a));
const V3=(x,y,z)=>({x,y,z}), F3=(...a)=>a, F4=F3, F5=F3, U3=F3, Vertices=F3;
const Vertex=(wa,wb,w,a,indexA,indexB)=>({wa,wb,w,a,indexA,indexB}), Simplex=(v,count,solved)=>({v,count,solved}), Cache=(metric,count,indexA,indexB)=>({metric,count,indexA,indexB}), Witness=(pointA,pointB)=>({pointA,pointB});
const DistanceResult=(pointA,pointB,normal,distance,iterations,cache,overlap,cacheWritten,termination,cacheAccepted,cacheFlushed,finalCount)=>({pointA,pointB,normal,distance,iterations,cache,overlap,cacheWritten,termination,cacheAccepted,cacheFlushed,finalCount});
const pointA=i=>V3(...pointsA[i]), pointCount=()=>pointsA.length;
function normalizedOrZero(a) { const rcp=fdiv(1,vlength(a)); return Number.isFinite(rcp)&&rcp>0?vmul(a,rcp):V3(0,0,0); }

function vadd(a, b) { return V3(fadd(a.x,b.x),fadd(a.y,b.y),fadd(a.z,b.z)); }
function vsub(a, b) { return V3(fsub(a.x,b.x),fsub(a.y,b.y),fsub(a.z,b.z)); }
function vmul(a, b) { return V3(fmul(a.x,b),fmul(a.y,b),fmul(a.z,b)); }
function vneg(a) { return V3(-a.x,-a.y,-a.z); }
function vdot(a, b) { return fadd(fadd(fmul(a.x,b.x),fmul(a.y,b.y)),fmul(a.z,b.z)); }
function vcross(a, b) {
  return V3(fsub(fmul(a.y,b.z),fmul(b.y,a.z)),fsub(fmul(a.z,b.x),fmul(b.z,a.x)),fsub(fmul(a.x,b.y),fmul(b.x,a.y)));
}
function vlength(a) { return fsqrt(vdot(a,a)); }
function triple(a, b, c) { return vdot(vcross(a,b),c); }
function weighted(v, weight) { return Vertex(v.wa,v.wb,v.w,weight,v.indexA,v.indexB); }
function copySimplex(s) { return Simplex(Vertices(s.v[0],s.v[1],s.v[2],s.v[3]),s.count,s.solved); }
function copyCache(c) { return Cache(c.metric,c.count,U3(c.indexA[0],c.indexA[1],c.indexA[2]),U3(c.indexB[0],c.indexB[1],c.indexB[2])); }
function emptyVertex() { return Vertex(V3(0.0,0.0,0.0),V3(0.0,0.0,0.0),V3(0.0,0.0,0.0),0.0,0,0); }
function edge(a, b) { const ab=vsub(b,a); return F3(vdot(b,ab),-vdot(a,ab),vdot(ab,ab)); }
function triangle(a, b, c) {
  const ab=vsub(b,a); const ac=vsub(c,a);
  const bxc=vcross(b,c); const cxa=vcross(c,a); const axb=vcross(a,b); const abxac=vcross(ab,ac);
  return F4(vdot(bxc,abxac),vdot(cxa,abxac),vdot(axb,abxac),vdot(abxac,abxac));
}
function tetrahedron(a, b, c, d) {
  const ab=vsub(b,a); const ac=vsub(c,a); const ad=vsub(d,a); const divisor=triple(ab,ac,ad);
  let sign=1.0; if (divisor < 0.0) { sign=-1.0; }
  return F5(fmul(sign,triple(b,c,d)),fmul(sign,triple(a,d,c)),fmul(sign,triple(a,b,d)),fmul(sign,triple(a,c,b)),fmul(sign,divisor));
}
function simplexMetric(s) {
  if (s.count == 1) { return 0.0; }
  if (s.count == 2) { return vlength(vsub(s.v[0].w,s.v[1].w)); }
  const a=s.v[0].w; const b=s.v[1].w; const c=s.v[2].w;
  if (s.count == 3) { return fdiv(vlength(vcross(vsub(b,a),vsub(c,a))),2.0); }
  return fdiv(triple(vsub(b,a),vsub(c,a),vsub(s.v[3].w,a)),6.0);
}
function witness(s) {
  if (s.count == 1) { return Witness(s.v[0].wa,s.v[0].wb); }
  let pa=vadd(vmul(s.v[0].wa,s.v[0].a),vmul(s.v[1].wa,s.v[1].a));
  let pb=vadd(vmul(s.v[0].wb,s.v[0].a),vmul(s.v[1].wb,s.v[1].a));
  if (s.count == 2) { return Witness(pa,pb); }
  pa=vadd(pa,vmul(s.v[2].wa,s.v[2].a));
  pb=vadd(pb,vmul(s.v[2].wb,s.v[2].a));
  if (s.count == 3) { return Witness(pa,pb); }
  pa=vadd(pa,vmul(s.v[3].wa,s.v[3].a));
  return Witness(pa,pa);
}
function closest(s) {
  if (s.count == 1) { return s.v[0].w; }
  const p=vadd(vmul(s.v[0].w,s.v[0].a),vmul(s.v[1].w,s.v[1].a));
  if (s.count == 2) { return p; }
  return vadd(p,vmul(s.v[2].w,s.v[2].a));
}
function direction(s) {
  const a=s.v[0].w;
  if (s.count == 1) { return vneg(a); }
  const ab=vsub(s.v[1].w,a);
  if (s.count == 2) { return vcross(vcross(ab,vneg(a)),ab); }
  const n=vcross(ab,vsub(s.v[2].w,a));
  if (vdot(n,a) < 0.0) { return n; }
  return vneg(n);
}
function solve2(original) {
  let s=copySimplex(original); s.solved=true;
  const a=s.v[0].w; const b=s.v[1].w; const ab=vsub(b,a);
  const divisor=vdot(ab,ab); const u=vdot(b,ab); const v=-vdot(a,ab);
  if (v <= 0.0) { s.count=1; s.v[0]=weighted(s.v[0],1.0); return s; }
  if (u <= 0.0) { s.count=1; s.v[0]=weighted(s.v[1],1.0); return s; }
  if (divisor <= 0.0) { s.solved=false; return s; }
  const denominator=fdiv(1.0,divisor);
  s.v[0]=weighted(s.v[0],fmul(denominator,u));
  s.v[1]=weighted(s.v[1],fmul(denominator,v)); return s;
}

function solve3(original) {
  let s=copySimplex(original); s.solved=true;
  const a=s.v[0]; const b=s.v[1]; const c=s.v[2];
  const w_ab=edge(a.w,b.w); const w_bc=edge(b.w,c.w); const w_ca=edge(c.w,a.w);
  
  if (w_ab[1] <= 0.0 && w_ca[0] <= 0.0) { s.count=1; s.v[0]=weighted(a,1.0); return s; }
  if (w_bc[1] <= 0.0 && w_ab[0] <= 0.0) { s.count=1; s.v[0]=weighted(b,1.0); return s; }
  if (w_ca[1] <= 0.0 && w_bc[0] <= 0.0) { s.count=1; s.v[0]=weighted(c,1.0); return s; }
  const w_abc=triangle(a.w,b.w,c.w);
  
  if (w_abc[2] <= 0.0 && w_ab[0] > 0.0 && w_ab[1] > 0.0) {
    s.count=2; s.v[0]=a; s.v[1]=b; const divisor=w_ab[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_ab[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_ab[1],divisor)); return s;
  }
  if (w_abc[0] <= 0.0 && w_bc[0] > 0.0 && w_bc[1] > 0.0) {
    s.count=2; s.v[0]=b; s.v[1]=c; const divisor=w_bc[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_bc[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_bc[1],divisor)); return s;
  }
  if (w_abc[1] <= 0.0 && w_ca[0] > 0.0 && w_ca[1] > 0.0) {
    s.count=2; s.v[0]=c; s.v[1]=a; const divisor=w_ca[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_ca[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_ca[1],divisor)); return s;
  }
  const divisor=w_abc[3]; if (divisor <= 0.0) { s.solved=false; return s; }
  s.v[0]=weighted(s.v[0],fdiv(w_abc[0],divisor));
  s.v[1]=weighted(s.v[1],fdiv(w_abc[1],divisor));
  s.v[2]=weighted(s.v[2],fdiv(w_abc[2],divisor)); return s;
}
function solve4(original) {
  let s=copySimplex(original); s.solved=true;
  const a=s.v[0]; const b=s.v[1]; const c=s.v[2]; const d=s.v[3];
  const w_ab=edge(a.w,b.w); const w_ac=edge(a.w,c.w); const w_ad=edge(a.w,d.w);
  const w_bc=edge(b.w,c.w); const w_cd=edge(c.w,d.w); const w_db=edge(d.w,b.w);
  
  if (w_ab[1] <= 0.0 && w_ac[1] <= 0.0 && w_ad[1] <= 0.0) { s.count=1; s.v[0]=weighted(a,1.0); return s; }
  if (w_ab[0] <= 0.0 && w_db[0] <= 0.0 && w_bc[1] <= 0.0) { s.count=1; s.v[0]=weighted(b,1.0); return s; }
  if (w_ac[0] <= 0.0 && w_bc[0] <= 0.0 && w_cd[1] <= 0.0) { s.count=1; s.v[0]=weighted(c,1.0); return s; }
  if (w_ad[0] <= 0.0 && w_cd[0] <= 0.0 && w_db[1] <= 0.0) { s.count=1; s.v[0]=weighted(d,1.0); return s; }
  const w_acb=triangle(a.w,c.w,b.w); const w_abd=triangle(a.w,b.w,d.w);
  const w_adc=triangle(a.w,d.w,c.w); const w_bcd=triangle(b.w,c.w,d.w);
  
  if (w_abd[2] <= 0.0 && w_acb[1] <= 0.0 && w_ab[0] > 0.0 && w_ab[1] > 0.0) {
    s.count=2; s.v[0]=a; s.v[1]=b; const divisor=w_ab[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_ab[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_ab[1],divisor)); return s;
  }
  if (w_acb[2] <= 0.0 && w_adc[1] <= 0.0 && w_ac[0] > 0.0 && w_ac[1] > 0.0) {
    s.count=2; s.v[0]=a; s.v[1]=c; const divisor=w_ac[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_ac[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_ac[1],divisor)); return s;
  }
  if (w_adc[2] <= 0.0 && w_abd[1] <= 0.0 && w_ad[0] > 0.0 && w_ad[1] > 0.0) {
    s.count=2; s.v[0]=a; s.v[1]=d; const divisor=w_ad[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_ad[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_ad[1],divisor)); return s;
  }
  if (w_acb[0] <= 0.0 && w_bcd[2] <= 0.0 && w_bc[0] > 0.0 && w_bc[1] > 0.0) {
    s.count=2; s.v[0]=b; s.v[1]=c; const divisor=w_bc[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_bc[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_bc[1],divisor)); return s;
  }
  if (w_adc[0] <= 0.0 && w_bcd[0] <= 0.0 && w_cd[0] > 0.0 && w_cd[1] > 0.0) {
    s.count=2; s.v[0]=c; s.v[1]=d; const divisor=w_cd[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_cd[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_cd[1],divisor)); return s;
  }
  if (w_abd[0] <= 0.0 && w_bcd[1] <= 0.0 && w_db[0] > 0.0 && w_db[1] > 0.0) {
    s.count=2; s.v[0]=d; s.v[1]=b; const divisor=w_db[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_db[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_db[1],divisor)); return s;
  }
  const w_abcd=tetrahedron(a.w,b.w,c.w,d.w);
  
  if (w_abcd[3] < 0.0 && w_acb[0] > 0.0 && w_acb[1] > 0.0 && w_acb[2] > 0.0) {
    s.count=3; s.v[0]=a; s.v[1]=c; s.v[2]=b;
    const divisor=w_acb[3]; if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_acb[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_acb[1],divisor));
    s.v[2]=weighted(s.v[2],fdiv(w_acb[2],divisor)); return s;
  }
  if (w_abcd[2] < 0.0 && w_abd[0] > 0.0 && w_abd[1] > 0.0 && w_abd[2] > 0.0) {
    s.count=3; s.v[0]=a; s.v[1]=b; s.v[2]=d;
    const divisor=w_abd[3]; if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_abd[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_abd[1],divisor));
    s.v[2]=weighted(s.v[2],fdiv(w_abd[2],divisor)); return s;
  }
  if (w_abcd[1] < 0.0 && w_adc[0] > 0.0 && w_adc[1] > 0.0 && w_adc[2] > 0.0) {
    s.count=3; s.v[0]=a; s.v[1]=d; s.v[2]=c;
    const divisor=w_adc[3]; if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_adc[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_adc[1],divisor));
    s.v[2]=weighted(s.v[2],fdiv(w_adc[2],divisor)); return s;
  }
  if (w_abcd[0] < 0.0 && w_bcd[0] > 0.0 && w_bcd[1] > 0.0 && w_bcd[2] > 0.0) {
    s.count=3; s.v[0]=b; s.v[1]=c; s.v[2]=d;
    const divisor=w_bcd[3]; if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_bcd[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_bcd[1],divisor));
    s.v[2]=weighted(s.v[2],fdiv(w_bcd[2],divisor)); return s;
  }
  const divisor=w_abcd[4]; if (divisor <= 0.0) { s.solved=false; return s; }
  s.v[0]=weighted(s.v[0],fdiv(w_abcd[0],divisor));
  s.v[1]=weighted(s.v[1],fdiv(w_abcd[1],divisor));
  s.v[2]=weighted(s.v[2],fdiv(w_abcd[2],divisor));
  s.v[3]=weighted(s.v[3],fdiv(w_abcd[3],divisor)); return s;
}
function solve(original) {
  if (original.count == 2) { return solve2(original); }
  if (original.count == 3) { return solve3(original); }
  if (original.count == 4) { return solve4(original); }
  let s=copySimplex(original); s.solved=true; s.v[0]=weighted(s.v[0],1.0); return s;
}
function support(direction) {
  const origin=pointA(0); let bestIndex=0; let bestValue=0.0;
  for (let i=1; i < pointCount(); i=i+1) {
    const value=vdot(direction,vsub(pointA(i),origin));
    if (value > bestValue) { bestIndex=i; bestValue=value; }
  }
  return bestIndex;
}
function cacheValid(c) {
  if (c.count > 3) { return false; }
  for (let i=0; i < c.count; i=i+1) {
    if (c.indexA[i] >= pointCount() || c.indexB[i] >= 1) { return false; }
  }
  return true;
}
function ballPoint(translation, qxyz, qw) {
  // scalar glam Quat::mul_vec3(ZERO), then Pose::transform_point translation.
  const p=V3(0.0,0.0,0.0); const b2=vdot(qxyz,qxyz);
  return vadd(vadd(vadd(vmul(p,fsub(fmul(qw,qw),b2)),vmul(qxyz,fmul(vdot(p,qxyz),2.0))),vmul(vcross(qxyz,p),fmul(qw,2.0))),translation);
}
function proxyDistance(pointB, inputCache) {
  const z=V3(0.0,0.0,0.0);
  let result=DistanceResult(z,z,z,0.0,0,copyCache(inputCache),false,false,7,false,false,0);
  let simplex=Simplex(Vertices(emptyVertex(),emptyVertex(),emptyVertex(),emptyVertex()),0,true);
  result.cacheAccepted=cacheValid(inputCache);
  if (result.cacheAccepted) { simplex.count=inputCache.count; }
  for (let i=0; i < simplex.count; i=i+1) {
    const wa=pointA(inputCache.indexA[i]);
    simplex.v[i]=Vertex(wa,pointB,vsub(pointB,wa),0.0,inputCache.indexA[i],inputCache.indexB[i]);
  }
  if (simplex.count > 0) {
    const metric1=inputCache.metric; const metric2=simplexMetric(simplex);
    if (fmul(2.0,metric1) < metric2 || metric2 < fmul(0.5,metric1) || metric2 < 1.1920928955078125e-7) {
      simplex.count=0; result.cacheFlushed=true;
    }
  }
  if (simplex.count == 0) {
    const wa=pointA(0); simplex.v[0]=Vertex(wa,pointB,vsub(pointB,wa),0.0,0,0); simplex.count=1;
  }
  let backup=copySimplex(simplex); let backupCount=0;
  let distanceSq=3.4028234663852886e38; let normal=z; let iteration=0;
  while (iteration < 32) {
    simplex=solve(simplex);
    if (!simplex.solved) {
      result.termination=5;
      if (backupCount == 0) { break; }
      simplex=copySimplex(backup); simplex.count=backupCount; break;
    }
    if (simplex.count == 4) {
      const w=witness(simplex); result.pointA=w.pointA; result.pointB=w.pointB;
      result.iterations=iteration; result.overlap=true; result.termination=1; result.finalCount=simplex.count; return result;
    }
    const oldDistanceSq=distanceSq; const closestPoint=closest(simplex); distanceSq=vdot(closestPoint,closestPoint);
    if (distanceSq >= oldDistanceSq) {
      result.termination=6;
      if (backupCount == 0) { break; }
      simplex=copySimplex(backup); simplex.count=backupCount; break;
    }
    const searchDirection=direction(simplex);
    if (vdot(searchDirection,searchDirection) < fmul(1000.0,1.1754943508222875e-38)) {
      const w=witness(simplex); result.pointA=w.pointA; result.pointB=w.pointB;
      result.iterations=iteration; result.overlap=true; result.termination=2; result.finalCount=simplex.count; return result;
    }
    normal=vneg(searchDirection);
    const indexA=support(vneg(searchDirection)); const supportA=pointA(indexA);
    // Ball's proxy B has exactly one local ZERO point. Its support is index 0
    // for every inverse-rotated direction, so no shape/plane shortcut is used.
    backup=copySimplex(simplex); backupCount=simplex.count;
    let duplicate=false;
    for (let i=0; i < simplex.count; i=i+1) {
      if (simplex.v[i].indexA == indexA && simplex.v[i].indexB == 0) { duplicate=true; }
    }
    if (duplicate) { result.termination=4; break; }
    // Preserve the old slot's coefficient, exactly as the Rust assignment does.
    simplex.v[simplex.count]=Vertex(supportA,pointB,vsub(pointB,supportA),simplex.v[simplex.count].a,indexA,0);
    simplex.count=simplex.count+1; iteration=iteration+1;
  }
  normal=normalizedOrZero(normal);
  result.iterations=iteration; result.finalCount=simplex.count;
  if (normal.x == 0.0 && normal.y == 0.0 && normal.z == 0.0) {
    result.overlap=true; result.termination=3; return result;
  }
  const w=witness(simplex);
  result.cache.metric=simplexMetric(simplex); result.cache.count=simplex.count;
  if (result.cache.count > 3) { result.cache.count=3; }
  for (let i=0; i < result.cache.count; i=i+1) {
    result.cache.indexA[i]=simplex.v[i].indexA; result.cache.indexB[i]=simplex.v[i].indexB;
  }
  result.pointA=w.pointA; result.pointB=w.pointB; result.distance=vlength(vsub(w.pointA,w.pointB));
  result.normal=normal; result.cacheWritten=true; return result;
}

return {proxyDistance,ballPoint,solve,simplexMetric,witness,closest,direction,support,edge,triangle,tetrahedron,V3,Vertex,Simplex,Cache,Vertices,emptyVertex};
}
const api=Object.freeze({createKernel}); G.LabCcdProxyDistanceCpuExperimental=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
