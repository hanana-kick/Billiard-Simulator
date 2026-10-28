# Sealed upload preparation: 1,024-token CPU benchmark and width plan

## Scope and reproducibility

CPU-only; no real GPU device, GPU evaluation, or GPU speedup measurement.
The script verifies every current source byte against the reviewed pin, checks
its source revision against the immutable bundle, and imports the exact hashed
artifact bytes. All resource-bank captures use a nonexecuting recording device.

```
node scripts/benchmark-live-world-upload-preparation.mjs \
  /tmp/live-world-upload-shared-sealed.mjs \
  63b9a4a4183a9d38d06d9da8a6c208ff8320d5b1a8b66dc0500ada4375ee3a54 \
  /tmp/live-world-upload-1024-report.json
```

Source revision:
`44ae7d4811e29252be9a113b9608d2716424d857a2a9acd978522fc712371e55`.
Full report: `docs/evidence/live-world-upload-1024-preparation.json`.

## Measured preparation

The deterministic grid varies angle, elevation, speed and tip position, with
high unsigned IDs including `0xffffffff`. It contains 807 admitted and 217
owned-but-unadmitted candidates; no unsupported input is promoted to a valid shot.

| CPU phase | Measured time |
|---|---:|
| Construct 1,024 canonical candidates | 2.540 s |
| Capture one authoritative baseline graph | 1.575 s |
| Prepare all 1,024 candidate upload tokens | 2.790 s |
| Eight representative full captures, capture time only | 10.638 s |

The token timer includes original batch packing, tiny-factory capture/invariant
checks, snapshot-copy accounting and periodic memory sampling. It is not a pure
allocation timer. Two preliminary repeats measured 2.652 s and 2.481 s for the
same preparation loop; the checked-in report is the final source-verified run.
No 1,024-full-capture extrapolation is presented as a measurement.

All 1,024 tokens passed the original tiny-factory source/graph/nonidentity-upload
checks. Full source, graph and **every initial byte** were additionally compared
at indices 0, 1, 31, 32, 97, 511, 512 and 1,023. Those eight matched exactly;
this is not a claim that 1,024 full graphs were recaptured. Each full graph has
194 allocations, 34,642 commands and 338,280 initial bytes.

Logical candidate-dependent patch payload is **57,344 bytes = 56 × 1,024**.
This is not total host allocation, total GPU upload traffic, or peak memory.
Runtime still initializes/uploads full world buffers; request/candidate identity
metadata and the shared graph also consume host memory.

In the final run, sampled process RSS rose from 490.73 to 501.03 MiB; maximum
sampled heap use was 160.05 MiB. End heap use was lower than the initial sample
because GC occurred; it is not a negative-allocation result. Samples include
Node, imports, fixture, source verification, canonical candidate metadata and the
private graph. Sampling occurred every 32 candidates, with no forced GC; these
are neither token-exclusive measurements nor guaranteed true peaks. Earlier
runs had different RSS baselines, so no fixed per-token memory cost is inferred.

## Source-derived explicit buffer plan

These are allocation sizes derived from the pinned runtime and original raw
factory, **not device measurements**. N32/N33 remain disallowed by the runtime.
The N1/N3 world+fault+compact subtotals reproduce the native receipts' 337,472 and
773,312 bytes, providing a cross-check of the accounting.

| Quantity (bytes) | N32 | N33 |
|---|---:|---:|
| World allocations | 7,092,224 | 7,310,120 |
| Raw producer allocations | 52,880 | 54,484 |
| Faults and candidate IDs | 256 | 264 |
| Compact readback | 512 | 528 |
| Full diagnostic readback | 373,248 | 384,912 |
| Total with compact readback | 7,145,872 | 7,365,396 |
| Total with full diagnostic readback | 7,518,608 | 7,749,780 |
| Largest allocation/storage binding | 720,896 | 743,424 |

For this staged positive-budget raw profile, raw bytes are
`768 + 784 + 1604*N`. Different raw profiles or a zero-step path require their
own actual-factory plan; do not silently reuse this total. Explicit buffers do
not include pipeline/compiler memory, driver allocations, temporary upload copies,
JS objects or staging overhead. A total resident-memory budget is required in
addition to per-buffer limits. Prior compiler peaks cannot be treated as free
capacity or a general memory guarantee.

