# Bounded supported slip → rolling/rest bridge

`deterministic-slip-bridge.mjs` consumes **SMT2 persistent joint-ball input**, without changing actual friction F or rolling resistance K. It is a conditional local supported-motion certificate plus canonical numerical endpoint; not a scene-clearance proof, impulse-uncertainty reset, or global event selector. Its descriptor must never be fed to the exact-polynomial selector without its inflation law.

## Same real law, comparison only

State order is `(px,pz,vx,vz,qx,qz,qy)` and `u=(vx+qz,vz−qx)`. Actual F,K and normal-spin drag S retain their incoming encoded values. The real supported inclusion is the same kinetic-gradient-flow law as SMT2, including nonzero K and the nonsmooth slip/rolling/rest boundary. Require **7F>2K**; no weakened coefficient, enlarged budget or silent K=0 real trajectory is admitted.

Only the *comparison* flow uses K=0:

- `tstop=2|u|/(7F)`.
- `vSTAR=v−2u/7`, `qSTAR=up×vSTAR=(vSTARz,−vSTARx)`.
- Before reference stop: `pREF(t)=p0+v*t−F*(u/|u|)*t²/2`.
- After reference stop: `pREF(t)=p0+vSTAR*t+u*tstop/7`.
- u=0 uses the second expression with tstop=0, avoiding division by zero.

This comparison is not used to erase nonzero rolling resistance. In the joint kinetic norm `sqrt(|δv|²+(2/5)|δqt|²)`, the actual K perturbation has norm at most `sqrt(2/5)*K`. Nonexpansiveness of the same-F supported inclusion gives, for every time in the bridge,

`rho(t) <= rho0 + sqrt(2/5)*K*t`,

`positionError_i(t) <= incomingPositionError_i + t*rho0 + (sqrt(2/5)*K/2)*t²`.

All operations round outward. The actual all-state slip-stop upper bound includes incoming kinetic uncertainty:

`ceilTicks(2*(|u|upper + ceil(sqrt(7/2)*rho0))/(7F−2K))`.

The requested endpoint must be at or beyond this bound. A shorter caller horizon returns pending; it does not jump beyond the horizon. The strict inequality ensures the supported inclusion can remain rolling or rest after slip reaches zero. Reference velocity may be zero: the code does not invent a nonzero tangent spin/direction.

## Packing and persistent receipts

Use exact rational numerator `7v−2u` for vSTAR geometry. Endpoint velocity subtracts `roundNearest(2u/7)`; qSTAR is linked **from those same packed velocity words**, not independently rounded. Since each velocity packing error is at most3/7 quantum, linked v/q joint error is less than1 quantum (zero if both rational components are integral). This is added to endpoint rho, never hidden.

Reference stop times use exact floor/ceil integer norm bounds and directed division. Endpoint position is the midpoint of an outward interval for the exact rational post-stop formula; its per-axis packing error is added separately. Endpoint radii are:

- rho1 = rho0 + ceil(sqrt(2/5)*K*h) + jointPacking;
- evx=evz=rho1; eqx=eqz=ceil(sqrt(5/2)*rho1);
- epx/epz = incoming per-axis position radius + ceil(h*rho0) + ceil(sqrt(2/5)*K*h²/2) + corresponding position packing.

qy uses its separate 1-Lipschitz signed clamp under the unchanged S, and carries its incoming error plus at most1 quantum of packing (zero extra for S=0). A nominal zero clamp does not reset incoming uncertainty. Tangent-reference mode0 means zero center/tangent reference velocity; qy can still be nonzero. The separate nominal-full-rest flag additionally checks qy. Neither flag declares every enclosed physical state fully at rest.

All seven **existing caller budgets** must contain the endpoint radii. No budget is widened. A failed budget remains pending with diagnostics. Joint receipts are not converted back into independent boxes and renormalized. `bridgeInputFromSmoothReceipts` copies a matching accepted SMT2 endpoint/radius receipt into the next input and preserves material/budget words; it refuses failed/mismatched receipts and any decrease in persistent kinetic, position or normal-spin uncertainty. This structural check does not authenticate arbitrary caller-supplied proof bytes: a trusted resident producer must keep each receipt coupled to its originating anchor/material buffers.

