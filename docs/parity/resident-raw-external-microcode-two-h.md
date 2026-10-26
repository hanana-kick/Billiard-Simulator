# Raw six-row resident microcode with source macro handlers

**Strict original-source parity passed; the performance target did not.**
This is a two-h continuation checkpoint, not actual ball strike, full rest,
1024 simultaneous physical candidates, or hardware-GPU qualification.

## Executed boundary

The frozen accepted initial-only raw runtime was reused unchanged. Six raw
parameter rows enter original GPU initialization, then a storage-resident
scalar VM runs the source-ordered world. Two exact-source macros execute in
separate kernels: `rc_cue_flat_advance` (original 32768 instruction argument)
and `rc_num_eval` (original graph limits). The generic core does not inline
those native helper trees.

The compiler emits an approved `EXTERNAL_CALL` callee stub followed by normal
`RET`. The core holds PC/locals/stack in WAITING; the appropriate device handler
writes the return slot and resumes at RET. No host physics, conditional host
selection, future-state upload, or readback occurs between cycles. Invalid
protocol is rejected before source writes. Duplicate/unselected handlers do
nothing. The fixed schedule is core → cue → numeric for 512 cycles, with a
65536 scalar instruction budget. Core WGS64 and handler WGS1 remain explicit.

All 24 shader modules passed preflight before any pipeline was created. Heavy
macro pipelines compiled first, before initial source/VM buffers were allocated.
Two independent fresh-buffer runs reused the same device and pipeline cache;
each mapped diagnostics once, only after the complete schedule.

## Original comparator result

The separate, unchanged comparator passed all 11 source groups in eight strict
comparisons (four clear rows × two runs). Clear rows reached h2. The blocked and
invalid rows retained status8/reasons3 and2, respectively; they were not ordinary
physics misses. Complete source and VM buffers repeated exactly in the warm run.

- Runtime SHA256: `6aa5b97797902ace3aae0822b08fc4a2945b9ed941baaa5a91bfe83c5c36deb5`
- Actual SHA256: `ede21bafff473e9b64ac49b58ad0ad8efb47127699da8bf0f461b70277f213a5`
- Frozen preparation checkpoint: `f7dfbdc`.
- Native process exit0; sampled/child peak RSS 1,212,548 KiB.
- Adapter: SwiftShader 5.0.0, fallback true. This is not hardware performance.

The first separately launched assertion process reused PID5, so an existing
PID-inequality infrastructure check stopped it before physics comparison. The
unchanged comparator then ran as an independently launched child PID6. Stored
PID, outputs, expected states and source hashes were not edited. Future process
identity must not rely solely on PID inequality across namespaces.

## Measured timing, not an acceleration claim

| Phase | Dispatches/run | First run | Warm run |
| --- | ---: | ---: | ---: |
| Original raw initialization | 68,315 | 7.694 s | 6.664 s |
| Resident VM + macro pump | 1,536 | 143.508 s | 133.939 s |
| Steady end-to-end including final map | 69,851 | 151.204 s | 140.696 s |

Cold compilation was 89.922 s separately. Warm execution used all 24 cached
pipelines. Warm pump encoding was 5.292 ms; queue-drain wall time was 133.912 s.
These are host wall measurements, not GPU timestamps. The command reduction
alone did not improve elapsed time; the earlier 32768-command two-h path was
about65.87 s for its pump. This implementation is **not** a basis for launching
an unbounded/long full-rest run or claiming throughput for1024 worlds. Remaining
scalar interpretation/source-kernel execution must be measured and reduced.

The 48-row native continuation malformed/cap fixture remains pending separately;
this raw two-h pass does not replace it. Production admission/default CPU/backend
flags were not enabled by the gate. Actual strike, full-rest positive and
late-opponent-foul parity, then many-candidate throughput remain required.

Machine-readable hashes, controls, cold/warm counters, source manifest, command,
PID/resource evidence and local artifact paths are in
[`../evidence/resident-raw-external-microcode-two-h.json`](../evidence/resident-raw-external-microcode-two-h.json).
