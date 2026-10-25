# Experimental single-sphere compliant cue-tip stage

`experimental-cue-joint-tip-contact.js` implements the single-sphere suffix of the unchanged `PhysicsLab.compliantTipContact(h)` application law. It preserves contact birth, persistent tangent projection/integration, unilateral normal spring/damper force, Coulomb tangential limiting, ball impulse then opposite head impulse, and the post-contact cue-removal flag. It does not replace the law with a joint motor, prescribe a trajectory, or modify production CPU physics.

`sourceReference` retains original JavaScript Number arithmetic and explicit pinned Rapier f32 `velocityAtPoint`/`applyImpulseAtPoint` boundaries. `compensatedReference` and actual WGSL use `experimental-double-single.js` for application arithmetic, rounding only at native API boundaries. Native f32 point velocity, cross-product, inverse-inertia and zero-impulse guard order follows Rapier revision b716d375efc0201003f0cd9ef7168eee0b62c177, under Apache-2.0 (`vendor/RAPIER-LICENSE.txt`). The application source is `src/physics.js` and `src/math.js`.

## Precision regression and independent oracle

The original-method test uses actual native cue/ball bodies at four aim/elevation poses and seven contact states. It captures unchanged application impulse and application point arguments, resulting native velocities, public tangent state, contact episodes and cue removal. The original method does **not** expose its sliding branch flag. That flag is consequently not independently asserted or reported as matched; tangential impulses and resulting tangent/velocity are independently compared. A candidate flag must not be copied into expected oracle data.

A fixed regression retains the failed all-f32 flattening input: at aim 23°/elevation 37°, the old head-angular-z error was 1.0527670383453369e-5, exceeding the unchanged 3e-6 gate. The original double compression was 0.000010016508352743425 versus flattened f32 0.000010017305612564087. The native application point was unchanged in that fixture; the force/impulse change was amplified by the small tip body's inverse inertia. The compensated stage retains this case without relaxing the impulse 2e-6 or velocity/tangent 3e-6 limits.

The corrected 28-fixture CPU and actual Dawn/SwiftShader WGSL arithmetic gate has maximum native impulse and velocity error 0 and tangent error 3.4531839193663316e-17. The combined corrected suffix and shared primitive gate passes 7/7 tests with no skips, including explicit admission and preserved failure regressions. This is a single instantaneous stage: default h is approximately 0.016276 ms but simulation time advanced is **0 ms**. It is not an approach/compression/separation trajectory or full cue-clearance proof.

## Explicit numerical admission

This component supports only the following experimental domain, not every manual setting:

- Source JS coefficients: sphere radius 0.01–0.1 m, tip radius 0.001–0.02 m; h from 1e-6 to 1/960 s; normal/tangent stiffness 0–1e7; normal/tangent damping 0–1000; friction 0–2.
- Native f32 components: positions and world COM within ±10 m; linear velocity within ±100; angular velocity within ±1000; inverse mass magnitude ≤1000; inverse inertia component magnitude ≤1e8.
- Original-number tangent components within ±0.01 m; center separation at least 1e-7 m. Coincident and near-coincident centers are explicitly rejected, not silently converted to ordinary no-contact success.

These bounds prevent overflow from eager straight-line split products on far-separated paths. They do not turn approximate double-single arithmetic into binary64: near-tied branch/rounding boundaries and subnormal cancellation still require their own admission/evidence. Unsupported values such as stiffness 1e35 or separation 1e20 fail before packing rather than producing a misleading successful contact result. No general persistent native manifold, CCD, broad phase, cloth, lateral-prefix or world-step implementation is claimed by this module.
