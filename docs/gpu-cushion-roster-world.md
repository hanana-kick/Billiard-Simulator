# Source-ordered convex cushion roster

Both the initial-edge-roster and opt-in fresh-pair modes pass independent scalar/native and actual WGSL/native trajectories. The complete serial cushion regression passes 13/13 tests over 1,200 owned-state frames per backend: the original 304 frames, four orientations totaling 576, the 128-frame corner and 192-frame fresh insertion. Maximum absolute error is zero for every compared numeric field; all discrete contact, feature, graph, adjacency and event assertions pass. This is bounded contact recurrence, not a complete shot or full-scene equivalence claim.

The original right/front convex cushions share one dynamic sphere velocity record with continuous cloth. The same source PGS/warmstart/relaxation/restitution loop processes all three contacts. Native contact events follow dense graph edge order; deferred coloring separately sorts canonical body-ID pairs and assigns descending free colors. Existing colors persist. Pair removal mirrors edge swap-removal and never reassigns a warm cache by row position.

Default mode starts from two real native inactive edges, no geometric or solver contacts. Its 128-frame fixture has both cushion starts at frame 5 and ends at frame 7, with two genuine simultaneous three-contact frames. The dynamic ball starts at (1.388, radius + 0.00005, 0.678), initially moving (0.45, 0, 0.45) with angular velocity (1, 2, -1). All materials, native hull topology and dual collider groups are original. Preparation is 34 native steps before the one exported initial state; no cushion impact is hidden in preparation.

## Fresh pair insertion, explicit bounded mode

`pairMode:'source-single-new-pair'` permits a genuinely separated initial state. Own GPU fat proxies and original collision groups/types determine overlap, independently of native future snapshots. A frame with at most one newly overlapping eligible absent pair has unambiguous native BVTT output order. The host source lifecycle appends that fresh pair before canonically sorted stale deletions, initializes all manifold/cache/recycle/color state, and maintains contact adjacency and dense edge indices. Geometry and physics remain GPU-owned.

A frame with two or more fresh eligible pairs halts before state commit. This is essential: native BVH refit, SAH reinsertion and deferred optimization can reorder candidate traversal even for five leaves. No constant static-collider order substitutes for the unported BVTT machinery. Pair insertion, then selected-contact begin, are separate phases. Same-parent and massless channel filtering is retained.

Sources: Rapier `geometry/broad_phase_bvh/update.rs`, `geometry/narrow_phase/{pair_management,contacts,mod}.rs`; pinned revision and source notices are the same as `gpu-cushion-world.md`. `register_pairs` applies events in their existing order; every new AddPair precedes lexicographically sorted stale DeletePairs. Contact geometry uses the separately validated Parry convex point projection and convex-ball path.

Both modes retain CCD-enabled/max 4 source-inactive checks, original compensated cloth angular resistance, explicit never-sleep fixture thresholds, a 4096-step bound and fail-closed cloth loss. General BVH ordering, active CCD/TOI, native sleep/global manager serialization, wood impacts/freeflight and complete shots are not implemented by this module. All eight original hulls are covered by static projection tests; that does not imply all eight have recurrent impact coverage.

The singleton candidate-set invariant also requires a coherent post-step initial seed and immutable shapes, parents, groups and collider roster. Source `set_aabb` records pending updates; the next update resolves changed flags and conservative ancestor unions before traversal. The post-step proxy update does not itself advance contact-pair presence.

## Verified horizons and acceptance

The native timestep is 0.0010416667209938169 s, corresponding to original application `h = 1/960`. The corner is 128 frames (application 0.13333333333333333 s; native 0.13333334028720856 s). The fresh insertion fixture is 192 frames (application 0.2 s; native 0.20000001043081284 s). Both start after 34 native preparation steps (application 0.035416666666666666 s; native 0.03541666851378977 s), before any cushion impact. The 4096-step maximum is a safety bound, not a tested full-shot horizon.

The fresh fixture starts at (1.35, radius + 0.00005, 0.6603), moving (0.8, 0, 0.4) without initial spin. Both cushion pairs are genuinely absent in its initial native snapshot. Two actual AddPair events occur on different frames, then front and right contacts both start at frame 51 and stop at frame 53. There are two simultaneous cloth-plus-two-cushion frames. A separate mutation sentinel creates two fresh eligible pairs together and verifies a persistent unsupported halt at frame zero, with no state commit.

Every native future state is used only as an assertion. The candidate receives one initial state, then owns its poses, velocity, inertia, force, geometry, warm/reporting cache, recycle state and fat proxies. Tests preserve the fixed numeric criterion `2e-6 * max(1, abs(native))`, exact feature/contact decisions, source solver colors and contact adjacency. They check the scalar/native gate before dispatching GPU work.

Run the four test files serially: `experimental-cushion-world.cjs`, `experimental-cushion-orientations.cjs`, `experimental-cushion-roster-world.cjs`, and `experimental-cushion-pair-insertion.cjs`, all under `tests/`. Select the pinned decoder with `RAPIER_SNAPSHOT_DECODER`; actual GPU requires `GPU_NATIVE_MODULE`, adapter configuration and `REQUIRE_WEBGPU=1`.

### Constructor settling versus fixture preparation

The stated 34 fixture preparation steps follow the unchanged `PhysicsLab` constructor's 72 native settling steps. Thus constructor-to-export contains 106 native world steps in total: native f32 elapsed 0.11041667242534459 s (106 times the native dt), or 0.11041666666666666 s expressed using application h. No cushion collision occurs during either portion. The comparison horizon starts at the one exported seed; none of these earlier steps is counted as candidate recurrence. Constructor settling and directly invoked preparation steps do not advance `PhysicsLab.time` automatically.
