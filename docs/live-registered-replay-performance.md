# Live registered replay-only performance protocol

This harness measures actual candidate replay separately from independent original assertions. It is a diagnostic and regression instrument, not a product backend switch, hardware GPU acceleration claim, complete browser test, or replacement for `live-registered-world-replay.mjs`.

## Fixed scope and provenance

- Baseline runtime: commit `b68246c`, pinned by the aggregate runtime source SHA-256 and its complete per-file source map in every result. Candidate results must report their own source root and commit. Source hashes are rechecked after execution.
- Workload: the unchanged `placed` live capture, SHA-256 `4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403`, actual browser/read-only-WASM import, and a parameterless world replay.
- Oracle: existing independently produced continuous original reference, SHA-256 `2f81d4855d850bba3d807f79df246ffbc43a84dfa8fd3ebd1333bd14a3ab5a50`. No new original/native full shot is run. It is first loaded after measured replay, output serialization, idempotence checks and disposal.
- Both source and reference hashes are checked before deserialization. The importer receives only the original raw initial envelope. Neither expected frames nor checkpoints are passed to the candidate. The candidate process never initializes/loads the native engine or original controller.
- The measured CPU is `World.createReferenceStepper`, the parity-port CPU reference, not the existing Rapier production controller. Original/native oracle generation is not timed. CPU-reference and actual WebGPU execute in separate serial processes, with the same Node old-space cap. The real adapter, ICD and decoder provenance are recorded. On this machine actual WGSL runs on Vulkan SwiftShader, not hardware GPU.
- Prefix mode is a fixed h count, not physical completion. The h128 diagnostic lies before a completed-h raw checkpoint; it compares its last frame to the original, but does not claim full cache validation. Full mode must reach the original h5683/rest/finished checkpoint with exact final game and score, complete raw manager, graph, solver roster, cache, proxy and BVH comparisons under the unchanged numerical gates.

## Measurement boundaries

The result records input/import startup, adapter startup, world construction, replay, extra finished-state checks, disposal and excluded validation as separate stages. First h and post-first-step h2 onward distributions are separate. The latter is labeled “steadyH2Onward” in JSON, but can include lazy pipeline construction and shape/contact changes; it is not guaranteed fully warmed steady-state shader throughput. Replay includes the runtime's own returned public snapshot work. It excludes oracle reading/decoding/assertions, injected rollback probes, extra `snapshot()` calls, finished idempotence checks, final state serialization and disposal.

The loop retains only its latest returned world output, not all past output snapshots. Two bounded Float64 timing arrays use at most 320,000 bytes in full mode. Memory is sampled at h0, h1, every h128 and the final h; no forced garbage collection occurs. Runtime-owned retained history remains part of the measurement. No assertion stage/stage-observer collection is installed in the measured world.

The final state is persisted as a V8 artifact, hashed, reloaded and validated independently after timing. All final-frame checks and final complete-raw-state helpers are copied unchanged from the existing full harness. A source-parity test verifies these blocks and tolerances remain unchanged. Full runs also check two subsequent finished calls and a snapshot for exact idempotence outside replay timing.

## Metric semantics

