# Genuine-three-ball created control-layout bridge (HOST only)

Implemented after the bounded proposal at `7a5801c`. This is **initial-only
serialization**, not native/GPU execution, raw candidate construction, a first
substep, a full-h bank, a search evaluator or release enablement.

A separate [bounded HOST/source initialization plan](resident-three-ball-created-initialization.md)
now consumes this immutable initial representation. It does not widen this
bridge's initial-only capability or qualify a full numerical world.

## Interfaces and authority

```js
const admission = await admitThreeBallHost(decoder, actualOwnedRawCapture);
const initial = await projectThreeBallCreatedRegistration(admission);
const layout = packThreeBallCreatedControlLayout(initial);
assertThreeBallCreatedControlLayout(layout);
const diagnostic = decodeThreeBallCreatedControlLayout(layout);
```

The projection helper lives in the separate `three-ball-host-admission.mjs` and
uses its **private owned original t0 projection**, not caller-supplied projected
state. It invokes the existing `exportRegisteredCueInitialization(...,'three')`
and native body-registry extractor. The exporter rechecks snapshot bytes,
original creation journal/identity and original cue descriptors; its numerical
initialization inputs are **not evaluated**. A new immutable local registration
brand is required by the packer. Copies, guessed projected states and future
inputs are rejected.

`three-ball-created-control-layout.mjs` serializes initial control fields using
the existing `SCENE_LAYOUT` and `SCENE_INITIALIZATION_LAYOUT` constants. Its
representation code is adapted from the four-ball host serializer, but **all
old four-ball packers and WGSL generators remain byte-unchanged**. The bridge
does not call them to pretend this is four-ball data. Existing diagnostic
decoders are reused to verify the source-preserving initial representation.

Output kind: `resident-three-ball-created-control-layout-v1` (not the existing
world-template kind). There is **no `state`, `segments`, numerical program,
source CALL plan or full-world execution entry**. Existing `generateWorldHPlan`
therefore rejects it. `requireThreeBallResidentOwner(admission)` continues to
throw `three-ball-resident-owner-unavailable` after successful packing.

## Exact physical identities, not capacity bodies

- Actual source: three spheres; dynamic shaft/head; fixed guide; sixteen table
  statics. **22 bodies, five dynamics, 25 colliders, two cue joints**.
- The scene format retains its generic 32-body/27-collider capacity. Only 22/25
  rows are live; unused body/collider rows remain zero. No fourth sphere, fake
  handle, phantom collider, opponent, target or sleeping body is inserted.
- Future canonical dynamics remain source-object ordered
  `[ball0,ball1,ball2,shaft,head]`. The original scene role order is
  selected-ball first. `layout.bindings.dynamic` explicitly maps canonical
  indices and exact generation-bearing handles to their actual scene slots.
  Selecting cue 2 leaves its canonical index 1 but maps it to scene slot 0.
  The fixed guide has a scene slot but **no dynamic canonical index**.
- Actual after-turn allocation order remains shaft/head/guide
  `21:g3,19:g3,20:g3`; collider order `22:g3,24:g3,23:g3`; joint generations
  remain native. Nothing is normalized to initial handle order or generation 0.

## Retained t0 state

The bridge preserves the complete original island manager, holes/free lists,
epochs/sleep stamps, registered ball IDs and sleep flags, source modification
queues, collider parent/pose/change fields, native cue graph node/edge order,
directional adjacency and original joint mutation order.

Cue bodies remain **fresh unregistered IDs (`0xffffffff`), changes 255, and
zero max extent**. Scene phase is source-created/pre-user-changes. The numeric
receipt mask is 0 and all 90 numeric-output words are zero: no mass/extent,
registration, collision or integration operation has run. Intra-component
status words are initial serializer metadata, not whole-world RUNNING admission.

`layout.history` carries the complete prestrike and created 120-entry-bounded
source event lists plus the distinct genuine-three last-eight encoding. The
actual accepted stroke appears once; old history is not replayed into current
game scoring. Original exact binary64 clocks are retained. The existing
after-turn source supplies seven prestrike records and eight created records.

Nonempty typed arrays cannot be frozen in JavaScript. Layout arrays are made
non-extensible and sealed against private exact copies at every public
assert/decode. Mutation, detached arrays, forged/copy receipts and overrides of
the array comparator are rejected. Decoding returns a fresh diagnostic copy.

## Explicit unsupported boundaries

- Non-branded/four-ball/constructor/future source; changed generations,
  unsupported material/timing or non-ready source already fail admission.
- The current allocator fast-path receipt does not admit reserve/growth.
- This bridge requires exactly the original two enabled cue joints, fresh cue
  queues, three cue graph nodes and two edges, no persistent cue joint links,
  no pending split or removal journal, bounded existing island/contact maps,
  and only unchanged actual fixed bodies beyond the source role registry.
- It does not consume user changes, initialize numeric mass/poses, run source
  integer kernels, detect contacts, integrate, generate a source owner, or
  admit active CCD/solver/route evaluation. Initial history may represent a
  legitimate later ready-world boundary; that grants no continuation support.
- A successful pack is not a physical PASS/MISS, and missing ownership remains
  unsupported. Gameplay finish, controller rest publication and query stopping
  remain separate contracts.

## Tests and process-local temporary storage

The requested directory was safely created without changing shell/global
environment or existing capture paths:

```sh
mkdir -p /workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test tests/resident-three-ball-game.mjs \
  tests/resident-three-ball-host-admission.mjs
```

The new process temp root is recorded by both the HOST test process and its
independent original fixture child; their paths are asserted equal. The explicit
historical `/tmp/three-ball-live-evidence-20261025/capture` path is **unchanged**.
No global `TMPDIR` setting or historical artifact relocation is introduced.

**12 tests passed, zero failures/skips.** Both selected cues plus the existing
real after-turn artifact are checked. Original fixture capture remains byte-
identical to independently firing the continuous original source. The new bridge
advances zero physical steps. Independently decoded original snapshots prove:

- every represented body activation/extent and all 25 collider poses preserve
  exact native **f32 bits**, not rounded comparisons;
- all retained raw role-body numerical values and collider records equal the
  untouched original decoded state; complete manager/queue/IDs/graph fields agree;
- source snapshot hashes stay unchanged across projection/packing; temp-root
  plumbing has no numerical inputs or arithmetic changes;
- unused generic capacity is zero, numerical-output readiness is zero, and
  metadata/word mutations/detachment are fail-closed.

The unchanged existing after-turn snapshot hashes remain
`2750e8b44d5176006ea7748439b2be597041204d5b6597d291e1501eeed862ed`
(prestrike) and
`b544e5542b248f8b09b0d1d17f49ddc5274d57ffcb58a4ec6cd0f89f47e9070a`
(created). This is its independently authenticated next-shot input boundary,
not an expected-only future relabeled as runtime input.

No GPU/performance test, full-shot sweep, full release build/UI suite,
publication or deployment was performed. Remaining numerical/world-owner and
query integration gates in `resident-three-ball-next-boundary.md` are unchanged.
