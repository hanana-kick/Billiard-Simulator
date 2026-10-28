# Experimental source-owned raw world candidate batch

This is a **new opt-in variant**, not application routing, a release, or a claim
that the older 29-source prepared-world N2048 benchmark covers raw shots.

## Frozen boundary

The source snapshot is generated from commit `0850a4d`: 66 generic world
modules, 11 microtail modules, journal, raw-prefix seam, and rule reducer (80
modules, 369,887 source characters). Final generated shader strings include the
single-world factory's exact source substitutions. Newer cushion, kiss-coverage,
and >66-iteration changes are deliberately excluded. Updating this snapshot is
an explicit new ownership/index audit, never an automatic hash refresh.

`experimental-raw-world-batch-phases.mjs` specifies 86 variants: the 80 modules,
three journal entrypoints instead of one module, and four combined-row subviews.
`experimental-raw-world-batch-audit.mjs` pins exact source digests and checks every
scheduled binding against full allocation stride, view offset, and view length.
The existing strict candidate-Y transformer is unchanged. Journal adaptation
removes only the three exact entrypoint attributes and adds one selected wrapper;
its bodies are unchanged. Unsupported synchronization/pointer/shadow shapes
continue to reject.

Candidate-local index review assumes the owned producer's bounds: 3/4 balls,
finite static count <=20, and immutable query extension <=256. World state max
index is255, dense/smooth255, rolling511; descriptor max80B-1; advanced max143
inside160; mixed combinedRows max632 inside640. Pair sample capacity is1280B
words (10 nodes/body); mixed sample capacity1408B (11 nodes/body). Journal writes
are guarded by J and auxiliary stride is8J. Subviews retain stride640 rather than
their shorter view length. Shared bindings are only immutable geometry/material
or host schedule constants. In particular both ctx and rctx are candidate-local.

## Execution and limits

The existing raw N bank and PW1[N] handoff stay GPU-resident. Generic continuation
uses candidate dispatch Y and preserves the original X body/cell lanes. All
mutable contexts, configurations, state, journal and rules are candidate-local.
Microtail context initialization is one candidate-parallel copy/reset kernel;
clearing ctx[15] as one contiguous span would be incorrect for N>1.

The default result path maps only 16 bytes/candidate. Journal and its auxiliary
sidecar remain GPU-resident. Full-word readback exists only behind explicit
`diagnostic:true`. There is no host candidate physics between phases, no
intermediate readback, and one command submission per tile. Cancellation before
submission prevents the submit; after submission it suppresses the result and
cleans resources after completion, not cancellation of hardware instructions.

Tiles contain1..1024 candidates. The owned allocation cap is256 MiB, checked
against adapter buffer and storage-binding limits before allocation. For4 balls,
P>=3,J128, the conservative no-alias storage is167,300 bytes/candidate plus small
shared assets. N1024 is about163.4 MiB; N2048 would be326.8 MiB and is not admitted.
Compiler/driver memory is separate and native validation is additionally guarded
by a1500 MiB aggregate-process watchdog. N256 is the fallback tile size.

The frozen schedule has87+192P dispatches excluding the raw producer/handoff.
Raw K16 adds3+ceil(S/16) for S>0; staged adds3+4S. This is a command-count formula,
not a throughput measurement. K16 remains explicit opt-in. The default original
backend and every existing single-world/old-batch implementation are unchanged.

## Verification status

Structural CPU tests verify80 source pins,86 strict lift variants, B3/B4 and
P1/2/3/66 allocation/view schedules, source/view/shared-binding drift rejection,
compact-only readback, and allocation limits. These tests do not prove GPU parity.
Independent source-address review found no blocker for bounded native N1 and
cross-candidate diagnostic testing, subject to the producer invariants above.

Native test `experimental-raw-world-batch-native.mjs` uses one actual immutable
scene with cue50 at0 and red8 atx=.085, plus red300/opponent19. It includes the
source-owned raw angle0/elevation25/speed.5/tipX.2 hit, away-directed parameter
rows, and raw failure. A hit is not automatically a gameplay goal. Native evidence
will be recorded separately only after terminal watchdog results.

### Reproduction

- `node scripts/capture-raw-world-batch-sources.mjs /tmp/sources.mjs`
- `node scripts/capture-frozen-raw-world-batch-reference.mjs /tmp/reference.json`

Both recover0850a4d explicitly, not HEAD. They never update audit pins. The first
reproduces the source snapshot byte-for-byte; the second reproduces the saved CPU
reference byte-for-byte, including raw-scene and PW1-template hashes. Compare
outputs before changing any checked-in reference. The reference currently covers
angle0 hit/REST, angle90 no-pair **pending**, and angle330 hit/REST on the same scene.
The pending case is not described as a complete clear or MISS.

### First native checkpoint

N1/N3 test passed2/2 under shared flock and watchdog:32,076 literal words exactly
match the frozen CPU references and independent N1 candidate executions. Mixed
raw failure preserves neighboring output, and before-submit/after-submit cancel
plus reuse passed. Native compile87.626s; total109.962s; sampled aggregate1089.57
MiB (limit1500), no watchdog trip. N3 diagnostic allocation591,168 bytes; one
software-Vulkan submit3.189s. This is not physical-GPU throughput evidence.
`artifacts/raw-world-batch/n1n3-native-checkpoint.json` records the terminal receipt.
The prior attempt failed on an incorrectly classified speed.4 fixture after the
actual hit's2916-word parity succeeded; it is retained as a failed attempt, not
counted as a passing run. Larger widths were not measured in this first run; later checkpoints follow.