- `wallMs`: elapsed wall time for the named measured boundary. Replay includes observation overhead and minimal loop/sample overhead.
- `processCpuUserMs` and `processCpuSystemMs`: process CPU, including native code and SwiftShader worker threads. These are not isolated JavaScript CPU time. Multi-threaded process CPU may exceed wall time.
- `synchronousInvocationUntilPromiseReturn`: only the initial synchronous segment of calling `world.step()`, not all host work performed after awaits.
- `apiSynchronousWallMs`: synchronous duration of observed WebGPU API calls, including native call and instrumentation costs. It is not a pure JavaScript host CPU measurement.
- `mapAsyncOutstandingUnionMs`: host-observed union of outstanding mapping-promise intervals per phase. `mapAsyncWaitSumMs` also records their sum. Neither is a device timestamp or pure shader execution time. The residual replay wall must not be labeled isolated JS CPU.
- RSS, heap, external and array-buffer values: process samples at explicit h. `maxRssKiBProcessLifetime` is a cumulative process-lifetime high water mark, not an isolated replay peak. It must not be misrepresented as a GPU allocation measurement or a strict phase maximum.
- Buffer created/destroyed counts and bytes: actual successful GPUBuffer API calls, using requested logical descriptor sizes. Live and peak-live requested bytes are gauges. They do not measure driver allocation, deferred reclamation, physical VRAM or memory residency.
- Dispatch, submission, workgroup, copy/readback/map and data-transfer bytes: actual API observations. Construction, first h, steady steps, post-replay checks and disposal are distinct phases. Clear-buffer calls/bytes are counted too.

The observer invokes original methods with original receivers and arguments and returns original native handles and mapping promises. It does not replace shader output, readback data or numerical kernels. No per-allocation trace or strong-reference buffer registry is retained. Only persistent device/queue methods are retained for restoration; transient handle wrappers disappear with their native object.

## Reproduction

Run self-tests first:

```sh
node --test tests/webgpu-observation.test.cjs tests/live-registered-performance-support.test.cjs
```

The default runtime root is the harness repository. `BENCH_RUNTIME_ROOT` may select a different frozen checkout so exactly the same harness measures baseline and candidate. Supply the same original artifacts, engine bytes for provenance, decoder WASM/provenance, WebGPU module and ICD as the full correctness harness. Missing dependencies fail; no CPU substitute is installed for a missing adapter.

```sh
# Run each command separately and serially. Do not overlap GPU/native jobs.
BENCH_SOURCE=placed BENCH_BACKEND=cpu BENCH_SCOPE=prefix BENCH_MAX_H=128 \
  BENCH_LABEL=baseline-placed128-cpu node --max-old-space-size=384 \
  tests/live-registered-performance.mjs

REQUIRE_WEBGPU=1 BENCH_SOURCE=placed BENCH_BACKEND=gpu BENCH_SCOPE=prefix \
  BENCH_MAX_H=128 BENCH_LABEL=baseline-placed128-gpu \
  node --max-old-space-size=384 tests/live-registered-performance.mjs

BENCH_SOURCE=placed BENCH_BACKEND=cpu BENCH_SCOPE=full \
  BENCH_LABEL=baseline-placed-full-cpu node --max-old-space-size=384 \
  tests/live-registered-performance.mjs

REQUIRE_WEBGPU=1 BENCH_SOURCE=placed BENCH_BACKEND=gpu BENCH_SCOPE=full \
  BENCH_LABEL=baseline-placed-full-gpu node --max-old-space-size=384 \
  tests/live-registered-performance.mjs
```

Set `BENCH_RUNTIME_ROOT` to the candidate checkout and change labels for candidate commands. Set `BENCH_OUTPUT_DIR` for the JSON and state artifact directory; originals are never edited.

```sh
node tests/compare-live-performance.mjs baseline.json candidate.json \
  --require-allocation-reduction
```

Comparison rejects differing source, h, scope, initial capture, oracle, harness, adapter or tolerances. `--cross-backend` explicitly allows CPU/WebGPU comparison while still requiring the same original workload and exact final represented output; it cannot be combined with the allocation-regression gate. It separately checks the entire final public state exactly, normalizing only explicitly enumerated and value-checked backend diagnostic labels for cross-backend comparison, then reports timing and memory deltas. The allocation-regression flag requires fewer steady created buffers while preserving dispatch/readback/map counts and bytes, and zero remaining logical buffers after disposal. Timing ratios from one run are observations, not a statistically established speedup. A CPU-reference/WebGPU ratio is not a production Rapier CPU/GPU acceleration comparison. Performance acceptance still requires at least one identical complete case, not only the h128 prefix, and complete correctness/rollback/UI validation remains separately required.
