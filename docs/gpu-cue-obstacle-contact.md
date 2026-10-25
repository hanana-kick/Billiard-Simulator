# Experimental cue obstacle static query, recovery v3

This is a new source-derived implementation after environment loss, not a recovered original module. Historical 926/1950 passing counts are not current evidence. Production Rapier physics is unchanged.

## Current scope

Exactly one analytic cylinder and one cuboid or original-indexed convex hull, either pair order; independently specified f32 translations and unit quaternions. No bounding-box, capsule, or polygon-cylinder replacement is used. Hull support scans the original native point array with a strict greater-than comparison, retaining first-index ties. A convex point cloud must contain 4–32 points; its convexity/provenance is a caller obligation. Native topology export remains separate from query support points.

The internal support map implements sphere support as well, but the public native-dispatch parity API rejects sphere pairs: Parry dispatches cylinder/ball to its analytic point projection path, not this generic GJK/EPA route. That separate native-dispatch component is not yet rebuilt here.

The input quaternion is validated, not silently normalized. Tests must supply the same pose to the untouched native shape query. Collider setters may normalize quaternions; comparing a setter-altered native pose to a raw query pose is not valid.

## Pinned source mapping

- Published [Parry3d 0.31.1 source](https://docs.rs/crate/parry3d/0.31.1/source/), crate SHA256 `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e` and recorded VCS `3383f51cbbe9af70565427e7a66c605e1557c1fc`.
- `shape/cylinder.rs`, `shape/cuboid.rs`, `shape/ball.rs`, `utils/point_cloud_support_point.rs`: analytic support points, signed-zero copysign, first-index hull tie order.
- `query/contact/contact_support_map_support_map.rs`, `query/gjk/cso_point.rs`: initial direction, two independent witnesses, first-shape CSO frame and final local/world transforms.
- `query/gjk/gjk.rs`, `voronoi_simplex3.rs`, `query/point/point_segment.rs`, `point_triangle.rs`, `point_tetrahedron.rs`: source operation order and simplex permutation/previous-witness bookkeeping.
- `query/epa/epa3.rs`: see `experimental-cue-epa-source-map.md` for heap ties, silhouette recursion, barycentric witnesses, degeneracy checks and bounded workspace.
- glam scalar quaternion operations and glamx `Pose3::inv_mul`: source subtraction/rotation/multiplication order; finite-positive reciprocal normalization guard.

Origin projection uses `ZERO - vertex`, not unary negation. Negative EPA bootstrap axes use unary negation, retaining negative-zero unused lanes. These are source distinctions, not a claimed resolution of the historical exact-graze divergence.

## Execution and failure boundaries

The same typed scalar-f32 control source drives a JavaScript diagnostic interpreter and actual WGSL generation. Each floating arithmetic helper rounds to f32 on CPU. Native contacts are never uploaded to the GPU. Inputs contain shape dimensions, original points, poses and prediction only.

Each batch has 1–64 pairs. GPU execution dispatches initialization, 256 bounded GJK iteration stages, source EPA, then query output. Source GJK's 100 successful-reduction limit is preserved; an unresolved dispatch bound or workspace capacity fails explicitly rather than fabricating a contact. EPA uses bounded source topology; no alternate penetration algorithm is substituted.

Fixed comparison limits: distance 2e-6, each witness component 3e-6, normal component 3e-5. No tolerance is increased for grazes. A fixed historical rail exact-graze input retains position bits `3fbb645a 3c449ba6 00000000` and identity rotations, original right-rail native points, and an independent native gate. A failing gate is a failure, not a skip or known-good claim.

## Current verification

2026-10-24 initial smoke probe: 36 shaft/neck dimension, three-axis, both-sign side/cap/penetration/exact-graze/prediction cases matched untouched native `Shape.contactShape` with numeric maximum error 0. This was CPU diagnostics only. Expanded CPU tests now pass: 144 axis cases (120 contacts), 176 actual full-pose/original-hull cases, and the fixed historical exact-graze input. All measured numeric maxima were 0. The fixed graze reproduces native local witness y=-0.044523775577545166 after seven GJK reductions and EPA. The previous rejected port differed by about 0.04452379 in a witness; its single root cause is not yet isolated. The preserved JSON records original input and diagnostic history, never injected contacts. Current full suite: 11/11 with no skips. Actual native Dawn/SwiftShader WGSL readback compared 386 pairs (including 64 independently rotated/translated holdouts and both orders of the fixed graze) against untouched native queries over 1,813 actual dispatches. Distance, point and normal maximum errors were 0. This is correctness evidence on software Vulkan, not a hardware performance result.

Static query parity is not fresh manifold parity, persistent manifold/cache matching, nonlinear CCD, complete cue clearance, or whole-shot CPU/GPU parity. Those remain separate gates.
