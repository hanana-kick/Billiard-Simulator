# Bounded free-body graph chunk prototype

## Result and verification boundary

Isolated from integration `dad65a94b4b5aa1cf9a5240a98d5e6067027d889`.
Host transport/admission tests pass (10/10). JavaScript syntax checks pass.
On 2026-10-25, after the parent granted an exclusive short GPU slot, actual
SwiftShader WGSL execution passed exact comparison against both sequential
original CPU-component recurrence and sequential original GPU recurrence.
**The independent native-Rapier oracle was not rerun for this prototype.**
No production caller changes,
reference/parity gate changes, deployment, upload, or hardware speed claim.

## Mechanism

`src/experimental-free-body-graph-chunk.js` builds the existing free-body plan
and uses `Runtime.shaderForInputFloats(68)` unchanged. A command buffer alternates
that arithmetic pipeline and a separate u32-only carry pipeline in separate
compute passes. No fused arithmetic, reassociation, approximation or trajectory
lookup exists. The carry accesses separate output and source buffers; it never
aliases scratch and does not swap buffers. The immutable source parameters are
uploaded once. All steps' output blocks and success markers are copied to one
readback buffer; the whole chunk uses one queue submit and one map operation.

Supported state is exactly `Free.validate`: isolated awake unlocked dynamic
singleton, no contacts/joints, no CCD, no sleeping/activation evolution. Rows
are independent singleton simulations, **not interacting bodies in one world**.
The carry copies outputs 0..12 to inputs 0..12 and outputs 13..21 (refreshed world
inverse inertia) to inputs 19..27. Local COM, mass, principal properties, forces,
torque and all integration settings stay fixed. `worldCom` is decoded for the
result but is not a next-step input. Carry canonicalizes signed zero exactly as
the original `Free.decode` does. No host float math occurs between dispatches.

The entire output history is retained so the source admission validator can be
reapplied at every original step boundary, including quaternion admission,
after the single map and before **any** result is published. Earlier invalid
steps cannot be hidden by later success. Device arithmetic rejects non-finite
intermediates with its unchanged completion marker; the carry checks marker
and finite output words. Rejection/cancellation publishes no partial prefix.
This is speculative bounded chunk execution, not per-frame publication.

## Bounds and ownership

- 1..16 independent rows, 1..32 steps, existing 1..16 substeps.
- At most 4,000,000 graph instructions (`rows * steps * nodes`).
- At most 32 MiB aggregate allocated transport buffers; device per-buffer and
  per-storage-binding limits are checked before allocation.
- Carry work is independently bounded by the fixed source plan's output count,
  22 mapped words, and the row/step bounds.
- Input is synchronously validated/copied before the first await. The wire plan
  is frozen. Only one run may own a component at a time; no external buffer pool.
- Validation scope is popped synchronously before any await, avoiding async
  scope nesting with another stage. Buffers are private to one invocation.
- Cancellation stops publication and holds busy/ownership until submitted work
  drains or device loss is confirmed. Busy disposal fails explicitly. Loss also
  terminates a blocked map/drain. Every invocation destroys its own buffers.

No source sleeping, collision, broadphase, lifecycle, event, UI or goal contract
is being inferred from this free-body-only recurrence.

## Commands and next gate

Host-only:

```
node --check src/experimental-free-body-graph-chunk.js
node --check tests/experimental-free-body-graph-chunk-webgpu.cjs
node --test tests/experimental-free-body-graph-chunk-host.cjs
```

After an explicitly granted shared GPU/native slot only:

```
RUN_FREE_BODY_CHUNK_GPU=1 GPU_NATIVE_MODULE=<approved module path> \
 node --test tests/experimental-free-body-graph-chunk-webgpu.cjs
```

That opt-in gate compares every frame/stage exactly against sequential original
CPU free-body components and sequential original GPU free-body components at
1, 3 and 12 substeps, two independent rows and eight steps. It records 1 submit /
1 map versus 16 sequential-singleton submits/maps. This compares transport
structure (including batching), not hardware speed. The original independent
native-Rapier/free-body parity tests remain separate required gates and are
unmodified. A GPU mismatch or invalid WGSL is a blocker, not permission to relax
precision or publish the prototype.

## Granted-slot numerical result (2026-10-25)

`tests/experimental-free-body-graph-chunk-webgpu.cjs` passed, 1/1, process
wall duration 0.653 s. The native device was explicitly retained and released;
the shared GPU slot was released immediately after the process completed.
Every decoded body, force, delta, and per-substep stage output matched exactly
(`assert.deepEqual`) across 2 rows × 8 frames at each substep configuration.
No acceptance threshold was relaxed. This is component-only evidence, not an
independent world/native-Rapier parity or full-world acceleration result.

| Substeps | Actual chunk submit/map | Actual sequential GPU submit/map | Chunk allocated bytes | Chunk run ms | CPU+GPU sequential comparison ms |
|---|---|---|---|---|---|
| 1 | 1 / 1 | 16 / 16 | 19,716 | 5.007 | 18.007 |
| 3 | 1 / 1 | 16 / 16 | 37,164 | 3.373 | 18.433 |
| 12 | 1 / 1 | 16 / 16 | 115,680 | 7.491 | 67.342 |

Counts were instrumented at actual `queue.submit` / buffer `mapAsync` calls,
not inferred solely from component metadata. Allocation covers chunk transport
buffers only, not opaque driver/pipeline memory. Overall tracked peak live GPU
buffer bytes were 37,644 / 71,076 / 221,520; process RSS reached approximately
166 MB during the test. Timing excludes pipeline creation; the comparison
column deliberately includes CPU work and assertions, so it is **not** a fair
speedup ratio. SwiftShader is a software GPU, not hardware acceleration.

Raw output: `docs/evidence/free-body-graph-chunk-gpu-comparison.txt`.

### Baseline clarification (follow-on host checkpoint)

The measured 16-map baseline above is **individually stepped rows**. Temporal
chaining should primarily be compared with the existing per-step row batching:
2 rows × 8 steps requires 8 maps, not 16. The gated comparison now includes
`free-body-batched-step-baseline.cjs`, retaining the existing resident shader,
per-step decode/validation/repack, and exact every-frame comparison. Actual
8-map measurements have not yet run; this change is host/syntax checked only.

### Granted-slot fair-baseline result (2026-10-25)

The pending baseline above subsequently passed the explicitly granted short
slot: exact every-frame/stage equality to original CPU, sequential singleton
GPU, and per-step batched GPU. Actual instrumented submits/maps were **1/8/16**
for chunk / per-step two-row batch / individual singleton calls at every
substep setting. Full process duration 0.627 s; slot released immediately.

| Substeps | Chunk ms | Per-step batch ms | Chunk buffer allocation | Batched run buffer allocation |
|---|---|---|---|---|
| 1 | 4.786 | 3.803 | 19,716 bytes | 6,608 bytes |
| 3 | 5.283 | 3.778 | 37,164 bytes | 11,696 bytes |
| 12 | 7.388 | 7.585 | 115,680 bytes | 34,592 bytes |

These single SwiftShader samples show **no consistent speedup** against the fair
batched baseline despite fewer maps. Pipeline setup is outside both timings;
allocation columns count run-time transport allocations (resident baseline
program/index allocations precede its run). This is not a rigorous benchmark
or a hardware/world acceleration result. All original acceptance is unchanged.
Raw log: `docs/evidence/free-body-graph-chunk-batched-comparison.txt`.
