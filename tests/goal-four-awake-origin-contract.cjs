'use strict';
// SPDX-License-Identifier: Apache-2.0
// LIGHT source-readiness projection tests use normalized synthetic bodies only.
// They cannot establish byte provenance or initialize a numerical world.
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const copy = value => structuredClone(value), f = Math.fround;
const unavailable = new Proxy({}, {get(_target, name) {throw Error('Native/numerical execution forbidden: ' + String(name));}});
const original = {D: {field: unavailable}};
function loadPureInit() {
  const filename = path.join(__dirname, 'goal-four-initialization-seed.cjs'), module = {exports: {}};
  const dependencies = {'./four-ball-created-fixture.cjs': original, '../src/experimental-cue-initialization': unavailable};
  new Function('require', 'module', 'exports', fs.readFileSync(filename, 'utf8'))(name => {
    if (name.startsWith('node:')) return require(name);
    assert.ok(Object.hasOwn(dependencies, name)); return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const Init = loadPureInit();
function fixture({sleeping = [false, false, true, false]} = {}) {
  const bodies = sleeping.map((asleep, i) => ({handle: {index: 16 + i, generation: 4 + i}, body_type: 'Dynamic',
    activation: {sleeping: asleep, time_since_can_sleep: f(.125), normalized_linear_threshold: f(.4)},
    ids: {active_island_id: i, active_set_id: i, island_id: i, island_index: 0},
    vels: {linvel: [-0, 0, 0], angvel: [0, -0, 0]}}));
  const row = {boundary: 'goalStrikeCreated', candidateInput: true, hCount: 0, outerStep: 0, outerSubstep: 0,
    snapshotSha256: 'a'.repeat(64), application: {registry: {objects: bodies.map((b, i) => ({id: i + 1, body: copy(b.handle)}))}}};
  row.sourceReadiness = {kind: Init.AWAKE_SOURCE_KIND, sourceSchema: Init.AWAKE_SOURCE_SCHEMA,
    initialSnapshotSha256: row.snapshotSha256, anyMotion: false, fireAccepted: true,
    bodies: bodies.map(b => ({body: copy(b.handle), sleeping: b.activation.sleeping,
      linear: copy(b.vels.linvel), angular: copy(b.vels.angvel)}))};
  return {row, bodies};
}
function refresh(q) {
  q.row.sourceReadiness.bodies = q.bodies.map(b => ({body: copy(b.handle), sleeping: b.activation.sleeping,
    linear: copy(b.vels.linvel), angular: copy(b.vels.angvel)}));
  return q;
}
test('only explicit original awake-ready receipt admits unchanged mixed native activation and identities', () => {
  const q = fixture(), before = copy(q), out = Init.projectInitialReadiness(q.row, q.bodies);
  assert.equal(out.kind, 'verified-original-motionless-awake-created');
  assert.equal(out.sourceSchema, 'original-controller-four-ball-awake-pair-holdout-v1');
  assert.equal(out.initialSnapshotSha256, q.row.snapshotSha256); assert.equal(out.anyMotion, false); assert.equal(out.fireAccepted, true);
  assert.deepEqual(out.bodies, q.row.sourceReadiness.bodies); assert.deepEqual(out.bodies.map(b => b.sleeping), [false, false, true, false]);
  assert.ok(Object.is(out.bodies[0].linear[0], -0)); assert.deepEqual(q, before);
  out.bodies[0].linear[0] = 1; out.bodies[0].body.generation++; assert.deepEqual(q, before);
});
test('legacy all-sleep origin remains required without receipt and cannot be relabeled awake-ready', () => {
  const awake = fixture(); delete awake.row.sourceReadiness;
  assert.throws(() => Init.projectInitialReadiness(awake.row, awake.bodies));
  const asleep = fixture({sleeping: [true, true, true, true]});
  assert.throws(() => Init.projectInitialReadiness(asleep.row, asleep.bodies), /cannot relabel an all-sleep origin/);
  delete asleep.row.sourceReadiness;
  assert.equal(Init.projectInitialReadiness(asleep.row, asleep.bodies), undefined);
});
test('readiness applies exact original strict speed norms without rounding thresholds or zeroing source velocity', () => {
  const q = fixture(); q.bodies[0].vels.linvel = [f(.0019), 0, 0]; q.bodies[1].vels.angvel = [0, f(.049), 0];
  refresh(q); const before = copy(q), out = Init.projectInitialReadiness(q.row, q.bodies);
  assert.deepEqual(out.bodies, q.row.sourceReadiness.bodies); assert.deepEqual(q, before);
  for (const [field, vector] of [['linvel', [f(.002), 0, 0]], ['angvel', [0, f(.05), 0]],
    ['linvel', [f(.0015), f(.0015), 0]], ['angvel', [f(.04), f(.04), 0]]]) {
    const bad = fixture(); bad.bodies[0].vels[field] = vector; refresh(bad);
    assert.throws(() => Init.projectInitialReadiness(bad.row, bad.bodies), /unchanged original UI readiness/);
  }
  // Match source anyMotion exactly: it ignores sleeping bodies, rather than
  // inventing a numerical zero-velocity invariant for every retained cache.
  const sleeping = fixture(); sleeping.bodies[2].vels.linvel[0] = 1; refresh(sleeping);
  assert.equal(Init.projectInitialReadiness(sleeping.row, sleeping.bodies).bodies[2].linear[0], 1);
});
test('receipt kind, source schema, hash, fire acceptance, body identity and every duplicate value fail closed', () => {
  const mutations = [q => q.row.sourceReadiness.kind = 'user-ready',
    q => q.row.sourceReadiness.sourceSchema = 'original-controller-four-ball-cushion-holdout-v1',
    q => q.row.sourceReadiness.initialSnapshotSha256 = 'b'.repeat(64), q => q.row.sourceReadiness.anyMotion = true,
    q => q.row.sourceReadiness.fireAccepted = false, q => q.row.sourceReadiness.bodies[0].body.generation++,
    q => q.row.sourceReadiness.bodies[0].sleeping = true, q => q.row.sourceReadiness.bodies[0].linear[0] = 1,
    q => q.row.sourceReadiness.bodies[0].angular[0] = 1, q => q.row.sourceReadiness.bodies.reverse(),
    q => q.row.sourceReadiness.bodies.pop(), q => q.row.sourceReadiness.linearThreshold = 99,
    q => q.bodies[0].handle.generation++, q => q.bodies[0].body_type = 'Fixed',
    q => {q.bodies[0].vels.linvel[0] = NaN; refresh(q);},
    q => {q.bodies[0].vels.linvel[0] = .001; refresh(q);},
    q => q.bodies.push(copy(q.bodies[0]))];
  for (const mutate of mutations) {const q = fixture(); mutate(q); assert.throws(() => Init.projectInitialReadiness(q.row, q.bodies));}
});
test('awake-ready receipt never licenses a future or previous boundary', () => {
  for (const boundary of ['beforeStrike', 'firstH.preWorld', 'firstH.postWorld', 'physicalRest', 'secondStrikeCreated']) {
    const q = fixture(); q.row.boundary = boundary; assert.throws(() => Init.projectInitialReadiness(q.row, q.bodies));
  }
  for (const mutate of [q => q.row.candidateInput = false, q => q.row.hCount++, q => q.row.outerStep++, q => q.row.outerSubstep++]) {
    const q = fixture(); mutate(q); assert.throws(() => Init.projectInitialReadiness(q.row, q.bodies));
  }
});

const artifact = process.env.AWAKE_PAIR_ORACLE;
test('actual source UI-ready awake origin retains exact byte-verified initial state and rejects numerical overrides',
  {skip: !artifact, timeout: 120000}, () => {
    const C = require(process.env.AWAKE_PAIR_ORACLE_MODULE || './initial-pair-original-awake-fixture.cjs');
    const F = require('./four-ball-created-fixture.cjs'), E = require('./goal-four-world-seed.cjs');
    const previous = [], calls = {init: 0, step: 0, restoreSnapshot: 0};
    for (const [owner, name] of [[F.R, 'init'], [F.R.World, 'restoreSnapshot'], [F.R.World.prototype, 'step']]) {
      previous.push([owner, name, Object.getOwnPropertyDescriptor(owner, name)]);
      Object.defineProperty(owner, name, {configurable: true, writable: true, value() {calls[name]++; throw Error('Native execution forbidden: ' + name);}});
    }
    try {
      const p = C.load(artifact), record = p.record, row = record.boundaries.goalStrikeCreated;
      assert.equal(record.schema, Init.AWAKE_SOURCE_SCHEMA);
      const input = {goalStrikeCreated: row, strikeCreationJournal: record.strikeCreationJournal};
      const before = F.journalDigest(row), seed = E.exportInitialSeed(input, E.placementProvenanceFromRecord(record));
      const readiness = seed.initialReadiness, created = seed.cueInitial.sourceCreation.created;
      assert.equal(readiness.kind, Init.AWAKE_READINESS_KIND); assert.equal(readiness.initialSnapshotSha256, F.hash(row.snapshot));
      assert.deepEqual(readiness, seed.provenance.initialReadiness); assert.deepEqual(readiness, created.initialReadiness);
      assert.deepEqual(created.islands, row.state.islands);
      assert.deepEqual(created.modifiedBodies, row.state.bodies.modified_bodies[0]);
      assert.deepEqual(created.modifiedColliders, row.state.colliders.modified_colliders[0]);
      assert.deepEqual(created.jointState, row.state.impulse_joints);
      assert.ok(seed.balls.some(b => !b.state.sleeping));
      const same = (a, b) => a.index === b.index && a.generation === b.generation;
      for (const ball of seed.balls) {
        const raw = row.bodies.find(b => same(b.handle, ball.body));
        assert.equal(ball.state.sleeping, raw.activation.sleeping); assert.deepEqual(ball.state.activation, raw.activation);
        assert.deepEqual(ball.state.linear, raw.vels.linvel); assert.deepEqual(ball.state.angular, raw.vels.angvel);
        const sourceBody = Object.values(created.bodies).find(b => same(b.handle, raw.handle));
        assert.deepEqual(sourceBody, raw, 'No readiness normalization may change any raw body field, IDs or allocator state');
      }
      assert.deepEqual(seed.initialContactOrigin.contactGraph, row.state.narrow_phase.contact_graph);
      assert.deepEqual(seed.initialContactOrigin.pairSolverHints, row.state.narrow_phase.pair_solver_hints);
      assert.deepEqual(seed.initialContactOrigin.solverContactGraph, row.state.narrow_phase.solver_contact_graph);
      const malformed = [r => delete r.sourceReadiness, r => r.sourceReadiness.fireAccepted = false,
        r => r.sourceReadiness.bodies[0].sleeping = true, r => r.sourceReadiness.bodies[0].linear[0] = 99,
        r => r.sourceReadiness.initialSnapshotSha256 = 'f'.repeat(64)];
      for (const mutate of malformed) {const bad = copy(row); mutate(bad); assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: bad}));}
      for (const future of [...(p.rows || []), ...Object.values(record.boundaries).filter(r => r !== row)]) {
        assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: future}));
      }
      assert.equal(F.journalDigest(row), before); assert.deepEqual(calls, {init: 0, step: 0, restoreSnapshot: 0});
      console.log(JSON.stringify({initialSnapshotSha256: readiness.initialSnapshotSha256,
        awakeBodies: readiness.bodies.filter(b => !b.sleeping).length, anyMotion: readiness.anyMotion,
        fireAccepted: readiness.fireAccepted, sourceStateUnchanged: true, nativeCalls: calls}));
    } finally {
      for (const [owner, name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(owner, name, descriptor); else delete owner[name];
      }
    }
  });
