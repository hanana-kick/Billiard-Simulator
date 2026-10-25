# Physical search scoring seam (not a GPU scoring producer)

`ShotSearchCore` now exports the scoring reducer used by the existing CPU trial.
This is **not** permission to submit a GPU candidate as verified. The GPU producer
below is still required; inverse solver-substep topology receipts alone are insufficient.
No search selection, default backend, physics integration, clearance restoration,
FourBallGame scoring or certification policy is changed.

## API and ownership

- `createPhysicalAccumulator(settings, searchModel, startTime, cuePosition)` creates
  scoring state before `strike`, with no world, contacts or desired outcomes.
- `observePhysicalEvent(req, accumulator, event)` consumes actual PhysicsLab
  presentation callbacks **in original emission order**, including those emitted
  during strike and each solver substep. Events have `kind`, absolute `time`, and
  contact endpoints `{id, kind, label}`. Do not substitute inverse impulse episodes.
- `observePhysicalStep(req, accumulator, input)` runs **once per completed outer
  PhysicsLab.step**, after all substeps/callbacks and bookkeeping; increments
  `steps` and returns whether execution must stop. It mutates only scoring state.
- `finishPhysicalHorizon(req, accumulator, input)` is called after a batch only if
  the outer reducer did not stop, exactly as `stepTrial` does. Returns whether the
  rounded outer-step horizon is reached; invalidates incomplete goal verification.
- `physicalResult(options, accumulator, absoluteTime)` projects the original
  result without disposing, accepting a candidate or mutating scoring state. It
  is not a completion/certification gate. Never call it to certify a partial trial.
- `physicalInputs(lab)` is the lazy, read-only CPU implementation of `input`.
  Construction performs **no query**. Reducer queries never invoke convex
  clearance/projection, advance the world, change body state, or restore poses.

Before advancing, retain `stepTrial`'s short circuits: invalid -> stop; successful
non-four-ball with cue absent -> stop. Advance at most
`Math.round(options.horizon / input.dt)` outer steps. A reducer stop takes priority
and bypasses the final horizon check, including on the last allowed step.

### Reader contract

All reads in a reducer invocation refer to one completed outer boundary. Values
must not change while that invocation runs. Methods are lazy (not eager convex
queries or world stepping):

| Read | Required meaning |
| --- | --- |
| `time` | accumulated PhysicsLab time after final `h`, not recomputed `steps * dt` |
| `dt` | outer configured dt, not solver `h = dt / subdivisions` |
| `cuePresent()` | cue still exists after substep cue removal (strict elapsed > .22) |
| `allSleeping()` | every dynamic `lab.objects` body, including non-spheres; native sleeping state |
| `position(id)` | final body translation `{x,y,z}` |
| `radius(id)` | object radius, undefined for missing optional second target |
| `sphereIds()` | every sphere ID in original object iteration order, including cue |
| `positiveImpulse(a,b)` | any strictly positive manifold contact impulse at this boundary, using sphere pair collider if present, otherwise primary collider |

No synthetic success, goal flag, expected topology, residual, or expected result
is an input. Producer IDs/radii/positions must derive from the candidate world.
Absent required measurements are an unsupported producer, not zero/false defaults.
The reducer assumes the same validated request as CPU; inverse branch overrides
(first/second/method and fixed candidate elevation) must be retained upstream.

## Exact phase and semantic audit

1. `beginTrial` still clones, checks cue clearance, optionally restores feasibility
   for regular search, installs callback then strikes. Inverse begin fixes elevation
   to disable restoration. GPU must separately reproduce admission and strike
   rejection, actual clearance inequality and feasibility metadata. No admission
   query is repeated by the scoring adapter.
2. PhysicsLab chooses subdivisions once at outer-step entry; compliant cue contact,
   world.step(h), time += h, obstruction observation, collision queue callbacks,
   angular patch resistance and cue removal occur for each substep, followed by
   outer bookkeeping. Scoring is **after** this; inverse observations are after
   each world.step and before time increment. Do not interchange these streams.
