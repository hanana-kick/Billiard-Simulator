# Live registered replay performance results

Measured 2026-10-25. Protocol and reproduction: [live-registered-replay-performance.md](live-registered-replay-performance.md).

## Accepted scope and unchanged output

- One fixed original `placed` capture, separate serial processes, Node v24.22.1, `--max-old-space-size=384`, official WebGPU 0.6.2, actual Vulkan SwiftShader driver 5.0.0. This is software GPU execution, not a hardware acceleration result.
- The CPU measured here is the parity-port `World.createReferenceStepper`, not the production Rapier controller. Native/original oracle generation is not timed and is never run inside the candidate process.
- Baseline and candidate CPU-reference/WebGPU full runs all reach h5683, 5053 outer calls, all balls asleep, no awake island, and final score `{cueId: 1, delta: 0, nextCue: 2}`.
- Both final original raw checkpoints pass under unchanged numerical gates, including complete represented graph, manager, solver roster, caches, proxies and BVH. Final comparison maximum error is `1.2648604053033807e-8`; cue-inertia error is zero.
- Baseline/candidate final state files are byte-for-byte identical separately for each backend. Direct CPU-reference/WebGPU comparisons also pass for the entire public snapshot after only specifically enumerated backend diagnostic labels are normalized. Backend labels explain the distinct CPU/GPU serialized hashes.
- The full replay-only measurements do not replace the separate every-h, all-checkpoint and rollback correctness gate. They do not establish browser UI correctness, arbitrary-source support, production backend selection or deployment readiness.

## Full measured replay

Timing excludes independent oracle loading/assertions, rollback probes, final serialization, disposal and extra finished-step checks. Replay includes the runtime’s returned public snapshots and minimal measurement overhead.

| Path | Constructor s | Replay wall s | Process CPU s | H2+ median ms | Replay-end RSS MiB | Replay-end heapUsed MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline CPU-reference | 0.078 | 276.536 | 314.390 | 41.657 | 477.949 | 207.580 |
| candidate CPU-reference | 0.072 | 259.021 | 295.994 | 38.076 | 410.410 | 137.327 |
| baseline SwiftShader | 3.691 | 281.840 | 414.788 | 44.112 | 626.602 | 210.578 |
| candidate SwiftShader | 3.443 | 263.237 | 396.375 | 41.193 | 560.547 | 126.865 |

Each cell is one observed run, in baseline-then-candidate order, not repeated statistical evidence. Cache, JIT, GC and machine variance are not controlled away. H2+ includes late lazy pipeline construction, not guaranteed fully warmed steady-state throughput. Process CPU includes native code and software-GPU worker threads. HeapUsed is a sample without forced GC, not an attribution or proven live-heap bound.

- CPU-reference full replay wall observed change: 6.33% lower. This is not a production Rapier CPU/GPU speedup claim.
- SwiftShader full replay wall observed change: 6.60% lower. This is not a production Rapier CPU/GPU speedup claim.

## Actual full WebGPU resource counters

Full H2+ buffer creations fall 27.81%, but requested created bytes fall only 4.61%. Retained logical bytes increase by 79,900 bytes. These are distinct metrics, not a 27.81% memory reduction.

Counts/bytes are observed successful API operations, not inferred from source. H2+ resource gates require fewer created buffers with identical dispatch, map and readback counts/bytes. Buffer sizes are requested logical GPUBuffer sizes, not driver allocation or physical VRAM.

