'use strict';
// SPDX-License-Identifier: Apache-2.0
// Original placement -> stationary but awake retained red pair -> default fire -> native pair sleep.
// Derived from cushion-coupled-original-controller.cjs. The source fire() rejects
// anyMotion(), not awake bodies. Capture the first genuinely stationary native
// frame with a retained awake 3/4 pair, rather than imposing fixture-only sleep.
// No engine, controller, placement method, wake flag, or physical parameter is replaced.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const F = require('./four-ball-created-fixture.cjs');
const {hash, parts, observeMethod, journalDigest} = F;
const copy = x => structuredClone(x);
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'original-controller-four-ball-awake-pair-holdout-v1';
const MAX_SETTLE_OUTER = 2000, MAX_OUTER = 16000, GRID = 256;
const INITIAL_BOUNDARY = 'goalStrikeCreated';
const CUE_METHODS = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
const BASE_INPUTS = Object.freeze({
  positive: Object.freeze({name: 'two-red-positive-hypothesis', requiredOutcome: 'positive',
    placements: Object.freeze([{id: 1, x: -.5, z: 0}, {id: 2, x: -.8, z: .4},
      {id: 3, x: .0435, z: .0435}, {id: 4, x: .2615, z: -.2}])}),
  lateFoul: Object.freeze({name: 'two-red-then-yellow-hypothesis', requiredOutcome: 'late-opponent-foul',
    placements: Object.freeze([{id: 1, x: -.5, z: 0}, {id: 2, x: .2, z: -.55},
      {id: 3, x: .0435, z: .0435}, {id: 4, x: .2615, z: -.2}])})
});
const SOURCES = ['tests/initial-pair-original-awake-postsleep-controller.cjs', 'tests/four-ball-created-fixture.cjs',
  'src/controller.js', 'src/physics.js', 'src/game-rules.js', 'src/math.js',
  'src/render-cadence.js', 'vendor/rapier.cjs', 'tools/rapier-snapshot-decoder/index.cjs'];
