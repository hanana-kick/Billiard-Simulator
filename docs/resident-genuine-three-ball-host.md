# Genuine three-ball HOST admission and game-rule groundwork

Base: `work/resident-full-history-v1` at `eb8179f`.
Scope: source-owned initial admission, exact discrete `ThreeBallGame` replay,
and an explicitly separate controller completion adapter. **No resident/GPU
numerical owner, raw-candidate generation, search evaluator, full-shot parity,
performance claim, default change, publication, or release activation.**

## Actual mode and semantics

- `src/App.tsx:120` labels `gameMode='free'` as **3구**.
- `src/controller.js:80–86` creates `ThreeBallGame` over the existing **three**
  objects in free mode. Only four-ball adds another sphere.
- `src/game-rules.js:12–17`: two selectable cue players, three object IDs. Both
  other balls are targets, including the other player's cue. There is no
  prohibited opponent identity. The second distinct target hit freezes the
  cushion count. A point requires at least three cushions at that moment and
  no floor contact. Success adds one and retains the cue; failure/floor adds
  **zero**, then alternates cue. No negative-point four-ball foul is imported.
- Pure `ThreeBallGame.finish()` has **no physical-state predicate**.
  `controller.finishGameShot()` separately waits for cue removal and **all
  three** balls sleeping before publishing the game result.
- This is **not universal three-ball search termination**. In
  `optimizer-core.js:10`, `fullShot` means `gameMode==='four'`. Its
  `observePhysicalStep`, `finishPhysicalHorizon`, and `stepTrial` can stop a
  successful non-four-ball query once the cue is gone without all objects
  sleeping. Route method/order, kisses, same-time ambiguity, obstruction,
  horizon, ranking, and inverse-planner semantics are not implemented here.
  In particular, this early query success is not an irrevocable gameplay score:
  a later accepted cue/floor contact can make `ThreeBallGame.finish()` return 0.
  See [source audit and discrete HOST witness](resident-three-ball-search-gameplay-boundary.md);
  no physically reachable late-floor trajectory is claimed there.
  The complete actual route options are preserved, not replaced by gameplay
  assumptions or a made-up four-ball opponent.

## Separate HOST interface

`src/resident-candidate/three-ball-host-admission.mjs`:

```js
const receipt = await admitThreeBallHost(decoder, {
  snapshot, preStrikeSnapshot, capture,
});
assertThreeBallHostAdmission(receipt);
const observer = createThreeBallHostObserver(receipt);
observer.emit(originalAcceptedPhysicsLabEvent); // HOST observation only
observer.finish({cuePresent, balls: sourceOrderedSleepingObservations});
requireThreeBallResidentOwner(receipt); // throws, never substitutes a miss
```

Admission invokes the existing byte-verified `importLiveRegisteredThreeBall`.
Both snapshots, pinned engine/source identity, native/JS byte round trips,
pre-existing bodies/colliders, managers, exact captured source metadata, selected
cue, rule state, and zero-step thirteen-call cue-construction journal remain
checked by that importer. No caller-supplied projected/expected/future state is
accepted. The caller's inputs are copied before the first await. Receipts are
deep-frozen and locally branded; a copied receipt is not authority. Full decoded
native state remains private and owned. Snapshot hashes bind native bytes,
**not arbitrary caller-invented JavaScript history**: the original owned capture
envelope remains a trust requirement.

The generic `verifyCreationArenaTransition` helper is reused to prove actual
body/collider/joint allocation order, generation, free chains, capacity and
unchanged unallocated entries. Only its source insertion **fast path** is admitted;
reserve/growth remains explicit unsupported. No four-ball authentication or
numerical seeding entry is called. Source body/collider modification queues are
also checked in exact creation order.

`nativeBodyRow` denotes the dense decoded native arena row, **not** a resident
scene slot/canonical body address. Objects retain source registry order. Selected
cue 2 stays index 1; it is not swapped to index 0. Future numerical scene-slot
binding requires its own explicit mapping and validation.

`src/resident-candidate/three-ball-game.mjs` separates:

- `beginThreeBallGame`, `consumeThreeBallGameEvent`, `finishThreeBallGame`:
  pure independent discrete source-class semantics.
- `finishThreeBallGameAtRest`: source controller publication predicate, not
  optimizer query termination.
- `createThreeBallHostObserver`: already-created pending game plus original
  emitted events; it never reruns initial history through the new shot scorer.
  It does not accept raw collision candidates or implement native filtering.

Unknown numerical ownership throws `three-ball-resident-owner-unavailable`.
Contract errors throw rather than returning a physical miss. No GPU API or WGSL
kernel exists in these modules; they are not imported by controller/worker/build
runtime paths.

