# Retained initial-only microcode sessions

This is a **separate opt-in source/lifetime profile**, not an increase to the
existing fixed-budget runtime or single/multi-bank executor. The original
four-macro source, raw initializer, instruction budget, requested h horizon,
GPU overflow guards, and mask-zero physical publication stay unchanged.
The initial complete HOST fake-device matrix passed 8/8. Two subsequent narrow
interruption groups passed (idle abort/loss, post-map stale, commit-callback
cancellation). The final publication typed-view seal/callback guards passed 2/2, followed by a
fresh normal retained multi-chunk success gate (1/1) on that exact final source.
No numerical GPU run or full-rest throughput is claimed by this document.

## Construction and ownership

```js
const bank = createRetainedInitialMicrocodeRuntime(initializationPlan, rows, {
  experimental: true,
  maxHSteps,       // source h horizon, never modified by advance
  chunkCycles,    // 1..65536 core+four-macro cycles per advance
  maxTotalCycles, // explicit total, >= chunk; <= UINT32_MAX
});
const plan = createRetainedInitialMicrocodeBatchPlan([bank, otherBank], {
  orderedIds, count, macroWorkgroupSize: 8, limits, maxLiveBytes,
});
const owner = createRetainedInitialMicrocodeBatchExecutor(device, {
  experimental: true,
});
let receipt = await owner.begin(plan, {
  identity: plan.identity, getIdentity: () => currentIdentity, signal,
});
receipt = await owner.advance(receipt, {cyclesByBank: [256, 256]});
// Explicit additional advances only, bounded by each remaining declared cap.
const final = await owner.finalize(receipt);
await owner.dispose();
```

The factory accepts an authenticated initialization plan plus raw parameters,
not an already-created runtime. It constructs and seals its own initial-only
runtime. A clone/deserialized object cannot acquire a larger budget. Total and
chunk caps, initial source generation, ordered row IDs, common rules/history/
numerical profile and source h horizon all bind the new immutable generation.

UINT32_MAX is only the existing VM yield counter's representability ceiling,
**not a tested practical work allowance**. The conservative VM step bound is
`maxTotalCycles * (65536 + 4)` and remains below the checked u64 counter ceiling.
No overflow check, source numeric budget (32768), source iteration cap or physics
horizon is raised. Production accepts no numerical qualification override.

## Lifetime and publication

- Preflight all logical shaders before any expensive pipeline. Preserve the
  established broad-first compilation order and exact source/binding cache keys.
- Allocate ALL bank resources plus compact buffers transactionally before upload.
  Every world/VM/stack/scratch and initialization buffer remains simultaneously
  resident until finalize/cancel/failure; there is no spill/restart or bank shrink.
- Initialize once. `advance` submits only ordered core + four native macro cycles,
  across the same banks, then drains. It never uploads, invokes begin, resets VM
  counters, maps source state, patches a runtime, or steps CPU physics.
- Receipts are same-owner single-use object capabilities. They reveal scheduled
  work counts and remaining declared work only, **not** hidden per-row h/status,
  physical rest or success. Sparse/accessor arrays, receipt clones/replay,
  concurrent calls and automatic total extensions reject before submission.
- Only `finalize` runs compact publication and a single combined final map. The
  existing atomic journal validates the complete ordered wave. Early finalize
  retains actual incomplete/unsupported outcomes, never inventing an evaluated
  miss. PASS/MISS remains blocked by both shader mask zero and the journal.
- Cancellation, stale source/typed view, and device loss drain where possible,
  invalidate receipts and destroy every bank. Operations reject with an explicit
  `RetainedMicrocodeInterrupted.reason`, not partial physical results. An idle
  AbortSignal or loss also initiates cleanup. `cancel()` gives a control-only
  closure receipt; `dispose()` joins outstanding cleanup and invalidates cache.
  A source identity getter is checked at every API/async boundary, not polled
  while idle; the application should cancel promptly on a source change.

The device is exclusively borrowed for the owner lifetime. The owner never
requests or destroys a device. Loss clears all compiled cache; failed/poisoned
reuse rejects. The application still owns worker bundling and device acquisition.

## Evidence boundary

The initial two-bank HOST gate exercised genuine source construction and fake
WebGPU scheduling with 2+2 rows, chunk caps [2,3], total caps [5,7]. All 25 buffers
remained live with exact test sentinels through three advances, no extra upload
or begin occurred, and finalize mapped one 64-byte output. This is lifecycle
proof only: the fake device does not execute WGSL or simulate physics.

The complete eight-group matrix passed (exit 0) and tests authority/admission, early finalize,
all-bank allocation/preflight rejection, cancellation/staleness/loss, unqualified
PASS rejection and atomic post-map source changes. A separate final hardening regression checks an identity callback that aborts
during the atomic commit lease read: lifecycle checks must run after caller code
as well as before it, even after buffer cleanup removed the signal listener.
That cancellation/idle rerun passed 2/2. A related final lease typed-view mutation
regression passed: the new journal lease reader seals owned initial views after
caller code and before returning publication authority. The exact final-source
normal lifecycle was then rerun successfully. These are sequential bounded
checkpoints, not a claim that all ten distinct groups ran in one final invocation. Do not infer numerical parity from these HOST tests. No
1024 physical trajectories, full-rest result, hardware ratio or browser execution
is established here. The cast-loop differential is separate and is NOT enabled.

## Final HOST handoff

Committed production additions are only `retained-microcode-plan.mjs` and
`retained-microcode-executor.mjs`; no existing runtime, owner, shader generator or
default path was modified. The complete test log identities are recorded in
`docs/evidence/resident-retained-microcode-host-v1.json`. Successful completion
of a fake schedule is not numerical qualification: the remaining gates are real
worker/bundle integration and separately authorized native retained-state parity.
No native buffers/VM continuation were imported, serialized or relocated here.
