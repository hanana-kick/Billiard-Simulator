/** Private native selected owner: actual WASM schedule, full source GPU outputs. */
import {assertLoadedWasmGpuSelectedArtifact,loadWasmGpuSelectedArtifact} from './selected-artifact.mjs';
import {createWasmGpuSelectedWebGPUBridge} from './selected-webgpu-bridge.mjs';
import {prepareWasmGpuOwner} from './owner-core.mjs';
export async function prepareWasmGpuSelectedEngine({moduleBytes,device,engine,artifact,artifactExpectations,maximumOwnedBytes,chunkSize=256,maxInFlight=1,signal,onPrepareProgress}={}){
 if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>4096)throw RangeError('chunkSize must be1..4096');
 if(!Number.isSafeInteger(maximumOwnedBytes)||maximumOwnedBytes<1||maximumOwnedBytes>12*1024*1024)throw RangeError('Explicit selected owned budget up to12MiB required');
 if(engine&&artifact)throw TypeError('Supply loaded selected engine or serialized artifact');
 engine=engine?assertLoadedWasmGpuSelectedArtifact(engine):await loadWasmGpuSelectedArtifact(artifact,artifactExpectations);
 const bridge=await createWasmGpuSelectedWebGPUBridge(device,{engine,maximumOwnedBytes,maxInFlight,signal,onPrepareProgress});
 return prepareWasmGpuOwner({moduleBytes,device,bridge,chunkSize,signal,metadata:{selected:true,ownsRaw:true},snapshotRun({initialUploads,rawLease,rawUploads}){
  if(rawLease!==undefined||rawUploads!==undefined)throw TypeError('Selected owner accepts only complete owned initialUploads');
  if(!Array.isArray(initialUploads)||initialUploads.some(u=>!Number.isSafeInteger(u?.index)||!(u.initial instanceof Uint8Array)))throw TypeError('Complete current selected initialUploads required');
  return {begin:{initialUploads:initialUploads.map(({index,initial})=>({index,initial:initial.slice()}))}};
 }});
}
