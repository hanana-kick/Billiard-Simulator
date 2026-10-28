# Bounded retained impact-segment cost diagnostic

`tests/resident-candidate-tip-impact-segment-cost.mjs` profiles only an exact
saved **HOST** h191 continuation toward its existing born-h192 terminal. This
is not a raw-GPU initial state, another numerical implementation, a native
performance ratio, or permission to initialize a device from future CPU state.

The run retains one evolving source/VM state, the existing fixed audit/snapshot
buffer, one fixed u32 counter per immutable bytecode PC, and aggregates per
function/opcode. It does not retain per-instruction or per-call states/traces.
Original instruction budget65536, physics timestep/caps and requestedH192 stay
unchanged. Bounds are at most2048 transport pumps/300000HOSTmilliseconds. An
unfinished result stays incomplete with its own diagnostic continuation file.

At the segment boundary, pre-existing calls are reconstructed from saved return
PCs and validated against the unchanged bytecode CALL targets. Their inclusive
cost is explicitly **partial**, not a complete invocation estimate. Only calls
both entered and returned inside the observed segment receive full-invocation
inclusive cost. Inclusive costs overlap; exclusive function/opcode counts sum
exactly to the two candidates' successful core-step deltas. External native
macro body arithmetic is excluded from core counts and reported as call counts,
not estimated GPU time. Two scalar operations for a possible external stub are
subtracted only from complete-invocation instruction counts, never partial ones.

Final execution must match every word of the previously retained actual source
bindings **and** VM state, then pass the explicit independent cue-Number source
all11/native/tape comparator. Original input files remain byte-identical. A
completed192 bank cannot stand in for a missing191 VM continuation.

## Current actual-input boundary

The long run's `bounded191-result.json` receipt records h191,21213 pumps and
674724316 accepted-row core steps. Its exact saved continuation SHA was
`49d3cb3a9c1d2c84b429848e9b48a6b74b840b24c8a50ae84444c3da96b98da6`.
The subsequent legitimate in-place resume overwrote `continuation.v8` with the
completed192 state SHA
`c1013531a239adb273544bbf39e2840821131c89fb555f059416c67c2a0f051c`.
No separate191 bank was found in the artifact directory or inspected temporary
continuation files. The receipt alone cannot recover live locals/stack/state.

Thus the actual191→192 cost run is **pending the exact saved input**, not passed
or estimated from pre-impact shares. No coupled/application macro is selected
from this missing measurement. A new replay would need an explicit new plan;
this diagnostic does not silently restart or reconstruct from snapshots.

Five host tests pass, including nested partial-call accounting, unfinished-frame
accounting, malformed stack rejection, no invented work on an already complete
lane, and rejection of the actual final192 file against the authentic191 receipt:

```sh
RESIDENT_SEGMENT_ARTIFACT_DIR=/tmp/resident-tip-impact-full-history-created-host-v2 \
  node --test tests/resident-candidate-tip-impact-segment-cost-tests.mjs
```

If the exact191 continuation is recovered, the CLI requires six explicit paths:
initial, saved191 continuation, saved191 receipt, independently produced
cue-Number expected file, immutable final192 actual, and separate diagnostic JSON.
The diagnostic output and its sidecars cannot overwrite any input.

## Future checkpoint retention repair

Future `runTipImpactCreatedHost` checkpoints use the HOST-only
`saveHostContinuation` store. Both the exact predecessor and successor are
written to exclusive hash-addressed `host-continuations/<sha256>.v8` files
before the familiar `continuation.v8` pointer is atomically replaced. The
predecessor must match the current result receipt. Existing archive contents
are verified and never overwritten. This does **not** recover the old191 file
and does not rewrite any historical artifact.

Retention is explicitly bounded at eight immutable checkpoint files for this
harness (roughly41MiB for current5.1MiB captures). Exhaustion rejects before
any pointer or archive write; no predecessor is silently pruned. An identical
checkpoint does not consume another slot. Explicit resume is required whenever
an existing pointer is present, so a new initial run cannot silently reset it.
Six lightweight storage tests include exact VM resume versus uninterrupted
transport, byte/hash preservation, migration of an old pointer, corrupted
archive/receipt rejection, missing predecessor and bounded-capacity behavior.

