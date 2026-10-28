# Retained raw h192 cost barrier (TEST ONLY)

This is an **opt-in coordinator barrier**, not a new physics executor, horizon,
qualifier, or production mode. Default `gpu` still runs the whole existing fixed
schedule. Original source shaders, bytecode, caps, initialization, and source /
PhysicsLab / complete-event-tape assertions are unchanged.

## Explicit invocation

Prepare a **fresh** artifact using the original prepare command and an explicitly
chosen work list beginning with `512` and containing at least one further block.
The list must be measured/approved separately; no new total-work default exists.
It remains born with h192, count2, instruction budget65536, and the same exact
source macro budgets. During an exclusively authorized native slot:

```sh
REQUIRE_WEBGPU=1 RUN_RESIDENT_TIP_IMPACT_GPU=1 \
  node tests/resident-candidate-tip-impact-isolated.mjs \
  gpu-pilot ARTIFACT_DIR --wait-ms=600000
```

`600000` here is an explicit **operational wait** example, not a physical or
execution timeout. Admission accepts 1..3600000 ms. The wait starts after the
cost receipt is published. No choice means timeout -> INCOMPLETE, never continue.

After initialization, the first unchanged fixed pump block, and its normal
GPU-only diagnostic copy/drain, `pilot-cost.json` is published atomically with
no-overwrite semantics. It contains complete manifest/runtime/source identity
hashes, GPU invocation UUID, unchanged full work list, first-block callback
identities/counters/times, adapter identity, and separated cold compilation.
There are **no mapped world/VM/audit words or physical outcomes** in the receipt.
The same live session/device/pipelines/banks remain retained while waiting.
Existing pipeline/device validation and disposal are not suppressed.

## Manual local decision (separate lean process)

Read the receipt and `tip-impact-pilot-waiting` log, evaluate measured cost, then
supply **every** observed identity explicitly (no automatic continue):

```sh
node tests/resident-candidate-tip-impact-pilot-decision.mjs ARTIFACT_DIR continue \
  --cost-sha256=RECEIPT_FILE_SHA256 \
  --gpu-invocation-id=GPU_UUID \
  --manifest-sha256=MANIFEST_FILE_SHA256 \
  --runtime-sha256=RUNTIME_FILE_SHA256
```

Replace `continue` with `abort` to stop. This writes the immutable local
`pilot-decision.json`. The receipt names the exact GPU invocation and the distinct
coordinator process identity. Unknown decision/field, stale invocation, changed
receipt, mismatched hash, or invalid JSON refuses; duplicate publication rejects.
This is local provenance, **not security against an adversarial file owner**.

Continue rechecks frozen manifest, initial-only runtime, and source-file hashes,
then consumes *exactly* the previously committed `work.slice(1)` on the same live
session. No reset, additional initializer, new shader, bank patch, expected-file
read, device-state decision, or intermediate map is allowed. Final mapping and
independent assertions remain the original gates, supplemented by exact receipt
provenance and timing-callback equality. The pilot wait is explicitly recorded;
`steadyEndToEndWallMs` still includes it and must not be presented as pure compute
throughput. `queueDrainWallMs` is host-observed queue completion wall time, **not
a GPU timestamp**, and CPU encode/submit/capture/cold compile remain separate.
A single first-block observation is not a full-shot or hardware speed result.

Abort/refusal/timeout drains/disposes through the existing session lifecycle,
writes only `pilot-incomplete.json`, and the CLI exits2. It writes no `actual.v8`,
actual manifest, or passing assertion, and reports no miss/physical result. An
aborted directory cannot be reopened through the default mode; a fresh artifact
is required. Pipeline/device exceptions remain failures (CLI exit1), not results.

## Host evidence and stopping boundary

```sh
node --test tests/resident-candidate-tip-impact-pilot-tests.mjs \
  tests/resident-candidate-tip-impact-isolated-tests.mjs \
  tests/resident-candidate-microcode-world-runtime-tests.mjs \
  tests/resident-candidate-native-session-tests.mjs
```

34 host groups pass (17 pilot/coordinator plus 17 unchanged session/runtime), including exact callback identity/counter validation,
continue/abort/stale/malformed/timeout protocol, atomic duplicate rejection,
separate-process decision CLI, unchanged fixed schedule, no reset/map on abort,
and unchanged all11 transport admission. Mocks are explicitly non-physics and
non-performance fixtures. **No GPU or whole-world replay was run for this port.**
Source-freeze identity changes because the coordinator/helper changed; prepare
fresh artifacts after integration rather than editing historical manifests.
