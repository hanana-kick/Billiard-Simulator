# Shared-graph boundary: reject unconditional external-macro substitution

This is a **source-only follow-up** to the exact first-h HOST cost report, not a new port, replay, pipeline compilation or GPU measurement. Source SHA256 remains `5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7`. The live raw h192 numerical runtime is unchanged.

| Exact source root | Minimal linked closure | H1 calls | Conditional core savings | Active macro handoffs |
|---|---:|---:|---:|---:|
| `rc_world_shared_graph_owner` (5 u32 → u32) | 52,663 bytes / 87 functions | 232 | 499,707 | 74 → 237 |
| `rc_geometry_numeric_prepare` (6 u32 → u32) | 10,275 bytes / 27 functions | 216 | 284,633 | 74 → 290 |

Closure hashes respectively: `b439ea6ef3060f67a8c0888a82f24682b880cbc460d8b40287a9c2ebc13ca161` and `ba5c676bec2f7dc29ab7e2a9e4959f793a0325df34366baf475e81c797c6833c`. Both use state RW, program RO, geometry RO and scratch RW; neither references private globals or local arrays. Source references: `world-shared-graph-owner.mjs`, `numeric-request.mjs`, `world-owner-routing.mjs`, and the original geometry preparation helpers.

The whole root contains one static `rc_num_eval` call site through `rc_numeric_request_evaluate`, outside preparation/suffix loops. It was called 232 times but evaluated only **69** graphs in this prefix. Replacing that root with an unconditional external macro removes 69 old numeric waits but adds 232 new waits. Preparation alone adds 216 waits. Reduced scalar instruction count therefore does **not** establish reduced commands or time.

Preparation's eight loops are bounded copies/clears (largest 368 words), with no numeric-evaluator or f64 closure. Whole-root closure adds existing graph caps of 65,536 inputs, 1,000,000 nodes and 1,000,000 outputs plus software-f64 helpers. Its single evaluator call site is structurally better than duplicating it across many owners, but the whole native closure remains uncompiled/unqualified. `rc_owner_complete` must retain authority: WAIT preserves PC, COMPLETE advances once, and INVALID never becomes a miss.

For the current one-core-plus-all-handlers-per-pump schedule, same-path algebraic command bounds to the measured h1 source boundary are:

- Current four macros: **375–510** commands (5 stages/pump).
- Whole-root external macro: **1,428–1,542** (6 stages/pump).
- Preparation external macro: **1,746–1,878** (6 stages/pump).

These combine exact observed core/call counts with conditional stub substitution and bounded work-yield arithmetic; they are **not measured replacement traces or GPU timings**. They exclude initialization/capture and cannot be extrapolated to impact/full rest/1024 rows.

## Bounded next experiment, not yet implemented

If pursued after the current numerical slot releases, test the exact source-hash-bound **integer-only preparation inside the existing compact VM kernel**, rather than introducing another external wait. First capture only a few authenticated calls and compare all state/dirty scratch/control effects against scalar source execution; then preflight/compile the lean component and measure it against the unchanged core. Preserve wrapping, source order, bounds, signatures, failure behavior and source return PC. This avoids 216 new handoffs and the nested graph-interpreter closure, but compilation and performance remain unknown. No such optimization is included in this checkpoint.
