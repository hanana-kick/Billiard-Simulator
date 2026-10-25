# Source CCD inactive admission

`experimental-ccd-inactive.js` computes the pinned engine's CCD fast-body
predicates. It does not solve a time of impact, clamp a sweep or integrate a
world. Active CCD remains unsupported. The module retains original
`ccd_enabled=true` and `max_ccd_substeps=4` rather than changing those flags to
make a fixture pass.

## Source and order

Rapier commit `b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `RigidBodyCcd::is_moving_fast` predicts velocity using the current accumulated
  force/torque and effective mass/inertia. The farthest-point speed is linear
  speed plus angular speed times the body's native maximum extent. Activation
  is the strict comparison `speed * dt > 0.5 * ccd_thickness`.
- `pipeline/physics_pipeline/substep.rs` performs this prediction before solving
  when more than one CCD substep remains. A false result avoids TOI splitting.
- `staged_island_solver/worker.rs` derives `ccd_vels` from the solved next pose,
  not from final damped solver velocity.
- `RigidBodyPosition::pose_errors` composes the complete COM-shifted relative
  pose. Its rotation is converted to a scaled axis, then divided by full dt.
- `is_moving_fast_with_next_position` takes the maximum of actual COM/rotation
  motion and the interpolated-velocity estimate, then applies the same strict
  thickness threshold.

Full pose composition and native f32 operation order are preserved, including
COM transformations. `ccd_enabled` changes the sweep scope, not the fast-body
predicate: fast dynamic bodies can sweep fixed geometry even when that flag is
false. The present API deliberately admits only the requested enabled case.

## Bounded transcendental branch

Pinned glam 0.33.12 uses libm 0.2.16 under enhanced determinism. For relative
rotation arguments `y >= 0`, `x > 0`, `y/x < 0.4375`, libm's atan2f reduces to
its small atanf polynomial or exact tiny-argument return. This exact branch is
ported to the existing arithmetic graph without a hardware atan2 substitution
or new shared opcode. The source's near-zero axis threshold is also retained.
Other angular branches return `unsupported-ccd-angle-domain`; they are not
approximated or silently admitted. Active predicates return
`unsupported-active-ccd`. Neither is permission to proceed with a no-CCD solve.

The source notice from Sun Microsystems is retained in the module, and the
complete official libm license is in `vendor/LIBM-LICENSE.txt`. Rapier,
Parry and glam notices remain in their existing vendor license files.

## Validation

The actual GPU test passes 3/3 without skips. Both the CPU graph and WGSL are
compared against direct pinned Rust method calls for 78 cases, with maximum
observed numeric error 0 and exact Boolean decisions. These include 64 original
native frames with CCD enabled and max substeps 4, using app-scale sphere
radius 0.03075 m, mass 0.210 kg, dt 1/960 and 12 solver substeps. Two 32-frame
fixtures cover free motion with oblique spin and simultaneous floor contact.
Their post-solve native WASM `ccd_vels` are also exactly equal to the direct Rust
source oracle. The per-fixture elapsed horizon is approximately
0.033333335072 seconds, after one native initialization step.

Strict f32 neighbor cases exercise active/inactive thresholds, with one
pre-prediction and two post-pose active cases correctly refused. Additional
rotation cases cover the tiny-axis and polynomial branches, plus a separate
unsupported-angle sentinel.

The Rust oracle is a separate `rapier-ccd-probe` executable. Build it with
`node tools/rapier-ccd-probe/build-native.cjs` using the explicit official-source,
archive and Rust environment variables documented for the snapshot decoder.
The helper verifies official source archives, selects only that binary target,
and confirms an existing decoder binary's hash is unchanged. Set
`RAPIER_CCD_PROBE` and `RAPIER_SNAPSHOT_DECODER` to their generated executables,
then run `node --test tests/experimental-ccd-inactive.cjs` with the documented
strict WebGPU environment.

This isolated admission result does not yet establish a recurrent world with
CCD enabled. Such integration must check pre-solve admission before advancing,
check post-solve admission before commit, preserve its own state, and halt if
CCD becomes active. Actual TOI handling remains a separate required boundary.
