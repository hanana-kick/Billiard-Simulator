# Conditional supported motion: SMT2 kinetic certificate

Experimental version `0x534d5402` advances one sphere's general supported ODE with nonzero rolling resistance. SMT1 (`dd63b34`) is an earlier, more conservative certificate and is not silently reinterpreted. The tests start from an actual encoded 3D impact response, retaining noncollinear horizontal velocity and spin. This does **not** prove future support, exclude other bodies/hulls, advance the airborne partner, propagate uncertainty through an impulse, or publish a shot verdict. Defaults remain unchanged.

## Unchanged physical law

State `(px,pz,vx,vz,qx,qz,qy)` uses Q24 SI coordinates and surface angular velocity `q=R*omega`. Time is Q20 seconds, at most 65,535 ticks/request. Explicit positive encoded coefficients are `F=mu*g_load` and `K=2.5*g_patch*rollingLength/R`; separate nonnegative `Ks` controls normal spin. Their quantization relative to unencoded materials is not automatically included.

With `u=(vx+qz,vz-qx)`:

- `p'=v`, `v'=-F*u/|u|`;
- `qx'=2.5F*uz/|u|-K*qx/|qt|`;
- `qz'=-2.5F*ux/|u|-K*qz/|qt|`;
- `qy(t)=sign(qy0)*max(|qy0|-Ks*t,0)`.

The complete caller-budget tube must exclude `u=0` and `qt=0`. No tiny-spin threshold or zeroed material substitutes for a boundary. Conditional flat support and contact clearance remain separate physical admission obligations. Isotropic sphere attitude is unnecessary.

## Dense candidate and dependency-preserving defect

Two integer midpoint RHS evaluations define rounded increments `d0≈h*f(x0)` and `d1≈h*f(x0+floor(d0/2))`. They define the exact polynomial

`P(tau)=x0+d0*tau+(d1-d0)*tau²`, `0<=tau<=1`.

The midpoint-stage state is not `P(.5)`; residual evaluation uses the actual polynomial. Endpoint `x0+d1` is an exact integer addition. Coefficient rounding is included in the defect.

Four contiguous interval cells enclose the full curve. Position residual `Pp_tau'−h*Pv` is evaluated directly as a polynomial. For kinetic residual `R=P_tau'−h*f(P)`, evaluate an outward midpoint interval and add the cell radius times an interval bound on `R'`. This is a derivative theorem, not endpoint sampling.

For a planar quadratic vector `a=a0+a1*tau+a2*tau²`,

`cross(a,a')=cross(a0,a1)+2cross(a0,a2)*tau+cross(a1,a2)*tau²`.

All determinant coefficients are directed intervals. With `perpCCW(nx,nz)=(-nz,nx)`,

`(a/|a|)'=perpCCW(a/|a|)*cross(a,a')/|a|²`.

This CCW operation is opposite to the physical `up×` operation in X/Z coordinates. Independent derivative tests check the sign. Normalized component intervals use the exact monotonic extrema of `x/sqrt(x²+y²)`, preserving numerator/denominator dependency. They are intersected with `[-1,1]`. Arithmetic domain failure rejects/shortens the attempt, never changes the law.

## Persistent kinetic uncertainty: no Lipschitz amplification

Let `Jq=up×q`, `M=diag(I,(2/5)I)` on horizontal `(v,qt)`. The convex potential

`Psi=F*|v+Jq|+(2/5)*K*|qt|`

satisfies `f=-M^-1*gradient(Psi)`. Thus `(x-y)^T M (f(x)-f(y))<=0`: the constant-material supported kinetic flow is nonexpansive in this metric. The implementation retains smooth-mode guards rather than claiming an implemented subgradient transition.

Persist one joint radius `rho>=sqrt(|delta v|²+(2/5)|delta qt|²)`. If `D` is a **global supremum** of the normalized-time kinetic residual norm, then

- `rho1 <= rho0+D`;
- each position radius `ep1_i <= ep0_i+sup|Rp_i|+h*rho0+(h/2)*D`;
- each velocity error is at most `rho1`;
- each tangent-q error is at most `sqrt(5/2)*rho1`.

The half factor uses a global supremum, not a cell-averaged residual. The code first takes componentwise maxima over all cells, then an upper kinetic norm. Integer constants `10610844/Q` and `26527108/Q` round `sqrt(2/5)` and `sqrt(5/2)` upward. Square-root norms and every division round outward.

Initial independent coordinate boxes are converted to a containing joint radius **once**. Subsequent calls explicitly carry a joint-ball receipt. They do not convert derived component bounds back into a new metric radius. Initial-box inputs cannot override rho, and a joint receipt must match its derived velocity/q component bounds. Position radii remain per-axis; qy uncertainty propagates separately through its 1-Lipschitz clamp, including at most one quantum for endpoint rounding.

