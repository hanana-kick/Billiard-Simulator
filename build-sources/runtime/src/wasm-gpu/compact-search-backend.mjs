/** Private DEVTREE integration seam, explicitly NOT a qualified build library.
 * Lookup injection is a harness capability, never proof of source qualification.
 * No CPU physics, capture, fallback, public wiring, or network acquisition.
 */
import {validateCanonicalRequest, validateCanonicalCandidate} from '../direct-candidate/canonical-engine-contract.mjs';
import {snapshotCanonicalWorldContinuation} from '../direct-candidate/canonical-world-continuation.mjs';
import {prepareRawWorldBatch} from '../direct-candidate/deterministic-raw-world.mjs';
import {assertLoadedWasmGpuEngineArtifact, canonicalEngineArtifactJSON} from './engine-artifact.mjs';
import {assertLoadedWasmGpuRawArtifact} from './raw-artifact.mjs';
import {prepareWasmGpuInputs} from './world-inputs.mjs';
import {prepareWasmGpuEngine} from './engine.mjs';
import {isWasmGpuInputContract,assertWasmGpuWorldInputContract,assertWasmGpuRawInputContract} from './input-contract.mjs';
import {assertWorkerOwnerEndpoint} from './worker-owner-client.mjs';
const aborted = signal => { if (signal?.aborted) { const e = new Error(String(signal.reason ?? 'WASM compact search cancelled')); e.name = 'AbortError'; throw e; } };
const callback = (fn, detail) => { const result = fn?.(Object.freeze(detail)); if (result && typeof result.then === 'function') { Promise.resolve(result).catch(() => {}); throw new TypeError('Synchronous backend progress callbacks required'); } };
const checkSignal = signal => { if (signal !== undefined && signal !== null && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) throw new TypeError('AbortSignal required'); };
const now = () => globalThis.performance?.now() ?? Date.now();

/** Only a harness constructor exists until a separately reviewed, independently
 * pinned build-manifest owner supplies a non-forgeable production library. */
