'use strict';
// SPDX-License-Identifier: Apache-2.0
// LIGHT normalized projection/identity contracts, not numerical world fixtures.
// Public world import still verifies original snapshot bytes and the typed tree.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const I = require('./goal-four-initial-contact-import.cjs');
const Broad = require('./goal-four-broad-graph-seed.cjs');
const copy = value => structuredClone(value), U = 0xffffffff, f = Math.fround;
const h = (index, generation = 7) => ({index, generation});
function fixture() {
  const objects = [21, 23, 25, 27].map((index, ballIndex) => ({id: ballIndex + 1,
    body: h(101 + ballIndex, 3 + ballIndex), collider: h(index), pairCollider: h(index + 1)}));
  const statics = Array.from({length: 16}, (_, index) => ({body: h(50 + index, 4), collider: h(index),
    kind: index === 0 ? 'cloth' : [4, 6, 8, 10].includes(index) ? 'cushion' : 'wood'}));
  const colliders = [...statics, ...objects, ...objects.map(o => ({body: o.body, collider: o.pairCollider}))]
    .map(o => ({handle: copy(o.collider), parent: {handle: copy(o.body)},
      shape: {variant: o.collider.index >= 21 ? 'Ball' : 'Cuboid', value: {radius: f(.03075)}}}));
  const body = handle => colliders.find(c => c.handle.index === handle.index).parent.handle;
  function pair(a, b, {color = 127, active = true, point = true, manifold = true, recycle = true, graphPos = U} = {}) {
    const collider1 = h(a), collider2 = h(b);
    return {collider1, collider2, event_status: 1, contacts: {variant: 'Rigid', value: {
      solver_color: color, solver_color_bodies: [body(collider1).index, body(collider2).index],
      solver_clusters: [], workspace: null,
      recycle_state: recycle ? {pos12: {translation: [-0, 2, 3], rotation: [0, 0, 0, 1], padding: -0},
        rot1: [0, 0, 1, 0], rot2: [1, 0, 0, 0], max_extent: f(.03075), max_drift: f(.003)} : null,
      manifolds: manifold ? [{local_n1: [-0, 1, 0], local_n2: [0, -1, -0], subshape1: 11, subshape2: 12,
        subshape_poses: null, points: point ? [{local_p1: [-0, 2, 3], local_p2: [0, 4, -0],
          fid1: 2147483664, fid2: 3221225472, dist: f(.001), data: {
            impulse: f(.123), warmstart_impulse: -0, tangent_impulse: [1, -0],
            warmstart_tangent_impulse: [-0, 2], warmstart_twist_impulse: -0,
            warmstart_tangent_world: [3, -0, 5], solver_dp1: [-0, 7, 8], solver_dp2: [9, 10, -0]}}] : [],
        data: {rigid_body1: copy(body(collider1)), rigid_body2: copy(body(collider2)),
          solver_flags: 1, solver_color: color, solver_body_ids: [19, 23], graph_pos: graphPos,
          normal: [-0, 1, 0], relative_dominance: 0, user_data: 4, friction: f(.15), restitution: f(.82),
          solver_contacts: active ? [{anchor1: [-0, 11, 12], anchor2: [13, -0, 15], dist: f(.002),
            tangent_velocity: [0, -0, 0], contact_id: [2147483648], padding: [-0]}] : []}}] : []}}};
  }
  // Nonascending source orientation, nonzero generations and shared incidence.
  // The inactive retained pair, empty retained pair and absent pair are distinct.
  const pairs = [pair(0, 25), pair(26, 22, {color: 17, graphPos: 9}), pair(6, 27),
    pair(0, 21), pair(22, 28, {color: 23, active: false, graphPos: 4}), pair(0, 27),
    pair(26, 28, {color: 255, active: false, point: false, manifold: false, recycle: false}), pair(0, 23)];
  const nodes = [], edges = [], nodeBy = new Map();
  for (const weight of pairs) {
    const endpoints = [weight.collider1, weight.collider2], node = endpoints.map(handle => {
      const key = handle.index + ':' + handle.generation;
      if (!nodeBy.has(key)) { nodeBy.set(key, nodes.length); nodes.push({weight: copy(handle), next: [U, U]}); }
      return nodeBy.get(key);
    });
    const index = edges.length, edge = {weight, node, next: [U, U], prev: [U, U]};
    for (let side = 0; side < 2; side++) {
      const old = nodes[node[side]].next[side]; edge.next[side] = old;
      if (old !== U) edges[old].prev[side] = index;
      nodes[node[side]].next[side] = index;
    }
    edges.push(edge);
  }
  return {boundary: 'goalStrikeCreated', candidateInput: true, hCount: 0, outerStep: 0, outerSubstep: 0,
    sourceRevision: 'b716d375efc0201003f0cd9ef7168eee0b62c177', engineSha256: 'e'.repeat(64),
    snapshotSha256: 'a'.repeat(64), nativeSteps: 556,
    verification: {nativeBincodeByteIdentical: true, javascriptTypedReencodeByteIdentical: true},
    application: {steps: 484, shots: 1, time: .5, controller: {selectedId: 1},
      cue: {selectedId: 1, started: .5, contacted: false, contacts: []}, registry: {objects, statics}},
    colliders, contactPairs: pairs, state: {islands: {active_set_epoch: 17},
      multibody_joints: {topology_epoch: 4}, narrow_phase: {contact_graph: {graph: {nodes, edges}},
        pair_solver_hints: [0x8000, 0x8000, 0x8000, 0x8000, 0, 0x8000, 0, 0x8000],
        solver_contact_graph: {buckets: Array.from({length: 130}, () => [])},
        body_solver_color_masks: [1n << 127n, 1n << 17n], solver_graph_valid: false,
        solver_graph_epoch: 15, solver_graph_mb_epoch: 4}}};
}
function project(row = fixture()) {
  const origin = I.exportInitialContacts(row), graph = {initialSnapshotSha256: row.snapshotSha256, ...Broad.graphView(row)};
  const objects = row.application.registry.objects;
  return {row, origin, graph, objects, pair: indices => I.projectPairOrigin(origin, graph, objects, indices)};
}
test('retained dynamic origin preserves source identity, orientation, complete cache and count-cleared hint', () => {
  const row = fixture(), before = copy(row), {origin} = project(row);
  assert.deepEqual(origin.retainedDynamicPairs.map(p => [p.edgeId, p.ballIndices]), [[1, [2, 0]], [4, [0, 3]], [6, [2, 3]]]);
  assert.deepEqual(origin.retainedCushions.map(p => [p.edgeId, p.ballIndex, p.cushionIndex]), [[2, 3, 1]]);
  const p = origin.retainedDynamicPairs[0], source = row.contactPairs[1];
  assert.deepEqual(p.cache, I.projectCache(source, 0x8000)); assert.equal(p.cache.active, 1);
  assert.equal(p.cache.solverColor, 17); assert.equal(p.cache.manifoldSolverColor, 17); assert.equal(p.cache.graphPos, 9);
  assert.deepEqual([p.collider1, p.collider2], [h(26), h(22)]);
  assert.deepEqual([p.body1, p.body2], [h(103, 5), h(101, 3)]);
  assert.deepEqual(origin.contactGraph, row.state.narrow_phase.contact_graph);
  assert.deepEqual(origin.pairSolverHints, row.state.narrow_phase.pair_solver_hints);
  assert.deepEqual(origin.solverContactGraph, row.state.narrow_phase.solver_contact_graph);
  assert.deepEqual(origin.bodySolverColorMasks, [1n << 127n, 1n << 17n]);
  assert.ok(Object.is(p.cache.warmImpulse, -0)); assert.ok(Object.is(p.cache.recycleTranslation[0], -0));
  p.cache.sourcePair.contacts.value.manifolds[0].points[0].data.impulse = 99;
  origin.contactGraph.graph.edges[1].weight.contacts.value.solver_color = 99;
  assert.deepEqual(row, before, 'Projected origin must never alias or edit native input');
});
test('each pair binding uses the actual source orientation and retains every other owner adjacency', () => {
  const q = project(), p = q.pair([0, 2]);
  assert.deepEqual(p.ballIndices, [2, 0], 'Do not swap the original local anchors/normals to sort handles');
  assert.deepEqual(p.pair, q.origin.retainedDynamicPairs[0].cache);
  assert.deepEqual(p.pairAdjacency, [[6, 1], [4, 1]]);
  assert.deepEqual(p.pairDirectionalAdjacency, [
    {collider: h(26), outgoing: [6, 1], incoming: []},
    {collider: h(22), outgoing: [4], incoming: [1]}]);
  assert.deepEqual(p.nativeGraph, q.row.state.narrow_phase.contact_graph.graph);
  const absent = q.pair([0, 1]);
  assert.deepEqual(absent.ballIndices, [0, 1]); assert.deepEqual(absent.pairAdjacency, [[4, 1], []]);
  assert.deepEqual(absent.pair, {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0});
  const inactive = q.pair([0, 3]).pair, empty = q.pair([2, 3]).pair;
  assert.equal(inactive.pairPresent, 1); assert.equal(inactive.pointPresent, 1); assert.equal(inactive.active, 0);
  assert.equal(inactive.graphPos, 4); assert.equal(inactive.solverColor, 23); assert.equal(inactive.pairSolverHint, 0);
  assert.equal(empty.pairPresent, 1); assert.equal(empty.pointPresent, 0); assert.equal(empty.active, 0);
  assert.equal(empty.solverColor, 255); assert.equal(Object.hasOwn(empty, 'localN1'), false);
  p.pair.warmWorld[0] = 99; p.pairDirectionalAdjacency[0].outgoing.pop(); p.nativeGraph.edges.pop();
  assert.deepEqual(q.pair([0, 2]).pair, q.origin.retainedDynamicPairs[0].cache);
  assert.deepEqual(q.graph.adjacency.find(a => a.collider.index === 26).outgoing, [6, 1]);
});
test('dynamic origins reject forged channels, generations, parents, manifold identities, duplicate pairs and caches', () => {
  const mutations = [r => r.contactPairs[1].collider1.generation++,
    r => r.contactPairs[1].collider1 = copy(r.application.registry.objects[2].collider),
    r => r.contactPairs[1].collider2 = copy(r.contactPairs[1].collider1),
    r => r.colliders.find(c => c.handle.index === 26).parent.handle.generation++,
    r => r.colliders.find(c => c.handle.index === 26).shape.variant = 'Cylinder',
    r => r.contactPairs[1].contacts.value.manifolds[0].data.rigid_body1.generation++,
    r => r.contactPairs[1].contacts.value.manifolds.push(copy(r.contactPairs[1].contacts.value.manifolds[0])),
    r => { const p = copy(r.contactPairs[1]); [p.collider1, p.collider2] = [p.collider2, p.collider1];
      r.contactPairs.push(p); r.state.narrow_phase.contact_graph.graph.edges.push({weight: p}); r.state.narrow_phase.pair_solver_hints.push(0); }];
  for (const mutate of mutations) { const row = fixture(); mutate(row); assert.throws(() => I.exportInitialContacts(row)); }
  const q = project(); q.origin.retainedDynamicPairs[0].cache.graphPos++;
  assert.throws(() => q.pair([0, 2]), 'GraphPos cannot be rebuilt or repaired during import');
  const missing = project(); missing.origin.retainedDynamicPairs.shift();
  assert.throws(() => missing.pair([0, 2]), 'An existing native edge cannot be replaced by a dormant cache');
});
test('source intrusive graph directions, order, back links and full incidence fail closed on corruption', () => {
  const mutations = [g => g.nodes.find(n => n.weight.index === 26).next[0] = U,
    g => g.edges[1].prev[0] = U,
    g => g.edges[6].next[0] = 6,
    g => g.edges[1].node.reverse(),
    g => g.nodes.find(n => n.weight.index === 26).weight.generation++,
    g => g.nodes.push(copy(g.nodes[0]))];
  for (const mutate of mutations) {
    const row = fixture(); mutate(row.state.narrow_phase.contact_graph.graph);
    assert.throws(() => Broad.graphView(row));
  }
  const q = project(); q.graph.adjacency.find(a => a.collider.index === 26).outgoing.pop();
  assert.throws(() => q.pair([0, 2]), 'Other owner incidence may not be silently omitted');
});
test('dynamic cache import remains initial-only and refuses later boundaries or relabeling signals', () => {
  for (const boundary of ['firstH.preWorld', 'firstH.postWorld', 'firstH.postApplication', 'physicalRest', 'secondStrikeCreated']) {
    const row = fixture(); row.boundary = boundary; assert.throws(() => project(row));
  }
  for (const mutate of [r => r.hCount++, r => r.outerStep++, r => r.outerSubstep++, r => r.nativeSteps++,
    r => r.candidateInput = false, r => r.application.shots++, r => r.application.cue.contacted = true,
    r => r.verification.nativeBincodeByteIdentical = false, r => r.sourceRevision = 'candidate']) {
    const row = fixture(); mutate(row); assert.throws(() => project(row));
  }
});

