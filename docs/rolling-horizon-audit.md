# Rolling event horizon audit — CPU research only

## Finding and scope
MMQ2 uses the original rolling recipe, but its world query horizon is at most **65,535 ticks (~62.499 ms)**. A distant wall therefore requires many clear prefixes under the current ABI. The standalone rolling partial supports 64 seconds; that is a descriptor capability, **not permission to query or commit a longer MMQ2 collision horizon**.

No production solver, default route, GPU code, UI, tolerance, work cap, object roster or collision proof was changed. The rejected early-K0 bridge and exact-axis research remain off. This checkpoint records default behavior and a separate numeric experiment; it does not implement or certify an optimization.

## Reproduce
From the repository root, with existing Node dependencies installed:

```sh
# CPU fixture test; initializes the existing Rapier fixture asset provider.
# Coordinate with any memory-sensitive native validation run first.
node tests/rolling-horizon-audit.mjs

# Optional fresh export, without overwriting the checked-in baseline:
node scripts/export-rolling-horizon-fixtures.mjs /tmp/rolling-default-fixtures.json

# Standalone original rolling partial comparison (no native initialization):
node scripts/export-rolling-anchor-audit.mjs > /tmp/rolling-anchor-input.json
# Optional research dependency: Python mpmath (80 decimal digits used).
python scripts/assess-rolling-anchor-audit.py /tmp/rolling-anchor-input.json
# Or assess the checked-in input with no positional argument:
python scripts/assess-rolling-anchor-audit.py
```

Artifacts are `research/rolling-horizon-audit/default-fixtures.json` and `anchor-reference-input.json`. The fixture regression compares all recorded default 256-word step states, impact states, final states, event ticks, history kinds, options and step counts. It does not record full dense/proposal/query/journal buffers and therefore does not establish parity of those buffers. The tail-rest history record has no state; its result is preserved in the top-level final state. Timings are intentionally excluded from the reproducible snapshots.

## Existing contracts
- `deterministic-tube-prefix.mjs`, `packTubePrefixContext`: `durationTicks` is 1..65535.
- `deterministic-recurring-world.mjs`, `gatePreparedWorldTimeCPU`: horizon is `min(context[26], deadline-currentTick, state[60] || 65535)`; `context[26]` originates in `durationTicks`.
- `deterministic-world-supported.mjs`, `chooseRecurringPrefixCPU`: starts with `context[3]`; rolling bodies do not shrink that horizon; resets `state[60]` before preparation.
- `deterministic-mixed-motion-query.mjs`: producer and common descriptor validator both enforce <=65535. MMQ2 invokes that common validator and exposes the same `maxTicks`.
- `deterministic-mixed-motion-v2.mjs`: reserved rolling descriptor words must remain zero; no anchor-offset field exists.
- `deterministic-rolling-partial.mjs`: original rolling recipe accepts <=64*2^20 ticks, without clearance authority.
- `deterministic-cushion-resolver-v2.mjs`: `matched` binds descriptor source words/tick to current state; finite-clear commits cap the horizon at 65535 and sample integer endpoints.
- `deterministic-world-mixed-v2.mjs`: mixed-clear commits also check exact source identity and sample integer endpoints.

After a clear commit, the next recipe is reconstructed from rounded integer state. Stale original-anchor descriptors cannot simply be attached to an advanced state: pair/cushion/stop source-ownership checks would no longer match. A longer-horizon event path would need a separately reviewed contract; this audit does not widen one.

## Observed default CPU fixtures
All original fixture settings and caps were retained.

| Initial speed / x (m/s, m) | Steps | Final status/reason | Final tick | Cushion impact ticks |
|---|---:|---|---:|---|
| 2 / 0 | 99 | 9 / 0 (nominal rest) | 7763487 | 743814, 4066363 |
| 4 / 1.3 | 128 | 5 / 77 (work cap) | 4572481 | 25003, 1262870, 4451894 |
| .2 / 1.38 | 12 | 9 / 0 (nominal rest) | 1103434 | 57817 |

