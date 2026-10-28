# Source-law guarded advancement (opt-in, prepared boundary)

`src/direct-candidate/source-law-normal-spin.mjs` implements the original
normal-spin torque law, not the withdrawn Coulomb model. It advances angular
speed and full orientation to the globally earliest spin-stop/horizon event.
All balls advance to the same clock; simultaneous independent spin stops are
resolved together. No trajectory time grid is evaluated inside the formula.

`stepPreparedSpinWorld` is an explicit, default-off PhysicsLab adapter. It checks
all represented bodies, joints and collider ownership; actual native cloth
geometry; enabled collision channels; fixed surroundings; no external force,
damping or constraints; stationary spherical positions; pure normal spin; and
exact supported height at f32 representation. Other actual scene hulls are
queried, not replaced by four rectangle planes. It does not project approximate
positions or remove residual slip. Every call rechecks state and material.

Failure delegates to the unchanged `lab.step(frames)`. An outside event inside
the requested interval also delegates rather than guessing a partial-frame
handoff. The pure planner separately returns the exact external horizon and
unadvanced remainder. A zero-frame request is a true no-op. NaN horizons and
invalid timesteps are rejected before mutation.

## Explicit boundary contract and limitations

The caller must provide an explicitly **prepared, drained source-step boundary**
with no pending collision transition. `preparedBoundary: true` is an external
ownership contract, not an automatic proof obtained from one measured normal
impulse. Arbitrary live shots and queued event transitions are NOT certified.
The runtime geometry/dynamics checks establish stationary supported isolation;
old manifold impulse observations alone do not establish future equilibrium.

The adapter preserves current sleep flags, time/step counters, the unchanged
contact-event log, and stationary distance/height/trail bookkeeping. It does not
reproduce numerical sleep timers or claim identical future cache/sleep/event
chronology. `anyMotion()` sees the resulting physical angular speed. No PASS,
MISS, release or full-shot qualification follows from this component.

Typical finite-step settled Rapier states below ideal support are refused, not
silently lifted. The physical continuum law and finite-step numerical drift
remain distinct, as recorded in `original-law-rolling-verification.md`.

## Measured small test

Four focused tests passed with actual original PhysicsLab/Rapier in approximately
0.8 seconds. An explicitly prepared three-ball scene at exact support advanced
0.25 seconds while skipping **240 actual `world.step` calls**. Four fallback
steps executed the original solver. Spin error at the stop was zero; maximum
quaternion component difference from the analytic orientation after native f32
storage was **9.75247e-8**. These are separate work-count and observable-error
measurements, not hardware-speed or complete-shot accuracy claims.

Coverage includes both spin signs, zero resistance, orientation, multiple and
simultaneous global spin stops, external horizon, unsupported translation and
slip, support error, contact/cue/unowned-body rejection, collider channel and
enablement rejection, NaN horizon, true no-op, clock/bookkeeping and fallback.

```sh
DIRECT_CUE_RAPIER_PATH=/path/to/existing/trusted/vendor/rapier.cjs \
node --test tests/source-law-normal-spin.mjs
```

No renderer, UI default or production backend selection changed. Rolling and
general sliding remain unqualified; the withdrawn uncompiled GPU draft is not
imported or activated.

## Prepared collinear sliding: motion/event primitive, not live admission

`source-law-collinear-segment.mjs` now computes fixed-sign sliding motion from
**both** original cloth friction and original rolling patch torque. For a unit
horizontal direction e, `v = velocity·e`, `c = R(omega × up)·e`, and `u=v-c`:

- `v' = -mu*g*sign(u)`
- `c' = (5/2)*mu*g*sign(u) - 5*g*rollingLength*sign(c)/(2*R)`
- normal spin uses the same original `spinLength` law as above.

The intrinsic horizon is the earliest slip-zero, tangential-spin-zero or
normal-spin-stop. Crossing zero translational speed alone is **not** a regime
boundary: motion may reverse while slip direction is unchanged. The first numerically certified subset is coordinate-axial (X or Z); rotated
collinear states await an exact determinant certificate. Nonaxial or
noncollinear states, rolling, and an initial zero tangential-spin boundary are
refused; no fitted direction or forced no-slip projection is introduced.

`predictPreparedCollinearEvent` compares intrinsic horizons with all sphere-pair
quartic times and advances all kinematic states to one earliest event. It
requires a caller-provided, explicitly prepared actual-geometry-safe interval;
it neither invents cushion faces nor certifies that interval for live scenes.
The selected boundary must be handed to original geometry/contact physics.
Multiple/tied events are unsupported rather than arbitrarily ordered.

Seven focused tests cover source force/torque signs, independent dissipated-power
identity (draw/topspin/reversed motion), spin-started translation, reversal,
regime refusal, relative-acceleration pair contact, global uninvolved spin, and
mandatory external geometry horizons. The three-ball example performs three
pair-root solves and **zero trajectory timesteps**. This is an operation count,
not a total-runtime speedup claim.

Full orientation evolution under a changing, nonparallel angular-velocity vector
is not supplied by this kinematic primitive; outputs explicitly say
`orientationAdvance:false`. Contacts are not resolved (`collisionResolved:false`).
No live translating-world advancement, source-discretization parity, general
sliding or rolling qualification, or complete-shot PASS/MISS is claimed.

