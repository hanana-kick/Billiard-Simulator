import {lowerQueryProgram} from './query-program-lowering.mjs';
import {lowerCushionProgram} from './cushion-program-lowering.mjs';
import {lowerSmoothCellProgram} from './smooth-program-lowering.mjs';
/** BUILD ONLY. Original selected factory on a recorder; stop at first map after
 * confirmed submission. No fake headers, decoding errors swallowed, or physics. */
import {createLiveWorldCaptureDevice} from '../direct-candidate/experimental-live-world-capture.mjs';
import {createCanonicalWorldContinuationGPU,snapshotCanonicalWorldContinuation} from '../direct-candidate/canonical-world-continuation.mjs';
import {RAW_WORLD_HANDOFF_WGSL, snapshotRawWorldBatch} from '../direct-candidate/deterministic-raw-world.mjs';
import {generateRawStrikePhases} from '../direct-candidate/deterministic-raw-strike.mjs';
import {auditLiveCushionIndirect} from '../direct-candidate/experimental-live-indirect.mjs';
import {WASM_GPU_SELECTED_ARTIFACT_FORMAT,WASM_GPU_SELECTED_CONFIG,SELECTED_WORLD_RANGES,selectedArtifactJSON,selectedArtifactHash,packSelectedCommands,loadWasmGpuSelectedArtifact} from './selected-artifact.mjs';
export async function captureWasmGpuSelectedProgram({binding,batch}={}){
 const snapshot=snapshotCanonicalWorldContinuation(binding);snapshotRawWorldBatch(batch);
 if(batch.count!==1||batch.binding.bodyCount!==4||batch.effectiveMaximumSteps!==2048||snapshot.options.maxWorldSteps!==128||snapshot.options.mixedMotionRevision!=='mmq2'||snapshot.options.enableCushionContinuation!==true||snapshot.options.selectedTrace)throw Error('Exact public selected MMQ2 N1/4-body/2048/128/256 capsule required');
 const r=createLiveWorldCaptureDevice({allowCushionIndirect:true}),stop=Object.freeze({kind:'selected-capture-post-submit-map-boundary'}),create=r.device.createBuffer;let maps=0,mapBuffer;
 r.device.createBuffer=descriptor=>{const b=create(descriptor);b.mapAsync=async()=>{if(r.submits!==1||!(b.usage&1))throw Error('Selected capture mapped before final submission');maps++;mapBuffer=b.id;throw stop;};return b;};
 const factory=await createCanonicalWorldContinuationGPU(r.device,binding,{strikeBackend:'staged'});let stopped=false;
 try{await factory.runRaw(batch,{selectedTrace:true,selectedTraceMaxRecords:256});}catch(error){if(error!==stop)throw error;stopped=true;}
 if(!stopped||r.submits!==1||maps!==1)throw Error('Selected capture must stop at exactly first submitted map');
 const reads=r.buffers.filter(b=>b.usage&1),world=reads.find(b=>b.label==='wasm-output:world:read'),trace=reads.find(b=>b.label==='wasm-output:trace-v2:read');
 if(reads.length!==2||!world||!trace||mapBuffer!==world.id||world.size!==11664||trace.size!==4194368)throw Error('Original selected final outputs required');
 const definitions=r.pipelines.map(p=>({code:p.module.code,layout:p.layout,entryPoint:p.entryPoint,constants:p.constants}));
 const commands=r.commands.map(c=>c.kind==='dispatch'?{kind:c.kind,definition:c.pipeline,...(c.indirect?{indirect:{...c.indirect}}:{x:c.x}),entries:c.entries.map(e=>({...e}))}:{...c});
 // Exact original indirect owner audit runs only during build. Keep native
 // commands unchanged; derived guard annotations are not execution changes.
 auditLiveCushionIndirect({allocations:r.buffers,definitions:definitions.map(d=>({source:d.code})),commands:structuredClone(commands)});
 return {recorder:r,definitions,commands,outputs:{world:{buffer:world.id,bytes:world.size,ranges:SELECTED_WORLD_RANGES},trace:{buffer:trace.id,bytes:trace.size}},stoppedAtFirstSubmittedMap:true};
}
export async function createWasmGpuSelectedArtifact({binding,batch,sourceRevision}={}){
 if(typeof sourceRevision!=='string'||!sourceRevision.trim())throw Error('Selected source revision required');
 const {recorder:r,definitions,commands,outputs}=await captureWasmGpuSelectedProgram({binding,batch});
 const rawRoles=new Map(),phases=generateRawStrikePhases();let handoffs=0;
 for(const c of commands){if(c.kind!=='dispatch')continue;const d=definitions[c.definition];const names=d.code===RAW_WORLD_HANDOFF_WGSL?['strikeResult','handoffInput','rosterTemplate','admitted','prepared','status','budget']:phases.some(p=>p.code===d.code)?['scene','strikeInput','strikeResult','strikeScratch']:null;if(!names)continue;if(d.code===RAW_WORLD_HANDOFF_WGSL)handoffs++;if(c.indirect||c.x!==1||c.entries.length!==names.length)throw Error('Exact raw source binding roles');c.entries.forEach((e,i)=>{const b=r.buffers[e.buffer],role='raw:'+names[i];if(e.binding!==i||e.offset!==0||e.size!==b.size||rawRoles.has(e.buffer)&&rawRoles.get(e.buffer)!==role)throw Error('Raw role alias/view mismatch');rawRoles.set(e.buffer,role);});}
 if(handoffs!==1||rawRoles.size!==10)throw Error('Complete one raw producer chain required');
 const initialization=r.buffers.map((b,index)=>{
  if(!b.hostInitialized)return {index,kind:'zero'};
  const role=rawRoles.get(index)??(b.label.startsWith('wasm-input:')?b.label.slice(11):null);
  if(role)return {index,kind:'dynamic',role};
  if(b.label.startsWith('wasm-fixed:trace-v2:phase:'))return {index,kind:'fixed',role:b.label.slice(11),bytes:Array.from(b.bytes)};
  throw Error('Unclassified selected host initialization: '+index+' '+b.label);
 });
 const originalAllocations=r.buffers.map(b=>({size:b.size,sourceUsage:b.usage,usage:b.usage|8,label:b.label}));
 const smooth=await lowerSmoothCellProgram({definitions,commands,allocations:originalAllocations},{sourceField:'code'}),cushion=await lowerCushionProgram(smooth,{sourceField:'code'}),lowered=await lowerQueryProgram(cushion,{sourceField:'code'});
 initialization.push({index:smooth.receipt.tempAllocation,kind:'zero'},{index:cushion.receipt.tempAllocation,kind:'zero'});for(const {index}of cushion.receipt.cacheAllocations)if(initialization[index].kind!=='zero')throw Error('Endpoint cache must retain zero initialization');
 initialization.push(...lowered.descriptors.map(d=>({...d,kind:'fixed'})));
 const payload={sourceRevision,structuralConfig:WASM_GPU_SELECTED_CONFIG,allocations:lowered.allocations,definitions:lowered.definitions,commands:packSelectedCommands(lowered.commands),outputs,initialization,lowering:smooth.receipt,cushionLowering:cushion.receipt,queryLowering:lowered.receipt,sourceHashes:await Promise.all(lowered.definitions.map(d=>selectedArtifactHash(d.code)))};
 const artifact={format:WASM_GPU_SELECTED_ARTIFACT_FORMAT,sha256:await selectedArtifactHash(payload),payload};
 await loadWasmGpuSelectedArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision});
 return {artifact,initialUploads:lowered.allocations.map((a,index)=>({index,initial:index<r.buffers.length&&r.buffers[index].size===a.size?r.buffers[index].bytes.slice():Uint8Array.from(lowered.descriptors.find(d=>d.index===index)?.bytes??new Uint8Array(a.size))}))};
}
