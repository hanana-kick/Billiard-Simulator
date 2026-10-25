# Live three-ball initial collision preparation

This is the next bounded prerequisite after cue initialization. It is **not a
completed first physics substep**, full-shot result, or usable evaluation service.
The receipt completes initialization **connectivity bookkeeping**, not a serialized
post-collision native snapshot. Newly appended inactive cue-pair workspace/cache
state is not materialized by this increment; numerical separation proof is not
a substitute for those persistent caches. The public preparation owner
deliberately has no physics-step commit. Calling
`commit()` throws `three-ball-live-first-substep-unavailable`.

## Implemented

- `live-three-ball-broad.mjs` consumes the byte-verified three-ball import and
  shares the existing live broad/contact projection with explicit `three` or
  `four` family selection. Original source boundaries, selected registry index,
  ordered targets, handle generations, native BVH and contact caches survive.
- Broad-phase and contact-journal arithmetic are shared. Separate three-ball
  factories retain branded three-ball provenance; four-ball factories and
  receipts reject the three-ball source, and vice versa.
- Initial BVTT inserts the actual three fresh cue colliders into the original
  22-leaf source tree. No constructor reset or four-ball proxy is introduced.
- An initial narrow-phase receipt must be current, pending, origin-bound, and
  matching-backend. Copied, aborted, wrong-family or wrong-backend receipts fail.
- `finishLiveThreeBallCollisionPhase()` consumes only its exact privately branded
  initialization result and matching receipt. The result is explicitly
  `live-three-ball-collision-and-connectivity-complete-pre-energy`.
- `live-three-ball-collision.mjs` owns numerical initialization, broad/graph
  preparation, awake sphere-floor geometry, sleeping-cache retention, and real
  cue rigid-contact exclusion. It exposes only abortable collision preparation.
  Cancellation after submission leaves the original committed snapshot intact.

Admission is deliberately narrower than read-only import: **three retained
cloth contacts only**, no retained cushion/dynamic pair, no active rigid cue
contact, and the existing exact geometry/descriptor guards. Unsupported sources
fail without deleting their caches or substituting an easier seed.

## What the native oracle proves

For each existing genuine default and after-turn capture, the test independently
creates a continuously existing original controller. After-turn preparation runs
its original first shot through natural rest (5,875 outer steps), finishes the
turn, and preserves selected cue 2 at registry index 1 with targets `[1, 3]`.
Both pre-strike and strike-created native snapshots must match the stored capture
**byte for byte** before observing the first original native substep.

The observer stops immediately after that first unchanged native step, following
the original application cue forces. This assertion-only reference never enters
candidate construction. A bare restored `World.step()` is not equivalent to
this original application boundary and is not used as the accepted oracle.

Checks include:

- Exact native first-insertion integer BVH topology (parents, leaf indices,
  free nodes, optimizer bookkeeping, child order).
- Exact original dense contact-graph endpoint order.
- Exact native collision/connectivity manager at the pre-energy boundary: the
  separately owned energy scan's `sleep_scan_stamp` is restored to its known
  initial value for this comparison. All other manager fields are compared.
- Exact CPU-reference/actual-WGSL prepared floor geometry, collision manager,
  first-insertion tree, proxy bounds and pair order.
- True numerical cue separation, cancellation-after-submission rollback,
  abort/retry identity, and fail-closed commit/receipt/family guards.

**Not a full native BVH equality claim:** the component exposes its pre-solve
first-insertion tree; the native post-step snapshot already includes moved
bounds and updated flags. Those are different boundaries. Existing component
capability `fullBvhStateParity: false` is retained. CPU/WGSL equality of the
component's prepared tree does not imply native post-step tree equality.

## Verification commands

```sh
node --max-old-space-size=128 --test tests/live-three-ball-broad.mjs

REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --max-old-space-size=128 --test tests/live-three-ball-broad.mjs
```

Recorded 2026-10-25: both commands passed 3 tests, including existing live
four-ball placed/settled/awake factory separation. The GPU run completed in
9.71 seconds using real WGSL on **software Vulkan SwiftShader**, not hardware GPU.
`npm run build` passed. No original CPU physics or acceptance tolerances changed;
no full app browser/UI run, denied Chromium retry, publication, or deployment.

Logs: `../three-ball-live-reverification/three-collision-{cpu,gpu}.log`.

## Remaining first-substep integration

The current component intentionally cannot commit its pending broad/journal
transaction without a real numerical solve and post-solve bounds. Next: admit
the three-ball family to the actual cue application stage, consume the admitted
collision state in scene activation/energy, solve cue and floor components,
materialize new inactive cue-pair caches (and owned cue-cloth geometry when
needed), perform CCD and angular post-processing, and then commit all participants
atomically. Verify that complete first substep against both independent original
sources before adding any live evaluation routing or full-rest testing.

### Regression maintenance

The broader initialization/origin/four-ball broad-graph regression run exposed a
stale expected error string in `experimental-four-ball-broad-graph-birth.cjs`.
The same failure was reproduced from archived baseline `5f6e674`; its log remains
`../three-ball-live-reverification/baseline-four-broad.log`. Only the expected
regex was updated to the already-existing exact error text. The rejection and
committed-state rollback equality assertions are unchanged; no production
behavior or numerical acceptance was changed for this correction.

Final focused regression total: **39 passed, 2 explicit GPU opt-in skips, zero
failures**. The new collision suite separately passed 3 CPU and 3 actual-WGSL
tests. Existing placed/settled/awake four-ball live imports also passed 3/3.

The next separately committed integration is the [genuine live three-ball
first-substep owner](live-three-ball-first-step.md). The collision-only API above
still does not commit a physics step.