The separate conservative swept-pair helper was **not imported**: measured
whole-helper CPU cost exceeded the baseline despite reducing quartic calls.

Adversarial tests reject noncollinear subnormal products that round a determinant
to zero, and positive sign-change times that underflow to zero. No approximate
collinearity tolerance is used. Both X- and Z-axis segments are covered.

## Actual geometry and candidate-window integration

`source-geometry-horizon.mjs` constructs three-dimensional conservative bounds
from actual native box extents and convex hull vertices, using collider world
positions. The bounded first version rejects rotated or stale fixed transforms,
rounded/unknown shapes, native contact skins, stale ball/segment state, offset
sphere colliders and unsupported source settings. Both static sphere inflation
and pair-contact radii include actual native geometry; the torque-law radius
remains separate. The finite cloth footprint is checked, not discarded.

Outward-rounded Bernstein enclosures certify a collision-free prefix against
all real static bounds. Bounded interval halving can shorten a prefix, but never
samples/integrates a trajectory. This endpoint is a truncation bound, **not** a
predicted wall impact. Ordinary evidence uses 15 real static bounds, including
eight convex rail/cushion hulls, three swept bounds and 45 separation tests.
The near-rail fixture certifies 0.0614619 seconds after one halving. Pair and
regime events then compete globally; a prefix endpoint does not create a fake
collision tie. Geometry certification remains conditional on the separately
prepared motion segment, not automatic live-shot qualification.

`source-law-candidate-evaluator.mjs` now consumes **actual current PhysicsLab
state**. It distinguishes event precomputation from admitted advancement. Normal
spin can skip original work; translating windows currently schedule original
steps through the predicted boundary and do not replace state or responses.
Default-off and unverified boundaries execute original physics directly.

The matched [candidate receipt](evidence/source-law-candidate-evaluator.json)
records work counts, wall observations and finite-step endpoint differences
separately. Four 96-frame translating cases (forward slip, draw, near rail,
moving pair) matched original state, orientation and bookkeeping exactly because
all 96 original solves still execute. Precomputation adds overhead in this mode;
it is not a translating speedup. The spin window skipped 240 original solves,
but differed from finite-step source by about 58 micrometres in position and
0.000265 in quaternion components. After 24 unchanged fallback steps the position
difference was about 48 micrometres. These are numerical-source discrepancies,
not real-world accuracy measurements or a claim that native caches are identical.
The analytic spin-law/attitude error is measured independently above.

Run all focused CPU tests with `npm run test:source-law`. This uses the existing
`prepare:engine` setup and trusted repository `vendor/rapier.cjs`; no GPU or new
dependency is required. Ordinary build/UI/default physics remain unchanged.

## Second explicit opt-in: experimental axial prefixes

The candidate evaluator now accepts `advanceTranslation: true` **in addition to**
`enabled: true` and the prepared-boundary contract. This invokes
`source-law-axial-advance.mjs`; the default remains original translating steps.
The supported subset is fixed-axis sliding with zero normal spin, plus stationary
normal-spin companions. Rolling, nonaxial slip, changing-axis attitude and
uncertain native endpoints remain original-solver cases.

A prefix ends before a predicted regime/contact boundary. Selection of an
integer frame before an approximate TOI is NOT relied on as collision proof:
independent outward 3D enclosures must separate EVERY native sphere pair and
EVERY real static hull/box over the complete prefix. Native position-packing
padding is included. Unsafe prefixes are shortened or refused. The fixed-axis
orientation uses a left-multiplied world-axis quaternion from the integrated
angular velocity. Finite native-f32 endpoints, packed slip/spin signs, and
nonincreasing kinetic energy are checked before mutation.

No ball/cushion contact is analytically resolved. The original solver runs at
the remaining boundary and handles all impacts. Sleep flags remain unchanged.
Distance retains the source's per-frame chord observable, including the single
reversal-containing frame; it is not advertised as exact continuous arc length.
Trails use only the existing sixth-frame observation points, not physical
trajectory timestepping. Failed guards' enclosure work is counted too.

Five matched 96-frame windows in the [axial receipt](evidence/source-law-axial-advance.json):

| Prepared case | Actual original solves skipped | Original solves retained |
| --- | ---: | ---: |
| Forward slip | 81 | 15 |
| Draw | 81 | 15 |
| Near rail | 93 | 3 |
| Moving pair | 53 | 43 |
| Translational reversal | 96 | 0 |

Every case then executes 24 additional unchanged original steps. Counts,
wall-time observations, packed endpoint error, energy, and finite-step source
differences are separate receipt fields. Planning cost is real: near-rail and
forward-slip observations can be slower despite fewer solver calls. The forward
case timing includes diagnostic contact observation. No stable hardware/shot
speed claim follows from these small observations.

**Accuracy acceptance remains open across contact handoff.** The largest measured
angular difference is forward-slip cue-ball omega-z: -16.0758934 versus
-15.9125414 rad/s at 0.1 seconds, difference 0.1633520. Both are still sliding
with slip-x -0.446698 versus -0.439722 m/s. Contact order and recorded onset time
match (ball 1/2 at 0.0875 s), as does the first positive pair-impulse step; its
normal impulse differs (0.168874219 versus 0.168844879 N s). This is NOT evidence
of an event-order change, but neither is it established to be harmless roundoff.
Energy dissipation alone does not prove unchanged whole-window accuracy.

