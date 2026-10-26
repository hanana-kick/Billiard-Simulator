# Compact VM continuation native gate: compilation boundary

Checkpoint `b81bad2` adds an explicit exact-source `intrinsicFunctions` allowlist.
The compiler-generated immutable program determines the native roots used by
`tests/resident-candidate-microcode-continuation-native.mjs`. An unlisted
intrinsic fails `UNSUPPORTED/unsupportedPrimitive`; it is not a physical miss
and cannot invoke a host fallback.

## Unchanged component fixture

- 48 original scalar-source oracle rows, combined into 39 initial-state groups
  and 49 logical calls. Both numeric and source continuation roots execute.
- First/mid/final calls retain source buffers. Expected CPU snapshots are never
  uploaded; malformed mid-node cases are rebuilt from initial state.
- All five source buffers and return status are compared after each logical
  call. Three fresh-buffer repetitions reuse compiled pipelines if compilation
  succeeds. Original source instruction caps and arithmetic bodies are unchanged.
- Count 1, explicit workgroup size 64, 128 chunks of one VM instruction per call.
  This deliberately checks continuation transport; it is not a throughput test.

## Native results on SwiftShader, 2026-10-25

| Native roots | Shader bytes | Helper bytes | Outcome |
| --- | ---: | ---: | --- |
| All 17 profile roots | 57,615 | 23,786 | Main pipeline did not finish; Node test parent exit 1 after 55.076 s. Child signal was not captured. |
| Only the two emitted continuation roots | 48,820 | 18,598 | WGSL preflight passed; begin pipeline completed; main compilation process received SIGKILL after 66.024 s. |

The second launch invoked Node directly, without a `node --test` child or an
application timeout. An external Python parent sampled `/proc/<pid>/status`
and captured return code -9. Peak child RSS was 2,496,340 KiB. The last sample
was 2,465,784 KiB. These establish SIGKILL, **not its cause**: no cgroup OOM
record was available. Neither attempt submitted a numerical workload, so
neither supplies a numerical pass or timing ratio.

The two-root variant removes 15 native VM call sites, but still inlines the
large original helper trees beneath each retained controller root. It is a
materially different shader, not evidence that all-source intrinsic composition
fits the compiler. No further identical retry is justified by these results.

The host transport/admission suites passed 19 tests (one native test skipped).
The original all-scalar native binary64 and 12-query point gates remain distinct
prior evidence, not qualification of this native intrinsic implementation.

Exact hashes, launch arguments, phase and resource evidence are recorded in
[`../evidence/resident-microcode-continuation-compile-diagnostic.json`](../evidence/resident-microcode-continuation-compile-diagnostic.json).
Full local logs/artifacts are named there. CPU/default application behavior,
production admission flags and physics caps were not changed. Whole-world GPU
recurrence, actual strike, full rest, 1024 simultaneous candidates and hardware
performance remain unqualified by this component gate.
