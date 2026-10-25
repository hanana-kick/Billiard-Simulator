# Bounded cue broad-phase event projection

The experimental module owns the initial source BVH insertion and subsequent fat-leaf/pair lifecycle for the original three-ball default strike: angle0°, elevation8°, speed2, centered tip, constructor72 native settling steps, no extra application settling or layout changes. It does not modify production CPU physics.

This is a **prepared-pose component**, not a complete world solver. Its arithmetic executes through the same stored-f32 graph in the CPU diagnostic and actual WGSL paths. Integer tree topology, source traversal and transaction orchestration are host code. It must be integrated with the existing own-state numerical stages before that integration can be claimed.

## Why a separate broad stage is necessary

Rigid narrow separation does not prove absence of broad-phase edges. The default cue shaft AABB overlaps the left cushion and wood rail even while the actual cylinder is separated. The original first step creates two inactive ContactPair edges. They affect dense graph ordering and must not be omitted merely because they have no solver contacts.

The module derives the complete first AddPair order from the original tree, source collider creation order and current input poses. It does not encode the observed endpoint IDs as output constants. The separate rigid-cue exclusion stage remains mandatory to reject newly possible solver contacts.

## Source mapping

- Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`, `geometry/broad_phase_bvh/update.rs`: existing updates before deferred insertions, optimization/refit branch, filtering, canonical stale-pair deletion.
- Rapier `geometry/broad_phase_bvh/mod.rs`: source fat-leaf containment and change-detection margin.
- Rapier `geometry/collider.rs`: prediction/2 broad bounds, zero contact skins and zero soft CCD in this admitted fixture.
- Rapier `pipeline/physics_pipeline/substep.rs`: active-body order, each body's collider order, and deferred-optimizer join before end-step AABB writes.
- Parry0.31.1 `partitioning/bvh/{bvh_insert,bvh_refit,bvh_traverse_bvtt,bvh_tree}.rs`: all four descent rotations, volume-weighted SAH/ties, source free stack, full left-first refit and changed-leaf traversal.
- Parry cylinder support and support-map AABBs: exact analytic cylinder support along six transformed world axes. No polygon, capsule or rotated-box replacement is used.
- Scalar glam quaternion/vector operations preserve the enhanced-determinism operation associations. Source licenses are retained in both modules.

The admitted initial branch has22 existing leaves, three ordered new cue colliders, no pending updates, zero optimization debt and a full refit without optimizer execution. The immutable export includes all25 collider records, generation-bearing handles, per-body collider order, source tree and flags. Unsupported initial branches are rejected.

`sourcePipelineCompleted` is an explicit provenance requirement for the original constructor-complete, strike-created phase. It is justified by the synchronous source creation path and completed end-step optimizer join. It is not reconstruction of a serde-skipped workspace from an arbitrary restored snapshot.

## Deliberately narrower than full evolving BVH parity

After the first insertion, the module retains source fat leaf bounds, not the evolving optimized internal tree. At every next pre-step it exhaustively evaluates all filter-compatible current leaf overlaps. An unowned new pair is explicitly unsupported. Existing stale cue pairs produce source-canonical DeletePair events; actual collider withdrawal is a distinct ordered operation and does not invent broad DeletePair events.

This restriction makes the admitted event stream independent of later optimizer traversal order. It does **not** certify serialized BVH nodes, optimization flags, pair timestamps, persistent manifolds, active CCD, or general new-pair ordering. It may reject otherwise valid shots. Once the cue is withdrawn, the stage retires and the shared three-sphere journal must continue from its retained proxies, not reseed them.

## Transaction contract

Both factories are asynchronous: `createReferenceStage(seed)` and `createGpuStage(device,seed)`. `initialRegistry()` returns a clone of immutable source geometry and identity. Each leased transaction calls `prepare(own,token)`, then `postSolve(own,token)`, `assertPrepared(token)` and finally commit or abort.

Own inputs contain current cue and three-ball poses, the source-owned active body order, and actual removal order. No expected native body or contact cache is accepted as runtime state. Pre/post receipts are opaque and bound to the exact stage origin and current transaction. Wrong-origin, aborted, stale and committed receipts are rejected, including abort/retry at the same numerical frame. The shared journal alone allocates and removes dense edges. It validates both receipts and commits before this stage invalidates them.

## Current validation

`tests/experimental-cue-broad-phase.cjs` passed4/4 with no skips in the actual WGSL run. The original saved creation and450h replay artifacts are independently hash checked;13 saved native snapshots pass strict native-bincode and independent typed-tree byte roundtrips. No additional native stepping is performed by this gate.

For CPU and actual Dawn/Vulkan WGSL,440 prepared steps through original cue withdrawal, elapsed0.007161458333333313 seconds, matched the sampled native complete pair set, fat proxy bounds and pending-update order with maximum numerical error0. First insertion/refit topology and ordered AddPair events matched the independent native dense graph. The fixed AABB tolerance remains2e-6; observed zero is not a universal bit-identical guarantee.

The test replays independently captured poses as component inputs while the candidate retains its own proxy/pair recurrence. It is **not** an own-world trajectory test, GPU strike-completion claim, performance benchmark, or all-device guarantee. Shared25-collider journal integration and its complete own-state trajectory are separate gates.

The separate scalar admission suite `tests/experimental-cue-broad-phase-guards.cjs` passed3/3. It verifies transactional rejection of a newly possible filter-compatible pair, canonical stale-pair deletion before any collider withdrawal, and unchanged BVTT traversal under sparse cue leaf-ID renumbering. These are synthetic/source-metamorphic checks, not additional independently captured native shots. They do not extend the admitted runtime geometry or loosen the fixed criteria.
