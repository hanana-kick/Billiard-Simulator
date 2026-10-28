# Short supported tangential-spin neighborhood bridge

This opt-in bridge crosses a **qt-near-zero neighborhood while slip remains positive**. It is not the existing full slip-stop bridge, not an exact zero-event finder, and never snaps qt to zero or projects onto rolling. Original nonzero F/K/S remain the real force law. The exact K=0 solution is used only as a comparison with a charged perturbation bound.

## Same-law local proof

Let `u=(vx+qz,vz-qx)`, `q=(qx,qz)`, and `J(x,z)=(z,-x)`. While the reference slip remains positive, its exact comparison is

- `vREF=v0-F*uHat*t`
- `qREF=q0+2.5F*J(uHat)*t`
- `pREF=p0+v0*t-0.5F*uHat*t²`.

No floating-point unit vector is made authoritative. Directed wide integer division and outward integer square roots enclose the exact reference coefficients. Velocity and tangent-spin endpoint intervals are rounded to deterministic midpoints. The **actual joint packing vector** is charged by an outward bound on `sqrt(|dv|²+0.4|dq|²)`; the special one-quantum linked rolling projection proof is not reused. Position packing is charged independently.

For the original supported subgradient law, comparison errors are bounded by
`rho(t) ≤ rho0 + sqrt(2/5)*K*t` and
`ep(t) ≤ ep0 + t*rho0 + 0.5*sqrt(2/5)*K*t²`.
Incoming joint radius and per-axis position errors remain intact. Normal spin qy uses its original separate signed S-clamp and retained error; it is not set to zero because qt is small.

The bridge requires `5F-2K>0` and checks the strict entire-prefix bound
`|u0|Lower-ceil(sqrt(7/2)*rho0)-ceil((7F+2K)*h/(2T)) > slipGuard`.
This also keeps the K=0 reference before its own slip stop. Endpoint tangential-spin clearance is proved with
`floor((5F-2K)*h/(2T))-|q0|Upper-ceil(sqrt(5/2)*rho0) > qtGuard`.
All quantities are in Q24/Q20 units, with outward rounding.

In addition, the chosen endpoint's qt and slip boxes expanded by the **original full SMT2 budget radii** must exclude zero by their explicit guards. Checking only incoming rho would not establish the SMT2 anchor domain. This establishes the next anchor's domain, not that every future smooth step succeeds: the normal SMT2 proposal/certificate must still be run.

Every original position/v/q/qy budget is enforced unchanged. Coefficient, duration, positive-slip, endpoint-box, budget and numeric failures remain pending/rejected. No budget is increased and no carried radius is reset.

## Duration and common clock

Input is the existing owned64-word SMT2 row with explicit joint-ball kind1. Duration is at most65,535 Q20 ticks; maxAttempts1..16 is the caller's existing bound. Up to128 rows are admitted; shared mutable buffers are rejected. The shared canonical v8/q16 norm and p4 admission remain in force.

`durationMode:'search'` (default) treats row2 as a cap. A conservative first duration is
`ceil(2T*(|q0|Upper+ceil(sqrt(5/2)*rho0)+qtGuard)/(5F-2K))+1`.
If an endpoint box is still unresolved, candidate duration doubles, clamped to the cap, at most maxAttempts. Every candidate is independently evaluated from the **same original anchor**; these are not chained timesteps. No duplicate retry at the cap occurs. Other failures stop the bounded search.

`durationMode:'fixed'` evaluates exactly row2 once, with every same proof and budget guard. A common-clock caller may probe multiple bodies, select one common h, and re-evaluate the original rows in fixed mode. It must not use the proposed endpoint as a new anchor and then add h again. All other bodies and all competing geometry must be checked over that common prefix before any state is committed.

## Geometry and authority

Output contains interval quadratic acceleration coefficients and the unchanged source row. `qtBridgePositionBoundsCPU(packet,lo,hi)` encloses the whole reference interval plus its growing incoming/real-K error. The accepted output also directly contains the inflated whole-prefix XZ box. Coefficient uncertainty is retained; do not pass a chosen polynomial to an exact-polynomial selector without its enclosure.

This is a conditional local supported-flow certificate, not collision clearance or a global impulse-error proof. The result reports `globalChronology:false`, `zeroEvent:false`, `restCertified:false`. Only status1/descriptor-valid1 authorizes reading the proposed SLIDING state. A pending packet's zero default mode is not REST.

