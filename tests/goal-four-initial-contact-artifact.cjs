'use strict';
// SPDX-License-Identifier: Apache-2.0
// Opt-in read-only integration contract against frozen independent native bytes.
// No native initialization/step/restore or candidate recurrence is permitted.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const file = process.env.CUSHION_COUPLED_ORACLE;
test('actual initial retained cushion origin imports all cache/graph/BVH state without native execution',
  {skip: !file, timeout: 120000}, () => {
    const C = require(process.env.CUSHION_COUPLED_ORACLE_MODULE || './cushion-coupled-original-fixture.cjs');
    const F = require('./four-ball-created-fixture.cjs');
    const E = require('./goal-four-world-seed.cjs');
    const p = C.load(file), record = p.record, row = record.boundaries.goalStrikeCreated;
    const input = {goalStrikeCreated: row, strikeCreationJournal: record.strikeCreationJournal};
    const previous = [];
    for (const [owner, name] of [[F.R, 'init'], [F.R.World, 'restoreSnapshot'], [F.R.World.prototype, 'step']]) {
      previous.push([owner, name, Object.getOwnPropertyDescriptor(owner, name)]);
      Object.defineProperty(owner, name, {configurable: true, writable: true,
        value() { throw Error('Initial cache projection attempted native ' + name); }});
    }
    try {
      const seed = E.exportInitialSeed(input, E.placementProvenanceFromRecord(record));
      const sourceHash = F.hash(row.snapshot), np = row.state.narrow_phase;
      assert.equal(seed.initialSnapshotSha256, sourceHash);
      assert.deepEqual(seed.globalEdges, C.graphView(row).edges);
      assert.deepEqual(seed.contactGraphSeed.adjacency, C.graphView(row).adjacency);
      assert.deepEqual(seed.cueBroadSeed.initialBroadPhase, row.state.broad_phase);
      const origin = seed.initialContactOrigin;
      assert.deepEqual(origin.contactGraph, np.contact_graph);
      assert.deepEqual(origin.pairSolverHints, np.pair_solver_hints);
      assert.deepEqual(origin.solverContactGraph, np.solver_contact_graph);
      assert.deepEqual(origin.bodySolverColorMasks, np.body_solver_color_masks);
      assert.equal(origin.retainedCushions.length, p.initialContacts.length);
      assert.ok(origin.retainedCushions.length > 0);
      assert.ok(seed.balls.every(b => b.state.sleeping && b.state.activation.sleeping),
        'The actual sleeping bodies must not be fabricated awake for the coupled solver');
      for (const s of [seed.cueBroadSeed, ...seed.pairSeeds.map(p => p.seed), ...seed.cushionSeeds]) {
        assert.deepEqual(s.initialContactOrigin, origin);
        assert.notEqual(s.initialContactOrigin, origin, 'Stage inputs own independent cache copies');
      }
      const retained = new Set();
      for (const r of origin.retainedCushions) {
        const pair = np.contact_graph.graph.edges[r.edgeId].weight, rigid = pair.contacts.value;
        const m = rigid.manifolds[0], point = m.points[0], solver = m.data.solver_contacts[0];
        const cache = seed.cushionSeeds[r.ballIndex].cushions[r.cushionIndex].cache;
        retained.add(r.ballIndex + ':' + r.cushionIndex);
        assert.deepEqual(cache.sourcePair, pair);
        assert.equal(cache.pairSolverHint, np.pair_solver_hints[r.edgeId]);
        assert.equal(cache.solverColor, rigid.solver_color);
        assert.deepEqual(cache.solverColorBodies, rigid.solver_color_bodies);
        assert.equal(cache.graphPos, m.data.graph_pos);
        assert.equal(cache.manifoldSolverColor, m.data.solver_color);
        assert.deepEqual(cache.solverBodyIds, m.data.solver_body_ids);
        assert.equal(cache.active, +!!solver); assert.equal(cache.pointPresent, +!!point);
        for (const [a, b] of [['warmImpulse', 'warmstart_impulse'], ['warmTangent', 'warmstart_tangent_impulse'],
          ['warmTwist', 'warmstart_twist_impulse'], ['warmWorld', 'warmstart_tangent_world'],
          ['tangentImpulse', 'tangent_impulse'], ['impulse', 'impulse'], ['dp1', 'solver_dp1'], ['dp2', 'solver_dp2']]) {
          assert.deepEqual(cache[a], point.data[b], 'Exact retained ' + a);
        }
        assert.deepEqual(cache.recycleTranslation, rigid.recycle_state.pos12.translation);
        assert.deepEqual(cache.recycleRotation, rigid.recycle_state.pos12.rotation);
        assert.deepEqual(cache.recycleRotation1, rigid.recycle_state.rot1);
        assert.deepEqual(cache.recycleRotation2, rigid.recycle_state.rot2);
        assert.equal(cache.maxExtent, rigid.recycle_state.max_extent);
        assert.equal(cache.maxDrift, rigid.recycle_state.max_drift);
      }
      seed.cushionSeeds.forEach((s, i) => s.cushions.forEach((r, j) => {
        if (!retained.has(i + ':' + j)) assert.deepEqual(r.cache,
          {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0, solverColor: 255});
      }));
      for (const future of [...p.rows, record.boundaries['firstH.postApplication'], record.boundaries.physicalRest]) {
        assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: future}),
          'No original future snapshot may replace the initial contact origin');
      }
      const forged = structuredClone(row);
      forged.contactPairs.at(-1).contacts.value.manifolds[0].points[0].data.impulse = 99;
      assert.throws(() => E.exportInitialSeed({...input, goalStrikeCreated: forged}),
        'Convenience cache edits cannot override the byte-verified original typed tree');
      assert.equal(F.hash(row.snapshot), sourceHash);
      console.log(JSON.stringify({initialSnapshotSha256: sourceHash, retainedCushions: retained.size,
        edges: seed.globalEdges.length, allFourActuallySleeping: true, nativeSteps: 0, nativeRestores: 0}));
    } finally {
      for (const [owner, name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(owner, name, descriptor); else delete owner[name];
      }
    }
  });