| Metric | Baseline | Candidate |
| --- | ---: | ---: |
| Constructor buffers created | 570 | 570 |
| Constructor bytes created | 4,285,020 | 4,285,020 |
| Constructor buffers explicitly destroyed | 0 | 0 |
| Constructor bytes explicitly destroyed | 0 | 0 |
| Constructor bind groups | 64 | 64 |
| Constructor dispatches | 0 | 0 |
| Constructor readbacks | 0 | 0 |
| Constructor readback bytes | 0 | 0 |
| Constructor read mappings | 0 | 0 |
| Constructor mapped bytes | 0 | 0 |
| Constructor clearBuffer calls | 0 | 0 |
| First h buffers created | 416 | 104 |
| First h bytes created | 1,663,556 | 1,621,604 |
| First h buffers explicitly destroyed | 412 | 68 |
| First h bytes explicitly destroyed | 1,660,192 | 1,567,528 |
| First h bind groups | 103 | 31 |
| First h dispatches | 103 | 103 |
| First h readbacks | 103 | 103 |
| First h readback bytes | 12,028 | 12,028 |
| First h read mappings | 103 | 103 |
| First h mapped bytes | 12,028 | 12,028 |
| First h clearBuffer calls | 0 | 86 |
| H2+ buffers created | 405,753 | 292,897 |
| H2+ bytes created | 1,480,915,476 | 1,412,618,932 |
| H2+ buffers explicitly destroyed | 405,735 | 292,867 |
| H2+ bytes explicitly destroyed | 1,479,212,568 | 1,410,886,836 |
| H2+ bind groups | 101,596 | 73,405 |
| H2+ dispatches | 116,641 | 116,641 |
| H2+ readbacks | 101,419 | 101,419 |
| H2+ readback bytes | 23,464,268 | 23,464,268 |
| H2+ read mappings | 101,419 | 101,419 |
| H2+ mapped bytes | 23,464,268 | 23,464,268 |
| H2+ clearBuffer calls | 0 | 28,220 |
| Replay-end retained buffers | 592 | 636 |
| Replay-end retained logical bytes | 5,991,292 | 6,071,192 |
| Peak live buffer count | 597 | 641 |
| Peak live logical bytes | 6,072,480 | 6,152,380 |
| After world dispose retained buffers | 0 | 0 |
| After world dispose retained logical bytes | 0 | 0 |

Resident scratch here is buffer reuse only: dispatch/readback synchronization is unchanged, not GPU-resident whole-world state or parallel multi-shot batching. The change trades less allocation churn for more retained logical capacity. The table distinguishes that capacity from process RSS; it does not attribute the RSS difference exclusively to GPU buffers or promise leak-free indefinite execution.

## Host-facing wait and initialization observations

| Full SwiftShader metric | Baseline | Candidate |
| --- | ---: | ---: |
| Mapping outstanding union s | 47.278 | 45.488 |
| Observed WebGPU API synchronous wall s | 16.524 | 14.276 |
| Late H2+ pipelines created | 13 | 13 |
| Maximum h wall ms | 5,173.929 | 4,582.098 |
| Excluded final original validation s | 0.293 | 0.261 |

Mapping intervals are host-observed roundtrip waits, not GPU timestamps or pure shader time. The complement is not isolated JavaScript CPU either: it includes host work, native calls, scheduling and any other awaits. Initial synchronous invocation-to-promise-return distributions are available separately in JSON.

## Bounded h128 diagnostic

| Path | Baseline replay s | Candidate replay s |
| --- | ---: | ---: |
| CPU-reference | 13.568 | 13.411 |
| SwiftShader | 9.495 | 9.031 |

All four prefix outputs match the original h128 frame with zero measured numerical error. There is no original full raw checkpoint exactly at h128, so prefix cache/full-rest claims are explicitly excluded. The full result above is the acceptance evidence, not an extrapolation from this early cue-present prefix.

## Source and artifact provenance

- Baseline runtime commit: `b68246c3be79e3ea52e574ddfa55983af5076787`.
- Candidate runtime changes: `da415137d3103aefb65984a239134032f73f01ca`; later candidate commits add tests/docs only.
- Baseline 85-file runtime root SHA-256: `e8c5245c003aa6fed9656ef388aa6431bf45f3e713ecb1968153847c374f3538`.
- Candidate 85-file runtime root SHA-256: `509301b48032d4ddc9ad0f344ef6e196151ba932eab8746e7baf0ba11692f193`.
- Shared measured three-file harness root SHA-256: `2013aac08d715a8af9fb60652542464d269311b351c4be52fa43c567a4ecaf99`.
- Original capture SHA-256: `4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403`.
- Original continuous reference SHA-256: `2f81d4855d850bba3d807f79df246ffbc43a84dfa8fd3ebd1333bd14a3ab5a50`.
- Initial snapshot SHA-256: `d1f072a0f70c78a1918368c90a9f3b1d0e85e5dacbd08184675fe4b575dabc86`.
- Read-only decoder WASM SHA-256: `1647149118688a7152bc385e0c06ce985eda36e97a3a7e16a8f86fa8506eeabd`.

