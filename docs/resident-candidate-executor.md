# Resident candidate executor — implementation contract

Base: `e0a8275`. Experimental implementation only; the original CPU application,
inverse planner, public build and deployment remain unchanged.

Current release/mode/API gates are tracked in
[`resident-release-gates.md`](resident-release-gates.md). Dated entries below
remain bounded historical evidence; none promotes the backend by itself.

## Endpoint and non-goals

One authenticated original registered four-ball pre-strike world, immutable
geometry/materials/rules and arbitrary candidate rows enter the evaluator.
Each row has the five raw JavaScript Number parameters. GPU-owned mutable bodies,
contacts, warmstarts, source graph/roster/BVH, activation, CCD and rules survive
multiple complete `h` steps without intermediate host physics readback. Only
compact terminal records return; winning trajectories are replayed separately.

Candidate generation is independent. The endpoint must accept inverse-solver
probes as well as an explicitly requested grid. This work does not add an expert
"standard shot" prior or replace the existing inverse planner.

`src/resident-candidate/abi.mjs` defines 64-byte input and 16-byte output records.
Parameter bit patterns are not normalized, rounded, wrapped, or converted to
f32 by transport. Unsupported, incomplete, cancelled, failed and rejected inputs
carry an unset result, never an evaluated miss. Numerical source admission is a
device responsibility. No CPU-forward fallback is permitted.

## Implementation state

The experimental executor is callable and has independent created two-h and
raw-to-first-h fixtures. **It has not passed full-rest, 1,024-trajectory or
hardware-throughput acceptance.** The staged expanded schedule is a diagnostic
oracle, not the final throughput path. Dated checkpoints below are historical,
not concurrent claims. Independent implementation domains are:

1. Liveness-bounded arithmetic lowering preserving every original eager node,
   operation order, f32 boundary and signed-zero behavior.
2. Source-ordered packed contact roster and BVH mutations.
3. Raw parameter validation, source-number operations, pose, original swept
   clearance, actual cue creation and source allocation.
4. Packed physical rule state, late-foul/rest/horizon semantics.
5. World-state packing and complete-`h` device orchestration/integration.

These domains are dependencies of one vertical slice, not separately sufficient
acceptance results. Unimplemented phases must not produce guessed physics or a
success flag.

## Source numerical and lifecycle obligations

- Parallelize across candidates before within one world's ordered PGS solve.
- Preserve source graph birth/death order, swap-removal, color/hint lifetimes,
  island IDs/free lists, warmstarts and CCD traversal/pass order.
- Original cue stroke uses 64 application subdivisions and real spring/joints,
  not a directly assigned ball velocity. Source post-cue CCD has up to four
  internal passes; application resistance is applied at the original boundary.
- Preserve both source angular-patch eligibility and compensated-graph gates.
- Existing double-single graphs are approximately 48-bit, not binary64. Their
  bounded prior evidence is not a universal source-semantics guarantee. Raw
  sin/cos/hypot, carried tangent normalization, branch thresholds and native
  f32 behavior require independent comparison against the pinned source.
- Four-ball success remains provisional until physical rest; opponent contact
  after the goal is still a foul. A horizon cannot certify an unfinished success.
- Chunks are bounded. Cancellation does not instantly interrupt submitted GPU
  work; suppress publication and drain before reuse. Source revision is checked
  before dispatch and after drain. Device loss is explicit failure.
- Fixed-capacity exhaustion is explicit unsupported/overflow, not truncation.

## Parameter-space prerequisite

The current default is continuous inverse solving, not a Cartesian grid:
`controller.js:10`, `inverse-planner.js:51,61`, `inverse-solver.js:25–34`.
Default search bounds are angle modulo one turn, elevation 0–85 degrees, speed
0.5–4.5 m/s, tip rectangle [-0.55,0.55] × [-0.45,0.45] intersected with radius
0.6. Fixed elevation uses the current value (initially 8 degrees); spin off fixes
both tip coordinates at zero. Slider endpoint choices are not sampling steps.
The legacy optimizer's 1e-5 normalization is not a default inverse-search grid.

The following are **illustrative assumptions**, independently counted using
integer/rational disk membership. Angle is half-open to avoid duplicate ±180.
Speed/elevation bounds are inclusive. Tip points are retained, not projected
from an enclosing square (which would introduce duplicates).

