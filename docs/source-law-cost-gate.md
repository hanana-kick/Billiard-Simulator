# Experimental axial-prefix cost gate

`minAnalyticFrames` is an explicit experimental dispatch option, default **0
(disabled)**. It does not alter any physical coefficient, certificate or contact
resolver. When a proposed prefix is shorter than the configured minimum, the
controller runs **all remaining frames through unchanged original physics** and
stops retrying. The gate also applies after a failed envelope check halves the
prefix. Work already incurred is counted.

This is not a production activation or a claim that 16 is an optimal threshold.

## Bounded measurement

Four prepared 96-frame fixtures, three warmups and seven measured runs per
variant, rotating execution order. Identical fresh construction is outside the
timer; evaluator and all admission/certification work are inside. Diagnostic
records are disabled. Receipt: [paired measurements](evidence/source-law-cost-gate-benchmark.json).

| Fixture | Original median ms | Ungated median ms | Gate 16 median ms | Skipped source frames, ungated → gated |
| --- | ---: | ---: | ---: | ---: |
| Near rail | 5.424 | 7.929 | 4.131 | 93 → 70 |
| Forward slip | 4.904 | 2.805 | 2.313 | 81 → 81 |
| Moving pair | 4.637 | 4.515 | 3.495 | 53 → 53 |
| Reversal | 4.006 | 1.049 | 0.719 | 96 → 96 |

Near-rail axial attempts fall from 9 to 3. This fixture demonstrates why fewer
solver calls alone is insufficient: retaining more original steps can reduce
total runtime. Same-path timing differences (especially reversal) are measurement
variation, **not evidence that the gate improves identical work**. These are
small CPU fixtures, not raw shots, GPU throughput, or general speed guarantees.

Changing handoff time changes the hybrid numerical endpoint. Near-rail gated
versus ungated differences are 11.0 µm position, 0.000867 m/s velocity,
0.01358 rad/s angular velocity, and 0.000222 quaternion component. Other three
fixtures have identical measured endpoints. No accuracy ordering or hybrid
bit-identity is claimed. Tests verify that once fallback is selected, it is
exactly the original method called once for the whole remainder, with identical
output from the same handoff state.

## Snapshot admission limitation

The first attempted benchmark was rejected: restoring a native snapshot changes
the `world.gravity` getter from configured `-9.81` to its f32 representation,
`-9.8100004196167`. Current exact gravity guards conservatively reject restored
analytic candidates. Those timings did not exercise the optimization and were
not retained. Fresh prepared fixtures were used instead; the gravity guard was
not loosened. Explicitly separating native load gravity and the original patch
load cap requires its own qualification, outside this cost-gate change.

```sh
DIRECT_CUE_RAPIER_PATH="$PWD/vendor/rapier.cjs" \
  node --test tests/source-law-cost-gate.mjs
DIRECT_CUE_RAPIER_PATH="$PWD/vendor/rapier.cjs" \
  node tests/source-law-cost-gate-benchmark.mjs
```
