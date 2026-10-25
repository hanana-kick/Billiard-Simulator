/* SPDX-License-Identifier: Apache-2.0
 * Source-ordered f32 numerical stages for Parry 0.31.1 query/sweep_toi
 * and mass_properties::MassProperties::world_inv_inertia.
 * Copyright 2020 Sébastien Crozet. Modified 2026.
 * Quaternion/vector arithmetic follows glam 0.33.12 (MIT OR Apache-2.0).
 * See vendor/RAPIER-LICENSE.txt, vendor/GLAM-LICENSE-*.txt and THIRD_PARTY_NOTICES.txt.
 * Fixed convex A / local-zero sphere B only. Host controls iterations, never numerical fallback.
 */
(function(G){'use strict';
const A=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental,R=typeof module!=='undefined'&&module.exports?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental,f=Math.fround;
function check(x){if(typeof x==='number'){if(!Number.isFinite(x)||f(x)!==x)throw TypeError('Exact finite native f32 required');}else if(Array.isArray(x))x.forEach(check);else if(x&&typeof x==='object')Object.values(x).forEach(check);else if(typeof x!=='string'&&x!==null)throw TypeError('Unsupported numerical stage input');}
function builder(){const nodes=[],op=(kind,...args)=>(nodes.push({kind,args}),nodes.length),c=x=>op('const',f(x)),z=c(0),one=c(1),two=c(2),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),div=(a,b)=>op('div',a,b),neg=a=>op('negate',a),sel=(p,a,b)=>op('choose',p,a,b),vs=(a,b)=>a.map((x,i)=>sub(x,b[i])),va=(a,b)=>a.map((x,i)=>add(x,b[i])),vm=(a,b)=>a.map(x=>mul(x,b)),vv=x=>x.map(c),dot=(a,b)=>a.map((x,i)=>mul(x,b[i])).reduce(add),cross=(a,b)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))],norm=a=>op('sqrt',dot(a,a)),selectV=(p,a,b)=>a.map((x,i)=>sel(p,x,b[i]));
 const normalize=a=>{const n=norm(a),positive=op('gt',n,z),inv=div(one,sel(positive,n,one));return selectV(positive,vm(a,inv),a.map(()=>z));};
 const qm=(a,b)=>[sub(add(add(mul(a[3],b[0]),mul(a[0],b[3])),mul(a[1],b[2])),mul(a[2],b[1])),add(add(sub(mul(a[3],b[1]),mul(a[0],b[2])),mul(a[1],b[3])),mul(a[2],b[0])),add(sub(add(mul(a[3],b[2]),mul(a[0],b[1])),mul(a[1],b[0])),mul(a[2],b[3])),sub(sub(sub(mul(a[3],b[3]),mul(a[0],b[0])),mul(a[1],b[1])),mul(a[2],b[2]))],qi=q=>[...q.slice(0,3).map(neg),q[3]],rotate=(q,v)=>{const b=q.slice(0,3);return va(va(vm(v,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(v,b),two))),vm(cross(b,v),mul(q[3],two)));};
 const transform=(s,t)=>{const q1=vv(s.q1),q2=vv(s.q2),flip=op('lt',dot(q1,q2),z),qa=selectV(flip,q1.map(neg),q1),inv=sub(one,t),q=normalize(va(vm(qa,inv),vm(q2,t))),p=vs(va(vm(vv(s.c1),inv),vm(vv(s.c2),t)),rotate(q,vv(s.localCenter)));return{translation:p,rotation:q};};
 const point=(x,p)=>va(x.translation,rotate(x.rotation,p));
 const finish=fields=>{const outputs=[],layout={};for(const[k,v]of Object.entries(fields)){const ids=Array.isArray(v)?v:[v];layout[k]={offset:outputs.length,length:ids.length};outputs.push(...ids);}return{inputFloats:1,nodes,outputs,layout};};return{op,c,z,one,two,add,sub,mul,div,neg,sel,vs,va,vm,vv,dot,cross,norm,normalize,selectV,qm,qi,rotate,transform,point,finish};}