The first prefix respects the declared source physical equations; native
finite-step discrepancies and post-resume response require further bounded
analysis. No native cache identity, general sliding/rolling, raw-shot, full-rest
scoring, production-default or GPU qualification is claimed.

## Bounded precontact accuracy diagnosis

`tests/source-law-precontact-diagnostic.mjs` executes the unchanged original
forward-slip scene only through 0.05 seconds, before any positive pair impulse,
at dt, dt/2 and dt/4 (48/96/192 steps). Actual manifold loads and actual patch
torque calls are observed without forcing either. This run took about 0.153 s;
[receipt](evidence/source-law-precontact-diagnostic.json).

An initial support transient is present: first normal-load/(mg dt) ratios are
0.86771, 0.86561 and 0.93281, with compensating overshoots 1.13229, 1.13439 and
1.06719. Because the source patch torque caps load at mg dt, the overshoot does
not compensate the initial torque deficit. Accumulated rolling-torque impulse
approaches the constant-load value as dt shrinks. This is measured source
splitting/transient behavior, not a fabricated future normal force.

At 0.05 seconds, signed source-minus-analytic omega-z errors are -0.000899,
-0.001682 and -0.003604 rad/s; velocity-x errors are +1.27e-5, -2.16e-5 and
+4.70e-5 m/s. The errors already exist before contact and are not monotone under
refinement. However, they are far smaller than the 0.163352 rad/s difference
measured after the hybrid contact handoff. Therefore neither the support
transient nor generic roundoff has been established as a sufficient explanation
for the larger postcontact response difference. Whole-window accuracy remains
an open acceptance condition; no tolerance has been widened.

## Localized handoff/impact observation

A second bounded observation records only the original-equivalent last prefix
frame (81), four resumed frames (82–85), and the first positive pair-impact
step. It took approximately 0.127 s. Full observed states, cloth manifolds,
normal impulses, patch torque calls and world/patch increments are in the
[handoff receipt](evidence/source-law-handoff-diagnostic.json); no forces or
states were replaced for this diagnostic.

- At the jump, cue-ball omega-z differs by only -0.000721 rad/s.
- The first resumed cloth load is about 1/12 mg versus reference mg; the next
  resumed load is about 1.8333 mg. This creates a transient angular discrepancy,
  but the discrepancy is back to +0.001808 rad/s by frame 83.
- At pair impact (frame 84), measured world angular increments are nearly equal:
  +1.347908 versus +1.347839 rad/s. The post-impact discrepancy is +0.001877.
- At frame 85, the hybrid has **zero cloth normal impulse**, whereas reference
  has 0.000776444 N s. The angular discrepancy grows to -0.062609 rad/s.
  Hybrid center height is about 5.10 micrometres above ideal support; reference
  is about 19.85 micrometres below it. Both bodies were awake in both runs.

Thus the observed early large growth is associated with different cloth
recontact/support response after impact, not a changed pair-event order or a
large difference in the angular increment at the impact step. This does not
prove the internal cause of the resumed-load transient, identify a particular
private cache defect, or establish which whole-window result is closer to the
physical limit. Public manifold impulse fields also do not by themselves
constitute a complete decomposition of every solver impulse.

No position offset, forced normal load, warm-start cloning or physics parameter
change was introduced. A consistent, accuracy-qualified contact handoff remains
required before this experimental mode can be a default or full-shot authority.

### Earlier handoff did not resolve the discrepancy

The bounded follow-up handed back to the unchanged solver 4, 8 and 16 source
frames earlier. It retained 19, 23 and 31 native steps respectively (instead
of 15), while still skipping 77, 73 and 65. Endpoint cue omega-z differences
were -0.188996, -0.188279 and -0.187053 rad/s, versus -0.163352 for the original
handoff. Each run took under 0.16 seconds. The
[compact comparison receipt](evidence/source-law-earlier-handoff.json) records
frames 81–85, first resumed samples and endpoints.

All three earlier handoffs recovered an approximately mg cloth load before
frame 81, but still had zero cloth impulse at frame 85, unlike the reference.
Thus a fixed settling margin or a previously stable load alone is not an
accuracy qualification. No margin was adopted. The hybrid's tiny post-impact
clearance and upward velocity can allow genuine short flight; the reference
is still penetrating the ideal support plane. These observations do not
establish which contact solution is more accurate. The next useful check is
continuous landing timing from actual native support geometry, together with
bounded local contact-step refinement, not forcing baseline penetration or
refining the whole shot. Experimental advancement remains disabled by default.

### Bounded local 3D contact refinement

The next diagnostic uses fresh original and hybrid branches at each of h, h/2
and h/4. Only the interval after frame 81 through frame 88 is refined; all
branches then use common h through frame 96. Original source world stepping,
3D contact resolution and the source angular patch run at every local substep.
There is no forced support state or altered contact law. The six branches took
0.210 seconds; see the [receipt](evidence/source-law-local-contact-diagnostic.json).

