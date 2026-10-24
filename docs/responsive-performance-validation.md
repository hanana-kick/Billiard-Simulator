# Responsive input and render diagnostics

Cloud-only work on `research/responsive-next`, based on `130657a`, 2026-10-23 UTC. No user Windows/remote desktop was accessed. No push or deployment.

## Changes

- Pointer diagnostics retain the input revision with each worker request and report a sample only when that matching bitmap is drawn to the visible canvas. Worker submission and worker response are not counted as presentation. A newer pending input is not incorrectly attributed to an older bitmap.
- `cueLab.inputMetrics` remains developer-only. `lastDispatchMs` measures event timestamp to handler entry, `lastHandlerMs` measures synchronous handler work, and `lastInputToCanvasMs` measures event timestamp to the matching canvas rendering call. The old `lastInputToFrameMs` name remains an alias for compatibility.
- `lastBoundary` distinguishes `cpu-render`, `worker-bitmap-draw`, and `webgl-command-submit`. Main-thread WebGL metrics do **not** wait for GPU completion. None of these metrics measure compositor presentation, physical display scanout, hardware touch latency, or touch-to-photon latency. Coalesced inputs use the latest represented input revision, not every dispatched pointer event.
- `renderMetrics.frames` is the accepted render-gate count; `renderMetrics.presentations` counts completed canvas rendering calls. Existing 30 FPS CPU / 60 FPS WebGL-worker caps remain unchanged. These are maximum limits, not promises of sustained performance.
- A real viewport dimension change cancels in-progress gesture coordinates and clears pinch/touch state, without resetting committed world/settings/camera/history. A cancelled ball move rolls back once even through repeated sidebar-width transitions. Cancelled forward/rear/fine/elevation aim restores original settings and redo history.
- No normal UI diagnostics, overlays, fullscreen controls, visual redesign, or physics/search changes were introduced.

## Verification

Passed on final source:

`node --test tests/responsive-performance.cjs tests/frame-cap.cjs tests/controller-render-cap.cjs tests/render-service.cjs tests/direct-input.cjs`

43 tests passed, including 11 new regression cases. The new tests cover worker timing attribution, cancellation/hidden stale samples, event clock normalization, CPU/WebGL shared cap gates, seven projection aspect ratios, real Rapier state preservation, repeated resizing with exactly one ball rollback, and four aiming cancellation modes. The fixtures do not claim real-device or browser-display latency results. See [targeted output](validation/responsive-performance-targeted-test.txt).

`npm run build` and `npm run typecheck` passed before the final diagnostic boundary-label/comment addition. Final source also passes syntax checks and `git diff --check`. The parent owns the final integrated build/typecheck/full-suite rerun.

Four new real-app Playwright cases are in `tests/e2e/responsive-performance.spec.cjs` (including the two cancellation variants). They were authored and syntax-checked but **not executed** in this task. The existing full browser suite was not rerun. An earlier shell Chromium sandbox/socket denial was respected; no sandbox weakening, alternate launch bypass, or Windows fallback was attempted.

### Aggregate Node suite, not a pass

Exact command: `npm test`

Expanded first stage:

```
node --test --test-concurrency=2 tests/physics.cjs tests/accuracy.cjs tests/repair-v5.cjs tests/optimizer.cjs tests/route-families.cjs tests/official-ui.cjs tests/search-repair-v8.cjs tests/ui-inventory.cjs tests/four-ball.cjs tests/four-ball-search.cjs tests/table-geometry.cjs tests/physics-invariants.cjs tests/search-options.cjs tests/render-service.cjs tests/search-motion.cjs tests/worker-pool.cjs tests/four-ball-integration.cjs tests/frame-cap.cjs tests/controller-render-cap.cjs tests/seo.cjs tests/inverse-solver.cjs tests/inverse-integration.cjs tests/cue-feasibility.cjs tests/direct-input.cjs tests/tip-inverse.cjs tests/contact-transfer.cjs tests/planar-rail-inverse.cjs
```

It exited 1 after 40.356 seconds: 208 reported tests, 205 pass, 3 file-level failures:

- `tests/inverse-integration.cjs`, 10.123 seconds, `'test failed'`.
- `tests/optimizer.cjs`, 7.389 seconds, `'test failed'`.
- `tests/planar-rail-inverse.cjs`, 1.957 seconds, `'test failed'`.

The spec reporter exposed no assertion stack, child exit code, or child exit signal for these three failures. No specific signal or OOM cause is established by this log. Resource pressure is only a possibility, not a verified diagnosis. The chained `node --test tests/deterministic-workers.cjs` did not run because the first stage failed. The exact captured output is [here](validation/responsive-performance-full-test.txt). Further heavy reruns were deferred to the parent’s sequential integrated validation slot.

### Actual cloud browser smoke, limited scope

The built isolated application was served through the existing shared localhost server. Only owned cloud tabs 239 and then 240 were used. Tab 239 disappeared after a CDP input timeout; the documented one-time recovery created tab 240, and no unrelated tabs were touched. Tab 240 was closed after reading the result.

Observed with the actual application in `tests/manual/responsive-performance.html`:

- CPU fallback renderer, Korean Pretendard font loaded.
- CSS iframe viewports 344×882, 768×960, and 844×390 preserved the same world, canvas, settings, camera, history, selected panel, shots, and time against a saved baseline.
- Each had no document horizontal overflow and zero removed cue/fullscreen overlay elements.
- A 10.0593-second dirty-render measurement completed 213 CPU canvas frames, average 21.1744 FPS, below the 30 FPS cap (boundary-tolerant limit 303).
- Input events during that measurement: 0. Therefore no actual browser input-latency or pointer-cancellation pass is claimed from this smoke.

These are cloud browser / CSS viewport observations, **not Samsung Fold or other physical-device validation**. Actual 60 FPS WebGL-worker browser behavior, hardware responsiveness, and the full real-app UI suite remain unverified here. The new manual harness and Playwright cases provide the next validation path without adding diagnostics to the normal app.
