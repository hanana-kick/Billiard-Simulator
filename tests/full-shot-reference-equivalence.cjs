'use strict';
// Reference-format regression only. Captured outputs are deliberately NOT a
// physics implementation or a parity result. The exact existing comparators run
// against the same captured values before and after projection, with every
// assertion recorded in an ordered, bounded-memory transcript.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const v8 = require('node:v8');
const {createRequire} = require('node:module');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;

function sourceBetween(file, start, end) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'Exact comparator source boundaries: ' + file);
  assert.equal(source.indexOf(start, from + start.length), -1, 'Unambiguous comparator source start');
  return source.slice(from, to);
}

// Unlike JSON's default encoding, this preserves undefined, -0 and nonfinite
// numbers. Object key order and shared-object identity are not assertions.
function canonical(value) {
  if (value === undefined) return ['undefined'];
  if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
  if (typeof value === 'bigint') return ['bigint', String(value)];
  if (typeof value === 'function') return ['function', value.name];
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return ['array', value.map(canonical)];
  if (ArrayBuffer.isView(value)) return ['view', value.constructor.name, Array.from(value, canonical)];
  if (value instanceof ArrayBuffer) return ['buffer', Buffer.from(value).toString('hex')];
  return ['object', Object.keys(value).sort().map(key => [key, canonical(value[key])])];
}

function assertionTranscript() {
  const digest = crypto.createHash('sha256');
  const methods = Object.create(null);
  let count = 0, failure;
  const wrappers = new Map();
  const traced = new Proxy(assert, {
    get(target, key) {
      const member = Reflect.get(target, key);
      if (typeof member !== 'function' || key === 'AssertionError') return member;
      if (!wrappers.has(key)) wrappers.set(key, (...args) => {
        count++; methods[key] = (methods[key] ?? 0) + 1;
        // assert.ok(edge/body) observes truthiness, not the unused native fields
        // on that object. Record exactly that predicate while still passing the
        // original arguments unchanged to the real assertion implementation.
        const observed = key === 'ok' ? [!!args[0], ...args.slice(1)] : args;
        digest.update(JSON.stringify(canonical([key, ...observed])) + '\n');
        try { return Reflect.apply(member, target, args); }
        catch (error) { failure = error; throw error; }
      });
      return wrappers.get(key);
    }
  });
  return {assert: traced, get failure() { return failure; },
    finish: () => ({assertions: count, methods: {...methods}, sha256: digest.digest('hex')})};
}

// Compile only the unchanged comparison declarations, never the full-shot test
// modules: their node:test registrations, source-loader hooks and real World
// imports therefore cannot execute. Keeping the current realm preserves strict
// deep-equality semantics for object/array prototypes.
function bindSource(source, bindings, exports, file) {
  return vm.compileFunction(source + '\nreturn {' + exports.join(',') + '};', Object.keys(bindings),
    {filename: path.join(__dirname, file)})(...Object.values(bindings));
}

function assertionModule(file, tracedAssert) {
  const filename = path.join(__dirname, file), nativeRequire = createRequire(filename);
  const module = {exports: {}};
  const localRequire = id => id === 'node:assert/strict' ? tracedAssert : nativeRequire(id);
  localRequire.resolve = nativeRequire.resolve;
  vm.compileFunction(fs.readFileSync(filename, 'utf8'),
    ['exports', 'require', 'module', '__filename', '__dirname'], {filename})(
    module.exports, localRequire, module, filename, __dirname);
  return module.exports;
}

function checkpointMap(replay, select) {
  const rows = replay.checkpoints.filter(row => row.step > 0);
  const result = new Map(rows.map(row => [row.step, select(row)]));
  assert.equal(result.size, rows.length, 'No duplicate expected checkpoint is silently discarded');
  return result;
}

function assertUnchangedRoots(original, projected) {
  assert.deepEqual(projected.frames, original.frames, 'Every captured reference frame remains unchanged');
  assert.deepEqual(projected.events, original.events, 'Every captured application event remains unchanged');
  assert.deepEqual(projected.checkpoints.map(row => row.step), original.checkpoints.map(row => row.step),
    'Every original checkpoint remains in order, including the non-comparison initial boundary');
  for (const key of ['status', 'score', 'firstRestOuter'])
    assert.deepEqual(projected[key], original[key], 'Unchanged full-shot result: ' + key);
}

