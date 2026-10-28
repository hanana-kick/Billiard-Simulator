# N32/N33 flat CPU reference and bounded N33 diagnostic

The original CPU preparation is documented below. The independently reviewed
N33 diagnostic profile subsequently passed one bounded native run; see the final
section. Default runtime widths remain N1/N3. No production or hardware-throughput
qualification follows from this diagnostic.

## Genuine input and observed scope

The fixture uses the original `mmq2RawFixture` with the cue at x=0 and the
unchanged four-ball roster/static table. It varies 33 admitted raw settings:
angle -1.6 through +1.6 degrees, speed 0.500 through 0.510, and elevation
25 / 25.25 / 25.5 degrees. Tips are centered. Raw speed below 0.5 was rejected
by the declared initializer domain and is **not** used to make cheap invalid lanes.

IDs include ordinary 100, high unsigned IDs, and `0xfffffffe` / `0xffffffff`
at lanes 31 / 32. N32 is exactly the first 32 candidates of N33.
All results are calculated by `runCanonicalRawWorldContinuationCPU`, not stored
successful trajectories or hand-selected outcomes in production code.

Observed N33 CPU run: all 33 admitted, original raw READY, genuine model nominal
REST, complete continuation and compact MISS. It took 1.377 s with the explicit 1,700-step raw cap
(the earlier 2,048-step generation took 1.361 s) (not a GPU timing prediction). Each shot executed
1,627–1,664 raw steps and 15–20 continuation history entries. Observed body modes
were 0/1/3 and the journal contained REST events only. There were **no** cushion
or ball-ball collisions. Qy-stop, collision/foul/goal coverage, cancellation and
wider GPU execution are not qualified by this fixture. This deliberately narrow
free-cloth case is a low-cost first index/width gate, not broad physics coverage.

## Flat reference contract

```
node scripts/prepare-live-world-wide-reference.mjs /tmp/live-world-wide-reference-n33 33 1700
node scripts/prepare-live-world-wide-reference.mjs /tmp/live-world-wide-reference-n32 32 1700
```

The generator runs CPU physics before the native quiet window, then retains only
flat little-endian u32 words and reconstruction/provenance metadata—no per-shot
continuation/history object graphs. Metadata contains the exact canonical request,
raw/world binding options, candidate IDs/settings, observed scalar coverage, and
74 current physics-source hashes. These are provenance checks against the reviewed
bundle inputs, not a substitute for the independently generated CPU words.

| Per-candidate segment | Word offset | Length |
|---|---:|---:|
| State/dense/first-pair entry+response | 0 | 768 |
| Journal | 768 | 1,056 |
| Journal auxiliaries | 1,824 | 1,024 |
| Raw handoff status | 2,848 | 16 |
| Rule state | 2,864 | 48 |
| Compact result | 2,912 | 4 |

Stride: 2,916 words. N33: 96,228 words / 384,912 bytes. N32: 93,312 words /
373,248 bytes. The generated N32 bytes exactly match the N33 first-32 prefix.
N33 expected binary SHA-256:
`a3528abd500a019d7196d71848d3dfec67a79342ac2af188d3e330d316da36ca`.

The future native harness must reconstruct owned raw/world bindings with the
verified bundle's exports, decode these words without importing/running CPU
physics, verify the binary digest and physics-source provenance, and perform one
explicit full diagnostic comparison initially. Existing 240 s / 1,500 MiB limits
remain unchanged. CPU cost/early REST does not guarantee GPU completion within
those limits; timeout/RSS termination remains incomplete evidence, not PASS.

Validation: `node --test tests/live-world-wide-reference.mjs` passed 2/2;
separate N32 generation matched the N33 binary prefix exactly. No native test
was run for this task.

## Rejected faster-approach probes

CPU-only probes at central x=0, angle=0, centered tip were retained as negative
selection evidence, not relabelled as successful REST:

| Speed / elevation | Raw steps | World result |
|---|---:|---|
| 0.6 / 25 | 1,398 | pending reason 77, 128 history entries |
| 0.75 / 25 | 1,139 | pending reason 77, 128 history entries |
| 1.0 / 25 | 877 | pending reason 77, 128 history entries |
| 0.75 / 45 | 1,157 | pending reason 77, 128 history entries |
| 1.0 / 60, 75, 85 | 914, 931, 938 | pending reason 42, one history entry |
| 0.6 / 45, 40 | 1,416, 1,411 | pending reason 77, 128 history entries |

All these probes were input-admitted and raw READY, but none reached nominal
REST. They were not substituted for the genuine complete fixture merely to
shorten raw approach time. The proposed fixture now explicitly uses maximumSteps=1700 with the original
staged backend. All 33 CPU references were regenerated and still reached raw
READY and nominal REST. All 96,228 N33 words (and all 93,312 N32 words) were
identical to the preserved 2048-cap references; the binary SHA-256 values did not
change. Maximum observed raw steps were 1664, leaving 36 steps of margin for
this exact fixture only. This is not universal input coverage. The runtime
default remains 2048; no model/backend or production default changed. Original
2048 artifacts are retained as `/tmp/live-world-wide-reference-n33-steps2048`
and the corresponding N32 prefix. The generator accepts either explicit cap
for reproducibility, and the focused test compares every N33 word across both.


## Reviewed N33 native diagnostic (2026-10-28)

The explicit `mmq2-n33-diagnostic-v1` profile admits only 33 owned, input-admitted
four-ball candidates, sealed uploads, MMQ2 cushion world, staged raw backend,
atomic-per-access faults, largest-first compilation, and a 1,700-step raw cap.
It allows the original candidates in one **full diagnostic submission** only.
Compact-only calls, replacement/permutation calls, and a second submission are
rejected. The default profile still accepts only N1/N3; default raw cap remains
2,048. This is a narrow test profile, not a new application default.

