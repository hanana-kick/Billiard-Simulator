'use strict';
// SPDX-License-Identifier: Apache-2.0
// Explicit frozen source artifact replay; never initializes or steps Rapier.
const {test, before} = require('node:test');
const assert = require('node:assert/strict');
const F = require('./four-ball-settled-turn-fixture.cjs');
const Original = require('./four-ball-created-fixture.cjs');
let record, manifest;
before(() => {
  assert.ok(process.env.FOUR_BALL_SETTLED_TURN_REPLAY, 'Explicit frozen settled-turn artifact required');
  ({record, manifest} = F.loadArtifact(process.env.FOUR_BALL_SETTLED_TURN_REPLAY,
    process.env.FOUR_BALL_CREATION_V8, process.env.FOUR_BALL_FULL_REPLAY));
});

test('the same source first shot reaches full physical rest, then the actual controller selects yellow ID 2', () => {
  assert.deepEqual(record.firstShot.result, {cueId: 1, delta: -1, nextCue: 2});
  assert.equal(record.firstShot.matchedFrameCount, 5845);
  assert.equal(record.firstShot.matchedCheckpointCount, 132);
  const b = record.boundaries;
  assert.equal(b['firstShot.physicalRest'].application.game.pending.foul, true);
  assert.equal(b['firstShot.gameFinished'].application.game.activeCue, 2);
  assert.equal(b['firstShot.gameFinished'].application.controller.selectedId, 1);
  assert.equal(b['firstShot.controllerFinished'].application.controller.selectedId, 2);
  assert.deepEqual([record.selectedId, record.selectedIndex], [2, 1]);
});

test('the sole initial seed boundary keeps all four settled bodies and floor caches unchanged', () => {
  const created = record.boundaries.secondStrikeCreated, before = record.boundaries['secondShot.beforeStrike'];
  assert.equal(created.application.time - created.application.cue.started, 0);
  assert.equal(created.nativeSteps, 5917); assert.equal(created.hCount, 0);
  assert.equal(created.application.steps, 5404); assert.equal(created.application.shots, 2);
  assert.equal(created.application.cue.selectedId, 2);
  assert.deepEqual(Original.clothPairs(created), Original.clothPairs(before));
  assert.equal(Original.clothPairs(created).length, 4);
  assert.deepEqual(Object.values(record.boundaries).filter(row => row.candidateInput).map(row => row.boundary), ['secondStrikeCreated']);
  assert.equal(record.replacementSphereUsed, false); assert.equal(record.nativeRestoreUsed, false);
});

test('second-cue creation and snapshot-skipped joint pending inputs are exact source journals', () => {
  assert.deepEqual(record.strikeCreationJournal.map(row => row.method), F.CUE_METHODS);
  assert.deepEqual(record.pendingJointJournal.map(row => row.method),
    ['createImpulseJoint', 'setContactsEnabled', 'createImpulseJoint', 'setLimits', 'setContactsEnabled']);
  assert.ok(record.strikeCreationJournal.every(row => row.nativeStepsBefore === 5917 && row.nativeStepsAfter === 5917));
  assert.equal(Original.journalDigest(record.pendingJointJournal), manifest.pendingJointJournalSha256);
  assert.equal(record.pendingJournalSemantics, 'exact-original-api-inputs-for-snapshot-skipped-impulse-joint-pending-events');
});

test('only original control changes may resolve an actually obstructed default second stroke', () => {
  const attempts = record.controlAttempts;
  assert.deepEqual(attempts[0].settings, Original.SETTINGS);
  for (const rejected of attempts.slice(0, -1)) {
    assert.equal(rejected.fireAccepted, false); assert.equal(rejected.clearance.clear, false);
    assert.equal(rejected.reason, `큐가 ${rejected.clearance.obstacle}에 닿습니다. 경사 또는 조준 방향을 바꾸세요.`);
  }
  assert.equal(attempts.at(-1).fireAccepted, true); assert.equal(attempts.at(-1).clearance.clear, true);
  assert.deepEqual(attempts.at(-1).settings, record.settings);
});

test('independent continuous captures match every declared boundary and second-shot frame', () => {
  assert.equal(record.observerAgreement.independentContinuousCaptures, 2);
  assert.equal(record.observerAgreement.exactSecondFrames, record.frames.length);
  assert.deepEqual(record.observerAgreement.byteIdenticalBoundaries, Object.keys(record.boundaries));
  assert.equal(manifest.candidateStateUsed, false); assert.equal(manifest.sourceRuntimeChanged, false);
});

test('full capture reaches withdrawal and physical second rest', t => {
  if (record.captureExtent === 'second-first-h-only') {t.skip('Explicit initial-only artifact; second full rest has not been captured'); return;}
  assert.equal(record.status, 'native-second-rest-complete');
  assert.ok(record.secondShot.withdrawal.elapsed > 0);
  assert.ok(record.boundaries['secondShot.cueWithdrawal.postApplication']);
  assert.equal(record.boundaries['secondShot.controllerFinished'].application.game.pending, null);
  assert.equal(manifest.candidateStateUsed, false); assert.equal(manifest.sourceRuntimeChanged, false);
});

test('initial-only status never claims withdrawal or full-shot completion', () => {
  if (record.captureExtent !== 'second-first-h-only') return;
  assert.equal(record.status, 'native-second-first-h-complete');
  assert.equal(record.frames.length, 1); assert.equal(record.secondShot.outerSteps, 0);
  assert.equal(record.secondShot.withdrawal, null); assert.equal(record.secondShot.result, null);
  assert.equal(record.boundaries['secondShot.physicalRest'], undefined);
});