The same fixed caller component budgets apply to every segment. All resulting component radii must fit those budgets; this also closes the budget-tube bootstrap used for the derivative domain. There are no default accuracy budgets. Failed attempts halve time, never budgets. Maximum 16 attempts; near-zero, numeric, or work exhaustion is incomplete, never MISS. Endpoints outside the next-call +/-4 SI domain are refused.

**The nonexpansive proof applies to this continuous supported flow, not to collision maps.** A later representative impact cannot reset rho/position uncertainty. It needs a propagated response enclosure or must remain pending.

## Versioned 64-word contract

Input:

- 0 id, 1 version, 2 requested ticks, 3 max attempts;
- 4 F, 5 K, 6 Ks, 7 uncertainty kind (0 independent box; 1 joint kinetic ball);
- 8..14 state, 16..22 absolute component budgets;
- 24..30 incoming component radii, 31 persistent joint rho;
- remaining words zero.

Output:

- 0 id, 1 status (`1` certified conditional ODE prefix; `5` incomplete), 2 reason, 3 version;
- 4 attempts, 5 accepted/last attempted ticks, 6 point RHS calls, 7 interval RHS calls;
- 8 maximum normalized component radius (diagnostic only), 9 rho1, 10 global D;
- 11 minimum slip norm, 12 minimum tangent-spin norm, 13 interval normalized-derivative evaluations;
- 16..22 endpoint, 24..30 outgoing component radii;
- 32..37 d0, 40..45 quadratic increment coefficient;
- 48 unadvanced requested ticks, 49 conditional-ODE-only marker.

Incomplete rows contain no accepted endpoint. Reason2 denotes a tube intersecting a smooth-law boundary, not a certified exact event time. Reasons3/4 mean accuracy-budget/arithmetic-range failure. No status is a gameplay outcome.

## Bounded evidence, unchanged budgets

The actual angled-impact fixture uses position budgets2,000 quanta (0.1192mm), velocity/q budgets20,000 quanta (1.1921mm/s). All stages below use these SAME total budgets and carry incoming uncertainty:

| Certificate stage | Reached | Accepted segments | Point RHS | Interval RHS |
|---|---:|---:|---:|---:|
| SMT1 generic max-norm Lipschitz |17.236ms, then budget failure|7|134|536|
| Direct polynomial position defect only |17.236ms, then budget failure|7|134|536|
| Dependency-preserving normalized rectangles |30.204ms, then budget failure|9|154|616|
| Centered derivative defect + conservative H<=1/4 policy |100ms|24|192|768|
| SMT2 physical kinetic contraction |100ms|2|4|16|

The centered-defect stage additionally used768 interval normalized-derivative evaluations; SMT2 uses16. This is measured arithmetic-work reduction for the same fixture/target/budgets, not a hardware speed claim.

SMT2 admits65,535ticks then39,323ticks without halving. Final position radii are183/295quanta (10.9/17.6um), velocity radius2,501quanta (149um/s), tangent-q radius3,955quanta (236um/s). Independent binary64 RK4 refinement remains inside these bounds; endpoint position differences are about1.3/3.7um. Numerical reference containment is a regression test, not the proof.

A one-second request stops at154.819ms after13accepted segments: the budget tube reaches possible slip-zero. Representative slip is0.00247m/s and tangent spin0.1919m/s. Last accepted maximum normalized radius≈0.7976, so this is not an exhausted total error budget. Including failed boundary approach:240point RHS,960interval RHS,960normalized-derivative evaluations. No exact transition time or one-second trajectory is claimed.

## Resident implementation

Three phases: candidate, eight parallel domain/defect cells, acceptance/halving. Fixed bounded attempts are submitted upfront; accepted/exhausted rows skip later arithmetic, though dispatch bookkeeping remains. No VM, intermediate readback, or host physics. Ordinary immutable-for-call inputs are required; shared buffers are refused. Cancellation retains the original signal identity and suppresses publication.

SMT2 final targeted suite: 11/11 passed in 10.31 seconds; 41 rows / 2,624 output words exactly CPU/GPU, including a carried joint-radius row and negative cases. Initial syntax-only parser issue was fixed; final compilation 9.72s, shaders10,015/10,062/11,492bytes; application buffers62,976bytes,48dispatches. Software SwiftShader only. SMT1's original monolithic compile exceeded60s; phase separation avoided that expansion without loosening its certificate.

The next integration is all-body common-clock advancement and pair/actual-hull exclusion enlarged by these uncertainty tubes. An uninflated old quadratic query is not valid for this new motion. Near-zero regime transitions and uncertainty through contacts remain explicit next gates.
