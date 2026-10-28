# Checked preparation inside the scalar core — bounded HOST pilot

**PASS at authentic committed h1, not native/GPU or full-rest qualification.**
The previous analysis rejected another external macro because it would add 216
waits. This explicit pilot lowers only `rc_geometry_numeric_prepare` into one
in-core operation, retaining the four existing external macros. No new host
stage, wait, dispatch or fallback is introduced. Defaults and the separate frozen
h192 numerical run are untouched.

## Measured source-execution results

Input is the authenticated fresh CREATED-t0 artifact
`74c67de5efd476cbbe394678cfc927ac5ed6d70a3b38c5e24697dd735895eb75`,
not a saved evolved state or raw-GPU admission. Original requestedH remains192;
the diagnostic stops after the original owner RET commits completedH1 and all
whole-h idle assertions pass. It never rewrites the horizon or restores a captured
future snapshot. Fresh baseline lowering equals the admitted original bytecode.

| Metric | Original four-macro scalar core | Preparation in core |
|---|---:|---:|
| Successful core instructions through committed h1 | 1,789,105 | 1,502,528 |
| Static instructions | 131,908 | 130,652 |
| Local words per lane | 7,786 | 7,786 |
| Call-stack capacity | 15 | 15 |
| External handoffs | 74 | 74 |
| In-core preparation calls | 0 | 216 |

Exactly **286,577 core instructions (16.02%)** are removed on this prefix.
Handoffs remain4 cue +69 numeric +1 broad; the coupled handler is inactive here.
No dispatch reduction or wall-speed gain is measured by this HOST run.

All216 captured calls return0: kinds1–4 each26, kinds5–6 each56. These counts are
fixture observations, not assumptions for impact/full rest/1024 candidates.
At every call, complete source state, dirty scratch, audit and read-only bindings
match between the retained original world call, an independently compiled scalar
closure, an independent source-AST executor, and the actual generated checked
helper executed by that AST executor. Afterward a separate fresh optimized h1
execution matches **every final source/scratch/audit/read-only word**. Its return
PC commits at the same original owner boundary; source/control error remains0.

The original preparation executes11,007 logical reads and16,553 writes. Those
27,560 source LOAD/STORE instructions move out of the generic interpreter; the
underlying memory work is **not eliminated**. Checked native accesses add bounds
work. LENGTH operations, local-memory traffic, device compilation and native
steady cost are not measured by those two counts. The unchanged external bodies
are also outside the core instruction totals.

## Admission, bounds and failure semantics

Profile: `source-geometry-preparation-count2-v1`, six u32 inputs → one u32 result.
The new opcode fits the existing eight-word instruction. It requires the exact
`PREPARATION_DESCRIPTOR`; absence, unknown profile, changed descriptor and counts
other than2 reject. No old numerical profile silently acquires this operation.

The canonical27-function closure is copied verbatim from authenticated source
`5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7`.
Original generators remain `geometry-numeric-owner`, `numeric-request`,
`narrowphase`, `world-geometry`, `world-cue-geometry` and `cue-empty-caches`.
The fixed pilot records signature, root body, every transitive function,
declarations, storage bindings, layout and preserved-f32 profile identities.
Actual compilation independently compares every body/dependency and exact
storage address-space/access/type declarations, not only function names.

Important hashes:
- Original function-only closure bytes: `6e16f188778849dff8df7a37a51c160e758ef2747f3f8bc2a57ad48be8ebde45`.
- Parsed transitive function closure: `c16938d4ab763a09c65b13e077418a3dbda4ec937d8dd49ac9b29bc5d2f8f7ab`.
- Layout: `1ac47e1e91b83bd3c867326dc71c828e8c80ac7046701e6d524ea7ef67590b6e`.
- Original packed bytecode: `d0241fb5daa61ea4923cde61881beb799f3407d2c686f3661a22dea36c79cde5`.
- New packed bytecode: `341fe9a65b608b8e3df4dafcb5c96a97cd6e3e364722b9d550af32f31bf849cb`.

The native helper is generated from the approved AST, retaining original u32
wrapping, expression/call/short-circuit order and all eight original bounded
loops (maximum368). Only storage accesses are instrumented. Source functions
have no private state; two new transport guard scalars reset once per opcode.
The layout admits bank0/62976, its complete62976-word candidate object, its own
24-word request, its own13632-word scratch and exact full binding lengths.
Readonly geometry/program retain their original full array lengths.

The sticky first storage fault preserves all earlier visible writes and blocks
later writes. The VM reports the existing INVALID/storageRange; result register,
return PC, CALL stack and successful-step count do not advance. Successful calls
commit one operation without an external wait. A malformed candidate bank is
UNSUPPORTED/sourceDomain before helper writes. Original source failure returns
(e.g. wrong request/kind) stay source return values, not VM completion claims.

**Scope is deliberately narrower than arbitrary malformed source storage.**
The old scalar path could access another candidate through corrupt in-range
pointers; this profile explicitly rejects that ownership violation. It does not
claim equivalent success for such input. Interior fields of a candidate object
retain original layout semantics; no general forged-cache/pointer proof is
claimed. Checks are executable at the affected access, not documentation-only.
Read/write faults, u32/signed-bit wrap, cross-candidate ownership, partial dirty
scratch writes, source failure PC/status and missing descriptor are tested.

## Reproduction and stopping boundary

`tests/resident-candidate-preparation-in-core-host.mjs` streams comparisons,
discarding per-call copies. It retains one active source/VM per run, bounded
transient comparison copies and one final baseline assertion bank; no per-call
state archive or full instruction trace. Each prefix is capped at8M transport
steps/120s, with an incomplete bound treated as failure of this diagnostic gate,
never as a physical miss. Source physics caps are unchanged. Evidence is in
`docs/evidence/resident-preparation-in-core-h1-host.json` (hashes/counts only).

Focused source/compiler/VM/allocation/intrinsic/external/control-cache suite:
**78 passed, 1 optional native test skipped, 0 failed**. Both standard/cached
component shaders parse as WGSL; this is not Dawn compilation or native proof.

Next gate, only after the parent releases the numerical slot: compile the lean
source-bound component, compare actual device effects/failure transport, then
measure the unchanged vs opted core on matched inputs. Do not infer speed from
HOST execution or extend directly to a long shot. Whole-candidate throughput,
physical impact/full-rest parity and hardware performance remain unproven by
this pilot. No package/CI/plumbing/default/deployment changes are included.
