# Phase-correct inverse observation seam

Checkpoint based on `2ed077e`. This does not select a GPU search backend, add a
GPU observation producer, change the inverse algorithm, or certify new shots.
`LabInverseEvents.observation` is a plain-data reducer shared with the original
CPU path. It observes physics; it never advances or alters a physical world.
Its private accumulator is mutable, input positions/projections are copied when
retained, and receipts may be deeply frozen.

## Receipt / source mapping

| Field | Original native source / exact meaning |
|---|---|
| `phase` | `after-world-step-before-application` |
| `sequence` | Contiguous 1-based `world.step` ordinal per shot; zero only for initial geometry |
| `time` | `lab.time + lab.world.integrationParameters.dt`, computed before native call |
| `stepDt` | The same native getter before that call: source f32 dt represented as a JS number |
| `cue.radius`, `cue.position` | Selected sphere radius and copied `body.translation()` after native return |
| `objects[]` | Other sphere objects in `lab.objects` order, with `id`, `radius`, copied `position`, boolean `impact` |
| `objects[].impact` | Any `contactImpulse(i) > 0` in native `contactPair(cue.pairCollider || cue.collider, other.pairCollider || other.collider)`; not collision-start events |
| `rails[]` | Cushions in original static order, `rail` from `LabRouteRules.railId`, boolean `impact`, `projection` |
| `rails[].impact` | Any positive manifold contact impulse using cue **primary** collider and cushion collider |
| `rails[].projection` | Actual convex `projectPoint(cuePosition, true)`: copied `point:{x,y,z}`, boolean `isInside`; never an ideal table plane |

Initial geometry uses the same schema with `phase: initial-before-world-step`,
`stepDt: 0`, and current absolute time. It samples residuals but creates no impact
or solver-step count. `observation.create(topology, startTime)` owns its expected
events. `initial(state, receipt)` and `step(state, receipt)` update the observation
accumulator. There is no physical-success or GPU-certification method.

Episode threshold, repeated-return rule, interpolation, 1e-9 event grouping,
ordering, signed residual formulas, and first-impact metadata remain unchanged.
The private CPU adapter copies target geometry but lazily memoizes cushion projection
only when the unchanged episode/sample reducer demands it. Its accessors never
escape; public GPU receipts remain validated plain data. Each demanded rail is
queried at most once per native substep, avoiding eager four-rail query overhead.
Duplicate/skipped/out-of-order sequence and nonincreasing time are rejected; producers must deliver committed receipts in source order exactly once, not completion order across worlds. A shot owns its reducer.
Malformed receipt fields fail validation before reducer mutation. This is an
internal data contract, not an untrusted-input transport/provenance boundary.

## Required GPU producer (not implemented)

The native observer wraps **one `world.step` call**. It does not observe internal
Rapier CCD solver passes individually.

* Cue-present path: `experimental-four-ball-world.js` currently patches angular
  state inside its ball solve loop. Accumulate detached solved/post-CCD-clamp
  positions plus native-equivalent impulse/projection data before application
  mutation; wait for every ball. One receipt per application h (typically
  1/61440 while cue subdivisions are active).
* Post-cue path: `experimental-three-ball-ccd-world.js:advanceCcdOuter`, called by
  the four-ball owner, can perform several internal CCD passes. Capture after
  the **final** pass, before `emitEvents` and angular patch, using `appH` and
  `next.time + appH`. Do not count each CCD pass as an inverse observation.
* Keep the receipt transaction-owned. Publish only after the corresponding
  owner commits. Rollback/cancellation/failure publishes no speculative event;
  batch owners commit independently, never as a fabricated cross-world atomic
  update. A consumer failure after commit must not imply physics rollback.
* Map final live narrow-phase/solver contact impulses by authoritative collider
  identity, including retained/persistent contacts; collision-start events and
  debounced `contactEvents` are insufficient. Determine the exact authoritative
  final-pass cache for each pair/cushion before implementing the producer.
* Actual convex projection (`point`, `isInside`) is still required for every
  sampled/repeated cushion. Existing source hull data alone is not this query.
* Preserve application time (JS double) separately from native integration dt
  (f32): receipt time = pre-h application time + f32(h); application then adds h. The count used by the reducer is native `world.step` calls,
  distinct from internal CCD passes and outer `PhysicsLab.step` calls.

Current public GPU snapshots are after application patch, event/game updates,
and transaction commit. They are not phase receipts and must not be relabeled.

## Remaining scoring/search seam

`ShotSearchCore.stepTrial/finishTrial` remain the original CPU implementation.
The observation reducer alone cannot produce `physicalResult` or certify a
solution. A future shared scoring reducer additionally needs application event
ordering, outer-boundary selected/target poses, per-h opponent positive impulses,
cue obstruction/tail state, sleeping/rest state, sampled kiss pairs, distance,
maximum height, target-order/rule ambiguity, goal-latch time and horizon semantics.
Its outcome must preserve settings/clearance restoration, penalties, residuals,
first/second IDs, methods, and incomplete-verification failures. Do not replace
that outcome with `FourBallGame.scoreResult` or weaken separate verify replay.

## Evidence

`tests/fixtures/inverse-observation-original.json` was generated before refactor
from unchanged `2ed077e` inverse source (SHA-256
`9dbd020884d8e5c47f171ab40b97734e0bc6bccdf7603bc0af3a24e7c1a64160`).
`tests/inverse-observation-native.cjs` uses bundled original Rapier, compares full
inverse outcomes and per-outer-step trace hashes for hit, wrong-rail, and miss,
and asserts the inverse step counter already advanced before every angular patch.
The capture command refuses to regenerate expectations from modified source.
`tests/inverse-observation-data.cjs` checks detached/frozen receipts, quick
recontact, persistent/ambiguous episodes, initial sampling, and invalid phases.
