/** One-hull continuous entering proof + bounded upper contact intervals. No response. */
import {multiplyWide} from './deterministic-axial.mjs';
import {divideWide} from './deterministic-contact.mjs';
import {qMath} from './deterministic-q-continuation.mjs';
import {createCushionPointCPU,validateCushionHull,cushionIntervalMath,CUSHION_POINT_WGSL} from './deterministic-cushion-geometry.mjs';
import {runCushionMotionCPU,validateCushionMotionRows,CUSHION_TIME_WGSL,CUSHION_MOTION_WGSL} from './deterministic-cushion-time.mjs';
const Q=2**24,NONE=0xffffffff,{term,interval}=qMath,{norm,dot}=cushionIntervalMath;
function options(values){const p=values?.maxPenetrationQuanta,a=values?.approachMarginQuanta??1;if(!Number.isInteger(p)||p<1||p>4096||!Number.isInteger(a)||a<1||a>256)throw RangeError('Explicit penetration/approach budgets');return new Uint32Array([p,a]);}
export const packCushionAdmissionConfig=options;
function pad(distance,denominator){const numerator=4*distance;if(numerator>=2*denominator)return 2*Q;const p=multiplyWide(numerator,Q),r=divideWide(p[0],p[1],denominator);if(!r.valid)throw RangeError('Normal pad division');return r.quotient+(r.remainder?1:0);}
const size=v=>norm(v.map(x=>[x,x]))[1];
const expand=(normal,padding)=>normal.map(([l,h])=>[Math.max(-Q,l-padding),Math.min(Q,h+padding)]);
/** Recompute time and point proofs from original anchors; never accepts cached claims. */
export function runCushionAdmissionCPU(rows,scene,config){
 validateCushionMotionRows(rows);rows=rows.slice();if(!(scene instanceof Uint32Array))throw TypeError('Scene words');scene=scene.slice();const cfg=options(config),time=runCushionMotionCPU(rows,scene),query=createCushionPointCPU(scene),s=new Int32Array(rows.buffer),out=new Uint32Array(rows.length*4),o=new Int32Array(out.buffer);
 for(let b=0;b<rows.length;b+=16){const z=b*4,lo=time[z+4],hi=time[z+5];out.set([rows[b],6,1,scene[1],lo,hi,NONE,0,scene[2],0,0,cfg[0]],z);out[z+17]=time[z+10];out[z+18]=time[z+6];out[z+19]=NONE;
  if(time[z+1]!==6){out[z+1]=time[z+1];out[z+2]=time[z+1]===2?0:1;continue;}
  if(hi-lo!==1||time[z+10]!==lo){out[z+2]=2;continue;}
  const p=Array.from(s.slice(b+4,b+7)),v=Array.from(s.slice(b+7,b+10)),a=Array.from(s.slice(b+10,b+13)),r=s[b+13],at=t=>p.map((x,j)=>x+term(v[j],t,20)+term(a[j],t*t,41));
  const point=center=>{const q=new Uint32Array(16),qs=new Int32Array(q.buffer);q.set([rows[b],96]);qs.set(center,2);qs[5]=r;return query(q);};
  const upperCenter=at(hi),upper=point(upperCenter),us=new Int32Array(upper.buffer);out[z+6]=upper[4];out[z+7]=upper[5];out[z+27]=upper[1];
  if(upper[1]!==1||upper[24]!==1){out[z+2]=3;continue;} // Includes certified exterior side test.
  const upperBox=p.map((x,j)=>interval(x,v[j],a[j],hi,hi)),whole=p.map((x,j)=>interval(x,v[j],a[j],lo,hi)),E=size(upperBox.map((x,j)=>Math.max(Math.abs(x[0]-upperCenter[j]),Math.abs(x[1]-upperCenter[j])))),B=size(whole.map((x,j)=>Math.max(Math.abs(x[0]-upperCenter[j]),Math.abs(x[1]-upperCenter[j]))));out[z+12]=E;out[z+13]=B;
  for(let j=0;j<3;j++)o.set(upperBox[j],z+32+2*j);
  const upperGap=us[9]+E-r;o[z+23]=upperGap;if(upperGap>=0){out[z+2]=4;continue;}out[z+9]|=2;
  const lowerCenter=at(lo),lower=point(lowerCenter),ls=new Int32Array(lower.buffer),lowerBox=p.map((x,j)=>interval(x,v[j],a[j],lo,lo)),El=size(lowerBox.map((x,j)=>Math.max(Math.abs(x[0]-lowerCenter[j]),Math.abs(x[1]-lowerCenter[j]))));out[z+25]=El;out[z+28]=lower[1];const lowerGap=ls[8]-El-r;o[z+22]=lowerGap;
  if(![1,6].includes(lower[1])||lowerGap<=0){out[z+2]=5;continue;}out[z+9]|=1;
  if(us[8]<=B){out[z+2]=7;continue;}out[z+30]=1;out[z+9]|=4;
  const padding=pad(B,us[8]-B),upperPadding=pad(E,us[8]-E),normal=[0,1,2].map(j=>[us[18+2*j],us[19+2*j]]),allNormals=expand(normal,padding),upperNormals=expand(normal,upperPadding),velocity=v.map((x,j)=>[x+term(a[j],a[j]<0?hi:lo,20),x+term(a[j],a[j]<0?lo:hi,20,true)]),approach=dot(velocity,allNormals);out[z+14]=padding;out[z+26]=upperPadding;o.set(approach,z+15);
  for(let j=0;j<3;j++){o.set(velocity[j],z+38+2*j);o.set([us[12+2*j]-E,us[13+2*j]+E],z+44+2*j);o.set(upperNormals[j],z+50+2*j);o.set(allNormals[j],z+56+2*j);}
  if(approach[1]>=-cfg[1]){out[z+2]=8;continue;}out[z+9]|=8;
  const penetration=r-us[8]+E,travel=size(whole.map(x=>x[1]-x[0])),derived=travel+(us[9]-us[8])+2*E;out[z+10]=penetration;out[z+24]=derived;if(penetration>cfg[0]||penetration>derived){out[z+2]=6;continue;}out[z+9]|=16;out[z+1]=1;out[z+2]=0;
 }return {time,result:out};
}
export const CUSHION_ADMISSION_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> times:array<u32>;
@group(0) @binding(3) var<storage,read_write> output:array<u32>;
@group(0) @binding(4) var<storage,read> config:array<u32>;
${CUSHION_POINT_WGSL}
${CUSHION_MOTION_WGSL}
fn normalPad(distance:i32,denominator:i32)->i32{let numerator=4*distance;if(numerator>=2*denominator){return 33554432;}let p=wide(u32(numerator),16777216u);let r=divideWide(p.x,p.y,u32(denominator));if(r.z==0u){bad=true;return 0;}return i32(r.x)+select(0,1,r.y!=0u);}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*16u;if(b>=arrayLength(&rows)){return;}let z=gid.x*64u;for(var j=0u;j<64u;j++){output[z+j]=0u;}let lo=times[z+4u];let hi=times[z+5u];output[z]=rows[b];output[z+1u]=6u;output[z+2u]=1u;output[z+3u]=scene[1];output[z+4u]=lo;output[z+5u]=hi;output[z+6u]=0xffffffffu;output[z+8u]=scene[2];output[z+11u]=config[0];output[z+17u]=times[z+10u];output[z+18u]=times[z+6u];output[z+19u]=0xffffffffu;
 if(times[z+1u]!=6u){output[z+1u]=times[z+1u];output[z+2u]=select(1u,0u,times[z+1u]==2u);return;}if(hi-lo!=1u||times[z+10u]!=lo){output[z+2u]=2u;return;}
 let radius=rv(b+13u);let center=position(b,hi);queryPoint(rows[b],center,radius);let upper=pointResult;output[z+6u]=upper[4];output[z+7u]=upper[5];output[z+27u]=upper[1];if(upper[1]!=1u||upper[24]!=1u){output[z+2u]=3u;return;}
 var upperBox:array<vec2<i32>,3>;var whole:array<vec2<i32>,3>;var error:array<vec2<i32>,3>;var movement:array<vec2<i32>,3>;
 for(var j=0u;j<3u;j++){upperBox[j]=bound(rv(b+4u+j),rv(b+7u+j),rv(b+10u+j),hi,hi);whole[j]=bound(rv(b+4u+j),rv(b+7u+j),rv(b+10u+j),lo,hi);error[j]=vec2<i32>(max(abs(upperBox[j].x-center[j]),abs(upperBox[j].y-center[j])));movement[j]=vec2<i32>(max(abs(whole[j].x-center[j]),abs(whole[j].y-center[j])));output[z+32u+2u*j]=bitcast<u32>(upperBox[j].x);output[z+33u+2u*j]=bitcast<u32>(upperBox[j].y);}
 let E=norm(error).y;let B=norm(movement).y;output[z+12u]=u32(E);output[z+13u]=u32(B);let upperGap=bitcast<i32>(upper[9])+E-radius;output[z+23u]=bitcast<u32>(upperGap);if(upperGap>=0){output[z+2u]=4u;return;}output[z+9u]|=2u;
 let lowerCenter=position(b,lo);queryPoint(rows[b],lowerCenter,radius);let lower=pointResult;for(var j=0u;j<3u;j++){let box=bound(rv(b+4u+j),rv(b+7u+j),rv(b+10u+j),lo,lo);error[j]=vec2<i32>(max(abs(box.x-lowerCenter[j]),abs(box.y-lowerCenter[j])));}let El=norm(error).y;output[z+25u]=u32(El);output[z+28u]=lower[1];let lowerGap=bitcast<i32>(lower[8])-El-radius;output[z+22u]=bitcast<u32>(lowerGap);if((lower[1]!=1u&&lower[1]!=6u)||lowerGap<=0){output[z+2u]=5u;return;}output[z+9u]|=1u;
 let distance=bitcast<i32>(upper[8]);if(distance<=B){output[z+2u]=7u;return;}output[z+30u]=1u;output[z+9u]|=4u;let padding=normalPad(B,distance-B);let upperPadding=normalPad(E,distance-E);output[z+14u]=u32(padding);output[z+26u]=u32(upperPadding);
 var velocity:array<vec2<i32>,3>;var normals:array<vec2<i32>,3>;for(var j=0u;j<3u;j++){let a=rv(b+10u+j);let v=rv(b+7u+j);velocity[j]=vec2<i32>(v+timeTerm(a,select(lo,hi,a<0),20u,false),v+timeTerm(a,select(hi,lo,a<0),20u,true));let n=vec2<i32>(bitcast<i32>(upper[18u+2u*j]),bitcast<i32>(upper[19u+2u*j]));normals[j]=vec2<i32>(max(-16777216,n.x-padding),min(16777216,n.y+padding));output[z+38u+2u*j]=bitcast<u32>(velocity[j].x);output[z+39u+2u*j]=bitcast<u32>(velocity[j].y);output[z+44u+2u*j]=bitcast<u32>(bitcast<i32>(upper[12u+2u*j])-E);output[z+45u+2u*j]=bitcast<u32>(bitcast<i32>(upper[13u+2u*j])+E);output[z+50u+2u*j]=bitcast<u32>(max(-16777216,n.x-upperPadding));output[z+51u+2u*j]=bitcast<u32>(min(16777216,n.y+upperPadding));output[z+56u+2u*j]=bitcast<u32>(normals[j].x);output[z+57u+2u*j]=bitcast<u32>(normals[j].y);}
 let approach=vdot(velocity,normals);output[z+15u]=bitcast<u32>(approach.x);output[z+16u]=bitcast<u32>(approach.y);if(bad){output[z+2u]=9u;return;}if(approach.y>=-i32(config[1])){output[z+2u]=8u;return;}output[z+9u]|=8u;
 var travel:array<vec2<i32>,3>;for(var j=0u;j<3u;j++){travel[j]=vec2<i32>(whole[j].y-whole[j].x);}let penetration=radius-distance+E;let derived=norm(travel).y+bitcast<i32>(upper[9])-distance+2*E;output[z+10u]=u32(penetration);output[z+24u]=u32(derived);if(penetration>i32(config[0])||penetration>derived){output[z+2u]=6u;return;}output[z+9u]|=16u;output[z+1u]=1u;output[z+2u]=0u;
}
`;
export async function createCushionAdmissionGPU(device,scene,config){
 if(!(scene instanceof Uint32Array))throw TypeError('Scene words');scene=scene.slice();const cfg=options(config);validateCushionHull(scene);device.pushErrorScope('validation');const start=performance.now();let timePipeline,admissionPipeline,shared,parameters;
 try{const compile=async code=>{const module=device.createShaderModule({code}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));return device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});};timePipeline=await compile(CUSHION_TIME_WGSL);admissionPipeline=await compile(CUSHION_ADMISSION_WGSL);shared=device.createBuffer({size:scene.byteLength,usage:128|8});parameters=device.createBuffer({size:cfg.byteLength,usage:128|8});device.queue.writeBuffer(shared,0,scene);device.queue.writeBuffer(parameters,0,cfg);}finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 let disposed=false;return {compileMs:performance.now()-start,shaderBytes:[CUSHION_TIME_WGSL,CUSHION_ADMISSION_WGSL].map(x=>new TextEncoder().encode(x).length),dispose(){shared.destroy();parameters.destroy();disposed=true;},async run(rows){if(disposed)throw Error('Disposed');validateCushionMotionRows(rows);rows=rows.slice();const buffers=[];const alloc=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};device.pushErrorScope('validation');try{const input=alloc(rows.byteLength,128|8),time=alloc(rows.byteLength*4,128),output=alloc(rows.byteLength*4,128|4),read=alloc(rows.byteLength*4,1|8);device.queue.writeBuffer(input,0,rows);const encoder=device.createCommandEncoder(),dispatch=(pipeline,bindings)=>{const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:bindings.map((buffer,binding)=>({binding,resource:{buffer}}))}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/16/32));pass.end();};dispatch(timePipeline,[input,shared,time]);dispatch(admissionPipeline,[input,shared,time,output,parameters]);encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength*4);const begin=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return {result,metrics:{candidates:rows.length/16,sharedBytes:scene.byteLength+cfg.byteLength,inputBytes:rows.byteLength,residentTimeBytes:rows.byteLength*4,outputBytes:rows.byteLength*4,readbackBytes:rows.byteLength*4,dispatches:2,intermediateReadbacks:0,submitToDoneMs:performance.now()-begin,physicalAcceptance:false}};}finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}}};
}