const artifact = process.env.INITIAL_PAIR_ORACLE;
test('frozen original initial dynamic cache imports into all six world owners without native execution or future state',
  {skip: !artifact, timeout: 120000}, () => {
    const C = require(process.env.INITIAL_PAIR_ORACLE_MODULE || './initial-pair-original-fixture.cjs');
    const F = require('./four-ball-created-fixture.cjs'), E = require('./goal-four-world-seed.cjs');
    const previous = [], calls = {init: 0, step: 0, restoreSnapshot: 0};
    for (const [owner, name] of [[F.R, 'init'], [F.R.World, 'restoreSnapshot'], [F.R.World.prototype, 'step']]) {
      previous.push([owner, name, Object.getOwnPropertyDescriptor(owner, name)]);
      Object.defineProperty(owner, name, {configurable: true, writable: true,
        value() { calls[name]++; throw Error('Initial cache import attempted native ' + name); }});
    }
    try {
      const p = C.load(artifact), record = p.record, row = record.boundaries.goalStrikeCreated;
      const input = {goalStrikeCreated: row, strikeCreationJournal: record.strikeCreationJournal};
      const hash = F.hash(row.snapshot), np = row.state.narrow_phase;
      const seed = E.exportInitialSeed(input, E.placementProvenanceFromRecord(record));
      const origin = seed.initialContactOrigin, same = (a, b) => a.index === b.index && a.generation === b.generation;
      assert.equal(seed.initialSnapshotSha256, hash); assert.equal(origin.initialSnapshotSha256, hash);
      assert.equal(seed.provenance.expectedFirstHStateIncluded, false);
      assert.deepEqual(origin.contactGraph, np.contact_graph);
      assert.deepEqual(origin.pairSolverHints, np.pair_solver_hints);
      assert.deepEqual(origin.solverContactGraph, np.solver_contact_graph);
      assert.deepEqual(origin.bodySolverColorMasks, np.body_solver_color_masks);
      assert.equal(origin.solverGraphEpoch, np.solver_graph_epoch);
      assert.equal(origin.solverGraphValid, np.solver_graph_valid);
      assert.deepEqual(seed.cueBroadSeed.initialBroadPhase, row.state.broad_phase);
      const independentGraph = C.graphView(row);
      assert.deepEqual(seed.globalEdges, independentGraph.edges);
      assert.deepEqual(seed.contactGraphSeed.adjacency, independentGraph.adjacency);
      assert.ok(origin.retainedDynamicPairs.length > 0, 'Oracle must contain a genuine initial dynamic cache');
      assert.equal(seed.pairSeeds.length, 6);
      assert.ok(seed.balls.every(b => b.state.sleeping && b.state.activation.sleeping),
        'Initial retained components keep actual source sleep states');
      for (const retained of origin.retainedDynamicPairs) {
        const source = np.contact_graph.graph.edges[retained.edgeId].weight;
        const binding = seed.pairSeeds.find(b => b.ballIndices.length === 2 &&
          b.ballIndices.every((index, side) => index === retained.ballIndices[side]));
        assert.ok(binding, 'Every original dynamic edge has exactly its source-oriented owner');
        assert.equal(binding.key, binding.ballIndices.slice().sort((a, b) => a - b).join(''));
        assert.deepEqual(binding.seed.pair, I.projectCache(source, np.pair_solver_hints[retained.edgeId]));
        assert.deepEqual(binding.seed.pair.sourcePair, source);
        const cache = binding.seed.pair, rigid = source.contacts.value, manifold = rigid.manifolds[0];
        assert.equal(cache.solverColor, rigid.solver_color);
        assert.equal(cache.pairSolverHint, np.pair_solver_hints[retained.edgeId]);
        assert.deepEqual(cache.solverColorBodies, rigid.solver_color_bodies);
        if (manifold) {
          assert.deepEqual(cache.localN1, manifold.local_n1); assert.deepEqual(cache.localN2, manifold.local_n2);
          assert.deepEqual(cache.normal, manifold.data.normal); assert.deepEqual(cache.solverBodyIds, manifold.data.solver_body_ids);
          assert.equal(cache.manifoldSolverColor, manifold.data.solver_color);
          const point = manifold.points[0], solver = manifold.data.solver_contacts[0];
          assert.equal(cache.pointPresent, +!!point); assert.equal(cache.active, +!!solver);
          if (point) {
            assert.deepEqual(cache.localP1, point.local_p1); assert.deepEqual(cache.localP2, point.local_p2);
            for (const [a, b] of [['warmImpulse', 'warmstart_impulse'], ['warmTangent', 'warmstart_tangent_impulse'],
              ['warmTwist', 'warmstart_twist_impulse'], ['warmWorld', 'warmstart_tangent_world'],
              ['tangentImpulse', 'tangent_impulse'], ['impulse', 'impulse'], ['dp1', 'solver_dp1'], ['dp2', 'solver_dp2']]) {
              assert.deepEqual(cache[a], point.data[b]);
            }
          }
          if (solver) { assert.deepEqual(cache.anchor1, solver.anchor1); assert.deepEqual(cache.anchor2, solver.anchor2); }
        }
        if (rigid.recycle_state) {
          assert.deepEqual(cache.recycleTranslation, rigid.recycle_state.pos12.translation);
          assert.deepEqual(cache.recycleRotation, rigid.recycle_state.pos12.rotation);
          assert.deepEqual(cache.recycleRotation1, rigid.recycle_state.rot1);
          assert.deepEqual(cache.recycleRotation2, rigid.recycle_state.rot2);
          assert.equal(cache.maxExtent, rigid.recycle_state.max_extent); assert.equal(cache.maxDrift, rigid.recycle_state.max_drift);
        }
        assert.deepEqual([binding.seed.bodies[0].pairCollider, binding.seed.bodies[1].pairCollider],
          [source.collider1, source.collider2]);
        assert.equal(binding.seed.pair.graphPos, source.contacts.value.manifolds[0]?.data.graph_pos);
        assert.deepEqual(binding.seed.globalEdges, seed.globalEdges);
      }
      for (const binding of seed.pairSeeds) {
        assert.deepEqual(binding.seed.nativeGraph, np.contact_graph.graph);
        assert.deepEqual(binding.seed.globalEdges, seed.globalEdges);
        binding.ballIndices.forEach((index, side) => {
          const adjacency = seed.contactGraphSeed.adjacency.find(a => same(a.collider, seed.balls[index].pairCollider));
          assert.deepEqual(binding.seed.pairDirectionalAdjacency[side], adjacency);
          assert.deepEqual(binding.seed.pairAdjacency[side], [...adjacency.outgoing, ...adjacency.incoming]);
        });
        if (!origin.retainedDynamicPairs.some(r => r.ballIndices.every(i => binding.ballIndices.includes(i)))) {
          assert.deepEqual(binding.seed.pair, {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0});
        }
      }
      for (const owner of [seed.cueBroadSeed, ...seed.pairSeeds.map(b => b.seed), ...seed.cushionSeeds]) {
        assert.deepEqual(owner.initialContactOrigin, origin); assert.notEqual(owner.initialContactOrigin, origin);
      }
      const futures = [...(p.rows || []), ...Object.values(record.boundaries).filter(r => r !== row)];
      assert.ok(futures.length > 0, 'Oracle includes independent assertion-only later boundaries');
      for (const future of futures) assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: future}),
        'Only the actual initial snapshot is admitted; future native state is assertion-only');
      assert.throws(() => E.exportInitialSeed({...input, expected: futures}), 'Future outputs are not an import input');
      const forged = copy(row), retained = origin.retainedDynamicPairs[0];
      forged.contactPairs[retained.edgeId].contacts.value.manifolds[0].points[0].data.impulse = 99;
      assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: forged}),
        'Cache convenience edits cannot supersede the byte-verified typed original tree');
      assert.equal(F.hash(row.snapshot), hash);
      assert.deepEqual(calls, {init: 0, step: 0, restoreSnapshot: 0});
      console.log(JSON.stringify({initialSnapshotSha256: hash, retainedDynamicPairs: origin.retainedDynamicPairs.length,
        exactPairOwners: seed.pairSeeds.length, edges: seed.globalEdges.length, futureBoundariesRejected: futures.length,
        nativeInitializations: calls.init, nativeSteps: calls.step, nativeRestores: calls.restoreSnapshot}));
    } finally {
      for (const [owner, name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(owner, name, descriptor); else delete owner[name];
      }
    }
  });
