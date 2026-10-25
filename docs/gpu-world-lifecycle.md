# Two-collider recurrent contact lifecycle

This bounded adapter connects the sphere/floor geometry and contact solver with
the genuine free-body solver. It is not a general BVH, complete application world,
or complete-shot parity claim. The source/native and actual WGSL lifecycle
differentials pass with maximum absolute numeric error zero on the cases below.

## Own-state phase order

1. Update the moving sphere's broad-phase AABB with the source prediction margin.
   Keep its native initial fat AABB while it contains the current AABB; otherwise
   replace it using the source change-detection skin, `0.04 * lengthUnit`.
2. Intersect the two source fat AABBs. With exactly two colliders, this determines
   the one sorted floor/sphere AddPair or DeletePair transition without needing a
   general BVH walk. The fixed floor's initial leaf bounds remain unchanged.
3. Run narrow-phase recycle eligibility from the entry pose. Pair presence,
   geometric-point presence and active-solver-contact presence are separate flags.
   A full refresh uses the source convex/ball query and separate geometric and
   solver-prediction gates. New points start from `ContactData::default`; geometry
   replacement of an existing one-point manifold retains its impulse data.
4. An active contact uses the actual PGS graph. No active contact uses the genuine
   free-body graph, with no fake zero-strength contact. End-touch therefore does
   not stop time. A later new point receives fresh cache state and can recontact.
5. Commit resulting body state, then update the moving fat AABB at the post-solve
   pose, matching the source final broad-phase-only update. Do not run a second
   narrow phase at that post-solve pose.

All arithmetic is either the shared scalar f32 reference graph or actual WGSL
readback. Host logic selects source phases using their own results, not native
per-frame observations. The recurrent `step()` rejects external state arguments.
Native trajectory snapshots are assertions only after the initial input.

## Sources and boundaries

Rapier commit `b716d375efc0201003f0cd9ef7168eee0b62c177`:
`geometry/broad_phase_bvh/{mod,update}.rs`, `geometry/collider.rs`,
`geometry/narrow_phase/pair_update.rs`, and
`pipeline/physics_pipeline/substep.rs`. Parry 0.31.1:
`partitioning/bvh/bvh_insert.rs` and
`query/contact_manifolds/contact_manifolds_convex_ball.rs`.
The component implementations retain the upstream Apache-2.0 notices.

Exactly two unmodified colliders, one awake dynamic sphere and one fixed,
identity-rotated floor, floor-then-sphere handle order, identity parent-local
collider transforms, zero COM/skins/soft-CCD prediction, no hooks/joints/sleep/CCD,
and no adaptive change-detection margin are admitted. The sphere remains over
the floor's interior top face. This does not implement general BVH nodes,
multiple-pair event order, multiple-body island splits/merges, application rolling,
duplicate body-pair channels or cue contacts. Up to 4096 outer steps are admitted.

The source-pinned native CLI decoder is test initialization/oracle infrastructure,
not yet browser transport. Browser application integration requires a separately
validated read-only decoder, never hidden native per-step physics inputs.

## Tests

Use the environment described in [the snapshot decoder guide](rapier-snapshot-decoder.md)
and [the contact stepper guide](gpu-world-stepper.md), then run:

```sh
node --test --test-concurrency=1 tests/experimental-world-stepper.cjs tests/experimental-world-lifecycle.cjs
```

The first cases are two 128-frame separated sphere/floor trajectories at dt
1/120, with four solver substeps and four internal PGS iterations. One starts
without a broad-phase pair; one starts with only an inactive pair. The first native
fixture must exhibit contact birth, positive physical impact, end-touch and
recontact. The second exhibits birth and settles; it does not naturally end
contact in this horizon. Production physics/settings are not changed to force
a different outcome.
The assertions retain the fixed `2e-6 * max(1, abs(native))` numeric tolerance,
exact topology/event transitions, native cache fields and fat-AABB bounds.

## Newly executed evidence

The complete owned suite passes 8/8 with no skips on actual Dawn 0.6.2 Vulkan
SwiftShader. Each backend ran the prior 144 continuous-contact frames and 256
lifecycle frames, totaling 400 outer steps per backend. Every asserted numeric
field had maximum absolute error **0**, and all event/topology comparisons were
exact. Numeric equality here does not imply a byte-identical whole-world snapshot.

Each lifecycle fixture spans 128 steps at native f32 dt
`0.008333333767950535`, approximately 1.0666667223 seconds after the initial
snapshot. Four solver substeps and four internal PGS sweeps are used.

- Initially no pair, radius 0.5 m, mass 1 kg, initial gap 0.2 m: 91 genuine
  free-body frames and 37 contact-solver frames. Zero-based event frames are
  start 22, stop 27, start 60, stop 65, start 88, stop 96, start 109.
