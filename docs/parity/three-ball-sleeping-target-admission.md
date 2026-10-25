# Bounded initial-N3 sleeping-target admission

Status: source-derived implementation and focused tests only. A full initial-only CPU/WGSL replay on the new runtime is still required. This is not a full-shot parity result.

## Original evidence

Unchanged input: constructor three-ball layout, angle 61.25°, elevation 20°, speed 1.8, tip X 0.11, tip Y −0.16.

- Original full-rest capture: `yaw61-25-elevated-holdout-full-rest.v8`, SHA-256 `277051231ec674ceb9bc9baf248d97acb103a1787cb515ad94b2a671fdc6964f`.
- Read-only decoded transition evidence: `yaw61-25-elevated-holdout-sleeping-pair-native-transition.json`, SHA-256 `10d0bd9f65ee2b3103acfedb75a97ab7202ffe2151d7b388c16fd88d8f063e0f`.
- Pinned Rapier source: `b716d375efc0201003f0cd9ef7168eee0b62c177`; decoder SHA-256 `0bbebced302953113abd7c428d7b66a7a8a9b7d293fe4108c8d67dc06a824d82`.
- On the preceding runtime `4d343cc`, both CPU and actual WGSL reached h2078 / outer1574 and rejected h2079 / outer1575 on the combined awake-cloth guard. The rejected state was not airborne.

The original source has two distinct boundaries:

1. h2079 / outer1575: pair colliders 17↔19 (bodies16↔17) enter the fat-AABB graph. Its single manifold has zero points and zero solver contacts; dense edge3 hint32768, color255, solver IDs `[4294967295,4294967295]`. Yellow remains asleep.
2. h2103 / outer1599: the pair becomes active and yellow wakes. The awake island changes `[16] → [16,17]`. At h2102 / h2103 / h2104, yellow-floor edge2 hints are `[32768,32768,32769]`, while persistent solver-contact array lengths remain `[1,1,1]`. Its graph position is NONE / NONE / 532676609. Dynamic pair edge3 has hint32769, color0, solver IDs `[0,1]`, graph position0 on wake h.

The yellow-floor numerical constraint must therefore stay excluded on wake h and return on the following narrow phase. The persistent manifold is neither deleted nor reset. The native yellow vertical velocity is −0.011397507041692734 on wake h and zero on the following h.

## Pinned source ordering

- `geometry/narrow_phase/contacts.rs:46`: take the entry awake mask before updating pairs.
- `geometry/narrow_phase/pair_update.rs:102–111`: skip unchanged fixed/sleeping pairs.
- `geometry/narrow_phase/solver_graph.rs:24–43`: sleep clears the hint count, without clearing the manifold.
- `geometry/narrow_phase/contacts.rs:184,366–391`: after pair geometry, apply active transitions, strong-wake the sleeping side, then link and merge islands.
- `geometry/narrow_phase/pair_update.rs:147–165`: on the next awake narrow phase, requalify a count-cleared recycled hint.
- `pipeline/physics_pipeline/solve.rs`: energy and effective forces run after narrow wake.

## Implementation boundary

`createReferenceInitialThreeBallStage` and `createGpuInitialThreeBallStage` admit only original awake elapsed-zero N3 bindings, with the original snapshot identity, three floor edges and absent pair caches. Their distinct `prepareInitialThreeBallGeometry` path requires a same-origin live journal. Generic prepared fixtures and all N4 factories reject that method; existing N4 geometry remains separate.

Inactive geometry owns only the pair cache/graph transaction. The awake singleton floor integrates once, and the sleeping target's cache and body state are untouched. A real active transition promotes both bodies only after source scene activation and newly-awake enabled-CCD admission. The existing private, current-transaction source-wake receipt selects the one-floor arithmetic plan. No public floor-disable option, pose injection, force substitution, timing override or native future seed is added.

Multiple retained dynamic pairs, pair-plus-cushion coupling, cloth loss, sleeping preexisting active pairs, active rigid cue contacts and unsupported CCD remain fail-closed. The whole transaction is rolled back before journal invalidation on failure.

## Focused tests

With the original snapshot fixtures and `RAPIER_SNAPSHOT_DECODER` set, these five files pass 23 tests with zero skips:

- `tests/experimental-three-ball-wake-admission.cjs`
- `tests/experimental-three-ball-world-pair-transaction.cjs`
- `tests/experimental-three-ball-initial-pair-seeds.cjs`
- `tests/experimental-pair-geometry-validation.cjs`
- `tests/experimental-four-ball-world-rollback.cjs`

The controller-spy tests are explicitly control-flow tests, not numerical parity evidence. They cover inactive singleton integration, untouched sleep state, active-wake ownership, new CCD admission, unsupported guards, and exact rollback/retry. Actual first-h N3 and N4 source-stage rollback tests also pass. The native capture and decoded transition observations are assertion-only evidence; none seeds a later candidate state.
