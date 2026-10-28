/** Resident finite-hull MMQ2 extension. Same admission/impulse packet ABI, original rolling law. */
import {MIXED_HULL_MOTION_WGSL,MIXED_HULL_SAMPLE_WGSL,MIXED_HULL_QUERY_WGSL,MIXED_HULL_LEDGER_WGSL,MIXED_HULL_ENTRY_WGSL,MIXED_CUSHION_MERGE_WGSL,packMixedCushionConfig} from './deterministic-mixed-cushion-entry.mjs';
import {MIXED_V2_MATH_WGSL,MIXED_V2_QUERY_WGSL} from './deterministic-mixed-motion-v2-gpu.mjs';
import {ROLLING_PARTIAL_HELPER_WGSL} from './deterministic-rolling-partial.mjs';
import {ROLLING_BOUNDS_HELPER_WGSL} from './deterministic-rolling-bounds.mjs';
import {validateMixedMotionV2} from './deterministic-mixed-motion-v2.mjs';
import {validateRollingTailScene} from './deterministic-rolling-tail.mjs';
import {validateCushionHull,CUSHION_POINT_WGSL} from './deterministic-cushion-geometry.mjs';
import {CANONICAL_STATE_DOMAIN_WGSL} from './deterministic-state-domain.mjs';
import {CUSHION_RESPONSE_WGSL} from './deterministic-cushion-response.mjs';
const normAdapter=MIXED_HULL_SAMPLE_WGSL.slice(0,MIXED_HULL_SAMPLE_WGSL.indexOf('struct HullState'));
const numeric=MIXED_V2_MATH_WGSL.slice(MIXED_V2_MATH_WGSL.indexOf('fn rollingRecipe'),MIXED_V2_MATH_WGSL.indexOf('struct HullState')).replaceAll('norm(', 'hn(').replace('fn mb2(', 'fn mb(').replace('return mb(body,lo,hi)', 'return legacyBounds(body,lo,hi)');
const rollingPartial=ROLLING_PARTIAL_HELPER_WGSL.replaceAll('norm(', 'hn(').replaceAll('equalSquare(', 'rollingEqualSquare(');
export const MIXED_V2_HULL_MOTION_WGSL=MIXED_HULL_MOTION_WGSL.replace('fn mb(', 'fn legacyBounds(')+normAdapter+`
var<private> muls:u32;var<private> divs:u32;var<private> norms:u32;
fn rollingEqualSquare(v:vec3<i32>,value:i32)->bool{var sum=vec2<u32>(0);for(var j=0u;j<3u;j++){sum=add64(sum,wide(u32(abs(v[j])),u32(abs(v[j]))));}return compare(sum,wide(u32(value),u32(value)))==0;}
`+rollingPartial+ROLLING_BOUNDS_HELPER_WGSL+numeric;
const rollingState=`if(kind==3u){let r=rollingPartial(rollingRecipe(body),t);out.p=vec3<i32>(bitcast<i32>(r[16]),ms(b+9u),bitcast<i32>(r[17]));out.v=vec3<i32>(bitcast<i32>(r[18]),0,bitcast<i32>(r[19]));out.q=vec3<i32>(bitcast<i32>(r[20]),bitcast<i32>(r[22]),bitcast<i32>(r[21]));out.valid=r[1]==1u&&r[10]==1u&&!bad&&canonicalPositionWithin(out.p,67108864)&&canonicalVelocitySpinWithin(out.v,out.q);return out;}else if(kind==1u){`;
export const MIXED_V2_HULL_SAMPLE_WGSL=MIXED_HULL_SAMPLE_WGSL.slice(MIXED_HULL_SAMPLE_WGSL.indexOf('struct HullState')).replace('if(kind==1u){',rollingState);
const adapt=code=>code.replace(MIXED_HULL_MOTION_WGSL,MIXED_V2_HULL_MOTION_WGSL).replace(MIXED_HULL_SAMPLE_WGSL,MIXED_V2_HULL_SAMPLE_WGSL);
// Keep the exact qualifier, but do not thread a function exit through every
// iteration of the heavy original rolling sampler or competing-event scan.
const originalAllStates='var allStates:array<HullState,4>;for(var i=0u;i<n;i++){allStates[i]=hs(i,hi);if(!allStates[i].valid){entry[6]=6u;return;}}';
const accumulatedAllStates='var allStates:array<HullState,4>;var allStatesValid=true;for(var i=0u;i<n;i++){allStates[i]=hs(i,hi);allStatesValid=allStatesValid & allStates[i].valid;}if(!allStatesValid){entry[6]=6u;return;}';
const originalCompetitors='for(var k=0u;k<ledger[8];k++){if(k==selected){continue;}let at=32u+8u*k;if(ledger[at+3u]!=2u&&ledger[at+4u]<=hi){entry[6]=10u;return;}}';
const accumulatedCompetitors='var competitorsClear=true;for(var k=0u;k<ledger[8];k++){let at=32u+8u*k;competitorsClear=competitorsClear & ((k==selected)|(ledger[at+3u]==2u)|(ledger[at+4u]>hi));}if(!competitorsClear){entry[6]=10u;return;}';
if(!MIXED_HULL_ENTRY_WGSL.includes(originalAllStates)||!MIXED_HULL_ENTRY_WGSL.includes(originalCompetitors))throw Error('Audited finite-cushion qualifier structure changed');
export const MIXED_V2_HULL_QUERY_WGSL=adapt(MIXED_HULL_QUERY_WGSL),MIXED_V2_HULL_ENTRY_UNCACHED_WGSL=adapt(MIXED_HULL_ENTRY_WGSL).replace(originalAllStates,accumulatedAllStates).replace(originalCompetitors,accumulatedCompetitors);
/** Ten selected-body endpoints, plus exact source/header binding: 256 words. */
export const MIXED_V2_HULL_ENDPOINT_CACHE_WORDS=256;
export const MIXED_V2_HULL_ENDPOINT_CACHE_WGSL=`
@group(0) @binding(0) var<storage,read> rows:array<u32>;
@group(0) @binding(1) var<storage,read> scene:array<u32>;
@group(0) @binding(2) var<storage,read> ledger:array<u32>;
@group(0) @binding(3) var<storage,read> config:array<u32>;
@group(0) @binding(4) var<storage,read_write> endpointCache:array<u32>;
${CUSHION_POINT_WGSL}
${MIXED_V2_HULL_MOTION_WGSL}
${CANONICAL_STATE_DOMAIN_WGSL}
${MIXED_V2_HULL_SAMPLE_WGSL}
@compute @workgroup_size(16) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let slot=gid.x;if(slot>=10u){return;}let out=96u+slot*16u;
 for(var j=0u;j<16u;j++){endpointCache[out+j]=0u;}
 if(slot==0u){for(var j=0u;j<96u;j++){endpointCache[j]=0u;}}
 if(ledger[1]!=6u||ledger[4]>=128u){return;}let selected=ledger[4];let z=32u+8u*selected;
 let body=ledger[z+1u];let rail=ledger[z+2u];let n=config[0];
 if(ledger[z]!=2u||rail!=config[1]||body>=n||n<3u||n>4u||arrayLength(&rows)!=n*80u||config[2]<1u||config[2]>256u){return;}
 let b=body*80u;let lo=ledger[z+4u];let firstHi=ledger[z+5u];let H=ledger[2];
 if(slot==0u){endpointCache[0]=0x43454332u;endpointCache[1]=1u;endpointCache[2]=n;endpointCache[3]=selected;endpointCache[4]=body;endpointCache[5]=rail;endpointCache[6]=lo;endpointCache[7]=firstHi;endpointCache[8]=H;endpointCache[9]=config[2];endpointCache[10]=arrayLength(&rows);endpointCache[11]=rows[b+6u];endpointCache[12]=rows[b+3u];endpointCache[13]=scene[1];for(var j=0u;j<80u;j++){endpointCache[16u+j]=rows[b+j];}}
 var t=lo;if(slot!=0u){let width=1u<<(slot-1u);if(width>config[2]){return;}t=min(H,firstHi+width-1u);}
 let sampled=hs(body,t);endpointCache[out]=select(0u,1u,sampled.valid);endpointCache[out+1u]=t;endpointCache[out+2u]=body;endpointCache[out+3u]=rows[b+3u];endpointCache[out+4u]=rail;endpointCache[out+5u]=rows[b+6u];endpointCache[out+15u]=slot;
 for(var j=0u;j<3u;j++){endpointCache[out+6u+j]=bitcast<u32>(sampled.p[j]);endpointCache[out+9u+j]=bitcast<u32>(sampled.v[j]);endpointCache[out+12u+j]=bitcast<u32>(sampled.q[j]);}
}
`;
const cachedState=`
@group(0) @binding(7) var<storage,read> endpointCache:array<u32>;
fn endpointCacheBound(body:u32,rail:u32,selected:u32,lo:u32,firstHi:u32)->bool{
 let b=body*80u;var valid=(arrayLength(&endpointCache)==256u);
 valid=valid & (endpointCache[0]==0x43454332u) & (endpointCache[1]==1u) & (endpointCache[2]==config[0]);
 valid=valid & (endpointCache[3]==selected) & (endpointCache[4]==body) & (endpointCache[5]==rail);
 valid=valid & (endpointCache[6]==lo) & (endpointCache[7]==firstHi) & (endpointCache[8]==ledger[2]);
 valid=valid & (endpointCache[9]==config[2]) & (endpointCache[10]==arrayLength(&rows));
 valid=valid & (endpointCache[11]==rows[b+6u]) & (endpointCache[12]==rows[b+3u]) & (endpointCache[13]==scene[1]);
 for(var j=0u;j<80u;j++){valid=valid & (endpointCache[16u+j]==rows[b+j]);}
 for(var slot=0u;slot<10u;slot++){let width=1u<<select(0u,slot-1u,slot!=0u);if(slot==0u||width<=config[2]){let z=96u+slot*16u;let t=select(min(ledger[2],firstHi+width-1u),lo,slot==0u);valid=valid & (endpointCache[z]<=1u) & (endpointCache[z+1u]==t) & (endpointCache[z+2u]==body) & (endpointCache[z+3u]==rows[b+3u]) & (endpointCache[z+4u]==rail) & (endpointCache[z+5u]==rows[b+6u]) & (endpointCache[z+15u]==slot);}}
 return valid;
}
fn cachedHullState(body:u32,t:u32,slot:u32)->HullState{
 var out:HullState;out.valid=false;if(slot>=10u){return out;}let z=96u+slot*16u;let b=80u*body;
 if(endpointCache[z]!=1u||endpointCache[z+1u]!=t||endpointCache[z+2u]!=body||endpointCache[z+3u]!=rows[b+3u]||endpointCache[z+4u]!=config[1]||endpointCache[z+5u]!=rows[b+6u]||endpointCache[z+15u]!=slot){return out;}
 for(var j=0u;j<3u;j++){out.p[j]=bitcast<i32>(endpointCache[z+6u+j]);out.v[j]=bitcast<i32>(endpointCache[z+9u+j]);out.q[j]=bitcast<i32>(endpointCache[z+12u+j]);}out.valid=true;return out;
}
`;
export const MIXED_V2_HULL_ENTRY_WGSL=MIXED_V2_HULL_ENTRY_UNCACHED_WGSL
 .replace('fn hc(i:u32)',cachedState+'\nfn hc(i:u32)')
 .replace('let lowState=hs(body,lo);','if(!endpointCacheBound(body,rail,selected,lo,firstHi)){entry[6]=7u;return;}let lowState=cachedHullState(body,lo,0u);')
 .replace('for(var width=1u;width<=config[2];width*=2u){','var endpointSlot=1u;for(var width=1u;width<=config[2];width*=2u){')
 .replace('upperState=hs(body,hi);','upperState=cachedHullState(body,hi,endpointSlot);')
 .replace('if(hi==ledger[2]){break;}}if(!accepted)','if(hi==ledger[2]){break;}endpointSlot++;}if(!accepted)');
