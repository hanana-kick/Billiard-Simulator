# Opt-in resident arithmetic pipeline reuse prototype

## Scope

`createResidentGraph(device, plan, { reusePipelines: true })` enables a module-private cache. Default calls still compile independently; production and world callers are unchanged. This is not enabled in plan-batch scheduler facades: explicit opt-in there rejects, rather than unwrapping or aliasing their underlying device.

The key is the **exact passed device object identity**, full generated WGSL string, module label, `layout: 'auto'`, and `entryPoint: 'main'`. Distinct wrappers/proxies remain distinct. Labels are included conservatively to preserve shader-module descriptor diagnostics. Therefore different labels intentionally miss even if WGSL matches. Program instructions, output indices, maximum rows and owner identity are not shader configuration: they remain private runtime buffer data.

Each device has at most 16 cached entries, LRU-evicted, counting pending entries. Concurrent same-key callers share a compilation promise. Eviction only drops the cache reference: an active stage or waiter keeps its pipeline; no work is cancelled. A separate counter admits at most 16 simultaneous opt-in compilations per exact device, including evicted pending entries. A new cache miss at that bound rejects with a compilation-limit RangeError before shader creation; a cache hit can still join. Retry after settlement is explicit. Default uncached callers are unchanged and are not subject to this opt-in admission limit. Active stages can retain more than 16 completed pipelines outside the cache: this is not a total GPU resource bound. Device keys are weak; live stages remain responsible for their own resources.

Compilation failures evict only their exact promise, so a late failure from an evicted entry cannot remove a newer replacement. Device loss clears the cache and rejects pending/future stage construction using the existing loss observer. Shader modules/pipelines have no explicit destruction operation; cache eviction releases references, not necessarily immediate driver memory. Each failed compilation waiter receives an independent Error wrapper (with the underlying failure as cause), isolating owner-local cleanup annotations. Valid compilation survives an individual stage's subsequent buffer-init failure.

Only immutable pipeline compilation is shared. Program/index/input/scratch/output/readback buffers, bind groups, error scopes, cancellation signals, mutable lifecycle state, dispatches, readbacks and synchronization remain owned by their existing stage. No arithmetic/WGSL, tolerances, CPU path, source interpretation, scoring, or original parity assertions change.

## Host characterization performed

```
node --test --test-name-pattern='^(?!actual WGSL)' tests/experimental-resident-stage-runtime.cjs
node --check src/experimental-stage-runtime.js
git diff --check
```

21 host tests pass; the native WGSL test is intentionally excluded/skipped. Ten added cache tests cover explicit opt-in/default independence, descriptor and exact proxy identity separation, distinct owner buffers/groups, pending deduplication, shader/pipeline failure retry, owner-local validation failure, bounded pending LRU and independent in-flight admission even after pending eviction, stale rejection, loss during compilation/pipeline creation, cancellation isolation and scheduler-facade rejection. Host doubles do not establish numerical parity, GPU behavior, performance, physical VRAM, original CPU equivalence or browser acceptance.

## Intended serialized measurement (not run)

1. Freeze this commit and baseline parent, runtime source hashes, native WebGPU version, adapter/driver identity, exact inputs and the stage-construction sequence. Do not use older full replay pipeline counts as this prototype's baseline.
2. First run original CPU/GPU correctness gates under unchanged tolerances, including every-h/checkpoint and rollback checks for any later world-level integration. Also compare resident arithmetic with opt-in disabled/enabled against the transient GPU path and CPU arithmetic, bitwise for the same GPU outputs, including construction overlap, growth/reuse, cancellation and loss behavior. Run serially under parent control.
3. For an initial bounded microbenchmark, use identical nonempty plans, labels and packed inputs. Compare default versus explicit opt-in on a fresh real device for each trial. Measure first construction and 32 subsequent sequential same-descriptor graph constructions separately; dispose each graph after its identical run. Include a separate retained-two-stage/concurrent-construction case. Count successful shader modules/pipelines separately from buffers, bind groups, submissions, dispatches, maps/readbacks, bytes and explicit buffer destruction. The candidate should avoid repeated compilation without changing the latter operations or results; measure, do not infer, wall time and process CPU. Report retained cache behavior independently of stage buffer disposal.
4. Alternate baseline/candidate trial order over repeated fresh-process/device trials with fixed input; report distributions, cold versus warm phases, adapter type and all correctness outcomes. Software SwiftShader is not hardware GPU acceleration. Cache eviction at >16 distinct descriptors and wrapper identity separation are separate characterization cases, not the warm-hit timing workload.
5. Only after authorized world caller opt-in plumbing exists, rerun the same fixed original capture end-to-end with the same source and stopping condition on CPU-reference and actual GPU. Partition constructor/first-h/later-h pipeline creation and timing, retain dispatch/readback and full-output equality gates. Existing 59 constructor + 2 first-h + 13 later-h counts are historical observations, not promised removable counts: this cache also keys labels and exact passed device identity.

