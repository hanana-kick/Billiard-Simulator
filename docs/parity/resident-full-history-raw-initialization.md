# Authentic full-history raw initialization

The former raw h64 and created-HOST h128 **failed** native history parity:
contact-only seed7 omitted a non-key stroke occupying the real last-eight
debounce window. Those artifacts remain failures; no retained bank was repaired.

The new explicit `source-full-application-history-v1` preserves contact/scorer
data separately. The owned capture provides full prestrike and created event
lists. A created template contains created history; its immutable **raw clone**
contains the authentic prestrike ring. Only successful `creation-finish` appends
the new non-key stroke, after the original numerical creation guards and before
RUNNING publication. Invalid, blocked and unsupported rows do not append.

Initialization canonicalizes oldest-to-newest slots/head=count%8. Full rings
evict the oldest slot with a forward-safe bounded32-word operation. This is an
initial storage representation, not a changed PhysicsLab timeline; normal later
ring FIFO/head evolution remains untouched. Original PhysicsLab and the strict
native history comparator have not been edited.

## Gates completed

- `fa2f0ce`: raw clone/accepted-only WGSL commit; five host groups cover empty,
  partial/full/mixed rings, signed-zero/subnormal timestamp bits, FIFO eviction,
  unchanged rejection, malformed prefix/clock, duplicate finish and subsequent
  ordinary ring/head behavior. These are protocol tests, not substitute physics.
- `e083f82`: existing initializer host holdouts pass6/6 (native case skipped in
  the host run). They independently call unchanged `PhysicsLab.strike` and read
  **its complete events** for4 admitted,2 blocked,4 invalid rows. Exact source
  initialization fields and full history match; repeated real generated finish
  does not mutate completed state. No native forward step is permitted.
- The same10 raw rows then pass the actual WebGPU initializer on frozen
  `e083f82`, with all19 shaders preflighted before pipeline creation or source
  allocation. It executes68,313 dispatches/67 submissions, zero physical h, no
  intermediate readbacks and one final map. Native process exits0.

The WebGPU adapter is **SwiftShader fallback**, not hardware. Test wall time
46.539s includes CPU setup, cold shader preparation, compute, map and assertions;
it is not a GPU timestamp or a calibrated speed ratio. Curated evidence:
`docs/evidence/resident-full-history-initialization-native-v1.json`.

Fresh source/native reference gates separately agree at t0/h64/h128/h192,
including true tip emission beforeh165 and ring head0→1. This is expectation
qualification only. At that checkpoint corrected raw GPU h64/h192, full rest/late foul,
and1024-candidate terminal evaluation **remain pending**. The next run must start
from fresh authenticated input, never resume the old wrong-history bank.

## Corrected raw eight-h recurrence (2026-10-26 02:14 UTC)

Frozen `3b09eed` passes the two-row native probe: admitted219 completes eight
original h and matches all11 original-source groups; rejected522 remains at h0
with its exact authentic prestrike FIFO and no appended stroke. It uses one raw
initialization, no intermediate state readback and one final map. This precedes
the first original outer-step completion and does not qualify physical impact.

SwiftShader pump wall321.382s and initialization-to-final-map326.402s are
observations, not calibrated throughput: a separate HOST correctness continuation
ran after cold compilation. Pair cold compilation115.094s is separate. The
independent assertion then issued a receipt/hash-bound GO for a **fresh** h64
bank, retaining immutable compiled pipelines only. That native outer comparison
is pending; no old failed or probe bank was patched or resumed.

Curated evidence: `docs/evidence/resident-full-history-small-strike-probe-native-v1.json`.
The prior failed h64 remains negative evidence. Full rest, late foul, actual
1024-trajectory isolation, and production/API/mode qualification remain open.

## Fresh raw first outer: strict native PASS (02:58 UTC)

The untouched frozen `3b09eed` comparator passes the new born-h64 bank:
all11 source groups plus actual PhysicsLab outer1 balls, cue, exact clock,
rules, complete last-eight event history and game fields. Rejected522 retains
the authentic prestrike ring at h0; admitted219 uses its original raw controls.
Both VM lanes finish at the immutable HALT without errors. There is no physical
impact yet, and this seven-binding gate does not capture the complete emission
tape (the distinct impact gate does).

One fresh initialization and fixed[512,1536,6144] pump cycles retain GPU-owned
state throughout; three diagnostic copies are mapped only once at the end.
Process0 and strict independent assertion0 are recorded. The probe's bank and
the earlier failed bank were neither reused nor repaired.

Observed SwiftShader warm initialization-to-map is2,565.593s (42.760min), of
which pumping is2,560.183s. There are101,083 dispatches/102 submissions, including
68,315 initialization dispatches. These are correctness-run host-wall timings,
not hardware performance or a calibrated speed comparison; independent HOST
work ran concurrently. The device was released after completion.

Evidence: `docs/evidence/resident-full-history-small-strike-first-outer-native-v1.json`.
This closes the corrected **first original outer boundary**, not raw-to-impact,
full rest, late foul or1024-candidate terminal execution. The previous failed
history artifact remains an immutable failure.
