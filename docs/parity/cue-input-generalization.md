# Source-validated cue input admission

This extension separates input validity from the numerical solver's physical
capabilities. It does not change `PhysicsLab`, Rapier, material parameters,
collider geometry, CCD settings, or the source application clock.

## Latest frozen family result

All three preregistered inputs now pass independent CPU/native and actual
WGSL/native shots through physical rest at the same frozen runtime
`4a233ac579d300b7bbadb7541f81e2d94d1715bf`. Original inputs and native artifacts
were never changed to obtain success:

- yaw23, elevation8, speed1.5, tip(0.2,0.1):5981outer states per backend,
  82source checkpoints,3events, rest5980, maximum native error8.049334865312119e-9.
- yaw-37, elevation12, speed2.4, tip(-0.18,-0.12):6501outer states per backend,
  89source checkpoints,3events, rest6500, maximum native error2.1263861449405397e-8.
- Held-out yaw61.25, elevation20, speed1.8, tip(0.11,-0.16):5762outer states
  per backend,103source checkpoints,4events, rest5761, maximum native
  error2.7803868318798663e-8.

Across six fresh backend processes,36,488outer states,548source checkpoints and
20application contact comparisons pass. All57loaded source hashes match across
all six runs, every process exits0 with typed full-shot completion and successful
source-hash after-hook, and original scoring/turn and rest boundaries are exact.
Evidence: `../evidence/cue-input-family-full-rest-4a233ac.json`.

This is actual WGSL on Dawn Vulkan SwiftShader software, not a hardware GPU or
interactive performance claim. Physical state is compared every outer step,
event/graph sequence every h, and source caches/managers at declared fixed-grid
and transition checkpoints. These gates do not claim complete engine byte
identity, direct full-trace CPU/GPU bit equality, or support for every legal
control value. Active CCD, active rigid cue contact, multiple novel recurrent
cue pairs and complex coupled components remain fail-closed. Final integrated
main original-scenario acceptance is separately owned by the coordinator and is
not substituted by this frozen-branch evidence. Historical failed/unsupported
runs below remain preserved and are not counted as successful tests.

## Input domain

`PhysicsLab.strike` accepts finite yaw (without normalizing it), elevation from
0 through 85 degrees, speed greater than 0 through 10 m/s, and finite tip
coordinates with `Math.hypot(tipX, tipY) < 1`. These are engine control ranges,
not a promise that every input clears the table geometry or is supported by the
experimental component scheduler. The UI's narrower manual ranges are separate.

The new `source-validated-original-three-ball-cue-input-v1` contract requires the
original three-ball constructor layout and selected body zero. It checks the
unchanged JS-double source pose expression against the actual created native
shaft, head, and guide poses, the projected numeric initializer inputs, the
original double-valued `setLinvel` journal, and its f32 native velocity result.
Thus changing a tip coordinate, speed, or direction without the corresponding
real source-created state is rejected. The old default and named yaw15 contracts
remain strict for compatibility and previously frozen evidence.

The artificial `axis * 2` admission check now uses the actual validated speed.
No original integration formula, native solver parameter, or source application law is changed.

## Physical boundaries retained

- Only the original sphere/cue/collider geometry, masses, material coefficients,
  creation order, source snapshots and native journals are admitted.
- Both native CCD flags remain enabled. Active pre-solve or solved-pose CCD is
  still rejected transactionally; no flag is forced off.
- Active rigid cue contacts, another compliant-tip ball contact, unsupported
  simultaneous retained dynamic pairs, and pair/cushion coupling remain rejected.
- Created-state initialization is the only external physics state input.
  Independent later native frames are assertions only.
- The first gate covers actual cue withdrawal and two ordinary source time
  steps. A separately captured continuous native full-rest suite extends exactly
  the same frozen inputs. Prefix success is not full-shot or arbitrary-input success.

## Frozen acceptance family

`cue-input-family-v1.json` records two representative mixed yaw/tip/speed inputs
and an elevated holdout, chosen before any native capture or candidate run.
Inputs must not be adjusted to obtain success. Source strike obstruction and
candidate unsupported-domain rejection must be reported as such, never parity
success. Existing position/velocity/cache tolerances and exact events, clocks,
queues, identities, and topology remain acceptance gates. Whole-owned-snapshot
CPU/WGSL bit identity is a diagnostic, not an additional physical success claim.

Native captures are explicit and immutable:

```
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
  node tests/cue-source-input-fixture.cjs /absolute/new-case.v8 yaw23-side-follow
```

A gate never captures implicitly. Run `tests/experimental-cue-source-input-through-cue.cjs`
with an existing absolute `CUE_INPUT_REPLAY`, the admitted native decoder,
`REQUIRE_WEBGPU=1`, and an actual `GPU_NATIVE_MODULE`. `CUE_INPUT_CPU_ONLY=1`
is an explicitly partial diagnostic and does not count as CPU/GPU parity.

## Current verification

