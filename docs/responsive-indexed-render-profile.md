# Same-input CPU render profiling and indexed-vertex comparison

2026-10-23. Follow-up to prior cloud pointer observations. This closes the render-cost attribution gap, not the physical-device or low-latency acceptance gap.

## Result and source scope

- Instrumentation-only commit: `61b0c22`. It retains at most 60 presented input traces, linked by input revision and worker sequence where applicable. No extra normal-UI diagnostics.
- Indexed-vertex commit: `5bb945f`. Only bit-identical Float32 position **and normal** tuples are reused within a draw command. Triangle order, depth testing, material/shading arithmetic, geometry, camera behavior, supersampling policy and output resolution are unchanged.
- The CPU input workload transforms 12,471 vertices instead of 65,112. The moving/hidden-cue test fixture transforms 10,959 instead of 58,968. These are operation counts, not speedup factors.
- No flat-pixel arithmetic change, static raster cache, quality reduction, physics/search edit, worker scheduling change, external push or deployment was made.
- The retained, matched browser comparison observed approximately 20% lower mean CPU render time. This is a small cloud sample, not a reliable general-device speedup guarantee or a low-latency pass. Orbit still took 108.7 ms to render its final input, and an earlier optimized run took 130.0 ms.

## Fixed workload and evidence integrity

The real application ran in an iframe of 1100×620 CSS pixels, with the sidebar closed, a 1068×424 canvas and 1600×635 software raster. Both builds used the same instrumentation and same application bundle, differing only in `mesh` and `drawCommand`. The baseline restores the original algorithms, with the same timing/operation counters.

Local comparison HTML SHA-256:
- Before: `41cfb3c608fec075fbf1df91ed56e8654cb4276dbac2c1e767e96f20be425125`.
- Indexed: `59ff4145de038ccc3a1bcf371e01390e13d1b8a9b3817153866bdba958686b6e`.

Both began at top view (yaw 0, pitch 1.5706963, orthographic, zoom 1), default three-ball positions, angle 0°, elevation 8°, speed 2, zero shots/time/undo/redo, with prediction ON and loaded Korean font. The same native CUA drags were performed from freshly inspected application screenshots:

1. Forward line (530,475) → (540,430), ending at angle −28.9954061184°. Eight handled input revisions and eight matched canvas completions.
2. Floor (100,380) → (170,330), ending at yaw −0.42 and pitch 1.2706963268. Eight additional handled input revisions and eight matched completions.

Positions, other shot settings, shot count/time, and history remained unchanged. Both ended without active gestures, horizontal overflow or removed overlays. The same world/canvas objects were preserved. Prediction was still computing at both immediate aim snapshots and had settled to the same forecast status at both orbit snapshots.

A runtime interruption erased the first pair's temporary baseline result storage. The potentially interrupted optimized orbit was **queried before retry** and was found complete (16/16); it was not dragged again. Its [recovered trace](validation/cloud-indexed-after-2026-10-23.json) is kept as variability evidence, not paired with a fabricated baseline. A new bounded before→after comparison was then performed and each raw result saved to files immediately. All averages below come only from that retained pair.

| Build | Initial state | After aim | After orbit (all 16 samples) |
|---|---|---|---|
| Before | [JSON](validation/cloud-indexed-before-start-repeat.json) | [JSON](validation/cloud-indexed-before-aim-repeat.json) | [JSON](validation/cloud-indexed-before-orbit-repeat.json) |
| Indexed | [JSON](validation/cloud-indexed-after-start-repeat.json) | [JSON](validation/cloud-indexed-after-aim-repeat.json) | [JSON](validation/cloud-indexed-after-orbit-repeat.json) |

Only owned cloud tab 253 and the existing localhost:8765 server were used. The owned tab was closed and CUA released. Other tabs, server configuration, browser sandbox settings and user Windows were untouched. The comparison used native CUA pointer drags, not injected JavaScript pointer events or controller mutations. The developer harness only sized/inspected the app; the separate cap test deliberately forced dirty frames.

## Same-input latency decomposition

Means in milliseconds, eight presented input samples per gesture per build:

| Build / gesture | Dispatch | Handler | Handler end → render start | CPU render | Static commands | Dynamic commands | Event → canvas |
|---|---:|---:|---:|---:|---:|---:|---:|
| Before aim | 81.21 | 0.25 | 1.18 | 76.47 | 59.70 | 11.89 | 159.12 |
| Indexed aim | 56.90 | 0.20 | 1.11 | 61.16 | 47.46 | 7.40 | 119.39 |
| Before orbit | 105.77 | 0.14 | 0.55 | 116.02 | 96.61 | 12.96 | 222.49 |
| Indexed orbit | 85.06 | 0.17 | 0.39 | 92.15 | 79.55 | 8.33 | 177.78 |

