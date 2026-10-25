# Bounded current-source four-ball evaluation

This is a local, explicitly opt-in evaluation API. It does not select the product backend, alter the production controller/optimizer, change the visible game, or generate shots. It accepts a caller's bounded list of **raw source captures** and executes them one at a time through the existing exclusive actual-WebGPU shot owner.

It is **serial bounded evaluation, not resident GPU multi-shot batching or an acceleration result**. A real parallel resident batch is a separate throughput stage. No original/native CPU continuation, approximate full-shot fallback, or replayed expected state runs inside this service. A null adapter stays unsupported. Native Dawn/SwiftShader tests, if run separately, are software-adapter evidence, not browser hardware or real-time throughput evidence.

## Public worker API

```js
import {createBoundedFourBallEvaluationClient} from './src/bounded-gpu-shot/evaluation.mjs';
const evaluator = createBoundedFourBallEvaluationClient({
  onProgress(view) { /* compact, detached latest-request progress */ }
});
const available = await evaluator.ready;
if (available.status === 'ready') {
  const operation = evaluator.start([
    {id: 'candidate-1', snapshot, preStrikeSnapshot, capture},
    // Each entry must have its own matching native source bytes and capture.
  ], {
    signal: abortController.signal,
    budget: {maxSteps: 256, maxWallMs: 1000},
    limits: {maxShots: 16, maxInputBytes: 64 * 1024 * 1024,
      maxShotH: 65536, maxTotalH: 262144}
  });
  let view = await operation.result;
  while (view.status === 'budget-suspended') {
    // The caller controls when another bounded slice may run.
    view = await operation.resume({budget: {maxSteps: 256, maxWallMs: 1000}});
  }
  await operation.finished;
}
await evaluator.dispose();
```

The trusted local worker assets and pinned read-only decoder build are the same assets required by `docs/bounded-four-ball-gpu-shot-worker.md`. The worker must be served with its actual local modules and decoder files. Importing this API alone does not install or publish assets. Existing asset copying includes all `.mjs` files under `src/bounded-gpu-shot` and `src/browser-initial-import`; any new runtime dependency must also be present in the source-derived runtime postorder.

`createBoundedFourBallEvaluationService({device, decoder, scheduling?, onProgress?})` in `evaluation-service.mjs` exposes the same API on a borrowed, actual same-realm GPUDevice. It uses the fixed trusted runtime/importer and shares the same device lease with the legacy single-shot service. The caller must initialize the trusted runtime exactly as required by `four-ball.mjs`; callers cannot inject an alternate physics backend or projected seed. Disposal releases only this service's resources, not the borrowed device. The dedicated worker variant owns and destroys its own device after draining.

## Source boundaries are distinct contracts

The worker copies transport data; **only the fixed decoder/importer and world can admit the physical source**. Recognizing a boundary name is not source validation or a guarantee of full-shot completion.

- `strikeCreated` retains the unchanged exact constructor-72/default first-strike contract, with its mode and strike journals. No arbitrary later state is relabeled as that historical boundary.
- `goalStrikeCreated` and `secondStrikeCreated` route to `configured-four-ball.mjs`, retaining the respective strict first/second identity, clock, settings, sleep, contact-cache and native-handle contracts. They are not catch-all names for arbitrary live positions.
- `liveRegisteredStrikeCreated` routes to `live-registered-four-ball.mjs`. It requires both `snapshot` and `preStrikeSnapshot`. Its capture fields are `boundary`, `candidateInput`, `apiJournalLength`, `application`, `strikeCreationJournal`, `nativeRestoreUsed`, `preStrikeApplication`, and `readiness`. `nativeRestoreUsed` must remain true. The importer validates the independent before/after snapshots, derives native frame identity, and validates the original nonmutating fork's creation journal. The worker never performs that native restore or fires a visible controller.

Historical inputs contain only `{id, snapshot, capture}`. Live-fork inputs additionally contain `preStrikeSnapshot`. Caller-projected seeds, decoded trees, hulls, expected results and alternate importer/backend functions are not inputs to either public factory. Unknown/malformed bounded capture envelopes become per-shot `unsupported` results. Unsafe accessors, shared/host memory, invalid list IDs and global budget/size limits reject synchronously before replacing the previous operation.