## Actual counts and native mapping

| Boundary | Ball bodies | All bodies | Dynamic bodies | Colliders | Cue joints |
|---|---:|---:|---:|---:|---:|
| Original prestrike | 3 | 19 | 3 | 22 | 0 |
| Original cue created | 3 | 22 | 5 | 25 | 2 |

Sixteen static table bodies/colliders persist. Cue creation adds dynamic shaft
and head, a fixed guide, and three colliders. Ball capacity in this new contract
is exactly **3**, with **0 unused slots**. A later capacity-4 representation is
permissible only if capacity and live count are distinct and the unused slot is
never iterated as a physical fourth body/collider/contact/target.

The original default and previously captured real after-turn source have:

| Object | Body | Primary collider | Pair collider |
|---|---|---|---|
| 1 | `16:g0` | `16:g0` | `17:g0` |
| 2 | `17:g0` | `18:g0` | `19:g0` |
| 3 | `18:g0` | `20:g0` | `21:g0` |

These are **observed fixture values, not hardcoded admission constants**.

| Allocation order | Default | Real after-turn |
|---|---|---|
| Shaft, head, guide bodies | `19:g0,20:g0,21:g0` | `21:g3,19:g3,20:g3` |
| Shaft, tip, neck colliders | `22:g0,23:g0,24:g0` | `22:g3,24:g3,23:g3` |
| Flex, prismatic joints | `0:g0,1:g0` | `1:g2,0:g2` |

The existing after-turn artifact's created SHA-256 is
`b544e5542b248f8b09b0d1d17f49ddc5274d57ffcb58a4ec6cd0f89f47e9070a`,
prestrike `2750e8b44d5176006ea7748439b2be597041204d5b6597d291e1501eeed862ed`.
It is re-imported read-only: **no new full shot** is generated. Its selected cue
is 2, source index 1, targets `[1,3]`, application steps 5,875, native frame index
6,388. Native frame index is not a guessed total physical-step count.
This artifact is a separately captured/authenticated **ready-world prestrike
input boundary for its own next shot**, with its own matching original created
snapshot and journal. It is not an expected-only future checkpoint of the
default shot relabeled as runtime input. No future/reference arrays enter the
receipt. Its admission supplies no physical-continuation qualification.

## Full source event-history contract

`captureAcceptedEventHistory` is generic and reused unchanged. Both complete
bounded lists (maximum 120) are retained. Created history must be exactly
prestrike plus the actual accepted stroke, with original FIFO truncation at 120.
Every `PhysicsLab.emit` matters: keyed native contacts and non-key stroke,
compliant-tip contact, and cue-obstruction records all evict last-eight entries.

The new `packThreeBallInitialHistory` uses a **distinct 25-collider stride** and
exact source binary64 time words. Native key endpoints decode back into complete
handle index/generation; no index-only matching. Only the last eight entries are
packed, but the full 120-entry application history is retained. Unmappable
last-eight retired generations are unsupported instead of silently dropped.
Older retired keys outside that window need no resident key mapping.
The accepted stroke appears exactly once in the created history. Initial history
does not contribute targets/cushions/fouls to the newly begun game.

The real after-turn capture has **7 prestrike events → 8 created events**,
including the previous stroke and a non-key compliant contact. This is not the
known-invalid contact-only ring. The new representation is not a compatible
replacement for the current four-ball `RULE_LAYOUT`/WGSL bank.

## Four-ball resident delta inventory

