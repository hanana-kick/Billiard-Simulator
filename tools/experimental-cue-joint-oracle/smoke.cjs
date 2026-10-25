'use strict';
// SPDX-License-Identifier: Apache-2.0
// Bounded native diagnostic smoke probe. No full-world stepping or GPU work.
const assert = require('node:assert/strict');
const { runOracle, f32Bits, floatValue } = require('./index.cjs');
const body = () => ({ world_com: [0, 0, 0], im: [1, 1, 1], ii: [1, 0, 0, 1, 0, 1], linear: [0, 0, 0], angular: [0, 0, 0] });
const frame = () => ({ translation: [0, 0, 0], rotation: [0, 0, 0, 1] });
function fixture(kind = 'flex') {
  return { kind, frame1: frame(), frame2: frame(), body1: body(), body2: body(),
    dt: 1 / 240, erp_inv_dt: 40, cfm_coeff: 0, max_corrective_velocity: 3, solve_iterations: 1 };
}
function probe(input) {
  const out = runOracle(input);
  assert.equal(out.metadata.originalWasmOracle, false);
  const result = out.result, count = input.kind === 'flex' ? 4 : 6;
  for (const key of ['rows_before_finalize', 'rows', 'rows_after_solve']) assert.equal(result[key].length, count);
  assert.deepEqual(result.rows.slice(0, 3).map(row => row.writeback_id), [3, 4, 5].map(axis => ({ kind: 'dof', axis })));
  assert.deepEqual(result.rows.slice(3).map(row => row.writeback_id), input.kind === 'flex'
    ? [{ kind: 'dof', axis: 0 }] : [{ kind: 'dof', axis: 1 }, { kind: 'dof', axis: 2 }, { kind: 'limit', axis: 0 }]);
  return result;
}
const flex = probe(fixture());
assert.equal(floatValue(flex.rows[0].inv_lhs), 2);
assert.equal(floatValue(flex.rows[3].inv_lhs), .5);
assert.equal(floatValue(flex.rows_after_solve[3].impulse), 0);
for (const x of [-.2, -.08, 0, .13, .2]) {
  const input = fixture('guide'); input.frame2.translation[0] = x;
  const row = probe(input).rows[5];
  assert.deepEqual(row.impulse_bounds.map(floatValue), [Math.fround(x) <= Math.fround(-.08) ? -Infinity : 0, Math.fround(x) >= Math.fround(.13) ? Infinity : 0]);
  assert.ok(Math.abs(floatValue(row.rhs)) <= 3);
}
const seeded = fixture();
seeded.solve_iterations = 0;
seeded.warmstart = { impulses: [1, 2, 3, 4].map(f32Bits), coefficient: .5, apply: true };
const warm = probe(seeded);
assert.deepEqual(warm.rows.map(row => floatValue(row.impulse)), [.5, 1, 1.5, 2]);
assert.deepEqual(warm.body1.linear.map(floatValue), [2, 0, 0]);
assert.deepEqual(warm.body2.linear.map(floatValue), [-2, 0, 0]);
assert.deepEqual(warm.body1.angular.map(floatValue), [.25, .5, .75]);
const signed = fixture(); signed.dt = f32Bits(1 / 240); signed.solve_iterations = 0;
signed.body1.linear[0] = { bits: 0x80000000 };
assert.equal(probe(signed).body1.linear[0].bits, 0x80000000);
console.log(JSON.stringify({ ok: true, oracleKind: 'instrumented-pinned-rust-scalar-joint', probes: 8, originalWasmOracle: false }));