| Grid | Angle step | Speed step | Elevation step | Tip step | Valid tips | Combinations | 1,024-row waves |
|---|---:|---:|---:|---:|---:|---:|---:|
| Coarse | 5° | 0.5 | 5° | 0.05 | 393 | 4,583,952 | 4,477 |
| Medium | 1° | 0.1 | 1° | 0.05 | 393 | 498,858,480 | 487,167 |
| Fine | 0.1° | 0.05 | 0.5° | 0.025 | 1,541 | 76,839,807,600 | 75,038,875 |

Formula: angle count × speed count × elevation count × valid tip-pair count.
The tip counts are 437−44 and 1,665−124. No selected grid point is exactly on
the disk boundary. A batch size is not a search-domain size. An unsearched
region is not evidence of no solution.

## Acceptance gates

1. Exact packed-state ownership and independent source arithmetic/ordering tests.
2. Multiple complete resident `h` steps, with no host state-dependent continuation.
3. Created-seed full-shot recurrence (an intermediate gate, not raw-input success).
4. Raw-parameter source creation and swept-clearance parity.
5. Original full-rest holdouts: success/miss, late foul, kisses, elevation/CCD,
   recurrent and simultaneous contacts. Keep original discrete/internal gates
   and declared observable tolerances unchanged.
6. Chunk-size/candidate-isolation/cancellation/device-loss/capacity tests.
7. Hardware end-to-end measurement for 1,024 distinct candidates; 4,096 only
   after actual device memory/binding and parity gates. SwiftShader is not
   hardware performance evidence.

No publication or default-backend selection is included in this work.

## Native integration checkpoint (2026-10-25)

- Integer source registration/scene manager: 1,024 lanes, exact complete packed
  state; these component gates supply original numerical receipts, not trajectories.
- Convex point projection: original four native hulls, 12 point/feature comparisons
  pass bitwise. A nested 256-GJK-step kernel was killed during pipeline creation;
  original one-step kernels in a fixed 259-dispatch chain pass without intermediate
  reads. This is a compiler-safe correctness boundary, not a throughput result.
- Coupled original solver: seven lanes including 27-contact capacity, invalid lane
  isolation, real source h and order, bitwise against unchanged source arithmetic.
  Fused and 64-operation drivers were killed at pipeline creation before submit.
  Three resident gather/evaluate/scatter kernels, 2,130 fixed cycles, pass. No
  resource/OOM cause is established. No original iteration or fixture was reduced.
- Authenticated four-ball body/cache pack and numerical cue programs have host
  gates. Cue orchestration, clearance→creation, world broad/geometry/scene linkage,
  CCD, application and full-rest recurrence are still integration dependencies.

There is still **no complete resident h or 1,024-trajectory acceptance**. The
experimental modules are not wired into the default application or inverse planner.

### 16:35 UTC integration checkpoint

Source-ordered scene integration passed a 1,024-lane native component gate;
26-owner ball geometry and canonical solver bridges passed their original-source
phase fixtures. These are **not complete h or physical trajectories**. The
cloth-cache and canonical CCD adapters have host gates; their new native gates
are pending. The WGSL linker preserves reachable equations without inlining a
numeric interpreter inside a controller loop.

Strict cue orchestration exposed a real device FTZ/DAZ discrepancy in the
original 72,546-node cue graph. An opt-in subnormal-preserving numeric profile
has independent host primitive tests, but its native gate is still pending at
this checkpoint; no tolerance was relaxed. The ordinary device-f32 profile is
not promoted as source-exact. Whole-h composition, raw allocation admission,
current cue geometry, post-h application, and full-rest parity remain open.

### 16:46 UTC composed-source checkpoint

The strict repaired-profile native gate passed 148 rows including the original
72,546-node cue graph; the complete seven-row cue application/deferred-joint
component gate then passed without tolerance changes. The live-cue ball CCD
adapter passed 1,024 lanes over four predicate cases, not 1,024 trajectories.

The authenticated raw initializer now describes 68,313 device dispatches with
no intermediate readback. The whole-h source command composition builds 93
pipelines / 259,184 fixed dispatches; host linking found no unresolved helper
calls, arity mismatches, or mixed numeric profiles. This deliberately conservative
command schedule is an unqualified correctness integration, NOT a throughput
claim. Original first-h end-to-end execution and recurrence remain pending.