Each JSON includes exact source maps, memory samples, full counter phases, startup/validation boundaries, adapter identity, proof hashes and final artifact hash. Artifacts live in `artifacts/live-performance/` in the measurement checkout and are not production assets.

| Artifact | SHA-256 |
| --- | --- |
| `baseline-placed128-cpu.json` | `68424d9e94b8bbd178846e727fb15d23f42c7ccb5a31f6d282a3d06ac22b7c73` |
| `baseline-placed128-gpu.json` | `3698923882c8162f80a20f797fc9e50742289c33365f070c5c6b9dd272010571` |
| `baseline-placed-full-cpu.json` | `5a10c512e3c9c05b177097c599b6697ac9d60575a2b2e00ea73dfc851692da42` |
| `baseline-placed-full-gpu.json` | `7436c0912bd671f9b67711aac284369b57b0fb44576775f1fbc29e09696bd8d4` |
| `candidate-placed128-cpu.json` | `d36cd47c2f26b57cbdcaa0589e9b73d8b81f3bf9db0033f67087cf241567fbfa` |
| `candidate-placed128-gpu.json` | `16e36d50a68ba9af7eab7cce209d9fe8f599623e0554af7dbb65af1dee1a6f0b` |
| `candidate-placed-full-cpu.json` | `245747491e0d4e767e4a6916f805bfb843ef538cd88729da8a01077b4b6e0cd6` |
| `candidate-placed-full-gpu.json` | `3b886567ed1a8cd8f356f060ee5b1371ef4609e383aa4664303f8f0df0c2d0ec` |
| Baseline and candidate full `cpu` `.state.v8` | `6795679cfbe88483be089f0472c22060b71ce8a131c416a9e2a719271c9f6581` |
| Baseline and candidate full `gpu` `.state.v8` | `68754636081675b3c8c75217df5205123238e41bce5593750bc69321d4c85275` |

Four measurement self-tests pass, including original assertion-block/tolerance parity, native-handle/promise forwarding, pending-map boundaries and rejected-map/clear-range behavior. Negative gates reject unchanged allocation counters and an altered final public clock. Cross-version and cross-backend comparisons are saved as separate JSON artifacts.

## Integrated correctness and regression acceptance

The integrated runtime changes were frozen at `da415137d3103aefb65984a239134032f73f01ca`; subsequent commits add only the measurement harness, its comparisons, and reports. The production `physics.js`, `controller.js`, and `game-rules.js` remain unchanged from the live-evaluation baseline.

After the measured comparisons, the integrated candidate passed the independent every-h `live-registered-world-replay.mjs` gate for the complete placed source on both CPU-reference and actual SwiftShader. Each backend reached 5,683 h / 5,053 outer calls, 43 full raw-state checkpoints and 45 injected atomic rollbacks. Maximum absolute error remained `1.2648604053033807e-8`, cue-inertia error remained zero, and final CPU/GPU state, score, next cue and finished idempotence matched. This correctness command passed 3 tests with zero skips; its approximately 583-second duration includes assertions and rollback work and is not substituted for the replay-only timings above.

The genuine original fourth-body creation/cloth-birth first-h owner gate also passed on CPU-reference and actual WGSL: 2 tests, zero skips, maximum absolute error zero. It covers the real initial-birth bookkeeping boundary independently of the synthetic journal test.

Final aggregate checks passed:

- Existing product regression command: 308 passed, zero failures or skips.
- Combined journal, bounded evaluation/lifecycle/resource/transport, importer-gravity, and benchmark observer/assertion tests: 103 passed, zero failures or skips.
- Application build, TypeScript check and all 24 official styled UI component provenance checks.
- Separately recorded native resident-stage differential, BVH recurrence and synthetic cue-cloth component gates remain scoped as documented in `gpu-resident-arithmetic-scratch.md`; the unavailable original cue-cloth fixture tests are not represented as passes.

No actual browser UI/WebGPU or hardware/mobile performance acceptance is added by this phase. Production backend selection is unchanged. General 3-ball live import, unsupported owner transitions, persistent whole-world GPU residency and parallel independent-shot batching remain separate work; the implemented optimization does not imply them.
