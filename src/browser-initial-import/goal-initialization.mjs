// SPDX-License-Identifier: Apache-2.0
// Browser-native, initial-only source projection. Port of tests/goal-four-initialization-seed.cjs.
// Numerical values, generations and caches are copied from verified native bytes;
// this adapter never creates/restores/steps physics or accepts future output.
import '../experimental-live-registered-origin.js';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import {requireThat,equal,equalData,plain,hash,journalDigest,copy} from './exact-data.mjs';
import * as I from './initial-body.mjs';
import * as importedVariant from '../experimental-cue-created-variant.js';
const Variant=importedVariant.default??globalThis.LabCueCreatedVariantExperimental;
const F=D.field,f=Math.fround,SETTINGS={angle:0,elevation:8,tipX:0,tipY:0,speed:2};
export const AWAKE_SOURCE_SCHEMA = 'original-controller-four-ball-awake-pair-holdout-v1';
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
const CUE_METHODS = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];

function descriptor(value) { equal(value?.kind, 'descriptor'); return value.fields; }
function vector(value, keys) { const d = descriptor(value); return keys.map(k => d[k]); }
function bodyStartedDefault(event) {
  const d = descriptor(event.args[0]);
  equal(d.mass, 0); equal(d.massOnly, false);
  equalData(vector(d.centerOfMass, ['x', 'y', 'z']), [0, 0, 0]);
  equalData(vector(d.principalAngularInertia, ['x', 'y', 'z']), [0, 0, 0]);
  equalData(vector(d.angularInertiaLocalFrame, ['x', 'y', 'z', 'w']), [0, 0, 0, 1]);
  for (const key of ['translationsEnabledX', 'translationsEnabledY', 'translationsEnabledZ',
    'rotationsEnabledX', 'rotationsEnabledY', 'rotationsEnabledZ', 'enabled']) equal(d[key], true);
  return true;
}
function journal(rows, methods, phase, row) {
  requireThat(Array.isArray(rows)); equalData(rows.map(e => e.method), methods);
  rows.forEach((e, index) => {
    equal(e.phase, phase); equal(e.nativeStepsBefore, row.nativeSteps); equal(e.nativeStepsAfter, row.nativeSteps);
    requireThat(Number.isInteger(e.order) && e.order < row.apiJournalLength);
    if (index) equal(e.order, rows[index - 1].order + 1);
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
const AWAKE_SOURCE_KIND = 'original-controller-motionless-awake-fire';
const AWAKE_READINESS_KIND = 'verified-original-motionless-awake-created';
// Only the byte-verified original initial arena supplies numerical state. The
// source receipt records what the unchanged UI observed before accepted fire;
// its duplicate vectors are checked, never used to replace native body fields.
function projectInitialReadiness(row, originalBodies) {
  const objects = row.application.registry.objects;
  equal(objects.length, 4);
  const bodies = objects.map(object => {
    const matches = originalBodies.filter(body => same(body.handle, object.body));
    equal(matches.length, 1, 'Every readiness body retains its exact native generation');
    return matches[0];
  });
  if (!Object.hasOwn(row, 'sourceReadiness')) {
    for (const b of bodies) equal(b.activation.sleeping,true);
    return undefined;
  }
  const source = row.sourceReadiness;
  equalData(Object.keys(source).sort(), ['kind', 'sourceSchema', 'initialSnapshotSha256',
    'anyMotion', 'fireAccepted', 'bodies'].sort());
  equal(source.kind, AWAKE_SOURCE_KIND); equal(source.sourceSchema, AWAKE_SOURCE_SCHEMA);
  equal(row.boundary, 'goalStrikeCreated'); equal(row.candidateInput, true);
  equal(row.hCount, 0); equal(row.outerStep, 0); equal(row.outerSubstep, 0);
  requireThat(/^[a-f0-9]{64}$/.test(row.snapshotSha256));
  equal(source.initialSnapshotSha256, row.snapshotSha256);
  equal(source.anyMotion, false); equal(source.fireAccepted, true);
  const views = bodies.map(b => {
    equal(b.body_type, 'Dynamic'); equal(typeof b.activation.sleeping, 'boolean');
    for (const vector of [b.vels.linvel, b.vels.angvel]) {
      requireThat(Array.isArray(vector) && vector.length === 3 &&
        vector.every(x => Number.isFinite(x) && Object.is(f(x), x)), 'Exact finite native readiness velocity');
    }
    return {body: copy(b.handle), sleeping: b.activation.sleeping,
      linear: copy(b.vels.linvel), angular: copy(b.vels.angvel)};
  });
  equalData(source.bodies, views, 'Observed readiness must equal byte-verified initial body state');
  requireThat(views.some(b => !b.sleeping), 'Awake-ready origin cannot relabel an all-sleep origin');
  // PhysicsLab.anyMotion uses these strict comparisons and ignores sleeping
  // bodies. Do not quantize thresholds, zero a velocity, or force any sleep bit.
  equal(views.some(b => !b.sleeping &&
    (Math.hypot(...b.linear) > .002 || Math.hypot(...b.angular) > .05)), false,
  'The actual initial native bodies must satisfy unchanged original UI readiness');
  return {kind: AWAKE_READINESS_KIND, sourceSchema: source.sourceSchema,
    initialSnapshotSha256: row.snapshotSha256, bodies: views, anyMotion: false, fireAccepted: true};
}

async function exportInitialSeed(input) {
  equalData(Object.keys(input).sort(), ['goalStrikeCreated', 'strikeCreationJournal']);
  const {goalStrikeCreated: row, strikeCreationJournal} = input;
  equal(row.boundary, 'goalStrikeCreated'); equal(row.candidateInput, true);
  equal(row.sourceRevision, D.SOURCE_REVISION); equal(row.engineSha256, D.ENGINE_SHA256);
  equal(row.hCount, 0); equal(row.outerStep, 0); equal(row.outerSubstep, 0);
  requireThat(Number.isInteger(row.application.steps) && row.application.steps > 0);
  equal(row.nativeSteps, 72 + row.application.steps,
    'Original constructor plus placement settling only, not a preceding shot');
  requireThat(Number.isFinite(row.application.time) && row.application.time > 0);
  equal(row.application.shots, 1);
  equal(row.application.controller.gameMode, 'four');
  equal(row.application.controller.selectedId, 1);
  equal(row.application.cue.selectedId, row.application.controller.selectedId);
  equal(row.application.cue.started, row.application.time);
  equal(row.application.cue.contacted, false);
  equalData(row.application.cue.contacts, []);
  equalData(row.application.cue.obstructions, []);
  equal(row.application.game.pending.cueId, 1);
  equal(row.application.game.pending.foul, false);
  equalData(row.application.game.pending.reds, []);
  Variant.validateSettings(row.application.controller.settings);
  equal(row.snapshotBytes, row.snapshot.length);
  equal(await hash(row.snapshot), row.snapshotSha256);
  equalData(D.encodeLosslessTree(row.typedState), row.snapshot);
  equal(row.verification.nativeBincodeByteIdentical, true);
  equal(row.verification.javascriptTypedReencodeByteIdentical, true);
  // Re-project the byte-verified typed initial tree, not caller convenience
  // copies of mass, IDs, managers or queues that might contain a later state.
  const state = row.typedState;
  const occupied = field => F(F(F(state, field), field), 'items').items.flatMap((entry, index) =>
    entry.variant === 'Occupied' ? [{handle: {index, generation: Number(F(entry, 'generation').value)},
      ...plain(F(entry, 'value'))}] : []);
  const allBodies = occupied('bodies'), colliders = occupied('colliders');
  equal(allBodies.length, 23); equal(colliders.length, 27);
  const registry = row.application.registry, cue = row.application.cue;
  equal(registry.objects.length, 4); equal(registry.statics.length, 16);
  equal(registry.staticCount, 16); requireThat(cue);
  equalData(registry.objects.map(o => o.id), [1, 2, 3, 4]);
  equalData(registry.objects.map(o => o.index), [0, 1, 2, 3]);
  const selected=registry.objects.find(o=>o.id===row.application.controller.selectedId);
  requireThat(selected,'Selected source object ID is not an array index');
  equal(registry.objects.indexOf(selected), 0);
  const others=registry.objects.filter(o=>o!==selected);
  const roles={ball:copy(selected.body),...Object.fromEntries(others.map((o,i)=>['otherBall'+(i+1),copy(o.body)])),
    floor:copy(registry.statics.find(s=>s.kind==='cloth').body),shaft:copy(cue.shaft),head:copy(cue.head),guide:copy(cue.guide)};
  const bodies = Object.fromEntries(Object.entries(roles).map(([role, handle]) => {
    const body = allBodies.find(b => same(b.handle, handle)); requireThat(body); return [role, copy(body)];
  }));
  const initialReadiness=projectInitialReadiness(row,allBodies);
  const events=journal(strikeCreationJournal,CUE_METHODS,'goalStrikeCreation',row);
  const created = {sourceRevision: row.sourceRevision, engineSha256: row.engineSha256,
    boundary:'goalStrikeCreated',originalPlacedGoalFourBallCreation:true,sourceNativeSteps:row.nativeSteps,sourceApplicationTime:row.application.time,snapshotSha256:row.snapshotSha256,
    sourceApplicationSteps:row.application.steps,sourceShots:1,sourceSelectedId:1,sourceSelectedIndex:0,
    ...(initialReadiness?{initialReadiness:copy(initialReadiness)}:{}),
    bodies, colliders, islands: plain(F(state, 'islands')),
    modifiedBodies: plain(F(F(state, 'bodies'), 'modified_bodies'))[0],
    modifiedColliders: plain(F(F(state, 'colliders'), 'modified_colliders'))[0],
    jointState: plain(F(state, 'impulse_joints'))};
  const freshRoles = ['shaft', 'head', 'guide'];
  equalData(created.modifiedBodies.filter(h=>freshRoles.some(role=>same(roles[role],h))),freshRoles.map(role=>roles[role]));
  for(const role of ['ball','otherBall1','otherBall2','otherBall3']){const b=bodies[role];if(!initialReadiness)equal(b.activation.sleeping,true);requireThat(Object.values(b.ids).every(x=>x!==0xffffffff));requireThat(b.mprops.max_extent>0);equal(b.colliders.length,2);}
  equalData(created.modifiedColliders, freshRoles.flatMap(role => bodies[role].colliders));
  const sourceJournal = strikeCreationJournal;
  const numericInputs = freshRoles.map(role => {
    const b = bodies[role], m = b.mprops, local = m.local_mprops;
    equal(b.changes, 255); requireThat(Object.values(b.ids).every(id => id === 0xffffffff));
    const bodyEvent = sourceJournal.find(e => e.method === 'createRigidBody' && same(e.result.handle, roles[role]));
    requireThat(bodyEvent); equal(bodyStartedDefault(bodyEvent), true);
    const bd = descriptor(bodyEvent.args[0]); equal(bd.status, role === 'guide' ? 1 : 0);
    equalData(vector(bd.translation, ['x', 'y', 'z']).map(f), b.pos.position.translation);
    equalData(vector(bd.rotation, ['x', 'y', 'z', 'w']).map(f), b.pos.position.rotation);
    const attachments = b.colliders.map(handle => {
      const c = colliders.find(c => same(c.handle, handle)); requireThat(c); requireThat(same(c.parent.handle, roles[role]));
      const event = sourceJournal.find(e => e.method === 'createCollider' && same(e.result.handle, handle));
      requireThat(event); requireThat(same(event.args[1].handle, roles[role]));
      const cd = descriptor(event.args[0]), shape = descriptor(cd.shape);
      equal(cd.enabled, true); equal(cd.massPropsMode, 1);
      equal(c.mprops.variant, 'Mass'); equal(f(cd.mass), c.mprops.value);
      equal(f(shape.radius), c.shape.value.radius);
      equal(shape.type, c.shape.variant === 'Ball' ? 0 : 10);
      if (c.shape.variant === 'Cylinder') equal(f(shape.halfHeight), c.shape.value.half_height);
      equalData(vector(cd.translation, ['x', 'y', 'z']).map(f), c.parent.pos_wrt_parent.translation);
      equalData(vector(cd.rotation, ['x', 'y', 'z', 'w']).map(f), c.parent.pos_wrt_parent.rotation);
      return {handle: copy(handle), shape: c.shape.variant, halfHeight: c.shape.value.half_height ?? 0,
        radius: c.shape.value.radius, massMode: c.mprops.variant, mass: c.mprops.value,
        enabled: c.flags.enabled === 'Enabled', localTranslation: copy(c.parent.pos_wrt_parent.translation),
        localRotation: copy(c.parent.pos_wrt_parent.rotation)};
    });
    const attachedEvents = sourceJournal.filter(e => e.method === 'createCollider' && same(e.args[1].handle, roles[role]));
    equalData(attachedEvents.map(e => e.result.handle), b.colliders);
    return I.validate({kind:'source-created-cue-body-initialization',
      sourceRevision: created.sourceRevision, phase: 'post-source-strike-pre-first-h', role,
      bodyType: b.body_type, enabled: b.enabled, lockedAxes: m.flags, initialMaxExtent: m.max_extent,
      additionalLocalMass: m.additional_local_mprops, initialLocalMassWasDefault: true,
      translation: copy(b.pos.position.translation), rotation: copy(b.pos.position.rotation),
      localCom: copy(local.local_com), localInvMass: local.inv_mass,
      invPrincipalInertia: copy(local.inv_principal_inertia), principalFrame: copy(local.principal_inertia_local_frame),
      colliders: attachments, creationColliders: copy(attachments)});
  });
  return {kind: 'original-placed-goal-four-ball-initialization-component-seed', numericInputs,
    ...(initialReadiness?{initialReadiness:copy(initialReadiness)}:{}),
    userChanges: {created, roles, events},
    provenance: {sourceRevision: created.sourceRevision, engineSha256: created.engineSha256,
      initialSnapshotSha256: created.snapshotSha256, boundary:'goalStrikeCreated',nativeSteps:row.nativeSteps,sourceApplicationTime:row.application.time,
      sourceApplicationSteps: row.application.steps, sourceShots: 1, selectedId: 1, selectedIndex: 0,
      strikeCreationJournalSha256: await journalDigest(strikeCreationJournal),
      ...(initialReadiness?{initialReadiness:copy(initialReadiness)}:{}),
      expectedFirstHStateIncluded: false, broadPhaseBirthImplemented: false, contactBirthImplemented: false}};
}
export {exportInitialSeed,projectInitialReadiness,AWAKE_SOURCE_KIND,AWAKE_READINESS_KIND};