function validateMixedWorldQueryInput(rows,scene,options={}){validateMixedMotionV2(rows);validateRollingTailScene(scene);const n=rows.length/80,h=options.horizonTicks??rows[2],cap=options.maxNodes??256,count=n*(n-1)/2+n*scene[1]+2*n+2*Array.from({length:n},(_,i)=>i).filter(i=>rows[i*80+1]===3).length;if(!Number.isInteger(h)||h<1||h>rows[2]||!Number.isInteger(cap)||cap<1||cap>1024||count>128||count*cap>32768)throw RangeError('Bounded MMQ2 world query');for(let b=0;b<rows.length;b+=80)if(rows[b+49]!==scene[3])throw RangeError('Immutable cloth mismatch');return{n,h,cap};}
function check(rows,hull){validateMixedMotionV2(rows);validateCushionHull(hull);}
export async function createMixedCushionEntryV2GPU(device,material,{onCompilePhase=()=>{}}={}){const codes=[MIXED_V2_QUERY_WGSL,MIXED_V2_HULL_QUERY_WGSL,MIXED_HULL_LEDGER_WGSL,MIXED_V2_HULL_ENTRY_WGSL,CUSHION_RESPONSE_WGSL,MIXED_CUSHION_MERGE_WGSL,MIXED_V2_HULL_ENDPOINT_CACHE_WGSL],modules=codes.map(code=>device.createShaderModule({code})),pipelines=[],start=performance.now();for(const module of modules){const info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));}for(const [index,module] of modules.entries()){onCompilePhase({stage:'entry',index});pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}return{compileMs:performance.now()-start,async run(rows,scene,hulls,options={}){const{h,cap,n}=validateMixedWorldQueryInput(rows,scene,options);if(!Array.isArray(hulls)||hulls.length!==4)throw TypeError('Four actual hulls');const configs=hulls.map((x,i)=>{check(rows,x,options);const hs=new Int32Array(x.buffer,x.byteOffset),sc=new Int32Array(scene.buffer,scene.byteOffset);if(x[1]!==scene[22+8*i]||Array.from(hs.slice(8,14)).some((v,k)=>v!==sc[16+8*i+k]))throw RangeError('Actual hull identity/bounds');return packMixedCushionConfig(rows,scene,i,material);}),buffers=[],alloc=(size,usage=128|4|8)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};try{const input=alloc(rows.byteLength),world=alloc(scene.byteLength),cfg=alloc(8),mergeCfg=alloc(8),hullBuffers=hulls.map(x=>alloc(x.byteLength)),materialBuffers=configs.map(x=>alloc(x.byteLength)),query=alloc(1056*4),times=alloc(n*4*64*4),ledger=alloc(1056*4),entry=alloc(128*4),packets=alloc(192*4),advanced=alloc(160*4),response=alloc(128*4),state=alloc(160*4),endpointCache=alloc(MIXED_V2_HULL_ENDPOINT_CACHE_WORDS*4),counts=[1056,n*4*64,128,64,16,32,160,128,160],total=counts.reduce((a,b)=>a+b,0),read=alloc(total*4,1|8);for(const[b,x]of[[input,rows],[world,scene],[cfg,new Uint32Array([h,cap])],[mergeCfg,new Uint32Array([n,scene[1]])],...hulls.map((x,i)=>[hullBuffers[i],x]),...configs.map((x,i)=>[materialBuffers[i],x])])device.queue.writeBuffer(b,0,x);const e=device.createCommandEncoder();encode(e,0,[input,world,cfg,query]);for(let i=0;i<4;i++)encode(e,1,[input,hullBuffers[i],cfg,{buffer:times,offset:i*n*256,size:n*256}],n);encode(e,2,[query,times,mergeCfg,ledger,entry,advanced]);for(let i=0;i<4;i++){encode(e,6,[input,hullBuffers[i],ledger,materialBuffers[i],endpointCache]);encode(e,3,[input,hullBuffers[i],ledger,materialBuffers[i],entry,packets,advanced,endpointCache]);}encode(e,4,[{buffer:packets,offset:0,size:64},{buffer:packets,offset:256,size:128},{buffer:packets,offset:512,size:256},response]);encode(e,5,[entry,advanced,response,state]);let offset=0;for(const[i,item]of[[ledger,0],[times,0],[entry,0],[packets,512],[packets,0],[packets,256],[advanced,0],[response,0],[state,0]].entries()){e.copyBufferToBuffer(item[0],item[1],read,offset,counts[i]*4);offset+=counts[i]*4;}device.queue.submit([e.finish()]);await read.mapAsync(1);const data=new Uint32Array(read.getMappedRange()).slice();read.unmap();const result={};offset=0;for(const[i,name]of['query','times','entry','admission','motion','states','advanced','response','state'].entries()){result[name]=data.slice(offset,offset+counts[i]);offset+=counts[i];}return{...result,metrics:{dispatches:16,intermediateReadbacks:0,endpointCacheBytes:1024,maximumSelectedEndpointSamples:10}};}finally{buffers.forEach(b=>b.destroy());}},encode(encoder,index,buffers,count=1){encode(encoder,index,buffers,count);}};function encode(encoder,index,buffers,count=1){const group=device.createBindGroup({layout:pipelines[index].getBindGroupLayout(0),entries:buffers.map((value,binding)=>({binding,resource:value.buffer?value:{buffer:value}}))}),pass=encoder.beginComputePass();pass.setPipeline(pipelines[index]);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count);pass.end();}}
