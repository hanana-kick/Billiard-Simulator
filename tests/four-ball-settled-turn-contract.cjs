'use strict';
// SPDX-License-Identifier: Apache-2.0
// Light contract tests. No Rapier initialization, native decoder, or physics.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const F = require('./four-ball-settled-turn-fixture.cjs');
const Original = require('./four-ball-created-fixture.cjs');
const source = fs.readFileSync(require.resolve('./four-ball-settled-turn-fixture.cjs'), 'utf8');

test('settled next-turn is an independent original controller capture, not a restored first-h seed', () => {
  assert.equal(F.INITIAL_BOUNDARY, 'secondStrikeCreated');
  assert.match(source, /c = new LabController\(\); c\.lab = new PhysicsLab\(F\.R\)/);
  assert.match(source, /c\.state\.gameMode = 'four'; c\.setupGame\(\)/);
  assert.match(source, /c\.finishGameShot\(\); checkpoint\('firstShot\.controllerFinished'\)/);
  assert.match(source, /assert\.equal\(c\.state\.selectedId, 2\)/);
  assert.match(source, /lab\.objects\.findIndex\(o => o\.id === 2\), 1/);
  assert.doesNotMatch(source, /\.restoreSnapshot\(|\.restore\(|\.addSphere\(|ignoreObstruction\s*:/);
  assert.doesNotMatch(source, /\.scores\[[^\]]+\]\s*=|\.activeCue\s*=|\.selectedId\s*=/);
  assert.equal(F.SOURCES.includes('src/controller.js'), true);
  assert.equal(F.SOURCES.includes('src/physics.js'), true);
});

test('source-first settling and controller turn are distinct, with all original sphere identities retained', () => {
  assert.match(source, /checkpoint\('firstShot\.physicalRest'\)/);
  assert.match(source, /firstShot\.gameFinished/);
  assert.match(source, /firstShot\.controllerFinished/);
  assert.match(source, /o === originalObjects\[i\]/);
  assert.match(source, /All four settled floor caches survive second cue creation/);
  assert.match(source, /Second-created elapsed is exactly zero/);
  assert.match(source, /Entire first shot original frame/);
  assert.match(source, /First-shot checkpoint/);
});

test('alternate input policy is explicit and bounded by the existing manual controls', () => {
  assert.equal(F.ALTERNATE_SETTINGS.length, 48);
  assert.deepEqual(F.ALTERNATE_SETTINGS[0], {...Original.SETTINGS, angle: 90});
  for (const s of F.ALTERNATE_SETTINGS) {
    assert.ok(s.angle >= -180 && s.angle <= 180);
    assert.ok(s.elevation >= 0 && s.elevation <= 85);
    assert.deepEqual([s.tipX, s.tipY, s.speed], [0, 0, 2]);
  }
  assert.match(source, /c\.changeSettings\(settings\)/);
  assert.match(source, /Authoritative controller rejects obstructed cue/);
  assert.match(source, /if \(!selected\) for \(const settings of ALTERNATE_SETTINGS\)/);
});

test('pending joint inputs retain genuine original source entries and exclude unrelated operations', () => {
  const journal = [
    {order: 1, method: 'createRigidBody', result: {handle: {index: 19, generation: 1}}},
    {order: 2, method: 'createImpulseJoint', args: [{}, {handle: {index: 19, generation: 1}}, {handle: {index: 20, generation: 1}}, true], result: {handle: {index: 1, generation: 1}}},
    {order: 3, method: 'setContactsEnabled', args: [false], target: {handle: {index: 1, generation: 1}}},
    {order: 4, method: 'setLimits', args: [-.08, .13]},
    {order: 5, method: 'setLinvel', args: [null, true]}
  ];
  const inputs = F.pendingJointInputs(journal);
  assert.deepEqual(inputs, journal.slice(1, 4));
  assert.notEqual(inputs[0], journal[1]);
  inputs[0].args[1].handle.generation = 10;
  assert.equal(journal[1].args[1].handle.generation, 1);
  assert.match(source, /exact-original-api-inputs-for-snapshot-skipped-impulse-joint-pending-events/);
  assert.match(source, /do not label a guessed native queue/);
});

test('capture refuses implicit inputs and frozen artifacts are never overwritten', async () => {
  assert.throws(() => F.loadArtifact(), /Explicit existing absolute settled-turn artifact/);
  assert.throws(() => F.loadArtifact('relative.v8'), /Explicit existing absolute settled-turn artifact/);
  assert.throws(() => F.identity(), /Explicit absolute source artifact paths/);
  await assert.rejects(() => F.captureArtifact(__filename), /assert|absolute/i);
  assert.match(source, /Never overwrite a frozen oracle/);
});
