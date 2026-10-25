// Replay-only timing, followed by assertion-only independent original validation.
// No original/native controller is loaded. No oracle frame enters the replay loop.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {prepareValidation, importInitial, validateOutput, noNative, PINNED} from './live-registered-performance-support.mjs';
const require = createRequire(import.meta.url), HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.BENCH_RUNTIME_ROOT ?? path.join(HERE, '..'));
const EVIDENCE = path.resolve(process.env.LIVE_REGISTERED_EVIDENCE_DIR ?? path.join(ROOT, '../billiard-live-registered-evidence'));
const SOURCE = process.env.BENCH_SOURCE ?? 'placed', BACKEND = process.env.BENCH_BACKEND ?? 'cpu';
const SCOPE = process.env.BENCH_SCOPE ?? 'prefix', LIMIT = SCOPE === 'full' ? 20000 : Number(process.env.BENCH_MAX_H ?? 128);
assert.ok(Object.hasOwn(PINNED, SOURCE)); assert.ok(['cpu', 'gpu'].includes(BACKEND)); assert.ok(['prefix', 'full'].includes(SCOPE));
assert.ok(Number.isSafeInteger(LIMIT) && LIMIT > 0 && LIMIT <= 20000);
const LABEL = process.env.BENCH_LABEL ?? BACKEND + '-' + SOURCE + '-' + SCOPE;
assert.match(LABEL, /^[a-zA-Z0-9_.-]+$/);
const OUTPUT = path.resolve(process.env.BENCH_OUTPUT_DIR ?? path.join(ROOT, 'artifacts/live-performance'));
fs.mkdirSync(OUTPUT, {recursive: true});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const emit = value => console.log(JSON.stringify(value));
const sourceFiles = [
  ...fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.startsWith('experimental-') && n.endsWith('.js')).map(n => 'src/' + n),
  ...fs.readdirSync(path.join(ROOT, 'src/browser-initial-import')).filter(n => n.endsWith('.mjs')).map(n => 'src/browser-initial-import/' + n),
  'src/game-rules.js', 'tools/rapier-snapshot-decoder/browser.mjs', 'tools/rapier-snapshot-decoder/codec.js',
].sort();
const sources = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
const runtimeRootSha256 = hash(JSON.stringify(sources));
const harnessFiles = ['live-registered-performance.mjs', 'live-registered-performance-support.mjs', 'webgpu-observation.cjs'];
const harnessSources = Object.fromEntries(harnessFiles.map(file => [file, hash(fs.readFileSync(path.join(HERE, file)))]));
const git = args => execFileSync('git', ['-C', ROOT, ...args], {encoding: 'utf8'}).trim();
const proof = {runtimeRoot: ROOT, gitCommit: git(['rev-parse', 'HEAD']), gitStatus: git(['status', '--porcelain']), runtimeRootSha256, sources, harnessRootSha256: hash(JSON.stringify(harnessSources)), harnessSources};
const memory = () => ({...process.memoryUsage(), maxRssKiBProcessLifetime: process.resourceUsage().maxRSS});
function begin() {return {at: performance.now(), cpu: process.cpuUsage(), memory: memory()};}
function end(start) {const cpu = process.cpuUsage(start.cpu); return {wallMs: performance.now() - start.at, processCpuUserMs: cpu.user / 1000, processCpuSystemMs: cpu.system / 1000, memoryBefore: start.memory, memoryAfter: memory()};}
function distribution(values) {if (!values.length) return null; const sorted = Array.from(values).sort((a, b) => a - b); const at = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]; return {count: values.length, totalMs: sorted.reduce((a, b) => a + b, 0), minMs: sorted[0], medianMs: at(.5), p95Ms: at(.95), p99Ms: at(.99), maxMs: sorted.at(-1)};}
let owner = null, observation = null, world = null, failure = null;
const stages = {}, memorySamples = [], stepTimes = new Float64Array(LIMIT), callReturnTimes = new Float64Array(LIMIT);
let h = 0, internalPasses = 0, state, replayBeforeDispose, afterDispose, adapterInfo = null;
const bootstrap = begin();
try {
  const provenance = await prepareValidation(ROOT, EVIDENCE);
  const seed = await importInitial(SOURCE);
  noNative();
  const World = require(path.join(ROOT, 'src/experimental-four-ball-world.js'));
  stages.importAndSourceLoad = end(bootstrap);
  if (BACKEND === 'gpu') {
    assert.equal(process.env.REQUIRE_WEBGPU, '1', 'Actual WebGPU requested explicitly; never substitute CPU');
    const adapterStart = begin(), module = process.env.GPU_NATIVE_MODULE ?? '/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js';
    assert.ok(path.isAbsolute(module)); process.env.VK_ICD_FILENAMES ??= '/usr/lib/chromium/vk_swiftshader_icd.json'; assert.ok(fs.existsSync(process.env.VK_ICD_FILENAMES));
    const {create, globals} = await import(pathToFileURL(module).href); Object.assign(globalThis, globals);
    const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter, 'No actual adapter; no CPU reference fallback');
    const device = await adapter.requestDevice();
    owner = {gpu, adapter, device}; // Keep native root/adapter/device strongly alive.
    adapterInfo = Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(k => [k, adapter.info?.[k] ?? null]));
    device.addEventListener?.('uncapturederror', event => {failure ??= String(event.error?.message ?? event.error);});
    stages.adapterStartup = end(adapterStart);
    observation = require('./webgpu-observation.cjs').observeWebGpu(device);
  }
  emit({schema: 'live-performance-start-v1', label: LABEL, backend: BACKEND, source: SOURCE, scope: SCOPE, limit: LIMIT, adapter: adapterInfo, runtimeRootSha256, harnessRootSha256: proof.harnessRootSha256});
  const construct = begin();
  world = BACKEND === 'gpu' ? await World.createGpuStepper(owner.device, seed) : await World.createReferenceStepper(seed);
  stages.worldConstruction = end(construct); assert.equal(world.capability.liveRegisteredFourBall, true); assert.equal(world.capability.wholeWorld, false);
  const constructorObservation = observation?.snapshot() ?? null;
  observation?.phase('firstStep');
  const replay = begin();
  memorySamples.push({h: 0, ...memory()});
  for (; h < LIMIT; h++) {
    if (h === 1) observation?.phase('steady');
    const start = performance.now(), pending = world.step(); callReturnTimes[h] = performance.now() - start;
    state = await pending; stepTimes[h] = performance.now() - start;
    internalPasses += state.lastStep.ccd?.sourceInternalPasses.length ?? 1;
    assert.equal(state.frame, h + 1, 'Monotonic measured replay h');
    if ((h + 1) % 128 === 0 || h === 0) memorySamples.push({h: h + 1, ...memory()});
    if ((h + 1) % 1024 === 0) emit({schema: 'live-performance-progress-v1', label: LABEL, h: h + 1, wallMs: performance.now() - replay.at, memory: memory()});
    if (state.shotComplete) {h++; break;}
  }
  stages.replay = end(replay); memorySamples.push({h, ...memory()});
  replayBeforeDispose = observation?.snapshot() ?? null;
  if (SCOPE === 'full') assert.ok(state.shotComplete, 'Guard limit reached without physical rest; not a full result');
  else assert.equal(h, LIMIT, 'Prefix cannot silently finish at a different size');
  observation?.phase('postReplayChecks');
  const postReplay = begin();
  if (state.shotComplete) {
    assert.deepEqual(await world.step(), state, 'Finished step exact idempotence');
    assert.deepEqual(await world.step(), state, 'Repeated finished step exact idempotence');
    assert.deepEqual(world.snapshot(), state);
  }
  stages.postReplayChecks = end(postReplay);
  const outputFile = path.join(OUTPUT, LABEL + '.state.v8'), outputBytes = v8.serialize(state);
  fs.writeFileSync(outputFile, outputBytes);
  const outputSha256 = hash(outputBytes);
  observation?.phase('disposal'); const disposal = begin(); world.dispose(); world = null; stages.disposal = end(disposal);
  afterDispose = observation?.snapshot() ?? null;
  // Oracle bytes/frames/checkpoints first become accessible here, after replay
  // timing, state capture, idempotence checks and disposal have all completed.
  const validationStart = begin();
  const validation = await validateOutput(SOURCE, seed, v8.deserialize(fs.readFileSync(outputFile)), internalPasses, SCOPE);
  stages.validationExcluded = end(validationStart);
  noNative(); if (failure) throw Error('Uncaptured actual WebGPU error: ' + failure);
  for (const [file, digest] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(ROOT, file))), digest, 'Runtime changed during benchmark: ' + file);
  for (const [file, digest] of Object.entries(harnessSources)) assert.equal(hash(fs.readFileSync(path.join(HERE, file))), digest, 'Harness changed during benchmark: ' + file);
  const result = {
    schema: 'live-registered-replay-performance-v1', status: 'validated', label: LABEL, backend: BACKEND, source: SOURCE, scope: SCOPE, h, internalPasses, outer: state.outerStep,
    initialSnapshotSha256: seed.initialSnapshotSha256, captureSha256: PINNED[SOURCE].capture, provenance, proof, adapter: adapterInfo, vkIcd: process.env.VK_ICD_FILENAMES ?? null,
    stages, steps: {firstMs: stepTimes[0], all: distribution(stepTimes.subarray(0, h)), steadyH2Onward: distribution(stepTimes.subarray(1, h)), synchronousInvocationUntilPromiseReturn: distribution(callReturnTimes.subarray(0, h))},
    memorySamples, gpu: {atConstructor: constructorObservation, atReplayEnd: replayBeforeDispose, afterWorldDispose: afterDispose},
    output: {path: outputFile, sha256: outputSha256, bytes: outputBytes.length}, validation,
    semantics: {hardwarePerformanceClaim: false, adapterIsSoftware: adapterInfo?.isFallbackAdapter ?? null, cpuTiming: 'process CPU includes native code and software-GPU worker threads, not isolated JavaScript host CPU', timing: 'replay wall includes own.step public snapshot production; excludes oracle load/assertions, extra snapshot, rollback probes, output serialization and disposal', gpuTiming: 'mapAsync promise-wait union/sum is host-observed roundtrip latency, NOT GPU execution timestamp; API synchronous wall and initial step invocation are host-facing elapsed wall, NOT isolated JS CPU', memory: 'RSS/heap sampled h0,h1,every128,end; maxRSS is cumulative process lifetime. No forced GC. Only latest state and bounded two Float64 timing arrays retained by harness. Runtime may retain its own history.', gpuMemory: 'GPUBuffer requested logical sizes, not true physical device allocation; destroy is explicit API destruction, driver reclamation may be deferred', candidateInput: 'Pinned initial raw capture only; zero oracle frames or native runtime steps supplied during replay', assertions: 'Independent original final measured frame and any same-h full raw checkpoints; full scope requires final controller raw checkpoint, game, score, caches, managers, BVH and solver roster. Full every-h/rollback suite remains separate.'},
  };
  const resultFile = path.join(OUTPUT, LABEL + '.json'); fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  emit({schema: result.schema, status: result.status, label: LABEL, backend: BACKEND, source: SOURCE, scope: SCOPE, h, validation, stages, steps: result.steps, gpu: result.gpu, output: result.output, resultFile, runtimeRootSha256, harnessRootSha256: proof.harnessRootSha256});
} catch (error) {emit({schema: 'live-performance-failure-v1', label: LABEL, h, error: error.message, stack: error.stack}); process.exitCode = 1;}
finally {try {world?.dispose();} finally {observation?.restore(); owner?.device.destroy(); owner = null;}}
