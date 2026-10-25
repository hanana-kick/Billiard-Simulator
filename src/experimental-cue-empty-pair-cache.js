/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2020 Sébastien Crozet. Modified 2026: separated cue-pair cache port.
 * Rapier b716d375efc0201003f0cd9ef7168eee0b62c177:
 * geometry/narrow_phase/pair_update.rs and contact_pair.rs ContactRecycleState.
 * Pose composition: glamx 0.3.1 pose3.rs; scalar quaternion arithmetic: glam 0.33.10.
 * Upstream notices: vendor/RAPIER-LICENSE.txt; glam MIT/Apache-2.0.
 * This is ONLY the numeric cache recurrence for an independently proven empty
 * sphere/cylinder manifold. It does not determine separation, create contacts,
 * integrate bodies, own graph topology, or change the original physics engine.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports;
const Graph=common?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const Runtime=common?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental;
const f=Math.fround,INPUT_FLOATS=48,copy=x=>structuredClone(x);
const CAPABILITY=Object.freeze({wholeWorld:false,contactSolver:false,separationProof:false,emptySphereCylinderCache:true,identityLocalRotationsOnly:true,shapeChanges:false,requiresCurrentSeparationProof:true,sharedF32Graph:true});
const brands=new WeakMap();
const CACHE_VECTORS={recycleTranslation:[25,3],recycleRelativeRotation:[28,4],recycleRotation1:[32,4],recycleRotation2:[36,4]};
const CACHE_SCALARS={maxExtent:40,maxDrift:41};
const requireThat=(ok,message)=>{if(!ok)throw RangeError(message);};
function keys(value,allowed,label){requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k)),'Unsupported '+label+' fields');}
function scalar(value,limit,label){requireThat(typeof value==='number'&&Number.isFinite(value)&&value===f(value)&&Math.abs(value)<=limit,'Bounded exact f32 '+label+' required');return value;}
function vector(value,n,limit,label){requireThat(Array.isArray(value)&&value.length===n,'Invalid '+label);value.forEach(x=>scalar(x,limit,label));return value;}
function rotation(value,label){vector(value,4,1.001,label);requireThat(Math.abs(value.reduce((s,x)=>s+x*x,0)-1)<2e-5,'Source unit quaternion required');}
function validate(input){
 keys(input,['kind','separated','shapesChanged','sphere','cylinder','contactRecycleDistance','predictionDistance','previous'],'empty-cache input');
 requireThat(input.kind==='separated-sphere-cylinder-empty-cache'&&input.separated===true&&input.shapesChanged===false,'Current separated empty sphere/cylinder pair with unchanged shapes required');
 for(const name of['sphere','cylinder']){
  const body=input[name];keys(body,name==='sphere'?['radius','translation','rotation','localTranslation']:['radius','halfHeight','translation','rotation','localTranslation'],name);
  scalar(body.radius,name==='sphere'?.1:.02,name+' radius');requireThat(body.radius>0,'Positive shape radius required');
  if(name==='cylinder'){scalar(body.halfHeight,1,'cylinder half height');requireThat(body.halfHeight>0,'Positive cylinder half height required');}
  vector(body.translation,3,10,name+' body translation');rotation(body.rotation,name+' body rotation');vector(body.localTranslation,3,2,name+' local translation');
 }
 scalar(input.contactRecycleDistance,.1,'contact recycle distance');scalar(input.predictionDistance,.01,'prediction distance');
 requireThat(input.contactRecycleDistance>0&&input.predictionDistance>=0,'Enabled positive contact recycling and nonnegative prediction required');
 const dimensions=[input.sphere.radius,input.cylinder.radius,input.cylinder.halfHeight];
 requireThat(input.previous===null||(input.previous&&typeof input.previous==='object'),'Explicit previous cache or null required');
 if(input.previous!==null){
  const previous=input.previous;
  keys(previous,[...Object.keys(CACHE_VECTORS),...Object.keys(CACHE_SCALARS),'shapeDimensions','recycled','drift','rotationCos','backend','actualDispatches'],'previous empty cache');
  vector(previous.shapeDimensions,3,1,'previous shape dimensions');
  requireThat(dimensions.every((x,i)=>x===previous.shapeDimensions[i]),'Shape changes are unsupported by empty-cache recurrence');
  for(const[k,[,n]]of Object.entries(CACHE_VECTORS))if(n===4)rotation(previous[k],k);else vector(previous[k],n,48,k);
  scalar(previous.maxExtent,2,'previous maximum extent');scalar(previous.maxDrift,.1,'previous maximum drift');
  requireThat(previous.maxExtent>0&&previous.maxDrift>=0,'Invalid previous empty-cache bounds');
 }
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
 const sphereExtent=op('max',norm([neg(10),neg(10),neg(10)]),norm([10,10,10]));
 const cylinderExtent=op('max',norm([neg(21),neg(22),neg(21)]),norm([21,22,21]));
 const extent=choose(42,40,op('max',sphereExtent,cylinderExtent)),maxDrift=op('min',23,24);
 const fields={recycleTranslation:sel(recycled,v(25),relative),recycleRelativeRotation:sel(recycled,v(28,4),relativeRotation),recycleRotation1:sel(recycled,v(32,4),q1),recycleRotation2:sel(recycled,v(36,4),q2),maxExtent:[extent],maxDrift:[choose(recycled,41,maxDrift)],recycled:[recycled],drift:[choose(42,drift,z)],rotationCos:[choose(42,rotationCos,one)]};
 const outputs=[],layout={};for(const[k,ids]of Object.entries(fields)){layout[k]={offset:outputs.length,length:ids.length};outputs.push(...ids);}return{inputFloats:INPUT_FLOATS,nodes,outputs,layout};
}
const PLAN=buildPlan();
function pack(input){
 const a=new Float32Array(INPUT_FLOATS);for(const[body,base]of[[input.sphere,0],[input.cylinder,11]]){a.set(body.translation,base);a.set(body.rotation,base+3);a.set(body.localTranslation,base+7);a[base+10]=body.radius;}
 a[22]=input.cylinder.halfHeight;a[23]=input.contactRecycleDistance;a[24]=input.predictionDistance;
 // Safe finite default only initializes the graph's non-selected branch. It is
 // never returned as a cache. No saved source/frame values enter this program.
 if(input.previous){for(const[k,[index]]of Object.entries(CACHE_VECTORS))a.set(input.previous[k],index);for(const[k,index]of Object.entries(CACHE_SCALARS))a[index]=input.previous[k];a[42]=1;}
 else{a[31]=1;a[35]=1;a[39]=1;}
 return a;
}
function decode(raw,input,backend){
 const result={};for(const[k,{offset,length}]of Object.entries(PLAN.layout))result[k]=length===1?raw[offset]:Array.from(raw.slice(offset,offset+length));
 requireThat(raw.every(Number.isFinite)&&(result.recycled===0||result.recycled===1),'Incomplete empty-cache arithmetic');
 result.recycled=!!result.recycled;result.shapeDimensions=[input.sphere.radius,input.cylinder.radius,input.cylinder.halfHeight];result.backend=backend;result.actualDispatches=backend==='webgpu'?1:0;return result;
}
function createReferenceStage(){let disposed=false;const stage={capability:CAPABILITY,step(input){if(disposed)throw Error('Empty-cache stage disposed');const s=validate(input);return decode(Graph.execute(pack(s),PLAN),s,'cpu-reference');},dispose(){disposed=true;brands.delete(stage);}};brands.set(stage,'cpu-reference');return stage;}
async function createGpuStage(device){
 if(!device?.createShaderModule)throw TypeError('Actual GPUDevice required');
 const shader=device.createShaderModule({code:Runtime.shaderForInputFloats(INPUT_FLOATS)}),info=await shader.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));
 const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}}),program=Graph.encode(PLAN),indices=Uint32Array.from(PLAN.outputs),owned=[],make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};
 const pb=make(program.byteLength,136),ib=make(indices.byteLength,136);device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);let busy=false,disposed=false;
 const stage={capability:CAPABILITY,async step(input){
  if(busy||disposed)throw Error('Empty-cache stage busy or disposed');const s=copy(validate(input));busy=true;const temp=[],buf=(size,usage)=>{const b=device.createBuffer({size,usage});temp.push(b);return b;};let scoped=false;
  try{device.pushErrorScope('validation');scoped=true;const a=pack(s),source=buf(a.byteLength,136),scratch=buf((INPUT_FLOATS+PLAN.nodes.length)*4,128),size=(PLAN.outputs.length+1)*4,out=buf(size,132),read=buf(size,9);device.queue.writeBuffer(source,0,a);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[source,pb,scratch,ib,out].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);
// Close this device-global scope before yielding to another owner's operation.
const mapping=Promise.resolve(read.mapAsync(1));mapping.catch(()=>{});scoped=false;const pendingScope=Promise.resolve(device.popErrorScope());pendingScope.catch(()=>{});await mapping;const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();const error=await pendingScope;if(error)throw Error(error.message);if(raw.at(-1)!==1||raw.some(x=>!Number.isFinite(x)))throw Error('Incomplete actual WGSL empty-cache computation');return decode(raw.subarray(0,-1),s,'webgpu');
  }finally{temp.forEach(b=>b.destroy());if(scoped)await device.popErrorScope();busy=false;}
 },dispose(){if(busy)throw Error('Empty-cache stage busy');disposed=true;owned.forEach(b=>b.destroy());brands.delete(stage);}};brands.set(stage,'webgpu');return stage;
}
const api=Object.freeze({CAPABILITY,validate,isStage:(stage,backend)=>brands.get(stage)===backend,createReferenceStage,createGpuStage});G.LabCueEmptyPairCacheExperimental=api;if(common)module.exports=api;
})(globalThis);