function finishEquivalence(kind, source, a, b, originalStats, projectedStats, additional) {
  assert.deepEqual(projectedStats, originalStats, kind + ': identical comparator statistics');
  const original = a.finish(), projected = b.finish();
  assert.ok(original.assertions > 0, kind + ': original assertions actually executed');
  assert.deepEqual(projected, original,
    kind + ': exact assertion transcript, counts, methods and order survive projection');
  return {kind, comparisonSourceSha256: hash(source), original, projected,
    assertions: original.assertions, originalAssertionSha256: original.sha256,
    projectedAssertionSha256: projected.sha256,
    stats: originalStats, capturedValuesOnly: true, physicsSteps: 0, ...additional};
}

function fourBindings(replay, seed, transcript, source) {
  return bindSource(source, {assert: transcript.assert,
    Graph: assertionModule('four-ball-broad-graph-seed.cjs', transcript.assert),
    seed, checkpoints: checkpointMap(replay, row => row.row)},
  ['cache', 'checkpoint', 'frame'], 'experimental-four-ball-full-shot.cjs');
}

function capturedFourCheckpoint(row, seed, cache, Graph) {
  const graph = Graph.graphView(row);
  const contact = (a, b) => cache(row.contactPairs.find(pair => same(pair.collider1, a) && same(pair.collider2, b)));
  const balls = seed.balls.map(ball => {
    const state = contact(seed.pairSeed.floorCollider, ball.collider);
    const proxy = row.proxies.find(p => p.index === ball.collider.index);
    assert.ok(proxy, 'Captured primary ball proxy exists');
    state.topology = Object.fromEntries(['pairPresent', 'pointPresent', 'active', 'recycleValid']
      .map(key => [key, !!state[key]]));
    Object.assign(state.topology, {ballMin: proxy.min, ballMax: proxy.max});
    return {state};
  });
  return {scene: {manager: row.state.islands, modifiedBodies: row.queues.modifiedBodies, bodies: row.bodies},
    globalEdges: graph.edges, contactGraph: {adjacency: graph.adjacency,
      liveColliders: row.colliders.map(c => c.handle)}, balls,
    cushions: seed.balls.map((ball, i) => seed.cushionSeeds[i].cushions
      .map(rail => contact(rail.colliderHandle, ball.collider))),
    pairs: seed.pairSeeds.map(binding => ({key: binding.key,
      pair: contact(...binding.ballIndices.map(i => seed.balls[i].pairCollider))}))};
}

function verifyFourBall(original, projected, seed) {
  assertUnchangedRoots(original, projected);
  const source = sourceBetween('experimental-four-ball-full-shot.cjs', 'const same=', '\nasync function run');
  const a = assertionTranscript(), b = assertionTranscript();
  const native = fourBindings(original, seed, a, source), compact = fourBindings(projected, seed, b, source);
  const originalCheckpoints = checkpointMap(original, row => row.row);
  const Graph = require('./four-ball-broad-graph-seed.cjs');
  const builder = bindSource(source, {assert, Graph, seed, checkpoints: new Map()},
    ['cache'], 'experimental-four-ball-full-shot.cjs');
  const liveByPresence = new Map(original.checkpoints.map(({row}) =>
    [row.colliders.length === 27, row.colliders.map(c => c.handle)]));
  const statsA = {maxAbsolute: 0, hCompared: 0, checkpoints: 0};
  const statsB = {...statsA};
  for (let i = 0; i < original.frames.length; i++) {
    const want = original.frames[i];
    const row = want.outerSubstep === 0 && originalCheckpoints.get(want.outerStep);
    const out = row ? capturedFourCheckpoint(row, seed, builder.cache, Graph) : {
      balls: seed.balls.map(() => ({state: {}})), contactGraph: {liveColliders: liveByPresence.get(want.cuePresent)}};
    Object.assign(out, {frame: want.hCount, time: want.time, lastStep: {h: want.h},
      outerStep: want.outerStep, outerSubstep: want.outerSubstep,
      cue: {present: want.cuePresent, cue: want.cue},
      contactEvents: want.events.filter(event => event.kind === 'contact'), game: want.game});
    out.contactGraph.sequence = out.frame;
    out.balls.forEach((ball, index) => Object.assign(ball.state, want.balls[index]));
    // The same candidate object, created exclusively from the original capture,
    // is deliberately passed to both unchanged comparison functions.
    native.frame(out, want, statsA);
    compact.frame(out, projected.frames[i], statsB);
  }
  assert.equal(statsA.hCompared, original.frames.length, 'Every captured h frame compared');
  assert.equal(statsA.checkpoints, originalCheckpoints.size, 'Every positive original checkpoint compared');
  return finishEquivalence('four-ball', source, a, b, statsA, statsB,
    {framesCompared: statsA.hCompared, checkpointsCompared: statsA.checkpoints});
}

