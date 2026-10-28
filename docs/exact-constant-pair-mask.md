# Constant-relative pair mask: exact, but not enabled

This diagnostic tests an exact encoded-phase reduction: after the unchanged
initial separation check, a pair with equal encoded velocity **and** equal
encoded acceleration has constant relative position. It cannot collide in that
phase. Spin is not an omitted influence: phase acceleration is already an input.
Any regime change requires reclassification. The proposal changes no physics,
root ordering, tie rule, timestep, output layout, status or node budget.

**Decision: retain the unmasked runtime.** Fewer interval evaluations did not
translate to lower WebGPU time on the measured software backend. There is no
hardware-GPU speed claim and no inference about hardware performance.

## Bounded paired measurement

300 four-ball encoded rows per workload; three warmups, seven alternating paired
samples. CPU samples each average five evaluations. Native samples include fresh
buffers and compare every output word. Table values are median milliseconds:

| Workload | Node pair bounds, baseline → mask | CPU | Native submit → done | Native whole call |
|---|---:|---:|---:|---:|
| One moving ball | 47,892 → 23,946 | 2.582 → 1.508 | 1.987 → 2.560 | 2.524 → 2.993 |
| All pairs active | 1,800 → 1,800 | 0.265 → 0.323 | 0.399 → 0.415 | 0.566 → 0.587 |
| Common motion | 1,800 → 0 | 0.325 → 0.240 | 0.409 → 0.650 | 0.577 → 0.794 |

All 14,400 output words per workload matched, including states, statuses and node
counts. Separate differential cases cover initial touch, one-quantum clearance,
equal velocity with differing acceleration, equal acceleration with differing
velocity, malformed rows and budgets. These are encoded-kernel tests, not an
additional full-shot physical validation. The native adapter was SwiftShader.
The initial native harness run failed before measurement because its GPU owner
was not retained; the corrected lifetime run produced the linked receipt.

[Raw measurement](evidence/exact-pair-mask-benchmark.json).

## Reproduction and isolation

`node --test tests/deterministic-pair-mask.mjs` runs CPU differential correctness.
The mask variant is constructed by explicit source patches in the test-only
`deterministic-pair-mask-fixture.mjs`; patches fail if baseline locations change.
No runtime module imports this fixture. No optimization is enabled by default.

For the bounded timing/native diagnostic, set `RUN_PAIR_MASK_BENCH=1`,
`REQUIRE_WEBGPU=1`, `GPU_NATIVE_MODULE`, `VK_ICD_FILENAMES`, and optionally
`PAIR_MASK_RECEIPT`. Use the already-installed trusted WebGPU module. No generic
culling framework, dependency install or broader tuning sweep is introduced.