- 11 lightweight source/admission tests passed before captures.
- 448 combinations exactly matched the unchanged `PhysicsLab.pose` expression.
- The saved actual yaw15 created snapshot passed the new source-pose/journal
  validation without any recapture or state substitution.
- All three original captures succeeded unchanged, with 578 / 450 / 514 prefix h.
- The first input passed CPU/native and actual WGSL/native before recurrence
  changes. The other two initially rejected at h247 / h308 in both backends.
  Those rejection records remain preserved and are not counted as successes.
- The source birth observations show exactly sphere16:0 → neckCylinder24:0,
  one new dense graph edge, one empty manifold, and a real recycle cache.
- The source-derived empty-cache stage passed eight tests including actual WGSL
  and the independent native birth/reuse numeric cache samples.
- The revised second-input CPU diagnostic reached all 450 h, including exact
  native graph, AddPair order and empty caches, with max source error
  2.1263861449405397e-8. Final prefix at2a4b309 passed both representatives on CPU and actual WGSL.
  The elevated holdout passed the original h308 boundary, then rejected a different
  fixed-hull/cylinder birth at h410 on both backends; it is not a prefix pass.
- Independent original full-rest captures completed at outer5980 / 6500 / 5761,
  plus one passive confirmation outer. Their entire prior prefixes agreed with
  the frozen originals. Both representative CPU/native full-rest gates at060a0ac completed:5981 /
  6501 outer states,82 /89 full checkpoints and3 events each; source maxima
  8.049334865312119e-9 /2.1263861449405397e-8. Scores/turns and rest outer were exact.
- First representative GPU full-rest process ended abnormally with runner exit1
  and no result, signal, cause, or last GPU checkpoint. Cause is undetermined.
  The second GPU branch was intentionally interrupted only after its CPU proof
  completed, returning owned session exit130. Neither is a GPU full-rest success.
- Frozen physical source files were audited against060a0ac after termination.
  Strict zero-dominance and original solver-group negative checks passed.
  Evidence and artifact identities: `../evidence/cue-input-family-checkpoint-060a.json`.

## Bounded recurrent cue pair ownership

The new source changed-leaf BVTT traversal reuses the actual first-insertion
source tree and current owned fat leaves, with source u32 child/count/changed
semantics and source cross/self traversal ordering. Because subsequent native
optimizer topology is not serialized by this owner, only a single novel event
remaining after original parent/group filters is admitted. Its order is
independent of optimizer topology. Multiple novel events and all other new pair
shapes remain unsupported. This is event/pair projection, not full BVH-state
byte parity.

The default broad-phase stage still rejects new pairs. Only an original
three-ball owner's private lease can bind actual branded matching-backend
empty-cache and rigid-cue guard stages. Fresh, settled, and placed-goal four-ball
factories cannot make that binding. Each recurrent frame still executes the
existing rigid-cue exclusion with current own poses before any cache admission.

The new empty sphere/cylinder manifold retains original handles/generations,
source material values, solver sentinels, graph ordering, and the source recycle
pose/drift/rotation recurrence. All numerical recurrence executes the same f32
graph on scalar or actual WGSL; the original created snapshot supplies immutable
shape dimensions and integration parameters, never later native state.
Unsupported frames roll back the entire exposed owner state. The cushion
substage keeps its incoming fixed-contact order and only projects past a live,
inactive cue edge from its branded shared graph journal; active foreign or
coupled constraints remain rejected.

`cue-source-input-birth-oracle.cjs` captures independent before/at/after native
birth snapshots. `cue-source-input-full-shot-oracle.cjs` continues unchanged native
physics to real rest, with a fixed 9600-outer horizon and declared fixed-grid plus
transition checkpoints. Neither oracle imports the candidate world. The matching
full-shot gate seeds only `record.created`, asserts every outer body/scoring
state and selected full source caches, and reports unsupported boundaries rather
than treating them as parity successes.

## Convex boundary: prefix proved, full-rest pending

The unchanged elevated holdout creates rear-rail ConvexPolyhedron9:0 ↔ shaft
Cylinder22:0 at h410. Independent h409/410/411 observations show an empty
manifold and null workspace, but nonzero source GJK separating normal and
fixed/dynamic effective dominance128. A separate new module preserves native
hull-first support order/ties, source termination and the persistent normal.
Its stage conformance tests use frozen pre-step poses and its own prior cache,
not native normals or later caches as recurrence inputs. At frozen runtime dded16d, actual initial-only
whole-world CPU/native and WGSL/native prefix acceptance now passes514h,
19source checkpoints, cue removal at493h and two ordinary-clock steps. Both
backends have maximum native error2.7803868318798663e-8. The compared physical
vectors have CPU/WGSL difference0; all514 serialized own snapshots differ,
so this is not a full-engine bit-exact claim. The independent stage suite also
passes11/11 including actual WGSL. Full-rest acceptance of the new runtime
remains pending. Evidence: `../evidence/cue-input-convex-prefix-dded16d.json`.

### Convex ownership candidate and independent backend gates

