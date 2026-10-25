/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: bounded JS/WGSL query port.
 * Source-derived Parry3d 0.31.1 convex-polyhedron point projection.
 * Native-topology hull against ConstantOrigin; no world or CCD claim.
 * Quaternion operations derive from glam (MIT OR Apache-2.0).
 */
(function(G){'use strict';
const EPA=typeof module!=='undefined'&&module.exports?require('./experimental-cue-epa-core.js'):G.LabCueEpaCoreExperimental;
const T=typeof module!=='undefined'&&module.exports?require('./experimental-cue-convex-topology.js'):G.LabCueConvexTopologyExperimental;
const PARITY_SCOPE='experimental-native-convex-point-projection-only';
const PROVENANCE=Object.freeze({parry:'0.31.1',parryRevision:'3383f51cbbe9af70565427e7a66c605e1557c1fc',crateSha256:'7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e',rapier:'0.21.0',revision:'b716d375efc0201003f0cd9ef7168eee0b62c177'});
const MAX_BATCH=64,INPUT_FLOATS=24,OUTPUT_FLOATS=16,HULL_FLOATS=1156,STATE_FLOATS=13632,GJK_DISPATCHES=256;
const F=Math.fround;
const JS_PRIMITIVES={f32:F,i32:Math.trunc,addf:(a,b)=>F(a+b),subf:(a,b)=>F(a-b),mulf:(a,b)=>F(a*b),divf:(a,b)=>F(a/b),sqrtf:x=>F(Math.sqrt(x)),absf:Math.abs,minf:Math.min,maxf:Math.max,finitef:Number.isFinite,signcopy:(s,m)=>s<0||Object.is(s,-0)?-Math.abs(m):Math.abs(m),v3:(x,y,z)=>({x:F(x),y:F(y),z:F(z)}),Cso:(orig1,orig2,point)=>({orig1,orig2,point}),Projection:(point,kind,index,weights)=>({point,kind,index,weights})};
const CORE=String.raw`
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
fn support(dir:V)->Cso{let p1:V=local_support(0,dir);let p2:V=getv(17);return Cso(p1,p2,vs(p1,p2));}
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
 // point_support_map: seed uses Pose(point, identity); project_origin uses inverse(Pose(-point, identity)).
 let point:V=iv(10);var dir:V=try_unit(point);if(vd(dir,dir)==0.0){dir=v3(1.0,0.0,0.0);}
 let p1:V=local_support(0,dir);put_vertex(0,Cso(p1,point,vs(p1,point)));
 setv(17,rotate(point,zero(),1.0));setv(68,zero());sset(71,1.0);
 sset(1,0.0);sset(2,0.0);for(var i:i32=0;i<4;i=i+1){sset(60+i,f32(i));}
 let proj:V=reduce_simplex();setv(8,proj);let pd:V=try_unit(proj);if(vd(pd,pd)==0.0){sset(0,2.0);return;}
 setv(11,vn(pd));sset(3,3.4028234663852886e38);sset(4,-3.4028234663852886e38);sset(5,0.0);sset(6,0.0);sset(7,0.0);sset(0,0.0);
}
fn gjk_step(){if(sget(0)!=0.0){return;}let eps:f32=0.0000011920928955078125;let rel:f32=sqrtf(eps);let oldmax:f32=sget(3);let np:V=vn(getv(8));var dist:f32=len(np);var dir:V=try_unit(np);if(vd(dir,dir)==0.0){dist=0.0;}if(dist<=eps){sset(0,2.0);return;}sset(3,dist);
 if(dist>=oldmax){if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(true,getv(11));return;}if(sget(6)<6.0){let seed:i32=i32(sget(6));sset(6,f32(seed+1));let axis:i32=seed%3;var sign:f32=1.0;if(seed>=3){sign=-1.0;}var bumped:V=v3(dir.x,dir.y,dir.z);if(axis==0){bumped.x=addf(bumped.x,mulf(sign,0.01));}else if(axis==1){bumped.y=addf(bumped.y,mulf(sign,0.01));}else{bumped.z=addf(bumped.z,mulf(sign,0.01));}let next:V=try_unit(bumped);if(vd(next,next)>0.0){dir=next;}}else{sset(0,2.0);return;}}
 let pt:Cso=support(dir);let min_bound:f32=-vd(dir,pt.point);sset(4,maxf(sget(4),min_bound));sset(5,maxf(sget(5),len(pt.point)));if(min_bound>iget(22)){setv(88,dir);sset(0,4.0);return;}if(subf(dist,min_bound)<=mulf(rel,dist)){result(false,dir);return;}
 if(!add_vertex(pt)){if(sget(0)<0.0){return;}if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(false,dir);return;}if(sget(6)<6.0){return;}sset(0,2.0);return;}
 setv(11,dir);setv(8,reduce_simplex());if(sget(1)==3.0){if(min_bound>=eps){result(true,dir);}else{sset(0,2.0);}return;}sset(7,addf(sget(7),1.0));if(sget(7)==100.0){setv(88,v3(1.0,0.0,0.0));sset(0,4.0);}
}
// Native solid projection returns the input point on GJK containment, before EPA.
fn point_epa(){if(sget(0)==2.0){sset(110,1.0);if(iget(23)==1.0){setv(14,iv(10));sset(0,3.0);return;}epa();if(sget(0)==4.0){setv(14,iv(10));sset(0,3.0);}}}
fn feature(p:V,inside:f32){
 var dir:V=vs(iv(10),p);if(inside!=0.0){dir=vn(dir);}dir=try_unit(dir);
 if(vd(dir,dir)==0.0){oset(5,3.0);oset(6,0.0);return;}
 var id:i32=0;var best:f32=vd(v3(hget(1),hget(2),hget(3)),dir);
 for(var i:i32=1;i<i32(hget(0));i=i+1){let at:i32=1+i*3;let score:f32=vd(v3(hget(at),hget(at+1),hget(at+2)),dir);if(score>best){best=score;id=i;}}
 let first:i32=i32(hget(100+id*2));let count:i32=i32(hget(101+id*2));
 // libm 0.2.16 sin_cos of f32(PI/180), source ConvexPolyhedron::support_feature_id_toward.
 for(var i:i32=0;i<count;i=i+1){let fid:i32=i32(hget(644+first+i));let at:i32=164+fid*3;if(vd(v3(hget(at),hget(at+1),hget(at+2)),dir)>=0.9998477101325989){oset(5,2.0);oset(6,f32(fid));return;}}
 for(var i:i32=0;i<count;i=i+1){let eid:i32=i32(hget(900+first+i));let at:i32=356+eid*3;if(absf(vd(v3(hget(at),hget(at+1),hget(at+2)),dir))<=0.017452405765652657){oset(5,1.0);oset(6,f32(eid));return;}}
 oset(5,0.0);oset(6,f32(id));
}
fn finish(){if(sget(0)!=3.0){oset(0,-1.0);return;}oset(0,1.0);oset(1,sget(110));ov(2,getv(14));feature(getv(14),sget(110));}
`+EPA.EPA_CORE;
function eraseTypes(code){return code.replace(/\bfn\s+/g,'function ').replace(/\s*->\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'').replace(/:\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'');}
let factory;
function interpreter(state,input,output,hulls){if(!factory)factory=new Function(...Object.keys(JS_PRIMITIVES),'sget','sset','iget','oset','hget',eraseTypes(CORE)+';return {init,gjk_step,epa:point_epa,finish}');return factory(...Object.values(JS_PRIMITIVES),i=>state[i],(i,v)=>{state[i]=v;},i=>input[i],(i,v)=>{output[i]=v;},i=>hulls[i]);}
function finite(v,name){if(typeof v!=='number'||!Number.isFinite(F(v)))throw TypeError('Finite f32 '+name+' required');return F(v);}
function packQuery(item){
 if(!item||typeof item!=='object')throw TypeError('Native hull/point required');T.assertNativeHull(item.hull);
 if(item.solid!==undefined&&typeof item.solid!=='boolean')throw TypeError('solid must be boolean');
 if(!Array.isArray(item.point)||item.point.length!==3)throw RangeError('Three local point coordinates required');
 const input=new Float32Array(INPUT_FLOATS),hulls=new Float32Array(HULL_FLOATS),h=item.hull;
 input.set(item.point.map(x=>finite(x,'point')),10);input[6]=input[16]=1;input[20]=2;input[22]=Math.fround(3.4028234663852886e38);input[23]=item.solid===true?1:0;
 hulls[0]=h.points.length;h.points.forEach((p,i)=>hulls.set(p,1+i*3));
 h.vertices.forEach((v,i)=>hulls.set([v.first,v.num],100+i*2));h.faces.forEach((v,i)=>hulls.set(v.normal,164+i*3));h.edges.forEach((v,i)=>hulls.set(v.dir,356+i*3));
 hulls.set(h.facesAdjToVertex,644);hulls.set(h.edgesAdjToVertex,900);return{input,hulls};
}
function decode(raw,offset=0){if(raw[offset]!==1)throw RangeError('Convex point projection failed closed: '+raw[offset]);const kind=raw[offset+5],index=raw[offset+6];if(!Number.isInteger(kind)||kind<0||kind>3||!Number.isInteger(index)||index<0)throw Error('Invalid source feature');const headers=[0x40000000,0x80000000,0xc0000000,0];return{point:Array.from(raw.slice(offset+2,offset+5)),isInside:!!raw[offset+1],feature:{kind:['vertex','edge','face','unknown'][kind],index},packedFeature:(headers[kind]|index)>>>0};}
function queryReference(pair){const{input,hulls}=packQuery(pair),state=new Float32Array(STATE_FLOATS),output=new Float32Array(OUTPUT_FLOATS),core=interpreter(state,input,output,hulls);core.init();for(let i=0;i<GJK_DISPATCHES;i++)core.gjk_step();core.epa();core.finish();if(output.some(x=>!Number.isFinite(x))||state.some(x=>!Number.isFinite(x)))throw RangeError('Query numeric overflow');return decode(output);}
function diagnoseReference(pair){const{input,hulls}=packQuery(pair),state=new Float32Array(STATE_FLOATS),output=new Float32Array(OUTPUT_FLOATS),core=interpreter(state,input,output,hulls),trace=[];core.init();trace.push({stage:'init',state:Array.from(state.slice(0,112))});for(let i=0;i<GJK_DISPATCHES&&state[0]===0;i++){core.gjk_step();trace.push({stage:'gjk:'+i,state:Array.from(state.slice(0,112))});}core.epa();trace.push({stage:'epa',state:Array.from(state.slice(0,112))});core.finish();return{contact:decode(output),trace,state,output};}
function functionsByName(source){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(source))){const start=m.index,open=source.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unbalanced shared core');result.set(m[1],source.slice(start,end));re.lastIndex=end;}return result;}
function generateWGSL(stage='finish'){
 const entries={init:'init',gjk:'gjk_step',epa:'point_epa',finish:'finish'},target=entries[stage];if(!target)throw RangeError('Unknown query stage');const funcs=functionsByName(CORE),used=new Set(),visit=name=>{if(used.has(name)||!funcs.has(name))return;used.add(name);for(const m of funcs.get(name).matchAll(/\b(\w+)\s*\(/g))if(m[1]!==name)visit(m[1]);};visit(target);
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
fn signcopy(sign:f32,mag:f32)->f32{return bitcast<f32>((bitcast<u32>(sign)&0x80000000u)|(bitcast<u32>(mag)&0x7fffffffu));}
fn v3(x:f32,y:f32,z:f32)->V{return V(x,y,z);}
`+[...funcs].filter(([name])=>used.has(name)).map(([,body])=>body).join('\n')+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){query_id=i32(gid.x);${target}();}`;
}
async function createGpuQueries(device){
 if(!device?.createShaderModule)throw TypeError('Actual GPUDevice required');const pipelines={};for(const stage of['init','gjk','epa','finish']){const code=generateWGSL(stage),shader=device.createShaderModule({code,label:'convex point '+stage}),info=await shader.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipelines[stage]=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});}
 let busy=false,disposed=false;return{async queryBatch(pairs){if(busy||disposed)throw Error('Convex point GPU query busy/disposed');if(!Array.isArray(pairs)||pairs.length<1||pairs.length>MAX_BATCH)throw RangeError('Bounded query batch required');busy=true;const owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};let scoped=false;try{device.pushErrorScope('validation');scoped=true;const n=pairs.length,input=new Float32Array(n*INPUT_FLOATS),hulls=new Float32Array(n*HULL_FLOATS);pairs.forEach((p,i)=>{const packed=packQuery(p);input.set(packed.input,i*INPUT_FLOATS);hulls.set(packed.hulls,i*HULL_FLOATS);});const buffers=[make(input.byteLength,136),make(n*STATE_FLOATS*4,128),make(n*OUTPUT_FLOATS*4,132),make(hulls.byteLength,136)],read=make(n*OUTPUT_FLOATS*4,9);device.queue.writeBuffer(buffers[0],0,input);device.queue.writeBuffer(buffers[3],0,hulls);const groups={};for(const stage of Object.keys(pipelines)){const layout=pipelines[stage].getBindGroupLayout(0);const indices=stage==='init'?[0,1,3]:stage==='gjk'||stage==='epa'?[0,1,3]:[0,1,2,3];groups[stage]=device.createBindGroup({layout,entries:indices.map(binding=>({binding,resource:{buffer:buffers[binding]}}))});}
 const e=device.createCommandEncoder();for(const stage of['init',...Array(GJK_DISPATCHES).fill('gjk'),'epa','finish']){const pass=e.beginComputePass();pass.setPipeline(pipelines[stage]);pass.setBindGroup(0,groups[stage]);pass.dispatchWorkgroups(n);pass.end();}e.copyBufferToBuffer(buffers[2],0,read,0,n*OUTPUT_FLOATS*4);device.queue.submit([e.finish()]);
// Close this device-global scope before yielding to another owner's operation.
const mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});scoped=false;const pendingScope=Promise.resolve(device.popErrorScope());pendingScope.catch(()=>{});await mapping;const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();const error=await pendingScope;if(error)throw Error(error.message);if(raw.some(x=>!Number.isFinite(x)))throw Error('GPU query non-finite output');return{backend:'webgpu',actualDispatches:GJK_DISPATCHES+3,contacts:pairs.map((_,i)=>decode(raw,i*OUTPUT_FLOATS)),raw};}finally{owned.forEach(b=>b.destroy());if(scoped)await device.popErrorScope();busy=false;}},dispose(){if(busy)throw Error('Query stage busy');disposed=true;}};
}
const api=Object.freeze({PARITY_SCOPE,PROVENANCE,MAX_BATCH,INPUT_FLOATS,OUTPUT_FLOATS,HULL_FLOATS,STATE_FLOATS,GJK_DISPATCHES,packQuery,queryReference,diagnoseReference,generateWGSL,createGpuQueries});G.LabConvexPointExperimental=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
