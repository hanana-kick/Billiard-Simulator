# Isolated canonical engine contract

`src/direct-candidate/canonical-engine-contract.mjs` is an opt-in **contract and validation layer**, not a new application backend. It executes no physics, produces no trajectory, and changes no production defaults. Run its unit suite with:

```sh
node --test tests/canonical-engine-contract.mjs
```

The existing application still has three separate numerical entrypoints: `LabController.fire()` calls `PhysicsLab.strike`, `LabForecast.begin/advance` reconstructs and steps a `PhysicsLab`, and optimizer workers/cooperative fallback run source candidate evaluators. A future canonical migration must replace all three together with one model/profile and one producer. `build.cjs` has not been changed to load this module. This contract does not authorize production activation or establish release qualification.

## Model and admission

The explicit model identity is `canonical-equal-solid-sphere-event-model-v1`; its execution profiles are `canonical-local-v1` and `strict-carried-v1`. The supported metadata domain is a complete 3- or 4-body roster of equal .03075 m, .210 kg solid isotropic spheres, the declared source default physical parameters, and a complete finite environment. This is a new named numerical model, **not a claim of Rapier equality**.

`encodeCanonicalScene(snapshot, {objectIds, staticCount})` requires a complete `PhysicsLab.snapshot()` plus the authoritative roster manifest taken from the **same live scene and epoch**. It returns `{admitted, scene, reasons}`. `admitted` is a necessary **metadata/domain** gate, never a guarantee that raw initialization or a later physical event is supported. The function cannot prove an externally invented manifest corresponds to a live world; the owner must capture the manifest from the actual scene, not a selected subset.

- Every dynamic body's ID, shape, mass/radius/extents, position, linear velocity and angular velocity is retained. Bodies are sorted by numeric ID. `slotToId`, `idToSlot`, `canonicalSlotForId` and `canonicalIdForSlot` give the exact inverse mapping. No body is sliced off to fit a kernel, padded in, relabeled, or silently reassigned to another role.
- All static bodies are retained, including wood, floor, cloth, and the four actual cushion hulls. Vertex/index arrays are copied; unknown geometry, moving statics, rotated statics without a transformed-hull implementation, or too many other static bounds are explicit refusals. The contract itself does not substitute a hull's bounding box for its contact geometry.
- Every physical parameter and source `dt`/`strokeSubsteps` value is retained. Changed material/source settings are explicitly unsupported by the present raw capability. Unknown settings are retained in refusal metadata and produce an explicit reason. Malformed or non-finite physical data has no canonical scene identity.
- Twelve-body UI scenes, boxes, unequal mass/radius, and out-of-domain state are rejected, not clipped. Box orientation is retained in the rejected physical identity; boxes remain unsupported until genuine orientation-dependent rigid-body physics exists.
- A sphere's quaternion, label and color are presentation data and do **not** affect physical identity. Angular velocity remains physical and does affect it. Position/height edits remain exact inputs, not a projection to cloth.
- The opaque Rapier `world` buffer and its contact caches are not imported as canonical state. This is an explicitly new model starting from the complete observable physical scene, not an asserted continuation of Rapier's hidden solver state.

`createCanonicalCandidate` retains exactly the five raw settings; it does not normalize angles, clamp speed, shrink tip offset, or reset motion. Current raw capability: speed .5–4.5 m/s, elevation 0–85°, absolute yaw ≤3600°, normalized tip radius ≤.6. The UI's .25–5 m/s and .92 tip envelope are **not** silently admitted. The .6 limit is a supported numerical envelope, not an asserted physical miscue threshold.

The full-world raw producer must separately admit actual support height, finite-cloth coverage, full-roster rest, cue clearance and initial contacts. In particular the resident raw adapter's support test compares encoded `y` to encoded cloth top plus encoded radius; it never projects the source height. Every subsequent contact, lift/landing, ambiguity and recurrence regime needs its own genuine producer admission. A complete model-domain scene can therefore still yield `UNSUPPORTED` or `INCOMPLETE`; neither means a physical miss.

## Immutable identities and transport

`createCanonicalRequest` requires explicit epoch/request ID, selected ID, purpose (`manual`, `forecast`, `search`), execution profile, resource budgets, and a complete ID-based rule configuration. Targets/opponent are mapped through the same scene slots. Rules cover the exact 3/4-body roster and retain all scoring/search settings. Changed budget/profile/rules/physical scene/raw settings change the relevant identity.

