# Experimental bounded four-ball dedicated worker

## Boundary and non-claims

The new `src/bounded-gpu-shot/four-ball-worker-client.mjs` is an explicit opt-in transport for the **unchanged** bounded actual-GPU service in `four-ball.mjs`. Nothing selects it in the product, changes existing modules, or broadens the admitted shot. Only the original constructor-72 → default first four-ball strike → synchronous raw initial snapshot/capture is supported. Arbitrary cue settings, later shots and general CPU/GPU parity are not established.

The dedicated worker owns the read-only WASM decoder, importer, single private branded-hull authority, imported seed, actual same-realm GPUDevice, and existing GPU world. The main thread posts a copied `{snapshot, capture}`, bounded budgets and IDs, never a seed, hull, decoder, device, expected trajectory, or native physics object. Both sides copy and validate raw inputs. Plain-data accessors/symbols and shared or hidden host storage are rejected before replacement. Typed-array backing buffers and lengths are read through captured intrinsic getters, including cross-realm shared-buffer checks; ignored custom typed-array metadata is stripped by structured clone without invoking its accessors. There is no transfer list, shared-memory alias, CPU replay, native restore, runtime source-string evaluation, or CPU fallback.

Moving the synchronous WASM decode/projection into this realm removes that work from the main-thread transport. It does **not** make source capture or structured-clone copies nonblocking, guarantee frame latency, or make an atomic GPU h preemptible. Browser-worker WGSL execution and UI responsiveness still need direct evidence; the existing native Dawn full-rest result is not that evidence.

## Build-trusted local assets and source order

Use a standalone, locally served copy of the source modules. The worker loads three fixed sibling build assets:

- `four-ball-worker-assets.json`: schema `bounded-four-ball-worker-assets-v1`, the admitted decoder build provenance, and independent application-pinned `expectedWasmSha256`.
- `four-ball-worker-engine.bin`: actual pinned engine source bytes, used **only for hashing**, never executed by this worker.
- `four-ball-worker-decoder.wasm`: the admitted import-free read-only WASM build.

Those assets belong to the trusted application build, not an operation or uploaded capture. The existing decoder verifies provenance, pinned engine/WASM hashes, zero WASM imports, ABI bounds, native byte roundtrip and JavaScript re-encoding. Do not turn caller-provided provenance into build authority.

`four-ball-worker-runtime.mjs` first imports the existing initial importer, establishing its sole topology module instance. It then awaits every runtime source import in the exact dependency order derived from `tests/browser-live-initial-four-ball-page.cjs`, excluding a second topology evaluation. The source gate independently executes that generator's trusted traversal and compares the complete list. It also checks the classic-script globals in a fresh source-only VM without invoking physics. Finally it imports the unchanged bounded GPU service, whose world import reuses the same module instance. Loading an extra topology script or cloning hulls would lose authority and is prohibited.

No renderer/original PhysicsLab/controller is initialized inside the worker. The modules are copied at their relative source paths by the dedicated generator, not added to the product build. A future bundler must preserve this singleton and dynamic module order; this patch does not claim an arbitrary bundler works.

## API

```js
import {createBoundedFourBallWorkerClient} from './src/bounded-gpu-shot/four-ball-worker-client.mjs';
const client = createBoundedFourBallWorkerClient({onProgress(view) { /* optional */ }});
const availability = await client.ready;
if (availability.status === 'ready') {
  const operation = client.start({snapshot, capture}, {
    signal: abortController.signal,
    budget: {maxSteps: 256, maxWallMs: 1000}
  });
  let result = await operation.result;
  if (result.status === 'budget-suspended') {
    result = await operation.resume({budget: {maxSteps: 256, maxWallMs: 1000}});
  }
  // Resume explicitly for further bounded slices, or cancel/dispose.
  await operation.cancel();
  await operation.finished;
}
await client.dispose();
```

`ready` resolves to `ready`, `unsupported`, `device-lost` or `failed`. A loss observed during bootstrap cannot produce a misleading ready receipt. `navigator.gpu` absent or the standard default `requestAdapter()` returning null is `unsupported`; no decoder execution, shader work or CPU replacement follows. No fallback-adapter request, security flag, browser setting or permission change is made. A real same-realm `GPUDevice` remains mandatory in the unchanged service.

Start requires `ready`. Each operation exposes `id`, `result` (first bounded slice), `finished` (terminal result), synchronous cached `snapshot()`, asynchronous `progress()` (request a fresh snapshot), `resume({budget})`, and idempotent `cancel()`. `client.snapshot()` is always the latest requested operation, never a stale owner. `onProgress` receives detached snapshots at queued/terminal boundaries and slice/snapshot responses; it is not a per-h polling timer. Callback failures cannot affect work. All ID-bearing responses preserve the original state/events/scoring/resource view; only the service-local operation ID is mapped to the transport operation ID.