| Local timestep | Original native calls | Hybrid native calls | Endpoint hybrid minus original omega-z |
| --- | ---: | ---: | ---: |
| h | 96 | 15 | -0.163352 rad/s |
| h/2 | 103 | 22 | -0.154267 rad/s |
| h/4 | 117 | 36 | -0.129045 rad/s |

Counts include preparation (81 source steps for original, 81 analytic skipped
steps for hybrid), local steps and the final eight steps. Each branch also has
72 identical constructor settling steps, reported separately in the receipt.
Pair impact times move together from 0.0875 to 0.0864583 to 0.0859375 seconds.
The endpoint discrepancy decreases, but this is neither a convergence proof nor
an acceptance result; the finest branch is not declared physical truth.

The actual native cloth top plus native sphere radius shows positive hybrid
clearance after impact, while the reference remains penetrating support.
Conditional ballistic roots from samples with zero current cloth/pair impulse
predict landing near 0.089195, 0.089209 and 0.089029 seconds; subsequent positive
cloth impulses occur at 0.089583, 0.089583 and 0.0890625 seconds. No intervening
pair impulse was observed. These are retrospective conditional checks, **not
runtime flight certificates**: no independently proved future exclusion of
all other contacts was added. The script never advances a body using them.
Native world velocity/angular increments and patch torque impulses are retained
so the comparison does not infer all tangential impulse from public manifold
fields alone.

This supports investigating event-bounded local contact solves rather than
finer whole-shot marching, but does not yet qualify the hybrid contact handoff.
A runtime flight branch still needs a genuine all-contact validity horizon and
a landing response accuracy test. No further refinement levels, magic settling
margin, or default behavior change were introduced.

## Reusable ballistic landing event predictor

`source-law-landing-event.mjs` adds prediction only, with no bridge activation,
world advancement or contact impulse replacement. Its explicit prepared domain
contains spherical, unconstrained, force-free, undamped ballistic bodies and
optionally exactly stationary supported spheres with zero spin. Airborne bodies
must have positive native geometric clearance and no active native contact
impulses or penetrating manifold points, including stale contact records.
Unowned bodies, joints, cue, altered support/collider modes and unsupported
native shapes are refused using the source-state guards.

For native cloth top H and native sphere radius R, gap = y - H - R. The positive
descending solution of gap + vy*t - g*t²/2 = 0 is used; the downward branch is
rationalized to avoid subtraction cancellation. Invalid/overflow/underflow
arithmetic is refused. This is a numerical event candidate, not an exact-contact
response or permission to jump across its endpoint. Equal landing candidates
are returned together rather than assigned arbitrary body order.

Outward-rounded swept 3D bounds cover every body's certified motion. The entire
sphere footprint must remain strictly inside the finite native cloth face, and
all native hull/box bounds and all sphere pairs must remain disjoint. If the
full landing interval cannot be certified, bounded halving returns a shorter
safe geometry/observation horizon, not a claimed rail/pair impact. This can be
conservative and produce a short prefix. The native rail profiles are not
replaced by infinite planes. Only the original solver may resolve contact.

The CPU-focused runner now has 22 passing tests. New coverage includes upward
and downward roots, invalid arithmetic, actual native landing geometry, moving
pair and finite-rail preemption, stale active-contact refusal, force/skin
refusal and unchanged source world snapshot. No GPU, whole-shot accuracy or
runtime optimization claim follows from those tests.

Before arbitrary-angle GPU candidates are qualified, remaining work includes
source-law nonaxial sliding/tangential-spin dynamics (including original rolling
torque during slip), regime and all-body event isolation, qualified 3D
ball/rail/landing local response, and compact native candidate-batch execution
with complete rest/rule evaluation. The withdrawn substitute-law GPU draft
remains unused; porting this quadratic root alone does not fill those gaps.

A review regression covers a native-f32 landing root rounded upward: comparing
an observation time with that computed root alone could falsely certify a tiny
penetration. Shorter safe prefixes now independently require every airborne
sphere's outward swept lower-y bound to remain strictly above native cloth top.
A landing candidate has `certifiedAdvanceDuration: null` and
`prefixExcludesClothContact: false`; its numerical root is never an advancement
certificate. Conservative shorter prefixes explicitly report that distinction.

## General horizontal source-law derivative (no integrator)

`source-law-nonaxial-rhs.mjs` removes the coordinate-axis restriction for the
**instantaneous derivative**, not for world advancement. With upward unit n,
contact arm a = -R n, horizontal slip u = v + omega cross a, tangential angular
velocity omega-t and I = 2mR²/5:

- F = -mu m g u / |u|;
- contact torque = a cross F;
- rolling torque = -m g rollingLength omega-t / |omega-t|;
- normal spin torque = -m g spinLength sign(omega dot n) n;
- dv/dt = F/m and domega/dt = sum(torques)/I.

Rolling torque therefore remains present **during sliding**, unlike the
withdrawn simplified Coulomb prototype. Normal-spin decay is separable under
these prepared flat constant-load assumptions. The native source instead uses
measured contact normal impulse capped by mg*h; arbitrary live contacts do not
automatically meet this continuum load premise.

