/** Conservative first unresolved time interval, NOT a collision/TOI certificate. */
import {multiplyWide} from './deterministic-axial.mjs';
import {qMath} from './deterministic-q-continuation.mjs';
import {validateCushionHull,createCushionPointCPU,CUSHION_POINT_WGSL} from './deterministic-cushion-geometry.mjs';
const Q=2**24,T=2**20,NONE=0xffffffff,{term,interval}=qMath;
export const CUSHION_TIME=Object.freeze({rowWords:16,outputWords:64,maxTicks:65535,maxNodes:8192,defaultMaxNodes:256,maxBatchNodes:32768,maxCandidates:128,physicalAcceptance:false});
export function packCushionMotion(cases){
 if(!Array.isArray(cases)||!cases.length||cases.length>128)throw RangeError('1..128 motions');const rows=new Uint32Array(cases.length*16),s=new Int32Array(rows.buffer),ids=new Set();for(let k=0;k<cases.length;k++){const c=cases[k],h=c.horizonTicks,n=c.maxNodes??256;if(!Number.isInteger(c.id)||c.id<0||c.id>NONE||ids.has(c.id)||!Number.isInteger(h)||h<1||h>65535||!Number.isInteger(n)||n<1||n>8192||!Number.isFinite(c.radius)||c.radius<4096/Q||c.radius>1)throw RangeError('Motion header');ids.add(c.id);for(const [i,key] of ['position','velocity','acceleration'].entries())if(!Array.isArray(c[key])||c[key].length!==3||c[key].some(x=>!Number.isFinite(x)||Math.abs(x)>(i===0?4:16)))throw RangeError('Motion domain');const b=k*16;rows.set([c.id,h,n,0],b);s.set([...c.position,...c.velocity,...c.acceleration,c.radius].map(x=>Math.floor(x*Q+.5)),b+4);}return rows;
}
export function validateCushionMotionRows(rows){if(rows instanceof Uint32Array&&Object.prototype.toString.call(rows.buffer)==='[object SharedArrayBuffer]')throw TypeError('Shared motion rows unsupported');if(!(rows instanceof Uint32Array)||!rows.length||rows.length%16||rows.length/16>128)throw RangeError('Motion rows');let budget=0;for(let i=0;i<rows.length;i+=16)budget+=Math.min(rows[i+2],8192);if(budget>32768)throw RangeError('Batch node budget');}
const cmp=(a,b)=>a[1]===b[1]?Math.sign(a[0]-b[0]):Math.sign(a[1]-b[1]);
function radiusBound(v){let l=0,h=0;for(const x of v){const p=multiplyWide(x,x),n=(l+p[0])>>>0;h=(h+p[1]+(n<l?1:0))>>>0;l=n;}let low=0,high=0x7fffffff;while(low<high){const mid=Math.floor((low+high+1)/2);if(cmp(multiplyWide(mid,mid),[l,h])<=0)low=mid;else high=mid-1;}return low+(cmp(multiplyWide(low,low),[l,h])!==0?1:0);}
/** CPU mirror; point queries are CPU-only reference calls, never GPU preparation. */
export function runCushionMotionCPU(rows,scene){
 validateCushionMotionRows(rows);if(!(scene instanceof Uint32Array))throw TypeError('Scene words');scene=scene.slice();const pointQuery=createCushionPointCPU(scene);const s=new Int32Array(rows.buffer,rows.byteOffset,rows.length),out=new Uint32Array(rows.length*4),o=new Int32Array(out.buffer);
 for(let b=0;b<rows.length;b+=16){const z=b*4,h=rows[b+1],budget=rows[b+2],radius=s[b+13];out.set([rows[b],4,1,scene[1],0,0,0,h,NONE,1],z);
  if(h<1||h>65535||budget<1||budget>8192||rows[b+3]||rows[b+14]||rows[b+15]||radius<4096||radius>Q||Array.from(s.slice(b+4,b+13)).some((x,i)=>Math.abs(x)>(i<3?4:16)*Q))continue;
  const p=Array.from(s.slice(b+4,b+7)),v=Array.from(s.slice(b+7,b+10)),a=Array.from(s.slice(b+10,b+13));if(p.some((x,j)=>{const r=interval(x,v[j],a[j],0,h);return r[0]<-4*Q||r[1]>4*Q;})){out[z+2]=5;continue;}
  const at=t=>p.map((x,j)=>x+term(v[j],t,20)+term(a[j],t*t,41));
  const query=center=>{const q=new Uint32Array(16),qs=new Int32Array(q.buffer);q.set([rows[b],96]);qs.set(center,2);qs[5]=radius;return pointQuery(q);};
  const initial=query(p);if(![1,6].includes(initial[1])||initial[8]<=radius){out[z+2]=2;out.set(initial,z+32);o.set(p,z+12);o.set(v,z+15);continue;}
  const stack=[[0,h]];let status=2,reason=0,lo=h,hi=h,nodes=0,prefix=0;
  while(stack.length){if(nodes>=budget){status=5;reason=4;[lo,hi]=stack[stack.length-1];break;}const [l,u]=stack.pop();nodes++;const mid=Math.floor((l+u)/2),center=at(mid),point=query(center);if(point[1]===4&&point[2]!==2&&point[2]!==3){status=4;reason=5;lo=l;hi=u;break;}
   const distance=[1,6].includes(point[1])?point[8]:0,extent=p.map((x,j)=>{const r=interval(x,v[j],a[j],l,u);return Math.max(Math.abs(r[0]-center[j]),Math.abs(r[1]-center[j]));}),motion=radiusBound(extent);
   if(distance>radius+motion){prefix=u;continue;}
   if(u-l<=1){status=6;reason=3;lo=l;hi=u;break;}
   const m=Math.floor((l+u)/2);stack.push([m,u],[l,m]);
  }
  out[z+1]=status;out[z+2]=reason;out[z+4]=lo;out[z+5]=hi;out[z+6]=nodes;out[z+10]=prefix;const upper=at(hi),point=query(upper);o.set(upper,z+12);o.set(v.map((x,j)=>x+term(a[j],hi,20)),z+15);out.set(point,z+32);out[z+18]=point[1];
 }return out;
}
export const CUSHION_MOTION_WGSL=`
fn rv(i:u32)->i32{return bitcast<i32>(rows[i]);}
fn timeTerm(a:i32,t:u32,shift:u32,ceil:bool)->i32{let p=wide(u32(abs(a)),t);var q=0u;var rem=false;if(shift==20u){q=(p.y<<12u)|(p.x>>20u);rem=(p.x&1048575u)!=0u;}else{q=p.y>>9u;rem=p.x!=0u||(p.y&511u)!=0u;}if(a<0){return -i32(q)-select(0,1,!ceil&&rem);}return i32(q)+select(0,1,ceil&&rem);}
fn bound(p:i32,v:i32,a:i32,l:u32,h:u32)->vec2<i32>{return vec2<i32>(p+timeTerm(v,select(l,h,v<0),20u,false)+timeTerm(a,select(l*l,h*h,a<0),41u,false),p+timeTerm(v,select(h,l,v<0),20u,true)+timeTerm(a,select(h*h,l*l,a<0),41u,true));}
fn position(b:u32,t:u32)->vec3<i32>{var p:vec3<i32>;for(var j=0u;j<3u;j++){p[j]=rv(b+4u+j)+timeTerm(rv(b+7u+j),t,20u,false)+timeTerm(rv(b+10u+j),t*t,41u,false);}return p;}
`;
// Explicit shared full point evaluator: no duplicate feature formulas/source slicing.
export const CUSHION_TIME_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read_write> output:array<u32>;
${CUSHION_POINT_WGSL}
${CUSHION_MOTION_WGSL}
fn distanceLower(center:vec3<i32>)->i32{queryPoint(0u,center,4096);if(pointResult[1]==1u||pointResult[1]==6u){return bitcast<i32>(pointResult[8]);}return 0;}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*16u;if(b>=arrayLength(&rows)){return;}let z=b*64u/16u;for(var j=0u;j<64u;j++){output[z+j]=0u;}output[z]=rows[b];output[z+1u]=4u;output[z+2u]=1u;output[z+3u]=scene[1];output[z+7u]=rows[b+1u];output[z+8u]=0xffffffffu;output[z+9u]=1u;
 let h=rows[b+1u];let budget=rows[b+2u];let radius=rv(b+13u);var invalid=h<1u||h>65535u||budget<1u||budget>8192u||rows[b+3u]!=0u||rows[b+14u]!=0u||rows[b+15u]!=0u||radius<4096||radius>16777216;for(var j=0u;j<9u;j++){let x=rv(b+4u+j);let limit=select(268435456,67108864,j<3u);if(x< -limit||x>limit){invalid=true;}}if(invalid){return;}
 for(var j=0u;j<3u;j++){let range=bound(rv(b+4u+j),rv(b+7u+j),rv(b+10u+j),0u,h);if(range.x< -67108864||range.y>67108864){output[z+2u]=5u;return;}}
 bad=false;queryPoint(rows[b],position(b,0u),radius);if((pointResult[1]!=1u&&pointResult[1]!=6u)||pointResult[8]<=u32(radius)){output[z+2u]=2u;for(var j=0u;j<32u;j++){output[z+32u+j]=pointResult[j];}let p=position(b,0u);for(var j=0u;j<3u;j++){output[z+12u+j]=bitcast<u32>(p[j]);output[z+15u+j]=rows[b+7u+j];}return;}
 var stack:array<vec2<u32>,17>;stack[0]=vec2<u32>(0u,h);var count=1u;var nodes=0u;var status=2u;var reason=0u;var lo=h;var hi=h;var prefix=0u;
 loop{if(count==0u){break;}if(nodes>=budget){status=5u;reason=4u;lo=stack[count-1u].x;hi=stack[count-1u].y;break;}count--;let range=stack[count];let l=range.x;let u=range.y;nodes++;let mid=(l+u)/2u;let center=position(b,mid);let distance=distanceLower(center);if(bad){status=4u;reason=5u;lo=l;hi=u;break;}
  var extent:array<vec2<i32>,3>;for(var j=0u;j<3u;j++){let r=bound(rv(b+4u+j),rv(b+7u+j),rv(b+10u+j),l,u);extent[j]=vec2<i32>(max(abs(r.x-center[j]),abs(r.y-center[j])));}let motion=norm(extent).y;
  if(distance>radius+motion){prefix=u;continue;}if(u-l<=1u){status=6u;reason=3u;lo=l;hi=u;break;}
  let m=(l+u)/2u;stack[count]=vec2<u32>(m,u);stack[count+1u]=vec2<u32>(l,m);count+=2u;
 }
 output[z+1u]=status;output[z+2u]=reason;output[z+4u]=lo;output[z+5u]=hi;output[z+6u]=nodes;output[z+10u]=prefix;let upper=position(b,hi);for(var j=0u;j<3u;j++){output[z+12u+j]=bitcast<u32>(upper[j]);output[z+15u+j]=bitcast<u32>(rv(b+7u+j)+timeTerm(rv(b+10u+j),hi,20u,false));}