## Piecewise geometry descriptor

The128-word output includes the complete immutable64-word source input, initial u, norm enclosure, exact vSTAR numerators, reference stop-time enclosure and outward error-growth coefficient. Together these define the whole comparison curve, not just an endpoint chord.

`slipBridgePositionBoundsCPU(packet,lo,hi)` is a CPU reference oracle for downstream GPU geometry composition. It returns both reference intervals and **already inflated** intervals using the time-dependent position bound evaluated at hi. Before stop it bounds the normalized quadratic; after stop it bounds the exact rational linear branch; across uncertain stop time it unions the two branch enclosures. It does not sample the trajectory. This helper is not used to do per-candidate host collision physics in the GPU execution path. The bridge GPU emits the same complete descriptor; downstream resident hull/pair/static queries must implement/use its inflation, or refuse. There is no automatic handoff to the uninflated polynomial selector.

## ABI and guards

Input: existing SMT2/version `0x534d5402`,64 words, explicitly kind7=1 joint-kinetic-ball. State8..14, budgets16..22, incoming component radii24..30, persistent rho31. Existing SMT2 range checks apply:1..128 rows, h1..65535, |state|≤4, 0<F≤16,0<K≤4,0≤S≤4 (Q24), component budgets≤1/16 and matching incoming receipt. Bridge accepts no initial independent-box reset. Public packing checks row count before allocation. Shared buffers reject; offset views work and run snapshots before async upload.

Output128 words:

- 0ID,1status (1local certificate accepted,4domain/arithmetic rejection,5pending),2reason (1strict F/K,2horizon too short,3fixed budget,4numeric/range),3bridge version`0x53425201`,4h.
- 5all-state stop-upper ticks,6/7reference stop floor/ceil ticks,8incoming rho,9endpoint rho,10K-growth,11joint packing,12ceil-Q24 sqrt(2/5)*K,13normalized budget use (saturated to Q+1 on failure),14nominal tangent reference mode0/3,15all-state-slip-stop premise reached (diagnostic; only status1 usable).
- 16..22endpoint state;24..30endpoint component radii.
- 32/33initial u,34/35norm floor/ceil,36F,37K,38S.
- 40/41exact vSTAR numerator (denominator7),42/43position packing error,44..47endpoint reference position intervals.
- 48descriptor present,49nominalReferenceRest flag (not actual rest),50/51global/event authority always0,52restCertified always0; remaining words through63 zero.
- 64..127complete source SMT2 input.

One bounded algebraic dispatch, no iterative trajectory stepping and no intermediate readback. Same caller budgets and ≤128 rows; maximum65,536 output/readback bytes. Very small denominators causing integer quotient overflow reject rather than fabricate an endpoint.

## Tests and next boundary

`tests/deterministic-slip-bridge.mjs` follows the actual post-impact SMT2 fixture to162,339 ticks, where its smooth guard stops. With the *same budgets*, this bridge advances581 ticks (all-state bound580; reference stop377..378), rho10088→12200 and component radii `[528,706,12200,12200,19290,19290,14]`, with tangent-q budgets still20000. Independent high-accuracy nonzero-K integration through slip stop and analytic real-K rolling agrees, including eight extreme joint-radius perturbations. Exact qSTAR linkage, nominal rest, normal-spin clamp, strict coefficient failures, too-short horizon, budget refusal, receipt ownership and whole-prefix inflated geometry are checked.

After this checkpoint, analytic rolling-to-rest can consume the supported rolling/rest family and persistent receipt. Global scene chronology and cross-body whole-prefix clearance remain separate requirements; coefficients and errors may not be reset at the bridge boundary.

Checkpoint receipt: native **4/4 tests pass**,10 cases including strict F/K failure, horizon/budget failure, normal-spin clamp and zero nominal reference with positive rho; **1,280 words exactly match CPU/GPU**,0.279s compile,0.577s suite. One resident dispatch, zero intermediate readbacks. Independent reviewer checked linked packing, rational position geometry, error units and strict nominal-rest/no-rest-authority separation. Shared-backed geometry descriptors reject and are snapshotted before coefficient reads.
