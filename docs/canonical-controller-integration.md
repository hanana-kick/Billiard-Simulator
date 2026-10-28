# Explicit canonical controller integration

**Experimental opt-in only; not release-complete.** The default application is
unchanged. No user session, legacy height or Rapier snapshot is silently migrated.

## Activation and local packaging

`installCanonicalController(controller, options)` installs an instance-level
owner on the actual mounted `LabController`; its normal frame loop has one
optional owner hook. Supply an already-admitted canonical `stateStore`, explicit
`selectedWorldProfile`, existing WebGPU `device`, and bounded `requestOptions`:
`executionProfile`, `budget`, `raw`, `continuation`, `maximumRecords` (and optional
`strikeBackend`). The owner assigns request/candidate IDs and continues from the
store's exact committed absolute clock. It never requests a device itself.

Activation requires a paused, idle controller with **empty undo/redo**, matching
actual game/physical roster, and resting admitted scene. Existing history is
rejected, not discarded or migrated. Four-ball game and selected three-cushion
option must agree. There is no automatic preset/reset or tab-triggered activation.

Package locally with:

```
node tools/build-canonical-controller-assets.cjs /absolute/output-directory
# Or include optional local assets in an otherwise normal application build:
node build.cjs --canonical-controller-assets
```

The optional bundle is `dist/canonical-controller-assets/canonical-controller.mjs`.
It exports `installCanonicalController` and `createCanonicalStateStore` only.
The public installer optionally accepts `searchOptions`; the browser wrapper creates
the reviewed sealed compact service internally and rejects caller `searchService` injection.
Importing it is inert; no script is injected into the default app and there is no
UI toggle or external runtime dependency. Caller must explicitly supply its own
already-admitted scene/store and bounded configuration. A bundle manifest hashes
all included sources; bundling is not runtime/GPU qualification.

## Authority, manual play and history

The store remains the sole physics authority. After explicit activation, the
legacy lab is disposed; the renderer receives a read-only facade with **no**
`strike`, `step`, `snapshot` or `restore` API. Neither final nor intermediate
render poses are ever read back into canonical state.

Manual fire freezes active selected cue/settings while future aim changes remain
separate. Complete live game context, store revision/provenance and session guards
remain active across computation, playback, paused frames, publication and commit.
Guarded source-context access binds the final score to the original entire game,
scene and selected shooter, not merely a candidate ID.

Only a complete scoring-eligible physical REST can commit state, then synchronously
install its prevalidated score/turn snapshot. No legacy game contact events are
fabricated and no incomplete result is scored. The existing Three/Four shooter,
signed score and next-cue semantics are preserved. Full physical completion is
independent of trace capture completion.

Undo/redo uses opaque exact store snapshots. In-flight replay is an explicitly
reauthorized shot from the exact pre-shot state, never a render checkpoint.
Destructive history insertion is deferred until a complete result is accepted;
failed/stale/cancelled operations preserve prior full-stack history. Future aim
edits retain their ordinary redo-invalidation effect. Failed/cancelled redo keeps
its popped shot entry available for retry.

## Presentation and forecast

`canonical-controller-projection.mjs` accepts only full-roster `exact-source` or
`exact-boundary` samples and preserves signed Q24 coordinates as JS numbers.
Source q means surface spin R*omega; conversion to angular velocity is HUD-only.
Sphere quaternion remains an explicitly cosmetic fixed reference, not integrated
canonical orientation. Cue preview is geometric, not a clearance proof; raw
producer admission remains authoritative.

Playback exposes `state.canonicalPlayback.poseTick`, `playheadTick`, `sampleStatus`
and `held`. A missing/bounded/capture-incomplete interval holds the entire last
exact roster, never mixes body clocks or invents an interpolated point. A held
pose is not labelled as a current exact sample. The final authoritative REST
scene may be installed even when intermediate capture was incomplete.

Forecast displays at most 32 source-clock samples as visual point rings, with
explicit exact/missing sample counts and physical-completion status. The UI
horizon bounds visible sample ticks, not the authoritative physical run. It never
connects sparse points using legacy `forecastGeometry`. The original receipt and
source revision remain guarded after publication; idle frame/notification paths
invalidate stale markers and reconcile an externally restored canonical source.

## Explicit limitations and evidence

- Resting ball x/z placement is available through existing drag and Manual controls.
  Authoring uses Q24 resolution and the original conservative full-scene raw-start
  clearance gate; refusal does not prove an actual collision. Invalid/no-op edits
  preserve source/history/search. Accepted edits invalidate search/forecast, preserve
  the owner clock and game state, clear physics receipts, and support exact undo/redo.
  Height/material/add/remove/game-mode/rule edits remain unavailable; no fallback.
  Reset explicitly restores the activation scene, game, aim and clock, clears history
  and cancels pending work. The edited search grid and monotonic request IDs remain.
- Same-model compact search is optional and bounded as described below. Without
  explicit search options it remains unavailable. Legacy route filters, external
  finalized search requests and resume are not silently interpreted or supported.
- There is no cross-backend history migration, mid-shot checkpoint, physics cue
  animation, dynamically integrated sphere quaternion, or continuous exact
  sampling guarantee. Session cumulative work/event budgets are not newly
  enforced by this integration.
- Host tests use the actual controller and injected guarded session receipts.
  They verify lifecycle/source/history/render routing, **not** canonical physics
  correctness, native GPU controller execution, or real browser operation.
- Browser execution is blocked in the container. No sandbox workaround or user
  computer was used. Full real-app browser/mobile/settings checks remain required
  before release, along with native controller qualification and remaining
  production functionality. No release, push or deployment claim is made here.

## Recorded local checks

