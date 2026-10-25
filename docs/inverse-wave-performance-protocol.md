# Original CPU / GPU inverse-wave benchmark (not yet executed)

This harness measures the **original Rapier `LabInverseEvents`**, not the
arithmetic `cpu-reference` interpreter. No runtime behavior is changed.
It reuses the genuine accepted early-opponent-foul source and requests from
`tests/inverse-gpu-wave-native.cjs`: cue (.6,0), opponent (.95,0), reds (-.4,.4)
and (-.6,-.3), angle 0, elevation 8, speeds 1.25 and 2, zero tip offsets.
It does not certify successful/full-rest search or hardware acceleration.

## Execution requires the coordinator's exclusive numerical slot

**Do not run until the coordinator explicitly grants that slot.**

```sh
REQUIRE_WEBGPU=1 BENCH_WARM_REPETITIONS=1 \
  node --max-old-space-size=384 tests/inverse-wave-benchmark.cjs \
  > /tmp/inverse-wave-performance.log 2>&1
```

Default decoder/native-module paths match the accepted native test. Override
`RAPIER_WASM_PROVENANCE`, `GPU_NATIVE_MODULE`, `VK_ICD_FILENAMES` when needed.
Default Vulkan ICD is SwiftShader; the actual adapter identity is saved.
`BENCH_OUTPUT` selects the final JSON (default
`artifacts/inverse-wave-performance.json`). Each validated raw repetition is
also emitted to stdout. No native fixture generator runs.

## Exact work budget, not a fabricated exact duration

`BENCH_WARM_REPETITIONS` is bounded 0..3, default 1. Let N = 1 + that value.
For each sequence: two original CPU inverse evaluations; two genuine candidate
preparations; two individual GPU evaluator calls; one two-candidate GPU wave.
Thus **2N original CPU evaluations, 2N preparations, 3N GPU calls evaluating
4N candidates**. The default is 4 original CPU evaluations, 4 preparations,
6 GPU calls / 8 GPU candidate evaluations. Original source settling occurs once.
Each GPU owner retains the existing bounded step limit; physical foul terminates
normally, never by an artificial shorter benchmark horizon.

The accepted test took 205.47 seconds for 3 GPU candidate evaluations (one
single + a pair), including evaluator construction and final assertions. This
new workload adds the second single. Its exact time is unknowable before running;
a rough **8–12 minute** default software-adapter slot budget is planning only,
not measured throughput. `BENCH_WARM_REPETITIONS=0` bounds the first diagnostic
to one sequence / 4 GPU candidate evaluations (roughly 4–6 minutes planning).
No process-level timeout kills active native work automatically.

## Honest timer boundaries

- Engine/module/decoder setup, original source creation/settling and device setup
  are recorded independently. Setup includes its necessary admission checks.
- Every preparation is separately timed, including genuine capture/import/admission.
- Original CPU time includes `begin`, all `advance` calls, `finish`, and `dispose`.
- Each GPU single and batch call is separately timed. **Owned-world construction,
  late pipelines, simulation, observation/scoring and internal cleanup remain
  included**; the public evaluator exposes no honest further decomposition.
- First single is cold on a fresh device. All subsequent calls share that device.
  Later sequences are **device/process warm**, not guaranteed pipeline-warm;
  candidates and owners are fresh. Fixed order is reported, not randomized away.
- Final parity/source/native-call/resource assertions run outside evaluator timers.
  Final device/source cleanup is timed separately. No every-h oracle assertions
  or rollback injections are inserted into measured loops.
- API counters are separated per call using the existing observer. Mapping waits
  are host roundtrips, not shader timestamps; synchronous API wall includes
  instrumentation. CPU usage includes software-GPU worker threads, not pure JS.

## Gates / provenance

The comparison helper copies the accepted native wave's numerical policy exactly:
complete object keys and nonnumeric fields; exact listed clock/step fields;
other finite numbers within 1e-6. No tolerance relaxation. Report the measured
maximum error, do not presume zero. Both singles and batch must be evaluated and
stopped on the original opponent foul; batch must prove multi-owner dispatch.
During all GPU evaluator calls, original native `World.step` throws and counts
attempts. The source bytes must remain unchanged. Each evaluator must return
with zero observed logical GPU buffers/bytes; uncaptured GPU errors fail the run.
Resource counts describe successful API operations, not physical VRAM reclamation.

Output retains original source/request hashes, decoder/engine hashes, runtime
and harness source manifest with end-of-run recheck, commit/dirty status, adapter,
raw runs, clocks/committed steps, process memory, timing and counters. The existing
independent every-h/full-state/rollback acceptance remains necessary; this small
benchmark does not replace it or claim UI/worker integration.

## Allowed nonnumerical review checks

```sh
node --check tests/inverse-wave-benchmark.cjs
node --test tests/inverse-wave-benchmark-support.test.cjs
```

At authoring, these pass (2 host tests); the benchmark itself has **not run**.