Zero slip is refused as an unqualified rolling/static-friction boundary, and
zero tangential spin is refused as a direction-change boundary. Numerical
invalidity and unrepresentable rates are rejected. Normal spin at zero has zero
spin torque. Returned current boundary indicators do not predict when general
slip or tangential spin next reaches zero. No state is integrated or mutated.

The focused suite now has 25 passing tests. Independent contact-arm cross
products, spherical inertia, force/torque energy dissipation, horizontal
rotational covariance, axial-law reduction, spin-induced translation and
boundary/invalid-condition refusals are covered. Arithmetic comparison limits
are explicitly roundoff checks, not whole-shot physical acceptance tolerances.

### Minimal next error-controlled advance proposal

General slip and tangential-spin directions vary, so the current constant-
acceleration/quartic segment cannot be reused. No closed-form general advance
has been implemented or justified. A bounded adaptive local ODE solve can use
this RHS, while axial proved segments remain analytical. Before that becomes
an accuracy-authorized event advance, it needs:

1. A declared observable error budget, not a tolerance adjusted after fixtures.
2. An accepted interval enclosure maintaining strictly positive lower bounds
   on slip and tangential-spin magnitudes. Those bounds control the derivative
   of vector normalization and hence a local Lipschitz/remainder bound.
3. A dense state enclosure whose defect and roundoff are bounded; an embedded
   method's error estimate alone is not a rigorous certificate. Reject or
   subdivide when the enclosure cannot separate a regime boundary.
4. All-ball pair/native-hull event brackets against that enclosure, advancing
   every ball to one common certified time and isolating competing events.
5. Original 3D local contact/landing response outside qualified free-motion
   intervals, with total RHS evaluations and native substeps counted together.

This is a proposal, not a new generic integrator or an accuracy assertion.
Normal-spin stop remains an analytical candidate; general sliding/rolling
transition handling and qualified contact handoff remain open.

## Opt-in numerical general-angle segment checkpoint

`source-law-general-segment.mjs` implements a small direct Dormand–Prince 5(4)
evaluator for the prepared RHS. It is **not** a certified-error solver or a
world bridge. Its snapshot geometry domain must be produced by the native
scene validator; a fabricated caller object is refused. All balls are included
in outward force-magnitude position tubes, actual hull/box separation, pair
separation and finite cloth-footprint checks. For sliding, |acceleration| is
bounded by mu*g; no fixed slip direction is assumed. Numerical stage/end
positions must stay inside those tubes. This domain applies to the snapshot,
not a later changed native world.

Caller-specified positive absolute position, velocity and angular budgets are
allocated by interval duration. The embedded discrepancy is accumulated as an
**estimate**, with explicit `errorBoundCertified: false`. Every RHS call,
including entry validation and rejected attempts, is counted; domain RHS work
and geometry checks are separately reported. A hard evaluation cap returns
`incomplete`, not a fabricated endpoint. Quaternion attitude is explicitly
incomplete; no angular endpoint is represented as a complete rigid-body state.

Outward upper derivative bounds and conservative lower slip/spin norms guard
approaches to zero directions. The scalar bounds are
U = 7*mu*g/2 + 5*g*rollingLength/(2R) and
W = 5*mu*g/(2R) + 5*g*rollingLength/(2R²).
These guards apply locally to the numerical state and cannot turn accumulated
embedded estimates into a global physical proof. Uncertain approach, missing
geometry, invalid arithmetic or exhausted work returns unsupported/incomplete.

The focused suite has 26 passing tests (1.41 s). The 0.04-second general-angle
fixture used 24 RHS calls at a 1e-5 per-observable budget and 156 at 1e-10, plus
one domain RHS evaluation and 48 geometry checks. This interval corresponds to
38.4 original source timesteps; RHS calls and full 3D solver calls are different
work units, so those counts alone are **not a speedup claim**. Against a separate
fixed-step RK4 calculation, refined from 512 to 1024 steps, maximum state
component differences were 9.60e-8 and 2.15e-12; the reference refinement delta
was 2.66e-14. This is numerical consistency evidence, not an independent physical
accuracy guarantee. Tests also cover exact axial/normal-spin reduction,
90-degree rotational covariance, missing geometry, capped work, guarded
approach to a boundary, actual native no-mutation, and geometry preemption.

Production and experimental world-bridge defaults remain unchanged. General
regime transition handling, rigorous error/event ordering bounds, complete
attitude and qualified 3D contact handoff remain open before GPU/full-shot use.

The domain's `geometryTests` counter counts its explicit AABB separation tests;
source-state capture additionally performs native shape/contact validation.
Those validation queries are not included in that counter. No total-operation
or elapsed-time speedup is inferred from the reported sub-operation counts.

### Quaternion follow-on

The subsequent numerical-state checkpoint now includes attitude in the same
DP stages: qdot = (omega-world, 0) quaternion-product q / 2. The multiplication
is on the left, and each stage uses its own simultaneously evolved angular
velocity; integrating only the endpoint spin would be wrong for changing axes.
The required `errorBudget.attitude` is an **absolute quaternion-component**
budget, not radians. It joins the embedded error estimate and adaptive step
selection. `attitudeComplete: true` means the numerical state includes attitude,
not that an orientation-error bound or physical shot has been certified.

