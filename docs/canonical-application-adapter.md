# Read-only canonical application boundary (experimental)

`src/direct-candidate/canonical-application-adapter.mjs` prepares a complete real
PhysicsLab scene for the selected-shot session and exposes guarded, source-owned
presentation data. **It is not imported by the controller or UI, does not enable a
new default, and is not a playable application integration or release.**

## Implemented boundary

- A caller supplies the actual PhysicsLab and a reader returning exactly
  `{selectedId, settings, game}`. `game` is the complete current ThreeBallGame or
  FourBallGame snapshot, not a route-search result or partial target list.
- The adapter calls `lab.snapshot({trails:false})`, builds the manifest from the
  live complete object IDs/static count, and runs canonical scene admission.
  It never clips settings, moves a ball to cloth height, resets velocities,
  drops objects, substitutes materials, or resumes the snapshot's Rapier bytes.
- Manual/forecast game rules are derived from the actual game roster. Three-ball
  requires three cushions and treats the other two objects as targets. Four-ball
  retains both red IDs, the opposing cue ID and optional three-cushion setting.
  Kisses remain allowed for gameplay; search restrictions are not silently added.
- The session receives owned scene/settings/budget data and owns its canonical
  epoch. The application layer independently compares the complete physical
  scene, native clock/revision, settings and full game snapshot after the await
  and before every result/sample/presentation use. Even a direct body mutation
  that does not increment `lab.revision` invalidates the result.
- Exact result identity, final full roster, clock bounds, physical-rest flag and
  compact candidate ID are verified. Unknown/incomplete output is never a MISS.
- `presentAt` only invokes a caller's presentation callback for an exact source
  or boundary point from a complete capture. Bounded references/intervals and
  unavailable/unsupported interiors remain explicit; no interpolation or replay
  manufactures a point. Returned data are owned copies.

The adapter's outcome is **read-only**. `scoringEligible` identifies an evaluated
full-rest wire packet, not a game mutation. There is no `game.begin`, `contact`,
`finish`, turn switch, undo commit, body write, `lab.strike`, `step` or `restore`.
A presentation callback must only update presentation; the adapter cannot undo
arbitrary side effects in user-supplied callbacks.

## Capabilities and execution

`createCanonicalApplicationAdapter({lab, readContext, device})` instantiates the
real selected-session interface. That service is currently MMQ1/no-cushion,
selected-candidate-only. Successful MMQ2 component/trace tests do not implicitly
expand its admission. `createCanonicalApplicationAdapterHarness` is explicitly
labelled `injected-test-adapter-v1`; it provides lifecycle tests, not GPU evidence.

`runSearch()` rejects. A future search route must use a matching current-source
batch profile and identity; it cannot loop selected shots, restore frozen0850
physics, or replay candidates through Rapier as a hidden verifier.

The complete scene is recaptured at guard boundaries, including presentation.
PhysicsLab.snapshot currently serializes native bytes even though this adapter
never uses those bytes. This correctness-first boundary is not a low-allocation
per-frame implementation. A future cheap guard requires complete trusted
mutation tracking, not merely comparing revision numbers.

## Exact controller seams still to change together

1. `controller.fire()` currently calls `lab.strike`, writes undo history and
   calls `game.begin`. Canonical submission must replace—not accompany—that
   physical stroke, and preserve transactional history/cancellation semantics.
2. `controller`'s frame loop currently calls `lab.step` and sleeping-based
   `finishGameShot()`. A canonical shot needs a separate source-trace presentation
   clock and GPU-authoritative end-of-shot scoring/turn reducer. The frame loop
   must never advance Rapier while displaying a canonical result.
3. `PredictionService` currently starts LabForecast/Rapier and silently switches
   worker failure to cooperative execution. A canonical forecast needs this
   request/epoch boundary with no fallback to a different physical model.
4. `applyRoute()` currently changes settings then starts that legacy forecast.
   Candidate application must preserve the winning batch's exact source/profile,
   scene/epoch and selected-source re-execution identity.
5. Build/bundling, capability UI, explicit unsupported states, source sampling
   gaps, real rendering, score/turn/undo/redo integration, responsive controls and
   full real-app browser tests remain unimplemented here.

## Test scope

`tests/canonical-application-adapter.mjs` uses actual PhysicsLab snapshots and
actual game snapshots with an injected selected-session response. It checks
whole-roster admission, derived rules, stale direct-body/settings/game/clock
changes, unsupported replacement, copied output, exact/bounded presentation,
foreign results and forbidden dynamic/game calls. These are adapter lifecycle
checks, not native GPU physics or real browser/UI qualification.

Local validation (2026-10-27): `node --test tests/canonical-application-adapter.mjs`
passed 11/11 tests (0 skipped); `npm run typecheck` exited 0. This also covers
backend input mutation, external abort/supersession, incomplete capture and
unsupported raw settings. No native GPU or real browser run was performed for
this adapter, and the application wiring remains unimplemented.

