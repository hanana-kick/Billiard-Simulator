# Bounded cue EPA source mapping

This module is a source-derived translation of published Parry3d 0.31.1, not a native-contact fallback or uploaded contact oracle. It is not wired into production physics. No CPU/GPU parity result is claimed by this document.

Source: https://docs.rs/crate/parry3d/0.31.1/source/src/query/epa/epa3.rs

## Shared interface

`src/experimental-cue-epa-core.js` exports `EPA_CORE` and `EPA_LAYOUT` through CommonJS and `globalThis.LabCueEpaCoreExperimental`. `EPA_CORE` is WGSL-like control source intended for the same scalar-f32 interpreter and WGSL generator. All floating arithmetic is expressed through the supplied scalar/vector primitives; integer divisions in heap traversal are explicitly cast to `i32` so type erasure cannot introduce fractional indices.

Required helpers: `addf`, `subf`, `mulf`, `divf`, `sqrtf`, `absf`, `f32`, `i32`; `v3`, `zero`, `va`, `vs`, `vm`, `vn`, `vd`, `vc`, `len`, `try_unit`; `sget`, `sset`, `getv`, `setv`; `Cso`, `support`, `simplex_vertex`, and `triangle`. Some scalar helpers are supplied transitively by vector helpers rather than called directly here.

`Cso` retains `orig1`, `orig2`, and `point`. All three are expressed in shape 1's coordinate frame. `triangle` returns `Projection { point, kind, index, weights }`; kinds 0, 1, and 2 mean vertex, edge, and face. `weights` must be all three barycentric coordinates in original a/b/c order, including on edges and vertices. `try_unit` must use a finite positive reciprocal-length guard, returning zero when normalization fails. No nonzero epsilon is substituted for that guard.

`epa()` acts only when state 0 equals 2, and reads simplex dimension from state 1. Success sets state 0 to 3 and writes the two witnesses at 14 and 84, and the normal at 88. Native `None` maps to state 4 with normal +X. Capacity overflow maps to -2. An impossible/invalid simplex dimension or a degenerate two-vertex bootstrap that cannot construct the source's third vertex maps to -3 instead of out-of-bounds memory access.

## Source correspondence

- `FaceId::new` and distance-only ordering, epa3.rs 22–52: `epa_heap_push` and `epa_heap_pop`. Face IDs do not break ties.
- `Face::new_with_proj`, `Face::new`, and barycentric reconstruction, epa3.rs 64–118: `epa_make_face`. Triangle normal is `try_unit(cross(b-a,c-a))`, matching `utils/ccw_face_normal.rs`. The edge/vertex admission test retains the projection-inside check plus strict squared distance less than `(100*f32::EPSILON)^2`.
- `Face::closest_points`, epa3.rs 120–129: `epa_result`. Both witnesses retain left-associated `(a*w0+b*w1)+c*w2` evaluation.
- `Face::next_ccw_pt_id` and `can_be_seen_by`, epa3.rs 135–165: `epa_next_ccw` and `epa_seen`. Affine dependence uses squared cross-product length less than or equal to `(100*f32::EPSILON)^2`, as `shape/triangle.rs` 522–527 compares against zero.
- EPA initialization and source bootstrap, epa3.rs 439–577: first half of `epa`. Negative axes are made with unary vector negation, preserving the two negative-zero lanes of `-Vector::X/Y/Z`. The one-vector orthogonal basis follows `math/mod.rs` 234–250 and stops after its first basis vector, matching the source callback's `false` result.
- EPA expansion, epa3.rs 579–690: second half of `epa`. Tests and order are retained, including the source's unusual candidate comparison after updating `max_dist`, the previous popped face fallback when a new face distance decreases, and the final best-face return after more than 100 expansion iterations. The iteration limit is not converted into a failure.
- Recursive silhouette traversal, epa3.rs 693–714: `epa_silhouette`. An explicit bounded LIFO stack pushes the second branch first, so branch one is visited first, preserving recursive traversal and silhouette append order.