queryPoint(rows[b],upper,radius);for(var j=0u;j<32u;j++){output[z+32u+j]=pointResult[j];}output[z+18u]=pointResult[1];
}
`;
export async function createCushionMotionGPU(device,scene){
 if(!(scene instanceof Uint32Array))throw TypeError('Scene words');scene=scene.slice();validateCushionHull(scene);device.pushErrorScope('validation');let pipeline,shared;const start=performance.now();try{const module=device.createShaderModule({code:CUSHION_TIME_WGSL}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});shared=device.createBuffer({size:scene.byteLength,usage:128|8});device.queue.writeBuffer(shared,0,scene);}finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 let disposed=false;return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(CUSHION_TIME_WGSL).length,dispose(){shared.destroy();disposed=true;},async run(rows){if(disposed)throw Error('Disposed');validateCushionMotionRows(rows);const buffers=[];const alloc=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};device.pushErrorScope('validation');try{const input=alloc(rows.byteLength,128|8),output=alloc(rows.byteLength*4,128|4),read=alloc(rows.byteLength*4,1|8);device.queue.writeBuffer(input,0,rows);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,shared,output].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/16/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength*4);const begin=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();return {result,metrics:{candidates:rows.length/16,sharedBytes:scene.byteLength,inputBytes:rows.byteLength,outputBytes:rows.byteLength*4,readbackBytes:rows.byteLength*4,submitToDoneMs:performance.now()-begin,physicalAcceptance:false}};}finally{buffers.forEach(b=>b.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}}};
}