## Explicit authoritative-state alternative

`createCanonicalStateApplicationAdapter({stateStore, selectedWorldProfile,
readContext, device})` is an additive opt-in source. Its harness is
`createCanonicalStateApplicationAdapterHarness` and labels output
`injected-test-state-adapter-v1`. Original PhysicsLab/MMQ1 factories and all
controller/UI defaults are unchanged.

Supply an actual `createCanonicalStateStore` owner and explicitly match its
`mmq1-ball-ball` or `mmq2-cushion` profile. This source reads the complete exact
scene, provenance and monotonic owner revision, never rendered/Rapier poses.
MMQ2 receipt identities retain `selectedWorldProfile`; missing/foreign profiles
fail rather than being stripped to match MMQ1. Owner cancellation, restore
(including same-scene ABA), begin/commit and disposal invalidate results, as do
context changes and the selected session's epoch guard.

The submission remains read-only. Complete manual results additionally expose an
explicit `commitState()`; forecast/search never commit. Adoption and undo remain
explicit caller operations. No automatic state/scoring/turn commit, height
snapping or mid-shot checkpoint is introduced. Unsupported
bootstrap heights or next-start clearance still fail the real raw binding gate.
A committed REST does not guarantee a supported next shot.

The integration tests in `tests/canonical-state-store.mjs` use the actual store,
full PhysicsLab-derived geometry and game snapshots, with explicitly injected
REST positions/session receipts. Odd positive/negative Q24 next-shot scenes,
three/four-ball rosters, profile/epoch guards and same-scene invalidation are
lifecycle evidence only: not GPU seam, physical parity, browser/UI or release
qualification.

**Closed explicit commit seam:** selected-session results expose guarded
`readSubmission()` with the exact session-created immutable request/candidate and
owned immutable raw settings. The session still exclusively owns its epoch.
Manual stored results offer synchronous `commitState()`, which first checks the
original source revision, context, local epoch and session guard, compares the
complete real submission, then calls `store.begin` with it. Only that begin's
single revision increment is permitted during the store's existing atomic
receipt checks. Same-scene restore, cancellation, replacement and ABA cannot
be hidden by manufacturing a fresh transaction. No identity field is omitted.

Commit returns owned identity/provenance, original and committed revisions, and
the store-owned snapshot handle, with `scoreAndTurnCommitted:false`. This metadata
and committed state survive later session cancellation. The old result becomes
stale after commit; duplicate commit fails. Existing read-only factories and
`runSelected()` behavior are unchanged. A missing submission accessor in an older
injected service only prevents explicit commit, not existing read-only use.

`tests/canonical-state-commit.mjs` drives the actual session lifecycle with an
explicit injected backend: it tests exact submission ownership, manual commit,
packed next-source Q24 preservation, stale/context/ABA/cancel guards, forecast,
unsupported replacement, corrupt REST and prepared-provenance rejection. This
is lifecycle/ownership evidence, not GPU physics evidence.

Local source-integration validation (2026-10-27):
`node --test --test-concurrency=1 tests/canonical-state-store.mjs tests/canonical-application-adapter.mjs`
passed 25/25 tests with no skips; `npm run typecheck` exited 0. No GPU execution
or real browser/application wiring was tested for this change.

Local commit-seam lifecycle validation (2026-10-27):
`node --test --test-concurrency=1 tests/canonical-state-commit.mjs tests/canonical-state-store.mjs tests/canonical-application-adapter.mjs tests/canonical-session-service.mjs`
passed **53/53, zero skips**; `npm run typecheck` exited 0. Independent source
review found no blocking issue. MMQ1 commit, legacy read-only receipt compatibility,
incomplete physics, foreign submission/raw settings and reentrant same-scene
restore are covered. No UI/controller/scoring/default changes are included.

Native commit-seam validation (2026-10-27):
`tests/canonical-state-commit-native.mjs` passed **1/1, zero skips** on actual
WebGPU SwiftShader under shared `/tmp/billiard-native-gpu.lock` and the unchanged
240-second / 1500-MiB process-tree watchdog. Elapsed 133.409 seconds; sampled
aggregate RSS 1480.75 MiB; maximum child RSS 1449.61 MiB; exit 0, no watchdog stop.
The real stored adapter ran a raw MMQ2 shot with one cushion event to REST,
committed all 256 final words through the real session/store seam, then verified
all four stable IDs and all 12 packed next-source position words exactly.
**This executes no second shot and makes no second-shot physics, physical GPU
hardware, browser/UI, scoring/turn or release claim.** Committed words and owned
metadata remained available after adapter cancellation. This test adds store
ownership evidence; CPU/GPU physics parity is covered by separate source tests.
