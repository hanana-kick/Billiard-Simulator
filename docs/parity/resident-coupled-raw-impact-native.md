# Raw parameters → genuine first impact: bounded resident PASS

On 2026-10-26, the frozen source
`7d5e70bff01ae9182080ef0496210348c8f12c9a` completed the declared two-row native
WebGPU run and its **separate independent assertion passed**. This is a real
raw-to-impact milestone, not full-rest, terminal-query, 1024-lane, hardware-speed
or release qualification. The application default remains CPU.

## Input and exact endpoint

- Admitted row219: angle310°, elevation85°, speed4.5, tip(.2,−.1).
- Rejected row522: angle9°, elevation8°, speed0, tip(0,0).
- Original time step, outer-step-latched subdivisions, physical horizon and all
  source caps were unchanged. The first real tip impact is at h165; the declared
  endpoint is h192, with independent source/native comparisons at h128 and h192.
- One raw initialization; complete world/contact/solver/CCD/history/VM state
  stayed resident. Five predetermined checkpoints were GPU-to-GPU copies only.
  There was **one final map and zero continuation readbacks or CPU stepping**.
- All 16,896 predetermined pump cycles completed; no future expected state was
  opened by the GPU process or supplied as runtime input. No full-rest extension
  was scheduled. Remaining physical evaluation is incomplete, not a MISS.

The assertion combines distinct authorities, without overstating either:

1. All11 source-owner groups compare independently at both source endpoints.
2. The unchanged original `PhysicsLab.step(1)` outer checkpoints compare exact
   represented native ball/cue poses, rotations, velocities, mass/inertia words,
   sleeping, compliant-contact flags/counts/tangent/stats, binary64 clocks,
   latched subdivisions, represented optimizer/game counters and full history.
3. The complete accepted post-creation emission tape (one emitted event in this
   prefix) matches key/time/h/outer/substep receipts. Rejected522 retains the
   authentic prestrike history and never appends a new stroke.

The original native projection is **not complete native-engine memory equality**.
Native contact caches, BVH/allocator/scene internals and solver warmstarts are
covered by the independent all11 *source-owner* comparison, not directly claimed
equal to native internal memory. Native cue joint impulses, presentation labels/
event positions, paths and ranking artifacts are not projected by this gate.

## Immutable receipts (local, not publication claims)

Artifact directory relative to the workspace:
`resident-native-artifacts/coupled-raw-impact-native-v1/`.

| File | SHA256 |
| --- | --- |
| `manifest.json` | `c3949373ccb4d729b77a17955770f1a2d47e9a6d11096e7d7c8142350b2fe8d8` |
| initial-only `runtime.v8` | `7cf2c1be3dc3c6736ed07a89d5df92fb01df416df519e86532f1f008839c9f1e` |
| assertion-only `expected.v8` | `e0d698573911f87e2fce0a61a5967f7d3c1f3fe0b9fbc58863e249deceb104cc` |
| `actual.v8` | `dd02fb5fec72f0ff682aaef98ccc7da42efe46927bf236d3268a458c066bd9b7` |
| `assertion.json` | `cdb385e0897028347b9eb51a145c5af8978d6baa1c45686c964754f3f6f156bb` |

The accepted lane finished with361,168,594 successful core instructions; the
rejected lane with2,511. These match the separately prepared HOST reference.
Profiles are `source-coupled-macro-v1`, `original-js-number-v1`, and
`source-full-application-history-v1`. The original failed contact-only-history
run and the pre-dispatch failed compilation attempts remain preserved; they
have not been relabeled as passes.

## Measured software cost, not a throughput or hardware claim

Adapter: Google SwiftShader5.0.0, fallback=true. Supervisor exit0/no signal;
wall9417.821s (156.96min), peak child RSS1,672,076KiB. The fixed schedule used:

- Raw initialization:68,315 dispatches,67 submissions,4.675s execution-group wall.
- Continuation:84,480 dispatches,85 submissions across16,896 cycles, including
  67,584 external-handler dispatches. Each cycle retains the existing core plus
  four exact-source macro stages.
- Whole run:152,795 dispatches,155 submissions,8 initial writes,15 copies,1 map.
- CPU encode0.911s; submit0.081s; queue-drain wall8860.527s; final map7.487ms.
- Cold pipeline preparation129.605s is separate. The session reports9287.614s
  from post-compilation setup to final validation, **including the manual retained
  pilot decision wait**; it is not a clean steady-state throughput measurement.

Queue-drain wall is not a GPU timestamp. Independent HOST work overlapped this
correctness run. Only one physical row was admitted, so these measurements do
not establish multi-candidate parallel throughput, a hardware correction ratio,
or performance for full rest. The cost is a continuing architecture gate: next
are separately profiled in-core preparation and genuinely varied multi-lane
macro launch checks, before considering a costly raw-to-rest execution.

The independent comparison command ran in the **frozen worktree**, after the
owned supervisor reached terminal, using the existing comparator unchanged:

```sh
node tests/resident-candidate-tip-impact-isolated.mjs assert \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/coupled-raw-impact-native-v1
```

Do not rerun preparation or overwrite the retained bank/receipts to reproduce a
claim. The new explicit qualification runner can create a separately identified
run with its own authorized bounded schedule. See `resident-release-gates.md`.
