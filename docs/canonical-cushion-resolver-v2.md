# Explicit MMQ2 finite-cushion resolver

`deterministic-cushion-resolver-v2.mjs` is a separate opt-in composition. It does not replace the MMQ1 resolver, alter default routing, or introduce a fitted rolling/slide/collision law.

## API and authority

- CPU: `runCushionResolverV2CPU(current, descriptors, scene, hulls, context, rails, material, options)`.
- GPU: `createCushionResolverV2GPU(device, material).createBank(...)`, with the same resident input/output bank fields as v1. `queryBuffer` / `ledgerBuffer` alias the actual complete merged finite ledger (`cushion.query` on CPU), not the conservative AABB ledger; no extra allocation or readback is introduced.
- Descriptors must be explicitly MMQ2 (`0x4d4d5102`) and context 13 must declare canonical-local ownership. Kinds 0/1/2/3 denote original REST/SMT2/FLIGHT/ROLLING recipes.
- Current identities, clock, positive horizon, radius/mass, modes, nine p/v/q words and encoded context must agree. Rolling descriptors additionally match the source rolling coefficient and five local budgets, zero incoming local-anchor recipe errors, and the original rolling-partial version. Signed-range source friction F and rolling K must remain feasible (0≤F≤16Q, 0≤K≤4Q, 2K≤7F); this is rechecked after producer admission. Polynomials/rolling caches come from the trusted original MMQ2 producer, not arbitrary caller-authored trajectories.
- Actual finite hull identities, bounds, rail mapping and immutable response material remain mandatory. No hull ID is suppressed, including the last-hit rail. Original numerical budgets are unchanged.

A genuine finite EDGE entry and original isolated cushion response commit the full-roster common-clock impact first. `impact.state` / `impactStateBuffer` is the **journal snapshot**; the later departure is not another cushion event. The shared world impact-commit ABI already supports rolling endpoint modes. A new original producer prefix then uses accepted SMT2 where required and original rolling recipes elsewhere. Release requires the original whole-interval outward and finite-hull separation proof, all other-object/cloth/regime records clear, and the original deadline. Failure retains the actual impact pending; a deadline refusal remains 5/84.

## Complete ledger and stop ownership

The MMQ2 ledger has a base task count in word 9 and total task count in word 8. Two additional authoritative kind 6 records—translation stop and normal-spin stop—are appended for every rolling body. Full finite CLEAR requires every expected pair, finite hull, extra static, cloth, landing and stop record in complete order, each CLEAR with the full positive horizon, plus the matching summary and deadline. A missing, reordered, nonclear or tied stop cannot become CLEAR. The existing v2 entry and release components independently refuse stops at/before their candidate endpoints; no stop is skipped to admit a cushion.

CLEAR advances the original all-body endpoint and counter 56 only among segment/event counters; cushion count/tick/rail 61/62/63 and other event counters remain unchanged. The owning world must handle explicit stop transitions when these records block the current interval. This resolver does not silently cross a stop, fake REST, or claim a whole shot is complete.

## Endpoint representation

Rolling p/v/q are sampled from the original partial law. The sampler's mode 88 is retained, not reconstructed with an SMT2 condition. Source q remains qx/qy/qz in state. Rolling receipt words 84/85/86 are qx/qz/qy and map directly to dense 36/38/37; kinetic radius 87 maps to dense 40. GPU mapping equivalently uses partial-result 28/30/29/49 for dense 36/37/38/40. Nonrolling bodies retain the original v1 endpoint arithmetic and receipt assignment.

The output remains canonical-local, not a carried global physical enclosure: `globalReceiptCertified:false`. Preserving q/qy and local receipts is not global KISS qualification.

## Resident execution

The candidate-local GPU owner gate is retained: 1 direct owner command and, after the selected-endpoint cache split, 29 indirect commands, with 0 heavy workgroups on inactive/mismatched input. The existing 32-byte indirect query config and its 1-or-3/4-body dispatch shapes are unchanged. The entry qualifier now uses an eighth storage binding for a 1024-byte selected-only endpoint cache, shared across the four sequential rail attempts. Four extra cache commands use one 16-lane workgroup each; only the selected rail performs endpoint sampling. Public diagnostic buffers are cleared on every encode; cache words are fully overwritten by the sampler, preventing stale bank-reuse results. Current metrics are 30 encoded dispatches and 14 explicit clears, with 71,872 bytes for 3 bodies or 73,216 bytes for 4 bodies (excluding input buffers and pipelines). Work admission reserves space/budget for both stop records for every body. No host predicate or intermediate readback is added.

Native numerical qualification is recorded separately below; software Vulkan results are not hardware-performance claims. No publication/default switch is authorized by this component.

## Component checkpoint

CPU: 22 passed with 2 native-only skips; typecheck passed. Independent review verified the complete base/stop ledger guards, receipt ordering, endpoint mode, pending/deadline behavior and source ownership; its friction-feasibility finding was corrected and independently retested.

Pre-cache bounded native checkpoint: **17 cases / 31,552 exact CPU/GPU words**, including complete finite ledgers, final state/dense, genuine impact state/dense, release proofs and original departure descriptors. Cases cover actual rolling EDGE response/departure, mixed-roster rolling preservation, a later normal-spin stop refusing departure while retaining the impact, initial stop/tie refusals, three/four-body full CLEAR, original post-departure SMT2 CLEAR, source/version/F substitutions, inactivity and deadline refusal. Before/after source hashes matched. Allocations are 70,848 bytes (3 bodies) and 72,192 bytes (4 bodies).

Final compile 80.810s, bounded elapsed 82.383s, sampled aggregate 1467.76MiB under 1500MiB. This is close to the memory cap and does not qualify a larger full-world compilation. Backend was SwiftShader software Vulkan, not physical GPU performance. Full-world rolling→cushion→release→REST and repeated-cushion qualification belong to the explicit v2 world integration, not this component checkpoint.

The selected-endpoint cache component and stale-source tests are documented in
`canonical-cushion-entry-compile.md`. The pre-cache 17-case resolver evidence above
does not by itself qualify the modified resolver bank or full-world composition;
those require their own subsequent native run.
