# Source-bound graph-only in-core pilot

This is the bounded follow-up to `resident-post-impact-cost-profile.md`, not a
production switch. The unchanged `rc_num_eval` dependency closure is selected
through the existing `source-numeric-v1` intrinsic profile with the explicit
one-item allowlist `['rc_num_eval']`. Cue, broad commit and coupled transport
remain separate macros. No other arithmetic helper is newly substituted and no
source, numeric profile, dt, instruction budget, physical cap or original PC
program is changed.

Preparation proves the original four-macro compiler output matches the pinned
baseline, all retained macro approvals match, and the graph's parsed signature,
body, entire transitive dependency map and closure hash are identical between
the old macro and selected intrinsic. It generates a 52,334-byte core. Existing
all-helper/in-core-preparation compiler failures are not relabeled resolved.

## HOST differential

Same declared owned HOST h192 t0 as the prior diagnostic; candidate219 advances
one h, rejected522 remains h0. Both fresh VM execution and full six-binding final
comparison pass. Expected terminal banks are decoded only after execution ends.
The graph executes the same 77 calls, now without an external kernel handoff.

| Diagnostic work | Baseline four macros | Graph-only intrinsic + three macros |
|---|---:|---:|
| Core instructions, accepted219 | 2,752,256 | 2,751,871 |
| Core instructions, rejected522 | 2,511 | 2,511 |
| Pumps | 108 | 49 |
| Fixed command model | 540 | 196 |
| Actual GPU dispatches in this HOST gate | 0 | 0 |

The command model falls 63.7%; this is not a measured GPU speedup. Observed HOST
wall was 31,624.615ms with independent HOST work allowed. The full-world native
raw initialization, multiple-candidate isolation, numerical precision domain,
raw recurrence/full rest and solver observations remain separate qualifications.
No PhysicsLab/native h193 equality is inferred from the HOST source differential.

The curated result is `docs/evidence/resident-inline-graph-host-pilot.json`.
Raw diagnostic banks and exhaustive counters remain local. Eight focused HOST
tests reject changed closure/profile, invalid caps, extra compile payload fields
and an unrequested native role. An initial preparation command selected the wrong
source-only artifact and failed its immutable file hash before compiling;
the verified original source path was then used with the original hash unchanged.

## Native feasibility boundary

`tests/resident-candidate-inline-graph-compile.mjs` prepares a pinned 53,296-byte
JSON containing only the new shader and fixed metadata. Its explicit native role
syntax-checks before one pipeline creation and has no buffer allocation,
command encoder, upload, dispatch or mapping. It does not import PhysicsLab,
the compiler, diagnostic banks, or expected results. It records adapter identity,
compile wall time and owned-process resources; a signal or resource failure is
not classified as a numerical mismatch or an invented OOM cause.

## Native compile-only result: negative

The frozen `5663d42` compile-only gate passed WGSL syntax preflight, then its
owned child received **SIGKILL9 during `createComputePipelineAsync(main)`**.
Supervisor wall was 46.339s, peak child RSS 1,929,384KiB, with no supervisor
interruption. There were zero buffers, uploads, dispatches or mappings. No
pipeline-ready result or numerical execution occurred. The reported adapter was
Dawn Vulkan SwiftShader, not hardware acceleration. The cause is not proven OOM.

`docs/evidence/resident-inline-graph-core-compile-negative.json` preserves the
source/payload/shader/terminal-receipt identity and exact scope. No identical
retry is authorized by this document. The whole-graph-in-core profile remains
**unadopted**, and the HOST 540→196 command reduction is not usable native
throughput evidence.

A separate source-exact phased numeric continuation is under HOST investigation:
one header/input/node/output microstep under the existing VM pump, with a
disjoint VM-owned cursor rather than physical-state scratch. This must preserve
all source error/dirty-write semantics and undergo new native compilation gates;
historical two-helper pruned continuation compilation also failed. No earlier
49-pump budget or compile success may be assumed for that different transport.
