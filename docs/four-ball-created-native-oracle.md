# Original four-ball creation oracle

This capture is a test-only reference, not a GPU implementation or a parity claim.
The original runtime, numerical engine, source exporter, licenses, and controller
remain unchanged. The fixture runs entirely in the agent cloud environment.

## Original entry and timing

The harness follows `tests/four-ball-integration.cjs`:

1. Construct the original `LabController` and `PhysicsLab`.
2. Retain all 16 original statics and the three original constructor balls. The
   constructor completes 72 native world steps, while application time/steps remain 0.
3. Set `controller.state.gameMode = 'four'` and call original `setupGame()`.
   That method adds the fourth sphere at `(0.64, radius + 0.00005, 0.30)` with
   no extra settling, repositioning, restore, or preprocessing.
4. Call original `fire()` with its original defaults: cue 1, angle 0 degrees,
   elevation 8 degrees, speed 2 m/s, and centered tip.
5. Run the original application step only through the end of its first h,
   `1 / 61440` second. A test sentinel stops immediately after original
   `angularPatchResistance(h)` returns. This partial outer step is never resumed.

## Six frozen boundaries

- `constructor`: after the original constructor, before mode creation.
- `modeCreated`: after actual `setupGame()`, before `fire()`.
- `strikeCreated`: after actual `fire()`, before the first application h.
- `firstH.preWorld`: after original compliant-tip application, before original
  native `world.step(queue)`.
- `firstH.postWorld`: immediately after the native step returns, before the
  original application increments its time or drains collision events.
- `firstH.postApplication`: after original angular patch resistance returns.

Only `strikeCreated` is admitted as candidate initial state. All first-h
snapshots are assertion-only references. Constructor/mode snapshots document
provenance and do not silently replace the elapsed-zero strike seed.

The expected creation distinction is substantive: mode creation has 20 bodies,
24 colliders, but only the constructor's 22 BVH leaves and three cloth pairs.
Strike creation has 23 bodies (6 dynamic and 17 fixed), 27 colliders and two
joints, while the same 22 leaves and three cloth pairs remain. The five pending
collider insertions are the new ball's primary/pair colliders, then shaft, tip,
and neck. Original collider attachment has already folded the fourth body's
local/world mass and CCD thickness. The first native h retains that unchanged
attachment-mass identity while computing max extent/IDs and creating the real
missing proxies and fourth cloth pair. No absent
proxy, contact cache, mass, or active membership is invented by this fixture.
All counts and order are verified against the actual capture, not accepted
solely from this source-derived description.

## Recorded evidence

Every boundary contains its exact native snapshot and SHA-256, independently
round-tripped through the pinned source decoder and JavaScript typed encoder,
plus the original authoritative full typed decoder tree and a convenience
full-world projection. The original typed tree must re-encode byte-identically
at capture and reload. This includes all body/collider arenas and fields,
shape/material data, BVH, narrow phase, island manager, joints, integration
parameters, and ordered modified-body/modified-collider/removed-collider queues.
Integers outside JavaScript's safe-number range, including native u128
solver-color masks, remain exact BigInt values in the V8 artifact.
Native snapshot serialization does not expose the transient EventQueue payload
or serde-skipped workspaces; none is invented. The original collision-drain
call receives its unchanged original callback, and resulting application events
are captured separately.

The actual API journal preserves the original receiver, argument references,
and return value. Descriptor values are recorded before original API calls.
Actual created handle generations, joint setters, wake flags, impulse calls,
propagation calls, native-step calls, and original event-drain calls are recorded.
The mode's three creation calls and strike's thirteen creation calls are exposed
separately, so the fourth sphere cannot be dropped from provenance.

A second independent recreation omits the API journal. All six native snapshots
and application observations must be byte-/value-identical across the two runs.
This checks that journaling has not changed native or application behavior.
The bounded probe is not a full-shot trace or a GPU/CPU agreement test.

## Source identity and execution

The engine is bundled Rapier 0.21.0, SHA-256
`fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`,
source revision `b716d375efc0201003f0cd9ef7168eee0b62c177`.
The explicit admitted decoder binary is hashed, together with the fixture,
original controller, physics, math, render cadence, game rules, bundled engine,
and decoder adapter. Identity is checked before and after capture. The frozen
capture Git commit is retained as manifest provenance, separate from admission
by exact source bytes so that an unchanged fixture can be cherry-picked.

The light contract tests perform no native/GPU initialization:

```
node --test tests/four-ball-created-fixture-contract.cjs
```

Only after the coordinator grants the shared native/GPU slot:

```
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
  node tests/four-ball-created-fixture.cjs /tmp/billiard-original-four-ball-created-canonical-v1.v8
```

