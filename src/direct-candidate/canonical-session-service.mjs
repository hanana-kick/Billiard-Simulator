/** Experimental selected-shot orchestration only. No application/default switch,
 * search batching, checkpoint restore, Rapier fallback, or CPU physics replay. */
import {createCanonicalEpochGate, createCanonicalRequest, createCanonicalCandidate,
  CanonicalContractError} from './canonical-engine-contract.mjs';
import {prepareRawWorldBinding, prepareRawWorldBatch} from './deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation, createCanonicalWorldContinuationGPU} from './canonical-world-continuation.mjs';
import {hydrateCanonicalSelectedGPUTrace} from './canonical-selected-world-trace-hydrate.mjs';
import {hydrateCanonicalSelectedV2GPUTrace} from './canonical-selected-world-trace-v2-hydrate.mjs';
import {sampleSelectedShotTrace} from './canonical-selected-trace.mjs';

import {assertWasmGpuProductionRuntime} from '../wasm-gpu/production-runtime.mjs';
export const CANONICAL_SESSION_CAPABILITIES = Object.freeze({
  experimental: true, productionEnabled: false, selectedCandidateCount: 1,
  searchBatchImplemented: false, motionRevision: 'mmq1', cushionTraceImplemented: false,
  checkpointImplemented: false, physicalHardwareVerified: false,
  cumulativeWorkBudgetEnforced: false, cumulativeEventBudgetEnforced: false,
  arbitraryInteriorPointSamplingGuaranteed: false,
});
const own = value => structuredClone(value);
const freeze = value => { if(value && typeof value==='object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const error = (code, message) => new CanonicalContractError(code, message);
export const CANONICAL_SELECTED_WORLD_PROFILES = Object.freeze({
  'mmq1-ball-ball': Object.freeze({motionRevision: 'mmq1', cushionTraceImplemented: false}),
  'mmq2-cushion': Object.freeze({motionRevision: 'mmq2', cushionTraceImplemented: true}),
});
function core(device, runtime, implementation, selectedWorldProfile = 'mmq1-ball-ball') {
  if (!Object.hasOwn(CANONICAL_SELECTED_WORLD_PROFILES, selectedWorldProfile))
    throw error('UNSUPPORTED_SESSION_PROFILE', 'Explicit supported selected-world profile required');
  const profile = CANONICAL_SELECTED_WORLD_PROFILES[selectedWorldProfile];
  const mmq2 = selectedWorldProfile === 'mmq2-cushion';
  const gate = createCanonicalEpochGate();
  let disposed = false, submissionTail = Promise.resolve();
  const assertOpen = () => { if (disposed) throw error('SESSION_DISPOSED', 'Create a new session owner'); };
  return Object.freeze({
    selectedWorldProfile,
    capabilities: Object.freeze({...CANONICAL_SESSION_CAPABILITIES, ...profile, selectedWorldProfile, implementation}),
    cancel(reason = 'cancelled') { gate.cancel(reason); },
    dispose() { disposed = true; gate.cancel('disposed'); return submissionTail; },
    async runSelected({request: requestOptions, candidateId, settings, raw, continuation,
      maximumRecords = 128, strikeBackend = 'staged', signal} = {}) {
      assertOpen();
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      // A new attempted scene/rule request invalidates the previous result even
      // when the new profile is unsupported and never reaches the GPU.
      const epoch = gate.begin();
      // Input snapshots precede the first await. Caller mutation never changes
      // the submitted physical scene, rule configuration, or source settings.
      const input = own({requestOptions, candidateId, settings, raw, continuation, maximumRecords, strikeBackend});
      if (!Number.isInteger(maximumRecords) || maximumRecords < 1 || maximumRecords > 512)
        throw RangeError('Selected source record cap must be 1..512');
      if ((input.continuation?.mixedMotionRevision ?? profile.motionRevision) !== profile.motionRevision ||
          (input.continuation?.enableCushionContinuation ?? mmq2) !== mmq2 ||
          Object.hasOwn(input.requestOptions ?? {}, 'selectedWorldProfile'))
        throw error('UNSUPPORTED_SESSION_PROFILE', 'Selected-world profile is frozen at session creation');
      if (input.requestOptions?.rules?.allowKiss !== true || input.requestOptions?.rules?.conditionOnly !== false)
        throw error('UNSUPPORTED_SESSION_RULES', 'Selected session v1 requires allow-kiss and full physical continuation');
      if (Object.hasOwn(input.requestOptions ?? {}, 'epoch'))
        throw error('SESSION_OWNS_EPOCH', 'The session owner assigns epochs; omit request.epoch');
      const request = createCanonicalRequest({...input.requestOptions, epoch: epoch.epoch});
      gate.bind(request);
      const candidate = createCanonicalCandidate(request, input.candidateId, input.settings);
      const gateIdentity = gate.register(candidate);
      // Preserve the existing MMQ1 contract; opt-in receipts cannot be mistaken
      // for MMQ1 by consumers comparing the complete result identity.
      const identity = mmq2 ? Object.freeze({...gateIdentity, selectedWorldProfile}) : gateIdentity;
      const current = () => { assertOpen(); if (signal?.aborted) throw error('CANCELLED', 'Discard externally cancelled output'); gate.assertCurrent(gateIdentity); };
      const cancel = () => { if (gate.validate(gateIdentity).ok) gate.cancel(signal.reason ?? 'cancelled'); };
      signal?.addEventListener('abort', cancel, {once: true});
      let releaseTurn,engine,resultReady=false;
      try {
        if (signal?.aborted) cancel();
        current();
        if (!candidate.admitted) return Object.freeze({kind: 'canonical-session-unsupported-v1', identity, selectedWorldProfile,
          reasons: candidate.reasons, physicsResultComplete: false, captureComplete: false,
          samplingComplete: false, assertCurrent: current});
        const rawBinding = prepareRawWorldBinding(request, input.raw);
        const batch = prepareRawWorldBatch(rawBinding, [candidate], {maximumSteps: input.raw?.maximumSteps});
        const binding = prepareCanonicalWorldContinuation(request, rawBinding.shotClock, {
          ...input.continuation, mixedMotionRevision: profile.motionRevision, enableCushionContinuation: mmq2, sceneKey: rawBinding.sceneKey, requestKey: rawBinding.requestKey,
        });
        // A superseded compile cannot necessarily be interrupted by WebGPU.
        // Keep this owner's compiler/arena lifetimes serial, rather than let a
        // rapid aim change allocate two full selected-shot pipelines at once.
        const predecessor = submissionTail;
        submissionTail = new Promise(resolve => { releaseTurn = resolve; });
        await predecessor;
        current();
        engine = await runtime.createEngine(device, binding, {request,candidate,strikeBackend: input.strikeBackend});
        current();
        const run = await engine.runRaw(batch, {signal: epoch.signal, selectedTrace: true, selectedTraceMaxRecords: input.maximumRecords});
        current();
        const status = run?.rawHandoffStatus;
        if (!(status instanceof Uint32Array) || status.length !== 16 || status[0] !== candidate.candidateId ||
            status[8] !== rawBinding.sceneKey || status[9] !== rawBinding.requestKey)
          throw error('BACKEND_IDENTITY_MISMATCH', 'Raw handoff must belong to this exact candidate and binding');
        if (!run.continuation) {
          if (status[1] === 1) throw error('MISSING_CONTINUATION', 'Ready raw handoff cannot silently lose continuation');
          const packet = status.slice();
          return Object.freeze({kind: 'canonical-session-raw-incomplete-v1', identity, selectedWorldProfile,
            physicsResultComplete: false, captureComplete: false, samplingComplete: false,
            readRawStatus() { current(); return packet.slice(); }, assertCurrent: current});
        }
        const result = run.continuation, state = result.state;
        if (status[1] !== 1 || !(state instanceof Uint32Array) || state.length < 256 ||
            state[0] !== candidate.candidateId || state[3] !== request.slotToId.length ||
            state[41] !== rawBinding.sceneKey || state[42] !== rawBinding.requestKey ||
            request.slotToId.some((id, i) => state[64 + 48 * i] !== id) ||
            state[5] < rawBinding.absoluteTick || state[5] > rawBinding.shotClock.deadlineTick ||
            result.nominalRest !== (state[1] === 9))
          throw error('BACKEND_IDENTITY_MISMATCH', 'Full source roster, clock, candidate and rest status must match');
        if (!(result.compactResult instanceof Uint32Array) || result.compactResult.length !== 4 || result.compactResult[0] !== candidate.candidateId)
          throw error('BACKEND_IDENTITY_MISMATCH', 'Selected compact packet identity mismatch');
        const trace = await runtime.hydrate({request, candidate, batch, gpuCapture: result.selectedTraceGPU,
          result, maximumRecords: input.maximumRecords});
        current();
        if (mmq2 && (trace.entryKind !== 'canonical-raw-shot' || trace.preparedBinding !== null ||
            trace.callerLabelIdentityVerified !== true ||
            trace.backend !== 'webgpu' || trace.gpuProduced !== true))
          throw error('TRACE_PROVENANCE_MISMATCH', 'Public raw session requires original GPU raw-shot provenance, never host-prepared hydration');
        if (trace.physicsResultComplete !== result.nominalRest)
          throw error('TRACE_RESULT_MISMATCH', 'Trace capture must not change the physical completion result');
        const compact = result.compactResult.slice(), finalState = state.slice();
        const submission = freeze({request, candidate, raw:own(input.raw)});
        resultReady=true;return Object.freeze({kind: 'canonical-session-selected-result-v1', identity, selectedWorldProfile,
          implementation, physicsResultComplete: trace.physicsResultComplete,
          captureComplete: trace.captureComplete, samplingComplete: trace.samplingComplete,
          timeBudgetEnforced: result.timeBudgetEnforced === true,
          cumulativeWorkBudgetEnforced: false, cumulativeEventBudgetEnforced: false,
          sourceRecordCount: trace.sourceRecordCount, physicalHardwareVerified: false,
          readSubmission() { current(); return submission; },
          readCompact() { current(); return compact.slice(); },
          readFinalState() { current(); return finalState.slice(); },
          sample(tick, options) { current(); const sample = runtime.sample(trace.trace, tick, options); current(); return own(sample); },
          assertCurrent: current,
        });
      } catch (failure) { current(); throw failure; }
      finally { try { await engine?.dispose?.(); if(resultReady)current(); } finally { releaseTurn?.(); signal?.removeEventListener('abort', cancel); } }
    },
  });
}
/** Production-shaped adapter, still opt-in/experimental. It invokes real GPU
 * execution and hydrates original source records, never reruns CPU dynamics. */
export function createCanonicalSessionService({device, selectedWorldProfile = 'mmq1-ball-ball'} = {}) {
  if (!device?.queue || typeof device.createComputePipelineAsync !== 'function') throw TypeError('WebGPU device required');
  return core(device, {createEngine: createCanonicalWorldContinuationGPU,
    hydrate: selectedWorldProfile === 'mmq2-cushion' ? hydrateCanonicalSelectedV2GPUTrace : hydrateCanonicalSelectedGPUTrace,
    sample: sampleSelectedShotTrace}, selectedWorldProfile === 'mmq2-cushion' ? 'webgpu-selected-v2' : 'webgpu-selected-v1', selectedWorldProfile);
}
/** Lifecycle test seam. Every result is labelled injected-test, not WebGPU
 * qualification. This entry point is not imported by the application. */
export function createCanonicalSessionLifecycleHarness(runtime, {selectedWorldProfile} = {}) {
  if (!runtime || ['createEngine', 'hydrate', 'sample'].some(k => typeof runtime[k] !== 'function')) throw TypeError('Complete lifecycle test runtime');
  return core(null, runtime, 'injected-test', selectedWorldProfile);
}

/** Full native readbacks through an owned, sealed WASM GPU runtime. */
export function createCanonicalWasmSessionService({device,productionRuntime,selectedWorldProfile='mmq2-cushion'}={}){
 const runtime=assertWasmGpuProductionRuntime(productionRuntime,device);
 if(selectedWorldProfile!=='mmq2-cushion')throw error('UNSUPPORTED_SESSION_PROFILE','WASM public mode is MMQ2 only');
 return core(device,{createEngine:runtime.createSelectedEngine,hydrate:hydrateCanonicalSelectedV2GPUTrace,sample:sampleSelectedShotTrace},'webgpu-wasm-selected-v2',selectedWorldProfile);
}
