'use strict';
// These fixed original shots are regression evidence, not general GPU admission.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = Object.freeze([
  'tests/experimental-three-ball-shared-graph-rest.cjs',
  'tests/experimental-three-ball-yaw-full-shot.cjs',
  'tests/experimental-four-ball-full-shot.cjs',
]);
const required = Object.freeze([
  'GPU_NATIVE_MODULE', 'RAPIER_SNAPSHOT_DECODER',
  'THREE_BALL_CREATION_V8', 'THREE_BALL_FULL_TRACE',
  'THREE_BALL_PAIR_REPLAY', 'THREE_BALL_CUSHION_REPLAY', 'THREE_BALL_SPLIT_REPLAY',
  'YAW15_REPLAY', 'YAW15_FULL_REPLAY', 'FOUR_BALL_CREATION_V8', 'FOUR_BALL_FULL_REPLAY',
  'YAW15_FULL_REFERENCE', 'FOUR_BALL_FULL_REFERENCE',
]);
const manifested = Object.freeze(['YAW15_REPLAY', 'YAW15_FULL_REPLAY', 'FOUR_BALL_CREATION_V8', 'FOUR_BALL_FULL_REPLAY', 'YAW15_FULL_REFERENCE', 'FOUR_BALL_FULL_REFERENCE']);
function file(p, label) {
  if (!p || !path.isAbsolute(p) || !fs.statSync(p, {throwIfNoEntry:false})?.isFile())
    throw new Error(`${label} must be an existing absolute file. No capture, default path or skipped GPU substitute is allowed.`);
}
function plan(env = process.env, cwd = root) {
  for (const key of required) file(env[key], key);
  for (const key of manifested) file(env[key] + '.json', key + ' provenance manifest');
  for (const test of tests) file(path.join(cwd, test), test);
  return {command:process.execPath, args:['--test', '--test-concurrency=1', ...tests],
    options:{cwd, env:{...env, REQUIRE_WEBGPU:'1'}, stdio:'inherit'}};
}
function run(env=process.env, launch=spawnSync, log=console, cwd=root) {
  let invocation;
  try { invocation=plan(env,cwd); } catch(error) { log.error(error.message); return 2; }
  log.log('Serial original-world regressions: 3-ball default, 3-ball yaw15, 4-ball default. Each requires CPU/native and actual WGSL. This does not certify arbitrary inputs, positive goals, hardware performance or a product GPU backend.');
  const result=launch(invocation.command,invocation.args,invocation.options);
  if(result.error){log.error(result.error.message);return 1;}
  return Number.isInteger(result.status)?result.status:1;
}
if(require.main===module)process.exitCode=run();
module.exports={tests,required,manifested,plan,run};
