# Bounded active CCD world integration

The isolated `experimental-three-ball-ccd-world.js` extends the original-created three-ball path after cue withdrawal. The default product and prior `experimental-three-ball-world.js` entry point are unchanged.

## Implemented

- Original pre-force sphere-center prediction, complete immutable sixteen-target roster and both collider channels per ball.
- Source proxy-distance, conservative advancement/root solve, four-pass timestep selection, and explicit collision-dt/solve-dt separation.
- A conservative certificate proves query-order independence when the complete candidate set has at most one positive accepted fraction. Ambiguous cases fail closed instead of assuming an unmaintained BVH order.
- Atomic outer ownership across numerical stages, source contact journal and island manager. Intermediate passes remain private; only the final pass publishes. Final application time, event drain and angular resistance run once.
- Source solver input remains the original engine configuration. No velocities are injected to make the fixture pass.

## Actual result so far

The unchanged original shot at angle 0°, elevation 35°, tipX 0.25 and speed 10 previously stopped at substep 193 because CCD became active. The isolated new owner reaches substep 389 from the original creation snapshot on CPU and actual native software WebGPU. All three balls’ positions, rotations and linear/angular velocities match the original at every compared substep with zero numeric error.

At substep 389 it computes TOI 0.0004171431646682322 seconds and source intervals 0.0005732740391977131 and 0.0004683926817961037. Additional assertions cover final source island manager, modification queue, floor caches/topology, dense contact graph, directional adjacency, live collider registry, all 22 fat proxies and the represented cushion cache fields. The small 2.2920788711466855e-8 difference is in the pre-existing compliant-tip presentation position, not the new CCD collision.

The real WGSL distance kernel passes 488 original-native cold/warm comparisons at exact f32 bit patterns, including signed zero. Its aggregate reducer implementation initially failed during software pipeline compilation; a source-equivalent scalar-graph lowering resolves that compiler-resource boundary without changing the native corpus or arithmetic order.

## Still not supported

This particular original shot has no positive post-solve pose clamp: the shorter intervals prevent one. That earlier checkpoint rejected positive post-clamp. The later isolated continuation now verifies one constructor-yaw clamp; see `post-clamp-integration-status.md` for its separate bounds. Arbitrary live-cue CCD, order-sensitive candidate sets, larger simultaneous contact components and full general shots are not covered. A software adapter result is not a browser or physical-GPU performance result.

## Fresh regression checkpoint (2026-10-25)

All nine previous bounded scenarios were rerun against the shared adapters: default three-ball, default four-ball, yaw15, a second four-ball turn from actual settled state, successful four-ball goal, later opponent foul after goal, side-follow23, side-draw−37, and elevated holdout61.25. Each passed both CPU reference execution and actual native SwiftShader WGSL execution. These are regression checks of the existing owner, not evidence that the new CCD owner supports every complete shot.

The last three input families ran each backend in its own process. All six process manifests recorded completed successful comparisons. Their maximum absolute differences against original Rapier were respectively 8.049334865312119e-9, 2.1263861449405397e-8 and 2.7803868318798663e-8. Separate backend-selection skips do not mean a missing backend: both selected-backend processes ran for every family.

The final bounded CCD owner additionally rejects missing graph ownership before creating stages. Generic active CCD remains false; separate bounded capability metadata describes its admitted domain. Its CPU and actual WGSL acceptance test now invokes the graph comparator directly. All 180 represented graph/proxy/cushion numerical values match exactly, while six explicitly unrepresented cache fields remain outside the comparison. Complete island manager, modification queue, events and 223 boundary values remain checked. A forced failure in the real second pass leaves the entire public snapshot unchanged on two attempts; retry then reaches the correct boundary.

## Test process memory correction

An earlier native-GPU regression process was killed without a numerical assertion, and a later constrained-heap diagnostic explicitly exhausted V8 memory while loading the original oracle. The fix is test-only: prepare a compact reference in a separate process, preserve the complete original artifact hash, and compare the exact existing assertion transcript before using the prepared file. Four-ball and yaw15 transcripts preserve 1,048,347 and 1,114,742 assertions respectively. Native GPU owners are retained until the last awaited dispatch. The successful reruns do not erase the earlier failed process logs or establish hardware speed.

## Positive post-clamp remains separate

A source-derived world-inertia update passed four pinned native tensors on actual WGSL with exact f32 patterns and all 66 buffers destroyed. Its later integration is documented separately in `post-clamp-integration-status.md`; this paragraph records the earlier checkpoint. The unchanged original elevation60 shot was observed over 768 post-cue steps: two positive pre-TOI splits occurred, but no positive post-solve clamps. That negative result cannot validate the missing clamp integration. No engine parameter was weakened to manufacture a passing clamp case.