Current packed world: 62,976 words (251,904 bytes) per candidate; shared numeric
scratch 13,632 words (54,528 bytes) per candidate in the active tile. A 128 MiB
binding gives tiles 532+492 for 1,024 candidates including each shared 4,064-byte
CCD tail. These are serialized allocation estimates, not measured VRAM.

### 16:59 UTC first complete-h execution / strict failure

All 93 whole-h pipelines compiled, and two authentic CREATED banks reached the
sealed first h (hSequence1, RUNNING, next-h application phase) with 254 bounded
submissions and no intermediate state mapping. Strict source comparison failed
at convex cache10 recycleRotation.w: device0 versus source1.0. This was NOT a
parity pass. The original cushion validator supplies the absent-cache identity
quaternion; the initial packer had omitted that validator. The packer now calls
the unchanged source validator for all16 cushion caches, with a regression test;
the same native gate is being rerun, without deleting fields or changing tolerance.

`executor.mjs` is an explicit experimental resource owner: arbitrary raw rows,
all world tiles retained, one reusable scratch pool, bounded queue submissions,
source-identity lease, cancellation/drain and compact16-byte rows only. Host
transport/resource tests execute no physics. Its numeric qualification mask is
intentionally zero and cannot be overridden by the caller: scored PASS and MISS
remain UNSUPPORTED until whole-path admission exists. It is not default-wired.

The optional `RESIDENT_POINT_DYNAMIC` GJK-loop diagnostic remains unadmitted;
production composition uses the proven original256 separate GJK dispatches.

### 17:03 UTC qualified first-h fixture

The unchanged two-bank CREATED first-h rerun passed every represented owner
(bitwise f32 fields, exact scene/journal/roster/BVH/cache ordering, binary64 clocks,
and scoring state). All93 kernels executed, no intermediate mapping. It remains
an isolated first-h fixture with sleeping balls, not raw or full-rest admission.

The opt-in flat coupled driver now preserves the same source microprograms and
liveness slots in one instruction continuation. Host tests cover all16 programs,
4 bodies/27 contacts and original12/4/1 order; the largest fixture needs9 fixed
32,768-instruction driver calls instead of6,390 staged dispatches. Native parity
is pending and this driver is not used by the admitted staged baseline yet.

### 17:08 UTC raw admission and retained recurrence boundary

The actual raw initializer native gate passed 10 rows: four clear distinct
five-parameter rows, two source-blocked rows and four source-invalid rows.
All created aliases matched original source words; 19 pipelines executed
68,313 dispatches in67 bounded submissions with one final mapping and no
intermediate state reads. No h was performed by this initializer gate.

The original PhysicsLab CPU oracle is now separately captured through real
latched outer completion: default strike retires at h448 and rests at
outer6642/h7083 (MISS; no goal or late-foul coverage). The source16-second
horizon remains intact. It is not replaced with the convenience World wrapper's
early shot-complete boundary.

The conservative whole-h transport is diagnostic, not the final throughput
architecture:259,202 dispatches and254 submissions/h project to
1,835,927,766 dispatches and1,799,082 submissions for7083 h per storage tile.
These are schedule counts, not timing or measured GPU throughput. Retained
multi-h parity, combined raw-to-h parity, source-equivalent flat continuations,
then full-rest/late-foul and1024 raw trajectory qualification remain required.

Initializer metadata and every reachable typed view now have mutation guards;
the executor revalidates after asynchronous raw initialization before whole-h
code generation. Caller mutation cannot change source codegen after admission.

### 17:24 UTC combined raw-to-h and recurrent-state gates

The staged diagnostic path passed two retained authentic created h, and a
separate combined raw-to-h gate passed six rows: four distinct accepted raw
strikes matched every represented original-source owner after h1; one blocked
and one invalid strike remained rejected at h0. No future expected snapshots
were uploaded; zero intermediate maps and one final map. The combined gate
recorded327,515 dispatches/320 submissions. These remain sleeping-ball first-h
fixtures, not strike, full rest or1024-trajectory acceptance.

