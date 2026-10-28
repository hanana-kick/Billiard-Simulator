// SPDX-License-Identifier: Apache-2.0
// Native-f32 geometry port of PhysicsLab.pose/strike. Not clearance or a shot.
// Explicit versioned f32 input; original JS parameters remain host replay metadata.
export const DIRECT_POSE_PROFILE=Object.freeze({name:'native-f32-raw-pose-v1',maxAbsAngleDegrees:3600,
 absoluteTolerance:2e-5,relativeTolerance:2e-5,clearanceImplemented:false,conservativeClearance:true,clearanceGuardMeters:0.005,physicalAdmission:false,
 rawRowBytes:32,stateBytes:320,sharedBytes:64});
export const POSE_FIELDS=Object.freeze(['direction','side','up','surface','contact','tip','rotation','shaftCenter','bodyPosition','headPosition','guidePosition','initialVelocity','shaftColliderCenter','neckColliderCenter','tipColliderCenter','shaftLocalCenter','neckLocalCenter']);
export function packRawPoseRows(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>4096)throw new RangeError('1..4096 raw rows');
 const words=new Uint32Array(rows.length*8),values=new Float32Array(words.buffer),ids=new Set();
 rows.forEach((r,i)=>{if(!Number.isInteger(r.id)||r.id<0||r.id>=0xffffffff||ids.has(r.id))throw new RangeError('Distinct candidate ids');ids.add(r.id);
 const p=['angle','elevation','speed','tipX','tipY'].map(k=>r[k]);if(!p.every(v=>typeof v==='number'))throw new TypeError('Number parameters required');
 let status=0,reason=0;
 if(!p.every(Number.isFinite)){status=8;reason=1;}
 else if(Math.hypot(r.tipX,r.tipY)>=1||r.speed<=0||r.speed>10||r.elevation<0||r.elevation>85){status=8;reason=2;}
 else if(Math.abs(r.angle)>3600||p.some(v=>!Number.isFinite(Math.fround(v)))||Math.fround(r.speed)===0){status=4;reason=5;}
 words[i*8]=r.id;words[i*8+1]=status;values.set(p,i*8+2);words[i*8+7]=reason;
 });return words;
}
// Outward rounding applies once to shared geometry, never per-candidate physics.
export function outwardBoundF32(value,lower){
 const f=Float32Array.of(value),bits=new Uint32Array(f.buffer);
 if(lower?f[0]>value:f[0]<value){if(f[0]===0)bits[0]=lower?0x80000001:1;else bits[0]+=lower===(f[0]>0)?-1:1;}
 return f[0];
}
export function packPoseScene(scene){const a=new Float32Array(16);a.set([...scene.center,scene.radius,scene.tipRadius,scene.cueLength,scene.flexibleLength,scene.retract,scene.obstacles?.length??0,scene.cueRadius??.011,scene.neckRadius??.0058]);if(!Array.from(a).every(Number.isFinite)||a[3]<=0||a[4]<=0||a[5]<=a[6]||a[6]<=0||a[7]!==Math.fround(.012)||scene.center.some(v=>Math.abs(v)>10)||a[5]>2||a[9]<=0||a[10]<=0)throw new RangeError('Finite real cue geometry required');return a;}
export function decodePose(words,index){const b=index*80,f=new Float32Array(words.buffer,words.byteOffset,words.length);return {id:words[b],status:words[b+1],pass:words[b+2]===0xffffffff?null:words[b+2],reason:words[b+3],clearance:{code:words[b+72],pairs:words[b+73],obstacle:words[b+74],part:words[b+75],minimumMargin:f[b+76]},...Object.fromEntries(POSE_FIELDS.map((k,i)=>[k,Array.from(f.slice(b+4+i*4,b+4+i*4+(k==='rotation'?4:3)))]))};}
export const RAW_POSE_WGSL=`
@group(0) @binding(0) var<storage,read> scene:array<f32>;
@group(0) @binding(1) var<storage,read> raw:array<u32>;
@group(0) @binding(2) var<storage,read_write> state:array<u32>;
@group(0) @binding(3) var<storage,read> obstacles:array<u32>;
// Localized native-f32 trig: SwiftShader builtins failed the frozen pose budget.
// Range reduction happens in degrees, then reflection to [-pi/2, pi/2].
// Ordinary bounded Horner polynomial, not binary64 emulation or a math VM.
fn sincosDegrees(degrees:f32)->vec2<f32>{
 let reduced=degrees-360.0*round(degrees/360.0);var x=reduced*0.017453292519943295;var cosineSign=1.0;
 if(x>1.5707963267948966){x=3.141592653589793-x;cosineSign= -1.0;}
 if(x< -1.5707963267948966){x= -3.141592653589793-x;cosineSign= -1.0;}
 let z=x*x;
 let sine=x*(1.0+z*(-0.16666666666666667+z*(0.008333333333333333+z*(-0.0001984126984126984+z*(0.0000027557319223985893+z*(-0.00000002505210838544172+z*0.00000000016059043836821613))))));
 let cosine=1.0+z*(-0.5+z*(0.041666666666666664+z*(-0.001388888888888889+z*(0.0000248015873015873+z*(-0.0000002755731922398589+z*(0.00000000208767569878681+z*(-0.000000000011470745597729725)))))));
 return vec2<f32>(sine,cosine*cosineSign);
}
// Sufficient separation only; unresolved overlap is NOT a physical collision.
// Capsule-envelope AABBs enclose the exact cylinders through the full sweep.
fn clearance(b:u32,direction:vec3<f32>,tip:vec3<f32>,shaftLocal:vec3<f32>,neckLocal:vec3<f32>){
 let count=u32(scene[8]);if(count==0u){return;}var pairs=0u;var margin=1000.0;
 for(var i=0u;i<count;i++){
  let at=i*8u;let otherMin=vec3<f32>(bitcast<f32>(obstacles[at]),bitcast<f32>(obstacles[at+1u]),bitcast<f32>(obstacles[at+2u]));
  let otherMax=vec3<f32>(bitcast<f32>(obstacles[at+4u]),bitcast<f32>(obstacles[at+5u]),bitcast<f32>(obstacles[at+6u]));
  for(var part=0u;part<3u;part++){
   if(part==2u&&obstacles[at+3u]==1u){continue;}pairs+=1u;
   var center=tip;var extent=vec3<f32>(scene[4]);
   if(part==0u){center=tip+direction*shaftLocal.y;extent=abs(direction)*((scene[5]-scene[6])/2.0)+vec3<f32>(scene[9]);}
   if(part==1u){center=tip+direction*neckLocal.y;extent=abs(direction)*(scene[6]/2.0)+vec3<f32>(scene[10]);}
   let end=center+direction*scene[7];let lower=min(center,end)-extent;let upper=max(center,end)+extent;
   let gap=max(otherMin-upper,lower-otherMax);let separating=max(max(gap.x,gap.y),gap.z)-0.005;
   margin=min(margin,separating);
   if(separating<=0.0){state[b+72u]=2u;state[b+73u]=pairs;state[b+74u]=i;state[b+75u]=part;state[b+76u]=bitcast<u32>(margin);return;}
  }
 }
 state[b+72u]=1u;state[b+73u]=pairs;state[b+74u]=0xffffffffu;state[b+75u]=0xffffffffu;state[b+76u]=bitcast<u32>(margin);
}
fn put(base:u32,slot:u32,v:vec3<f32>){let at=base+4u+slot*4u;state[at]=bitcast<u32>(v.x);state[at+1u]=bitcast<u32>(v.y);state[at+2u]=bitcast<u32>(v.z);}
fn outcome(base:u32,status:u32,reason:u32){state[base+1u]=status;state[base+2u]=0xffffffffu;state[base+3u]=reason;}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let row=gid.x;if(row>=arrayLength(&raw)/8u){return;}let b=row*80u;let r=row*8u;state[b]=raw[r];
 if(raw[r+1u]!=0u){outcome(b,raw[r+1u],raw[r+7u]);return;}
 var p:array<f32,5>;for(var j=0u;j<5u;j++){p[j]=bitcast<f32>(raw[r+2u+j]);}
 let angle=p[0];let elevation=p[1];let speed=p[2];let x=p[3];let y=p[4];let radial=x*x+y*y;
 // Raw inputs remain observable. Quantization near the tip domain boundary is
 // unsupported rather than a manufactured source-valid/source-invalid result.
 if(abs(radial-1.0)<0.000004){outcome(b,4u,5u);return;}
 if(radial>=1.0||speed<=0.0||speed>10.0||elevation<0.0||elevation>85.0){outcome(b,8u,2u);return;}
 if(abs(angle)>3600.0){outcome(b,4u,5u);return;}
 let a=sincosDegrees(angle);let e=sincosDegrees(elevation);
 let direction=vec3<f32>(a.y*e.y,-e.x,a.x*e.y);
 let side=vec3<f32>(-a.x,0.0,a.y);let up=cross(side,direction);
 let surface=side*x+up*y+direction*(-sqrt(max(0.0001,1.0-x*x-y*y)));
 let center=vec3<f32>(scene[0],scene[1],scene[2]);let tipRadius=scene[4];let cueLength=scene[5];let flexLength=scene[6];
 let contact=center+surface*scene[3];let tip=(center+surface*(scene[3]+tipRadius))-direction*scene[7];
 let normal=normalize(direction);let s=sqrt((1.0+normal.y)*2.0);var rotation=vec4<f32>(normal.z/s,0.0,-normal.x/s,s/2.0);
 if(normal.y< -0.999999){rotation=vec4<f32>(1.0,0.0,0.0,0.0);}
 let shaftCenter=tip-direction*(tipRadius+cueLength/2.0);let shaftLocal=vec3<f32>(0.0,-tipRadius-flexLength-(cueLength-flexLength)/2.0,0.0);let neckLocal=vec3<f32>(0.0,-tipRadius-flexLength/2.0,0.0);
 put(b,0u,direction);put(b,1u,side);put(b,2u,up);put(b,3u,surface);put(b,4u,contact);put(b,5u,tip);
 for(var j=0u;j<4u;j++){state[b+28u+j]=bitcast<u32>(rotation[j]);}
 put(b,7u,shaftCenter);put(b,8u,tip);put(b,9u,tip);put(b,10u,tip);put(b,11u,direction*speed);
 put(b,12u,tip+direction*shaftLocal.y);put(b,13u,tip+direction*neckLocal.y);put(b,14u,tip);put(b,15u,shaftLocal);put(b,16u,neckLocal);
 clearance(b,direction,tip,shaftLocal,neckLocal);
 // Even certified-separated geometry has no physical integration authority.
 outcome(b,4u,6u);
}`;

