'use strict';
// Independent, continuous, unchanged PhysicsLab capture. Expected snapshots never
// become candidate recurrence inputs. The fixed grid and transition rule are
// declared before capture and do not depend on candidate results.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const crypto = require('node:crypto');
const Yaw = require('./three-ball-yaw-fixture.cjs');
const F = Yaw.F;
require('../src/game-rules');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const HORIZON = 9600;
const GRID = Object.freeze([1, 2, 4, 6, 7, 8, 9, ...Array.from({length: 75}, (_, i) => (i + 1) * 128)]);
const SCHEMA = 'original-three-ball-yaw15-continuous-fixed9600-v1';
const TRANSITION_RULE = 'Keep outer before/at/after every contact-graph pair/manifold-count change, application event, cue-presence change, or per-ball sleep change; plus fixed grid.';
const vec = x => [x.x, x.y, x.z];
const quat = x => [x.x, x.y, x.z, x.w];
function sample(b) {
  // Read/copy inertia first: Rapier's public matrix uses shared scratch storage.
  const m = b.effectiveWorldInvInertia();
  const invInertia = [m.m11, m.m12, m.m13, m.m21, m.m22, m.m23, m.m31, m.m32, m.m33];
  return {translation: vec(b.translation()), rotation: quat(b.rotation()),
    linear: vec(b.linvel()), angular: vec(b.angvel()), invInertia, sleeping: b.isSleeping()};
}
function contactTopology(lab) {
  const pairs = new Map();
  lab.world.forEachCollider(co => lab.world.contactPairsWith(co, other => {
    const ids = [F.S.parts(co.handle), F.S.parts(other.handle)]
      .sort((a, b) => a.index - b.index || a.generation - b.generation);
    const key = ids.map(h => h.index + ':' + h.generation).join('/');
    if (pairs.has(key)) return;
    const manifolds = [];
    lab.world.contactPair(co, other, m => manifolds.push({points: m.numContacts(), solverContacts: m.numSolverContacts()}));
    pairs.set(key, {colliders: ids, manifolds});
  }));
  return [...pairs].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
}
function rawSnapshot(snapshot, roles) {
  const d = F.D.decodeSnapshot(snapshot, {binary: process.env.RAPIER_SNAPSHOT_DECODER, engineVersion: '0.21.0'});
  const field = F.D.field, state = d.state;
  const bodies = {}, entries = field(field(field(state, 'bodies'), 'bodies'), 'items').items;
  for (const [role, h] of Object.entries(roles)) {
    const e = entries[h.index];
    if (e?.variant !== 'Occupied') continue;
    assert.equal(Number(field(e, 'generation').value), h.generation);
    bodies[role] = F.plain(field(e, 'value'));
  }
  const colliders = [];
  field(field(field(state, 'colliders'), 'colliders'), 'items').items.forEach((e, index) => {
    if (e.variant === 'Occupied') colliders.push({handle: {index, generation: Number(field(e, 'generation').value)}, ...F.plain(field(e, 'value'))});
  });
  return {sourceRevision: F.D.SOURCE_REVISION, engineSha256: F.D.ENGINE_SHA256,
    snapshot, snapshotSha256: hash(snapshot), bodies, colliders,
    islands: F.plain(field(state, 'islands')),
    modifiedBodies: F.plain(field(field(state, 'bodies'), 'modified_bodies'))[0],
    modifiedColliders: F.plain(field(field(state, 'colliders'), 'modified_colliders'))[0],
    jointState: F.plain(field(state, 'impulse_joints')),
    integration: F.plain(field(state, 'integration_parameters'))};
}
function sourceIdentity(prefixPath) {
  assert.ok(path.isAbsolute(prefixPath), 'Explicit frozen yaw15 prefix path required');
  return {schema: SCHEMA, horizonOuterSteps: HORIZON, grid: GRID, transitionRule: TRANSITION_RULE,
    prefixIdentity: Yaw.sourceIdentity(), prefixSha256: hash(fs.readFileSync(prefixPath)),
    prefixManifestSha256: hash(fs.readFileSync(prefixPath + '.json')),
    captureFunctionSha256: hash(capture.toString()),
    sources: Object.fromEntries([__filename, require.resolve('../src/game-rules')]
      .map(p => [path.relative(path.resolve(__dirname, '..'), p), hash(fs.readFileSync(p))]))};
}
function capture(prefix) {
  const {record, frames: priorFrames} = prefix;
  const lab = new PhysicsLab(F.R), game = new ThreeBallGame(), frames = [], events = [], transitions = [], pending = new Map();
  let hCount = 0, prefixSnapshots = 0, previousPresent = true, outerStep = 0, outerSubstep = 0, subdivisions = 64;
  let firstRestOuter = null, score = null, previousSnapshot, previousSignature, previousEventCount = 0, follow = -1;
  const keep = (step, bytes, reason) => {
    if (step < 0 || step > HORIZON) return;
    if (!pending.has(step)) pending.set(step, {step, snapshot: bytes, reasons: []});
    const row = pending.get(step);
    assert.equal(hash(row.snapshot), hash(bytes), 'One native state for each checkpoint outer');
    if (!row.reasons.includes(reason)) row.reasons.push(reason);
  };
  try {
    assert.equal(lab.objects.length, 3); assert.equal(lab.statics.length, 16);
    assert.equal(lab.steps, 0); assert.equal(lab.time, 0);
    assert.equal(game.begin(record.objects[0].id), true);
    lab.onEvent = event => {
      events.push({...structuredClone(event), outerStep: lab.steps, substepTime: event.time});
      if (event.kind === 'contact') game.contact(event);
    };
    assert.equal(lab.strike(record.objects[0].id, {...record.settings}, {saveSnapshot: false}).ok, true);
    previousSnapshot = lab.world.takeSnapshot();
    assert.equal(hash(previousSnapshot), record.created.snapshotSha256, 'Independent whole shot starts at identical created bytes');
    const initialRaw = rawSnapshot(previousSnapshot, record.roles);
    assert.deepEqual(initialRaw, record.created, 'Independent snapshot projector agrees with original creation capture');
    keep(0, previousSnapshot, 'original-created');
    previousSignature = JSON.stringify({cuePresent: !!lab.cue, sleeping: lab.objects.map(o => o.body.isSleeping()), topology: contactTopology(lab)});
    previousEventCount = events.length;
    const original = lab.angularPatchResistance.bind(lab);
    lab.angularPatchResistance = h => {
      original(h); hCount++;
      const present = !!lab.cue, separation = previousPresent && !present;
      previousPresent = present; outerSubstep++;
      const outerBoundary = outerSubstep === subdivisions;
      if (outerBoundary) { outerStep++; outerSubstep = 0; subdivisions = present ? 64 : 1; }
      if (hCount <= priorFrames.length) {
        const want = priorFrames[hCount - 1];
        const observed = {time: lab.time, h, cuePresent: present, touching: !!lab.cue?.contacts.size,
          separation, outerStep, outerSubstep, outerBoundary, balls: lab.objects.map(o => sample(o.body)),
          cue: present ? {shaft: sample(lab.cue.body), head: sample(lab.cue.head)} : null,
          events: structuredClone(lab.events)};
        const {raw, ...expected} = want;
        assert.deepEqual(observed, expected, 'Exact existing yaw15 prefix observables at h ' + hCount);
        if (raw) {
          assert.deepEqual(lab.world.takeSnapshot(), raw.snapshot, 'Exact existing yaw15 prefix snapshot at h ' + hCount);
          prefixSnapshots++;
        }
      }
    };
    for (let step = 1; step <= HORIZON; step++) {
      lab.step();
      assert.equal(lab.steps, step); assert.equal(outerStep, step); assert.equal(outerSubstep, 0);
      const bodies = lab.objects.map(o => ({id: o.id, ...sample(o.body)}));
      const cuePresent = !!lab.cue, topology = contactTopology(lab);
      const signature = JSON.stringify({cuePresent, sleeping: bodies.map(b => b.sleeping), topology});
      const snapshot = lab.world.takeSnapshot();
      if (GRID.includes(step)) keep(step, snapshot, 'fixed-grid');
      if (step === follow) keep(step, snapshot, 'after-transition');
      if (signature !== previousSignature || events.length !== previousEventCount) {
        transitions.push({step, before: JSON.parse(previousSignature), after: JSON.parse(signature),
          eventIndices: Array.from({length: events.length - previousEventCount}, (_, i) => previousEventCount + i)});
        keep(step - 1, previousSnapshot, 'before-transition'); keep(step, snapshot, 'at-transition'); follow = step + 1;
      }
      if (firstRestOuter === null && !cuePresent && bodies.every(b => b.sleeping)) {
        firstRestOuter = step; score = game.finish();
      }
      frames.push({step, hCount, time: lab.time, cuePresent, bodies, topology, eventCount: events.length,
        contactEventCount: events.filter(e => e.kind === 'contact').length, scoring: game.snapshot()});
      previousSnapshot = snapshot; previousSignature = signature; previousEventCount = events.length;
    }
    assert.ok(hCount >= priorFrames.length, 'Whole capture includes the complete frozen prefix');
    keep(HORIZON, previousSnapshot, 'fixed-horizon');
    const checkpoints = [...pending.values()].sort((a, b) => a.step - b.step)
      .map(row => ({step: row.step, reasons: row.reasons, raw: rawSnapshot(row.snapshot, record.roles)}));
    const restComplete = firstRestOuter !== null && frames.at(-1).bodies.every(b => b.sleeping) && !frames.at(-1).cuePresent;
    return {record, frames, events, transitions, checkpoints, firstRestOuter, score,
      status: restComplete ? 'native-rest-complete' : 'horizon-incomplete',
      prefixAgreement: {h: priorFrames.length, byteIdenticalSnapshots: prefixSnapshots,
        exactObservables: true, createdSnapshotSha256: record.created.snapshotSha256}};
  } finally { lab.dispose(); }
}
function verify(payload) {
  Yaw.verifyRecord(payload.record);
  assert.equal(payload.frames.length, HORIZON);
  payload.frames.forEach((row, i) => { assert.equal(row.step, i + 1); assert.equal(row.bodies.length, 3); });
  for (const row of payload.checkpoints) assert.equal(hash(row.raw.snapshot), row.raw.snapshotSha256);
  for (const step of GRID) assert.ok(payload.checkpoints.some(row => row.step === step), 'Fixed checkpoint ' + step);
  for (const t of payload.transitions) for (const step of [t.step - 1, t.step, t.step + 1].filter(x => x <= HORIZON))
    assert.ok(payload.checkpoints.some(row => row.step === step), 'Transition checkpoint ' + step);
  assert.equal(payload.prefixAgreement.exactObservables, true);
  if (payload.status === 'native-rest-complete') {
    assert.ok(Number.isInteger(payload.firstRestOuter)); assert.ok(payload.score);
    assert.ok(payload.frames.at(-1).bodies.every(b => b.sleeping)); assert.equal(payload.frames.at(-1).cuePresent, false);
  } else assert.equal(payload.status, 'horizon-incomplete');
  return payload;
}
async function captureArtifact(file, prefixPath) {
  assert.ok(file && path.isAbsolute(file), 'Explicit absolute isolated full-shot artifact path required');
  assert.ok(!fs.existsSync(file) && !fs.existsSync(file + '.json'), 'Never overwrite frozen native capture');
  const identity = sourceIdentity(prefixPath), prefix = Yaw.loadArtifact(prefixPath);
  await F.R.init(); assert.equal(F.R.version(), '0.21.0');
  const payload = verify(capture(prefix));
  assert.deepEqual(sourceIdentity(prefixPath), identity, 'Capture source and prefix bytes unchanged');
  const bytes = v8.serialize(payload), manifest = {identity, sha256: hash(bytes), bytes: bytes.length,
    status: payload.status, firstRestOuter: payload.firstRestOuter, score: payload.score,
    prefixAgreement: payload.prefixAgreement, checkpoints: payload.checkpoints.length,
    transitions: payload.transitions.length, sourceRuntimeChanged: false, candidateStateUsed: false};
  fs.writeFileSync(file, bytes, {flag: 'wx'});
  fs.writeFileSync(file + '.json', JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  return manifest;
}
function loadArtifact(file, prefixPath) {
  assert.ok(file && path.isAbsolute(file), 'Explicit existing YAW15_FULL_REPLAY required; capture is never implicit');
  const bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  assert.deepEqual(manifest.identity, sourceIdentity(prefixPath), 'Exact full-shot capture provenance');
  assert.equal(hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
  const payload = verify(v8.deserialize(bytes));
  assert.equal(payload.status, manifest.status); assert.equal(payload.firstRestOuter, manifest.firstRestOuter);
  assert.deepEqual(payload.score, manifest.score); assert.equal(payload.checkpoints.length, manifest.checkpoints);
  assert.deepEqual(payload.prefixAgreement, manifest.prefixAgreement);
  return payload;
}
module.exports = {HORIZON, GRID, SCHEMA, TRANSITION_RULE, sourceIdentity, captureArtifact, loadArtifact};
if (require.main === module) captureArtifact(process.argv[2], process.env.YAW15_REPLAY)
  .then(m => console.log(JSON.stringify(m, null, 2)))
  .catch(e => { console.error(e.stack); process.exitCode = 1; });
