# Genuine-three retained outer bookkeeping (HOST/source)

## Authority and separate boundaries

The unchanged `PhysicsLab.step` in `src/physics.js:248–274` is the application
chronology authority. At **each outer entry**, it latches
`subdivisions = cue ? strokeSubsteps : 1`, computes binary64 `h = dt / subdivisions`,
and sets the native integration dt (a binary32 setter). Each inner iteration is:

1. compliant cue preparation;
2. native world step;
3. binary64 `time += h`;
4. cue obstruction observation, collision queue drain;
5. original object-order angular patch;
6. timed cue withdrawal predicate.

Only after all **latched** subdivisions does it restore native dt to `f32(dt)`,
then execute JS `steps++`. Cue removal inside the loop does **not** shorten that
loop. No `time += dt` shortcut is equivalent to its repeated binary64 additions.

This component represents these clocks/counters/native-dt settings, **not the
entire PhysicsLab object or a physical full outer step**. The retained physical
profile still admits only the existing genuine-three no-emission, live-cue,
inactive-CCD, authenticated floor/empty-cue-cache domain. It does not gain cue
withdrawal or event handling merely because the clock can wrap its inner cursor.

`Controller.finishGameShot` (`src/controller.js:88`) is separate: pending game,
no cue, and all actual bodies sleeping precede `game.finish()`. Neither this
component nor `ThreeBallGame.finish()` invents a physical-rest proof or a final
score. Query termination is different again: `optimizer-core.js:252–306` observes
**after a complete outer step**, increments a query-local count, and applies its
mode-specific goal/invalid/rest predicates and `round(horizon/dt)` bound. This is
not the existing absolute `lab.steps` count.

## Dependency projection: no fabricated telemetry

`PhysicsLab.objects[].distance`, `maxHeight`, and `lastPos` are read only by object
telemetry bookkeeping and snapshot/restore/reset operations. `trail` additionally
feeds `LabMath.visibleTrail` / rendering. The physics equations, ThreeBallGame,
and `ShotSearchCore.physicalInputs` do not read these object fields. The authentic
created-world admission does not contain their current values. They are therefore
**excluded**, not initialized to fake zeros or reconstructed from later native
snapshots; no per-candidate 4000-point trail arena is allocated.

Do not confuse those object fields with the **separate search accumulator** in
`optimizer-core.js:198,252–316`: its `length`, `previous`, and `maxHeight` are
initialized by `createPhysicalAccumulator`, updated from actual outer endpoint
positions, and used by legacy ranking/display (`physicalResult`, `acceptCandidate`,
`finishSearch`). A future contract that selects that legacy ranking must preserve
its exact reductions. The compact inverse result contract does not publish that
legacy path length/score/height; winner display/replay is separate. This exclusion
does not authorize returning invented legacy metrics.

The inverse observer has its own source-time/position/velocity/contact metrics,
event episodes and residuals. Its after-world-before-application sample uses the
native f32 step dt whereas application time advances by original binary64 h.
Those exact metrics and the query terminal reducer remain **unimplemented for
this genuine-three owner**. No CPU-forward fill or completed inverse-query claim
is made here. The four-ball observer's fixed four-sphere/catalog admission is
not widened to accept this three-sphere owner.

## Additive interface

`three-ball-outer-bookkeeping.mjs` exports a locally branded authentic-template
plan, assertion, and emitted WGSL generator. It owns 96 words (not per-h storage):

| Offset | Meaning |
|---|---|
| 0–3 | magic/version/sticky status/phase (fresh, inner, outer-complete) |
| 4–7 | latched subdivisions, accepted inner count, completed outer count, reason |
| 8–12 | accepted/entry frame and journal sequence, cue presence at entry |
| 13–14 | native f32 integration dt, original stroke subdivisions |
| 16–27 | binary64 dt, h, current time, absolute steps, outer-entry time/steps |

