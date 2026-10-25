'use strict';
// Opt-in bounded graph microbenchmark, not a physics/world/GPU performance claim.
// Each sample runs in its own --expose-gc process with identical fixed operations.
// Usage: node tests/contact-graph-journal-sharing-benchmark.cjs [baseline-revision]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { seed, at, pair } = require('./contact-graph-bounded-fixture.cjs');
const { observedJournal } = require('./contact-graph-journal-sharing-probe.cjs');
const revision = process.argv[2] ?? 'b68246c';
const samples = Number(process.env.JOURNAL_BENCH_SAMPLES ?? 5);
const frames = Number(process.env.JOURNAL_BENCH_FRAMES ?? 1500);
const queries = Number(process.env.JOURNAL_BENCH_QUERIES ?? 20000);
const sourcePath = 'src/experimental-contact-graph-journal.js';
assert.ok(Number.isInteger(samples) && samples > 0, 'positive sample count');
assert.ok(Number.isInteger(frames) && frames >= 4, 'at least four transactions');
assert.ok(Number.isInteger(queries) && queries > 0 && queries % 4 === 0, 'positive query count divisible by four');
const median = xs => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function graphCounts(roots) {
  const all = new Set();
  const visit = value => {
    if (value && typeof value === 'object' && !all.has(value)) {
      all.add(value); for (const child of Object.values(value)) visit(child);
    }
  };
  roots.forEach(visit);
  return { graphVersions: new Set(roots).size, graphObjects: all.size };
}
async function child(variant, count) {
  assert.equal(typeof global.gc, 'function', '--expose-gc is required');
  const source = variant === 'baseline'
    ? execFileSync('git', ['show', `${revision}:${sourcePath}`], { encoding: 'utf8' })
    : fs.readFileSync(require.resolve('../src/experimental-contact-graph-journal'), 'utf8');
  const { J, instances } = observedJournal(source), s = seed(count), j = J.createReferenceStage(s), t = {};
  const probe = instances[0], edge = pair(s, 0, 1);
  j.claim(t);
  const positions = [at(s, { 1: .15 }), at(s, { 0: -1 })];
  // The same pose/transitions alternate one pair birth/activation and deletion.
  // Warm arithmetic/compiler paths with an independent journal, then discard it.
  let warm = J.createReferenceStage(s); const w = {};
  warm.claim(w);
  for (let i = 0; i < 64; i++) {
    await warm.prepare(positions[i % 2], w);
    warm.narrowTransitions(i % 2 ? [] : [{ ...edge, active: true }], w);
    await warm.postSolve(positions[i % 2], w); warm.commit(w);
  }
  warm.release(w); warm.dispose(); warm = null; instances.splice(1);
  for (let i = 0; i < 3; i++) global.gc();
  const heapBefore = process.memoryUsage().heapUsed, start = performance.now();
  for (let i = 0; i < frames; i++) {
    await j.prepare(positions[i % 2], t);
    j.narrowTransitions(i % 2 ? [] : [{ ...edge, active: true }], t);
    await j.postSolve(positions[i % 2], t); j.commit(t);
  }
  const transactionMs = performance.now() - start;
  for (let i = 0; i < 3; i++) global.gc();
  const retainedHeapBytes = process.memoryUsage().heapUsed - heapBefore;
  const queryStart = performance.now(); let totalReturned = 0;
  for (let i = 0; i < queries; i++) totalReturned += j.receiptsSince(frames - 1 - (i % 4), t).length;
  const suffixQueryMs = performance.now() - queryStart;
  assert.equal(totalReturned, queries * 2.5);
  const roots = [probe.state().current];
  const hash = createHash('sha256');
  for (const receipt of j.receiptsSince(0, t)) {
    const r = probe.receipt(receipt); roots.push(r.before, r.after);
    hash.update(JSON.stringify(J.viewReceipt(receipt)));
  }
  const output = { variant, bodyCount: count, frames, queries, transactionMs, suffixQueryMs, retainedHeapBytes,
    ...graphCounts(roots), receiptSha256: hash.digest('hex') };
  j.release(t); j.dispose();
  process.stdout.write(JSON.stringify(output));
}
async function main() {
  if (process.env.JOURNAL_BENCH_CHILD) return child(process.env.JOURNAL_BENCH_CHILD, Number(process.env.JOURNAL_BENCH_BODIES));
  const rows = [];
  for (const count of [3, 4]) for (let i = 0; i < samples; i++) {
    // Alternate process order to avoid systematically favoring a warm machine.
    for (const variant of i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
      rows.push(JSON.parse(execFileSync(process.execPath, ['--expose-gc', __filename, revision], {
        encoding: 'utf8', env: { ...process.env, JOURNAL_BENCH_CHILD: variant, JOURNAL_BENCH_BODIES: String(count) }
      })));
    }
  }
  const summary = [];
  for (const count of [3, 4]) {
    const selected = rows.filter(r => r.bodyCount === count);
    assert.equal(new Set(selected.map(r => r.receiptSha256)).size, 1, 'every complete baseline/candidate receipt matches exactly');
    const pair = {};
    for (const variant of ['baseline', 'candidate']) {
      const group = selected.filter(r => r.variant === variant);
      pair[variant] = Object.fromEntries(['transactionMs', 'suffixQueryMs', 'retainedHeapBytes', 'graphVersions', 'graphObjects'].map(k => [k, median(group.map(r => r[k]))]));
    }
    summary.push({ bodyCount: count, ...pair, receiptSha256: selected[0].receiptSha256 });
  }
  console.log(JSON.stringify({ baseline: revision, node: process.version, samples, frames, queries, summary, rows }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