The separate convex integration branch now owns the optional original-created
roster of all eight static native hulls. The new capability is still limited to
one novel fixed-hull/cue-cylinder pair per source broad-phase transition, only
with matching branded cache/guard stages and the private transaction lease.
It does not admit active rigid cue contacts, active CCD, multi-new-pair ordering,
contact/EPA GJK terminations, or any four-ball recurrence. Existing unchanged
rigid separation must pass first; a public `separated` flag alone is not world
authority. Source GJK support vertex order/ties, strict lower-bound termination,
previous own local normal, and source early cache recycling are preserved.

Before any new native whole-world or GPU run, the lightweight suite passed
29 tests with two explicit GPU skips. It includes real convex cache refresh
followed by a later forced transaction rejection, proving the cloned next cache
is discarded and retry starts from the previously committed own cache. Frozen
h409/410 pose stage conformance is not an initial-only whole-world proof.

`tests/run-cue-input-full-shot.cjs` runs a fresh process for one explicit backend
(`CUE_INPUT_BACKEND=cpu` or `gpu`) and preserves raw TAP plus a separate process
record. It records selected typed completion, immutable fixture paths, source
hash after-hook, own PID/memory/progress every512 outer steps, and exit/signal
as actually reported. A zero exit or skipped tests alone cannot pass: exactly
one selected-backend `rest-complete`, `fullShot:true` result and one completed
nonempty source-hash check are mandatory. No memory limit or physics assertion
was relaxed. Source checkpoint projections are local to each comparison rather
than accumulated through both backends. This is a diagnostic lifetime change,
not a claim about the earlier abnormal process termination's cause.

The full-shot gate compares body physical state and score/turn at every outer
step, event/graph sequence at each internal h, and source caches/manager at the
predeclared fixed-grid and transition checkpoints. The separate through-cue
prefix compares body physical vectors every h. Neither gate claims all caches
or full engine bytes are checked every h. CPU and GPU full-rest evidence may
only be combined when both pass against identical frozen loaded runtime sources;
the older060a0ac CPU result is not proof for this changed convex runtime.

### Subsequent frozen4d343cc full-rest boundaries

After the device-scoped immutable pipeline reuse change, the frozen4d343cc
holdout CPU and fresh actual-WGSL runs both matched the original through h2078,
outer1574,34cache checkpoints and2events, then rejected exactly attemptedh2079
with `Selected pair needs active awake cloth components`. Both rolled back and
completed the source-hash after-hook. This matching unsupported result is not
full-shot parity success. It is an inactive fat-AABB pair birth against sleeping
yellow, not an airborne/missing-cloth contact. The original later wakes yellow
at h2103, with its retained floor solver hint count0 on that h and count1 at
h2104. Read-only decoding of six original snapshots directly verifies the
geometry, manager, hints, buckets, solver IDs and ordering; no new simulation
was captured and no later state seeds the owner.

A separate fresh yaw23 WGSL run exposed a wider initial-cache lifecycle gap at
h64/outer1: the generalized convex assertion expected initial hull6/shaft22 and
hull5/shaft22 empty caches, while the owner only populated post-initial convex
births. This is a recorded comparison failure, not the earlier unexplained
process termination or a memory diagnosis. The existing numeric stage computes
both initial cache states and normals exactly from genuinely branded original
created hulls and created cue pose, but that isolated stage conformance does not
replace initial-birth world ownership. Neither guard deletion nor restricting
the assertion back to only the holdout pair is used to claim success.

These statuses, identical loaded runtime hashes and immutable evidence links are
in `../evidence/cue-input-full-rest-boundaries-4d343cc.json`. The next bounded N3
owner extension remains isolated from the frozen run source. All three original
inputs remain unchanged; new runtime CPU and WGSL full-rest results are pending.

### Elevated holdout full-rest acceptance at4a233ac

The unchanged preregistered holdout (yaw61.25, elevation20, speed1.8,
tipX0.11, tipY-0.16) now passes the complete initial-only native-reference shot
on independent CPU and actual-WGSL processes at the identical frozen4a233ac
runtime. Each compares5762outer states,103source graph/manager/cache checkpoints
and4application contact events. Both reach original rest atouter5761, then the
passive confirmation outer; scoring and next turn are exact. Each maximum
native numerical error is2.7803868318798663e-8 under the unchanged per-field
contract. Both supervised processes exit0 with exactly one typed full-shot
completion and successful source-hash after-hook; all57loaded source hashes
and immutable original artifact hashes match between backends.

This includes source inactive pair birth, sleeping-target wake, deferred floor
requalification and retained cache/manager ownership. Neither backend receives
later native state as input. It is one fixed-input full-shot acceptance, not
universal control support, full serialization parity, or a direct full-trace
CPU/WGSL bit-equality test. The two fixed representatives still need their new
runtime independent CPU and WGSL completions, and final common-runtime baseline
regressions remain separate. Evidence:
`../evidence/cue-input-holdout-full-rest-4a233ac.json`.
