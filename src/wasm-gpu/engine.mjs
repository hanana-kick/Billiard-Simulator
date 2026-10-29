/** Callable private stage-one owner: WASM schedules existing GPU WGSL.
 * Optional rawEngine adds captured staged raw GPU commands before world commands.
 * Without rawEngine, a transitional run borrows an external raw GPU lease.
 * Never substitutes CPU physics or fetches.
 */
import {assertLoadedWasmGpuEngineArtifact, loadWasmGpuEngineArtifact} from './engine-artifact.mjs';
import {assertLoadedWasmGpuRawArtifact, loadWasmGpuRawArtifact} from './raw-artifact.mjs';
import {createWasmGpuWebGPUBridge} from './webgpu-bridge.mjs';
import {prepareWasmGpuOwner} from './owner-core.mjs';

export async function prepareWasmGpuEngine({moduleBytes, device, engine, artifact, artifactExpectations, rawEngine, rawArtifact, rawArtifactExpectations, maximumOwnedBytes, chunkSize = 256, maxInFlight = 1, signal, onPrepareProgress} = {}) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 4096) throw new RangeError('chunkSize must be 1..4096');
  if (engine && artifact) throw new TypeError('Supply either loaded engine or serialized artifact');
  engine = engine ? assertLoadedWasmGpuEngineArtifact(engine) : await loadWasmGpuEngineArtifact(artifact, artifactExpectations);
  if (rawEngine && rawArtifact) throw new TypeError('Supply either loaded rawEngine or serialized rawArtifact');
  rawEngine = rawEngine ? assertLoadedWasmGpuRawArtifact(rawEngine) : rawArtifact ? await loadWasmGpuRawArtifact(rawArtifact, rawArtifactExpectations) : null;
  const bridge = await createWasmGpuWebGPUBridge(device, {engine, rawEngine, maximumOwnedBytes, maxInFlight, signal, onPrepareProgress});
  return prepareWasmGpuOwner({moduleBytes, device, bridge, chunkSize, signal, metadata: {ownsRaw: !!rawEngine}, snapshotRun({initialUploads, rawUploads, candidateIds, rawLease}) {
      if (rawEngine) {
        if (rawLease !== undefined) throw new TypeError('Combined raw/world mode does not accept external raw leases');
        if (!Array.isArray(rawUploads) || rawUploads.some(u => !Number.isSafeInteger(u?.index) || !(u.initial instanceof Uint8Array))) throw new TypeError('Complete current rawUploads required');
      } else {
        if (rawUploads !== undefined) throw new TypeError('rawUploads require a loaded rawEngine');
        if (!rawLease?.prepared || !rawLease?.status || typeof rawLease.release !== 'function') throw new TypeError('External raw GPU lease with prepared/status/release required');
      }
      if (!(candidateIds instanceof Uint32Array) || candidateIds.length !== engine.count || new Set(candidateIds).size !== engine.count) throw new TypeError('Distinct candidate IDs required');
      if (!Array.isArray(initialUploads) || initialUploads.some(u => !Number.isSafeInteger(u?.index) || !(u.initial instanceof Uint8Array))) throw new TypeError('Complete initialUploads required');
      // Snapshot caller-owned host inputs before the first await.
      const uploads = initialUploads.map(({index, initial}) => ({index, initial: initial.slice()}));
      const ids = candidateIds.slice();
      const rawInputs = rawEngine ? {rawUploads: rawUploads.map(({index, initial}) => ({index, initial: initial.slice()}))} : {externalBuffers: {prepared: rawLease.prepared, status: rawLease.status}};
      const release = rawEngine ? () => {} : rawLease.release.bind(rawLease);
      return {begin: {initialUploads: uploads, ...rawInputs, candidateIds: ids}, release};
  }});
}
