/** Prepared-state GPU scheduler proof ONLY: constant velocity, no cloth,
 * no angular state, equal radius/mass, frictionless planar rectangle contacts.
 * Distinct subset of event-core, NOT a Coulomb GPU implementation or raw shot.
 * 96 B/candidate + 32 B shared; compact output 16 B, no PASS/MISS authority.
 */
export const LINEAR_GPU_PROFILE='experimental-planar-frictionless-linear-event-gpu-v1';
export const LINEAR_EVENT_WGSL=`
struct State { header:vec4<u32>, progress:vec4<f32>, balls:array<vec4<f32>,4> }
struct Shared { geometry:vec4<f32>, limits:vec4<f32> }
@group(0) @binding(0) var<storage,read> tableData:Shared;
@group(0) @binding(1) var<storage,read_write> states:array<State>;
@group(0) @binding(2) var<storage,read_write> results:array<vec4<u32>>;
const E:f32=0.00001;
fn finiteValue(x:f32)->bool{return (bitcast<u32>(x)&0x7f800000u)!=0x7f800000u;}
fn finiteVector(x:vec4<f32>)->bool{return all((bitcast<vec4<u32>>(x)&vec4<u32>(0x7f800000u))!=vec4<u32>(0x7f800000u));}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let index=gid.x;if(index>=arrayLength(&states)){return;}
 var s=states[index];let n=s.header.y;let budget=s.header.z;
 var status=5u;var reason=1u;
 let size=tableData.geometry.xy;let radius=tableData.geometry.z;let restitution=tableData.geometry.w;
 if((n!=3u&&n!=4u)||budget<1u||budget>32u||s.header.w!=0u){results[index]=vec4<u32>(s.header.x,4u,2u,0xffffffffu);return;}
 var invalid=!finiteVector(tableData.geometry)||!finiteVector(tableData.limits);
 for(var i=0u;i<n;i++){
  let b=s.balls[i];if(!finiteVector(b)){invalid=true;}if(any(b.xy<vec2<f32>(radius-E))||any(b.xy>size-vec2<f32>(radius-E))){invalid=true;}
  for(var j=i+1u;j<n;j++){if(distance(b.xy,s.balls[j].xy)<2.0*radius-E){invalid=true;}}
 }
 if(invalid){results[index]=vec4<u32>(s.header.x,4u,3u,0xffffffffu);return;}
 for(var step=0u;step<budget;step++){
  var moving=false;for(var i=0u;i<n;i++){if(length(s.balls[i].zw)>E){moving=true;}}
  if(!moving){status=6u;reason=0u;break;}
  let horizon=tableData.limits.x-s.progress.x;
  var best=horizon+1.0;var kind=0u;var first=0u;var second=0u;var tied=false;var ambiguous=false;var numeric=false;
  for(var i=0u;i<n;i++){
   let b=s.balls[i];
   for(var axis=0u;axis<2u;axis++){
    let velocity=b[axis+2u];if(abs(velocity)>E){
     let edge=select(radius,size[axis]-radius,velocity>0.0);let t=(edge-b[axis])/velocity;
     if(t>=-E&&t<=horizon){
      if(abs(t-best)<=E*(1.0+abs(best))){tied=true;}
      else if(t<best){best=t;kind=1u;first=i;second=axis;tied=false;ambiguous=false;}
     }
    }
   }
   for(var j=i+1u;j<n;j++){
    let p=s.balls[j].xy-b.xy;let v=s.balls[j].zw-b.zw;
    let a=dot(v,v);let q=dot(p,v);let c=dot(p,p)-4.0*radius*radius;
    if(!finiteValue(a)||!finiteValue(q)||!finiteValue(c)){numeric=true;continue;}
    if(a>E*E&&q<0.0){
     let d=q*q-a*c;if(!finiteValue(d)){numeric=true;continue;}
     if(d>=-E*(1.0+q*q+abs(a*c))){
      let t=c/(-q+sqrt(max(d,0.0)));
      if(t>=-E&&t<=horizon){
       if(abs(t-best)<=E*(1.0+abs(best))){tied=true;}
       else if(t<best){best=t;kind=2u;first=i;second=j;tied=false;ambiguous=d<=E*(1.0+q*q+abs(a*c));}
      }
     }
    }
   }
  }
  if(numeric){status=4u;reason=6u;break;}
  if(kind==0u){reason=4u;break;}
  if(tied||ambiguous||best<=E){status=4u;reason=5u;break;}
  for(var i=0u;i<n;i++){let b=s.balls[i];s.balls[i]=vec4<f32>(b.xy+b.zw*best,b.zw);}
  if(kind==1u){s.balls[first][second+2u]=-restitution*s.balls[first][second+2u];}
  else{
   let normal=normalize(s.balls[second].xy-s.balls[first].xy);
   let impulse=-(1.0+restitution)*dot(s.balls[second].zw-s.balls[first].zw,normal)*0.5;
   s.balls[first]=vec4<f32>(s.balls[first].xy,s.balls[first].zw-impulse*normal);
   s.balls[second]=vec4<f32>(s.balls[second].xy,s.balls[second].zw+impulse*normal);
  }
  for(var i=0u;i<n;i++){if(!finiteVector(s.balls[i])){numeric=true;}}
  if(numeric){status=4u;reason=6u;break;}
  s.progress=vec4<f32>(s.progress.x+best,s.progress.y+1.0,f32(kind),f32(first*4u+second));
 }
 states[index]=s;results[index]=vec4<u32>(s.header.x,status,reason,0xffffffffu);
}`;
export function packLinearEventBatch(candidates){
 if(!Array.isArray(candidates)||!candidates.length||candidates.length>4096)throw Error('1..4096 prepared candidates required');
 const rows=new Uint32Array(candidates.length*24),f=new Float32Array(rows.buffer),ids=new Set();
 candidates.forEach((c,index)=>{
  if(![3,4].includes(c.balls.length)||!Number.isInteger(c.maxEvents??1)||(c.maxEvents??1)<1||(c.maxEvents??1)>32)throw Error('Invalid prepared candidate');
  const id=c.id??index;if(!Number.isInteger(id)||id<0||id>0xffffffff||ids.has(id))throw Error('Unique u32 candidate IDs required');ids.add(id);
  const base=index*24;rows.set([id,c.balls.length,c.maxEvents??1,0],base);
  c.balls.forEach((b,i)=>{if(b.length!==4||!b.every(Number.isFinite)||b.some(x=>!Number.isFinite(Math.fround(x))))throw Error('Finite planar p,v required');f.set(b,base+8+i*4);});
 });return rows;
}
export async function createLinearEventGPU(device){
 const start=performance.now();device.pushErrorScope('validation');
 let pipeline;
 try{const module=device.createShaderModule({code:LINEAR_EVENT_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(LINEAR_EVENT_WGSL).length,
  async run({width,height,radius,restitution=1,maxTime=60},rows,{diagnostic=false}={}){
   if(![width,height,radius,restitution,maxTime].every(x=>Number.isFinite(x)&&Number.isFinite(Math.fround(x)))||width<=2*radius||height<=2*radius||radius<=0||restitution<0||restitution>1||maxTime<=0||maxTime>3600||width>100||height>100||radius<1e-4||!(rows instanceof Uint32Array)||!rows.length||rows.length%24||rows.length/24>4096)throw Error('Invalid shared scene or prepared rows');
   const count=rows.length/24,ids=new Set(),values=new Float32Array(rows.buffer,rows.byteOffset,rows.length);
   for(let i=0;i<count;i++){
    if(ids.has(rows[i*24]))throw Error('Unique u32 candidate IDs required');ids.add(rows[i*24]);
    if(values.slice(i*24+4,i*24+8).some(x=>x!==0)||values.slice(i*24+8,(i+1)*24).some(x=>!Number.isFinite(x)||Math.abs(x)>100))throw Error('Prepared linear numeric domain exceeded');
   }
   const buffers=[];const alloc=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
   device.pushErrorScope('validation');
   try{
    const shared=alloc(32,128|8),state=alloc(rows.byteLength,128|8|4),result=alloc(count*16,128|4),read=alloc(count*16,1|8),stateRead=diagnostic?alloc(rows.byteLength,1|8):null;
    device.queue.writeBuffer(shared,0,new Float32Array([width,height,radius,restitution,maxTime,0,0,0]));device.queue.writeBuffer(state,0,rows);
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[shared,state,result].map((buffer,binding)=>({binding,resource:{buffer}}))});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();encoder.copyBufferToBuffer(result,0,read,0,count*16);if(diagnostic)encoder.copyBufferToBuffer(state,0,stateRead,0,rows.byteLength);
    const submitted=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-submitted;
    await read.mapAsync(1);const compact=new Uint32Array(read.getMappedRange()).slice();read.unmap();let observations=null;
    if(diagnostic){await stateRead.mapAsync(1);observations=new Float32Array(stateRead.getMappedRange()).slice();stateRead.unmap();}
    return {compact,observations,metrics:{count,persistentBytes:32+rows.byteLength,resultBytes:count*16,readbackBytes:count*16+(diagnostic?rows.byteLength:0),submitToDoneMs,hardwareSpeedClaim:false,rawShot:false}};
   }finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
  }
 };
}