Optional flat source-instruction drivers now preserve source ordering and
liveness scratch while replacing host-expanded owner loops. Host-only whole-h
composition gives211,742 dispatches with coupled+cue+application flat versus
259,202 staged. This is not yet enough and is not native throughput evidence.
The first flat coupled kernel was SIGKILLed during pipeline creation before
submit (35.5s; cause unestablished). Flat cue compiled and executed, but the
strict seven-row gate failed its other-sphere exclusion status; that failure
remains unresolved at this checkpoint. Default transport remains staged and
all public numerical admission remains fail-closed.

Compiler diagnostics separate instruction-only and integer gather/scatter
call trees. Geometry source-cap loops and flat CCD remain independently gated
before integration. Actual late-opponent-after-goal source artifact has both
initial snapshots and full expected journal; the positive report lacks snapshot
bytes and must be recreated through original controller placement/settling,
not substituted for a native-state oracle.

### 17:30 UTC compact-owner diagnostics

Flat cue now passes the same seven native source fixtures, including obstruction:
its earlier failure was a test packer bug (other-body absolute addresses were
not relocated when concatenating candidates), fixed with a lane-local pointer
regression. Production shader and expected obstruction status were unchanged.
Five fixed32,768-instruction chunks preserve all original source work. Its first
whole-h retained recurrence/timing gate is running; no whole-h promotion yet.

Compiler isolation found the arithmetic instruction loop compiles alone
(peak child RSS698,824 KiB), whereas gather/scatter alone, without the arithmetic
VM, is SIGKILLed during pipeline creation (peak2,986,880 KiB). Exact256-step GJK
loop and scratch-address-reload variants also terminate before submit at peaks
2,985,504/2,986,840 KiB. These are measured process peaks and compile failures,
not proven OOM causes; kernel/cgroup kill attribution is unavailable. Controller
copy/validation micro-ops and source GJK phase/chunk lowering are the recovery
path; no original iteration cap or fixture is reduced.

The optional flat CCD world adapter preserves each completed numeric job's
ready/count receipt and calls the unchanged source pre/post wrapper before
publishing solveDt/clamps. All four flat-owner host schedules total147,158
commands/h, still unqualified natively and insufficient for final throughput.
Full-loop geometry adapters remain opt-in and unqualified after the compiler
failures. The default staged raw/whole-h path is unchanged.


### 18:05 UTC source-owner continuations and device PC

The cue-flat whole-h gate passed two retained created banks/h1+h2 with exact
represented owners. Measured retained h2 was37.2016 seconds on SwiftShader,
including2.0649 seconds host encoding and35.0318 seconds queue drain, for
246,416 dispatches/241 submissions. Compile time was253.54 seconds separately.
These host wall measurements are not GPU timestamps or hardware performance.
Holding that isolated-h cost constant would imply roughly73 hours for7,083 h;
this is a warning against launching the long test, not a measured shot time.

The staged schedule's dominant shares are cue geometry117,152 calls, active
CCD65,536, ball geometry27,560, coupled25,560, cue12,810, application9,258,
other1,326 per h. Query+CCD comprise81%; optimizing cue alone cannot solve it.

Compiler-safe source-order continuations now have independent native evidence:

- Coupled one-word transport: unchanged seven fixtures, including four bodies,
  27 contacts, original12/4/1 order, invalid-lane isolation and exact bits. The
  65-chunk conservative source-cap schedule passed. No physics cap changed.
- Registered active CCD:244 dispatches,47 pre and46 post numerical jobs,
  original BVH lifecycle, exact selected fractions, quaternion clamp/inertia
  and ready/count receipts passed. Compile+execute130.11 seconds, peak child
  RSS1,958,792 KiB. This is a component fixture, not full-h admission.
- Point GJK chunk8: the same12 queries/four native hulls and256 original calls
  passed in35 dispatches. Contact/normal families require separate gates; this
  result does not transfer numerical qualification to them.

`world-device-pc.mjs` appends immutable CALL/REPEAT/END_REPEAT/END_H bytecode
and80 control words per candidate after the shared fixed-CCD tail. Its phase
wrappers call each original source entry once outside the integer PC loop.
Pure source-proven no-op predicates may skip completed GJK and sticky owner
continuation tails; all26 ball and56 cue lifecycle rows, EPA/finish, source
job capacities, source ordering and canonical completion checks remain.
The first transport emits fixed phase sweeps, so phase-dispatch overhead still
exists and must be measured. No full-rest launch is justified by host counts.

