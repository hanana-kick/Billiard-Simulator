/** Bounded N1/N3 current-source prototype. Captures the actual live host graph;
 * no frozen WGSL refresh, hand-written world schedule, or CPU physics replay.
 * No app integration, release qualification, or large-N performance claim. */
import {linkResidentWGSL} from '../resident-candidate/wgsl-linker.mjs';
import {compileLiveWorldPipeline} from './experimental-live-world-pipeline-cache.mjs';
import {createLiveWorldSubmissionQueue} from './experimental-live-world-submissions.mjs';
import {createLiveWorldRunBindGroups} from './experimental-live-world-bind-groups.mjs';
import {captureRawWorldResourceFacts} from './experimental-live-world-raw-resources.mjs';
import {planLiveWorldResources,validateLiveWorldResources} from './experimental-live-world-resources.mjs';
import {createLiveWorldUploadPreparer} from './experimental-live-world-uploads.mjs';
import {LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION} from './experimental-live-world-build-seal.mjs';
import {prepareRawWorldBatch,createRawWorldGPU} from './deterministic-raw-world.mjs';
import {captureLiveWorldPlan,assertLiveWorldPlansCompatible,assertLiveWorldPlansEqual,liveWorldPlanIdentity,sha256Text} from './experimental-live-world-capture.mjs';
import {liftGuardedCandidatePhase,coalesceGuardedInvocationFault} from './experimental-guarded-storage-lift.mjs';
import {guardLiveCushionIndirect} from './experimental-live-indirect.mjs';
const abort=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
// Yield to browser input between bounded host stages; submitted GPU work must drain.
const checkpoint=async signal=>{abort(signal);await new Promise(resolve=>setTimeout(resolve,0));abort(signal);};
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export function liveCompileIndices(definitions,order='source'){if(!['source','largest-first'].includes(order))throw RangeError('Explicit compilation order');const indices=definitions.map((_,i)=>i);if(order==='largest-first')indices.sort((a,b)=>definitions[b].code.length-definitions[a].code.length||a-b);return indices;}
export async function lowerLiveWorldPlans(plans,{faultPolicy='atomic-per-access',candidateLocalAllocations=[]}={}){
 if(!['atomic-per-access','private-per-invocation'].includes(faultPolicy))throw Error('Unknown fault publication policy');
 const identity=await assertLiveWorldPlansCompatible(plans),base=plans[0],written=new Set();
 for(const c of base.commands){if(c.kind==='clear')written.add(c.buffer);if(c.kind==='copy')written.add(c.target);if(c.kind==='dispatch'){
  const def=base.definitions[c.definition],access=[...def.source.matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g)];
  if(access.length!==c.entries.length)throw Error('Unclassified live storage access');
  access.forEach((m,i)=>{if(m[2]==='read_write')written.add(c.entries[i].buffer);});
 }}
 const shared=base.allocations.map((a,i)=>!a.external&&!written.has(i)&&plans.every(p=>equal(p.allocations[i].initial,a.initial)));
 if(!Array.isArray(candidateLocalAllocations)||candidateLocalAllocations.some(i=>!Number.isInteger(i)||i<0||i>=base.allocations.length))throw Error('Exact candidate-local allocation roles required');
 for(const i of candidateLocalAllocations)shared[i]=false;
 shared[base.readback]=false;
 const definitions=[],keys=new Map(),variants=new Map(),intern=(code,layout='auto',faultBinding=null)=>{
  // Drop unreachable declarations before cold shader parsing. Retained function
  // bodies, bindings, dispatch order and the arithmetic model stay unchanged.
  code=linkResidentWGSL([code]).code;const key=JSON.stringify([code,layout,faultBinding]);let id=keys.get(key);if(id===undefined){id=definitions.length;keys.set(key,id);definitions.push({code,layout,faultBinding});}return id;};
 const commands=base.commands.map(c=>{
  if(c.kind==='dispatch'){
   const variantKey=JSON.stringify([c.definition,c.entries.map(e=>shared[e.buffer]),c.indirect?{offset:c.indirect.offset,bound:c.indirect.bound,stride:base.allocations[c.indirect.buffer].size/4}:null]);let definition=variants.get(variantKey);
   if(definition===undefined){const source=base.definitions[c.definition].source,ownership=c.entries.map(e=>shared[e.buffer]?null:{stride:base.allocations[e.buffer].size/4,base:e.offset/4,length:e.size/4}),scalarGuard=liftGuardedCandidatePhase(source,ownership,c.entries.map(e=>e.size/4)),originalGuard=faultPolicy==='private-per-invocation'?coalesceGuardedInvocationFault(scalarGuard):scalarGuard,guarded=c.indirect?guardLiveCushionIndirect(originalGuard,{stride:base.allocations[c.indirect.buffer].size/4,...c.indirect}):originalGuard;let layout=structuredClone(base.definitions[c.definition].layout);if(layout!=='auto'){if(layout.bindGroupLayouts.length!==1)throw Error('One layout group required');if(layout.bindGroupLayouts[0].entries.length!==c.entries.length||layout.bindGroupLayouts[0].entries.some((e,i)=>e.binding!==i))throw Error('Exact explicit layout binding order required');layout.bindGroupLayouts[0].entries.push({binding:guarded.faultBinding,visibility:4,buffer:{type:'storage'}});if(c.indirect)layout.bindGroupLayouts[0].entries.push({binding:guarded.indirectBinding,visibility:4,buffer:{type:'read-only-storage'}});}definition=intern(guarded.code,layout,guarded.faultBinding);variants.set(variantKey,definition);}
   return{...c,definition,x:c.indirect?.bound??c.x,entries:[...c.entries.map(e=>shared[e.buffer]?e:{binding:e.binding,buffer:e.buffer,offset:0,size:base.allocations[e.buffer].size*plans.length}),...(c.indirect?[{binding:c.entries.length+1,buffer:c.indirect.buffer,offset:0,size:base.allocations[c.indirect.buffer].size*plans.length}]:[])]};
  }
  if(c.kind==='copy'){
   if(c.source===c.target)throw Error('Same-buffer copies require overlap proof');
   const a=base.allocations[c.source],b=base.allocations[c.target],count=c.size/4,code=`@group(0) @binding(0) var<storage,read> source:array<u32>;@group(0) @binding(1) var<storage,read_write> copyOut:array<u32>;@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<${count}u){copyOut[id.y*${b.size/4}u+${c.targetOffset/4}u+id.x]=source[${shared[c.source]?'0u':`id.y*${a.size/4}u`}+${c.sourceOffset/4}u+id.x];}}`;
   return{kind:'dispatch',definition:intern(code),x:Math.ceil(count/32),entries:[{binding:0,buffer:c.source,offset:0,size:a.size*(shared[c.source]?1:plans.length)},{binding:1,buffer:c.target,offset:0,size:b.size*plans.length}]};
  }
  if(c.offset!==0||c.size!==base.allocations[c.buffer].size){const a=base.allocations[c.buffer];if(c.offset%4||c.size%4||c.offset<0||c.offset+c.size>a.size)throw Error('Invalid clear subview');const code=`@group(0) @binding(0) var<storage,read_write> copyOut:array<u32>;@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<${c.size/4}u){copyOut[id.y*${a.size/4}u+${c.offset/4}u+id.x]=0u;}}`;return{kind:'dispatch',definition:intern(code),x:Math.ceil(c.size/128),entries:[{binding:0,buffer:c.buffer,offset:0,size:a.size*plans.length}]};}return c;
 });
 const ownershipReport={boundsProof:'not-established-by-capture-or-N1-N3-parity',allocations:base.allocations.map((a,i)=>({id:i,size:a.size,written:written.has(i),shared:shared[i],external:a.external})),dispatchOwnership:'streamed by liveWorldDispatchOwnership; no duplicated command graph'};
 ownershipReport.guardPolicy='explicit scalar bounds guards; sticky atomic fault gates result unsupported; '+faultPolicy;ownershipReport.requiredStorageBuffersPerShaderStage=Math.max(...definitions.map(d=>(d.code.match(/var<storage,/g)??[]).length));return{identity,sourcePlan:base,shared,definitions,commands,ownershipReport};
}
export function* liveWorldDispatchOwnership(lowered){for(let i=0;i<lowered.commands.length;i++){const c=lowered.commands[i];if(c.kind!=='dispatch')continue;yield{command:i,definition:c.definition,originalCommand:lowered.sourcePlan.commands[i],bindings:c.entries.map(e=>({...e,strideWords:lowered.shared[e.buffer]?null:lowered.sourcePlan.allocations[e.buffer].size/4})),faultBinding:lowered.definitions[c.definition].faultBinding};}}
export async function liveWorldRecipeIdentity(lowered){const definitions=[];for(const {code,layout,faultBinding} of lowered.definitions)definitions.push({sha256:await sha256Text(code),layout,faultBinding});return JSON.stringify({sourcePlan:lowered.identity,definitions,shared:lowered.shared,guardPolicy:lowered.ownershipReport.guardPolicy,requiredStorageBuffersPerShaderStage:lowered.ownershipReport.requiredStorageBuffersPerShaderStage});}
export function assertLiveWorldRecipesEqual(a,b){assertLiveWorldPlansEqual(a.sourcePlan,b.sourcePlan);if(JSON.stringify(a.shared)!==JSON.stringify(b.shared)||a.ownershipReport.guardPolicy!==b.ownershipReport.guardPolicy||a.ownershipReport.requiredStorageBuffersPerShaderStage!==b.ownershipReport.requiredStorageBuffersPerShaderStage||a.definitions.length!==b.definitions.length||a.commands.length!==b.commands.length)throw Error('Guarded recipe mismatch');for(let i=0;i<a.definitions.length;i++){const x=a.definitions[i],y=b.definitions[i];if(x.code!==y.code||x.faultBinding!==y.faultBinding||JSON.stringify(x.layout)!==JSON.stringify(y.layout))throw Error('Guarded recipe mismatch');}for(let i=0;i<a.commands.length;i++)if(JSON.stringify(a.commands[i])!==JSON.stringify(b.commands[i]))throw Error('Guarded recipe mismatch');}
async function captureTile(binding,rawBinding,candidates,maximumSteps,strikeBackend,signal,profile){const plans=[];for(const candidate of candidates){abort(signal);let p=await captureLiveWorldPlan(binding,prepareRawWorldBatch(rawBinding,[candidate],{maximumSteps}),{strikeBackend,profile});if(plans.length){assertLiveWorldPlansEqual(plans[0],p);p={...plans[0],allocations:p.allocations};}plans.push(p);}return plans;}
export function liveWorldWidthPolicy({count,validationProfile=null,profile,preparation,strikeBackend,faultPolicy,compileOrder,maximumSteps,bodyCount,allAdmitted}={}){
 if(validationProfile===null){if(![1,3].includes(count))throw RangeError('Reviewed default widths are N1 and N3 only');return Object.freeze({diagnosticOnly:false,singleSubmission:false});}
 if(validationProfile==='mmq1-n16-repeat-qualification-v1'){
  if(count!==16||profile!=='mmq1-no-cushion'||preparation!=='sealed-uploads'||strikeBackend!=='staged'||faultPolicy!=='atomic-per-access'||compileOrder!=='source'||maximumSteps!==2048||bodyCount!==4||allAdmitted!==true)throw RangeError('Exact opt-in MMQ1 N16 qualification profile required');
  return Object.freeze({diagnosticOnly:false,singleSubmission:false});
 }
 if(validationProfile!=='mmq2-n33-diagnostic-v1'||count!==33||profile!=='mmq2-cushion'||preparation!=='sealed-uploads'||strikeBackend!=='staged'||faultPolicy!=='atomic-per-access'||compileOrder!=='largest-first'||maximumSteps!==1700||bodyCount!==4||allAdmitted!==true)throw RangeError('Exact opt-in N33 diagnostic validation profile required');
 return Object.freeze({diagnosticOnly:true,singleSubmission:true});
}
export function assertLiveWorldReplacementCandidates(replacement,count,validationProfile){
 if(!Array.isArray(replacement)||replacement.length!==count||new Set(replacement.map(c=>c?.candidateId)).size!==count)throw RangeError('Same width distinct owned candidates required');
 if(validationProfile==='mmq1-n16-repeat-qualification-v1'&&replacement.some(c=>c?.admitted!==true))throw RangeError('N16 qualification requires admitted replacement candidates');
}
export async function createExperimentalLiveWorldBatchGPU(device,{binding,rawBinding,candidates,request,preparation='full-capture',validationProfile=null,maximumOwnedBytes=8*1024*1024,maximumSteps=2048,strikeBackend='staged',profile='mmq1-no-cushion',faultPolicy='atomic-per-access',compileOrder='source',expectedBuildRevision,expectedPlanIdentity,expectedRecipeIdentity,expectedPlan,expectedRecipe,onCompilePhase=()=>{},signal}={}){
 await checkpoint(signal);
 if(!Number.isSafeInteger(maximumOwnedBytes)||maximumOwnedBytes<1||maximumOwnedBytes>8*1024*1024)throw RangeError('Explicit owned-buffer policy budget1..8MiB');
 if(!['full-capture','sealed-uploads'].includes(preparation))throw RangeError('Explicit preparation mode');
 if(preparation==='sealed-uploads'&&!LIVE_WORLD_UPLOAD_SOURCE_SEALED)throw Error('Upload-only graph reuse requires verified sealed build');
 if(expectedBuildRevision!==undefined&&expectedBuildRevision!==LIVE_WORLD_UPLOAD_SOURCE_REVISION)throw Error('Same-build source revision mismatch');
 if(typeof onCompilePhase!=='function')throw TypeError('Compile phase observer');if(!['source','largest-first'].includes(compileOrder))throw RangeError('Explicit compilation order');
 if(!Array.isArray(candidates))throw RangeError('Owned candidate array required');
 const widthPolicy=liveWorldWidthPolicy({count:candidates.length,validationProfile,profile,preparation,strikeBackend,faultPolicy,compileOrder,maximumSteps,bodyCount:rawBinding?.bodyCount,allAdmitted:candidates.every(c=>c?.admitted===true)});let validationSubmissionUsed=false;
 candidates=[...candidates];
 if(new Set(candidates.map(c=>c.candidateId)).size!==candidates.length)throw RangeError('Distinct candidate IDs required');
 const batch=prepareRawWorldBatch(rawBinding,candidates,{maximumSteps}),N=candidates.length;
 let plans,uploadPreparer,uploadTokens;
 if(preparation==='sealed-uploads'){
  const first=prepareRawWorldBatch(rawBinding,[candidates[0]],{maximumSteps});await checkpoint(signal);uploadPreparer=await createLiveWorldUploadPreparer({request,binding,batch:first,strikeBackend,profile});
  if(!uploadPreparer.graphReuseQualified)throw Error('Unqualified upload preparation');
  uploadTokens=[];for(const c of candidates){await checkpoint(signal);uploadTokens.push(await uploadPreparer.prepare(prepareRawWorldBatch(rawBinding,[c],{maximumSteps})));}
  const base=uploadPreparer.runtimePlan(uploadTokens[0]);plans=Array(N).fill(base);
 }else plans=await captureTile(binding,rawBinding,candidates,maximumSteps,strikeBackend,signal,profile);
 await checkpoint(signal);
 const candidateLocalAllocations=uploadPreparer&&N>1?uploadPreparer.roles.map(r=>r.index):[];
 const lowered=await lowerLiveWorldPlans(plans,{faultPolicy,candidateLocalAllocations}),plan=plans[0];
 if(expectedPlan!==undefined)assertLiveWorldPlansEqual(plan,expectedPlan);if(expectedRecipe!==undefined)assertLiveWorldRecipesEqual(lowered,expectedRecipe);
 if(expectedPlanIdentity!==undefined&&expectedPlanIdentity!==lowered.identity)throw Error('Live source/schedule/ownership mismatch; cannot mix search and selected engines');
 await checkpoint(signal);const recipeIdentity=await liveWorldRecipeIdentity(lowered);if(expectedRecipeIdentity!==undefined&&expectedRecipeIdentity!==recipeIdentity)throw Error('Guarded recipe mismatch');
 const requiredStorageBuffers=lowered.ownershipReport.requiredStorageBuffersPerShaderStage;if((device.limits.maxStorageBuffersPerShaderStage??0)<requiredStorageBuffers)throw RangeError('Experimental guarded profile requires '+requiredStorageBuffers+' storage buffers per shader stage');
 const rawAllocations=await captureRawWorldResourceFacts(batch,{strikeBackend}),resourceInput={plan,shared:lowered.shared,commands:lowered.commands,definitions:lowered.definitions,count:N,rawAllocations},compactResources=planLiveWorldResources(resourceInput),diagnosticResources=planLiveWorldResources({...resourceInput,diagnostic:true});
 validateLiveWorldResources(diagnosticResources,device.limits,{maximumOwnedBytes});
 const recipeSHA256=await sha256Text(recipeIdentity),compileStart=performance.now(),pipelines=[];
 // Stream exact source preflight/compile: do not retain future shader modules.
 // Error timing differs from eager all-source preflight; no shader or graph changes.
 const compileIndices=liveCompileIndices(lowered.definitions,compileOrder);
 for(const [compileOrdinal,i] of compileIndices.entries()){await checkpoint(signal);const d=lowered.definitions[i],definitionStarted=performance.now();
  onCompilePhase({stage:'start',phase:i,compileOrdinal,total:lowered.definitions.length,elapsedMs:definitionStarted-compileStart,...(compileOrdinal===0?{recipeSHA256}:{} )});
  pipelines[i]=await compileLiveWorldPipeline(device,{code:d.code,layout:d.layout,label:'experimental-live-world-'+i,signal});abort(signal);onCompilePhase({stage:'end',phase:i,compileOrdinal,total:lowered.definitions.length,definitionMs:performance.now()-definitionStarted,elapsedMs:performance.now()-compileStart});
 }
 await checkpoint(signal);const finalStride=plan.allocations[plan.readback].size/4;const gateCode=liveBoundsResultGateSource(finalStride);const gatePipeline=await compileLiveWorldPipeline(device,{code:gateCode,preflight:false,signal});
 abort(signal);const raw=await createRawWorldGPU(device,{strikeBackend,signal,reusePipelines:true,onCompileStage:()=>{abort(signal);}});abort(signal);const compileMs=performance.now()-compileStart;
 return Object.freeze({sourcePlanIdentity:lowered.identity,recipeIdentity,compileOrder,compileMs,preparation,validationProfile,maximumOwnedBytes,resourceRequirements:diagnosticResources.requiredLimits,buildRevision:LIVE_WORLD_UPLOAD_SOURCE_REVISION,candidateCount:N,definitionCount:pipelines.length,requiredStorageBuffersPerShaderStage:requiredStorageBuffers,productionEnabled:false,
  async run({signal,diagnostic=false,candidates:replacement,onPhase=()=>{}}={}){
   abort(signal);if(widthPolicy.diagnosticOnly&&(diagnostic!==true||replacement!==undefined))throw Error('N33 validation permits original diagnostic submission only');if(widthPolicy.singleSubmission&&validationSubmissionUsed)throw Error('N33 validation submission already used');let activePlans=plans,activeBatch=batch,activeCandidates=candidates,activeUploadTokens=uploadTokens;
   if(replacement!==undefined){assertLiveWorldReplacementCandidates(replacement,N,validationProfile);activeCandidates=[...replacement];activeBatch=prepareRawWorldBatch(rawBinding,activeCandidates,{maximumSteps});if(uploadPreparer){activeUploadTokens=[];for(const c of activeCandidates){abort(signal);activeUploadTokens.push(await uploadPreparer.prepare(prepareRawWorldBatch(rawBinding,[c],{maximumSteps})));}}else{activePlans=await captureTile(binding,rawBinding,activeCandidates,maximumSteps,strikeBackend,signal,profile);assertLiveWorldRecipesEqual(lowered,await lowerLiveWorldPlans(activePlans,{faultPolicy}));}abort(signal);}
   const resources=diagnostic?diagnosticResources:compactResources;validateLiveWorldResources(resources,device.limits,{maximumOwnedBytes});
   const activeUploads=uploadPreparer?activeUploadTokens.map(token=>new Map(uploadPreparer.snapshotUploads(token).map(x=>[x.index,x.initial]))):null;
   const rawBank=raw.createBank(activeBatch),buffers=[],owned=[],runGroups=createLiveWorldRunBindGroups(device);let mapped=false,mappedRead;
   try{
    for(let i=0;i<plan.allocations.length;i++){
     const a=plan.allocations[i];if(a.external){buffers.push(a.external==='prepared'?rawBank.preparedWorldBuffer:rawBank.handoffStatusBuffer);continue;}
     const size=a.size*(lowered.shared[i]?1:N),b=device.createBuffer({size,usage:128|4|8});buffers.push(b);owned.push(b);
     const bytes=new Uint8Array(size);for(let c=0;c<(lowered.shared[i]?1:N);c++)bytes.set(activeUploads?.[c].get(i)??activePlans[c].allocations[i].initial,c*a.size);device.queue.writeBuffer(b,0,bytes);
    }
    const stride=plan.allocations[plan.readback].size/4,outputSize=diagnostic?stride*N*4:16*N,read=device.createBuffer({size:outputSize,usage:1|8});owned.push(read);
    const fault=device.createBuffer({size:N*4,usage:128|8});owned.push(fault);const ids=device.createBuffer({size:N*4,usage:128|8});owned.push(ids);device.queue.writeBuffer(fault,0,new Uint32Array(N));device.queue.writeBuffer(ids,0,Uint32Array.from(activeCandidates,c=>c.candidateId));
    const commandEncodingStart=performance.now(),submissions=createLiveWorldSubmissionQueue(device,{signal,onPhase});let encoder=device.createCommandEncoder(),rawCommands=0;const dispatchesRaw=rawBank.dispatches;
    if(widthPolicy.singleSubmission)rawBank.encode(encoder);
    else{await rawBank.encodeCooperatively({signal,getEncoder:()=>encoder,afterCommand:async()=>{rawCommands++;if(rawCommands%256===0){await submissions.submit(encoder);encoder=device.createCommandEncoder();await checkpoint(signal);onPhase({phase:'encoding',encodedCommands:rawCommands,totalCommands:dispatchesRaw+lowered.commands.length});}}});
     if(rawCommands%256){await submissions.submit(encoder);encoder=device.createCommandEncoder();}}
    let dispatches=dispatchesRaw;
    let encodedCommands=0;onPhase({phase:'encoding',encodedCommands:dispatchesRaw+encodedCommands,totalCommands:dispatchesRaw+lowered.commands.length});
    for(const c of lowered.commands){if(!widthPolicy.singleSubmission&&encodedCommands&&encodedCommands%256===0){await submissions.submit(encoder);encoder=device.createCommandEncoder();await checkpoint(signal);onPhase({phase:'encoding',encodedCommands:dispatchesRaw+encodedCommands,totalCommands:dispatchesRaw+lowered.commands.length});}encodedCommands++;if(c.kind==='clear'){encoder.clearBuffer(buffers[c.buffer]);continue;}const p=pipelines[c.definition],group=runGroups.get(p,[...c.entries.map(e=>({binding:e.binding,resource:{buffer:buffers[e.buffer],offset:e.offset,size:e.size}})),...(lowered.definitions[c.definition].faultBinding===null?[]:[{binding:lowered.definitions[c.definition].faultBinding,resource:{buffer:fault}}])]),pass=encoder.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,group);pass.dispatchWorkgroups(c.x,N);pass.end();dispatches++;}
    {const pass=encoder.beginComputePass();pass.setPipeline(gatePipeline);pass.setBindGroup(0,runGroups.get(gatePipeline,[fault,buffers[plan.readback],ids].map((buffer,binding)=>({binding,resource:{buffer}}))));pass.dispatchWorkgroups(N);pass.end();dispatches++;}
    if(diagnostic)encoder.copyBufferToBuffer(buffers[plan.readback],0,read,0,outputSize);else for(let i=0;i<N;i++)encoder.copyBufferToBuffer(buffers[plan.readback],(i*stride+stride-4)*4,read,i*16,16);
    abort(signal);if(widthPolicy.singleSubmission)validationSubmissionUsed=true;const commandEncodingMs=performance.now()-commandEncodingStart-submissions.stats().waitMs;await submissions.submit(encoder);abort(signal);await read.mapAsync(1);mapped=true;mappedRead=read;abort(signal);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();mapped=false;
    return{buildRevision:LIVE_WORLD_UPLOAD_SOURCE_REVISION,preparation,validationProfile,requestIdentity:binding.requestIdentity,sceneIdentity:binding.sceneIdentity,epoch:binding.epoch,candidateKeys:[...activeBatch.candidateKeys],...(diagnostic?{words,diagnosticWordStride:stride}:{}),compact:diagnostic?Uint32Array.from(Array.from({length:N},(_,i)=>Array.from(words.slice((i+1)*stride-4,(i+1)*stride))).flat()):words,sourcePlanIdentity:lowered.identity,recipeIdentity,coverage:'experimental-current-source-'+profile+'-'+(validationProfile??'N1-N3'),metrics:{compileMs,dispatches,commandEncodingMs,bindGroups:runGroups.stats(),readbackBytes:outputSize,submitToDoneMs:submissions.stats().waitMs,submittedChunks:submissions.stats().submittedChunks,maximumWorldCommandsPerSubmission:widthPolicy.singleSubmission?null:256,allocatedWorldBytes:owned.reduce((s,b)=>s+b.size,0),plannedTotalOwnedBytes:resources.totalOwnedBytes,maximumOwnedBytes,hardwareVerified:false},cumulativeWorkBudgetEnforced:false,cumulativeEventBudgetEnforced:false};
   }finally{runGroups.dispose();if(mapped)mappedRead?.unmap();owned.forEach(b=>b.destroy());rawBank.dispose();}
  }
 });
}

export function liveBoundsResultGateSource(stride){if(!Number.isInteger(stride)||stride<4)throw RangeError('Complete result stride');return `@group(0) @binding(0) var<storage,read_write> fault:array<atomic<u32>>;@group(0) @binding(1) var<storage,read_write> result:array<u32>;@group(0) @binding(2) var<storage,read> ids:array<u32>;@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let c=id.x;if(c>=arrayLength(&ids)){return;}if(atomicLoad(&fault[c])!=0u){let b=(c+1u)*${stride}u-4u;result[b]=ids[c];result[b+1u]=4u;result[b+2u]=4u;result[b+3u]=0x80000000u;}}`;}
