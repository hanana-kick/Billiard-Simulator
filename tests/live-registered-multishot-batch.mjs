// Actual multi-owner WebGPU world replay. Original trajectories are assertion
// only; only independently imported initial raw captures enter candidate worlds.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import Module, {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {prepareValidation, importInitial, noNative, PINNED, loadEvidence, compareFrame, compareCheckpoint, compactDeepEqual} from './live-registered-performance-support.mjs';
const require = createRequire(import.meta.url), HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.BATCH_RUNTIME_ROOT ?? path.join(HERE, '..'));
const EVIDENCE = path.resolve(process.env.LIVE_REGISTERED_EVIDENCE_DIR ?? path.join(ROOT, '../billiard-live-registered-evidence'));
const OUTPUT = path.resolve(process.env.BATCH_OUTPUT_DIR ?? path.join(HERE, '../artifacts/multishot-batch'));
const SOURCES = (process.env.BATCH_SOURCES ?? 'placed,awake').split(',');
const FULL = process.env.BATCH_SCOPE === 'full', LIMIT = FULL ? 20000 : Number(process.env.BATCH_MAX_H ?? 128);
const SEQUENTIAL_H = Number(process.env.BATCH_SEQUENTIAL_H ?? 8);
const PROGRESS_EVERY = Number(process.env.BATCH_PROGRESS_EVERY ?? (FULL ? 256 : 32));
const ENABLED = process.env.REQUIRE_WEBGPU === '1';
const OBSERVE = process.env.BATCH_INVERSE_OBSERVATION === '1';
const observationOptions=()=>OBSERVE?{observeInverse:true}:{};
function checkReceipt(slot){if(!OBSERVE)return;assert.equal(slot.state.inverseObservation.sequence,slot.state.frame);assert.ok(Object.isFrozen(slot.state.inverseObservation));assert.ok(Object.isFrozen(slot.state.inverseObservation.cue.position));}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex'), copy = value => structuredClone(value);
const emit = value => console.log(JSON.stringify(value));
assert.ok(SOURCES.length >= 2 && SOURCES.length <= 3 && new Set(SOURCES).size === SOURCES.length, 'Distinct original source states required, not duplicate fixtures');
assert.ok(SOURCES.every(source => Object.hasOwn(PINNED, source)));
assert.ok(Number.isSafeInteger(LIMIT) && LIMIT > 0 && LIMIT <= 20000);
assert.ok(Number.isSafeInteger(PROGRESS_EVERY) && PROGRESS_EVERY > 0);
assert.ok(Number.isSafeInteger(SEQUENTIAL_H) && SEQUENTIAL_H >= 0 && SEQUENTIAL_H <= Math.min(128, LIMIT));
let prepared;
async function sources() {
  prepared ??= prepareValidation(ROOT, EVIDENCE);
  const provenance = await prepared, seeds = [];
  for (const source of SOURCES) seeds.push(await importInitial(source));
  assert.equal(new Set(seeds.map(seed => seed.initialSnapshotSha256)).size, SOURCES.length);
  noNative(); return {provenance, seeds};
}
async function nativeDevice(label) {
  assert.equal(process.env.REQUIRE_WEBGPU, '1', 'Actual WebGPU is required, never a CPU fallback');
  const module = process.env.GPU_NATIVE_MODULE ?? '/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js';
  process.env.VK_ICD_FILENAMES ??= '/usr/lib/chromium/vk_swiftshader_icd.json';
  const {create, globals} = await import(pathToFileURL(module).href); Object.assign(globalThis, globals);
  const gpu = create(['backend=vulkan']), adapter = await gpu.requestAdapter(); assert.ok(adapter);
  const device = await adapter.requestDevice(), release = require('./native-gpu-test-owner.cjs').retain(gpu, adapter, device, label);
  return {device, release, adapter: Object.fromEntries(['vendor', 'architecture', 'device', 'description', 'isFallbackAdapter'].map(key => [key, adapter.info?.[key] ?? null]))};
}
const batchModule = suffix => import(pathToFileURL(path.join(ROOT, 'src/experimental-four-ball-batch-world.mjs')).href + (suffix ? '?' + suffix : ''));
function statsFor() {return {hCompared: 0, internalPasses: 0, maxAbsolute: 0, maxCueInertiaAbsolute: 0, maxCueInertiaNormalized: 0, checkpoints: []};}
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
function sourceProof() {
  const files = [...fs.readdirSync(path.join(ROOT, 'src')).filter(name => name.startsWith('experimental-') && /\.(?:m?js)$/.test(name)).map(name => 'src/' + name),
    ...fs.readdirSync(path.join(ROOT, 'src/browser-initial-import')).filter(name => name.endsWith('.mjs')).map(name => 'src/browser-initial-import/' + name), 'src/game-rules.js', 'src/bounded-gpu-shot/resources.mjs'];
  return Object.fromEntries(files.sort().map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]));
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

