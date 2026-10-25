'use strict';
// Read-only artifact + scalar contract tests. No Rapier init/native execution,
// decoder invocation, restored world, GPU, or candidate expected-state input.
const {test, before} = require('node:test'), assert = require('node:assert/strict');
const C = require('./four-ball-created-fixture.cjs'), E = require('./four-ball-initialization-seed.cjs');
const I = require('../src/experimental-cue-initialization');
let record, seed, initialInput;
before(() => {
  ({record} = C.loadArtifact(process.env.FOUR_BALL_CREATION_V8));
  initialInput = {strikeCreated: record.boundaries.strikeCreated,
    modeCreationJournal: record.modeCreationJournal, strikeCreationJournal: record.strikeCreationJournal};
  seed = E.exportInitialSeed(initialInput);
});
const same = (a, b) => a.index === b.index && a.generation === b.generation;
const numeric = () => Object.fromEntries(seed.numericInputs.map(s => [s.role, I.initializeReference(s)]));
const prepare = () => I.initializeFourBallUserChanges(seed.userChanges, numeric());

test('initial-only exporter retains exact source creation provenance and never an expected h', () => {
  assert.equal(seed.provenance.expectedFirstHStateIncluded, false);
  assert.equal(seed.provenance.initialSnapshotSha256, record.boundaries.strikeCreated.snapshotSha256);
  assert.equal(seed.provenance.nativeSteps, 72);
  assert.deepEqual(seed.numericInputs.map(s => s.role), ['freshBall', 'shaft', 'head', 'guide']);
  assert.equal(I.buildPlan().inputFloats, 40);
  assert.deepEqual(Object.keys(seed.userChanges).sort(), ['created', 'events', 'modeEvents', 'roles']);
  assert.equal(seed.userChanges.modeEvents.length, 3); assert.equal(seed.userChanges.events.length, 13);
  assert.equal('snapshot' in seed.userChanges.created, false);
  assert.equal('typedState' in seed.userChanges.created, false);
  assert.throws(() => E.exportInitialSeed({...initialInput, expected: record.boundaries['firstH.postWorld']}));
  assert.throws(() => E.exportInitialSeed({...initialInput, strikeCreated: record.boundaries['firstH.preWorld']}));
  assert.throws(() => E.exportInitialSeed({...initialInput, strikeCreated: record.boundaries.modeCreated}));
});

test('fresh two-Ball attachment fold is already initialized, not zero mass or a replacement formula', () => {
  const s = seed.numericInputs[0], out = numeric().freshBall, created = seed.userChanges.created.bodies.freshBall;
  assert.deepEqual(s.colliders.map(c => [c.shape, c.mass]), [['Ball', Math.fround(.21)], ['Ball', 0]]);
  assert.equal(s.initialMaxExtent, 0); assert.equal(s.localInvMass, 4.761904716491699);
  assert.deepEqual(s.invPrincipalInertia, [12590.1357421875, 12590.1357421875, 12590.1357421875]);
  assert.deepEqual(out.worldCom, created.mprops.world_com);
  assert.deepEqual(out.invMass, created.mprops.effective_inv_mass);
  assert.deepEqual(out.invInertia, Object.values(created.mprops.effective_world_inv_inertia));
  assert.equal(out.maxExtent, Math.fround(.03075));
  assert.equal(out.ccdThickness, created.ccd.ccd_thickness);
  assert.deepEqual(out.colliders[0], out.colliders[1], 'Both massful and massless attachments have source world transforms');
  assert.deepEqual(out.localMassIdentity, {localCom: s.localCom, localInvMass: s.localInvMass,
    invPrincipalInertia: s.invPrincipalInertia, principalFrame: s.principalFrame});
});

test('strict fresh-ball admission rejects generalized mass, geometry, order, and changed attachments', () => {
  for (const mutate of [s => {s.kind = 'source-created-cue-body-initialization';},
    s => {s.localInvMass = 0;}, s => {s.invPrincipalInertia[0] = Math.fround(12590.14);},
    s => {s.localCom[0] = Math.fround(.001);}, s => {s.additionalLocalMass = {Mass: 0};},
    s => {s.colliders.reverse(); s.creationColliders.reverse();},
    s => {s.colliders[1].mass = .5; s.creationColliders[1].mass = .5;},
    s => {s.colliders[1].enabled = false; s.creationColliders[1].enabled = false;},
    s => {s.colliders[1].radius = .04; s.creationColliders[1].radius = .04;},
    s => {s.colliders[1].localTranslation[0] = 1; s.creationColliders[1].localTranslation[0] = 1;},
    s => {s.initialMaxExtent = Math.fround(.03075);}, s => {s.initialLocalMassWasDefault = false;}]) {
    const bad = structuredClone(seed.numericInputs[0]); mutate(bad); assert.throws(() => I.initializeReference(bad));
  }
  seed.numericInputs.slice(1).forEach(s => assert.equal(I.validate(s).kind, 'source-created-cue-body-initialization'));
});

