// SPDX-License-Identifier: Apache-2.0
// Full independent sequential replay. Expected native frames are assertions,
// never candidate inputs. Run sources/backends in separate serial processes:
// SEQ_SOURCE=placed SEQ_BACKEND=cpu node --max-old-space-size=192 tests/live-registered-multishot-sequential-full.mjs
// REQUIRE_WEBGPU=1 SEQ_SOURCE=awake SEQ_BACKEND=gpu node --max-old-space-size=192 tests/live-registered-multishot-sequential-full.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {prepareValidation, importInitial, noNative, PINNED, loadEvidence, compareFrame, compareCheckpoint, compactDeepEqual} from './live-registered-performance-support.mjs';
const require = createRequire(import.meta.url), HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.SEQ_RUNTIME_ROOT ?? path.join(HERE, '..'));
const EVIDENCE = path.resolve(process.env.LIVE_REGISTERED_EVIDENCE_DIR ?? path.join(ROOT, '../billiard-live-registered-evidence'));
const OUTPUT = path.resolve(process.env.SEQ_OUTPUT_DIR ?? path.join(ROOT, 'artifacts/resumed-multishot-sequential'));
const BATCH = path.resolve(process.env.SEQ_BATCH_DIR ?? path.join(ROOT, 'artifacts/resumed-multishot'));
const SOURCE = process.env.SEQ_SOURCE ?? 'placed', BACKEND = process.env.SEQ_BACKEND ?? 'cpu';
assert.ok(Object.hasOwn(PINNED, SOURCE)); assert.ok(['cpu', 'gpu'].includes(BACKEND));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex'), copy = value => structuredClone(value);
const emit = value => console.log(JSON.stringify(value));
const sourceFiles = [...fs.readdirSync(path.join(ROOT, 'src')).filter(name => name.startsWith('experimental-') && /\.(?:m?js)$/.test(name)).map(name => 'src/' + name),
  ...fs.readdirSync(path.join(ROOT, 'src/browser-initial-import')).filter(name => name.endsWith('.mjs')).map(name => 'src/browser-initial-import/' + name), 'src/game-rules.js', 'src/bounded-gpu-shot/resources.mjs'];
const sourceProof = Object.fromEntries(sourceFiles.sort().map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
const harnessProof = Object.fromEntries(['live-registered-multishot-sequential-full.mjs', 'live-registered-performance-support.mjs', 'webgpu-observation.cjs', 'native-gpu-test-owner.cjs'].map(file => [file, hash(fs.readFileSync(path.join(HERE, file)))]));
function normalizeBackendLabels(state, backend) {
  const out = copy(state);
  const field = (object, key, values = ['cpu-reference', 'webgpu']) => {if (object && Object.hasOwn(object, key)) {assert.equal(object[key], values[backend === 'cpu' ? 0 : 1]); object[key] = '<backend>';}};
  // Exact producer diagnostics only: experimental-cue-empty-pair-cache.js decode()
  // sets backend plus actualDispatches=(webgpu?1:0). In
  // experimental-cue-empty-convex-cache.js complete()/createGpuStage(), CPU is0,
  // GPU recycled is1, and fresh GJK is GJK_DISPATCHES256+3=259. No physical
  // cache field, generic dispatch field, or numerical value is ignored.
  for (const [name, convex] of [['emptyCuePairs', false], ['emptyCueConvexPairs', true]]) for (const pair of out[name] ?? []) {
    field(pair.cache, 'backend');
    if (Object.hasOwn(pair.cache, 'actualDispatches')) {
      const wanted = backend === 'cpu' ? 0 : convex && !pair.cache.recycled ? 259 : 1;
      assert.equal(pair.cache.actualDispatches, wanted, 'Exact backend-only empty-cache dispatch diagnostic'); pair.cache.actualDispatches = '<backend-dispatches>';
    }
  }
  field(out.solverContactRoster, 'backend'); field(out.lastStep?.activationEffects, 'energyBackend');
  field(out.lastStep?.cue, 'backend'); field(out.lastStep?.cue?.jointResult, 'backend'); field(out.lastStep?.cue?.rigidExclusion, 'backend');
  field(out.lastStep?.cue?.tip, 'backend', ['cpu-double-single-approximation', 'webgpu-double-single-approximation']);
  for (const cue of out.lastStep?.cue?.ccd ?? []) field(cue, 'backend');
  for (const pass of out.lastStep?.ccd?.sourceInternalPasses ?? []) for (const check of pass.preChecks ?? []) field(check.activation, 'backend');
  return out;
}
function numericalDifferenceReport(actual, expected) {
  const numeric = [], other = [];
  const walk = (a, b, at = '$') => {
    if (isDeepStrictEqual(a, b)) return;
    if (typeof a === 'number' && typeof b === 'number') {assert.ok(Number.isFinite(a) && Number.isFinite(b)); numeric.push({path: at, actual: a, expected: b, absolute: Math.abs(a - b)}); return;}
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {other.push({path: at, actual: a, expected: b}); return;}
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], at + (Array.isArray(a) ? '[' + key + ']' : '.' + key));
  };
  walk(actual, expected); assert.deepEqual(other, [], 'After enumerated backend diagnostics, all nonnumeric state is exact');
  // This is a complete numeric difference report, not an extra acceptance
  // tolerance. Independent original-frame/checkpoint gates above remain the
  // unchanged CPU/GPU numerical acceptance criterion. No physical field is
  // removed, rounded, or relabeled to manufacture a bitwise CPU/GPU match.
  return {exactEntirePublicState: numeric.length === 0, maximumNumericAbsolute: Math.max(0, ...numeric.map(value => value.absolute)), numericDifferences: numeric};
}

