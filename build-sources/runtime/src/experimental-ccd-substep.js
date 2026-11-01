/* SPDX-License-Identifier: Apache-2.0
 * Source-order f32 CCD timestep selection from Rapier b716d375efc0201003f0cd9ef7168eee0b62c177,
 * src/pipeline/physics_pipeline/substep.rs:499-562. See vendor/RAPIER-LICENSE.txt.
 * This stage does not find TOI, solve constraints, clamp bodies, or advance a world.
 */
(function(G){'use strict';
const A=typeof module!=='undefined'&&module.exports?require('./experimental-arithmetic-graph'):G.LabArithmeticGraphExperimental;
const R=typeof module!=='undefined'&&module.exports?require('./experimental-stage-runtime'):G.LabStageRuntimeExperimental;
const f=Math.fround, STRIDE=5;
const CAPABILITY=Object.freeze({kind:'source-ccd-substep-selection',maxCcdSubsteps:4,toiQuery:false,worldIntegration:false});
function validate(s){
 if(!s||Object.keys(s).some(k=>!['remainingTime','remainingSubsteps','minCcdDt','firstImpact'].includes(k)))throw TypeError('Exact CCD timestep fields required');
 for(const k of ['remainingTime','minCcdDt'])if(typeof s[k]!=='number'||!Number.isFinite(s[k])||f(s[k])!==s[k]||s[k]<0)throw RangeError('Nonnegative source f32 '+k+' required');
 if(s.remainingTime<=0||!Number.isInteger(s.remainingSubsteps)||s.remainingSubsteps<1||s.remainingSubsteps>4)throw RangeError('Live original four-substep schedule required');
 if(s.firstImpact!==null&&(typeof s.firstImpact!=='number'||!Number.isFinite(s.firstImpact)||f(s.firstImpact)!==s.firstImpact||s.firstImpact<0||s.firstImpact>=s.remainingTime))throw RangeError('TOI must be null or a source f32 in [0, remainingTime)');
 if(s.remainingSubsteps===1&&s.firstImpact!==null)throw RangeError('Final pass must not query a splitter TOI');
 return {...s};
}
function plan(){
 const nodes=[],op=(kind,...args)=>(nodes.push({kind,args}),STRIDE+nodes.length-1),c=x=>op('const',f(x)),z=c(0),one=c(1),sel=(p,a,b)=>op('choose',p,a,b),sub=(a,b)=>op('sub',a,b),add=(a,b)=>op('add',a,b),div=(a,b)=>op('div',a,b),multi=op('gt',1,one),has=2,toi=3;
 const interval=div(0,1),impactDt=sel(op('lt',toi,interval),interval,add(toi,div(sub(0,toi),1))),dt=sel(has,impactDt,0),left=sub(0,dt),absorb=op('le',left,4),splitDt=sel(absorb,add(dt,left),dt),steps=sel(absorb,z,sel(has,sub(1,one),z));
 return {inputFloats:STRIDE,nodes,outputs:[sel(multi,splitDt,0),sel(multi,left,z),sel(multi,steps,z)]};
}
const PLAN=plan();
function pack(s){return new Float32Array([s.remainingTime,s.remainingSubsteps,s.firstImpact===null?0:1,s.firstImpact??0,s.minCcdDt]);}
function unpack(raw){return Object.freeze({dt:raw[0],remainingTime:raw[1],remainingSubsteps:raw[2],collisionRefreshRequired:raw[2]>0});}
function reference(s){return unpack(A.execute(pack(validate(s)),PLAN));}
async function createGpuStage(device){
 const owned=[];let busy=false,disposed=false;
 const make=(size,usage,list=owned)=>{const b=device.createBuffer({size,usage});list.push(b);return b;};
 try {
  const shader=device.createShaderModule({code:R.shaderForInputFloats(STRIDE)}),info=await shader.getCompilationInfo();
  if(info.messages.some(m=>m.type==='error'))throw Error('CCD substep shader compilation failed');
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}}),program=A.encode(PLAN),indices=Uint32Array.from(PLAN.outputs),pb=make(program.byteLength,136),ib=make(indices.byteLength,136);
  device.queue.writeBuffer(pb,0,program);device.queue.writeBuffer(ib,0,indices);
  return Object.freeze({async step(input){
   if(disposed||busy)throw Error('CCD substep stage unavailable');const s=validate(input);busy=true;const temp=[];
   try {
    const packed=pack(s),size=16,src=make(packed.byteLength,136,temp),scratch=make((STRIDE+PLAN.nodes.length)*4,128,temp),out=make(size,132,temp),read=make(size,9,temp);
    device.queue.writeBuffer(src,0,packed);
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src,pb,scratch,ib,out].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);device.queue.submit([encoder.finish()]);await read.mapAsync(1);
    const raw=new Float32Array(read.getMappedRange().slice(0));read.unmap();if(raw[3]!==1||raw.some(x=>!Number.isFinite(x)))throw Error('Incomplete CCD substep dispatch');return unpack(raw);
   }finally{temp.forEach(b=>b.destroy());busy=false;}
  },dispose(){if(busy)throw Error('CCD substep busy');if(disposed)return;disposed=true;owned.forEach(b=>b.destroy());owned.length=0;}});
 }catch(e){owned.forEach(b=>b.destroy());throw e;}
}
const api=Object.freeze({CAPABILITY,validate,reference,createGpuStage,sourcePlan:()=>structuredClone(PLAN),pack});G.LabCcdSubstepExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
