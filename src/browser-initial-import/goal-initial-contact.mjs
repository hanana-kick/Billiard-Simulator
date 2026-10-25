// SPDX-License-Identifier: Apache-2.0
// Browser-native, initial-only source projection. Port of tests/goal-four-initial-contact-import.cjs.
// Numerical values, generations and caches are copied from verified native bytes;
// this adapter never creates/restores/steps physics or accepts future output.
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import {requireThat,equal,equalData,plain,hash,journalDigest,copy} from './exact-data.mjs';
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const key = h => h.index + ':' + h.generation;
const SOURCE = 'b716d375efc0201003f0cd9ef7168eee0b62c177';
const KIND = 'verified-original-placed-goal-initial-contacts';

function projectCache(pair, pairSolverHint) {
  if (!pair) return {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0, solverColor: 255};
  equal(pair.contacts.variant, 'Rigid', 'Initial contacts must be original rigid pairs');
  const rigid = pair.contacts.value;
  requireThat(Array.isArray(rigid.manifolds) && rigid.manifolds.length <= 1,
    'Initial sphere contacts require an exact zero/one-manifold cache');
  equalData(rigid.solver_clusters, [], 'Clustered initial contacts need a different importer');
  requireThat(Number.isInteger(pairSolverHint) && pairSolverHint >= 0 && pairSolverHint <= 65535);
  const manifold = rigid.manifolds[0], point = manifold?.points[0], data = manifold?.data;
  if (manifold) {
    requireThat(Array.isArray(manifold.points) && manifold.points.length <= 1,
      'Initial sphere manifold must have at most one original point');
    requireThat(Array.isArray(data.solver_contacts) && data.solver_contacts.length <= 1,
      'Initial sphere manifold must have at most one original solver contact');
  }
  const solver = data?.solver_contacts[0], recycle = rigid.recycle_state;
  // This is Rapier's has_any_active_contact(), not the pair hint count. Sleeping
  // contacts may remain active while their count-cleared solver hint is 0x8000.
  const cache = {pairPresent: 1, pointPresent: +!!point, active: +!!solver,
    recycleValid: +!!recycle, solverColor: rigid.solver_color,
    pairSolverHint, solverColorBodies: copy(rigid.solver_color_bodies),
    eventStatus: pair.event_status, workspace: copy(rigid.workspace), sourcePair: copy(pair)};
  if (manifold) Object.assign(cache, {
    localN1: copy(manifold.local_n1), localN2: copy(manifold.local_n2),
    normal: copy(data.normal), friction: data.friction, restitution: data.restitution,
    solverFlags: data.solver_flags, manifoldSolverColor: data.solver_color,
    graphPos: data.graph_pos, solverBodyIds: copy(data.solver_body_ids),
    subshape1: manifold.subshape1, subshape2: manifold.subshape2,
    subshapePoses: copy(manifold.subshape_poses), relativeDominance: data.relative_dominance,
    manifoldUserData: copy(data.user_data)});
  if (point) Object.assign(cache, {
    localP1: copy(point.local_p1), localP2: copy(point.local_p2),
    feature1: point.fid1, feature2: point.fid2, contactDistance: point.dist,
    impulse: point.data.impulse, warmImpulse: point.data.warmstart_impulse,
    warmTwist: point.data.warmstart_twist_impulse,
    warmWorld: copy(point.data.warmstart_tangent_world),
    warmTangent: copy(point.data.warmstart_tangent_impulse),
    tangentImpulse: copy(point.data.tangent_impulse),
    dp1: copy(point.data.solver_dp1), dp2: copy(point.data.solver_dp2)});
  if (solver) {
    requireThat(point, 'An active initial solver contact must retain its actual point');
    requireThat(Array.isArray(solver.contact_id) && solver.contact_id.length === 1);
    Object.assign(cache, {anchor1: copy(solver.anchor1), anchor2: copy(solver.anchor2),
      contactId: solver.contact_id[0], tangentVelocity: copy(solver.tangent_velocity),
      solverContactDistance: solver.dist, solverContactPadding: copy(solver.padding)});
  }
  if (recycle) Object.assign(cache, {
    recycleTranslation: copy(recycle.pos12.translation), recycleRotation: copy(recycle.pos12.rotation),
    recycleRelativeRotation: copy(recycle.pos12.rotation),
    recycleRotation1: copy(recycle.rot1), recycleRotation2: copy(recycle.rot2),
    maxExtent: recycle.max_extent, maxDrift: recycle.max_drift});
  return cache;
}

