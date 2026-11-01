// SPDX-License-Identifier: Apache-2.0
// Explicit experimental GPU-only API. Never selects a product backend.
import {importInitialFourBall} from '../browser-initial-import/four-ball.mjs';
import * as importedWorld from '../experimental-four-ball-world.js';
import {createExclusiveShotRunner, freezeOwned} from './lifecycle.mjs';
import {createGpuResourceScope} from './resources.mjs';
import {copyCurrentSourceWorkerInput} from './four-ball-worker-protocol.mjs';
const World = importedWorld.default ?? globalThis.LabFourBallWorldExperimental;
const createGpuStepper = World.createGpuStepper.bind(World);
const deviceLeases = new WeakMap();
const defaultYield = () => new Promise(resolve => setTimeout(resolve, 0));

function normalizedFailure(error) {
  const failure = error instanceof RangeError ? new RangeError(error.message) :
    new Error(String(error?.message ?? error));
  failure.interruption = error?.interruption;
  return failure;
}
function releaseOwned(world, scope) {
  let failure;
  try { world?.dispose(); } catch (error) { failure = normalizedFailure(error); }
  try { scope.dispose(); } catch (error) {
    if (failure) failure.cleanupError = normalizedFailure(error);
    else failure = normalizedFailure(error);
  }
  if (failure) throw failure;
}

export const BOUNDED_FOUR_BALL_CAPABILITY = Object.freeze({
  kind: 'experimental-bounded-live-initial-four-ball-gpu-service',
  backend: 'webgpu', initialSnapshotOnly: true, cpuFallback: false,
  wholeWorld: false, arbitraryShots: false, initialDomain: 'original-constructor72-default-first-strike',
  completion: 'existing-world-physical-rest-and-scoring', resumableBudget: true
});

export const CURRENT_SOURCE_FOUR_BALL_CAPABILITY = Object.freeze({
  kind: 'experimental-bounded-current-source-four-ball-gpu-service',
  backend: 'webgpu', cpuFallback: false, wholeWorld: false, arbitraryShots: false,
  sourceBoundaries: Object.freeze(['strikeCreated', 'goalStrikeCreated', 'secondStrikeCreated', 'liveRegisteredStrikeCreated']),
  completion: 'existing-world-physical-rest-and-scoring', resumableBudget: true,
  certification: 'source-admission-is-not-shot-parity-certification'
});

export function createBoundedFourBallShotService(options) { return createService(options, false); }
export function createCurrentSourceFourBallShotService(options) { return createService(options, true); }
function createService(options, currentSource) {
  if (!options || Object.keys(options).some(k => !['device', 'decoder', 'scheduling'].includes(k)))
    throw new TypeError('Service accepts device, decoder and optional scheduling only');
  const {device, decoder, scheduling = {}} = options;
  if (typeof globalThis.GPUDevice !== 'function' || !(device instanceof globalThis.GPUDevice))
    throw new TypeError('An actual same-realm WebGPU GPUDevice is required; no CPU fallback');
  if (deviceLeases.has(device)) throw new Error('GPUDevice already belongs to an active bounded shot service');
  if (typeof decoder?.decodeSnapshot !== 'function') throw new TypeError('Initialized read-only snapshot decoder required');
  if (!scheduling || Object.keys(scheduling).some(k => !['yieldControl', 'renderingBusy'].includes(k)))
    throw new TypeError('Scheduling accepts yieldControl and renderingBusy only');
  const config = Object.freeze({yieldControl: scheduling.yieldControl ?? defaultYield,
    renderingBusy: scheduling.renderingBusy ?? (() => false)});
  if (typeof config.yieldControl !== 'function' || typeof config.renderingBusy !== 'function')
    throw new TypeError('Scheduling hooks must be functions');
  // Capture the decoder method now; later caller method replacement cannot
  // switch this operation to a different decoder. The decoder is not owned.
  const decodeSnapshot = decoder.decodeSnapshot.bind(decoder);
  const fixedDecoder = Object.freeze({decodeSnapshot});
  const runner = createExclusiveShotRunner({
    deviceLost: device.lost, now: () => performance.now(),
    ...config,
    async initialize(input, check) {
      check();
      let seed;
      if (!currentSource || input?.capture?.boundary === 'strikeCreated') {
        seed = await importInitialFourBall(fixedDecoder, input);
      } else if (input?.capture?.boundary === 'liveRegisteredStrikeCreated') {
        const {importLiveRegisteredFourBall} = await import('../browser-initial-import/live-registered-four-ball.mjs');
        check(); seed = await importLiveRegisteredFourBall(fixedDecoder, input);
      } else if (['goalStrikeCreated', 'secondStrikeCreated'].includes(input?.capture?.boundary)) {
        // Fixed application module only. No caller-projected seed or importer.
        const {importConfiguredFourBall} = await import('../browser-initial-import/configured-four-ball.mjs');
        check(); seed = await importConfiguredFourBall(fixedDecoder, input);
      } else throw new RangeError('Unsupported current-source four-ball capture boundary');
      const sourceEvidence = currentSource ? Object.freeze({validated: true,
        boundary: input.capture.boundary, domain: seed.kind,
        snapshotSha256: seed.initialSnapshotSha256,
        sourceRevision: seed.cueInitial.sourceCreation.created.sourceRevision}) : null;
      check();
      // Preserve private hull identity. Neither seed nor hulls leave this scope.
      freezeOwned(seed);
      const scope = createGpuResourceScope(device); let world;
      try {
        check(); world = await createGpuStepper(scope.device, seed); check();
        return {world, sourceEvidence, resourceStats: scope.snapshot, release: () => releaseOwned(world, scope)};
      } catch (error) {
        // A decoder/device/hook may reject with null or a frozen Error. Never
        // mutate the thrown value or let cleanup erase the cancellation cause.
        const failure = normalizedFailure(error);
        if (world) {
          try { failure.lastCommittedState = world.snapshot(); } catch {}
        }
        try { releaseOwned(world, scope); } catch (cleanupError) { failure.cleanupError = cleanupError; }
        failure.resourceCounts = scope.snapshot();
        throw failure;
      }
    }
  });
  const lease = Object.freeze({}); deviceLeases.set(device, lease);
  return Object.freeze({...runner, ...(currentSource ? {start(input, options) {
      return runner.start(copyCurrentSourceWorkerInput(input), options);
    }} : {}), capability: currentSource ? CURRENT_SOURCE_FOUR_BALL_CAPABILITY : BOUNDED_FOUR_BALL_CAPABILITY,
    async dispose() {
      await runner.dispose();
      if (deviceLeases.get(device) === lease) deviceLeases.delete(device);
    }});
}