Budgets retain the existing exact limits: 1..4096 committed h, positive wall milliseconds up to 30000, defaults 256 h / 1000 ms. They never change h, dt, iterations, physics parameters or scoring. `budget-suspended` is nonterminal and retains its owned world. Only the active idle suspended operation can resume; concurrent resume is rejected before posting. A pre-aborted signal is carried in the start request and performs no initialization.

The protocol uses a unique session ID, strictly increasing request/operation IDs and monotonically increasing operation revisions. Foreign sessions, duplicate/out-of-order requests and old replies are ignored. Superseded operation results can still settle their own promises, but cannot overwrite the latest operation. Terminal receipt is acknowledged with release, so completed host operation records are not accumulated indefinitely. Already-sent cancel/snapshot requests arrive before that FIFO release.

`deviceLost` is an availability notification, **not a premature terminal result**. The service's atomic construction/h must drain before `operation.finished` reports `device-lost`. The worker never recreates a device or changes backend automatically.

`dispose()` is idempotent. It blocks new work, awaits pending initialization and existing service disposal, then destroys its own device. Only after the drained reply does the main client terminate the worker. Unlike the existing borrowed-device service, this dedicated worker owns the device it created. Abrupt worker/message failure settles outstanding work as `failed`; it reports `cleanupVerified: false` rather than claiming GPU cleanup or a committed state it could not observe. The last received state is retained for diagnosis, not continuation.

## Focused verification

```sh
node --test tests/bounded-gpu-shot-worker-transport.mjs tests/bounded-gpu-shot-worker-source.mjs
```

The transport suite uses explicit lifecycle/physics doubles, not a GPUDevice. It covers copy isolation, bounded suspension/resume, exact terminal semantics, one in-flight h, supersession/stale messages, shared/host/accessor-data rejection, pre-abort and mid-h cancel, loss during h, construction/h drain before disposal, null adapter, and abrupt failure. The separate Node Worker test uses a **real isolated thread with doubled physics**, proving transport/realm behavior only. Source-only loading and a mocked null adapter likewise do not execute shaders.

A local actual-browser harness can be prepared without engine/native/GPU work:

```sh
RAPIER_WASM_PROVENANCE=/absolute/admitted/snapshot-wasm-decoder-provenance.json \
BOUNDED_WORKER_PAGE_DIR=/new/absolute/workspace/worker-page \
node tests/bounded-gpu-shot-worker-page.cjs
```

The generator requires a new output directory, verifies every pinned decoder source plus engine/WASM bytes, and copies only local assets. It performs no browser launch, upload or deployment. Serve the printed directory on a separately owned localhost server, then use **Check worker GPU capability** in the agent's supported cloud browser. Preserve unrelated tabs/servers. An unsupported result is useful capability evidence, not a test failure to bypass and not a GPU pass.

If that browser supplies an actual adapter, the page optionally accepts the original raw live-capture download and starts/resumes exactly one bounded h per click. It labels a committed h as a prefix only; no physical-rest/whole-shot parity claim follows. Full worker parity would additionally require all unchanged original h/checkpoint/event/score comparisons in an actual supported GPU run. No such run or full product UI test is implied by the fast tests or this harness.

## Observed capability checkpoint, 2026-10-24

The actual managed cloud Chromium 155 loaded the production dedicated-worker entry in a secure localhost context. Its standard default worker `requestAdapter()` returned null. The client reported `unsupported` / `worker-webgpu-adapter-unavailable`, with no WASM decode, GPUDevice creation, shader dispatch or physics h. The visible disposal control returned `{status:'disposed', drained:true}`. This establishes actual worker/bootstrap/message delivery and the correct unsupported path, **not browser GPU parity**.

The owned test tab, port-8795 server and new terminal were closed; unrelated terminal/application windows were not read or changed. No security flags, settings, manual CDP or user-computer access were used. See the [capability record](evidence/bounded-four-ball-worker-browser-capability.json) and [rendered screenshot](evidence/bounded-four-ball-worker-browser-capability.png). The record pins all generated local asset source hashes separately from the base commit.

Final focused check: 40/40 passed, comprising 17 worker transport/source checks and 23 unchanged service lifecycle/resource checks. All computation in these automated lifecycle tests remains explicitly doubled; the real Node worker test is transport evidence only. Full product/browser-GPU tests and the full native-Dawn service replay were not rerun by this worker patch.
