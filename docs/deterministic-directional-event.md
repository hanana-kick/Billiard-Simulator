# Supported arbitrary-direction segment to a real 3D impact

The experimental `supported-intrinsic-direction-v1` profile now accepts different horizontal directions for each of three/four moving spheres. Five resident GPU phases prepare the motion, select a globally earliest bounded contact interval, build the full-3D contact packet, solve it, and merge all response components. CPU mirrors every word. This is **one actual angled event**, not arbitrary-spin motion or a whole-shot evaluator.

## Invariant family and unchanged forces

For an exact horizontal unit vector e and up=(0,1,0), each sphere starts with v=V e and q=C(up×e), with q_normal=0. Its cloth slip is (V−C)e. Let F=mu*g_load and K=2.5*g_patch*rollingLength/R. While slip and C signs stay fixed:

- Vdot=−F sign(V−C).
- Cdot=2.5F sign(V−C)−K sign(C).

Rolling V=C uses Vdot=Cdot=−(2K/7)sign(V), only when its required static friction is available. At C=0, the friction torque drives C only by the amount exceeding the rolling-resistance cap; equality retains Cdot=0. At zero slip with insufficient static friction, the outgoing slip direction is derived from the rolling resistance, not forced to no-slip. These cases reuse the validated scalar mode law. A translational reversal V=0 alone does not end a sliding segment. A sphere with zero v but nonzero slip/spin can start translating.

The scheduler stops at the earliest scalar slip/C/rolling-stop boundary of **any** ball. No assumption is made that arbitrary noncollinear slip/spin has constant acceleration. Generic velocity/q inputs and nonzero normal-spin input are rejected by this packer rather than projected onto the family. The full v/q vectors are stored throughout the resulting event state.

## Encoding and approximation contract

Intrinsic V/C, material fields and world coefficients use Q24; time uses Q20. Initial directions are nonzero horizontal vectors of norm .5..2, packed once and normalized by the shared power-of-two-rescaled integer method. Relative to the exact normalized encoded direction, error is less than .9/Q in vector norm. Including initial direction-component rounding, a conservative direction error is below 4/Q relative to the original supplied direction. The rounded direction is **not claimed to be exactly unit**.

Intrinsic scalars remain authoritative. Full components use v=(mul(V,ex),0,mul(V,ez)) and q=(mul(C,ez),0,−mul(C,ex)), negating after multiplication. V=C therefore gives exactly zero encoded slip. Rolling acceleration/q-rate use the same linked construction; at advancement the encoded rolling constraint is retained by linking current q to current v. For each component coefficient, the direction/multiply error relative to the exact normalized encoded direction and the same encoded scalar S is at most `(0.9*abs(S)+0.5)/Q`. Scalar material arithmetic has the existing explicit half-quantum rounding per multiply/divide; no claim of exact real-valued material equations is inferred from bit equality.

Position is p0+v0*t+A*t²/2, evaluated from original anchors with directed integer products. Stored position differs from that encoded continuous polynomial by less than 2/Q per component, velocity by less than 1/Q, and unconstrained q by less than 1/Q. The linked rolling q uses the current encoded velocity instead of independently rounding its negative. Each segment is at most 65535 ticks (about 62.5 ms) and never extends beyond its scalar-regime horizon.

The contact bracket certifies the **encoded coefficient model**, not a universal TOI error bound against the original unquantized input. Near grazing or very small relative speed, input quantization can affect event time disproportionately; these cases remain pending when isolation cannot be proved. This is separate from exact CPU/GPU agreement.

## Event isolation and common clock

A left-first interval tree encloses every relative quadratic and every declared conservative static AABB/finite cloth footprint. Squared minimum distance proves a pair clear; squared maximum distance at a time proves overlap. Each relative term uses directed floor/ceil bounds. The identity `floor(x)-floor(y) in [floor(x-y),ceil(x-y)]` means the same enclosure covers independently floor-packed body positions; no unproved extra epsilon is substituted.

A unique candidate then needs strictly closing squared distance over the proposed bracket, a certified outside lower endpoint and inside upper endpoint. Bisection moves a bound only after that side is certified; an uncertain point is not treated as outside. The explicit maximum bracket width is 1..64 ticks (default 64, at most about 61 microseconds). The actual width is returned. All other pairs, static bounds and scalar boundaries must be excluded through the chosen upper time. Ambiguous/tied/grazing candidates are not MISS.

Every ball advances from its original anchor to the same upper time, including moving uninvolved balls. The actual upper-state centers are not projected. The contact overlap allowance is derived from the interval relative-speed L1 bound times bracket width, plus 16 position-rounding quanta, and is limited to R/8. This accounts for a numerical representative impact time, not an exact real timestamp. The full-3D solver receives real centers, radius/inertia, mass and separate cloth restitution.

After a successful impact, all actual selected v/q components are merged, their old coefficients are invalidated, and status 8 reports **resolved impact, next motion family pending**. No post-impact projection invents collinearity. Initial all-ball rest may be recognized, but there is no rule/scoring authority in this profile. Static bounds only reject/preempt; they are not fabricated rail planes or rail responses. Actual cushion point/time/admission modules remain separate until globally integrated.

## ABI and limits

Input is 96 words: header16 then four20-word body slots. Header: id/version/n/horizon/node budget/bracket budget/contact iterations/residual/cloth restitution. Body: p xyz, raw direction xz, V,C,R,mass, then reserved zeros. Strict host validation precedes upload; shared-memory inputs are rejected.

State is256 words: header64 then four48-word body slots. Body0..14 contain original p/v/q/A/qRate,15mode,16..23 direction/scalars/R/mass,24..32 current p/v/q,36..38 scalar boundary,39dirty coefficients. Header0id,1status,2reason,3count,4/5bracket,6paircode,7interval nodes,8current time,9version,10regime-limited horizon,11..14budgets/material,15no-outcome marker (not a score field),16candidate kind,17bracket width,19overlap allowance,20..22contact status/iterations/residual,23dirty mask. Unused words are zero/reserved.

Statuses: 2 clear observation horizon (not MISS),3initial supported rest,4unsupported,5incomplete,7pending regime/geometry/ambiguity,8resolved impact with continuation pending. Internal1 means certified contact ready. Returned state+64-word contact packet+128-word response total448 words per candidate; no intermediate readback or host physics. Work counters report interval-tree nodes only, not all arithmetic/refinement work.

Tests include actual angled contact against a moving target, another moving uninvolved ball, independent continuous-distance root, global-clock advancement, force/torque/power checks, rolling cancellation, yaw covariance, reversal, grazing, simultaneous contact, scalar horizon, work exhaustion, initial overlap, rest, input ownership and full native word comparison. Production defaults and raw-cue/full-general-motion qualification remain unchanged.

Checkpoint: complete sequential native manifest **69/69 passed in 58.00 s**. The directional batch compared **19,264 words across 43 candidates**: 35 arbitrary-azimuth/moving-target impacts resolved, and eight regime/budget/grazing/simultaneous/horizon/rest/initial-overlap cases stayed explicitly classified. The five-stage chain used **171,136 bytes** of application buffers, **2.82 s** compilation and a **12.03 ms** SwiftShader submission/readback sample. Zero intermediate readbacks or host physics were used. These are software-backend component diagnostics, not hardware speed or whole-shot accuracy claims. Receipt: `docs/evidence/deterministic-directional-event.json`.
