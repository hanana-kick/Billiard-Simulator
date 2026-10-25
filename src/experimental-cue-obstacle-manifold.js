/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: bounded JS/WGSL query port.
 * Fresh source-derived Parry3d 0.31.1 cylinder/cuboid/native-convex manifold.
 * original-indexed-convex queries are the source basis. This separate module implements
 * fresh cylinder/cuboid/admitted-native-convex clipping. No persistence, CCD, or world claim.
 * Reimplemented after environment loss; historical test counts are not evidence.
 * Quaternion operations derive from glam (MIT OR Apache-2.0).
 */
(function(G){'use strict';
const EPA=typeof module!=='undefined'&&module.exports?require('./experimental-cue-epa-core.js'):G.LabCueEpaCoreExperimental;
const PARITY_SCOPE='experimental-cylinder-cuboid-native-convex-fresh-manifold-only';
const Topology=typeof module!=='undefined'&&module.exports?require('./experimental-cue-convex-topology.js'):G.LabCueConvexTopologyExperimental;
const Query=typeof module!=='undefined'&&module.exports?require('./experimental-cue-obstacle-contact.js'):G.LabCueObstacleContactExperimental;
const PROVENANCE=Object.freeze({parry:'0.31.1',parryRevision:'3383f51cbbe9af70565427e7a66c605e1557c1fc',crateSha256:'7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e',rapier:'0.21.0',revision:'b716d375efc0201003f0cd9ef7168eee0b62c177',reimplemented:true});
const MAX_BATCH=64,INPUT_FLOATS=24,OUTPUT_FLOATS=516,HULL_FLOATS=1744,STATE_FLOATS=13760,GJK_DISPATCHES=256;
const F=Math.fround;
const bitFloat=new Float32Array(1),bitUint=new Uint32Array(bitFloat.buffer);
function bits(x){bitFloat[0]=x;return bitUint[0];}
const JS_PRIMITIVES={f32:F,i32:Math.trunc,addf:(a,b)=>F(a+b),subf:(a,b)=>F(a-b),mulf:(a,b)=>F(a*b),divf:(a,b)=>F(a/b),sqrtf:x=>F(Math.sqrt(x)),absf:Math.abs,minf:Math.min,maxf:Math.max,finitef:Number.isFinite,signcopy:(s,m)=>s<0||Object.is(s,-0)?-Math.abs(m):Math.abs(m),v3:(x,y,z)=>({x:F(x),y:F(y),z:F(z)}),Cso:(orig1,orig2,point)=>({orig1,orig2,point}),ulpsnear:(a,b)=>Math.abs(bits(a)-bits(b))<=4,Projection:(point,kind,index,weights)=>({point,kind,index,weights})};
const QUERY_CORE=String.raw`
fn zero()->V{return v3(0.0,0.0,0.0);}
fn va(a:V,b:V)->V{return v3(addf(a.x,b.x),addf(a.y,b.y),addf(a.z,b.z));}
fn vs(a:V,b:V)->V{return v3(subf(a.x,b.x),subf(a.y,b.y),subf(a.z,b.z));}
fn vn(a:V)->V{return v3(-a.x,-a.y,-a.z);}
fn vm(a:V,s:f32)->V{return v3(mulf(a.x,s),mulf(a.y,s),mulf(a.z,s));}
fn vd(a:V,b:V)->f32{return addf(addf(mulf(a.x,b.x),mulf(a.y,b.y)),mulf(a.z,b.z));}
fn vc(a:V,b:V)->V{return v3(subf(mulf(a.y,b.z),mulf(a.z,b.y)),subf(mulf(a.z,b.x),mulf(a.x,b.z)),subf(mulf(a.x,b.y),mulf(a.y,b.x)));}
fn len(a:V)->f32{return sqrtf(vd(a,a));}
fn try_unit(a:V)->V{let inv:f32=divf(1.0,len(a));if(finitef(inv)&&inv>0.0){return vm(a,inv);}return zero();}
fn unit(a:V)->V{return vm(a,divf(1.0,len(a)));}
fn getv(i:i32)->V{return v3(sget(i),sget(i+1),sget(i+2));}
fn setv(i:i32,v:V){sset(i,v.x);sset(i+1,v.y);sset(i+2,v.z);}
fn iv(i:i32)->V{return v3(iget(i),iget(i+1),iget(i+2));}
fn ov(i:i32,v:V){oset(i,v.x);oset(i+1,v.y);oset(i+2,v.z);}
// glam scalar Quat::mul_vec3 preserves each elementary rounding and association.
fn rotate(v:V,q:V,w:f32)->V{return va(va(vm(v,subf(mulf(w,w),vd(q,q))),vm(q,mulf(vd(v,q),2.0))),vm(vc(q,v),mulf(w,2.0)));}
fn local_support(which:i32,dir:V)->V{
 let d:V=iv(which*10+7);let kind:i32=i32(iget(20+which));
 if(kind==0){let radial:V=vm(try_unit(v3(dir.x,0.0,dir.z)),d.y);return v3(radial.x,signcopy(dir.y,d.x),radial.z);}
 if(kind==1){return v3(signcopy(dir.x,d.x),signcopy(dir.y,d.y),signcopy(dir.z,d.z));}
 if(kind==3){return vm(unit(dir),d.x);}
 let base:i32=which*100;let count:i32=i32(hget(base));var best:V=v3(hget(base+1),hget(base+2),hget(base+3));var score:f32=vd(best,dir);
 for(var i:i32=1;i<count;i=i+1){let at:i32=base+1+i*3;let p:V=v3(hget(at),hget(at+1),hget(at+2));let v:f32=vd(p,dir);if(v>score){score=v;best=p;}}
 return best;
}
fn support(dir:V)->Cso{let p1:V=local_support(0,dir);var p2:V=zero();if(iget(21)==3.0){p2=va(getv(17),vm(unit(vn(dir)),iget(17)));}else{let d2:V=rotate(vn(dir),vn(getv(68)),sget(71));p2=va(rotate(local_support(1,d2),getv(68),sget(71)),getv(17));}return Cso(p1,p2,vs(p1,p2));}
fn simplex_vertex(i:i32)->Cso{let b:i32=20+i*9;return Cso(getv(b),getv(b+3),getv(b+6));}
fn put_vertex(i:i32,p:Cso){let b:i32=20+i*9;setv(b,p.orig1);setv(b+3,p.orig2);setv(b+6,p.point);}
fn swap_vertex(a:i32,b:i32){let p:Cso=simplex_vertex(a);put_vertex(a,simplex_vertex(b));put_vertex(b,p);let t:f32=sget(60+a);sset(60+a,sget(60+b));sset(60+b,t);}
fn segment(a:V,b:V)->Projection{let ab:V=vs(b,a);let ap:V=vs(zero(),a);let dp:f32=vd(ab,ap);let sq:f32=vd(ab,ab);if(dp<=0.0){return Projection(a,0,0,v3(1.0,0.0,0.0));}if(dp>=sq){return Projection(b,0,1,v3(0.0,1.0,0.0));}let u:f32=divf(dp,sq);return Projection(va(a,vm(ab,u)),1,0,v3(subf(1.0,u),u,0.0));}
fn triangle(a:V,b:V,c:V)->Projection{
 let ab:V=vs(b,a);let ac:V=vs(c,a);let ap:V=vs(zero(),a);let aa:f32=vd(ab,ap);let ca:f32=vd(ac,ap);
 if(aa<=0.0&&ca<=0.0){return Projection(a,0,0,v3(1.0,0.0,0.0));}
 let bp:V=vs(zero(),b);let abp:f32=vd(ab,bp);let cbp:f32=vd(ac,bp);if(abp>=0.0&&cbp<=abp){return Projection(b,0,1,v3(0.0,1.0,0.0));}
 let cp:V=vs(zero(),c);let acp:f32=vd(ab,cp);let ccp:f32=vd(ac,cp);if(ccp>=0.0&&acp<=ccp){return Projection(c,0,2,v3(0.0,0.0,1.0));}
 let bc:V=vs(c,b);let n:V=vc(ab,ac);let cw:f32=vd(n,vc(ab,ap));
 if(cw<0.0&&aa>=0.0&&abp<=0.0){let t:f32=divf(aa,vd(ab,ab));return Projection(va(a,vm(ab,t)),1,0,v3(subf(1.0,t),t,0.0));}
 let bw:f32=-vd(n,vc(ac,cp));if(bw<0.0&&ca>=0.0&&ccp<=0.0){let t:f32=divf(ca,vd(ac,ac));return Projection(va(a,vm(ac,t)),1,2,v3(subf(1.0,t),0.0,t));}
 let aw:f32=vd(n,vc(bc,bp));if(aw<0.0&&subf(cbp,abp)>=0.0&&subf(acp,ccp)>=0.0){let t:f32=divf(vd(bc,bp),vd(bc,bc));return Projection(va(b,vm(bc,t)),1,1,v3(0.0,subf(1.0,t),t));}
 let denom:f32=addf(addf(aw,bw),cw);if(denom==0.0){let sa:f32=vd(ab,ab);let sc:f32=vd(ac,ac);let sb:f32=vd(bc,bc);if(sa>=sc&&sa>=sb){return segment(a,b);}if(sc>=sb){let p:Projection=segment(a,c);if(p.kind==0){if(p.index==0){return Projection(p.point,0,0,v3(1.0,0.0,0.0));}return Projection(p.point,0,2,v3(0.0,0.0,1.0));}return Projection(p.point,1,2,v3(p.weights.x,0.0,p.weights.y));}let p:Projection=segment(b,c);if(p.kind==0){if(p.index==0){return Projection(p.point,0,1,v3(0.0,1.0,0.0));}return Projection(p.point,0,2,v3(0.0,0.0,1.0));}return Projection(p.point,1,1,v3(0.0,p.weights.x,p.weights.y));}
 let v:f32=divf(bw,denom);let w:f32=divf(cw,denom);var side:i32=1;if(vd(n,ap)>=0.0){side=0;}return Projection(va(va(a,vm(ab,v)),vm(ac,w)),2,side,v3(subf(subf(1.0,v),w),v,w));
}
fn tet_edge(i:i32,a:V,n1:V,n2:V,ap:V,ab:V,aa:f32,ba:f32)->Projection{let dd:f32=subf(aa,ba);let cr:V=vc(ap,ab);let d1:f32=vd(cr,n1);let d2:f32=vd(cr,n2);sset(96+i*2,d1);sset(97+i*2,d2);if(dd!=0.0&&d1>=0.0&&d2>=0.0&&aa>=0.0&&aa<=dd){let u:f32=divf(aa,dd);return Projection(va(a,vm(ab,u)),1,i,v3(subf(1.0,u),u,0.0));}return Projection(zero(),-1,0,zero());}
fn tet_face(i:i32,a:V,b:V,c:V,ap:V,bp:V,cp:V,ab:V,ac:V,ad:V,d1:f32,d2:f32,d3:f32)->Projection{
 if(d1<0.0&&d2<0.0&&d3<0.0){let n:V=vc(ab,ac);if(mulf(vd(n,ad),vd(n,ap))<0.0){let normal:V=try_unit(n);if(vd(normal,normal)==0.0){return Projection(zero(),-1,0,zero());}let wc:f32=vd(normal,vc(ap,bp));let wa:f32=vd(normal,vc(bp,cp));let wb:f32=vd(normal,vc(cp,ap));let inv:f32=divf(1.0,addf(addf(wa,wb),wc));let w:V=v3(mulf(wa,inv),mulf(wb,inv),mulf(wc,inv));return Projection(va(va(vm(a,w.x),vm(b,w.y)),vm(c,w.z)),2,i,w);}}return Projection(zero(),-1,0,zero());
}
fn tetra(a:V,b:V,c:V,d:V)->Projection{
 let ab:V=vs(b,a);let ac:V=vs(c,a);let ad:V=vs(d,a);let ap:V=vs(zero(),a);let aa:f32=vd(ap,ab);let ca:f32=vd(ap,ac);let da:f32=vd(ap,ad);
 if(aa<=0.0&&ca<=0.0&&da<=0.0){return Projection(a,0,0,zero());}
 let bc:V=vs(c,b);let bd:V=vs(d,b);let bp:V=vs(zero(),b);let bc_b:f32=vd(bp,bc);let bd_b:f32=vd(bp,bd);let ab_b:f32=vd(bp,ab);
 if(bc_b<=0.0&&bd_b<=0.0&&ab_b>=0.0){return Projection(b,0,1,zero());}
 let cd:V=vs(d,c);let cp:V=vs(zero(),c);let ac_c:f32=vd(cp,ac);let bc_c:f32=vd(cp,bc);let cd_c:f32=vd(cp,cd);
 if(cd_c<=0.0&&bc_c>=0.0&&ac_c>=0.0){return Projection(c,0,2,zero());}
 let dp:V=vs(zero(),d);let cd_d:f32=vd(dp,cd);let bd_d:f32=vd(dp,bd);let ad_d:f32=vd(dp,ad);if(ad_d>=0.0&&bd_d>=0.0&&cd_d>=0.0){return Projection(d,0,3,zero());}
 let nabc:V=vc(ab,ac);let nabd:V=vc(ab,ad);let nacd:V=vc(ac,ad);let nbcd:V=vc(bc,bd);
 var p:Projection=tet_edge(0,a,nabc,nabd,ap,ab,aa,ab_b);if(p.kind>=0){return p;}p=tet_edge(1,a,nacd,vn(nabc),ap,ac,ca,ac_c);if(p.kind>=0){return p;}p=tet_edge(2,a,vn(nabd),vn(nacd),ap,ad,da,ad_d);if(p.kind>=0){return p;}p=tet_edge(3,b,nabc,nbcd,bp,bc,bc_b,bc_c);if(p.kind>=0){return p;}p=tet_edge(4,b,vn(nbcd),nabd,bp,bd,bd_b,bd_d);if(p.kind>=0){return p;}p=tet_edge(5,c,nacd,nbcd,cp,cd,cd_c,cd_d);if(p.kind>=0){return p;}
 p=tet_face(0,a,b,c,ap,bp,cp,ab,ac,ad,sget(96),sget(102),sget(99));if(p.kind>=0){return p;}p=tet_face(1,a,b,d,ap,bp,dp,ab,ad,ac,sget(100),sget(97),sget(105));if(p.kind>=0){return p;}p=tet_face(2,a,c,d,ap,cp,dp,ac,ad,ab,sget(98),sget(106),sget(101));if(p.kind>=0){return p;}p=tet_face(3,b,c,d,bp,cp,dp,bc,bd,vn(ab),sget(103),sget(107),sget(104));if(p.kind>=0){return p;}return Projection(zero(),3,0,zero());
}
fn reduce_simplex()->V{
 let dim:i32=i32(sget(1));if(dim==0){sset(56,1.0);return simplex_vertex(0).point;}
 var p:Projection=Projection(zero(),-1,0,zero());if(dim==1){p=segment(simplex_vertex(0).point,simplex_vertex(1).point);}else if(dim==2){p=triangle(simplex_vertex(0).point,simplex_vertex(1).point,simplex_vertex(2).point);}else{p=tetra(simplex_vertex(0).point,simplex_vertex(1).point,simplex_vertex(2).point,simplex_vertex(3).point);}
 if(p.kind==0){swap_vertex(0,p.index);sset(56,1.0);sset(1,0.0);}
 else if(p.kind==1){
  var w0:f32=p.weights.x;var w1:f32=p.weights.y;
  if(dim==2){if(p.index==1){swap_vertex(0,2);w0=p.weights.z;w1=p.weights.y;}else if(p.index==2){swap_vertex(1,2);w1=p.weights.z;}}
  if(dim==3){if(p.index==1){swap_vertex(1,2);}else if(p.index==2){swap_vertex(1,3);}else if(p.index==3){swap_vertex(0,2);w0=p.weights.y;w1=p.weights.x;}else if(p.index==4){swap_vertex(0,3);w0=p.weights.y;w1=p.weights.x;}else if(p.index==5){swap_vertex(0,2);swap_vertex(1,3);}}
  sset(56,w0);sset(57,w1);sset(1,1.0);
 }else if(p.kind==2){var w:V=p.weights;if(dim==3){if(p.index==1){put_vertex(2,simplex_vertex(3));}else if(p.index==2){put_vertex(1,simplex_vertex(3));w=v3(w.x,w.z,w.y);}else if(p.index==3){put_vertex(0,simplex_vertex(3));w=v3(w.z,w.x,w.y);}}setv(56,w);sset(1,2.0);}
 return p.point;
}
fn add_vertex(p:Cso)->bool{let dim:i32=i32(sget(1));sset(2,f32(dim));for(var i:i32=0;i<4;i=i+1){sset(60+i,f32(i));sset(64+i,sget(56+i));}let a:V=simplex_vertex(0).point;let ab:V=vs(simplex_vertex(1).point,a);let ac:V=vs(p.point,a);let eps:f32=0.0000011920928955078125;
 if(dim==0){let d:V=vs(a,p.point);if(vd(d,d)<eps){return false;}}else if(dim==1){let cr:V=vc(ab,ac);if(vd(cr,cr)<eps){return false;}}else if(dim==2){let n:V=unit(vc(ab,vs(simplex_vertex(2).point,a)));if(absf(vd(n,ac))<eps){return false;}}else{sset(0,-3.0);return false;}sset(1,f32(dim+1));put_vertex(dim+1,p);return true;}
fn result(prev:bool,dir:V){var p1:V=zero();var p2:V=zero();var dim:i32=i32(sget(1));if(prev){dim=i32(sget(2));}for(var i:i32=0;i<=dim;i=i+1){var index:i32=i;var w:f32=sget(56+i);if(prev){index=i32(sget(60+i));w=sget(64+i);}let pt:Cso=simplex_vertex(index);p1=va(p1,vm(pt.orig1,w));p2=va(p2,vm(pt.orig2,w));}setv(14,p1);setv(84,p2);setv(88,dir);sset(0,3.0);}
fn init(){
 let qa:V=vn(iv(3));let aw:f32=iget(6);let qb:V=iv(13);let bw:f32=iget(16);
 setv(17,rotate(vs(iv(10),iv(0)),qa,aw));
 let qx:f32=subf(addf(addf(mulf(aw,qb.x),mulf(qa.x,bw)),mulf(qa.y,qb.z)),mulf(qa.z,qb.y));
 let qy:f32=addf(addf(subf(mulf(aw,qb.y),mulf(qa.x,qb.z)),mulf(qa.y,bw)),mulf(qa.z,qb.x));
 let qz:f32=addf(subf(addf(mulf(aw,qb.z),mulf(qa.x,qb.y)),mulf(qa.y,qb.x)),mulf(qa.z,bw));
 setv(68,v3(qx,qy,qz));sset(71,subf(subf(subf(mulf(aw,bw),mulf(qa.x,qb.x)),mulf(qa.y,qb.y)),mulf(qa.z,qb.z)));
 var dir:V=try_unit(getv(17));if(vd(dir,dir)==0.0){dir=v3(1.0,0.0,0.0);}put_vertex(0,support(dir));sset(1,0.0);sset(2,0.0);for(var i:i32=0;i<4;i=i+1){sset(60+i,f32(i));}let proj:V=reduce_simplex();setv(8,proj);let pd:V=try_unit(proj);if(vd(pd,pd)==0.0){sset(0,2.0);return;}setv(11,vn(pd));sset(3,3.4028234663852886e38);sset(4,-3.4028234663852886e38);sset(5,0.0);sset(6,0.0);sset(7,0.0);sset(0,0.0);
}
fn gjk_step(){if(sget(0)!=0.0){return;}let eps:f32=0.0000011920928955078125;let rel:f32=sqrtf(eps);let oldmax:f32=sget(3);let np:V=vn(getv(8));var dist:f32=len(np);var dir:V=try_unit(np);if(vd(dir,dir)==0.0){dist=0.0;}if(dist<=eps){sset(0,2.0);return;}sset(3,dist);
 if(dist>=oldmax){if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(true,getv(11));return;}if(sget(6)<6.0){let seed:i32=i32(sget(6));sset(6,f32(seed+1));let axis:i32=seed%3;var sign:f32=1.0;if(seed>=3){sign=-1.0;}var bumped:V=v3(dir.x,dir.y,dir.z);if(axis==0){bumped.x=addf(bumped.x,mulf(sign,0.01));}else if(axis==1){bumped.y=addf(bumped.y,mulf(sign,0.01));}else{bumped.z=addf(bumped.z,mulf(sign,0.01));}let next:V=try_unit(bumped);if(vd(next,next)>0.0){dir=next;}}else{sset(0,2.0);return;}}
 let pt:Cso=support(dir);let min_bound:f32=-vd(dir,pt.point);sset(4,maxf(sget(4),min_bound));sset(5,maxf(sget(5),len(pt.point)));if(min_bound>iget(22)){setv(88,dir);sset(0,4.0);return;}if(subf(dist,min_bound)<=mulf(rel,dist)){result(false,dir);return;}
 if(!add_vertex(pt)){if(sget(0)<0.0){return;}if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(false,dir);return;}if(sget(6)<6.0){return;}sset(0,2.0);return;}
 setv(11,dir);setv(8,reduce_simplex());if(sget(1)==3.0){if(min_bound>=eps){result(true,dir);}else{sset(0,2.0);}return;}sset(7,addf(sget(7),1.0));if(sget(7)==100.0){setv(88,v3(1.0,0.0,0.0));sset(0,4.0);}
}
fn finish(){if(sget(0)==0.0||sget(0)==2.0){oset(0,-1.0);return;}if(sget(0)<0.0){oset(0,sget(0));return;}if(sget(0)==4.0){oset(0,0.0);return;}let n1:V=getv(88);let p1:V=getv(14);let p2:V=rotate(vs(getv(84),getv(17)),vn(getv(68)),sget(71));let n2:V=rotate(vn(n1),vn(getv(68)),sget(71));oset(0,1.0);oset(1,vd(vs(getv(84),p1),n1));ov(2,va(rotate(p1,iv(3),iget(6)),iv(0)));ov(5,va(rotate(p2,iv(13),iget(16)),iv(10)));ov(8,rotate(n1,iv(3),iget(6)));ov(11,rotate(n2,iv(13),iget(16)));}
`+EPA.EPA_CORE;
// PolygonalFeatureMap and PolygonalFeature::contacts_face_face, Parry 0.31.1.
// The source cylinder cap patch is an oriented square; analytic GJK/EPA above
// remains a continuous cylinder. No cached manifold enters this fresh-only API.
const MANIFOLD_CORE=String.raw`
fn fi(which:i32)->i32{return 13632+which*40;}
fn fv(which:i32,i:i32)->V{return getv(fi(which)+i*3);}
fn fp(which:i32,i:i32)->V{return v3(sget(fi(which)+12+i*2),sget(fi(which)+13+i*2),0.0);}
fn v2(x:f32,y:f32)->V{return v3(x,y,0.0);}
fn dot2(a:V,b:V)->f32{return addf(mulf(a.x,b.x),mulf(a.y,b.y));}
fn perp(a:V,b:V)->f32{return subf(mulf(a.x,b.y),mulf(a.y,b.x));}
fn azimuth(dir:V,hint:V)->V{
 let h:V=v2(hint.x,hint.z);let len:f32=sqrtf(dot2(h,h));
 if(len>0.0){return vm(h,divf(1.0,len));}
 let d:V=v2(dir.x,dir.z);let dl:f32=sqrtf(dot2(d,d));
 if(dl>0.0){return vm(d,divf(1.0,dl));}return v2(1.0,0.0);
}
fn support_feature(which:i32,dir:V,hint:V){
 let base:i32=fi(which);for(var i:i32=0;i<40;i=i+1){sset(base+i,0.0);}
 let dim:V=iv(which*10+7);
 if(iget(20+which)==0.0){
  let d:V=azimuth(dir,hint);let r:f32=dim.y;let h:f32=dim.x;
  if(absf(dir.y)<0.5){
   setv(base,v3(mulf(d.x,r),-h,mulf(d.y,r)));setv(base+3,v3(mulf(d.x,r),h,mulf(d.y,r)));
   sset(base+20,1.0);sset(base+21,11.0);sset(base+22,11.0);sset(base+23,11.0);sset(base+28,0.0);sset(base+29,2.0);
  }else{
   let y:f32=signcopy(dir.y,h);setv(base,v3(mulf(d.x,r),y,mulf(d.y,r)));setv(base+3,v3(mulf(-d.y,r),y,mulf(d.x,r)));setv(base+6,v3(mulf(-d.x,r),y,mulf(-d.y,r)));setv(base+9,v3(mulf(d.y,r),y,mulf(-d.x,r)));
   var offset:i32=0;if(dir.y>=0.0){offset=10;}
   for(var i:i32=0;i<4;i=i+1){sset(base+20+i,f32(offset+1+2*i));sset(base+24+i,f32(offset+2+2*i));}sset(base+28,f32(offset+9));sset(base+29,4.0);
  }
 }else if(iget(20+which)==2.0){
  let hb:i32=200+which*772;let count:i32=i32(hget(hb));var face:i32=0;var best:f32=vd(v3(hget(hb+4),hget(hb+5),hget(hb+6)),dir);
  for(var j:i32=1;j<count;j=j+1){let at:i32=hb+4+j*12;let score:f32=vd(v3(hget(at),hget(at+1),hget(at+2)),dir);if(score>best){best=score;face=j;}}
  let fb:i32=hb+4+face*12;let n:i32=i32(hget(fb+3));for(var j:i32=0;j<n;j=j+1){let vid:i32=i32(hget(fb+4+j*2));let point:i32=which*100+1+vid*3;setv(base+j*3,v3(hget(point),hget(point+1),hget(point+2)));sset(base+20+j,f32(vid));sset(base+24+j,hget(fb+5+j*2));}sset(base+28,f32(face));sset(base+29,f32(n));
 }else{
  var axis:i32=0;var maxval:f32=absf(dir.x);if(absf(dir.y)>maxval){axis=1;maxval=absf(dir.y);}if(absf(dir.z)>maxval){axis=2;}
  var direction:f32=dir.x;if(axis==1){direction=dir.y;}else if(axis==2){direction=dir.z;}let sign:f32=signcopy(direction,1.0);let si:i32=i32(divf(addf(sign,1.0),2.0));
  if(axis==0){
   let x:f32=mulf(dim.x,sign);setv(base,v3(x,dim.y,dim.z));setv(base+3,v3(x,-dim.y,dim.z));setv(base+6,v3(x,-dim.y,-dim.z));setv(base+9,v3(x,dim.y,-dim.z));
   sset(base+20,f32(2*(0+si*4)));sset(base+21,f32(2*(2+si*4)));sset(base+22,f32(2*(3+si*4)));sset(base+23,f32(2*(1+si*4)));
   let sb:i32=si*36;sset(base+24,f32(208+sb));sset(base+25,f32(218+sb));sset(base+26,f32(217+sb));sset(base+27,f32(200+sb));
  }else if(axis==1){
   let y:f32=mulf(dim.y,sign);setv(base,v3(dim.x,y,dim.z));setv(base+3,v3(-dim.x,y,dim.z));setv(base+6,v3(-dim.x,y,-dim.z));setv(base+9,v3(dim.x,y,-dim.z));
   sset(base+20,f32(2*(0+si*2)));sset(base+21,f32(2*(4+si*2)));sset(base+22,f32(2*(5+si*2)));sset(base+23,f32(2*(1+si*2)));
   let sb:i32=si*18;sset(base+24,f32(224+sb));sset(base+25,f32(236+sb));sset(base+26,f32(233+sb));sset(base+27,f32(200+sb));
  }else{
   let z:f32=mulf(dim.z,sign);setv(base,v3(dim.x,dim.y,z));setv(base+3,v3(dim.x,-dim.y,z));setv(base+6,v3(-dim.x,-dim.y,z));setv(base+9,v3(-dim.x,dim.y,z));
   sset(base+20,f32(2*(0+si)));sset(base+21,f32(2*(2+si)));sset(base+22,f32(2*(6+si)));sset(base+23,f32(2*(4+si)));
   let sb:i32=si*9;sset(base+24,f32(208+sb));sset(base+25,f32(242+sb));sset(base+26,f32(244+sb));sset(base+27,f32(224+sb));
  }sset(base+28,f32(axis+si*3+10));sset(base+29,4.0);
 }
}
fn pos12(p:V)->V{return va(rotate(p,getv(68),sget(71)),getv(17));}
fn inv12(p:V)->V{return rotate(vs(p,getv(17)),vn(getv(68)),sget(71));}
fn transformed2(i:i32)->V{return getv(13712+i*3);}
fn append_point(p1:V,p2:V,dist:f32,t1:i32,c1:f32,t2:i32,c2:f32){
 let n:i32=i32(sget(13730));if(n>=25){oset(0,-4.0);sset(13731,-4.0);return;}
 let base:i32=16+n*20;oset(base,dist);ov(base+1,p1);ov(base+4,p2);ov(base+7,va(rotate(p1,iv(3),iget(6)),iv(0)));ov(base+10,va(rotate(p2,iv(13),iget(16)),iv(10)));oset(base+13,f32(t1));oset(base+14,c1);oset(base+15,f32(t2));oset(base+16,c2);sset(13730,f32(n+1));
}
fn inside(which:i32,n:i32,p:V)->bool{
 let last:i32=n-1;var sign:f32=perp(vs(fp(which,0),fp(which,last)),vs(p,fp(which,last)));
 for(var j:i32=0;j<last;j=j+1){let next:f32=perp(vs(fp(which,j+1),fp(which,j)),vs(p,fp(which,j)));if(sign==0.0){sign=next;}else if(mulf(sign,next)<0.0){return false;}}return true;
}
// Return (s,t,has_intersection), preserving the source epsilon and four-ULP test.
fn line2d(a1:V,b1:V,a2:V,b2:V)->V{
 let d1:V=vs(b1,a1);let d2:V=vs(b2,a2);let r:V=vs(a1,a2);let a:f32=dot2(d1,d1);let e:f32=dot2(d2,d2);let f:f32=dot2(d2,r);let eps:f32=0.00000011920928955078125;
 if(a<=eps&&e<=eps){return v3(0.0,0.0,1.0);}if(a<=eps){return v3(0.0,divf(f,e),1.0);}
 let c:f32=dot2(d1,r);if(e<=eps){return v3(divf(-c,a),0.0,1.0);}let b:f32=dot2(d1,d2);let ae:f32=mulf(a,e);let bb:f32=mulf(b,b);let denom:f32=subf(ae,bb);
 if(denom<=eps||ulpsnear(ae,bb)){return zero();}let s:f32=divf(subf(mulf(b,f),mulf(c,e)),denom);return v3(s,divf(addf(mulf(b,s),f),e),1.0);
}
fn clip_faces(n1:V){
 let sign:f32=signcopy(n1.z,1.0);let a:f32=divf(-1.0,addf(sign,n1.z));let b:f32=mulf(mulf(n1.x,n1.y),a);
 let b0:V=v3(addf(1.0,mulf(mulf(mulf(sign,n1.x),n1.x),a)),mulf(sign,b),mulf(-sign,n1.x));let b1:V=v3(b,addf(sign,mulf(mulf(n1.y,n1.y),a)),-n1.y);
 for(var i:i32=0;i<4;i=i+1){let p1:V=fv(0,i);let p2:V=pos12(fv(1,i));setv(13712+i*3,p2);sset(fi(0)+12+i*2,vd(p1,b0));sset(fi(0)+13+i*2,vd(p1,b1));sset(fi(1)+12+i*2,vd(p2,b0));sset(fi(1)+13+i*2,vd(p2,b1));}
 let count1:i32=i32(sget(fi(0)+29));let count2:i32=i32(sget(fi(1)+29));let eps:f32=0.00000011920928955078125;
 if(count2>2){let normal2:V=vc(vs(transformed2(2),transformed2(1)),vs(transformed2(0),transformed2(1)));let denom:f32=vd(normal2,n1);
  if(absf(denom)>eps){for(var i:i32=0;i<count1;i=i+1){if(inside(1,count2,fp(0,i))){let p1:V=fv(0,i);let dist:f32=divf(vd(vs(transformed2(0),p1),normal2),denom);append_point(p1,inv12(va(p1,vm(n1,dist))),dist,1,sget(fi(0)+20+i),3,sget(fi(1)+28));}}}
 }
 if(count1>2){let normal1:V=vc(vs(fv(0,2),fv(0,1)),vs(fv(0,0),fv(0,1)));let denom:f32=-vd(normal1,n1);
  if(absf(denom)>eps){for(var i:i32=0;i<count2;i=i+1){if(inside(0,count1,fp(1,i))){let p2:V=transformed2(i);let dist:f32=divf(vd(vs(fv(0,0),p2),normal1),denom);append_point(vs(p2,vm(n1,dist)),inv12(p2),dist,3,sget(fi(0)+28),1,sget(fi(1)+20+i));}}}
 }
 for(var j:i32=0;j<count2;j=j+1){let next2:i32=(j+1)%count2;for(var i:i32=0;i<count1;i=i+1){let next1:i32=(i+1)%count1;let bc:V=line2d(fp(0,i),fp(0,next1),fp(1,j),fp(1,next2));
  if(bc.z!=0.0&&bc.x>0.0&&bc.x<1.0&&bc.y>0.0&&bc.y<1.0){let p1:V=va(vm(fv(0,i),subf(1.0,bc.x)),vm(fv(0,next1),bc.x));let p2:V=va(vm(transformed2(j),subf(1.0,bc.y)),vm(transformed2(next2),bc.y));append_point(p1,inv12(p2),vd(vs(p2,p1),n1),2,sget(fi(0)+24+i),2,sget(fi(1)+24+j));}
 }}
}
fn manifold_finish(){
 sset(13730,0.0);sset(13731,0.0);if(sget(0)==0.0||sget(0)==2.0){sset(0,-1.0);}if(sget(0)<0.0){oset(0,sget(0));return;}if(sget(0)==4.0){oset(0,0.0);oset(1,0.0);ov(2,getv(88));return;}
 let n1:V=getv(88);let n2:V=rotate(vn(n1),vn(getv(68)),sget(71));let p1:V=getv(14);let p2:V=inv12(getv(84));support_feature(0,n1,p1);support_feature(1,n2,p2);clip_faces(n1);
 append_point(p1,p2,vd(vs(getv(84),p1),n1),0,0.0,0,0.0);if(sget(13731)<0.0){return;}oset(0,1.0);oset(1,sget(13730));ov(2,n1);ov(5,n2);ov(8,rotate(n1,iv(3),iget(6)));ov(11,rotate(n2,iv(13),iget(16)));
}
`;
const CORE=QUERY_CORE+MANIFOLD_CORE;
function eraseTypes(code){return code.replace(/\bfn\s+/g,'function ').replace(/\s*->\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'').replace(/:\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'');}
let factory;
function interpreter(state,input,output,hulls){if(!factory)factory=new Function(...Object.keys(JS_PRIMITIVES),'sget','sset','iget','oset','hget',eraseTypes(CORE)+';return {init,gjk_step,epa,manifold_finish}');return factory(...Object.values(JS_PRIMITIVES),i=>state[i],(i,v)=>{state[i]=v;},i=>input[i],(i,v)=>{output[i]=v;},i=>hulls[i]);}
function functionsByName(source){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(source))){const start=m.index,open=source.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unbalanced shared core');result.set(m[1],source.slice(start,end));re.lastIndex=end;}return result;}
function generateWGSL(stage='finish'){
 const entries={init:'init',gjk:'gjk_step',epa:'epa',finish:'manifold_finish'},target=entries[stage];if(!target)throw RangeError('Unknown query stage');const funcs=functionsByName(CORE),used=new Set(),visit=name=>{if(used.has(name)||!funcs.has(name))return;used.add(name);for(const m of funcs.get(name).matchAll(/\b(\w+)\s*\(/g))if(m[1]!==name)visit(m[1]);};visit(target);
 return `alias V=vec3<f32>;
struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};
@group(0) @binding(0) var<storage,read> inputs:array<f32>;
@group(0) @binding(1) var<storage,read_write> states:array<f32>;
@group(0) @binding(2) var<storage,read_write> outputs:array<f32>;
@group(0) @binding(3) var<storage,read> hulls:array<f32>;
var<private> query_id:i32;
fn sget(i:i32)->f32{return states[query_id*${STATE_FLOATS}+i];}fn sset(i:i32,x:f32){states[query_id*${STATE_FLOATS}+i]=x;}
fn iget(i:i32)->f32{return inputs[query_id*24+i];}fn oset(i:i32,x:f32){outputs[query_id*${OUTPUT_FLOATS}+i]=x;}fn hget(i:i32)->f32{return hulls[query_id*${HULL_FLOATS}+i];}
fn addf(a:f32,b:f32)->f32{return a+b;}fn subf(a:f32,b:f32)->f32{return a-b;}fn mulf(a:f32,b:f32)->f32{return a*b;}fn divf(a:f32,b:f32)->f32{return a/b;}fn sqrtf(a:f32)->f32{return sqrt(a);}fn absf(a:f32)->f32{return abs(a);}fn minf(a:f32,b:f32)->f32{return min(a,b);}fn maxf(a:f32,b:f32)->f32{return max(a,b);}fn finitef(a:f32)->bool{return (bitcast<u32>(a)&0x7f800000u)!=0x7f800000u;}
fn ulpsnear(a:f32,b:f32)->bool {let x=bitcast<u32>(a);let y=bitcast<u32>(b);return max(x,y)-min(x,y)<=4u;}
fn signcopy(sign:f32,mag:f32)->f32{return bitcast<f32>((bitcast<u32>(sign)&0x80000000u)|(bitcast<u32>(mag)&0x7fffffffu));}
fn v3(x:f32,y:f32,z:f32)->V{return V(x,y,z);}
`+[...funcs].filter(([name])=>used.has(name)).map(([,body])=>body).join('\n')+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){query_id=i32(gid.x);${target}();}`;
}
function packManifold(pair){
 if(pair?.fresh!==true)throw new RangeError('Explicit fresh:true provenance is required; empty points do not establish freshness');
 for(const k of['previousManifold','cachedNormal','local_n1','local_n2','points','warmstart','normalConstraints','borderRadius'])if(Object.hasOwn(pair,k))throw new RangeError('Persistent state, normal constraints and rounded shapes are unsupported: '+k);
 if(!((pair.shape1?.type==='cylinder'&&['box','convex'].includes(pair.shape2?.type))||(['box','convex'].includes(pair.shape1?.type)&&pair.shape2?.type==='cylinder')))throw new RangeError('Fresh manifold requires one analytic cylinder and one cuboid or admitted original native convex topology');
 for(const s of[pair.shape1,pair.shape2])for(const k of['borderRadius','normalConstraints'])if(Object.hasOwn(s,k))throw new RangeError('Unsupported shape feature: '+k);
 const packed=Query.packQuery(pair),hulls=new Float32Array(HULL_FLOATS);hulls.set(packed.hulls);
 for(let which=0;which<2;which++){const shape=pair['shape'+(which+1)];if(shape.type!=='convex')continue;const t=Topology.assertNativeHull(shape.nativeTopology);if(shape.points.length!==t.points.length||shape.points.some((p,i)=>p.length!==3||p.some((x,j)=>!Object.is(F(x),t.points[i][j]))))throw new RangeError('Support points do not match admitted original topology');const base=200+which*772;hulls[base]=t.faces.length;for(let i=0;i<t.faces.length;i++){const face=t.faces[i],at=base+4+i*12,n=Math.min(face.count,4);hulls.set(face.normal,at);hulls[at+3]=n;for(let j=0;j<n;j++){hulls[at+4+j*2]=t.verticesAdjToFace[face.first+j];hulls[at+5+j*2]=t.edgesAdjToFace[face.first+j];}}}
 return{input:packed.input,hulls};
}
function decode(raw,offset=0){
 const status=raw[offset];if(status<0)throw new RangeError('Cue-obstacle fresh manifold failed closed: '+({[-1]:'GJK iteration/dispatch bound',[-2]:'EPA workspace/iteration bound',[-3]:'invalid simplex state',[-4]:'clipping point capacity'}[status]??'invalid state'));
 if(status!==0&&status!==1)throw new RangeError('Invalid fresh manifold status');const count=raw[offset+1];if(!Number.isInteger(count)||count<0||count>25||(status===1&&count===0))throw new RangeError('Invalid fresh manifold point count');
 const v=i=>Array.from(raw.slice(offset+i,offset+i+3),x=>x===0?0:x),fid=(t,c)=>{if(!Number.isInteger(t)||t<0||t>3||!Number.isInteger(c)||c<0||c>=2**30)throw new RangeError('Invalid exact feature ID');return t*2**30+c;};
 return{localNormal1:v(2),localNormal2:v(5),normal1:v(8),normal2:v(11),points:Array.from({length:count},(_,i)=>{const b=16+i*20;return{distance:raw[offset+b],localPoint1:v(b+1),localPoint2:v(b+4),point1:v(b+7),point2:v(b+10),fid1:fid(raw[offset+b+13],raw[offset+b+14]),fid2:fid(raw[offset+b+15],raw[offset+b+16])};})};
}
function manifoldReference(pair){const{input,hulls}=packManifold(pair),state=new Float32Array(STATE_FLOATS),output=new Float32Array(OUTPUT_FLOATS),core=interpreter(state,input,output,hulls);core.init();for(let i=0;i<GJK_DISPATCHES;i++)core.gjk_step();core.epa();core.manifold_finish();if(output.some(x=>!Number.isFinite(x))||state.some(x=>!Number.isFinite(x)))throw new RangeError('Fresh manifold numeric overflow');return decode(output);}
async function createGpuManifolds(device){
 if(!device?.createShaderModule)throw TypeError('Actual GPUDevice required');const pipelines={};for(const stage of['init','gjk','epa','finish']){const code=generateWGSL(stage),shader=device.createShaderModule({code,label:'cue-obstacle fresh manifold '+stage}),info=await shader.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines[stage]=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});}
 let busy=false,disposed=false;return{async manifoldBatch(pairs){if(busy||disposed)throw Error('Cue-obstacle fresh manifold GPU query busy/disposed');if(!Array.isArray(pairs)||pairs.length<1||pairs.length>MAX_BATCH)throw RangeError('Bounded query batch required');busy=true;const owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};let scoped=false;try{device.pushErrorScope('validation');scoped=true;const n=pairs.length,input=new Float32Array(n*INPUT_FLOATS),hulls=new Float32Array(n*HULL_FLOATS);pairs.forEach((p,i)=>{const packed=packManifold(p);input.set(packed.input,i*INPUT_FLOATS);hulls.set(packed.hulls,i*HULL_FLOATS);});const buffers=[make(input.byteLength,136),make(n*STATE_FLOATS*4,128),make(n*OUTPUT_FLOATS*4,132),make(hulls.byteLength,136)],read=make(n*OUTPUT_FLOATS*4,9);device.queue.writeBuffer(buffers[0],0,input);device.queue.writeBuffer(buffers[3],0,hulls);const groups={};for(const stage of Object.keys(pipelines)){const layout=pipelines[stage].getBindGroupLayout(0);const indices=stage==='init'?[0,1,3]:stage==='gjk'||stage==='epa'?[0,1,3]:[0,1,2,3];groups[stage]=device.createBindGroup({layout,entries:indices.map(binding=>({binding,resource:{buffer:buffers[binding]}}))});}
 const e=device.createCommandEncoder();for(const stage of['init',...Array(GJK_DISPATCHES).fill('gjk'),'epa','finish']){const pass=e.beginComputePass();pass.setPipeline(pipelines[stage]);pass.setBindGroup(0,groups[stage]);pass.dispatchWorkgroups(n);pass.end();}e.copyBufferToBuffer(buffers[2],0,read,0,n*OUTPUT_FLOATS*4);device.queue.submit([e.finish()]);
// Close this device-global scope before yielding to another owner's operation.
const mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});scoped=false;const pendingScope=Promise.resolve(device.popErrorScope());pendingScope.catch(()=>{});await mapping;const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();const error=await pendingScope;if(error)throw Error(error.message);if(raw.some(x=>!Number.isFinite(x)))throw Error('GPU query non-finite output');return{backend:'webgpu',actualDispatches:GJK_DISPATCHES+3,contacts:pairs.map((_,i)=>decode(raw,i*OUTPUT_FLOATS)),raw};}finally{owned.forEach(b=>b.destroy());if(scoped)await device.popErrorScope();busy=false;}},dispose(){if(busy)throw Error('Query stage busy');disposed=true;}};
}
const api=Object.freeze({PARITY_SCOPE,PROVENANCE,MAX_BATCH,INPUT_FLOATS,OUTPUT_FLOATS,HULL_FLOATS,STATE_FLOATS,GJK_DISPATCHES,packManifold,manifoldReference,generateWGSL,createGpuManifolds,exportNativeHull:Topology.exportNativeHull});G.LabCueObstacleManifoldExperimental=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
