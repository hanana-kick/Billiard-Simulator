'use strict';
// Independent proof, not the adapter's projection repeated. Every retained
// native value is checked directly, then the UNCHANGED replay assertions run
// twice against captured values. No world import, native restore, or stepping.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const copy = value => structuredClone(value);
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => fs.readFileSync(require.resolve('./' + name), 'utf8');
function canonical(value) {
  if (value === undefined) return ['undefined'];
  if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
  if (typeof value === 'bigint') return ['bigint', String(value)];
  if (value === null || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value)) return [value.constructor.name, Array.from(value, canonical)];
  if (Array.isArray(value)) return ['array', value.map(canonical)];
  return ['object', Object.keys(value).sort().map(key => [key, canonical(value[key])])];
}
function transcript() {
  const digest = crypto.createHash('sha256'), methods = {}, wrapped = new Map();
  let assertions = 0;
  return {assert: new Proxy(assert, {get(target, key) {
    const fn = target[key];
    if (typeof fn !== 'function' || key === 'AssertionError') return fn;
    if (!wrapped.has(key)) wrapped.set(key, (...args) => {
      assertions++; methods[key] = (methods[key] ?? 0) + 1;
      const observed = key === 'ok' ? [!!args[0], ...args.slice(1)] : args;
      digest.update(JSON.stringify(canonical([key, ...observed])) + '\n');
      return Reflect.apply(fn, target, args);
    });
    return wrapped.get(key);
  }}), finish: () => ({assertions, methods, sha256: digest.digest('hex')})};
}
function sources() {
  const replay = read('elevated-flight-world-replay.cjs');
  const graph = name => {const text = read(name); return text.slice(text.indexOf('function graphView('), text.indexOf('\nfunction exportInitialSeeds'));};
  return {
    constantsAndClose: replay.slice(replay.indexOf('const CHECKPOINTS='), replay.indexOf('\nfunction sourceHashes')),
    comparisons: replay.slice(replay.indexOf('function sourceSolverRoster('), replay.indexOf('\nfunction horizon')),
    native: read('four-ball-active-ccd-native-compare.cjs'),
    graph: graph('goal-four-broad-graph-seed.cjs'),
    nativeGraph: graph('four-ball-broad-graph-seed.cjs')
  };
}
function bind(observedAssert) {
  const source = sources();
  const graph = text => ({graphView: vm.compileFunction(text + '\nreturn graphView;',
    ['assert', 'copy', 'same', 'U'])(observedAssert, copy, same, 0xffffffff)});
  const Graph = graph(source.graph), nativeGraph = graph(source.nativeGraph), module = {exports: {}};
  const localRequire = name => {
    if (name === 'node:assert/strict') return observedAssert;
    if (name === './four-ball-broad-graph-seed.cjs') return nativeGraph;
    throw Error('Unexpected assertion-only dependency: ' + name);
  };
  vm.compileFunction(source.native, ['require', 'module'])(localRequire, module);
  return vm.compileFunction(source.constantsAndClose + '\n' + source.comparisons +
    '\nreturn {sourceSolverRoster, compareRoster, checkpoint, compareFrame};',
  ['assert', 'Graph', 'Native', 'copy', 'same', 'CueClothNative'])(observedAssert, Graph, module.exports, copy, same, require('./cue-cloth-cache-native-compare.cjs').bind(observedAssert));
}
function verifyRetained(original, compact) {
  const keys = value => Object.keys(value).sort();
  assert.deepEqual(keys(compact), keys(original), 'No original root metadata omitted');
  for (const key of keys(original).filter(key => !['record', 'rows'].includes(key)))
    assert.deepEqual(compact[key], original[key], 'Exact original root field ' + key);
  assert.deepEqual(keys(compact.record), keys(original.record), 'All original record fields retained');
  for (const key of keys(original.record).filter(key => !['boundaries', 'checkpoints'].includes(key)))
    assert.deepEqual(compact.record[key], original.record[key], 'Exact original record field ' + key);
  const retainedRow = (a, b, label) => {
    assert.equal(a.candidateInput, false, label + ' remains expected-only');
    const expectedKeys = keys(b).filter(key => !['snapshot', 'typedState'].includes(key));
    assert.deepEqual(keys(a), expectedKeys, label + ' drops only duplicated binary and typed storage');
    for (const key of expectedKeys) assert.deepEqual(a[key], b[key], label + '.' + key);
  };
  assert.deepEqual(keys(compact.record.boundaries), keys(original.record.boundaries));
  for (const [name, originalRow] of Object.entries(original.record.boundaries)) {
    const value = compact.record.boundaries[name];
    if (['goalStrikeCreated', 'physicalRest'].includes(name))
      assert.deepEqual(value, originalRow, 'Complete exact native boundary ' + name);
    else retainedRow(value, originalRow, 'boundary.' + name);
  }
  assert.equal(compact.record.boundaries.goalStrikeCreated.candidateInput, true);
  assert.equal(compact.record.checkpoints.length, original.record.checkpoints.length);
  original.record.checkpoints.forEach((checkpoint, i) => {
    const actual = compact.record.checkpoints[i];
    assert.deepEqual(keys(actual), keys(checkpoint));
    for (const key of keys(checkpoint).filter(key => key !== 'row'))
      assert.deepEqual(actual[key], checkpoint[key], 'Checkpoint metadata ' + i + '.' + key);
    retainedRow(actual.row, checkpoint.row, 'record.checkpoints[' + i + ']');
  });
  assert.equal(compact.rows.length, original.rows.length);
  original.rows.forEach((row, i) => retainedRow(compact.rows[i], row, 'rows[' + i + ']'));
  return {rows: original.rows.length, checkpoints: original.record.checkpoints.length,
    boundaries: Object.keys(original.record.boundaries),
    fullBoundarySnapshotSha256: Object.fromEntries(['goalStrikeCreated', 'physicalRest'].map(name =>
      [name, hash(original.record.boundaries[name].snapshot)])),
    droppedFieldsOnly: ['snapshot', 'typedState'], allOtherValuesExact: true};
}
function frameOutput(frame, record, seed) {
  return {frame: frame.hCount, time: frame.time, lastStep: {h: frame.h},
    outerStep: frame.outerStep, outerSubstep: frame.outerSubstep,
    sourceApplicationSteps: seed.sourceApplicationSteps + frame.outerStep,
    cue: {present: frame.cuePresent, cue: copy(frame.cue)},
    balls: frame.balls.map(ball => ({id: ball.id, state: copy(ball)})),
    contactEvents: copy(frame.events.filter(event => event.kind === 'contact' || event.kind === 'cue-obstruction')),
    game: copy(frame.hCount === record.frames.length ? record.boundaries.controllerFinished.application.game : frame.game)};
}
function captured(row, frame, record, seed, builder) {
  const Native = require('./four-ball-active-ccd-native-compare.cjs');
  const Graph = require('./four-ball-broad-graph-seed.cjs');
  const contact = (a, b, dynamic = false) => copy(Native.cache(row.contactPairs.find(pair =>
    same(pair.collider1, a) && same(pair.collider2, b)), dynamic));
  const graph = Graph.graphView(row), out = frameOutput(frame, record, seed);
  out.scene = {manager: copy(row.state.islands), modifiedBodies: copy(row.queues.modifiedBodies), bodies: copy(row.bodies)};
  out.globalEdges = graph.edges;
  const primaryProxies = seed.balls.map(ball => row.proxies.find(proxy => proxy.index === ball.collider.index));
  const fixedIndices = seed.cueBroadSeed.colliders.filter(c => c.bodyType === 'Fixed').map(c => c.handle.index);
  const ballIndices = seed.balls.flatMap(ball => [ball.collider.index, ball.pairCollider.index]);
  out.contactGraph = {adjacency: graph.adjacency, liveColliders: row.colliders.map(collider => copy(collider.handle)),
    sequence: frame.hCount, revision: frame.hCount,
    proxies: primaryProxies.map(proxy => ({min: copy(proxy.min), max: copy(proxy.max)})),
    cueProxies: row.proxies.filter(proxy => !fixedIndices.includes(proxy.index) && !ballIndices.includes(proxy.index))
      .map(proxy => ({collider: copy(row.colliders.find(collider => collider.handle.index === proxy.index).handle),
        min: copy(proxy.min), max: copy(proxy.max)}))};
  out.balls.forEach((ball, i) => {
    const cache = contact(seed.pairSeed.floorCollider, seed.balls[i].collider), proxy = primaryProxies[i];
    const topology = {...Object.fromEntries(['pairPresent', 'pointPresent', 'active', 'recycleValid'].map(key =>
      [key, !!cache[key]])), ballMin: copy(proxy.min), ballMax: copy(proxy.max)};
    const nativePair=row.contactPairs.find(p=>same(p.collider1,seed.pairSeed.floorCollider)&&same(p.collider2,seed.balls[i].collider)),m=nativePair?.contacts.value.manifolds[0];topology.manifoldPresent=!!m;ball.state = {...cache, ...ball.state, topology,...(m?{normal:copy(m.data.normal),localN1:copy(m.local_n1),localN2:copy(m.local_n2)}:{})};
  });
  out.cushions = seed.balls.map((ball, i) => seed.cushionSeeds[i].cushions.map(rail => contact(rail.colliderHandle, ball.collider)));
  out.pairs = seed.pairSeeds.map(binding => ({key: binding.key,
    pair: contact(...binding.ballIndices.map(i => seed.balls[i].pairCollider), true)}));
  out.cueCloth = require('./cue-cloth-cache-native-compare.cjs').project(row,seed);
  out.solverContactRoster = {...builder.sourceSolverRoster(row), initialSnapshotSha256: seed.initialSnapshotSha256,
    sequence: out.contactGraph.sequence, revision: out.contactGraph.revision};
  return out;
}
function comparisonRows(original) {
  const record = original.record;
  const rows = original.rows.filter(row => row.boundary.endsWith('-postApplication'));
  return [...rows, {...record.boundaries['firstH.postApplication'], hCount: 1, boundary: 'expected-only-h1-postApplication'},
    {...record.boundaries.physicalRest, hCount: record.frames.length,
      boundary: 'expected-only-h' + record.frames.length + '-postApplication', candidateInput: false}];
}
function verifyComparisons(original, compact, seed) {
  const a = transcript(), b = transcript(), native = bind(a.assert), projected = bind(b.assert), builder = bind(assert);
  const statsA = {maxAbsolute: 0, framesCompared: 0, checkpoints: []};
  const statsB = {maxAbsolute: 0, framesCompared: 0, checkpoints: []};
  const record = original.record;
  for (let i = 0; i < record.frames.length; i++) {
    const frame = record.frames[i], out = frameOutput(frame, record, seed);
    native.compareFrame(out, frame, seed, record, statsA);
    projected.compareFrame(out, compact.record.frames[i], seed, compact.record, statsB);
  }
  const nativeRows = comparisonRows(original), smallRows = comparisonRows(compact);
  assert.equal(smallRows.length, nativeRows.length);
  nativeRows.forEach((row, i) => {
    const storedFrame = record.frames[row.hCount - 1];
    const frame = row.hCount === record.frames.length ? {...storedFrame, game: record.boundaries.controllerFinished.application.game} : storedFrame;
    const out = captured(row, frame, record, seed, builder);
    native.checkpoint(out, row, frame, seed, out.contactGraph.sequence, statsA);
    const compactStoredFrame = compact.record.frames[row.hCount - 1];
    const compactFrame = row.hCount === compact.record.frames.length ? {...compactStoredFrame,
      game: compact.record.boundaries.controllerFinished.application.game} : compactStoredFrame;
    projected.checkpoint(out, smallRows[i], compactFrame, seed, out.contactGraph.sequence, statsB);
  });
  assert.deepEqual(statsB, statsA, 'Same comparison counts, exact/tolerance counts, cache counts and maximum errors');
  assert.equal(statsA.framesCompared, record.frames.length, 'Every captured frame compared');
  assert.equal(statsA.checkpoints.length, nativeRows.length, 'Every stored postApplication row plus h1 and physical rest compared');
  const x = a.finish(), y = b.finish();
  assert.deepEqual(y, x, 'Identical ordered unchanged assertion methods, predicates, values and tolerances');
  return {comparisonSourceHashes: Object.fromEntries(Object.entries(sources()).map(([name, value]) => [name, hash(value)])),
    original: x, projected: y, stats: statsA, frames: record.frames.length, comparedCheckpoints: nativeRows.length,
    capturedValuesOnly: true, physicsSteps: 0};
}
function verify(original, compact) {
  const retained = verifyRetained(original, compact), E = require('./goal-four-world-seed.cjs');
  const seed = value => E.exportInitialSeed({goalStrikeCreated: value.record.boundaries.goalStrikeCreated,
    strikeCreationJournal: value.record.strikeCreationJournal}, E.placementProvenanceFromRecord(value.record));
  const initial = seed(original);
  assert.deepEqual(seed(compact), initial, 'Independent complete initial seed and move provenance unchanged');
  return {...verifyComparisons(original, compact, initial), retained, initialSeedExact: true};
}
module.exports = {canonical, sources, bind, verifyRetained, frameOutput, captured, comparisonRows, verifyComparisons, verify};
