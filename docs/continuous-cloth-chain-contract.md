# Continuous-cloth graph-chain inspection checkpoint

## Useful result

A genuine numerical contact recurrence exists in
`experimental-world-stepper.js`, but it is **not** the original rolling-world
ownership contract. This checkpoint exports an inspection-only wire map in
`tests/cloth-chain-wire-contract.cjs` and host tests. It deliberately does not
create a runnable cloth chunk: doing so for original inputs currently requires
transporting the real activation/CCD/lifecycle transaction, not freezing its
first admission or relabeling the sleep/CCD-disabled standalone component.
No GPU, native numerical engine, or CPU graph execution was run here.

## Source dependency order (do not reorder)

1. Optional owned cue `prepare` changes linear/angular velocity and emits ordered
   source mutable-body/removal calls. Capture entry state for CCD.
2. CCD `pre` evaluates entry force, velocity, inertia, extent and thickness.
   Refusal stops before solve; admission establishes the current source phase.
3. Fat-AABB graph uses position, radius, prediction and retained fat bounds.
   Host lifecycle commits its bounds and pair membership, then clears/recreates
   manifold ownership if necessary.
4. Geometry graph evaluates floor feature, recycling, geometric point and
   solver qualification. Lifecycle refresh conditionally carries anchors,
   local points/normals, arms, distances, recycle pose, contact id and caches.
5. Activation owner processes real modified-body queues, source order, contact
   links, energy updates and island eligibility. Only its resulting awake
   admission can authorize the prepared contact solver.
6. Contact graph solves the fixed source iteration plan; otherwise lifecycle
   chooses free-body integration. A continuous-contact-only chunk must stop
   atomically rather than silently choosing an invented continuation on loss.
7. CCD `post` compares entry pose to solved pose before any commit. The solved
   force is retained for the next pre-check. Post fat-AABB updates owned bounds.
8. Application angular patch reads **this solve's** impulse, linear/angular
   velocity and refreshed inverse inertia. Only angular velocity is written back.
9. Patch metadata may enqueue the body into the next modified-body queue.
   All prepared owners assert, then commit together. On failure they abort.

Source locations: `experimental-world-lifecycle.js` functions `controller`,
`preparedContactStage`, `refreshManifold`; `experimental-awake-activation.js`
function `owner`; `experimental-angular-patch.js` functions `postStage`,
`packPrecise`. Existing leased numerical phases explicitly say their common
owner—not the phase—owns queues, source order, CCD, application law and commit.

## Exact numerical carry for the continuous-contact subset

The source world graph has 128 input floats. Offsets below are destination
input offsets; output offsets must be derived from `plan.outputLayout` rather
than baked across plans:

| Fields | Input offsets |
|---|---|
| linear, angular, translation, rotation | 0, 3, 6, 9 |
| refreshed inverse inertia (9 entries) | 16 |
| anchor1/2, dp1/2 | 58, 61, 64, 67 |
| impulse, warmImpulse, warmWorld | 70, 71, 72 |
| tangentImpulse, contactDistance | 75, 77 |
| localP1/2, localN2 | 78, 81, 84 |
| recycleTranslation/Rotation | 87, 90 |
| contactId, warmTangent | 114, 115 |

Only `impulse`, `warmImpulse`, `warmWorld`, `warmTangent` canonicalize -0 to +0
in the original decoder. Unlike free-body decode, body/geometry fields preserve
signed zero. `contactId` is an f32 slot containing 0 or 2147483648, **not** an
integer handle reinterpretation. `recycleValid` (input 117), `maxDrift` (95),
normal (55), manifold flags, ownership and fat bounds are lifecycle-managed;
a solver output alone does not establish their next authoritative state.
The `supported` output must be accepted together with the final arithmetic
completion marker. A later success cannot erase an earlier unsupported result.

The compensated angular graph has 64 input floats. Carry normal from the owned
manifold to 0..2, solver angular to 3..5, linear to 6..8, symmetric inverse inertia
matrix entries `[0,1,2,4,5,8]` to 9..14, and the owned singleton impulse to 24.
Other impulse slots must stay zero. Angular outputs 4..6 overwrite world inputs
3..5 without zero canonicalization. The patch's `requiresModifiedBodyTracking`
flag must also be carried to the next source owner, not discarded.

