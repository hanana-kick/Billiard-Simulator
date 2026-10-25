# Four-ball goal and late-opponent physical holdouts

## Scope and non-claims

`tests/four-ball-goal-fixture.cjs` constructs the original controller and original
Rapier-backed `PhysicsLab`. It observes original calls without replacing their
arguments, receivers, return values, physics, materials, or collision checks.
It never restores a candidate or native future snapshot into the running world.

These fixtures are **not CPU/GPU parity evidence by themselves**. They supply
independent native expected traces and genuine initial inputs for a separate
candidate comparison. The capture must reach native sleep for every ball, remove
the physical cue, and call the original `finishGameShot()` before reporting a
final score. Reaching two reds alone is not completion.

## Exact original input route

1. Create the unchanged original controller and `PhysicsLab`.
2. Select four-ball mode through the existing setup path, preserving all four
   original object identities.
3. Call `controller.move(id, {x, y: radius + 0.00005, z})` once per declared ball.
   Each original collision-safe placement must return true. No overlap bypass
   or direct replacement of body state is allowed.
4. Advance the existing world with original `lab.step()` until every ball reports
   native `isSleeping()`. The 2,000-outer-step settling ceiling is an incomplete
   capture boundary, not permission to freeze bodies.
5. Keep the original manual shot input unchanged: angle 0°, elevation 8°, centered
   tip, speed 2. Call original `controller.fire()` and preserve any rejection.
6. Continue real original physics for up to 16,000 outer steps, recording the
   actual emitted contacts and before/after game state. A ceiling exit is marked
   incomplete, never treated as a point or foul.
7. At all-ball native sleep after cue withdrawal, call original
   `controller.finishGameShot()` and preserve its actual result and selected cue.

The original ball radius is 0.03075 m. Cloth half-extents are x = 1.42 m and
z = 0.71 m. Inputs stay within the original cloth bounds with radius clearance;
the authoritative original placement collision checks still decide acceptance.

## Input hypotheses, not expected trajectories

The initial geometric hypothesis places white at (-0.5, 0), red 1 at
(0.0435, 0.0435), and red 2 at (0.2615, -0.2), in original table x/z coordinates.
For the positive-goal hypothesis yellow is at (-0.8, 0.4). For the late-opponent
hypothesis it is at (0.2, -0.55). All input y coordinates are 0.0308 m.

These positions are deliberate legal test inputs, not claimed successful paths.
A run preserves its complete event trace even if the requested outcome is absent.
Further input adjustments must be small, bounded, and explained by these actual
traces. The script does not scan an angle/position grid or alter the shot input.

## Evidence schema

- `placements`: exact original controller method, ID and position inputs,
  returned acceptance, and observed before/after states.
- `beforeStrike`: native all-four-settled pre-cue snapshot, original application
  state, and original object/handle registry.
- `goalStrikeCreated`: original physical cue creation boundary, before its first
  native h. This is the candidate initial snapshot boundary, not a post-step
  expected state. It is deliberately not mislabeled as a second-turn shot.
- `strikeCreationJournal`: original calls with phase `goalStrikeCreation`, exact
  descriptors, native handle generations, call order and native-step counts.
- `pendingJointJournal`: the five actual original joint insertion/mutator API
  inputs whose native pending events are omitted from serialized snapshots.
- `firstH.*`, withdrawal, rest, and every later checkpoint: expected-only native
  outputs. These may never be candidate initialization inputs.
- `frames`: every original h with all body poses, velocities, inertias, sleep,
  original contacts, pending game state and controller selection.
- `events`: every original emitted event with exact game state before and after,
  all four observed body states, order, time and step information. Goal and
  opponent markers are derived from these observations; no game state is set.
- `score`: only the observed result from the original game finish method.

A full artifact repeats the continuous capture without the API journal and
requires byte-identical original boundary snapshots plus exact contact, game,
and sampled path agreement. Decoded boundaries preserve the native lossless tree.
Creation-journal hashes use the admitted tagged/sorted/f64-bits encoding, not
noncanonical V8 object representation.

## Required holdout assertions

Positive: white genuinely contacts both distinct reds while no opponent contact
occurs, all balls reach real sleep, and original finish returns +1 with white
retaining the turn.

Late foul: white genuinely contacts both distinct reds with foul still false;
only at a strictly later original event/time does it contact yellow, making foul
true; every ball is followed to native sleep, and original finish returns -1
with yellow selected next. A first-opponent-then-red sequence does not qualify.

## Running

A coordinator-granted serial physics slot is required before setting
`FOUR_BALL_GOAL_SERIAL_SLOT=1`. No simultaneous heavy native/CPU/GPU run is allowed.
Artifacts belong under the workspace, never `/tmp`, and are never overwritten.

Probe only (keeps all emitted contacts, rest result and sampled actual paths):

    FOUR_BALL_GOAL_SERIAL_SLOT=1 node tests/four-ball-goal-fixture.cjs /workspace/path/positive-probe.v8 positive probe
    FOUR_BALL_GOAL_SERIAL_SLOT=1 node tests/four-ball-goal-fixture.cjs /workspace/path/late-probe.v8 lateFoul probe

Full independent capture after a genuine input is observed to qualify:

    FOUR_BALL_GOAL_SERIAL_SLOT=1 RAPIER_SNAPSHOT_DECODER=/absolute/admitted/decoder node tests/four-ball-goal-fixture.cjs /workspace/path/positive-full.v8 positive capture

