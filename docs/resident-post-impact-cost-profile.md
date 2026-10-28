# One-h post-impact HOST cost diagnostic

This is a **separate, explicitly initialized HOST h192→193 diagnostic**, not a
raw-to-impact run, a resumed GPU bank, or original PhysicsLab h193 qualification.
The input is the immutable, owned completed HOST bank from the independently
checked h192 comparison. No expected future state is supplied to execution.

`tests/resident-candidate-post-impact-profile.mjs` verifies all six four-/five-
macro initial bindings agree, the independent h192 receipt, source and bytecode
hashes, and unchanged physical/scratch/history/input/program words. It executes
the original source PC begin with only the diagnostic's requested additional-h
literal changed to 1. Only its 80 control words per candidate may change. Both
diagnostics use a fresh VM, original 65,536-instruction budget and source caps.
This is not a way to reset an ongoing raw shot or extend its horizon.

## Result

Both profiles completed; every word of all six final source bindings agrees.
Candidate 219 advances h192→193; rejected 522 remains h0. VM layouts/counters are
profile-specific and are not falsely asserted identical.

| Work in this single declared diagnostic | Four macros | Optional five macros |
|---|---:|---:|
| Accepted lane core instructions | 2,752,256 | 1,861,651 |
| Rejected lane core instructions | 2,511 | 2,511 |
| Fixed schedule pumps | 108 | 96 |
| Numeric graph macro calls | 77 | 77 |
| Other macro calls | 8 | 10 |
| Modeled fixed dispatches | 540 | 576 |
| Actual GPU dispatches | 0 | 0 |
| Observed HOST wall milliseconds | 32,116.127 | 28,810.355 |

The fifth macro reduces accepted core instructions by about 32.36%, but increases
the fixed command model by 6.67%. HOST timings overlapped independent HOST work;
they are not native GPU measurements, a calibrated speed ratio, or shot costs.
The existing four-macro native profile remains the baseline.

In the four-macro profile, `rc_num_eval` accounts for 77/85 handoffs. The optional
fifth macro removes much of the software-binary64 scalar work but not these
handoffs. In that five-macro core, the largest functions are `rc_pc_guard`
(181,063), cue-geometry graph preparation (138,065), general graph preparation
(108,420), `rc_pc_advance` (105,078) and the world driver (103,332). MOV/SET remain
about 55% of instructions. The report distinguishes source memory operations and
explicit operand reads from unmeasured macro memory traffic and VM machinery.

The next bounded investigation is the **already source-hash-bound `rc_num_eval`
intrinsic alone**, inside the generic core, with the other three macros retained.
It is not all-helper inlining or a name-only replacement. Compiler feasibility,
every changed source boundary and native numerical results remain unqualified.
No projection from this one h to strike, full rest or 1,024 candidates is made.

## Evidence and preserved failures

The curated report is `docs/evidence/resident-post-impact-cost-profile.json`.
It records immutable input/result/output hashes and bounded PC/opcode summaries;
raw bank artifacts remain local. The four focused HOST unit tests cover work
caps, source-literal uniqueness, pin identity and counter accounting.

Two preparation failures were retained locally before this successful run:

1. The trimmed created-state template lacked the original PC compiler fields.
   Preparation rejected it; the repair loads and verifies the actual original
   PC program instead of inventing omitted fields.
2. The five-binding macro oracle rejected an accidental six-binding view.
   The repair supplies its unchanged five logical bindings; the Number owner
   separately receives the six-binding audit-aware view it requires.

Neither failure was a physics mismatch or GPU execution. No failing result was
repaired by copying expected state, weakening comparisons, or changing source
steps. Native first-impact h192 remains a separate earlier qualification; full
rest, actual scale, inverse observations and application integration remain open.
