/* SPDX-License-Identifier: Apache-2.0
 * Parry 0.31.1 sweep_toi proxy_distance (3D), fixed convex A / ball point B.
 * Original: Sébastien Crozet and the Dimforge contributors. Modified 2026.
 * See experimental-ccd-proxy-distance-kernel.js for shared algorithm and
 * attribution; vendor/RAPIER-LICENSE.txt contains the Apache-2.0 license.
 */
(function(G) {'use strict';
const isNode=typeof module!=='undefined'&&module.exports;
const Source=isNode?require('./experimental-ccd-proxy-distance-kernel'):G.LabCcdProxyDistanceKernelExperimental;
const Cpu=isNode?require('./experimental-ccd-proxy-distance-cpu'):G.LabCcdProxyDistanceCpuExperimental;
const Reducers=isNode?require('./experimental-ccd-proxy-distance-reducers'):G.LabCcdProxyDistanceReducersExperimental;
const f=Math.fround, INPUT_WORDS=16, OUTPUT_WORDS=26;
const TERMINATIONS=Object.freeze({1:'overlap-tetrahedron',2:'overlap-small-direction',3:'overlap-zero-normal',4:'duplicate-support',5:'degenerate-simplex',6:'no-distance-progress',7:'iteration-limit'});
const CAPABILITY=Object.freeze({physicsIntegration:false,productDefaultActivation:false,dimension:3,target:'ordered-convex-point-cloud',movingProxy:'Ball(local ZERO, support index 0)',useRadii:false,maxIterations:32,cso:'wB-wA',source:'parry3d-0.31.1/query/sweep_toi/proxy_distance.rs',sharedCpuWgslControlFlow:true,bitwiseGpuGuarantee:false});
const zeroCache=()=>({metric:0,count:0,indexA:[0,0,0],indexB:[0,0,0]});
function real(x,label) { if(typeof x!=='number'||!Number.isFinite(x)||x!==f(x)) throw TypeError('Finite native-f32 '+label+' required'); return x; }
function vector(v,n,label) { if(!Array.isArray(v)&&!ArrayBuffer.isView(v)) throw TypeError(label+' must be an array'); if(v.length!==n) throw RangeError(label+' length must be '+n); return Array.from(v,(x,i)=>real(x,label+'['+i+']')); }
function integer(x,max,label) { if(!Number.isInteger(x)||x<0||x>max) throw TypeError(label+' must be an unsigned integer <= '+max); return x; }
function validatePoints(points) { if(!Array.isArray(points)||points.length<1||points.length>0xffffffff) throw RangeError('Nonempty source-ordered pointsA required'); return points.map((p,i)=>vector(p,3,'pointsA['+i+']')); }
function validateQuery(input) {
  if(!input||typeof input!=='object') throw TypeError('Query required');
  if(input.useRadii!==undefined&&input.useRadii!==false) throw RangeError('Only source core-distance useRadii:false is supported');
  const pos12=input.pos12; if(!pos12) throw TypeError('Relative pose pos12 required');
  const translation=vector(pos12.translation,3,'pos12.translation'),rotation=vector(pos12.rotation,4,'pos12.rotation');
  const qlen=rotation.reduce((s,x)=>s+x*x,0); if(Math.abs(qlen-1)>0.0001) throw RangeError('pos12.rotation must be a normalized source quaternion');
  const supplied=input.cache===undefined?zeroCache():input.cache;
  if(!supplied||typeof supplied!=='object') throw TypeError('cache must be a SimplexCache');
  const cache={metric:real(supplied.metric,'cache.metric'),count:integer(supplied.count,255,'cache.count')};
  for(const key of ['indexA','indexB']) { if((!Array.isArray(supplied[key])&&!ArrayBuffer.isView(supplied[key]))||supplied[key].length!==3) throw TypeError('cache.'+key+' requires three u32 indices'); cache[key]=Array.from(supplied[key],(x,i)=>integer(x,0xffffffff,'cache.'+key+'['+i+']')); }
  return {pos12:{translation,rotation},cache,useRadii:false};
}
const array=v=>[v.x,v.y,v.z];
function finish(raw,backend) {
  const result={...raw,backend,terminationCode:raw.termination,termination:TERMINATIONS[raw.termination]};
  for(const key of ['pointA','pointB','normal']) if(!Array.isArray(result[key])) result[key]=array(result[key]);
  const values=[...result.pointA,...result.pointB,...result.normal,result.distance,result.cache.metric];
  if(values.some(x=>!Number.isFinite(x))) throw RangeError('Proxy-distance arithmetic exceeded the finite component domain');
  return result;
}
function reference(input) {
  const pointsA=validatePoints(input.pointsA),query=validateQuery(input),kernel=Cpu.createKernel(pointsA),q=query.pos12.rotation;
  const pointB=kernel.ballPoint(kernel.V3(...query.pos12.translation),kernel.V3(...q.slice(0,3)),q[3]);
  return finish(kernel.proxyDistance(pointB,query.cache),'cpu-reference');
}
function shaderSource() { return Source.TYPES+Source.PRIMITIVES+`
@group(0) @binding(0) var<storage,read> points: array<vec4<f32>>;
@group(0) @binding(1) var<storage,read> inputWords: array<u32>;
@group(0) @binding(2) var<storage,read_write> outputWords: array<u32>;
fn pointA(i: u32) -> V3 { return points[i].xyz; }
fn pointCount() -> u32 { return arrayLength(&points); }
fn inputFloat(i: u32) -> f32 { return bitcast<f32>(inputWords[i]); }
`+Source.wgslKernel(Reducers.wgsl())+`
@compute @workgroup_size(1) fn main() {
  outputWords[25]=0u;
  if(arrayLength(&inputWords)!=16u || arrayLength(&outputWords)!=26u || pointCount()==0u) { return; }
  let t=V3(inputFloat(0u),inputFloat(1u),inputFloat(2u));
  let q=V3(inputFloat(3u),inputFloat(4u),inputFloat(5u));
  let c=Cache(inputFloat(7u),inputWords[8],U3(inputWords[9],inputWords[10],inputWords[11]),U3(inputWords[12],inputWords[13],inputWords[14]));
  proxyDistance(ballPoint(t,q,inputFloat(6u)),c);
  let r=result;
  outputWords[0]=bitcast<u32>(r.pointA.x); outputWords[1]=bitcast<u32>(r.pointA.y); outputWords[2]=bitcast<u32>(r.pointA.z);
  outputWords[3]=bitcast<u32>(r.pointB.x); outputWords[4]=bitcast<u32>(r.pointB.y); outputWords[5]=bitcast<u32>(r.pointB.z);
  outputWords[6]=bitcast<u32>(r.normal.x); outputWords[7]=bitcast<u32>(r.normal.y); outputWords[8]=bitcast<u32>(r.normal.z);
  outputWords[9]=bitcast<u32>(r.distance); outputWords[10]=r.iterations;
  outputWords[11]=bitcast<u32>(r.cache.metric); outputWords[12]=r.cache.count;
  for(var i=0u;i<3u;i++) { outputWords[13u+i]=r.cache.indexA[i]; outputWords[16u+i]=r.cache.indexB[i]; }
  outputWords[19]=select(0u,1u,r.overlap); outputWords[20]=select(0u,1u,r.cacheWritten);
  outputWords[21]=r.termination; outputWords[22]=select(0u,1u,r.cacheAccepted); outputWords[23]=select(0u,1u,r.cacheFlushed); outputWords[24]=r.finalCount;
  outputWords[25]=1u;
}
`; }
function pack(query) {
  const buffer=new ArrayBuffer(INPUT_WORDS*4),floats=new Float32Array(buffer),words=new Uint32Array(buffer);
  floats.set(query.pos12.translation,0);floats.set(query.pos12.rotation,3);floats[7]=query.cache.metric;
  words[8]=query.cache.count;words.set(query.cache.indexA,9);words.set(query.cache.indexB,12);return words;
}
function unpack(buffer) {
  const v=new Float32Array(buffer),u=new Uint32Array(buffer);
  if(u[25]!==1) throw Error('Incomplete proxy-distance GPU dispatch');
  return {pointA:Array.from(v.slice(0,3)),pointB:Array.from(v.slice(3,6)),normal:Array.from(v.slice(6,9)),distance:v[9],iterations:u[10],cache:{metric:v[11],count:u[12],indexA:Array.from(u.slice(13,16)),indexB:Array.from(u.slice(16,19))},overlap:!!u[19],cacheWritten:!!u[20],termination:u[21],cacheAccepted:!!u[22],cacheFlushed:!!u[23],finalCount:u[24]};
}
const PIPELINES=new WeakMap();
function pipelineFor(device) {
  if(!PIPELINES.has(device)) {
    const promise=(async()=>{
      const module=device.createShaderModule({code:shaderSource(),label:'Parry 0.31.1 3D proxy-distance'}),info=await module.getCompilationInfo();
      const errors=info.messages.filter(m=>m.type==='error');if(errors.length) throw Error('Proxy-distance WGSL: '+errors.map(m=>m.lineNum+':'+m.message).join('; '));
      return device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    })();
    PIPELINES.set(device,promise);promise.catch(()=>{if(PIPELINES.get(device)===promise)PIPELINES.delete(device);});
  }
  return PIPELINES.get(device);
}
async function createGpuStage(device,{pointsA}) {
  const points=validatePoints(pointsA),owned=[];
  if(!device||typeof device.createShaderModule!=='function') throw TypeError('An actual GPUDevice is required');
  let busy=false,disposed=false;
  const make=(size,usage,label)=>{const b=device.createBuffer({size,usage,label});owned.push(b);return b;};
  try {
    const pipeline=await pipelineFor(device);
    const pointData=new Float32Array(points.length*4);points.forEach((p,i)=>pointData.set(p,i*4));
    const pointsBuffer=make(pointData.byteLength,136,'source-ordered target points'),input=make(INPUT_WORDS*4,136,'proxy query'),output=make(OUTPUT_WORDS*4,132,'proxy result'),read=make(OUTPUT_WORDS*4,9,'proxy readback');
    const program=make(Reducers.PROGRAM.byteLength,136,'source reducer program'),indices=make(Reducers.OUTPUTS.byteLength,136,'source reducer outputs'),scratch=make(Reducers.SCRATCH_FLOATS*4,128,'source reducer scalar scratch');
    device.queue.writeBuffer(program,0,Reducers.PROGRAM);device.queue.writeBuffer(indices,0,Reducers.OUTPUTS);
    device.queue.writeBuffer(pointsBuffer,0,pointData);
    const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[pointsBuffer,input,output,program,indices,scratch].map((buffer,binding)=>({binding,resource:{buffer}}))});
    return {
      async step(inputQuery) {
        if(disposed||busy) throw Error('Proxy-distance stage is disposed or busy');
        const query=validateQuery(inputQuery);busy=true;
        try {
          device.queue.writeBuffer(input,0,pack(query));
          const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(1);pass.end();
          encoder.copyBufferToBuffer(output,0,read,0,OUTPUT_WORDS*4);device.queue.submit([encoder.finish()]);
          await read.mapAsync(1);const result=read.getMappedRange().slice(0);read.unmap();return finish(unpack(result),'webgpu');
        } finally {busy=false;}
      },
      dispose() {if(busy) throw Error('Cannot dispose a busy proxy-distance stage');if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}
    };
  } catch(error) {owned.forEach(b=>b.destroy());throw error;}
}
const api=Object.freeze({CAPABILITY,TERMINATIONS,reference,createGpuStage,shaderSource,zeroCache,validatePoints,validateQuery});
G.LabCcdProxyDistanceExperimental=api;if(isNode)module.exports=api;
})(globalThis);
