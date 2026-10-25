'use strict';
// Bounded original-scene continuation, not whole-shot certification.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const required = Object.freeze([
  'GPU_NATIVE_MODULE', 'RAPIER_SNAPSHOT_DECODER',
  'THREE_BALL_CREATION_V8', 'THREE_BALL_FULL_TRACE',
  'THREE_BALL_SWITCH_REPLAY', 'THREE_BALL_PAIR_REPLAY',
  'THREE_BALL_SHARED_PREFIX_REPLAY',
  'THREE_BALL_CUSHION_REPLAY', 'THREE_BALL_SPLIT_REPLAY',
]);
const tests = Object.freeze([
  'tests/experimental-three-ball-scene.cjs',
  'tests/experimental-three-ball-world.cjs',
  'tests/experimental-three-ball-through-cue.cjs',
  'tests/experimental-three-ball-first-pair.cjs',
  'tests/experimental-three-ball-shared-graph-prefix.cjs',
  'tests/experimental-three-ball-shared-graph-through-cue.cjs',
  'tests/experimental-three-ball-shared-graph-first-pair.cjs',
  'tests/experimental-three-ball-shared-graph-first-cushion.cjs',
  'tests/experimental-three-ball-shared-graph-rest.cjs',
]);
function plan(env = process.env) {
  for (const key of required) {
    const file = env[key];
    if (!file || !path.isAbsolute(file) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`${key} must identify an existing absolute file. Scene verification does not silently skip native or actual WebGPU execution.`);
    }
  }
  for (const key of ['THREE_BALL_SWITCH_REPLAY', 'THREE_BALL_PAIR_REPLAY', 'THREE_BALL_SHARED_PREFIX_REPLAY', 'THREE_BALL_CUSHION_REPLAY', 'THREE_BALL_SPLIT_REPLAY']) {
    if (!fs.statSync(env[key] + '.json', { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`${key} requires its source-identity and payload-digest .json sidecar.`);
    }
  }
  return {
    command: process.execPath,
    args: ['--test', '--test-concurrency=1', ...tests],
    options: { cwd: root, env: { ...env, REQUIRE_WEBGPU: '1' }, stdio: 'inherit' },
  };
}
function run(env = process.env, launch = spawnSync, log = console) {
  let invocation;
  try { invocation = plan(env); } catch (error) { log.error(error.message); return 2; }
  log.log('Running the admitted original three-ball default shot serially on native reference and actual WebGPU, including final rest. This is not general-input physics equivalence.');
  const result = launch(invocation.command, invocation.args, invocation.options);
  if (result.error) { log.error(result.error.message); return 1; }
  return Number.isInteger(result.status) ? result.status : 1;
}
if (require.main === module) process.exitCode = run();
module.exports = { plan, run, required, tests };
