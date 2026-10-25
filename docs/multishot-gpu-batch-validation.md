# Independent multi-shot GPU batching validation

## Acceptance boundary

The opt-in batch owner is not accepted merely because two `step()` promises run
concurrently. A passing world replay must independently observe actual native
WGSL dispatches and show scheduler receipts containing at least two distinct
world owner IDs in a single dispatch. Exact-plan identity includes input stride,
encoded instruction words and output indices. Unlike-plan requests remain
separate. No numerical tolerance is widened and no CPU-shot fallback is allowed.

The adapter used for this work is official Dawn WebGPU on Vulkan SwiftShader,
vendor `google`, architecture `swiftshader`, driver `5.0.0`, fallback adapter true.
It executes the actual shader but is a software GPU. These tests do not establish
hardware acceleration, browser/device coverage, production selection, or an
interactive throughput improvement. Host orchestration and nonshared kernels
remain; this is not whole-world GPU residency.

## Independent tests

- `tests/experimental-multishot-plan-batch.cjs` submits distinct inputs through
  two independently owned device facades and inspects one actual native dispatch
  containing both rows. Results must match separate sequential native GPU bits
  and CPU arithmetic. It separately checks instruction/output/stride/signed-zero
  plan identity, queue/row/byte/handle/plan budgets, transient growth budget,
  input and result mutation isolation, cancellation, owner cancellation, device
  loss, and isolation of an invalid arithmetic lane through bounded GPU retries.
  Host doubles are labeled ownership tests, never native numerical evidence.
- `tests/webgpu-batch-observation.cjs` records actual native shader stride,
  encoded-plan/output hashes, logical binding sizes, submitted input hashes,
  invocation row counts, dispatches and queue submissions. It preserves original
  native objects, receivers and return promises. An omitted WebGPU binding size
  means the actual buffer size minus offset; it is not assumed to be row capacity.
- `tests/live-registered-multishot-batch.mjs` imports distinct raw live captures
  and runs their worlds together. Every committed h is compared with its own
  continuously generated original controller frame. Every completed-h raw
  checkpoint uses the unchanged existing graph, manager, solver roster, cache,
  proxy and BVH gates. The mid-h cue-removal checkpoint is not mislabeled post-h.
  The test-only support exports are additive; original comparator bodies and
  tolerances are unchanged and their source-equivalence regression still passes.
- The world suite separately injects failure after the real final scene
  preflight for one source, checks its public/private-scene rollback, and checks
  that its sibling commits. Cancellation and actual device loss must expose only
  complete committed-h states, never partially published results.

Candidate worlds receive only their imported initial seeds. Original trajectory
frames, checkpoints and final outcomes stay on the assertion side. Expected raw
checkpoints are decoded when needed and discarded, not retained as decoded
history. The original native engine is not initialized or stepped.

## Source identities

The primary pair is `placed` and `awake`, not two copies of one fixture. Their
original full-rest extents are respectively h5683 and h5848. Original final
scores are `{cueId:1, delta:0, nextCue:2}` and
`{cueId:1, delta:-1, nextCue:2}`. The second case therefore exercises the recorded
opponent-contact foul, rather than certifying only zero-score shots.

| Source | Raw capture SHA-256 | Continuous original reference SHA-256 |
| --- | --- | --- |
| placed | `4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403` | `2f81d4855d850bba3d807f79df246ffbc43a84dfa8fd3ebd1333bd14a3ab5a50` |
| awake | `789955f1ecdd79cb4b39af2c8ab5ba578d6b7e3b49d9882845cb9a57ea57d0d6` | `699ede31cb19809b0487f3f85d3665e465f3721cc7cf12c316cbb2d48d7fd53c` |

The existing independently validated full sequential native GPU `placed` state
is additionally pinned to SHA-256
`68754636081675b3c8c75217df5205123238e41bce5593750bc69321d4c85275`.
The batch's entire final public state must equal that state exactly. Short
same-run sequential CPU-reference and native GPU comparisons cover both sources
after only explicitly enumerated backend diagnostic labels are normalized.

## Ownership contract and limits

Each world commits its own h atomically. There is no cross-world atomic commit:
one world can finish a step while a sibling rejects and retains its previous h.
Terminal complete, failed, unsupported, cancelled and step-limit states are not
advanced again. Incomplete/limited states must never be relabeled full shots or
given fabricated final scores. World count, queued requests/rows/bytes, resident
bytes, plan/handle counts, dispatch rows and per-shot h are explicitly bounded.

