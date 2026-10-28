# CPU/GPU identity: new acceptance target

The user's 2026-10-27 clarification is **no difference between CPU and GPU
calculation results**. Matching the existing Rapier implementation is a separate
physical-validation reference, not the definition of cross-backend identity.
The production backend remains unchanged while this contract is implemented.

## Sufficient ball state, without unnecessary orientation work

For the declared isotropic perfect spheres with uniform materials, position,
linear velocity and angular velocity are sufficient for search physics. Ball
orientation does not change sphere geometry, scalar inertia or the contact/cloth
laws. CPU and GPU deliberately omit quaternion advancement from candidate search;
this is exact removal of irrelevant calculation, not a dropped physical effect.
Winner visualization may reconstruct orientation separately. Older component
flags stating `attitudeComplete:false` describe that absent visualization state,
not an outstanding sphere-dynamics qualification gate. Anisotropic cue rods and
joints are different: their orientation remains physically necessary during the
future raw-strike stage.

## Current concrete gaps

| Component | CPU side today | GPU side today | Identity status |
| --- | --- | --- | --- |
| Raw pose | Original JS Number / native source pose | Native f32 polynomial trigonometry | Tolerance-tested, not bit identity |
| Cue application | Original JS/native impulse boundary | Direct f32 compliant cue component | Tolerance-tested, not a full strike |
| Prepared event loop | f64 planar Coulomb, quartic isolation, EPS 1e-8 | f32 frictionless constant velocity, quadratic, EPS 1e-5 | Different laws and thresholds; not interchangeable |
| Original-law nonaxial segment | Adaptive JS Number DP5(4), quaternion | Not ported | No GPU counterpart |
| Actual raw shot / rules | Original source runner, full-rest or permanent-failure proof | Not integrated | No GPU shot result |

The withdrawn Coulomb GPU draft stays withdrawn. The successful retained-support
shadow integration is not a shared CPU/GPU kernel and does not close these gaps.
Its replay remains authoritative only for the original-source runner.

## Numeric contract must precede physics integration

