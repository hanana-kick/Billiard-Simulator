# Isolated landing response and one subsequent query

Opt-in continuation of the q-v2 resident chain; default application behavior
is unchanged. `createQContinuationGPU(device, {landing:true})` and
`runQLandingCPU` require an explicit `landing` option containing
`clothRestitution` and `maxCorrectionQuanta`. The separate landing context tag
is `0x514c0101`; pair restitution is never reused as cloth restitution.

## Numerical event policy

Only an unambiguous descending landing bracket from the preceding private
query is eligible. The current scope has one airborne sphere and supported
others. The query excludes intervening scalar boundaries and other geometry.
At landing, a second interval enclosure checks every pair (including the
previously resolved pair), all static boxes and the finite cloth footprint
through the bracket and through the proposed geometry correction.

All spheres are evaluated from their original post-impact anchors at the same
upper bracket tick. The landing sphere alone is placed at the actual encoded
cloth top plus radius. This is **a declared root-geometry approximation**,
not a claim that the upper tick is the exact real root. No unrelated state is
projected. The correction must be upward, within a derived ballistic bound,
and within the caller's explicit budget; otherwise the result is unsupported.

With bracket width dt <= 2^-20 seconds, downward lower-end speed vLower,
and gravity g, the correction bound is
`ceil(|vLower|*dt) + ceil(g*dt²/2) + 2 position quanta`.
The two quanta cover polynomial endpoint rounding. The impact time error is
at most one time tick relative to the encoded root. The potential-energy
change from conditioning the contact geometry is at most `m*g*abs(deltaY)`.
The normal impulse timing discrepancy from gravity is at most
`m*(1+e)*g*dt`, plus the declared fixed-point impulse rounding. Tangential
impulse differs according to the corresponding Coulomb clamp and slip error;
this checkpoint does not assert a certified global trajectory error bound.

The fixture has a 1-quantum correction (59.6 nm), with a derived 4-quantum
bound. At mass .21 kg and g=10, this correction changes potential energy by
about 1.25e-7 J; the conservative 4-quantum bound is about 5.01e-7 J.

## Floor response, without lost spin or artificial flattening

At the conditioned floor contact, the actual arm is `(0,-R,0)` and the solid
sphere inertia is `(2/5)mR²`. For normalized impulses J/m:

- normal impulse = `-(1+clothRestitution)*vyBefore`
- slip = `vx+qz`
- tangent impulse = `clamp(-slip/3.5, -mu*normal, +mu*normal)`
- vx += tangent; vy += normal; qz += 2.5*tangent.

The total friction cone limit uses named floorQ24 material multiplication and is rounded downward; time-product helpers only admit shifts20/41 and fail other shifts. Division and other impulse
products use the shared integer rounding contract. No rolling torque is added
as an arbitrary whole-frame instantaneous impulse. Subsequent supported
motion retains the verified rolling-resistance law.

Positive normal impact impulse legitimately coexists with positive rebound
velocity. The validated isolated-floor response establishes this mode directly:
any positive encoded rebound remains flight, including one velocity quantum
below the earlier contact residual tolerance. Zero rebound is supported.
There is no tiny-spin/velocity flattening rule. Unrepresentable sub-quantum
restitution effects remain part of the explicitly quantized program model.

The state retains a landing ledger in header words 18–31: context version,
original absolute lower/upper ticks, body, correction and bound, normal and
tangent impulses, pre/post vertical velocity, pre/post slip, prior query node
count, and completed-landing count. Positive impulses are not erased to pass
mode guards. Current query nodes remain in word 11.

All bodies are rebased together at this numerical event state, with freshly
computed motion coefficients. This is one explicit quantized rebase, not an
unbounded partition-independent recurrence claim. The next query includes
**all** pairs; the old resolved-pair exemption is removed. The original
phase certificate remains private to this immutable resident chain; there is
no public API that trusts arbitrary forged landing state flags.

## Measured checkpoint

The seven dispatches are original event, contact builder, pair/cloth solver,
q admission, next query, landing response, and one subsequent query. No host
physics or intermediate readback occurs. The final state still occupies
640 bytes/candidate; the 39-row allocation is 105,376 bytes.

`npm run test:deterministic-event` passes 23/23 native tests in 9.29 seconds.
Across 156 cases/material combinations, all 24,960 CPU/GPU words match;
132 complete landing response and re-query. The explicit cloth restitution
matrix is 0, .2, 1 and 16 Q24 quanta (the latter produces a one-quantum rebound).
Tests also check independent floor impulse, energy dissipation, friction cone,
missing material rejection and correction-budget rejection. Compile time was
3.44 s; submissions were 2.46–4.73 ms on SwiftShader (software only).

The first fixture reaches landing bracket 42309–42310 ticks:
- e=0: support, then slip boundary 49466–49467;
- e=.2: bounce, then another landing 44836–44837;
- e=1: bounce, but another sphere's q-stop 53245–53246 occurs first.

The next response is deliberately pending. General rail contacts, arbitrary
3D flight/pairs, repeated multi-event budgets, raw strike and full-rest scoring
are not complete. This is not a whole-shot accuracy or hardware-speed claim.
See `evidence/deterministic-q-landing.json`.

The untouched v1 angular conversion now shares the proven endpoint limit
`17*2^26` on CPU/GPU (initial magnitude and rate each <=2^30, time<1/16).
Raw arithmetic holdouts explicitly test endpoints below, at, and above the old
initial-only 2^30 limit, with the full-product q bound enforced before narrowing.

## Recurrence refinement

The numerical measurements and upper-tick velocity description above record
checkpoint8ab23e8. The subsequent [q recurrence](deterministic-q-recurrence.md)
uses the encoded ballistic root velocity instead, with an exact integer square
root. This prevents an upper-tick tiny-bounce limit cycle. Position/common-clock
policy remains explicit; q-header15 now records the landing velocity correction.
