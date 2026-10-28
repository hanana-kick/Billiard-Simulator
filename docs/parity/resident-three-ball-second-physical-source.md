# Genuine-three second-h final physical boundary

The distinct `three-ball-second-physical.mjs` accepts only a locally branded
second numerical plan. It appends32 control words and256 fresh final-mass work
words to the same authentic t0 bank. It does not reuse/reset the first physical
completion words, supply future poses, apply the roster twice, or solve the cue
joint twice. The existing broad and final-mass programs are required to match
byte-for-byte at their existing offsets; no numeric program growth is needed.

## Emitted contract

`createThreeBallSecondPhysicalPlan(numerical)` exposes `layout.physicalControl`,
`layout.massState`, `massPlan`, `programOffsets.{broad,mass}`, and immutable
initial/program/geometry bindings. `generateThreeBallSecondPhysicalWGSL(plan)`
returns the current adapter plus the unchanged final-mass helper.
`buildThreeBallSecondPhysicalSource(plan)` provides eight compiler-separated
stages and a fixed bounded schedule:

1. `rc_three_h2p_begin()` verifies the produced numerical/cue/sphere/post-CCD/fat
   boundary, source scene/current awake order, and actual current journal,
   roster, floor, and empty-cache identities.
2. At most25 original collider rows run bounds gather/evaluate/scatter. After
   each actual awake parent's **last** collider, the source final-mass graph
   gathers/evaluates/scatters that body before the next parent is visited.
3. `rc_three_h2p_finish()` requires complete same-epoch mass/harvest counts,
   performs original `set_aabbs`, then calls actual journal finish. No manual
   phase assignment or forged roster-applied acknowledgement substitutes for
   those source transitions.

The native source ordering is Rapier b716d375
`physics_pipeline/substep.rs:86–156`: original awake bodies, each original
parent collider list, world mass refresh, then broad publication.

The current journal must retain sequence2/phase3 and applied roster1 before
seal. Its actual three floor edges and up to six authenticated inactive empty
sphere/cylinder rows must match the complete current roster. Every empty row
is checked against current edge/lifetime, actual ordered append/AddPair log,
cache epoch and type, original descriptor identities/materials, complete native
empty metadata, and generic geometry views. A completion flag alone is not an
admission receipt. Unknown transitions, active cue contacts, cue removal, and
unsupported contact domains fail closed.

Successful physical control: status1, phase2, completed1. Journal and broad are
phase0 at sequence2; scene remains6; cue.frame2/needsSolve1 and source cue fields
are retained for exactly one subsequent application adoption. Application
clock, event observation/drain, angular patches, withdrawal and retained tape
are not advanced here. No complete-h2, GPU, full-rest or search claim follows
from this physical boundary.

## HOST-only test transport

`executeThreeBallSecondPhysicalWordsForTest(plan, words,
{testOnly:true, physicalOnly:false})` executes preceding immutable parts on
subarrays of this same bank, then the emitted physical stages. The high-level
test executor starts only from `plan.initialWords`; no original endpoint or
completed result is accepted as input. Its `before` field is diagnostic only.
Only exact final `words` and the local result/plan identity carry the result
seal. This is a test interpreter, not a CPU fallback in a candidate runtime.

The focused suite is `tests/resident-three-ball-second-physical.mjs`. It is
explicit costly source qualification, not a default HOST or optional GPU test.
Expected original native h2 data is decoded only after candidate execution.
Tests cover all final five-body world mass/COM fields, complete BVH tree and
journal graph, exact original per-parent harvest/mass order, unchanged current
roster/empty manifold/joint words/tape, and negative receipt/identity/epoch/replay
cases. Numerical/GPU qualification is separate.

Qualification recorded: focused HOST suite **4/4 passed, no skips**,47.13s.
The candidate reached the final physical boundary from authentic t0; complete
native h2 BVH tree/allocator/graph and all five final mass/COM projections
matched. An independent instrumented transport verified every parent boundary
and produced identical entire-bank words. Eleven current receipt/metadata/post
corruptions and replay failed closed without finishing the journal. The test
performed no GPU execution; the duration is not a device throughput measure.
