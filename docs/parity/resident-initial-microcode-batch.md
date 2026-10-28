# Owned simultaneous microcode banks (HOST integration)

This is a separate opt-in production owner, not a loop around the single-bank
`evaluate()` API. `initial-microcode-batch-plan.mjs` takes an explicit ordered
array of genuinely constructed runtimes. It never slices or scales a historical
runtime, imports future snapshots, composes new source, requests a device or
changes the four-macro default profile.

```js
const plan = createInitialMicrocodeBatchPlan(runtimes, {
  orderedIds: exactRequestedIds,
  count: exactRequestedIds.length,
  macroWorkgroupSize: 8, // explicit 1 or 8
  limits: actualGrantedLimits,
  maxLiveBytes: 512 * 1024 * 1024, // allocation budget, NOT free-memory evidence
});
const owner = createInitialMicrocodeBatchExecutor(device, {
  experimental: true,
  maxDispatchesPerSubmission: 1024,
});
try {
  const out = await owner.evaluate(plan, {
    identity: plan.identity,
    getIdentity: () => currentBatchIdentity,
    signal,
  });
} finally { await owner.dispose(); }
```

The plan is same-realm branded. `currentBatchIdentity` must be invalidated by the
application when its source/prestrike/request changes; the plan is not a claim
that the live game has remained unchanged. Its generation identity binds the
complete ordered bank generations, input/source/bytecode/logical-view/launch
identities, row ranges and explicit work caps, plus common query semantics.
The source and prestrike identities are also checked separately. Exact requested
IDs/count must match the concatenated bank rows without duplicates, reordering,
padding or omission. Clone/hash-only authority rejects.

Common rule/query obligations, requested source h horizon, complete initial
history, source/numerical/transport profiles and macro budget are required.
Different explicit VM work caps are preserved, not replaced by the largest cap.
Work exhaustion remains incomplete. Each runtime and launch retains its exact
owned-view seal. No numerical qualification override is accepted.

## Resource and execution order

Each bank owns all eleven original source/VM resources and its compact output;
one additional global readback receives the ordered compact copies. Thus two
banks use 25 buffers. Every bank's resources, retained initialization resources,
compact output and global readback count toward the explicit live-byte budget.
Documented raw/numeric scratch aliases are counted once per bank. No mutable
buffer is shared between banks. This first version also conservatively keeps
separate immutable buffers, rather than asserting deduplication without proof.
Compiler, driver and allocator overhead are unknown and excluded from the exact
logical buffer-byte sum. WebGPU does not expose device free memory.

Before any upload/dispatch:

1. Revalidate every owned runtime/launch, the global lease and actual device
   limits (including the compatibility 128 MiB storage-binding ceiling).
2. Preflight every unique source module and every logical descriptor across all
   banks before any pipeline. Cache identity is full code, entry and binding
   types, not a short name or caller hash.
3. Compile broad handlers for all banks first, then core begin/pump, source begin,
   the unchanged raw initialization stages, other handlers and publishers.
4. Allocate **all** banks and compact buffers transactionally. An allocation
   failure destroys earlier allocations without uploading or dispatching.

Original initializers then execute with all banks retained. Continuation cycles
are round-robin, preserving each bank's core/four-macro order and its declared
number of cycles. No bank is released, spilled, mapped or reconstructed while
another bank runs. Only after every bank's work drains do the compact publishers
run, followed by copies into global row offsets and **one final map**. The
existing compact transaction validates every bank/ID and commits atomically.
No public source/VM/scratch or per-h snapshots exist.

Cancellation, stale source and device loss prevent partial publication, drain
submitted work and destroy all bank resources. Unknown queue/drain failures
remain failures and poison reuse. Failed IDs, malformed records or forbidden
physical PASS/MISS in even one bank invalidate the whole wave. The publisher
uses qualification mask zero; the journal separately refuses physical PASS/MISS.
Original rejection, unsupported numerics, work/horizon exhaustion and lifecycle
failures are not relabelled as physical misses.

## Scope and evidence

The source plan gates use independently authenticated original initial data and
freshly constructed runtimes. Lifecycle tests use a **noncomputing fake device**
with explicit compact transport injections; they do not execute physics. They
check simultaneous allocation/retention, schedules, exact binding lengths,
preflight order, compact map/copy counts, cross-bank ID isolation and cleanup.
The intended1024 plan test constructs two genuine512-row source runtimes only;
it does not allocate large fake banks or execute GPU trajectories.

