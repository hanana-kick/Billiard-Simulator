'use strict';
// Source-only acceptance guard: never presented as physics or native GPU proof.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const sequential = read('live-registered-multishot-sequential-full.mjs');
const batch = read('live-registered-multishot-batch.mjs');

test('full sequential CPU difference reporting preserves exact batch helper bodies', () => {
  const section = (source, start, end) => {
    const begin = source.indexOf(start); assert.ok(begin >= 0);
    const finish = source.indexOf(end, begin); assert.ok(finish > begin);
    return source.slice(begin, finish).trim();
  };
  assert.equal(section(sequential, 'function normalizeBackendLabels', 'function numericalDifferenceReport'),
    section(batch, 'function normalizeBackendLabels', 'function sourceProof'));
  assert.equal(section(sequential, 'function numericalDifferenceReport', 'let world, owner'),
    section(batch, 'function numericalDifferenceReport', "test('distinct live worlds"));
});

test('full sequential harness consumes unchanged original comparison helpers after stepping', () => {
  assert.ok(sequential.includes("import {prepareValidation, importInitial, noNative, PINNED, loadEvidence, compareFrame, compareCheckpoint, compactDeepEqual} from './live-registered-performance-support.mjs';"));
  assert.ok(!/function\s+(compareFrame|compareCheckpoint)\b/.test(sequential), 'No local replacements for original gates');
  assert.ok(sequential.includes('state = await world.step();'));
  assert.ok(sequential.includes('compareFrame(state, frame, seed, record, stats);'));
  assert.ok(sequential.includes('await compareCheckpoint(state, point, frame, seed, record, stats);'));
  assert.ok(sequential.indexOf('state = await world.step();') < sequential.indexOf('compareFrame(state, frame, seed, record, stats);'));
  assert.ok(sequential.includes("!point.reasons.includes('cue-withdrawal')"), 'Do not label mid-h checkpoint post-h');
  assert.ok(sequential.includes('World.createGpuStepper(device, seed)'));
  assert.ok(sequential.includes('World.createReferenceStepper(seed)'));
  assert.ok(sequential.includes("assert.equal(process.env.REQUIRE_WEBGPU, '1'"));
  assert.ok(sequential.includes('noNative();'));
});

test('full sequential proof requires original rest, all checkpoints, score and exact GPU batch state', () => {
  for (const gate of [
    'assert.equal(state.shotComplete, true', 'assert.equal(h, record.hCount)',
    'assert.equal(state.scene.manager.awake_island, null)', 'assert.ok(state.balls.every(ball => ball.state.sleeping))',
    'compactDeepEqual(state.game, record.finalGame)', 'compactDeepEqual(state.scoreResult, record.score)',
    'compactDeepEqual(await world.step(), state', 'assert.equal(stats.checkpoints.length, [...checkpointMap.values()].flat().length',
    "assert.equal(proof.status, 'all-native-full-rest-matched')", 'assert.equal(proof.fullShot, true)',
    'compactDeepEqual(proof.sourceProof, sourceProof', 'assert.equal(hash(bytes), artifact.sha256)',
    "if (BACKEND === 'gpu') compactDeepEqual(batch, state", 'hardwareAccelerationClaim: false',
    'numericDifferencesAreReportNotTolerance: true', 'nativeRuntimeSteps: 0',
  ]) assert.ok(sequential.includes(gate), 'Required full acceptance guard: ' + gate);
});