test('distinct live worlds share native dispatches and independently match every original h through rest', {skip: !ENABLED || process.env.BATCH_LIFECYCLE_ONLY === '1', timeout: 3600000}, async () => {
  const {provenance, seeds} = await sources(), fixtures = SOURCES.map(loadEvidence), proof = sourceProof();
  const harnessProof = Object.fromEntries(['live-registered-multishot-batch.mjs', 'live-registered-performance-support.mjs', 'webgpu-batch-observation.cjs', 'webgpu-observation.cjs', 'native-gpu-test-owner.cjs'].map(file => [file, hash(fs.readFileSync(path.join(HERE, file)))]));
  const gpu = await nativeDevice('independent original multi-shot replay'), actual = require('./webgpu-batch-observation.cjs').observeBatchDispatches(gpu.device);
  const resources = require('./webgpu-observation.cjs').observeWebGpu(gpu.device), {createGpuBatchStepper} = await batchModule();
  const originals = seeds, submittedSeeds = (await sources()).seeds, ids = SOURCES.map(source => 'source-' + source), savedIds = ids.slice();
  const stats = SOURCES.map(statsFor), checkpointMaps = fixtures.map(({record}) => {
    const result = new Map(); for (const point of record.checkpoints.filter(point => point.hCount > 0 && !point.reasons.includes('cue-withdrawal'))) result.set(point.hCount, [...(result.get(point.hCount) ?? []), point]); return result;
  });
  const prefix = []; let batch, out, failure = null, sharedNativeWitness = null;
  gpu.device.addEventListener?.('uncapturederror', event => {failure ??= String(event.error?.message ?? event.error);});
  const start = performance.now();
  try {
    const creating = createGpuBatchStepper(gpu.device, submittedSeeds, {ids});
    submittedSeeds[0].initialSnapshotSha256 = 'caller-mutated-after-invocation'; submittedSeeds[0].sourceApplicationSteps += 1000; submittedSeeds[0].balls.reverse(); ids.reverse();
    batch = await creating; out = batch.snapshot();
    assert.deepEqual(out.slots.map(slot => slot.id), savedIds); assert.ok(out.slots.every(slot => slot.status === 'ready'), JSON.stringify(out.slots.map(({id,status,reason}) => ({id,status,reason}))));
    out.slots.forEach((slot, index) => {assert.equal(slot.state.frame, 0); compactDeepEqual(slot.state.origin.sourceOrigin, originals[index].sourceOrigin);});
    const baseline = copy(out.slots); out.slots[0].state.balls[0].state.linear[0] = 12345;
    out = batch.snapshot(); compactDeepEqual(out.slots, baseline, 'Returned snapshot mutation cannot alter either world');
    emit({schema: 'multishot-world-start-v1', sources: SOURCES, scope: FULL ? 'full' : 'prefix', limit: LIMIT, adapter: gpu.adapter, proof, harnessProof, provenance});
    for (let tick = 1; tick <= LIMIT; tick++) {
      const before = out; out = await batch.step();
      const nativeEvents = actual.takeRecent();
      if (!sharedNativeWitness) for (const receipt of out.scheduler.recentDispatches.filter(receipt => receipt.ownerIds.length >= 2 && !receipt.failed)) {
        const plan = out.scheduler.plans.find(plan => plan.planId === receipt.planId);
        const event = nativeEvents.find(event => event.label === 'shared arithmetic plan ' + receipt.planId && event.rows === receipt.rows && event.inputFloats === plan.inputFloats && event.nodeCount === plan.nodeCount && event.outputFloats === plan.outputFloats);
        if (event) {
          assert.ok(receipt.ownerIds.every(id => savedIds.includes(id))); assert.equal(event.workgroups, Math.ceil(receipt.rows / 32)); assert.equal(event.outputBytes, receipt.rows * (plan.outputFloats + 1) * 4);
          sharedNativeWitness = {tick, receipt, nativeDispatch: event}; break;
        }
      }
      for (let index = 0; index < out.slots.length; index++) {
        const slot = out.slots[index], state = slot.state, record = fixtures[index].record, metrics = stats[index];
        assert.ok(['ready', 'complete'].includes(slot.status), slot.id + ': ' + slot.status + ': ' + slot.reason);
        if (before.slots[index].status === 'complete') {compactDeepEqual(state, before.slots[index].state, 'Already finished world is exactly idempotent while sibling continues'); continue;}
        assert.equal(state.frame, metrics.hCompared + 1); metrics.internalPasses += state.lastStep.ccd?.sourceInternalPasses.length ?? 1;
        assert.equal(state.contactGraph.sequence, metrics.internalPasses);
        const frame = record.frames[state.frame - 1]; assert.ok(frame, 'Candidate cannot outlive the original rest boundary');
        compareFrame(state, frame, originals[index], record, metrics);
        for (const point of checkpointMaps[index].get(state.frame) ?? []) await compareCheckpoint(state, point, frame, originals[index], record, metrics);
        metrics.hCompared++; if (state.frame === SEQUENTIAL_H) prefix[index] = copy(state);
        if (slot.status === 'complete') {assert.equal(state.shotComplete, true); assert.equal(state.scene.manager.awake_island, null); assert.ok(state.balls.every(ball => ball.state.sleeping)); compactDeepEqual(state.game, record.finalGame); compactDeepEqual(state.scoreResult, record.score);}
      }
      if (tick === 1 || tick % PROGRESS_EVERY === 0 || tick === LIMIT) emit({schema: 'multishot-world-progress-v1', tick, elapsedMs: performance.now() - start, slots: out.slots.map((slot, index) => ({id: slot.id, status: slot.status, h: slot.state.frame, checkpoints: stats[index].checkpoints.length, maxAbsolute: stats[index].maxAbsolute})), scheduler: out.scheduler, memory: process.memoryUsage()});
      if (out.slots.every(slot => slot.status === 'complete')) break;
    }
    const complete = out.slots.every(slot => slot.status === 'complete'); if (FULL) assert.ok(complete, 'Full scope must reach independent original physical rest for every slot');
    const nativeProof = actual.snapshot(), scheduled = batch.stats().scheduler;
    assert.ok(scheduled.multiOwnerDispatches > 0, 'At least one actual dispatch must include requests from independent worlds');
    assert.ok(scheduled.maxDispatchOwners >= 2); assert.ok(scheduled.maxDispatchRequests >= 2);
    assert.ok(sharedNativeWitness, 'A multi-owner world receipt must match an independently observed actual native plan/row dispatch');
    assert.ok(nativeProof.multiRowDispatches >= scheduled.multiOwnerDispatches, 'Actual native logical rows independently corroborate multi-owner receipts');
    assert.ok(nativeProof.arithmeticDispatches >= scheduled.dispatches);
    if (complete) {compactDeepEqual((await batch.step()).slots, out.slots); compactDeepEqual((await batch.step()).slots, out.slots);}
    const final = copy(out.slots); await batch.dispose(); assert.equal(resources.snapshot().buffers.liveCount, 0, 'All tracked actual native buffers disposed');
    // Short same-run sequential CPU and native GPU comparisons are independent
    // worlds, never reference values fed into the batched candidate.
    fs.mkdirSync(OUTPUT, {recursive: true});
    const World = require(path.join(ROOT, 'src/experimental-four-ball-world.js')), sequential = [];
    if (SEQUENTIAL_H) for (let index = 0; index < originals.length; index++) for (const backend of ['cpu', 'gpu']) {
      let world; try {
        world = backend === 'cpu' ? await World.createReferenceStepper(originals[index]) : await World.createGpuStepper(gpu.device, originals[index]);
        let state; const sequentialStats = statsFor();
        for (let h = 0; h < SEQUENTIAL_H; h++) {
          state = await world.step(); sequentialStats.internalPasses += state.lastStep.ccd?.sourceInternalPasses.length ?? 1;
          compareFrame(state, fixtures[index].record.frames[h], originals[index], fixtures[index].record, sequentialStats);
          for (const point of checkpointMaps[index].get(state.frame) ?? []) await compareCheckpoint(state, point, fixtures[index].record.frames[h], originals[index], fixtures[index].record, sequentialStats);
          sequentialStats.hCompared++;
        }
        for (const [kind, value] of [['batch', prefix[index]], [backend, state]]) fs.writeFileSync(path.join(OUTPUT, SOURCES[index] + '-' + kind + '-h' + SEQUENTIAL_H + '.state.v8'), v8.serialize(value));
        if (backend === 'gpu') compactDeepEqual(prefix[index], state, 'Entire batched/sequential native GPU public state ' + SOURCES[index]);
        const comparison = backend === 'cpu' ? numericalDifferenceReport(normalizeBackendLabels(prefix[index], 'gpu'), normalizeBackendLabels(state, backend)) : {exactEntirePublicState: true};
        sequential.push({source: SOURCES[index], backend, h: SEQUENTIAL_H, ...comparison, independentlyMatchedOriginal: true, originalValidation: sequentialStats, normalizedBackendDiagnosticsOnly: backend === 'cpu'});
      } finally {world?.dispose();}
    }
    // Independently pinned already-validated full sequential native result.
    let sequentialFull = null;
    if (complete && SOURCES.includes('placed')) {
      const file = path.resolve(process.env.BATCH_PLACED_SEQUENTIAL_STATE ?? path.join(ROOT, '../billiard-live-gpu-performance-test/artifacts/live-performance/candidate-placed-full-gpu.state.v8'));
      const bytes = fs.readFileSync(file), expectedHash = '68754636081675b3c8c75217df5205123238e41bce5593750bc69321d4c85275';
      assert.equal(hash(bytes), expectedHash, 'Pinned independently validated full sequential native GPU snapshot');
      compactDeepEqual(final[SOURCES.indexOf('placed')].state, v8.deserialize(bytes), 'Entire final placed batch snapshot equals established sequential native GPU output');
      sequentialFull = {source: 'placed', h: 5683, sha256: expectedHash, exactEntirePublicState: true};
    }
    stats.forEach((metrics, index) => assert.equal(metrics.checkpoints.length, [...checkpointMaps[index].values()].flat().filter(point => point.hCount <= metrics.hCompared).length));
    for (const [file, digest] of Object.entries(proof)) assert.equal(hash(fs.readFileSync(path.join(ROOT, file))), digest, 'Runtime source changed while evidence ran: ' + file);
    for (const [file, digest] of Object.entries(harnessProof)) assert.equal(hash(fs.readFileSync(path.join(HERE, file))), digest, 'Harness changed while evidence ran: ' + file);
    noNative(); if (failure) throw Error('Uncaptured native GPU error: ' + failure);
    fs.mkdirSync(OUTPUT, {recursive: true}); const outputs = [];
    for (let index = 0; index < final.length; index++) {const bytes = v8.serialize(final[index].state), file = path.join(OUTPUT, SOURCES[index] + (complete ? '-full' : '-prefix') + '.state.v8'); fs.writeFileSync(file, bytes); outputs.push({source: SOURCES[index], path: file, sha256: hash(bytes), bytes: bytes.length});}
    const result = {schema: 'live-registered-multishot-world-proof-v1', status: complete ? 'all-native-full-rest-matched' : 'verified-prefix', fullShot: complete, sources: SOURCES, adapter: gpu.adapter, provenance, sourceProof: proof, harnessProof, native: nativeProof, scheduler: scheduled, sharedNativeWitness, sequential, sequentialFull, stats, outputs, elapsedMs: performance.now() - start,
      semantics: {actualMultiOwnerNativeDispatch: true, independentCommitPerWorld: true, crossWorldAtomicCommit: false, hardwareAccelerationClaim: false, originalFramesAssertionOnly: true, nativeRuntimeSteps: 0, distinctPinnedSourceInputs: true, scoreAndFoulRulesUnchanged: true}};
    fs.writeFileSync(path.join(OUTPUT, complete ? 'full-proof.json' : 'prefix-proof.json'), JSON.stringify(result, null, 2) + '\n'); emit(result);
  } finally {try {await batch?.dispose();} finally {resources.restore(); actual.restore(); gpu.release();}}
});