No intermediate or endpoint normalization is applied. Raw quaternion, initial
norm, final norm and norm drift are returned with `normalizationApplied: false`;
no projection silently hides a defect. Initial native f32 quaternion norm need
not be exactly one, so drift is reported relative to that initial norm too.

Tests include fixed-axis analytical rotation left-multiplied onto a nonidentity
90-degree-Y initial orientation, noncommuting changing-axis motion against a
separate tighter RK4 quaternion calculation, rotational covariance and norm
drift. In the 0.04-second tight-budget fixture, quaternion component difference
was 4.90e-14 and norm drift -4.15e-14. These remain numerical consistency checks,
not rigorous global attitude bounds. The focused suite still contains 26 tests,
with the segment test expanded to include these checks. No bridge/default
activation occurred.

## Raw candidate to full-rest integration

`source-law-raw-candidate.mjs` is the first end-to-end opt-in runner in this
branch: immutable bound raw settings and source snapshot/game state, genuine
`PhysicsLab.strike`, original cue and 3D world solver, complete external event
journal, original route observer and original Game, through **all objects
sleeping with no cue**. Source `anyMotion` thresholds are not substituted for
that rest condition. Existing source request binding/finalization policy is
reused; no scoring rules were reimplemented. The route query's early-stop
boolean is intentionally ignored so that late fouls and all-body rest remain
observable. Original per-outer positive-impulse/kiss observation also continues.

No automatic live prepared-boundary certificate currently exists. After cue
removal the dispatcher makes one guarded spin-adapter attempt with truthful
`preparedBoundary: false`; it receives unchanged original fallback and avoids
repeating a guaranteed failed admission every step. Therefore actual raw-shot
skips are **zero**, not simulated savings. No accelerated result can become a
success merely because an experimental numerical segment completed. This
runner's successful outputs are original-source evaluations themselves.

Both real-input holdouts completed, matched independently stepped original
endpoints, complete journals and Game.finish outcomes, and left the input world
and history unchanged. The extended bounded test took 2.08 seconds:

| Raw input | Outer steps | Actual native calls | Full-rest result |
| --- | ---: | ---: | --- |
| Two-red goal | 5,039 | 5,480 | +1, verified final gameplay |
| Goal then opponent contact | 4,974 | 5,415 | -1, evaluated negative |

The latter goal occurred at source time 0.95417 s, foul at 1.53125 s, and the
runner continued to full rest at 5.68542 s. Preparation was 484 original steps
plus 72 constructor settling steps, separately excluded from candidate counts.
Each input native snapshot was 39,269 bytes; serialized journals used 2,002 and
2,295 bytes. These are explicit buffers, **not total/native heap measurements**.
See the [raw integration receipt](evidence/source-law-raw-candidate.json).

Native-step caps, outer/horizon caps, wall caps and journal caps produce
`incomplete`, never a miss or a score. Cancellation is separate; unsupported
input is separate. Tests include an operational stop after the genuine early
goal (no final score), a ten-native-call cap, prestrike cancellation and default
off. The source contact journal is preserved independently of the capped
presentation history; it is not claimed to expose every internal solver impulse.

The next concrete blocker to accelerated raw-shot evaluation is live regime
admission and an accuracy-qualified transition into/out of the original 3D
contact solver—not missing raw-input or rule-result plumbing anymore. Source
contact penetration/load transients and the measured hybrid postimpact
angular discrepancy remain unresolved. No synthetic projection, GPU port,
production/default change or whole-shot no-accuracy-loss claim was introduced.

Restore ownership is acquired before native allocation, so malformed metadata
that throws during source restore still frees the partially allocated world and
queue. A bad-collider-handle regression observes both frees. Journal byte caps
include serialized array brackets and commas. Additional controls cover an
asynchronous cancellation, journal exhaustion and wall-budget exhaustion.

### One actual live-admission sample per raw shot

The runner now records one read-only sample at its first post-cue guard attempt,
not a whole-shot trace or a future-load certificate. Both holdouts give the same
sample at absolute source time 0.5114583 seconds:

- Four of four native sphere centers are below exact support by 67.48–68.00
  micrometres; all four current vertical velocities are zero.
- One cue ball translates, has tangential spin, and fails strict axial equality.
  The other three balls are exactly stationary and sleeping; their zero slip
  is not evidence of three moving rolling-regime failures.
- Cue is absent. Native gravity -9.8100004196167 equals `Math.fround(-9.81)`;
  the then-current exact host-number equality guard reported a representation
  mismatch. The fix below does not qualify the supported dynamics.
- Last native h is approximately 1/61440 s. Moving cue's cached cloth impulse
  3.353e-5 N s corresponds to approximately mg at that h. It must not be read as
  1/64 mg using the outer timestep. Sleeping-ball cached impulses are not
  current-step normal-force measurements. None proves future constant load.
- Normal cue spin is about -5.72e-30 rad/s. A threshold must not silently erase
  it. Its independent exact spin-stop event can instead be composed into the
  general segment without changing the torque law.

The immediate integration decisions are therefore separate: native-gravity
representation validation is repairable; exact separable normal-spin stopping
can avoid an artificial RK boundary stall; supported-contact evolution and
native contact handoff remain physically unqualified. No center-height
projection, near-axis threshold, forced load, or automatic live admission was
introduced by this diagnostic. The sample adds no world steps.

