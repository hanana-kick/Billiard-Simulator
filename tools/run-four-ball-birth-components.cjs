'use strict';
// Original creation components only. No whole-shot or product-backend certification.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = Object.freeze([
  'tests/four-ball-initialization-contract.cjs',
  'tests/experimental-four-ball-initialization.cjs',
  'tests/experimental-four-ball-broad-graph-birth.cjs',
  'tests/experimental-four-ball-cloth-birth.cjs',
]);
const required = Object.freeze(['FOUR_BALL_CREATION_V8', 'RAPIER_SNAPSHOT_DECODER', 'GPU_NATIVE_MODULE']);
function plan(env = process.env) {
  for (const key of required) {
    const file = env[key];
    if (!file || !path.isAbsolute(file) || !fs.statSync(file, {throwIfNoEntry:false})?.isFile())
      throw new Error(`${key} must identify an existing absolute file; no native or actual WGSL skip is accepted.`);
  }
  if (!fs.statSync(env.FOUR_BALL_CREATION_V8 + '.json', {throwIfNoEntry:false})?.isFile())
    throw new Error('Original creation artifact requires its verified source/payload .json manifest.');
  if (env.FOUR_BALL_CREATION_REPLAY && path.resolve(env.FOUR_BALL_CREATION_REPLAY) !== path.resolve(env.FOUR_BALL_CREATION_V8))
    throw new Error('All creation components must use the same original artifact.');
  return {command: process.execPath, args:['--test','--test-concurrency=1',...tests],
    options:{cwd:root, env:{...env, FOUR_BALL_CREATION_REPLAY:env.FOUR_BALL_CREATION_V8, REQUIRE_WEBGPU:'1'}, stdio:'inherit'}};
}
function run(env=process.env, launch=spawnSync, log=console) {
  let invocation;
  try { invocation=plan(env); } catch(error) { log.error(error.message); return 2; }
  log.log('Running original four-ball creation components serially against native references and actual WGSL. Global activation and whole-shot ownership remain separate gates.');
  const result=launch(invocation.command,invocation.args,invocation.options);
  if(result.error){log.error(result.error.message);return 1;}
  return Number.isInteger(result.status)?result.status:1;
}
if(require.main===module)process.exitCode=run();
module.exports={required,tests,plan,run};
