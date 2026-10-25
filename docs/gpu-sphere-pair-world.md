# Coupled recurrent two-sphere experiment

The source/native and actual WGSL suite passes 3/3 with no skips. All five
trajectories, 608 outer frames per backend, have maximum asserted absolute
numeric error zero. This is not a complete application world or a portable
bit-identical result for every GPU adapter.

The bounded domain contains exactly two dynamic spheres, no floor, no other
collider or joint, zero COM offset and collider-local offset, no skins/hooks,
canSleep=false, CCD disabled, and no adaptive broad-phase margin. Native initial
active-set body IDs are retained: persistent-island merge order is not used as a
substitute for solver-body order. The single constraint gathers each source
collider side and updates both bodies together inside every PGS operation.

This is not two independent per-body collision impulses. The shared normal
projected mass includes both dynamic inverse masses and inverse inertias. The
coupled tangent 2×2 matrix includes both bodies' rotational contributions.
Warmstart, biased passes, pose integration, relaxation, restitution and reporting
impulse accumulation use source order. Separate free-body stages are used only
when the GPU geometry says there is no active constraint.

The world owns both fat AABBs, pair/point/active flags, geometry, frozen anchors,
lever arms and impulse caches across time. The initial native snapshot is the
only authoritative input; subsequent native states are independent assertions.
The geometric ball-ball gate is the source strict distance < prediction, not the
convex-ball <= radius+prediction gate. Contact normals use direct component
division and local witnesses retain the source rotation roundtrip.

## Sources and notices

- Rapier commit `b716d375efc0201003f0cd9ef7168eee0b62c177`, contact constraint,
  staged solver, broad-phase and narrow-phase source. Apache license text is
  retained in `vendor/RAPIER-LICENSE.txt`.
- Parry 0.31.1, `query/contact_manifolds/contact_manifolds_ball_ball.rs` and
  `partitioning/bvh/bvh_insert.rs`, under the retained Apache license.
- glam 0.33.12, commit `e7d680ed34c051cfa8741f76821628a925161280`, scalar
  quaternion operation order. Exact upstream MIT and Apache texts are preserved
  in `vendor/GLAM-LICENSE-MIT.txt` and `vendor/GLAM-LICENSE-APACHE.txt`.
- glamx 0.3.1, commit `f530eef5be6a009d29499d1d8919b4f1bee19477`, relative-pose
  construction. Exact upstream texts are preserved in
  `vendor/GLAMX-LICENSE-MIT.txt` and `vendor/GLAMX-LICENSE-APACHE.txt`.

The appended `signbitSign` graph opcode reproduces copysign(1, normal.z), including
negative zero, for the deterministic source tangent basis. Unary source negation
uses an appended integer-bit-XOR `negate` opcode, not a floating multiplication
whose zero sign WGSL may ignore. Existing opcode indices remain unchanged.
The generated geometry normal is checked against the native source sign branch,
not only against uploaded negative-zero operands. Results on the selected
software adapter are not a blanket portability claim for all GPU adapters.

## Executed acceptance

The independent fixture suite includes generic head-on, unequal-mass oblique
spin, and actual billiard radius/mass/dt/12-substep oblique, near-graze and miss
cases. It compares both complete body states, source active-set/solver-body IDs,
geometry/cache, pair topology and events at the unchanged numeric gate
`2e-6 * max(1, abs(native))`.

Actual-scale cases use native values and body-pair material combine settings
from the public PhysicsLab constructor but remain free-space, single-channel,
CCD-disabled subsets. They do not claim table contact, rolling, duplicate-channel,
sleep, cue, TOI or complete-shot equivalence. Actual application spheres enable
CCD: source activation/inactive-branch admission remains a separate prerequisite.
The native CLI decoder is test infrastructure, not browser-ready transport.


Actual execution used Dawn 0.6.2 with Vulkan SwiftShader. The fixed tolerance
above was unchanged. Whole trajectory comparisons cover both bodies, not just
collision-time samples. Initial snapshots are taken after one free-flight setup
step, with no prior collision or impulse cache warm-up.

- Equal-mass head-on: 64 frames at native dt `0.008333333767950535`,
  0.5333333611 s; contact start 22, stop 28; peak normal impulse 1.7999999523.
- Unequal-mass oblique/spinning: 96 frames at the same dt, 0.8000000417 s;
  start 25, stop 28; peak impulse 2.2921528816.
- Actual-scale oblique/spinning: 128 frames at native dt
  `0.0010416667209938169`, 0.1333333403 s; start 38, stop 41;
  peak impulse 0.1958253831.
- Actual-scale near graze: 160 frames at that dt, 0.1666666754 s;
  start 89, stop 91; peak impulse 0.02058823593.
- Actual-scale miss: 160 frames, 0.1666666754 s; no active contacts, collision
  events or reporting normal impulse. Broad-phase-only pair state remains
  independently compared and is not conflated with a physical collision.

Event frames are zero-based relative to the initial snapshot. Generic cases use
4 substeps; actual-scale cases use 12, with 4 internal PGS iterations in every
case. The actual application radius is 0.03075 m and mass is 0.210 kg before native
f32 storage. Pair material coefficients and Multiply combine settings are read
from an actual public PhysicsLab instance, including the native-rounded square
root coefficients on its body-pair collider channel.

The exact source basis-sign sentinel passes for generated axis-aligned zero
normal components as well as the oblique/spinning geometry. This guards against
silently treating +0 and -0 as interchangeable before copysign; ordinary numeric
zero equality alone is not the basis admission contract.
