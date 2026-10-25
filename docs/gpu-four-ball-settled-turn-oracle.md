# Settled four-ball next-turn source oracle

This fixture is an independent original-CPU reference for the next real turn.
It does not prove candidate CPU/GPU parity and does not change runtime code.

## Exact source path

`tests/four-ball-settled-turn-fixture.cjs` creates the original `LabController`
and `PhysicsLab`, calls the original four-ball `setupGame()` and `fire()`, and
continuously advances the same world. It does not restore a snapshot, replace
any sphere, assign a score, or bypass cue obstruction.

The first stroke must match the frozen original creation snapshot, first native
h, every one of the full-shot oracle's 5,845 h frames, and all its outer-step
snapshots. The first full rest is outer step 5,404. The game is still pending at
that physical boundary. Observing `game.finish()` inside the original
`controller.finishGameShot()` records two different facts:

1. The scoring method records foul -1 and changes `activeCue` to ID 2 while the
   controller's selected ID is still 1.
2. The original controller then changes `state.selectedId` to ID 2.

Yellow cue ID 2 is registry index 1, not index 2. The same four original object
references, body handles/generations, complete settled body states, and all four
cloth contact caches survive the turn and second cue creation unchanged.
The fixture calls the real `pause(true)` manual control after completing the
turn. It tests input through `changeSettings`, `cueClearance`, and `fire`, not
through a synthetic renderer frame.

## Legal second input

The unchanged original controls (angle 0, elevation 8, centered tip, speed 2)
are tried first. If obstructed, the actual controller must reject the strike,
and the obstacle, clearance, and exact source message are recorded. Only then
may the fixture try a declared finite list of manual-control settings:

- Elevations 8, 15, 25, 40, 60, 80 degrees, in that order.
- At each elevation, yaw 90, -90, 180, 45, -45, 135, -135, 0 degrees.
- Centered tip and speed 2 remain unchanged.

The first geometrically clear input must be accepted by the actual original
controller. No score or future trajectory determines this choice. Changing
controls is asserted not to change the native settled world snapshot.

## Boundary and journal contract

Schema: `original-controller-four-ball-settled-next-turn-v1`.

The sole candidate-input row is `record.boundaries.secondStrikeCreated`.
It has the existing `four-ball-created-fixture.decodeBoundary` shape, including
lossless typed source tree, full decoded managers/arenas/contact graph, and
native byte-roundtrip verification. Native step count is 5,917 (72 constructor
steps + 5,845 first-shot h). Application time is the original absolute time;
`cue.started === application.time`, so second-stroke elapsed is exactly zero.
Application outer steps remain 5,404, with `shots === 2`.

`record.strikeCreationJournal` preserves the 13 original source API calls and
their descriptors, body/joint handle generations, wake arguments, and native
step counter before/after each call. Its phase is `secondStrikeCreation`.
`record.pendingJointJournal` preserves the five exact source API inputs for
joint insertion and mutation. Rapier serialization skips its pending joint
events, so the snapshot alone is insufficient. These entries are explicitly
API-input observations, not a falsely claimed direct read of the native pending
event queue. An initializer may expand these genuine inputs using the pinned
source rules; it must not borrow the expected first-h state.

All other boundaries are expected-only: first-shot provenance, pre-strike,
second first-h pre/post-world and post-application, exact cue removal and the
following application/outer boundary, physical rest, game finish, and controller
selection after the second shot. Every second-shot h contains ball/cue numeric
states, event history, pending game state, absolute/elapsed time, and selected
controller ID. A 256-outer-step grid supplies additional decoded native caches.

## Capture and verification

Heavy native/physics work must use the coordinator's serialized slot. Do not
rebuild shared native helpers or change shared artifact files. Store generated
large artifacts under the task's workspace evidence directory, not `/tmp`.

Required environment variables:

- `RAPIER_SNAPSHOT_DECODER`: admitted original-source decoder binary.
- `FOUR_BALL_CREATION_V8`: frozen original creation artifact.
- `FOUR_BALL_FULL_REPLAY`: frozen original first full-shot artifact.

Run `node tests/four-ball-settled-turn-fixture.cjs /absolute/new-artifact.v8`.
A second independently created continuous original world runs without the API
journal. All boundary bytes/application state, second-shot frames/checkpoints,
input decisions, events, and score/selection results must exactly match. Source,
engine, decoder, both input artifacts/manifests, and capture code hashes are
frozen before and after capture. Existing artifacts are never overwritten.

The light test is `node --test tests/four-ball-settled-turn-contract.cjs`.
After capture, set `FOUR_BALL_SETTLED_TURN_REPLAY` and run
`node --test tests/four-ball-settled-turn-artifact.cjs`. This only verifies the
frozen artifact; it never initializes or steps Rapier.