CPU render means decreased by 20.0% (aim) and 20.6% (orbit) in this retained pair. The total input-to-canvas intervals also decreased in this pair, but dispatch is separately reported and can vary with cloud/browser scheduling. The preceding optimized run's final orbit render was 130.0 ms, versus 108.7 ms in the retained repeat. Do not present these values as a stable hardware benchmark or claim platform/transport delivery was improved.

Last sample **ID 16**, all stages belonging to that event:

| Stage | Before | Indexed |
|---|---:|---:|
| Event timestamp | 31096.3 | 35311.8 |
| Handler start / end | 31221.6 / 31221.7 | 35419.8 / 35420.0 |
| Render start / canvas complete | 31222.3 / 31344.3 | 35420.1 / 35528.8 |
| Dispatch | 125.3 | 108.0 |
| Handler | 0.1 | 0.2 |
| Handler → render | 0.6 | 0.1 |
| CPU prepare | 2.6 | 2.7 |
| Command construction | 0.2 | 0.1 |
| Static raster | 106.8 | 98.2 |
| Dynamic raster | 10.9 | 6.3 |
| Shadows / blit / overlay | 0.7 / 0.6 / 0.2 | 0.8 / 0.5 / 0.1 |
| CPU render total | 122.0 | 108.7 |
| Event → matching canvas | 248.0 | 217.0 |

Stage timings use `performance.now()`; event timestamps are normalized to that clock. Small gaps are timing/loop overhead. Static raster includes floor/table/rails and 20 inlay spheres, while dynamic raster includes objects/cue. No claim is made that all static time was vertex work: pixel filling remains substantial.

**Causal evidence:** Before sample 16's event timestamp (31096.3) falls inside sample 15's synchronous CPU render (31094.2–31214.4), so the main thread could not dispatch it until that render returned. Across the retained pairs, 14 of 15 adjacent-before and 13 of 15 adjacent-indexed event timestamps overlapped the preceding sampled render; the gesture-boundary pair is included in these denominators. This establishes our synchronous renderer as a contributor to delivery delay, not just an unexplained platform delay.

All 16 handled revisions were presented in each build and all recorded gate-skips were zero. Handler-to-render waits were short. This CPU path has no worker bitmap to become stale. These observations do not support stale-worker presentation or the 30 FPS gate as the dominant cause of this workload's latency. They do not rule out browser/OS coalescing before handler delivery or measure transport time before `Event.timeStamp`.

## Image and depth equivalence

`tests/responsive-performance-raster.cjs` compares **every RGBA byte and every Float32 depth-buffer byte** against the original mesh/draw implementation, not a tolerance or visual impression. It covers top/3D/side view, fractional aim, elevation, resize, orbit, and moved/raised balls. The actual slow-screen size (1068×424 CSS, 1600×635 raster) and orbit camera were added explicitly and passed.

The reference freezes the two changed algorithms while retaining common render/timing code. It is valid for this indexed-only change; any later pixel-loop change must separately freeze the old pixel-loop implementation.

Additional real-browser read-only FNV-1a-32 fingerprints matched at all three states:

| State | Software color | Software depth | Full canvas including overlays |
|---|---|---|---|
| Initial | 750ba468 | 70ba2490 | 166985d6 |
| Aim | e4905c91 | da10d2a9 | 762516f6 |
| Orbit | 58216e02 | 64bee892 | 37e6e5a4 |

FNV fingerprints are non-cryptographic corroboration, not a replacement for the exact byte tests. Raster dimensions and actual canvas dimensions matched in every snapshot. No supersampling, shading, triangle or overlay was removed to obtain the timing difference.

## Cap and regression checks

- [Optimized CPU forced-dirty cap measurement](validation/cloud-indexed-cap-2026-10-23.json): 88 actual canvas completions in 10,214.5 ms = 8.615 FPS, below 30 FPS cap (elapsed-time allowance 308 frames). Prediction OFF only for this separate forced-load check. This confirms the upper bound, **not** achievement of 30 FPS. The workload remains render-bound.
- Final targeted command: `node --test tests/responsive-performance.cjs tests/responsive-performance-raster.cjs tests/render-service.cjs tests/frame-cap.cjs tests/controller-render-cap.cjs tests/direct-input.cjs`.
- Result: 46 passed, 0 failed, exit 0; [complete log](validation/responsive-indexed-targeted-test.txt). Includes matching worker revision/sequence, cancellation/resize/history, cap, bounded traces and exact image/depth checks.
- Instrumentation-only checkpoint: 44 passed, exit 0.
- Final `npm run build && npm run typecheck`: both passed, exit 0 after commit `5bb945f`.
- Parent integration/full-suite rerun is separate and must be recorded against its integrated commit. This branch's targeted checks do not replace it.

Not verified here: real Samsung/Fold hardware, physical touch-to-photon or display scanout, the full real-app browser suite, actual worker-WebGL browser latency, long-duration/distributional performance across devices. CPU canvas completion excludes compositor/physical display. The result is an evidence-backed, quality-preserving reduction in redundant CPU transforms and a limited observed render-time improvement; substantial orbit/input latency remains.

