'use strict';
// Independent continuous original shot. These snapshots are assertions, never
// recurrent numerical inputs to an experimental world.
const F = require('./three-ball-scene-fixture.cjs');
const fs = require('node:fs');
const v8 = require('node:v8');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);
const TARGETS = Object.freeze([
  ...range(1336, 1346), ...range(1527, 1531),
  ...range(1703, 1707), ...range(3224, 3228)
]);
const vec = v => [v.x, v.y, v.z];
const quat = q => [q.x, q.y, q.z, q.w];
function frame(lab) {
  return {step: lab.steps, bodies: lab.objects.map(o => ({
    id: o.id, position: vec(o.body.translation()), rotation: quat(o.body.rotation()),
    linearVelocity: vec(o.body.linvel()), angularVelocity: vec(o.body.angvel()),
    sleeping: o.body.isSleeping()
  }))};
}
function numericFrameEqual(actual, expected) {
  assert.equal(actual.step, expected.step);
  assert.equal(actual.bodies.length, expected.bodies.length);
  actual.bodies.forEach((a, i) => {
    const b = expected.bodies[i];
    assert.equal(a.id, b.id);
    assert.equal(a.sleeping, b.sleeping);
    for (const k of ['position', 'rotation', 'linearVelocity', 'angularVelocity']) {
      assert.equal(a[k].length, b[k].length);
      a[k].forEach((x, j) => assert.ok(Number.isFinite(x) && x === b[k][j],
        `Original corpus disagreement at outer ${actual.step}, body ${a.id}, ${k}[${j}]`));
    }
  });
}
function capture(record, baseline) {
  const lab = new PhysicsLab(F.R), rows = [], events = [];
  const expected = new Map(baseline.frames.map(f => [f.step, f]));
  try {
    assert.equal(record.fixtureScope, 'original-three-ball-constructor-layout');
    assert.equal(record.additionalApplicationSettlingSteps, 0);
    assert.deepEqual(baseline.settings, record.settings);
    numericFrameEqual(frame(lab), expected.get(0));
    lab.onEvent = e => events.push({kind: e.kind, step: lab.steps, substepTime: e.time,
      a: e.a ? {id: e.a.id, kind: e.a.kind} : null,
      b: e.b ? {id: e.b.id, kind: e.b.kind} : null});
    assert.equal(lab.strike(1, {...record.settings}, {saveSnapshot: false}).ok, true);
    assert.equal(F.capture(lab.world, record.roles).snapshotSha256,
      record.created.snapshotSha256, 'Exact independently recreated elapsed-zero state');
    for (let step = 1; step <= TARGETS.at(-1); step++) {
      lab.step();
      numericFrameEqual(frame(lab), expected.get(step));
      if (TARGETS.includes(step)) rows.push({step, time: lab.time,
        raw: F.capture(lab.world, record.roles)});
    }
    assert.deepEqual(events, baseline.events.filter(e => e.step < lab.steps),
      'All original application event identities and times through this horizon');
    return {rows, events, outerSteps: lab.steps, seconds: lab.time,
      allOuterObservablesCompared: true, numericMaxAbsolute: 0};
  } finally { lab.dispose(); }
}
function identity(record, baselinePath) {
  assert.ok(process.env.RAPIER_SNAPSHOT_DECODER, 'Explicit admitted decoder required');
  const files = [__filename, require.resolve('./three-ball-scene-fixture.cjs'),
    require.resolve('./cue-initialization-fixture.cjs'), require.resolve('./cue-stroke-fixture.cjs'),
    require.resolve('../src/physics'), require.resolve('../src/math'),
    require.resolve('../vendor/rapier.cjs'), require.resolve('../tools/rapier-snapshot-decoder')];
  return {schema: 'original-three-ball-continuous-cushion-checkpoints-v1',
    initial: record.created.snapshotSha256, targets: TARGETS,
    node: process.versions.node, v8: process.versions.v8,
    decoderBinary: hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)),
    baseline: hash(fs.readFileSync(baselinePath)),
    sources: Object.fromEntries(files.map(p => [p.split('/').slice(-2).join('/'), hash(fs.readFileSync(p))]))};
}
function load(record, path, baselinePath) {
  const before = identity(record, baselinePath);
  if (fs.existsSync(path)) {
    const bytes = fs.readFileSync(path), manifest = JSON.parse(fs.readFileSync(path + '.json', 'utf8'));
    assert.deepEqual(manifest.identity, before, 'Immutable independent replay provenance');
    assert.equal(manifest.sha256, hash(bytes));
    assert.equal(manifest.bytes, bytes.length);
    return v8.deserialize(bytes);
  }
  const baseline = JSON.parse(zlib.gunzipSync(fs.readFileSync(baselinePath)));
  const out = capture(record, baseline);
  assert.deepEqual(identity(record, baselinePath), before, 'Reference sources unchanged during capture');
  const bytes = v8.serialize(out);
  fs.writeFileSync(path, bytes, {flag: 'wx'});
  fs.writeFileSync(path + '.json', JSON.stringify({identity: before,
    sha256: hash(bytes), bytes: bytes.length, checkpoints: out.rows.length}, null, 2), {flag: 'wx'});
  return out;
}
module.exports = {TARGETS, load};
if (require.main === module) (async () => {
  for (const name of ['THREE_BALL_CREATION_V8', 'THREE_BALL_FULL_TRACE', 'THREE_BALL_CUSHION_REPLAY'])
    assert.ok(process.env[name], 'Explicit ' + name + ' required');
  await F.R.init();
  const record = v8.deserialize(fs.readFileSync(process.env.THREE_BALL_CREATION_V8));
  const out = load(record, process.env.THREE_BALL_CUSHION_REPLAY, process.env.THREE_BALL_FULL_TRACE);
  console.log(JSON.stringify({scope: 'independent-original-native-cushion-checkpoints-no-candidate-run',
    outerSteps: out.outerSteps, seconds: out.seconds, checkpoints: out.rows.map(r => r.step),
    allOuterObservablesCompared: out.allOuterObservablesCompared,
    numericMaxAbsolute: out.numericMaxAbsolute, events: out.events,
    artifact: process.env.THREE_BALL_CUSHION_REPLAY}));
})().catch(e => { console.error(e); process.exitCode = 1; });