`rc_three_outer_begin` latches from current same-bank cue presence and authentic
settings. `rc_three_outer_accept_h` consumes each **produced**, completed
application/root/journal/scene boundary exactly once; it verifies the exact next
binary64 time, native/global identity and modulo-64 cue cursor.
`rc_three_outer_finish` requires the full latched count, restores represented
native dt first, then increments binary64 steps and publishes it to the retained
and current-application owners. Early finish, duplicate acceptance and mismatched
clock/sequence are sticky failures, never ordinary misses.

The distinct APIs in `three-ball-retained-h.mjs` are:

- `createThreeBallRetainedOuterHPlan(template)` / assertion;
- `buildThreeBallRetainedOuterHSource(plan)`;
- `executeThreeBallRetainedOuterWordsForTest`;
- `createThreeBallRetainedOuterRunnerForTest` / result assertion.

They append only this 96-word owner to the existing retained bank. The first-h
bootstrap, immutable numerical/geometry programs and reused work/scratch remain
unchanged. Initial native dt is copied from the authenticated native t0 integration settings;
its equality to the ready-boundary f32(original dt) is explicitly required.
A separate initial outer-begin source entry precedes the unchanged
first-h entry. The existing root/bootstrap and reusable advance entries then
accept actual successful inner boundaries and finish bookkeeping at the latch.
Global frame/sequence never reset; only the **new profile's** cue/application
substep checks use modulo 64. The original initial, fixed-h2 and retained profile
APIs keep their previous behavior, including the old retained >=63 rejection.
Portable fingerprints characterize the entire old retained source/initial bank,
program, geometry, layout and capability against `ec3c1f5`.

## Qualification scope

The focused test keeps the exact original `t0 -> h1 -> h2 -> h3` fixture, including
all five bodies, full scene/FIFO, all 2678 cue words, all joint/CCD input and output
words, full BVH/allocator/roster, native empty-manifold/recycle data, all floor
cache words, clocks, patches, and complete unchanged history. It does not replace
original PhysicsLab with a convenience wrapper for that gate.

Separate bounded **component-only** tests call the unchanged
`PhysicsLab.prototype.step` with substituted native world/physical methods to
exercise its 64-substep latch, a cue disappearing mid-loop, the no-cue single-step
branch, and dt-reset/steps ordering. Their boundary inputs are labeled control
witnesses, **not physically reachable trajectories, native world parity, emitted
no-event proofs or withdrawal qualification**.

No `h1 -> h64` physical sweep is performed. General active contacts/CCD, eventful
history/ThreeBallGame transitions, real withdrawal, complete outer64 physical
parity, genuine-three inverse query observation/termination, GPU/native numerical
qualification and runtime/default activation remain separate gates.

### Recorded HOST checks

- Preserved initial compiler rejection: `/tmp/three-retained-outer-h-host.log`.
  The Number-only bootstrap omitted the exact numeric-profile declaration;
  execution stopped before physics. Adding the unchanged preserved-f32 library
  repaired transport admission, not physics equations.
- Corrected combined exploratory gate: 14/14, no skips, 133.785 s,
  `/tmp/three-retained-outer-h-host-r2.log`.
- Final separated exact original h3 gate: **12/12**, no skips, 130.863 s,
  `/tmp/three-retained-outer-h-host-final.log`.
- Final bounded bookkeeping/admission-identity gate: **6/6**, no skips, 25.336 s,
  `/tmp/three-outer-bookkeeping-identity-final.log`. The historical HOST factory
  is reconstructed solely to prove the later native-t0 admission tightening
  leaves the **complete bank, program, geometry, layout, capability and every
  first/outer-begin/bootstrap/advance source byte identical** to the passed h3
  profile. No future endpoint is an input to that identity comparison.
  The unchanged original timed-withdrawal predicate drives the substituted-cue
  component witness; the same component bank then exercises a second outer
  entry, including relatching to one subdivision after removal. This is still
  not native withdrawal or a physically reachable trajectory qualification.

Every run uses process-local disk-backed
`TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp`.
No historical evidence path is rewritten. This adds no default test workload,
GPU launch, complete physical outer64 claim, telemetry zeros or runtime activation.
