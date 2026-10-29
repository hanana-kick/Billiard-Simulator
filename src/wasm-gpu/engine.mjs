/** Callable private stage-one owner: WASM schedules existing GPU WGSL.
 * Optional rawEngine adds captured staged raw GPU commands before world commands.
 * Without rawEngine, a transitional run borrows an external raw GPU lease.
 * Never substitutes CPU physics or fetches.
 */
import {assertLoadedWasmGpuEngineArtifact, loadWasmGpuEngineArtifact} from './engine-artifact.mjs';
import {assertLoadedWasmGpuRawArtifact, loadWasmGpuRawArtifact} from './raw-artifact.mjs';
import {createWasmGpuWebGPUBridge} from './webgpu-bridge.mjs';
import {instantiateWasmGpuRuntime} from './runtime.mjs';
const abortError = reason => { const error = new Error(String(reason ?? 'WASM GPU run cancelled')); error.name = 'AbortError'; return error; };

export async function prepareWasmGpuEngine({moduleBytes, device, engine, artifact, artifactExpectations, rawEngine, rawArtifact, rawArtifactExpectations, maximumOwnedBytes, chunkSize = 256, maxInFlight = 1} = {}) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 4096) throw new RangeError('chunkSize must be 1..4096');
  if (engine && artifact) throw new TypeError('Supply either loaded engine or serialized artifact');
  engine = engine ? assertLoadedWasmGpuEngineArtifact(engine) : await loadWasmGpuEngineArtifact(artifact, artifactExpectations);
  if (rawEngine && rawArtifact) throw new TypeError('Supply either loaded rawEngine or serialized rawArtifact');
  rawEngine = rawEngine ? assertLoadedWasmGpuRawArtifact(rawEngine) : rawArtifact ? await loadWasmGpuRawArtifact(rawArtifact, rawArtifactExpectations) : null;
  const bridge = await createWasmGpuWebGPUBridge(device, {engine, rawEngine, maximumOwnedBytes, maxInFlight});
  let runtime;
  try {
    runtime = await instantiateWasmGpuRuntime({moduleBytes, bridge});
    runtime.load(Uint32Array.from({length: bridge.commandCount}, (_, i) => i + 1));
  } catch (error) { await bridge.dispose(); throw error; }
  let active = null, terminal = null, disposal = null, disposed = false;
  const checkAlive = () => { if (disposed || disposal) throw new Error('WASM GPU engine disposed'); if (terminal) throw terminal; };
  const status = () => Object.freeze({experimental: true, productionEnabled: false, requiresExclusiveDevice: true, ownsRaw: !!rawEngine, state: disposed ? 'disposed' : disposal ? 'disposing' : terminal ? 'lost' : active ? (active.cancelled ? 'cancelling' : 'running') : 'ready', generation: runtime.status().generation, scheduler: runtime.status()});
  const cancel = reason => {
    if (!active || active.cancelled) return false;
    active.cancelled = abortError(reason);
    // The scheduler may already be complete while bridge.finish is awaiting GPU.
    if (runtime.status().state === 'running') runtime.cancel();
    else bridge.cancel(active.generation);
    return true;
  };
  const lose = reason => {
    if (disposed) return;
    terminal = reason instanceof Error ? reason : new Error(String(reason));
    if (runtime.status().state !== 'disposed') runtime.lose(terminal);
  };
  Promise.resolve(device.lost).then(info => lose(new Error(`GPU device lost: ${info?.message ?? 'unknown'}`)), lose);
  const guard = token => {
    if (active !== token) throw new Error('Stale WASM GPU run');
    if (terminal) throw terminal;
    if (token.cancelled) { bridge.cancel(token.generation); throw token.cancelled; }
    if (disposal || disposed) throw abortError('WASM GPU engine disposed');
  };
  function run({initialUploads, rawUploads, candidateIds, rawLease, signal, onProgress} = {}) {
    try {
      checkAlive();
      if (active) throw new Error('WASM GPU engine run already active');
      if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw new TypeError('AbortSignal required');
      if (signal?.aborted) throw abortError(signal.reason);
      if (onProgress !== undefined && typeof onProgress !== 'function') throw new TypeError('onProgress must be a function');
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
      const token = {generation: runtime.start().generation, cancelled: null, promise: null};
      active = token;
      const onAbort = () => cancel(signal.reason);
      token.promise = (async () => {
        let result, failure, phase = 'begin';
        try {
          signal?.addEventListener('abort', onAbort, {once: true});
          if (signal?.aborted) onAbort();
          guard(token);
          await bridge.beginRun({generation: token.generation, initialUploads: uploads, ...rawInputs, candidateIds: ids});
          guard(token);
          let submittedCommands = 0;
          while (runtime.status().state === 'running') {
            phase = 'step';
            const chunk = await runtime.step(chunkSize); submittedCommands += chunk.submittedCommands;
            guard(token);
            if (onProgress) {
              phase = 'progress';
              await onProgress(Object.freeze({generation: token.generation, submittedCommands, totalCommands: bridge.commandCount}));
              guard(token);
            }
          }
          phase = 'finish'; result = await bridge.finish(token.generation); guard(token);
        } catch (error) {
          failure = token.cancelled || error;
          if (token.cancelled || phase === 'progress') {
            if (runtime.status().state === 'running') runtime.cancel();
            else bridge.cancel(token.generation);
          } else lose(error);
        } finally {
          // Always settle real GPU fences before releasing or allowing arena reuse.
          try { await bridge.drain(); } catch (error) { failure ??= error; lose(error); }
          try { await release(); } catch (error) { failure ??= error; lose(error); }
          try { signal?.removeEventListener('abort', onAbort); } catch (error) { failure ??= error; }
          // Cancellation/loss/disposal can arrive during async lease cleanup too.
          failure ??= terminal || token.cancelled || ((disposal || disposed) ? abortError('WASM GPU engine disposed') : null);
          if (active === token) active = null;
        }
        if (failure) throw failure;
        return Object.freeze({generation: token.generation, result});
      })();
      return token.promise;
    } catch (error) { return Promise.reject(error); }
  }
  function dispose() {
    if (disposal) return disposal;
    // Reserve disposal before any await; a run cannot enter during cleanup.
    cancel('WASM GPU engine disposed');
    const pending = active?.promise;
    disposal = (async () => {
      try {
        if (pending) await pending.catch(() => {});
        runtime.dispose();
        await bridge.dispose();
      } finally { disposed = true; }
    })();
    return disposal;
  }
  return Object.freeze({run, cancel, dispose, status, experimental: true, productionEnabled: false, requiresExclusiveDevice: true, ownsRaw: !!rawEngine});
}
