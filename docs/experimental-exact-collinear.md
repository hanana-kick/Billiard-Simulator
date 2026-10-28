# Design: exact axis-aligned supported event advance (CPU research)

Status: design/CPU proof only; a new integration policy, not the qualified default or GPU implementation. Earlier K=0 qt-bridge selection is rejected for the user's no-accuracy-loss objective: independent contact timing worsened despite fewer steps.

## Admission and model contract

Start with the deliberately narrower x-only or z-only subset, not arbitrary 2D collinearity. The transverse velocity and transverse tangential spin must be **exactly zero**, not below a threshold. Normal spin remains independent. Input uses the existing owned Q24 smooth-row ABI, Q20 integer horizon 1..65535, exact canonical anchors (zero incoming positional/kinetic error and joint radius), F>0, K>0, S>=0 and strict 5F>2K. Initial slip must be nonzero. This is not a global physical enclosure/reset claim.

For the moving axis let v be velocity, and w=qz for x motion or w=−qx for z motion. Then u=v+w, dv/dt=−F sign(u), dw/dt=−(5F/2) sign(u)−K sign(w). At exact w=0, strict 5F>2K makes departure sign(w)=−sign(u); no near-zero or epsilon rule is permitted.

Use reduced BigInt rational arithmetic for time, position, v and w. Compute the earliest strictly positive qt-zero or slip-zero time. **Slip may precede qt**, so never assume qt is first. Preserve the fractional crossing time, integrate to it, change only the analytically reached regime, and integrate the residual time. At slip=0 use rolling dv/dt=−(2K/7) sign(v), w=−v. At exact v=0 enter REST. Simultaneous qt/slip zero is REST. K=0 is mathematically well-defined but excluded by the existing smooth-row ABI; this initial experiment does not broaden that ABI. Normal spin decays independently to its exact zero event.

A bounded interval has at most one qt crossing, one slip transition, and one rolling stop. Fixed integer h is the output clock delta; fractional internal events are not rounded up into whole-tick physical motion. Position extrema include any within-phase velocity zero, not merely endpoints.

## Output numeric contract

Round final p/v/q once using nearest, ties to even (sign symmetric). Preserve rolling w=−v exactly after rounding. Return outward floor/ceiling swept position bounds and an error of 0 or 1 Q24 quantum enclosing each rounded exact-rational coordinate. Reject an endpoint if rounding would turn a nonzero regime-defining slip, tangential spin or rolling speed into zero; no premature regime transition/snap. Report exact event rational times separately from integer world time.

CPU BigInt is a proof vehicle, **not** a GPU implementation or throughput benchmark. GPU integer-width bounds and equivalent division/rounding need independent qualification before use there.

## World integration boundary

Initially allow one admitted supported moving ball and otherwise REST bodies, preserving every body identity, radius, mass and common clock. Other REST bodies may have independent normal spin. Build a swept-box descriptor from exact extrema, retain the original all-object tube-clear checker against all spheres/table/static boxes, and commit only a certified clear interval. If any admission or clearance check fails, retain the original route; no event-resolver or journal mutation before acceptance. Do not silently handle rolling/airborne/contact sources or suppress earlier collisions.

Full-request policy must be named separately and use unchanged maxWorldSteps<=128/budgets. Fewer accepted steps alone is not fewer actual operations. Assess both endpoint and subsequent contact errors using the independent 60/90-digit equations/geometry reference, separately from future CPU/GPU parity. Never use Rapier as the accuracy oracle. No default/GPU change or publication until independently qualified.

## Required CPU tests

- x/z direction/sign symmetry; exact-zero and one-quantum transverse admission distinction.
- qt before slip, slip before qt, simultaneous zero, excluded K=0 ABI, normal-spin zero.
- Fractional crossing plus residual, horizons before/at/after each event; endpoint derivative/mode consistency.
- Directed bounds contain analytic extrema; rounding receipts contain high-precision reference.
- No tolerance or budget increase, no rounding-induced regime change; input immutability.
- Full-roster/common-clock clearance rejects an intervening sphere/static boundary.
- Same-source affected fixtures and contact-time comparison against 60/90-digit independent reference; unresolved or worse accuracy blocks promotion.

## Prototype evidence (not yet qualified/promoted)

The CPU proof uses reduced BigInt rationals with a 1,024-bit intermediate guard. The original smooth-row ABI requires K>0; zero K remains excluded. Rolling static-friction feasibility follows from enforcing w=−v: required friction magnitude is 2K/7, below F under the stricter admitted 5F>2K condition.

Mode 0 means stationary translation/tangential spin, not necessarily full REST while normal spin remains. Normal-spin zero is recorded independently; `nominalRest` requires all p-derivative/tangential/normal-spin motion to have stopped. Exact motion-stop and full-REST events are separately named. Outward swept bounds explicitly include the rounded endpoint. Rounding-induced slip/qt/rolling/normal-spin zero is rejected rather than treated as a physical event.

Five descriptor tests and two world tests passed in serialized processes; the world test covers six complete requests. Exact event boundaries at ticks 2/3/18/242 pass, and tick 241 rejects rounding-induced false stop. Typecheck passed. Both 60- and 90-digit independent references reproduce the contact numbers below and all six descriptor rounding bounds. Default/GPU sources are unchanged.

- Speed2/x0: default REST99 steps, exact-axis policy REST67 steps, six exact advances. Same ordered two cushion identities.
- Speed4/x0: default budget128, exact-axis policy three-cushion REST80 steps, sixteen exact advances.
- Low-speed controls and both noncollinear x1.3 controls retain all state/dense/journal/aux words; noncollinear budget outcomes stay unresolved.
- From the verified FIRST shared divergence at tick809413 (not the later earlier-qt snapshot), independent60-digit same-equation finite-triangle contact reference is4066562.219232. Default contact4066363 has error−199.219232 ticks; exact-axis contact4066564 has error+1.780768 ticks. This is promising fixture-specific evidence, not a universal no-accuracy-loss theorem.
- Six actual exact-axis descriptors agree with independently evaluated60-digit piecewise equations; rounded coordinate error is at most0.5 Q24 quantum and within returned receipts.

Reproducibility scripts: `export-exact-collinear-reference.mjs OUTPUT_JSON`, then `assess-exact-collinear-segments.py OUTPUT_JSON 60` and `assess-exact-collinear-contact.py OUTPUT_JSON 60` (optional research dependency mpmath). The same scripts were also rerun with 90 digits. Descriptor errors, contact errors, native parity, total operations and wall time are separate quantities; no GPU speedup claim is made.

Admission remains strict: exact cloth height and zero vertical velocity, positive radius/mass, one moving supported ball, stationary other-body translation/tangential spin, owned buffers, no carried-error source reinterpretation, and no rounding-induced regime zeros. Normal spin remains independent. Diagnostic overflow rejects the speculative advance and takes the unchanged route. No native GPU parity, total-operation reduction, final-rest position accuracy theorem, app integration, or release qualification is claimed for this new policy.

Independent source-only review found no scoped blocker in event signs/ties, normal-spin handling, fractional residual time, ties-even/false-zero guards, swept extrema, or original all-object clearance and fallback. This review did not independently rerun tests during the native quiet window. Owner evidence: descriptor tests 5 passed; world tests 2 passed (six complete fixtures plus obstruction/cap negatives); default world regression 6 passed/2 native skipped; canonical binding regression 11 passed/4 native skipped; typecheck passed. Both 60/90-digit research assessments completed. No publication or default promotion.
