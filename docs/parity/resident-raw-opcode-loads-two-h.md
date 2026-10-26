# Opcode-required operand loads: native two-h checkpoint

**Exact state parity passed. A meaningful speed improvement was not demonstrated.**

At `be8acde3faca12546aeb0090e29eb4f647f22ce0`, the core shader reads only the local operands used by the current opcode, after its unchanged range/operand guards. No arithmetic, bytecode, source guard, counter, budget, private-state reset, macro implementation or physical cap changed. There is no control caching in this gate.

Preparation compared the entire initial-only raw payload, scalar bytecode, all macro shaders and configuration against the [broad-only baseline](resident-raw-broad-macro-two-h.md). Only the VM generator source differed. Both fresh native runs used the same six rows, original raw initializer and two h on SwiftShader. The compiler child had completed; the VM child explicitly acknowledged a no-command/test hold before execution and remained held until the comparator finished.

## Result

- All eight original comparisons passed all 11 source groups. Four admitted rows reached h2; blocked/invalid rows stayed status 8, reasons 3/2, at h0.
- Every source-bank and VM-bank word matched between warm/fresh runs **and against the previous broad-only artifact**. This includes dirty local/scratch state, not just exported body fields.
- All 25 pipelines preflighted before compilation. The numerical child exited 0 without signal/timeout; peak RSS was 1,716,664 KiB.
- One final map per run; no CPU future-state upload, intermediate state selection or forward fallback.

| Two-h pump (same 2,048 dispatches) | Broad-only | Opcode-required loads |
|---|---:|---:|
| First fresh execution | 111.546 s | 118.388 s |
| Warm fresh execution | 110.174 s | 108.371 s |

The new warm end-to-end time through initialization and final map was **115.799 s**. These are host-wall/queue-drain observations, not GPU timestamps. There is only one warm sample per variant, and the baseline's small overlapping host checks are separately disclosed. The inconsistent first/warm change does not justify a speedup claim, a hardware correction factor or a full-shot extrapolation.

The static operand audit's 65.17% reduction in *generated local reads* was real, but it was **not** a measurement of backend memory traffic or a demonstrated bottleneck. This result does not establish that the GPU compiler executed all the removed reads.

## Boundary

This remains a bounded prestrike two-h gate, not raw-to-impact, full rest, late-foul trajectory qualification, 1,024 simultaneous physical worlds or hardware performance. Default CPU execution and public qualification are unchanged. No long-shot run is justified by this timing.

The next separately gated proposal is caching only VM control scalars inside a kernel. It must preserve and flush every original yield, malformed/domain failure, counter overflow, macro wait, return and completion, and prove source buffers cannot alias the VM control bank. It is not enabled by this checkpoint.

Exact artifact/source hashes, matched-input/result assertions, controls, adapter identity and timing scopes: [evidence JSON](../evidence/resident-raw-opcode-loads-two-h-v1.json). Complete local artifacts are in `/tmp/resident-microcode-world-opcode-loads-v1`; raw logs and `.v8` payloads are not committed.
