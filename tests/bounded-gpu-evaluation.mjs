// ORCHESTRATION / OWNERSHIP DOUBLES ONLY. No actual GPU or parity claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExclusiveShotRunner} from '../src/bounded-gpu-shot/lifecycle.mjs';
import {createEvaluationQueue, EVALUATION_CAPABILITY} from '../src/bounded-gpu-shot/evaluation-queue.mjs';
import {copyCurrentSourceWorkerInput} from '../src/bounded-gpu-shot/four-ball-worker-protocol.mjs';
import {input, deferred, tick} from './bounded-gpu-shot-worker-fixture.mjs';
const shot = (id, extras = {}) => ({id, ...input(id), ...extras});
function setup({step, initialize, restAt = 3, onProgress, status = 'ready', now} = {}) {
  const loss = deferred(), stats = {flights: 0, maxFlights: 0, initialized: [], releases: 0, disposed: 0};
  const service = createExclusiveShotRunner({deviceLost: loss.promise, now: () => performance.now(), renderingBusy: () => false, yieldControl: tick,
    async initialize(raw, check) {
      stats.initialized.push(raw); await initialize?.(raw); check();
      if (raw.capture.application.id === 'unsupported') throw new RangeError('Unsupported native source binding');
      const state = {frame: 0, outerStep: 0, outerSubstep: 0, time: 0, cue: {present: true},
        balls: Array.from({length: 4}, () => ({state: {sleeping: false}})), scene: {manager: {awake_island: 0}},
        shotComplete: false, cueObstructions: [], game: {}, scoreResult: null};
      return {sourceEvidence: {validated: true, boundary: raw.capture.boundary, domain: 'explicit-test-double', snapshotSha256: 'test-' + raw.capture.application.id},
        world: {snapshot: () => structuredClone(state), async step() {
          stats.flights++; stats.maxFlights = Math.max(stats.maxFlights, stats.flights);
          try {
            await step?.(state, raw); state.frame++; state.outerStep++; state.time += 1 / 960;
            if (state.frame >= restAt) {state.shotComplete = true; state.cue.present = false;
              state.balls.forEach(b => {b.state.sleeping = true;}); state.scene.manager.awake_island = null;
              state.scoreResult = {delta: raw.capture.application.id === 'obstructed' ? 0 : 1};
              if (raw.capture.application.id === 'obstructed') state.cueObstructions.push({kind: 'shaft-floor'});}
          } finally {stats.flights--;}
        }}, release() {assert.equal(stats.flights, 0); stats.releases++;}};
    }});
  const client = {...service, ready: Promise.resolve({status, capability: {backend: 'webgpu', actualGpu: false}}), deviceLost: loss.promise,
    async dispose() {await service.dispose(); stats.disposed++;}};
  const evaluation = createEvaluationQueue(client, {onProgress, ...(now ? {now} : {})});
  return {evaluation, stats, loss};
}
async function complete(op, budget = {maxSteps: 4096, maxWallMs: 30000}) {
  let out = await op.result;
  while (out.status === 'budget-suspended') out = await op.resume({budget});
  return out;
}
test('evaluation double: bounded serial list processes mixed source support without certifying parity', async () => {
  const s = setup(); await s.evaluation.ready;
  const malformed = shot('bad-boundary'); malformed.capture.boundary = 'unknownCreated';
  const op = s.evaluation.start([shot('A'), shot('unsupported'), malformed, shot('B')]);
  const out = await complete(op);
  assert.equal(out.status, 'complete'); assert.equal(out.allShotsComplete, false);
  assert.deepEqual(out.shots.map(x => x.status), ['complete', 'unsupported', 'unsupported', 'complete']);
  assert.equal(out.progress.committedH, 6); assert.equal(out.progress.processed, 4);
  assert.equal(out.backend, 'webgpu'); assert.equal(out.cpuFallback, false);
  assert.equal(out.execution, 'serial-bounded-evaluation'); assert.equal(EVALUATION_CAPABILITY.parallelShotBatch, false);
  for (const row of out.shots) {assert.equal(row.certification.status, 'not-certified'); assert.equal(row.backend, 'webgpu'); assert.ok(!('state' in row));}
  assert.equal(out.shots[0].source.snapshotSha256, 'test-A'); assert.equal(out.shots[0].recommendation.valid, true);
  assert.equal(out.shots[1].source.validated, false); assert.equal(out.shots[1].score, null);
  assert.equal(s.stats.maxFlights, 1); assert.equal(s.stats.releases, 2); await s.evaluation.dispose();
});
test('evaluation double: physical-rest score zero cannot make a cue-obstructed route valid', async () => {
  const s = setup(); await s.evaluation.ready;
  const out = await complete(s.evaluation.start([shot('obstructed')]));
  assert.equal(out.shots[0].status, 'complete'); assert.equal(out.shots[0].score.delta, 0);
  assert.deepEqual(out.shots[0].obstruction, {status: 'observed', count: 1});
  assert.deepEqual(out.shots[0].recommendation, {valid: false, reason: 'cue-obstructed'}); await s.evaluation.dispose();
});
test('evaluation double: aggregate slices preserve a world across resume and count h across shots', async () => {
  const s = setup(); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A'), shot('B')], {budget: {maxSteps: 2, maxWallMs: 30000}});
  const first = await op.result; assert.equal(first.status, 'budget-suspended'); assert.equal(first.progress.committedH, 2);
  assert.equal(s.stats.initialized.length, 1); assert.equal(s.stats.releases, 0);
  const second = await op.resume({budget: {maxSteps: 2, maxWallMs: 30000}});
  assert.equal(second.progress.committedH, 4); assert.equal(second.shots[0].status, 'complete'); assert.equal(second.shots[1].progress.committedH, 1);
  const out = await op.resume(); assert.equal(out.status, 'complete'); assert.equal(out.progress.committedH, 6);
  assert.deepEqual(await op.finished, out); await s.evaluation.dispose();
});
test('evaluation double: raw bytes and metadata for every list entry are owned before first await', async () => {
  const entered = deferred(), gate = deferred();
  const s = setup({initialize: async () => {entered.resolve(); await gate.promise;}}); await s.evaluation.ready;
  const a = shot('A'), b = shot('B'), op = s.evaluation.start([a, b]);
  a.snapshot.fill(9); a.capture.application.id = 'mutated'; b.snapshot.fill(8); b.capture.application.id = 'later-mutated';
  await entered.promise; gate.resolve(); const out = await complete(op);
  assert.deepEqual(s.stats.initialized.map(x => x.capture.application.id), ['A', 'B']);
  for (const raw of s.stats.initialized) assert.deepEqual(raw.snapshot, new Uint8Array([1, 2, 3]));
  assert.throws(() => {out.shots[0].source.validated = false;});
  assert.equal(op.snapshot().shots[0].source.validated, true); await s.evaluation.dispose();
});
test('evaluation double: stale drain settles old handle without overwriting latest progress or opening another world', async () => {
  const entered = deferred(), gate = deferred(), progress = [];
  const s = setup({onProgress: value => progress.push(value.operationId), step: async (_, raw) => {
    if (raw.capture.application.id === 'old') {entered.resolve(); await gate.promise;}
  }}); await s.evaluation.ready;
  const old = s.evaluation.start([shot('old'), shot('never')]); await entered.promise;
  const fresh = s.evaluation.start([shot('new')]); const transition = progress.length;
  assert.equal(s.evaluation.snapshot().operationId, fresh.id); assert.equal(s.stats.initialized.length, 1);
  gate.resolve(); const prior = await old.finished, out = await complete(fresh);
  assert.equal(prior.status, 'cancelled'); assert.equal(prior.reason, 'superseded');
  assert.equal(prior.shots[0].progress.committedH, 1); assert.equal(prior.shots[1].status, 'not-run');
  assert.equal(out.status, 'complete'); assert.equal(s.stats.maxFlights, 1);
  assert.ok(progress.slice(transition).every(id => id === fresh.id));
  assert.throws(() => old.resume(), /latest idle/); assert.equal(s.evaluation.snapshot().operationId, fresh.id); await s.evaluation.dispose();
});
test('evaluation double: abort during atomic h drains before terminal, preabort initializes nothing', async () => {
  const entered = deferred(), gate = deferred(), abort = new AbortController();
  const s = setup({step: async () => {entered.resolve(); await gate.promise;}}); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A'), shot('B')], {signal: abort.signal}); await entered.promise; abort.abort();
  assert.equal(s.stats.releases, 0); gate.resolve(); const out = await op.finished;
  assert.equal(out.status, 'cancelled'); assert.equal(out.shots[0].progress.committedH, 1); assert.equal(s.stats.releases, 1);
  const next = s.evaluation.start([shot('preaborted')], {signal: abort.signal});
  assert.equal((await next.finished).status, 'cancelled'); assert.equal(s.stats.initialized.length, 1); await s.evaluation.dispose();
});
test('evaluation double: device loss drains h and never initializes a later input or CPU fallback', async () => {
  const entered = deferred(), gate = deferred();
  const s = setup({step: async () => {entered.resolve(); await gate.promise;}}); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A'), shot('B')]); await entered.promise; s.loss.resolve({message: 'lost test adapter'}); await tick();
  assert.equal(s.stats.releases, 0); gate.resolve(); const out = await op.finished;
  assert.equal(out.status, 'device-lost'); assert.equal(out.shots[0].status, 'device-lost'); assert.equal(out.shots[1].status, 'not-run');
  assert.equal(out.cpuFallback, false); assert.equal(s.stats.initialized.length, 1);
  assert.throws(() => s.evaluation.start([shot('C')]), /device-lost/); await s.evaluation.dispose();
});
test('evaluation double: unavailable adapter readiness is explicit and cannot start evaluation', async () => {
  const s = setup({status: 'unsupported'}); const ready = await s.evaluation.ready;
  assert.equal(ready.status, 'unsupported'); assert.equal(ready.evaluation.cpuFallback, false);
  assert.throws(() => s.evaluation.start([shot('A')]), /unavailable: unsupported; no CPU fallback/);
  assert.equal(s.stats.initialized.length, 0); await s.evaluation.dispose();
});
test('evaluation double: loss before ready cannot turn into a ready receipt', async () => {
  const ready = deferred(), loss = deferred();
  const client = {ready: ready.promise, deviceLost: loss.promise, async dispose() {}};
  const e = createEvaluationQueue(client); loss.resolve({reason: 'lost-before-ready'}); await tick(); ready.resolve({status: 'ready'});
  assert.equal((await e.ready).status, 'device-lost'); await e.dispose();
});
test('evaluation double: per-shot and total h caps cancel live owners and distinguish limits from unsupported', async () => {
  const s = setup({restAt: 10}); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A'), shot('B')], {limits: {maxShotH: 2, maxTotalH: 3}});
  const out = await complete(op); assert.equal(out.status, 'limit-reached'); assert.equal(out.reason, 'maxTotalH');
  assert.deepEqual(out.shots.map(x => x.status), ['limit-reached', 'limit-reached']);
  assert.deepEqual(out.shots.map(x => x.reason), ['maxShotH', 'maxTotalH']); assert.equal(out.progress.committedH, 3);
  assert.equal(s.stats.releases, 2); assert.ok(out.shots.every(x => x.score === null && !x.recommendation.valid)); await s.evaluation.dispose();
});
test('evaluation double: bad limits, duplicated IDs, shared/accessor memory reject before replacing current owner', async () => {
  const s = setup({restAt: 10}); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A')], {budget: {maxSteps: 1}}); await op.result;
  assert.throws(() => s.evaluation.start([shot('B')], {limits: {maxShots: 17}}), /maxShots/);
  assert.throws(() => s.evaluation.start([shot('B'), shot('B')]), /Unique/);
  assert.throws(() => s.evaluation.start([shot('B')], {limits: {maxInputBytes: 2}}), /maxInputBytes/);
  let getter = 0; const evil = shot('B'); Object.defineProperty(evil.capture, 'extra', {get() {getter++; return 1;}});
  assert.throws(() => s.evaluation.start([evil]), /accessors/); assert.equal(getter, 0);
  assert.throws(() => s.evaluation.start([shot('B', {snapshot: new Uint8Array(new SharedArrayBuffer(4))})]), /SharedArrayBuffer/);
  assert.equal(s.evaluation.snapshot().operationId, op.id); assert.equal(op.snapshot().status, 'budget-suspended'); await s.evaluation.dispose();
});
test('evaluation double: backing-store limit counts memory beyond a narrow snapshot view', async () => {
  const s = setup(); await s.evaluation.ready;
  const narrow = new Uint8Array(new ArrayBuffer(1024 * 1024), 0, 3);
  assert.throws(() => s.evaluation.start([shot('A', {snapshot: narrow})], {limits: {maxInputBytes: 16384}}), /maxInputBytes/);
  assert.equal(s.stats.initialized.length, 0); await s.evaluation.dispose();
});
test('evaluation double: duplicate resume rejects, observer errors are isolated, disposal is drained and idempotent', async () => {
  const s = setup({onProgress() {throw new Error('observer');}}); await s.evaluation.ready;
  const op = s.evaluation.start([shot('A')], {budget: {maxSteps: 1}}); await op.result;
  const resume = op.resume({budget: {maxSteps: 1}}); assert.throws(() => op.resume(), /latest idle/); await resume;
  const disposed = s.evaluation.dispose(); assert.equal(s.evaluation.dispose(), disposed); await disposed;
  assert.equal((await op.finished).status, 'cancelled'); assert.equal(s.stats.releases, 1); assert.equal(s.stats.disposed, 1);
});
test('current-source envelope: distinct live boundary owns both snapshots and preserves restore provenance', () => {
  const raw = {snapshot: new Uint8Array([1]), preStrikeSnapshot: new Uint8Array([2]), capture: {
    boundary: 'liveRegisteredStrikeCreated', candidateInput: true, apiJournalLength: 13, application: {},
    strikeCreationJournal: [], nativeRestoreUsed: true, preStrikeApplication: {}, readiness: {anyMotion: false}}};
  const owned = copyCurrentSourceWorkerInput(raw); raw.preStrikeSnapshot.fill(9); raw.capture.readiness.anyMotion = true;
  assert.equal(owned.preStrikeSnapshot[0], 2); assert.equal(owned.capture.readiness.anyMotion, false);
  assert.throws(() => copyCurrentSourceWorkerInput({...raw, capture: {...raw.capture, nativeRestoreUsed: false}}), /restore provenance/);
  assert.throws(() => copyCurrentSourceWorkerInput({...raw, seed: {}}), /raw snapshot/);
});
test('current-source envelope: boundary accessors cannot execute before rejection', () => {
  let called = 0; const raw = input('getter');
  Object.defineProperty(raw.capture, 'boundary', {get() {called++; return 'liveRegisteredStrikeCreated';}});
  assert.throws(() => copyCurrentSourceWorkerInput(raw), /accessors/); assert.equal(called, 0);
});
test('evaluation double: repeated queued replacement releases obsolete lists before the running h drains', async () => {
  const entered = deferred(), gate = deferred();
  const s = setup({step: async (_, raw) => {if (raw.capture.application.id === 'running') {entered.resolve(); await gate.promise;}}});
  await s.evaluation.ready; const running = s.evaluation.start([shot('running')]); await entered.promise;
  const queued = [];
  for (let n = 0; n < 100; n++) queued.push(s.evaluation.start([shot('replacement-' + n)]));
  // These promises settle while the first GPU h is still blocked. No retained
  // raw-list tail or initializer for the other 99 requests is needed.
  const obsolete = await Promise.all(queued.slice(0, -1).map(x => x.finished));
  assert.ok(obsolete.every(x => x.status === 'cancelled' && x.progress.committedH === 0));
  assert.equal(s.stats.initialized.length, 1); gate.resolve();
  assert.equal((await running.finished).status, 'cancelled');
  assert.equal((await complete(queued.at(-1))).status, 'complete');
  assert.deepEqual(s.stats.initialized.map(x => x.capture.application.id), ['running', 'replacement-99']); await s.evaluation.dispose();
});
test('public evaluation factories: no injected backend, actual same-realm device required', async () => {
  const {createBoundedFourBallEvaluationService} = await import('../src/bounded-gpu-shot/evaluation-service.mjs');
  const {createBoundedFourBallEvaluationClient} = await import('../src/bounded-gpu-shot/evaluation.mjs');
  assert.throws(() => createBoundedFourBallEvaluationService({device: {}, decoder: {decodeSnapshot() {}}}), /actual same-realm/);
  assert.throws(() => createBoundedFourBallEvaluationService({device: {}, decoder: {}, createGpuStepper() {}}), /accepts device/);
  assert.throws(() => createBoundedFourBallEvaluationClient({backend: 'cpu'}), /onProgress only/);
});
test('production current-source bootstrap: null adapter remains unsupported before decoder and device work', async () => {
  const {initializeWorkerGpu} = await import('../src/bounded-gpu-shot/four-ball-worker-bootstrap.mjs');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), previousFetch = globalThis.fetch;
  let adapterQueries = 0, requests = 0;
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {gpu: {async requestAdapter(...args) {
    assert.equal(args.length, 0); adapterQueries++; return null;
  }}}});
  globalThis.fetch = () => {requests++; throw new Error('No decoder fetch permitted without an adapter');};
  try {
    const result = await initializeWorkerGpu({currentSource: true});
    assert.deepEqual(result, {status: 'unsupported', reason: 'worker-webgpu-adapter-unavailable'});
    assert.equal(adapterQueries, 1); assert.equal(requests, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator;
    globalThis.fetch = previousFetch;
  }
});
test('evaluation double: shared ordinary input identities are counted once per independently owned shot', async () => {
  const s = setup(); await s.evaluation.ready;
  const shared = new Uint8Array(40000);
  assert.throws(() => s.evaluation.start([shot('A', {snapshot: shared}), shot('B', {snapshot: shared})],
    {limits: {maxInputBytes: 65536}}), /maxInputBytes/);
  assert.equal(s.stats.initialized.length, 0); await s.evaluation.dispose();
});
test('evaluation double: caller-thrown sourceEvidence cannot certify an uninitialized shot', async () => {
  const s = setup({initialize() {throw Object.assign(new RangeError('unsupported before owner'),
    {sourceEvidence: {validated: true, snapshotSha256: 'forged'}});}});
  await s.evaluation.ready; const out = await complete(s.evaluation.start([shot('A')]));
  assert.equal(out.shots[0].status, 'unsupported'); assert.equal(out.shots[0].source.validated, false);
  assert.equal(out.shots[0].certification.status, 'not-certified'); assert.equal(out.shots[0].recommendation.valid, false); await s.evaluation.dispose();
});
test('evidence reader: source-file hashes are pinned before V8 caller views can mutate backing memory', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path'), v8 = await import('node:v8'), crypto = await import('node:crypto');
  const {readRawEvaluationArtifact} = await import('./bounded-gpu-evaluation-artifact.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bounded-evaluation-artifact-')), file = path.join(directory, 'source.v8');
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  try {
    const original = v8.serialize({snapshot: new Uint8Array([1, 2, 3]), preStrikeSnapshot: new Uint8Array([4, 5, 6]), capture: {}});
    fs.writeFileSync(file, original); const result = readRawEvaluationArtifact(file), expectedFileHash = hash(original);
    result.raw.snapshot.fill(0); result.raw.preStrikeSnapshot.fill(0);
    assert.equal(result.inputArtifactSha256, expectedFileHash); assert.equal(hash(fs.readFileSync(file)), expectedFileHash);
    assert.equal(result.snapshotSha256, hash(new Uint8Array([1, 2, 3])));
    assert.equal(result.preStrikeSha256, hash(new Uint8Array([4, 5, 6])));
    assert.notEqual(hash(result.raw.snapshot), result.snapshotSha256);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});
