# Experimental application cue compliance

## Validated lateral prefix

`experimental-cue-joint-compliance.js` ports the lateral shaft/head prefix of the unchanged `PhysicsLab.compliantTipContact(h)` method. It does not create a generic joint motor and does not substitute a different elastic model. The original order is retained: native point velocities, application lateral displacement/velocity projection, spring/damper impulse, head impulse, then equal/opposite shaft impulse at the head origin.

The arithmetic boundary is explicit. `sourceReference` retains the original JavaScript Number operations. Native `velocityAtPoint`, `applyImpulse` and `applyImpulseAtPoint` use pinned Rapier f32 operations and their zero-impulse guards. `f32Reference` and actual WGSL are separately labeled **f32 approximations**, not bit-equivalent replacements for the JS-double source. No production CPU physics is changed.

The original-method oracle calls `PhysicsLab.compliantTipContact` on actual native cue bodies. Four actual aim/elevation poses × six prepared states cover zero response, nonzero displacement/relative velocity, stiffness-only, damping-only, both coefficients zero and changed source coefficients. The sphere-object list is empty for this lateral-only fixture, so normal contact, tangent history and cue separation are outside this gate.

Current validation: **3/3 tests, no skips**, 24 fixtures. The exact JS-double/native-boundary reference agrees with the original method in impulses, resulting velocities and float bits. CPU-f32 and actual native Dawn/SwiftShader WGSL both have maximum original-method impulse error 9.094947017729282e-13 and velocity error 7.450580596923828e-9. There are 46 non-bit-identical compared components and zero signed-zero differences. Fixed component limits remain 2e-6 for impulse and 3e-6 for velocity; no tolerance was widened.

This stage applies one instantaneous impulse calculation using h=lab.dt/64, about 0.016276 ms at default settings. It advances **zero simulation time** by itself. The cue remains present and no sphere contact/lifecycle transition is tested. Whole approach→compression→separation must be checked after the source tip law and own-state world stepping are connected.

Native operation attribution: Rapier b716d375efc0201003f0cd9ef7168eee0b62c177, `dynamics/rigid_body.rs` and `dynamics/rigid_body_components.rs`; Apache-2.0 notice retained. Application-law source is `src/physics.js` and `src/math.js` in this repository.
