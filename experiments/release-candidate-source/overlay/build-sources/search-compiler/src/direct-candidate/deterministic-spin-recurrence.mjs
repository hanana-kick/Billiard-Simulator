/** Separable normal-spin stop recurrence. Original axial anchors are immutable;
 * no pair response, quaternion or source-world authority.64-word rows retain
 * the48-word axial layout plus four [lower,upper,mask,exactMask] stop records.
 * Input header4=max spin-event groups,5..7 and trace words must be zero.
 */
import {AXIAL_INTEGER_KERNEL_WGSL,multiplyWide,packSourceAxialCandidates,runAxialIntegerCPU} from './deterministic-axial.mjs';
import {prepareCollinearSegment} from './source-law-collinear-segment.mjs';
const T=2**20,NONE=0xffffffff;
const compare=(a,b)=>a[1]===b[1]?Math.sign(a[0]-b[0]):Math.sign(a[1]-b[1]);
function stopBracket(w,rate,h){
 if(w===0||rate===0)return null;
 const stopProduct=multiplyWide(Math.abs(w),T),a=Math.abs(rate);
 if(compare(multiplyWide(a,h),stopProduct)<0)return null;
 let lo=1,hi=h;while(lo<hi){const mid=(lo+hi)>>>1;if(compare(multiplyWide(a,mid),stopProduct)>=0)hi=mid;else lo=mid+1;}
 const exact=compare(multiplyWide(a,lo),stopProduct)===0;return {lower:exact?lo:lo-1,upper:lo,exact};
}
export function packSourceSpinRecurrence(candidates){
 const neutral=candidates.map(c=>({...c,bodies:c.bodies.map(b=>({...b,angular:[b.angular[0],0,b.angular[2]]}))}));
 const packed=packSourceAxialCandidates(neutral),rows=new Uint32Array(candidates.length*64),signed=new Int32Array(rows.buffer);
 candidates.forEach((c,k)=>{
  const max=c.maxSpinEvents??4;if(!Number.isInteger(max)||max<1||max>4)throw RangeError('1..4 spin event groups');
  const b=k*64;rows.set(packed.rows.subarray(k*48,k*48+48),b);rows[b+4]=max;
  c.bodies.forEach((body,i)=>{
   const original=prepareCollinearSegment(body,c.material);if(!original.eligible)throw RangeError('Original source-law spin state');
   const w=Math.round(body.angular[1]*T),rate=Math.round(original.angularAcceleration[1]*T);
   if(![w,rate].every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=2**30))throw RangeError('Normal spin numeric domain');
   signed[b+12+i*10]=w;signed[b+15+i*10]=w===0?0:rate;
  });
 });
 return {rows,provenance:packed.provenance.map(p=>({...p,normalSpin:'separable encoded clamp; stop bracket recorded',attitudeComplete:false,originalContinuumContactCertified:false}))};
}
function validRows(rows){if(!(rows instanceof Uint32Array)||!rows.length||rows.length%64||rows.length/64>4096)throw TypeError('Complete bounded64-word recurrence rows');}
export function runSpinRecurrenceCPU(rows){
 validRows(rows);const result=rows.slice();
 for(let b=0;b<rows.length;b+=64){
  const origin=rows.slice(b,b+48),s=new Int32Array(origin.buffer),n=origin[1],h=origin[2],budget=origin[3],maxEvents=origin[4];origin.fill(0,4,8);
  let status=2,reason=0,elapsed=0,upper=0,pair=NONE,nodes=0,groups=0;
  let invalid=![3,4].includes(n)||h<1||h>65535||budget<1||budget>8192||maxEvents<1||maxEvents>4||rows.slice(b+5,b+8).some(x=>x!==0)||rows.slice(b+48,b+64).some(x=>x!==0);
  for(let i=0;i<4;i++)for(let j=0;j<10;j++)if(Math.abs(s[8+i*10+j])>(j>=3&&j<=8?2**30:2**28))invalid=true;
  for(let i=0;i<n&&i<4;i++){const w=s[12+i*10],rate=s[15+i*10];if((w===0&&rate!==0)||(w!==0&&rate!==0&&Math.sign(w)===Math.sign(rate)))invalid=true;}
  if(invalid){status=4;reason=1;}
  else for(let phase=0;phase<5;phase++){
   let next=null,mask=0,exactMask=0,lower=0;
   for(let i=0;i<n;i++){
    const stop=stopBracket(s[12+i*10],s[15+i*10],h);if(!stop)continue;
    if(next===null||stop.upper<next){next=stop.upper;lower=stop.lower;mask=1<<i;exactMask=stop.exact?1<<i:0;}
    else if(stop.upper===next){lower=Math.min(lower,stop.lower);mask|=1<<i;if(stop.exact)exactMask|=1<<i;}
   }
   if(nodes>=budget){status=5;reason=4;upper=elapsed;break;}
   origin[2]=next??h;origin[3]=budget-nodes;
   const segment=runAxialIntegerCPU(origin);nodes+=segment[6];
   if(segment[1]===4||segment[1]===5){status=segment[1];reason=segment[2];upper=Math.max(elapsed,segment[4]);break;}
   if(segment[1]===1){
    if(next!==null&&segment[4]>=next){status=4;reason=7;upper=next;break;}
    result.set(segment.subarray(8),b+8);status=1;elapsed=segment[3];upper=segment[4];pair=segment[5];break;
   }
   if(next!==null&&groups>=maxEvents){status=5;reason=5;upper=elapsed;break;}
   result.set(segment.subarray(8),b+8);elapsed=next??h;upper=elapsed;
   if(next===null)break;
   for(let i=0;i<n;i++)if(mask&(1<<i)){origin[12+i*10]=0;origin[15+i*10]=0;result[b+12+i*10]=0;result[b+15+i*10]=0;}
   result.set([lower,next,mask,exactMask],b+48+groups*4);groups++;
   if(elapsed===h)break;
  }
  result.set([rows[b],status,reason,elapsed,upper,pair,nodes,NONE],b);
 }return result;
}
export const SPIN_RECURRENCE_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read_write> results:array<u32>;
${AXIAL_INTEGER_KERNEL_WGSL}
fn wideCompare(a:vec2<u32>,b:vec2<u32>)->i32{
 if(a.y<b.y){return -1;}if(a.y>b.y){return 1;}if(a.x<b.x){return -1;}if(a.x>b.x){return 1;}return 0;
}
fn spinStop(w:i32,rate:i32,h:u32)->vec3<u32>{
 if(w==0||rate==0){return vec3<u32>(0u);}
 let stopProduct=wide(u32(abs(w)),1048576u);let a=u32(abs(rate));
 if(wideCompare(wide(a,h),stopProduct)<0){return vec3<u32>(0u);}
 var lo=1u;var hi=h;
 loop{if(lo>=hi){break;}let mid=(lo+hi)>>1u;if(wideCompare(wide(a,mid),stopProduct)>=0){hi=mid;}else{lo=mid+1u;}}
 let exact=wideCompare(wide(a,lo),stopProduct)==0;return vec3<u32>(select(lo-1u,lo,exact),lo,select(0u,1u,exact));
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let b=gid.x*64u;if(b>=arrayLength(&rows)){return;}
 for(var j=0u;j<64u;j++){results[b+j]=rows[b+j];}
 for(var j=0u;j<48u;j++){segmentInput[j]=rows[b+j];}
 let n=segmentInput[1];let h=segmentInput[2];let budget=segmentInput[3];let maxEvents=segmentInput[4];
 for(var j=4u;j<8u;j++){segmentInput[j]=0u;}
 var status=2u;var reason=0u;var elapsed=0u;var upper=0u;var pair=0xffffffffu;var nodes=0u;var groups=0u;
 var invalid=(n!=3u&&n!=4u)||h<1u||h>65535u||budget<1u||budget>8192u||maxEvents<1u||maxEvents>4u;
 for(var j=5u;j<8u;j++){if(rows[b+j]!=0u){invalid=true;}}
 for(var j=48u;j<64u;j++){if(rows[b+j]!=0u){invalid=true;}}
 for(var i=0u;i<4u;i++){for(var j=0u;j<10u;j++){
  let x=value(8u+i*10u+j);let limit=select(268435456,1073741824,j>=3u&&j<=8u);if(x< -limit||x>limit){invalid=true;}
 }}
 for(var i=0u;i<min(n,4u);i++){let w=value(12u+i*10u);let rate=value(15u+i*10u);
  if((w==0&&rate!=0)||(w!=0&&rate!=0&&((w>0)==(rate>0)))){invalid=true;}
 }
 if(invalid){status=4u;reason=1u;}
 else{for(var phase=0u;phase<5u;phase++){
  var next=0u;var mask=0u;var exactMask=0u;var lower=0u;
  for(var i=0u;i<n;i++){
   let stop=spinStop(value(12u+i*10u),value(15u+i*10u),h);if(stop.y==0u){continue;}
   if(next==0u||stop.y<next){next=stop.y;lower=stop.x;mask=1u<<i;exactMask=select(0u,1u<<i,stop.z!=0u);}
   else if(stop.y==next){lower=min(lower,stop.x);mask|=1u<<i;if(stop.z!=0u){exactMask|=1u<<i;}}
  }
  if(nodes>=budget){status=5u;reason=4u;upper=elapsed;break;}
  segmentInput[2]=select(h,next,next!=0u);segmentInput[3]=budget-nodes;
  solveAxialSegment();nodes+=segmentOutput[6];
  if(segmentOutput[1]==4u||segmentOutput[1]==5u){status=segmentOutput[1];reason=segmentOutput[2];upper=max(elapsed,segmentOutput[4]);break;}
  if(segmentOutput[1]==1u){
   if(next!=0u&&segmentOutput[4]>=next){status=4u;reason=7u;upper=next;break;}
   for(var j=8u;j<48u;j++){results[b+j]=segmentOutput[j];}status=1u;elapsed=segmentOutput[3];upper=segmentOutput[4];pair=segmentOutput[5];break;
  }
  if(next!=0u&&groups>=maxEvents){status=5u;reason=5u;upper=elapsed;break;}
  for(var j=8u;j<48u;j++){results[b+j]=segmentOutput[j];}elapsed=select(h,next,next!=0u);upper=elapsed;
  if(next==0u){break;}
  for(var i=0u;i<n;i++){if((mask&(1u<<i))!=0u){segmentInput[12u+i*10u]=0u;segmentInput[15u+i*10u]=0u;results[b+12u+i*10u]=0u;results[b+15u+i*10u]=0u;}}
  let at=b+48u+groups*4u;results[at]=lower;results[at+1u]=next;results[at+2u]=mask;results[at+3u]=exactMask;groups++;
  if(elapsed==h){break;}
 }}
 results[b]=rows[b];results[b+1u]=status;results[b+2u]=reason;results[b+3u]=elapsed;results[b+4u]=upper;results[b+5u]=pair;results[b+6u]=nodes;results[b+7u]=0xffffffffu;
}`;

export async function createSpinRecurrenceGPU(device){
 device.pushErrorScope('validation');const start=performance.now();let pipeline;
 try{const module=device.createShaderModule({code:SPIN_RECURRENCE_WGSL});const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});}
 finally{const error=await device.popErrorScope();if(error)throw Error(error.message);}
 return {compileMs:performance.now()-start,shaderBytes:new TextEncoder().encode(SPIN_RECURRENCE_WGSL).length,async run(rows){
  validRows(rows);const buffers=[];const allocate=(usage)=>{const b=device.createBuffer({size:rows.byteLength,usage});buffers.push(b);return b;};
  device.pushErrorScope('validation');
  try{
   const input=allocate(128|8),output=allocate(128|4),read=allocate(1|8);device.queue.writeBuffer(input,0,rows);
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[input,output].map((buffer,binding)=>({binding,resource:{buffer}}))});
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/64/32));pass.end();encoder.copyBufferToBuffer(output,0,read,0,rows.byteLength);
   const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();const submitToDoneMs=performance.now()-start;
   await read.mapAsync(1);const result=new Uint32Array(read.getMappedRange()).slice();read.unmap();
   return {result,metrics:{candidates:rows.length/64,inputBytes:rows.byteLength,outputBytes:rows.byteLength,readbackBytes:rows.byteLength,allocatedBytes:3*rows.byteLength,submitToDoneMs,hardwareSpeedClaim:false,physicalAcceptance:false}};
  }finally{buffers.forEach(x=>x.destroy());const error=await device.popErrorScope();if(error)throw Error(error.message);}
 }};
}