The API journal's secondary content hash uses tagged, sorted JSON with exact
64-bit number bits, not noncanonical V8 reserialization. The output and `.json` manifest must not already exist. Neither is overwritten.
Loading an absent fixture fails rather than initiating an implicit capture:

```
const {record, manifest} = require('./four-ball-created-fixture.cjs').loadArtifact(path);
const initial = record.boundaries.strikeCreated;
const expected = record.boundaries['firstH.postApplication'];
```

No existing three-ball exporter is generalized here. In particular,
`flatBalls`/`commonSeed` require existing floor caches and would be invalid for
the fresh fourth sphere. Consumers must implement genuine creation, insertion,
and contact birth instead of initializing from expected first-h state.

## Captured boundary correction

An initial test expectation that the fourth body's current local mass would be
zero before its first h was rejected by the original native oracle. The source
`RigidBodyColliders::attach_collider` (`rigid_body_components.rs:1227–1266`)
already accumulates local mass, updates world mass, and sets CCD thickness at
attachment. The fixture now asserts that actual source behavior, including
unchanged local mass across mode creation, strike creation, and first world step.
The first-h-only max extent/ID/proxy/contact-birth distinction remains intact.
This correction changes assertions and documentation only, never the original
world or a candidate initial state.

## Verified capture, 2026-10-24

- Capture source commit: `afbf4feeee7abefa32566cf942224915d167dabb`.
- Artifact: `/tmp/billiard-original-four-ball-created-canonical-v1.v8`, 6,096,798 bytes.
- Artifact SHA-256: `b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`.
- Manifest SHA-256: `1894618ad41122cb92d4acc8a402712b1230f4cdc825c6ce1d8141d92d95cd65`.
- Mode-created snapshot SHA-256: `982919a351245906b3eed35fd28daa48073f7669f9cf10ae240c0a5ed528b3ac`.
- Strike-created sole initial snapshot SHA-256: `cffbc79fdccfc6e763dfa6e72c78d84eca4ba1d050408b7e011192c18bf9413a`.
- Explicit reload, all six typed re-encodes, independent recreation equality,
  source/binary provenance, and canonical API-journal verification passed.

Actual native counts (body/collider/BVH leaf/contact pair): constructor
`19/22/22/3`, mode `20/24/22/3`, strike and first-h pre-world `23/27/22/3`,
first-h post-world and post-application `23/27/27/6`. Four of the six post-world
pairs are cloth-ball pairs. This does not mean six active constraints.

The fourth body is actual handle `19:0`. Before first h, its local/effective
inverse mass is `4.761904716491699`, diagonal inverse inertia is
`12590.1357421875`, and CCD thickness is `0.030750000849366188`. These remain
identical after first native h. Its maximum extent changes from zero to
`0.030750000849366188`, and its invalid IDs become active-island 0,
active-set 3, island 3, island-index 0. Its first-h y velocity is
`-0.0001596679794602096`; no pose displacement is observed at that boundary.

Mode-created queues contain body `19:0` and colliders `22:0,23:0`.
Strike-created/pre-world queues contain bodies `19:0,20:0,21:0,22:0`
and colliders `22:0,23:0,24:0,25:0,26:0`, in that order. Post-world queues
are empty. Original post-application angular resistance then queues only the
three original ball bodies `16:0,17:0,18:0`, even though their observed torque
impulses are zero; the newborn fourth body is not in that application queue.

The source color masks are `Vec<u128>` (`narrow_phase/mod.rs:345`), including
`2^127`. They are retained in the unchanged typed tree and exact BigInt projection.
The journal records typed arrays as their constructor/type tag plus exact values;
its canonical encoding retains those tags, f64 sign bits, undefined, nonfinite
numbers, BigInt values, and explicit native integer width tags.

Frozen artifact-only verification, with no native initialization/stepping:

```
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
FOUR_BALL_CREATION_REPLAY=/tmp/billiard-original-four-ball-created-canonical-v1.v8 \
  node --test tests/four-ball-created-fixture-artifact.cjs
```

Earlier failed projection/assertion/reload evidence is retained separately in
`/tmp/billiard-four-ball-native-creation-85df985.log`,
`/tmp/billiard-four-ball-native-creation-3900182.log`, and
`/tmp/billiard-four-ball-native-creation-0237fea-reload-failure.log`.
The earlier `/tmp/billiard-original-four-ball-created-v1.v8` and its manifest
remain untouched but are not admitted by the finalized loader because their
secondary journal digest used noncanonical V8 reserialization. No failed
artifact or native expected state is substituted into a candidate recurrence.