function instrumentFinalPreflight() {
  const file = path.join(ROOT, 'src/experimental-four-ball-world.js'), original = require(file), base = createRequire(file), module = new Module(file);
  module.filename = file; module.paths = Module._nodeModulePaths(path.dirname(file));
  const scenes = new Map(); let armed = null, hits = 0;
  module.require = id => {
    const actual = base(id); if (id !== './experimental-scene-activation') return actual;
    const wrapped = {...actual};
    for (const method of ['createGpuStage', 'createReferenceStage']) wrapped[method] = (...args) => {
      const initial = args.at(-1), finish = stage => {
        scenes.set(initial.initialSnapshotSha256, stage); const out = {...stage};
        for (const name of ['assertPrepared', 'assertOuterPrepared']) out[name] = (...args) => {
          const result = Reflect.apply(stage[name], stage, args);
          if (armed === initial.initialSnapshotSha256) {armed = null; hits++; throw Error('Injected independent owner final-preflight rollback');}
          return result;
        };
        return Object.freeze(out);
      };
      const stage = actual[method](...args); return stage?.then ? stage.then(finish) : finish(stage);
    };
    return wrapped;
  };
  module._compile(fs.readFileSync(file, 'utf8'), file);
  return {arm(hash) {assert.equal(armed, null); armed = hash;}, hits: () => hits, scene(hash) {return copy(scenes.get(hash).snapshot());}, restore() {globalThis.LabFourBallWorldExperimental = original; scenes.clear();}};
}

