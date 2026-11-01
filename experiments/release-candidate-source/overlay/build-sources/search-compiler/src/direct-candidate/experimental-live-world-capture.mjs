/** Nonexecuting host-graph recorder for an explicit experimental live MMQ1 profile.
 * It invokes actual factories, but never evaluates CPU or GPU physics. Not a GPU
 * validator: structural capture success is not native qualification. */
import {createCanonicalWorldContinuationGPU} from './canonical-world-continuation.mjs';
import {liftLiveCandidateStructure as liftCandidatePhase} from './experimental-guarded-storage-lift.mjs';
import {auditLiveCushionIndirect} from './experimental-live-indirect.mjs';
const clone = x => structuredClone(x);
export function createLiveWorldCaptureDevice({allowCushionIndirect=false,onCommand=null}={}) {
 if(onCommand!==null&&typeof onCommand!=='function')throw TypeError('Command observer must be a function');
 const buffers=[], modules=[], pipelines=[], commands=[];
 const record=command=>onCommand===null?commands.push(command):onCommand(command);
 let submits=0;
 const device={
  limits:{maxComputeWorkgroupsPerDimension:65535,maxBufferSize:256*1024*1024,maxStorageBufferBindingSize:128*1024*1024},
  pushErrorScope(){},async popErrorScope(){return null;},
  createShaderModule(d){const m={id:modules.length,code:d.code,label:d.label??'',async getCompilationInfo(){return{messages:[]};}};modules.push(m);return m;},
  createBindGroupLayout(d){return clone(d);},createPipelineLayout(d){return d;},
  async createComputePipelineAsync(d){const p={id:pipelines.length,module:d.compute.module,entryPoint:d.compute.entryPoint??'main',layout:d.layout,constants:clone(d.compute.constants??{}),getBindGroupLayout(){return {};}};pipelines.push(p);return p;},
  createBuffer(d){if(!Number.isInteger(d.size)||d.size<4||d.size%4)throw Error('Aligned bounded capture allocation');const b={id:buffers.length,size:d.size,usage:d.usage,label:d.label??'',hostInitialized:false,bytes:new Uint8Array(d.size),destroy(){},async mapAsync(){},getMappedRange(){return b.bytes.slice().buffer;},unmap(){}};buffers.push(b);return b;},
  createBindGroup(d){if(!Array.isArray(d.entries)||d.entries.some((e,i)=>e.binding!==i))throw Error('Contiguous ordered binding numbers required');return{entries:d.entries.map(e=>{const offset=e.resource.offset??0,size=e.resource.size??e.resource.buffer.size-offset;if(![offset,size].every(Number.isInteger)||offset<0||size<4||offset%4||size%4||offset+size>e.resource.buffer.size)throw Error('Invalid binding subview');return{binding:e.binding,buffer:e.resource.buffer.id,offset,size};})};},
  createCommandEncoder(){return{
   beginComputePass(){let pipeline,group;return{setPipeline(p){pipeline=p;},setBindGroup(i,g,offsets){if(i!==0||(offsets?.length??0)!==0)throw Error('Only group0 without dynamic offsets');group=g;},dispatchWorkgroups(x,y=1,z=1){if(!pipeline||!group||y!==1||z!==1)throw Error('Unreviewed dispatch shape');record({kind:'dispatch',pipeline:pipeline.id,x,entries:clone(group.entries)});},dispatchWorkgroupsIndirect(buffer,offset){if(!allowCushionIndirect||!pipeline||!group||buffer.size!==32||!(buffer.usage&256)||![8,20].includes(offset))throw Error('Indirect live graph requires separate audit');record({kind:'dispatch',pipeline:pipeline.id,indirect:{buffer:buffer.id,offset},entries:clone(group.entries)});},end(){}};},
   clearBuffer(b,offset=0,size=b.size-offset){if(![offset,size].every(Number.isInteger)||offset<0||size<4||offset%4||size%4||offset+size>b.size)throw Error('Invalid clear range');record({kind:'clear',buffer:b.id,offset,size});},
   copyBufferToBuffer(a,ao,b,bo,size){if(![ao,bo,size].every(Number.isInteger)||ao<0||bo<0||size<4||ao%4||bo%4||size%4||ao+size>a.size||bo+size>b.size)throw Error('Invalid copy range');record({kind:'copy',source:a.id,sourceOffset:ao,target:b.id,targetOffset:bo,size});},finish(){return{};}
  };},
  queue:{writeBuffer(b,offset,data,dataOffset=0,size){if(submits)throw Error('Post-submit writes are outside captured graph contract');const bytes=data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength);const unit=data instanceof ArrayBuffer?1:data.BYTES_PER_ELEMENT;const first=dataOffset*unit,count=size===undefined?bytes.length-first:size*unit;if(![offset,first,count].every(Number.isInteger)||offset<0||first<0||count<0||offset%4||count%4||first+count>bytes.length||offset+count>b.size)throw Error('Invalid upload range');b.hostInitialized=true;b.bytes.set(bytes.slice(first,first+count),offset);},submit(){if(submits)throw Error('Multiple submissions require fresh graph audit');submits++;},async onSubmittedWorkDone(){}}
 };
 return {device,buffers,modules,pipelines,commands,get submits(){return submits;}};
}
function entrySource(source,entry){
 const names=[...source.matchAll(/@compute @workgroup_size\(1\) fn (initialize|snapshot|finish)\(\)/g)].map(m=>m[1]);
 if(names.length){if(names.join(',')!=='initialize,snapshot,finish'||!names.includes(entry)||(source.match(/@compute/g)??[]).length!==3)throw Error('Unreviewed multi-entrypoint source');return source.replace(/@compute @workgroup_size\(1\) fn (initialize|snapshot|finish)\(\)/g,'fn $1()')+`\n@compute @workgroup_size(1) fn main(){${entry}();}\n`;}
 if(entry!=='main')throw Error('Unreviewed entrypoint');return source;
}
export async function captureLiveWorldPlan(binding,batch,{strikeBackend='staged',profile='mmq1-no-cushion',onUploadMetadata=null}={}){
 if(onUploadMetadata!==null&&typeof onUploadMetadata!=='function')throw TypeError('Synchronous upload metadata observer required');
 const mmq2=profile==='mmq2-cushion';if(!['mmq1-no-cushion','mmq2-cushion'].includes(profile)||batch.count!==1||(binding.localOptions?.mixedMotionRevision==='mmq2')!==mmq2||!!binding.localOptions?.enableCushionContinuation!==mmq2||binding.localOptions?.selectedTrace)throw RangeError('Explicit single-candidate matching live profile required');
 const r=createLiveWorldCaptureDevice({allowCushionIndirect:mmq2}),engine=await createCanonicalWorldContinuationGPU(r.device,binding,{strikeBackend});
 await engine.runRaw(batch);
 if(r.submits!==1)throw Error('One owned command submission required');
 const markers=r.commands.map((c,i)=>c.kind==='dispatch'&&r.pipelines[c.pipeline].module.label==='raw_world_handoff'?i:-1).filter(i=>i>=0);
 if(markers.length!==1)throw Error('Exactly one live raw handoff required');
 const marker=r.commands[markers[0]],external={prepared:marker.entries[4].buffer,status:marker.entries[5].buffer},commands=r.commands.slice(markers[0]+1);
 const reads=r.buffers.filter(b=>(b.usage&1)!==0);if(reads.length!==1)throw Error('One final diagnostic readback expected');const read=reads[0];
 const used=new Set([read.id]);for(const c of commands){if(c.kind==='dispatch'){for(const e of c.entries)used.add(e.buffer);if(c.indirect)used.add(c.indirect.buffer);}else if(c.kind==='copy'){used.add(c.source);used.add(c.target);}else used.add(c.buffer);}
 const ids=[...used].sort((a,b)=>a-b),localId=new Map(ids.map((id,i)=>[id,i]));
 const allocations=ids.map(id=>{const b=r.buffers[id];return{size:b.size,usage:b.usage,initial:b.bytes.slice(),external:id===external.prepared?'prepared':id===external.status?'status':null};});
 const definitions=[],keys=new Map();
 const mapped=commands.map(c=>{
  if(c.kind==='dispatch'){
   const p=r.pipelines[c.pipeline];if(Object.keys(p.constants).length)throw Error('Pipeline specialization requires fresh review');
   const entries=c.entries.map(e=>({...e,buffer:localId.get(e.buffer)}));
   const ownership=entries.map(e=>({stride:allocations[e.buffer].size/4,base:e.offset/4,length:e.size/4}));
   const source=entrySource(p.module.code,p.entryPoint),layout=clone(p.layout),key=JSON.stringify([source,ownership,layout]);let definition=keys.get(key);
   if(definition===undefined){definition=definitions.length;keys.set(key,definition);liftCandidatePhase(source,ownership);definitions.push({source,ownership,entryPoint:p.entryPoint,label:p.module.label,layout});}
   return{kind:'dispatch',definition,...(c.indirect?{indirect:{...c.indirect,buffer:localId.get(c.indirect.buffer)}}:{x:c.x}),entries};
  }
  if(c.kind==='copy')return{...c,source:localId.get(c.source),target:localId.get(c.target)};
  return{...c,buffer:localId.get(c.buffer)};
 });
 if(onUploadMetadata){const result=onUploadMetadata(Object.freeze(ids.map((id,index)=>Object.freeze({index,label:r.buffers[id].label,hostInitialized:r.buffers[id].hostInitialized,size:allocations[index].size,usage:allocations[index].usage,external:allocations[index].external}))));if(result&&typeof result.then==='function')throw TypeError('Upload metadata observer must be synchronous');}
 return auditLiveCushionIndirect({kind:mmq2?'experimental-live-mmq2-cushion-graph-v1':'experimental-live-mmq1-graph-v1',strikeBackend,allocations,definitions,commands:mapped,readback:localId.get(read.id),sourceQualified:false,nativeQualified:false});
}
export async function sha256Text(text){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
export async function liveWorldPlanIdentity(plan){
 const definitions=[];for(const {source,ownership,entryPoint,layout} of plan.definitions)definitions.push({sha256:await sha256Text(source),ownership,entryPoint,layout});
 const commandChunks=[];for(let i=0;i<plan.commands.length;i+=128)commandChunks.push(await sha256Text(JSON.stringify(plan.commands.slice(i,i+128))));
 return JSON.stringify({kind:plan.kind,strikeBackend:plan.strikeBackend,allocations:plan.allocations.map(({size,usage,external})=>({size,usage,external})),definitions,commandCount:plan.commands.length,commandsPerChunk:128,commandChunks,readback:plan.readback});
}
export function assertLiveWorldPlansEqual(a,b){
 const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),allocation=p=>p.allocations.map(({size,usage,external})=>({size,usage,external}));
 if(a.kind!==b.kind||a.strikeBackend!==b.strikeBackend||a.readback!==b.readback||!same(allocation(a),allocation(b))||a.definitions.length!==b.definitions.length||a.commands.length!==b.commands.length)throw Error('Live source/schedule/ownership mismatch; reject mixed engine execution');
 for(let i=0;i<a.definitions.length;i++){const x=a.definitions[i],y=b.definitions[i];if(x.source!==y.source||x.entryPoint!==y.entryPoint||!same(x.ownership,y.ownership)||!same(x.layout,y.layout))throw Error('Live source/schedule/ownership mismatch; reject mixed engine execution');}
 for(let i=0;i<a.commands.length;i++)if(!same(a.commands[i],b.commands[i]))throw Error('Live source/schedule/ownership mismatch; reject mixed engine execution');
}
export async function assertLiveWorldPlansCompatible(plans){if(!Array.isArray(plans)||!plans.length)throw Error('At least one captured plan');for(const p of plans.slice(1))assertLiveWorldPlansEqual(plans[0],p);return liveWorldPlanIdentity(plans[0]);}