Independent source review accepted the exact 84-module closure. Relative to the
prior 82-module pin, it adds the two resource-planning modules and changes only
batch orchestration and nonexecuting capture; all 74 CPU physics dependencies
match the previously generated flat reference. The oracle verifier checks exact
transitive membership, source hashes, binary hash, identities, READY/REST states,
raw-step bounds, zero terminal velocity/spin, and REST-only journal semantics in
a separate process **before GPU creation**. No CPU physics runs in that process
or the native test. Negative verifier tests also recompute the binary hash after
semantic corruption, so a fresh hash cannot legitimize a changed terminal row.

- Source revision: `c89eab3ec60f014e0097eba668c1b52cc6c7eae7f5e49f988acdfbc1b7153d3c`.
- Self-contained artifact: 933,915 bytes; SHA-256
  `1e3dfb0b8194c7bf7645b4cad88de9dd9a981a797ea70e9087fc8f7b5c1d50e8`.
- Recipe SHA-256 (unchanged):
  `f1ed12398e220b33ded2f1a4b2c96a9cc4afc88737b615b00dbacceb356a1300`.
- Exact comparison: **96,228 / 96,228 words**, all 33 original raw READY and
  nominal REST; lane 31/32 IDs `0xfffffffe` / `0xffffffff` included.
- Actual device/resource preflight: passed; requested 10 storage bindings;
  owned-buffer plan **7,749,780 bytes** within the unchanged 8 MiB policy.
- Full diagnostic readback: **384,912 bytes**. Derived compact array: 528 bytes;
  this does **not** qualify a compact-only GPU readback.
- Compilation including raw producer: **193.779 s**, 104 guarded definitions.
  Dispatches: **35,430**. Submit-through-readback: **28.162 s**.
- Bounded process: **227.575 s**, sampled aggregate RSS **1,253.99 MiB**,
  exit 0, stopReason null; unchanged **240 s / 1,500 MiB** watchdog.
- Invalid compact/replacement mode and second-submission rejection passed.

Evidence files: `/tmp/live-world-n33-reviewed-native.log` and
`/tmp/live-world-n33-reviewed-receipt.log`. The artifact path used for this run was
`/tmp/live-world-n33-reviewed-20261028.mjs`; the test reads it once, verifies its
hash, and imports those exact bytes. The matching reference prefix was
`/tmp/live-world-wide-reference-n33`.

This is **SwiftShader software Vulkan**, not physical GPU performance. It proves
one current-source N33 free-cloth width/index case, not broad collision, qy-stop,
goal/foul, permutation, cancellation/reuse, sustained throughput, browser,
application, or release correctness. N32 full-engine execution and widths above
33 remain unqualified. Earlier CPU metadata retains `gpuExecutionQualified:false`
as its original CPU-only provenance; the native result is this separate receipt.

Focused CPU validation: width policy, resource/raw planning, flat-reference and
negative verifier tests passed; 5 seal tests and 9 existing live-batch tests
passed; typecheck passed. Native-only suites remain explicitly skipped when
`REQUIRE_WEBGPU` is not `1`.

### Per-run bind-group reuse, same N33 numerical result

A subsequent host-only change reuses bind groups for exactly equal pipeline,
buffer, binding number, offset, and size tuples within one invocation. Pipeline
object identity owns its immutable group-0 layout. Fault and indirect-argument
buffers participate in the same actual-object key; no allocation ordinal is used
as runtime identity. Each run owns a new cache, disposed before its buffers are
destroyed, including error/cancellation paths. No cross-run group reuse occurs.
The one-shot N33 gate still consumes its attempt before `encoder.finish()`.
WGSL, lowered recipe, clears, dispatch dimensions/order and copies are unchanged.

Independent review approved the exact 85-module closure; only batch host
orchestration and the new cache module changed relative to the preceding N33
snapshot. Six helper tests cover exact reuse, different pipeline/resources/views,
fault/indirect identity, simultaneous cache isolation, malformed inputs and failed
creation. Two additional **nonexecuting** actual-engine N1/N3 fake-device tests
cover repeated runs, injected world-binding errors, post-submit cancellation,
subsequent reuse and buffer cleanup. These host tests do not establish native
MMQ2 cancellation coverage.

The requalified N33 run again matched **all 96,228 words** with the same recipe
and unchanged 35,430 dispatches. The world graph's 28,626 group creations became
370; including the final gate, measured counts were **371 created and 28,256
reused** instead of 28,627 creations. Raw-stage groups are outside these counters.

- Source revision: `a9466d23b64e8038d6563fc717755cc3938ff821aa22c628ba5e75d087d4c62b`.
- Artifact: 936,405 bytes, SHA-256
  `f4f0e911e76d7a85f3591c1bf89684a7cc757dff4e760c4b22fe94b889d7a569`.
- Compilation: **189.039 s**; command encoding: **235.893 ms**;
  submit-through-readback: **26.911 s**.
- Total bounded process: **221.368 s**; sampled aggregate RSS **1,246.15 MiB**;
  exit 0, stopReason null, unchanged **240 s / 1,500 MiB** limits.
- Owned buffers/readback remain **7,749,780 / 384,912 bytes**.
- Receipt: `/tmp/live-world-n33-bindgroups-receipt.log`.

This proves fewer redundant host API object creations and preserved fixture
results, not a general runtime speedup or a GPU arithmetic reduction. The two
cold-run timings are single observations; the earlier submit timing included
`encoder.finish()` whereas the new encoding metric measures it separately.
All narrow fixture, software-Vulkan, browser and release limitations above remain.