### Gravity representation and separable spin-stop plumbing fixes

Native gravity validation now accepts either the source configured Number or
its exact f32 representation returned by restored worlds. It does not accept
arbitrary nearby gravity. Native load acceleration is consistently the f32
value, including fresh worlds whose JS getter retains the configured Number.
Original patch cap gravity remains the configured value. Prepared friction uses
N=m*g-load; prepared rolling/spin torque uses m*min(g-load,g-cap) times its
original resistance length. Both quantities are exposed rather than silently
identified. This is propagated through normal-spin, axial/general and landing
consumers; down-rounded g=9.7 is tested as well as default 9.81.

General numerical stages now evaluate independent normal spin by its closed
form at the same stage time. A representable stop splits the interval, then
normal spin remains zero and the next adaptive step is reseeded at useful
scale. No arbitrary small-spin threshold is used. A stop time below Number's
representable range is explicitly flagged; t=0 retains the supplied spin and
positive times use the stopped value. The computed stop remains a numerical
candidate, not a certified event-ordering bound. Zero embedded discrepancy is
handled before a potentially underflowed local error allowance is divided.

Tests cover negative normal spin -5.72e-30, the smallest native f32 nonzero
scale (-1e-45 input), a representable in-window stop, zero spin drag, separate
load/cap torques, fresh/restored gravity and continued rejection of penetrating
support. Two earlier numerical test expectations now use actual native gravity
(axial distance and landing-root-edge placement); no assertion tolerance was
widened. The focused suite passes 28/28. The raw full-rest holdouts still use
5,480/5,415 native steps and **zero skipped steps**. Support/contact evolution
and handoff accuracy—not representation equality or tiny normal-spin stalling—
remain the live-acceleration gate. No live support guard was relaxed.

## Actual supported-depth handoff diagnosis

Exact ideal-plane height is sufficient for the prepared prototype, but is not
necessary for an original native sphere to be supported. A bounded raw-shot
observation examined 24 original post-cue frames (25 ms), without changing any
state. Normal remained exactly vertical, vy remained exactly zero, no other-ball
impulse occurred, and cloth impulse was constant at 1.000000067 mg*h. Native
center y nevertheless drifted downward 54.0 nm. That observation does not prove
an exactly stationary native height or explain the internal correction cause.

The authorized diagnostic then cloned the **actual post-cue snapshot twice**.
One clone ran 24 original frames. The other received a conditional original-law
horizontal/angular/quaternion evolution while retaining original y/vy and
native contact state—no ideal-plane projection or private cache injection.
Actual hull/pair force-bound tubes excluded other contacts over this interval.
Because transverse components were nonzero, this used the existing nonaxial
RHS with a small diagnostic RK4 calculation, not a falsely axial closed form.
Its 64/128 subdivision comparison differed by 2.93e-14 state components; that is
numerical consistency, not physical acceptance or an error bound.

During all six subsequent original source steps, both clones had the **same
cloth impulse** 0.002145937644 N s and zero vy. The previous projected-plane
1/12-mg then 11/6-mg handoff transient did not occur. At prefix end, hybrid minus
original differences were x +1.639 micrometres, y +54.0 nm, vx -2.36e-5 m/s and
omega-z -0.004150 rad/s. After six source steps, angular difference was
-0.004127 rad/s, without the earlier large transient growth. Original native
calls were 30 versus 6, but the diagnostic also used 261 RHS calls plus 517 for
its reference check; this is **not a net speedup measurement**. Total diagnostic
wall time was 0.243 s. See the [receipt](evidence/source-law-live-support-diagnostic.json).

This supports investigating a supported-contact constraint certificate that
preserves actual state, rather than insisting on one geometric representation.
The required invariant is vertical support/zero vertical motion and controlled
normal load decoupled from horizontal slip throughout an all-contact-safe
interval, plus a valid contact handoff. A few stable past samples alone do not
establish that invariant for future times. No runtime support guard was relaxed,
no error tolerance widened, and raw full-shot acceleration remains unqualified.

### Contact-anchor accounting, without fitting a replacement radius

The same bounded window also records contact local points, poststep solver
points, native inverse inertia, prepatch velocities/spins and actual patch torque
calls. Stored solver-point lever length is 30.71552–30.71586 mm, versus nominal
R=30.750 mm: about half the observed penetration shorter. This confirms a
finite native contact-geometry difference, not its complete impulse history.

Measured prepatch angular change sums to -3.98365474 rad/s. Using native mass
times observed velocity differences as an **impulse proxy**, radius R predicts
-3.98589303, while stored point lever predicts -3.98144871. Assuming instead
saturated friction mu times measured normal impulse, the stored lever predicts
-3.98335818; R predicts -3.98780464. Neither proxy is a measurement of every
solver tangential impulse. Public tangent fields are zero in these records,
and repeated f32 velocity updates need not recover exact applied impulse.
The poststep point likewise is not proven to describe every internal stage.

Thus a midpoint-lever contribution is plausible and the geometric shortfall is
observed, but no fitted/effective radius is adopted. This finite contact
representation must also be distinguished from the ideal rigid-sphere
continuum law; numerical source agreement and physical accuracy are separate
questions. Both remaining discrepancies and assumptions are retained in the
receipt. No production guard, torque law or acceptance tolerance was changed.

