# Original-law grounded rolling: verification-only result

**Result: not qualified.** This small original PhysicsLab/Rapier experiment does
not demonstrate monotonic refinement toward the derived rolling/spin solution,
and does not establish that analytical advancement is at least as accurate as
the baseline. No production optimization was activated. This is not evidence
that the continuum Newton–Euler derivation is wrong, nor real-world validation.

## Physical candidate, not a replacement material

With a flat grounded solid sphere, no slip, normal load mg, no other contacts,
and the original resistance lengths, Newton–Euler gives rolling deceleration
`5*g*rollingLength/(7*R)` and normal-spin decay
`5*g*spinLength/(2*R*R)`. Static friction must exceed
`5*rollingLength/(7*R)`. Neither expression substitutes a new material parameter.
The existing application also applies rolling resistance during sliding, so
these equations cannot be used for arbitrary sliding states.

## Experiment

`tests/original-law-rolling-experiment.mjs` loads the actual original `math.js`
and `physics.js`, using an existing trusted bundled Rapier artifact. It removes
the other balls, settles the original sphere for 0.2 seconds after construction,
then prepares velocity/spin. It runs 0.25 seconds at dt = 1/960, dt/2 and dt/4.
Five samples are recorded per run. A read-only wrapper observes actual manifold
impulses immediately before the unchanged angular patch resistance call.
Normal impulses, future states and solver outputs are never forced.

Five cases: rolling at 0.3 m/s; rolling plus 1 rad/s normal spin; stationary
translation with -1 rad/s normal spin; friction 0.001; and initial slip 0.02 m/s.
The last two fail initial rolling admission. Initial admission is only a prepared
state hypothesis, **not** runtime regime certification; its 1e-7 m/s slip check
allows input f32 packing noise and is not an observable accuracy tolerance.

Measured recurrence steps are 240, 480 and 960 per case, totaling 8,400. Each
run additionally has 72 original constructor settling steps and respectively
192, 384 or 768 explicit settling steps (7,800 total additional steps).
There were no GPU jobs. Measured experiment wall time was approximately 0.95 s.

## Findings

Actual normal impulse/(mg dt) was 1.000000067 across all runs; the capped ratio
was 1. The normal was vertical and maximum observed vertical speed was
1.46e-11 m/s. Combined friction was approximately 0.2 versus required 0.010453;
the insufficient-friction case used approximately 0.001 and developed roughly
0.081 m/s slip.

For rolling, at 0.25 seconds:

| Observable error versus derived solution | dt | dt/2 | dt/4 |
| --- | ---: | ---: | ---: |
| Position, metres | 1.14e-5 | 1.61e-5 | 2.30e-5 |
| Velocity, m/s | 2.76e-5 | 3.93e-5 | 1.12e-4 |
| Angular velocity, rad/s | 0.00138 | 0.00410 | 0.00786 |

Mean pre-patch slip decreases (0.000304, 0.000256, 0.000183 m/s), but state errors
do not converge monotonically. Position includes timestep-dependent vertical
contact settling; horizontal and angular results also lack a clean trend.

Pure normal-spin error at 0.10 seconds increases from 0.000115 to 0.000225 to
0.000461 rad/s. All runs are effectively spin-stopped by the 0.15-second sample,
consistent with the predicted boundary near 0.11016 seconds, but that coarse
sample bracket does not qualify stop-time precision.

The finest run is **not** assumed to be truth. Its differences from baseline are
reported, but this failed convergence sequence cannot establish a reliable
accuracy ordering. Finite-precision accumulation, solver regularization and
impulse splitting remain possible contributors; none was diagnosed here.
No tolerance was widened and no analytical runtime admission was enabled.

Full observations: [refinement receipt](evidence/original-law-rolling-refinement.json).
The separate, withdrawn `event-coulomb-gpu.mjs` draft remains uncompiled and
unconnected. Further diagnosis needs a separate bounded scope, not a larger
parameter sweep or an assumption that more steps necessarily improve accuracy.

```sh
DIRECT_CUE_RAPIER_PATH=/path/to/existing/trusted/vendor/rapier.cjs \
ORIGINAL_ROLLING_RECEIPT=/tmp/original-law-rolling.json \
timeout 60s node tests/original-law-rolling-experiment.mjs
```

## Bounded follow-on diagnosis (no adoption)

The same test supports `ORIGINAL_ROLLING_DIAGNOSTIC=1` (rolling only) or `spin`
(pure normal spin only). Each runs the same 0.25-second interval at dt×4, dt×2,
dt, dt/2 and dt/4, observing actual torque calls, native inverse inertia and
pre/post patch state. The diagnostic does not replace the call or its inputs.
These two observations took approximately 0.30 and 0.26 seconds respectively.
Summary evidence: [diagnostic receipt](evidence/original-law-rolling-diagnostics.json).

For rolling, velocity error decreases from 3.17e-4 at dt×4 to 1.18e-4 at dt×2
and 2.76e-5 at dt, then increases at finer steps. Each run applies the same total
resistance torque impulse, approximately 0.00023176125 N m s. The final signed
slip and world-solver angular/linear momentum residual vary with timestep.
Rolling remains unqualified.

Pure normal spin gives a cleaner localization. At t=0.10 and dt/4, its signed
angular error is -4.60657e-4 rad/s. The observed world-step changes sum to
-4.58919e-4 rad/s; patch angular-increment error relative to ideal inertia sums
to only -1.73837e-6 rad/s. These account for the discrepancy without changing
the physical equations. At dt×4 the world-step contribution is -2.78056e-5;
its magnitude grows approximately with the number of steps.

Every captured patch update exactly matches the explicitly f32-rounded torque,
actual captured inverse inertia, and rounded angular-velocity addition in these
isolated tests. Native inverse inertia differs from the ideal scalar inverse
inertia by at most 1.41e-7 relative. Thus repeated rounding in the patch update
alone does **not** explain the dominant pure-spin discrepancy: most is introduced
inside `world.step`. Its precise internal origin was not established.

The continuum spin formula remains an independently derived exact solution of
the stated isolated constant-load physical law. Agreement with numerical drift
is not a physical requirement. These observations support treating finite-step
source agreement and continuum-law accuracy separately; they do not qualify an
entire contact-world fast-forward, realistic shots, or rolling advancement.
