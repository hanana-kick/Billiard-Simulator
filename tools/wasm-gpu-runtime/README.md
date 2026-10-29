# Private WASM GPU schedule runtime (stage one)

This dependency-free Rust crate moves **command-stream ownership and scheduling**
into actual WASM. It is not a completed physics-engine port. WGSL numerical kernels
remain on WebGPU; there is no CPU physics substitute or arithmetic import here.

Build (requires an already installed Rust toolchain and wasm32 target):

```sh
node tools/wasm-gpu-runtime/build.mjs [output.wasm]
node --test tests/wasm-gpu-runtime.mjs
```

The build is offline and locked, with an explicit local target directory (inherited
`CARGO_TARGET_DIR` cannot redirect the expected artifact). It validates ABI imports
and required exports, and writes `<output>.build.json` containing binary/source
SHA-256 hashes, toolchain versions, target and build flags. `CARGO`, `CARGO_HOME`, and `RUSTUP_HOME` can select
an existing toolchain. Default output: `artifacts/wasm-gpu-runtime.wasm`. Tests build
the actual binary into a temporary directory, instantiate it, and use a mock bridge;
they do not execute a GPU and do not prove numerical parity or full-app readiness.

## Host contract

`instantiateWasmGpuRuntime({moduleBytes, bridge})` takes explicit bundled bytes,
never a URL. `bridge.commandCount` is a verified registry size, 1..65,536.
`bridge.encodeChunk(handles, generation)` accepts a copied `Uint32Array` of 1-based
command handles, with a promise that resolves only when safe to accept another chunk.
Required synchronous `bridge.cancel(generation)` and `bridge.lose(reason)` hooks
stop pending, not-yet-submitted work when the runtime lifecycle changes. Resource
descriptor validation and GPU buffer/pipeline ownership belong to the bridge.
The owner prepares/begins the bridge run before stepping and drains/finishes it after.

1. `load(handles)` validates integral handles and copies up to 65,536 into WASM.
2. `start({repeat: 1})` creates a monotonically increasing nonzero generation.
3. `await step(maxCommands = 256)` emits at most 4,096 handles and awaits the bridge.
   WASM commits its cursor only after successful bridge acceptance/completion.
4. `status()` reports state, generation, cursor, repeatsLeft, commandCount, inFlight.
5. `cancel()` stops future chunks. Restart requires the prior step to settle, and
   starts from stream beginning with a new generation. Already submitted GPU work
   cannot be retracted; the owner must drain before destroying shared GPU resources.
6. `lose()` and `dispose()` are terminal, including during an in-flight step.
   Disposal clears CPU schedule storage and terminally invalidates the bridge through
   its synchronous lose hook; async bridge drain/GPU destruction is caller-owned.

State: empty → ready → running → complete/cancelled; ready/complete/cancelled may
load/start again. Lost and disposed never restart. Bridge throw/rejection/false loses
the runtime, not retries an ambiguously submitted chunk. A single step may cross a
repeat boundary. The bridge must support that if repeat > 1 is used; a one-shot
physics bridge must use the default repeat=1 and enforce a complete run/reset
boundary rather than blindly repeating world commands. Generation exhaustion rejects rather than
wraps. Invalid calls throw without producing GPU commands. An encode rejection after
cancellation preserves cancelled state (and rejects the step promise); other bridge
failures lose both runtime and bridge.

## Raw ABI v1

Exports: memory, abi_version, input_ptr, capacity, max_chunk, configure, load,
start, step, commit, cancel, lose, dispose, state, generation, cursor,
repeats_left, stream_len. Signed status returns are 0 success / negative failure;
step returns positive emitted count. Unsigned data getters use Wasm i32 bits.
The sole import is `bridge.submit(pointer, count, generation) -> i32`, which copies
one emitted chunk into the JS pending slot (0 = accepted). `step` remains busy
until `commit(1)` (success) or `commit(0)` (terminal failure). Native GPU objects
never enter WASM memory; no per-physics arithmetic crosses the ABI.

## Unified experimental owner

Prefer `prepareWasmGpuEngine` from `src/wasm-gpu/engine.mjs` over manually composing
runtime/bridge lifecycle. It accepts explicit `moduleBytes`, `device`, a verified
loaded `engine` artifact, `maximumOwnedBytes`, and optional `chunkSize` (1..4,096)
and `maxInFlight` (1 or 2). Alternatively pass serialized `artifact` plus independent
`artifactExpectations` instead of loaded `engine`; the same strict loader is used.
There are no network fetches and no public application wiring.

