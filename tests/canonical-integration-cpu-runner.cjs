'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {run, suites} = require('../tools/run-canonical-integration-cpu.cjs');
const root = path.resolve(__dirname, '..');
test('supplemental canonical manifest names unique existing explicit test files', () => {
  assert.equal(new Set(suites).size, suites.length);
  for (const suite of suites) {
    assert.match(suite, /^tests\/[a-z0-9-]+\.(mjs|cjs)$/);
    assert.ok(fs.statSync(path.join(root, suite)).isFile(), suite);
  }
});
test('CPU integration runner overrides native shell opt-in and keeps tests sequential', () => {
  let seen;
  assert.equal(run({env: {REQUIRE_WEBGPU:'1', GPU_NATIVE_MODULE:'/native/module', SENTINEL:'kept'},
    spawn: (...args) => {seen=args; return {status:0};}}), 0);
  const [command,args,options] = seen;
  assert.equal(command, process.execPath);
  assert.deepEqual(args, ['--test','--test-concurrency=1','--test-reporter=tap',...suites]);
  assert.equal(options.cwd, root);
  assert.deepEqual(options.env, {REQUIRE_WEBGPU:'0', GPU_NATIVE_MODULE:'', SENTINEL:'kept'});
  assert.equal(options.stdio, 'inherit');
});
test('CPU integration runner propagates failure and signals instead of reporting a pass', () => {
  assert.equal(run({spawn:()=>({status:7})}),7);
  assert.equal(run({spawn:()=>({status:null,signal:'SIGKILL'})}),1);
  assert.throws(()=>run({spawn:()=>({error:new Error('spawn unavailable')})}),/spawn unavailable/);
});
