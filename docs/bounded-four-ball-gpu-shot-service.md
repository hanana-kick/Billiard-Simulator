# Bounded live-initial four-ball GPU shot service

## Scope and non-claims

`src/bounded-gpu-shot/four-ball.mjs` is an explicit experimental API, not a product backend switch. It composes the existing browser initial importer with the unchanged `experimental-four-ball-world.js` GPU owner. It changes no solver, h, numerical guard, domain admission, game rule, UI, default backend or production bundle.

The only admitted input remains the original, freshly observed constructor-72 → four-ball mode creation → default first strike → synchronous initial capture. Settings are angle 0, elevation 8, tip X/Y 0, speed 2 and the original parameters/layout. Dragged balls, arbitrary settings, later turns and unsupported contact configurations are not silently generalized. Initial decoding is read-only WASM; subsequent physics uses actual WebGPU arithmetic and the world's existing source-derived orchestration. There is no native `PhysicsLab.step`/restore continuation, reference-world selection, hidden CPU simulation, or expected trajectory input.

This module must not be presented as full arbitrary CPU/GPU parity or as default gameplay integration. A native software Dawn run proves actual WGSL execution, not browser GPU availability or hardware performance. Lifecycle test doubles prove scheduling only, not compute.

## Browser load and source ownership

The runtime uses existing classic-script dependency globals. This module is **not standalone**:

1. Initialize the official bundled original source and the build-pinned read-only decoder as documented in `browser-live-initial-four-ball-capture.md` and `browser-initial-four-ball-import.md`.
2. Import the initial importer to establish the shared topology module authority. Load the existing four-ball runtime dependency scripts in dependency order, excluding a second execution of `experimental-cue-convex-topology.js`. The live-capture test-page generator derives this exact script order.
3. Import `src/bounded-gpu-shot/four-ball.mjs` only after those runtime globals exist. A bundle must preserve the same single topology authority and dependency initialization order.
4. Obtain a real same-realm `GPUDevice`. The service does not request an adapter or a device and rejects device-shaped plain objects. Software Dawn's actual `GPUDevice` is supported when its official globals are installed.

The source collector supplies `{snapshot, capture}`, never a generated physics seed:

```js
const live = captureLiveInitialFourBall({R: RAPIER});
const service = createBoundedFourBallShotService({device, decoder});
const operation = service.start(
  {snapshot: live.snapshot, capture: live.capture},
  {signal: abortController.signal, budget: {maxSteps: 256, maxWallMs: 1000}}
);
live.dispose(); // start already owns a copy, before its first await.
let result = await operation.result;
while (result.status === 'budget-suspended') {
  // A UI should resume only when it wants another bounded compute slice.
  result = await operation.resume({budget: {maxSteps: 256, maxWallMs: 1000}});
}
await service.dispose();
```

Capture and configuration are copied/frozen before asynchronous work. SharedArrayBuffer-backed input and hidden host-object storage such as shared WebAssembly.Memory anywhere in the capture are synchronously rejected before superseding the previous operation, because structuredClone would otherwise retain shared mutable storage. Nonempty typed arrays cannot be frozen in JavaScript, so the copied bytes remain encapsulated and are never exposed. The importer owns another private copy. The private seed is frozen without cloning branded hulls; neither the seed nor its hulls is an output. Returned world snapshots contain owned simulation state, events and scoring, not initialization authority. Returned snapshots are detached/frozen; caller changes cannot rewrite the world.

The decoder method is captured at service construction. The decoder and native GPUDevice are borrowed; the service must not destroy either. Each operation owns its created world and buffers. A private resource tracker also destroys buffers allocated by a stage whose asynchronous construction fails before the world can register that stage. Native WebGPU methods remain bound to the actual device; no renderer allocations or error handlers are intercepted.

## API and exact budgets

`createBoundedFourBallShotService({device, decoder, scheduling?})` returns:

- `start({snapshot,capture}, {signal?,budget?})`: creates a new operation and cancels the previous nonterminal operation, including a suspended one.
- `snapshot()`: a detached view of the latest operation only. A stale operation can never publish over this view.
- `dispose()`: cancels pending/suspended work, awaits creation/the current atomic h, then releases owned resources. It is idempotent and never calls `device.destroy()`.
- `capability`: the explicit bounded-domain declaration.