## Results and recommendation validity

Every compact shot result includes its stable `id` and index, `backend: 'webgpu'`, `execution: 'serial-bounded-evaluation'`, status/reason, committed-h progress, source-admission evidence, resource counters, final score only after physical rest, obstruction status, recommendation validity, and certification status.

- The backend label identifies the selected execution path, not a claim that an unsupported input dispatched a shader. Inspect status and committed-h progress.
- `source.validated` becomes true only after the fixed importer has returned its validated, privately owned seed and the world constructor has returned its owner. A constructor failure may therefore lack a source receipt even if decoding succeeded. Caller-thrown error metadata never establishes source admission. The receipt records the captured snapshot hash, source revision, boundary and domain. It is not copied from a caller's convenience claim.
- `certification.status` is always `not-certified`, with reason `no-reference-comparison-in-this-evaluation`. This API does not compare a shot against an independent original CPU oracle. Prior bounded parity evidence must not be presented as certification of every new shot.
- A complete shot has reached the existing world's original physical-rest condition, not an early score threshold. Nonterminal/unsupported/failed/cancelled/limited shots have no final score.
- `obstruction.status` is `observed` when a committed state reports cue obstructions, `clear-through-rest` only after a completed shot with an explicitly empty obstruction history, otherwise `unknown`.
- Recommendation validity requires source validation, physical rest, established clear obstruction history and a positive score. Any cue obstruction is invalid even if the shot is source-valid, fully simulated and has score zero. No such result is inserted into production search automatically.

The list's `complete` means every input was processed into a terminal per-shot result. It does not mean every shot completed physically: inspect `allShotsComplete` and the individual rows. An unsupported shot does not prevent an independent later shot from being evaluated. Device loss stops the list and leaves unstarted entries `not-run`.

## Bounds, progress and lifetime

A request allows 1–16 uniquely named shots, at most 64 MiB of accounted raw input data, at most 65,536 committed h per shot and 262,144 h across the list. All four limits may be lowered, not raised. IDs are 1–128 characters. Raw snapshot views are independently limited to 32 MiB each. Input accounting counts complete backing stores, strings, property names and conservative object/node charges before copying; it also enforces 100,000 data nodes. These are owned-data bounds, not exact JavaScript/native-process RSS measurements.

Each slice uses the unchanged `1..4096` committed-h and positive `<=30000 ms` wall budgets. Those affect scheduling only, never dt, physical iterations or scoring. Wall budgets are checked around awaited atomic h work; they cannot preempt an in-flight shader/construction/decoder operation and are not a hard latency guarantee. When a per-shot or total-h cap is reached, the owner drains/cancels and the relevant status is `limit-reached`, not unsupported, complete or approximately solved. H caps ensure an automatically resumed list cannot run an unbounded number of committed h.

All list inputs are copied before the first await. Pending raw copies are released as soon as the child owns them or the request is cancelled. Results retain only compact summaries, not per-h native trees, world caches or trajectory arrays. At most one live GPU world executes. A superseded, not-yet-started list is removed from the queue immediately; repeated replacements cannot accumulate a raw-input promise tail behind an in-flight h. During replacement validation, the new and previous bounded input copies may briefly coexist. Existing world internals remain bounded by the h/domain limits, not a claim of indefinite heap stability or leak-free GPU-driver memory.

`result` settles the first aggregate slice. `finished` settles only terminal completion after owner cleanup. `resume()` requires the latest idle suspended request. `cancel()` is idempotent and drains the current atomic h before finalizing. A new start cancels the old owner before a replacement world is initialized. The old handle may settle its own terminal result but cannot replace the latest cached view or emit stale progress. `onProgress` is event/slice-based, not an unbounded polling timer; callback exceptions cannot alter execution. Disposal cancels/drains all owners before terminating the worker.

## Verification scope

Fast tests:

