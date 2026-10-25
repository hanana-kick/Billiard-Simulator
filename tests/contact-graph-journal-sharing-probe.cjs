'use strict';
// Test-only access to object identity. Production gains no exports, counters,
// freezing, or mutation hooks. Optional source permits an exact baseline replay.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
function observedJournal(source, options = {}) {
  const file = require.resolve('../src/experimental-contact-graph-journal');
  source ??= fs.readFileSync(file, 'utf8');
  const anchor = 'return Object.freeze(api);}';
  assert.equal(source.split(anchor).length, 2, 'one private controller return');
  const instances = [], m = new Module(file, module), read = Module.createRequire(file);
  m.require = name => name === 'test-only:journal-sharing-probe'
    ? probe => instances.push(probe)
    : options.require?.(name, read) ?? read(name);
  const probe = `__journalSharingProbe({
    state:() => ({current, pending, outer, history, identity}),
    receipt:r => receipts.get(r)
  });`;
  m._compile("const __journalSharingProbe=require('test-only:journal-sharing-probe');\n" + source.replace(anchor, probe + anchor), file);
  return { J: m.exports, instances };
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
module.exports = { observedJournal, deepFreeze };