| Existing source | Hard assumption / genuine-three-ball work still needed |
|---|---|
| `world-state.mjs:39–80` | Four-ball validator/kind; six dynamic body64 slots, shaft/head at ball slots 4/5; three “others”; `coupledStateLayout(4,27)`; BVH 24 retained → 27 created leaves; actual red/opponent rule identities. Needs explicit live counts 3/5/22/25 and two others, source-order mappings, real three-ball seed. |
| `geometry-state.mjs:22–40`, `world-geometry.mjs` | Four-ball validator, four body/descriptor slots, fixed catalog assumptions (four cloth + six ball-pair + sixteen cushion rows). Three balls have three cloth, three ball-pair and twelve cushion combinations; catalog cursors/cache ownership must be rebuilt, not padded with a physical sphere. |
| `scene-activation.mjs:417–428`, `scene-initialization.mjs` | Created scene admission explicitly demands 27 colliders and six dynamics. Bounded 32-body/6-dynamic storage is capacity, but genuine source counts and registration/energy/removal mappings need a new entry. |
| `world-broad.mjs`, `bvh.mjs`, `world-h.mjs` | Some packers are generic **capacity 27**, but the world owner embeds 24/27 leaf rosters, 27-row scheduling, 26-row geometry cursors and cue “others” count 3. Must distinguish capacity from live count, fresh three cue colliders, 22 retained leaves and 25 created leaves. |
| `ccd.mjs:27–38,294,352–367`, `world-ccd.mjs:14–18,46–96` | Requires eight moving ball colliders, four canonical bindings, arrays/loops of four and four-ball seed; three-ball needs six dual-channel moving colliders, three canonical bindings and true masks/order in both active/inactive CCD paths. |
| `world-solver.mjs:11,20,46` | Exactly four seed balls/scene slots and fixed coupled layout. Rebuild mappings/rosters/order for three balls; don't introduce a dummy solver body. |
| `application.mjs:24–35`, `world-application.mjs` | Exactly four source objects; four-ball physical-rule offsets/identity and encoded pair-stride assumptions. Source emitted-event filtering and full history must bind the true 25-collider metadata; two target kiss pairs instead of three. |
| `physical-rules.mjs:15,27–31,44–45,72–80` | Four distinct cue/first/second/opponent IDs, four-ball foul semantics, opponent positive-impulse input and full-shot terminal policy. New HOST **game** reducer is not a replacement route/search reducer. True-three search needs separately sourced termination/options/ambiguity/kiss/route policy. |
| `creation-template.mjs:54–68`, `world-initialization.mjs:19–20` | Four-ball projector/receipt, sixteen statics plus four objects in clearance roster; no genuine-three raw candidate bank/creation admission. Generic arena verifier is reused only for HOST proof. Numerical creation/overwrite/scene aliases still require genuine-three integration. |
| `source-event-history.mjs:34–56`, `world-initial-history.mjs` | New-profile seed validation is explicitly four-ball; packing requires 27 colliders and `minSlot*27+maxSlot`, ring guards use 729. Generic captured-history transition is reused, but genuine-three packing is a separate 25-collider contract. Raw prestrike → exactly-one accepted-stroke GPU commit remains absent. |

### Reusable pieces, not end-to-end qualification

- Existing genuine live capture/import, cue origin/application validators,
  native decoder and initial contact/broad/initialization/step-seed modules.
- Generic exact-data ownership, source history transition, arena-transition
  verifier, source-number representation and source cue math.
- Contact journal/solver-color roster bounded layouts, scene bookkeeping,
  broad/BVH primitives and coupled solver's documented **1–4 body capacity**
  can be candidates for reuse. Four-ball world integration is still hardcoded;
  sharing numeric kernels alone does not admit three-ball execution.
- Existing experimental live-three first-step/outer/tip/withdrawal proofs have
  their own limited reference/GPU contracts. They are not a source-owned
  resident raw-to-rest, full-search or release qualification, and are not
  broadened by this change.

## Verification and remaining gates

Focused HOST tests (9 passed, 0 failed) with existing after-turn evidence:

```sh
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test tests/resident-three-ball-game.mjs \
  tests/resident-three-ball-host-admission.mjs
```

- Independent untouched ORIGINAL class comparison over **2,592 bounded
  discrete event sequences**, both cue choices, exact snapshots/results.
  These are semantic event fixtures, not claimed physical trajectories.
- Independent ORIGINAL fixture process constructs each three-ball source,
  manually selects cue 1 or cue 2, uses original controls (speed 4.5), captures
  with zero capture steps, then fires the continuous original independently.
  Native created bytes and game/events match. Four original outer steps per
  cue supply **nonempty actual emitted-event** assertions; no evolved state
  enters admission. The HOST process loads no Rapier/PhysicsLab/controller.
- Local receipt branding, deep immutability, mutation across await, exact
  generations/free-list order, non-key FIFO eviction, unknown/future/four-ball
  inputs, forged targets and invalid late floor/controller-rest cases.
- Existing read-only importer regression: **11 passed, 1 explicit Chromium
  skip**, using old actual default/after-turn artifacts, no fresh fullshot.
- Syntax and whitespace checks pass. No release build/full physics sweep/full
  UI tests or GPU jobs were run for this isolated, non-runtime stage. Those
  remain release gates; this commit does not authorize publication/deployment.

Next genuine-three work requires a distinct resident initial bank plus raw
creation, actual scene/broad/contact/CCD/coupled-solver mappings, emitted-event
producer, pure gameplay and separate query reducer/termination, numerical
parity for original source settings/identities, and complete release tests.
Unsupported remains unsupported until those owners exist.