### Candidate-boundary checkpoint

N1/3/31/32/33 and reverse permutations passed2/2 native tests:591,948 literal
words match frozen CPU references/N1 outputs. This includes the earlier N1/N3
subset, not591,948 additional unique words. Explicit compact-only execution maps
16 bytes/candidate with no diagnostic buffers. Compile91.979s; total199.477s;
aggregate1052.45 MiB, no watchdog trip. `npm run typecheck` passed.
Evidence: `artifacts/raw-world-batch/boundary-native-checkpoint.json`.
The33-row stress reference is losslessly gzip-encoded little-endian u32; the three
original reference cases are unchanged. Larger tiles were not measured in that run; see the later checkpoints below.


### Explicit host128 scheduling revision

`pipelineRevision: '0850a4d+host128-v1'` permits up to128 host world-prefix
steps without replacing any of the80 pinned shader modules or86 strict lifts.
The default `0850a4d` domain still rejects more than66. This is a separately
identified scheduling domain, not implicit adoption of later cushion/kiss physics.
`capture-frozen-host128-goal-reference.mjs` recovers0850a4d and checks original
source hashes before exactly two admission-guard replacements (66→128). The
checked-in reference records both replacements and before/after hashes. Its
actual raw shot reaches full REST and goal compact `[100,1,0,1]` in that CPU
reference. Native N1 now passes2/2 tests with2916/2916 exact CPU words and a
separate16B compact-only run: compile95.366s, total107.811s, aggregate1103.07MiB,
no watchdog trip. Receipt: `host128-goal-native-checkpoint.json`. This does not
qualify goal at scale or any newer physics revision.

Scale reproduction accepts an explicit third argument1024:
`node scripts/capture-frozen-raw-world-batch-reference.mjs /tmp/scale.json 1024`.
The scale harness uses1024 unique IDs cycling the same three actual parameter
classes, not1024 distinct trajectories. It compares full words against recovered
0850a4d CPU atN256 and reverses a compact-only256 tile to verify16B/candidate
readback. N1024 uses exactly one compact-only execution and checks all4096 compact
words; it does not allocate or read full diagnostics or rerun physics.
N256 full words and N1024 compact results are qualified separately below.


### N256 checkpoint

N256 passed2/2 native tests,746,496 full diagnostic words exact to isolated0850a4d
CPU, followed by a reversed compact-only tile mapping4096 bytes total. Compilation
104.300s; diagnostic queue95.935s, encode307ms, readback1.16ms; compact queue90.381s,
encode279ms, readback5.45ms. Owned allocation48,820,052 bytes diagnostic and
42,848,084 bytes compact; banks destroyed between runs. Total292.082s, aggregate
1081.28MiB under420s/1500MiB watchdog; no trip. Receipt:
`artifacts/raw-world-batch/n256-native-checkpoint.json`.
These256 unique candidate IDs cycle3 parameter classes (hit/REST, honest pending,
hit/REST), not256 distinct trajectories. No goal-at-scale claim. N1024 compact-only
qualification passed as recorded below.


### N1024 compact-only checkpoint

A single N1024 execution passed2/2 tests, all4096 compact words exactly matching
isolated0850a4d CPU. No full diagnostic allocation/readback and no second physics
run. Exactly16,384 bytes were mapped, with171,334,484 bytes owned allocation
(~163.4MiB), under256MiB. Compilation96.356s, host preparation59ms, encode301ms,
queue359.243s, readback129ms; total456.988s. Aggregate1113.97MiB, no watchdog trip
under600s/1500MiB. Receipt:
`artifacts/raw-world-batch/n1024-compact-native-checkpoint.json`.
This qualifies all1024 compact results for3 repeated parameter classes with unique
IDs, not full N1024 intermediate states, goal at scale, or physical-GPU throughput.
Full diagnostic state equality is established separately atN256; actual raw goal
is established separately atN1 on explicit `0850a4d+host128-v1`.

### Frozen stable-roster execution domain

Both `0850a4d` and `0850a4d+host128-v1` explicitly reject stable **body roster** IDs
above `0x7fffffff` at batch continuation binding, before shader compilation or
allocation. IDs are never clipped, signed-coerced, or rewritten. This is an
old-profile execution restriction, not a change to canonical scene identity:
canonical scenes still retain full-u32 roster IDs, and independent **candidate**
IDs remain full-u32 (including `0x80000000`, `0xfffffffe`, and `0xffffffff`).

The isolated archived CPU reproduction uses the actual raw angle0/elevation25/
speed.5/tipX0/tipY.2 shot in the scale scene, changing only first-red stable ID8.
ID8 and `0x7fffffff` reach REST. IDs `0x80000000` and `0xffffffff` throw
`Smooth input range` in frozen `smoothRow` → `advanceMixedWorldCPU`, because its
stable ID is read through an Int32Array and passed to a nonnegative signed-range
internal recipe packer. Candidate ID stays `0xfffffffe` throughout. Changing only
the cue ID in the simpler hit fixture did not trigger this path; the rejection is
conservative for all bodies because any body may later enter mixed smooth motion.

Reproduce:
`node scripts/probe-frozen-raw-world-roster-domain.mjs /tmp/roster-domain.json`.
Evidence: `artifacts/raw-world-batch/frozen-roster-id-domain.json`; host guard tests:
`tests/experimental-raw-world-batch-roster.mjs`. No archived CPU/shader repair,
source-pin change, transformer change, or latest-physics import is included. All
previously qualified scale/goal fixtures use supported low stable roster IDs, so
this admission-only guard does not require repeating their native kernels.
