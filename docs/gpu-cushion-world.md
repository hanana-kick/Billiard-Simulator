# One sphere, cloth and original convex cushion

The original focused scalar/native and actual WGSL tests pass 3/3 over 304 owned-state frames per backend. The separate four-orientation regression also passes 3/3 over 576 frames per backend. Every compared physical/cache/CCD value has maximum absolute error zero. This is a bounded trajectory checkpoint, not a complete shot or whole-app parity claim.

The bounded controller owns one dynamic sphere, its original massless pair collider, one fixed cloth and one original native convex cushion. It takes one initial snapshot-derived state and accepts no per-frame external state. It does not substitute a cuboid rail or independently advance the floor and cushion worlds.

## Shared solve and lifecycle

The initial cloth contact owns source color127. The later cushion contact takes126; every warmstart, PGS pass, relaxation pass and final restitution therefore runs cushion then cloth against the same dynamic velocity record. Warmstart/reporting data remains associated with each pair/manifold when the solver row ordering changes. Cloth contact loss is outside this first domain.

The cushion geometry uses original native-indexed convex topology and Parry's `point_support_map` + `convex_ball` dispatcher. Fresh sphere-local witness, direct component division, source quaternion transforms, solver anchors and frozen lever arms are retained. Recycling keeps the saved pose reference and frozen geometry until native eligibility fails. A one-point refresh preserves contact impulse data even when the feature changes; no-point-to-point birth initializes source-default data.

A GPU fat-AABB stage evolves the sphere's own proxy against the two initial fixed proxies. Pair existence, geometric-point presence and selected solver contact are separate. The last pose writeback updates proxies, not narrow phase. This is a bounded fixed roster, not the general native BVH.

## Original application parameters

Fixtures retain native original cushion vertices/topology, cloth dimensions, radius0.03075, mass0.210, dt1/960, twelve solver substeps and original dual collision groups. Environment coefficients use original Multiply materials. The actual unchanged public `PhysicsLab.angularPatchResistance` is the independent reference; the candidate uses the branded compensated GPU angular stage from its own solved cloth impulse and body state. Original JS-double application constants are not quantized to native f32 to ease comparison.

Original CCD is enabled, maxCcdSubsteps4. The source pre-force-prediction and post-pose-error tests run every frame. Active or unsupported CCD permanently halts before state commit; no TOI support is implied. Initial never-sleep thresholds remain an explicit fixture boundary, rather than the application’s default sleep-enabled descriptor. This controller does not implement sleep, cue constraints, other balls, another cushion, global manager serialization or complete shots.

## Verified trajectories

- Original right cushion, head-on: 144 frames, native dt0.0010416667209938169, native elapsed0.15000000782310963 s (application clock0.15 s). Cushion starts at frame52 and ends at55; peak reporting normal impulse0.258197546005249 N·s; 13 full geometry refreshes.
- Original right cushion, oblique with spin: 160 frames, same native dt, native elapsed0.1666666753590107 s (application clock1/6 s). Start56, end59; peak impulse0.2428194284439087 N·s; 19 refreshes.

Both trajectories begin before any cushion impact, include actual simultaneous cloth/cushion response, and continue on cloth after separation. Initial preparation is 34 real native steps,0.03541666851378977 s, with no prior cushion collision. Reporting normal impulse is distinct from the final substep warmstart cache. Native feature IDs, contact flags, events and generated normal copysign are exact assertions, not approximate numeric comparisons.

Run `node --test tests/experimental-cushion-world.cjs` with the pinned decoder selected by `RAPIER_SNAPSHOT_DECODER`; actual GPU additionally requires `GPU_NATIVE_MODULE`, adapter configuration and `REQUIRE_WEBGPU=1`.

## Source and verification contract

Pinned Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`, Parry0.31.1. Source: `geometry/narrow_phase/{mod,contacts,pair_update}.rs`, `dynamics/solver/contact_constraint`, `staged_island_solver`, and Parry `query/{point,contact_manifolds}`. Apache-2.0 notices are retained in source and `vendor/RAPIER-LICENSE.txt`; glam and libm notices are preserved under `vendor/`.

The tests compare every owned frame's position, quaternion, linear/angular velocity, world inertia, forces, geometry, warmstart/reporting caches, feature IDs, broad-phase events, collision events and CCD velocity. Numeric tolerance remains fixed at2e-6×max(1,|native|), with exact discrete decisions. Original native future snapshots are assertions only.

The native snapshot decoder is currently a CLI test/export tool. Browser initial-state transport still requires a supported read-only decoder; it must never secretly step PhysicsLab on the CPU to feed this recurrence.

The pure floor component uses `validateConfiguration` for structural admission with unchanged CCD metadata. Execution admission comes from the separate source CCD pre/post stages, not from that structural validator. General modified-body queues, active-set epochs and serialized island-manager equivalence are not claimed by these numerical/contact tests.

## Four original cushion orientations

Right, left, front and back original cushion hulls each have a 144-frame oblique/spinning trajectory (application 0.15 s; native 0.15000000782310963 s). Each has contact start at frame 52, end at frame 55 and 14 full geometry refreshes. Right/left peak normal impulse is 0.26475560665130615 N·s; front/back is 0.2553468644618988 N·s. Scalar/native and actual WGSL/native errors are zero. All eight original hulls have independent static point-projection coverage, but the four wood hulls do not have recurrent impact coverage.

Fresh recycle `max_extent` follows `pair_update.rs` exactly: compute each shape's local AABB, take `max(length(mins), length(maxs))`, then the maximum across the two shapes. This is not the norm of a componentwise absolute-extrema corner. Each endpoint norm is evaluated in the GPU arithmetic graph. Existing valid recycle extent is retained unchanged. The reflected left-cushion fixture detects this distinction; no native material, geometry or tolerance was changed to resolve it.

The source-ordered two-cushion and fresh-pair extension is documented separately in `gpu-cushion-roster-world.md`.

### Constructor settling versus fixture preparation

The stated 34 fixture preparation steps follow the unchanged `PhysicsLab` constructor's 72 native settling steps. Thus constructor-to-export contains 106 native world steps in total: native f32 elapsed 0.11041667242534459 s (106 times the native dt), or 0.11041666666666666 s expressed using application h. No cushion collision occurs during either portion. The comparison horizon starts at the one exported seed; none of these earlier steps is counted as candidate recurrence. Constructor settling and directly invoked preparation steps do not advance `PhysicsLab.time` automatically.
