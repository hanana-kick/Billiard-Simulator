'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Ref = require('./full-shot-reference-fixture.cjs');

test('full-shot assertion/runner/test suffixes remain byte-identical to 3617c65', () => {
  // Includes all numeric tolerances, cache/event checks, injected rollback checks,
  // observer checks, terminal checks, and CPU/GPU test bodies, not just assertions.
  for (const [file, start, sha256] of [
    ['experimental-four-ball-full-shot.cjs', 'const same=', '2b4de4df115d710804c4a8e44ad745dd7b2703df825cc07035245a88ac81fbb2'],
    ['experimental-three-ball-yaw-full-shot.cjs', 'function close(', 'f0e056ab0434f2e86de1f91b63118d947c244457c70be92cf67f9997ef36fcda']
  ]) {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(text.includes(start)); assert.equal(Ref.hash(text.slice(text.indexOf(start))), sha256, file);
  }
});

test('streamed original hash preserves every byte with bounded read buffers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'full-shot-reference-hash-'));
  try {
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 17); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const file = path.join(dir, 'original.v8'); fs.writeFileSync(file, bytes);
    assert.deepEqual(Ref.hashFile(file), {bytes: bytes.length, sha256: Ref.hash(bytes)});
    bytes[1024 * 1024 + 1] ^= 1; fs.writeFileSync(file, bytes);
    assert.equal(Ref.hashFile(file).sha256, Ref.hash(bytes));
  } finally { fs.rmSync(dir, {recursive: true}); }
});

test('checkpoint projection keeps complete directional graph, activation, and cache leaves', () => {
  const handle = index => ({index, generation: 0});
  const pair = {collider1: handle(0), collider2: handle(1), ignoredPair: 'not used', contacts: {variant: 'Rigid', value: {
    solver_color: 7, ignoredRigid: 'not used', recycle_state: {pos12: {translation: [1, 2, 3], rotation: [0, 0, 0, 1]}, max_extent: 4, max_drift: 5},
    manifolds: [{local_n2: [0, 1, 0], ignoredManifold: 'not used', points: [{local_p1: [1, 0, 0], local_p2: [2, 0, 0], dist: -1,
      data: {solver_dp1: [1, 2, 3], solver_dp2: [4, 5, 6], impulse: 1, warmstart_impulse: 2, tangent_impulse: [3, 4], warmstart_tangent_impulse: [5, 6], warmstart_tangent_world: [7, 8, 9]}}],
      data: {normal: [0, 1, 0], solver_contacts: [{anchor1: [1, 2, 3], anchor2: [4, 5, 6], contact_id: [7]}]}}]
  }}};
  const activation = {normalized_linear_threshold: 1, angular_threshold: 2, time_until_sleep: 3, time_since_can_sleep: 4,
    sleeping: false, sleep_prev_pose: {translation: [1, 2, 3], rotation: [0, 0, 0, 1]}};
  const row = {typedState: {massive: 'unused'}, snapshot: Buffer.from('unused'), application: {unused: true},
    state: {islands: {active_dynamic_set: [handle(1)], awake_island: 0}, hugeUnused: true, narrow_phase: {contact_graph: {graph: {
      nodes: [{weight: handle(0), next: [0, 4294967295]}, {weight: handle(1), next: [4294967295, 0]}],
      edges: [{next: [4294967295, 4294967295], weight: pair}]
    }}}}, queues: {modifiedBodies: [handle(1)], modifiedColliders: ['unused']},
    bodies: [{handle: handle(1), ids: {active_set_id: 1}, changes: 2, body_type: 'Dynamic', activation, unused: 'unused'},
      {handle: handle(0), ids: {active_set_id: 0}, changes: 0, body_type: 'Fixed', activation: {unused: true}}],
    colliders: [0, 1].map(i => ({handle: handle(i), parent: {handle: handle(i)}, unused: true})),
    proxies: [{index: 1, min: [0, 0, 0], max: [1, 1, 1]}], contactPairs: [pair]};
  const projected = Ref.fourBallRow(row);
  assert.deepEqual(projected.bodies[0].activation, activation);
  assert.equal('activation' in projected.bodies[1], false);
  for (const key of ['typedState', 'snapshot', 'application']) assert.equal(key in projected, false);
  assert.equal('hugeUnused' in projected.state, false);
  assert.equal('ignoredPair' in projected.contactPairs[0], false);
  assert.equal('ignoredRigid' in projected.contactPairs[0].contacts.value, false);
  const Graph = require('./four-ball-broad-graph-seed.cjs');
  assert.deepEqual(Graph.graphView(projected), Graph.graphView(row));
  assert.deepEqual(projected.contactPairs[0].contacts.value.manifolds[0].points, pair.contacts.value.manifolds[0].points);
});
