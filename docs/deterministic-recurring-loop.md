# Bounded recurring supported-motion chain (experimental)

This opt-in adapter composes the actual prepared directional impact, common-clock
3D cloth landing, supported smooth motion, slip-to-rolling comparison bridge,
partial rolling, and a geometry-qualified rolling-to-rest tail. It is not the raw
cue/full-table production evaluator. Generic subsequent impacts remain pending.

## Two deliberately different receipt profiles

`canonical-local-v1` is the GPU-canonical numerical execution profile. Every
smooth/bridge step uses the unchanged caller **local** component budgets from its
encoded model anchor. Prior accumulated uncertainty is retained separately and
is never represented as a new globally certified zero-radius state. The final
flags remain `globalReceiptCertified:false`,
`preImpactPhysicalEnclosurePreserved:false`, and `physicalRestCertified:false`.
A model REST can coexist with `globalBudgetWithin:false`.

`strict-carried-v1` instead supplies the persistent joint kinetic radius and
position/spin errors to the next step. Budget exhaustion is incomplete, not REST.
Its tail must satisfy both carried-budget and swept-clearance checks.

All bodies advance by the same elapsed time. A body already rolling uses its
analytic partial-time reference, not its eventual stop endpoint. A slip bridge
retains the true nonzero rolling material in its comparison error. Neither path
projects arbitrary spin into the directional family.

## Geometry and state receipts

`pathDense` is the **last accepted swept prefix**, with an explicit descriptor
kind; it is not the next-anchor error radius. Failed later attempts leave this
receipt unchanged. Next-anchor position and velocity are separately rebased and
old polynomial rates cleared. At model REST every linear/angular surface
velocity and all next-anchor rates are zero.

A conservative whole-tail AABB overlap is only an uncleared interval. The
refined rolling-world query uses the original analytic descriptors against every
pair, actual hull bounds, other static bounds, and finite cloth. Only a complete
clear result for the same horizon permits the nominal REST tail. No collision
impulse is invented from broadphase overlap.

## CPU and native evidence

The original four-ball prepared fixture, with local budgets
`[2000,2000,20000,20000,20000,20000,20000]` Q24 component units:

- Strict carried execution stops at tick 148137 with budget exhaustion.
- Canonical-local execution uses 32 shared prefixes and three slip bridges.
- Its raw tail reports pair 1/3 AABB overlap; refined geometry clears it in
  76 nodes. The actual trajectories do not collide.
- Nominal REST is tick 4713089, or 4.4947519302 s, with all v/q zero.
- Proposal plus committed point RHS work is 854 calls. These are not native
  solver steps or a hardware speed comparison.

Halving the same local budgets reaches REST at tick 4712926; the largest final
position difference is about 72.29 micrometres. Quarter budgets stop incomplete
at tick 59693 (local bridge budget). This is not a three-level convergence proof;
an incomplete state must not be compared to a final endpoint as its error.

The resident chain passed 6/6 tests. Six execution/budget cases compare all
12,576 output words exactly, including the original fixture's model REST and the
strict carried-budget failure. Geometry-node exhaustion remains incomplete,
and the half-budget trajectory is also bit-identical. There are 29 pipelines and zero intermediate
readbacks/host physics. Compilation took 24.04 s; the canonical 40-prefix case
used 2,660 fixed dispatches and 953 ms submit-through-read on SwiftShader.
Application buffer allocation was 60,968 bytes. The watchdog RSS sample omitted
possible children spawned by non-main threads, so its 40.05 MiB sample is NOT a
process-tree peak or reliable total-memory bound; that metric is withdrawn. The
process-group time limit remained enforced. These are software-backend
measurements, not hardware GPU speed claims. See `artifacts/deterministic-recurring-loop/native-receipt.json`.

Fixed dispatches for terminal rows are bookkeeping no-ops, not zero submission
cost. Cancellation suppresses publication; event/prefix exhaustion never emits
REST or MISS. No gameplay FLOOR event is emitted for a cloth landing.