// Own scene and candidate state once. Future physical chunks must use this
// resident ownership shape, not per-step input upload/full-state readback.
export async function createRawPoseBank(device,scene,rows){
 const shared=packPoseScene(scene),input=packRawPoseRows(rows),count=rows.length,owned=[];
 const roster=scene.obstacles??[];if(roster.length>128)throw new RangeError('Bounded complete obstacle roster');
 const obstacleWords=new Uint32Array(Math.max(1,roster.length)*8),obstacleFloats=new Float32Array(obstacleWords.buffer);
 if(roster.length&&roster.filter(o=>o.selected===true).length!==1)throw new RangeError('Exactly one selected obstacle');
 roster.forEach((o,i)=>{if(!Array.isArray(o.min)||!Array.isArray(o.max)||o.min.length!==3||o.max.length!==3||[...o.min,...o.max].some(v=>!Number.isFinite(v)||Math.abs(v)>10)||o.min.some((v,j)=>v>o.max[j])||typeof o.selected!=='boolean')throw new RangeError('Finite immutable world AABBs required');obstacleFloats.set(o.min.map(v=>outwardBoundF32(v,true)),i*8);obstacleFloats.set(o.max.map(v=>outwardBoundF32(v,false)),i*8+4);obstacleWords[i*8+3]=+o.selected;});
 const make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};
 let closed=false,busy=false,initialized=false;const start=performance.now();
 device.pushErrorScope('validation');
 try{
  const module=device.createShaderModule({code:RAW_POSE_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  const material=make(64,136),raw=make(input.byteLength,136),state=make(count*320,132),read=make(count*320,9),obstacleBuffer=make(obstacleWords.byteLength,136);
  device.queue.writeBuffer(material,0,shared);device.queue.writeBuffer(raw,0,input);device.queue.writeBuffer(obstacleBuffer,0,obstacleWords);
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[material,raw,state,obstacleBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const compileAndAllocateMs=performance.now()-start;
  return Object.freeze({originalParameters:Object.freeze(rows.map(r=>Object.freeze({...r}))),metrics:{count,shaderBytes:new TextEncoder().encode(RAW_POSE_WGSL).length,allocatedBufferBytes:64+obstacleWords.byteLength+count*(32+320+320),compileAndAllocateMs,sharedUploads:1,rawUploads:1,clearanceImplemented:false,fullShot:false},
   async initialize(){if(closed||busy||initialized)throw Error('Raw pose bank unavailable/already initialized');busy=true;device.pushErrorScope('validation');try{const e=device.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(pipeline);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil(count/32));p.end();const t=performance.now();device.queue.submit([e.finish()]);await device.queue.onSubmittedWorkDone();initialized=true;return {submitToDoneMs:performance.now()-t,status:roster.length?'clearance-certificate-only-no-physics':'unsupported-clearance'};}finally{busy=false;const error=await device.popErrorScope();if(error)throw Error(error.message);}},
   async readDiagnostic(){if(closed||busy||!initialized)throw Error('Initialized idle pose bank required');busy=true;try{const e=device.createCommandEncoder();e.copyBufferToBuffer(state,0,read,0,count*320);device.queue.submit([e.finish()]);await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return result;}finally{busy=false;}},
   dispose(){if(busy)throw Error('Cannot dispose busy bank');if(!closed){closed=true;owned.forEach(b=>b.destroy());}}
  });
 }catch(error){owned.forEach(b=>b.destroy());throw error;}finally{const error=await device.popErrorScope();if(error){owned.forEach(b=>b.destroy());throw Error(error.message);}}
}