Only one service from this module may hold a given GPUDevice at a time. A private WeakMap lease rejects duplicate service construction, and releases only after `dispose()` drains. This restricts this compute service, not other renderer work on the borrowed device. Use a single module instance per realm.

Each operation exposes `id`, `result` (first slice), `finished` (terminal result), `snapshot()`, `cancel()` and `resume({budget?})`. Resume only accepts an idle `budget-suspended` operation. Duplicate or concurrent resume throws instead of scheduling extra h. `finished` intentionally remains pending while an operation is suspended; callers must resume or cancel/dispose it.

A budget has exactly:

- `maxSteps`: integer 1..4096, default 256. Counts successful, committed calls to the original world's `step()`, each of which owns exactly one actual h. It does not count outer frames or approximate physics steps.
- `maxWallMs`: finite positive milliseconds, at most 30000, default 1000. Uses monotonic wall time from the beginning of an executing slice, including construction and cooperative yields. Queue waiting behind an older operation is not included.

Budgets are checked at safe transaction boundaries. They are **not hard GPU/preemption deadlines**: an asynchronous constructor or one atomic h can exceed the remaining wall budget. Once that work drains, the last committed state is observed before returning. No requested budget changes dt, subdivisions, solver iterations, positions, velocities, sleep thresholds or arithmetic. `state.lastStep.h`, `outerSubstep` and `outerStep` are the unchanged world's schedule, initially 1/61440 and later 1/960 at its own outer boundary.

The API being asynchronous does **not** make initialization nonblocking. WASM decoding, validation, copying and pure projection include synchronous CPU segments and can block a browser main thread for hundreds of milliseconds; a yield around an atomic phase cannot preempt those segments. A future product integration should create its decoder, private hull authority, imported seed, GPUDevice and world together inside one dedicated worker realm, sending only the raw initial snapshot/capture to that worker. Do not transfer or reconstruct branded hulls across realms. This change does not implement that worker or claim main-UI responsiveness.

An optional `scheduling` object has only `yieldControl` and `renderingBusy` functions. By default the service yields via a zero-delay task timer before construction and before every h. A renderer can return true from `renderingBusy()` to retain the shared queue; elapsed wall time still suspends the operation, including before initialization. Hooks are captured at construction and must resolve normally; this API cannot forcibly interrupt an arbitrary hook that never resolves. No physics or world factory hook exists on the public service.

## Results, cancellation and cleanup

Every view identifies its operation, status, phase, reason/error, committed h/outer counters/time, last committed `state`, cumulative contact `events`, and `scoring`. Read-only `resources` reports owned buffer creation, explicit destruction, collection, current tracking and peak tracking counts. Destroying an owned native buffer immediately removes its tracking record, rather than accumulating one record per transient buffer until GC; renderer buffers are not wrapped or counted. `scoring.game` is the world's current pending/final game state. `scoring.result` is non-null only on successful `complete`; it is copied directly from the original world, not recalculated by the service.

Terminal statuses are:

- `complete`: the world itself has `shotComplete`, cue absent, four sleeping bodies, no awake island and a source score result. There is no guessed settle duration, speed cutoff, goal shortcut or maximum-h success.
- `unsupported`: importer/world domain admission rejects an input or a later unsupported contact/CCD phase. Last committed state is retained; the failed h is not treated as committed.
- `cancelled`: caller abort/cancel, a newer request, or service disposal. An already submitted atomic h drains first; its committed result is reported if it succeeded.
- `device-lost`: the native device's loss promise reports loss. No CPU/device fallback occurs.
- `failed`: an unexpected error or invalid completion invariant, kept distinct from domain rejection.

`budget-suspended` is not terminal and never means success. Its world and exact continuation remain owned until resume/cancel/dispose. `queued` and `running` are observable transient statuses only. The input may still be private and uninitialized if rendering contention exhausted the wall budget.

Abort/device-loss/stale ownership checks occur before and after importer/world-construction awaits, scheduler awaits and each atomic world-step await. Cancellation never races disposal against active submissions or rewrites a pending world transaction. The service serial queue drains an older owner before constructing/stepping the newer owner. If work cannot be preempted inside a shader/map/construction, the operation remains pending until it settles; no premature cleanup or fake final status is emitted.

## Verification

Fast lifecycle-only tests:

