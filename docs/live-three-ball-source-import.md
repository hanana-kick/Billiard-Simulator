# Current three-ball source capture and read-only import

This is an initial-only source-import stage. It is **not** a live three-ball GPU
solver or a full-shot CPU/GPU parity claim. Existing four-ball and legacy
three-ball numerical contracts are unchanged.

## Separate contract

- Boundary: `liveRegisteredThreeBallStrikeCreated`.
- Source schema: `original-controller-live-three-ball-fork-v1`.
- Projection kind: `original-live-registered-three-ball-source-projection`.
- Native engine: Rapier `0.21.0`, source revision
  `b716d375efc0201003f0cd9ef7168eee0b62c177`.
- Required engine SHA-256:
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.

The original controller currently calls three-ball mode `free`. A valid source
has an actual `ThreeBallGame`, exactly three registered sphere objects, sixteen
static bodies, no active cue, no pending game result, and passes the original
`anyMotion()` readiness check. Native sleeping flags are not changed. Default
physical parameters and the original timestep/subdivision settings are the
current explicit admission scope.

## API

`src/browser-initial-import/live-three-ball-capture.mjs` exports:

```js
const captured = captureLiveRegisteredThreeBall({ controller });
try {
  const projection = await importLiveRegisteredThreeBall(decoder, {
    snapshot: captured.snapshot,
    preStrikeSnapshot: captured.preStrikeSnapshot,
    capture: captured.capture,
  });
} finally {
  captured.dispose();
}
```

The capture uses `source.lab.fork()` and restores the actual game's snapshot
into an original `ThreeBallGame` on a private original controller. It does not
construct a replacement `PhysicsLab`, reset or set up a game, advance a native
step, force sleep, change a selected cue, or alter the visible controller. It
fires the private fork once through the unchanged original controller. The
returned candidate belongs to the caller; disposal frees only that candidate.

`src/browser-initial-import/live-registered-three-ball.mjs` exports:

- `importLiveRegisteredThreeBall(decoder, rawCapture)` composes the initialized,
  read-only, build-pinned WASM decoder with the projection.
- `projectLiveRegisteredThreeBall({ snapshot, preStrikeSnapshot, decoded,
  preStrikeDecoded, capture })` consumes both byte-verified decoder outputs.
- `requireLiveThreeBallNumericalOwner(projection)` explicitly throws
  `three-ball-live-owner-unavailable`.

The latter must remain a failure until a numerical owner explicitly implements
this live source contract. Do not convert this projection to a constructor seed,
route it through the four-ball owner, make an opponent cue illegal, or move the
selected object to index zero. The existing three-ball owner admits an older
constructor-only, selected-index-zero, awake/floor-only input. That does not
admit a current cue-2 turn.

## Preserved state

Both original snapshots are retained, together with their lossless typed trees,
complete decoded native states, original arena handles, colliders and contact
pairs. The projection does not select a subset of numerical caches or discard
unsupported contact data. It preserves complete islands, persistent membership,
sleep scan stamps, free lists, epochs, BVH state, narrow-phase/contact/solver
caches, multibody state, soft-body state, and native creation arenas.

Cue creation must leave every pre-existing body and collider exactly unchanged,
as well as all native managers other than the body, collider and impulse-joint
creation containers. Newly created cue bodies, colliders and joint endpoints are
bound to their actual generation-bearing identities. All three existing balls
must resolve back through their exact persistent and active-or-sleeping native
island memberships.

The application snapshot preserves source object order, selected cue ID/index,
full route options and target order, score/turn state, events, clocks and history
counts. Three-ball pending targets are both other balls, including the opponent
cue. `threeCushion` remains true and the original `ThreeBallGame.begin()` result
is preserved rather than substituted with four-ball rules.

Native `broad_phase.frame_index` is explicitly a frame index, **not** a guessed
historical native-step count. Application `steps` and native frame index are
kept separate. The observed cue-construction journal has thirteen cue calls,
preceded by one propagation call, and capture-local native step counters of zero.

