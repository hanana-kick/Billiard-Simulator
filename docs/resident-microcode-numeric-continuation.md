# Source-derived phased NUM_EVAL transport (HOST only)

This opt-in helper does not activate a production path, change a graph program,
replace an equation, or claim native compilation. It removes the **graph,
input-validation and output-validation traversal loops** from one numeric step.
The original preserved-f32 arithmetic helper loops remain unchanged.

`microcode-numeric-continuation.mjs` extracts the original `rc_num_eval` header,
input check, complete single-node body, initialized-register check, output check
and final status store. Its descriptor pins the approved original function and
transitive closure, each extracted part, the explicit transformation, layout and
generated shader. It is a transport-equivalence descriptor, **not** a claim that
the relocated helper has the unchanged root's closure hash.

## ABI

Generator options: `{candidateCount, vmStride, tailOffset}`. The tail is exactly
the last16 words of each candidate's VM allocation; the caller appends it after
the original control/locals/call stack. The helper rejects misaligned/out-of-range
candidate bases and mismatched full VM-array length before any write.

| Word | Meaning |
|---:|---|
|0|magic `0x52434e56`|
|1|phase0 IDLE,1 HEADER,2 INPUT_CHECK,3 NODE,4 OUTPUT_CHECK,5 RETURN|
|2–5|owner PC, destination local slot, program base, scratch base|
|6–9|node index, initialized count, validation cursor, original numeric result|
|10–13|register/node/input/output counts captured after header validation|
|14–15|VM-owned cumulative micro-work low/high; never changed by this helper|

Functions (bindings supplied by caller):

```wgsl
rc_vm_num_start(base, programBase, scratchBase, ownerPC, destination) -> u32
rc_vm_num_step(base) -> u32
rc_vm_num_clear(base) -> u32
```

`start` requires all helper-owned words0..13 zero. It does not inspect or alter
source scratch. `step` performs one header, one input check, one original node
(or zero-node completion check), or one output check. Status0 means pending;
1..4 are the **original source return values**. Status5 is an invalid transport
protocol, never a source numeric result. Terminal steps are idempotent. `clear`
is allowed only after RETURN and clears words0..13 without changing counters.

The VM owner must retain the original PC/destination until RETURN, cross-check
owner PC/destination/program/scratch on resumption, keep programs immutable and
scratch candidate-owned, and perform no other same-candidate source work while
this CALL is pending. No source `rc_state` writes are introduced. Source globals
are not aliased to VM controls. All original source buffer lengths/addresses
retain their original interpretation; no new physical-domain guard is invented.

## Exact dirty/error behavior

Invalid header/scratch span returns2 without touching any scratch word, even a
stale status slot. After valid header/span, the original status slot becomes0
before input checks. Nonfinite inputs return3 in source order. Earlier successful
node writes survive a later malformed/domain/nonfinite failure; a failed node's
destination is not written. All operands are checked eagerly. Output mappings,
including duplicates and input slots, are checked after complete register
assignment. The helper never clears registers or copies mapped outputs. Only
complete output validation stores1. Original return2/3/4 is for the original
caller to handle, not an automatic VM failure or scored MISS.

One successful call consumes `start + header + inputs + max(1,nodes) + outputs`
micro-work units. These are distinct from the single completed source opcode;
source instruction counters must not count each internal phase as another CALL.
Dispatch-budget exhaustion is a yield, not source-budget exhaustion or failure.

## Evidence and gates

Focused HOST gate:9/9 tests pass. The TEST adapter executes the actual
generated phased WGSL and independently lowered original `rc_num_eval`, using
the existing binary64 primitive reference. It compares every dirty scratch word,
immutable programs, candidate-local tail changes and preserved counters. Cases
include all16 original opcodes, malformed headers/nodes/outputs, nonfinite inputs
and results, domain errors, signed zero/subnormals, zero-node programs, duplicate
and input-backed outputs, arbitrary budget splits, fresh-reference resumption,
and invalid-tail/base isolation. Follow-up cases verify observable status/write
ordering at each phase, corrupt phase/header/cursor rejection before source
writes, and interleaved candidates restored from copied backing words. This does
**not** qualify device arithmetic.

Historical evidence is retained, not relabeled: the48,820-byte pruned core with
numeric **and** source-number continuation roots used **workgroup size64/count1**.
It failed main-pipeline compilation with SIGKILL9 after66.02s, before submission
(`docs/evidence/resident-microcode-continuation-compile-diagnostic.json`). A
different16,595-byte numeric-only continuation kernel compiled previously; it
was not this generic VM core. The52,334-byte graph-only in-core pilot likewise
failed before dispatch. These facts are not proof that this transport compiles.

Next independent gates: optional VM transport HOST integration with unchanged
default shader/layout; a newly frozen numeric-only compile-only experiment; then
the unchanged frozen diagnostic's full-source-binding comparison. No GPU test,
speedup, full-h, full-rest, hardware or1024/4096-lane claim is made here.
