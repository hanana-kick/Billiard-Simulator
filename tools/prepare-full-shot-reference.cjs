'use strict';
// Run separately from CPU/GPU replay. Frozen oracle files are read-only inputs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), v8 = require('node:v8');
const Ref = require('../tests/full-shot-reference-fixture.cjs');
async function prepare(kind, destination, originalPath, initialPath) {
  assert.ok(['four-ball', 'yaw15'].includes(kind), 'kind must be four-ball or yaw15');
  assert.ok(destination && path.isAbsolute(destination), 'Absolute new prepared destination required');
  assert.ok(!fs.existsSync(destination) && !fs.existsSync(destination + '.json'), 'Never overwrite original or prepared evidence');
  assert.notEqual(destination, originalPath); assert.notEqual(destination, initialPath);
  const measurements = [];
  const recordMemory = label => {
    const measurement = Ref.memory(label); measurements.push(measurement);
    console.error(JSON.stringify({referencePreparation: kind, ...measurement}));
  };
  recordMemory('before-original-validation');
  const sourceHashes = Ref.sourceHashes(kind), originalIdentity = Ref.validateOriginal(kind, originalPath, initialPath);
  recordMemory('before-original-load');
  let original, projected, seed;
  if (kind === 'four-ball') {
    const F = require('../tests/four-ball-created-fixture.cjs');
    const {record} = F.loadArtifact(initialPath);
    seed = require('../tests/four-ball-world-seed.cjs').exportInitialSeed({strikeCreated: record.boundaries.strikeCreated,
      modeCreationJournal: record.modeCreationJournal, strikeCreationJournal: record.strikeCreationJournal});
    original = require('../tests/four-ball-world-oracle.cjs').loadArtifact(originalPath, initialPath);
    assert.equal(original.initialSnapshotSha256, seed.initialSnapshotSha256);
    recordMemory('original-loaded');
    projected = Ref.projectFourBall(original);
  } else {
    original = require('../tests/three-ball-yaw-full-shot-oracle.cjs').loadArtifact(originalPath, initialPath);
    recordMemory('original-loaded');
    seed = require('../tests/three-ball-yaw-fixture.cjs').exportSeed(original.record);
    projected = Ref.projectYaw(original);
  }
  recordMemory('projection-built-original-still-live');
  const Eq = require('../tests/full-shot-reference-equivalence.cjs');
  const equivalence = await (kind === 'four-ball' ? Eq.verifyFourBall(original, projected, seed) : Eq.verifyYaw(original, projected, seed));
  assert.equal(equivalence.originalAssertionSha256, equivalence.projectedAssertionSha256);
  assert.ok(equivalence.assertions > 0);
  recordMemory('assertion-equivalence-verified');
  original = null; seed = null;
  // Optional diagnostic only: never needed for correctness or replay operation.
  if (global.gc) global.gc();
  recordMemory('original-released');
  const bytes = v8.serialize(projected), manifest = {schema: Ref.SCHEMA, kind, original: originalIdentity, sourceHashes,
    sha256: Ref.hash(bytes), bytes: bytes.length, frames: projected.frames.length, checkpoints: projected.checkpoints.length,
    status: projected.status, firstRestOuter: projected.firstRestOuter, score: projected.score, equivalence, measurements,
    expectedOnly: true, candidatePhysicsChanged: false, originalArtifactsChanged: false};
  assert.deepEqual(Ref.sourceHashes(kind), sourceHashes, 'Preparation sources unchanged');
  assert.deepEqual(Ref.validateOriginal(kind, originalPath, initialPath), originalIdentity, 'Original bytes and identity unchanged');
  fs.writeFileSync(destination, bytes, {flag: 'wx'});
  recordMemory('prepared-reference-written');
  fs.writeFileSync(destination + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({kind, prepared: destination, ...manifest}, null, 2));
  return manifest;
}
module.exports = {prepare};
if (require.main === module) {
  const kind = process.argv[2], initial = kind === 'four-ball' ? process.env.FOUR_BALL_CREATION_V8 : process.env.YAW15_REPLAY;
  const original = kind === 'four-ball' ? process.env.FOUR_BALL_FULL_REPLAY : process.env.YAW15_FULL_REPLAY;
  prepare(kind, process.argv[3], original, initial).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
