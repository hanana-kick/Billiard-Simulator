/* SPDX-License-Identifier: Apache-2.0
 * Port of Parry 0.31.1 src/query/sweep_toi/{proxy_distance,toi_proxy}.rs (dim3).
 * Original work: Sébastien Crozet and the Dimforge contributors.
 * Modified 2026: scalar shared CPU/WGSL kernel, fixed A / Ball::ZERO point B.
 * License: vendor/RAPIER-LICENSE.txt (Apache-2.0); scalar vector arithmetic
 * follows glam 0.33.12, vendor/GLAM-LICENSE-APACHE.txt and GLAM-LICENSE-MIT.txt.
 * This is an experimental distance component, not an enabled physics engine.
 */
(function(G) {'use strict';
// This constrained WGSL subset is the single algorithm source. The checked-in
// CPU artifact is mechanically emitted by --generate; no eval runs in the app.
// Integer arithmetic below is indexing only. ALL physical scalar arithmetic is
// an explicitly ordered fadd/fsub/fmul/fdiv/fsqrt call, shared by both backends.
const PRIMITIVES = `
fn fadd(a: f32, b: f32) -> f32 { return a + b; }
fn fsub(a: f32, b: f32) -> f32 { return a - b; }
fn fmul(a: f32, b: f32) -> f32 { return a * b; }
fn fdiv(a: f32, b: f32) -> f32 { return a / b; }
fn fsqrt(a: f32) -> f32 { return sqrt(a); }
fn finite(a: f32) -> bool { return (bitcast<u32>(a) & 0x7f800000u) != 0x7f800000u; }
fn normalizedOrZero(a: V3) -> V3 {
  let len = vlength(a);
  // WGSL division by zero is indeterminate. This returns the same zero as
  // glam's reciprocal-is-finite guard without performing that invalid divide.
  if (len == 0.0) { return V3(0.0, 0.0, 0.0); }
  let rcp = fdiv(1.0, len);
  if (finite(rcp) && rcp > 0.0) { return vmul(a, rcp); }
  return V3(0.0, 0.0, 0.0);
}
`;
const TYPES = `
alias V3 = vec3<f32>;
alias F3 = array<f32, 3>;
alias F4 = array<f32, 4>;
alias F5 = array<f32, 5>;
alias U3 = array<u32, 3>;
struct Vertex { wa: V3, wb: V3, w: V3, a: f32, indexA: u32, indexB: u32 }
alias Vertices = array<Vertex, 4>;
struct Simplex { v: Vertices, count: u32, solved: bool }
struct Cache { metric: f32, count: u32, indexA: U3, indexB: U3 }
struct Witness { pointA: V3, pointB: V3 }
struct DistanceResult {
  pointA: V3, pointB: V3, normal: V3, distance: f32, iterations: u32,
  cache: Cache, overlap: bool, cacheWritten: bool, termination: u32,
  cacheAccepted: bool, cacheFlushed: bool, finalCount: u32
}
`;
let KERNEL = `
fn vadd(a: V3, b: V3) -> V3 { return V3(fadd(a.x,b.x),fadd(a.y,b.y),fadd(a.z,b.z)); }
fn vsub(a: V3, b: V3) -> V3 { return V3(fsub(a.x,b.x),fsub(a.y,b.y),fsub(a.z,b.z)); }
fn vmul(a: V3, b: f32) -> V3 { return V3(fmul(a.x,b),fmul(a.y,b),fmul(a.z,b)); }
fn vneg(a: V3) -> V3 { return V3(-a.x,-a.y,-a.z); }
fn vdot(a: V3, b: V3) -> f32 { return fadd(fadd(fmul(a.x,b.x),fmul(a.y,b.y)),fmul(a.z,b.z)); }
fn vcross(a: V3, b: V3) -> V3 {
  return V3(fsub(fmul(a.y,b.z),fmul(b.y,a.z)),fsub(fmul(a.z,b.x),fmul(b.z,a.x)),fsub(fmul(a.x,b.y),fmul(b.x,a.y)));
}
fn vlength(a: V3) -> f32 { return fsqrt(vdot(a,a)); }
fn triple(a: V3, b: V3, c: V3) -> f32 { return vdot(vcross(a,b),c); }
fn weighted(v: Vertex, weight: f32) -> Vertex { return Vertex(v.wa,v.wb,v.w,weight,v.indexA,v.indexB); }
fn copySimplex(s: Simplex) -> Simplex { return Simplex(Vertices(s.v[0],s.v[1],s.v[2],s.v[3]),s.count,s.solved); }
fn copyCache(c: Cache) -> Cache { return Cache(c.metric,c.count,U3(c.indexA[0],c.indexA[1],c.indexA[2]),U3(c.indexB[0],c.indexB[1],c.indexB[2])); }
fn emptyVertex() -> Vertex { return Vertex(V3(0.0,0.0,0.0),V3(0.0,0.0,0.0),V3(0.0,0.0,0.0),0.0,0u,0u); }
fn edge(a: V3, b: V3) -> F3 { let ab=vsub(b,a); return F3(vdot(b,ab),-vdot(a,ab),vdot(ab,ab)); }
fn triangle(a: V3, b: V3, c: V3) -> F4 {
  let ab=vsub(b,a); let ac=vsub(c,a);
  let bxc=vcross(b,c); let cxa=vcross(c,a); let axb=vcross(a,b); let abxac=vcross(ab,ac);
  return F4(vdot(bxc,abxac),vdot(cxa,abxac),vdot(axb,abxac),vdot(abxac,abxac));
}
fn tetrahedron(a: V3, b: V3, c: V3, d: V3) -> F5 {
  let ab=vsub(b,a); let ac=vsub(c,a); let ad=vsub(d,a); let divisor=triple(ab,ac,ad);
  var sign=1.0; if (divisor < 0.0) { sign=-1.0; }
  return F5(fmul(sign,triple(b,c,d)),fmul(sign,triple(a,d,c)),fmul(sign,triple(a,b,d)),fmul(sign,triple(a,c,b)),fmul(sign,divisor));
}
fn simplexMetric(s: Simplex) -> f32 {
  if (s.count == 1u) { return 0.0; }
  if (s.count == 2u) { return vlength(vsub(s.v[0].w,s.v[1].w)); }
  let a=s.v[0].w; let b=s.v[1].w; let c=s.v[2].w;
  if (s.count == 3u) { return fdiv(vlength(vcross(vsub(b,a),vsub(c,a))),2.0); }
  return fdiv(triple(vsub(b,a),vsub(c,a),vsub(s.v[3].w,a)),6.0);
}
fn witness(s: Simplex) -> Witness {
  if (s.count == 1u) { return Witness(s.v[0].wa,s.v[0].wb); }
  var pa=vadd(vmul(s.v[0].wa,s.v[0].a),vmul(s.v[1].wa,s.v[1].a));
  var pb=vadd(vmul(s.v[0].wb,s.v[0].a),vmul(s.v[1].wb,s.v[1].a));
  if (s.count == 2u) { return Witness(pa,pb); }
  pa=vadd(pa,vmul(s.v[2].wa,s.v[2].a));
  pb=vadd(pb,vmul(s.v[2].wb,s.v[2].a));
  if (s.count == 3u) { return Witness(pa,pb); }
  pa=vadd(pa,vmul(s.v[3].wa,s.v[3].a));
  return Witness(pa,pa);
}
fn closest(s: Simplex) -> V3 {
  if (s.count == 1u) { return s.v[0].w; }
  let p=vadd(vmul(s.v[0].w,s.v[0].a),vmul(s.v[1].w,s.v[1].a));
  if (s.count == 2u) { return p; }
  return vadd(p,vmul(s.v[2].w,s.v[2].a));
}
fn direction(s: Simplex) -> V3 {
  let a=s.v[0].w;
  if (s.count == 1u) { return vneg(a); }
  let ab=vsub(s.v[1].w,a);
  if (s.count == 2u) { return vcross(vcross(ab,vneg(a)),ab); }
  let n=vcross(ab,vsub(s.v[2].w,a));
  if (vdot(n,a) < 0.0) { return n; }
  return vneg(n);
}
fn solve2(original: Simplex) -> Simplex {
  var s=copySimplex(original); s.solved=true;
  let a=s.v[0].w; let b=s.v[1].w; let ab=vsub(b,a);
  let divisor=vdot(ab,ab); let u=vdot(b,ab); let v=-vdot(a,ab);
  if (v <= 0.0) { s.count=1u; s.v[0]=weighted(s.v[0],1.0); return s; }
  if (u <= 0.0) { s.count=1u; s.v[0]=weighted(s.v[1],1.0); return s; }
  if (divisor <= 0.0) { s.solved=false; return s; }
  let denominator=fdiv(1.0,divisor);
  s.v[0]=weighted(s.v[0],fmul(denominator,u));
  s.v[1]=weighted(s.v[1],fmul(denominator,v)); return s;
}
`;
// Ordered region tables are a direct transcription of source solve_simplex3_3d
// and solve_simplex4_3d. They emit ONE algorithm for CPU and WGSL, including the
// non-canonical CA, DB, ACB, ADC order and strict (<0) tetrahedron face tests.
const R3 = {
  vertices: [['a','w_ab[1] <= 0.0 && w_ca[0] <= 0.0'],['b','w_bc[1] <= 0.0 && w_ab[0] <= 0.0'],['c','w_ca[1] <= 0.0 && w_bc[0] <= 0.0']],
  edges: [['ab','a','b','w_abc[2] <= 0.0'],['bc','b','c','w_abc[0] <= 0.0'],['ca','c','a','w_abc[1] <= 0.0']]
};
const R4 = {
  vertices: [['a','w_ab[1] <= 0.0 && w_ac[1] <= 0.0 && w_ad[1] <= 0.0'],['b','w_ab[0] <= 0.0 && w_db[0] <= 0.0 && w_bc[1] <= 0.0'],['c','w_ac[0] <= 0.0 && w_bc[0] <= 0.0 && w_cd[1] <= 0.0'],['d','w_ad[0] <= 0.0 && w_cd[0] <= 0.0 && w_db[1] <= 0.0']],
  edges: [['ab','a','b','w_abd[2] <= 0.0 && w_acb[1] <= 0.0'],['ac','a','c','w_acb[2] <= 0.0 && w_adc[1] <= 0.0'],['ad','a','d','w_adc[2] <= 0.0 && w_abd[1] <= 0.0'],['bc','b','c','w_acb[0] <= 0.0 && w_bcd[2] <= 0.0'],['cd','c','d','w_adc[0] <= 0.0 && w_bcd[0] <= 0.0'],['db','d','b','w_abd[0] <= 0.0 && w_bcd[1] <= 0.0']],
  faces: [['acb',['a','c','b'],3],['abd',['a','b','d'],2],['adc',['a','d','c'],1],['bcd',['b','c','d'],0]]
};
function vertexRegions(rows) { return rows.map(([v,p])=>`
  if (${p}) { s.count=1u; s.v[0]=weighted(${v},1.0); return s; }`).join(''); }
function edgeRegions(rows) { return rows.map(([name,a,b,p])=>`
  if (${p} && w_${name}[0] > 0.0 && w_${name}[1] > 0.0) {
    s.count=2u; s.v[0]=${a}; s.v[1]=${b}; let divisor=w_${name}[2];
    if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_${name}[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_${name}[1],divisor)); return s;
  }`).join(''); }
KERNEL += `
fn solve3(original: Simplex) -> Simplex {
  var s=copySimplex(original); s.solved=true;
  let a=s.v[0]; let b=s.v[1]; let c=s.v[2];
  let w_ab=edge(a.w,b.w); let w_bc=edge(b.w,c.w); let w_ca=edge(c.w,a.w);
  ${vertexRegions(R3.vertices)}
  let w_abc=triangle(a.w,b.w,c.w);
  ${edgeRegions(R3.edges)}
  let divisor=w_abc[3]; if (divisor <= 0.0) { s.solved=false; return s; }
  s.v[0]=weighted(s.v[0],fdiv(w_abc[0],divisor));
  s.v[1]=weighted(s.v[1],fdiv(w_abc[1],divisor));
  s.v[2]=weighted(s.v[2],fdiv(w_abc[2],divisor)); return s;
}
fn solve4(original: Simplex) -> Simplex {
  var s=copySimplex(original); s.solved=true;
  let a=s.v[0]; let b=s.v[1]; let c=s.v[2]; let d=s.v[3];
  let w_ab=edge(a.w,b.w); let w_ac=edge(a.w,c.w); let w_ad=edge(a.w,d.w);
  let w_bc=edge(b.w,c.w); let w_cd=edge(c.w,d.w); let w_db=edge(d.w,b.w);
  ${vertexRegions(R4.vertices)}
  let w_acb=triangle(a.w,c.w,b.w); let w_abd=triangle(a.w,b.w,d.w);
  let w_adc=triangle(a.w,d.w,c.w); let w_bcd=triangle(b.w,c.w,d.w);
  ${edgeRegions(R4.edges)}
  let w_abcd=tetrahedron(a.w,b.w,c.w,d.w);
  ${R4.faces.map(([name,vs,i])=>`
  if (w_abcd[${i}] < 0.0 && w_${name}[0] > 0.0 && w_${name}[1] > 0.0 && w_${name}[2] > 0.0) {
    s.count=3u; s.v[0]=${vs[0]}; s.v[1]=${vs[1]}; s.v[2]=${vs[2]};
    let divisor=w_${name}[3]; if (divisor <= 0.0) { s.solved=false; return s; }
    s.v[0]=weighted(s.v[0],fdiv(w_${name}[0],divisor));
    s.v[1]=weighted(s.v[1],fdiv(w_${name}[1],divisor));
    s.v[2]=weighted(s.v[2],fdiv(w_${name}[2],divisor)); return s;
  }`).join('')}
  let divisor=w_abcd[4]; if (divisor <= 0.0) { s.solved=false; return s; }
  s.v[0]=weighted(s.v[0],fdiv(w_abcd[0],divisor));
  s.v[1]=weighted(s.v[1],fdiv(w_abcd[1],divisor));
  s.v[2]=weighted(s.v[2],fdiv(w_abcd[2],divisor));
  s.v[3]=weighted(s.v[3],fdiv(w_abcd[3],divisor)); return s;
}
fn solve(original: Simplex) -> Simplex {
  if (original.count == 2u) { return solve2(original); }
  if (original.count == 3u) { return solve3(original); }
  if (original.count == 4u) { return solve4(original); }
  var s=copySimplex(original); s.solved=true; s.v[0]=weighted(s.v[0],1.0); return s;
}
fn support(direction: V3) -> u32 {
  let origin=pointA(0u); var bestIndex=0u; var bestValue=0.0;
  for (var i=1u; i < pointCount(); i=i+1u) {
    let value=vdot(direction,vsub(pointA(i),origin));
    if (value > bestValue) { bestIndex=i; bestValue=value; }
  }
  return bestIndex;
}
fn cacheValid(c: Cache) -> bool {
  if (c.count > 3u) { return false; }
  for (var i=0u; i < c.count; i=i+1u) {
    if (c.indexA[i] >= pointCount() || c.indexB[i] >= 1u) { return false; }
  }
  return true;
}
fn ballPoint(translation: V3, qxyz: V3, qw: f32) -> V3 {
  // scalar glam Quat::mul_vec3(ZERO), then Pose::transform_point translation.
  let p=V3(0.0,0.0,0.0); let b2=vdot(qxyz,qxyz);
  return vadd(vadd(vadd(vmul(p,fsub(fmul(qw,qw),b2)),vmul(qxyz,fmul(vdot(p,qxyz),2.0))),vmul(vcross(qxyz,p),fmul(qw,2.0))),translation);
}
fn proxyDistance(pointB: V3, inputCache: Cache) -> DistanceResult {
  let z=V3(0.0,0.0,0.0);
  var result=DistanceResult(z,z,z,0.0,0u,copyCache(inputCache),false,false,7u,false,false,0u);
  var simplex=Simplex(Vertices(emptyVertex(),emptyVertex(),emptyVertex(),emptyVertex()),0u,true);
  result.cacheAccepted=cacheValid(inputCache);
  if (result.cacheAccepted) { simplex.count=inputCache.count; }
  for (var i=0u; i < simplex.count; i=i+1u) {
    let wa=pointA(inputCache.indexA[i]);
    simplex.v[i]=Vertex(wa,pointB,vsub(pointB,wa),0.0,inputCache.indexA[i],inputCache.indexB[i]);
  }
  if (simplex.count > 0u) {
    let metric1=inputCache.metric; let metric2=simplexMetric(simplex);
    if (fmul(2.0,metric1) < metric2 || metric2 < fmul(0.5,metric1) || metric2 < 1.1920928955078125e-7) {
      simplex.count=0u; result.cacheFlushed=true;
    }
  }
  if (simplex.count == 0u) {
    let wa=pointA(0u); simplex.v[0]=Vertex(wa,pointB,vsub(pointB,wa),0.0,0u,0u); simplex.count=1u;
  }
  var backup=copySimplex(simplex); var backupCount=0u;
  var distanceSq=3.4028234663852886e38; var normal=z; var iteration=0u;
  while (iteration < 32u) {
    simplex=solve(simplex);
    if (!simplex.solved) {
      result.termination=5u;
      if (backupCount == 0u) { break; }
      simplex=copySimplex(backup); simplex.count=backupCount; break;
    }
    if (simplex.count == 4u) {
      let w=witness(simplex); result.pointA=w.pointA; result.pointB=w.pointB;
      result.iterations=iteration; result.overlap=true; result.termination=1u; result.finalCount=simplex.count; return result;
    }
    let oldDistanceSq=distanceSq; let closestPoint=closest(simplex); distanceSq=vdot(closestPoint,closestPoint);
    if (distanceSq >= oldDistanceSq) {
      result.termination=6u;
      if (backupCount == 0u) { break; }
      simplex=copySimplex(backup); simplex.count=backupCount; break;
    }
    let searchDirection=direction(simplex);
    if (vdot(searchDirection,searchDirection) < fmul(1000.0,1.1754943508222875e-38)) {
      let w=witness(simplex); result.pointA=w.pointA; result.pointB=w.pointB;
      result.iterations=iteration; result.overlap=true; result.termination=2u; result.finalCount=simplex.count; return result;
    }
    normal=vneg(searchDirection);
    let indexA=support(vneg(searchDirection)); let supportA=pointA(indexA);
    // Ball's proxy B has exactly one local ZERO point. Its support is index 0
    // for every inverse-rotated direction, so no shape/plane shortcut is used.
    backup=copySimplex(simplex); backupCount=simplex.count;
    var duplicate=false;
    for (var i=0u; i < simplex.count; i=i+1u) {
      if (simplex.v[i].indexA == indexA && simplex.v[i].indexB == 0u) { duplicate=true; }
    }
    if (duplicate) { result.termination=4u; break; }
    // Preserve the old slot's coefficient, exactly as the Rust assignment does.
    simplex.v[simplex.count]=Vertex(supportA,pointB,vsub(pointB,supportA),simplex.v[simplex.count].a,indexA,0u);
    simplex.count=simplex.count+1u; iteration=iteration+1u;
  }
  normal=normalizedOrZero(normal);
  result.iterations=iteration; result.finalCount=simplex.count;
  if (normal.x == 0.0 && normal.y == 0.0 && normal.z == 0.0) {
    result.overlap=true; result.termination=3u; return result;
  }
  let w=witness(simplex);
  result.cache.metric=simplexMetric(simplex); result.cache.count=simplex.count;
  if (result.cache.count > 3u) { result.cache.count=3u; }
  for (var i=0u; i < result.cache.count; i=i+1u) {
    result.cache.indexA[i]=simplex.v[i].indexA; result.cache.indexB[i]=simplex.v[i].indexB;
  }
  result.pointA=w.pointA; result.pointB=w.pointB; result.distance=vlength(vsub(w.pointA,w.pointB));
  result.normal=normal; result.cacheWritten=true; return result;
}
`;
// WGSL uses explicit function pointers for the mutable simplex. Returning a
// 4-vertex aggregate from every Voronoi branch produces enormous SSA merges in
// some software drivers. This mechanical lowering changes storage spelling,
// not scalar arithmetic, region/branch order, or the CPU algorithm source.
function rewriteFunction(source,name,change) {
  const start=source.indexOf('fn '+name+'('); if(start<0)throw Error('Missing kernel function '+name);
  const brace=source.indexOf('{',start);let depth=1,end=brace+1;
  while(depth&&end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  if(depth)throw Error('Malformed kernel function '+name);
  return source.slice(0,start)+change(source.slice(start,end))+source.slice(end);
}
function wgslKernel(reducerSource) {
  let source=KERNEL;
  for(const name of ['solve2','solve3','solve4'])source=rewriteFunction(source,name,body=>body
    .replace('original: Simplex) -> Simplex','s: ptr<function, Simplex>)')
    .replace('var s=copySimplex(original); ','')
    .replace(/\bs\./g,'(*s).').replace(/return s;/g,'return;'));
  source=rewriteFunction(source,'solve',()=>`fn solve(s: ptr<function, Simplex>) {
    if ((*s).count == 2u) { solve2(s); return; }
    if ((*s).count == 3u) { solve3(s); return; }
    if ((*s).count == 4u) { solve4(s); return; }
    (*s).solved=true; (*s).v[0]=weighted((*s).v[0],1.0);
  }`);
  if(reducerSource) {
    for(const name of ['solve2','solve3','solve4','edge','triangle','tetrahedron']) source=rewriteFunction(source,name,()=> '');
    source=rewriteFunction(source,'solve',()=>reducerSource);
  }
  for(const name of ['simplexMetric','witness','closest','direction']) {
    source=rewriteFunction(source,name,body=>body.replace('s: Simplex','s: ptr<function, Simplex>').replace(/\bs\./g,'(*s).'));
    source=source.replace(new RegExp('\\b'+name+'\\(simplex\\)','g'),name+'(&simplex)');
  }
  source=source.replace('simplex=solve(simplex);','solve(&simplex);');
  source=rewriteFunction(source,'proxyDistance',body=>body
    .replace(' -> DistanceResult','')
    .replace('var result=DistanceResult','result=DistanceResult')
    .replace(/return result;/g,'return;'));
  source='var<private> result: DistanceResult;\n'+source;
  source=rewriteFunction(source,'copySimplex',()=> '');
  return source.replace(/copySimplex\((\w+)\)/g,'$1');
}
// Translation of a closed, deliberately tiny syntax subset, not a general
// compiler. Source tests regenerate and compare the artifact byte-for-byte.
function cpuArtifact() {
  const body=KERNEL.replace(/fn\s+(\w+)\(([^)]*)\)\s*->\s*\w+\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:\s*\w+/g,'')}) {`)
    .replace(/\blet\b/g,'const').replace(/\bvar\b/g,'let').replace(/(\d)u\b/g,'$1');
  return `/* SPDX-License-Identifier: Apache-2.0\n * GENERATED from experimental-ccd-proxy-distance-kernel.js. DO NOT EDIT.\n * Source/attribution/license notices are preserved in that file.\n */\n(function(G){'use strict';\nfunction createKernel(pointsA) {\nconst f=Math.fround, fadd=(a,b)=>f(a+b), fsub=(a,b)=>f(a-b), fmul=(a,b)=>f(a*b), fdiv=(a,b)=>f(a/b), fsqrt=a=>f(Math.sqrt(a));\nconst V3=(x,y,z)=>({x,y,z}), F3=(...a)=>a, F4=F3, F5=F3, U3=F3, Vertices=F3;\nconst Vertex=(wa,wb,w,a,indexA,indexB)=>({wa,wb,w,a,indexA,indexB}), Simplex=(v,count,solved)=>({v,count,solved}), Cache=(metric,count,indexA,indexB)=>({metric,count,indexA,indexB}), Witness=(pointA,pointB)=>({pointA,pointB});\nconst DistanceResult=(pointA,pointB,normal,distance,iterations,cache,overlap,cacheWritten,termination,cacheAccepted,cacheFlushed,finalCount)=>({pointA,pointB,normal,distance,iterations,cache,overlap,cacheWritten,termination,cacheAccepted,cacheFlushed,finalCount});\nconst pointA=i=>V3(...pointsA[i]), pointCount=()=>pointsA.length;\nfunction normalizedOrZero(a) { const rcp=fdiv(1,vlength(a)); return Number.isFinite(rcp)&&rcp>0?vmul(a,rcp):V3(0,0,0); }\n${body}\nreturn {proxyDistance,ballPoint,solve,simplexMetric,witness,closest,direction,support,edge,triangle,tetrahedron,V3,Vertex,Simplex,Cache,Vertices,emptyVertex};\n}\nconst api=Object.freeze({createKernel}); G.LabCcdProxyDistanceCpuExperimental=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;\n})(globalThis);\n`;
}
const api=Object.freeze({KERNEL,TYPES,PRIMITIVES,cpuArtifact,wgslKernel,REGIONS3:R3,REGIONS4:R4});
G.LabCcdProxyDistanceKernelExperimental=api; if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof module!=='undefined'&&require.main===module) {
  const fs=require('node:fs'),path=require('node:path'),out=path.join(__dirname,'experimental-ccd-proxy-distance-cpu.js');
  if(process.argv.includes('--generate')) fs.writeFileSync(out,cpuArtifact());
  else if(process.argv.includes('--check')) { if(fs.readFileSync(out,'utf8')!==cpuArtifact()) throw Error('Proxy-distance CPU artifact is stale'); }
  else throw Error('Use --generate or --check');
}
})(globalThis);
