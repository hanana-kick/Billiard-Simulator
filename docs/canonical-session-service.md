# Experimental selected-shot session service

`src/direct-candidate/canonical-session-service.mjs` is an opt-in orchestration adapter. It does not modify manual play, forecasts, optimizer search, application defaults, or deployment.

## Real backend path

`createCanonicalSessionService({device})` uses the actual raw/world GPU factory and the resident-source trace hydrator. It does not substitute CPU physics, Rapier replay, final-state interpolation, or a successful example trajectory. The service owns immutable scene/request/candidate identities and a monotonically increasing epoch.

`runSelected` accepts:

- `request`: arguments for `createCanonicalRequest`, excluding `epoch` (the session assigns it).
- `candidateId`, `settings`: one candidate and its five unmodified raw strike settings.
- `raw`: explicit original `absoluteTick`, opaque `sceneKey`/`requestKey`, and optional component `maximumSteps`.
- `continuation`: bounded local solver settings (`durationTicks`, seven `budgets`, `maxWorldSteps`, optional existing component settings).
- `maximumRecords`: source snapshot cap 1–512, default 128.
- `strikeBackend`: existing `staged` default or explicit `chunked-16`.
- `signal`: optional caller cancellation.

The default source-capture profile remains canonical-local MMQ1 without cushion continuation. An explicit factory opt-in enables MMQ2 finite-cushion source capture:

```js
const session = createCanonicalSessionService({device, selectedWorldProfile: 'mmq2-cushion'});
```

The default profile name is `mmq1-ball-ball`. The profile is immutable for the owner lifetime, appears in `session.selectedWorldProfile`, capabilities, and every receipt. MMQ2 receipts additionally include `identity.selectedWorldProfile`; MMQ1 identity remains backward compatible. Consumers comparing full canonical identities must explicitly support the new discriminator before accepting MMQ2. Neither the application adapter nor UI opts into it.

For MMQ2, omitted continuation motion/cushion options become `mixedMotionRevision: 'mmq2'` and `enableCushionContinuation: true`. Conflicting options or `request.selectedWorldProfile` fail with `UNSUPPORTED_SESSION_PROFILE`; create a different owner instead of switching a live session. MMQ2 uses the real world GPU factory, `runRaw`, and `hydrateCanonicalSelectedV2GPUTrace`, never the prepared-world hydrator. Public raw receipts reject host-prepared, unverified raw identity, or non-GPU provenance.

Both profiles require allow-kiss rules and no early condition-only termination. Unsupported candidate settings return an explicit unsupported receipt before compilation; unsupported session profiles throw a named contract error. Other original raw/scene/domain admission failures remain explicit errors. Nothing is clipped or silently retried on a different physical model.

Each attempted call supersedes the preceding epoch, including a replacement rejected as an unsupported profile. Compile, submit/readback, and hydration boundaries revalidate the epoch. Heavy work is serialized within this session owner: an older uninterruptible GPU compilation must settle before the next one starts. Cancelled queued requests never compile. This is not a cross-session/device scheduler or a shader cache; repeated calls still create request-bound engine instances.

## Returned data and presentation

The selected result exposes separate `physicsResultComplete`, `captureComplete`, and `samplingComplete` flags. It provides guarded `readCompact()`, `readFinalState()`, `sample(tick, options)`, and `assertCurrent()` methods. Returned word arrays are independent copies. Supersession, explicit cancellation, caller-signal cancellation, or disposal invalidates later access.

`sample` evaluates only retained original source representations. Depending on the interval, it returns an exact boundary/source, a bounded source interval/reference, or an unsupported/unavailable result. Source equation evaluation is not a second shot simulation. It is also not universally exact point sampling. Consumers must not render unavailable or bounded results as precise canonical trajectories. Raw contact interiors and some composite microtail interiors remain unavailable as exact points.

A raw handoff failure exposes `readRawStatus()` and no gameplay score. Incomplete/unsupported world results retain their original compact packet; the service never invents PASS, MISS, or REST. Full roster, candidate, source keys, clock range, and physical-rest status are checked before hydration.

## Explicit limitations

- One selected candidate only. This is not the parallel search-batch adapter.
- No checkpoint export/restore, production switch, or application event-handler wiring.
- Time enforcement is forwarded from the original producer. Cumulative request work/event accounting remains false.
- Physical hardware is not inferred from the existence of a WebGPU device.
- Engine and source-component native parity tests do not automatically qualify this wrapper.

## Validation

`tests/canonical-session-service.mjs` uses an explicitly labelled `injected-test` runtime. Fifteen lifecycle tests pass, including supersession at compile/run/hydrate boundaries, cancellation, ownership, incorrect identity/rest rejection, raw failure, and bounded concurrent lifetimes. These are not GPU physics tests. Type checking passes.

`tests/canonical-session-service-native.mjs` is a separate actual WebGPU service test. It compares the complete goal result state and compact packet with an independent CPU reference, verifies the retained final source boundary, and checks cancellation of returned access. It skips unless `REQUIRE_WEBGPU=1`. The actual service test passed on software Vulkan/SwiftShader on 2026-10-27: all 256 final state words and four compact words exactly matched the independent CPU reference; 78 source records hydrated and the original final boundary matched exactly. This is one selected GOAL fixture, not arbitrary-case or application qualification.

The bounded separate process completed in 73.543 seconds with sampled aggregate RSS 1091.53 MiB and maximum-child RSS 1053.82 MiB (limits 180 seconds / 1500 MiB). No watchdog stop occurred. Native log: `/tmp/canonical-session-native-goal.log`. These are software-renderer end-to-end process measurements, not hardware throughput or isolated shader timing.


`tests/canonical-session-service-v2-native.mjs` is a separate opt-in actual-WebGPU raw-cushion service qualification. It compares all final state and compact words with the independent CPU reference and checks the exact final source boundary, completion flags, profile identity, and cancellation. It skips unless `REQUIRE_WEBGPU=1`; a skipped test is not native qualification.

The actual opt-in MMQ2 service test passed on software Vulkan/SwiftShader on 2026-10-27: one raw shot reached one cushion and full rest; all 256 final-state words and four compact words exactly matched CPU; 31 original GPU source records hydrated with an exact final boundary. Physical completion and capture completion were true, while universal exact interior sampling remained false. Returned access was invalidated by cancellation. This qualifies this fixture through the service, not UI integration, arbitrary trajectories, or physical GPU hardware.

The run held `/tmp/billiard-native-gpu.lock` with `/tmp/canonical-native-bounded-v2.py` inside the lock, limits 240 seconds / 1500 MiB. It passed in 152.383 seconds, sampled aggregate RSS 1359.02 MiB, maximum child RSS 1322.23 MiB, no watchdog stop. Log: `/tmp/canonical-session-service-v2-native.log`. These are software-renderer process measurements, not hardware throughput.

## Guarded original submission

Selected-result receipts expose `readSubmission()`: the exact immutable
session-created request and candidate plus owned immutable original raw settings.
The accessor uses the same epoch/cancellation guard as final-state reads. Callers
must not guess a future epoch. The stored application adapter can explicitly
commit a complete manual result using this tuple and strict source-revision,
context and atomic store guards; the session itself never commits state or game
score/turn changes. Unsupported/raw-incomplete receipts do not gain commit data.
