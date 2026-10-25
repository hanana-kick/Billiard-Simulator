'use strict';
// SPDX-License-Identifier: Apache-2.0
// Independent original PhysicsLab + controller, continuously advanced twice.
// No restored world, candidate output, manual score, or replacement physics.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const {execFileSync} = require('node:child_process');
const F = require('./four-ball-created-fixture.cjs');
const O = require('./four-ball-world-oracle.cjs');
const {hash, parts, observeMethod, journalDigest} = F;
const copy = x => structuredClone(x);
const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'original-controller-four-ball-settled-next-turn-v1';
const MAX_OUTER = 16000, GRID = 256;
const INITIAL_BOUNDARY = 'secondStrikeCreated';
const CUE_METHODS = ['createRigidBody', 'createCollider', 'createRigidBody', 'createCollider',
  'createCollider', 'createImpulseJoint', 'setContactsEnabled', 'createRigidBody',
  'createImpulseJoint', 'setLimits', 'setContactsEnabled', 'setLinvel', 'setLinvel'];
// Try the unchanged manual controls first. Only after its real rejection, try
// these explicit legal inputs through controller.changeSettings, in this order.
const ALTERNATE_SETTINGS = Object.freeze([8, 15, 25, 40, 60, 80].flatMap(elevation =>
  [90, -90, 180, 45, -45, 135, -135, 0].map(angle => Object.freeze({...F.SETTINGS, angle, elevation}))));
const SOURCES = ['tests/four-ball-settled-turn-fixture.cjs', 'tests/four-ball-created-fixture.cjs',
  'tests/four-ball-world-oracle.cjs', 'src/controller.js', 'src/physics.js', 'src/game-rules.js',
  'src/math.js', 'src/render-cadence.js', 'vendor/rapier.cjs', 'tools/rapier-snapshot-decoder/index.cjs'];