The heap implements the Rust `BinaryHeap` push/sift-up and pop/sift-down-to-bottom/sift-up order: equal pushed values stop; equal left/right children select the right child; deleted faces are removed lazily when popped. This ordering must be checked against the pinned native build's standard-library behavior in differential validation.

## Scratch layout and boundaries

All EPA scratch is within 200–12631, leaving 12632–13631 unused. No GJK memory below 200 is overwritten except the specified status/output slots.

- Controls 200–215: vertex count, face count, heap count, silhouette count, stack count, distance tolerance, last popped negative distance, expansion iteration count, then reserved.
- Vertices 216–1367: 128 records of 9 f32 values, ordered `orig1`, `orig2`, `point`.
- Faces 1368–8535: 512 records of 14 f32 values, ordered three vertex indices, three adjacent-face indices, normal xyz, barycentric xyz, deleted flag, projection-inside flag.
- Heap 8536–9559: 512 `(face_id, neg_dist)` records.
- Silhouette 9560–10583: 512 `(face_id, opposite_vertex_slot)` records.
- DFS stack 10584–12631: 1024 records of the same two integers.

These are implementation bounds, not changes to contact tolerances. Hitting a capacity explicitly fails with -2, rather than silently truncating or substituting another contact algorithm.

## Verification status

Current integration/native/actual-WGSL checkpoint: combined query/fresh-box suite 12/12, no skips; query GPU386pairs and fresh box/native-hull manifold GPU578pairs match independent native at fixed tolerances with measured maxima0. The historical fixed rail graze now reproduces native witnesses exactly. Capacity-overflow fixtures and attribution of the former port divergence to one source difference remain unverified; no causal claim is made.

## Separation-proof termination metadata

The ordinary Parry contact API deliberately maps both the GJK 100-reduction cap and an EPA `None` result to `NoIntersection(Vector::X)`, hence to no contact. This return value alone is not a geometric separation proof. The source branches are preserved, including contact values and legacy null results.

The bounded query now records additional metadata in previously unused scratch lanes 112–113 and query output lanes 14–15. Reason 1 is written only by the actual `min_bound > prediction` support-bound branch; its argument is that exact f32 lower bound. Reason 2 records the GJK cap and its iteration count. EPA failure reasons 3–6 distinguish rejected heap distance, empty initial heap, empty silhouette, and no new face. Reason 7 is an unresolved EPA miss; zero means contact or unspecified/uncompleted output. These metadata writes do not change the original predicates, arithmetic, contact witnesses, normals, or source null behavior.

The guard accepts only null plus completed reason1 metadata with a finite lower bound strictly above the exact requested prediction. A zero-initialized output, cap, EPA failure, contact, or other unresolved status cannot prove separation. Metadata predicates are shared by the scalar and WGSL control source. The small `epa_require_*` helpers preserve the corresponding source conditions and make the actual status transitions independently testable.

`tests/cue-query-termination-harness.cjs` is test-only: it exposes internal methods in an isolated VM and runs explicit algorithm-control-state fixtures. The GJK fixture executes a real reduction with the counter set to99, then traverses the actual100-cap branch. EPA fixtures execute the actual heap/failure predicates. These are not naturally encountered physical trajectories or native geometry parity claims, and no candidate API accepts their injected scratch state. On frozen `307e23e`, actual WGSL branch/readback coverage passes for the GJK cap, all four EPA miss predicates and zero/uncompleted output, while a normal completed support-bound query and actual contact retain their expected proof/non-proof status. The combined query/manifold/guard suite passes 21/21 with no skips. Independent native regression covers 386 actual-WGSL query cases and 578 fresh manifold cases (1,016 ordered points), with measured distance/point/normal maxima of zero. These branch tests do not claim naturally encountered cap trajectories. The fixed yaw15 and unchanged default 450-h owner regressions also pass; their exact scope and evidence logs are recorded in `docs/gpu-yaw15-variant.md`.
