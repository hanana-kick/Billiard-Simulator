'use strict';
// Storage-only adapter for elevated-flight-world-replay. Preparation first runs the
// unmodified original verifier in its own process. Future native values are
// assertion data only; no candidate world, restore, or physics step is used here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const v8 = require('node:v8');
const C = require('./elevated-flight-original-fixture.cjs');
const SCHEMA = 'assertion-equivalent-elevated-flight-reference-v1';
const FULL_BOUNDARIES = Object.freeze(['goalStrikeCreated', 'physicalRest']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function row(value, full = false) {
  const {snapshot, typedState, ...retained} = value;
  if (!full) return retained;
  // V8 deserialization may expose a short view into the whole input artifact.
  // Copy that view before cloning, so a single origin cannot pin that backing.
  const bytes = Buffer.isBuffer(snapshot) ? Buffer.from(snapshot) : snapshot.slice();
  return {...value, snapshot: bytes};
}
function project(original) {
  const record = original.record;
  return structuredClone({...original, record: {...record,
    boundaries: Object.fromEntries(Object.entries(record.boundaries).map(([name, value]) =>
      [name, row(value, FULL_BOUNDARIES.includes(name))])),
    checkpoints: record.checkpoints.map(checkpoint => ({...checkpoint, row: row(checkpoint.row)}))
  }, rows: original.rows.map(value => row(value))});
}
function sourceHashes() {
  const files = ['elevated-flight-reference-memory.cjs', 'elevated-flight-reference-equivalence.cjs',
    'elevated-flight-reference-memory-contract.cjs', 'elevated-flight-world-replay.cjs',
    'cue-cloth-cache-native-compare.cjs',
    'elevated-flight-original-fixture.cjs', 'four-ball-created-fixture.cjs',
    'four-ball-active-ccd-native-compare.cjs', 'four-ball-broad-graph-seed.cjs',
    'goal-four-broad-graph-seed.cjs', 'goal-four-world-seed.cjs',
    'goal-four-initialization-seed.cjs', 'goal-four-initial-contact-import.cjs',
    'three-ball-scene-fixture.cjs'];
  return Object.fromEntries(files.map(name => [name, hash(fs.readFileSync(path.join(__dirname, name)))]));
}
function hashFile(file) {
  const digest = crypto.createHash('sha256'), fd = fs.openSync(file, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let bytes = 0;
  try {
    for (;;) {
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!n) break;
      digest.update(chunk.subarray(0, n)); bytes += n;
    }
  } finally { fs.closeSync(fd); }
  return {sha256: digest.digest('hex'), bytes};
}
function verifyOriginal(file) {
  assert.ok(file && path.isAbsolute(file), 'Explicit absolute original artifact path required');
  const manifestBytes = fs.readFileSync(file + '.json'), manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.probe, false, 'A complete original oracle, never a probe');
  assert.deepEqual(manifest.identity, C.identity(), 'Unchanged original capture/source identity');
  const info = hashFile(file);
  assert.equal(info.sha256, manifest.sha256, 'Entire original file hash, streamed without deserialization');
  assert.equal(info.bytes, manifest.bytes, 'Entire original file length');
  return {...info, manifestSha256: hash(manifestBytes), identity: manifest.identity};
}
async function prepare(file, originalFile) {
  assert.equal(process.env.ELEVATED_FLIGHT_SERIAL_SLOT, '1', 'Coordinator serial preparation slot required');
  assert.ok(file && path.isAbsolute(file) && !fs.existsSync(file) && !fs.existsSync(file + '.json'),
    'Use a fresh absolute compact artifact path; never overwrite evidence');
  const originalIdentity = verifyOriginal(originalFile), frozen = sourceHashes();
  const original = C.load(originalFile); // All original hash, typed-tree, cache and observer checks run unchanged.
  const compact = project(original);
  const equivalence = require('./elevated-flight-reference-equivalence.cjs').verify(original, compact);
  assert.deepEqual(sourceHashes(), frozen, 'Preparation and assertion sources stayed frozen');
  const bytes = v8.serialize(compact);
  const manifest = {schema: SCHEMA, sourceHashes: frozen, original: originalIdentity, equivalence,
    bytes: bytes.length, sha256: hash(bytes), initialSnapshotSha256: compact.record.boundaries.goalStrikeCreated.snapshotSha256,
    frames: compact.record.frames.length, rows: compact.rows.length, checkpoints: compact.record.checkpoints.length};
  fs.writeFileSync(file, bytes, {flag: 'wx'});
  fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function load(file, originalFile) {
  if (!file) return C.load(originalFile);
  assert.ok(path.isAbsolute(file), 'Explicit absolute prepared artifact path required');
  const manifest = JSON.parse(fs.readFileSync(file + '.json'));
  assert.equal(manifest.schema, SCHEMA);
  assert.deepEqual(manifest.sourceHashes, sourceHashes(), 'Prepared-reference sources frozen');
  assert.deepEqual(manifest.original, verifyOriginal(originalFile), 'Same exact verified original file and source identity');
  assert.deepEqual(manifest.equivalence.original, manifest.equivalence.projected, 'Independent ordered assertion transcripts agree');
  assert.ok(manifest.equivalence.original.assertions > 0);
  assert.equal(manifest.equivalence.frames, manifest.frames);
  assert.equal(manifest.equivalence.retained.rows, manifest.rows);
  assert.equal(manifest.equivalence.retained.checkpoints, manifest.checkpoints);
  assert.equal(manifest.equivalence.initialSeedExact, true);
  assert.equal(manifest.equivalence.retained.allOtherValuesExact, true);
  assert.deepEqual(manifest.equivalence.retained.droppedFieldsOnly, ['snapshot', 'typedState']);
  assert.equal(manifest.equivalence.capturedValuesOnly, true);
  assert.equal(manifest.equivalence.physicsSteps, 0);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, manifest.bytes); assert.equal(hash(bytes), manifest.sha256);
  const compact = v8.deserialize(bytes);
  assert.equal(compact.record.frames.length, manifest.frames);
  assert.equal(compact.rows.length, manifest.rows);
  assert.equal(compact.record.checkpoints.length, manifest.checkpoints);
  assert.equal(compact.record.boundaries.goalStrikeCreated.snapshotSha256, manifest.initialSnapshotSha256);
  assert.deepEqual(compact.identity, manifest.original.identity);
  assert.equal(compact.manifest.sha256, manifest.original.sha256);
  console.error(JSON.stringify({initialPairReference: {originalBytes: manifest.original.bytes,
    preparedBytes: manifest.bytes, frames: manifest.frames, rows: manifest.rows, memory: process.memoryUsage()}}));
  return compact;
}
module.exports = {SCHEMA, FULL_BOUNDARIES, hash, hashFile, row, project, sourceHashes, verifyOriginal, prepare, load};
if (require.main === module) prepare(process.argv[2], process.argv[3]).then(result =>
  console.log(JSON.stringify(result, null, 2))).catch(error => {console.error(error.stack); process.exitCode = 1;});