const vec = x => [x.x, x.y, x.z], quat = x => [x.x, x.y, x.z, x.w];
function sample(body) {
  const m = body.effectiveWorldInvInertia();
  // Rapier getters reuse WASM scratch storage: copy the matrix before other getters.
  const invInertia = [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33];
  return {translation: vec(body.translation()), rotation: quat(body.rotation()),
    linear: vec(body.linvel()), angular: vec(body.angvel()),
    invInertia, sleeping: body.isSleeping()};
}
// Shape intentionally matches the settled-turn original fixture, not candidate runtime state.
function registry(lab) {
  return {staticCount: lab.statics.length,
    objects: lab.objects.map((o, index) => ({index, id: o.id, label: o.label, kind: o.kind,
      shape: o.shape, radius: o.radius, mass: o.mass, body: parts(o.body.handle),
      collider: parts(o.collider.handle), pairCollider: parts(o.pairCollider.handle)})),
    statics: lab.statics.map((o, index) => ({index, label: o.label, kind: o.kind,
      body: parts(o.body.handle), collider: parts(o.collider.handle)}))};
}
function application(c) {
  const lab = c.lab, cue = lab.cue;
  return {time: lab.time, steps: lab.steps, shots: lab.shots, revision: lab.revision,
    dt: lab.dt, strokeSubsteps: lab.strokeSubsteps, nextId: lab.nextId, params: copy(lab.params),
    events: copy(lab.events), registry: registry(lab),
    controller: {gameMode: c.state.gameMode, selectedId: c.state.selectedId, paused: c.state.paused,
      settings: copy(c.state.settings), undoCount: c.undoStack.length, redoCount: c.redoStack.length},
    game: c.game?.snapshot() || null,
    cue: cue ? {shaft: parts(cue.body.handle), head: parts(cue.head.handle), guide: parts(cue.guide.handle),
      shaftCollider: parts(cue.shaft.handle), tipCollider: parts(cue.tip.handle), neckCollider: parts(cue.neck.handle),
      flex: parts(cue.flex.handle), prismatic: parts(cue.joint.handle), selectedId: cue.selectedId,
      pose: copy(cue.pose), started: cue.started, contacted: cue.contacted,
      contacts: copy([...cue.contacts]), obstructions: copy([...cue.obstructions]), stats: copy(cue.stats)} : null};
}
function identity() {
  return {schema: SCHEMA, node: process.version, v8: process.versions.v8, maxOuter: MAX_OUTER,
    maxSettleOuter: MAX_SETTLE_OUTER, grid: GRID, engineVersion: F.D.ENGINE_VERSION,
    engineSha256: F.D.ENGINE_SHA256, sourceRevision: F.D.SOURCE_REVISION,
    sources: Object.fromEntries(SOURCES.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]))};
}
function validateInput(input) {
  assert.equal(typeof input.name, 'string');
  assert.equal(input.requiredOutcome, 'retained-pair-native-sleep');
  assert.deepEqual(input.placements.map(p => p.id).sort(), [1, 2, 3, 4]);
  for (const p of input.placements) {
    assert.deepEqual(Object.keys(p).sort(), ['id', 'x', 'z']);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    // No guessed geometric bound: the original move result below is required.
    assert.ok(Math.abs(p.x) < 3 && Math.abs(p.z) < 2.5);
  }
}
function outcome(events, result, fullRest) {
  const goal = events.find(e => e.goalFirstReached), opponent = events.find(e => e.opponentCueContact);
  const validGoal = !!goal && !goal.gameAfter.pending.foul;
  const positive = !!(fullRest && validGoal && !opponent && result?.delta === 1 && result.nextCue === 1);
  const lateOpponentFoul = !!(fullRest && validGoal && opponent && opponent.order > goal.order &&
    opponent.event.time > goal.event.time && result?.delta === -1 && result.nextCue === 2);
  return {positive, lateOpponentFoul, goalEventOrder: goal?.order ?? null,
    goalTime: goal?.event.time ?? null, opponentEventOrder: opponent?.order ?? null,
    opponentTime: opponent?.event.time ?? null, goalToOpponentSeconds: goal && opponent ? opponent.event.time - goal.event.time : null};
}
function captureOriginal(input, {recordFrames = true, journal = true} = {}) {
  validateInput(input);
  const restores = [], boundaries = {}, apiJournal = [], events = [], frames = [], checkpoints = [],
    placements = [], pathSamples = [], references = new WeakMap();
  let c, lab, phase = 'constructor', nativeSteps = 0, settleOuter = 0, outer = 0, substep = 0,
    subdivisions = 64, hCount = 0, lastPresent = true, finishResult = null, started = null, lastEventCount = 0, firstPairSleepH = null, firstPairSleepOuter = null;
  const reference = (value, kind) => {
    references.set(value, {kind, ...(typeof value.handle === 'number' ? {handle: parts(value.handle)} : {})}); return value;
  };
  const argument = value => {
    if (value === null || typeof value !== 'object') return typeof value === 'function'
      ? {kind: 'original-callback', sourceSha256: hash(value.toString())} : value;
    if (references.has(value)) return copy(references.get(value));
    if (ArrayBuffer.isView(value)) return {kind: value.constructor.name, values: Array.from(value)};
    if (Array.isArray(value)) return value.map(argument);
    const fields = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      assert.ok('value' in descriptor, 'Read-only journal never invokes accessors'); fields[key] = argument(descriptor.value);
    }
    return {kind: 'descriptor', className: value.constructor?.name || null, fields};
  };
  const checkpoint = name => {
    assert.ok(!Object.hasOwn(boundaries, name));
    boundaries[name] = {boundary: name, candidateInput: name === INITIAL_BOUNDARY, nativeSteps,
      hCount, outerStep: outer, outerSubstep: substep, snapshot: lab.world.takeSnapshot(),
      application: application(c), ...(journal ? {apiJournalLength: apiJournal.length} : {})};
  };
  const journalEnabled = () => journal && ['constructor', 'modeCreation', 'placement', 'goalStrikeCreation',
    'firstH.preApplication', 'firstH.world', 'firstH.postApplication'].includes(phase);
  const observeApi = (object, method, createdKind) => {
    restores.push(observeMethod(object, method, {
      before(receiver, args) {
        if (!journalEnabled()) return null;
        const row = {order: apiJournal.length, phase, target: copy(references.get(receiver) || {kind: 'World'}),
          method, args: args.map(argument), nativeStepsBefore: nativeSteps}; apiJournal.push(row); return row;
      },
      after(receiver, args, result, row) {
        if (createdKind) reference(result, createdKind);
        if (row) {row.result = argument(result); row.nativeStepsAfter = nativeSteps;}
        if (createdKind === 'RigidBody') for (const name of ['setLinvel', 'setAngvel', 'setTranslation', 'setRotation',
          'wakeUp', 'sleep', 'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'resetForces',
          'resetTorques', 'recomputeMassPropertiesFromColliders']) observeApi(result, name);
        if (createdKind === 'ImpulseJoint') for (const name of ['setContactsEnabled', 'setLimits'])
          if (typeof result[name] === 'function') observeApi(result, name);
      }
    }));
  };
  try {
    if (journal) {
      for (const [method, kind] of [['createRigidBody', 'RigidBody'], ['createCollider', 'Collider'],
        ['createImpulseJoint', 'ImpulseJoint']]) observeApi(F.R.World.prototype, method, kind);
      for (const name of ['propagateModifiedBodyPositionsToColliders', 'removeRigidBody']) observeApi(F.R.World.prototype, name);
    }
    restores.push(observeMethod(F.R.World.prototype, 'step', {
      before(receiver, args) {
        if (lab) {assert.equal(receiver, lab.world); assert.equal(args.length, 1); assert.equal(args[0], lab.queue);}
        else assert.equal(args.length, 0);
        if (started !== null && hCount === 0) {checkpoint('firstH.preWorld'); phase = 'firstH.world';}
      },
      after() {
        nativeSteps++;
        if (started !== null && hCount === 0) {checkpoint('firstH.postWorld'); phase = 'firstH.postApplication';}
      }
    }));
    c = new LabController(); c.lab = new PhysicsLab(F.R); lab = c.lab;
    reference(lab.world, 'World'); reference(lab.queue, 'EventQueue');
    assert.equal(nativeSteps, 72); checkpoint('constructor');
    phase = 'modeCreation'; c.state.gameMode = 'four'; c.setupGame(); checkpoint('modeCreated');
    const originalObjects = lab.objects.slice();
    assert.equal(originalObjects.length, 4); assert.deepEqual(c.state.settings, F.SETTINGS);
    phase = 'placement';
    for (const p of input.placements) {
      const position = {x: p.x, y: lab.get(p.id).radius + .00005, z: p.z}, before = sample(lab.get(p.id).body);
      const accepted = c.move(p.id, position);
      placements.push({method: 'LabController.move', id: p.id, position, accepted,
        before, after: sample(lab.get(p.id).body)});
      assert.equal(accepted, true, 'Original collision-safe placement accepted for ball ' + p.id);
    }
    checkpoint('placementComplete'); phase = 'settling';
    // The normal UI allows firing after motion has stopped and before native
    // sleep. At least one genuine step must register the moved pair; this is
    // not an immediate fire with an invented retained cache.
    const ready = () => {
      if (settleOuter === 0 || lab.anyMotion() || lab.get(3).body.isSleeping() || lab.get(4).body.isSleeping()) return false;
      let active = false;
      lab.world.contactPair(lab.get(3).pairCollider, lab.get(4).pairCollider, m => { if (m.numSolverContacts() > 0) active = true; });
      return active;
    };
    while (settleOuter < MAX_SETTLE_OUTER && !ready()) {lab.step(); settleOuter++;}
    assert.ok(ready(), 'Original UI permits a stationary but genuinely awake retained red pair before fire');
    assert.equal(lab.cue, null); assert.equal(c.game.pending, null); assert.equal(c.state.selectedId, 1);
    assert.ok(lab.objects.every((o, i) => o === originalObjects[i]), 'No original ball replaced');
    assert.deepEqual(c.state.settings, F.SETTINGS); checkpoint('beforeStrike');
    const clearance = copy(lab.cueClearance(lab.get(1), c.state.settings));
    restores.push(observeMethod(lab, 'emit', {before(receiver, args) {
      return {before: c.game.snapshot(), event: copy(args[0])};
    }, after(receiver, args, result, token) {
      const gameAfter = c.game.snapshot(), e = token.event, pending = gameAfter.pending;
      const other = e.a?.id === 1 ? e.b : e.b?.id === 1 ? e.a : null;
      events.push({order: events.length, hCountBeforeApplication: hCount, outerStep: outer,
        outerSubstep: substep, event: e, gameBefore: token.before, gameAfter,
        goalFirstReached: token.before.pending?.reds.length !== 2 && pending?.reds.length === 2,
        opponentCueContact: other?.id === 2,
        balls: lab.objects.map(o => ({id: o.id, ...sample(o.body)}))});
    }}));
    restores.push(observeMethod(c.game, 'finish', {after(receiver, args, result) {
      assert.equal(receiver, c.game); assert.deepEqual(args, []); finishResult = copy(result);
    }}));
    const sourceMotionGate = {method: 'PhysicsLab.anyMotion', sourceFunctionSha256: hash(lab.anyMotion.toString()), observations: []};
    const sourcePreFireBodies = lab.objects.map(o => { const b = sample(o.body); return {body: parts(o.body.handle), sleeping: b.sleeping, linear: b.linear, angular: b.angular}; });
    restores.push(observeMethod(lab, 'anyMotion', {after(receiver, args, result) {
      assert.equal(receiver, lab); assert.deepEqual(args, []);
      sourceMotionGate.observations.push({phase, result});
    }}));
    phase = 'goalStrikeCreation'; const accepted = c.fire();
    const control = {settings: copy(c.state.settings), selectedId: c.state.selectedId, clearance,
      fireAccepted: accepted, reason: accepted ? null : c.state.notice};
    if (!accepted) return {schema: SCHEMA, input: copy(input), placements, settleOuter, boundaries,
      control, apiJournal, status: 'original-controller-rejected', candidateStateUsed: false};
    checkpoint(INITIAL_BOUNDARY); started = lab.time;
    assert.deepEqual(sourceMotionGate.observations, [{phase: 'goalStrikeCreation', result: false}]);
    boundaries[INITIAL_BOUNDARY].sourceReadiness = {
      kind: 'original-controller-motionless-awake-fire', sourceSchema: SCHEMA,
      initialSnapshotSha256: hash(boundaries[INITIAL_BOUNDARY].snapshot),
      anyMotion: sourceMotionGate.observations[0].result, fireAccepted: accepted, bodies: sourcePreFireBodies
    };
    const nativeStepsAtCreation = nativeSteps;
    if (journal) observeApi(lab.queue, 'drainCollisionEvents');
    restores.push(observeMethod(lab, 'angularPatchResistance', {after(receiver, args) {
      assert.equal(receiver, lab); const [h] = args; hCount++;
      const present = !!lab.cue, separation = lastPresent && !present; lastPresent = present;
      substep++; if (substep === subdivisions) {outer++; substep = 0; subdivisions = present ? 64 : 1;}
      if (recordFrames) frames.push({hCount, h, time: lab.time, elapsed: lab.time - started,
        outerStep: outer, outerSubstep: substep, cuePresent: present, separation,
        balls: lab.objects.map(o => ({id: o.id, ...sample(o.body)})),
        cue: present ? {shaft: sample(lab.cue.body), head: sample(lab.cue.head)} : null,
        events: copy(lab.events), game: c.game.snapshot(), controllerSelectedId: c.state.selectedId});
      if (hCount === 1) {checkpoint('firstH.postApplication'); phase = 'shot';}
      if (separation) checkpoint('cueWithdrawal.postApplication');
    }}));
    phase = 'firstH.preApplication';
    for (let step = 1; step <= MAX_OUTER; step++) {
      lab.step(); assert.equal(outer, step); assert.equal(substep, 0);
      const fullRest = !lab.cue && lab.objects.every(o => o.body.isSleeping());
      if (step === 1 || step % 32 === 0 || events.length !== lastEventCount || fullRest)
        pathSamples.push({outerStep: step, hCount, time: lab.time, balls: lab.objects.map(o => ({id: o.id, ...sample(o.body)}))});
      if (recordFrames && (step <= 2 || step % GRID === 0 || events.length !== lastEventCount || fullRest))
        checkpoints.push({step, reasons: [fullRest ? 'native-full-rest' : events.length !== lastEventCount ? 'contact-event' : 'fixed-grid'],
          row: {boundary: 'expected-only-goal-outer-' + step, candidateInput: false, nativeSteps,
            snapshot: lab.world.takeSnapshot(), application: application(c)}});
      lastEventCount = events.length;
      // Continue exactly two original native h after first target-pair sleep.
      // This is read-only continuation, not an unrelated whole-shot extension.
      // The original controller's score is intentionally not finalized here.
      let retainedActive = false;
      lab.world.contactPair(lab.get(3).pairCollider, lab.get(4).pairCollider, m => { if (m.numSolverContacts() > 0) retainedActive = true; });
      if (retainedActive && lab.get(3).body.isSleeping() && lab.get(4).body.isSleeping()) {
        if (firstPairSleepH === null) {firstPairSleepH = hCount; firstPairSleepOuter = outer; checkpoint('retainedPairSleeping');}
        if (hCount >= firstPairSleepH + 2) {
          assert.equal(lab.cue, null, 'This bounded source case has withdrawn the cue before pair sleep');
          assert.equal(hCount, firstPairSleepH + 2, 'Observe exactly two unmodified native h after the transition');
          checkpoint('retainedPairSleepPersistence'); break;
        }
      }
    }
    const fullRest = !!boundaries.physicalRest, pairSleep = !!boundaries.retainedPairSleepPersistence, found = outcome(events, finishResult, fullRest);
    const creationMethods = new Set(CUE_METHODS);
    const strikeCreationJournal = apiJournal.filter(row => row.phase === 'goalStrikeCreation' && creationMethods.has(row.method));
    if (journal) assert.deepEqual(strikeCreationJournal.map(row => row.method), CUE_METHODS);
    return {schema: SCHEMA, fixtureScope: 'original-controller-move-native-stationary-awake-pair-default-fire-to-pair-sleep-plus-two-h',
      readiness: {sourcePredicate: 'not PhysicsLab.anyMotion()', anyMotion: sourceMotionGate.observations[0].result, pairIds: [3, 4], pairActive: true, pairSleeping: sourcePreFireBodies.filter((_, i) => [2, 3].includes(i)).map(b => b.sleeping)},
      sourceMotionGate,
      input: copy(input), settings: copy(F.SETTINGS), selectedIndex: 0, selectedId: 1,
      constructorNativeSettlingSteps: 72, settleOuter, nativeStepsAtCreation,
      nativeSteps, hCount, outerSteps: outer, firstRestOuter: fullRest ? outer : null,
      firstPairSleepOuter, firstPairSleepH, pairSleepPersistenceH: pairSleep ? hCount : null,
      status: pairSleep ? 'native-retained-pair-sleep-persistence-complete' : 'horizon-incomplete', control, placements,
      initialBoundary: INITIAL_BOUNDARY, readyBoundary: 'beforeStrike', expectedOnlyBoundaries:
        Object.keys(boundaries).filter(x => !['beforeStrike', INITIAL_BOUNDARY].includes(x)),
      boundaries, apiJournal, strikeCreationJournal,
      pendingJointJournal: strikeCreationJournal.filter(row => ['createImpulseJoint', 'setContactsEnabled', 'setLimits'].includes(row.method)).map(copy),
      frames, events, checkpoints, pathSamples, score: finishResult, outcome: found,
      requiredOutcomeObserved: pairSleep,
      candidateStateUsed: false, nativeRestoreUsed: false};
  } finally {
    while (restores.length) restores.pop()();
    if (c) {clearTimeout(c.noticeTimer); clearTimeout(c.predictionTimer);} lab?.dispose();
  }
}
function summary(record) {
  return {schema: record.schema, input: record.input, status: record.status, settleOuter: record.settleOuter,
    firstRestOuter: record.firstRestOuter, hCount: record.hCount, control: record.control,
    score: record.score, outcome: record.outcome, requiredOutcomeObserved: record.requiredOutcomeObserved,
    contacts: record.events?.filter(e => e.event.kind === 'contact').map(e => ({order: e.order,
      time: e.event.time, elapsed: e.event.time - record.boundaries[INITIAL_BOUNDARY]?.application.time,
      a: e.event.a, b: e.event.b, position: e.event.position,
      goalFirstReached: e.goalFirstReached, opponentCueContact: e.opponentCueContact,
      pending: e.gameAfter.pending})),
    readySnapshotSha256: record.boundaries.beforeStrike && hash(record.boundaries.beforeStrike.snapshot),
    initialSnapshotSha256: record.boundaries[INITIAL_BOUNDARY] && hash(record.boundaries[INITIAL_BOUNDARY].snapshot)};
}
function verifyRecord(record, {requireOutcome = true, decoded = true} = {}) {
  assert.equal(record.schema, SCHEMA); validateInput(record.input);
  assert.equal(record.fixtureScope, 'original-controller-move-native-stationary-awake-pair-default-fire-to-pair-sleep-plus-two-h');
  assert.deepEqual(record.readiness, {sourcePredicate: 'not PhysicsLab.anyMotion()', anyMotion: false, pairIds: [3, 4], pairActive: true, pairSleeping: [false, false]});
  assert.equal(record.nativeRestoreUsed, false); assert.equal(record.candidateStateUsed, false);
  assert.equal(record.initialBoundary, INITIAL_BOUNDARY); assert.equal(record.readyBoundary, 'beforeStrike');
  assert.deepEqual(record.settings, F.SETTINGS); assert.deepEqual([record.selectedId, record.selectedIndex], [1, 0]);
  assert.equal(record.control.fireAccepted, true); assert.equal(record.control.clearance.clear, true);
  assert.equal(record.placements.length, 4); assert.ok(record.placements.every(p => p.accepted && p.method === 'LabController.move'));
  assert.equal(record.nativeStepsAtCreation, 72 + record.settleOuter);
  assert.equal(record.nativeSteps - record.nativeStepsAtCreation, record.hCount);
  assert.equal(record.frames.length, record.hCount);
  assert.deepEqual(record.strikeCreationJournal.map(row => row.method), CUE_METHODS);
  assert.equal(record.pendingJointJournal.length, 5);
  for (const row of record.strikeCreationJournal) {
    assert.equal(row.phase, 'goalStrikeCreation'); assert.equal(row.nativeStepsBefore, record.nativeStepsAtCreation);
    assert.equal(row.nativeStepsAfter, record.nativeStepsAtCreation);
  }
  const b = record.boundaries, before = b.beforeStrike, created = b[INITIAL_BOUNDARY];
  assert.deepEqual(record.sourceMotionGate.observations, [{phase: 'goalStrikeCreation', result: false}]);
  assert.equal(created.sourceReadiness.kind, 'original-controller-motionless-awake-fire');
  assert.equal(created.sourceReadiness.sourceSchema, SCHEMA); assert.equal(created.sourceReadiness.initialSnapshotSha256, hash(created.snapshot));
  assert.equal(created.sourceReadiness.anyMotion, false); assert.equal(created.sourceReadiness.fireAccepted, true);
  assert.deepEqual(Object.keys(b).filter(name => b[name].candidateInput), [INITIAL_BOUNDARY]);
  assert.equal(before.application.cue, null); assert.equal(before.application.game.pending, null);
  assert.equal(before.application.steps, record.settleOuter); assert.equal(before.application.shots, 0);
  assert.equal(created.application.shots, 1); assert.equal(created.application.cue.selectedId, 1);
  assert.equal(created.application.game.pending.cueId, 1); assert.equal(created.application.game.pending.foul, false);
  assert.deepEqual(created.application.game.pending.reds, []);
  assert.equal(created.application.time, created.application.cue.started);
  assert.equal(created.nativeSteps, record.nativeStepsAtCreation);
  assert.equal(b['firstH.postWorld'].nativeSteps, record.nativeStepsAtCreation + 1);
  assert.equal(b['firstH.postApplication'].hCount, 1);
  if (decoded) {
    for (const [name, row] of Object.entries(b)) {
      assert.equal(row.boundary, name); assert.equal(hash(row.snapshot), row.snapshotSha256);
      assert.deepEqual(F.D.encodeLosslessTree(row.typedState), Buffer.from(row.snapshot));
      assert.equal(row.verification.nativeBincodeByteIdentical, true);
      assert.equal(row.verification.javascriptTypedReencodeByteIdentical, true);
    }
    assert.equal(before.summary.bvhLeaves, 24); assert.equal(before.summary.bodies, 20);
    assert.equal(created.summary.bodies, 23); assert.equal(created.summary.colliders, 27); assert.equal(created.summary.joints, 2);
    assert.equal(F.clothPairs(before).length, 4); assert.deepEqual(F.clothPairs(created), F.clothPairs(before));
    for (const object of before.application.registry.objects) {
      const same = body => body.handle.index === object.body.index && body.handle.generation === object.body.generation;
      const oldBody = before.bodies.find(same), newBody = created.bodies.find(same);
      if ([3, 4].includes(object.id)) assert.equal(oldBody.activation.sleeping, false); assert.deepEqual(newBody, oldBody);
      const observed = created.sourceReadiness.bodies.find(x => same({handle: x.body}));
      assert.ok(observed); assert.equal(observed.sleeping, oldBody.activation.sleeping);
      assert.deepEqual(observed.linear, oldBody.vels.linvel); assert.deepEqual(observed.angular, oldBody.vels.angvel);
      assert.ok(observed.sleeping || Math.hypot(...observed.linear) <= .002 && Math.hypot(...observed.angular) <= .05, 'Exact source anyMotion threshold holds in original bytes');
    }
  }
  if (requireOutcome) {assert.equal(record.status, 'native-retained-pair-sleep-persistence-complete'); assert.equal(record.requiredOutcomeObserved, true);
    assert.ok(b.retainedPairSleeping); assert.ok(b.retainedPairSleepPersistence);
    assert.equal(record.firstPairSleepOuter + 2, record.outerSteps); assert.equal(record.firstPairSleepH + 2, record.pairSleepPersistenceH); assert.equal(record.pairSleepPersistenceH, record.hCount); assert.equal(record.score, null);
    if (decoded) for (const id of [3,4]) { const object = b.retainedPairSleeping.application.registry.objects.find(o => o.id === id);
      assert.equal(b.retainedPairSleeping.bodies.find(rb => rb.handle.index === object.body.index && rb.handle.generation === object.body.generation).activation.sleeping, true); }
  }
  if (record.status === 'native-rest-complete') {
    assert.equal(b.physicalRest.application.cue, null); assert.equal(b.controllerFinished.application.game.pending, null);
    assert.deepEqual(b.controllerFinished.snapshot, b.physicalRest.snapshot, 'Real scoring does not alter physical state');
    assert.equal(b.controllerFinished.application.controller.selectedId, record.score.nextCue);
    if (decoded) assert.ok(b.physicalRest.bodies.filter(body => body.body_type === 'Dynamic').every(body => body.activation.sleeping));
  }
  assert.deepEqual(record.outcome, outcome(record.events, record.score, record.status === 'native-rest-complete'));
  return record;
}
function decodeRecord(record) {
  for (const name of Object.keys(record.boundaries)) record.boundaries[name] = F.decodeBoundary(record.boundaries[name]);
  for (const p of record.checkpoints || []) p.row = F.decodeBoundary(p.row);
  return record;
}
async function captureArtifact(file, input, {probe = false, decode = !probe} = {}) {
  assert.equal(process.env.INITIAL_PAIR_AWAKE_SERIAL_SLOT, '1', 'Coordinator-granted serial physics slot is required');
  assert.ok(file && path.isAbsolute(file)); assert.ok(!file.startsWith('/tmp/'), 'Large artifacts belong in the workspace');
  assert.ok(!fs.existsSync(file) && !fs.existsSync(file + '.json'), 'Never overwrite original evidence');
  const id = identity(); await F.R.init(); assert.equal(F.R.version(), '0.21.0');
  const record = captureOriginal(input, {recordFrames: !probe, journal: !probe});
  if (!probe) {
    const independent = captureOriginal(input, {recordFrames: false, journal: false});
    for (const name of Object.keys(record.boundaries)) {
      assert.deepEqual(record.boundaries[name].snapshot, independent.boundaries[name].snapshot,
        'Independent no-journal original recreation agrees byte-for-byte at ' + name);
      assert.deepEqual(record.boundaries[name].application, independent.boundaries[name].application);
    }
    assert.deepEqual(record.events, independent.events);
    assert.deepEqual(record.pathSamples, independent.pathSamples);
    assert.deepEqual(summary(record), summary(independent));
    record.observerAgreement = {independentRecreations: 2,
      byteIdenticalBoundaries: Object.keys(record.boundaries), exactContactAndGameObservables: true};
  }
  if (decode) {decodeRecord(record); if (record.control.fireAccepted) verifyRecord(record, {requireOutcome: false});}
  assert.deepEqual(identity(), id, 'Source files remain frozen throughout original capture');
  const bytes = v8.serialize(record), manifest = {identity: id, sha256: hash(bytes), bytes: bytes.length,
    probe, decoded: decode, candidateStateUsed: false, nativeRestoreUsed: false, sourceRuntimeChanged: false,
    apiJournalEncoding: F.JOURNAL_ENCODING, apiJournalSha256: journalDigest(record.apiJournal), ...summary(record)};
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, bytes, {flag: 'wx'}); fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function loadArtifact(file, {requireOutcome = true} = {}) {
  const bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json'));
  assert.deepEqual(manifest.identity, identity()); assert.equal(hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
  const record = v8.deserialize(bytes); assert.equal(record.schema, SCHEMA);
  assert.equal(journalDigest(record.apiJournal), manifest.apiJournalSha256);
  assert.deepEqual(summary(record), Object.fromEntries(Object.keys(summary(record)).map(k => [k, manifest[k]])));
  if (!manifest.probe && record.control.fireAccepted) verifyRecord(record, {requireOutcome, decoded: manifest.decoded});
  else if (requireOutcome) {assert.equal(record.status, 'native-retained-pair-sleep-persistence-complete'); assert.equal(record.requiredOutcomeObserved, true);
    assert.ok(b.retainedPairSleeping); assert.ok(b.retainedPairSleepPersistence);
    assert.equal(record.firstPairSleepOuter + 2, record.outerSteps); assert.equal(record.firstPairSleepH + 2, record.pairSleepPersistenceH); assert.equal(record.pairSleepPersistenceH, record.hCount); assert.equal(record.score, null);
    if (decoded) for (const id of [3,4]) { const object = b.retainedPairSleeping.application.registry.objects.find(o => o.id === id);
      assert.equal(b.retainedPairSleeping.bodies.find(rb => rb.handle.index === object.body.index && rb.handle.generation === object.body.generation).activation.sleeping, true); }
  }
  return {record, manifest};
}
module.exports = {SCHEMA, MAX_SETTLE_OUTER, MAX_OUTER, GRID, INITIAL_BOUNDARY, CUE_METHODS,
  BASE_INPUTS, SOURCES, sample, registry, application, identity, validateInput, outcome,
  captureOriginal, summary, verifyRecord, decodeRecord, captureArtifact, loadArtifact};
if (require.main === module) {
  const [file, scenario = 'positive', mode = 'probe'] = process.argv.slice(2);
  const input = BASE_INPUTS[scenario] || JSON.parse(fs.readFileSync(scenario, 'utf8'));
  captureArtifact(file, input, {probe: mode === 'probe', decode: mode === 'capture'})
    .then(m => console.log(JSON.stringify(m, null, 2)))
    .catch(e => {console.error(e.stack); process.exitCode = 1;});
}
