# Bounded full-3D equal-sphere contact component

This experimental GPU-canonical component retains all three components of position, linear velocity and angular surface velocity `q = R omega`. It is not connected to trajectory recurrence or production defaults. The old planar solver is unchanged.

## Physics

Each sphere has equal mass, radius and solid-sphere inertia `I = 2 m R² / 5`. Pair contact uses one encoded common midpoint; both actual arms are measured from the original centers, without projecting positions. Optional cloth contacts use the midpoint between the bottom sphere feature and the flat cloth feature. Active cloth contacts require the actual encoded center to touch/penetrate within the explicit overlap budget; omitted cloth contacts require a positive gap. A caller flag alone cannot invent support.

For direction d and normalized arm s=r/R, contact Jacobians contain linear ±d and angular ±(s×d). Applying normalized impulse lambda=J/m changes v by its linear Jacobian times lambda and q by 2.5 times its angular Jacobian times lambda. The full effective matrix `J D J^T`, with `D=diag(1,1,1,2.5,2.5,2.5)` per sphere, retains normal/tangent and tangent/tangent coupling. No constant Kt=7 assumption is made.

Each contact has an accumulated unilateral normal impulse and **one circular two-dimensional Coulomb tangent cone**, not independent tangent clamps. Fixed-order normal updates use separate pair/cloth restitution targets from pre-impact normal velocity. Tangent projected-gradient updates use `L=max(K11,K22)+abs(K12)`, a symmetric tangent-block spectral upper bound. Projection clamps the total accumulated tangent vector; applying its difference retracts earlier friction if the normal cone shrinks. All constraints are revisited until the projected fixed-point/normal velocity residual meets the declared budget or the iteration budget expires. Positive vertical velocities and all sidespin components are retained.

No finite-time rolling/spin resistance is injected into this instantaneous impulse solve. No sphere attitude is needed for uniform isotropic spheres.

## Arithmetic and domain

Q24 state/material/normalized impulses, two-u32 wide products, bounded u64/u32 division and integer square root. No floating point executes in WGSL. CPU mirrors the same arithmetic, including half-away magnitude rounding, deterministic smallest-component tangent-axis selection, ceil norm, downward cone scaling and final component truncation. The ceil norm plus downward projection proves the **encoded coefficient disk** stays inside floor(mu*Jn).

The direction basis itself is quantized; the coefficient disk is not claimed to be an exact real Cartesian disk. The private helper rejects zero input or a component magnitude >=2^30 (all current geometry/cross callers lie below that limit). Before normalizing, `unit()` scales its integer vector by an exact power of two until its largest component lies in `[2^29,2^30)`. Squared-component sums remain below `3*2^60 < 2^62`, and the integer norm fits signed i32. This avoids the old distance-dependent ceil-norm error at minimum sphere radius. No floating-point normalization or software float is introduced.

Let Q=2^24. The rescaled norm is at least 32Q, so ceil-norm relative error is at most `1/(32Q)`. Nearest-rounded components add Euclidean error at most `sqrt(3)/(2Q)`. Thus each `unit()` result differs from the exact normalized input by less than `.9/Q`, and its length error obeys the same bound.

The first tangent uses a coordinate-axis cross product, which is exact in Q24; its dot product with the encoded normal is below `1/Q`. For the second tangent, rounding the cross product contributes at most `sqrt(3)/Q` in vector norm. The first two axes have lengths within `.9/Q` of one and dot product below `1/Q`, so that raw cross has length greater than `1-4/Q`. Combining its normalization and component-rounding errors gives normal/second-tangent and first/second-tangent dot products below `3/Q`. The tangent Gram matrix therefore has largest eigenvalue at most `1+5/Q`, yielding Cartesian tangent magnitude at most `coefficientNorm*(1+3/Q)`. Tangent leakage along the encoded normal is below `4/Q*coefficientNorm`; against the exact geometric normal it is below `5/Q*coefficientNorm`. These friction bounds describe the tangent-basis contribution T, not the entire impulse. For the full Cartesian impulse J=Jn*nEncoded+T, its tangential component relative to the exact geometric normal is bounded by `mu*Jn*(1+3/Q)+.9*Jn/Q`, while its geometric normal component is at least `Jn*(1-.9/Q)-5*mu*Jn/Q`. Even frictionless response therefore has an O(Jn/Q) direction approximation. These are bounds for this bounded arithmetic/axis-construction path, not a global contact-solver or trajectory error certificate. Independent minimum-radius/high-friction saturated tests check these stronger distance-independent inequalities; the former empirical factor-16 distance allowance is no longer used.