```js
const owner = await prepareWasmGpuEngine({
  moduleBytes, device, engine: verifiedArtifact,
  maximumOwnedBytes: approvedByteBudget, chunkSize: 256,
});
try {
  const {generation, result} = await owner.run({
    initialUploads,                    // complete per-candidate internal arena reset
    candidateIds,                      // distinct Uint32 IDs, exact artifact width
    rawLease: {prepared, status, release}, // borrowed genuine raw GPU outputs
    signal: abortController.signal,
    onProgress: ({submittedCommands, totalCommands}) => {},
  });
} finally {
  await owner.dispose();
}
```

`run` owns one complete exact command schedule per fresh generation; it cannot
repeat arbitrary world commands. Concurrent runs reject without acquiring the
second lease. Host upload bytes and IDs are copied before the first await.
`owner.cancel(reason)` synchronously cancels both scheduler and pending bridge
submissions; cancellation rejects the run with `AbortError`, drains actual GPU
work, releases the raw lease, then permits a fresh fully reset run. It also stops
publication when cancellation arrives during final readback or async lease release.
`dispose()` cancels an active run, awaits cleanup, and then destroys only bridge-owned
GPU buffers. It is idempotent and callers must await it. The raw `prepared` and
`status` buffers are **never destroyed by this owner**.

`rawLease.release()` is mandatory and called exactly once for an acquired run,
only after all submitted GPU fences have settled (or device loss establishes work
cannot continue). Before acquisition, malformed options or a pre-aborted signal
reject without calling release. The caller must keep both genuine raw buffers
alive and exclusively leased until release; JavaScript cannot prove their producer
provenance. In transitional external-lease mode, an existing raw-strike/handoff GPU producer
must provide these buffers; no host-generated physics substitute is allowed.
Combined mode below instead owns captured raw GPU command execution and buffers. Internal graph initial data must be genuinely prepared for every candidate.

Progress callbacks and lease release may return promises; they must eventually
settle. They may call synchronous `cancel`, but **must not await this same owner's
`run` or `dispose` from inside the callback**, since those operations await callback
completion. Await disposal from the outer caller instead. A progress callback
failure cancels/drains before rejecting and allows reuse; bridge/device/lease-release
failures terminally lose the owner. `status()` distinguishes running, cancelling,
ready, lost, disposing and disposed. Compact result words are the existing bridge
output, not a new physics model or evidence of numerical qualification.

Owner verification: `node --test --test-concurrency=1 tests/wasm-gpu-engine.mjs`.
These tests execute actual bundled WASM against a tiny structural WebGPU API mock,
including blocked cancellation, callback/fence failures, device loss, async release
races and persistent reuse. They do not execute GPU kernels or qualify full physics.


### Combined raw + world owner (preferred private staged path)

Supply optional `rawEngine` (a branded loaded raw artifact), or serialized
`rawArtifact` with independent `rawArtifactExpectations`, to
`prepareWasmGpuEngine`. The owner then uses **one WASM command stream** consisting
of the captured raw-strike phases and handoff, followed by world commands. The
bridge persistently owns raw buffers, including `prepared` and `status`; the world
binds those exact buffers without host readback or replacement. Raw dispatch Y
remains 1; world dispatch Y is the artifact candidate count.

Combined `run` takes `{rawUploads, initialUploads, candidateIds, signal,
onProgress}` and rejects `rawLease`. `rawUploads` must reset every raw allocation
with exact indexed, full-width `Uint8Array` data. Both upload collections must be
prepared from the **current run's scene/candidates**, not frozen artifact input
bytes. They are copied before the first await. No artifact capture or physics
factory executes inside the runtime owner. The external-lease mode remains
explicitly transitional and rejects rawUploads without a raw artifact.

Both modes return `requiresExclusiveDevice: true`. This is a contract: callers
must reserve the supplied GPUDevice exclusively for the prepared owner while it
is alive, because error-scope stacks are device-global. Separate owners/users must
not interleave scope operations on that device. `ownsRaw` distinguishes combined
mode. Disposal owns/destroys all combined raw/world buffers only after submitted
work drains. Cancellation still allows a subsequent fully reset generation.

This is a callable staged GPU scheduling/resource migration, not a completed
universal engine port: artifact construction, current-input packing, full graph
coverage, real-GPU numerical parity, wider scales, and public activation are
separate work. Tests use a tiny structural raw/world fixture and actual WASM,
not GPU execution or physics qualification.
