# Experimental source 3D proxy distance

This component ports Parry 0.31.1's `query/sweep_toi/proxy_distance.rs` dim3 path for an ordered convex target point cloud A and the one local ZERO point of a Ball proxy B. It is not an alternative GJK algorithm, sphere/plane approximation, complete CCD scheduler, or activated product backend. Existing physics, application defaults, and runtime files are unchanged.

## Source identity and license

- Rapier source baseline: `b716d375efc0201003f0cd9ef7168eee0b62c177`.
- Parry: official `parry3d 0.31.1` source.
- `proxy_distance.rs` SHA-256: `0a70a90c80d0e71ccbc0d3a32820401b34ed0405ff0812c578385cda248aeb3a`.
- `toi_proxy.rs` SHA-256: `6275314acc6d1a24c677dca0f0932517c43bdfc13ed84d48e0590d82d440672b`.
- Native enhanced-determinism baseline uses scalar glam 0.33.12 through glamx. Vector is Vec3, not Vec3A. Dot, cross, length, reciprocal normalization, and quaternion ZERO-point transformation retain scalar expression order.
- Parry's Apache-2.0 attribution is retained in source headers; the complete license is `vendor/RAPIER-LICENSE.txt`. Vector arithmetic attribution references the existing glam license files.

## API

```js
const Distance = require('../src/experimental-ccd-proxy-distance');
const input = {
  pointsA: orderedSourceHullPoints, // each [x, y, z], native f32
  pos12: { translation: [x, y, z], rotation: [qx, qy, qz, qw] },
  cache: { metric: 0, count: 0, indexA: [0, 0, 0], indexB: [0, 0, 0] },
  useRadii: false
};
const cpu = Distance.reference(input);
const stage = await Distance.createGpuStage(device, { pointsA: input.pointsA });
const gpu = await stage.step({ pos12: input.pos12, cache: input.cache, useRadii: false });
stage.dispose();
```

Results contain `pointA`, `pointB`, `normal`, `distance`, `iterations`, and `cache`. Points, normal, and distance are in frame A, and normal points from A to B. Inputs and their cache are never mutated; the caller explicitly feeds the returned cache into its next distance query. The default omitted cache is the source all-zero cache. `useRadii:true`, empty clouds, non-f32/nonfinite values, malformed cache representations, and non-unit quaternion inputs fail closed.

The proxy B specialization is only the source Ball's unique point/support index 0. The target A may be an arbitrary source-ordered hull point cloud, including segments, triangles, tetrahedra, cuboids, and non-box convex hulls. Points are not sorted, deduplicated, reconstructed, or replaced by analytical planes. Ball radii belong to the caller's source TOI algorithm, not this core distance query.

For non-module browser use, load the existing arithmetic-graph runtime, kernel, generated CPU artifact, reducer-graph lowering, and API files in that order. Global name is `LabCcdProxyDistanceExperimental`. A GPUDevice is mandatory for `createGpuStage`; there is no CPU fallback. Each stage owns its buffers, rejects concurrent use, and requires disposal. The compiled GPU pipeline is shared per device.

## Preserved source behavior

- 3D CSO is `wB - wA`, unlike the source 2D branch.
- Complete 1/2/3/4 simplex solvers, with the source ordered region comparisons and assignments. CA and DB edges and ACB/ADC faces are intentionally not canonicalized.
- Exact source first-point-relative support projections and strict `>` first-tie index selection.
- Cache validity: count at most 3 and both index arrays within their proxy bounds. An invalid but representable source cache flushes; it is not an API error.
- Metric ratio checks are strict. The count-1 metric is zero and therefore flushes under the source epsilon test. Counts 2/3 use edge length/triangle area. Source signed tetrahedron volume is retained for the capped-loop case.
- Original witness accumulation order, barycentric divisors, rollback on degeneracy/no distance progress, and duplicate support termination.
- The 32-iteration counter increments only after a nonduplicate support vertex is appended. Source stale coefficient behavior in an appended slot is retained.
- All three source overlap exits leave the entire incoming cache unchanged, including unused index slots. They do not apply radii. Source terminal normal-zero returns zero witnesses.
- CPU uses f32 rounding at every scalar physical arithmetic operation. The WGSL carries the same primitive operation order and the identical generated control flow. It avoids built-in `dot`, `cross`, `normalize`, and reciprocal-square-root substitutions.

