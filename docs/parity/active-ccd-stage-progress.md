# Active CCD stage implementation checkpoint

This isolated implementation does not modify or expand the validated world runtime. It ports the pinned Rapier four-pass timestep decision and Parry sphere-versus-fixed-convex sweep math/root control. Native query validation, matched actual WGSL execution, and whole-world integration remain pending. Four timestep branch tests currently pass; these are component expectations, not an original-world differential proof.

The application retains maxCcdSubsteps=4. A slice can extend beyond the first impact; each residual pass must repeat source collision/island/solver phases, whereas application rolling resistance and event filtering remain once per external PhysicsLab.step. Position clamping must preserve solver velocities and CCD velocities. No CCD flag, collision filter, or physical constraint may be disabled for admission.

Pinned source: Rapier b716d375efc0201003f0cd9ef7168eee0b62c177; Parry3d 0.31.1; glam0.33.12. Original native vertex order, subtract-first proxy support, source GJK and hybrid-root iteration order are required. The numerical module is separate from the forthcoming proxy-distance implementation. Current validated product checkpoint remains fdba7d4.

## Native boundary captured

The original 35-degree / speed-10 shot supplies a genuine positive TOI with unchanged max CCD substeps = 4. Native query fixtures are in tests/fixtures/active-ccd. Transform interpolation, force-predicted sphere center, and source two-interval scheduling now have direct native numerical comparisons. Actual full TOI differential and world integration are still pending.

A conservative order-independence certificate is being implemented because the previous bounded world does not maintain the complete native BVH topology. It requires the complete current fat-AABB/filter-qualified candidate set, exactly zero or one positive accepted cast at bound 1, and no other accepted cast at the reduced winning bound. It does not assume target order, ignore Failed interior fractions, or claim general BVH parity. Ambiguous cases reject before world commit.

Arithmetic stages reject non-finite intermediate calculations; extreme finite geometry that overflows the source normalization path is outside this bounded admission. It is not claimed to reproduce the source overflow fallback.

## Complete fixed target admission

The fixed-sphere component now derives the actual two qualifying casts from all sixteen immutable initial fixed targets and all six original ball collider channels. It computes the force-predicted center instead of receiving a native future endpoint. The original high-speed boundary gives exactly the native fraction, normal and point, and the source interval selector gives the native split. This is a component comparison from a current boundary state, not yet an initial-to-rest recurrence claim.

The source-equivalent point-sphere reduction retains the original body's quaternion untouched. Only the geometric query replaces the irrelevant moving-proxy orientation, since local COM and the sole proxy point are zero. Generic convex/cue exponential integration is not implemented by this reduction. Signed zero means full bitwise pose equivalence is not claimed. Post-clamp interpolation uses the actual owned solver start/end rotations.

Live integration must establish the immutable fixed roster and absent cue from its own journal and scene ownership. The standalone component's input-validation booleans are not independently proof of the entire scene. The normal contact graph and every previous numerical/activation invariant still apply.
