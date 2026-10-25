'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
test('performance validation preserves original full-state comparison functions and gates', () => {
  const original = fs.readFileSync(path.join(__dirname, 'live-registered-world-replay.mjs'), 'utf8'), support = fs.readFileSync(path.join(__dirname, 'live-registered-performance-support.mjs'), 'utf8');
  for (const [start, end] of [
    ['function brief(', 'const FILE ='],
    ['function nativeValue(', 'before(async'],
    ['function pendingOuterIncrement(', '// Same production World source'],
    ['function close(', 'async function run('],
  ]) assert.ok(support.includes(original.slice(original.indexOf(start), original.indexOf(end))), 'Original assertion block preserved: ' + start);
  const gates = original.match(/const TOLERANCES = Object.freeze\(\{[^\n]+\}\);/)[0]; assert.ok(support.includes(gates));
});
