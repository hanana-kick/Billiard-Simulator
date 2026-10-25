# Retained pair / cloth flight admission

Scope: isolated four-ball experimental owner only. No public/default integration,
original CPU changes, tolerance changes, cached-manifold deletion, or future-state inputs.

## Original mechanism

The genuine settled layout is ball 1 (.9, 0), 2 (-.4, .4), 3 (1.25, 0),
4 (-.6, -.3), original controller angle 0, elevation 8, speed 4.5, centered tip.
The untouched engine first collides ball 1 with ball 3 at native h309.

- h309 cue y=.030753308907151222, vy=.06453943997621536.
- h310 cue y=.030814772471785545, vy=.054320670664310455.
- h311 cue y=.030865589156746864, vy=.04410190135240555.
- h311 cloth collider 0/16: retained rigid manifold, zero points, zero solver
  contacts, GraphPos=4294967295. Ball 3 cloth collider 0/20 remains active.
- h311 sphere colliders 17/21: retained rigid manifold, zero points, zero solver
  contacts, GraphPos=4294967295.
- h312 sphere fat-AABB edge is deleted naturally by the original broad phase.

These facts were obtained from original native snapshots h307–313 decoded with
pinned read-only WASM decoder, not experimental-world observations.
Original full rest is h7228; further original sphere impacts are h374 and h4815.

## Bounded dispatch correction

A pair retained by broad phase with newly inactive cloth goes through the
existing source-coupled owner, rather than the continuous-cloth pair solver.
The common owner independently runs pair geometry, retains its empty manifold,
and selects integration only for active constraints. Here its selected component
is empty: each ball stays with its existing floor lifecycle, including free flight.
The continuous-cloth guard is unchanged. No pair-stage validation was changed.
Unsupported active constraints still fail through existing shared-owner gates.

## Accepted isolated evidence

Both independent runs completed **7,228 native steps through original physical rest**:

| Gate | CPU reference | Native WebGPU |
| --- | --- | --- |
| Body numeric comparisons | 636,064 | 636,064 |
| Maximum body deviation from original | 0 | 4.9829346625296543e-39 |
| Full native checkpoints | 13 | 13 |
| Maximum checkpoint deviation | 7.497713006010542e-9 | 7.497713006010542e-9 |
| Injected commit-preflight rollbacks | 4 | 4 |
| Independent sibling remains unchanged | pass | pass |
| Final physical rest/game | pass | pass |

Checkpoints: h307–313, h320, h374–375, h4815–4816, h7228. They reuse the
original complete graph, scene, activation, cache, proxy, solver roster, cue-cloth,
event and game comparison functions **verbatim**, including previously omitted
floor fields. Their source hashes are recorded. The assertion-only loader avoids
loading the native engine into the candidate process. Future snapshots are never
candidate inputs. Native angular samples are after original application resistance.

All per-frame body comparisons use 1e-6 (stricter than the established 3e-6
velocity/inertia bound); full checkpoint tolerances stay unchanged: poses 1e-6,
velocity/inertia 3e-6, caches/proxies 2e-6. No tolerance was widened.

Final bodies and game are exactly equal between CPU and GPU. This is **not**
bitwise equality of entire trajectories or final snapshots: the sole final numeric
difference is contactEvents[0].position.z, 2.407412430484045e-35, within the
unchanged original event-position gate. Three backend diagnostic strings differ.

Native WebGPU used Vulkan SwiftShader, not a hardware-performance measurement.
Peak logged RSS: CPU 876,015,616 bytes; GPU 1,059,303,424 bytes. Both exited 0,
and the GPU owner was released. Six lightweight source contracts also passed;
three optional native contracts were skipped (the independent full runs above
provide the new source evidence).

Workspace proof index: `artifacts/retained-flight-full/proof.json`. Original
snapshot artifact, CPU/GPU results, final states and logs are hashed there. Artifacts
remain local/untracked; no upload, push, deployment, or public/default integration.

Earlier interrupted attempts are retained: one duplicate long comparison exited
without an assertion or established cause; other attempts were explicitly stopped
for resource serialization or to add full native checkpoints. They are not passes.
A broader experimental pair-stage variant was discarded; accepted runtime changes
only the bounded four-ball dispatch, retaining all existing guards and owners.

## Reproduce serially

    mkdir -p artifacts/retained-flight-full
    INVERSE_OBSERVATION_SPEED=4.5 node --max-old-space-size=1536 tests/retained-flight-native.cjs artifacts/retained-flight-full/original-checkpoints.v8
    INVERSE_WORLD_EVIDENCE="$PWD/artifacts/retained-flight-full/original-checkpoints.v8" RETAINED_FLIGHT_RESULT="$PWD/artifacts/retained-flight-full/cpu.json" node --max-old-space-size=1536 --test tests/retained-flight-reference.mjs
    VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js REQUIRE_WEBGPU=1 RETAINED_FLIGHT_GPU_ONLY=1 INVERSE_WORLD_EVIDENCE="$PWD/artifacts/retained-flight-full/original-checkpoints.v8" RETAINED_FLIGHT_RESULT="$PWD/artifacts/retained-flight-full/gpu.json" node --max-old-space-size=1536 --test tests/retained-flight-reference.mjs
    node tests/retained-flight-proof.cjs

`RETAINED_FLIGHT_MAX_H` permits a declared bounded observation window, never a
full-rest claim. Acceptance above used the entire original horizon in both runs.