## Concrete missing prerequisites for a safe original-input chunk

1. **Owned device transaction:** no exported device-resident representation
   currently transports the common owner's activation state, ordered modified
   queue, contact links, epoch/sleep-scan counters, source awake/sleep decision,
   and post-patch enqueue across several outer steps. Existing prepared solver
   checks require current real admission; a copied `source-observed-awake` label
   is not admission. Add a bounded exact u32 owner transport plus unchanged energy
   graphs and explicit sleep/retirement/CCD stop flags, with atomic owner commit.
2. **CCD and boundary guards:** export/access the original pre/post check plans
   and stable packing contracts with both entry and solved poses/force. Preserve
   original selected-pass capability ownership; do not forge or reuse a prior
   pass. Chunk rejection must leave all leases and original snapshots unchanged.
3. **Lifecycle graph seam:** `fatPlan`/`fatPack`, topology transitions and refresh
   carry remain private to the host lifecycle. Export an immutable plan/packing
   descriptor and source-authored carry/guard contract rather than duplicating
   a subtly different broadphase/manifold implementation in the prototype.
4. **Dynamic angular constant masking:** `packPrecise` packs hi/lo values at
   56..63 only when the **current** source-JS eligibility is true; otherwise all
   eight words are zero. Packing only the initial state can leave them zero
   forever after an ineligible→eligible transition, or incorrectly retain them
   after the reverse. Precompute immutable hi/lo pairs once, then reproduce the
   exact source eligibility mask on device from owned current state. Preserve
   the existing graph's own gates too—do not "fix" or approximate its boundaries.
   Source eligibility includes positive ordered impulse sum, material/sphere/
   sleep flags, `abs(normal.y) >= .95`, `abs(linear.y) <= .05` and rolling/spin
   enablement. Singleton one-point integer bit comparisons may be possible,
   but need explicit boundary and signed-zero host proofs before use.
5. **Precision honesty:** the existing selected angular law uses approximately
   48-bit compensated arithmetic, not exact f64. Reuse it unchanged and keep its
   existing independent source-parity gates. A graph-chain pass cannot establish
   stronger source-JS equality by assertion.

A standalone `canSleep=false`, `ccdEnabled=false` continuously supported floor
component could be chained with fewer prerequisites, but does not address the
original common rolling path and must be separately labeled. This checkpoint
has not invented such a substitution or injected future geometry/impulses.

## Correct free-body performance denominator

The previous measured 1-map chunk vs 16 maps compared against individually
stepped two-row singletons. That combines row batching and temporal chaining.
The appropriate already-batched baseline is **8 per-step batched submissions /
8 maps** for 2 rows × 8 steps. `free-body-batched-step-baseline.cjs` now runs the
existing resident arithmetic graph once for both rows on every step, decodes,
validates and repacks the original recurrence on the host, and compares every
output exactly with the chunk. The gated GPU test records both denominators,
actual submit/map counters, allocations and separate durations. Its new
8-map numerical measurement is **pending a granted slot**, not inferred from
host mocks. Host test confirms eight two-row calls and the recurrence/immutable
seed plumbing without arithmetic execution.

## Narrower safe segment: within one already-admitted h

Whole-step recurrence blockers above do **not** block every smaller numeric
chain. In `experimental-world-lifecycle.js:55-56`, after the original host owner
has selected the active contact solver and performed real activation and CCD
pre-admission, the longest pure-field-transport segment identified is:

**contact solve → inactive-CCD post-pose check → post-solve fat-AABB → readback**

Stop there, before the existing post-world angular stage/`Angular.packPrecise`.
The host keeps all scene, topology, awake/sleep, pass and commit decisions.
This is one admitted h only; it neither predicts nor manufactures next-h state.

### Exact carry and eliminated boundaries

