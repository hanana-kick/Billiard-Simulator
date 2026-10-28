# Retained genuine-three inner-h owner — source plan

The frozen first-h and second-h profiles remain unchanged. The successor uses
one allocation of the existing h2 phase/work regions plus one64-word retained
control. It does not append an h3 bank or compile a graph per frame.

## Entry points and immutable inputs

`createThreeBallRetainedHPlan(template)` admits only the existing locally
branded authentic created t0 template. `buildThreeBallRetainedHSource(plan)`
exposes an unchanged `first` source, a small `bootstrap` seal entry and one
reusable `advance` entry, with the same
state/program/geometry/scratch bindings used by `compileMicrocodeWGSL` and its
retained VM. Bootstrap invokes the unchanged first-h source exactly once.
Each advance consumes current same-bank physical and discrete state; there is
no HOST phase decision, source-physics callback or future-state copy.

The shared source ABI is `three-ball-retained-control.mjs`. Dynamic cue frame,
journal sequence, scene epoch and binary64 time are captured from the actual
prior completed application. Addition is overflow-checked. A next target frame
is a control expectation, not permission to write a journal sequence: original
journal narrow advances that sequence and is checked against the expectation.

## Preserved state versus reusable work

Physical bodies, cue warmstart/joint metadata, full cue transport, scene
manager/FIFO/epochs, journal edges/lifetimes/sequence, BVH nodes/allocator,
ordered contact roster, current floor caches/fat bounds, actual empty cue
cache records/metadata/previous FIFO, and full tape are retained. No original
counter, contact lifetime, cue frame or event history is normalized to t0.

Only transient per-pass cursors, completion masks, pending-job state, and
numerical input/output/scratch may be rearmed, after exact prior completion
checks. This rearm is emitted source, not HOST memory edits. Empty-cache
records and the previous retained-candidate queue survive it. Failed advances
are sticky unsupported drafts and cannot be resumed or published as a MISS.

## Same original chronology

Current cue prepare → current geometric Guard → scene user-change FIFO/drain →
current broad/journal → current floor/empty geometry → journal narrow → actual
retained-then-added empty-cache recurrence → native current-active pre-CCD with
retained pre-force words → deferred BVH join → energy → real ordered roster →
one cue joint + real three-sphere numerical solve/post-CCD → per-body bounds
then final mass → BVH/journal seal → one joint adoption/COM reconciliation →
original binary64 clock/observation/drain/angular patch/withdrawal checks →
full-tape-preserved publication.

## Ownership and enforceable limits

The sibling BVH owner supplies additive retained Guard, empty-cache and final
physical profiles. The main three-ball owner supplies lifecycle, floor,
native-current pre-CCD, roster, numerical, application and immutable scheduler.
Old profile emitted bytes must remain stable under additive parameterization.

`createThreeBallRetainedRunnerForTest(plan,{testOnly:true})` privately allocates
the bank/scratch once, runs first-h/bootstrap once, and exposes `advance()` with
no arguments. It compiles the advance source once and reuses that code for each
advance. Diagnostic snapshots are copied out and sealed; they are not inputs.
Overlapping advances and snapshots during an advance are rejected. A HOST
transport exception closes the runner to retries; this is transport ownership,
not a change to the emitted source's physical unsupported status.
`executeThreeBallRetainedWordsForTest` is explicitly a low-level corruption-test
harness, not an authenticated runtime-input API.

The native fixture is the original controller/PhysicsLab/ThreeBallGame and
pinned Rapier, continuously from authentic selected-2 created t0. It stops before
the fourth tip call, after exactly three original world/application slices;
the original 64-substep outer latch is still in progress. Expected native
endpoints are decoded only after source execution. The tested h3 empty cache
must use native h2 recycle state, not merely reproduce a first-birth output.
No numerical GPU job or outer-step sweep is part of this work.

## Compiler and eventual event-owner seam

The emitted entries use existing state/program/geometry/scratch bindings0..3,
`compileMicrocodeWGSL(...,{intrinsics:'source-numeric-v1'})`, and the existing
HOST VM. The immutable numerical program remains 1,203,783 words; the one bank
is 73,920 words including the 64-word root, with 13,632 reused scratch words.
There is no per-frame code generation, additional owner bank, or HOST physics
callback in the emitted chronology. The HOST numeric intrinsic is the existing
exact source qualification transport, not a native GPU result.