A scenario argument can instead name an explicit JSON input file containing
`name`, `requiredOutcome`, and the exact four `{id,x,z}` placements. This supplies
original controller inputs only, not native state or expected contact events.

Lightweight contract checks do not advance physics. Set
`FOUR_BALL_POSITIVE_GOAL_V8` and `FOUR_BALL_LATE_OPPONENT_V8` to already-captured
full artifacts to enable genuine frozen-evidence assertions.

## First genuine source findings (2026-10-24)

Recorder source commit `7777766` was frozen for three bounded native probes.
All used original default cue input, collision-safe controller placements and
484 outer native settling steps before the shot. No extra trajectory search ran.

- Initial positive input: genuine white-to-red-1 at 0.23854166666667154 s after
  strike, white-to-red-2 at 0.4500000000000154 s, no white-to-yellow event through
  native full rest at outer 5039 / h 5480. Original finish returned
  `{cueId:1, delta:1, nextCue:1}`.
- Initial late-opponent hypothesis: **did not achieve a late foul**. It also
  returned +1 and never hit yellow. The original white ball went mostly right,
  rather than down toward yellow at (0.2, -0.55). This failed input and complete
  result remain frozen separately; they were not changed into a passing fixture.
- One trace-guided adjustment moved only yellow to (0.5, -0.18). All three other
  positions and cue input remained unchanged. The actual two red contacts
  retained the exact times above. White then hit yellow at 1.0270833333333207 s
  after strike, strictly 0.5770833333333054 s after the second distinct red.
  Original pending state changed from reds `[3,4]`, foul false, to foul true.
  Native full rest occurred at outer 4974 / h 5415, and original finish returned
  `{cueId:1, delta:-1, nextCue:2}`.

The reproducible successful placement inputs are separately checked in as
`tests/four-ball-goal-positive-input.json` and
`tests/four-ball-goal-late-opponent-input.json`. They are inputs, not contact
sequences or precomputed outcomes. The original failed hypothesis remains in
`BASE_INPUTS.lateFoul` and in its separate captured evidence.

Probe evidence directory:
`/workspace/scratch/f887f82f638e/billiard-four-ball-goal-evidence/`.
Artifacts: `7777766-positive-hypothesis.v8`, `7777766-late-hypothesis.v8`, and
`7777766-late-observed-path.v8`, with exact input/event/result JSON manifests.
These probes intentionally omit full per-h frames, creation journals and native
decoding. They establish source behavior, **not candidate CPU/GPU parity**.

## Completed frozen original fixtures

Both successful inputs were captured under unchanged recorder SHA-256
`ecdeac9ef6023655c853b8ed0bb839b269903edd825e3f0b6de88696dcbcc727`.
Each contains the full 94-entry original API journal, 32 actual placement-phase
API observations, 13 cue creation/mutator inputs, 5 joint pending-input entries,
all per-h original states, 11 losslessly decoded named boundaries, and 29
positive / 30 late-opponent expected-only decoded shot checkpoints. The independent no-journal continuous
recreation exactly matched both captures. All-ball native settling before cue
creation is 484 outer steps, so the creation native step count is 556.

In the evidence directory above:

- `f9a18d6-positive-full.v8`: 54,472,395 bytes. SHA-256
  `f20c802c0d6ef4f91263dd607c1b6317d0ec07c4fad3eb63cb67a4c21f5baf98`.
  Initial snapshot SHA-256
  `2fbe24668f912195b3d398434ec1491f0a305d2f4f83d874408d331277a89f4c`.
- `f9a18d6-late-opponent-full.v8`: 56,226,038 bytes. SHA-256
  `36558a2590539af234d4791a95f93b1cb3e6cf62b19d966301e0f5c6e5308e0c`.
  Initial snapshot SHA-256
  `56faf7ea3ae80c2a5b7a524f291ebaac405733887843fa6c1fe1c915c4cdc8b0`.

Consumers should use `tests/four-ball-goal-artifact.cjs::loadArtifact`. The frozen
recorder's original loader compares undefined properties against JSON-omitted
properties in a compliant-tip event summary. The separate read-only loader fixes
only this representation comparison: it omits undefined object properties,
rejects NaN/Infinity and undefined array elements, and never changes original
raw events, numbers, native snapshots, or journals. The recorder bytes and
artifact bytes remain unchanged.

`placementProvenance(record)` projects non-numerical provenance from observed
`record.placements` plus the actual original placement API journal. It verifies
the four original body identities, exact setTranslation descriptors and step
counts, and returns a journal digest. It does not infer a placement from the
requested geometry. Numerical candidate input remains the exact original
`{goalStrikeCreated, strikeCreationJournal}` pair, with the separately explicit
placed-goal origin contract.

Frozen artifact contract tests pass for both full fixtures, including strict
red1/red2/opponent ordering, native sleep, original game finish, unchanged
pre-cue-to-created ball bodies and cloth caches, exact source/byte/journal hashes,
and manifest-normalization rejection checks. Candidate CPU/WGSL whole-shot parity
remains a separate required test and is not claimed here.

Frame timing follows the existing original full-shot oracle: the final per-h
`game` field is updated with the real finish result after physical rest. Its
`controllerSelectedId` remains the selection observed inside that h, before
`finishGameShot()` runs. The authoritative post-finish selection is separately
recorded in `boundaries.controllerFinished.application.controller.selectedId`
and `score.nextCue`; for late foul these are both 2. Candidate tests must not
confuse shooter identity inside the h with next-turn selection after finishing.
