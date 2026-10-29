/** BUILD ONLY: classify every original allocation by descriptor provenance and
 * prove its complete initial bytes against current source-owned input packers. */
import {captureLiveWorldPlan} from '../direct-candidate/experimental-live-world-capture.mjs';
import {WORLD_UPLOAD_MANIFEST_FORMAT,WORLD_INPUT_ROLES,packWasmGpuWorldInputRoles,validateWasmGpuWorldUploadManifest} from './world-inputs.mjs';
export function buildWasmGpuWorldUploadManifest({plan,metadata,binding,batch}={}){
 if(!Array.isArray(metadata)||metadata.length!==plan?.allocations?.length)throw Error('Complete original upload metadata required');
 const current=packWasmGpuWorldInputRoles({binding,batch});
 const allocations=metadata.map((m,index)=>{const a=plan.allocations[index];if(m.index!==index||m.size!==a.size||m.usage!==a.usage||m.external!==a.external)throw Error('Metadata allocation mismatch');let role;
 if(a.external){if(m.hostInitialized)throw Error('Host-written external allocation unsupported');role='external';}
 else if(m.hostInitialized){if(typeof m.label!=='string'||!m.label.startsWith('wasm-input:'))throw Error('Unclassified host-written allocation '+index);role=m.label.slice(11);if(!WORLD_INPUT_ROLES.includes(role))throw Error('Unknown semantic input role '+role);const expected=current.roles.get(role);if(expected.byteLength!==a.size||expected.some((x,i)=>x!==a.initial[i]))throw Error('Source-owned upload bytes disagree for '+role);}
 else{role='zero';if(a.initial.some(x=>x!==0))throw Error('Unwritten allocation contains nonzero bytes');}
 return {index,size:a.size,usage:a.usage,external:a.external,hostInitialized:m.hostInitialized,role};});
 const manifest={format:WORLD_UPLOAD_MANIFEST_FORMAT,shape:current.shape,allocations};validateWasmGpuWorldUploadManifest(manifest,plan);return manifest;
}
export function wasmGpuWorldCandidateLocalAllocations(uploadManifest){
 if(uploadManifest?.format!==WORLD_UPLOAD_MANIFEST_FORMAT||!Array.isArray(uploadManifest.allocations))throw Error('Complete upload manifest required');
 const roles=['rules:identity','raw-prefix:identity'],indices=uploadManifest.allocations.filter(a=>roles.includes(a.role)).map(a=>a.index);
 if(indices.length!==roles.length||roles.some(role=>uploadManifest.allocations.filter(a=>a.role===role).length!==1))throw Error('Exactly one original candidate identity owner per role required');
 return indices;
}
export async function captureWasmGpuWorldInputPlan({binding,batch}={}){
 let metadata;const plan=await captureLiveWorldPlan(binding,batch,{profile:'mmq2-cushion',strikeBackend:'staged',onUploadMetadata:value=>{metadata=value;}});
 const uploadManifest=buildWasmGpuWorldUploadManifest({plan,metadata,binding,batch});
 return {plan,uploadManifest,metadata,candidateLocalAllocations:wasmGpuWorldCandidateLocalAllocations(uploadManifest)};
}