export function createWasmGpuCompactSearchBackendHarness({lookupProgram, sourceRevision, moduleBytes, workerEndpoint, maximumOwnedBytes, chunkSize = 256, maximumCachedPrograms = 4, prepareEngine = prepareWasmGpuEngine} = {}) {
  if (typeof lookupProgram !== 'function' || typeof prepareEngine !== 'function') throw new TypeError('Explicit program lookup and owner factory required');
  if (typeof sourceRevision !== 'string' || !sourceRevision.trim()) throw new TypeError('Explicit descriptive source revision required');
  if (!Number.isSafeInteger(maximumOwnedBytes) || maximumOwnedBytes < 1) throw new RangeError('Explicit owned GPU byte budget required');
  if (!Number.isSafeInteger(maximumCachedPrograms) || maximumCachedPrograms < 1 || maximumCachedPrograms > 4) throw new RangeError('Bounded cache1..4 programs per device required');
  const workerOwned = workerEndpoint !== undefined;
  if (workerOwned) {
    assertWorkerOwnerEndpoint(workerEndpoint);
    if (moduleBytes !== undefined || prepareEngine === prepareWasmGpuEngine) throw new TypeError('Worker-owned scheduler requires a remote owner and no main-thread WASM bytes');
  } else if (!(moduleBytes instanceof ArrayBuffer) && !ArrayBuffer.isView(moduleBytes)) throw new TypeError('Explicit bundled WASM bytes required');
  const scheduler = workerOwned ? {workerEndpoint} : {moduleBytes: moduleBytes instanceof ArrayBuffer ? new Uint8Array(moduleBytes).slice() : new Uint8Array(moduleBytes.buffer, moduleBytes.byteOffset, moduleBytes.byteLength).slice()};
  const devices = new Map(); let tail = Promise.resolve(), disposed = false, disposal = null, active = null, cancellation = 0;
  const current = ticket => { if (ticket !== cancellation) { const e = new Error('WASM compact invocation cancelled'); e.name = 'AbortError'; throw e; } };
  const alive = () => { if (disposed) throw new Error('WASM compact backend disposed'); };
  const serial = work => { const result = tail.then(work); tail = result.catch(() => {}); return result; };
  const deviceState = device => {
    if (workerOwned && device !== workerEndpoint) throw new TypeError('Owned Worker scheduler endpoint mismatch');
    if (!device || typeof device.lost?.then !== 'function') throw new TypeError('Exclusive GPU device with loss promise required');
    let state = devices.get(device);
    if (!state) {
      state = {programs: new Map(), allocatedBytes: 0, lost: null}; devices.set(device, state);
      Promise.resolve(device.lost).then(info => { state.lost = new Error(`GPU device lost: ${info?.message ?? 'unknown'}`); if (active?.state === state) active.abort.abort(state.lost.message); }, error => { state.lost = error instanceof Error ? error : new Error(String(error)); if (active?.state === state) active.abort.abort(state.lost.message); });
    }
    if (state.lost) throw state.lost;
    return state;
  };
  const candidatesFor = (request, candidates, count) => {
    if (!Array.isArray(candidates) || ![1,3].includes(candidates.length) || (count !== undefined && candidates.length !== count)) throw new RangeError('Exact N1/N3 candidate width required');
    const checked = candidates.map(c => validateCanonicalCandidate(request, c));
    if (new Set(checked.map(c => c.candidateId)).size !== checked.length) throw new Error('Distinct candidate IDs required');
    return checked;
  };
  const inputsFor = (context, candidates, program) => {
    const batch = prepareRawWorldBatch(context.rawBinding, candidates, {maximumSteps: 2048});
    if (batch.effectiveMaximumSteps !== 2048) throw new Error('Exact effective staged raw2048 shape required');
    const singleBatches = candidates.map(c => prepareRawWorldBatch(context.rawBinding, [c], {maximumSteps: 2048}));
    return prepareWasmGpuInputs({engine: program.engine, rawEngine: program.rawEngine, binding: context.binding, singleBatches, batch});
  };
  async function createEngine(device, options = {}) {
    alive(); checkSignal(options.signal); aborted(options.signal); const ticket = cancellation;
    const {binding, rawBinding, maximumSteps, preparation, strikeBackend, profile, faultPolicy, expectedBuildRevision, validationProfile = null} = options;
    if (preparation !== 'wasm-program' || strikeBackend !== 'staged' || profile !== 'mmq2-cushion' || faultPolicy !== 'atomic-per-access' || maximumSteps !== 2048 || validationProfile !== null) throw new Error('Exact private MMQ2 staged raw2048 wasm-program configuration required');
    if (expectedBuildRevision !== sourceRevision) throw new Error('Backend descriptive source revision mismatch');
    const request = validateCanonicalRequest(options.request), snapshot = snapshotCanonicalWorldContinuation(binding);
    if (request.purpose !== 'search' || snapshot.request.requestKey !== request.requestKey || binding.requestIdentity !== request.requestKey || binding.sceneIdentity !== request.sceneId || binding.epoch !== request.epoch || rawBinding?.requestIdentity !== request.requestKey || rawBinding?.sceneId !== request.sceneId || rawBinding?.epoch !== request.epoch) throw new Error('Exact current search request/raw/world binding identities required');
    if (snapshot.options.mixedMotionRevision !== 'mmq2' || snapshot.options.enableCushionContinuation !== true || snapshot.options.selectedTrace) throw new Error('MMQ2 cushion continuation without trace required');
    const initialCandidates = candidatesFor(request, options.candidates), count = initialCandidates.length;
    const context = {request, binding, rawBinding};
    const selector = Object.freeze({sourceRevision, count, profile, strikeBackend, maximumSteps, bodyCount: rawBinding.bodyCount, maxWorldSteps: snapshot.options.maxWorldSteps});
    const state = deviceState(device);
    const entry = await serial(async () => {
      alive(); current(ticket); aborted(options.signal); if (state.lost) throw state.lost;
      const program = await lookupProgram(selector, {signal: options.signal});
      alive(); current(ticket); aborted(options.signal); if (state.lost) throw state.lost;
      workerOwned && isWasmGpuInputContract(program?.engine,'world') ? assertWasmGpuWorldInputContract(program.engine) : assertLoadedWasmGpuEngineArtifact(program?.engine);
      workerOwned && isWasmGpuInputContract(program?.rawEngine,'raw') ? assertWasmGpuRawInputContract(program.rawEngine) : assertLoadedWasmGpuRawArtifact(program?.rawEngine);
      const {engine, rawEngine} = program;
      const expectedShape = {profile, strikeBackend, bodyCount: selector.bodyCount, maximumSteps, maxWorldSteps: selector.maxWorldSteps};
      if (engine.count !== count || rawEngine.count !== count || engine.sourceRevision !== sourceRevision || rawEngine.sourceRevision !== sourceRevision || rawEngine.maximumSteps !== 2048 || engine.structuralConfig.profile !== profile || engine.structuralConfig.strikeBackend !== strikeBackend || canonicalEngineArtifactJSON(engine.structuralConfig.uploadManifest?.shape) !== canonicalEngineArtifactJSON(expectedShape)) throw new Error('Program library structural/source identity mismatch');
      // Validate current source-owned input packing before compiling/borrowing GPU state.
      inputsFor(context, initialCandidates, program);
      const signature = `${engine.artifactSha256}:${rawEngine.artifactSha256}`;
      let entry = state.programs.get(signature);
      if (!entry) {
        const required = engine.resources.totalOwnedBytes;
        if (state.programs.size >= maximumCachedPrograms || !Number.isSafeInteger(required) || required < 1 || state.allocatedBytes + required > maximumOwnedBytes) throw new RangeError('Persistent WASM program cache exceeds count/aggregate byte budget');
        const began = now();
        const owner = await prepareEngine({...scheduler, device, engine, rawEngine, maximumOwnedBytes, chunkSize, signal: options.signal, onPrepareProgress: options.onPrepareProgress});
        if (owner?.requiresExclusiveDevice !== true || owner?.ownsRaw !== true || typeof owner.run !== 'function' || typeof owner.cancel !== 'function' || typeof owner.dispose !== 'function') { await owner?.dispose?.(); throw new Error('Combined exclusive-device WASM owner required'); }
        entry = {program: {engine, rawEngine}, owner, signature, compileMs: now() - began}; state.programs.set(signature, entry); state.allocatedBytes += required;
      }
      alive(); current(ticket); aborted(options.signal); if (state.lost) throw state.lost;
      return entry;
    });
    let released = false; const view = {};
    return Object.freeze({
      buildRevision: sourceRevision, preparation: 'wasm-program', candidateCount: count, validationProfile: null,
      sourcePlanIdentity: entry.program.engine.lowered.identity, recipeIdentity: entry.signature,
      requiresExclusiveDevice: true, productionEnabled: false, gpuExecutionQualified: false,
      provenance: 'injected-program-library-harness',
      dispose() { released = true; if (active?.view === view) { active.abort.abort('Compact engine view disposed'); active.owner.cancel('Compact engine view disposed'); } },
      async run({candidates = initialCandidates, signal, onPhase} = {}) {
        alive(); if (released) throw new Error('Compact engine view disposed'); checkSignal(signal); aborted(signal);
        if (onPhase !== undefined && typeof onPhase !== 'function') throw new TypeError('Synchronous phase callback required');
        const checked = candidatesFor(request, candidates, count), ticket = cancellation;
        return serial(async () => {
          alive(); current(ticket); if (released) throw new Error('Compact engine view disposed'); if (entry.error) throw entry.error; aborted(signal); if (state.lost) throw state.lost;
          const abort = new AbortController(), onAbort = () => abort.abort(signal.reason), token = {state, abort, owner: entry.owner, view};
          active = token;
          try {
            signal?.addEventListener('abort', onAbort, {once: true}); if (signal?.aborted) onAbort(); aborted(abort.signal);
            const inputs = inputsFor(context, checked, entry.program);
            const began = now();
            const report = detail => {
              alive(); current(ticket); aborted(abort.signal);
              callback(onPhase, {preparation: 'wasm-program', candidateCount: count,
                plannedTotalOwnedBytes: entry.program.engine.resources.totalOwnedBytes,
                cachedDeviceOwnedBytes: state.allocatedBytes, ...detail});
              alive(); current(ticket); aborted(abort.signal);
            };
            report({phase: 'queued', executionStage: 'coordinator-admission', submittedCommands: 0,
              chunkIndex: 0, chunkCount: null, totalCommands: null, runElapsedMs: 0});
            const result = await entry.owner.run({...inputs, signal: abort.signal,
              onExecutionPhase: detail => report({phase: detail.executionStage === 'upload' ? 'uploading' : detail.executionStage === 'finish-fence-and-readback' ? 'readback' : 'encoding', ...detail}),
              onProgress: detail => report({phase: 'submitted', ...detail})});
            if (state.lost) throw state.lost; alive(); current(ticket); aborted(abort.signal);
            const compact = result.result;
            if (!(compact instanceof Uint32Array) || compact.length !== count * 4 || checked.some((c, i) => compact[i * 4] !== c.candidateId)) { entry.error = new Error('Exact current candidate compact16-byte rows required'); await entry.owner.dispose(); throw entry.error; }
            callback(onPhase, {phase: 'complete', preparation: 'wasm-program', candidateCount: count}); aborted(abort.signal); alive();
            return Object.freeze({buildRevision: sourceRevision, preparation: 'wasm-program', validationProfile: null,
              requestIdentity: binding.requestIdentity, sceneIdentity: binding.sceneIdentity, epoch: request.epoch,
              candidateKeys: Object.freeze(checked.map(c => c.candidateKey)), compact: compact.slice(), sourcePlanIdentity: entry.program.engine.lowered.identity,
              recipeIdentity: entry.signature, coverage: 'experimental-current-source-mmq2-N1-N3-wasm-program-harness',
              gpuExecutionQualified: false, productionEnabled: false, provenance: 'injected-program-library-harness',
              metrics: Object.freeze({readbackBytes: count * 16, compileMs: entry.compileMs, ownerRunMs: now() - began, plannedTotalOwnedBytes: entry.program.engine.resources.totalOwnedBytes, maximumOwnedBytes, cachedDeviceOwnedBytes: state.allocatedBytes, hardwareVerified: false}),
              cumulativeWorkBudgetEnforced: false, cumulativeEventBudgetEnforced: false});
          } finally { try { signal?.removeEventListener('abort', onAbort); } finally { if (active === token) active = null; } }
        });
      },
    });
  }
  function cancel(reason = 'WASM compact backend cancelled') { cancellation++; active?.abort.abort(reason); active?.owner.cancel(reason); }
  function releaseOwners(){
    alive();cancel('Compact mode retired');
    return serial(async()=>{const errors=[];for(const state of devices.values()){for(const entry of state.programs.values()){entry.error=Object.assign(new Error('Compact mode retired'),{name:'AbortError'});try{await entry.owner.dispose();}catch(error){errors.push(error);}}state.programs.clear();state.allocatedBytes=0;}if(errors.length)throw new AggregateError(errors,'Compact mode retirement failed');});
  }
  function dispose() {
    if (disposal) return disposal; disposed = true; cancel('WASM compact backend disposed');
    disposal = serial(async () => { const errors = []; for (const state of devices.values()) for (const entry of state.programs.values()) { try { await entry.owner.dispose(); } catch (error) { errors.push(error); } } devices.clear(); if (errors.length) throw new AggregateError(errors, 'WASM compact backend disposal failed'); });
    return disposal;
  }
  return Object.freeze({sourceRevision, implementation: 'wasm-program-compact-search-harness-v1', preparation: 'wasm-program', requiresExclusiveDevice: true,
    experimental: true, productionEnabled: false, gpuExecutionQualified: false, provenance: 'injected-program-library-harness', createEngine, cancel, releaseOwners, dispose});
}