Device-PC host control gates pass, including candidate-local nested loops,
retained two-h sequencing, terminal/cancelled lanes, hSequence errors, and
fixed-sweep exhaustion. Native complete-h PC recurrence is pending. A finite
transport sweep budget is not a shorter physics horizon: unfinished execution
is INCOMPLETE, never MISS. Public numeric qualification remains zero.

A query can terminate early on an irreversible source rule violation. This is
query-terminal state, not a claim of physical rest. Success must still run to
actual full rest to exclude a later opponent foul. Compare each independent
CPU oracle at the same boundary; do not compare an early query failure against
a later resting world or call a horizon exhaustion a failed shot.

### 18:43 UTC measured device-PC recurrence and next compiler boundary

The genuine CREATED two-bank `maxH:2` PC gate passed every represented original
owner and exact hSequence2. A single GPU begin crossed END_H into the next h;
there was no intervening host state read or restart. One final map compared h2.
Per lane:1,855 original source calls,16,150 ready dispatch visits (190 last-needed
85-phase sweeps). The declared512-sweep transport emitted43,522 dispatches in43
submissions. Execution took39.492 seconds for both h, including1.575 seconds
encoding and37.895 seconds queue drain; compilation was451.357 seconds separately.
All timings are SwiftShader host wall time. These are still sleeping-ball/cue
recurrence fixtures, not the physical strike around h371, full rest or1,024 lanes.
Fewer commands did not produce a proportional speed improvement; owner routing
remains the critical path rather than launching a many-hour full-rest test.

The separate flat application component passed all four original cases,
including256 native event rows, a goal still awaiting rest, same-time ambiguity,
and positive-subnormal impulse with zero native torque. Twelve dispatches and
one final map;448.679 seconds compile+execute. It is not late-foul trajectory
coverage or whole-world numerical admission.

The next explicit composition has ten owners over the unchanged124-instruction
source schedule: SOURCE-CONTROL35 phases, one shared graph worker19, three query
owners11, cue6, coupled3, application9, and CCD pre/post2. Source graph prefixes
and suffixes are split at the original evaluator call; the worker has one shared
`rc_num_eval` callsite outside any new controller loop. All original equations,
job caps, row lifecycles, error propagation and source suffix receipts remain.
Eight additional inactive-query predicates skip only source immediate returns,
never active GJK, EPA, finish, or required chunk validation.

The first raw-six-row ten-owner attempt **did not execute physics**: the merged
263,367-byte SOURCE-CONTROL pipeline was SIGKILLed during creation after41.786
seconds, peak child RSS2,978,444 KiB. No initializer/physics dispatch was submitted.
Kernel/cgroup attribution is unavailable; OOM is not established. There are35
static PC-advance callsites in that control chain. An explicit one-CALL/control
visit with one PC-advance callsite is the next isolated transport repair; it may
need more transport sweeps and must retain INCOMPLETE if its budget runs out.
The previous phase-PC parity result does not qualify the new owner composition.

The retained native runner now supports cold/warm comparisons on one device,
exact code/binding/entry pipeline caching, fresh initial-only buffers for each
independent run, and resident continuations with final-only diagnostic mapping.
A repeated run must compile zero identical pipelines and must not upload prior
outputs as inputs. Runtime public publication remains fail-closed (numeric mask0).
The80-word PC tail fits532+492 lanes at128 MiB; adding the24-word graph request
makes531+493. These are exact buffer-size calculations, not measured GPU VRAM.

The single-CALL retry also failed before execution: the259,756-byte control
pipeline was SIGKILLed during creation after37.340 seconds, peak child
RSS2,983,928 KiB. Reducing PC-advance callsites alone did not recover compilation.
No raw initializer, physical step, shared graph owner or later owner was run.
The next recovery partitions the explicit control source closures; it must
report its actual owner count and pass the unchanged raw-six-row/two-h gate.
Both failed attempts are compiler-boundary evidence, not numerical passes or
proof of an OS memory-kill cause.

### 19:03 UTC control partition and host-residency isolation