The binary64 oracle independently normalizes geometry and constructs Jacobians; it does not call production integer helpers. Solver residual/rounding and physical validation remain separate from CPU/GPU bit identity.

Input ranges: radius 4096..Q quanta, positive mass <=4, positions/floor height within ±8, each v/q component within ±4, overlap budget <=R/8, combined restitution/friction in [0,1], 1..256 iterations and residual budget 16..1024 velocity quanta. Geometry checks use a strict squared-distance equality check at the ceil-norm lower boundary, so fractional excessive penetration cannot hide behind ceil rounding. Input scaling is checked before narrowing; numeric overflow or unsupported geometry returns status 4. Iteration exhaustion returns status 5, never MISS. Status 1 means numerical convergence only, not whole-shot physical acceptance. Norm/impulse/rate guards can reject otherwise physical high-speed cases outside this bounded domain.

## ABI

Input: 64 u32 words, signed fields stored as i32 bits.
- 0 id, 1 version `0x33444301`, 2 max iterations, 3 residual budget.
- 4 radius, 5 mass, 6 cloth top, 7 overlap budget.
- 8 pair restitution, 9 pair friction, 10 cloth restitution, 11 cloth friction, 12 cloth mask.
- 13..15 zero; 16..18 pA, 19..21 pB, 22..24 vA, 25..27 qA, 28..30 vB, 31..33 qB; 34..63 zero.

Output: 128 words.
- 0 id, 1 status, 2 reason, 3 iterations, 4 residual, 5 floor mask, 6 version, 7 no-score sentinel.
- 8..19 solved vA/qA/vB/qB; 20..28 accumulated pair/floorA/floorB normal/tangent1/tangent2 impulses.
- 32..40 encoded pair normal/tangent1/tangent2; 41..49 real common pair/floorA/floorB contact points.
- 50..52 division/multiplication/norm counts; 54..62 diagonal effective masses; 63..65 restitution targets; 66..68 tangent iteration bounds. Other words zero.

The host validates complete bounded raw rows before CPU evaluation or GPU upload. This low-level contact component presumes an independently prepared isolated contact set; it does not discover all scene contacts or certify an event-time bracket.

## Tests and limitations

Independent tests construct full 3D Jacobians and a binary64 contact oracle, check linear impulse balance, angular momentum including actual external cloth torques, tested energy dissipation, elastic frictionless closed form, all spin components, circular cones, yaw covariance, excessive penetration, integer aliasing and iteration exhaustion. These checks validate the canonical logic, not old Rapier outputs. A converged Newton restitution/contact solve is not a universal energy theorem for every simultaneous contact set; runtime shot acceptance is not granted by this component.

Actual 3D event prediction, general motion recomputation, airborne pair recurrence, cushions and raw cue contact remain separate integration work. Native SwiftShader evidence is recorded in `docs/evidence/deterministic-contact-3d.json`; no hardware speed claim.

Checkpoint: complete deterministic native manifest **45/45 passed in 25.32 s**. The new 3D batch compared **8,960 words across 70 candidates**, including cross-workgroup/tail dispatch, input subarray offset, incomplete solve and unsupported geometry. Shader size **8,407 bytes**, compilation **1.24 s**, application buffers **89,600 bytes**, SwiftShader submission/readback **64.31 ms**. These measurements are component diagnostics, not a whole-shot performance claim.

### Distance-independent normalization checkpoint

After power-of-two rescaling, the full native manifest passed **46/46 in 26.30 s**, followed by focused **5/5 native** tests including representative input-alias/INT_MIN guards. The additional full-impulse Cartesian inequality was also checked in the final CPU test run. The 70-candidate native batch still compares **8,960 words exactly**, now including minimum-radius near-touch oblique saturated friction. Updated shader: **8,591 bytes**; unchanged application buffers: **89,600 bytes**. Latest focused compile: **1.31 s**, SwiftShader submission/readback: **78.96 ms** (single sample, not a speed comparison). Receipt: `docs/evidence/deterministic-contact-3d-normalized.json`.
