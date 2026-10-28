/** Exact default baseline, not evidence of optimized-solver parity. CPU-only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recordRollingHorizonFixtures} from '../scripts/export-rolling-horizon-fixtures.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('../research/rolling-horizon-audit/default-fixtures.json',import.meta.url),'utf8'));
const actual=JSON.parse(JSON.stringify(recordRollingHorizonFixtures()));
assert.deepEqual(actual,baseline,'Full recorded default states, events, options and step counts');
assert.equal(actual[1].state[1],5);assert.equal(actual[1].state[2],77,'4 m/s remains work-cap pending, not rest');
for(const run of actual)for(const step of run.history)if(step.horizon!==undefined)assert.ok(step.horizon<=65535);
console.log('rolling-horizon-audit: 3 default fixture snapshots match exactly; no optimized solver tested');