Identity strings use exact canonical serialization, not a probabilistic hash as a correctness gate. Public immutable model/profile/scene/request/candidate records are frozen owned data. A separate producer's u32 `sceneKey` or `requestKey` can be an opaque transport binding only; it does not replace matching the exact host identity.

`validateCanonicalScene`, `validateCanonicalRequest`, and `validateCanonicalCandidate` rederive admission/identities at structured-clone boundaries. Changing geometry, mappings, request settings, or a candidate's `admitted` flag cannot silently reuse an old identity. `createCanonicalBatchEnvelope` stores one shared model/profile/scene/request identity and a distinct candidate-ID registry for the entire batch.

`createCanonicalSceneTransfer` creates a **fresh owned** UTF-8 structured-data buffer. It is a one-time scene transport encoding, not a GPU physics ABI. Transferring it may detach that disposable copy, never the immutable scene or caller-owned source buffers. `readCanonicalSceneTransfer` verifies the expected exact identity and revalidates the scene. `cloneCanonicalWords` copies precisely the supplied u32 view; detached/empty/shared arrays are rejected. No per-candidate host physics is performed by any of these functions.

## Total shot time and separate work budgets

`budget.maximumTicks` is the **total elapsed simulated duration in Q20 ticks from the shot's declared raw-start, INCLUDING the raw strike**. It is not an absolute clock ceiling, a per-phase allowance, or a producer-completed flag. `maximumEvents` and `maximumWorkItems` remain separate cumulative resource caps. Identity/admission of these values is not evidence that a producer respected or completed within them.

Before initialization, `createCanonicalShotClock(request, startingTick)` binds that duration to an explicit per-shot clock origin and derives the checked `deadlineTick = startingTick + maximumTicks`. The current prepared-world ABI uses the signed-range nonnegative Q20 clock `[0, 0x7fffffff]`; a start or derived deadline outside it is rejected as `CLOCK_OVERFLOW`, never wrapped. A per-shot origin of zero is independent of the UI's cumulative session time. The request's budget fields are unchanged; this additional immutable clock binding includes the exact request identity and must be carried through the complete shot.

`validateCanonicalShotClock` verifies that binding after a clone/handoff. `inspectCanonicalPhaseBudget(request, clock, currentTick, requiredTicks)` reports elapsed/remaining ticks and whether the next positive-duration phase fits, **without executing or claiming completion**. A continuation must retain the original raw-start: time consumed by strike and previous phases is subtracted, never reset at a handoff. If remaining time cannot cover the next accepted step, the phase must stop with its valid checkpoint/`INCOMPLETE` rather than silently overrun or call it model REST. The raw initializer's 16-Q20-tick step therefore permits at most `floor(remainingTicks / 16)` additional whole steps, independently of its own raw work-step limit; fewer than 16 remaining ticks permits zero raw steps. Runtime dispatch/continuation adapters, not this metadata helper, must enforce these gates and the separate work/event caps.

## Epochs and cancellation

`createCanonicalEpochGate` owns a request epoch, `AbortSignal`, binding, and candidate registry:

1. `begin()` invalidates/aborts the previous request and returns `{epoch, signal}`.
2. Build and `bind(request)` for that epoch; `register(candidate)` before submission.
3. Validate the complete returned identity after **every** asynchronous boundary/readback and immediately before applying gameplay or displaying a selected trace.
4. `cancel(reason)` makes all later results from that active request unusable. A superseding `begin()` gives an old output `STALE_EPOCH`. IDs cannot be reused for changed raw parameters within the same epoch. Epoch overflow is rejected, never wrapped.

The owner advances epochs for **external semantic edits**: physical scene/model/profile/parameters, selected role, request/rules or candidate-source changes, explicit cancellation/reset/undo/new search. Visual sphere quaternion updates and ordinary playback/render frames are not external scene mutations and must not continuously cancel the simulation that is producing them. No controller integration is present yet.

Cancellation does not imply a GPU dispatch physically stops immediately; it guarantees stale output is discarded. A current producer may report `INCOMPLETE/CANCELLED` with unavailable score, but a cancelled/superseded epoch must not apply that result to a new request.

## Four-word compact results, evidence outside the payload

The existing numeric payload remains **four u32 words / 16 bytes**:

