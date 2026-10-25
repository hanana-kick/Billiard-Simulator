# Live three-ball cue initialization: bounded pre-collision increment

This implements **only source-created cue preprocessing**, not a complete first
physics substep, live evaluation service, or full-shot CPU/GPU parity.
`requireLiveThreeBallNumericalOwner()` still throws. The new owner also rejects
`step()` with `three-ball-live-first-substep-unavailable`.

## Scope

`src/browser-initial-import/live-three-ball-initialization.mjs` first uses the
unchanged strict read-only three-ball importer, then shares the registered cue
initialization projection with the existing four-ball importer. The shared
projection explicitly selects `three` or `four` provenance and exact capacity;
it never relabels three-ball data as four-ball or changes rule semantics.

- Actual source registry order, selected cue index, target IDs and game state
  survive unchanged. Cue 2 remains registry index 1.
- Complete original native state remains available as `initialNative`. This is
  explicitly the **initial** state, not a manufactured post-step snapshot.
- Existing spheres retain original state, IDs, sleep membership and caches.
- Fresh cue mass extents, world COM, inverse mass/inertia and collider transforms
  use the existing unchanged f32 reference/WGSL arithmetic component.
- Registration uses the existing exact host-u32 allocator/connectivity code,
  with distinct three-ball provenance validation. Sleeping sources can allocate
  their real new awake cue chunk without force-waking/reindexing existing balls.
- No original controller, rules or CPU physics implementation is modified.

The initialization result is pre-collision. It contains source registration
queues/joint connectivity effects still awaiting the real broad/contact phase.
Do not pass it to legacy collision finalization, a constructor three-ball world,
or any four-ball world. Do not call preserved initial caches evolved state.

## Transactions

`createReferenceInitializationOwner(decoder, raw)` and
`createGpuInitializationOwner(device, decoder, raw)` expose `prepare`, `commit`,
`abort`, `snapshot`, `dispose`, and a deliberately unsupported `step`.

Inputs are copied and byte verified through the existing importer. Preparing
never changes committed state; abort and cancellation discard the draft. The
GPU path requires an actual same-realm GPUDevice, uses real shader dispatch,
and has no CPU fallback. Cancellation after submission waits for the submission
to finish, then rejects without a commit. Exactly one initialization may commit.
The caller owns the device and decoder, while the owner frees its GPU component.

## Verification

`tests/live-three-ball-initialization.mjs` uses the existing genuine default and
after-turn captures. Native mass/transform recomputation is assertion-only and
never supplied to candidate construction. Bounds match the existing component
acceptance: COM/inertia/transforms 3e-6; inverse mass/extent/thickness 2e-6.
Actual WGSL is additionally compared exactly against the f32 reference outputs;
registration output is compared exactly between backends. This does not prove
registration equality to a complete original post-substep manager.

CPU command:

```sh
node --max-old-space-size=128 --test tests/live-three-ball-initialization.mjs
```

GPU opt-in (run serially with other native GPU tests):

```sh
REQUIRE_WEBGPU=1 GPU_NATIVE_MODULE=/absolute/webgpu/index.js \
node --max-old-space-size=128 --test tests/live-three-ball-initialization.mjs
```

Missing GPU prerequisites are not a GPU pass. Chromium and complete app UI
verification remain outside this increment; the previously denied Chromium
route was not retried. No publication or deployment is part of these tests.

## Next integration

Explicit live three-ball source admission for cue broad-phase insertion and the
shared contact journal must consume this exact initialized registration. Then
implement the collision-complete initialization receipt, scene activation and
first-substep numerical solve. Only after both source turns match independent
original CPU and actual WGSL may a bounded evaluation service consume the owner.
Full-rest evaluation is a later gate, not inferred from this initialization.

### Recorded local verification, 2026-10-25

- New CPU tests: 3 passed, zero failures.
- New actual WGSL tests: 3 passed, zero failures, 4.05 seconds, using
  `webgpu@0.6.2` and Vulkan SwiftShader
  (`VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json`). This is real shader
  execution on a software Vulkan implementation, **not hardware-GPU evidence**.
- Existing initialization/origin regressions: 28 passed, one explicit GPU opt-in
  skip. Their original native decoder and creation artifact were provided.
- Existing live four-ball placed/settled/awake imports: 3 passed with their
  unchanged exact native-body/cache and provenance checks.
- `npm run build`: passed. Full app browser/UI suites were not run here.

Evidence logs are in the local workspace directory
`../three-ball-live-reverification/`. An initial regression invocation omitted
required native-decoder/artifact environment variables; the configured rerun
passed. No acceptance bounds or existing test assertions were relaxed.

The next [collision-preparation checkpoint](live-three-ball-collision.md) now
adds family-bound broad/contact admission and a branded collision-complete,
pre-energy initialization receipt. It still cannot commit a physics substep.