3. Presentation contacts use collision-start events and CPU filters (cloth before
   .15, cloth/floor speed < .12, last-eight-events pair debounce < .12 seconds),
   endpoint labels and callback order. A topology producer's positive-impulse
   episode stream deliberately differs and cannot replace presentation contacts.
4. Four-ball checks opponent impulse and off-table/finite cue position first,
   including after goal latch. A cue/opponent presentation contact or cue/floor
   event is also a foul. Opponent prohibition is independent of `allowKiss`.
5. After goal latch, only tail/foul/rest checks continue. Contacts, kisses, path
   length, max height, closest gaps and residuals are frozen. Four-ball waits for
   **all** balls to sleep and cue removal, not just the cue ball. Other modes need
   cue removal; a goal can terminate before all balls sleep.
6. Before latch, kisses sample positive impulses at the final outer boundary, not
   accumulated OR across substeps, and separation > .00005. This intentionally
   retains existing CPU behavior even when an inverse episode saw a transient
   impact. Disallowed kisses invalidate through hitTime + 1e-9, not later kisses.
7. Method routes sort queued presentation contacts by time, group differences
   < 1e-9, mark object+cushion or distinct objects ambiguous, deduplicate within
   each group, then use unchanged LabRouteRules. Without methodId, callbacks
   update target order/rails immediately. Never reorder using desired topology.
8. Ordered first/second targets, cushion requirement (three mode or four-ball
   three-cushion option), hitTime and hitRails retain original behavior. A goal
   freezes on the valid second distinct target, but four-ball foul checking remains.
9. Path length and max height use outer endpoint positions. Residual selects first
   target until hit, then second (or always first in target mode); resets on first-hit
   transition or strictly smaller nonnegative surface gap. Cartesian residual and
   topology string are unchanged. Closest/firstClosest/afterFirstClosest determine
   final `clearance` with fallback 5; this is **not** cue geometric clearance.
10. There is no `minDistance` field in this scoring contract. A GPU field named
    minDistance cannot replace these staged gaps or initial cue clearance. Inverse
    event residuals (including convex rail projection and segment interpolation)
    remain a separate observation reducer and are not extracted here.
11. Horizon counts outer steps, uses rounding, and only marks verificationIncomplete
    when a latched goal still has cue tail or (four-ball) awake objects. Misses are
    not rewritten as incomplete. Failure precedence: cue obstruction, four-ball
    foul, incomplete, invalid rule/table, first target, cushions, final target.

## Evidence / next bounded prerequisite

`tests/fixtures/physical-scoring-original-cpu.json` was captured from unchanged
`2ed077e` before extraction. Seven actual CPU shots retain **exact** full results
and step counts. Fixture settings are regression inputs only, never candidate
producer data. `tests/physical-scoring-seam.cjs` additionally records actual lazy
reads and emitted events during each CPU shot, replays them into a detached
accumulator, and checks exact results/read order. It tests ambiguity, post-goal
opponent foul, tail horizon, foul precedence, no eager queries, and kiss return.

Next: implement a bounded GPU producer of the presentation stream plus all reader
fields at authentic outer boundaries, preserving admission/strike and termination.
Compare it against these CPU observations (including cue phase, post-goal rest,
late opponent contact and missed transient outer kisses) before wiring inverse
physicalResult. Run genuine GPU numerical parity separately; CPU trace replay only
proves the reducer/adapter contract, **not GPU producer parity or full GPU search**.

## Numerical-world producer (experimental, public search still off)

`src/experimental-four-ball-physical-scoring.mjs` now implements the reader and
phase driver for the supported registered four-ball numerical world snapshots.
It does not step or alter a world. Pass the actual seed, unadvanced public snapshot,
original ordered search request, and explicit admission measurement to
`createFourBallPhysicalScoring`; call `consume(snapshot)` after each committed
world step. Only a completed original outer boundary invokes scoring. `finish()`
throws until the scoring termination condition, regardless of FourBallGame flags.

The producer requires all six pair bindings and validates original body/pair
collider identities. A positive impulse is `pairPresent && pointPresent &&
impulse > 0` in the **final committed** cache, not active graph status, game flags,
prior substep OR, or accumulated impulse. Missing required fields fail closed.
It retains original source time/step origin, skips exactly the captured initial
presentation history, verifies append-only history, and forwards new contacts or
cue-obstruction events once in original order. No convex queries are introduced.