function exportInitialContacts(row) {
  equal(row.boundary, 'goalStrikeCreated', 'Only the actual initial contact origin is accepted');
  equal(row.candidateInput, true);
  equal(row.hCount, 0); equal(row.outerStep, 0); equal(row.outerSubstep, 0);
  equal(row.sourceRevision, SOURCE);
  requireThat(/^[a-f0-9]{64}$/.test(row.snapshotSha256));
  equal(row.verification.nativeBincodeByteIdentical, true);
  equal(row.verification.javascriptTypedReencodeByteIdentical, true);
  const app = row.application;
  requireThat(Number.isInteger(app.steps) && app.steps > 0);
  equal(row.nativeSteps, 72 + app.steps);
  equal(app.shots, 1); equal(app.controller.selectedId, 1);
  equal(app.cue.selectedId, 1); equal(app.cue.started, app.time);
  equal(app.cue.contacted, false); equalData(app.cue.contacts, []);
  const objects = app.registry.objects, statics = app.registry.statics;
  equal(objects.length, 4); equal(statics.length, 16);
  const floor = statics.find(s => s.kind === 'cloth'), rails = statics.filter(s => s.kind === 'cushion');
  requireThat(floor); equal(rails.length, 4);
  const np = row.state.narrow_phase, graph = np.contact_graph.graph;
  const pairs = graph.edges.map(e => e.weight);
  equalData(row.contactPairs, pairs, 'Every retained pair must retain its exact dense graph position');
  equal(np.pair_solver_hints.length, pairs.length, 'Every source pair keeps its own native hint');
  const colliders = new Map(row.colliders.map(c => [key(c.handle), c]));
  const edges = [], retainedCushions = [], retainedDynamicPairs = [], seen = new Set();
  pairs.forEach((pair, edgeId) => {
    const pairKey = [key(pair.collider1), key(pair.collider2)].sort().join('/');
    equal(seen.has(pairKey), false, 'Duplicate initial contact pair'); seen.add(pairKey);
    const ballIndex = objects.findIndex(o => same(o.collider, pair.collider2));
    const cushionIndex = rails.findIndex(r => same(r.collider, pair.collider1));
    const cloth = same(pair.collider1, floor.collider);
    const dynamicIndices = [pair.collider1, pair.collider2].map(h =>
      objects.findIndex(o => same(o.pairCollider, h)));
    const dynamic = dynamicIndices.every(i => i >= 0) && dynamicIndices[0] !== dynamicIndices[1];
    requireThat(dynamic || ballIndex >= 0 && (cloth || cushionIndex >= 0),
      'Only original registered cloth, cushion/primary-sphere and distinct pair-channel sphere origins are supported');
    const endpoints = dynamic ? dynamicIndices.map(i => objects[i]) :
      [cloth ? floor : rails[cushionIndex], objects[ballIndex]];
    const c1 = colliders.get(key(pair.collider1)), c2 = colliders.get(key(pair.collider2));
    requireThat(c1 && c2 && same(c1.parent.handle, endpoints[0].body) && same(c2.parent.handle, endpoints[1].body),
      'Original collider generations and parent body identities must match the registry');
    if (dynamic) {
      requireThat(!same(endpoints[0].body, endpoints[1].body), 'A dynamic origin requires two distinct original bodies');
      requireThat(c1.shape?.variant === 'Ball' && c2.shape?.variant === 'Ball',
        'Retained dynamic contacts must use the actual original sphere pair colliders');
    }
    const cache = projectCache(pair, np.pair_solver_hints[edgeId]);
    if (dynamic) for (const manifold of pair.contacts.value.manifolds) {
      requireThat(same(manifold.data.rigid_body1, endpoints[0].body) &&
        same(manifold.data.rigid_body2, endpoints[1].body),
      'Dynamic manifold body identities and source edge orientation must agree exactly');
    }
    const edge = {collider1: copy(pair.collider1), collider2: copy(pair.collider2),
      body1: copy(endpoints[0].body), body2: copy(endpoints[1].body), active: !!cache.active};
    edges.push(edge);
    if (dynamic) retainedDynamicPairs.push({edgeId, ballIndices: dynamicIndices, ...copy(edge), cache});
    else if (!cloth) retainedCushions.push({edgeId, ballIndex, cushionIndex, ...copy(edge), cache});
  });
  for (const object of objects) equal(pairs.filter(p =>
    same(p.collider1, floor.collider) && same(p.collider2, object.collider)).length, 1,
  'Every settled sphere must retain exactly its own original cloth cache');
  return {kind: KIND, boundary: row.boundary, initialSnapshotSha256: row.snapshotSha256,
    sourceRevision: row.sourceRevision, engineSha256: row.engineSha256, sourceNativeSteps: row.nativeSteps,
    edges, contactGraph: copy(np.contact_graph), pairSolverHints: copy(np.pair_solver_hints),
    solverContactGraph: copy(np.solver_contact_graph), bodySolverColorMasks: copy(np.body_solver_color_masks),
    solverGraphValid: np.solver_graph_valid, solverGraphEpoch: np.solver_graph_epoch,
    solverGraphMultibodyEpoch: np.solver_graph_mb_epoch, activeSetEpoch: row.state.islands.active_set_epoch,
    multibodyTopologyEpoch: row.state.multibody_joints.topology_epoch, retainedCushions, retainedDynamicPairs};
}