This does **not** widen `createMicrocodeWorldSession`, its four-ball runtime
schema, row packing, device PC schedule, or production dispatch. A later native
adapter must admit this distinct genuine-three initial schema, upload only its
initial bank/program/geometry, bootstrap once, and keep the current root/VM
state while repeatedly calling the same advance. It must preserve failure and
incomplete-budget status, and independently qualify all bindings/represented
native fields before claiming GPU support. It cannot relabel four-ball rows.

The future emitted event owner belongs after physical BVH/journal seal: actual
cue-obstruction observation, ordered native event drain, exact source app clock
and patch ordering, then withdrawal and emitted history/ThreeBallGame updates.
Current no-emission predicates cover these reached paths and retain full
history exactly; they are not an event reducer. General event creation/drain,
point-bearing cue contact, off-table events, outer64 bookkeeping/finish and
controller search-vs-gameplay completion remain separate gates.

Active contact/CCD, unknown edge classes/removal, changed floor topology,
unrepresented retained torque or newly-awakened history, real emissions, cue
withdrawal, integer overflow, and the64th inner substep requiring original outer
bookkeeping remain explicit unsupported boundaries. ThreeBallGame has an exact
HOST reducer, not yet an emitted event/history/contact/finish owner. The retained
no-event profile preserves it; it does not fabricate gameplay evaluation.

## Evidence and retained failed witness

Initial integration `three-retained-h-integration.log` failed during HOST
compilation with `Unsupported builtin lowering rc_scene_finish_application`.
Already-pruned component sources omitted the original external application
finalizer. Adding the **unchanged** full SceneActivation source fixed linking;
no equation, predicate, or expected value was changed. It was a compiler/link
failure, not a numerical parity result.

The first corrected integration (`three-retained-h-integration-r2.log`) passed
2/2 in 52.77 s, comparing both h2/h3 native body/scene projections.

The expanded `tests/resident-three-ball-retained-h.mjs` gate passed **8/8, no
skips, 81.25 s** (`/tmp/three-retained-h-expanded.log`). Source compile/bootstrap
and two advances took 44.13 s; this HOST transport timing is not a throughput
benchmark. The original continuous three-h fixture including setup took
180.09 ms and reported peak RSS 236,524 KiB. Exact comparisons cover all five
body projections and full scene manager/FIFO, all 2,678 CUE words under the
native/source-transition partition, full native BVH/roster, complete empty
manifold and recycle metadata, all 48 independent Pair inputs/all 20 outputs,
all 144 floor words, exact clock/angular outputs, and unchanged complete tape.
The h3 Pair input42 is actually1, input25..41 equals the native prior recycle
record and produced prior cache, candidate order/lifetime persists, and there
is no new AddPair. Ten epoch/rearm/emission/history/outer64 corruptions reject
before a new cue prefix/publication and remain sticky on retry.

The portable `tests/resident-three-ball-retained-default-bytes.mjs` gate passed
**1/1, no skips, 10.00 s** (`/tmp/three-retained-default-bytes.log`). Eleven old
h2 source/initial/program/geometry/layout fingerprints exactly match frozen
7512e3a; no unmerged git object or developer worktree is needed at test time.
All commands used process-local
`TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp`;
historical `/tmp` evidence paths are intentionally preserved.

The final strengthened gate passed **10/10, no skips, 82.32 s**
(`/tmp/three-retained-h-complete-gate.log`): all 144 native prefix joint inputs
and every original numerical output/trace are exact at h2 and h3; all five
actual awake-order pre-CCD inputs64/outputs11 and post-CCD inputs64/all outputs
are also exact. Source compile/bootstrap/two advances took 45.49 s. Overlap
rejections are exercised during those same two advances, without another h.
The original three-h fixture including setup was 164.46 ms, peak RSS
248,208 KiB. These are bounded HOST resource observations, not benchmarks.

A separate read-only peer review found no concrete missing no-event/order link
in the admitted slice: previous clock/tape/no-event proof precedes root frame
advance; Empty entry lifetimes precede work clearing; physical rearm preserves
canonical/cache/local mass; Guard follows new cue prefix; current scene epoch
is refreshed after actual energy/roster; physical bounds/mass/journal seal
precedes one joint adoption and object-order application patches. This review
does not extend the supported domain or replace the executable gates.

These HOST results never imply full rest, outer64,
general retained admission, native GPU, or production qualification.