## Fresh replay recovery and measured final segment

The missing historical191 file was **not** reconstructed. One separately
approved fresh CREATED-t0 replay independently regenerated original-Number
cue expectations. Its entire initial artifact, all bindings, full bytecode,
function signatures/approvals, configuration and layout matched the earlier t0
artifact exactly (`c500a622…4d7b53`). No evolved prior state was loaded. New
artifacts were moved byte-identically to disk-backed
`resident-native-artifacts/tip-impact-created-host-replay-v3`.

The fixed21213-pump stop reached h191 in1806.500s HOST wall, with674724316
accepted-row core steps,766 cue /13300 numeric /192 broad calls and the h128
all11/native checkpoint passing. Its immutable retained file is:

`host-continuations/7d5f264cb6e73ebb4c437d0582bbf34407ea91901ba4cf7884ce2eb73c637efa.v8`

The filename is its SHA256. Only that owned saved continuation was advanced in
the diagnostic segment. SourcePC83/completedH191/request192 and VMPC47303/SP5
became sourcePC123/completedH192/terminal and VMcomplete/SP0. The accepted VM
counter increased674724316→690143272; the rejected lane remained2511 throughout.
The segment consumed244 pumps and **15418956 successful core instructions** in
24.859s HOST wall. Every final source binding and VM word matched the immutable
prior actual192, followed by all11 source, unchanged actual-native projections,
complete one-event accepted-emission tape and final-bank equality PASS.
The generic `$module` diagnostic frame ends via HALT rather than RET; its
reported residual inclusive attribution is partial, not a live VM stack frame.

| Bounded source function | Complete calls | Inclusive core instructions | Segment share |
|---|---:|---:|---:|
| `rc_coupled_transport_advance` |3|11748617|76.20%|
| `rc_world_application_evaluate` |6|2111976|13.70%|
| `rc_tip_impact_checkpoint_capture` (test instrumentation) |110|1200231|7.78%|

Inclusive rows overlap their callees; do not sum parent/child costs. The coupled
root itself accounts for6060665 exclusive instructions; its nested
`rc_num_cont_instruction` runs11635 times (5234482 inclusive). The application
source-program root runs3 times (2102987 inclusive). All software-number/u128
helper exclusive work totals2049279 (13.29%), distributed through those paths.
Already external cue work contributes only5 core instructions in this window;
its native arithmetic is deliberately excluded. Nine existing numeric and two
cue external services occur; broad does not run in this partial-h boundary.

**One limited next pilot is justified:** the unchanged six-u32→u32
`rc_coupled_transport_advance` root, not thousands of numeric-instruction
handoffs or a blanket owner wrapper. A read-only closure audit found41 exact
source functions/24784bytes, no private globals, state/program/scratch storage,
and original budget passed unchanged by `world-h.mjs:166`. All41 function ASTs
match the current authentic dispatcher. Replacing its three complete bodies
with existing two-op external stubs would remove11748611 core interpreter
instructions **in this segment**; this is not a GPU time estimate or a measured
speedup. Native compilation, full side-effect comparison and genuine resident
integration are separate pending gates. No new macro has been implemented here.

Evidence:
* `docs/evidence/resident-tip-impact-h191-h192-host-cost.json`: exact boundaries,
  input hashes, all function/opcode aggregates and strict comparison results.
* `docs/evidence/resident-tip-impact-coupled-macro-candidate.json`: read-only
  signature/closure/private-state audit, explicitly not compiler feasibility.
* Local `segment-cost.json.pc.v8`: one fixed135571-word PC counter array, not a
  per-call trace. Original input files and the archived191 state remain intact.

Two diagnostic-only repairs preceded this terminal report: path normalization
must not pass `Array.map`'s index/array to `path.resolve`; and V8 typed-array
views can alias a serialized Buffer, so the evolving decode now owns a detached
buffer. Regression tests cover both. The hash mismatch involved only the
in-memory decoded receipt buffer; the checkpoint file never changed. The
strict gates were not loosened. Seven segment tests and six retention tests
pass; no fresh full replay was needed for these bounded-segment retries.
