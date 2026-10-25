# Completed contact-graph journal version sharing

## Scope

This is a bounded host bookkeeping optimization in `experimental-contact-graph-journal.js`, based on `b68246c`. It changes neither arithmetic plans/WGSL nor physical state, contacts, ordering, filtering, or numerical solvers. CPU-reference and WebGPU controllers use the same bookkeeping implementation. Actual WebGPU/world replay and full application/UI validation remain integration responsibilities; the measurements here do not establish those results.

## Ownership and history invariants

- All mutations occur in `d = copy(current)` or `pending.d`, never in a completed `current` graph or its nested objects. Public snapshots, receipt views, projections, prepare results, and post-solve results remain independent copies.
- A completed transaction adopts its already-published receipt `after` as `current`. The next receipt uses that immutable-by-ownership graph as `before`, rather than cloning the identical predecessor again. No production deep-freezing or public mutation hooks were added.
- Every pending publication still clones the draft. Thus a published broad/narrow version cannot be edited by later narrow/post-solve work. A completed draft is never adopted directly.
- Ordinary commit, nonfinal CCD internal advance, and final CCD outer commit all adopt the sealed `after`. Outer rollback holds the immutable `current` reference and restores that exact version on abort.
- First-cloth commit still deletes `pendingCollisionBirth` from the private draft and republishes `after` **before** adopting it. The pre-removal sealed version and initial `before` are untouched. Its geometry-authority checks have not changed.
- Committed sequence `n` always occupies `history[n - 1]`. Ordered CCD passes continue that dense sequence; rollback discards only the outer suffix. This permits `history.slice(sequence)` plus the correctly offset staged suffix, without constructing and scanning all prior receipts.
- Receipt identity/order, validation order, negative-zero acceptance, old cursor catch-up, pending-phase rejection, same-sequence retry, and disposed receipt inspection are unchanged. There is no history pruning. Disposal still drops journal-owned receipt roots and invalidates projection authority while externally held committed receipts remain inspectable.

Future maintainers must preserve the completed-version no-mutation invariant. Directly mutating `current`, a sealed receipt graph, or using sparse/non-dense sequence histories would invalidate this optimization.

## Focused verification

Run:

```sh
node --test --test-concurrency=1 \
  tests/experimental-contact-graph-journal-sharing.cjs \
  tests/experimental-contact-graph-journal-bounded.cjs \
  tests/experimental-contact-graph-journal-freshness.cjs \
  tests/experimental-contact-graph-journal-disposal.cjs \
  tests/experimental-journal-ccd-pass.cjs
```

Result: 26 tests pass, no skips. New test-only probes check exact reference reuse while deeply freezing completed graph trees, without exposing diagnostics in the production API. They cover:

- Three- and four-body mutation isolation through birth, activation, deletion, ordinary abort/retry, and projection/snapshot reads.
- Every cursor boundary and invalid cursor class, caller-owned result arrays, original receipt identity, old history, pending seal enforcement, and disposal.
- CCD outer abort at all four pass positions and all pending phases (absent, broad, narrow, complete), plus successful two-pass commit and same-sequence retry.
- First-cloth commit marker removal before completed-version adoption. This final test deliberately injects only the private bookkeeping precondition; it does not replace the existing original-artifact cloth-binding integration test or prove genuine birth admission.

No heavy world/GPU/browser tests were run by this isolated patch.

## Reproducible microbenchmark

```sh
node tests/contact-graph-journal-sharing-benchmark.cjs b68246c
```

Five separate-process samples per variant/body count, alternating execution order, Node v24.22.1. Each sample performs the same 1,500 transactions, alternating one pair birth/activation and deletion, after a 64-transaction warm-up. The recent suffix workload performs 20,000 reads returning one through four receipt identities. Heap deltas are measured after three explicit garbage collections, with all committed history still retained. Raw results are in `contact-graph-journal-sharing-benchmark.json`.

| Median metric | Three-body baseline | Three-body candidate | Four-body baseline | Four-body candidate |
| --- | ---: | ---: | ---: | ---: |
| Transaction execution, ms | 1163.79 | 1084.95 | 1274.92 | 1226.59 |
| 20,000 recent suffix reads, ms | 369.96 | 1.83 | 382.21 | 1.90 |
| Retained heap delta, bytes | 24,399,648 | 14,045,832 | 26,799,440 | 15,244,784 |
| Distinct retained graph versions | 3,001 | 1,501 | 3,001 | 1,501 |
| Distinct retained graph objects/arrays | 382,625 | 191,375 | 421,638 | 210,888 |

Retained heap fell 42.4% / 43.1%, and median transaction time fell 6.8% / 3.8%. Recent-suffix lookup time fell about 99.5% in this deliberately history-heavy micro-workload. Full-history catch-up still returns every receipt and necessarily scales with the returned history. These are workload-local measurements, not whole-shot/whole-world/GPU speedups. Timing noise is material; raw sample distributions are retained.

Every complete receipt's full JSON view is hashed in order, covering before/after graphs, revisions/sequences, operations, contacts, status, and phase. All baseline/candidate samples match exactly:

- Three-body: `b3dd35d1e9411f26f86146e6e9d66067437d6d0e61a807b54699a1bb5bd595d9`
- Four-body: `20c56f810f6208f7e7d8737a6a88a0058cbe7a3f8f9dcf0d25a1d6d001ef02cd`
