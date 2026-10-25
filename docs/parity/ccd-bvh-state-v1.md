# Owned recurrent CCD BVH component

Status: native/CPU/actual-WGSL component recurrence passes every original-app h1–396 tree, scheduler field and query stream. The actual h396 front-before-right order is reproduced from the initial tree plus owned recurrent topology, with no future tree input. The validation uses prepared source operations, so this is not an owned-world or whole-shot parity claim.

## Exact boundary and ownership

The component starts only from the completed original constructor72 creation snapshot: 22 existing collider leaves, three original fresh cue colliders, zero broad-phase debt, empty pending/previous queues. It owns the subsequent 22 → 25 → 22 tree, source flags, free slots, parent/map arrays, optimization counters, scheduler counters and pending queues. It accepts current owned AABBs and ordered operations, not subsequent trees. Inputs with a `futureTree` field are rejected.

`createReferenceStage(seed)` and `createGpuStage(device, seed)` expose:

- `begin()` begins a private draft of committed state.
- `prepareUpdate({ updates: [{ leaf, box: { min, max }, skin }], removedLeaves, forcedReinsertLeaves, liveLeaves })` reproduces the broad-phase update phase. `liveLeaves` is optional when the still-owned tree roster is identical to the enabled collider roster.
- `joinDeferredOptimize()` joins the source deferred optimizer before CCD queries.
- `setAabbs(orderedRows)` reproduces source end-of-step writes, joining pending optimization first.
- `query(sweptAabb)` issues an opaque receipt. `assertQueryReceipt(receipt, stage, backend, expectedBox)` validates origin, backend, exact bounds, current transaction and mutation epoch and returns an independent copy of ordered leaves. Caller admission must require this receipt, not an arbitrary list. Any later successful mutation, commit or abort invalidates it.
- `queryLeaves(sweptAabb)` is the direct diagnostic view, not an admission credential.
- `snapshot()` returns committed state; `preview()` returns the draft. `commit()` adopts the draft; `abort()` discards it. Failed operations leave both draft and committed state unchanged.

The integrator must derive operations from its own current poses, active-body/collider order, update queues and source withdrawal order. Replaying observed native operations validates this component only. Future native operations may not drive a claimed whole-world implementation.

## Required source functions

Pinned Rapier revision: `b716d375efc0201003f0cd9ef7168eee0b62c177`. Parry: 0.31.1.

- Rapier `geometry/broad_phase_bvh/update.rs::update`: consume pending optimization, removals, forced-reinsertion prepass, existing-before-fresh update passes, update-volume hysteresis, debt scheduling, full/partial refit and changed-leaf queues.
- Rapier `geometry/broad_phase_bvh/mod.rs::set_aabb` and `run_bvh_optimize`: in-place versus SAH reinsertion, pending queue and debt, optimize followed by flag-preserving refit.
- Parry `bvh_insert.rs`: change containment, fattening, ancestor enlargement, downward rotation, SAH reinsertion and free-slot reuse. The first fresh insertion directly reuses the existing `experimental-cue-bvh-insertion.js::firstInsert` implementation.
- Parry `bvh_tree.rs::remove`: sibling promotion, packed parent/map relocation, zeroed free nodes and raw merged ancestor flags.
- Parry `bvh_refit.rs`: full left-first preorder compaction, pending/resolved flag transitions, and partial complete ancestor walks.
- Parry `bvh_optimize.rs`: subtree-root selection, alternating root modes, breadth-first and priority-queue pseudo-leaves, and persistent start/frame counters.
- Parry `bvh_binned_build.rs`: eight-bin, maximum-centroid-extent axis, original in-place partition order and recursive rebuild.
- Parry `bvh_traverse.rs::Leaves`: original left-first DFS leaf order with exact AABB pruning.
- Rapier `dynamics/ccd/sweeps.rs::intersect_swept_aabb`: queries stored tree AABBs, not recomputed collider AABBs. The source pipeline joins deferred optimization before find-first-impact and motion clamping.

No optimizer is omitted. For 22–25 leaves the source `optimization_config` evaluates to root count 5; subtree target 19 for 22 leaves, otherwise 20; subtree target count 0 on odd optimizer calls and 1 on even calls. These bounded integer results are explicitly admitted; the BFS, priority heap, binned rebuild and all refits still execute. Root mode is skip on even calls, breadth-first when floor(call/2) is a multiple of16, and priority queue otherwise. Heap scores alone compare, including Rust BinaryHeap's right-child choice on ties and observable heap-array drain order.

## Numeric execution

The same f32 arithmetic graphs run on CPU reference or actual WGSL for volume-weighted costs, differences, fattening, midpoints, bin scale and bin coordinate arithmetic. CPU owns integer topology, comparisons and min/max selection of already-rounded values, as in the first-insertion component. The GPU path has no CPU arithmetic fallback.