## ABI and resident execution

Exports: `packQtBridge`, `validateQtBridgeRows`, `packQtBridgeConfig`, `runQtBridgeCPU`, `createQtBridgeGPU`, `qtBridgePositionBoundsCPU`, `QT_BRIDGE_PREPARE_WGSL`, `QT_BRIDGE_TRIAL_WGSL`.

Config4: `[version,qtGuard,slipGuard,durationMode(0search/1fixed)]`, default guards64 quanta, explicit range1..65,536. Options snapshot synchronously before awaits.

Output128/body:
- 0ID,1status(1accepted/5pending/4numeric),2reason,3version
- 4accepted or last attempted h,5required first duration,6attempt count,7SLIDING1 only on acceptance
- 8incomingrho,9endpoint rho,10real-K increment,11kinetic packing radius,12outward sqrt(.4)K,13maximum budget ratio
- 14whole-prefix slip lower,15physical endpoint qt lower
- 16..22 `[px,pz,vx,vz,qx,qz,qy]`,24..30 component radii
- 32..35 XZ acceleration intervals;36..39 tangent-q derivative intervals
- 40..43 inflated whole-prefix XZ box;44/45 full-budget qt/slip anchor-box lower norms
- 46..51 component endpoint packing bounds;52descriptor-valid;53/54authority0;55duration mode
- 56/57initial slip,58/59its norm bounds,60initial qt norm upper,61/62guards,63requested cap
- 64..127original SMT2 row unchanged.

Reasons:1drive coefficient,2insufficient cap,3positive slip unavailable,4endpoint box/attempt exhaustion,5unchanged budget,6numeric/domain.

GPU phases bind0rows64/body,1config4,2output128/body,3scratch8/body. Workgroup1, dispatch body count. Prepare caches invariant coefficients and sets scratch readiness. Each trial dispatch evaluates one candidate and gates completed rows. Search dispatches at most one preparation plus16 trials; fixed mode uses two dispatches. Zero intermediate readbacks/per-candidate host physics. Private inactive version0 rows disable scratch readiness without overwriting an old output; public validation still rejects them. A consumer must gate old receipt authority by its active roster generation.

The first monolithic adaptive shader hit the unchanged1200MiB compiler budget after51.7s and was stopped/reaped; it produced no parity receipt. Splitting preparation from one trial changed neither physical formulas nor caller work caps.

## Actual fixture and tests

The genuine-hit continuation's body3 at absolute562,312 ticks has slip≈0.3071269 and qt≈0.00149064. The old full slip-stop bridge requested49,484 ticks. This bridge accepts **692 ticks in two trials**, keeps full qt/SLIDING, and retains rho2,517 including packing radius3. Radii are `[2,2,2517,2517,3980,3980,1]` under the original `[2000,2000,20000,20000,20000,20000,20000]` budgets. The unchanged SMT2 solver then accepts32,767 ticks from the resulting anchor.

Tests include independent real-K RK4 refinement, an exact collinear qt-zero-crossing solution, a nonzero near miss, real qt=0, normal spin, whole-prefix bounds, eight incoming joint-ball axis perturbations, strict coefficient/slip/time/work/budget refusal, fixed common-time reevaluation, offsets/shared-buffer guards, and immutable async config/row ownership. There is no claim that a true zero event occurred in the accepted neighborhood.

## Verification receipt (2026-10-27)

Final bounded native suite: **6/6 passed, no skips; 12 cases and 1,536 output words exactly equal between CPU and GPU**. Pipeline creation took1.956s; the test suite took2.338s. The run used exclusive `/tmp/billiard-native-gpu.lock`, the PPid-ancestry watchdog, and unchanged90s/1200MiB limits. The preceding same-shader split run measured318.44MiB sampled aggregate RSS and279.93MiB maximum child RSS; these are sampled process measurements, not device-memory guarantees. The final run additionally includes whole-prefix/perturbed-input checks and async config snapshot mutation. Independent CPU review found no remaining proof or ownership blocker in this scoped bridge.

No application runtime defaults changed. This checkpoint supplies a proposed short sliding segment and its local enclosure; whole-world chronology and recurring execution remain the consumer's responsibility.