The 2 m/s case had 57 finite-cushion-clear steps, one rolling-stop event, two cushion events, 38 supported steps and one tail-rest. Before the first wall it consumed ten 65535-tick clear prefixes and one 47158-tick normal-spin stop. This is an actual regime event, not translation stopping. The 4 m/s case had 54 clears, 71 supported steps and three cushion events; **it did not reach rest within the 128-step budget**. The .2 m/s case had four clears, six supported steps, one cushion event and one tail-rest. Every captured `state[60]` was zero; persistent tiny-horizon carry was not observed.

## Original-anchor numerical research: explicitly changed policy
The standalone test compares ten sequential 65535-tick recipe reanchors against one original-anchor evaluation at the same total tick (two prefixes for .2 m/s). The latter remains within the standalone partial's original 64-second bound but **exceeds the MMQ2 query limit and is never passed to an MMQ2 event query**.

An independent 80-digit mpmath analytic reference uses the exact same integer source/material words: acceleration magnitude `2K/7`, constant velocity direction, translation clamped at stop, and normal spin decreasing linearly to zero. It does not use an old Rapier trajectory. Materials are directly rounded for this synthetic test, rather than extracted from the world's fixed-point material pipeline.

| Velocity x/z (m/s) | Prefixes | Max position error, reanchored → original anchor (quanta) | Max velocity error (quanta) |
|---|---:|---:|---:|
| 2 / 0 | 10 | 5.5221 → .4779 | 5.2641 → .2641 |
| 1.2 / .8 | 10 | 3.6280 → 1.2524 | .9566 → .2896 |
| -2 / 0 | 10 | 2.4779 → .4779 | 2.7359 → .2641 |
| .2 / 0 | 2 | 1.7959 → .7959 | .1472 → .1472 |

All original-anchor endpoints passed existing rolling diagnostic budgets. Every seven-word endpoint array differed between policies. These examples motivate research; **they are not a general no-accuracy-loss proof or event-sequence parity test**. No collision, cushion response, full-world rest, GPU parity or global physical enclosure follows from them.

## Proposed exact invocation-local query reuse — not implemented
Source inspection shows duplicate coarse queries: `runMixedPairEntryV2CPU`, `runMixedCushionEntryV2CPU` and fallback `runMixedClearPrefixV2CPU` each independently call `runMixedWorldQueryV2CPU` for the same anchor/horizon. The cushion path subsequently clones and refines its ledger with the actual finite-hull queries. Rolling partial and bound preparation also recur across supported preparation, descriptor generation and sampling.

The narrow first proposal is **one private coarse-query cache per `resolveSupportedPrefixV2CPU` invocation**, not a trajectory-policy change:

1. Own immutable snapshots of the complete descriptor rows, scene and exact `{horizonTicks,maxNodes}`.
2. Evaluate the complete coarse roster query once; pass defensive copies through private trusted qualifier helpers. Do not expose a public unchecked precomputed-query parameter or invent descriptor fields.
3. Keep every original pair/static/cloth/stop ledger task, every finite-hull query, all endpoint/range proofs and response/commit checks. A coarse AABB ledger does not replace finite-hull authority.
4. End the cache lifetime at invocation return or any commit/reanchor/event epoch. Invalidate on any source, scene, horizon or configuration change. No cross-step reuse.
5. Use exact key-word comparison or a private immutable snapshot closure. Input identity alone is insufficient because qualifiers slice buffers; publicly mutable typed arrays require mutation guards. Cushion ledger refinement must never mutate the shared coarse result.

Before adoption, compare every output word and failure status through clear, cushion, pair, stop and pending paths, then compare full world histories, impact states, ticks, journals and final states. Count actual query evaluations to establish fewer computations; wall time or dispatch count alone is insufficient. This checkpoint does not perform that refactor or claim those comparisons passed.
