'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const runner = require('../../tools/run-parity-scene.cjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-scene-runner-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { REQUIRE_WEBGPU: '0' };
  for (const key of runner.required) { env[key] = path.join(dir, key); fs.writeFileSync(env[key], 'test-only placeholder'); }
  for (const key of ['THREE_BALL_SWITCH_REPLAY', 'THREE_BALL_PAIR_REPLAY', 'THREE_BALL_SHARED_PREFIX_REPLAY', 'THREE_BALL_CUSHION_REPLAY', 'THREE_BALL_SPLIT_REPLAY']) fs.writeFileSync(env[key] + '.json', '{}');
  return env;
}
test('scene runner requires explicit native, GPU and independently captured evidence paths', t => {
  const env = fixture(t);
  for (const key of runner.required) {
    assert.throws(() => runner.plan({ ...env, [key]: undefined }), new RegExp(key));
    assert.throws(() => runner.plan({ ...env, [key]: 'relative-file' }), new RegExp(key));
  }
  fs.unlinkSync(env.THREE_BALL_PAIR_REPLAY + '.json');
  assert.throws(() => runner.plan(env), /sidecar/);
});
test('scene runner forces real GPU and sequential tests without mutating caller environment', t => {
  const env = fixture(t), invocation = runner.plan(env);
  assert.equal(invocation.options.env.REQUIRE_WEBGPU, '1');
  assert.equal(env.REQUIRE_WEBGPU, '0');
  assert.deepEqual(invocation.args.slice(0, 2), ['--test', '--test-concurrency=1']);
  assert.deepEqual(invocation.args.slice(2), runner.tests);
  assert.ok(runner.tests.includes('tests/experimental-three-ball-through-cue.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-first-pair.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-shared-graph-prefix.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-shared-graph-through-cue.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-shared-graph-first-pair.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-shared-graph-first-cushion.cjs'));
  assert.ok(runner.tests.includes('tests/experimental-three-ball-shared-graph-rest.cjs'));
});
test('scene runner propagates failures and never launches when evidence is missing', t => {
  const env = fixture(t), log = { log() {}, error() {} };
  assert.equal(runner.run({}, () => assert.fail('must not launch'), log), 2);
  for (const status of [0, 1, 7]) assert.equal(runner.run(env, () => ({ status }), log), status);
  assert.equal(runner.run(env, () => ({ status: null, signal: 'SIGTERM' }), log), 1);
  assert.equal(runner.run(env, () => ({ error: new Error('unavailable') }), log), 1);
});
