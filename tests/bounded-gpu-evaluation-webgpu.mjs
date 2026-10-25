// Opt-in actual native-Dawn service integration. PREFIX ONLY, NOT PARITY.
// Candidate data are original raw source captures; no expected trajectory,
// caller-projected seed, original CPU continuation, or approximate fallback.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createSnapshotDecoder} from '../tools/rapier-snapshot-decoder/browser.mjs';
import {createBoundedFourBallEvaluationService} from '../src/bounded-gpu-shot/evaluation-service.mjs';
import {forbidNativeContinuation} from './bounded-gpu-shot-source.mjs';
import {readRawEvaluationArtifact} from './bounded-gpu-evaluation-artifact.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');

// Test driver only: every actual resume must continue the same privately owned
// source world. The fixed importer decodes on every initializer invocation, so
// an unchanged decode-call count proves it did not initialize that input again.
async function advancePrefix(operation, {targetH, snapshotSha256, expectedDecodeCalls, readDecodeCalls}) {
  let result = await operation.result, resumeCalls = 0;
  const progressSequence = [], source = structuredClone(result.shots[0].source);
  let previousResources = null;
  function observe(expectedH) {
    assert.equal(result.status, 'budget-suspended', JSON.stringify(result));
    assert.equal(result.operationId, operation.id, 'Resume keeps the same request sequence');
    assert.equal(result.progress.currentIndex, 0, 'The first shot remains the sole live owner');
    assert.equal(result.progress.committedH, expectedH, 'Committed h advances once, never restarts or skips');
    assert.equal(result.shots[0].progress.committedH, expectedH);
    assert.equal(result.slice.committedH, 1, 'Every observed slice commits exactly one h');
    assert.equal(result.shots[0].source.validated, true);
    assert.equal(result.shots[0].source.snapshotSha256, snapshotSha256);
    assert.deepEqual(result.shots[0].source, source, 'Resume preserves the full source admission receipt');
    assert.equal(result.shots[1].progress.committedH, 0, 'No second input may initialize');
    assert.equal(readDecodeCalls(), expectedDecodeCalls, 'Resume must not re-decode/reinitialize the source');
    const resources = result.shots[0].resources;
    assert.ok(resources.trackedBuffers > 0, 'The suspended GPU owner remains resident');
    if (previousResources) {
      for (const key of ['buffersCreated', 'buffersDestroyed', 'buffersCollected', 'peakTrackedBuffers'])
        assert.ok(resources[key] >= previousResources[key], 'Owner resource counter must not reset: ' + key);
    }
    progressSequence.push({operationId: result.operationId, committedH: expectedH,
      sliceCommittedH: result.slice.committedH, snapshotSha256: result.shots[0].source.snapshotSha256,
      decoderCalls: readDecodeCalls(), resources: structuredClone(resources)});
    previousResources = structuredClone(resources);
  }
  observe(1);
  for (let nextH = 2; nextH <= targetH; nextH++) {
    resumeCalls++;
    result = await operation.resume({budget: {maxSteps: 1, maxWallMs: 30000}});
    observe(nextH);
  }
  assert.equal(resumeCalls, targetH - 1, 'Targets above one h must traverse operation.resume');
  return {result, resumeCalls, progressSequence};
}
test('real native Dawn evaluator owns source bytes and drains a bounded current-source prefix',
  {skip: process.env.REQUIRE_BOUNDED_EVALUATION_WEBGPU !== '1', timeout: 600000}, async () => {
    assert.ok(process.env.GPU_NATIVE_MODULE, 'Installed official WebGPU module required');
    assert.ok(process.env.GPU_EVALUATION_INPUT, 'Original raw input V8 artifact required');
    assert.ok(process.env.RAPIER_WASM_PROVENANCE, 'Pinned read-only decoder build provenance required');
    assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: ROOT, encoding: 'utf8'}).trim(), '', 'Freeze tracked test source');
    const testedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim();
    const {raw, inputArtifactSha256, snapshotSha256, preStrikeSha256} = readRawEvaluationArtifact(process.env.GPU_EVALUATION_INPUT);
    const provenance = JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE));
    const restore = forbidNativeContinuation(); let device, evaluator, sentinel;
    try {
      const initializedDecoder = await createSnapshotDecoder({engineVersion: '0.21.0', provenance,
        expectedWasmSha256: provenance.wasmSha256,
        engineBytes: new Uint8Array(fs.readFileSync(path.join(ROOT, 'vendor/rapier.cjs'))),
        wasmBytes: new Uint8Array(fs.readFileSync(provenance.wasmPath))});
      let decoderCalls = 0;
      const decoder = Object.freeze({decodeSnapshot(...args) {
        decoderCalls++; return initializedDecoder.decodeSnapshot(...args);
      }});
      const expectedDecodeCalls = raw.preStrikeSnapshot ? 2 : 1;
      const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href); Object.assign(globalThis, globals);
      const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter, 'Actual native Dawn adapter required');
      device = await adapter.requestDevice(); assert.ok(device instanceof GPUDevice);
      const errors = []; device.addEventListener('uncapturederror', event => errors.push(String(event.error?.message)));
      sentinel = device.createBuffer({size: 4, usage: 9}); device.queue.writeBuffer(sentinel, 0, new Uint32Array([0x51afe]));
      evaluator = createBoundedFourBallEvaluationService({device, decoder, scheduling: {yieldControl: () => new Promise(resolve => setImmediate(resolve))}});
      assert.equal((await evaluator.ready).status, 'ready');
      const h = Number(process.env.GPU_EVALUATION_H ?? 1); assert.ok(Number.isSafeInteger(h) && h >= 1 && h <= 64);
      const operation = evaluator.start([{id: 'source-prefix', ...raw}, {id: 'unstarted-independent-input', ...structuredClone(raw)}],
        {budget: {maxSteps: 1, maxWallMs: 30000}});
      // The API owns both entries. Mutating caller bytes cannot alter the
      // source hash admitted after the first await or a later queued input.
      raw.snapshot.fill(0); raw.preStrikeSnapshot?.fill(0);
      const prefix = await advancePrefix(operation, {targetH: h, snapshotSha256,
        expectedDecodeCalls, readDecodeCalls: () => decoderCalls});
      let result = prefix.result;
      assert.equal(result.progress.committedH, h);
      assert.equal(result.shots[0].certification.status, 'not-certified'); assert.equal(result.shots[0].score, null);
      assert.equal(result.shots[1].progress.committedH, 0);
      result = await operation.cancel(); assert.equal(result.status, 'cancelled');
      assert.equal(decoderCalls, expectedDecodeCalls, 'Cancel drains without reinitializing any input');
      assert.equal(result.shots[0].resources.trackedBuffers, 0);
      assert.equal(result.shots[0].resources.buffersCreated, result.shots[0].resources.buffersDestroyed + result.shots[0].resources.buffersCollected);
      await evaluator.dispose(); await sentinel.mapAsync(1);
      assert.equal(new Uint32Array(sentinel.getMappedRange())[0], 0x51afe); sentinel.unmap(); assert.deepEqual(errors, []);
      const report = {status: 'prefix-only-not-parity', backend: 'native-dawn-webgpu', execution: 'serial-bounded-evaluation',
        adapter: {vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description},
        testedCommit, inputArtifactSha256, snapshotSha256, preStrikeSha256,
        sourceBoundary: result.shots[0].source.boundary, committedH: h, sourceValidated: true,
        initialSliceMaxSteps: 1, resumeCalls: prefix.resumeCalls, progressSequence: prefix.progressSequence,
        decoderCalls, expectedDecodeCalls, sourceReinitialized: false,
        cpuFallback: false, nativeContinuation: false, parallelShotBatch: false, fullRest: false,
        borrowedDeviceSurvives: true, resources: result.shots[0].resources, gpuErrors: errors,
        memory: process.memoryUsage(), processMaxRSSKiB: process.resourceUsage().maxRSS};
      console.log(JSON.stringify(report));
      if (process.env.GPU_EVALUATION_EVIDENCE_OUT) fs.writeFileSync(process.env.GPU_EVALUATION_EVIDENCE_OUT, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    } finally {await evaluator?.dispose(); sentinel?.destroy(); device?.destroy(); restore();}
  });

