'use strict';
// SPDX-License-Identifier: Apache-2.0
// LIGHT protocol/projection contracts. Synthetic normalized rows below are not
// numerical world seeds and never bypass the public exporter's byte verification.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const I = require('./goal-four-initial-contact-import.cjs');
const copy = value => structuredClone(value), U = 0xffffffff;
const h = index => ({index, generation: 7});
function pair(a, b, color = 126) {
  return {collider1: h(a), collider2: h(b), event_status: 1, contacts: {variant: 'Rigid', value: {
    solver_color: color, solver_color_bodies: [b, U], solver_clusters: [], workspace: null,
    recycle_state: {pos12: {translation: [-0, 2, 3], rotation: [0, 0, 0, 1], padding: -0},
      rot1: [0, 0, 0, 1], rot2: [1, 0, 0, 0], max_extent: 2, max_drift: Math.fround(.003)},
    manifolds: [{local_n1: [-0, 1, 0], local_n2: [0, -1, -0], subshape1: 11, subshape2: 12,
      subshape_poses: null, points: [{local_p1: [-0, 2, 3], local_p2: [0, 4, -0],
        fid1: 2147483664, fid2: 3221225472, dist: Math.fround(.001), data: {
          impulse: Math.fround(.123), warmstart_impulse: -0, tangent_impulse: [1, -0],
          warmstart_tangent_impulse: [-0, 2], warmstart_twist_impulse: -0,
          warmstart_tangent_world: [3, -0, 5], solver_dp1: [-0, 7, 8], solver_dp2: [9, 10, -0]}}],
      data: {rigid_body1: h(a), rigid_body2: h(b), solver_flags: 1, solver_color: color,
        solver_body_ids: [U, 23], graph_pos: U, normal: [-0, 1, 0],
        relative_dominance: 128, user_data: 4, friction: Math.fround(.15), restitution: Math.fround(.82),
        solver_contacts: [{anchor1: [-0, 11, 12], anchor2: [13, -0, 15], dist: Math.fround(.002),
          tangent_velocity: [0, -0, 0], contact_id: [2147483648], padding: [-0]}]}}]}}};
}
function fixture() {
  const objects = [21, 23, 25, 27].map((index, ballIndex) => ({id: ballIndex + 1,
    body: h(index), collider: h(index), pairCollider: h(index + 1)}));
  const statics = Array.from({length: 16}, (_, index) => ({body: h(index), collider: h(index),
    kind: index === 0 ? 'cloth' : [4, 6, 8, 10].includes(index) ? 'cushion' : 'wood'}));
  // Deliberately shuffled dense order, two different balls/rails, and nonzero
  // generations prevent a selected-ball/rail-8/zero-generation special case.
  const pairs = [pair(6, 27), pair(0, 25, 127), pair(0, 21, 127),
    pair(10, 23), pair(0, 27, 127), pair(0, 23, 127)];
  const colliders = [...statics, ...objects, ...objects.map(o => ({body: o.body, collider: o.pairCollider}))]
    .map(o => ({handle: o.collider, parent: {handle: o.body}}));
  const row = {boundary: 'goalStrikeCreated', candidateInput: true, hCount: 0, outerStep: 0, outerSubstep: 0,
    sourceRevision: 'b716d375efc0201003f0cd9ef7168eee0b62c177', engineSha256: 'e'.repeat(64),
    snapshotSha256: 'a'.repeat(64), nativeSteps: 556,
    verification: {nativeBincodeByteIdentical: true, javascriptTypedReencodeByteIdentical: true},
    application: {steps: 484, shots: 1, time: .5, controller: {selectedId: 1},
      cue: {selectedId: 1, started: .5, contacted: false, contacts: []}, registry: {objects, statics}},
    colliders, contactPairs: pairs, state: {islands: {active_set_epoch: 17},
      multibody_joints: {topology_epoch: 4}, narrow_phase: {contact_graph: {graph: {
        nodes: [{weight: h(27), next: [U, 0]}], edges: pairs.map((weight, index) => ({
          weight, next: [index === 5 ? U : index + 1, U]}))}},
        pair_solver_hints: [0x8000, 0x8000, 0x8000, 0x8001, 0x8000, 0x8000],
        solver_contact_graph: {buckets: Array.from({length: 130}, () => [])},
        body_solver_color_masks: [1n << 127n, 1n << 126n], solver_graph_valid: false,
        solver_graph_epoch: 15, solver_graph_mb_epoch: 4}}};
  return row;
}
test('retained source point, manifold, warm cache, recycle and count-cleared hint are copied exactly', () => {
  const p = pair(6, 27), before = copy(p), out = I.projectCache(p, 0x8000);
  assert.deepEqual(p, before); assert.deepEqual(out.sourcePair, p);
  assert.equal(out.active, 1); assert.equal(out.pairSolverHint, 0x8000);
  assert.equal(out.graphPos, U); assert.equal(out.solverColor, 126);
  assert.deepEqual(out.solverBodyIds, [U, 23]); assert.equal(out.manifoldSolverColor, 126);
  assert.equal(out.contactId, 2147483648); assert.equal(out.eventStatus, 1);
  assert.deepEqual(out.warmWorld, [3, -0, 5]); assert.ok(Object.is(out.warmImpulse, -0));
  assert.ok(Object.is(out.warmTwist, -0)); assert.ok(Object.is(out.recycleTranslation[0], -0));
  assert.deepEqual(out.recycleRotation2, [1, 0, 0, 0]);
  assert.deepEqual(out.solverContactPadding, [-0]);
  out.sourcePair.contacts.value.manifolds[0].points[0].data.impulse = 99;
  out.warmWorld[0] = 99; assert.deepEqual(p, before, 'No aliases mutate the original snapshot');
});
test('manifold metadata survives a zero-point/inactive retained manifold without fabricated solver fields', () => {
  const p = pair(6, 27), m = p.contacts.value.manifolds[0]; m.points = []; m.data.solver_contacts = [];
  const out = I.projectCache(p, 0x8000);
  assert.equal(out.pairPresent, 1); assert.equal(out.pointPresent, 0); assert.equal(out.active, 0);
  assert.deepEqual(out.localN1, [-0, 1, 0]); assert.equal(out.graphPos, U);
  assert.deepEqual(out.sourcePair, p); assert.equal(Object.hasOwn(out, 'warmImpulse'), false);
  assert.equal(Object.hasOwn(out, 'anchor1'), false); assert.equal(Object.hasOwn(out, 'contactId'), false);
});
test('empty and absent retained caches remain distinct and no warm state is invented', () => {
  const p = pair(6, 27); p.contacts.value.manifolds = []; p.contacts.value.recycle_state = null;
  const out = I.projectCache(p, 0);
  assert.equal(out.pairPresent, 1); assert.equal(out.recycleValid, 0);
  assert.equal(Object.hasOwn(out, 'localN1'), false); assert.deepEqual(out.sourcePair, p);
  assert.deepEqual(I.projectCache(null), {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0, solverColor: 255});
});
test('unsupported multimanifold, multipoint and clustered cache projections fail closed', () => {
  for (const mutate of [p => p.contacts.variant = 'Soft',
    p => p.contacts.value.manifolds.push(copy(p.contacts.value.manifolds[0])),
    p => p.contacts.value.manifolds[0].points.push(copy(p.contacts.value.manifolds[0].points[0])),
    p => p.contacts.value.manifolds[0].data.solver_contacts.push(copy(p.contacts.value.manifolds[0].data.solver_contacts[0])),
    p => p.contacts.value.solver_clusters.push(copy(p.contacts.value.manifolds[0])),
    p => p.contacts.value.manifolds[0].points = []]) {
    const p = pair(6, 27); mutate(p); assert.throws(() => I.projectCache(p, 0x8000));
  }
  for (const hint of [-1, 65536, 1.5, undefined]) assert.throws(() => I.projectCache(pair(6, 27), hint));
});
test('generic initial importer preserves dense graph, generations, hints and allocator metadata', () => {
  const row = fixture(), before = copy(row), out = I.exportInitialContacts(row);
  assert.deepEqual(row, before); assert.equal(out.kind, I.KIND);
  assert.deepEqual(out.retainedCushions.map(c => [c.edgeId, c.ballIndex, c.cushionIndex]), [[0, 3, 1], [3, 1, 3]]);
  assert.deepEqual(out.edges.map(e => [e.collider1.index, e.collider2.index]), [[6, 27], [0, 25], [0, 21], [10, 23], [0, 27], [0, 23]]);
  assert.deepEqual(out.contactGraph, row.state.narrow_phase.contact_graph);
  assert.deepEqual(out.pairSolverHints, row.state.narrow_phase.pair_solver_hints);
  assert.deepEqual(out.bodySolverColorMasks, [1n << 127n, 1n << 126n]);
  assert.equal(out.activeSetEpoch, 17); assert.equal(out.solverGraphEpoch, 15);
  assert.equal(out.retainedCushions[0].cache.active, 1);
  assert.equal(out.retainedCushions[0].cache.pairSolverHint, 0x8000);
  out.contactGraph.graph.edges[0].weight.contacts.value.solver_color = 99;
  out.retainedCushions[0].cache.sourcePair.event_status = 99;
  assert.deepEqual(row, before, 'Origin records and stage cache copies must not alias the source');
});
test('the initial contact projection rejects all known future boundaries and source-state relabeling signals', () => {
  for (const boundary of ['beforeStrike', 'strikeCreated', 'secondStrikeCreated', 'firstH.preWorld',
    'firstH.postWorld', 'firstH.postApplication', 'physicalRest', 'controllerFinished']) {
    const row = fixture(); row.boundary = boundary; assert.throws(() => I.exportInitialContacts(row));
  }
  for (const mutate of [r => r.candidateInput = false, r => r.hCount = 1, r => r.outerStep = 1,
    r => r.outerSubstep = 1, r => r.nativeSteps++, r => r.application.steps = 0,
    r => r.application.shots = 2, r => r.application.cue.contacted = true,
    r => r.application.cue.contacts = [3], r => r.sourceRevision = 'unknown',
    r => r.verification.javascriptTypedReencodeByteIdentical = false]) {
    const row = fixture(); mutate(row); assert.throws(() => I.exportInitialContacts(row));
  }
});
test('unknown statics, dynamic-pair origins, forged generations and missing cloth are not discarded', () => {
  for (const mutate of [r => r.contactPairs[0].collider1 = h(3),
    r => { r.contactPairs[0].collider1 = h(22); r.contactPairs[0].collider2 = h(24); },
    r => r.contactPairs[0].collider1.generation++,
    r => r.colliders.find(c => c.handle.index === 6).parent.handle = h(5),
    r => r.state.narrow_phase.pair_solver_hints.pop(),
    r => r.contactPairs.splice(1, 1),
    r => { r.state.narrow_phase.contact_graph.graph.edges.splice(1, 1); r.contactPairs.splice(1, 1); r.state.narrow_phase.pair_solver_hints.splice(1, 1); }]) {
    const row = fixture(); mutate(row); assert.throws(() => I.exportInitialContacts(row));
  }
});