Inputs are owned before the first asynchronous operation. Both snapshot hashes,
both native and JavaScript round trips, pinned engine/source identity, exact
metadata fields, journal phase/order, handles and readiness are checked. Shared
storage, accessors, unrelated snapshots, post/future/expected/seed input, and
legacy-origin relabeling are rejected. The hashes establish byte identity, not
cryptographic authentication of arbitrary caller-supplied history.

## Verification on 2026-10-25

Base application commit: `edd7dd0ea0d0b7a66d03e1d939ba046276f820cf`.
No controller, game-rule, physics-engine, four-ball or common owner file was
modified for this stage.

### Independent original CPU capture proof

Command (full-shot preparation is explicit and should be serialized with other
heavy tests):

```sh
THREE_BALL_LIVE_CONTINUATION=1 \
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test tests/browser-live-three-ball-source.cjs
```

All four original source-proof tests passed; a fifth cancellation/rejected-fire cleanup test also passed in the final focused run. The first original three-ball shot reached natural
rest after 5,875 outer steps. Original `finishGameShot()` then selected cue 2 and
repaired its targets to `[1, 3]`.

For both the default cue-1 source and actual after-turn cue-2 source:

- Capture advanced zero native steps and left the visible original unchanged.
- Captured pre-strike bytes equaled the actual source snapshot.
- Captured created bytes and application equaled an independently fired,
  continuously existing original controller, not another restored reference.
- A bounded continuation compared complete native snapshot bytes and application
  state after each of 64 outer steps of the original and captured fork. All
  comparisons were exact. This is not a per-substep or full-shot GPU proof.

Source snapshot hashes:

| Source | Pre-strike SHA-256 | Created SHA-256 |
| --- | --- | --- |
| Default cue 1 | `d736c6964006af5ae74d05cfeba99ad8e48d02ee15293affe6e224c36c9ff269` | `e8ead34aa0f144aebf2ec73d163796f7a8b75e1f79bf4f9ed7b3d0121e048750` |
| After-turn cue 2 | `2750e8b44d5176006ea7748439b2be597041204d5b6597d291e1501eeed862ed` | `b544e5542b248f8b09b0d1d17f49ddc5274d57ffcb58a4ec6cd0f89f47e9070a` |

The default created source has application steps `0`, time `0`, shots `1`, and
native frame index `72`. The after-turn created source has application steps
`5875`, time `6.1197916666664`, shots `2`, and native frame index `6388`.
Cue 2 remains at source registry index `1`.

### Read-only WASM projection

```sh
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test tests/browser-live-three-ball-import.cjs
```

The final import run passed 11 tests with 0 failures and 1 explicit Chromium
skip. The import process does not load, restore or step Rapier. It uses the existing
pinned read-only WASM decoder. Tests compare the complete projected native tree
and state with independent decoder projections, validate both cue identities and
turn targets, verify ownership across awaits, and reject corrupted provenance,
bytes, native trees, source metadata, rules, targets, identities, shared storage,
accessors, future data and cross-source snapshot substitution. They also assert
that existing four-ball and legacy three-ball contracts reject this distinct
projection and the missing numerical owner fails explicitly.

Without an evidence prefix, the test generates only a default original capture
in a separate process. Actual after-turn and cross-source tests skip unless the
genuine original full-shot capture has been explicitly generated. The decoder
manifest can be supplied with `RAPIER_WASM_PROVENANCE`; the local default points
to the existing sibling snapshot-decoder build. That build remains a test
prerequisite, not a network/runtime dependency added by this patch.

### Not verified / out of scope

A genuine Chromium equality test is included, but did not execute in this cloud
sandbox: Chromium could not create its local socket (`EPERM`) and the single
execution-environment retry failed during environment setup before Chromium ran.
No browser sandbox/security settings were weakened and no further retry was made.
The browser test is opt-in with `RAPIER_TEST_CHROMIUM` and cannot be counted as
passing. A Node-hosted browser-compatible WASM test is not a real-browser pass.

No GPU dispatch or live three-ball numerical owner is implemented here. Full
CPU/GPU shot parity, actual-app browser/UI suites, publication and deployment
are not verified by these tests. This stage deliberately reports those limits
instead of substituting a legacy or four-ball seed.

A separate [bounded cue-initialization component](live-three-ball-initialization.md)
now consumes this projection. It does not change this importer capability or
provide the missing complete first-substep/world owner.
