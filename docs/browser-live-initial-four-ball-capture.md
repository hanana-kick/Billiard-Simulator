# Live original browser capture, initial boundary only

## What is connected

`src/browser-initial-import/live-capture.mjs` exports the synchronous function
`captureLiveInitialFourBall({R, PhysicsLab, LabController, signal})`. The two
constructors default to the original browser globals. Initialize the pinned
Rapier engine first. The function creates its own original controller and lab;
it does not mount a renderer, schedule animation, alter defaults, use an archived
snapshot, restore a world, or continue into the first application h.

The return value is `{controller, snapshot, capture, apiJournal, dispose}`:

- `snapshot` and `capture` are owned contemporaneous bytes/data suitable for
  `importInitialFourBall(decoder, {snapshot, capture})`.
- `apiJournal` is the complete actual observation, including constructor calls
  and the source strike's position-propagation call. Importer journals retain
  only the three mode-creation and thirteen cue-creation calls.
- `controller` is the actual unchanged live source owner. Its `lab.steps` is 0,
  but the separately observed native counter is 72. The controller is not
  automatically advanced while asynchronous decoding occurs.
- `dispose()` releases that source owner's lab and timers exactly once. Call it
  when the source owner is no longer needed. Source disposal cannot alter the
  copied capture. No experimental runtime or product backend is selected here.

Minimal composition, after loading the original application classes and the
single shared topology module:

```js
await RAPIER.init();
const live = captureLiveInitialFourBall({R: RAPIER});
try {
  const seed = await importInitialFourBall(decoder, {
    snapshot: live.snapshot,
    capture: live.capture
  });
  LabFourBallWorldExperimental.validate(seed);
} finally {
  live.dispose();
}
```

The decoder remains the build-pinned official-source browser WASM decoder,
initialized with actual bundled engine/WASM bytes and admitted provenance. No
new hull authority, fake admission callback, Node shim or cloned branded hull is
introduced. The existing importer independently checks bytes, provenance,
settings, registry bindings, material state and source creation descriptors.

## Observation and fail-closed lifecycle

Observation is installed on World before the original PhysicsLab constructor.
The exact accepted source sequence is 16 fixed body/collider pairs, three sphere
body/collider/collider triples, 72 World.step calls with no arguments, then
position propagation. Four-ball setup creates a sphere using three native
calls. Default fire propagates positions and makes the original thirteen cue
creation/configuration calls. Every wrapper forwards the original receiver,
argument references and result using Reflect.apply, recording arguments before
the native method executes. It does not reconstruct or replace any descriptor.

The observer patterns and registry/application capture are derived from
`tests/four-ball-created-fixture.cjs`. It records generation-bearing handle bits,
undefined, f64 negative zero, typed-view values and descriptor fields. Descriptor
accessors, including constructor getters, are never invoked. Application IDs,
labels, game snapshot, cue pose/statistics and events are copied from the source,
not synthesized. Source identity is not inferred from fixture labels or hashes.

The synchronous capture ends immediately after genuine `controller.fire()`.
It rejects missing observed methods, unexpected observed API order/counts,
foreign worlds, incorrect constructor native counts, nondefault parameters,
settings/timesteps, failed fire, noninitial state, unknown options, and overlapping
observations. It makes no promise to accept new source methods or generalized
settings; changes need an explicit new boundary and tests.

All prototype descriptors and inherited instance methods are restored in
finally, both on success and errors. The capture uses no abort-event listener,
RAF or timer. AbortSignal cancellation is checked before installation, at
observed calls/phase boundaries and before returning. A failure cleans up the
owned completed lab; if the original constructor fails before returning, only
the observed World is available for best-effort native cleanup. This is not a
replacement for exception safety inside the original constructor itself.

## Independent verification

`tests/browser-live-initial-four-ball-page.cjs` generates a standalone local page
from current source files and the existing admitted WASM build. It does not load
any archived snapshot, V8 fixture, seed or precomputed expected outcome.

It extracts the exact original `observeMethod`, `parts`, `objectRegistry` and
`applicationState` helpers, plus the original capture body only through its
strikeCreated checkpoint. The removed first-h continuation is never executed.
The resulting independent reference observer runs on a different actual source
instance. The browser test compares all snapshot bytes, the entire application
capture, every complete journal row and all preserved numeric types against the
new collector. A third source instance runs the original constructor/setup/fire
sequence with no wrappers at all and produces identical snapshot/application
state. A fourth instance verifies repeated capture. Import and unchanged
World.validate run against the live collector input, not the reference input.

The actual cloud Chromium 155 run passed on 2026-10-24:

- Four actual source instances; only the original 72 constructor steps per
  instance, zero application physics steps and no GPU work.
- Actual captured API journal length 131, mode creation 3, strike creation 13.
- New observation equals the independent original observation in full.
- Unwrapped source outcome, live state after import, and input bytes/data remain
  unchanged. Repeated capture is identical.
- Prototype descriptors and every created-body/joint observation shadow restore.
- Pre-cancellation and original constructor errors restore cleanly.
- Existing World.validate and the single shared hull authority both pass.
- Snapshot SHA-256: `cffbc79fdccfc6e763dfa6e72c78d84eca4ba1d050408b7e011192c18bf9413a`.
- Whole seed fingerprint: `0ee42731b1817a5a60e0e9c257aedc775af604f259da8a25260f2ef63d2162f0`.

These hashes are observed results, not accepted input keys. The full browser
result and tested source hashes are in
`docs/evidence/browser-live-initial-four-ball.json`.

## Reproduction

1. Have the existing pinned `vendor/rapier.cjs` bytes available.
2. Set `RAPIER_WASM_PROVENANCE` to the admitted
   `snapshot-wasm-decoder-provenance.json` from the existing decoder build.
3. Run `node --test tests/browser-live-initial-four-ball.cjs` for eight fast
   lifecycle/forwarding tests with JavaScript doubles, no native engine.
4. Run `node tests/browser-live-initial-four-ball-page.cjs`, serve its generated
   `.browser-live-capture-evidence/page` directory on an unused local port, and
   click **Run live source checks** in actual Chromium.
5. The successful page exposes **Download live capture evidence**. This downloads
   a tagged exact-data JSON object (use `unpack` from
   `tests/browser-initial-import-evidence.mjs`) containing the freshly observed
   snapshot/capture/full journal, decoder provenance, and tested source hashes.
   It is test evidence only, never a production input or an archived seed gate.
   The final local downloaded artifact hash is recorded with the browser result.
6. Existing import regression: `node --test tests/browser-initial-four-ball-import.cjs`.
   The final combined Node run passed 14 tests; the optional direct Playwright
   launcher remained skipped. The separate actual cloud Chromium run above is
   the browser evidence, not that skipped test.

No original source/runtime modules, product bundles, solver math or UI behavior
were edited. No shader work, whole-shot/native recapture, full product UI suite,
external upload, push, deployment, or user-computer access was performed. This
establishes live source capture and initial import/admission only, not CPU/GPU
whole-shot parity or a selectable product GPU backend.
