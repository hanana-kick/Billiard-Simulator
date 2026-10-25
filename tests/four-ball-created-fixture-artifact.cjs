'use strict';
// Explicit frozen artifact verification only: never initializes or steps Rapier.
const {test, before} = require('node:test');
const assert = require('node:assert/strict');
const F = require('./four-ball-created-fixture.cjs');
let record, manifest;
before(() => {
  assert.ok(process.env.FOUR_BALL_CREATION_REPLAY, 'Explicit frozen FOUR_BALL_CREATION_REPLAY required');
  ({record, manifest} = F.loadArtifact(process.env.FOUR_BALL_CREATION_REPLAY));
});
test('actual four-ball creation retains all six exact boundaries and independent reproduction', () => {
  assert.equal(record.observerAgreement.independentRecreations, 2);
  assert.deepEqual(record.observerAgreement.byteIdenticalBoundaries, F.BOUNDARIES);
  assert.equal(record.observerAgreement.exactApplicationObservables, true);
  assert.deepEqual(F.BOUNDARIES.filter(name => record.boundaries[name].candidateInput), ['strikeCreated']);
  assert.equal(manifest.sourceRuntimeChanged, false); assert.equal(manifest.candidateStateUsed, false);
  assert.equal(manifest.nativeFirstHReseeding, false);
});
test('new sphere is genuinely uninserted at mode/strike creation and born in native first h', () => {
  const mode = record.boundaries.modeCreated, strike = record.boundaries.strikeCreated;
  const post = record.boundaries['firstH.postWorld'];
  assert.deepEqual([mode.summary.bodies, mode.summary.colliders, mode.summary.bvhLeaves, F.clothPairs(mode).length], [20, 24, 22, 3]);
  assert.deepEqual([strike.summary.bodies, strike.summary.colliders, strike.summary.bvhLeaves, F.clothPairs(strike).length], [23, 27, 22, 3]);
  assert.deepEqual([post.summary.bodies, post.summary.colliders, post.summary.bvhLeaves, F.clothPairs(post).length], [23, 27, 27, 4]);
  assert.equal(record.modeCreationJournal.length, 3); assert.equal(record.strikeCreationJournal.length, 13);
});
test('source typed integer widths and wide color masks are authoritative, not rounded', () => {
  const typed = record.boundaries.constructor.typedState;
  const masks = [...F.D.walk(typed)].filter(n => n.kind === 'integer' && n.width === 'u128' && n.value === '170141183460469231731687303715884105728');
  assert.ok(masks.length >= 3);
  const projected = record.boundaries.constructor.state.narrow_phase.body_solver_color_masks;
  assert.equal(projected.filter(value => value === 1n << 127n).length, 3);
});
test('changed native snapshot or source typed float is rejected', () => {
  const snapshotChanged = structuredClone(record); snapshotChanged.boundaries.strikeCreated.snapshot[0] ^= 1;
  assert.throws(() => F.verifyRecord(snapshotChanged));
  const typedChanged = structuredClone(record);
  const node = [...F.D.walk(typedChanged.boundaries.strikeCreated.typedState)].find(n => n.kind === 'float');
  node.bits = node.bits === '00000000' ? '3f800000' : '00000000';
  assert.throws(() => F.verifyRecord(typedChanged), /Authoritative full typed source tree exactly re-encodes/);
});
