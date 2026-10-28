# Prepared recurrence: candidate-parallel batch

This is an explicit opt-in library, not a UI/default change. It batches the **existing prepared supported-direction recurrence**. It is not the generic raw cue/world pipeline, and does not assert parity with Rapier or provide a gameplay/search verdict.

## APIs

- `runRecurringBatchCPU(rows, scene, hulls, options)` in `deterministic-recurring-batch.mjs`.
- `await createRecurringBatchGPU(device, hulls, {bodyCount: 4})`, then `engine.run(rows, scene, options)` in `deterministic-recurring-batch-gpu.mjs`.
- `rows`: owned `Uint32Array`, 96 words/candidate, unique exact u32 IDs, 1..65535 candidates (also device/storage limited). Offset typed-array views are supported; inputs are snapshotted before asynchronous work. Unlike the old single-row wrapper, the batch validates each row with the unchanged validator and separately enforces batch-wide ID uniqueness; it does not change the old 128-row packer.
- `scene`, hull assets, material, budgets, bounded `maxPrefixes`, and `executionProfile` are common to the batch. Every candidate still runs the original single-candidate physics model. Malformed protocol inputs reject the batch; valid physical failure statuses remain isolated per candidate.
- Default output `compact`: four **physics receipt** u32s/candidate: `[candidateId, physicsStateStatus, physicsStateReason, physicsFlags]`. Flag bit 0 means only canonical-model REST (`state[1] == 9`); all other flag bits are zero. This is **not** PASS, FAIL, score bits, or physical-rest certification. The envelope explicitly says `gameplayVerdict: 'not-evaluated'`, `globalReceiptCertified: false`, `physicalRestCertified: false`, and `preImpactPhysicalEnclosurePreserved: false`.
- `diagnostic: 'all-words'` additionally returns `words`: 2096 words/candidate in exactly the preexisting `recurringWords` order: state256, dense256, latest accepted path256, tail272, refinement1056. Full statuses and local receipts are preserved in this diagnostic output; compact mode deliberately does not claim a full global receipt.
- Abort before submission prevents submission. Abort while submitted rejects after the submitted GPU work finishes and all owned buffers are destroyed; it never returns a partial success. GPU work already submitted is not preempted.

## Parallelism and ownership audit

Each old phase is dispatched once with `dispatchWorkgroups(originalX, N)`. Its original x lanes and guards retain their exact meaning (one world, four bodies, or 32 smooth cells); y selects the candidate. All shaders have workgroup y-size 1. Every mutable storage access is lifted to `candidate * stride + localOffset`; original integer arithmetic and physics branches are unchanged. Private arithmetic registers and arrays remain invocation-local. There is no workgroup/shared storage, barrier, atomic, cross-candidate reduction, engine VM, heap clone, or N-fold serialized command bank.

The phase specification records **every** storage binding as shared immutable or candidate-local. The lift is an internal audited-kernel/test hook, not a generic safe WGSL transformer: every original local index must be in its audited logical view. An out-of-range original index could otherwise wrap into another candidate bank. The GPU factory SHA-256-pins all 29 original kernels through Web Crypto before compilation; any source drift requires renewed local-address audit. It also reserves its injected identifier namespace. The lift fails closed for unknown bindings, mutable shared bindings, storage pointer use, workgroup state/barriers/atomics, or unsupported entry signatures. Helper parameters that shadow a storage name (`unit(input)`) are alpha-renamed before lifting. `arrayLength` becomes the original per-candidate logical length, never the full batch length. The combined 640-word row bank has explicit views: smooth `[0,256)`, bridge `[256,512)`, rolling `[512,640)`; it is never accidentally treated as a contiguous all-candidate subarray.

Initial tube context is copied per candidate because landing preparation writes `ctx[15]`. Recurring context, scene, cloth/config, and finite-table geometry are immutable shared buffers. Per-candidate state, proposals, roots/responses, dense/path receipts, tail/refinement, and scratch are separate fixed-stride arrays. No intermediate readback and no host physics occur between phases.

With prefix budget P, command count is **21 + 66P** in default compact mode and **22 + 66P** in diagnostic mode, independent of N. Clears are **9P**. There is one submission; readback is **16N bytes** by default or **8400N bytes** with diagnostics. The CPU batch deliberately maps the unchanged single-candidate CPU model, rather than presenting serialized GPU submissions as batching.

## Verification scope

`node --test tests/deterministic-recurring-batch.mjs` covers source ownership, CPU single/batch all-word identity, input offsets, unsigned IDs, independent geometry/query-budget failures, permutations, malformed inputs, >128-row validation, and cancellation. The opt-in native GPU test additionally covers N=1,3,31,32,33; bounded/full canonical and strict profiles; tail budget failure; exact full-word CPU/GPU identity; permutation/cross-candidate contamination; compact byte count; submitted cancellation and subsequent reuse. Native results and measured memory/timings must be reported separately; tests skipped without `REQUIRE_WEBGPU=1` are not GPU evidence.

### Native result (SwiftShader, source checkpoint `8e55403`)

All five tests passed; 234,752 diagnostic words matched exactly across 12 run cases. N=1,3,31,32,33 all used 88 diagnostic dispatches at P=1; the P=40 canonical/strict/tail-budget runs used 2662. The N=33 compact run returned 528 bytes and used 87 dispatches. Full canonical-model REST was exercised at N=3, not yet at thousands. Compiler time was 32.736 s; bounded process elapsed 39.471 s, sampled aggregate peak 1107.86 MiB (1500 MiB cap), exit 0. These are software Vulkan validation results, not physical GPU throughput measurements.