```sh
node --test tests/bounded-gpu-evaluation.mjs \
  tests/bounded-gpu-shot-lifecycle.mjs tests/bounded-gpu-shot-resources.mjs \
  tests/bounded-gpu-shot-worker-transport.mjs tests/bounded-gpu-shot-worker-source.mjs
```

The evaluation tests use explicit lifecycle doubles. They cover mixed supported/unsupported inputs, source ownership and post-call mutation, two-snapshot live transport, getters/shared buffers, backing-store and list/h limits, suspension/resume, repeated latest-request replacement, stale progress, atomic-h cancellation/device loss, unavailable readiness, obstruction-invalid score zero, backend/certification labels, cleanup and bounded compact results. The existing worker source test also invokes the real production bootstrap with a null adapter. These tests do **not** establish new shader execution, arbitrary live-shot parity, browser GPU support, performance, full product UI behavior or deployment readiness.

Actual new-boundary importer and GPU integration must be verified against the final shared contract/runtime sources separately. Heavy native/GPU gates run only in the coordinator's serial slot. Do not substitute a lifecycle double or source-only test for that gate.

### Optional actual native-Dawn prefix gate

Once the final importer/runtime dependencies are integrated and the serial heavy-test slot is available:

```sh
REQUIRE_BOUNDED_EVALUATION_WEBGPU=1 \
GPU_NATIVE_MODULE=/absolute/path/official-webgpu/index.js \
GPU_EVALUATION_INPUT=/absolute/path/original-raw-live-fork.v8 \
RAPIER_WASM_PROVENANCE=/absolute/path/snapshot-wasm-decoder-provenance.json \
GPU_EVALUATION_EVIDENCE_OUT=/new/absolute/path/evaluation-prefix.json \
node --test tests/bounded-gpu-evaluation-webgpu.mjs
```

The V8 file contains exactly the original raw `{snapshot, preStrikeSnapshot, capture}` input. The test freezes tracked code, prohibits native initialization/step/restore, owns two copied inputs, executes a bounded prefix of the first (one h by default, `GPU_EVALUATION_H` permits 1–64), then cancels/drains before the second starts. It verifies input hashes, source receipt, no certification claim, owned-buffer cleanup and borrowed-device survival. Its report is explicitly `prefix-only-not-parity`. It does not compare an independent CPU oracle or prove physical-rest completion.

## Capture the actual ready game without resetting it

`captureLiveRegisteredFourBall({controller})` from
`src/browser-initial-import/live-capture.mjs` uses the supplied original
controller's `PhysicsLab.fork()` and the original controller's `fire()` on that
private copy. It does not initialize a replacement game, reorder body IDs,
zero velocities, force sleep, or advance a native simulation step. The original
visible controller, history, selected cue, scores, and world remain unchanged.
The capture includes both pre-strike and created native snapshots. A prior
completed shot and a motionless-but-awake state keep their real native frame,
body generations, retained contacts, and manager memberships.

```js
const observed = captureLiveRegisteredFourBall({controller});
try {
  const operation = evaluator.start([{
    id: 'current-controls',
    snapshot: observed.snapshot,
    preStrikeSnapshot: observed.preStrikeSnapshot,
    capture: observed.capture
  }]);
  // start owns its raw inputs synchronously. The private native copy need not
  // remain alive while the GPU evaluates its independent source state.
  // Keep and resume/cancel operation under the application's normal UI policy.
} finally {
  observed.dispose();
}
```

The initial capture may still reject an unfinished turn, moving balls, blocked
original strike, or freshly unregistered fourth body. Current supported live
imports require the unchanged default physical parameters and the existing
four-ball sphere/table configuration. Every additional unsupported owner
transition remains explicit. Admission and one successful GPU step are not a
certificate of a complete shot. This API is not yet wired into public search or
selected as a production default.
## Observed native-Dawn service prefixes, 2026-10-25

