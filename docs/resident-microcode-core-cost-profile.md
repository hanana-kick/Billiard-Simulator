# Resident microcode: measured core instruction cost

This is a **HOST-only**, original-created-input, two-h profile. It is not raw-input GPU throughput, a hardware benchmark, physical strike, or full-rest qualification. Original dt and source caps are unchanged. CPU future states are assertion-only. Both external macros retain their original source bodies.

## Result

The fresh source VM completed **4,710,762** successful core instructions in 186 pumps: 145 external handoffs (8 cue, 137 numeric graph), 40 budget yields, then completion. All 11 independent original-CPU comparison groups matched exactly. The diagnostic host run took 13.228 s; this is not an estimate of GPU speed.

- `MOV` 1,914,249 + `SET` 822,820 = **2,737,069 (58.10%)**.
- Source `LOAD` 191,850 + `STORE` 93,259 = **285,109 (6.05%)**. Every VM opcode also reads/writes VM-local storage; that traffic is **not** included in this category.
- All `rc_f64_*`, `rc_u128_*`, and `rc_rsp_*` function **exclusive** costs sum to **94,240 (2.00%)**. These helpers are not the dominant remaining core cost. Existing external macro arithmetic is excluded from all these counts.
- Live local frame allocation remains 7,820 words for this one-row wrapper. This is not total per-world memory.

Inclusive function counts below include callees and **must not be added for overlapping ancestors**. Replacing a body with one external call and one return would save at most `inclusive − 2 × calls` core instructions, before extra device handoff/kernel overhead. Counts are not elapsed GPU time or bandwidth.

| Source boundary | Calls | Inclusive core instructions | Core share | Source closure / marshalling |
|---|---:|---:|---:|---|
| `rc_world_broad_commit_collision` | 2 | 1,042,095 | 22.12% | 64 functions; 3 u32 args, void; state only; no private globals, numeric interpreter, or f64 |
| `rc_world_broad_before_queries` | 2 | 306,657 | 6.51% | 31 functions; 2 u32 args, void; state only; no private/numeric/f64 |
| Entire phase 17 | 2 | 1,428,436 | 30.32% | 96 functions; vec3<u32> arg, void; stage wrapper, **not a proposed blanket-owner handler** |
| `rc_geometry_numeric_prepare` | 432 | 570,130 | 12.10% | 27 functions; 6 u32 args, u32 return; state/program/geometry/scratch; no private/numeric/f64 |
| `rc_world_shared_graph_owner` | 463 | 999,441 | 21.22% | 87 functions; 5 u32 args, u32 return; includes `rc_num_eval` + 22 f64 helpers; would reintroduce known heavy-native-closure risk |
| `rc_pc_guard` | 2,484 | 342,994 | 7.28% | Single function; 3 u32 args, bool return; state/geometry; poor standalone-handoff economics |
| `rc_pc_advance` | 1,140 | 519,714 | 11.03% | Five functions; 3 u32 args, void; no private/numeric/f64; high handoff frequency |

All audited closures have no referenced private globals. The report walks parsed transitive function calls and unshadowed global references; it is a bounded static audit, **not** a native compiler feasibility or universal aliasing proof. Void/bool/vector signatures require explicit ABI handling rather than inventing return words. Existing private-global reset semantics elsewhere must remain unchanged.

## Next architecture gate

1. Rank exact consecutive `MOV`/`SET` runs from the saved per-PC trace before considering bounded copy/fill micro-ops. Preserve original value-copy/overlap behavior, bounds, dirty writes, branch targets, and yield semantics. **58.1% is an upper bound, not a fusion savings claim.**
2. Broad commit is a defensible two-handoff pilot: no nested numeric interpreter, private-state transport, or f64 closure. Its 22.1% ceiling alone cannot solve the entire remaining core cost. A source-hash-approved, void-return implementation still needs every handoff/full-word transport and original-CPU parity before a timed native pilot.
3. Do not add standalone f64 handlers or blanket owner kernels based on this profile. Do not extrapolate a two-h prestrike profile to later contacts/full rest or 1,024-row throughput.

## Reproduce

```sh
RESIDENT_MICRO_HOST_INTRINSICS=none \
RESIDENT_MICRO_HOST_EXTERNAL_FUNCTIONS='["rc_cue_flat_advance","rc_num_eval"]' \
RESIDENT_MICRO_HOST_ALLOCATION=call-frames-v1 \
RESIDENT_MICRO_HOST_COSTS=1 \
RESIDENT_MICRO_HOST_COST_TRACE=/tmp/resident-microcode-world-host-costs.v8 \
node tests/resident-candidate-microcode-world-host.mjs
node tests/resident-candidate-microcode-cost-report.mjs
```