Focused adapter/store/projection/controller/packaging/default-frame tests: **58/58**.
Typecheck and the full local app build with `--canonical-controller-assets` passed.
Retained canvas/window/document callbacks were bound before opt-in in host tests
and exercised afterward (drag refusal, cancellations, visibility, keyboard
fire/undo/redo, input-focus exclusion); these are not real browser tests.

## Explicit compact parameter search

The packaged browser installer accepts an additional `searchOptions` object:

```js
searchOptions: {
  parameterGrid: {
    angles: [-10, 0, 10], speeds: [0.5, 1], elevations: [25],
    tipXs: [0], tipYs: [0, 0.2]
  },
  maximumCandidates: 4096
}
```

This example produces 12 explicitly enumerated candidates, not a continuous or
complete billiards-path solution. The five finite distinct axes and their product
are checked before any controller method is replaced. Controller angles must lie
in [-180, 180], matching the actual manual setting domain; no normalization or
clamping is permitted to change a verified shot. Invalid raw physics inputs remain
unsupported/incomplete rather than becoming misses. 4096 is the maximum **queued
population**, not GPU parallel width. Qualified MMQ1 four-ball/raw2048 tiles
with 16 admitted candidates use N16. Other tiles use N3/N1; MMQ2 remains N3/N1.
Each compiled width is reused within one search request. The UI distinguishes
the maximum eligible width from actual completed tile widths. A mixed unsupported
tile can use N3 before a later admitted N16 tile; no input is silently dropped.

After activation, the existing route tab/button now invokes that service. Each
candidate uses the same full-gameplay rules and profile as selected manual play.
Only a completed positive gameplay PASS appears as an applicable candidate. MISS,
INCOMPLETE and UNSUPPORTED counts stay separate; compact packets do not contain
contact order, cushion count, path distance or arrival time, so the UI does not
invent those fields. No per-candidate CPU physics or selected-shot verification
loop runs. Applying a private guarded candidate sets its exact five shot inputs;
the existing strike button then runs the same canonical selected engine.

Stopping retains only already-published guarded candidates. Source revision ABA,
roster/game/rule changes, ordinary input edits, manual firing and disposal cancel
or invalidate stale work. The original scene revision and private candidate
settings are checked before apply; modifying UI result objects cannot change the
applied shot. No continuation/resume or unsupported legacy filters are advertised. The manual
tab allows replacing the finite grid via `updateCanonicalSearchGrid({parameterGrid})`.
Each axis must contain distinct finite values in its displayed admitted input range;
the exact Cartesian product is shown before applying or running. The population cap
is4096 queued candidates, not4096-way parallel execution. Invalid edits leave an
active search intact; an accepted edit cancels/stales prior work without changing
physical state, score or history. Combined tip radius above0.6 remains counted and
is reported separately rather than silently removed.

The renderer/controller host tests cover actual instance callbacks and source
lifecycles, but injected service tests are **not native GPU or browser evidence**.
The explicit fresh-game UI entry is described below; full browser qualification
remains required, and a console-only invocation is not a completed product proof.

## User-visible explicit fresh practice entry

An optional app build (`node build.cjs --canonical-controller-assets`) now exposes
**GPU 실험 새 게임** in the mounted application. The normal build has no availability
flag/button and does not fetch optional assets. Opening the confirmation dialog
requests no device. Confirming loads the local self-contained module and requests
an actual WebGPU device with the nine storage bindings required by this MMQ1 path.
Missing support is an error, never a silent fallback.

The confirmation explains that a new authored four-ball practice scene replaces
the initial game, with scores reset and no legacy state/history migration. The
entry only accepts an idle paused game with empty undo/redo; existing history must
be explicitly reset using the ordinary game first. While the device request is
pending, cancellation, duplicate requests and changes to the previous game are
checked before replacement. Failed setup releases the acquired device. Imported
modules remain inert; no automatic opt-in happens on tab changes or page load.

The preset is a new unstepped table with explicitly authored resting ball positions,
not a moved/snapped copy of the current Rapier scene. The initial input grid is
**nine candidates**, editable in the manual tab after activation: angles -2/0/2 degrees, speeds 0.5/0.6/0.7 m/s, elevation25,
tipX0/tipY0.2. It uses the current MMQ1 ball-ball profile, so unsupported cushion
paths stay unavailable. Positions/inputs are authored, but no outcome is hardcoded.

Use the route tab's search button, choose a verified positive candidate, then press
the ordinary strike button. Search does not fire automatically. Applying a candidate preserves the existing
forecast toggle; it does not force a hidden extra selected-shot calculation. Resting x/z editing is supported; height/material/add/remove,
game-mode changes inside canonical mode and legacy history migration are still
unsupported; reset returns to the canonical activation scene, not the legacy engine; reload returns to the ordinary default game. Device loss cancels work
and blocks further search/fire/forecast. Disposal releases the entry-owned store
and device. The owner exposes only a copied `readCommittedState()` diagnostic result.

Host checks cover this explicit entry and retained controller callbacks. They are
not evidence that the UI has been exercised in a real browser; that release gate
remains independently required.


## Explicit fresh profile choice

The new-game confirmation defaults to MMQ1 and can explicitly choose MMQ2 before
activation. Both use the same authored table and initial nine parameter choices;
MMQ1 requests nine storage bindings, MMQ2 ten. There is no profile migration of an
existing canonical owner. MMQ2 uses the already-supported bounded cushion engine,
not a new arithmetic path; unsupported/incomplete outcomes are not misses. Existing
individual MMQ2 evidence does not qualify this entire fresh-entry/search/apply flow
or arbitrary cushion shots. Reset does not recover a lost GPU device.
