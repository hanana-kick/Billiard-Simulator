'use strict';
// Load/seed-export diagnostic only. No source world construction or physics step.
const assert = require('node:assert/strict');
const Ref = require('../tests/full-shot-reference-fixture.cjs');
const kind = process.argv[2], measurements = [Ref.memory('before-load')];
let seed, replay;
if (kind === 'four-ball') {
  const input = process.env.FOUR_BALL_CREATION_V8;
  // Keep initial record block-local, exactly as the replay before hook does.
  {
    const {record} = require('../tests/four-ball-created-fixture.cjs').loadArtifact(input);
    seed = require('../tests/four-ball-world-seed.cjs').exportInitialSeed({strikeCreated: record.boundaries.strikeCreated,
      modeCreationJournal: record.modeCreationJournal, strikeCreationJournal: record.strikeCreationJournal});
  }
  replay = Ref.loadPrepared(kind, process.env.FOUR_BALL_FULL_REFERENCE, process.env.FOUR_BALL_FULL_REPLAY, input);
  assert.equal(replay.initialSnapshotSha256, seed.initialSnapshotSha256);
} else {
  assert.equal(kind, 'yaw15');
  replay = Ref.loadPrepared(kind, process.env.YAW15_FULL_REFERENCE, process.env.YAW15_FULL_REPLAY, process.env.YAW15_REPLAY);
  seed = require('../tests/three-ball-yaw-fixture.cjs').exportSeed(replay.record);
  assert.ok(!('post' in seed) && !('expected' in seed));
  assert.ok(!('post' in seed.cueInitial.sourceCreation));
  replay.record = {roles: replay.record.roles, created: {snapshotSha256: replay.record.created.snapshotSha256}};
}
measurements.push(Ref.memory('prepared-plus-unchanged-seed'));
if (global.gc) { global.gc(); measurements.push(Ref.memory('optional-diagnostic-gc')); }
console.log(JSON.stringify({kind, frames: replay.frames.length, checkpoints: replay.checkpoints.length,
  balls: seed.balls.length, noPhysicsSteps: true, optionalGc: !!global.gc, measurements}, null, 2));