let world, owner, observation, failure = null, h = 0;
const stats = {hCompared: 0, internalPasses: 0, maxAbsolute: 0, maxCueInertiaAbsolute: 0, maxCueInertiaNormalized: 0, checkpoints: []};
const start = performance.now();
fs.mkdirSync(OUTPUT, {recursive: true});
try {
  const provenance = await prepareValidation(ROOT, EVIDENCE), seed = await importInitial(SOURCE);
  const {record} = loadEvidence(SOURCE), checkpointMap = new Map();
  for (const point of record.checkpoints.filter(point => point.hCount > 0 && !point.reasons.includes('cue-withdrawal'))) checkpointMap.set(point.hCount, [...(checkpointMap.get(point.hCount) ?? []), point]);
  noNative();
  const World = require(path.join(ROOT, 'src/experimental-four-ball-world.js'));
  let adapterInfo = null;
  if (BACKEND === 'gpu') {
    assert.equal(process.env.REQUIRE_WEBGPU, '1', 'Actual WebGPU explicitly required; no CPU fallback');
    process.env.VK_ICD_FILENAMES ??= '/usr/lib/chromium/vk_swiftshader_icd.json';
    const {create, globals} = await import(pathToFileURL(process.env.GPU_NATIVE_MODULE ?? '/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js').href);
    Object.assign(globalThis, globals);
    const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter);
    const device = await adapter.requestDevice();
    owner = {device, release: require('./native-gpu-test-owner.cjs').retain(gpu, adapter, device, 'full sequential ' + SOURCE)};
    adapterInfo = Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(key => [key, adapter.info?.[key] ?? null]));
    device.addEventListener?.('uncapturederror', event => {failure ??= String(event.error?.message ?? event.error);});
    observation = require('./webgpu-observation.cjs').observeWebGpu(device);
    world = await World.createGpuStepper(device, seed);
  } else world = await World.createReferenceStepper(seed);
  emit({schema: 'multishot-sequential-full-start-v1', source: SOURCE, backend: BACKEND, expectedH: record.hCount, adapter: adapterInfo, sourceProof, harnessProof});
  let state;
  for (h = 1; h <= 20000; h++) {
    state = await world.step();
    stats.internalPasses += state.lastStep.ccd?.sourceInternalPasses.length ?? 1;
    assert.equal(state.frame, h); assert.equal(state.contactGraph.sequence, stats.internalPasses);
    const frame = record.frames[h - 1]; assert.ok(frame, 'Candidate cannot outlive original rest boundary');
    compareFrame(state, frame, seed, record, stats);
    for (const point of checkpointMap.get(h) ?? []) await compareCheckpoint(state, point, frame, seed, record, stats);
    stats.hCompared++;
    if (h === 1 || h % 256 === 0 || state.shotComplete) emit({schema: 'multishot-sequential-full-progress-v1', source: SOURCE, backend: BACKEND, h, elapsedMs: performance.now() - start, maxAbsolute: stats.maxAbsolute, checkpoints: stats.checkpoints.length, memory: process.memoryUsage()});
    if (state.shotComplete) break;
  }
  assert.equal(state.shotComplete, true, 'Full scope must reach original physical rest'); assert.equal(h, record.hCount);
  assert.equal(state.scene.manager.awake_island, null); assert.ok(state.balls.every(ball => ball.state.sleeping));
  compactDeepEqual(state.game, record.finalGame); compactDeepEqual(state.scoreResult, record.score);
  compactDeepEqual(await world.step(), state, 'Completed sequential world is exactly idempotent'); compactDeepEqual(world.snapshot(), state);
  assert.equal(stats.checkpoints.length, [...checkpointMap.values()].flat().length, 'Every applicable original raw checkpoint compared');
  world.dispose(); world = null;
  if (observation) assert.equal(observation.snapshot().buffers.liveCount, 0, 'All actual native buffers disposed');
  noNative(); if (failure) throw Error('Uncaptured actual WebGPU error: ' + failure);
  for (const [file, digest] of Object.entries(sourceProof)) assert.equal(hash(fs.readFileSync(path.join(ROOT, file))), digest, 'Runtime changed during replay: ' + file);
  for (const [file, digest] of Object.entries(harnessProof)) assert.equal(hash(fs.readFileSync(path.join(HERE, file))), digest, 'Harness changed during replay: ' + file);
  let batchComparison = {status: 'unavailable', reason: 'Full batch proof not available'};
  const batchProofFile = path.join(BATCH, 'full-proof.json');
  if (fs.existsSync(batchProofFile)) {
    const proofBytes = fs.readFileSync(batchProofFile), proof = JSON.parse(proofBytes);
    assert.equal(proof.status, 'all-native-full-rest-matched'); assert.equal(proof.fullShot, true);
    compactDeepEqual(proof.sourceProof, sourceProof, 'Batch and sequential runtime sources are identical');
    const artifact = proof.outputs.find(row => row.source === SOURCE); assert.ok(artifact, 'Batch proof must include requested source');
    const bytes = fs.readFileSync(artifact.path); assert.equal(hash(bytes), artifact.sha256); assert.equal(bytes.length, artifact.bytes);
    const batch = v8.deserialize(bytes); assert.equal(batch.frame, state.frame);
    if (BACKEND === 'gpu') compactDeepEqual(batch, state, 'Entire final batch/sequential native GPU public state');
    const comparison = BACKEND === 'cpu' ? numericalDifferenceReport(normalizeBackendLabels(batch, 'gpu'), normalizeBackendLabels(state, 'cpu')) : {exactEntirePublicState: true};
    batchComparison = {status: 'compared', batchProofSha256: hash(proofBytes), batchStateSha256: artifact.sha256, normalizedBackendDiagnosticsOnly: BACKEND === 'cpu', ...comparison};
  }
  const bytes = v8.serialize(state), outputFile = path.join(OUTPUT, SOURCE + '-' + BACKEND + '-full.state.v8'); fs.writeFileSync(outputFile, bytes);
  const result = {schema: 'multishot-sequential-full-proof-v1', status: 'all-original-h-through-rest-matched', source: SOURCE, backend: BACKEND, h, fullShot: true, stats, adapter: adapterInfo,
    provenance, initialSnapshotSha256: seed.initialSnapshotSha256, captureSha256: PINNED[SOURCE].capture, originalReferenceSha256: PINNED[SOURCE].reference,
    sourceProof, harnessProof, batchComparison, native: observation?.snapshot() ?? null, output: {path: outputFile, sha256: hash(bytes), bytes: bytes.length}, elapsedMs: performance.now() - start,
    semantics: {hardwareAccelerationClaim: false, originalFramesAssertionOnly: true, nativeRuntimeSteps: 0, unchangedOriginalAcceptanceGates: true, numericDifferencesAreReportNotTolerance: true, scoreAndFoulRulesUnchanged: true}};
  const resultFile = path.join(OUTPUT, SOURCE + '-' + BACKEND + '-full-proof.json'); fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n'); emit(result);
} catch (error) {emit({schema: 'multishot-sequential-full-failure-v1', source: SOURCE, backend: BACKEND, h, error: error.message, stack: error.stack}); process.exitCode = 1;}
finally {try {world?.dispose();} finally {observation?.restore(); owner?.release();}}
