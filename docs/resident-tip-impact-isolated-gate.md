# Fixed raw row219 first-impact diagnostic

This is an **opt-in test coordinator**, not the application search backend. It
admits only row219 `(310°, 85°, 4.5, .2, -.1)` plus invalid row522. The original
16-second query horizon and time-step/latched subdivision rules stay unchanged.
The diagnostic cutoff is h192; success here is not physical rest, a terminal
search result, 1024-candidate qualification, or hardware performance evidence.

## Three separate processes

`tests/resident-candidate-tip-impact-isolated.mjs` provides:

1. `prepare DIRECTORY --work=BLOCKS`: derive the common prestrike/raw input,
   original source/PC and genuine audited h192 program afresh. Compile only the
   actually used WGSL subset with source-hash-approved cue/numeric/broad macros.
   Save **initial-only** `runtime.v8` separately from independent original CPU
   `expected.v8`. `BLOCKS` is an explicit comma-separated list of positive fixed
   pump counts, total at most 65536. There is deliberately no default or selected
   native work budget before the previous h64 result/cost is reviewed.
2. `gpu DIRECTORY`, with both `RUN_RESIDENT_TIP_IMPACT_GPU=1` and
   `REQUIRE_WEBGPU=1`: check frozen source and runtime hashes, preflight every
   shader, compile broad-first before source-buffer allocation, then initialize
   raw rows once and retain the same GPU source/VM/call-stack/scratch/audit banks
   throughout the immutable work blocks. Diagnostic copies do not map or select
   later work. One map follows the last block. This role imports neither the
   original CPU world nor the compiler, and never opens expected files.
3. `assert DIRECTORY`: independent process checks immutable artifact identities,
   both source-PC and VM completion, exact invalid-row h0 rejection, all eleven
   source comparison groups at h128 and h192, and the actual PhysicsLab outer
   chronology and **entire accepted emission tape** through h192. Row219's true
   tip emission is before h165; expected future values are assertions only.

The source observer is inserted before lowering at genuine source owner returns.
It writes a separate diagnostic binding only. It records h128/outer2 and
h192/outer3 after fully completed latched outer steps; incomplete/missed captures
are errors. The 64-event prefix capacity is fixed independently of the appended
snapshot storage. Original state arrays retain their original lengths.

## Authority and numerical boundaries

- Actual audit storage is fresh GPU-zeroed, never host-uploaded. The source sees
  logical binding5; the core/macros see physical binding7. Eight actual storage
  bindings and disjoint GPU buffers are required. The entire 1,016,096-byte audit
  allocation is copied and mapped, including both full source snapshots and
  the rejected lane's required empty region. This size is a layout calculation,
  not a memory/performance measurement.
- Original unsupported/overflow/numerical-domain paths remain errors or explicit
  unsupported. Exhausted transport work is incomplete, never a physical miss.
- Device/process loss may preserve logs only; final mapped diagnostics are not
  a full scratch-state crash-resume format. There is no CPU repair path.
- Native cold compilation, initialization, host encode/queue-drain wall time,
  final readback and steady end-to-end time are separate observations. Queue
  wall time is not a GPU timestamp. Software timings cannot imply a hardware
  acceleration factor without matched measurements.
- Neither a host compilation test nor a synthetic transport test qualifies a
  physical GPU trajectory. The h192 native gate remains **not run** here.

## Current host checks

`node --test tests/resident-candidate-tip-impact-isolated-tests.mjs`:
Six control-contract groups pass. These use synthetic markers, not substitute
physics. They reject missing audit data, changed request/rejection, hidden later
uploads/readbacks, control reset, incomplete/unsupported final VM state, and
mutation after completion. The complete authentic preparation path and native
execution require separate qualification; source-backed fixture/compiler gates
are documented in their own checkpoints.

Authentic **prepare-only** validation also passed at source `4b1f4e2`, with
explicit work `[1]`, no GPU creation and no chosen native run budget. It freshly
generated the original CPU h128/h192 assertions, compiled the actual observed
source and canonical macros, serialized the raw initial-only runtime, then
reopened and validated its complete identities. The first attempt exposed a
coordinator metadata-hash issue: V8 bytes are not a canonical representation
after a round trip. Exact finite plain-value encoding now binds that metadata;
whole stored artifact/code bytes remain SHA256-bound. A dedicated round-trip
and negative regression covers this fix. No numerical source changed.

The curated record is
`docs/evidence/resident-tip-impact-coordinator-host-preparation-v1.json`.
This is still **not** raw-to-impact GPU parity or a completed search result.

No application default, inverse planner, deployment, main branch, or published
site changes are made by this coordinator. No h192 GPU run is automatically
started after h64 or after a host test.