// Pure local-owner projection, after the public world exporter has verified the
// original bytes and complete graph. Keep all other owners' edges and incidence:
// a two-body numerical binding is not permission to truncate a coupled graph.
function projectPairOrigin(origin, graphSeed, objects, indices) {
  equal(origin.kind, KIND); equal(origin.boundary, 'goalStrikeCreated');
  equal(graphSeed.initialSnapshotSha256, origin.initialSnapshotSha256);
  equalData(graphSeed.edges, origin.edges);
  equal(indices.length, 2); equal(new Set(indices).size, 2);
  requireThat(indices.every(i => Number.isInteger(i) && objects[i]));
  const selectedPair = edge => indices.every(i => [edge.collider1, edge.collider2].some(h => same(h, objects[i].pairCollider)));
  const matches = origin.edges.flatMap((e, i) => selectedPair(e) ? [i] : []);
  requireThat(matches.length <= 1, 'One actual original dense edge per sphere pair');
  const edgeId = matches[0], retained = origin.retainedDynamicPairs.find(p => p.edgeId === edgeId);
  equal(!!retained, edgeId !== undefined, 'Every retained pair requires its exact original cache');
  const ballIndices = retained ? copy(retained.ballIndices) : indices.slice().sort((a, b) =>
    objects[a].pairCollider.index - objects[b].pairCollider.index || objects[a].pairCollider.generation - objects[b].pairCollider.generation);
  equalData(ballIndices.slice().sort((a, b) => a - b), indices.slice().sort((a, b) => a - b));
  if (retained) {
    const edge = origin.edges[edgeId], pair = origin.contactGraph.graph.edges[edgeId].weight;
    for (let side = 0; side < 2; side++) {
      const n = side + 1, object = objects[ballIndices[side]];
      requireThat(same(retained['collider' + n], object.pairCollider) &&
        same(retained['body' + n], object.body), 'Never reverse an original pair cache to force canonical body order');
      equalData(retained['collider' + n], edge['collider' + n]);
      equalData(retained['body' + n], edge['body' + n]);
    }
    equal(retained.active, edge.active); equal(!!retained.cache.active, edge.active);
    equalData(retained.cache, projectCache(pair, origin.pairSolverHints[edgeId]));
  }
  const pairDirectionalAdjacency = ballIndices.map(i => {
    const adjacency = graphSeed.adjacency.find(a => same(a.collider, objects[i].pairCollider));
    requireThat(adjacency, 'Every pair endpoint must retain its original directional adjacency');
    for (const [direction, side] of [['outgoing', 1], ['incoming', 2]]) {
      const incident = origin.edges.flatMap((e, j) => same(e['collider' + side], adjacency.collider) ? [j] : []);
      equalData(adjacency[direction].slice().sort((a, b) => a - b), incident,
        'Every original other-owner edge must remain in its exact source direction');
    }
    return copy(adjacency);
  });
  return {ballIndices, pair: retained ? copy(retained.cache) :
    {pairPresent: 0, pointPresent: 0, active: 0, recycleValid: 0},
    pairAdjacency: pairDirectionalAdjacency.map(a => [...a.outgoing, ...a.incoming]),
    pairDirectionalAdjacency, nativeGraph: copy(origin.contactGraph.graph)};
}

export {KIND,exportInitialContacts,projectCache,projectPairOrigin};
