# WASM-owned GPU engine

## Goal and boundary

Move the billiards engine's orchestration into a persistent WASM runtime while
retaining GPU execution and the existing integer physics. This is **not** a
Rapier/CPU fallback. Browser WebGPU objects still need a host bridge; GPU kernels
remain GPU programs, not WASM instructions.

This work is experimental and does not activate a new public backend. The initial
implementation covers versioned raw-strike and world-command artifacts, a WASM
command scheduler, and a persistent WebGPU arena for their combined ordered
execution. It does not yet port all request packing, search/session ownership, or
selected-trace integration. A successful host test is not physical-GPU qualification.

## Source-backed precedents

The implementation borrows architectural separation, not neural-network kernels
or third-party source code.

- LiteRT's `loadAndCompile` copies model bytes into the WASM heap and invokes
  WASM model loading and compilation. Its JS environment passes the selected
  WebGPU device to the engine:
  [LiteRT source](https://github.com/google-ai-edge/LiteRT/blob/4be8e673b6f03a038dd5503cd7dce6eb5cbd8dd2/litert/js/packages/core/src/litert_web.ts).
- LiteRT's pinned ML Drift dependency separates `Compile`, parameter `Update`,
  and `Encode`, with a pipeline fingerprint cache:
  [compute task](https://github.com/google-ai-edge/ml-drift/blob/1b18771f44c0be3d972847b31a80f6dc3d6964b5/ml_drift/webgpu/compute_task.cc),
  [pipeline cache](https://github.com/google-ai-edge/ml-drift/blob/1b18771f44c0be3d972847b31a80f6dc3d6964b5/ml_drift/webgpu/compute_pipeline_cache.h).
- ML Drift plans intermediate-buffer lifetimes and reuses adequate capacity:
  [memory manager](https://github.com/google-ai-edge/ml-drift/blob/1b18771f44c0be3d972847b31a80f6dc3d6964b5/ml_drift/webgpu/memory_manager.cc).
- It encodes bounded groups rather than a single unlimited command buffer:
  [inference context](https://github.com/google-ai-edge/ml-drift/blob/1b18771f44c0be3d972847b31a80f6dc3d6964b5/ml_drift/webgpu/inference_context.cc).
  Its node-count constants are not billiards timestep limits. The native LiteRT
  look-ahead encoding thread is excluded under Emscripten, so it is not a browser
  optimization we can assume.
- WebLLM loads a prebuilt WASM model library, initializes WebGPU, uploads weights,
  and preloads pipelines:
  [engine](https://github.com/mlc-ai/web-llm/blob/main/src/engine.ts).
  TVM uses a GPU object-handle table, retained pipelines, pooled auxiliary
  buffers, and batched command encoding:
  [runtime](https://github.com/apache/tvm/blob/main/web/src/runtime.ts),
  [WebGPU bridge](https://github.com/apache/tvm/blob/main/web/src/webgpu.ts).
  These TVM main-branch sources are architectural references, not a claim of
  exact identity with WebLLM's packaged runtime.

## Target execution flow

1. **Build:** derive unchanged WGSL and the ordered command/resource graph from
   current physics factories. Package structural configuration and exact source
   identity. Scene, shot, rules, and scratch initialization are separate inputs.
2. **Prepare:** validate the artifact against trusted build identity and device
   limits, instantiate WASM, prepare pipelines, and allocate a reusable arena.
   `ready` must mean asynchronous pipeline preparation has actually completed.
3. **Run:** pack current inputs, reset every mutable arena region, upload compact
   parameters, and let WASM advance the command stream in bounded chunks.
   The host bridge encodes browser GPU commands without reimplementing physics.
4. **Finish:** keep intermediate results GPU-resident and read compact outcomes.
   Capture a full trajectory only for the selected candidate.
5. **Cancel/loss:** invalidate the generation, stop later submissions, drain
   submitted work before reuse or disposal when the device is live, and reject
   stale results. Device loss invalidates all device-bound resources.

## Invariants

- Preserve arithmetic, source bytes, layouts, dispatch order, admission rules,
  score semantics, and supported widths. WASM does not authorize wider batches.
- Never classify `INCOMPLETE` or `UNSUPPORTED` as a miss or a successful result.
- Do not store scene-dependent initial bytes in a supposedly universal program.
- Do not accept serialized resource-validation receipts as trusted ownership.
  Recompute and validate resource requirements after deserialization.
- Cache immutable packages separately from device-bound pipelines and buffers.
- Use coarse WASM/host calls per chunk, not one import per ball or arithmetic
  operation. Bound both command counts and in-flight work.
- Do not recycle memory while an earlier submission can still reference it.
- Do not silently replace GPU physics with CPU simulation after a failure.

## What this does not promise

A WASM port does not eliminate browser/driver GPU shader preparation, guarantee
Android device-loss recovery, or establish a speedup. Portable WASM artifacts
are not portable precompiled GPU machine code. Browser WASM itself also requires
validation/compilation/instantiation.

The existing pipeline cache already avoids some repeat compilation. The new
architecture addresses repeated graph construction, host allocation, buffer
churn, and command scheduling. Reducing the physical workload or the number of
GPU dispatches is a separate optimization requiring numerical equivalence.

## Migration gates

1. Exact artifact round trips and fail-closed malformed-input checks.
2. Actual compiled WASM scheduler tests, including cancellation, repeated runs,
   stale generations, malformed handles, and bridge errors.
3. Persistent-arena host tests for reset, reuse, queue ordering, readback,
   disposal, and device loss.
4. Differential command/upload comparisons against the existing producer.
5. Integrate current input packing, search, and selected gameplay through one
   engine owner. Remove runtime capture only after all
   structural variants and mutable uploads are accounted for.
6. Full application build/physics/UI verification before public activation.
   Real GPU execution remains untested unless separately authorized.

## First-stage callable API

`prepareWasmGpuEngine` in `src/wasm-gpu/engine.mjs` composes the artifact loader,
real WASM scheduler, and persistent WebGPU bridge. Preparation accepts an already
selected device and bundled module bytes; it never fetches code or requests a
device implicitly. `run`, `cancel`, and asynchronous `dispose` are coordinated
through this owner rather than independent scheduler/bridge calls.

The preferred combined mode takes a loaded raw artifact at preparation and
complete current `rawUploads`, world `initialUploads`, and candidate IDs at each
run. Raw prepared/status buffers are owned by the same persistent arena and fed
directly into world commands. Raw dispatch preserves Y=1; world dispatch uses the
candidate count in Y. Both streams share one WASM cursor and cancellation owner.

The transitional world-only mode still accepts a borrowed `rawLease`. Its producer
must keep prepared/status buffers valid and unmodified until release; the owner
releases only after submitted work drains. Neither mode runs CPU physics.

This API requires exclusive GPUDevice access during preparation and runs because
WebGPU error scopes are device-global. Concurrent renderer or other-owner calls on
the same device are not supported by this first implementation.

Run the opt-in host checks with `npm run test:wasm-gpu:host`, with an installed Rust
toolchain and `wasm32-unknown-unknown` target. The command builds actual WASM and
runs the artifact, scheduler, bridge, and owner checks serially. It does not execute
GPU kernels. The generated binary has a companion SHA-256/source/toolchain record.

The first artifact format admits N1/N3 only. Repeated commands and binding tables
are dictionary encoded, preserving their order and exact shader strings. A
nonexecuting MMQ2 world-program sample (source revision `d662fdb`)'s JSON package decreased from 17,709,460 to 3,054,721 bytes
(279,048 bytes with gzip). A fresh Node loader process measured 118,288 KiB peak RSS;
this is not browser memory, GPU memory, driver memory, or a runtime speed benchmark.

Host integration also replays the genuine captured N1 graph through actual WASM
and the concrete GPU bridge using a nonexecuting mock device: 8,195 raw commands
followed by 34,642 world commands, final guard and compact copies. Two runs verify
unchanged command/binding order, current uploads, and reuse of 112 pipelines and
all owned buffers. This does not evaluate the shader arithmetic or establish
physical-GPU numerical equivalence.
