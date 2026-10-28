// HOST tests of actual generated integer initialization code, not physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_EVENT_HISTORY_PROFILE, packSourceEventHistory} from '../src/source-event-history.mjs';
import {RULE_LAYOUT as R, binary64Words, appendNonkeyEventHistory, filterNativeEvent} from '../src/resident-candidate/physical-rules.mjs';
import {APPLICATION_LAYOUT as A} from '../src/resident-candidate/application.mjs';
import {validateWorldHistoryInitialization, packRawWorldHistoryClone, generateInitialStrokeHistoryWGSL} from '../src/resident-candidate/world-initial-history.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';

const colliders = Array.from({length: 27}, (_, index) => ({handle: {index, generation: 0}}));
const handle = index => new Float64Array(Uint32Array.of(index, 0).buffer)[0];
const keyed = (i, time) => ({kind: 'contact', key: handle(i % 26) + ':' + handle(26), time});
function fixture(n, time = 5.6291666666664275) {
  const pre = Array.from({length: n}, (_, i) => i % 3 ? keyed(i, i / 1000) : {kind: 'stroke', time: i / 1000});
  const created = [...pre, {kind: 'stroke', time}].slice(-120);
  const historyInitialization = {kind: 'resident-initial-event-history-v1', profile: SOURCE_EVENT_HISTORY_PROFILE,
    preStrike: packSourceEventHistory(pre, colliders), created: packSourceEventHistory(created, colliders), strokeTime: Uint32Array.from(binary64Words(time))};
  const state = new Uint32Array(512), segments = {rules: {offset: 64, words: 128}, application: {offset: 256, words: 128}}, r = segments.rules.offset;
  state[r + R.version] = 1; state[r + R.status] = 1;
  state[r + R.ringCount] = historyInitialization.created.count; state[r + R.ringHead] = historyInitialization.created.head;
  state.set(historyInitialization.created.words, r + R.ring);
  state.set(historyInitialization.strokeTime, segments.application.offset + A.header.time);
  return {template: {kind: 'resident-created-world-layout', state, segments, relocations: new Uint32Array(), historyInitialization}, pre, created};
}
function execute(template, state, {finish = false} = {}) {
  const entry = finish ? 'fn main()->bool{if(rc_state[2u]!=0u){return false;}if(!rc_world_initial_history_commit(0u)){rc_state[2u]=4u;return false;}rc_state[2u]=1u;return true;}' : 'fn main()->bool{return rc_world_initial_history_commit(0u);}';
  const code = '@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n' + generateInitialStrokeHistoryWGSL(template) + entry;
  const c = compileMicrocodeWGSL(code), main = c.functions.find(x => x.name === 'main'), bindings = Array.from({length: 5}, (_, i) => i ? new Uint32Array(1) : state);
  const vm = createMicrocodeVmReferenceForTest({testOnly: true, code: c.instructions, count: 1, localWords: c.localWords,
    stackCapacity: Math.max(1, c.callDepth), entryPc: c.entryPc, bindings});
  vm.begin(); let status = I.status.ready, calls = 0;
  while (status === I.status.ready) { status = vm.advance(0, 31); assert.ok(++calls < 1000); }
  assert.equal(status, I.status.complete);
  return {committed: !!vm.local(0, main.returnSlot), chunks: calls};
}
function readRing(state, template) {
  const r = template.segments.rules.offset;
  return {count: state[r + R.ringCount], head: state[r + R.ringHead], words: state.slice(r + R.ring, r + R.ring + 32)};
}
test('raw clone differs from created template only by authentic prestrike ring, never by body/program state', () => {
  for (const n of [0, 1, 7, 8, 9, 120]) {
    const {template: t} = fixture(n), before = t.state.slice(), clone = packRawWorldHistoryClone(t), r = t.segments.rules.offset;
    assert.deepEqual(readRing(clone, t), t.historyInitialization.preStrike);
    assert.deepEqual(t.state, before, 'created template remains authentic and immutable');
    for (let i = 0; i < t.state.length; i++) if (i !== r + R.ringCount && i !== r + R.ringHead && !(i >= r + R.ring && i < r + R.ring + 32)) assert.equal(clone[i], before[i]);
  }
});
test('actual generated WGSL appends exact non-key stroke once, including mixed full-ring FIFO eviction and bit-preserved clocks', () => {
  for (const [n, time] of [[0, -0], [0, Number.MIN_VALUE], [1, 5.6291666666664275], [7, 5.6291666666664275], [8, 5.6291666666664275], [9, 5.6291666666664275], [120, 5.6291666666664275]]) {
    const {template: t} = fixture(n, time), state = packRawWorldHistoryClone(t), result = execute(t, state, {finish: true});
    assert.equal(result.committed, true); assert.ok(result.chunks > 1, 'source order survives bounded interpreter yields');
    assert.deepEqual(readRing(state, t), t.historyInitialization.created);
    const once = state.slice(); assert.equal(execute(t, state, {finish: true}).committed, false);
    assert.deepEqual(state, once, 'published RUNNING prevents duplicate finish append');
  }
});
test('rejected, blocked and unsupported rows keep exact prestrike history; malformed prefix/clock fails before writes', () => {
  const {template: t} = fixture(8);
  for (const status of [8, 4, 5]) {
    const state = packRawWorldHistoryClone(t); state[2] = status;
    const before = state.slice(); assert.equal(execute(t, state, {finish: true}).committed, false); assert.deepEqual(state, before);
  }
  for (const mutate of [s => s[t.segments.rules.offset + R.ring + 1] ^= 1,
    s => s[t.segments.application.offset + A.header.time] ^= 1, s => s[5] = 1,
    s => s[t.segments.rules.offset + R.steps] = 1]) {
    const state = packRawWorldHistoryClone(t); mutate(state); const before = state.slice();
    assert.equal(execute(t, state).committed, false); assert.deepEqual(state, before, 'internal failure has no partial append');
  }
});
test('missing/tampered profile, wrong created FIFO, incomplete state and changed t0 timestamp are rejected before GPU code generation', () => {
  const {template: t} = fixture(8);
  for (const mutate of [x => delete x.historyInitialization, x => x.historyInitialization.profile = 'legacy',
    x => x.historyInitialization.created.words[0] ^= 1, x => x.historyInitialization.preStrike.head = 1,
    x => x.historyInitialization.strokeTime[0] ^= 1, x => x.state[x.segments.rules.offset + R.ringCount] = 7,
    x => x.segments.rules.words = 1]) {
    const bad = structuredClone(t); mutate(bad);
    assert.throws(() => validateWorldHistoryInitialization(bad)); assert.throws(() => generateInitialStrokeHistoryWGSL(bad));
  }
});
test('later source ring stays ordinary FIFO; non-key stroke occupies a slot but never matches a native pair', () => {
  const {template: t} = fixture(8), state = packRawWorldHistoryClone(t); execute(t, state, {finish: true});
  const r = state.subarray(t.segments.rules.offset, t.segments.rules.offset + 128);
  appendNonkeyEventHistory(r, binary64Words(5.64));
  assert.equal(r[R.ringHead], 1, 'no post-t0 recanonicalization'); assert.equal(r[R.ringCount], 8);
  const {template: empty} = fixture(0), emptyState = packRawWorldHistoryClone(empty); execute(empty, emptyState, {finish: true});
  const rules = emptyState.subarray(empty.segments.rules.offset, empty.segments.rules.offset + 128);
  assert.equal(filterNativeEvent(rules, {pairId: 0, time: binary64Words(5.64), started: true, movingBall: true,
    clothEarly: false, clothOrFloorSlow: false, recentMask: 255}), true, 'non-key pair word0 is not native pair0');
  assert.equal(rules[R.ringCount], 2); assert.equal(rules[R.ringHead], 2);
});