function inspectOriginalYawCheckpoint(row, record, F, PairOracle, GraphAssert, CushionAssert) {
  // Deliberately independent of the projector, exactly matching the full-shot
  // before-hook's four original expected-value derivations.
  const d = F.decode({post: row.raw}, 'post');
  return {...row, balls: F.flatBalls({...record, post: row.raw}, 'post', d, 1 / 960),
    pair: PairOracle.pairCache(d, record.objects), expectedGraph: GraphAssert.inspect(row.raw, d),
    cushions: CushionAssert.inspect(record, d)};
}

function capturedYawFrame(frame, checkpoint, original, seed, contacts, liveByPresence) {
  const out = {frame: frame.hCount, time: frame.time, outerStep: frame.step, outerSubstep: 0,
    balls: frame.bodies.map((body, i) => ({id: body.id, state: {...checkpoint?.balls[i].state, ...body}})),
    cue: {present: frame.cuePresent}, contactEvents: contacts.slice(0, frame.contactEventCount),
    contactGraph: {sequence: frame.hCount, liveColliders: liveByPresence.get(frame.cuePresent)}};
  if (!checkpoint) return out;
  const expected = checkpoint.expectedGraph;
  out.scene = {manager: checkpoint.raw.islands, modifiedBodies: checkpoint.raw.modifiedBodies,
    bodies: Object.entries(checkpoint.raw.bodies).map(([role, body]) =>
      ({handle: original.record.roles[role], ...body}))};
  out.globalEdges = expected.edges;
  Object.assign(out.contactGraph, {adjacency: expected.adjacency, liveColliders: expected.liveColliders,
    proxies: seed.balls.map(ball => {
      const proxy = expected.proxies.find(p => same(p.collider, ball.collider));
      assert.ok(proxy, 'Captured yaw primary ball proxy exists');
      return {min: proxy.min, max: proxy.max};
    })});
  const known = [...seed.staticProxies.map(p => p.colliderHandle),
    ...seed.balls.flatMap(ball => [ball.collider, ball.pairCollider])];
  out.contactGraph.cueProxies = expected.proxies.filter(p => !known.some(handle => same(handle, p.collider)));
  out.cushions = checkpoint.cushions;
  out.pair = checkpoint.pair;
  if (out.cue.present) out.cue.cue = {joints: checkpoint.raw.jointState.joint_graph.graph.edges
    .map(({weight}) => ({impulses: weight.impulses, limitImpulses: weight.data.limits.map(limit => limit.impulse)}))};
  return out;
}

