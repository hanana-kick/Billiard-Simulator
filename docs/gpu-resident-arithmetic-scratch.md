# Bounded resident arithmetic scratch

This change reuses actual GPU resources for recurring arithmetic stages. It is
not whole-world GPU state residence, parallel multi-shot simulation, or a change
of product backend/defaults. CPU and WGSL arithmetic, shader source, stage order,
physics, admission rules, and Rapier comparison tolerances remain unchanged.

## Migrated scope

- Source BVH scalar programs in `experimental-ccd-bvh-state.js`.
- World-to-BVH bounds evaluation in `experimental-ccd-bvh-world-bridge.js`.
- Cue broad-phase bounds/score/difference/overlap evaluation.
- Cue-cloth geometry evaluation.

The shared implementation is `createResidentGraph` in
`experimental-stage-runtime.js`. Existing callers that do not use it are
unchanged. The new helper keeps two program/index buffers and, after first use,
four input/scratch/output/readback buffers per stage. Capacity grows geometrically
within the explicit row bound and actual device binding limits. Old capacity
generations are destroyed. Bind groups are cached by logical row count only for
the current generation; there are at most `maxRows` groups per stage.

Every binding has an explicit logical byte range. Binding allocation capacity
would change WGSL `arrayLength`, row count, and scratch indexing, and would be a
physics correctness bug. A 35-row allocation followed by a 1-row dispatch binds
one row, dispatches one workgroup, and reads only one row's output.

Each call still uploads its packed input, creates one encoder, dispatches once,
copies one logical output range, and maps/readbacks once. An explicit logical
output clear prevents a failed dispatch from accepting a previous completion
marker. This is resource reuse, not dispatch/readback batching.

## Ownership and failure contract

- Input is synchronously copied into a new `Float32Array` before the first await;
  byte-offset views are supported, shared buffers are rejected, and returned
  arrays are detached from GPU mapping and later calls.
- Each stage has an exclusive busy lease. Concurrent reuse and disposal while
  busy reject. Distinct stage/device resources never alias.
- Validation error scopes are popped synchronously before yielding, so distinct
  stages cannot interleave their asynchronous scope lifetimes.
- Cancellation retires the entire scratch generation and rejects without
  returning stale results. A retry allocates a fresh generation.
- Device loss invalidates both busy and idle leases, destroys retained buffers,
  interrupts construction, and prevents further dispatch/construction.
- Partial allocation, bind, upload, encode, submit, map, validation, or mapped
  range failure retires the generation. Cleanup attempts every owned buffer;
  a cleanup error is attached to the original failure, and busy is always reset.
- Program/index buffers survive a recoverable per-run failure, but are destroyed
  on construction failure, device loss, or explicit disposal. No global buffer
  pool or cross-device reuse is involved.

## Verification

`node --test tests/experimental-resident-stage-runtime.cjs` contains deterministic
host-double tests for ownership and failure behavior. Those tests do not claim
GPU execution or GPU performance. Its separately gated native test compares
actual resident WGSL results against both the old transient dispatch pattern and
CPU graph results, including resize/shrink/tail workgroups and repeated reuse.

Native test invocation (run only in an assigned serial GPU slot):

```sh
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 node --max-old-space-size=256 --test \
  tests/experimental-resident-stage-runtime.cjs
```

The native test checks exact GPU raw bits versus transient buffers and exact CPU
values for dyadic inputs, zero new buffers/groups across 50 warmed runs,
cancellation/retry, incomplete-intermediate rejection, and cleanup. SwiftShader
is software Vulkan executing actual WGSL; it is not evidence of hardware speed.
The existing complete BVH CPU/GPU snapshot recurrence and original-controller
live world replay remain the higher-level integration gates.

A separate test-only correction updates the cue broad-admission guard's stale
error-message regex. The exact baseline `b68246c` source rejected the same invalid
new overlap with `source-owned BVTT and exact contact owner`; the test still
checks rejection and unchanged committed state. No admission logic was changed.

### Verified component results, 2026-10-25

Runtime source revision: `9f1f03f` (also included in integrated candidate
`da415137d3103aefb65984a239134032f73f01ca`). Tests ran serially on the agent's
Linux container with native Dawn and the SwiftShader Vulkan ICD above.

- Resident runtime: 12 passed, zero failed, zero skipped. Eight changing-row
  cases match old transient GPU raw bits; 59 cases match CPU exactly. Fifty
  warmed runs create zero new GPU buffers or bind groups. Native cancellation,
  fresh-generation retry, finite-input invalid division, and recovery pass.
  Final statistics: 14 buffers created, 14 destroyed, zero live buffers.
- Existing BVH state recurrence: 7 passed, zero failed, zero skipped. All 43
  complete tree/scheduler snapshots and diagnostics match CPU byte-for-byte.
  History SHA-256:
  `45b60bc60095ae6a3560daca629a3525c6aa3541278150a6e602fd82b1bed338`.
- Existing cue-cloth lifecycle: 3 passed, zero failed, 2 skipped because the
  optional original geometry oracle files were unavailable. All 15 synthetic
  lifecycle cases match CPU/GPU exactly. Original geometry boundaries checked
  in this component run: **0**, not an implied native-oracle pass.
- Arithmetic/BVH/cue-cloth host regression group before the GPU slot: 25 passed,
  zero failed, 8 explicitly gated skips. Prepared original cue-broad CPU replay
  also passed 440 h with maximum proxy error 0; all 3 admission guard tests pass.

These component checks establish exact preserved arithmetic/state within their
stated scope. They do not substitute for the integrated original-controller
whole-world replay, which is coordinated separately. No real-hardware speedup
is asserted; one GPU dispatch and one readback still occur for every stage run.