| Word | Meaning |
|---|---|
| 0 | Candidate ID |
| 1 | Wire status: 1 PASS, 2 FAIL, 3 INCOMPLETE, 4 UNSUPPORTED; legacy 5 is early-condition FAIL only |
| 2 | Existing reason codes 0–7 preserved; explicit cancel/horizon/numeric/unresolved/not-implemented reasons extend the set |
| 3 | Signed score bits; `0xffffffff` is **−1** and `0x80000000` alone means **unavailable** |

`decodeCanonicalResult` additionally requires the matching shared batch envelope and **explicit trusted physical-producer evidence**:

```js
{
  termination: 'MODEL_REST' | 'CONDITION_FAILURE' | 'INCOMPLETE' | 'UNSUPPORTED',
  rosterMask,  // actual complete producer roster, not assumed from request length
  restMask,    // actual producer rest facts, not inferred from a status word
  unresolvedEvent: false | true
}
```

Missing evidence is an error. These fields must be derived from real producer state/event guards by a future adapter, not from guessed success, a caller's desired outcome, absent scratch buffers, or default zeroes. The validator checks consistency; it is not a physical proof factory or authentication system.

- `PASS`, or a final gameplay/search `FAIL`, needs `MODEL_REST`, all admitted slots present and resting, and no unresolved event. The gameplay score must be available. An opponent foul can be −1; a completed search failure can still have +1 gameplay score if the gameplay goal succeeded but search constraints failed.
- `FAIL` before rest is allowed only for an explicit irreversible **condition-only** negative proof in a search request that enabled it. It has **no gameplay score**, no model-REST claim and `gameplayApplicable:false`. Existing wire status 5 is normalized to this semantic FAIL only with the required evidence; it is not a fifth public outcome kind.
- Budget, horizon, cancellation, unresolved event and numerical termination are `INCOMPLETE`, never a fabricated miss. An unimplemented/unsupported domain is `UNSUPPORTED`, never a request to switch silently to Rapier.
- Preserve the existing finalizer's separate gameplay/search semantics: after proven full model REST, `UNSUPPORTED_SEARCH` (reason 5) or an incomplete search verdict may still carry a known final gameplay score. That score can be applied while the search outcome remains unsupported/incomplete. `UNSUPPORTED_GAMEPLAY` (reason 6) at model REST keeps the score unavailable and cannot apply gameplay. A numerical budget/cancel/unresolved termination before REST never gets this exception. The decoder tests these cases against the actual existing finalizer, not a rewritten guess.
- Optional `physicalRestCertified`, `globalReceiptCertified` and `globalBudgetWithin` fields are diagnostics, not numerical termination authority. Canonical-local model REST can drive gameplay after complete admitted roster/rest and no unresolved event even when these diagnostics are false. Conversely, `physicalRestCertified:true` by itself cannot turn incomplete numerical output into gameplay completion. Neither field establishes release qualification.

The module intentionally does not adapt a particular producer's state layout to this evidence yet. It does not manufacture a model-REST result from an incomplete producer.

## Same-model fallback and selected-shot obligations

`assertCanonicalBackendCompatibility` permits CPU or WebGPU execution only with the **same model, profile and contract version**. CPU fallback means the CPU mirror of the same integer canonical laws and state, not the current Rapier forecast or optimizer fallback. Device selection must not alter the accepted physics model.

`createSelectedShotTraceRequest` records exact selected candidate identity and explicit sampling bounds. `SELECTED_SHOT_REQUIREMENTS` specifies all-body common-clock p/v/q, actual event order/brackets, no interpolation through unresolved impacts, and epoch checks. Checkpoints require the full integer state, clock, regime/resume scratch, pending events and complete physical-rule/contact-episode ledgers. Positions-only reconstruction is not a checkpoint.

`executeCanonicalBatch`, `hydrateSelectedShotTrace`, `exportCanonicalCheckpoint`, and `restoreCanonicalCheckpoint` deliberately throw `CanonicalInterfaceNotImplementedError`. No fake trajectory, synthetic quaternion physics, incomplete checkpoint, or fallback simulation is returned. Real hydration/restore must use the same canonical producer and be implemented and verified before live/manual/forecast/search migration.

## Verification scope

The suite checks complete-roster refusals, every changed physical parameter, stable permutation mapping, visual sphere rotation independence, raw settings, cloning/transfers/detachment, stale epochs and cancellation, result/score semantics, optional certificate separation, batch binding, and same-model fallback. It includes an actual default `PhysicsLab.snapshot()` only as a serialization/default-fields source, **not a physics oracle**. Contract tests do not establish GPU parity, full-shot correctness, UI migration, performance, or release qualification; those remain separate producer/application tests.
