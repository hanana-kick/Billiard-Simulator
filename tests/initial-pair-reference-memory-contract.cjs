'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const v8 = require('node:v8');
const Ref = require('./initial-pair-reference-memory.cjs');
const Proof = require('./initial-pair-reference-equivalence.cjs');
const COMPARISON_HASHES = Object.freeze({
  constantsAndClose: 'e0cb8cc38a50e7e95f37b1e3eaa2e2e9f31adb9522f60a8cf09f1b30ded2bad2',
  comparisons: '4a2a165b3c921f083488a37f1d5027dae9e70a1fb1d63a1e233dcfad46cbe4ea',
  native: '0dae4e1eda882b3d5fdc51a0ab0af81a1f367223f030ce8e42550bb9a70a1dff',
  graph: '1f780df6a17b1b4d3d7b821ea2e31f9a24880cd7835d654afa40facd3b8a785d',
  nativeGraph: 'a7afe9027b805c9a58536df657d62cbbd8b191af4fa7b0cf3a7fb882723d7b5a'
});
function fixture() {
  // Small hand-built test data exercises storage and assertions, not physics.
  const h = index => ({index, generation: 3}), U = 0xffffffff;
  const fixed = [1, 2, 3, 4, 5].map(index => ({handle: h(index), parent: {handle: h(1000 + index)}}));
  const balls = Array.from({length: 4}, (_, i) => ({collider: h(10 + i * 2), pairCollider: h(11 + i * 2)}));
  const colliders = [...fixed, ...balls.flatMap((ball, i) => [ball.collider, ball.pairCollider].map(handle =>
    ({handle, parent: {handle: h(100 + i)}, unconsumedNativeField: {keep: -0}})))];
  const pair = (a, b) => ({collider1: a, collider2: b, contacts: {variant: 'Rigid', value: {
    solver_color: 7, solver_color_bodies: [h(100), h(101)],
    recycle_state: {pos12: {translation: [-0, 0, 0], rotation: [0, 0, 0, 1]},
      rot1: [0, 0, 0, 1], rot2: [0, 0, 0, 1], max_extent: 0.03, max_drift: 0.001},
    manifolds: [{local_n1: [-0, 1, 0], local_n2: [0, -1, 0],
      data: {normal: [0, 1, 0], solver_flags: 1, solver_color: 7, solver_body_ids: [2, 3], graph_pos: 9,
        solver_contacts: [{anchor1: [-0, 0, 0], anchor2: [0, 0, 0], contact_id: [0]}]},
      points: [{local_p1: [-0, 0, 0], local_p2: [0, 0, 0], fid1: 33, fid2: 44, dist: -0,
        data: {solver_dp1: [-0, 0, 0], solver_dp2: [0, 0, 0], impulse: 0.25, warmstart_impulse: 0.2,
          tangent_impulse: [-0, 0], warmstart_tangent_impulse: [-0, 0], warmstart_tangent_world: [0, -0, 0]}}]}]
  }}});
  const pairs = [...balls.map(ball => pair(h(1), ball.collider)), pair(balls[0].pairCollider, balls[2].pairCollider)];
  const graph = {nodes: colliders.map(collider => ({weight: collider.handle, next: [U, U]})), edges: []};
  for (const weight of pairs) {
    const i = graph.edges.length;
    const edge = {weight, node: [weight.collider1, weight.collider2].map(handle =>
      colliders.findIndex(collider => collider.handle.index === handle.index)), prev: [U, U], next: [U, U]};
    edge.node.forEach((node, side) => {edge.next[side] = graph.nodes[node].next[side];
      if (edge.next[side] !== U) graph.edges[edge.next[side]].prev[side] = i;
      graph.nodes[node].next[side] = i;});
    graph.edges.push(edge);
  }
  const bodies = balls.map((_, i) => ({handle: h(100 + i), ids: {active_set_id: i}, changes: 2,
    body_type: 'Dynamic', activation: {normalized_linear_threshold: 0.01, angular_threshold: 0.02,
      time_until_sleep: 2, time_since_can_sleep: -0, sleeping: false,
      sleep_prev_pose: {translation: [-0, 0, 0], rotation: [0, 0, 0, 1]}},
    unconsumedNativeField: {preserved: true}}));
  const proxies = colliders.map(collider => ({index: collider.handle.index, min: [-1, -1, -1], max: [1, 1, 1]}));
  const snapshot = new Uint8Array(1024 * 1024).subarray(100, 104);
  snapshot.set([1, 2, 3, 4]);
  const game = {pending: null, score: 0};
  const row = {boundary: 'expected-only-h1-postApplication', candidateInput: false, hCount: 1,
    snapshot, snapshotSha256: Ref.hash(snapshot), typedState: {unused: 'exact typed native tree'},
    application: {game}, queues: {modifiedBodies: bodies.map(body => body.handle), modifiedColliders: []},
    state: {islands: {awake_island: 0, islands: {v: [{bodies: bodies.map(body => body.handle)}]}, active_set_epoch: 5},
      narrow_phase: {contact_graph: {graph}, pair_solver_hints: pairs.map((_, i) => i),
        body_solver_color_masks: ['170141183460469231731687303715884105728', 0, '3', 1],
        solver_contact_graph: {buckets: Array.from({length: 130}, (_, i) => i === 7 ? [0, 1, 2, 3, 4] : [])},
        solver_graph_valid: true, solver_graph_epoch: 12, solver_graph_mb_epoch: 13},
      multibody_joints: {topology_epoch: 14}, broad_phase: {tree: {largeUnconsumedPlainState: [-0, 7]}}},
    bodies, colliders, proxies, contactPairs: pairs};
  const frame = {hCount: 1, time: 2, h: 0.01, outerStep: 1, outerSubstep: 0, cuePresent: false, cue: null,
    balls: balls.map((_, i) => ({id: i + 1, translation: [-0, i, 0], rotation: [0, 0, 0, 1],
      linear: [0, 0, 0], angular: [-0, 0, 0], invInertia: [1, 0, 0, 0, 1, 0, 0, 0, 1], sleeping: false})),
    events: [{kind: 'contact', key: '1:3', label: null, time: 2, a: 1, b: 3, position: {x: -0, y: 0, z: 0}}], game};
  const original = {schema: 'unit-only-not-an-oracle', identity: {test: true}, manifest: {sha256: 'unit'},
    record: {frames: [frame], events: frame.events, score: {delta: 0}, apiJournal: [{exact: -0}],
      strikeCreationJournal: [{exact: 1n}], boundaries: {
        goalStrikeCreated: {...row, boundary: 'goalStrikeCreated', candidateInput: true},
        'firstH.postApplication': {...row, boundary: 'firstH.postApplication'},
        physicalRest: {...row, boundary: 'physicalRest'}, controllerFinished: {...row, boundary: 'controllerFinished'}},
      checkpoints: [{step: 1, reasons: ['unit'], row: {boundary: 'raw-grid', candidateInput: false, snapshot, application: {game}}}]},
    rows: [row], assertions: [{completeOriginalAssertionProjection: row.state}], applicationImpulseJournal: [{value: -0}]};
  const leaf = collider => ({data: 1, children: collider.handle.index, mins: [-1, -1, -1], maxs: [1, 1, 1]});
  const seed = {balls, sourceApplicationSteps: 10, initialSnapshotSha256: 'unit-snapshot-only',
    pairSeed: {floorCollider: h(1)}, cushionSeeds: balls.map(() => ({cushions: fixed.slice(1).map(c => ({colliderHandle: c.handle}))})),
    pairSeeds: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]].map(ballIndices => ({key: ballIndices.join(''), ballIndices})),
    cueBroadSeed: {colliders: fixed.map(c => ({...c, bodyType: 'Fixed'})), initialBroadPhase: {tree: {nodes:
      fixed.map(c => ({left: leaf(c), right: {data: 0, children: U}}))}}}};
  return {original, seed};
}
test('all pre-existing replay predicates, tolerances, rollback and CPU/GPU runner gates remain unchanged', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(Proof.sources()).map(([name, value]) => [name, Ref.hash(value)])), COMPARISON_HASHES);
  const source = fs.readFileSync(require.resolve('./initial-pair-world-replay.cjs'), 'utf8');
  assert.equal(Ref.hash(source.slice(source.indexOf(' const initial='))),
    '96b3fa149fd933ff75733356f373a138aee099bf7f5a82f00390015d6fac0206');
});
test('compaction only removes duplicate expected snapshots/typed trees and detaches both retained native origins', () => {
  const {original} = fixture(), compact = Ref.project(original);
  const proof = Proof.verifyRetained(original, compact);
  assert.equal(proof.allOtherValuesExact, true);
  for (const name of ['goalStrikeCreated', 'physicalRest']) {
    assert.deepEqual(compact.record.boundaries[name], original.record.boundaries[name]);
    assert.equal(compact.record.boundaries[name].snapshot.buffer.byteLength, 4);
  }
  assert.equal('snapshot' in compact.rows[0], false);
  assert.equal('typedState' in compact.rows[0], false);
  assert.equal('snapshot' in compact.record.checkpoints[0].row, false);
  assert.deepEqual(compact.rows[0].state, original.rows[0].state);
  assert.deepEqual(compact.rows[0].bodies, original.rows[0].bodies);
  assert.deepEqual(compact.rows[0].contactPairs, original.rows[0].contactPairs);
  assert.ok(Object.is(compact.record.frames[0].balls[0].translation[0], -0));
  assert.equal(compact.record.strikeCreationJournal[0].exact, 1n);
  Proof.verifyRetained(original, v8.deserialize(v8.serialize(compact)));
});
test('independent unchanged comparison transcript covers full u128 roster, graph, caches, frame events and score', () => {
  const {original, seed} = fixture(), compact = Ref.project(original);
  const proof = Proof.verifyComparisons(original, compact, seed);
  assert.deepEqual(proof.original, proof.projected);
  assert.ok(proof.original.assertions > 1000);
  assert.equal(proof.frames, 1);
  assert.equal(proof.comparedCheckpoints, 3);
  assert.equal(proof.physicsSteps, 0);
  assert.deepEqual(proof.stats.checkpoints.map(c => [c.omittedUnrepresentedFields, c.fullSourceRoster]),
    [[[], true], [[], true], [[], true]]);
});
test('independent proof rejects changed retained native roster/cache/frame/scoring fields', () => {
  const changes = [
    p => {p.rows[0].state.narrow_phase.body_solver_color_masks[0] = '170141183460469231731687303715884105729';},
    p => {p.rows[0].state.narrow_phase.pair_solver_hints[0] = 99;},
    p => {p.rows[0].state.narrow_phase.solver_contact_graph.buckets[0].push(99);},
    p => {p.rows[0].state.multibody_joints.topology_epoch++;},
    p => {p.rows[0].contactPairs[0].contacts.value.manifolds[0].points[0].fid1++;},
    p => {p.record.frames[0].events[0].position.x = 0;},
    p => {p.record.score.delta++;},
    p => {p.record.boundaries.goalStrikeCreated.snapshot[0]++;}
  ];
  for (const change of changes) {const {original} = fixture(), compact = Ref.project(original); change(compact);
    assert.throws(() => Proof.verifyRetained(original, compact), assert.AssertionError);}
  const {original, seed} = fixture(), compact = Ref.project(original);
  compact.rows[0].state.narrow_phase.body_solver_color_masks[0] = '170141183460469231731687303715884105729';
  assert.throws(() => Proof.verifyComparisons(original, compact, seed), assert.AssertionError);
});
test('original identity uses complete bounded streaming reads, not a retained source buffer', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'initial-pair-hash-contract-'));
  try {const file = path.join(directory, 'bytes'), bytes = Buffer.alloc(2 * 1024 * 1024 + 7, 193);
    fs.writeFileSync(file, bytes); assert.deepEqual(Ref.hashFile(file), {sha256: Ref.hash(bytes), bytes: bytes.length});
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});
module.exports = {fixture};
