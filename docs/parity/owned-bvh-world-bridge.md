# Original-created recurrent BVH world bridge

The experimental three-ball CCD owner now creates a private BVH stage from the
original constructor72 `cueBroadSeed.initialBroadPhase`. It does not initialize
from a later tree, query ordering, operation stream, or native frame.

`experimental-ccd-bvh-world-bridge.js` translates the owner's current poses into
raw source AABBs using the existing CPU/WGSL bounds arithmetic graph. The margin
is prediction distance / 2; source change-detection skin is f32(.04 * lengthUnit).
It does not submit already-fat proxies as the shape bounds.

- The first collision update consumes the original fresh collider queue.
- The bounded application's subsequent velocity/force changes do not create
  geometry-change collider entries. Cue withdrawal derives the removal order
  from the owned removed-body list and original body collider order.
- Every active collider is submitted to set_aabb, even if its raw AABB remains
  inside the current fat leaf. Ordering comes from the current observed active
  body order and each original body's collider order.
- Each internal CCD slice joins deferred optimization before the source query
  use and again before moved-collider updates. Internal collision detection
  consumes the BVH's own pending queue.
- The private transaction spans one complete application h, including all
  internal CCD slices. Failure aborts the tree, optimizer state, pending queues,
  contact stages, scene state, and CCD authority. The application angular patch
  remains once per application h, not once per CCD slice.

The fixed-sphere stage receives this same private BVH stage as its query
context, allowing branded receipt-bound sequential casts with shrinking bounds.
There is no hardcoded cloth/front/right order.

## Validation scope

The corner fixture is an engine-accepted speed10 shot, yaw12.905686665770533,
elevation35 and tipX.25. The manual UI has a speed5 ceiling, so this is not a
claim that the manual UI accepts speed10.

CPU-reference and actual software-WebGPU validation independently recreated
original Rapier from creation through h400. All three balls' translation, rotation, linear velocity, and angular
velocity matched exactly at every application boundary (maximum absolute
error 0). The existing h396–400 boundary, island, event, graph, proxy, and cushion
cache checks passed without relaxing tolerances. The actual h396 pre-impact
fraction was .9360221028327942 and post-clamp fraction .9357571601867676.

A separate exact-state check reproduced all396 native BVH trees and retained
scheduling/queue fields from owned poses. Those later native states were
assertions only. The permanent `multi-toi-owned-world.cjs` test also injects a
late failure after actual corner BVH writes, checks two complete aborts, and
retries from the same owned state.

The persisted original fixture's individual frames are pre-application-patch.
Physical assertions must independently recreate post-application frames, as
the permanent tests do; comparing the former to the latter incorrectly reports
an angular discrepancy beginning around cue contact.

This remains an isolated bounded experimental owner, not complete generic
world parity, full-shot parity, or a public `src/physics.js` replacement.
