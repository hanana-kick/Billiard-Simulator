# Earlier qt bridge — rejected for no-accuracy-loss goal

`runExperimentalEarlyQtWorldCPU` is a separate opt-in research entry point. Existing `runPreparedWorldCPU` calls and GPU routing are unchanged. This is a **revised integration policy**, not an identical-path optimization, hardware benchmark, or release qualification.

## Policy and proof boundary

For supported worlds containing only REST/sliding bodies, with no active contact, inspect an originally accepted but shortened smooth proposal. Prefer the existing qt bridge only if its original search certifies a longer interval. The common-time fixed-duration qt calculation is rerun, and the existing all-object tube checker must certify the entire interval against every sphere, table bound and static box. Otherwise use the unchanged continuation. No event resolver/journal side effects occur before this clearance decision. Original budgets, 128-step cap, numerical laws, and fixed-point tolerances are unchanged. Rolling/airborne/mixed-source cases retain the old route.

The selector does not alter smooth acceptance flags to pretend the smooth solver failed; the optional `preferQtMask` is explicit and checks original qt acceptance/version. The CPU runner accepts an optional internal supported-step function; the experimental wrapper is its only new caller. No experimental option is sent to the qualified GPU engine. Selected-trace capture is deliberately rejected by the wrapper.

Fallback currently repeats some probe work, and discarded speculative work is not reflected in returned fallback counters. Accepted-step reduction is **not** a demonstrated reduction in total arithmetic, shader dispatches, elapsed time, or memory. Counters are not a cumulative request-work certificate. Local bridge bounds do not prove global physical accuracy across subsequent impacts.

## Measured complete CPU requests

Six prepared three-body fixtures, default materials, unchanged maxWorldSteps=128:

| Speed / x | Original | Experimental | Accepted early bridges |
|---|---|---|---:|
| 0.2 / 1.38 | REST, 12 steps | REST, 12 steps | 0 |
| 0.1 / 1.38 | pending 7/6, 11 steps | pending 7/6, 11 steps | 0 |
| 2 / 0 | REST, 99 steps | REST, 85 steps | 2 |
| 3.5 / 1.3 | budget 5/77, 128 steps | budget 5/77, 128 steps | 3 |
| 4 / 1.3 | budget 5/77, 128 steps | REST, 120 steps | 4 |
| 4 / 0 | budget 5/77, 128 steps | REST, 112 steps | 3 |

The two low-speed controls retain every state/dense/journal/aux word. All six retain the ordered cushion body/rail sequence and pair/cushion counts. Event times and final states can change:

- Speed2/x0: cushion ticks `[743814,4066363]` → `[743814,4066199]`; REST tick `7763487` → `7763724`; cue x `-12451942` → `-12449622` Q24 units (2320 units, about0.138mm). State/dense/journal differences:12/9/3 words. This is not bit parity.
- Speed3.5/x1.3: cushion ticks `[28401,1510968,5653665]` → `[28401,1511031,5655563]`; still budget-limited, not a solved request.
- Speed4/x1.3: `[25003,1262870,4451894]` → `[25003,1262903,4452718]`; experimental REST tick8364560.
- Speed4/x0: `[367423,1619729,4855799]` → `[367423,1619720,4855592]`; experimental REST tick8692837.

`tests/experimental-early-qt-world.mjs` prints all final per-body p/v/q values and full-buffer word difference counts, checks ordered impact identities, accepted bridge receipts, unchanged controls, obstructed-tube fallback, and original work-cap rejection. Initial CPU suite: 2 passed; default/canonical CPU regression: 17 passed, 6 native skips (obsolete selected-trace rejection updated separately by trace feature owner); typecheck passed. No GPU/native qualification for this policy. Production/default MMQ2 qualification remains the distinct unchanged policy documented in `canonical-world-mmq2.md`.

## Independent nominal accuracy assessment: do not promote

This assessment integrates the **same physical equations** independently, not Rapier and not the CPU/GPU fixed-point implementation as truth. Exact Q24 input anchors/materials are converted into 60-digit `mpmath` numbers. With `u=(vx+qz,vz-qx)`, the reference uses `dv=-F u/|u|`, `dq=(-2.5 az,2.5 ax)-K q/|q|`, and the original independent normal-spin decay. Collinear qt crossings are solved piecewise analytically. Noncollinear segments use RK4 with step doubling; the largest observed doubling difference was 0.0000531 Q24 quantum. That is **empirical convergence, not a rigorous reference enclosure**.

Six anchors (two from speed 2/x0, four from speed 4/x1.3), twelve endpoints: both the original shortened smooth endpoint and the earlier bridge endpoint lie inside their existing local receipts. These endpoints have **different durations**; this does not establish equal accuracy. At the first collinear anchor, smooth q error is about 0.791 Q24 quantum after 1,023 ticks, while the longer qt bridge q error is about 2,687.302 quanta after 3,398 ticks. The bridge uses a bounded K=0 comparison reference; its permitted actual-K error can be much larger.

For a downstream contact comparison, both policies have identical body sources, source row, material, identity, and clock at tick 836,034 (diagnostic work counters are not identical). The independent reference solves qt sign crossing, slip→rolling, rolling deceleration `2K/7`, and sphere distance to every triangle of the actual packed target cushion. Geometry root finding uses 220 bisections. Explicit assertions exclude earlier non-target hulls by swept-AABB separation and stationary balls by z separation; phase endpoints remain before the target along the monotone collinear path.

| Next left-cushion contact | Tick | Error versus independent reference |
|---|---:|---:|
| Independent nominal reference | 4,066,561.931215 | — |
| Default policy | 4,066,363 | −198.931 ticks (about −0.190 ms) |
| Experimental early qt | 4,066,199 | −362.931 ticks (about −0.346 ms) |

**The experimental policy is less accurate in contact timing for this case, despite fewer accepted steps and unchanged local budgets. Keep it off; it does not satisfy an unchanged-accuracy optimization claim.** This single anchored-path comparison is not a global physical enclosure or broad model calibration.

Reproduce (optional research dependency `mpmath`, not a runtime dependency):

```sh
node scripts/export-early-qt-reference.mjs /tmp/early-qt-reference
python3 scripts/assess-early-qt-segments.py /tmp/early-qt-reference 60
python3 scripts/assess-early-qt-contact.py /tmp/early-qt-reference 60
# Repeat with 90 digits to check arithmetic precision sensitivity.
```

The exporter verifies exact common body sources and emits complete original/experimental impact states and descriptors. Reference scripts report each endpoint error and original receipt, contact timing, source/obstacle exclusions, and convergence diagnostics separately from CPU/GPU parity. None of these scripts changes production acceptance.

The 60- and 90-digit reruns produced identical printed diagnostics for all twelve endpoints and identical printed contact/reference errors. Independent review found no scoped blocker for this fixture-specific nominal assessment; it is not a rigorous universal contact proof or release gate.
