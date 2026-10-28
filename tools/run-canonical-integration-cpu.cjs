'use strict';
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const suites = Object.freeze(require('./canonical-integration-cpu-suites.json'));
const root = path.resolve(__dirname, '..');
function run({spawn = spawnSync, env = process.env} = {}) {
  // This entry point is CPU/fake-device only even in a native-enabled shell.
  // Native cases remain visible as SKIP, never as an implied parity pass.
  const result = spawn(process.execPath,
    ['--test', '--test-concurrency=1', '--test-reporter=tap', ...suites],
    {cwd: root, stdio: 'inherit', env: {...env, REQUIRE_WEBGPU: '0', GPU_NATIVE_MODULE: ''}});
  if (result.error) throw result.error;
  return Number.isInteger(result.status) ? result.status : 1;
}
module.exports = {run, suites};
if (require.main === module) process.exitCode = run();