const vec = x => [x.x, x.y, x.z], quat = x => [x.x, x.y, x.z, x.w];
const same = (a, b) => a?.index === b?.index && a?.generation === b?.generation;
function sample(body) {
  // Copy the returned WASM scratch view before another body getter reuses it.
  const m = body.effectiveWorldInvInertia(), invInertia =
    [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33];
  return {translation: vec(body.translation()), rotation: quat(body.rotation()),
    linear: vec(body.linvel()), angular: vec(body.angvel()),
    invInertia, sleeping: body.isSleeping()};
}
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
function identity(initialPath, fullPath) {
  for (const file of [initialPath, fullPath]) assert.ok(file && path.isAbsolute(file), 'Explicit absolute source artifact paths required');
  return {schema: SCHEMA, maxOuter: MAX_OUTER, grid: GRID, node: process.version, v8: process.versions.v8,
    originalCreationIdentity: F.sourceIdentity(),
    firstShotArtifacts: Object.fromEntries([['creation', initialPath], ['fullShot', fullPath]].map(([key, file]) =>
      [key, {sha256: hash(fs.readFileSync(file)), manifestSha256: hash(fs.readFileSync(file + '.json'))}])),
    sources: Object.fromEntries(SOURCES.map(file => [file, hash(fs.readFileSync(path.join(ROOT, file)))]))};
}
function pendingJointInputs(journal) {
  // Rapier's serialized ImpulseJointSet omits pending events. Preserve the exact
  // observed API inputs which generate them; do not label a guessed native queue
  // as directly observed. The native user-changes stage may expand these inputs.
  return journal.filter(row => ['createImpulseJoint', 'setContactsEnabled', 'setLimits'].includes(row.method)).map(copy);
}
async function captureOriginal({creation, fullShot, journal = true, stopAfterFirstH = false}) {
  const firstHDone = Symbol('exact original second first-h boundary');
  const restores = [], boundaries = {}, apiJournal = [], frames = [], events = [], controlAttempts = [],
    references = new WeakMap(), firstCheckpoints = new Map(fullShot.checkpoints.map(p => [p.step, p.row])), secondCheckpoints = [];
  let c, lab, phase = 'constructor', nativeSteps = 0, shot = 0, outer = 0, substep = 0,
    subdivisions = 64, hCount = 0, lastPresent = true, withdrawal = null, finishResult = null;
  const reference = (value, kind) => {
    references.set(value, {kind, ...(typeof value.handle === 'number' ? {handle: parts(value.handle)} : {})});
    return value;
  };
  const argument = value => {
    if (value === null || typeof value !== 'object') return typeof value === 'function'
      ? {kind: 'original-callback', sourceSha256: hash(value.toString())} : value;
    if (references.has(value)) return copy(references.get(value));
    if (ArrayBuffer.isView(value)) return {kind: value.constructor.name, values: Array.from(value)};
    if (Array.isArray(value)) return value.map(argument);
    const fields = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      assert.ok('value' in descriptor, 'Journal observation never invokes accessors');
      fields[key] = argument(descriptor.value);
    }
    return {kind: 'descriptor', className: value.constructor?.name || null, fields};
  };
  const checkpoint = name => {
    assert.ok(!Object.hasOwn(boundaries, name));
    boundaries[name] = {boundary: name, candidateInput: name === INITIAL_BOUNDARY, nativeSteps,
      shot, hCount, outerStep: outer, outerSubstep: substep, snapshot: lab.world.takeSnapshot(),
      application: application(c), ...(journal ? {apiJournalLength: apiJournal.length} : {})};
  };
  const journalEnabled = () => journal && shot === 2 && (phase === 'secondStrikeCreation' || hCount === 0);
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
    // Observe only. All original source methods, arguments, and results remain.
    if (journal) {
      for (const [method, kind] of [['createRigidBody', 'RigidBody'], ['createCollider', 'Collider'],
        ['createImpulseJoint', 'ImpulseJoint']]) observeApi(F.R.World.prototype, method, kind);
      for (const method of ['propagateModifiedBodyPositionsToColliders', 'removeRigidBody']) observeApi(F.R.World.prototype, method);
    }
    restores.push(observeMethod(F.R.World.prototype, 'step', {
      before(receiver, args) {
        if (lab) {assert.equal(receiver, lab.world); assert.equal(args.length, 1); assert.equal(args[0], lab.queue);}
        else assert.equal(args.length, 0);
        if (shot === 2 && hCount === 0) {checkpoint('secondShot.firstH.preWorld'); phase = 'secondFirstH.world';}
        if (journalEnabled()) {const row = {order: apiJournal.length, phase, target: {kind: 'World'},
          method: 'step', args: args.map(argument), nativeStepsBefore: nativeSteps}; apiJournal.push(row); return row;}
      },
      after(receiver, args, result, row) {
        nativeSteps++;
        if (row) {row.result = argument(result); row.nativeStepsAfter = nativeSteps;}
        if (shot === 2 && hCount === 0) {checkpoint('secondShot.firstH.postWorld'); phase = 'secondFirstH.postApplication';}
      }
    }));
    c = new LabController(); c.lab = new PhysicsLab(F.R); lab = c.lab;
    reference(lab.world, 'World'); reference(lab.queue, 'EventQueue');
    assert.equal(nativeSteps, 72);
    c.state.gameMode = 'four'; c.setupGame();
    const originalObjects = lab.objects.slice();
    assert.equal(originalObjects.length, 4);
    restores.push(observeMethod(c.game, 'finish', {after(receiver, args, result) {
      assert.equal(receiver, c.game); assert.deepEqual(args, []); finishResult = copy(result);
      checkpoint(shot === 1 ? 'firstShot.gameFinished' : 'secondShot.gameFinished');
    }}));
    const originalEvent = lab.onEvent;
    lab.onEvent = e => {Reflect.apply(originalEvent, lab, [e]); events.push(copy(e));};
    if (journal) observeApi(lab.queue, 'drainCollisionEvents');
    restores.push(observeMethod(lab, 'removeCue', {before() {
      if (shot === 2 && lab.cue && !withdrawal) checkpoint('secondShot.cueWithdrawal.preRemoval');
    }, after() {
      if (shot === 2 && !lab.cue && !withdrawal) {
        withdrawal = {hCountBeforeApplication: hCount, outerStep: outer, outerSubstep: substep,
          time: lab.time, elapsed: lab.time - boundaries[INITIAL_BOUNDARY].application.time};
        checkpoint('secondShot.cueWithdrawal.postRemoval');
      }
    }}));
    restores.push(observeMethod(lab, 'angularPatchResistance', {after(receiver, args) {
      assert.equal(receiver, lab); const [h] = args; hCount++;
      const present = !!lab.cue, separation = lastPresent && !present; lastPresent = present;
      substep++; if (substep === subdivisions) {outer++; substep = 0; subdivisions = present ? 64 : 1;}
      const frame = {hCount, h, time: lab.time, outerStep: outer, outerSubstep: substep,
        cuePresent: present, separation, balls: lab.objects.map(o => ({id: o.id, ...sample(o.body)})),
        cue: present ? {shaft: sample(lab.cue.body), head: sample(lab.cue.head)} : null,
        events: copy(lab.events), game: c.game.snapshot()};
      if (shot === 1) {
        const expected = fullShot.frames[hCount - 1]; assert.ok(expected);
        assert.deepEqual({...frame, game: undefined}, {...expected, game: undefined}, 'Entire first shot original frame ' + hCount);
        if (hCount < fullShot.hCount) assert.deepEqual(frame.game, expected.game);
        if (hCount === 1) {
          checkpoint('firstShot.firstH.postApplication');
          assert.deepEqual(lab.world.takeSnapshot(), creation.boundaries['firstH.postApplication'].snapshot);
        }
      } else {
        frame.elapsed = lab.time - boundaries[INITIAL_BOUNDARY].application.time;
        frame.controllerSelectedId = c.state.selectedId;
        frames.push(frame);
        if (hCount === 1) {
          checkpoint('secondShot.firstH.postApplication');
          if (stopAfterFirstH) throw firstHDone;
        }
        if (separation) checkpoint('secondShot.cueWithdrawal.postApplication');
      }
    }}));
    shot = 1; phase = 'firstStrikeCreation'; assert.equal(c.fire(), true);
    checkpoint('firstShot.strikeCreated');
    assert.deepEqual(lab.world.takeSnapshot(), creation.boundaries.strikeCreated.snapshot);
    assert.deepEqual(application(c), creation.boundaries.strikeCreated.application);
    const firstEventsStart = events.length;
    for (let step = 1; step <= MAX_OUTER; step++) {
      phase = 'firstShot'; lab.step(); assert.equal(outer, step); assert.equal(substep, 0);
      if (firstCheckpoints.has(step)) assert.deepEqual(lab.world.takeSnapshot(), firstCheckpoints.get(step).snapshot, 'First-shot checkpoint ' + step);
      if (!lab.cue && lab.objects.every(o => o.body.isSleeping())) break;
    }
    assert.equal(outer, fullShot.firstRestOuter); assert.equal(hCount, fullShot.hCount);
    assert.deepEqual(events.slice(firstEventsStart), fullShot.events);
    assert.equal(lab.cue, null); assert.ok(lab.objects.every(o => o.body.isSleeping()));
    checkpoint('firstShot.physicalRest');
    assert.equal(c.state.selectedId, 1); assert.equal(c.game.activeCue, 1); assert.equal(c.game.pending.foul, true);
    c.finishGameShot(); checkpoint('firstShot.controllerFinished');
    assert.deepEqual(finishResult, fullShot.score); assert.deepEqual(c.game.snapshot(), fullShot.frames.at(-1).game);
    assert.equal(c.state.selectedId, 2); assert.equal(c.game.activeCue, 2); assert.equal(c.game.pending, null);
    const firstShot = {outerSteps: outer, hCount, result: finishResult, matchedFrameCount: hCount,
      matchedCheckpointCount: fullShot.checkpoints.filter(p => p.step > 0).length,
      initialSnapshotSha256: hash(boundaries['firstShot.strikeCreated'].snapshot),
      firstHSnapshotSha256: hash(boundaries['firstShot.firstH.postApplication'].snapshot),
      restSnapshotSha256: hash(boundaries['firstShot.physicalRest'].snapshot)};
    // Real manual pause, not a direct state assignment. No physical advancement.
    c.pause(true);
    if (performance.now() < c.cooldownUntil) await new Promise(resolve => setTimeout(resolve, Math.ceil(c.cooldownUntil - performance.now()) + 1));
    shot = 2; outer = 0; substep = 0; subdivisions = 64; hCount = 0; lastPresent = true;
    phase = 'secondControlSelection'; checkpoint('secondShot.beforeControls');
    const settled = lab.world.takeSnapshot();
    const attempt = settings => {
      c.changeSettings(settings);
      assert.deepEqual(lab.world.takeSnapshot(), settled, 'Manual controls never reset settled physics');
      const clearance = lab.cueClearance(lab.get(c.state.selectedId), c.state.settings);
      const entry = {settings: copy(c.state.settings), clearance: copy(clearance), selectedId: c.state.selectedId};
      if (clearance.clear) return entry;
      const accepted = c.fire(); assert.equal(accepted, false, 'Authoritative controller rejects obstructed cue');
      entry.fireAccepted = accepted; entry.reason = c.state.notice;
      assert.equal(entry.reason, `큐가 ${clearance.obstacle}에 닿습니다. 경사 또는 조준 방향을 바꾸세요.`);
      assert.deepEqual(lab.world.takeSnapshot(), settled); controlAttempts.push(entry); return null;
    };
    let selected = attempt(F.SETTINGS);
    if (!selected) for (const settings of ALTERNATE_SETTINGS) {selected = attempt(settings); if (selected) break;}
    assert.ok(selected, 'No legal clear second input found within declared controller settings');
    checkpoint('secondShot.beforeStrike');
    phase = 'secondStrikeCreation'; assert.equal(c.fire(), true); selected.fireAccepted = true; controlAttempts.push(selected);
    checkpoint(INITIAL_BOUNDARY);
    assert.equal(lab.cue.selectedId, 2); assert.equal(lab.cue.started, lab.time);
    assert.equal(lab.objects.findIndex(o => o.id === 2), 1, 'Active yellow ID 2 is array index 1, not index 2');
    assert.ok(lab.objects.every((o, i) => o === originalObjects[i]), 'No sphere is added or replaced between turns');
    const secondEventsStart = events.length - 1, started = lab.time, nativeStepsAtCreation = nativeSteps;
    phase = 'secondFirstH.preApplication';
    for (let step = 1; step <= MAX_OUTER; step++) {
      try {lab.step();} catch (error) {if (error === firstHDone && stopAfterFirstH) break; throw error;}
      assert.equal(outer, step); assert.equal(substep, 0);
      const atRest = !lab.cue && lab.objects.every(o => o.body.isSleeping());
      if (step <= 2 || step % GRID === 0 || atRest) secondCheckpoints.push({step,
        snapshot: lab.world.takeSnapshot(), application: {registry: registry(lab)}});
      if (withdrawal && !boundaries['secondShot.afterWithdrawalOuter']) checkpoint('secondShot.afterWithdrawalOuter');
      if (atRest) break;
      phase = 'secondShot';
    }
    if (!stopAfterFirstH) assert.ok(withdrawal, 'Capture includes actual cue withdrawal');
    const atRest = !lab.cue && lab.objects.every(o => o.body.isSleeping());
    if (atRest) {
      checkpoint('secondShot.physicalRest'); c.finishGameShot(); checkpoint('secondShot.controllerFinished');
    }
    const strikeCreationJournal = apiJournal.filter(row => row.phase === 'secondStrikeCreation' && CUE_METHODS.includes(row.method));
    if (journal) assert.deepEqual(strikeCreationJournal.map(row => row.method), CUE_METHODS);
    return {schema: SCHEMA, initialBoundary: INITIAL_BOUNDARY, selectedId: 2, selectedIndex: 1,
      settings: copy(c.state.settings), firstShot, controlAttempts, constructorNativeSteps: 72,
      nativeStepsAtCreation, nativeSteps, captureExtent: stopAfterFirstH ? 'second-first-h-only' : 'second-full-rest',
      status: stopAfterFirstH ? 'native-second-first-h-complete' : atRest ? 'native-second-rest-complete' : 'second-horizon-incomplete',
      secondShot: {outerSteps: outer, hCount, started, elapsed: lab.time - started, withdrawal,
        result: atRest ? copy(finishResult) : null, events: copy(events.slice(secondEventsStart))},
      boundaries, frames, secondCheckpoints, apiJournal, strikeCreationJournal,
      pendingJointJournal: pendingJointInputs(strikeCreationJournal),
      pendingJournalSemantics: 'exact-original-api-inputs-for-snapshot-skipped-impulse-joint-pending-events',
      sourceRuntimeChanged: false, candidateStateUsed: false, nativeRestoreUsed: false, replacementSphereUsed: false};
  } finally {
    while (restores.length) restores.pop()();
    if (c) {clearTimeout(c.noticeTimer); clearTimeout(c.predictionTimer);}
    lab?.dispose();
  }
}
function verifyRecord(record) {
  assert.equal(record.schema, SCHEMA); assert.equal(record.initialBoundary, INITIAL_BOUNDARY);
  assert.deepEqual([record.selectedId, record.selectedIndex], [2, 1]);
  assert.equal(record.firstShot.outerSteps, 5404); assert.equal(record.firstShot.hCount, 5845);
  assert.deepEqual(record.firstShot.result, {cueId: 1, delta: -1, nextCue: 2});
  assert.equal(record.nativeStepsAtCreation, 72 + 5845);
  assert.equal(record.nativeSteps - record.nativeStepsAtCreation, record.secondShot.hCount);
  assert.equal(record.frames.length, record.secondShot.hCount);
  const b = record.boundaries, rest = b['firstShot.physicalRest'], game = b['firstShot.gameFinished'],
    turn = b['firstShot.controllerFinished'], before = b['secondShot.beforeStrike'], created = b[INITIAL_BOUNDARY];
  assert.deepEqual(Object.keys(b).filter(name => b[name].candidateInput), [INITIAL_BOUNDARY]);
  for (const [name, row] of Object.entries(b)) {
    assert.equal(name, row.boundary); assert.equal(hash(row.snapshot), row.snapshotSha256);
    assert.deepEqual(F.D.encodeLosslessTree(row.typedState), Buffer.from(row.snapshot));
    assert.equal(row.verification.nativeBincodeByteIdentical, true);
    assert.equal(row.verification.javascriptTypedReencodeByteIdentical, true);
    assert.equal(row.application.registry.objects.length, 4);
  }
  assert.equal(rest.application.game.pending.foul, true);
  assert.equal(rest.application.controller.selectedId, 1);
  assert.equal(game.application.game.pending, null); assert.equal(game.application.game.activeCue, 2);
  assert.equal(game.application.controller.selectedId, 1, 'Scoring changes activeCue before the controller changes selection');
  assert.equal(turn.application.controller.selectedId, 2);
  for (const row of [game, turn, before]) assert.deepEqual(row.snapshot, rest.snapshot, 'Turn and settings retain physical state');
  assert.equal(created.application.cue.selectedId, 2);
  assert.equal(created.application.time, created.application.cue.started, 'Second-created elapsed is exactly zero');
  assert.equal(created.hCount, 0); assert.equal(created.nativeSteps, record.nativeStepsAtCreation);
  assert.equal(created.application.steps, 5404); assert.equal(created.application.shots, 2);
  assert.equal(created.application.game.pending.cueId, 2); assert.equal(created.application.game.scores[1], -1);
  assert.equal(created.summary.bodies, 23); assert.equal(created.summary.colliders, 27); assert.equal(created.summary.joints, 2);
  assert.equal(before.summary.bodies, 20); assert.equal(before.summary.colliders, 24);
  assert.equal(F.clothPairs(before).length, 4); assert.equal(F.clothPairs(created).length, 4);
  assert.deepEqual(F.clothPairs(created), F.clothPairs(before), 'All four settled floor caches survive second cue creation');
  assert.deepEqual(created.application.registry, before.application.registry);
  for (const object of before.application.registry.objects) {
    const oldBody = before.bodies.find(b => same(b.handle, object.body));
    const newBody = created.bodies.find(b => same(b.handle, object.body));
    assert.equal(oldBody.activation.sleeping, true);
    assert.deepEqual(newBody, oldBody, 'Settled original body is unchanged at second-created ID ' + object.id);
    assert.notEqual(oldBody.ids.island_id, 0xffffffff, 'No unregistered fresh fourth sphere');
  }
  assert.deepEqual(record.strikeCreationJournal.map(row => row.method), CUE_METHODS);
  for (const row of record.strikeCreationJournal) {
    assert.equal(row.nativeStepsBefore, record.nativeStepsAtCreation);
    assert.equal(row.nativeStepsAfter, record.nativeStepsAtCreation);
    assert.ok(row.order < created.apiJournalLength);
  }
  assert.deepEqual(record.pendingJointJournal, pendingJointInputs(record.strikeCreationJournal));
  assert.equal(record.pendingJointJournal.length, 5);
  assert.equal(record.controlAttempts.at(-1).fireAccepted, true);
  assert.equal(record.controlAttempts.at(-1).clearance.clear, true);
  assert.deepEqual(record.controlAttempts.at(-1).settings, record.settings);
  assert.equal(b['secondShot.firstH.postWorld'].nativeSteps, created.nativeSteps + 1);
  assert.equal(b['secondShot.firstH.postApplication'].hCount, 1);
  if (record.status === 'native-second-first-h-complete') {
    assert.equal(record.captureExtent, 'second-first-h-only');
    assert.equal(record.secondShot.hCount, 1); assert.equal(record.secondShot.outerSteps, 0);
    assert.equal(record.secondShot.withdrawal, null); assert.equal(record.secondShot.result, null);
    assert.equal(b['secondShot.physicalRest'], undefined);
  }
  if (record.status === 'native-second-rest-complete') {
    assert.ok(b['secondShot.physicalRest'].bodies.filter(body => body.body_type === 'Dynamic').every(body => body.activation.sleeping));
    assert.equal(b['secondShot.physicalRest'].application.cue, null);
    assert.equal(b['secondShot.controllerFinished'].application.game.pending, null);
    assert.equal(b['secondShot.controllerFinished'].application.controller.selectedId, record.secondShot.result.nextCue);
  }
  return record;
}
async function captureArtifact(file, initialPath, fullPath, {stopAfterFirstH = false} = {}) {
  assert.ok(file && path.isAbsolute(file));
  assert.ok(!fs.existsSync(file) && !fs.existsSync(file + '.json'), 'Never overwrite a frozen oracle');
  const id = identity(initialPath, fullPath), {record: creation} = F.loadArtifact(initialPath), fullShot = O.loadArtifact(fullPath, initialPath);
  await F.R.init(); assert.equal(F.R.version(), '0.21.0');
  const record = await captureOriginal({creation, fullShot, stopAfterFirstH});
  const independent = await captureOriginal({creation, fullShot, journal: false, stopAfterFirstH});
  assert.deepEqual(Object.keys(record.boundaries), Object.keys(independent.boundaries));
  for (const name of Object.keys(record.boundaries)) {
    assert.deepEqual(record.boundaries[name].snapshot, independent.boundaries[name].snapshot, 'Journal is read-only at ' + name);
    assert.deepEqual(record.boundaries[name].application, independent.boundaries[name].application);
  }
  for (const field of ['firstShot', 'secondShot', 'settings', 'controlAttempts', 'frames', 'secondCheckpoints'])
    assert.deepEqual(record[field], independent[field], 'Independent continuous capture equivalence: ' + field);
  for (const name of Object.keys(record.boundaries)) record.boundaries[name] = F.decodeBoundary(record.boundaries[name]);
  record.secondCheckpoints = record.secondCheckpoints.map(p => ({step: p.step, row: F.decodeBoundary({
    boundary: 'expected-only-second-outer-' + p.step, candidateInput: false, snapshot: p.snapshot, application: p.application})}));
  record.observerAgreement = {independentContinuousCaptures: 2,
    byteIdenticalBoundaries: Object.keys(record.boundaries), exactSecondFrames: record.frames.length,
    exactSecondCheckpoints: record.secondCheckpoints.length, exactApplicationObservables: true};
  verifyRecord(record); assert.deepEqual(identity(initialPath, fullPath), id);
  const bytes = v8.serialize(record), manifest = {identity: id,
    captureRevision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
    sha256: hash(bytes), bytes: bytes.length, status: record.status, captureExtent: record.captureExtent, initialBoundary: INITIAL_BOUNDARY,
    selectedId: record.selectedId, selectedIndex: record.selectedIndex, settings: record.settings,
    firstShot: record.firstShot, secondShot: {...record.secondShot, events: undefined},
    controlAttempts: record.controlAttempts, observerAgreement: record.observerAgreement,
    boundarySnapshots: Object.fromEntries(Object.entries(record.boundaries).map(([key, row]) => [key, row.snapshotSha256])),
    apiJournalEncoding: F.JOURNAL_ENCODING, apiJournalSha256: journalDigest(record.apiJournal),
    strikeCreationJournalSha256: journalDigest(record.strikeCreationJournal), pendingJointJournalSha256: journalDigest(record.pendingJointJournal),
    scope: 'independent-original-CPU-two-continuous-shots-and-real-controller-turn; not candidate/GPU proof',
    sourceRuntimeChanged: false, candidateStateUsed: false, nativeRestoreUsed: false, replacementSphereUsed: false};
  fs.writeFileSync(file, bytes, {flag: 'wx'});
  fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function loadArtifact(file, initialPath, fullPath) {
  assert.ok(file && path.isAbsolute(file), 'Explicit existing absolute settled-turn artifact required');
  const bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  assert.deepEqual(manifest.identity, identity(initialPath, fullPath)); assert.equal(hash(bytes), manifest.sha256);
  assert.equal(bytes.length, manifest.bytes);
  const record = verifyRecord(v8.deserialize(bytes));
  assert.equal(journalDigest(record.apiJournal), manifest.apiJournalSha256);
  assert.equal(journalDigest(record.strikeCreationJournal), manifest.strikeCreationJournalSha256);
  assert.equal(journalDigest(record.pendingJointJournal), manifest.pendingJointJournalSha256);
  for (const [name, row] of Object.entries(record.boundaries)) assert.equal(row.snapshotSha256, manifest.boundarySnapshots[name]);
  return {record, manifest};
}
module.exports = {SCHEMA, MAX_OUTER, GRID, INITIAL_BOUNDARY, CUE_METHODS, ALTERNATE_SETTINGS, SOURCES,
  identity, pendingJointInputs, captureOriginal, verifyRecord, captureArtifact, loadArtifact};
if (require.main === module) captureArtifact(process.argv[2], process.env.FOUR_BALL_CREATION_V8, process.env.FOUR_BALL_FULL_REPLAY,
  {stopAfterFirstH: process.argv.includes('--initial-only')})
  .then(manifest => console.log(JSON.stringify(manifest, null, 2))).catch(error => {console.error(error.stack); process.exitCode = 1;});
