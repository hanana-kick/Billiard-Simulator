'use strict';
// Candidate input export is deliberately separate from the expected-state view.
// Only the actual strikeCreated boundary may initialize the numerical component.
const assert = require('node:assert/strict');
const F = require('./four-ball-created-fixture.cjs');
const copy = x => structuredClone(x), same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
function exportInitialSeed(input) {
  assert.deepEqual(Object.keys(input), ['strikeCreated']);
  const row = input.strikeCreated;
  assert.equal(row.boundary, 'strikeCreated'); assert.equal(row.candidateInput, true);
  assert.equal(row.nativeSteps, 72); assert.equal(row.sourceRevision, F.D.SOURCE_REVISION);
  assert.equal(row.engineSha256, F.D.ENGINE_SHA256);
  assert.equal(F.hash(row.snapshot), row.snapshotSha256);
  assert.deepEqual(F.D.encodeLosslessTree(row.typedState), Buffer.from(row.snapshot));
  const state = F.plain(row.typedState); assert.deepEqual(row.state, state);
  const arena = a => a.items.flatMap((entry, index) => entry && typeof entry === 'object' && 'generation' in entry
    ? [{handle: {index, generation: entry.generation}, ...entry.value}] : []);
  assert.deepEqual(row.bodies, arena(state.bodies.bodies));
  assert.deepEqual(row.colliders, arena(state.colliders.colliders));
  const objects = row.application.registry.objects, fourth = objects[3];
  assert.equal(objects.length, 4); assert.equal(row.application.registry.statics.length, 16);
  assert.equal(row.application.steps, 0); assert.equal(row.application.time, 0);
  const cloth = row.application.registry.statics.find(s => s.kind === 'cloth');
  const body = row.bodies.find(b => same(b.handle, fourth.body));
  const ball = row.colliders.find(c => same(c.handle, fourth.collider));
  const passive = row.colliders.find(c => same(c.handle, fourth.pairCollider));
  const floor = row.colliders.find(c => same(c.handle, cloth.collider));
  assert.equal(row.contactPairs.some(p => same(p.collider1, ball.handle) || same(p.collider2, ball.handle)), false);
  const proxies = []; for (const n of state.broad_phase.tree.nodes) for (const c of [n.left, n.right])
    if ((c.data & 0x3fffffff) === 1) proxies.push({index: c.children, min: copy(c.mins), max: copy(c.maxs)});
  assert.deepEqual(row.proxies, proxies);
  assert.equal(proxies.some(p => p.index === ball.handle.index || p.index === passive.handle.index), false);
  const floorProxy = proxies.find(p => p.index === floor.handle.index); assert.ok(floorProxy);
  const ip = state.integration_parameters;
  return {kind: 'original-fourth-ball-first-cloth-birth', boundary: 'strikeCreated', sourceRevision: row.sourceRevision,
    initialSnapshotSha256: row.snapshotSha256, constructorNativeSettlingSteps: 72, additionalApplicationSettlingSteps: 0,
    body: copy(body), ball: copy(ball), passive: copy(passive), floor: copy(floor),
    floorProxy: {min: copy(floorProxy.min), max: copy(floorProxy.max)}, gravity: copy(state.gravity),
    parameters: Object.fromEntries(['dt', 'contact_softness', 'static_contact_softness', 'warmstart_coefficient',
      'length_unit', 'normalized_max_corrective_velocity', 'normalized_prediction_distance', 'normalized_max_linear_velocity',
      'num_solver_iterations', 'num_internal_pgs_iterations', 'num_internal_stabilization_iterations', 'max_ccd_substeps',
      'contact_recycling', 'normalized_contact_recycle_distance', 'friction_in_bias_pass', 'friction_model'].map(k => [k, copy(ip[k])])),
    application: {dt: row.application.dt, strokeSubsteps: row.application.strokeSubsteps},
    initialAbsence: {proxy: true, pair: true, point: true, recycleState: true}};
}
// Tests only: oracle extraction is never called by the candidate's exporter.
function expectedPostWorld(row) {
  assert.equal(row.boundary, 'firstH.postWorld'); assert.equal(row.candidateInput, false);
  const object = row.application.registry.objects[3], body = row.bodies.find(b => same(b.handle, object.body));
  const pair = row.contactPairs.find(p => same(p.collider2, object.collider)); assert.ok(pair);
  const rigid = pair.contacts.value, m = rigid.manifolds[0], p = m.points[0], d = p.data, s = m.data.solver_contacts[0];
  const ii = body.mprops.effective_world_inv_inertia;
  const proxy = row.proxies.find(p => p.index === object.collider.index);
  return {body: {translation: copy(body.pos.position.translation), rotation: copy(body.pos.position.rotation),
      linear: copy(body.vels.linvel), angular: copy(body.vels.angvel), force: copy(body.forces.force),
      invInertia: ['m11', 'm12', 'm13', 'm12', 'm22', 'm23', 'm13', 'm23', 'm33'].map(k => ii[k])},
    cache: {normal: copy(m.data.normal), localN2: copy(m.local_n2), localP1: copy(p.local_p1), localP2: copy(p.local_p2),
      contactDistance: p.dist, anchor1: copy(s.anchor1), anchor2: copy(s.anchor2), dp1: copy(d.solver_dp1), dp2: copy(d.solver_dp2),
      impulse: d.impulse, warmImpulse: d.warmstart_impulse, tangentImpulse: copy(d.tangent_impulse),
      warmTangent: copy(d.warmstart_tangent_impulse), warmWorld: copy(d.warmstart_tangent_world), contactId: s.contact_id[0],
      friction: m.data.friction, restitution: m.data.restitution, recycleTranslation: copy(rigid.recycle_state.pos12.translation),
      recycleRotation: copy(rigid.recycle_state.pos12.rotation), maxExtent: rigid.recycle_state.max_extent,
      maxDrift: rigid.recycle_state.max_drift}, proxy: {min: copy(proxy.min), max: copy(proxy.max)}};
}
module.exports = {exportInitialSeed, expectedPostWorld};