```sh
node --test tests/bounded-gpu-shot-lifecycle.mjs tests/bounded-gpu-shot-resources.mjs
```

These use explicit fake lifecycle worlds only inside the internal orchestration module. They cover budget/resume, input isolation, stale-owner replacement, one in-flight h, abort before/during/after work, device loss, physical-rest invariants, exact status distinctions and cleanup. A separate resource-only double runs 10,000 transient allocations while the tracked-live count stays fixed, checks partial-constructor cleanup, and preserves an unrelated renderer allocation. These tests do not count as GPU compute.

Source-only gate, using an actual live browser download and the unchanged original full-rest oracle:

```sh
LIVE_FOUR_BALL_INPUT=/absolute/path/live-initial-four-ball.json \
FOUR_BALL_FULL_REPLAY=/absolute/path/original-four-ball-full-c49bc03.v8 \
node --test tests/bounded-gpu-shot-source.cjs
```

Before actual GPU validation, run a separate pure preparer once. It calls the unchanged strict original loader, writes every original h in exact 64-frame shards and every compared checkpoint, and verifies byte-exact V8 roundtrips. It never runs native or GPU physics. Use a fresh directory on workspace storage, not a RAM-backed temporary directory:

```sh
BOUNDED_EXPECTED_SHARDS=/new/absolute/workspace/expected-shards \
FOUR_BALL_FULL_REPLAY=/absolute/path/original-four-ball-full-c49bc03.v8 \
node tests/prepare-bounded-gpu-shot-oracle.mjs
```

Pin the printed manifest SHA-256 as BOUNDED_EXPECTED_SHARDS_SHA256. The GPU reader verifies that manifest, each shard, the preparer/comparison source hashes, the original source/manifest contract, and the entire original artifact SHA-256 using a streaming read. It retains only 64 expected frames and the current checkpoint, never the huge unused native typed trees. All 5,845 h and 132 continuation checkpoints remain required; the comparison functions are byte-identical to the original service harness. Expected data never enters the service initializer.

Actual WGSL integration, only when the shared heavy-compute slot is free:

```sh
BOUNDED_EXPECTED_SHARDS=/absolute/workspace/expected-shards \
BOUNDED_EXPECTED_SHARDS_SHA256=<preparer-output-manifest-hash> \
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/absolute/path/official-webgpu/index.js \
LIVE_FOUR_BALL_INPUT=/absolute/path/live-initial-four-ball.json \
FOUR_BALL_FULL_REPLAY=/absolute/path/original-four-ball-full-c49bc03.v8 \
SERVICE_EVIDENCE_OUT=/new/absolute/path/service-result.json \
node --test tests/bounded-gpu-shot-webgpu.mjs
```

`SERVICE_SMOKE_H=1` explicitly stops/cancels after the first verified h and reports `smoke-prefix-only`, never full-rest success. With no smoke setting, maxSteps:1 slices compare every h through the original physical-rest boundary, all source checkpoint state/contact caches, contact events, pending/final score and exact clocks. The original oracle is validated by its unchanged strict source/manifest/byte loader in the sequential preparer, then every needed shard and original hash is revalidated in the GPU process; it remains expected-only; its states are never passed to start/resume. Native initialization, original world/PhysicsLab stepping and restore are prohibited during service tests. The test logs its own process RSS/heap/native allocations and resource counters every 500 h, never inspects other processes, and requires zero remaining tracked buffers at the terminal boundary. The test also preserves a separate borrowed-device buffer across service cleanup and verifies that the device can accept a new service lease.

Verification results are recorded separately in `docs/evidence/bounded-four-ball-gpu-shot-service.json` after actual compute. Without that completed real run, the lifecycle/source gates alone must not be reported as a GPU pass. No full product UI test or browser hardware GPU integration is implied by this isolated API test.

## Source dependency and review record

The service was developed against importer commit `a7b4972` and live collector content from `0957a726` (integrated on the main line as `00f58a7`). The service changes only its new module, tests and documentation. It neither edits nor overrides those import/capture modules. Before the successful run, importer storage hardening `9685337e2e4f39cb7fced52d4ffceeed04baa354` (service-tree cherry-pick `8961fba`) and exact-handle canonicalization `bb0f1225771f312e7db573c9b95849328c10b9de` (service-tree cherry-pick `9373cf5`) were integrated. Fresh live evidence was regenerated and all 50 captured source hashes were checked; old hashes were not waived. Handle canonicalization changes only the owned `{index, generation}` representation after exact two-key/u32 validation, not physical values or runtime admission.

