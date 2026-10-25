// Compare measurements only when source, replay extent and harness are identical.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import {isDeepStrictEqual} from 'node:util';
const [baselineFile, candidateFile, ...flags] = process.argv.slice(2);
assert.ok(baselineFile && candidateFile, 'Usage: node tests/compare-live-performance.mjs baseline.json candidate.json [--require-allocation-reduction]');
assert.ok(flags.every(x => ['--require-allocation-reduction', '--cross-backend'].includes(x)), 'Known comparison flags');
const crossBackend = flags.includes('--cross-backend');
const load = file => JSON.parse(fs.readFileSync(file, 'utf8')), a = load(baselineFile), b = load(candidateFile);
for (const r of [a, b]) {assert.equal(r.schema, 'live-registered-replay-performance-v1'); assert.equal(r.status, 'validated');}
if (crossBackend) assert.deepEqual(new Set([a.backend, b.backend]), new Set(['cpu', 'gpu']), 'Explicit CPU/WebGPU comparison'); else assert.equal(b.backend, a.backend);
for (const key of ['source', 'scope', 'h', 'internalPasses', 'outer', 'initialSnapshotSha256', 'captureSha256']) assert.equal(b[key], a[key], 'Comparable ' + key);
assert.equal(b.proof.harnessRootSha256, a.proof.harnessRootSha256, 'Same measured harness');
if (!crossBackend) {assert.deepEqual(b.adapter, a.adapter, 'Same adapter identity'); assert.equal(b.vkIcd, a.vkIcd);}
assert.equal(b.validation.referenceSha256, a.validation.referenceSha256); assert.deepEqual(b.validation.tolerances, a.validation.tolerances);
const state = (r, resultFile) => {const sibling = path.join(path.dirname(resultFile), path.basename(r.output.path)), bytes = fs.readFileSync(fs.existsSync(sibling) ? sibling : r.output.path); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), r.output.sha256); return v8.deserialize(bytes);};
const aa = state(a, baselineFile), bb = state(b, candidateFile), withoutBackend = ({backend, ...rest}) => rest;
for (const field of ['scene', 'globalEdges', 'game', 'scoreResult', 'contactEvents', 'ownedBvh', 'balls', 'cueCloth', 'emptyCuePairs', 'emptyCueConvexPairs']) assert.deepEqual(bb[field], aa[field], 'Exact baseline/candidate final ' + field);
assert.deepEqual(withoutBackend(bb.solverContactRoster), withoutBackend(aa.solverContactRoster));
function normalizeBackendLabels(state, backend) {
  const out = structuredClone(state);
  const field = (object, key, values = ['cpu-reference', 'webgpu']) => {if (object && Object.hasOwn(object, key)) {assert.equal(object[key], values[backend === 'cpu' ? 0 : 1], 'Exact backend-only diagnostic label'); object[key] = '<backend>';}};
  field(out.solverContactRoster, 'backend'); field(out.lastStep?.activationEffects, 'energyBackend');
  field(out.lastStep?.cue, 'backend'); field(out.lastStep?.cue?.jointResult, 'backend'); field(out.lastStep?.cue?.rigidExclusion, 'backend');
  field(out.lastStep?.cue?.tip, 'backend', ['cpu-double-single-approximation', 'webgpu-double-single-approximation']);
  for (const cue of out.lastStep?.cue?.ccd ?? []) field(cue, 'backend');
  for (const pass of out.lastStep?.ccd?.sourceInternalPasses ?? []) for (const check of pass.preChecks ?? []) field(check.activation, 'backend');
  return out;
}
assert.ok(isDeepStrictEqual(crossBackend ? normalizeBackendLabels(bb, b.backend) : bb, crossBackend ? normalizeBackendLabels(aa, a.backend) : aa), 'Entire final public state differs after only explicit backend diagnostic labels are normalized for cross-backend comparison');
const change = (baseline, candidate) => ({baseline, candidate, difference: candidate - baseline, ratio: baseline ? candidate / baseline : null});
const counters = r => r.gpu.atReplayEnd?.phases.steady ?? null;
const ca = counters(a), cb = counters(b), resourceChanges = ca && cb ? Object.fromEntries(Object.keys(ca).map(k => [k, change(ca[k], cb[k])])) : null;
if (flags.includes('--require-allocation-reduction')) {
  assert.equal(crossBackend, false); assert.equal(a.backend, 'gpu'); assert.ok(cb.buffersCreated < ca.buffersCreated, 'Steady GPU allocation reduction');
  for (const field of ['dispatches', 'readbackCopies', 'readbackCopyBytes', 'mapReadCalls', 'mapReadBytes']) assert.equal(cb[field], ca[field], 'Optimization cannot hide work: ' + field);
  assert.equal(b.gpu.afterWorldDispose.buffers.liveCount, 0, 'Dispose all logical GPUBuffer handles');
}
console.log(JSON.stringify({schema: 'live-registered-performance-comparison-v1', baselineFile, candidateFile, source: a.source, backend: crossBackend ? 'cpu-vs-gpu' : a.backend, scope: a.scope, h: a.h, exactFinalRepresentedState: true, exactEntireFinalPublicState: true, backendLabelsNormalized: crossBackend, baselineRuntimeRootSha256: a.proof.runtimeRootSha256, candidateRuntimeRootSha256: b.proof.runtimeRootSha256, harnessRootSha256: a.proof.harnessRootSha256, timings: {constructionWallMs: change(a.stages.worldConstruction.wallMs, b.stages.worldConstruction.wallMs), replayWallMs: change(a.stages.replay.wallMs, b.stages.replay.wallMs), steadyMedianMs: change(a.steps.steadyH2Onward.medianMs, b.steps.steadyH2Onward.medianMs), processCpuMs: change(a.stages.replay.processCpuUserMs + a.stages.replay.processCpuSystemMs, b.stages.replay.processCpuUserMs + b.stages.replay.processCpuSystemMs)}, memory: {replayEndRss: change(a.stages.replay.memoryAfter.rss, b.stages.replay.memoryAfter.rss), replayEndHeapUsed: change(a.stages.replay.memoryAfter.heapUsed, b.stages.replay.memoryAfter.heapUsed)}, steadyGpuCounters: resourceChanges, caveat: 'One serial process per result, no statistical speedup claim. CPU usage includes native/driver threads. Actual SwiftShader is software, not hardware GPU performance.'}, null, 2));