Input ownership preserves only already-authenticated deeply immutable native
hull capabilities; mutable seed rows, arrays and source fields are copied before
the constructor yields. Re-exporting or JSON-rebranding a hull is not permitted.
Completed outputs are detached from other slots and future snapshots.

## Reproduction

Provide the pinned evidence and manifests, matching original engine bytes and
the read-only decoder build/provenance described in
`live-registered-world-replay-validation.md`. Run heavy native tests serially.

```sh
GPU_NATIVE_MODULE=/path/to/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 node --test tests/experimental-multishot-plan-batch.cjs

GPU_NATIVE_MODULE=/path/to/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 BATCH_REPLAY_ONLY=1 BATCH_SCOPE=full \
node --max-old-space-size=512 --test --test-reporter=tap \
  tests/live-registered-multishot-batch.mjs
```

`BATCH_MAX_H` without full scope produces only a prefix. `BATCH_SOURCES` selects
two or three distinct pinned sources. `BATCH_RUNTIME_ROOT` points the harness to
an independently frozen candidate worktree. `BATCH_LIFECYCLE_ONLY=1` selects the
short rollback/cancellation/device-loss checks. The full harness emits source
hashes, owner/dispatch receipts, original comparison counts and state artifacts.

## Validation record (2026-10-25 resumed run)

The frozen runtime at `2ed077e` passed full independent native WGSL batch replay
for `placed` through h5683 and `awake` through h5848. Every original h and all
43/46 applicable raw checkpoints passed unchanged original gates, including
exact discrete/contact/manager/BVH/cache state and original score/foul results.
The maximum recorded absolute numeric deviations from original were
`1.2648604053033807e-8` and `2.9890120378794904e-9` respectively. The observer
corroborated 10,325 multi-owner dispatches; the scheduler made 71,431 dispatches.
Completed worlds remained idempotent while their sibling advanced.

Fresh independent full CPU-reference and sequential native GPU replays of both
sources also passed every h and every applicable original checkpoint. Both
entire final sequential GPU public states equal their batch states exactly.
Both final CPU-reference states equal batch after only the explicitly enumerated
backend diagnostics are normalized. This is not a claim of bitwise CPU/GPU
trajectory equality: the same-run awake h8 comparison reports a maximum numeric
difference of `4.70197740328915e-38`. No numerical field was removed or rounded,
and original acceptance tolerances were not widened.

The added `tests/live-registered-multishot-sequential-full.mjs` runs one source
and backend per process. Its source-contract suite checks unchanged comparator
use and byte-identical diagnostic/difference-report helpers. Reproduce with:

```sh
SEQ_SOURCE=placed SEQ_BACKEND=cpu node --max-old-space-size=512 \
  tests/live-registered-multishot-sequential-full.mjs
GPU_NATIVE_MODULE=/path/to/webgpu/index.js REQUIRE_WEBGPU=1 \
SEQ_SOURCE=awake SEQ_BACKEND=gpu node --max-old-space-size=384 \
  tests/live-registered-multishot-sequential-full.mjs
```

Repeat each source/backend combination serially. The full batch artifact must
be present for the additional final batch comparison; its source hashes and
artifact digests are verified before use.

Native independent-owner final-preflight rollback, cancellation and actual
device loss passed; tracked GPU buffers were released. Native arithmetic,
frontier scheduler and device-global error-scope regression passed 26/26 with
zero skips. Host/comparator contracts passed 10/10. Product regression passed
308/308 using serial resource-controlled execution; build, typecheck and
official UI provenance passed.

Full real-app browser verification remains blocked before browser launch by
the execution sandbox's Unix-socket denial. No Chromium security was disabled.
The available separate cloud browser could not reach the execution-local server.
Thus narrow-screen/settings/interaction/font behavior remains unverified here.

Evidence is retained in `artifacts/resumed-multishot/` (including
`acceptance-summary.json`, `full-proof.json`, native logs and final states),
`artifacts/resumed-multishot-sequential/` (four fresh full proofs/states), and
`artifacts/resumed-regression/`. Earlier SIGKILL, constrained-heap OOM, and
missing-environment test attempts are retained alongside successful reruns.
These were not accepted as physics passes; no failed comparison was relaxed.

This acceptance covers two distinct pinned four-ball live-source inputs, not
all arbitrary settings/shots, three-ball trajectories, every API batch size,
or browser/hardware coverage. The frozen product build still uses Rapier and
does not call the experimental batch API. Gameplay/search/worker routing and
search-specific observation/acceptance integration are separate work. There is
no whole-world device residency or hardware-speed claim, and nothing was
uploaded, pushed, deployed or published.
