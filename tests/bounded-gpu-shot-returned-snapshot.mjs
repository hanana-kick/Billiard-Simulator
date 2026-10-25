// LIFECYCLE-ONLY DOUBLES. No native/GPU physics or performance claim.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExclusiveShotRunner} from '../src/bounded-gpu-shot/lifecycle.mjs';
const deferred = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({restAt = 3, returnKind = 'snapshot', beforeCommit, afterCommit} = {}) {
  const loss = deferred(), stats = {snapshotCalls: 0, releases: 0, steps: 0, flights: 0}, returns = [];
  const state = {frame: 0, outerStep: 0, outerSubstep: 0, time: 0,
    balls: Array.from({length: 4}, () => ({state: {sleeping: false, linear: [0, 0, 0]}})),
    cue: {present: true}, scene: {manager: {awake_island: 0}}, game: {}, shotComplete: false,
    bytes: new Uint8Array([1, 2, 3])};
  const world = {snapshot() {stats.snapshotCalls++; return structuredClone(state);}, async step() {
    stats.flights++;
    try {
      await beforeCommit?.(structuredClone(state));
      state.frame++; state.outerStep++; state.time += 1 / 960; stats.steps++;
      if (state.frame === restAt) {
        state.shotComplete = true; state.cue.present = false;
        state.balls.forEach(ball => {ball.state.sleeping = true;});
        state.scene.manager.awake_island = null; state.scoreResult = {delta: 1};
      }
      await afterCommit?.(state);
      if (returnKind === 'void') return;
      if (returnKind === 'null') return null;
      if (returnKind === 'primitive') return 1;
      if (returnKind === 'array') return [state.frame];
      if (returnKind === 'partial') return {notAWorldSnapshot: true};
      // Mirrors the actual owner's return api.snapshot(): it already performs
      // one full public projection. Count that call separately from the runner.
      const snapshot = world.snapshot(); returns.push(snapshot); return snapshot;
    } finally {stats.flights--;}
  }};
  const runner = createExclusiveShotRunner({deviceLost: loss.promise, now: () => performance.now(),
    yieldControl: tick, renderingBusy: () => false,
    async initialize() {return {world, release() {assert.equal(stats.flights, 0); stats.releases++;}};}});
  return {runner, world, state, stats, returns};
}
test('returned snapshot: each h uses its existing public projection; init and terminal refresh remain', async () => {
  const s = setup(), op = s.runner.start({}, {budget: {maxSteps: 1}});
  const first = await op.result; assert.equal(first.status, 'budget-suspended'); assert.equal(first.state.frame, 1);
  assert.equal(s.stats.snapshotCalls, 2, 'one initial snapshot plus the first step return, no duplicate observation');
  const second = await op.resume({budget: {maxSteps: 1}}); assert.equal(second.state.frame, 2);
  assert.equal(s.stats.snapshotCalls, 3, 'resume consumes the same owner returned snapshot');
  const final = await op.resume({budget: {maxSteps: 1}});
  assert.equal(final.status, 'complete'); assert.equal(final.state.frame, 3); assert.equal(final.scoring.result.delta, 1);
  assert.equal(s.stats.snapshotCalls, 5, 'three step returns, initial snapshot and unchanged final refresh');
  assert.deepEqual(await op.finished, final); assert.equal(s.stats.releases, 1); await s.runner.dispose();
});
test('returned snapshot: later mutation of the returned object or a public view cannot mutate retained state', async () => {
  const s = setup(), op = s.runner.start({}, {budget: {maxSteps: 1}}), first = await op.result;
  s.returns[0].frame = 900; s.returns[0].balls[0].state.linear[0] = 900; s.returns[0].bytes[0] = 9;
  assert.equal(op.snapshot().state.frame, 1); assert.equal(op.snapshot().state.balls[0].state.linear[0], 0);
  assert.equal(op.snapshot().state.bytes[0], 1); assert.ok(Object.isFrozen(first.state));
  assert.throws(() => {first.state.balls[0].state.linear[0] = 8;});
  first.state.bytes[0] = 8; assert.equal(op.snapshot().state.bytes[0], 1);
  assert.equal((await op.resume({budget: {maxSteps: 1}})).state.frame, 2);
  const cancelled = await op.cancel(); assert.equal(cancelled.state.frame, 2); assert.equal(s.stats.snapshotCalls, 4);
  assert.equal(s.stats.releases, 1); await s.runner.dispose();
});
test('returned snapshot: mid-h cancellation drains the returned commit and preserves terminal refresh', async () => {
  const entered = deferred(), gate = deferred();
  const s = setup({beforeCommit: async () => {entered.resolve(); await gate.promise;}}), op = s.runner.start({});
  await entered.promise; const cancelled = op.cancel(); assert.equal(s.stats.releases, 0); assert.equal(s.stats.snapshotCalls, 1);
  gate.resolve(); const out = await cancelled;
  assert.equal(out.status, 'cancelled'); assert.equal(out.state.frame, 1); assert.equal(out.progress.committedH, 1);
  assert.equal(s.stats.snapshotCalls, 3, 'initial, returned commit, then terminal refresh');
  assert.equal(s.stats.releases, 1); assert.deepEqual(await op.finished, out); await s.runner.dispose();
});
test('returned snapshot: atomic rollback error preserves the previous commit through terminal re-observation', async () => {
  const s = setup({beforeCommit: async speculative => {
    if (speculative.frame === 1) {speculative.frame = 999; speculative.balls[0].state.linear[0] = 999; throw new RangeError('unsupported atomic phase');}
  }}), op = s.runner.start({}, {budget: {maxSteps: 1}});
  await op.result; const out = await op.resume({budget: {maxSteps: 1}});
  assert.equal(out.status, 'unsupported'); assert.equal(out.state.frame, 1); assert.equal(out.state.balls[0].state.linear[0], 0);
  assert.equal(out.progress.committedH, 1); assert.equal(out.scoring.result, null);
  assert.equal(s.stats.snapshotCalls, 3); assert.equal(s.stats.releases, 1); await s.runner.dispose();
});
test('returned snapshot: errors after an actual commit still recover the latest world state at finish', async () => {
  const s = setup({afterCommit: async state => {if (state.frame === 2) throw new Error('public projection failed after commit');}});
  const op = s.runner.start({}, {budget: {maxSteps: 1}}); await op.result;
  const out = await op.resume({budget: {maxSteps: 1}});
  assert.equal(out.status, 'failed'); assert.equal(out.state.frame, 2); assert.equal(out.progress.committedH, 2);
  assert.equal(s.stats.snapshotCalls, 3); assert.equal(s.stats.releases, 1); await s.runner.dispose();
});
test('legacy void-step: undefined alone uses snapshot fallback across resume, final and cancel', async () => {
  const s = setup({returnKind: 'void', restAt: 2}), op = s.runner.start({}, {budget: {maxSteps: 1}});
  assert.equal((await op.result).state.frame, 1); assert.equal(s.stats.snapshotCalls, 2);
  assert.equal((await op.resume({budget: {maxSteps: 1}})).status, 'complete');
  assert.equal(s.stats.snapshotCalls, 4, 'initial, two void-step fallbacks and terminal refresh'); await s.runner.dispose();
  const other = setup({returnKind: 'void'}), pending = other.runner.start({}, {budget: {maxSteps: 1}}); await pending.result;
  assert.equal((await pending.cancel()).state.frame, 1); assert.equal(other.stats.snapshotCalls, 3); await other.runner.dispose();
});
test('invalid nonvoid step return: never silently use legacy fallback, but recover committed state for failure', async () => {
  for (const returnKind of ['null', 'primitive', 'array', 'partial']) {
    const s = setup({returnKind}), op = s.runner.start({}), out = await op.result;
    assert.equal(out.status, 'failed'); assert.match(out.error.message, /full committed snapshot or undefined/);
    assert.equal(out.state.frame, 1, 'unchanged terminal refresh recovers the actual commit');
    assert.equal(s.stats.snapshotCalls, 2, 'initial and terminal recovery only, no legacy fallback');
    assert.equal(out.scoring.result, null); assert.equal(s.stats.releases, 1); await s.runner.dispose();
  }
});