An independent ownership review reproduced and drove fixes for null/undefined promise rejection, cancellation in the exact suspended-status/pending-promise microtask boundary, and shared-memory input aliasing. The final lifecycle regression covers those cases without force-disposing to mask a pending terminal result. The module-private device lease and browser dependency initialization contract are explicit. Actual GPU test startup requires a clean tracked tree and logs its tested commit, source hashes, fresh live input hash and immutable expected-oracle hash before requesting the native adapter.


## Initial resource diagnostic

Two first-h attempts at source commit `8961fba` ended before an h result. A TAP rerun established child `SIGKILL` with no exit code, not a shader/parity assertion or a successful first h. The preceding own-process RSS was approximately 0.96–1.04 GB while retaining the entire expected oracle. The kill cause was not established and is not labeled OOM. Sequential expected-only sharding was introduced without changing service physics or reducing any comparison; the pure all-shard reader subsequently covered 5,845 h and 132 checkpoints at about 178 MB observed RSS. These diagnostics alone are not a GPU pass.

## Completed bounded validation, 2026-10-24

At clean tested commit `9373cf546a4051e26c3ddfb74ef54fb9a8fa7cf8`, the actual software Dawn/SwiftShader service continued a fresh Chromium source-only capture through **all 5,845 h and 132 continuation checkpoints**, including physical rest at outer step 5,404. The maximum absolute compared numerical difference was **2.815995547855721e-9**; discrete state/events and the original score `{cueId: 1, delta: -1, nextCue: 2}` matched. The process exited 0 after about 338.5 seconds. The previous first-h-only run also exited 0, but remains separately labeled prefix-only.

Every h used the existing GPU world with its exact h/outer-loop decisions. Expected oracle states never initialized or steered the candidate. Native init/step/restore continuation was prohibited. There was no hidden CPU fallback. This establishes the one stated domain, not bit-identical floats, arbitrary-shot coverage, browser hardware execution or real-time speed.

The full run observed no GPU errors. All **529,504 owned buffers were explicitly destroyed**, with zero tracked buffers remaining and peak 176. A separate renderer buffer and borrowed device survived service cleanup. Live buffers stayed 170 from h 1,500 through 4,500, then 172 at h 5,000/5,500, before terminal cleanup to zero. The test records counts, not allocation byte totals. Peak own-process RSS was 1,833,700 KiB; final RSS was 1,786,642,432 bytes. Existing contact-graph journal receipts retain full histories, so this is **not an indefinite heap-bounded or leak-free process claim**. Any future pruning needs cursor/commit correctness and its own validation, not an arbitrary history cap.

Reproducible records:

- [Combined provenance and progress record](evidence/bounded-four-ball-gpu-shot-service.json).
- [Unmodified full-run result](evidence/bounded-four-ball-gpu-shot-full-9373cf5.json) and [TAP/progress log](evidence/bounded-four-ball-gpu-shot-full-9373cf5.log).
- [Unmodified first-h-only result](evidence/bounded-four-ball-gpu-shot-smoke-9373cf5.json) and [log](evidence/bounded-four-ball-gpu-shot-smoke-9373cf5.log).

The later evidence/probe commit does not change any service, importer, solver, comparison or shader source tested at that SHA.

### Cloud browser capability is a separate result

A supported-CUA check of standard APIs in the agent's actual Chromium 155 observed `navigator.gpu` in a secure localhost context, but **both `requestAdapter()` and `requestAdapter({forceFallbackAdapter: true})` returned null**. No GPUDevice, shader dispatch, import or physics run was created for this check. No security flags or permissions were changed. The owned probe tabs/server/terminal were closed; the existing application window was preserved. See the [capability evidence](evidence/bounded-four-ball-browser-gpu-availability.json) and the standalone `tests/browser-gpu-availability.html` probe (append `?fallback=1` for the explicit standard fallback query).

Thus native software Dawn validation succeeds, while actual browser GPU execution remains unavailable in this observed cloud-browser configuration. The service must remain unsupported there; it must not silently select a CPU backend or treat the native result as browser integration proof.