The actual native Dawn Vulkan adapter identified itself as Google SwiftShader driver 5.0.0. At clean tested commit `b27da83bef4f67d63103a728299665500f4f997e`, three independently supplied original raw captures (`placed`, `settled`, `awake`) each passed exactly **one committed h** through the public borrowed-device evaluation service, then cancelled/drained before the second list entry started. The readonly decoder/importer admitted the live source, caller mutation did not change the source hash, GPU errors were empty and the borrowed renderer sentinel/device remained usable.

- Placed: 986 owned buffers created/destroyed, zero tracked after cancel. [Report](evidence/bounded-current-source-placed-prefix-b27da83.json), [log](evidence/bounded-current-source-placed-prefix-b27da83.log).
- Settled: 1,026 created/destroyed, zero tracked. [Report](evidence/bounded-current-source-settled-prefix-b27da83.json), [log](evidence/bounded-current-source-settled-prefix-b27da83.log).
- Awake: 1,048 created/destroyed, zero tracked. [Report](evidence/bounded-current-source-awake-prefix-b27da83.json), [log](evidence/bounded-current-source-awake-prefix-b27da83.log).

Peak tracked buffers were 578 for each case. Observed maximum process RSS was about 627–628 MiB. These are measured prefixes, not indefinite memory bounds or performance/acceleration benchmarks. The original run reports retain their unmodified output. Their before/after snapshot hashes are correct, but their raw-artifact hash was computed after the intentional caller-mutation test and is the mutated in-memory buffer hash, not the file hash. The separate [integrity correction](evidence/bounded-current-source-prefix-integrity-correction.json) records the true original file hashes and reproduces each mistaken hash without changing the files. Those captures are external test inputs, not embedded candidate seeds.

An initial constructor attempt failed closed because the source broad-phase projection omitted its required distinct live boundary; all 90 allocated buffers were cleaned up. The source projector was corrected to preserve the captured boundary, not by relaxing the owner assertion. Explicit reference-constructor/one-h diagnostics subsequently passed for the three sources before the actual GPU runs. Those diagnostics were separate tests, never an evaluation fallback.

A later browser import-order repair explicitly loads the shared live origin before modules that capture it. Its browser-like realm/source gate passes separately; it does not retroactively change the source SHA of these native-Dawn runs. Full-rest CPU/GPU comparison, actual browser WebGPU execution, production UI behavior and throughput remain outside these prefix receipts.

### Evidence hash-timing correction

V8 deserialization can return snapshot views sharing the input Buffer's backing store. The prefix test initially hashed that Buffer at the end, after deliberately zeroing caller-owned snapshot views to test service input isolation. All three reported container hashes are therefore post-mutation memory hashes. A separate read-only reproduction exactly matches each mistaken hash, verifies the immutable files retain their existing pinned hashes, and verifies the pre-mutation snapshot/pre-strike digests match the actual admission receipts. Original JSON/logs are preserved unchanged; the correction record is separate.

The test now computes and stores all input digests before deserialization/caller mutation through `readRawEvaluationArtifact`, with a regression test. No physics, importer, GPU shader or service ownership code changed for this correction. Repeating GPU work is unnecessary to establish the cause and corrected file hashes; the original one-h computation and cleanup evidence remain scoped to the original tested commit. No full-shot parity claim follows.

## Observed actual GPU suspension/resume

At tested source commit `15e80e0`, the placed, settled and motionless-awake
captures each executed two h on native Dawn/SwiftShader. The initial budget was
one h, followed by exactly one explicit `operation.resume()`. Each retained
operation ID 1, the same complete source receipt, progress `[1, 2]`, and exactly
two snapshot-decoder calls total. Thus resume did not re-import or reinitialize
the world. The service consumed the original world's returned detached step
snapshot instead of computing a redundant public snapshot; physics was unchanged.

All three probes retained 574 owned buffers while suspended, then released all
resources on cancellation: 1342/1342, 1342/1342, and 1400/1400 buffers destroyed,
respectively. GPU errors were empty and the borrowed device remained usable.
The corrected pre-mutation artifact hashes match the original pinned files.
These are actual resume-prefix tests, not full-shot or hardware-speed claims.
Receipts are `docs/evidence/bounded-current-source-*-resume2h-15e80e0.json`.
