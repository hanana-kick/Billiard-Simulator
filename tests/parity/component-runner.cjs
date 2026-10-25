'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { run } = require('../../tools/run-parity-components.cjs');
const required = ['GPU_NATIVE_MODULE', 'RAPIER_SNAPSHOT_DECODER', 'CUE_JOINT_ORACLE', 'CUE_JOINT_PROVENANCE', 'RAPIER_CCD_PROBE', 'THREE_BALL_CREATION_V8', 'THREE_BALL_SWITCH_REPLAY', 'THREE_BALL_SPLIT_REPLAY'];
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-component-runner-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { REQUIRE_WEBGPU: '0' };
  for (const key of required) { env[key] = path.join(dir, key); fs.writeFileSync(env[key], 'test-only placeholder'); }
  for (const key of ['THREE_BALL_SWITCH_REPLAY', 'THREE_BALL_SPLIT_REPLAY']) fs.writeFileSync(env[key] + '.json', '{}');
  return env;
}
test('component runner does not launch without explicit native/GPU inputs and replay identity sidecars', t => {
  const env = fixture(t), reject = () => assert.fail('must not launch');
  for (const key of required) assert.equal(run({ ...env, [key]: undefined }, reject), 2);
  fs.unlinkSync(env.THREE_BALL_SPLIT_REPLAY + '.json');
  assert.equal(run(env, reject), 2);
});
test('component runner enforces actual GPU, serial execution and complete component coverage', t => {
  const env = fixture(t);
  assert.equal(run(env, (command, args, options) => {
    assert.equal(command, process.execPath);
    assert.deepEqual(args.slice(0, 2), ['--test', '--test-concurrency=1']);
    assert.equal(options.env.REQUIRE_WEBGPU, '1');
    assert.equal(env.REQUIRE_WEBGPU, '0');
    const files = args.slice(2);
    assert.equal(new Set(files).size, files.length);
    for (const file of ['experimental-cue-contact-graph-journal.cjs', 'experimental-contact-graph-journal-freshness.cjs', 'experimental-four-cushion-mapping.cjs', 'experimental-scene-split.cjs']) assert.ok(files.includes('tests/' + file));
    assert.ok(!files.some(file => file.includes('shared-graph-rest')), 'long original-scene path is a separate gate');
    return { status: 0 };
  }), 0);
});
test('component runner propagates nonzero and interrupted outcomes', t => {
  const env = fixture(t);
  assert.equal(run(env, () => ({ status: 7 })), 7);
  assert.equal(run(env, () => ({ status: null, signal: 'SIGTERM' })), 1);
  assert.equal(run(env, () => ({ error: new Error('unavailable') })), 1);
});
