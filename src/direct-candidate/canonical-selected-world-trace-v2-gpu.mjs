/** Optional SWG2 selected source append for explicit MMQ2 stages.
 * Pure copies/identity/clock gates. No numeric physics shader body is changed.
 * Invalid/overflow captures stop this side channel, never write world buffers.
 */
export const SELECTED_WORLD_TRACE_V2_VERSION=0x53574702;
export const SELECTED_WORLD_TRACE_V2_PHASE=Object.freeze({INITIAL:1,TAIL:2,MIXED:3,SUPPORTED:4,MICROTAIL:5,CLEAR:6,PAIR:7,STOP:8,CUSHION_IMPACT:9,CUSHION_DEPARTURE:10});
export const SELECTED_WORLD_TRACE_V2_LAYOUT=Object.freeze({recordWords:4096,maximumRecords:512,headerWords:32,beforeState:[32,256],afterState:[288,256],context:[544,160],cloth:[704,16],rows:[720,256],smooth:[976,256],bridges:[1232,512],rolling:[1744,512],tailRows:[2256,128],roots:[2384,256],entry:[2640,128],descriptors:[2768,320],microRows:[3088,640],micro:[3728,96],fraction:[3824,96],microInput:[3920,32]});
const V=SELECTED_WORLD_TRACE_V2_VERSION,L=SELECTED_WORLD_TRACE_V2_LAYOUT,fields=Object.entries(L).filter(([,x])=>Array.isArray(x)),u32=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
export const SELECTED_WORLD_TRACE_V2_APPEND_WGSL=`
@group(0) @binding(0) var<storage,read> source:array<u32>;
@group(0) @binding(1) var<storage,read_write> control:array<u32>;
@group(0) @binding(2) var<storage,read_write> records:array<u32>;
@compute @workgroup_size(1) fn main(){
 if(control[0]!=0x53574702u||control[4]!=0u||control[3]!=0u){return;}
 let phase=source[1];if(phase<1u||phase>10u||source[0]!=0x53574702u||control[11]!=0x4d4d5102u){control[4]=1u;return;}let start=source[37];let end=source[293];let n=source[291];
 // MMQ2 route attempts append only their own accepted physical transition.
 let pairChange=source[333]-source[77];let cushionChange=source[349]-source[93];let landChange=source[309]-source[53];
 if(phase==6u&&(pairChange!=0u||cushionChange!=0u||landChange!=0u||(source[289]!=1u&&source[289]!=12u))){return;}
 if(phase==6u&&(source[2768]!=0x4d4d5102u||source[2774]!=start)){return;}
 if(phase==7u&&pairChange!=1u){return;}
 if(phase==8u&&(source[2641]!=1u||source[289]!=1u||pairChange!=0u||cushionChange!=0u||landChange!=0u)){return;}
 if(phase==9u&&cushionChange!=1u){return;}
 if(phase==10u&&(source[2641]!=1u||source[94]!=start||cushionChange!=0u||pairChange!=0u||landChange!=0u)){return;}
 // A later generic snapshot may repeat an already appended endpoint. Suppress
 // only exact physical identity/clock/event-counter duplicates, never an impulse.
 if(control[1]>0u&&end==control[5]&&start<end&&n==control[10]&&source[32]==control[7]&&source[288]==control[7]&&source[73]==control[8]&&source[329]==control[8]&&source[74]==control[9]&&source[330]==control[9]){let prev=(control[1]-1u)*4096u;var same=true;
 for(var k=0u;k<3u;k++){let at=array<u32,3>(21u,45u,61u)[k];same=same&&(records[prev+288u+at]==source[288u+at]);}
 for(var i=0u;i<n;i++){let a=352u+48u*i;same=same&&(records[prev+a]==source[a])&&(records[prev+a+22u]==source[a+22u])&&(records[prev+a+23u]==source[a+23u])&&(records[prev+a+39u]==source[a+39u])&&(records[prev+a+40u]==source[a+40u]);for(var j=24u;j<33u;j++){same=same&&(records[prev+a+j]==source[a+j]);}}
 if(same){return;}}
 // Most scheduled world routes are inactive. They must not create records.
 let pairDelta=source[333]-source[77];let landDelta=source[309]-source[53];let cushionDelta=source[349]-source[93];
 let zeroBoundary=end==start&&(pairDelta==1u||landDelta==1u||cushionDelta==1u||(source[289]==9u&&source[33]!=9u));
 if(phase!=1u&&end==start&&!zeroBoundary){return;}
 if(phase!=1u&&end<start){control[4]=7u;return;}
 if(phase<1u||phase>10u||source[0]!=0x53574702u||control[11]!=0x4d4d5102u){control[4]=1u;return;}
 if(n!=control[10]||source[35]!=n||source[32]!=control[7]||source[288]!=control[7]||source[73]!=control[8]||source[329]!=control[8]||source[74]!=control[9]||source[330]!=control[9]){control[4]=2u;return;}
 if(phase==1u){if(control[6]!=0u||start!=end){control[4]=3u;return;}}
 else if(control[6]!=1u||start!=control[5]||end>2147483647u){control[4]=4u;return;}
 for(var i=0u;i<n;i++){if(source[96u+48u*i]!=source[352u+48u*i]){control[4]=5u;return;}for(var j=0u;j<i;j++){if(source[96u+48u*i]==source[96u+48u*j]){control[4]=5u;return;}}}
 if(phase!=1u){if(source[333]<source[77]||source[309]<source[53]||source[349]<source[93]||pairDelta>1u||landDelta>1u||cushionDelta>1u){control[4]=8u;return;}
 if(pairDelta==1u&&(source[2641]!=1u||source[2644]>source[2645]||source[2645]!=end-start)){control[4]=9u;return;}
 if(cushionDelta==1u&&(phase!=9u||source[2641]!=1u||source[2644]>source[2645]||source[2645]!=end-start)){control[4]=12u;return;}
 if(phase==5u&&(landDelta!=1u||source[339]!=1u||source[3729]!=1u||source[3734]!=end-start||source[3732]!=source[341])){control[4]=10u;return;}
 if(phase==3u&&landDelta==1u){let slot=source[310];let r=2384u+64u*slot;if(slot>=n||source[r+1u]!=1u||source[r+3u]>source[r+4u]||source[r+4u]!=end-start){control[4]=11u;return;}}
 }
 let count=control[1];if(count>=control[2]){control[3]=1u;return;}
 let at=count*4096u;if(at+4096u>arrayLength(&records)){control[4]=6u;return;}
 for(var j=0u;j<4096u;j++){records[at+j]=source[j];}
 records[at+2u]=start;records[at+3u]=end;records[at+4u]=n;records[at+5u]=count;
 records[at+6u]=source[289];records[at+7u]=source[33];records[at+8u]=source[39];records[at+9u]=source[295];
 records[at+15u]=select(0u,1u,zeroBoundary);records[at+10u]=control[7];records[at+11u]=control[8];records[at+12u]=control[9];records[at+13u]=control[11];
 control[1]=count+1u;control[5]=end;control[6]=1u;control[12]|=1u<<phase;
}`;
function copyRange(encoder,source,target,offset,length){const r=source?.buffer?source:{buffer:source,offset:0},b=r.buffer,at=r.offset??0,size=Math.min(length*4,r.size??b?.size??0);if(!b||!(b.usage&4)||!Number.isInteger(at)||at<0||at%4||size%4||b.size<at+size)throw RangeError('Original COPY_SRC buffer range required');encoder.copyBufferToBuffer(b,at,target,offset*4,size);}
export function validateSelectedWorldTraceV2Profile(options={}){if(options.selectedTrace!==undefined&&typeof options.selectedTrace!=='boolean')throw TypeError('Explicit selectedTrace boolean');if(options.selectedTrace!==true)return false;if(options.mixedMotionRevision!=='mmq2')throw RangeError('Selected resident trace v2 requires explicit MMQ2');const cap=options.selectedTraceMaxRecords??512;if(!Number.isInteger(cap)||cap<1||cap>512)throw RangeError('Selected resident trace cap 1..512');return true;}
export async function createSelectedWorldTraceV2GPU(device){const module=device.createShaderModule({code:SELECTED_WORLD_TRACE_V2_APPEND_WGSL,label:'selected source append only'}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});return {createBank({candidateCount,candidateId,sceneKey,requestKey,bodyCount,maximumRecords=512,pinnedMotionVersion=0x4d4d5102}){
 if(candidateCount!==1||![candidateId,sceneKey,requestKey].every(u32)||![3,4].includes(bodyCount)||!Number.isInteger(maximumRecords)||maximumRecords<1||maximumRecords>512||pinnedMotionVersion!==0x4d4d5102)throw RangeError('One explicitly selected v2 shot with bounded records required');
 const owned=[],alloc=(words,usage=128|4|8)=>{const b=device.createBuffer({size:words*4,usage});owned.push(b);return b;},before=alloc(256),scratch=alloc(4096),control=alloc(16),records=alloc(4096*maximumRecords),read=alloc(16+4096*maximumRecords,1|8),configs=new Map(),group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[scratch,control,records].map((buffer,binding)=>({binding,resource:{buffer}}))});
 device.queue.writeBuffer(control,0,new Uint32Array([V,0,maximumRecords,0,0,0,0,candidateId,sceneKey,requestKey,bodyCount,pinnedMotionVersion,0,0,0,0]));let disposed=false,readEncoded=false,encodedDispatches=0;
 return {beforeStateBuffer:before,get encodedDispatches(){return encodedDispatches;},get allocatedBytes(){return owned.reduce((n,b)=>n+b.size,0);},recordWords:4096,maximumRecords,
 snapshotBefore(encoder,buffer){if(disposed)throw Error('Disposed selected trace');copyRange(encoder,buffer,before,0,256);return before;},
 capture(encoder,inputs){if(disposed||readEncoded)throw Error('Closed selected trace');const phase=inputs.phase;if(!Object.values(SELECTED_WORLD_TRACE_V2_PHASE).includes(phase))throw RangeError('Explicit source phase');let mask=0;for(let i=0;i<fields.length;i++)if(inputs[fields[i][0]+'Buffer'])mask|=1<<i;for(const k of ['beforeStateBuffer','afterStateBuffer','contextBuffer','clothBuffer'])if(!inputs[k])throw RangeError('Full source state/context/cloth required');const key=phase+':'+mask;let config=configs.get(key);if(!config){config=alloc(32);const words=new Uint32Array(32);words.set([V,phase]);words[14]=mask;device.queue.writeBuffer(config,0,words);configs.set(key,config);}encoder.clearBuffer(scratch);encoder.copyBufferToBuffer(config,0,scratch,0,128);for(const [name,[offset,length]]of fields)if(inputs[name+'Buffer'])copyRange(encoder,inputs[name+'Buffer'],scratch,offset,length);const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encodedDispatches++;},
 encodeReadback(encoder){if(disposed||readEncoded)throw Error('Closed selected trace');encoder.copyBufferToBuffer(control,0,read,0,64);encoder.copyBufferToBuffer(records,0,read,64,records.size);readEncoded=true;},
 async readAfterSubmission({signal}={}){if(disposed||!readEncoded)throw Error('Selected trace final readback not encoded');if(signal?.aborted)throw new DOMException('Cancelled','AbortError');await read.mapAsync(1);let result;try{result=decodeSelectedWorldTraceV2GPU(new Uint32Array(read.getMappedRange()));}finally{read.unmap();}if(signal?.aborted)throw new DOMException('Cancelled','AbortError');return result;},
 destroy(){if(!disposed){disposed=true;owned.forEach(b=>b.destroy());}}
 };
 }};
}
export function decodeSelectedWorldTraceV2GPU(words){if(!(words instanceof Uint32Array)||words.length<16||words[0]!==V||words[2]<1||words[2]>512||words.length!==16+4096*words[2]||words[1]>words[2]||words[11]!==0x4d4d5102)throw RangeError('Complete final selected GPU source readback');const records=Array.from({length:words[1]},(_,i)=>words.slice(16+4096*i,16+4096*(i+1)));return {kind:'gpu-selected-world-source-v2',gpuProduced:true,pinnedMotionVersion:words[11],recordCount:words[1],maximumRecords:words[2],overflow:words[3]!==0,errorCode:words[4],captureComplete:words[6]===1&&!words[3]&&!words[4],lastTick:words[5],identity:{candidateId:words[7],sceneKey:words[8],requestKey:words[9],bodyCount:words[10]},records,intermediateReadbacks:0};}