- Contact graph `translation` output → CCD inputs 37..39; `rotation` → 40..43.
  Source: `experimental-ccd-inactive.js:22` `pack`, and lifecycle `ccdInput` at
  line 22. All CCD inputs 0..36 remain the **entry** values: linear/angular,
  pose, force, torque, inverse mass/inertia, COM, extent, thickness and dt.
  In particular do not replace entry force with the newly solved force: the
  existing lifecycle assigns `s.force = result.force` only after CCD post.
- Solver `translation` → fat input 0..2. Seed remaining inputs from the current
  same-h state: radius3, prediction4, lengthUnit5, fixed floor bounds6..11,
  retained pre-solve fat bounds12..17. `fatPack`'s
  `f(normalizedPredictionDistance * lengthUnit)` is immutable during this h and
  can be packed once by the existing code before submission, not recomputed by
  a modified shader. Source: lifecycle `fatPlan`/`fatPack` lines14-15.
- Neither move canonicalizes signed zero: source contact decode preserves pose
  bits and both packers only copy those dynamic fields. Preserve all solver
  outputs separately for subsequent original host state writeback/patch input.
- Existing: three numerical submits and three maps. Proposed: three arithmetic
  dispatches plus u32-only gather(s), one submit and one joint map. Eliminates
  the **solve→CCD-post host roundtrip** and the **CCD-post→fat-post host
  roundtrip**, not the initial geometry/activation readback or angular readback.
- `preparedContactStage.solvePrepared` lines97-98, when the common owner performs
  CCD elsewhere, offers the narrower **solve→fat-post** segment: two maps to one.
  Do not insert, omit or move its owner's CCD phase just to force the longer
  chain onto that API.

### Speculation and same-h commit

CCD may refuse (`supported=false` or `active=true`). Post-fat may be evaluated
speculatively, but its results remain private and must be discarded on refusal.
Retain each stage's completion/finite marker, solver `supported`, CCD `supported`
and `active`, and final fat output in the joint readback. Reapply checks in the
original order: solver failure/geometry disagreement first, CCD refusal with
its original reason second, fat result last. Do not run angular packing or
commit any owner on failure. Cancellation/device loss drains or terminates the
same private transaction; no early prefix publication or lease escape.

The final host boundary still performs original validation and angular
post-stage checks before the unchanged original same-h commit. A geometry or
activation refusal remains outside this segment and prevents its submission.

### Remaining seam for implementation

This static checkpoint does not implement a runtime. The numerical source
contracts are adequate for the above local transport, but `CCD.POST`, CCD
`pack`/layout, and lifecycle `fatPlan`/`fatPack` are private. The minimal next
change is a read-only immutable internal descriptor seam or an in-module
encoder method reusing those **same** plans/packers, plus a leased same-h
submission wrapper. No new sleeping/CCD-disabled world and no device-side
activation port are required for this local segment. The inspection-only map
`inspectWithinH` and host bit-copy test explicitly preserve entry CCD words.

### Exact remaining dynamic angular predicate (unchanged)

`experimental-angular-patch.js:18`, `eligibility(s)`:

```
let sum = 0;
for (const impulse of s.impulses) sum += Math.max(0, impulse);
const eligible = !!(s.rollingLength || s.spinLength)
  && s.isSphere && !s.sleeping
  && ['cloth', 'floor'].includes(s.materialKind)
  && sum > 0 && Math.abs(s.normal[1]) >= .95
  && Math.abs(s.linear[1]) <= .05;
```

`packPrecise`, lines50-56, uses that **current source-JS** predicate to choose
`[(mass*gravity)*h, ((.4*mass)*radius)*radius, rollingLength, spinLength]`
versus four zero constants, then splits each into `hi=f(value)` and
`lo=f(value-hi)` at input56..63. `postStage`, line77, selects the current owned
manifold impulse array (`pointPresent ? [state.impulse] : []`) and can bypass
patching for `!pairPresent`; it also validates matching immutable configuration,
awake phase, mass, dt, radius, gravity and symmetric inertia.

The unchanged compensated graph separately uses its own strict gates
`gt(abs(normal.y), f32(.95))` and `lt(abs(linear.y), f32(.05))` (line38).
Do not collapse those into the host predicate or change their boundaries.
Returning the combined solve/CCD/fat output to the host before this packer
preserves **both** existing predicates, exactly as requested.
