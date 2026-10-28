# Conservative direct swept-clearance feasibility

This is a sufficient-separation fast path, not a replacement for original signed
contact distance or castShape. The raw-pose bank now accepts one shared immutable
roster in exactly original `statics` then `objects` order. For the tested scenes,
this includes all 16 static primary colliders and all four ball primary colliders.
The separate moving-body pair collider is not in original cueClearance's roster.

For each shaft/neck/tip and each obstacle, WGSL bounds the complete source .012 m
translation sweep. Sphere bounds use the actual tip radius; cylinder bounds use
`abs(axis)*halfLength + radius`, an enclosing capsule AABB, not a substituted
physical collider. Obstacle bounds derive once from actual native hull vertices,
box geometry/transforms or sphere radii. Their f32 minima round downward and
maxima upward. Only the selected ball versus tip is exempt. A candidate must have
strictly separated bounds for **every** nonexempt pair; an overlap is unsupported,
never declared collision, blocked shot, MISS, or false clear.

## Numeric admission margin and limits

A **5 mm outward uncertainty margin** is subtracted from each separating gap.
This deliberately large margin is distinct from, and not justified merely by,
the empirical pose-test tolerance. It covers f32 pose/range-reduction/geometry
conversion and bound arithmetic in this small profile (angle ±3,600°, elevation
0..85°, cue length ≤2 m, input center and immutable bounds coordinates ≤10 m).
For scale: f32 packing at 3,600° is at most approximately 0.000122°; reduction can
add at most a few float ulps in degrees; Horner evaluation is bounded in
[-π/2,π/2], and there are no ill-conditioned support divisions. At the 2 m cue
scale these ordinary rounding contributions are far below the chosen 5 mm pad.
The cylinder radial capsule overbound adds additional conservatism. The original
native quaternion/collider boundary and f32 effects are still tested against
actual original clearance, rather than assumed identical.

This engineering guard is **not a formal general-purpose interval proof**.
There is no authority to progress a complete world solely from this experimental
receipt. Exact overlap/distance/TOI queries, a quantified end-to-end bound for wider
profiles, and dynamic collision/CCD remain missing. Source pull is fixed at zero;
the original .012 m sweep is preserved. The reported minimum margin is an AABB
separation diagnostic, not original cueClearance.distance.

## Observed coverage

[Native receipt](evidence/direct-clearance-native.json): 23 raw candidates in four
actual source scenes yielded **6 geometrically separated, 17 unsupported, zero
admitted/original disagreements**. Every separated row checked 59 ordered pairs.
Tests include airborne and on-table scenes, cloth obstruction, another ball in
the shaft path, and an explicitly nonstandard large selected sphere to ensure
shaft overlap is not exempted. The latter is a conservative false overlap; it is
not reported as an original physical hit. Some original-clear rows are unsupported,
which is expected for this deliberately conservative first fast path.

Actual WGSL shader is 5,108 bytes. A seven-row bank requests 5,408 buffer bytes,
including shared geometry and diagnostic readback. Four banks were run serially;
the complete two-test command took under one second on SwiftShader software.
No hardware throughput, full-step, full-shot or rule correctness claim follows.
All candidate transport results remain unsupported/physicsScope/null-pass,
including the six geometry-separated candidates.

Run `tests/direct-clearance.mjs` with the same trusted Rapier/WebGPU environment
variables documented by the cue component. No dependencies or external computers
were used. Next: source-faithful physical state creation and flex/guide solve,
then actual contact/integration/CCD joins—not reinterpretation of unresolved
bounds as clear and not a position-only trajectory shortcut.