Source invalid empty bins produce NaN cost and never win a strict cost comparison. The implementation excludes only those empty-side cost rows. A zero centroid range follows the source saturated float-to-integer bin result0 and balanced degenerate split without evaluating non-finite GPU arithmetic. This is explicit source-equivalent control, not a substitute numeric result.

## Current tests

`node --test tests/experimental-ccd-bvh-state.cjs`

Synthetic CPU suite passes first-insertion reuse against the existing port; all optimizer modes over41 optimizer runs/422 binned ranges; full and partial refits; cue retirement; sparse and forced reinsertion; degenerate centers; transaction rollback and query-receipt forgery/staleness guards. Synthetic history hash: `45b60bc60095ae6a3560daca629a3525c6aa3541278150a6e602fd82b1bed338`.

Actual WGSL synthetic suite passed7/7 using Vulkan ICD `/usr/lib/chromium/vk_swiftshader_icd.json` and the installed `webgpu`0.6.2 module. The43 complete tree+scheduler snapshots match CPU byte-for-byte, with the same history hash above. This is SwiftShader software compute, not hardware performance evidence.

`tests/experimental-ccd-bvh-state-native.cjs` independently replays normalized source operations from `CCD_BVH_OPERATION_TRACE`, compares every owned source field and query stream, and never supplies later expected trees to the stage. `REQUIRE_CCD_CORNER_RECURRENCE=1` requires contiguous genuine app h1–396, original/native broad equality, all observer-neutrality checks, and the actual front-before-right query from the owned tree. `REQUIRE_WEBGPU=1` additionally requires actual WGSL full-state agreement with the native/CPU prerequisite.

The native created-engine-step pilot passed20 operations, six queries, exact tree and all scheduler fields. Its source operation payload hash is `840e6c3a77465a3eaad40327eae2ebd2706d146a331a515deaeac9a73ee18954`; owned state hash is `8f15b1a823c864d86c957a8c26df9de09be7ff775e31a42cb1154d4d3ca2b4bf`. That pilot is explicitly not actual app h1. The complete corner-operation gate below now supersedes that pilot.

## Complete corner-operation result

The frozen independent trace is `cb60e12acb901ad3c396edb67d2952c1e46c7f2c29b6d1eeeeb7b1a0c7450aa8`. Its genuine created full-snapshot SHA is `5daa1cc43aaea8b4145176d546c6b8681eef7e04a2fa28153a77f9843ba950e6`; h1-pre has a separate identity because the application changes the native timestep before the first step. The source observer verified that the initial broad state itself equals the genuine created broad state exactly.

CPU and actual WGSL both pass:

- 396 contiguous original application steps, all396 complete owned tree/scheduler snapshots exact against native source assertions.
- All816 pruned leaf-query streams exact, including both original moving collider orders before split and after solve.
- 5,463 source operations:396 updates,1,392 joins,2,859 set-aabb writes,816 queries.
- 206 real optimizer calls,2,093 binned rebuild ranges,26 descent rotations,435 full refits and167 partial refits. No optimizer bypass.
- Actual h396 leaves `[0,8,4,17,16]` for both moving collider16 and17, in both query phases. Filtering then yields original cloth0 → front8 → right4. The module never hardcodes these IDs or this order.
- CPU and WGSL state-history SHA: `306e0d56569edfd8988aba34f83fe24fae4d1574cde5d5e401d356c327237fd0`.

Combined final gate passed9/9, no skips, in5.89 seconds; the native-operation actual-WGSL test took3.43 seconds on SwiftShader. These durations are diagnostic, not hardware performance claims.

Run:

```sh
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 \
CCD_BVH_OPERATION_TRACE=/tmp/multi-toi-bvh-application-trace-v1.json \
REQUIRE_CCD_CORNER_RECURRENCE=1 \
node --test --test-concurrency=1 \
  tests/experimental-ccd-bvh-state.cjs \
  tests/experimental-ccd-bvh-state-native.cjs
```

The independent observer restores each actual original WASM pre-step snapshot into native source to record non-mutating operations. Every observer-on/off native snapshot is identical; every resulting native broad state matches original WASM bytes; broad-state boundary hashes are continuous across all396 steps. This is rigorous component evidence, but not uninterrupted native physics recurrence. Only the first broad state initializes this implementation. Subsequent native trees and expected query leaves are assertion data only.

Remaining integration boundary: the production owner must derive these operations itself from current owned poses/active-body order/removals and connect source-ordered casts through the branded query receipts. The prepared operation trace may never replace that world-owned operation sequence.

## Out of scope

General collider insertion after creation, non-original collider IDs, removal of fixed/ball colliders, adaptive margins, other optimization strategies, fewer than22 or more than25 live leaves, arbitrary prior snapshots, broad-pair maps/filtering, physics stepping and TOI calculations. This module does not declare the user’s whole-world CPU/GPU goal complete.
