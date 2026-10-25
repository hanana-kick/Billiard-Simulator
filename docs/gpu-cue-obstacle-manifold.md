# Experimental fresh cue obstacle manifold

This module implements source-derived fresh cylinder/obstacle feature clipping and analytic support-map queries.

## Scope

Fresh analytic cylinder ↔ cuboid or admitted original native ConvexPolyhedron, both pair orders and explicit full poses. Input must contain `fresh:true` and may not include persistent normals, points, cache state, warm starts, normal constraints or rounded-shape parameters. An empty old manifold is not proof of freshness.

The native cylinder cap feature is the source `PolygonalFeatureMap` oriented square contact patch. It does not replace the cylinder in support-map GJK/EPA, which remains analytic. Native face/edge/vertex feature IDs and clipping append order are retained.

The source polygonal feature clipping appends contained vertices from shape 1, then shape 2, then edge intersections (shape 2 outer loop), then the original GJK/EPA witness with UNKNOWN/UNKNOWN IDs. This can produce five geometric contacts where a later solver selects only four; geometric manifold and solver contact counts are not interchangeable.

Each packed feature ID uses separate exact small kind/code f32 values and is decoded to u32. Complete packed u32 IDs are not rounded through f32 storage. At most 25 points are represented; overflow rejects the result. No contact oracle values enter GPU storage.

## Source and shared foundation

Pinned published Parry3d 0.31.1, same crate hash and query provenance as `gpu-cue-obstacle-contact.md`; Apache-2.0 attribution retained. Source paths are `shape/cylinder.rs`, `shape/cuboid.rs`, `shape/polygonal_feature.rs`, and the PFM contact-manifold dispatcher. The query core and source-derived EPA are shared in behavior with the separate static query implementation.

## Independent native gate

Tests create a new zero-gravity native world, fixed/fixed collision pair with the specified prediction distance, verify no previous manifold, advance one step, and require input collider poses to remain unchanged across that step. The tested query inputs are the actual native collider input poses; setter normalization is not silently compared against another pose. Manifold reads must not mutate the native snapshot. Count, order and IDs are exact; distance/point/normal numeric limits remain 2e-6/3e-6/3e-5.

## Status and exclusions

Current independent CPU/native tests pass: 144 axis fixtures, 494 ordered geometric points, 71 five-point manifolds, plus 48 actual shaft/neck box-pose fixtures. Count/order/IDs are exact and all numeric maxima are 0. An additional 64 independently rotated/translated CPU fixtures pass. Actual native Dawn/SwiftShader WGSL validation passes 208 pairs and 774 ordered geometric points over 1,036 actual dispatches, with exact count/order/IDs and zero measured numeric maxima. The 48 actual PhysicsLab world poses are CPU-validated here; the GPU set consists of the axis and independent-rotation fixtures. Combined query/manifold suite: 11/11, no skips. Actual shaft/neck dimensions and source strike poses are included in written new tests. The validated convex route requires original native serialized faces/edges/normals/adjacency and handle/source validation, not inferred triangles or polygon simplification. Shapes without admitted topology remain unsupported.

Persistent matching/recycling, snapshot continuation, nonlinear CCD and complete cue clearance remain unsupported. Source simple-pair recomputation creates a new simplex, but an old manifold's local normal and tracked-point data can affect the persistent path; this fresh API does not invent missing workspace state.

## Validated bounded native convex extension

The current working extension additionally accepts original native ConvexPolyhedron topology exported once from the initial snapshot. The new extension passes its current bounded native/real-WGSL checkpoint. It retains the previously validated cylinder/cuboid path and the frozen query/GJK/EPA algorithm.

The immutable export is admitted only after pinned engine/source identity, native and typed byte-roundtrips, unchanged decoded-tree hash, exact collider handle generation, index bounds and reciprocal adjacency validation. It contains geometry only: original points, vertex/face/edge records and adjacency. No native contact normal, witness, feature cache or per-frame manifold is uploaded. The typed snapshot itself remains host diagnostic data and is not a GPU input.

Packed GPU geometry has 200 original point-cloud floats plus two 772-float face tables. Each face retains its original outward normal and the first `min(nativeCount,4)` original vertex and edge IDs, exactly as upstream `ConvexPolyhedron::local_support_feature` specifies, including faces with 11 vertices. Normal selection uses strict `>` and original face order. Deleted original edges are not renumbered or compacted.

A branded, deep-frozen export is required. Reconstructed triangles, copied/modified topology objects, stale handle generations and source/hash mismatch fail closed. The export and pack run in the same Node module instance; browser rehydration of unverified topology is intentionally not provided. Capturing the snapshot before cue lifecycle changes is a caller boundary, not inferred from timestamps or an empty manifold.

Initial geometry export alone does not certify persistent continuation. A separate current live-cue lifecycle test verifies eight snapshots through native and typed byte roundtrips, including handle reuse. That evidence does not validate a whole cue solver or synthesize persistent workspace.

Current complete checkpoint: 12/12 tests, no skips. Hull CPU/native subset is322pairs and242ordered geometric points. Actual WGSL fresh set preserves208axis/independent-rotation cases, adds48actualPhysicsLab box-pose cases and322original-hull cases:578pairs,1016points,2590actualdispatches. Count, order and feature IDs match exactly; measured distance, local/world witness and normal maxima are0. The fixed historical right-rail graze is included in both pair orders. Frozen query386pairs/1813dispatches also reran successfully. Tests ran on native Dawn software Vulkan/SwiftShader, not a hardware performance benchmark.