test('one real world final-preflight failure rolls back only its owner while another source commits', {skip: !ENABLED || process.env.BATCH_REPLAY_ONLY === '1', timeout: 180000}, async () => {
  const {seeds} = await sources(), gpu = await nativeDevice('multi-shot isolated rollback'), probe = instrumentFinalPreflight(); let batch;
  try {
    const {createGpuBatchStepper} = await batchModule('independent-rollback'); batch = await createGpuBatchStepper(gpu.device, seeds, observationOptions());
    const first = await batch.step(); assert.ok(first.slots.every(slot => slot.state.frame === 1 && slot.status === 'ready'));
    const before = batch.snapshot(), privateBefore = probe.scene(seeds[0].initialSnapshotSha256); probe.arm(seeds[0].initialSnapshotSha256);
    const next = await batch.step(); next.slots.forEach(checkReceipt);assert.equal(probe.hits(), 1); assert.equal(next.slots[0].status, 'failed'); assert.match(next.slots[0].reason, /Injected independent owner/);
    compactDeepEqual(next.slots[0].state, before.slots[0].state, 'Rejected owner h is atomic'); compactDeepEqual(probe.scene(seeds[0].initialSnapshotSha256), privateBefore, 'Failed owner private scene committed state is unchanged');
    assert.equal(next.slots[1].status, 'ready'); assert.equal(next.slots[1].state.frame, 2);
    const record = loadEvidence(SOURCES[1]).record; compareFrame(next.slots[1].state, record.frames[1], seeds[1], record, statsFor());
    const again = await batch.step(); compactDeepEqual(again.slots[0], next.slots[0], 'Failed owner is terminal, not retried or replayed'); assert.equal(again.slots[1].state.frame, 3);
    emit({schema: 'multishot-isolated-world-rollback-v1', failedSource: SOURCES[0], siblingSource: SOURCES[1], failedH: 2, failedCommittedH: 1, siblingH: 3, exactPublicRollback: true, exactPrivateSceneRollback: true});
  } finally {try {await batch?.dispose();} finally {probe.restore(); gpu.release();}}
});

