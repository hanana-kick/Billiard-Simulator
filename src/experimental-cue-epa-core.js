/* SPDX-License-Identifier: Apache-2.0
 * Source-derived bounded Parry3d 0.31.1 EPA, rebuilt 2026-10-24.
 * Copyright Sébastien Crozet and Dimforge/Parry contributors.
 * See vendor/RAPIER-LICENSE.txt and docs/experimental-cue-epa-source-map.md.
 * This is shared JS/WGSL control source, not a native-query oracle.
 */
(function(G){'use strict';
const EPA_LAYOUT=Object.freeze({
  first:200,last:12631,control:200,termination:112,terminationArgument:113,
  vertices:216,vertexStride:9,vertexCapacity:128,
  faces:1368,faceStride:14,faceCapacity:512,
  heap:8536,heapCapacity:512,
  silhouette:9560,silhouetteCapacity:512,
  stack:10584,stackCapacity:1024
});
const EPA_CORE=String.raw`
fn epa_vertex(i:i32)->Cso {
  let b:i32=216+i*9;
  return Cso(getv(b),getv(b+3),getv(b+6));
}
fn epa_point(i:i32)->V { return getv(222+i*9); }
fn epa_push_vertex(p:Cso)->i32 {
  let n:i32=i32(sget(200));
  if(n>=128){sset(0,-2.0);return -1;}
  let b:i32=216+n*9;
  setv(b,p.orig1);setv(b+3,p.orig2);setv(b+6,p.point);
  sset(200,f32(n+1));return n;
}
fn epa_face_get(i:i32,j:i32)->f32 { return sget(1368+i*14+j); }
fn epa_face_set(i:i32,j:i32,x:f32) { sset(1368+i*14+j,x); }
fn epa_face_normal(i:i32)->V { return getv(1374+i*14); }
fn epa_face_point(i:i32,j:i32)->V { return epa_point(i32(epa_face_get(i,j))); }
fn epa_make_face(a:i32,b:i32,c:i32,j0:i32,j1:i32,j2:i32)->i32 {
  let n:i32=i32(sget(201));
  if(n>=512){sset(0,-2.0);return -1;}
  let pa:V=epa_point(a);let pb:V=epa_point(b);let pc:V=epa_point(c);
  let r:Projection=triangle(pa,pb,pc);
  if(sget(0)<0.0){return -1;}
  let normal:V=try_unit(vc(vs(pb,pa),vs(pc,pa)));
  var weights:V=zero();var inside:f32=0.0;
  if(r.kind==0||r.kind==1){
    weights=r.weights;
    let d:V=vs(zero(),r.point);
    let eps:f32=0.00000011920928955078125;
    let tol:f32=mulf(eps,100.0);
    if((absf(r.point.x)<=eps&&absf(r.point.y)<=eps&&absf(r.point.z)<=eps)||vd(d,d)<mulf(tol,tol)){inside=1.0;}
  }else if(r.kind==2){weights=r.weights;inside=1.0;}
  epa_face_set(n,0,f32(a));epa_face_set(n,1,f32(b));epa_face_set(n,2,f32(c));
  epa_face_set(n,3,f32(j0));epa_face_set(n,4,f32(j1));epa_face_set(n,5,f32(j2));
  setv(1374+n*14,normal);setv(1377+n*14,weights);
  epa_face_set(n,12,0.0);epa_face_set(n,13,inside);
  sset(201,f32(n+1));return n;
}
fn epa_miss() { if(sget(112)==0.0){sset(112,7.0);}setv(88,v3(1.0,0.0,0.0));sset(0,4.0); }
// These predicates retain the source branches and annotate only their reason.
fn epa_require_heap()->bool { if(sget(202)==0.0){sset(112,4.0);epa_miss();return false;}return true; }
fn epa_require_silhouette()->bool { if(sget(203)==0.0){sset(112,5.0);epa_miss();return false;}return true; }
fn epa_require_new_faces(first:i32)->bool { if(first==i32(sget(201))){sset(112,6.0);epa_miss();return false;}return true; }
fn epa_heap_push(id:i32,d:f32) {
  if(d>sget(205)){sset(112,3.0);sset(113,d);epa_miss();return;}
  var hole:i32=i32(sget(202));
  if(hole>=512){sset(0,-2.0);return;}
  sset(202,f32(hole+1));
  while(hole>0){
    let parent:i32=i32((hole-1)/2);
    if(d<=sget(8537+parent*2)){break;}
    sset(8536+hole*2,sget(8536+parent*2));
    sset(8537+hole*2,sget(8537+parent*2));hole=parent;
  }
  sset(8536+hole*2,f32(id));sset(8537+hole*2,d);
}
fn epa_heap_pop()->i32 {
  let result:i32=i32(sget(8536));sset(206,sget(8537));
  let n:i32=i32(sget(202))-1;sset(202,f32(n));
  if(n==0){return result;}
  let id:f32=sget(8536+n*2);let d:f32=sget(8537+n*2);
  var hole:i32=0;var child:i32=1;
  while(child+1<n){
    if(sget(8537+child*2)<=sget(8537+(child+1)*2)){child=child+1;}
    sset(8536+hole*2,sget(8536+child*2));
    sset(8537+hole*2,sget(8537+child*2));
    hole=child;child=hole*2+1;
  }
  if(child<n){
    sset(8536+hole*2,sget(8536+child*2));
    sset(8537+hole*2,sget(8537+child*2));hole=child;
  }
  while(hole>0){
    let parent:i32=i32((hole-1)/2);
    if(d<=sget(8537+parent*2)){break;}
    sset(8536+hole*2,sget(8536+parent*2));
    sset(8537+hole*2,sget(8537+parent*2));hole=parent;
  }
  sset(8536+hole*2,id);sset(8537+hole*2,d);return result;
}
fn epa_result(id:i32) {
  let a:Cso=epa_vertex(i32(epa_face_get(id,0)));
  let b:Cso=epa_vertex(i32(epa_face_get(id,1)));
  let c:Cso=epa_vertex(i32(epa_face_get(id,2)));
  let w:V=getv(1377+id*14);
  setv(14,va(va(vm(a.orig1,w.x),vm(b.orig1,w.y)),vm(c.orig1,w.z)));
  setv(84,va(va(vm(a.orig2,w.x),vm(b.orig2,w.y)),vm(c.orig2,w.z)));
  setv(88,epa_face_normal(id));sset(0,3.0);
}
fn epa_next_ccw(id:i32,p:i32)->i32 {
  if(i32(epa_face_get(id,0))==p){return 1;}
  if(i32(epa_face_get(id,1))==p){return 2;}return 0;
}
fn epa_seen(id:i32,point:i32,opp:i32)->bool {
  let p0:V=epa_face_point(id,opp);
  let p1:V=epa_face_point(id,(opp+1)%3);
  let p2:V=epa_face_point(id,(opp+2)%3);
  let pt:V=epa_point(point);
  if(vd(vs(pt,p0),epa_face_normal(id))>=-0.0000011920928955078125){return true;}
  let n:V=vc(vs(p2,p1),vs(pt,p1));
  let eps:f32=0.000011920928955078125;
  return vd(n,n)<=mulf(eps,eps);
}
fn epa_stack_push(id:i32,opp:i32) {
  let n:i32=i32(sget(204));
  if(n>=1024){sset(0,-2.0);return;}
  sset(10584+n*2,f32(id));sset(10585+n*2,f32(opp));sset(204,f32(n+1));
}
fn epa_silhouette(point:i32,id:i32,opp:i32) {
  sset(204,0.0);epa_stack_push(id,opp);
  while(sget(204)>0.0){
    let n:i32=i32(sget(204))-1;sset(204,f32(n));
    let face:i32=i32(sget(10584+n*2));let op:i32=i32(sget(10585+n*2));
    if(epa_face_get(face,12)!=0.0){continue;}
    if(!epa_seen(face,point,op)){
      let count:i32=i32(sget(203));
      if(count>=512){sset(0,-2.0);return;}
      sset(9560+count*2,f32(face));sset(9561+count*2,f32(op));sset(203,f32(count+1));
    }else{
      epa_face_set(face,12,1.0);
      let p1:i32=(op+2)%3;let p2:i32=op;
      let a1:i32=i32(epa_face_get(face,3+p1));let a2:i32=i32(epa_face_get(face,3+p2));
      let o1:i32=epa_next_ccw(a1,i32(epa_face_get(face,p1)));
      let o2:i32=epa_next_ccw(a2,i32(epa_face_get(face,p2)));
      epa_stack_push(a2,o2);if(sget(0)<0.0){return;}
      epa_stack_push(a1,o1);if(sget(0)<0.0){return;}
    }
  }
}
fn epa() {
  if(sget(0)!=2.0){return;}
  for(var i:i32=200;i<216;i=i+1){sset(i,0.0);}
  let dim:i32=i32(sget(1));
  if(dim<0||dim>3){sset(0,-3.0);return;}
  for(var i:i32=0;i<=dim;i=i+1){let unused:i32=epa_push_vertex(simplex_vertex(i));}
  if(sget(0)<0.0){return;}
  if(dim==0){
    for(var k:i32=0;k<6;k=k+1){
      var dir:V=v3(1.0,0.0,0.0);
      if(k%3==1){dir=v3(0.0,1.0,0.0);}else if(k%3==2){dir=v3(0.0,0.0,1.0);}
      if(k>=3){dir=vn(dir);}
      let p:Cso=support(dir);let d:V=vs(p.point,epa_point(0));
      let tol:f32=0.0000011920928955078125;
      if(vd(d,d)>mulf(tol,tol)){let unused:i32=epa_push_vertex(p);break;}
    }
    if(sget(0)<0.0){return;}
    if(sget(200)==1.0){
      let p:Cso=epa_vertex(0);setv(14,p.orig1);setv(84,p.orig2);
      setv(88,v3(0.0,1.0,0.0));sset(0,3.0);return;
    }
  }
  var scale:f32=0.0;
  for(var i:i32=0;i<i32(sget(200));i=i+1){let d:f32=len(epa_point(i));if(d>scale){scale=d;}}
  if(scale<1.0){scale=1.0;}
  sset(205,mulf(0.0000011920928955078125,scale));
  if(dim==3){
    let d1:V=vs(epa_point(1),epa_point(0));
    let d2:V=vs(epa_point(2),epa_point(0));
    let d3:V=vs(epa_point(3),epa_point(0));
    if(vd(vc(d1,d2),d3)>0.0){
      for(var j:i32=0;j<9;j=j+1){let t:f32=sget(225+j);sset(225+j,sget(234+j));sset(234+j,t);}
    }
    let f0:i32=epa_make_face(0,1,2,3,1,2);if(sget(0)<0.0){return;}
    let f1:i32=epa_make_face(1,3,2,3,2,0);if(sget(0)<0.0){return;}
    let f2:i32=epa_make_face(0,2,3,0,1,3);if(sget(0)<0.0){return;}
    let f3:i32=epa_make_face(0,3,1,2,1,0);if(sget(0)<0.0){return;}
    for(var i:i32=0;i<4;i=i+1){
      if(epa_face_get(i,13)!=0.0){epa_heap_push(i,-vd(epa_face_normal(i),epa_point(i)));if(sget(0)!=2.0){return;}}
    }
    if(!epa_require_heap()){return;}
  }else{
    if(sget(200)==2.0){
      let d:V=try_unit(vs(epa_point(1),epa_point(0)));
      if(d.x==0.0&&d.y==0.0&&d.z==0.0){sset(0,-3.0);return;}
      var orth:V=v3(0.0,-d.z,d.y);
      if(absf(d.x)>absf(d.z)){orth=v3(-d.y,d.x,0.0);}
      let unused:i32=epa_push_vertex(support(try_unit(orth)));
      if(sget(0)<0.0){return;}
    }
    let f0:i32=epa_make_face(0,1,2,1,1,1);if(sget(0)<0.0){return;}
    let f1:i32=epa_make_face(0,2,1,0,0,0);if(sget(0)<0.0){return;}
    epa_heap_push(0,0.0);if(sget(0)!=2.0){return;}
    epa_heap_push(1,0.0);if(sget(0)!=2.0){return;}
  }
  var niter:i32=0;var max_dist:f32=3.4028234663852886e38;
  var best:i32=i32(sget(8536));var old_dist:f32=0.0;
  while(sget(202)>0.0){
    let id:i32=epa_heap_pop();let neg_dist:f32=sget(206);
    if(epa_face_get(id,12)!=0.0){continue;}
    let point:i32=epa_push_vertex(support(epa_face_normal(id)));
    if(sget(0)<0.0){return;}
    let candidate:f32=vd(epa_point(point),epa_face_normal(id));
    if(candidate<max_dist){best=id;max_dist=candidate;}
    let curr:f32=-neg_dist;
    if(subf(max_dist,curr)<0.000011920928955078125||(absf(subf(curr,old_dist))<0.00000011920928955078125&&candidate<max_dist)){
      epa_result(best);return;
    }
    old_dist=curr;epa_face_set(id,12,1.0);
    let a0:i32=i32(epa_face_get(id,3));
    let a1:i32=i32(epa_face_get(id,4));
    let a2:i32=i32(epa_face_get(id,5));
    let o0:i32=epa_next_ccw(a0,i32(epa_face_get(id,0)));
    let o1:i32=epa_next_ccw(a1,i32(epa_face_get(id,1)));
    let o2:i32=epa_next_ccw(a2,i32(epa_face_get(id,2)));
    epa_silhouette(point,a0,o0);if(sget(0)<0.0){return;}
    epa_silhouette(point,a1,o1);if(sget(0)<0.0){return;}
    epa_silhouette(point,a2,o2);if(sget(0)<0.0){return;}
    let first:i32=i32(sget(201));
    if(!epa_require_silhouette()){return;}
    for(var j:i32=0;j<i32(sget(203));j=j+1){
      let edge:i32=i32(sget(9560+j*2));let op:i32=i32(sget(9561+j*2));
      if(epa_face_get(edge,12)==0.0){
        let p1:i32=i32(epa_face_get(edge,(op+2)%3));
        let p2:i32=i32(epa_face_get(edge,(op+1)%3));
        let nf:i32=i32(sget(201));
        let made:i32=epa_make_face(p1,p2,point,edge,nf+1,nf-1);
        if(sget(0)<0.0){return;}
        epa_face_set(edge,3+(op+1)%3,f32(made));
        if(epa_face_get(made,13)!=0.0){
          let dist:f32=vd(epa_face_normal(made),epa_face_point(made,0));
          if(dist<curr){epa_result(id);return;}
          epa_heap_push(made,-dist);if(sget(0)!=2.0){return;}
        }
      }
    }
    if(!epa_require_new_faces(first)){return;}
    epa_face_set(first,5,subf(sget(201),1.0));
    epa_face_set(i32(sget(201))-1,4,f32(first));sset(203,0.0);
    niter=niter+1;sset(207,f32(niter));
    if(niter>100){break;}
  }
  epa_result(best);
}
`;
const api=Object.freeze({EPA_CORE,EPA_LAYOUT});
G.LabCueEpaCoreExperimental=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
