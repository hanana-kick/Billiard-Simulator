# Authenticated CREATED t0 → first committed h: HOST core cost

**Measured diagnostic, not a GPU benchmark or completed query.** The explicit
four-macro profile executed accepted row 219 only, from the new authenticated
CREATED t0 input. Row 522's initialized VM was deliberately not executed. The
independent lead HOST recurrence ran concurrently; no elapsed-time calibration
or hardware ratio is inferred. No evolved checkpoint, old VM layout, expected
future state, or GPU execution was used.

## Exact scope and stopping boundary

- Initial file SHA256: `74c67de5efd476cbbe394678cfc927ac5ed6d70a3b38c5e24697dd735895eb75`.
- Source SHA256: `5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7`.
- Bytecode SHA256: `d0241fb5daa61ea4923cde61881beb799f3407d2c686f3661a22dea36c79cde5`.
- Profile: `source-coupled-macro-v1`, 131,908 immutable instructions.
- First committed source h1 observed at `rc_micro_original_owner_13` RET PC
  **23455**. Source `completedH=1`, initialH0/requestedH192 retained, ready/error0,
  and unchanged `assertWholeHCommitted` succeeded (not merely the frame header).
- Existing TEST `onReturn` only sets a flag. `advance(0,1)` then commits the RET
  normally before the loop stops: VM PC **2929**, SP1, ready/error0, no pending
  macro. No observer exception and **zero overshoot**. Owner13 has nine completed
  calls in this prefix; only its last call meets the completed-h condition.
- Source caps and configured instruction budget 65,536 are unchanged. One-op
  diagnostic transport yields allow exact stopping; they are **not production
  dispatch counts**. No follow-on state is persisted.
- Whole-h idle/boundary assertions passed. This is not an independent all11
  physics parity replay, native outer boundary, full rest, or query terminal.

## Measured counts

Exactly **1,789,105 successful core instructions**, reconciled independently
against per-PC counters, opcode sums, function-exclusive sums, and VM step delta.
Native macro bodies are outside this core counter: cue **4**, NUM_EVAL **69**,
broad commit **1**, coupled transport **0** calls. Both source audit lanes contain
zero post-t0 emissions at this boundary.

| Source function | Calls | Exclusive ops | Complete-call inclusive ops | Inclusive share |
|---|---:|---:|---:|---:|
| `rc_world_shared_graph_owner` | 232 | 30,247 | 500,171 | 27.96% |
| `rc_geometry_numeric_prepare` | 216 | 108,427 | 285,065 | 15.93% |
| `rc_pc_advance` | 571 | 101,721 | 259,869 | 14.53% |
| `rc_pc_guard` | 1,244 | 171,189 | 171,189 | 9.57% |
| `rc_gn_prepare_rc_world_cue_geometry_pose` | 56 | 138,065 | 141,365 | 7.90% |
| `rc_world_solver_gather` | 1 | 77,054 | 85,759 | 4.79% |
| `rc_micro_reset_private` | 571 | 54,245 | 54,245 | 3.03% |
| `rc_tip_impact_checkpoint_capture` | 1,140 | 44,460 | 44,460 | 2.49% |

**Inclusive rows overlap and must not be added.** In particular numeric
preparation is nested within shared-graph ownership; PC advance includes calls
to the guard. The generic original-owner7 wrapper totals 687,249 inclusive, but
that is not a proposed native physics root. The still-running world dispatcher
has 98,542 exclusive ops; its prefix-only inclusive attribution is explicitly
partial, not a complete replaceable invocation.

MOV624,555 + SET359,972 account for **55.03%** of committed instructions. This is
raw volume, **not proven removable work**. Software-f64/u128/source-program helper
exclusive ops total **76,603 (4.28%)**, excluding arithmetic already in native
macro callbacks. Thus no standalone f64-dominance claim follows from this prefix.

Source storage accesses (not VM-local physical memory transactions):

| Binding | LOAD | STORE | LENGTH |
|---|---:|---:|---:|
| 0 state | 53,197 | 31,859 | 4,866 |
| 1 program | 7,595 | 0 | 14 |
| 2 geometry | 11,374 | 0 | 0 |
| 3 scratch | 1,074 | 8,912 | 1,864 |
| 5 audit | 1,140 | 0 | 1,140 |
| **Total** | **74,380** | **40,771** | **7,884** |

Local indirect access counts: LOCAL_LOAD2,841 and LOCAL_STORE1,077. Fixed counters
and aggregate diagnostic stacks were retained, not per-call/per-instruction
states or a full trace. The JSON contains all 331 nonzero function aggregates.

## Decision boundary

This one prefix measures unchanged pre-impact core work; it is not a whole-shot
workload or timing model. Shared graph preparation is the largest measured
completed source root here. Whether a native boundary is viable still requires
exact closure/private-state/argument validation, bounded handler compilation,
and actual handoff/control cost. No macro or optimization was added by this task.
Post-impact and full-rest behavior remain the lead recurrence's separate gates.

## Reproduction and checks

```sh
node tests/resident-candidate-coupled-h1-cost.mjs /path/to/initial.v8 /fresh/report.json
RESIDENT_COUPLED_H1_INITIAL=/path/to/initial.v8 \
RESIDENT_COUPLED_H1_REPORT=/fresh/report.json \
node --test tests/resident-candidate-coupled-h1-cost-tests.mjs
```

The input hash is pinned; outputs use exclusive creation and cannot overwrite
input. The original serialized bytes and file SHA are rechecked after execution;
working typed-array views decode from detached storage. Five lightweight tests
pass, including wrong-authority rejection, owner-RET attribution, header-only
boundary rejection, immutable input preservation, and actual count reconciliation.
The first test draft incorrectly assumed owner13 returned once; the measured
source services nine phases. The receipt assertion now checks that exact count;
the actual stopping predicate/source gate was not changed or rerun.

Evidence: `docs/evidence/resident-coupled-created-first-h-cost.json`.
