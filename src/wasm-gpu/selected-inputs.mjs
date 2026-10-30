/** Current source-owned request -> complete native selected arena resets.
 * No graph capture, GPU calls, physics evaluation, or frozen scene uploads. */
import {assertLoadedWasmGpuSelectedArtifact,WASM_GPU_SELECTED_CONFIG,selectedArtifactJSON} from './selected-artifact.mjs';
import {isWasmGpuInputContract,assertWasmGpuSelectedInputContract} from './input-contract.mjs';
import {packWasmGpuWorldInputRoles} from './world-inputs.mjs';
import {snapshotCanonicalWorldContinuation} from '../direct-candidate/canonical-world-continuation.mjs';
import {snapshotRawWorldBatch} from '../direct-candidate/deterministic-raw-world.mjs';
import {validatePreparedWorld} from '../direct-candidate/deterministic-prepared-world.mjs';
import {inspectCanonicalPhaseBudget} from '../direct-candidate/canonical-engine-contract.mjs';
import {packSelectedWorldTraceV2Control} from '../direct-candidate/canonical-selected-world-trace-v2-gpu.mjs';
const bytes=x=>new Uint8Array(x.buffer,x.byteOffset,x.byteLength).slice();
export function prepareWasmGpuSelectedInputs({engine,binding,batch,maximumRecords=256}={}){
 isWasmGpuInputContract(engine,'selected')?assertWasmGpuSelectedInputContract(engine):assertLoadedWasmGpuSelectedArtifact(engine);
 const d=snapshotCanonicalWorldContinuation(binding),raw=snapshotRawWorldBatch(batch),b=batch.binding,config=engine.structuralConfig;
 if(selectedArtifactJSON(config)!==selectedArtifactJSON(WASM_GPU_SELECTED_CONFIG)||maximumRecords!==config.maximumRecords||batch.count!==1||batch.maximumSteps!==config.maximumSteps||batch.effectiveMaximumSteps!==config.maximumSteps||b.bodyCount!==config.bodyCount||d.options.maxWorldSteps!==config.maxWorldSteps||d.options.mixedMotionRevision!=='mmq2'||d.options.enableCushionContinuation!==true||d.options.selectedTrace)throw Error('Current selected structural capsule mismatch');
 if(b.requestIdentity!==binding.requestIdentity||b.sceneId!==binding.sceneIdentity||b.epoch!==binding.epoch||d.request.epoch!==binding.epoch||b.sceneKey!==binding.sceneKey||b.requestKey!==binding.requestKey||selectedArtifactJSON(b.shotClock)!==selectedArtifactJSON(binding.shotClock)||selectedArtifactJSON(d.shotClock)!==selectedArtifactJSON(binding.shotClock))throw Error('Current selected owned request/scene/epoch/clock mismatch');
 const original=raw.template.slice();original[1]=raw.rawRows[0];validatePreparedWorld(original,d.scene);
 if(original[8]!==binding.sceneKey||original[9]!==binding.requestKey||original[7]!==d.request.cueSlot||original[2]!==d.request.slotToId.length||original[3]!==b.absoluteTick||d.request.slotToId.some((id,i)=>original[32+i*40]!==id))throw Error('Current selected complete PW1 identity/roster mismatch');
 inspectCanonicalPhaseBudget(d.request,d.shotClock,original[3],1);
 const {roles,shape,candidateId}=packWasmGpuWorldInputRoles({binding,batch});
 if(candidateId!==original[1]||shape.profile!==config.profile||shape.strikeBackend!==config.strikeBackend||shape.bodyCount!==config.bodyCount||shape.maximumSteps!==config.maximumSteps||shape.maxWorldSteps!==config.maxWorldSteps)throw Error('Current selected source input shape mismatch');
 for(const [role,value]of Object.entries({scene:raw.rawScene,strikeInput:raw.rawRows,handoffInput:raw.rawRows,rosterTemplate:raw.template,admitted:raw.admitted,budget:raw.budgetWords}))roles.set('raw:'+role,bytes(value));
 roles.set('trace-v2:control',bytes(packSelectedWorldTraceV2Control({candidateCount:1,candidateId,sceneKey:b.sceneKey,requestKey:b.requestKey,bodyCount:b.bodyCount,maximumRecords,pinnedMotionVersion:0x4d4d5102})));
 const initialUploads=engine.initialization.map(m=>{const a=engine.allocations[m.index];const data=m.kind==='zero'?new Uint8Array(a.size):m.kind==='fixed'?Uint8Array.from(m.bytes):roles.get(m.role);if(!(data instanceof Uint8Array)||data.byteLength!==a.size)throw Error('Current selected semantic input size mismatch: '+m.index+' '+m.role);return {index:m.index,initial:data.slice()};});
 return {initialUploads,candidateIds:Uint32Array.of(candidateId)};
}