// Lightweight driver regressions. These are explicit orchestration doubles,
// never GPU, physics or parity evidence, and can run while the GPU slot is busy.
function prefixDouble({changeSource = false, restart = false, reinitialize = false} = {}) {
  let h = 1, decodes = 2, resumes = 0;
  const view = () => ({operationId: 7, status: 'budget-suspended',
    progress: {committedH: h, currentIndex: 0}, slice: {committedH: 1}, shots: [
      {progress: {committedH: h}, source: {validated: true, snapshotSha256: changeSource && resumes ? 'changed' : 'source'},
        resources: {buffersCreated: 100 + h, buffersDestroyed: h, buffersCollected: 0, trackedBuffers: 100, peakTrackedBuffers: 101}},
      {progress: {committedH: 0}}
    ]});
  return {readDecodeCalls: () => decodes, operation: {id: 7, result: Promise.resolve(view()), async resume(options) {
    assert.deepEqual(options, {budget: {maxSteps: 1, maxWallMs: 30000}}); resumes++;
    if (!restart) h++; if (reinitialize) decodes += 2; return view();
  }}};
}
test('prefix probe driver double: two or more h require explicit sequential resumes with one source initialization', async () => {
  const double = prefixDouble(), out = await advancePrefix(double.operation,
    {targetH: 3, snapshotSha256: 'source', expectedDecodeCalls: 2, readDecodeCalls: double.readDecodeCalls});
  assert.equal(out.resumeCalls, 2); assert.deepEqual(out.progressSequence.map(x => x.committedH), [1, 2, 3]);
  assert.ok(out.progressSequence.every(x => x.operationId === 7 && x.snapshotSha256 === 'source' && x.decoderCalls === 2));
});
test('prefix probe driver doubles reject source changes, restarted progress and source reinitialization', async () => {
  for (const [options, message] of [[{changeSource: true}, /changed|source/], [{restart: true}, /never restarts/],
    [{reinitialize: true}, /re-decode\/reinitialize/]]) {
    const double = prefixDouble(options);
    await assert.rejects(advancePrefix(double.operation,
      {targetH: 2, snapshotSha256: 'source', expectedDecodeCalls: 2, readDecodeCalls: double.readDecodeCalls}), message);
  }
});