async function verifyYaw(original, projected, seed) {
  assertUnchangedRoots(original, projected);
  assert.deepEqual(projected.record, original.record,
    'The entire original yaw record is retained unchanged for original-only seed export');
  const source = sourceBetween('experimental-three-ball-yaw-full-shot.cjs', 'function close(',
    "\ntest('yaw15 CPU");
  const Yaw = require('./three-ball-yaw-fixture.cjs'), F = Yaw.F;
  const PairOracle = require('./three-ball-pair-oracle.cjs');
  const GraphAssert = require('./three-ball-contact-assertions.cjs');
  const CushionAssert = require('./three-ball-cushion-assertions.cjs');
  const originalCheckpoints = checkpointMap(original, row =>
    inspectOriginalYawCheckpoint(row, original.record, F, PairOracle, GraphAssert, CushionAssert));
  const compactCheckpoints = checkpointMap(projected, row => row);
  const liveByPresence = new Map([...originalCheckpoints.values()].map(row =>
    [row.expectedGraph.liveColliders.length === 25, row.expectedGraph.liveColliders]));
  const contacts = original.events.filter(event => event.kind === 'contact');
  const horizonSource = fs.readFileSync(path.join(__dirname, 'three-ball-yaw-full-shot-oracle.cjs'), 'utf8');
  const horizonDeclaration = horizonSource.match(/^const HORIZON = \d+;$/m);
  assert.ok(horizonDeclaration, 'Read the original fixed horizon rather than shorten it');
  const {HORIZON} = bindSource(horizonDeclaration[0], {}, ['HORIZON'], 'three-ball-yaw-full-shot-oracle.cjs');
  assert.equal(original.frames.length, HORIZON);
  require('../src/game-rules');

  // The two original run() invocations advance in lockstep through these shared
  // captured objects. The cache releases a frame after both readers receive it;
  // no candidate outputs for a whole shot are retained in memory.
  const pending = new Map();
  let createdFrames = 0, disposed = 0;
  const World = {async createReferenceStepper(providedSeed) {
    assert.strictEqual(providedSeed, seed, 'Both readers receive the identical original-only seed object');
    let cursor = 0, current = {frame: 0, outerStep: 0, outerSubstep: 0};
    return {snapshot: () => current, step() {
      assert.ok(cursor < original.frames.length, 'Captured-values reader cannot invent a frame');
      let slot = pending.get(cursor);
      if (!slot) {
        const frame = original.frames[cursor];
        slot = {readers: 0, out: capturedYawFrame(frame, originalCheckpoints.get(frame.step),
          original, seed, contacts, liveByPresence)};
        pending.set(cursor, slot); createdFrames++;
      }
      current = slot.out;
      if (++slot.readers === 2) pending.delete(cursor);
      cursor++;
      return current;
    }, dispose() { disposed++; }};
  }};
  const a = assertionTranscript(), b = assertionTranscript();
  function runner(replay, checkpoints, transcript) {
    const noWrites = {writeFileSync(file, bytes) {
      if (transcript.failure) throw transcript.failure;
      let reason = 'Unexpected failure in captured-values comparison';
      try { reason = v8.deserialize(bytes).boundary.error; } catch {}
      throw Error(reason + ' (no failure artifact was written)');
    }};
    return bindSource(source, {assert: transcript.assert, F,
      GraphAssert: assertionModule('three-ball-contact-assertions.cjs', transcript.assert),
      seed, replay, checkpoints, World, Full: {HORIZON}, ThreeBallGame: globalThis.ThreeBallGame,
      fs: noWrites, v8, hash, process, console: {log() {}}},
    ['run'], 'experimental-three-ball-yaw-full-shot.cjs').run();
  }
  const [statsA, statsB] = await Promise.all([
    runner(original, originalCheckpoints, a), runner(projected, compactCheckpoints, b)]);
  assert.equal(statsA.status, 'rest-complete', 'Original captured-values comparisons all pass');
  assert.equal(statsB.status, 'rest-complete', 'Projected captured-values comparisons all pass');
  assert.equal(statsA.outerCompared, original.frames.length, 'Every captured outer frame compared');
  assert.equal(statsA.checkpoints, originalCheckpoints.size, 'Every positive yaw checkpoint compared');
  assert.equal(statsA.eventsCompared, contacts.length, 'Every application contact compared');
  assert.equal(createdFrames, original.frames.length, 'One shared captured candidate per frame');
  assert.equal(pending.size, 0, 'Both original comparators read every shared captured candidate');
  assert.equal(disposed, 2, 'Both captured readers disposed');
  return finishEquivalence('yaw15', source, a, b, statsA, statsB,
    {framesCompared: statsA.outerCompared, checkpointsCompared: statsA.checkpoints,
      eventsCompared: statsA.eventsCompared, originalRunSourceExecuted: true});
}

module.exports = {verifyFourBall, verifyYaw};