## Mandatory preflight before changing the width gate

Current runtime checks storage-slot count but lacks the following complete
resource preflight. Implement and independently review a pure planner first:

1. Every allocation/product is an exact safe integer, aligned, and within both
   an explicit total-resident-byte budget and actual `device.limits.maxBufferSize`.
2. Every binding's offset/size fits its allocation; check actual
   `maxStorageBufferBindingSize`, binding/group counts and stage storage slots.
   Required here: 1 bind group, 10 bindings/group and 10 storage slots/stage.
   Nonzero storage offsets have GCD 256: the actual device's minimum storage
   offset alignment must divide every offset. Do not assume default limits.
3. Check dispatch dimensions: each original phase has `x <= 44`, world `y=N`,
   final gate `x=N`, raw `x=ceil(N/32)`. Thus both widths require at least 44
   workgroups per dimension. Observed shader workgroup sizes are 1, 16 and 32;
   require size-X/invocation limits >=32 (Y/Z are 1).
4. Prove all candidate-local products/additions fit u32 **before** scalar local
   bounds guards: arena stride/base/local index, copied/cleared subviews,
   indirect config arena, faults/IDs and final-gate intermediate arithmetic.
   `maximumWordAddress` in the report is only the largest allocated last-word
   index, not a complete computed-index proof.
5. Preserve the original indirect owner/dominance audit and exact x=0-or-bound,
   y=z=1 rule; no new indirect behavior or cross-candidate alias is admitted.

Actual device limits were not queried in this CPU-only task; the report retains
`actualDeviceLimits:null`. These minimum requirements are not an adapter pass.
The existing N1/N3 width gate is unchanged.

## N32/N33 address and boundary cases

- N32 raw launch: 32 lanes, max gid.x=31, pre-guard row base `31*16=496`.
- N33 raw launch: 64 lanes, max gid.x=63, pre-guard row base `63*16=1008`.
  Staged raw exits when that base is >=`16*N`, before output/scratch indexing.
  Handoff rejects i>=N before all address products.
- N33 maximum active indices: input 527, result 4,223, scratch 1,055,
  prepared state 6,335, handoff status 527, admitted flag 32.
- Final-gate intermediate words: 93,312 / 96,228; final indices 93,311 / 96,227.
- Largest allocated arena last indices: 180,223 / 185,855. Scalar guard proof
  still must cover actual expressions, not merely these arena extents.
- Physical-roster bitmasks remain three-/four-ball masks; do not substitute batch
  width into a 32-bit roster mask or use candidate IDs as lane indices.

## First wider-gate sequence (not executed)

1. Pure planner tests: every limit exactly accepted and one-over rejected;
   overflow/safe-integer boundaries, offsets/alignment, padded raw launch,
   fault/readback lengths, missing limits and explicit resident-memory budget.
2. Cheap N32/N33 boundary kernels: raw padding, candidate-Y copies/guards/final
   gate and MMQ2 size-16 indirect guards. Poison lanes 31 and 32 independently;
   require unaffected neighboring IDs/state. Include high IDs and owned invalid
   inputs. No source omissions or false MISS for a failed/pending lane.
3. Independently prepare CPU references before the native quiet window. For
   admitted complete cases, N32/N33 full parity targets are 93,312 / 96,228
   words. For unadmitted lanes, compare the actually defined rejection fields;
   do not fabricate undefined continuation words merely to reach those totals.
4. Run an explicitly bounded full native gate, then same-engine permutation /
   changed-ID replacement if the chosen scope fits. Cancellation remains separate.
   The existing 240 s / 1,500 MiB caps do not automatically increase. Compilation
   already costs about 182 s; blindly multiplying the current expensive N3 fixture
   to N33 may exceed the time cap. Use CPU-prequalified bounded-cost fixtures,
   retain incomplete results honestly, and obtain separate approval for any cap
   change. No GPU throughput prediction follows from the CPU token benchmark.

Independent source review confirmed the allocation arithmetic and identified the
missing preflight/boundary obligations above. No GPU width was expanded here.