function build(kind,s){check(s);const b=builder(),{op,c,z,one,add,sub,mul,div,neg,sel,vs,va,vm,vv,dot,cross,norm,normalize,selectV,qm,qi,rotate,transform,point,finish}=b;
 if(kind==='worldInvInertia'){
  for(const[k,n]of Object.entries({rotation:4,principalFrame:4,invPrincipalInertia:3}))if(!Array.isArray(s[k])||s[k].length!==n||Array.from(s[k]).some(x=>typeof x!=='number'))throw TypeError('Explicit finite f32 '+k+' required');
  for(const k of['rotation','principalFrame'])if(Math.abs(s[k].reduce((sum,x)=>sum+x*x,0)-1)>2e-5)throw RangeError('Unit '+k+' quaternion required');
  // Parry mass_properties.rs:261-272 returns positive zero for zero inertia.
  // Other locked/degenerate inertia is outside the admitted dynamic-body domain.
  if(s.invPrincipalInertia.every(x=>x===0))return finish({invInertia:Array(9).fill(z)});
  if(s.invPrincipalInertia.some(x=>x<=0))throw RangeError('Positive or all-zero principal inverse inertia required');
  // Keep the same scalar glam/Parry f32 order as free-body.js:45-48 and
  // world-stepper.js:70: R(rotation * principalFrame), column scale, R * R^T.
  // Do not simplify an isotropic sphere: source rotation rounding remains visible.
  const q=qm(vv(s.rotation),vv(s.principalFrame)),inv=vv(s.invPrincipalInertia),x2=add(q[0],q[0]),y2=add(q[1],q[1]),z2=add(q[2],q[2]),xx=mul(q[0],x2),xy=mul(q[0],y2),xz=mul(q[0],z2),yy=mul(q[1],y2),yz=mul(q[1],z2),zz=mul(q[2],z2),wx=mul(q[3],x2),wy=mul(q[3],y2),wz=mul(q[3],z2),cols=[[sub(one,add(yy,zz)),add(xy,wz),sub(xz,wy)],[sub(xy,wz),sub(one,add(xx,zz)),add(yz,wx)],[add(xz,wy),sub(yz,wx),sub(one,add(xx,yy))]],term=(i,j)=>add(add(mul(mul(cols[0][i],inv[0]),cols[0][j]),mul(mul(cols[1][i],inv[1]),cols[1][j])),mul(mul(cols[2][i],inv[2]),cols[2][j])),m11=term(0,0),m12=term(0,1),m13=term(0,2),m22=term(1,1),m23=term(1,2),m33=term(2,2);
  return finish({invInertia:[m11,m12,m13,m12,m22,m23,m13,m23,m33]});
 }
 if(kind==='shift'){const origin=vv(s.a.c1),out={origin};for(const k of['a','b']){out[k+'C1']=vs(vv(s[k].c1),origin);out[k+'C2']=vs(vv(s[k].c2),origin);}return finish(out);}
 if(kind==='sphereBounds'){const r=c(s.radius),a=vv(s.c1),bb=vv(s.c2);return finish({min:a.map((v,i)=>op('min',sub(v,r),sub(bb[i],r))),max:a.map((v,i)=>op('max',add(v,r),add(bb[i],r)))});}
 if(kind==='overlap'){let yes=one;for(let i=0;i<3;i++)yes=mul(yes,mul(op('le',c(s.a.min[i]),c(s.b.max[i])),op('le',c(s.b.min[i]),c(s.a.max[i]))));return finish({overlap:yes});}
 if(kind==='predictSphereCenter'){if(s.localCenter.some(x=>x!==0))throw RangeError('Only zero-COM sphere prediction supported');const dt=c(s.dt),velocity=vv(s.linear).map((v,i)=>add(v,mul(mul(c(s.force[i]),c(s.invMass[i])),dt))),start=vv(s.translation);return finish({c1:start,c2:va(start,vm(velocity,dt)),predictedLinear:velocity});}
 if(kind==='fromPoses'){const local=vv(s.localCenter);return finish({c1:point({translation:vv(s.start.translation),rotation:vv(s.start.rotation)},local),c2:point({translation:vv(s.end.translation),rotation:vv(s.end.rotation)},local)});}
 if(kind==='transform'){const x=transform(s.sweep,c(s.t));return finish(x);}
 if(kind==='relative'){const a=transform(s.a,c(s.t)),bb=transform(s.b,c(s.t)),inv=qi(a.rotation);return finish({translation:rotate(inv,vs(bb.translation,a.translation)),rotation:qm(inv,bb.rotation),aTranslation:a.translation,aRotation:a.rotation,bTranslation:bb.translation,bRotation:bb.rotation});}
 if(kind==='target'){const target=op('max',c(s.slop),sub(add(c(s.radiusA),c(s.radiusB)),c(s.slop))),tolerance=mul(c(.25),c(s.slop));return finish({target,tolerance,plus:add(target,tolerance),minus:sub(target,tolerance)});}
 if(kind==='worldDistance'){const xf=transform(s.a,c(s.t)),normal=rotate(xf.rotation,vv(s.normal)),pa=point(xf,vv(s.pointA)),pb=point(xf,vv(s.pointB));return finish({normal,point:va(vm(va(va(pa,vm(normal,c(s.radiusA))),vs(pb,vm(normal,c(s.radiusB)))),c(.5)),vv(s.origin))});}
 if(kind==='face'){const [p1,p2,p3]=s.points.map(vv),local=normalize(cross(vs(p2,p1),vs(p3,p1))),localPoint=va(va(p1,p2),p3).map(x=>div(x,c(3))),a=transform(s.a,c(s.t)),bb=transform(s.b,c(s.t)),axis=rotate(a.rotation,local),delta=va(vs([z,z,z],rotate(a.rotation,localPoint)),vs(bb.translation,a.translation)),flip=op('lt',dot(delta,axis),z);return finish({witness1:selectV(flip,local.map(neg),local),witness2:localPoint});}
 if(kind==='find'||kind==='evaluate'){const a=transform(s.a,c(s.t)),bb=transform(s.b,c(s.t));let axis,pa,ia=z;
  if(s.type==='FaceA'){axis=rotate(a.rotation,vv(s.witness1));pa=point(a,vv(s.witness2));}
  else if(s.type==='Vertices'){axis=vv(s.witness1);let local;
   if(kind==='find'){const dir=rotate(qi(a.rotation),axis);local=vv(s.pointsA[0]);const first=local;let best=z;for(let i=1;i<s.pointsA.length;i++){const p=vv(s.pointsA[i]),d=dot(dir,vs(p,first)),take=op('gt',d,best);local=selectV(take,p,local);ia=sel(take,c(i),ia);best=sel(take,d,best);}}
   else {if(!Number.isInteger(s.indexA)||!s.pointsA[s.indexA])throw RangeError('Source witness index required');local=vv(s.pointsA[s.indexA]);ia=c(s.indexA);}
   // The source find path subtracts rotated points first, then adds translation delta.
   if(kind==='find')return finish({separation:dot(va(vs([z,z,z],rotate(a.rotation,local)),vs(bb.translation,a.translation)),axis),indexA:ia});
   pa=point(a,local);
  }else throw RangeError('Only source Vertices/FaceA sphere separation supported');
  return finish({separation:dot(vs(bb.translation,pa),axis),indexA:ia});
 }
 if(kind==='root'){const a1=c(s.a1),a2=c(s.a2);return finish({t:s.method==='bisect'?mul(c(.5),add(a1,a2)):add(a1,div(mul(sub(c(s.target),c(s.s1)),sub(a2,a1)),sub(c(s.s2),c(s.s1))))});}
 if(kind==='difference')return finish({value:sub(c(s.a),c(s.b))});
 if(kind==='multiply')return finish({value:mul(c(s.a),c(s.b))});
 throw RangeError('Unknown CCD sweep numeric stage');
}
function unpack(raw,plan){const out={};for(const[k,x]of Object.entries(plan.layout)){const v=Array.from(raw.slice(x.offset,x.offset+x.length));out[k]=x.length===1?v[0]:v;}return out;}
function reference(kind,input){const p=build(kind,input);return unpack(A.execute(new Float32Array([0]),p),p);}
const PIPELINES=new WeakMap();
async function pipelineFor(device){if(!PIPELINES.has(device)){const pending=(async()=>{const shader=device.createShaderModule({code:R.shaderForInputFloats(1)}),info=await shader.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error('Sweep math WGSL compilation failed');return device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});})();PIPELINES.set(device,pending);pending.catch(()=>{if(PIPELINES.get(device)===pending)PIPELINES.delete(device);});}return PIPELINES.get(device);}
async function createGpuStage(device){let busy=false,disposed=false;const pipeline=await pipelineFor(device);return{async step(kind,input){if(busy||disposed)throw Error('Sweep math stage unavailable');const plan=build(kind,input),program=A.encode(plan),ids=Uint32Array.from(plan.outputs),owned=[];busy=true;const make=(size,usage)=>{const x=device.createBuffer({size,usage});owned.push(x);return x;};try{const src=make(4,136),pb=make(program.byteLength,136),ib=make(ids.byteLength,136),scratch=make((1+plan.nodes.length)*4,128),size=(ids.length+1)*4,out=make(size,132),read=make(size,9);device.queue.writeBuffer(src,0,new Float32Array([0]));device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,ids);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src,pb,scratch,ib,out].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);await read.mapAsync(1);const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();if(raw.at(-1)!==1||raw.some(x=>!Number.isFinite(x)))throw Error('Incomplete sweep math GPU result');return unpack(raw,plan);}finally{owned.forEach(x=>x.destroy());busy=false;}},dispose(){if(busy)throw Error('Sweep math busy');disposed=true;}};}
const api=Object.freeze({reference,createGpuStage});G.LabCcdSweepMathExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