The first combined lifecycle run ended with an uninformative file-level Node
failure after212.65 s (outer exit1; no recorded signal or assertion). Its log is
preserved. This is not a GPU failure or established OOM diagnosis. A bounded
first-success-only TAP rerun with a512 MiB Node heap cap passed unchanged source,
fixtures and136,657 dispatches. The subsequent resource-capped, single-process TAP run passed all six lifecycle
groups (exit0, peak owned RSS511,160 KiB). It included the full suite despite
its attempted name filter; this runner distinction is retained in the log. The
original failure cause remains unproven, not retroactively called OOM.

Single-bank production API/default UI/CPU and frozen native artifacts remain
unchanged. Actual browser-worker integration, numerical/native bank qualification,
full-rest rules,1024 physical trajectories and hardware throughput remain
separate gates. Simultaneous resource ownership is not proof of those outcomes.

## Reproduction and staged gates

```sh
node --test --test-concurrency=1 tests/resident-candidate-initial-microcode-batch-plan.mjs
NODE_OPTIONS=--max-old-space-size=512 node --test --test-isolation=none \
  --test-concurrency=1 --test-reporter=tap \
  tests/resident-candidate-initial-microcode-batch-executor.mjs
NODE_OPTIONS=--max-old-space-size=512 node --test --test-isolation=none \
  --test-concurrency=1 --test-reporter=tap \
  tests/resident-candidate-initial-microcode-batch-interruption.mjs
# Separate source/metadata-only count generation; no large fake buffers:
RESIDENT_BATCH_1024_PLAN=1 NODE_OPTIONS=--max-old-space-size=512 node --test \
  --test-name-pattern=intended1024 tests/resident-candidate-initial-microcode-batch-plan.mjs
```

The original no-step capture and pinned WASM decoder provenance remain local
test-only dependencies. None are imported by either production batch module.
All commands are HOST only and should run sequentially, not during native timing.

Completed phase coverage: all30 cases passed (three groups, exit0), covering
cancel/stale/loss at preflight, pipeline creation, allocation, upload, initial
execution, continuation, publication, copy, map and cleanup. Cancel/stale tests
reuse only immutable compiled pipelines; every attempt allocates fresh complete
banks. Lost devices reject reuse. Peak owned RSS was520,016 KiB under the explicit
HOST heap cap. These are lifecycle facts, not GPU speed or numerical evidence.

The separately enabled1024 source-only gate passed: two newly compiled512-row
banks, each129,191,904 B world storage, all25 logical buffers370,787,688 B
(353.61 MiB), including duplicated immutable/retained initialization resources
and16,384 B global compact readback. Each bank remains under the declared128 MiB
storage binding limit. This is a logical allocation fit, not an allocation or
free-memory measurement. Its declared2 VM cycles/bank and h2 source ceiling are
metadata test inputs, not a sufficient physical evaluation budget. Complete
counts, source/code hashes and scope flags are in
`docs/evidence/resident-initial-microcode-batch-host-v1.json`.

## Retained-work continuation seam (inventory, not implemented)

The current runtime constructor admits1..65,536 `dispatchChunks`. Both production
owners execute exactly the fixed per-bank budget, then publish/map and destroy
all banks even if VM/source work remains incomplete. There is no production
resume API, and `evaluate()` must not be presented as one. The requested source
h horizon is a distinct field and is never extended by increasing VM work.

A minimal future, separately branded session would authenticate a total work cap
and per-call chunk cap at construction, initialize once, and retain the exact
same buffers, PC, locals, stack, pending macro and source counters through
`advance(boundedCycles)` calls. Advance may return submitted/drained-work receipts
only, not inferred physical h progress or an intermediate state map. A sole
`finalize()` would run compact publication/map/atomic commit and destruction;
finalizing early or reaching the work cap remains incomplete, never a miss.
Cancellation/stale/loss still drains/disposes the complete wave. No caller
`extraCycles` override, old-runtime repair, serialized-state reload, renewed
`begin`, changed candidate roster or source-h extension should be admitted.

The VM already stores successful instruction counts in `stepsLow/stepsHigh` and
rejects64-bit overflow; its u32 yields counter also rejects overflow. A future
session must retain these values, not reset them between chunks. The current
65,536-cycle host policy is therefore not a32-bit scalar instruction ceiling.
This section does not raise any limit or qualify full-rest completion. The
bounded raw-initializer cast-loop experiment remains the next approved HOST
work, only after the shared numerical hold is released.
