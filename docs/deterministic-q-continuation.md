# GPU-canonical q-state continuation (experimental v2)

This checkpoint composes one real prepared axial pair impact with freshly
computed supported/flight motion and a next-event query. It is not a raw-shot
or full-rest evaluator. The GPU integer algorithm is the program reference;
the CPU executes the same arithmetic. Physical validation is separate from
bit identity and does not require copying old Rapier numerical artifacts.

## Sufficient state and arithmetic

The explicit ABI tag is `0x51563201`; v1 words are never reinterpreted.
Positions, velocities, and angular surface velocities `q = R * omega` use Q24.
Time uses Q20 (one tick = 0.95367431640625 microseconds). State is 160 words,
640 bytes per candidate: a 32-word header and four 32-word sphere records.
Each sphere stores anchor p/v/q, actual acceleration, q rate, mode, current
p/v/q, physical radius, collision radius and mass. Both radii must match in
this bounded profile. Uniform isotropic spheres do not need attitude for
trajectory, contact, or scoring; this is an exact removal of irrelevant state.

Actual acceleration A, rather than a rounded half-acceleration, gives:

- p = p0 + floor(v0*t / 2^20) + floor(A*t*t / 2^41)
- v = v0 + floor(A*t / 2^20)
- q = q0 + floor(qRate*t / 2^20)

All products use bounded two-word integer arithmetic. Time is at most 65,535
ticks. Admission bounds |p| <= 32, |v| and |q| <= 16, |A| <= 16 and
|qRate| <= 64 in SI-scaled units. Thus advanced coordinates remain below 34,
velocities below 17 and q below 20; relative polynomial terms and scalar
boundary sums remain within signed 32-bit range. Conversion of untouched v1
omega to q checks the full product BEFORE rounding or typed-array narrowing.
Selected impact q comes directly from contact c = -qz, with no omega roundtrip.

The encoded motion model is deterministic, not an exact real-number model.
Each stored quantum is about 59.6 nm, 59.6 nm/s or its angular-surface analogue.
Position evaluation adds less than two quanta of downward rounding; velocity
and q add less than one each, in addition to coefficient/initial-state
quantization. Geometry tests enclose encoded polynomials and packed-state
rounding; they do not certify original continuum event times near grazing.

## Fresh post-impact laws

The planar profile has qx=qy=0. Let F=mu*gLoad and
K=(5/2)*min(gLoad,gCap)*rollingLength/R, with encoded multiply/divide rounding.
Sliding uses u=vx+qz, ax=-F*sign(u) and
qRateZ=(5/2)*ax-K*sign(qz). At qz=0 the resisting torque is set-valued:
qRateZ=sign((5/2)*ax)*max(abs((5/2)*ax)-K,0).
At u=0, rolling is admitted only when 2K <= 7F; ax=-sign(vx)*2K/7
and qRateZ=-ax. Current rolling qz is exactly -vx in the common units.
Insufficient static friction starts slip or returns explicit unresolved onset.
These laws retain rolling resistance during sliding, rather than substituting
an independent simplified Coulomb model.

Flight requires exact encoded zero gap above the finite cloth, strictly positive
vy beyond contact residual, and zero cloth normal impulse. Supported motion
requires vy=0 at that same height. Penetrating, ambiguous, or unsupported modes
remain pending; centers are never projected. Flight keeps q constant and uses
ay=-gLoad. Its next descending landing has rational time 2*vy/gLoad.

## Resident flow and next event

Five dispatches share GPU buffers: axial prediction, contact packet construction,
coupled pair/cloth solve, q-state admission/recomputed coefficients, and mixed
next-event query/advance. There is zero intermediate readback or host physics.
All spheres advance on one clock from retained post-impact anchors. Old
pre-impact acceleration is not reused.

The previous pair must have a strictly separating X derivative until the next
scalar boundary, achieve padded X clearance, and have no vertical reversal
before clearance. Otherwise another local contact solve is explicitly pending.
Other pairs use conservative relative X/Y polynomial distance bounds. Static
AABBs and the finite cloth footprint use outward polynomial bounds. Left-first
interval subdivision returns possible-contact brackets, not fabricated exact
collision times; ambiguity and hard node exhaustion remain non-results.
Scalar slip, tangent-spin, rolling-stop and landing boundaries preempt the
observation horizon. No landing or second-pair response is implemented here.

## Verification receipt

`npm run test:deterministic-event` includes this module. Native SwiftShader run:
21/21 tests passed in 4.33 seconds. The v2 batch has 39 candidates and 6,240
output words, all CPU/GPU identical; 33 advance. Additional alternate-friction
and nonzero-byte-offset batches match, and invalid scenes reject before dispatch.
Tests reach landing, a subsequent moving pair, and an uninvolved slip boundary;
they cover q=0 onset, static-friction sufficiency, force/power signs, conversion
range boundaries, penetrating-mode rejection and incomplete query budgets.

The v2 compile took 1.52 seconds; shader sizes are 4,116 / 8,418 / 5,991 /
5,641 / 6,736 bytes. The 39-row run allocated 105,360 bytes, submitted in
3.34 ms, and performed one final readback. This is a software-GPU receipt,
not hardware throughput or whole-shot physical acceptance. See
`evidence/deterministic-q-continuation.json`.

Next missing integration: respond to landing or the next conservative pair
bracket with validated contact modes, then repeat. Arbitrary horizontal angles,
nonzero normal spin in this mixed profile, general rail contact, actual raw cue
strike, complete rule journaling and full-rest termination are not yet connected.

## Follow-on landing checkpoint

[Isolated landing response and re-query](deterministic-q-landing.md) now adds
one explicitly bounded floor response and another resident query. The historical
five-phase measurements above remain the original checkpoint; current receipts
reflect the extra optional landing context storage and shared range guards.

[Bounded resident recurrence](deterministic-q-recurrence.md) now handles repeated
landings and supported scalar events through actual prepared-scene rest.