test('source mode and strike journals are checked against byte-verified initial attachments', () => {
  for (const mutate of [x => {x.modeCreationJournal.reverse();},
    x => {x.modeCreationJournal[1].args[0].fields.mass = 0;},
    x => {x.modeCreationJournal[2].args[1].handle.index = 20;},
    x => {x.modeCreationJournal[0].args[0].fields.mass = 1;},
    x => {x.strikeCreationJournal[0].args[0].fields.centerOfMass.fields.x = 1;},
    x => {x.modeCreationJournal[0].nativeStepsAfter = 73;}]) {
    const bad = structuredClone(initialInput); mutate(bad); assert.throws(() => E.exportInitialSeed(bad));
  }
  const poisonedConvenience = {...initialInput, strikeCreated: {...initialInput.strikeCreated,
    bodies: record.boundaries['firstH.postWorld'].bodies, state: record.boundaries['firstH.postWorld'].state}};
  assert.deepEqual(E.exportInitialSeed(poisonedConvenience), seed, 'Exporter re-projects verified initial typed tree, not later convenience projections');
});

test('source registration owns initial queue order, exact u32 IDs, allocator and cue links only', () => {
  const out = prepare(), created = seed.userChanges.created, expected = record.boundaries['firstH.postWorld'];
  assert.equal(out.phase, 'source-user-changes-and-connectivity-complete-pre-collision');
  assert.equal(out.manager.active_set_epoch, 23);
  assert.deepEqual(out.manager.islands, expected.state.islands.islands);
  assert.deepEqual(out.manager.persistent.free_islands, [5]);
  assert.equal(out.manager.persistent.islands.n, 5); assert.equal(out.manager.persistent.islands.v[5], null);
  for (const role of ['freshBall', 'shaft', 'head', 'guide']) {
    const body = out.bodies.find(b => b.role === role), target = expected.bodies.find(b => same(b.handle, body.handle));
    assert.deepEqual(body.ids, target.ids, role + ' registration IDs');
    assert.equal(body.changes, 255, 'Pre-collision flags are not cleared early');
  }
  assert.deepEqual(out.bodies.find(b => b.role === 'freshBall').ids,
    {active_island_id: 0, active_set_id: 3, island_id: 3, island_index: 0});
  assert.equal(out.jointEventJournal.length, 13);
  assert.equal(out.manager.persistent.removal_journal.length, 4);
  assert.deepEqual(out.manager.persistent.joint_link_locs, expected.state.islands.persistent.joint_link_locs);
  assert.deepEqual(out.manager.persistent.islands.v[4].joint_links, expected.state.islands.persistent.islands.v[4].joint_links);
  assert.deepEqual(out.consumedModifiedBodies, created.modifiedBodies);
  assert.deepEqual(out.consumedModifiedColliders, created.modifiedColliders);
  assert.equal(out.colliders.filter(c => out.consumedModifiedColliders.some(h => same(h, c.handle))).every(c => c.changes !== 0), true);
  assert.equal(out.manager.persistent.sleep_scan_stamp, 72, 'Energy scan not owned by Init');
});

test('missing fourth cloth contact is a real blocker, never removed from expected to claim full first h', () => {
  const out = prepare(), expected = record.boundaries['firstH.postWorld'].state.islands;
  assert.notDeepEqual(out.manager, expected);
  assert.deepEqual(out.manager.persistent.islands.v[3].contact_links, []);
  assert.equal(expected.persistent.islands.v[3].contact_links.length, 1);
  assert.deepEqual(out.manager.persistent.contact_link_locs, seed.userChanges.created.islands.persistent.contact_link_locs);
  assert.equal(expected.persistent.contact_link_locs.length, 6);
  assert.equal(out.pendingCollisionWork.requiresFourthClothContact, true);
  assert.equal(out.pendingCollisionWork.postCollisionManagerComplete, false);
  assert.deepEqual(out.pendingCollisionWork.requiresBroadPhaseInsertions, seed.userChanges.created.modifiedColliders);
  assert.throws(() => I.finishCollisionPhase(out, {kind: 'owned-first-h-collision-admission',
    newCueSolverContacts: 0, allOriginalBallPairsOwned: true}), /collision birth is not owned/);
  const stripped = structuredClone(out); delete stripped.pendingCollisionWork;
  assert.throws(() => I.finishCollisionPhase(stripped, {kind: 'owned-first-h-collision-admission',
    newCueSolverContacts: 0, allOriginalBallPairsOwned: true}), /collision birth is not owned/);
  assert.equal(I.CAPABILITY.wholeWorld, false); assert.equal(I.CAPABILITY.fourthBallCollisionBirth, false);
});