Identical source expressions and `Math.fround` after each CPU operation do not
establish portable identity with native WGSL f32. WGSL allows floating-point
reassociation/fusion, accuracy ranges and subnormal handling that matter at event
and rule boundaries. See the primary specification's
[floating-point accuracy](https://www.w3.org/TR/WGSL/#floating-point-accuracy) and
[reassociation and fusion](https://www.w3.org/TR/WGSL/#reassociation-and-fusion).
A measured exact match on SwiftShader is evidence for that backend and corpus,
not a universal floating-point guarantee.

A compact bounded integer/fixed-point direct kernel is a candidate route to exact
CPU/GPU identity without a bytecode interpreter, private Rapier heap mirror or
software binary64 engine. Its input quantization, range and event-time resolution
must be explicit and physically validated separately. **Deterministic does not
mean physically accurate.** Overflow, unresolved ordering and unsupported physical
modes must remain non-results, never passes or misses.

Shared implementation means named ordinary arithmetic functions, matching layout,
operation order, boundary policy and tests on both backends; not a generic runtime
instruction set. One invocation owns all balls in one candidate. Integer event
selection alone can prove identity only for supplied event records, not their
physical prediction or collision response.

## Implemented first physical kernel

`deterministic-axial.mjs` now computes the **same physical segment arithmetic** on
CPU and GPU, not only selection of host-computed events. Ordinary CPU and WGSL
functions implement the same explicit integer contract; neither backend runs an
instruction stream. Initial source-law coefficients are computed and quantized
once, then identical words are supplied to both backends.

Scope: three or four prepared, same-X-lane spheres, genuine source-law axial
sliding or stationary normal spin, within the existing slip/tangential/normal-spin
regime horizon. The coefficients come from `prepareCollinearSegment`, including
rolling torque while sliding and distinct load/cap gravity where supplied.
A caller must explicitly supply a prepared no-static-contact horizon. It is not
an actual-world geometry certificate. Source torque radius and optional collision
radius are distinct; the latter alone enters the pair-contact calculation.

- Position, velocity, half-acceleration and collision radius use Q24 integer
  units. Position quantum is 59.60 nm. Angular state/rate use Q20 units.
- Time uses Q20 seconds: 0.953674 microseconds/tick, at most 65,535 ticks
  (0.0624990463 seconds). Requested duration is truncated, not silently extended.
- Absolute position/velocity/half-acceleration coefficients are limited to 16
  units; angular/rate coefficients to 1,024. Invalid coefficients/initial contact
  are unsupported; no saturating arithmetic is used.
- A 32-by-32 product uses four 16-bit partial products and two u32 limbs. CPU
  partial sums remain below 2^32 and hence exact JS integers; this is **not** a
  claim that arbitrary 32-by-32 JS Number multiplication is exact.
- Outward floor/ceil intervals enclose each relative quadratic. Left-first
  bisection discards certified-separated intervals, not uniformly sampled
  trajectory steps. At a one-tick candidate, separated/inside endpoint bounds
  and a nonzero derivative interval establish an entering bracket. Ties,
  grazing or uncertain endpoints are unsupported; exhausted node budgets are
  incomplete. No future event means observation-horizon completion, **not rest
  or miss**.
- All sphere positions, velocities and angular velocities advance to the same
  lower bracket tick (or the proven encoded-model observation horizon).
  Quaternion attitude and collision response are not implemented here. There is
  no scoring authority, live bridge, raw strike or full-shot qualification.

### What is exact, and what is bounded

CPU/GPU equality is a word-for-word property of the integer calculation. The
interval contact proof concerns the **encoded coefficient/radius polynomial**,
not the unquantized original continuum trajectory. In particular, an original
near-grazing contact is not certified by these encoded bounds. No physical
acceptance follows merely from backend equality.

For Q=2^24, W=2^20 and elapsed t, rounding each source coefficient once and flooring
terms gives these per-body state error bounds relative to that source-law segment
at the **same time**:

- Position: `[0.5(1+t+t²)+2]/Q` (at most 0.152 micrometers).
- Velocity: `(1.5+t)/Q` (at most 0.094 micrometers/second).
- Angular velocity: `[0.5(1+t)+1]/W` (at most 1.461e-6 rad/s).
- Collision radius input error: at most `0.5/Q` per sphere.

These are quantization/rounding bounds, not physical-law or measured-table error.
The one-tick bracket is for the encoded root. There is no uniform original-root
*time* error near zero relative normal speed: converting position error to time
needs a nonzero speed lower bound. At the profile's maximum 18 m/s endpoint speed,
one tick corresponds to about 17.17 micrometers per body. State bounds are below
the earlier direct component's 2e-5 m and 2e-4 rad/s observable tolerances, but
those component tolerances are **not whole-shot acceptance criteria**, and maximum
angular rate times a tick can exceed that angular tolerance. No tolerance changed.

### Measured checkpoint

A native SwiftShader run compared every output word for 72 candidates (3,456
words), including 64 deterministic holdouts. Results were identical: 47 entering
brackets, two no-pair observation horizons, 22 unsupported and one incomplete.
The holdouts produced 45 brackets and 19 deliberately unresolved near-boundary
boxes; no threshold was relaxed to convert them into results. An initial test
expectation of at least 48 brackets was corrected to record these actual outcomes,
not by changing the solver. Independent BigInt checks validate the selected
polynomial endpoints and packed-state rounding; 1,002 wide products are checked
against exact multiplication.

See `docs/evidence/deterministic-axial.json` for compile/buffer/timing measurements.
Full state readback is diagnostic for equality tests, not a proposed production
result stream. SwiftShader is software rendering: no hardware speed claim.

Run CPU tests with `node --test tests/deterministic-axial.mjs`; opt into the native
check using the existing trusted `GPU_NATIVE_MODULE`, `REQUIRE_WEBGPU=1` and
SwiftShader ICD environment. No dependency install is required.

Next integration gaps are shared raw-pose/cue arithmetic, general-angle motion,
actual 3D hull/ball contact timing and response, regime transitions and
full-rest/rule termination. This single bounded segment is not a replacement for
those effects, and the production app remains unchanged.

A second bounded batch exercises the requested independent-candidate axis:
**1,024 varied original-law prepared candidates, 49,152 output words, all exactly
identical across CPU and native WGSL**. With max128 interval nodes per candidate,
896 yielded entering brackets and128 remained explicitly uncertain; none exhausted
the budget. Total interval nodes were24,034. The measured warmed CPU evaluation
was16.58ms and SwiftShader submission-to-completion23.33ms; this is not a speedup
claim. Input/output/readback each196,608B, total589,824B. The72-case test separately
covers partial final workgroups, repeated dispatch and nonzero typed-array
byteOffset. Latest shader compile was170ms for3,730B of WGSL.

## Composed boundary/state/next-event recurrence

`deterministic-spin-recurrence.mjs` composes the physical segment with separable
normal-spin stops. Both wrappers use the **same direct WGSL segment function**;
the CPU recurrence likewise calls the existing integer segment implementation.
The production app and original-source replay authority are unchanged.

The initial translational/tangential-angular polynomial stays anchored at the
original state and absolute tick. A normal-spin stop changes only that body's
normal angular channel/rate. Subsequent pair prediction and all-body advancement
use the original anchors, not rounded endpoints as new initial conditions.
Tests verify unaffected state words are identical to a one-shot advance.

Wide-product comparisons locate the exact encoded rational normal-spin stop in
an integer-tick bracket. An exact-grid stop has equal lower/upper endpoints;
off-grid stops retain both endpoints. If pair prediction proves no contact
through the upper tick, the normal spin there is exactly zero under the encoded
clamped spin law. It is safe to continue the unchanged planar/tangential laws.
No midpoint or rounded timestamp is declared the true stop time. Independent
normal stops in the same upper tick commute and share a mask; their exact-grid
bits remain distinct. A pair bracket reaching that upper tick is unsupported,
not arbitrarily ordered before or after the spin stop.

The kernel returns a bounded trace of at most four spin-event groups. A group
budget is checked only when that stop actually wins; it cannot hide an earlier
pair. The interval-node budget is shared across every recurrence call. Failure
preserves the latest successfully advanced state/time, emits incomplete or
unsupported, and never claims pass, miss or complete physical rest.

Sphere orientation is intentionally omitted under the symmetry above. Pair contact is only returned
as a bracket; there is **no** frictionless restitution shortcut. Physical source
normal-stop time can differ from its quantized representation; the earlier
same-time state-error bounds and encoded-only contact qualification still apply.
The normal spin clamp is nonexpansive, so coefficient error is not amplified by
stopping. No original continuum event-order certificate is asserted.

The current direct implementation reruns pair interval isolation from the origin
at each new spin horizon, although normal spin cannot change that trajectory.
This redundant work is included in the pair-node count. The count does not mean
all integer instructions: stop-bracket binary searches and wide products are
additional work. Future reuse is possible only under that explicit independence
invariant; no speed claim is based on omitting those operations.

Latest combined native test: **8/8 pass**, run sequentially through
`npm run test:deterministic-event` with the native environment enabled. Recurrence:
141 candidates,9,024 complete state/trace words,266 stop records, all CPU/GPU
identical. Shader7,200B, compile434ms,256B/candidate,108,288B combined buffers;
measured CPU4.67ms and SwiftShader submit2.81ms for this small prepared batch.
These are a single software-backend receipt, not hardware or whole-shot speed.
Baseline1,024-candidate49,152-word equality also passes after the shared-function
refactor (baseline shader now4,116B). Records are in the two deterministic evidence
JSON files. Initial WGSL reserved identifier `target` was alpha-renamed before
successful compilation; numerical workload was unchanged.

### Next physical contact integration: requirements, not a shortcut

A grounded pair with tangential spin cannot be treated as isolated1D restitution.
Even with an axial center normal, contact-point tangential velocity can have
vertical and lateral components. Pair friction can produce a vertical impulse,
change support activity or cause flight, and normal spin can produce lateral
motion. The minimum valid next contact component therefore needs:

1. A deterministic interval policy for contact time and positions, with explicit
   time/penetration error bounds. Never call the bracket midpoint exact.
2. A bounded pair-plus-cloth contact cluster using actual sphere contact arms,
   masses/inertia, source restitution and pair/cloth friction coefficients.
   Solve unilateral support and normal restitution together with tangential
   stick/slip constraints; preserve equal/opposite impulses and angular torque.
3. Full3D linear/angular output and explicit support release/landing state.
   A resulting off-axis or airborne state must remain unsupported by the current
   axial propagator, not projected back into its supported plane.
4. Shared deterministic arithmetic for the contact solve, bounded iterations and
   nonconvergence status; independent momentum, energy/dissipation, friction-cone
   and support-complementarity checks. CPU/GPU exact equality alone is not this
   physical validation.
5. A general-motion implementation capable of continuing the
   resulting state, followed by raw strike and full-rest rule integration.

This defines the next genuine solver gate. It has not been implemented by
silently dropping the coupled effects to make the event loop appear complete.

## GPU-canonical coupled pair/cloth impact component

The user's further clarification makes the validated shared GPU logic the
canonical **program** result; the CPU runs that same logic. Independent physical
checks below validate that logic. They are not an obligation to reproduce the old
Rapier implementation or to run an old-engine replay beside each candidate.

`deterministic-contact.mjs` implements a bounded **instantaneous** equal-sphere
pair-plus-two-cloth-contact solve. It admits X-Y motion with omegaX=omegaY=0,
equal mass/radius/height, and initially vyA=vyB=0. Other contacts are excluded by
an explicit prepared-domain assumption, not inferred from an arbitrary caller
label at runtime. The radius range starts at4096 Q24 units; all input values are
bounded before signed arithmetic. Unsupported modes/overflow and iteration-budget
failure are explicit non-results, never miss/pass.

Finite overlap is supported without moving either center. One encoded shared
pair point is the floor-rounded midpoint of center X coordinates. Each cloth
point is midway between the encoded sphere bottom and plane y=0. Thus pair arms
are lA=cX-xA, lB=xB-cX and cloth arm h=y-cY; they are not blindly replaced by R.
The component validates the declared midpoint policy again on raw rows. For
normalized impulse lambda=J/m and c=-R*omegaZ:

- Pair tangent slip = vyB-vyA+(lA/R)cA+(lB/R)cB.
- Pair tangent effective mass denominator =2+2.5[(lA/R)^2+(lB/R)^2].
- Pair tangent impulse changes cA/cB by2.5(lA/R)lambda and2.5(lB/R)lambda.
- Cloth slip =vx-(h/R)c; denominator=1+2.5(h/R)^2; its tangent impulse changes
  c by-2.5(h/R)lambda.

At exact touch these reduce to7 and3.5. The angular-momentum ledger includes the
actual external cloth points, including negative cY for penetrating contacts.
The pair's common point is necessary for internal torque cancellation.

A fixed-order projected accumulated-impulse iteration applies pair normal,
pair tangent, cloth-A normal/tangent and cloth-B normal/tangent. Coulomb clamps
apply to **total** tangential impulses, with changes applied to the bodies; a
shrinking normal impulse also retracts excess tangent impulse. Positive cone
products are floor-rounded, so encoded impulses never exceed the encoded
friction cone. Restitution uses the original pre-solve pair approach velocity.
Normals are unilateral; positive vertical velocity and zero cloth normal impulse
are retained as liftoff, not projected back onto the plane.

The input friction/restitution coefficients are **effective combined material
values**. An adapter to original scene data must use the actual native Multiply
products, not square the source parameters again. Initially downward motion is
refused; therefore the zero normal cloth velocity target does not silently omit
an incoming cloth restitution event. Smooth cloth/sliding/rolling resistance
belongs to finite elapsed motion. This zero-duration impulse solve adds no
invented full-frame rolling torque (the existing smooth torque cap is mg*dt).

### Arithmetic, convergence and validation

Q24 ratios/effective masses/impulses use the same bounded integer wide multiply
and u64/u32 long division on GPU and CPU. Division is32 bounded bit iterations;
zero denominators, overflowing quotients and subsequent intermediate range
violations are rejected. Nearest rounding is explicit except strict floor cone
limits. No software floating-point engine or instruction VM is involved.

Up to128 iterations and an explicit residual budget in Q24 velocity/normalized
impulse units bound the solve. Tests freeze16 quanta (9.537e-7) and64 iterations;
no thresholds were widened. The residual includes normal complementarity,
friction-cone membership and sticking/saturated-sliding sign conditions. A
numerically converged status is **not** whole-shot or real-world acceptance.
Energy/angular invariants are checked independently in tests, not misleadingly
advertised as a runtime global proof. Work counters include every scalar division
and multiplication, and returned iteration/residual/impulse words are compared.

The independent binary64 oracle forms the full omegaZ contact Jacobian and
physical inverse inertia, rather than copying the fixed-point c formulas. It
validates the GPU program's equations, not old CPU numerical chronology. Across
the prepared/contact holdouts, maximum state difference was6.32e-7m/s in linear
or surface-spin velocity, linear-momentum ledger error0 and normalized angular
ledger error7.49e-9. Energy did not increase beyond the frozen1e-6 test budget;
all exact encoded Coulomb inequalities passed. These are bounded-test evidence,
not a general proof for every future contact cluster.

Five integration regressions start from actual encoded axial event rows. Tests
evaluate their upper tick with exact integer arithmetic, derive a relative-speed
penetration budget and pass those unchanged positions to this contact component.
All retain finite-overlap geometry and converge. This is a **test-only staged
handoff**, not yet a resident GPU event-to-contact bridge. A timeBracket label and
caller overlapBudget alone are not an actual-world clearance certificate.

See `docs/evidence/deterministic-contact.json` for full native counts/timing.
The suite also compares1,006 wide-division cases against exact integer answers on
CPU and GPU, including carries, zero division and quotient overflow. The ordinary
`test:deterministic-event` manifest now includes contact tests; native jobs run
sequentially when enabled. Production behavior is unchanged.

Remaining integration is concrete: resident event-output-to-contact packing and
validated all-other-geometry exclusion, then mixed airborne/supported next-event
motion for genuine liftoff, general-angle contacts, raw strike and
full-rest rules. The contact result is not silently forced into the old axial
propagator when its motion domain has changed.

## One fully resident event-to-contact transition

The next integration gate is now implemented in
`deterministic-resident-transition.mjs`. One command submission executes four
separate direct compute phases:

1. Axial event prediction from original candidate anchors.
2. Guarded evaluation of **every ball** at the event bracket's upper tick and
   construction of the real-arm contact packet.
3. Coupled pair/cloth impulse solve.
4. Merge into the full candidate physical state.

All phase handoffs are storage buffers. No intermediate readback, host event
choice, host contact packing or host physics occurs between them. The CPU mirror
performs the same integer operations as a separate backend/test reference.

### Explicit scene and admission contract

The immutable512-byte scene contains common world Y/Z, clothTop, equal mass,
physical inertia radius, effective materials and motion-law material provenance,
a finite cloth footprint and up to16 conservative static AABBs. An actual hull
may be represented by an outward bound; overlap is rejected, not interpreted as
collision with an invented plane. The declared prepared scene must include every
other static obstacle. This is not arbitrary-live-scene admission.

`packResidentCandidates` checks candidate Y/Z/mass/physical radius and the full
motion material against the scene **before** axial packing omits that metadata.
The low-level packed-row API requires this trusted-producer contract; it cannot
recover discarded metadata. Scene row ranges, reserved fields, materials and
bounds are validated again. Footprint limits round inward; obstacle limits round
outward. Encoded collision radius must equal the separately declared physical
radius in this first profile; mismatch is explicitly unsupported, never silently
substituted. Zero unsupported angular components/rates are required.

Before constructing contact, every other pair is excluded using relative
quadratic interval bounds over the entire[0,upper] interval. Every ball's swept
bounds must stay inside the finite cloth and disjoint from all static bounds.
The sphere envelopes add4 Q24 units, covering the earlier per-body coefficient/
state packing bound plus radius rounding; nonselected pair exclusion adds8units.
Overlapping conservative bounds remain unsupported. Cloth support is excluded
from the obstacle list only under the explicit prepared flat-support assumptions.

Selected-pair penetration is checked against a derived bound: maximum relative
speed through upperTick times the one-tick bracket width, rounded outward, plus
four position quanta. Declared cloth penetration is tracked separately from this
pair bound. Neither sphere is projected. Contact coordinates are translated
relative to the declared clothTop, while returned positions remain in world
coordinates. The full lower/upper bracket remains visible; upperTick is not
misrepresented as the exact collision time.

### Honest returned state

The result explicitly stores `stateTimeTick` separately from the event bracket.
All body positions/spins are evaluated at that same upper tick from original
anchors. The selected pair's resolved velocities/angular state are merged back;
uninvolved balls retain their independently advanced state. Surface-spin to
omega conversion uses shared wide integer division with explicit rounding and
overflow refusal.

Resolved bodies carry `coefficientsDirtyMask`: their old acceleration/angular-rate
coefficients are no longer valid. Those coefficients are deliberately absent from
the returned physical-state layout. Original anchors remain immutable, and no
implicit rounded-state restart is introduced. `nextRegimeNeeded` is always set
for an admitted contact boundary. Positive vertical velocity is retained in
`positiveVyMask`; this is an **observation**, not a certified airborne-mode decision
when complementarity only holds within a numerical residual. The next dispatcher
must inspect geometry, impulse and residual information before admitting flight
or supported motion. Nothing is projected back into axial motion.

Status7 means one transition completed and further motion-domain work is pending;
it never means full-rest completion, pass or miss. Existing event-budget incomplete
status is preserved. Unresolved contact iteration likewise remains incomplete.

### Measured resident checkpoint

Native74-candidate test:22,496 final/intermediate words exactly match the CPU
mirror, including reversed input order, byte-offset views and malformed/profile/
budget cases.67 completed one-contact transitions; all others remain explicit
non-results. Static obstruction and solver-budget scenes also match. There are
**four dispatches, zero intermediate readbacks, zero host-physics handoffs and
one final diagnostic readback**. All intermediate buffers are copied for the test
only after the final merge phase.

The four shaders total20,598bytes. Latest compile1.04s and SwiftShader submission
3.46ms;74 candidates allocate194,688bytes including the512-byte scene and89,984-byte
diagnostic readback. These small software-backend timings are not hardware-speed
or whole-shot throughput claims. See the resident evidence JSON for exact counts.

The next missing physical stage is mixed airborne/supported propagation after
this real contact, with admissible force/torque regimes and landing/other-event
ordering, followed by general-angle contacts, raw strike and full-rest
rules. This checkpoint deliberately stops before using stale coefficients or
pretending a partial motion domain is a complete candidate evaluator.