No numerical/GPU benchmark, full application build/browser suite, deployment, upload or push was performed. There is no measured speedup claim and no production Rapier CPU/GPU speedup baseline from this work. Reuse reduces a possible repeated construction cost; it is not whole-world GPU residency or arithmetic batching.

## Prepared explicit native component gate (not executed)

`tests/experimental-stage-pipeline-cache-native.cjs` is separately gated by `REQUIRE_STAGE_PIPELINE_CACHE_NATIVE=1`; merely setting the normal native module variable cannot run it. It imports the actual native module only inside that gate. Proposed serialized command, only after the parent grants the GPU slot:

```
REQUIRE_STAGE_PIPELINE_CACHE_NATIVE=1 GPU_NATIVE_MODULE=/absolute/path/to/webgpu/index.js \
  node --max-old-space-size=384 --test --test-concurrency=1 tests/experimental-stage-pipeline-cache-native.cjs
```

The test creates four independent resident stages on one exact observed device identity: two simultaneous cached and two uncached. It requires exactly three successful native shader-module/pipeline creations, while retaining original native buffers/groups/queue operations. Identical valid inputs at 1/4/2 rows must match the existing `Graph.execute` CPU component exactly and cached/uncached GPU bits exactly. It checks distinct native buffer handles and bind-group resources, disjoint returned arrays, growth/reuse, concurrent sibling cancellation, per-row division-by-zero failure, recovery, dispose-one/run-other behavior, balanced nonoverlapping error scopes, no uncaptured GPU errors, and zero stage-owned buffers after disposal. It is not batch-scheduler or original-world parity coverage.

Scheduling estimate, not measured: 10–30 seconds including startup/three interpreter pipelines, with a 60-second test timeout; only 19 tiny dispatches and at most four rows. Requested logical buffer allocation is under 4 KiB for this fixed sequence. Native pipeline compiler/driver process memory dominates and is not bounded by that buffer count or the 384 MiB JS heap ceiling; allow roughly 512 MiB process RSS as a provisional scheduling estimate, not a measured ceiling. The diagnostic records actual process memory and successful API counts. No native execution or numerical acceptance has yet been performed; syntax validation and the default skip-only invocation passed.

## Native component acceptance result — 2026-10-25

After the parent granted the exclusive GPU slot, the exact `d03077bcdd96e801dca68299cff9dc17a05d07d4` test passed: **1 test, zero failures/skips**. Slot released immediately afterward; no world replay or further GPU work was run.

Environment: Node v24.22.1, official native WebGPU 0.6.2 at `/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js`, Vulkan backend, `VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json`, JS heap ceiling 384 MiB. This selects the supplied software SwiftShader ICD, not hardware acceleration. The diagnostic's JSON serialization of `adapter.info` omitted non-enumerable identity fields, so this artifact does not independently record the adapter/driver identity string.

- Two simultaneous cached + two uncached stages created exactly **3 actual shader modules and 3 successful pipelines**.
- All identical valid inputs passed CPU component equality and cached/uncached GPU bit equality; native-buffer/group privacy, cancellation/error isolation, recovery and sibling-after-disposal checks passed.
- 19 dispatches, 48 created stage buffers, 16 groups; each stage's buffer-created count equaled buffer-destroyed count, with zero live stage buffers afterward. Scope depth returned to zero, maximum depth one; no uncaptured GPU errors.
- Python monotonic subprocess wall: **0.318711 s**; node-reported test duration: 96.794 ms (suite duration 262.852 ms). These are acceptance-run durations, **not cache speedup measurements**.
- `getrusage(RUSAGE_CHILDREN)` maximum RSS: **95,608 KiB (93.37 MiB)**; sampled pre-release process RSS: 97,632,256 bytes. User/system CPU: 0.332787/0.075046 s. Native/device memory is not isolated by these numbers.
- Local log: `artifacts/pipeline-cache/native-acceptance.log` (ignored artifact, not uploaded), SHA-256 `70797ddf6b660c6243831deb4f4d7ca491c34be87e557d9c4383de025ff705e5`.
- ICD JSON SHA-256: `c9eef28b6b984fec220ef0abfecc40b502d46946706e47bfe97707027cb818bd`; referenced SwiftShader library SHA-256: `12be11b09ef306e6cea4be63fa9b8a3202b2daaa47d0809111117dbf9601026e`.

The preliminary timing wrapper `/usr/bin/time` was unavailable and failed before launching Node; the subsequent Python timing wrapper executed the sole GPU run successfully. This acceptance does not establish original-world parity, batch-facade coverage, browser acceptance, physical VRAM limits or speedup.