Default candidate buffers are exactly 50,664 bytes/candidate and diagnostic buffers 67,432 bytes/candidate for a four-body scene, plus 1,952 bytes of shared immutable data for this fixture. Allocation is capped at 256 MiB before submission; backend pipeline/compiler memory is **not** included in this buffer cap and is separately covered by the native process watchdog.

A subsequent preflight hardening rejects non-1D workgroups, non-x original invocation uses, extra entry arguments, and any unclassified storage declaration. All 68 generated shader texts for three- and four-body configurations were verified byte-identical to the native-tested checkpoint. Original native source hashes and the text-identity evidence live in `artifacts/canonical-recurring-batch/`; post-hardening CPU tests do not substitute for native results.

Independent CPU-only schedule audit is durable in `tests/deterministic-recurring-batch-schedule.mjs`: for three/four bodies and P=1/3, N=1 exactly preserves every original physics binding/logical subview, initial upload, clear, and x dispatch.

### Bounded-prefix scale result (SwiftShader, source checkpoint `e46df05`)

The reviewed, source-pinned implementation passed all 14 native run cases. Total exact diagnostic comparison was 2,381,056 words. At **P=1**, N=1024 diagnostic mode used 88 phases, 69,052,320 buffer bytes, 8,601,600 final readback bytes, and 3.312 s from submit through result readback. N=2048 compact mode used 87 phases, 103,761,824 buffer bytes, 32,768 final readback bytes, and 6.904 s; every compact row matched the CPU model. Pipeline compilation was separate: 35.316 s. The bounded process completed in 65.991 s, peak sampled aggregate RSS 1117.25 MiB, exit 0 under unchanged 1500 MiB/230 s limits. All frozen source hashes passed the post-run check.

This establishes thousands of independent **bounded-prefix** candidates in one resident parallel phase bank—not thousands of full-rest shots, gameplay verdicts, or hardware-GPU throughput. The N=3/P=40 mixed batches were: canonical `[(9,0,REST),(7,1,none),(5,1,none)]`; strict `[(5,42,none),(7,1,none),(5,1,none)]`; canonical with one tail node `[(5,46,none),(7,1,none),(5,1,none)]`, expressed as `(physics status, reason, model-REST flag)`. Thus successful canonical-model REST, geometry rejection, and query-budget failure coexist without cross-candidate contamination; strict/tail-budget failures never become success.

## 2026-10-27 phase9 derivative-gate address re-audit

The TUBE_CLEAR source gained an additional necessary solved-pair release test:
strictly outward relative velocity alone is not proof that the independently
encoded nominal position polynomial is monotonic. The new gate also bounds the
original position derivative `(d + 2*c*s) * 2^20 / h` over `s in [0,1]`, using
checked addition and directed wide division, and requires a strictly positive
radial lower bound. Original physical-velocity and separated-endpoint gates remain.
Synthetic swept boxes do not provide that polynomial: their release fails closed.
No motion coefficients, physical impulse law, shared state, or default are changed.

Independent local-address review of the **exact changed source**, not blanket hash
regeneration:

- Only original source index9 changed. All other28 pinned sources were unchanged.
- Added helper reads `state[4]`, `dense[64*i]`, `dense[64*i+8+k]` and
  `dense[64*i+12+k]`. Existing admitted loop bounds `i<4`, `k<3` make the largest
  added dense index206, below the candidate-local256-word binding. State index4
  is likewise inside its256-word binding.
- No added binding, storage write, pointer, arrayLength use, storage-name shadow,
  barrier, workgroup variable or atomic. The helper parameters do not shadow
  state/dense/segments/ctx.
- The existing candidate lift applies the candidate offset inside the new helper
  as it does at the entry point. Phase9 ownership stays[256,256,256,160]. Phase33
  reuses source9 with immutable shared context; the new helper adds no context
  access and therefore does not change that ownership proof.
- New arithmetic locals and the existing checked-math flag are invocation-private.
  They cannot link lanes or candidate y indices.

The reviewed phase9 SHA256 is
`99b9af1f06f184155e63fffaaee5d39ede1a341fb60a0263213896783efd5c74`.
The pin change requires the ordinary N=1 schedule/ownership tests and targeted
native candidate-isolation regression below; it does not qualify arbitrary future
source edits. The direct native derivative-gate regression separately exercises
negative/positive directions, reversal, zero derivative, physical velocity failure,
unknown/synthetic modes, zero duration and signed-range-invalid duration.

Re-audit verification completed: N=1 schedule and CPU batch tests5passed/1native
skip; separate native batch suite5/5 passed,12 scenarios and234,752 counted
literal diagnostic words identical. Widths1/3/31/32/33, full recurrence under
canonical/strict profiles, failure/budget rows, permutation, compact output and
cancel/reuse were covered. The new derivative gate's direct native tests were
also checked independently (old+new gate7/7,10,752words). The large1024/2048scale
cases were not rerun in this source-change checkpoint and are not new evidence.
Batch native run43.323s including35.632s compilation, sampled aggregate process
RSS1118.51MiB. All measurements use software Vulkan, not physical GPU throughput.
Evidence: `artifacts/canonical-tube-release/batch-native-checkpoint.json`.
