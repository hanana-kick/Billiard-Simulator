# Native convex-hull point projection

`experimental-convex-point.js` implements the point projection used by Parry 0.31.1's convex-ball manifold dispatcher. It is not a generic sphere contact query or a replacement cuboid rail.

The initial shape must be an unchanged, branded `exportNativeHull` result from the pinned decoder, with both native bincode and JavaScript typed-tree byte-roundtrip gates passed. This preserves native point order, face/edge topology and adjacency. The decoder is a native test/export tool, not a browser snapshot transport.

## Source sequence

Pinned Rapier: `b716d375efc0201003f0cd9ef7168eee0b62c177`. Parry crate: `0.31.1`, SHA256 `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e`.

- `query/point/point_support_map.rs`: fresh simplex, convex support against `ConstantOrigin`, GJK projection, inside EPA boundary projection, and source fallback if EPA returns no point.
- `query/gjk/gjk.rs` and `voronoi_simplex3.rs`: original operation association, reduction/tie order, iteration and perturbation rules.
- `query/epa/epa3.rs`: reused attributed source EPA core and its explicit bounded workspace failure.
- `shape/convex_polyhedron.rs::support_feature_id_toward`: first maximum support vertex, adjacent faces then adjacent edges, native 1-degree threshold. Packed feature IDs are assembled as integers, never rounded through f32.

CPU and WGSL execute the same source core. No CPU projection is supplied to the GPU. The CPU orchestrates dispatch/readback and validates the native topology. The existing cylinder/hull query admission is unchanged.

Apache-2.0 notices are retained in source and `vendor/RAPIER-LICENSE.txt`; glam operation notices are in `vendor/GLAM-LICENSE-{MIT,APACHE}.txt`. The constant 1-degree sin/cos results correspond to the pinned enhanced-determinism libm path; its license is in `vendor/LIBM-LICENSE.txt`.

## Validation

The scalar and actual WGSL gates cover 356 queries against all eight original PhysicsLab convex hulls, including face offsets outside and inside, vertices and interiors. Native public `Collider.projectPoint(point, false)` supplies projection/inside assertions; filtered `World.projectPointAndGetFeature` independently supplies exact native feature IDs. All 3 tests pass. Maximum scalar/native and GPU/native point error is zero with a fixed absolute 2e-6 gate. These are static geometry tests, not world or whole-shot parity.

Run with the pinned native decoder selected through `RAPIER_SNAPSHOT_DECODER`. Actual GPU testing additionally requires `GPU_NATIVE_MODULE`, the adapter's configuration and `REQUIRE_WEBGPU=1`:

```
node --test tests/experimental-convex-point.cjs
```

GPU results are not inferred from the scalar gate. Supported topology is bounded to 32 vertices, 64 faces, 96 edges and 256 entries per adjacency array. Query batches are at most 64; GJK has a bounded dispatch schedule and EPA workspace overflow fails closed.