test('cancel and actual device loss leave only whole committed h snapshots and release borrowed resources', {skip: !ENABLED || process.env.BATCH_REPLAY_ONLY === '1', timeout: 180000}, async () => {
  const {seeds} = await sources(), {createGpuBatchStepper} = await batchModule();
  for (const mode of ['pre-abort', 'in-flight-cancel', 'device-loss']) {
    const gpu = await nativeDevice('multi-shot ' + mode), observation = require('./webgpu-observation.cjs').observeWebGpu(gpu.device); let batch;
    try {
      batch = await createGpuBatchStepper(gpu.device, seeds, observationOptions()); const before = batch.snapshot(); let after;
      if (mode === 'pre-abort') {const controller = new AbortController(); controller.abort(); after = await batch.step({signal: controller.signal});}
      else if (mode === 'in-flight-cancel') {const pending = batch.step(); await batch.cancel('independent test cancellation'); after = await pending;}
      else {gpu.device.destroy(); await gpu.device.lost; after = await batch.step();}
      for (let index = 0; index < after.slots.length; index++) {
        const slot = after.slots[index]; checkReceipt(slot);assert.equal(slot.status, mode === 'device-loss' ? 'failed' : 'cancelled'); assert.ok(slot.state.frame === 0 || slot.state.frame === 1);
        if (slot.state.frame === 0) compactDeepEqual(slot.state, before.slots[index].state, 'No partial h publication');
        else {const record = loadEvidence(SOURCES[index]).record; compareFrame(slot.state, record.frames[0], seeds[index], record, statsFor());}
      }
      compactDeepEqual((await batch.step()).slots, after.slots, 'Terminal cancellation/loss is idempotent'); await batch.dispose(); await batch.dispose();
      assert.equal(observation.snapshot().buffers.liveCount, 0); await assert.rejects(batch.step(), /disposed/);
      emit({schema: 'multishot-world-cancel-loss-v1', mode, states: after.slots.map(({status,state}) => ({status,h:state.frame})), actualNativeBuffersReleased: true});
    } finally {try {await batch?.dispose();} finally {observation.restore(); gpu.release();}}
  }
});