Admission schema (`kind: original-prestrike-cue-clearance`) requires the actual
`clearance` result, actual accepted strike, candidate settings/selected ID, created
snapshot SHA256, prestrike absolute time/source application steps, and count of
initial presentation contacts. This API validates binding and completeness; the
caller remains responsible for obtaining it from a genuine original capture.
An accepted strike without an explicit measured distance is insufficient. The
current normal stroke emits no contact during strike, so the history count must
equal initial `contactEvents.length`; any differing source behavior fails closed.

The production consumer has no dependency on original/native PhysicsLab. The
isolated `tests/four-ball-physical-scoring-native.cjs` creates native evidence:
settle the supported speed-2 layout, measure actual cue clearance, capture the
original created stroke, then run ordinary `beginTrial/stepTrial/finishTrial` on
an independent snapshot. Created world bytes must exactly equal captured bytes.
The file separates initial raw capture/admission/request from expected outcomes.
`tests/four-ball-physical-scoring-world.mjs` imports only raw capture into the
numerical world; expected per-outer accumulators/final results are assertion-only.
No native engine is loaded in that process. Table constants are copied from the
source-hash-checked original input configuration, not a simulated future result.

Reproduction (CPU-reference, no GPU needed):

```
node tests/four-ball-physical-scoring-native.cjs /tmp/scoring-original.v8
PHYSICAL_SCORING_ORIGINAL=/tmp/scoring-original.v8 PHYSICAL_SCORING_MAX_H=750 \
  node tests/four-ball-physical-scoring-world.mjs
node --test tests/four-ball-physical-scoring-contract.mjs
```

The supported 750-world-step prefix passed: 309 completed original outer steps,
7,866 numeric accumulator comparisons, maximum absolute difference **0**, including
actual target-3 contact, departure and return/kiss. Actual admission clearance was
0.011999974027276039 m. The original full native trial stops at 7,505 outer steps
with `final-target-not-hit`; the complete CPU-reference and independent actual
WebGPU replays now both reproduce this outcome exactly (see below). This single supported layout is not general
search admission. GPU mode must use `REQUIRE_WEBGPU=1` with the hardware owner;
there is no CPU fallback in that mode and no public-search activation here.


### Complete supported scoring replay

Serialized runs with `node --max-old-space-size=384` both reached the original
physical stopping boundary, not an arbitrary prefix or game-score shortcut:

| Backend | World h / outer steps | Numeric comparisons | Maximum error | Peak RSS KiB |
| --- | ---: | ---: | ---: | ---: |
| CPU-reference | 7,946 / 7,505 | 266,945 | 0 | 587,836 |
| Native WebGPU | 7,946 / 7,505 | 266,945 | 0 | 721,788 |

Each completed outer accumulator and the full final physicalResult matched the
independent original CPU trace. CPU/GPU final result objects also match exactly.
The correct result is **not success**: `final-target-not-hit`, first target hit,
actual repeated target-3 contact/kiss, distance 2.906339027194968 m,
seconds 7.817708333333209, clearance 0.23850002547732913 m,
score 105.99156402720517. The actual admission clearance remains the distinct
0.011999974027276039 m measurement.

Evidence is preserved locally under `artifacts/physical-scoring-full/`:
`original.v8`, `cpu.json`, `gpu.json`, `proof.json`, logs and the prior killed log.
`proof.json` includes original/candidate source hashes and strict final result
comparison. An earlier concurrent full attempt was externally killed after its
last logged h768/327outer (8,514 comparisons, error 0); it was not accepted as a
pass. The serialized complete retries above exited 0. The GPU owner was released.
The WebGPU run uses the existing native Dawn/Vulkan SwiftShader path; it proves
WebGPU execution-path parity, **not hardware-GPU performance**.

This closes full scoring replay for this supported miss/recontact case only.
General inverse-search integration, unsupported physical domains, and actual GPU
scoring cases covering positive goal/post-goal opponent foul/horizon limits are
not established by this one case. Public search remains unchanged and off for
this experimental producer. No upload, deployment or CPU fallback was introduced.