## Exact condition-only negative termination

The raw runner now has a separate explicit `purpose: 'condition-only'`;
`'full-rest'` remains the default reference behavior. After a completed original
outer step, the existing immutable source finalization policy may prove an
irreversible pending-game foul. This first integration uses only that original
foul proof, not newly invented early misses or broader route heuristics.
Cancellation, wall/journal exhaustion and invalid source states take priority.
A native-call budget exactly equal to the completed negative-proof step permits
that proof; a budget interrupted mid-outer still produces incomplete.

A condition-only permanent failure has `success: false`, the existing policy
termination reason, and a prefix journal. It has **no final score, game-finish
result or complete trajectory claim**. Successful goals continue to all-body
rest. No additional authoritative replay is needed after this original-source
negative proof.

On the real late-opponent holdout, condition-only stops after 986 outer / 1,427
native calls instead of the full-rest reference's 4,974 / 5,415: 3,988 fewer
native calls (73.6%). The earlier two-red goal still did not terminate the run;
the later opponent contact supplied the permanent-failure proof. Sample elapsed
times were 131 ms versus 322 ms. The positive holdout still uses 5,480 calls and
finishes original gameplay. Tests compare identical condition outcomes and
prefix journals. See the [receipt](evidence/source-law-condition-only.json).

This carries an **already existing search-policy optimization** into the new
raw-candidate path. The comparison baseline is the deliberately reference-heavy
new full-rest runner, not the old application search, so this is not evidence of
a new speedup over the existing app. Physics and all executed source steps are
unchanged; no approximation is involved in this terminal-condition reduction.

## Explicit retained-native-support shadow integration

A separate default-off domain now models one moving supported sphere with all
other spheres sleeping and exactly zero linear/angular velocity. It preserves
the actual native center height and vy; it never projects onto y=R. Guards
require centered equal-radius native spheres, no external force/damping/joints,
original source material rules, a horizontal cloth box and finite top-face
intersection without reaching the bottom/edges. Moving support must have one
finite penetrating contact, exact physical upward normal and finite positive
normal impulse. Sleeping passive manifold values may be historical; their
actual geometry and zero-motion sleep condition are checked separately.
All native hulls and moving/passive sphere pairs are excluded by force-bound
envelopes. Packed endpoint regime/geometry is checked before mutation.

The continuum closure is **conditional persistent flat spherical support**.
Past positive impulse is not a certificate of future native load, and these
checks do not claim the exact finite-step contact solver trajectory. Domain and
bridge explicitly report unqualified native evolution. Nominal physical radius
is unchanged; no midpoint/effective-radius fit was introduced.

`advanceExperimentalRetainedSupport` uses the existing adaptive full-state
solver. The real 24-frame prefix + six-source-frame resume case now needs 39 RHS
calls including domain and packed-state checks, plus 66 explicit geometry
comparisons, rather than the diagnostic's 261 RHS calls. All six resumed loads
still match reference. Original y/vy and native caches are preserved. Native
setter quaternion packing is reported. Intermediate source trail/path samples
are not replayed; this experimental bridge explicitly does not claim complete
source observer bookkeeping.

A native matrix capture bug was also corrected: `SdpMatrix3`'s six semantic
entries are read through m11/m12/m13/m22/m23/m33. Iterating an entire backing
array previously included unrelated tail entries and could falsely classify
spherical source bodies as constrained. No numeric tolerance was widened.

`evaluateExperimentalRetainedCandidate` owns one immutable/private input clone
for both shadow and verification, so caller mutation across awaits cannot
change the replayed shot. Any experimentally advanced result remains an
**unverified shadow**; authoritative outcome comes only from original-source
replay. A source-only result with no skipped physics needs no duplicate replay.
Exact original permanent failure may terminate before experimentation via the
existing policy. Native/outer work budgets and wall budget cover both runs.
Journal byte caps are explicitly per-run; aggregate serialized journal usage
and the two-run maximum are reported, not mislabeled as a native heap cap.

The two actual raw inputs retain the observed +1 / -1 outcomes, but are not
accuracy-qualified: late opponent contact shifts by one source frame
(1.5322917 versus 1.53125 seconds), and rest shifts by one or two frames.
Each shadow skips 24 source frames and uses 39 RHS calls:

| Input | Shadow native calls | Source verification calls | Combined native calls |
| --- | ---: | ---: | ---: |
| Positive | 5,454 | 5,480 | 10,934 |
| Late foul | 5,390 | 1,427 (permanent-failure proof) | 6,817 |

Warmed-in-process sample shadow times were 374/300 ms; combined times were
713/419 ms. These are individual observations, not a stable throughput
benchmark. Mandatory verification clearly makes this **not an overall speedup**
over source-only evaluation. See the [raw shadow receipt](evidence/source-law-retained-raw-candidate.json).
Tests cover actual source agreement of the authoritative result, immutable
replay identity after caller mutation, work accounting, non-mutating budget
refusal, passive-body guard and retained support/resume. Production/UI defaults
remain untouched. Further rollout awaits a resolved accuracy acceptance
criterion; no additional engine expansion is implied by this checkpoint.