For a small, early initialization artifact, append `--initial-only`. It still
recreates and validates the full first shot twice, but stops exactly after the
second shot's first native h. Its schema and source provenance are identical;
its explicit extent is `second-first-h-only` and status is
`native-second-first-h-complete`. It contains no withdrawal, second-rest, or
second-score result and cannot be represented as a completed second shot.

## Verified initial-only result (2026-10-24)

Producer source commit: `5112ee2686caddad0cc5b01f0791448676a53b79`.
The preceding recorder-only correction freezes the inertia matrix's returned
WASM scratch view before any later body getter. The first failed attempt stopped
at first-shot frame 1 and produced no fixture; its diagnostic log is retained.
No engine, simulation, comparison tolerance, or reference was changed.

The successful capture has status `native-second-first-h-complete` and:

- First shot: exactly 5,404 outer steps, 5,845 h frames, and 132 nonzero native
  checkpoints matched, independently twice. Result is foul -1 for cue ID 1,
  then original controller selection switches to yellow ID 2 (array index 1).
- Original default input is clear and accepted for the second shot. Settings
  remain angle 0, elevation 8, centered tip, speed 2. Measured original clearance
  is `0.01200001873075962`; obstacle is null. No alternate input was needed.
- Second-created absolute time is `5.6291666666664275`; elapsed is exactly zero.
  Native step count is 5,917. The first second-shot h advances to native 5,918.
- All eleven native boundary snapshots and application states match between two
  independent continuous worlds, including journaled versus nonjournaled runs.
- Artifact SHA256:
  `2bb5487304bba14e665b81e8f394f3d66029e6339541cf49ebbe1db3ca21f47e`.
- Second-created snapshot SHA256:
  `a93473fceb1da27bb580a2981d3e536057eb30856e49d64405ad2b96f8b51e0f`.
- First-h post-world and post-application snapshot SHA256:
  `350c0db9dd6a455468075a83c91fe3e075a05a74ce6287cc7c051a95429cc549`.
- Five light contract tests pass. Frozen initial artifact tests pass six, with
  the second-full-rest test explicitly skipped. No candidate CPU/GPU claim.

The 11,193,253-byte artifact is retained outside Git in the sibling workspace
`billiard-four-ball-settled-turn-evidence`, named
`original-settled-turn-initial-5112ee2.v8`, with its `.json` manifest and capture
and replay logs. Shared original source artifacts were read-only.

Second-shot trace frames are observed before controller completion. The eventual
physical-rest frame therefore keeps the pending game and current selected cue;
only the separately observed `gameFinished` and `controllerFinished` boundaries
show scoring and next selection. This ordering is not silently overwritten.

## Verified full second-shot result (2026-10-24)

The same unchanged producer subsequently captured two independent original
worlds through the second physical full rest. Status is
`native-second-rest-complete`. This source reference still does not establish
candidate CPU/GPU parity.

- The same ID 2/default input starts from exactly the initial-only seed.
  Every overlapping decoded boundary, entire API journal, and first second-shot
  frame is deep-equal between the separate initial-only and full artifacts.
- Second physical rest occurs at 6,642 outer steps / 7,083 native h, elapsed
  `6.918750000003379` seconds. All 7,083 h frames, 28 decoded outer checkpoints,
  and 18 exact boundary snapshots match between independent continuous runs.
- Actual cue removal occurs before application h 448 (after 447 completed h),
  with elapsed time `0.007275390624894129`.
- Source events are stroke, yellow cue/tip contact, right-cushion contact, and
  left-cushion contact. No red or opponent cue contact occurs in this second
  shot. At physical rest the source pending state has `reds: []`, `foul: false`,
  and `cushions: 2`.
- Actual `game.finish()` result is `{cueId: 2, delta: 0, nextCue: 1}`. The
  original controller then selects ID 1. Final scores remain ID 1 = -1 and
  ID 2 = 0. These are observed outcomes, not imposed trajectory/score inputs.
- Second-created topology is 23 bodies, 27 colliders, 2 joints, 24 BVH leaves,
  and four cloth pairs. First h inserts only the three new cue colliders into
  the BVH, reaching 27 leaves while the four existing cloth pairs remain.
- Full artifact SHA256:
  `270000ebe58d2e51f83484917425cb2999425e39a215c2c11620d56d743d591c`.
- Final native physical-rest snapshot SHA256:
  `9b5ca7526b1bb0de1ed7c3ef68ea1b84d3c07fe999adb99dbca59e46f6509cff`.
- Frozen full-artifact tests pass all seven, with no skips.

The separate 71,581,658-byte full artifact is
`original-settled-turn-full-5112ee2.v8` in the same workspace evidence directory,
with its manifest, capture/replay logs, and `5112ee2-full-result-summary.json`.
The initial-only artifact remains preserved. No shared source, native helper,
original artifact, or runtime file was changed.