- Initially inactive pair, the same radius/mass, initial gap 0.025 m: 2 free-body
  frames and 126 contact-solver frames, with contact start at frame 2 and no stop.
  An initial test incorrectly required a stop here; the unchanged native world
  instead settles. The fixture is retained and its actual narrower coverage is
  stated, rather than changing native physics or weakening numeric gates.

Both native trajectories contain positive reporting normal impulse in the tested
horizon. The initial snapshot is taken after one or two native free-flight setup
steps; neither fixture warms a collision before its tested horizon. Later native
snapshots never become recurrence inputs.

The existing stepper now preserves non-impulse signed-zero state and updates the
auxiliary warmstart-tangent cache in its owned snapshot. These changes passed the
same 144-frame scalar/native and actual GPU regressions. Geometry-only stages do
not integrate or manufacture a solver contact. Pair and active-contact decisions
are made before selecting the actual contact or free-body integration stage.

These lifecycle cases are generic-scale raw Rapier, not application-scale or
application rolling/cue parity. The separate continuous fixture verifies actual
cloth-scale values, but does not extend that claim to this lifecycle suite.

## Opt-in post-world angular phase

The separate `createReferenceStepperWithPostStep(initial, stage)` and
`createGpuStepperWithPostStep(device, initial, stage)` integration factories
accept only a matching-backend branded angular stage created by
`experimental-angular-patch.js`. They do not accept arbitrary callbacks. The
stage receives a clone of the candidate's own just-solved state after the
post-solve fat-AABB update. Only three finite f32 angular-velocity components
may be written back before the private state commit; pose, linear velocity,
geometry and cache replacement are prohibited. Stage metadata is returned as
`postStep`. The caller owns stage disposal. Default factories are unchanged.

The application law visits an existing geometric point's stored reporting
impulse even when that point is not currently solver-active. This hook does not
serialize the native modified-body queue or island epoch, and its existence
alone does not establish application-level trajectory parity. The composed
cloth-world adapter has its own tests and stated precision boundaries.

## Original-awake cue continuation boundary

The opt-in `createReferenceStepperWithStages(initial, {preStage, postStage})` and `createGpuStepperWithStages(device, initial, {preStage, postStage})` compose matching module-branded cue and angular-patch stages. This path retains original `canSleep:true` and enabled CCD settings; it does not change descriptors to meet the older standalone domain.

A private lease gives one lifecycle exclusive use of the cue transaction. The controller applies only the cue stage's own finite-f32 linear/angular output, checks original CCD prediction, updates its own contact geometry, observes source activation from the actual pre-solve pose/history, executes the numerical solver, checks post-pose CCD, then applies the angular patch. It commits cue, selected-body and activation/queue state only after every required phase succeeds. An unsupported step rolls back the staged state. Arbitrary callbacks, forged brands and wrong-backend stages are rejected.

The selected ball must be a persistent singleton, distinct from the cue shaft/head persistent component even when all are in one awake container. Native activation thresholds and max extent come from the initial snapshot. Ordered pending modifications, selected/cue IDs and serialized active-set epoch/sleep-scan stamp are maintained by the bounded [awake admission component](gpu-awake-activation.md). This is exact host-side integer bookkeeping plus actual CPU/WGSL activation arithmetic, not a claim that every island-manager operation executes on the GPU.

Sleep transitions, sleeping-island propagation, active CCD, arbitrary changes or general merge/split remain unsupported. First source cue withdrawal is handled in the original head/shaft/fixed-guide order; general removals are not. Serde-skipped joint-cache epochs and complete manager free-list serialization are not claimed. Prepared numerical solver exports alone cannot establish whole-world admission. The older default factories and their explicit never-sleep/CCD-off contract remain unchanged.

The new path passes seven focused admission/native/WGSL tests and five original-stroke/oracle/rollback tests. Scalar and actual WGSL each own 445 microsteps after one initial native microstep, through actual approach, 76 touching microsteps and first cue separation/removal at approximately 7.2591145833 ms. Original sleep and CCD descriptors are retained. Compared serialized queues, flags, IDs, activation counters, persistent membership and event times match exactly; the largest numerical residual is `1.7347234745631684e-19`, with raw signed-zero/subnormal differences disclosed rather than erased. See the awake component guide for criteria and the corrected native matrix-view oracle. This does not cover the later rolling-to-rest/sleep trajectory or establish whole-engine equivalence.

That executed cue fixture is an explicitly modified single-ball layout, not the original three-ball scene: it removes the other two balls, moves the selected ball to x=0.4, and runs 72 additional application settling steps. The static table and unchanged CPU methods are retained. Initial native h1 is not a demonstrated GPU creation/first-step implementation. Advancing the original three-ball scene requires all three floor/contact/activation states under the common application timestep; other balls cannot be treated as frozen.
