# Four-macro raw h192: measured retained pilot (incomplete)

Frozen numerical source: `7d5e70bff01ae9182080ef0496210348c8f12c9a`. The fresh explicit four-macro runtime uses original raw row 219 and rejected row 522, complete source event history, the explicit cue-only original-JS reference, born h192, unchanged dt/latching, and the original 16-second query horizon. The declared transport work is `[512,4096,4096,4096,4096]` (16,896 cycles); the HOST-created recurrence needed 16,529. The extra work is bounded transport padding, not changed physics.

**Status at this checkpoint: paused after the first 512 cycles, without any mapped state or parity assertion.** The same GPU banks/device/pipelines remain retained behind the explicit local decision barrier. No physical result, miss, success, raw-to-impact qualification or full-rest result is asserted.

## Observed software-only cost

Adapter: Google SwiftShader, driver 5.0.0, fallback adapter true. The entire intended 26-descriptor shader set passed preflight before pipeline creation.

| Stage | Host-observed wall | Dispatches | Submissions |
|---|---:|---:|---:|
| Cold preflight/compilation | 129.605 s | none | none |
| Authentic raw initialization | 4.675 s | 68,315 | 67 |
| First 512 cycles | 251.897 s | 2,560 | 3 |

For the pump, queue-drain wall was 251.819 s, CPU encode 37.445 ms, submit 2.116 ms; the GPU-only checkpoint copy took 1.900 ms. These are **not GPU timestamps**. All child workers were quiet/completed during this measured block; lightweight owned supervisor/resource logging remained active. There is no hardware measurement, calibration ratio, or measured whole-shot throughput.

The first block is approximately the earlier corrected three-macro pre-impact cost, **not a speed win**. Applying this rate to the 16,384 remaining cycles gives a provisional 134.35 minutes; the complete 16,896-cycle pump would be 138.54 minutes. Later source paths, notably impact work, can differ. This projection is not a deadline and cannot be extrapolated to full rest or 1024 rows. Continuation is not automatic.

Runtime SHA256: `7cf2c1be3dc3c6736ed07a89d5df92fb01df416df519e86532f1f008839c9f1e`.
Independent expected SHA256: `e0d698573911f87e2fce0a61a5967f7d3c1f3fe0b9fbc58863e249deceb104cc` (assertion-only; GPU role never opens it).
Cost receipt SHA256: `977a429b65120f70a916381d915c211342ec06767e79fefca56206d2297ebb70`.

## Preserved failed attempts and resource-only correction

1. Fresh worktree dependency staging failed before adapter creation: missing ignored generated `vendor/rapier.cjs`, exit 1, no signal, 0.165 s. Copied the existing exact manifest-bound generated dependency and verified every frozen source file. No input/source/shader was changed.
2. First native attempt passed all shader preflights, then the first broad-handler pipeline compile was killed: returncode -9, signal 9, 8.793 s, peak RSS 1,537,804 KiB. This is **pre-dispatch SIGKILL**, not a numerical failure. Its cause is not established.
3. Moved 363,647,532 bytes from 21 completed, owned HOST-test temporary directories to disk. Every file/tree was checked before removing its tmpfs copy; original paths remain exact-content symlinks. No evidence was discarded, no unidentified process was killed, and no mount/security setting changed. Shared-memory usage fell by about 355 MiB. The unchanged retry compiled the broad handler in 17.183 s and all 26 pipelines successfully. This supports the retry, but does not prove the prior kill's cause.

Lean-source review found one initial-runtime deserialization before first pipeline compilation, no original-world or expected import, and no early structured clone/source-bank allocation. Preflight modules are reused and removed from their cache as each pipeline compiles. The two core entry points currently have separate descriptor/module keys. Native module internals/heap are not measured. Owned supervisor peak RSS reached 1,672,076 KiB on the successful compilation attempt.

For future processes, use a recorded disk-backed `TMPDIR` where tests support it. Do not alter the live run or rewrite historical explicit `/tmp` dependencies. The strict final all-11/source/original-PhysicsLab/full-emission-tape gates remain mandatory after any authorized continuation.

## Subsequent coordinator decision

At 2026-10-26 05:41 UTC, the implementation coordinator manually authorized the **already declared remainder**, based on the measured cost and the standing raw-to-impact correctness task. Decision receipt SHA256: `32484fc3185da74e586df5b1c29efbf9577771ebc601255f1b5c0a4ae6488d43`. The same retained bank continues; no source/state reset or additional initialization occurs. The operational pause is included separately in final provenance. Three-ball HOST groundwork may run concurrently after the timing block, so later correctness wall time is not a calibrated benchmark. This continuation decision is **not a terminal result**; all final physical gates remain pending.
