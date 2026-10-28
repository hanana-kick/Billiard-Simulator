# Canonical sub-tick cloth bounce proposal

Status: isolated numeric proposal, not world integration. This module is not a
REST producer and is not wired into manual play, forecast, search or release defaults.

## Confirmed missing case

`deterministic-landing-3d.mjs` refuses a returning flight whose time bracket is
`[0, 1]` Q20 ticks (`status 6, reason 3`). With the default cloth restitution 0.20,
a shrinking bounce chain reaches that condition with a still-positive encoded
vertical velocity. The existing unit test deliberately accepted that unresolved
outcome. The zero-restitution prepared full-REST fixture did not cover this case.

## Extension, without a positive velocity snap

`deterministic-cloth-microtail.mjs` evaluates at most 128 micro-bounces using the
same encoded one-body impulse law as the existing landing response:

- Restitution: `nextSpeed = floor(e * speed / 2^24)`.
- Normal impulse per unit mass: `speed + nextSpeed`.
- Tangent impulse: the same directed divide by 3.5 and inward Coulomb disk.
- Real cloth arm: `(0, -R, 0)`, with the same rounded 2.5 angular conversion.
- The normal spin component is unchanged.
- A tail is complete only when that exact encoded recurrence produces zero.
  There is no arbitrary positive-velocity threshold and no substituted `e=0`.
- Elastic `e=1` is unsupported. Insufficient bounce/time/error budgets remain
  incomplete. No result is classified as gameplay success or physical world REST.

The extension is an explicit definition for a previously unsupported sub-tick
regime. It does not retroactively claim the older Q20-clock routine executed
these sub-tick flights, nor that the integer recurrence equals an unrounded
infinite impact series.

The initial ball center must be exactly at `cloth.top + radius`, with positive
Q24 vertical speed at most 127 quanta and `2*speed*2^20 < gravity`. All subsequent
launches are smaller. The vertical apex of each flight is less than one Q24
position quantum. A finite number of equal-gravity flights can therefore be
processed without sampling their trajectories.

## Time and position accounting

For an encoded launch speed `s_i` and encoded gravity `g`, the exact flight time
in seconds is `2*s_i/g`. The full tail time is represented by the rational pair
`(2*sum(s_i), g)`. The returned Q20 lower/upper clock bounds differ by at most
one tick; the remainder is retained. Impulse/gravity balance is exact in this
representation: `sum(Jn/m) - 2*sum(s_i) = -initialVy`, in Q24 units.

Horizontal velocity is constant on each micro-flight. Its displacement in Q24
position units is `2*v_i*s_i/g`. Each term is truncated toward zero for the
reference endpoint; every nonzero remainder contributes one position-error
quantum. These are accumulated, never discarded or mistaken for exact positions.
The maximum is 128 quanta, explicitly budgeted per input row. Default-material
examples terminate in a few bounces; near-elastic rows can take many more or fail.

A whole-prefix center box is returned using the maximum horizontal speed over
all stages and the exact total flight duration, rounded outward. Its vertical
interval is `[cloth plane + radius, cloth plane + radius + 1 quantum]`.
This is a swept bound, not an endpoint-only geometry check. The helper verifies
that its entire center box stays within the finite cloth face. It has no other
body or obstacle geometry and therefore cannot certify absence of those events.

## Required world integration

A world owner must do all of the following before committing any proposal:

1. Bind the immutable cloth/material and current full ball state to the producer.
2. Compare the entire swept box (with radius/contact and carried error inflation)
   with every moving body and static feature, with a common clock. An unresolved
   or earlier competing collision must block the tail, not be skipped.
3. Resolve the fractional endpoint clock consistently for every body. Simply
   copying this endpoint onto the returned upper integer tick is incorrect;
   the remaining supported evolution and its uncertainty must be accounted for.
4. Preserve the caller's original shot deadline, event budgets and accumulated
   error receipts. The helper's cloth impacts are not gameplay floor-foul events.
5. Only the world owner may emit all-roster model REST and committed rule facts.

Until those obligations are met the module explicitly returns
`worldCommitted:false`, `geometryPending:true`, and
`integerClockHandoffPending:true`, even for a successful numeric proposal.

## Output ABI (96 words per candidate)

- 0 id; 1 status; 2 reason; 3 version (`0x4d425401`).
- 4 evaluated bounces; 5/6 Q20 lower/upper duration; 7 sum of launch speeds.
- 8..10 endpoint reference position; 11..13 velocity; 14..16 full `q=Rω`.
- 17..19 position-error bounds, in Q24 quanta.
- 20/21 exact duration numerator/denominator in seconds.
- 22..24 accumulated normal/x/z impulses per mass.
- 32..34 whole-prefix minimum center; 35..37 maximum center.
- 40 needs world clearance; 41 encoded bounce sequence terminated;
  42 Q20-clock division remainder.
- Other words reserved and zero.

Status 1 is only a successful proposal. Status 4 is unsupported/invalid domain,
5 is incomplete, 7 is unresolved finite-cloth geometry. Failure outputs never
carry the successful proposal flags. Reasons: 1 admission, 2 bounce budget,
3 time budget, 4 position budget, 5 cloth edge, 6 arithmetic/state range.

## Verification

Run `node --test tests/deterministic-cloth-microtail.mjs`.
An independent BigInt implementation checks every impulse, normal spin,
termination, rational clock, momentum closure, endpoint error and every flight
vertex inside the whole-prefix bounds. Cases cover all 127 admitted starting
vertical quanta for restitution 0, .2, .5, .9 and the largest Q24 value below 1.
Failures exercise elastic restitution, support gap, zero/large launch speed,
step/time/error budget, finite-face edge and input ownership/range guards.

An independent unrounded Newton/Coulomb infinite-tail calculation is also
compared for restitution at most .5. This is physical comparison evidence,
not a replacement tolerance or an exact equivalence claim. The bounded helper
must separately pass literal native CPU/WGSL word equality. SwiftShader is a
software Vulkan implementation; its timings are not hardware GPU performance.

The refinement test halves and quarters the state/impulse quantum (Q25/Q26),
starting from the same encoded physical state and materials. Flight time is
analytic rather than time-stepped, so a time-step convergence claim would be
misleading here. This test compares the finite rounded recurrence against an
independent unrounded Newton/Coulomb tail; it is not real-table calibration.