`controlPartition:'source-closures-v1'` explicitly maps the same35 control CALLs
to seven source-name groups, plus the same nine numerical/query owners (16
actual kernels). The independent host gate checks12 split/sweep policies,
four divergent lanes, three h, WAIT receipts and exact original CALL order;
the authentic registry preserves every phase, bytecode word and source cap.
This is routing evidence, not native physics admission.

The unchanged raw-six-row/two-h attempt stopped at the first90,489-byte
collision-BVH owner: SIGKILL during compilation,27.527 seconds, peak child
RSS2,980,636 KiB; no initializer or physics work was submitted. A size-only
partition was not enough in that process. Controlled compile-only isolation
then succeeded for BOTH the current exact phase wrapper (31.103 seconds,
peak2,854,584 KiB) and the same wrapped owner shader (32.036 seconds,
peak2,862,944 KiB). The latter process began at294.6 MB RSS versus503.1 MB
for the raw fixture process. These results establish compilability under
leaner host residency, not the cause of SIGKILL or numerical equivalence.
Explicit GC of the live raw fixture reclaimed only37.7 MiB RSS in a separate
host-only probe; it did not remove all retained oracle/plan memory.

The next unchanged gate separates CPU source preparation, lean GPU execution,
and strict original comparison into sequential processes. Independent future
snapshots are assertion-only artifacts and must never be opened by the GPU
process or uploaded as runtime inputs. Cold/warm pipelines reuse one device,
but independent runs allocate fresh initial-only buffers. Public qualification
remains zero and full-rest/1,024 physical-lane execution remain unverified.

### 19:29 UTC accepted raw-input owner recurrence

Commit135b168 passed the unchanged six-raw-row/two-h gate twice, with four
independently created distinct accepted parameter rows and two distinct rejected
rows. All11 source-owner projections matched; both rejected rows stayed at h0.
Fresh initial-only buffers reproduced identical full output words, and the warm
run reused all36 pipelines with zero compilation. Both runs used one final map,
no intervening h readback, and no expected-state input. This is bounded source
reference h2 evidence, not actual NativePhysicsLab full-rest qualification.

Warm SwiftShader timings: initialization plus PC begin7.579 seconds /68,314
commands; resident two-h pump65.870 seconds /32,768 commands /32 submissions.
Cold pipeline compilation was325.566 seconds separately; peak child RSS was
2,703,140 KiB. The last-needed sweeps were818/818/818/822 for the accepted rows,
out of the declared2048 transport sweeps. Compare neither this four-accepted-row
workload directly to the earlier two-bank timing nor its software result to an
unmeasured hardware GPU. This remains too slow to justify a long-shot run.

`docs/evidence/resident-raw-owner-two-h-135b168.json` records exact artifact hashes,
source/adapter identities, rows, limits, and cold/warm measurements. Full-rest,
first physical strike,1,024 physical lanes and hardware throughput remain open;
public numerical qualification is still zero. New numerical architecture runs
are paused for the user's requested matched hardware/software calibration.

### 20:29 UTC resumed resident implementation (hardware ratio still pending)

The user's instruction to continue separates unfinished hardware calibration
from already authorized source-resident development. The portable benchmark
package remains prepared, but a physical adapter and its execution permission
are still unavailable; no correction multiplier is inferred.

The new experimental path lowers the **existing WGSL source**, not replacement
physics, to a scalar-word microcode table. Its compact native kernel retains a
per-candidate instruction PC, source locals and return stack in storage across
bounded work chunks. An explicit dynamic dispatcher calls only the owner of
the current original world-PC instruction. Original guards, WAIT receipts,
equations, h clocks and source capacities are retained. Private WGSL globals
reset once per logical original owner call, not at a VM yield. The accepted
16-owner native path remains an unchanged debug oracle.

The authentic composed source currently contains837 reachable functions;
guarded lowering produces144,264 instructions and101,278 local words per
candidate, with call depth15. This is compilation coverage, **not whole-world
parity**. Static-local allocation is not yet liveness-compacted and does not
establish1,024 simultaneous lanes. Unknown syntax/primitive domains reject
explicitly; instruction-budget exhaustion remains incomplete, never MISS.