The second command checks source/bytecode hashes, complete original-CPU parity, and that per-PC counts sum exactly to the committed step counter. Counter collection is fresh-invocation-only; partial resumed traces are rejected.

Durable report: `docs/evidence/resident-microcode-core-cost-host-v1.json` (full exclusive/inclusive function ranks, opcodes, signatures, closure references). Local diagnostic sidecar: `/tmp/resident-microcode-world-host-costs.v8`, 6,022,895 bytes, SHA-256 `c8a1d6e6483ca9e35e3df51e36644b0a7a7669b19bf30cc3f7c8cce74828a42c`. It contains source text, bytecode, functions and per-PC counters, **not runtime future inputs**.

## Subsequent broad transport host gate

`node tests/resident-candidate-microcode-broad-world-host.mjs` now compares the baseline with cue/graph external calls against the same fresh input with broad commit also external. Both paths keep original source physics, dt, caps and the same 512 × 65,536 host transport bound. The broad TEST callback runs the unchanged canonical WGSL closure through the scalar interpreter; this is a transport differential, not an independent arithmetic implementation.

**PASS:** all 147 ordered boundaries (8 cue, 137 graph, 2 broad) match every source-state/dirty-scratch word, argument/return words, and cue/broad pre-call snapshots. Void broad returns have zero words. Each finished world independently matches all 11 actual original-CPU groups.

Core instructions fall exactly by the count-predicted 1,042,091: **4,710,762 → 3,668,671 (22.12%)**. Pumps 186 → 172; budget yields 40 → 24; handoffs 145 → 147. Host elapsed times were 14.862 / 13.682 s, **not a native GPU improvement claim**. Native compilation, strict native parity and timed end-to-end performance remain separate gates. Evidence: `docs/evidence/resident-microcode-broad-paired-host-v1.json`.

## Immutable scalar read-copy estimate (no optimization enabled)

`node tests/resident-candidate-microcode-immutable-read-audit.mjs` imports an instrumented **in-memory copy** of the compiler; it does not edit shared compiler/runtime code or execute physics. Instrumented normal and packed bytecode are asserted identical to the saved measured bytecode before counts are used.

Of 983,265 executed `expr(name)` copy instructions, **608,206 (12.91% of the original core total)** read a scalar `let`, parameter or module constant. The audit excludes 242,363 mutable/unknown and 132,696 aggregate/vector/pointer copies. All 54 compiler-created local address targets are checked; none overlaps an otherwise eligible immutable scalar slot in this source. Declaration, argument, return, bitcast and other copies are **not** counted as removable by this proposal.

**Overlap matters:** 415,783 eligible copies belong to functions wholly outside the broad closure. This is a conservative lower bound on marginal eligible copies after broad offload; 608,206 is the upper bound. Shared callee counters cannot separate inside/outside invocations. Do not add the full 12.91% to broad's 22.12%, and do not equate either with elapsed GPU time.

The narrow direct-read proposal would need to preserve these invariants:

- Each scalar `let`/parameter remains a distinct owned slot: its initializer/argument copy is retained. A `let` initialized from a mutable variable is a snapshot, not an alias of that variable.
- Exclude all mutable/private globals, vectors/structs/arrays/pointers and every address-taken scalar binding. Existing local-object bounds and pointer-escape rejection remain mandatory; arbitrary pointer-bitcasts cannot be used to bypass the exclusion.
- No recursion is admitted. The allocator keeps ancestor/descendant function frames disjoint; nested calls cannot overwrite the caller's immutable scalar slots. Sibling frame reuse cannot expose a prior callee's locals because argument/return copies remain.
- Loop-local slots may be reinitialized on the next iteration, but a borrowed scalar expression is consumed before that backedge. No direct read may escape via a returned alias, a stored pointer or a skipped return copy.
- Preserve all numeric instructions, calls, evaluation order, mutable snapshots, guards, dirty source writes and original source caps. A newly lowered bytecode layout may only resume its own matching checkpoint, never an old layout.

This audit is a bounded opportunity count, not an implementation or universal compiler-correctness proof. No compiler optimization is enabled. Durable evidence: `docs/evidence/resident-microcode-immutable-read-host-v1.json`.
