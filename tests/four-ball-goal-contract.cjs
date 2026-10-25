'use strict';
// SPDX-License-Identifier: Apache-2.0
// Lightweight schema checks and admission of already-captured original evidence.
// This file never runs physics or manufactures a contact sequence.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const F = require('./four-ball-goal-fixture.cjs');
const C = require('./four-ball-created-fixture.cjs');
const A = require('./four-ball-goal-artifact.cjs');
test('goal hypotheses are explicit legal controller placement inputs, not expected states', () => {
  for (const input of Object.values(F.BASE_INPUTS)) F.validateInput(input);
  assert.deepEqual(C.SETTINGS, {angle: 0, elevation: 8, tipX: 0, tipY: 0, speed: 2});
  assert.equal(F.INITIAL_BOUNDARY, 'goalStrikeCreated');
  assert.equal(F.CUE_METHODS.length, 13);
});
test('manifest normalization only omits absent object fields and rejects nonfinite numbers', () => {
  assert.deepEqual(A.summaryJsonFields({present: 1, missing: undefined, nested: {missing: undefined}}), {present: 1, nested: {}});
  for (const number of [NaN, Infinity, -Infinity]) assert.throws(() => A.summaryJsonFields({number}), /finite/);
  assert.throws(() => A.summaryJsonFields([undefined]), /Undefined array element/);
});
for (const [variable, expected] of [['FOUR_BALL_POSITIVE_GOAL_V8', 'positive'],
  ['FOUR_BALL_LATE_OPPONENT_V8', 'late-opponent-foul']]) {
  test('frozen genuine original ' + expected + ' sequence reaches physical rest',
    {skip: !process.env[variable]}, () => {
      const {record: r, manifest: m} = A.loadArtifact(process.env[variable]);
      assert.equal(m.probe, false); assert.equal(m.decoded, true);
      const provenance = A.placementProvenance(r);
      assert.deepEqual(provenance.placements, r.placements);
      assert.match(provenance.placementApiJournalSha256, /^[a-f0-9]{64}$/);
      assert.equal(r.input.requiredOutcome, expected); assert.equal(r.requiredOutcomeObserved, true);
      assert.equal(r.nativeRestoreUsed, false); assert.equal(r.candidateStateUsed, false);
      assert.equal(r.frames.length, r.hCount); assert.equal(r.boundaries.physicalRest.application.cue, null);
      assert.equal(r.boundaries.physicalRest.application.game.pending.cueId, 1);
      assert.equal(r.boundaries.controllerFinished.application.game.pending, null);
      assert.ok(r.boundaries.beforeStrike.bodies.filter(b => b.body_type === 'Dynamic').every(b => b.activation.sleeping));
      assert.equal(r.boundaries.beforeStrike.application.cue, null);
      assert.equal(r.boundaries.beforeStrike.summary.bvhLeaves, 24);
      assert.equal(r.boundaries[F.INITIAL_BOUNDARY].candidateInput, true);
      assert.equal(r.boundaries[F.INITIAL_BOUNDARY].application.game.pending.cueId, 1);
      assert.equal(r.pendingJointJournal.length, 5);
      assert.ok(r.strikeCreationJournal.every(row => row.phase === 'goalStrikeCreation' &&
        row.nativeStepsBefore === r.nativeStepsAtCreation && row.nativeStepsAfter === r.nativeStepsAtCreation));
      assert.equal(r.observerAgreement.independentRecreations, 2);
      assert.equal(r.observerAgreement.exactContactAndGameObservables, true);
      const goal = r.events[r.outcome.goalEventOrder];
      assert.equal(goal.goalFirstReached, true); assert.equal(goal.gameAfter.pending.foul, false);
      assert.deepEqual(goal.gameAfter.pending.reds.slice().sort(), [3, 4]);
      assert.ok(r.firstRestOuter > goal.outerStep);
      if (expected === 'positive') {
        assert.equal(r.outcome.opponentEventOrder, null); assert.deepEqual(r.score, {cueId: 1, delta: 1, nextCue: 1});
      } else {
        const yellow = r.events[r.outcome.opponentEventOrder];
        assert.ok(yellow.order > goal.order && yellow.event.time > goal.event.time);
        assert.equal(yellow.opponentCueContact, true); assert.equal(yellow.gameBefore.pending.foul, false);
        assert.equal(yellow.gameAfter.pending.foul, true);
        assert.deepEqual(yellow.gameBefore.pending.reds.slice().sort(), [3, 4]);
        assert.ok(r.firstRestOuter > yellow.outerStep);
        assert.deepEqual(r.score, {cueId: 1, delta: -1, nextCue: 2});
      }
    });
}
