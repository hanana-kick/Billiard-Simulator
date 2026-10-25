/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: empty convex/cylinder cache.
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177 pair_update.rs/contact_pair.rs;
 * Parry3d 0.31.1 contact_manifolds_pfm_pfm.rs, contact_support_map_support_map.rs,
 * gjk.rs and VoronoiSimplex. Quaternion arithmetic: glam 0.33.10 (MIT OR Apache-2.0).
 * See vendor/RAPIER-LICENSE.txt and THIRD_PARTY_NOTICES.txt.
 * The GJK source graph is the existing obstacle-contact port, specialized to
 * native hull-first empty separation and persistent initial direction. It does
 * not implement contacts/EPA or authorize a world transaction. The caller must
 * first run the current matching-backend branded rigid-exclusion guard.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports,load=(name,global)=>common?require('./'+name):G[global];
const Graph=load('experimental-arithmetic-graph','LabArithmeticGraphExperimental'),Runtime=load('experimental-stage-runtime','LabStageRuntimeExperimental'),Topology=load('experimental-cue-convex-topology','LabCueConvexTopologyExperimental');
const f=Math.fround,copy=x=>structuredClone(x),INPUT_FLOATS=56,QUERY_INPUT_FLOATS=28,STATE_FLOATS=116,QUERY_OUTPUT_FLOATS=8,GJK_DISPATCHES=256;
const CAPABILITY=Object.freeze({wholeWorld:false,contactSolver:false,separationProof:false,emptyConvexCylinderCache:true,nativeHullFirst:true,identityLocalRotationsOnly:true,shapeChanges:false,requiresCurrentSeparationProof:true,sharedF32Graph:true,persistentSeparatingNormal:true,strictSupportBoundOnly:true});
const brands=new WeakMap();
const CACHE_VECTORS={recycleTranslation:[25,3],recycleRelativeRotation:[28,4],recycleRotation1:[32,4],recycleRotation2:[36,4]};
const CACHE_SCALARS={maxExtent:40,maxDrift:41};
const requireThat=(ok,message)=>{if(!ok)throw RangeError(message);};
function keys(value,allowed,label){requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k)),'Unsupported '+label+' fields');}
function scalar(value,limit,label){requireThat(typeof value==='number'&&Number.isFinite(value)&&value===f(value)&&Math.abs(value)<=limit,'Bounded exact f32 '+label+' required');return value;}
function vector(value,n,limit,label){requireThat(Array.isArray(value)&&value.length===n,'Invalid '+label);value.forEach(x=>scalar(x,limit,label));return value;}
function rotation(value,label){vector(value,4,1.001,label);requireThat(Math.abs(value.reduce((s,x)=>s+x*x,0)-1)<2e-5,'Source unit quaternion required');}
function hullBinding(options){keys(options,['hull'],'native hull binding');Topology.assertNativeHull(options.hull);const h=options.hull;h.points.forEach(p=>vector(p,3,10,'native hull point'));return{hull:h,identity:h.snapshot.inputSha256+':'+h.handle.index+':'+h.handle.generation,mins:[0,1,2].map(i=>Math.min(...h.points.map(p=>p[i]))),maxs:[0,1,2].map(i=>Math.max(...h.points.map(p=>p[i])))};}
function validate(input){
 keys(input,['kind','separated','shapesChanged','convex','cylinder','contactRecycleDistance','predictionDistance','previous'],'empty convex-cache input');
 requireThat(input.kind==='separated-convex-cylinder-empty-cache'&&input.separated===true&&input.shapesChanged===false,'Current separated empty convex/cylinder pair with unchanged shapes required');
 for(const name of['convex','cylinder']){const body=input[name];keys(body,name==='convex'?['translation','rotation','localTranslation']:['radius','halfHeight','translation','rotation','localTranslation'],name);if(name==='cylinder'){scalar(body.radius,.02,'cylinder radius');scalar(body.halfHeight,1,'cylinder half height');requireThat(body.radius>0&&body.halfHeight>0,'Positive cylinder dimensions required');}vector(body.translation,3,10,name+' body translation');rotation(body.rotation,name+' body rotation');vector(body.localTranslation,3,2,name+' local translation');}
 scalar(input.contactRecycleDistance,.1,'contact recycle distance');scalar(input.predictionDistance,.01,'prediction distance');requireThat(input.contactRecycleDistance>0&&input.predictionDistance>=0,'Enabled positive recycling and nonnegative prediction required');
 requireThat(input.previous===null||(input.previous&&typeof input.previous==='object'),'Explicit previous cache or null required');
 if(input.previous!==null){const p=input.previous;keys(p,[...Object.keys(CACHE_VECTORS),...Object.keys(CACHE_SCALARS),'shapeDimensions','hullIdentity','localNormal1','localNormal2','worldNormal','lowerBound','recycled','drift','rotationCos','backend','actualDispatches'],'previous empty convex cache');vector(p.shapeDimensions,2,1,'previous dimensions');requireThat(p.shapeDimensions[0]===input.cylinder.radius&&p.shapeDimensions[1]===input.cylinder.halfHeight,'Shape changes unsupported');requireThat(typeof p.hullIdentity==='string','Previous hull identity required');for(const[k,[,n]]of Object.entries(CACHE_VECTORS))if(n===4)rotation(p[k],k);else vector(p[k],n,48,k);scalar(p.maxExtent,18,'previous extent');scalar(p.maxDrift,.1,'previous drift');requireThat(p.maxExtent>0&&p.maxDrift>=0,'Invalid previous cache bounds');vector(p.localNormal1,3,1.001,'previous local normal');vector(p.localNormal2,3,0,'previous empty local normal2');vector(p.worldNormal,3,1.001,'previous world normal');requireThat(Math.abs(p.localNormal1.reduce((s,x)=>s+x*x,0)-1)<2e-5,'Previous source unit separation normal required');scalar(p.lowerBound,40,'previous support bound');requireThat(p.lowerBound>0,'Positive previous support bound required');}
 return input;
}
function buildPlan(){
 const nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return INPUT_FLOATS+nodes.length-1;},c=x=>op('const',f(x)),z=c(0),one=c(1),two=c(2);
 const add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),neg=a=>op('negate',a),choose=(p,a,b)=>op('choose',p,a,b);
 const v=(i,n=3)=>Array.from({length:n},(_,j)=>i+j),va=(a,b)=>a.map((x,i)=>add(x,b[i])),vs=(a,b)=>a.map((x,i)=>sub(x,b[i])),vm=(a,s)=>a.map(x=>mul(x,s)),sel=(p,a,b)=>a.map((x,i)=>choose(p,x,b[i]));
 const dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),qdot=(a,b)=>add(add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),mul(a[3],b[3])),norm=a=>op('sqrt',dot(a,a));
 const cross=(a,b)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))];
 // Preserve scalar glam expression association, including identity products.
 const qm=(a,b)=>[sub(add(add(mul(a[3],b[0]),mul(a[0],b[3])),mul(a[1],b[2])),mul(a[2],b[1])),add(add(sub(mul(a[3],b[1]),mul(a[0],b[2])),mul(a[1],b[3])),mul(a[2],b[0])),add(sub(add(mul(a[3],b[2]),mul(a[0],b[1])),mul(a[1],b[0])),mul(a[2],b[3])),sub(sub(sub(mul(a[3],b[3]),mul(a[0],b[0])),mul(a[1],b[1])),mul(a[2],b[2]))];
 const inverse=q=>[...q.slice(0,3).map(neg),q[3]],rotate=(q,a)=>{const b=q.slice(0,3);return va(va(vm(a,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(a,b),two))),vm(cross(b,a),mul(q[3],two)));};
 // Collider pose = own current body pose * immutable local identity pose.
 const localIdentity=[z,z,z,one],q1=qm(v(3,4),localIdentity),q2=qm(v(14,4),localIdentity),p1=va(v(0),rotate(v(3,4),v(7))),p2=va(v(11),rotate(v(14,4),v(18)));
 const relative=rotate(inverse(q1),vs(p2,p1)),relativeRotation=qm(inverse(q1),q2),deltaRotation=qm(relativeRotation,inverse(v(28,4)));
 const drift=add(norm(vs(relative,v(25))),mul(mul(two,norm(deltaRotation.slice(0,3))),40));
 const cos1=qdot(v(32,4),q1),cos2=qdot(v(36,4),q2),rotationCos=op('min',sub(mul(mul(two,cos1),cos1),one),sub(mul(mul(two,cos2),cos2),one));
 const recycled=mul(42,mul(op('le',drift,41),op('gt',rotationCos,c(.98))));
 // Local AABB mins/maxs, NOT the radius and NOT a world/local-offset bound.
 // Cylinder support extents are [radius, half_height, radius]. Keep the same
 // (x*x + y*y) + z*z graph as source Vec3::length(), without reassociation.
 const convexExtent=op('max',norm(v(43)),norm(v(46)));
 const cylinderExtent=op('max',norm([neg(21),neg(22),neg(21)]),norm([21,22,21]));
 const extent=choose(42,40,op('max',convexExtent,cylinderExtent)),maxDrift=op('min',23,24);
 const fields={recycleTranslation:sel(recycled,v(25),relative),recycleRelativeRotation:sel(recycled,v(28,4),relativeRotation),recycleRotation1:sel(recycled,v(32,4),q1),recycleRotation2:sel(recycled,v(36,4),q2),maxExtent:[extent],maxDrift:[choose(recycled,41,maxDrift)],recycled:[recycled],drift:[choose(42,drift,z)],rotationCos:[choose(42,rotationCos,one)],colliderTranslation1:p1,colliderRotation1:q1,colliderTranslation2:p2,colliderRotation2:q2};
 const outputs=[],layout={};for(const[k,ids]of Object.entries(fields)){layout[k]={offset:outputs.length,length:ids.length};outputs.push(...ids);}return{inputFloats:INPUT_FLOATS,nodes,outputs,layout};
}
const PLAN=buildPlan();
function pack(input,binding){
 const a=new Float32Array(INPUT_FLOATS);for(const[body,base]of[[input.convex,0],[input.cylinder,11]]){a.set(body.translation,base);a.set(body.rotation,base+3);a.set(body.localTranslation,base+7);if(body.radius!==undefined)a[base+10]=body.radius;}
 a.set(binding.mins,43);a.set(binding.maxs,46);a[22]=input.cylinder.halfHeight;a[23]=input.contactRecycleDistance;a[24]=input.predictionDistance;
 // Safe finite default only initializes the graph's non-selected branch. It is
 // never returned as a cache. No saved source/frame values enter this program.
 if(input.previous){for(const[k,[index]]of Object.entries(CACHE_VECTORS))a.set(input.previous[k],index);for(const[k,index]of Object.entries(CACHE_SCALARS))a[index]=input.previous[k];a[42]=1;}
 else{a[31]=1;a[35]=1;a[39]=1;}
 return a;
}
function decode(raw,input,backend,binding){
 const result={};for(const[k,{offset,length}]of Object.entries(PLAN.layout))result[k]=length===1?raw[offset]:Array.from(raw.slice(offset,offset+length));
 requireThat(raw.every(Number.isFinite)&&(result.recycled===0||result.recycled===1),'Incomplete empty-cache arithmetic');
 result.recycled=!!result.recycled;result.shapeDimensions=[input.cylinder.radius,input.cylinder.halfHeight];result.hullIdentity=binding.identity;result.backend=backend;result.actualDispatches=backend==='webgpu'?1:0;return result;
}
const JS_PRIMITIVES={f32:f,i32:Math.trunc,addf:(a,b)=>f(a+b),subf:(a,b)=>f(a-b),mulf:(a,b)=>f(a*b),divf:(a,b)=>f(a/b),sqrtf:x=>f(Math.sqrt(x)),absf:Math.abs,minf:Math.min,maxf:Math.max,finitef:Number.isFinite,signcopy:(s,m)=>s<0||Object.is(s,-0)?-Math.abs(m):Math.abs(m),v3:(x,y,z)=>({x:f(x),y:f(y),z:f(z)}),Cso:(orig1,orig2,point)=>({orig1,orig2,point}),Projection:(point,kind,index,weights)=>({point,kind,index,weights})};
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
fn local_support(which:i32,dir:V)->V{if(which==1){let radial:V=vm(try_unit(v3(dir.x,0.0,dir.z)),iget(18));return v3(radial.x,signcopy(dir.y,iget(17)),radial.z);}let count:i32=i32(hget(0));var best:V=v3(hget(1),hget(2),hget(3));var score:f32=vd(best,dir);for(var i:i32=1;i<count;i=i+1){let at:i32=1+i*3;let p:V=v3(hget(at),hget(at+1),hget(at+2));let d:f32=vd(p,dir);if(d>score){score=d;best=p;}}return best;}
fn support(dir:V)->Cso{let p1:V=local_support(0,dir);let d2:V=rotate(vn(dir),vn(getv(68)),sget(71));let p2:V=va(rotate(local_support(1,d2),getv(68),sget(71)),getv(17));return Cso(p1,p2,vs(p1,p2));}
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
 sset(112,0.0);sset(113,0.0);
 let qa:V=vn(iv(3));let aw:f32=iget(6);let qb:V=iv(13);let bw:f32=iget(16);
 setv(17,rotate(vs(iv(10),iv(0)),qa,aw));
 let qx:f32=subf(addf(addf(mulf(aw,qb.x),mulf(qa.x,bw)),mulf(qa.y,qb.z)),mulf(qa.z,qb.y));
 let qy:f32=addf(addf(subf(mulf(aw,qb.y),mulf(qa.x,qb.z)),mulf(qa.y,bw)),mulf(qa.z,qb.x));
 let qz:f32=addf(subf(addf(mulf(aw,qb.z),mulf(qa.x,qb.y)),mulf(qa.y,qb.x)),mulf(qa.z,bw));
 setv(68,v3(qx,qy,qz));sset(71,subf(subf(subf(mulf(aw,bw),mulf(qa.x,qb.x)),mulf(qa.y,qb.y)),mulf(qa.z,qb.z)));
 var dir:V=try_unit(iv(24));if(vd(dir,dir)==0.0){dir=try_unit(getv(17));}if(vd(dir,dir)==0.0){dir=v3(1.0,0.0,0.0);}put_vertex(0,support(dir));sset(1,0.0);sset(2,0.0);for(var i:i32=0;i<4;i=i+1){sset(60+i,f32(i));}let proj:V=reduce_simplex();setv(8,proj);let pd:V=try_unit(proj);if(vd(pd,pd)==0.0){sset(0,2.0);return;}setv(11,vn(pd));sset(3,3.4028234663852886e38);sset(4,-3.4028234663852886e38);sset(5,0.0);sset(6,0.0);sset(7,0.0);sset(0,0.0);
}
fn gjk_step(){if(sget(0)!=0.0){return;}let eps:f32=0.0000011920928955078125;let rel:f32=sqrtf(eps);let oldmax:f32=sget(3);let np:V=vn(getv(8));var dist:f32=len(np);var dir:V=try_unit(np);if(vd(dir,dir)==0.0){dist=0.0;}if(dist<=eps){sset(0,2.0);return;}sset(3,dist);
 if(dist>=oldmax){if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(true,getv(11));return;}if(sget(6)<6.0){let seed:i32=i32(sget(6));sset(6,f32(seed+1));let axis:i32=seed%3;var sign:f32=1.0;if(seed>=3){sign=-1.0;}var bumped:V=v3(dir.x,dir.y,dir.z);if(axis==0){bumped.x=addf(bumped.x,mulf(sign,0.01));}else if(axis==1){bumped.y=addf(bumped.y,mulf(sign,0.01));}else{bumped.z=addf(bumped.z,mulf(sign,0.01));}let next:V=try_unit(bumped);if(vd(next,next)>0.0){dir=next;}}else{sset(0,2.0);return;}}
 let pt:Cso=support(dir);let min_bound:f32=-vd(dir,pt.point);sset(4,maxf(sget(4),min_bound));sset(5,maxf(sget(5),len(pt.point)));if(min_bound>iget(22)){sset(112,1.0);sset(113,min_bound);setv(88,dir);sset(0,4.0);return;}if(subf(dist,min_bound)<=mulf(rel,dist)){result(false,dir);return;}
 if(!add_vertex(pt)){if(sget(0)<0.0){return;}if(sget(4)>0.0||sget(4)>=mulf(-rel,sget(5))){result(false,dir);return;}if(sget(6)<6.0){return;}sset(0,2.0);return;}
 setv(11,dir);setv(8,reduce_simplex());if(sget(1)==3.0){if(min_bound>=eps){result(true,dir);}else{sset(0,2.0);}return;}sset(7,addf(sget(7),1.0));if(sget(7)==100.0){sset(112,2.0);sset(113,sget(7));setv(88,v3(1.0,0.0,0.0));sset(0,4.0);}
}
// Only the source strict support-lower-bound NoIntersection branch is admitted.
// Intersection, closest contacts, caps, and EPA fallbacks fail closed here.
fn finish(){oset(0,-1.0);if(sget(0)!=4.0||sget(112)!=1.0||sget(113)<=iget(22)){return;}let n:V=getv(88);oset(0,1.0);ov(1,n);ov(4,rotate(n,iv(3),iget(6)));oset(7,sget(113));}
`;
function eraseTypes(code){return code.replace(/\bfn\s+/g,'function ').replace(/\s*->\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'').replace(/:\s*(?:f32|i32|bool|V|Cso|Projection)\b/g,'');}
let factory;
function interpreter(state,input,output,hulls){if(!factory)factory=new Function(...Object.keys(JS_PRIMITIVES),'sget','sset','iget','oset','hget',eraseTypes(CORE)+';return {init,gjk_step,finish}');return factory(...Object.values(JS_PRIMITIVES),i=>state[i],(i,v)=>{state[i]=v;},i=>input[i],(i,v)=>{output[i]=v;},i=>hulls[i]);}
function queryInput(input,cache,binding){const a=new Float32Array(QUERY_INPUT_FLOATS),h=new Float32Array(100);for(const[base,n]of[[0,1],[10,2]]){a.set(cache['colliderTranslation'+n],base);a.set(cache['colliderRotation'+n],base+3);}a[17]=input.cylinder.halfHeight;a[18]=input.cylinder.radius;a[22]=input.predictionDistance;if(input.previous)a.set(input.previous.localNormal1,24);h[0]=binding.hull.points.length;binding.hull.points.forEach((p,i)=>h.set(p,1+i*3));return{input:a,hulls:h};}
function decodeQuery(raw,prediction){requireThat(raw.every(Number.isFinite)&&raw[0]===1&&raw[7]>prediction,'Empty convex cache requires strict source GJK support separation; contacts and unresolved GJK/EPA paths remain unsupported');return{localNormal1:Array.from(raw.slice(1,4)),localNormal2:[0,0,0],worldNormal:Array.from(raw.slice(4,7)),lowerBound:raw[7]};}
function queryReference(input,cache,binding){const p=queryInput(input,cache,binding),s=new Float32Array(STATE_FLOATS),o=new Float32Array(QUERY_OUTPUT_FLOATS),c=interpreter(s,p.input,o,p.hulls);c.init();for(let i=0;i<GJK_DISPATCHES&&s[0]===0;i++)c.gjk_step();c.finish();return decodeQuery(o,input.predictionDistance);}
function complete(cache,normal,dispatches){for(const k of['colliderTranslation1','colliderRotation1','colliderTranslation2','colliderRotation2'])delete cache[k];return Object.assign(cache,copy(normal),{actualDispatches:dispatches});}
// Rapier pair_update.rs returns OUTCOME_RECYCLED before the manifold data
// normal update: both local_n1 and the world-space normal stay frozen, even
// when a permitted small absolute rotation occurred. The source cos gate in
// PLAN bounds that rotation; do not re-rotate a recycled normal.
function previousNormal(input){const p=input.previous;return{localNormal1:p.localNormal1,localNormal2:p.localNormal2,worldNormal:p.worldNormal,lowerBound:p.lowerBound};}
function checked(input,binding){validate(input);if(input.previous)requireThat(input.previous.hullIdentity===binding.identity,'Previous cache belongs to a different native hull');return copy(input);}
function createReferenceStage(options){const binding=hullBinding(options);let disposed=false;const stage={capability:CAPABILITY,step(input){if(disposed)throw Error('Empty convex-cache stage disposed');const s=checked(input,binding),cache=decode(Graph.execute(pack(s,binding),PLAN),s,'cpu-reference',binding);return complete(cache,cache.recycled?previousNormal(s):queryReference(s,cache,binding),0);},dispose(){disposed=true;brands.delete(stage);}};brands.set(stage,{backend:'cpu-reference',hull:binding.hull});return stage;}
function functionsByName(source){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(source))){const start=m.index,open=source.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unbalanced shared GJK core');result.set(m[1],source.slice(start,end));re.lastIndex=end;}return result;}
function generateWGSL(stage){const target={init:'init',gjk:'gjk_step',finish:'finish'}[stage];if(!target)throw RangeError('Unknown empty-convex query stage');const funcs=functionsByName(CORE),used=new Set(),visit=name=>{if(used.has(name)||!funcs.has(name))return;used.add(name);for(const m of funcs.get(name).matchAll(/\b(\w+)\s*\(/g))if(m[1]!==name)visit(m[1]);};visit(target);return `alias V=vec3<f32>;
struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};
@group(0) @binding(0) var<storage,read> inputs:array<f32>;
@group(0) @binding(1) var<storage,read_write> states:array<f32>;
@group(0) @binding(2) var<storage,read_write> outputs:array<f32>;
@group(0) @binding(3) var<storage,read> hulls:array<f32>;
fn sget(i:i32)->f32{return states[i];}fn sset(i:i32,x:f32){states[i]=x;}
fn iget(i:i32)->f32{return inputs[i];}fn oset(i:i32,x:f32){outputs[i]=x;}fn hget(i:i32)->f32{return hulls[i];}
fn addf(a:f32,b:f32)->f32{return a+b;}fn subf(a:f32,b:f32)->f32{return a-b;}fn mulf(a:f32,b:f32)->f32{return a*b;}fn divf(a:f32,b:f32)->f32{return a/b;}fn sqrtf(a:f32)->f32{return sqrt(a);}fn absf(a:f32)->f32{return abs(a);}fn minf(a:f32,b:f32)->f32{return min(a,b);}fn maxf(a:f32,b:f32)->f32{return max(a,b);}fn finitef(a:f32)->bool{return (bitcast<u32>(a)&0x7f800000u)!=0x7f800000u;}
fn signcopy(sign:f32,mag:f32)->f32{return bitcast<f32>((bitcast<u32>(sign)&0x80000000u)|(bitcast<u32>(mag)&0x7fffffffu));}
fn v3(x:f32,y:f32,z:f32)->V{return V(x,y,z);}
`+[...funcs].filter(([name])=>used.has(name)).map(([,body])=>body).join('\n')+`\n@compute @workgroup_size(1) fn main(){${target}();}`;}
async function compile(device,code,label){const shader=device.createShaderModule({code,label}),info=await shader.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));return device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});}
// Only immutable compiled programs are shared. Hull data, arithmetic buffers,
// bindings, scratch, stage brands and busy/disposed state remain stage-owned.
// Key by the exact device (including a caller's scoped facade), never unwrap it.
const devicePipelineCaches=new WeakMap(),lostPipelineDevices=new WeakSet();
function cachedCompile(device,code,label){
 if(lostPipelineDevices.has(device))return Promise.reject(Error('Empty convex-cache GPUDevice lost'));
 let cache=devicePipelineCaches.get(device);
 if(!cache){
  cache=new Map();devicePipelineCaches.set(device,cache);
  if(device.lost?.then){const lost=()=>{lostPipelineDevices.add(device);cache.clear();if(devicePipelineCaches.get(device)===cache)devicePipelineCaches.delete(device);};Promise.resolve(device.lost).then(lost,lost);}
 }
 // The descriptor identity includes the exact shader bytes and module label.
 // layout:'auto' and entryPoint:'main' stay fixed in compile above.
 const key=label+'\0'+code;let promise=cache.get(key);
 if(!promise){
  promise=compile(device,code,label).then(pipeline=>{if(lostPipelineDevices.has(device))throw Error('Empty convex-cache GPUDevice lost');return pipeline;});
  cache.set(key,promise);
  // Do not retain a failed compilation or let its late rejection evict a retry.
  promise.catch(()=>{if(cache.get(key)===promise)cache.delete(key);});
 }
 return promise;
}
async function createGpuStage(device,options){
 if(!device?.createShaderModule)throw TypeError('Actual GPUDevice required');const binding=hullBinding(options),arithmetic=await cachedCompile(device,Runtime.shaderForInputFloats(INPUT_FLOATS),'empty convex cache recurrence'),pipelines={};for(const stage of['init','gjk','finish'])pipelines[stage]=await cachedCompile(device,generateWGSL(stage),'empty convex '+stage);
 const owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;},program=Graph.encode(PLAN),indices=Uint32Array.from(PLAN.outputs),pb=make(program.byteLength,136),ib=make(indices.byteLength,136);device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);let busy=false,disposed=false;
 async function computeCache(input){const temp=[],buf=(size,usage)=>{const b=device.createBuffer({size,usage});temp.push(b);return b;};let scoped=false;try{device.pushErrorScope('validation');scoped=true;const a=pack(input,binding),source=buf(a.byteLength,136),scratch=buf((INPUT_FLOATS+PLAN.nodes.length)*4,128),size=(PLAN.outputs.length+1)*4,out=buf(size,132),read=buf(size,9);device.queue.writeBuffer(source,0,a);const group=device.createBindGroup({layout:arithmetic.getBindGroupLayout(0),entries:[source,pb,scratch,ib,out].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(arithmetic);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);
// Close this device-global scope before yielding to another owner's operation.
const mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});scoped=false;const pendingScope=Promise.resolve(device.popErrorScope());pendingScope.catch(()=>{});await mapping;const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();const error=await pendingScope;if(error)throw Error(error.message);if(raw.at(-1)!==1||raw.some(x=>!Number.isFinite(x)))throw Error('Incomplete actual WGSL convex-cache recurrence');return decode(raw.subarray(0,-1),input,'webgpu',binding);}finally{temp.forEach(b=>b.destroy());if(scoped)await device.popErrorScope();}}
 async function computeNormal(input,cache){const temp=[],buf=(size,usage)=>{const b=device.createBuffer({size,usage});temp.push(b);return b;};let scoped=false;try{device.pushErrorScope('validation');scoped=true;const p=queryInput(input,cache,binding),buffers=[buf(p.input.byteLength,136),buf(STATE_FLOATS*4,128),buf(QUERY_OUTPUT_FLOATS*4,132),buf(p.hulls.byteLength,136)],read=buf(QUERY_OUTPUT_FLOATS*4,9);device.queue.writeBuffer(buffers[0],0,p.input);device.queue.writeBuffer(buffers[3],0,p.hulls);const groups={};for(const stage of Object.keys(pipelines)){const bindings=stage==='finish'?[0,1,2]:[0,1,3];groups[stage]=device.createBindGroup({layout:pipelines[stage].getBindGroupLayout(0),entries:bindings.map(binding=>({binding,resource:{buffer:buffers[binding]}}))});}const e=device.createCommandEncoder();for(const stage of['init',...Array(GJK_DISPATCHES).fill('gjk'),'finish']){const pass=e.beginComputePass();pass.setPipeline(pipelines[stage]);pass.setBindGroup(0,groups[stage]);pass.dispatchWorkgroups(1);pass.end();}e.copyBufferToBuffer(buffers[2],0,read,0,QUERY_OUTPUT_FLOATS*4);device.queue.submit([e.finish()]);
// Close this device-global scope before yielding to another owner's operation.
const mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});scoped=false;const pendingScope=Promise.resolve(device.popErrorScope());pendingScope.catch(()=>{});await mapping;const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();const error=await pendingScope;if(error)throw Error(error.message);return decodeQuery(raw,input.predictionDistance);}finally{temp.forEach(b=>b.destroy());if(scoped)await device.popErrorScope();}}
 const stage={capability:CAPABILITY,async step(input){if(busy||disposed)throw Error('Empty convex-cache stage busy or disposed');const s=checked(input,binding);busy=true;try{const cache=await computeCache(s);return complete(cache,cache.recycled?previousNormal(s):await computeNormal(s,cache),cache.recycled?1:GJK_DISPATCHES+3);}finally{busy=false;}},dispose(){if(busy)throw Error('Empty convex-cache stage busy');disposed=true;owned.forEach(b=>b.destroy());brands.delete(stage);}};brands.set(stage,{backend:'webgpu',hull:binding.hull});return stage;
}
const api=Object.freeze({CAPABILITY,validate,isStage:(stage,backend,hull)=>{const b=brands.get(stage);return b?.backend===backend&&(hull===undefined||b.hull===hull);},createReferenceStage,createGpuStage,generateWGSL});G.LabCueEmptyConvexCacheExperimental=api;if(common)module.exports=api;
})(globalThis);
