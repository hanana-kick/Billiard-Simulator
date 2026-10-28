# Subsequent supported pair events in resident recurrence

The q-state recurrence can now resolve a second and third pair impact using
the existing equal-sphere, real-arm coupled pair/cloth impulse solver. It then
continues landing and supported regimes to rest when the declared scene stays
inside this bounded domain. There is no q→omega→q roundtrip, host physics, or
intermediate readback. Raw cue input, arbitrary 3D contacts and scoring remain
separate gaps; this is not a full-shot acceptance claim.

## Admission and true contact refinement

The general q query reports conservative padded pair candidates, sometimes
before actual contact. A candidate alone does not authorize an impulse.
The new builder independently refines the actual X-separation quadratic:

`gap + relativeVelocity*t + relativeAcceleration*t²/2 = 0`.

Spatial left/right order is independent of array IDs. Closing derivative must
remain strictly negative throughout the proposed interval. Signed polynomial
signs use exact two-word integer sums under gap<=1/8 m,
|relativeVelocity|<=1 m/s, |relativeAcceleration|<=32 m/s² and the existing
65,535-tick horizon. The builder searches at most 64 additional ticks after
the padded candidate; failure to certify a root is unsupported, never a miss.
It does not apply an impulse at the candidate midpoint.

The current supported-only profile requires every sphere to remain in the
same X lane, at exact encoded cloth-top-plus-radius, with zero vertical and
off-plane state. Physical/collision radius and mass must match the immutable
scene. All scalar sign-change times are checked by exact wide-product
comparisons before extension. Other pair contacts, static boxes and the finite
cloth footprint are excluded over the extension, including the old resolved
pair. The prior private query certifies the earlier prefix; packets from an
untrusted outside producer are not accepted as certificates.

Every sphere is evaluated from its anchors at the actual root bracket's upper
tick. Selected packed centers must have actual nonnegative overlap within a
derived speed*one-tick-plus-rounding envelope. Independently packed positions
that are still separated are refused. The common contact point is computed
from these actual centers, so the existing real lever arms/inertia, normal
restitution, pair tangential friction and both cloth constraints are retained.
No center is moved to manufacture pair contact.

## Merge, provenance and failure states

The solver's c channels become qz=−c directly. All spheres share the new
clock, and fresh motion coefficients replace old ones. Only the newly resolved
pair receives the bounded separating-exit token. It is not a permanent pair
exemption. Positive vy is retained; unresolved residual/support modes return
unsupported rather than flattening flight.

Pair-stage tag is `0x51500401`. Header 19/20 preserve the refined absolute
bracket,21 the left/right pair code,22/23 actual overlap/bound,24 solver
iterations,25 residual,26/27 solver division/multiplication work,29/30 pair
normal/tangent impulses. On a failed solve, current-state elapsed time still
points to the refined upper tick; it is not mislabeled with the earlier
padded-candidate time.

Each selected body's reserved fields 28/29 store its **last pair-solve cloth
normal/tangent impulses**,30 the pair-stage tag and31 the absolute impulse
epoch. These are dated historical impulses, not a certificate of current
sustained support or the latest landing. Landing and scalar records retain
their distinct provenance. A fresh closing impact is recorded once per
response, never once per projected-solver iteration. No scoring adapter is
introduced here.

## Bounded work and cancellation

Statistics ABI version is now `0x51520302`, with 24 words per candidate.
Existing fields 0–15 retain their meanings. Fields 16/17 count attempted and
completed subsequent pair responses;18–20 sum solver iterations/divisions/
multiplications for **successful subsequent responses only**;21–23 store last
pair code, epoch and positive-vy mask. These component counters are not total
arithmetic work: initial/failed solves, geometry checks and root refinement are
not represented by them. Full dispatch and resident-copy counts are reported
separately, including inactive invocations.

The pair stages reuse existing contact/response buffers. Every budget slot
adds builder, existing solver and direct q-merge dispatches. The fixed-budget
schedule remains intentionally conservative and can be slower than CPU on
SwiftShader. Budget exhaustion is incomplete, not a failed shot.

A pre-aborted signal prevents execution. An abort after GPU submission prevents
publishing the result and frees buffers after queued work drains. It does not
pretend to interrupt already submitted native GPU instructions. CPU checks the
signal before execution and between synchronous response slots.

## Tests and limits

The four-ball fixture produces genuine first→second→third pair impacts and
then all-ball rest. Tests verify subsequent contact energy, linear momentum
including cloth impulses, and angular momentum including the external cloth
lever arm; they also verify a failed solver's upper-tick state timestamp,
unsupported airborne mode, budget refusal, and pre/in-flight cancellation.

A new four-ball holdout found that scalar-query scratch boundaries needed
explicit initialization for every body: an idle fourth sphere must not retain
another body's candidate boundary. The shared shader now writes both entries
and kinds to zero before each body. CPU/GPU intermediate states for the first
five recurrence slots are regression-tested, as are every final state and
statistics word across workgroups.

See `evidence/deterministic-q-pair-recurrence.json` for the native measured batch.
The remaining scope exclusions are airborne/non-collinear/multiple simultaneous
pair impacts, real cushion geometry/response, arbitrary spin and raw strike.

Final native manifest: 29/29 tests pass in 18.63 s. The 105-case batch compares
all 19,320 state/statistics words exactly. For 35 four-ball chains, e=.2 resolves
70 subsequent pairs and all 35 reach rest; e=0 resolves 61 subsequent pairs,
with 30 at rest and five unsupported. Budget 2 produces no false rest.
The 35-row allocation is 123,744 bytes; 80 attempts submit 646 dispatches and 80
resident copies. Compile took 4.23 s and the two full-budget submissions took
70.7/79.7 ms on SwiftShader. No hardware-speed or full-shot claim follows.

[Prepared physical-to-RULE integration](deterministic-physical-rules.md) now
consumes committed responses inside the resident chain, with actual-rest and
operational non-result handling. It does not infer contacts from next candidates.