Independent review found a real local-object bounds bug in the first compiler:
global slab checks alone allowed an out-of-array access to alias another local.
The guarded compiler now checks each object index before address arithmetic;
positive/negative and nested pointer/array/vector regressions verify that
neighbor state cannot be modified. The review was not a comprehensive audit.

The required post-fix native pilot passed eight authentic software-binary64
cases and exact saved VM/output state at three continuation boundaries. The
primitive shader was about25 KB, compilation2.748 seconds, peak process RSS
378,288 KiB on **SwiftShader**; execution queue-drain wall was7.419 seconds.
These numbers prove a small compiler boundary and bounded native continuation,
not acceleration, hardware throughput, f32 admission or physical recurrence.
The pre-fix pilot is retained separately and is not acceptance evidence.

The raw integration harness now preserves original six-row initialization,
runs bounded VM chunks without intervening host state reads, and invokes the
unchanged11-group two-h comparator after a final-only diagnostic map. Its
transport mocks and lean initial-only handoff pass; whole-world VM numerical
execution remains pending. Authentic query measurements and real instruction
counts are required before choosing a longer physics budget.

The independent original NativePhysicsLab strike oracle now brackets the
baseline impact at h320/outer5 (still sleeping) and h384/outer6 (real contact
before h371, positive impulse). Its initial-only handoff and assertion-only
future data are separate. Actual GPU strike, full-rest/late-foul, arbitrary
1,024-row completion and production numerical admission remain open.


### 21:11 UTC compact VM query pilot and measured nested-interpreter boundary

The guarded scalar VM passed all12 original cushion projections in three fresh
SwiftShader runs using a64-invocation workgroup,16 bounded chunks and17 total
dispatches per run. Original GJK cap256, result words, inside/feature decisions
and repeated state words are unchanged. Compilation took2.659 seconds; warm
end-to-end wall times were24.677 and25.682 seconds, almost entirely queue drain.
This is a query correctness pilot, **not a speedup or complete physics h**.
Local evidence: `/tmp/resident-microcode-point-native-artifact/report.json`.

A real created-source world profile reached33,554,432 scalar instructions while
still in h0. Binding the existing exact software-binary64 helpers and complete
numeric graph evaluator then passed the first hot source phase, but another
bounded33,554,432-instruction profile stopped at original PC83 (cue-joint-flat),
READY/error0, after59.233 host seconds. It did not pass source parity and was
not submitted as an insufficient-budget GPU run. The remaining hotspot was the
original **single graph-instruction continuation**, itself interpreted as scalar
bytecode. Counting outer VM instructions alone hid this nested interpretation.

`source-continuations-v1` now additionally admits the unchanged original
`rc_num_cont_instruction` and `rc_source_program_instruction` closures as direct
native VM primitives. Their source signature, body, transitive dependencies,
profile declarations and exact storage bindings are checked before lowering;
matching a function name is insufficient. Their original one-instruction
control writeback, graph/source capacities, call stack, status and early exits
are retained. Older profiles do not enable the new opcodes. The combined native
helper closure is23,982 bytes, not a newly simplified physics implementation.
Whole-buffer stepwise host differential tests, bounded actual-h counts and then
native compilation/recurrence remain the next gates. Public qualification is
still zero; no hardware ratio, physical strike, full-rest, or1,024-world result
is implied by this checkpoint.


### 21:14 UTC actual-source host recurrence passed

With exact single-instruction continuations enabled, the genuine CREATED-bank
profile completes2h in12,393,298 scalar microinstructions (190 chunks of65,536)
and matches **all11 original CPU source groups exactly**. The independent CPU
future is generated only after completion. Original dt, world/source caps and
terminal PC123 are unchanged. This HOST-only run took13.038 seconds; it is not a
GPU or raw-row result. Its native arithmetic work also includes146,608 numeric
continuation calls,1,623 binary64 source-instruction calls and137 complete graph
calls, so scalar instruction totals alone are not a GPU workload estimate.

`docs/evidence/resident-created-microcode-two-h-host-33d3fb8.json` retains the
profile, hashes and exact counts. The twelve-query native pilot is separately
recorded in `docs/evidence/resident-microcode-twelve-query-native-1dfe930.json`.
Next: compact native continuation semantics/compile gate, then the unchanged
raw6-row two-h comparator. Until those pass, native recurrence is still pending.