test('four-ball manager rejects missing provenance and leaves caller initial data unchanged', () => {
  const before = structuredClone(seed); prepare(); assert.deepEqual(seed, before);
  assert.throws(() => I.initializeUserChanges(seed.userChanges, numeric()), /Only explicit initial/);
  const stripped = structuredClone(seed.userChanges); delete stripped.modeEvents;
  assert.throws(() => I.initializeUserChanges(stripped, numeric()), /distinct initializer/);
  for (const mutate of [r => {r.expected = record.boundaries['firstH.postWorld'];},
    r => {r.modeEvents.pop();}, r => {r.modeEvents[0].initialLocalMassWasDefault = false;},
    r => {r.modeEvents[2].handle.index = 22;}, r => {r.created.boundary = 'firstH.postWorld';},
    r => {r.created.modifiedBodies.reverse();}]) {
    const bad = structuredClone(seed.userChanges); mutate(bad);
    assert.throws(() => I.initializeFourBallUserChanges(bad, numeric()));
  }
});

test('removing both N4 result labels cannot finalize a structurally four-ball manager', () => {
  const stripped = prepare(); delete stripped.pendingCollisionWork; delete stripped.roles.freshBall;
  assert.equal(stripped.manager.persistent.islands.v[3].contact_links.length, 0);
  assert.throws(() => I.finishCollisionPhase(stripped, {kind: 'owned-first-h-collision-admission',
    newCueSolverContacts: 0, allOriginalBallPairsOwned: true}), /Legacy creation structure/);
  // Even a forged three-entry consumed queue cannot hide the actual extra
  // dynamic sphere and full 27-collider source structure.
  stripped.consumedModifiedBodies.shift(); stripped.consumedModifiedColliders.splice(0, 2);
  assert.throws(() => I.finishCollisionPhase(stripped, {kind: 'owned-first-h-collision-admission',
    newCueSolverContacts: 0, allOriginalBallPairsOwned: true}), /Legacy creation structure/);
});

test('relabeling the fresh ball as another settled ball cannot enter the legacy initializer', () => {
  const relabeled = structuredClone(seed.userChanges);
  delete relabeled.modeEvents; delete relabeled.created.originalFourBallCreation;
  relabeled.roles.otherBall3 = relabeled.roles.freshBall; delete relabeled.roles.freshBall;
  relabeled.created.bodies.otherBall3 = relabeled.created.bodies.freshBall; delete relabeled.created.bodies.freshBall;
  assert.equal(relabeled.created.bodies.otherBall3.mprops.max_extent, 0);
  assert.throws(() => I.initializeUserChanges(relabeled, numeric()), /Legacy creation structure/);
  relabeled.created.modifiedBodies.shift(); relabeled.created.modifiedColliders.splice(0, 2);
  assert.throws(() => I.initializeUserChanges(relabeled, numeric()), /Legacy creation structure/);
});

test('removing fourth registry rows cannot hide its real active and persistent island membership', () => {
  const stripped = prepare(), h = stripped.roles.freshBall;
  delete stripped.pendingCollisionWork; delete stripped.roles.freshBall;
  stripped.bodies = stripped.bodies.filter(b => !same(b.handle, h));
  stripped.colliders = stripped.colliders.filter(c => !same(c.parent.handle, h));
  stripped.consumedModifiedBodies.shift(); stripped.consumedModifiedColliders.splice(0, 2);
  assert.equal(stripped.manager.islands.v[0].bodies.length, 6);
  assert.deepEqual(stripped.manager.persistent.islands.v[3].bodies, [h]);
  assert.throws(() => I.finishCollisionPhase(stripped, {kind: 'owned-first-h-collision-admission',
    newCueSolverContacts: 0, allOriginalBallPairsOwned: true}), /membership\/body registry mismatch/);
});
