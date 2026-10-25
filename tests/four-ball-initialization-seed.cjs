'use strict';
// Initial-only component exporter. No native initialization/step, restored world,
// expected first-h boundary, mass formula, broad-phase proxy, or contact birth.
const assert = require('node:assert/strict');
const Creation = require('./four-ball-created-fixture.cjs');
const I = require('../src/experimental-cue-initialization');
const {D} = Creation, F = D.field, copy = value => structuredClone(value), f = Math.fround;
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const CUE_METHODS = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
const MODE_METHODS = ['createRigidBody', 'createCollider', 'createCollider'];
function descriptor(value) { assert.equal(value?.kind, 'descriptor'); return value.fields; }
function vector(value, keys) { const d = descriptor(value); return keys.map(k => d[k]); }
function bodyStartedDefault(event) {
  const d = descriptor(event.args[0]);
  assert.equal(d.mass, 0); assert.equal(d.massOnly, false);
  assert.deepEqual(vector(d.centerOfMass, ['x', 'y', 'z']), [0, 0, 0]);
  assert.deepEqual(vector(d.principalAngularInertia, ['x', 'y', 'z']), [0, 0, 0]);
  assert.deepEqual(vector(d.angularInertiaLocalFrame, ['x', 'y', 'z', 'w']), [0, 0, 0, 1]);
  for (const key of ['translationsEnabledX', 'translationsEnabledY', 'translationsEnabledZ',
    'rotationsEnabledX', 'rotationsEnabledY', 'rotationsEnabledZ', 'enabled']) assert.equal(d[key], true);
  return true;
}
function journal(rows, methods, phase, row) {
  assert.ok(Array.isArray(rows)); assert.deepEqual(rows.map(e => e.method), methods);
  rows.forEach((e, index) => {
    assert.equal(e.phase, phase); assert.equal(e.nativeStepsBefore, 72); assert.equal(e.nativeStepsAfter, 72);
    assert.ok(Number.isInteger(e.order) && e.order < row.apiJournalLength);
    if (index) assert.equal(e.order, rows[index - 1].order + 1);
  });
  return rows.map(e => {
    const out = {method: e.method, handle: copy((e.result || e.target).handle)};
    if (e.method === 'createRigidBody') out.initialLocalMassWasDefault = bodyStartedDefault(e);
    if (e.method === 'createCollider') out.parent = copy(e.args[1].handle);
    if (e.method === 'createImpulseJoint') Object.assign(out, {
      body1: copy(e.args[1].handle), body2: copy(e.args[2].handle), wakeUp: e.args[3]});
    if (e.method === 'setLinvel') Object.assign(out, {
      linear: vector(e.args[0], ['x', 'y', 'z']), wakeUp: e.args[1]});
    if (e.method === 'setLimits' || e.method === 'setContactsEnabled') out.args = copy(e.args);
    return out;
  });
}
function exportInitialSeed(input) {
  assert.deepEqual(Object.keys(input).sort(), ['modeCreationJournal', 'strikeCreated', 'strikeCreationJournal']);
  const {strikeCreated: row, modeCreationJournal, strikeCreationJournal} = input;
  assert.equal(row.boundary, 'strikeCreated'); assert.equal(row.candidateInput, true);
  assert.equal(row.sourceRevision, D.SOURCE_REVISION); assert.equal(row.engineSha256, D.ENGINE_SHA256);
  assert.equal(row.nativeSteps, 72); assert.equal(row.application.time, 0); assert.equal(row.application.steps, 0);
  assert.equal(row.application.controller.gameMode, 'four'); assert.equal(row.application.controller.selectedId, 1);
  const settings = row.application.controller.settings;
  assert.deepEqual(Object.keys(settings).sort(), ['angle', 'elevation', 'speed', 'tipX', 'tipY']);
  assert.ok(Object.values(settings).every(Number.isFinite), 'Finite source strike settings required');
  assert.ok(settings.angle >= -180 && settings.angle <= 180 && settings.elevation >= 0 && settings.elevation <= 85);
  assert.ok(settings.speed > 0 && settings.speed <= 10 && Math.hypot(settings.tipX, settings.tipY) < 1,
    'Original PhysicsLab engine domain, not the manual UI speed ceiling of 5');
  assert.equal(Creation.hash(row.snapshot), row.snapshotSha256);
  assert.deepEqual(D.encodeLosslessTree(row.typedState), Buffer.from(row.snapshot));
  assert.equal(row.verification.nativeBincodeByteIdentical, true);
  assert.equal(row.verification.javascriptTypedReencodeByteIdentical, true);
  // Re-project the byte-verified typed initial tree, not caller convenience
  // copies of mass, IDs, managers or queues that might contain a later state.
  const state = row.typedState, plain = Creation.plain;
  const occupied = field => F(F(F(state, field), field), 'items').items.flatMap((entry, index) =>
    entry.variant === 'Occupied' ? [{handle: {index, generation: Number(F(entry, 'generation').value)},
      ...plain(F(entry, 'value'))}] : []);
  const allBodies = occupied('bodies'), colliders = occupied('colliders');
  assert.equal(allBodies.length, 23); assert.equal(colliders.length, 27);
  const registry = row.application.registry, cue = row.application.cue;
  assert.equal(registry.objects.length, 4); assert.equal(registry.statics.length, 16); assert.ok(cue);
  const roles = {ball: copy(registry.objects[0].body), otherBall1: copy(registry.objects[1].body),
    otherBall2: copy(registry.objects[2].body), freshBall: copy(registry.objects[3].body),
    floor: copy(registry.statics.find(s => s.kind === 'cloth').body),
    shaft: copy(cue.shaft), head: copy(cue.head), guide: copy(cue.guide)};
  const bodies = Object.fromEntries(Object.entries(roles).map(([role, handle]) => {
    const body = allBodies.find(b => same(b.handle, handle)); assert.ok(body); return [role, copy(body)];
  }));
  const modeEvents = journal(modeCreationJournal, MODE_METHODS, 'modeCreation', row),
    events = journal(strikeCreationJournal, CUE_METHODS, 'strikeCreation', row);
  assert.ok(modeCreationJournal.at(-1).order < strikeCreationJournal[0].order);
  // Re-evaluate only the original pure pose function using the byte-verified
  // initial selected body. No world creation/step or future output is consulted.
  const selected = bodies.ball.pos.position.translation;
  assert.equal(registry.objects[0].radius, .03075);
  const pose = globalThis.PhysicsLab.prototype.pose.call(null, {
    radius: registry.objects[0].radius,
    body: {translation: () => ({x: selected[0], y: selected[1], z: selected[2]})}
  }, settings);
  assert.deepEqual(cue.pose, pose, 'Settings reproduce the original initial cue pose');
  const xyz = v => [v.x, v.y, v.z], xyzw = v => [v.x, v.y, v.z, v.w];
  for (const role of ['shaft', 'head', 'guide']) {
    const bodyEvent = strikeCreationJournal.find(e => e.method === 'createRigidBody' && same(e.result.handle, roles[role]));
    const bd = descriptor(bodyEvent.args[0]);
    assert.deepEqual(vector(bd.translation, ['x', 'y', 'z']), xyz(pose.tip));
    assert.deepEqual(vector(bd.rotation, ['x', 'y', 'z', 'w']), xyzw(pose.rotation));
  }
  const velocity = xyz(pose.direction).map(x => x * settings.speed);
  const setters = strikeCreationJournal.filter(e => e.method === 'setLinvel');
  assert.deepEqual(setters.map(e => e.target.handle), [roles.shaft, roles.head]);
  setters.forEach((event, i) => {
    assert.deepEqual(vector(event.args[0], ['x', 'y', 'z']), velocity);
    assert.equal(event.args[1], true);
    assert.deepEqual(bodies[i ? 'head' : 'shaft'].vels.linvel, velocity.map(f));
  });

  const created = {sourceRevision: row.sourceRevision, engineSha256: row.engineSha256,
    boundary: 'strikeCreated', originalFourBallCreation: true, snapshotSha256: row.snapshotSha256,
    bodies, colliders, islands: plain(F(state, 'islands')),
    modifiedBodies: plain(F(F(state, 'bodies'), 'modified_bodies'))[0],
    modifiedColliders: plain(F(F(state, 'colliders'), 'modified_colliders'))[0],
    jointState: plain(F(state, 'impulse_joints'))};
  const freshRoles = ['freshBall', 'shaft', 'head', 'guide'];
  assert.deepEqual(created.modifiedBodies, freshRoles.map(role => roles[role]));
  assert.deepEqual(created.modifiedColliders, freshRoles.flatMap(role => bodies[role].colliders));
  const sourceJournal = [...modeCreationJournal, ...strikeCreationJournal];
  const numericInputs = freshRoles.map(role => {
    const b = bodies[role], m = b.mprops, local = m.local_mprops;
    assert.equal(b.changes, 255); assert.ok(Object.values(b.ids).every(id => id === 0xffffffff));
    const bodyEvent = sourceJournal.find(e => e.method === 'createRigidBody' && same(e.result.handle, roles[role]));
    assert.ok(bodyEvent); assert.equal(bodyStartedDefault(bodyEvent), true);
    const bd = descriptor(bodyEvent.args[0]); assert.equal(bd.status, role === 'guide' ? 1 : 0);
    assert.deepEqual(vector(bd.translation, ['x', 'y', 'z']).map(f), b.pos.position.translation);
    assert.deepEqual(vector(bd.rotation, ['x', 'y', 'z', 'w']).map(f), b.pos.position.rotation);
    const attachments = b.colliders.map(handle => {
      const c = colliders.find(c => same(c.handle, handle)); assert.ok(c); assert.ok(same(c.parent.handle, roles[role]));
      const event = sourceJournal.find(e => e.method === 'createCollider' && same(e.result.handle, handle));
      assert.ok(event); assert.ok(same(event.args[1].handle, roles[role]));
      const cd = descriptor(event.args[0]), shape = descriptor(cd.shape);
      assert.equal(cd.enabled, true); assert.equal(cd.massPropsMode, 1);
      assert.equal(c.mprops.variant, 'Mass'); assert.equal(f(cd.mass), c.mprops.value);
      assert.equal(f(shape.radius), c.shape.value.radius);
      assert.equal(shape.type, c.shape.variant === 'Ball' ? 0 : 10);
      if (c.shape.variant === 'Cylinder') assert.equal(f(shape.halfHeight), c.shape.value.half_height);
      assert.deepEqual(vector(cd.translation, ['x', 'y', 'z']).map(f), c.parent.pos_wrt_parent.translation);
      assert.deepEqual(vector(cd.rotation, ['x', 'y', 'z', 'w']).map(f), c.parent.pos_wrt_parent.rotation);
      return {handle: copy(handle), shape: c.shape.variant, halfHeight: c.shape.value.half_height ?? 0,
        radius: c.shape.value.radius, massMode: c.mprops.variant, mass: c.mprops.value,
        enabled: c.flags.enabled === 'Enabled', localTranslation: copy(c.parent.pos_wrt_parent.translation),
        localRotation: copy(c.parent.pos_wrt_parent.rotation)};
    });
    const attachedEvents = sourceJournal.filter(e => e.method === 'createCollider' && same(e.args[1].handle, roles[role]));
    assert.deepEqual(attachedEvents.map(e => e.result.handle), b.colliders);
    return I.validate({kind: role === 'freshBall' ? 'source-created-four-ball-body-initialization' : 'source-created-cue-body-initialization',
      sourceRevision: created.sourceRevision, phase: 'post-source-strike-pre-first-h', role,
      bodyType: b.body_type, enabled: b.enabled, lockedAxes: m.flags, initialMaxExtent: m.max_extent,
      additionalLocalMass: m.additional_local_mprops, initialLocalMassWasDefault: true,
      translation: copy(b.pos.position.translation), rotation: copy(b.pos.position.rotation),
      localCom: copy(local.local_com), localInvMass: local.inv_mass,
      invPrincipalInertia: copy(local.inv_principal_inertia), principalFrame: copy(local.principal_inertia_local_frame),
      colliders: attachments, creationColliders: copy(attachments)});
  });
  assert.equal(numericInputs[0].colliders.length, 2);
  assert.equal(bodies.freshBall.ccd.ccd_thickness, f(.03075));
  assert.equal(bodies.freshBall.mprops.max_extent, 0);
  return {kind: 'original-four-ball-initialization-component-seed', numericInputs,
    userChanges: {created, roles, modeEvents, events},
    provenance: {sourceRevision: created.sourceRevision, engineSha256: created.engineSha256,
      initialSnapshotSha256: created.snapshotSha256, boundary: 'strikeCreated', nativeSteps: 72,
      modeCreationJournalSha256: Creation.journalDigest(modeCreationJournal),
      strikeCreationJournalSha256: Creation.journalDigest(strikeCreationJournal),
      expectedFirstHStateIncluded: false, broadPhaseBirthImplemented: false, contactBirthImplemented: false}};
}
module.exports = {exportInitialSeed};
