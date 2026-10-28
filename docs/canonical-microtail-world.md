# Common-clock cloth microtail adapter

The isolated bounce proposal is extended by
`deterministic-microtail-world.mjs` and its resident GPU counterpart. The adapter
can commit a bounded **canonical-local** whole-world prefix, not model REST,
gameplay success, or a globally certified physical trajectory. Production/manual/
forecast/search wiring remains a separate integration task.

## Fractional endpoint rule

The microtail endpoint has an exact rational time, generally between two Q20
clock ticks. All bodies finish this adapter at its upper tick. The selected ball
advances for the residual fraction, which is strictly less than one tick:

- Position and tangential velocity/spin use one explicit Euler step of the
  *same point RHS* used by the SMT2 supported-cloth solver. An export-only wrapper
  reuses that function and its exact WGSL source; existing SMT2 kernels are unchanged.
- Normal spin uses the existing constant torsional drag / zero clamp law.
- This first-order fractional step is a **new, declared canonical integration
  rule** in a previously unsupported regime. It is not called an exact ODE solve
  and does not silently hold velocity constant or discard the fractional time.
- A genuine zero tangential state remains at rest while normal spin decays.
- An exactly linked rolling endpoint (`qx=vz`, `qz=-vx`) with sufficient static
  friction (`2K<=7F`) uses the existing closed-form rolling law lifted to exact
  rational duration. Directed norm/scaling bounds and stop-interval handling
  retain linked q; normal spin uses the same drag law. No epsilon classifies
  approximately rolling input as rolling.
- Otherwise the initial slip lower bound must exceed `(3.5 F + K) dt`, and the
  tangent-spin lower bound must exceed `(2.5 F + K) dt`. This proves neither
  singular regime can be crossed over the residual interval. Unqualified near-zero
  slip/tangent spin remains pending, rather than being snapped into rolling/rest.

Directed integer division computes `a * numerator / (denominator * 2^20)` with
wide products and a shift followed by division. It does not round the residual
time to zero or need a native 64-bit GPU integer.

## Unchanged local bounds

For the first-order reference, per-component velocity defect is bounded by
`F*dt + abs(reference velocity increment)`, rounded outward. The angular bound
uses `(2.5F+K)*dt + abs(reference q increment)`. These need no smooth-direction
assumption beyond the admitted regime. If the component bounds are `Ev, Eq`,
`rho = 2*Ev + Eq` encloses the joint kinetic norm; the existing `ceil(1.5812*rho)`
conversion encloses tangent-spin components. Position adds two Q24 quanta:
one for directed endpoint packing and less than one for bounded acceleration
across a duration below one tick (`F <=16` in physical units).

Every fresh local receipt is checked against the caller's existing seven budgets,
including the other airborne body's vertical position/velocity and REST normal
spin. No tolerance is increased. Other sliding bodies use existing SMT2 with the
exact common integer duration; other rolling bodies use existing rollingPartial;
other flights use the same gravity polynomial and cannot cross a competing landing.

The prior world's carried radii are **diagnostic-only**, because this mode does
not claim a global physical enclosure across preceding impacts. They are preserved,
added to fresh receipts, and conservatively included in this adapter's clearance
boxes. The combined numbers may exceed the fresh local budgets; that is explicitly
not a newly claimed global certificate. Negative/unavailable or overflowing carried
numbers are rejected, not reset to zero. Outputs declare `globalReceiptCertified:false`
and `carriedReceipts:'diagnostic-only-not-a-global-budget-certificate'`.

## Whole-world geometry and atomic commit

The selected ball's swept center box covers every micro-flight and the residual
supported interval. Other bodies contribute full-duration bounds from their actual
motion provider. The existing TUBE_CLEAR routine checks all roster pairs, all four
finite cushion hull bounds, all remaining static bounds, and the finite cloth
footprint, including radii and carried position growth. A still-touching just-solved pair remains pending in this adapter. Its marker is
cleared before the geometry test: the synthetic swept boxes do not provide a
position-trajectory derivative contract, and physical acceleration bounds alone
must not be substituted for that contract. An already separated pair can pass the
ordinary whole-prefix distance test. Restoring a release exception requires a
separately qualified trajectory-derivative provider, not an ID-only suppression.

A failure restores the original all-body state and clock. The original absolute
shot deadline is preserved. On success, every body advances to the same clock;
full position, velocity, all three q components, stable IDs, modes and receipts
are returned. No intermediate CPU readback or host physics is required by the
11-phase resident implementation.

## Composite cloth event accounting

A committed microtail is one **composite cloth transition episode**, not one
physical impact. The existing landing commit counter increments once so a journal
can capture the atomic transition before it is overwritten. The separate
`episodeReceipt` contains:

- Actual number of evaluated physical micro-impulses.
- Original start tick and lower/upper endpoint tick bracket.
- Exact rational flight-duration numerator/denominator and common commit tick.
- Explicit `individualImpactTimesEnumerated:false` and `gameplayFloorFoul:false`.

The retained `micro` packet also carries these values directly. Future cumulative
physical-event/work accounting must charge the actual impulse count, not just the
single journal episode. A recorder must label the auxiliary episode; it must not
invent individual impact timestamps. World-owner-agreed header fields are 51 (composite flag), 53 (actual impulse count), 54/55 (absolute endpoint bracket), and 58/59 (duration numerator/denominator). Ordinary landing commits must clear these fields; consumers may not infer individual impact timestamps from the episode endpoint.

## Verification

`tests/deterministic-microtail-world.mjs` covers a four-ball mixed roster on actual
source table geometry, another airborne ball, intervening body/static obstruction,
original deadline, singular residual regimes, and local budget failure. Independent
fine RK4 integration checks the same continuous supported law over 78 residual
fractions against the returned local bounds. Integer fraction arithmetic is checked
against exact BigInt directed quotients. CPU/GPU comparisons include full accepted
intermediate packets and core state for guarded rejections.

This adapter alone does not establish default-material full-shot completion. Its
caller must route eligible tiny flights here, record the composite episode, and
continue with the same engine until a separately qualified all-body terminal state.

The resident `createBank` API accepts existing state/dense/context/cloth buffers and a two-word `[selectedSlot, enabled]` configuration buffer. `encode` clears reusable scratch, snapshots the context with the landing exception disabled, and schedules all phases. A disabled bank is a state-preserving no-op even on an already-terminal world; re-enabling the same bank does not reuse stale results.

Latest native checkpoint after the release restriction and fractional rolling
extension: **9/9** tests and **12,736 world/packet words** exactly equal between
CPU and WGSL. This includes still-touching pair refusals (separating or approaching),
exact rolling residuals, full-roster geometry, original deadline, local budgets,
and enabled/disabled bank reuse. Independent analytic rolling/stop comparison
covers120 cases; supported residual RK4 comparison covers78 cases.
World compilation was20.108s; bounded run20.770s, sampled aggregate RSS1080.40MiB
(max child1043.68MiB). These are SwiftShader software measurements.
See `artifacts/canonical-microtail-world/native-checkpoint.json` for source hashes.