test('opt-in independent inverse receipts share actual multi-owner GPU dispatches',{skip:!ENABLED||!OBSERVE,timeout:180000},async()=>{
 const {seeds}=await sources(),gpu=await nativeDevice('multi-shot inverse receipt'),actual=require('./webgpu-batch-observation.cjs').observeBatchDispatches(gpu.device),{createGpuBatchStepper}=await batchModule('inverse-receipts'),World=globalThis.LabFourBallWorldExperimental,refs=[];let batch,witness=null;
 try{
  for(const seed of seeds)refs.push(await World.createReferenceStepper(seed,{observeInverse:true}));
  const options={observeInverse:true},creating=createGpuBatchStepper(gpu.device,seeds,options);options.observeInverse=false;batch=await creating;
  const initial=batch.snapshot();initial.slots.forEach(checkReceipt);assert.notDeepEqual(initial.slots[0].state.inverseObservation,initial.slots[1].state.inverseObservation,'distinct source receipts');assert.throws(()=>{initial.slots[0].state.inverseObservation.cue.position.x=123;},TypeError);
  for(let h=1;h<=8;h++){
   const out=await batch.step();for(let i=0;i<out.slots.length;i++){const slot=out.slots[i];assert.equal(slot.status,'ready',slot.reason);checkReceipt(slot);const ref=await refs[i].step();compactDeepEqual(slot.state.inverseObservation,ref.inverseObservation,'independent reference receipt h'+h);}
   const native=actual.takeRecent();for(const receipt of out.scheduler.recentDispatches.filter(r=>r.ownerIds.length>=2&&!r.failed)){const plan=out.scheduler.plans.find(p=>p.planId===receipt.planId),event=native.find(e=>e.label==='shared arithmetic plan '+receipt.planId&&e.rows===receipt.rows&&e.inputFloats===plan.inputFloats&&e.nodeCount===plan.nodeCount&&e.outputFloats===plan.outputFloats);if(event){assert.equal(event.workgroups,Math.ceil(receipt.rows/32));witness={receipt,nativeDispatch:event};}}
  }
  assert.ok(witness,'scheduler owner receipt corroborated by native logical dispatch');assert.ok(batch.stats().scheduler.multiOwnerDispatches>0);initial.slots.forEach(s=>assert.equal(s.state.inverseObservation.sequence,0));
  emit({schema:'multishot-inverse-observation-v1',sources:SOURCES,steps:8,exactReferenceReceipts:true,immutableIndependentReceipts:true,witness});
 }finally{for(const ref of refs)ref.dispose();try{await batch?.dispose();}finally{actual.restore();gpu.release();}}
});