Extra diagnostic fields are not source public API fields: `overlap`, `cacheWritten`, `termination`/`terminationCode`, `cacheAccepted`, `cacheFlushed`, and `finalCount`. `cacheAccepted` describes index/count validity before metric flushing. These do not alter solver branches.

WGSL does not give a universal bitwise floating-point guarantee across all vendors, contraction settings, subnormal modes, or overflowing intermediate values. The module therefore does not claim arbitrary-device bitwise equivalence. Native-f32 arithmetic and branch/index parity are verified against the pinned source and actual WGSL on the stated adapter. Nonfinite final results fail closed.

## Single algorithm source

`src/experimental-ccd-proxy-distance-kernel.js` contains the constrained WGSL algorithm and source-order region tables. The CPU artifact is mechanically generated from that same control flow; application execution does not use eval or a runtime transpiler.

```sh
node src/experimental-ccd-proxy-distance-kernel.js --generate
node src/experimental-ccd-proxy-distance-kernel.js --check
node --test tests/experimental-ccd-proxy-distance.cjs
```

The simplex reducers are lowered from the same ordered region tables into scalar arithmetic graphs interpreted on the GPU. The GPU still owns every GJK loop, support decision, cache decision, rollback, and termination decision; the host never steers query branches. This avoids software-driver compiler explosion from large returned simplex aggregates. An independent 1,800-simplex holdout gate verifies that graph reducers exactly match the direct CPU source reducers, including all inactive slots and their retained coefficients. The remaining generated WGSL uses pointer/private storage lowering without changing operation or branch order.

The primitive arithmetic has explicit f32 CPU counterparts. The only intentional backend spelling difference is normalized-zero handling: WGSL avoids an indeterminate division by zero, returning the same zero that glam returns when its length reciprocal is not finite.

## Verification

The dedicated suite covers every reducer Voronoi region and source vertex order, degeneracy, cache validity and strict metric boundary cases, support ties, overlap cache preservation, all 24 tetrahedron permutations, 160 deterministic arbitrary point clouds, slanted and large-coordinate hulls, nonidentity Ball rotations, and cold/warm repeats. A captured active native cloth and right-cushion query adds seven exact source Sweep::transform_at sample inputs, including the captured native cushion TOI fraction. That fixture explicitly does not claim original-WASM world equivalence or end-to-end active CCD completion.

Native differential uses the companion unmodified-source `rapier-active-ccd-probe --proxy-distance` mode. It preserves native `Pose` serialization padding and compares witnesses, normal, distance, iteration count, cache metric, count, and all retained/unused index slots. The source revision and output protocol are asserted. No mutated private Parry source is needed.

```sh
PARRY_PROXY_DISTANCE_PROBE=/path/to/rapier-active-ccd-probe \
GPU_NATIVE_MODULE=/path/to/webgpu/index.js \
VK_ICD_FILENAMES=/path/to/verified-vulkan-icd.json \
REQUIRE_WEBGPU=1 node --test tests/experimental-ccd-proxy-distance.cjs
```

Final component verification: all 11 tests pass with no skips. The 488 native cold/warm queries and 488 actual WGSL queries each match every returned float field bit-for-bit, including signed zero, with exact iterations/cache indices and max absolute error 0. The tested adapter is Dawn WebGPU 0.6.2 over the existing Chromium SwiftShader Vulkan ICD. See the accompanying verification report. The source 32-iteration cap is retained, but this corpus reaches at most four iterations and does not dynamically cover every terminal branch. A light-only run explicitly skips native/GPU gates and must not be reported as a full parity pass.

This module is intended for the source Sweep/SeparationFunction/TOI root loop to call. No world branch is admitted merely because distance parity passes; real source branch capture, scheduling, integration, narrowphase state, post-clamp behavior, and product acceptance remain separate gates.
