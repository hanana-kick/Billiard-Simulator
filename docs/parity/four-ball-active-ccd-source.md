# Original four-ball active CCD source witness

This is source-oracle evidence, not CPU/GPU parity certification or a claim that
all manual settings are supported. Original `src/physics.js` is unchanged.

## Domains and original input

The actual manual/controller limit is speed 5. The original PhysicsLab engine
accepts speed up to 10. These are intentionally separate:

* Actual `setGameMode('four')` (including original reset),
  `changeSettings({angle:2.0743270562430363,elevation:35,tipX:.25,tipY:0,speed:5})`,
  and `fire()` succeeds. At the first right-cushion approach h650–657 the original
  pinned native diagnostic reports `preActive=false`, `firstImpact=null`.
  This is one bounded negative control, not proof that every UI-valid shot is inactive.
* The regression witness uses the same original four-ball layout and controls,
  then explicitly assigns the engine-domain speed 10 before original `fire()`.
  It is engine-accepted, **not changeSettings/UI-accepted**. The fixture asserts
  that `changeSettings` clamps 10 to 5 before this explicit engine override.
  No ball velocity, rotation, translation, CCD flag, physics parameter or
  `maxCcdSubsteps` is injected. The source maximum remains 4.

No placements or extra settling are needed. The fourth red is created by original
`setupGame` at (.64,.0308,.30); the selected cue remains at its constructor position.

## Created-only domain and oracle boundaries

The original 16 static bodies/colliders remain. Four balls are bodies 16–19,
with sphere/pair collider channels 16/17,18/19,20/21,22/23, all generation zero.
The source cue creates shaft/head/guide bodies 20–22 and colliders 24–26.
The created BVH has 22 leaves and five pending insertions, then 27 leaves after
first native h. After original cue withdrawal the world has 24 colliders.

`four-ball-active-ccd-fixture.cjs` retains the original creation API journal and
six decoded original boundaries, with independent observed/unobserved creation
byte agreement. Its `initial` field contains exactly strikeCreated,
modeCreationJournal and strikeCreationJournal. No future state is in that input.
Original `setGameMode`/reset/fire independently reproduces the same created bytes.
394 native-h and application frames are then captured continuously, with no
restored native world. Every original pre/post snapshot is also saved as the
existing BVH observer's length-prefixed stream. h388–394 snapshots are assertions.

The initialization seed exporter now admits finite source settings in bounded
engine ranges (angle ±180, elevation 0–85, speed >0 and <=10, tip radius <1).
This is not a dropped guard: it invokes the original pure pose function on the
byte-verified initial selected body, verifies the complete recorded cue pose,
three exact creation descriptors and both exact linear-velocity journal inputs,
and checks the typed initial velocities. Original fixed default-fixture
verification remains intact. Invalid settings, forged pose, altered descriptors,
velocity setters and future-state additions are rejected.

## Native source result

The existing hash-pinned active-CCD observer is reused without modification.
Its post-withdrawal/no-joints guard remains intact. No special four-ball binary
or weakened guard was needed. All seven observed/unobserved native worlds and
independent uninstrumented native outputs agree byte-for-byte.

At h389:

* first impact: 0.0009043353493325412 seconds;
* remaining source substeps: 4; source active flag: true;
* selected ball body: 16:0;
* strict positive clamp fraction: 0.8679085969924927;
* next translation changes from (1.3920730352401733, .030484238639473915,
  .27793553471565247) to (1.3907301425933838, .030484268441796303,
  .27780333161354065); current pose and velocity stay unchanged by the clamp.

The complete native/WASM typed-tree comparisons at h388–394 retain respectively
4,4,3,2,0,0,0 differences, all signed-zero only. This is deliberately not described
as byte equality across native and WASM. h392–394 are fully byte-equal.
This witness has one positive clamp, not multiple positive target TOIs.

## Artifacts and verification

Cloud-local evidence (not runtime assets):

* `/tmp/four-ball-active-ccd-engine-v1.v8`, manifest and `.inputs` stream;
  artifact SHA256 `5f2279f0dfb26fa72d0a49d4546018ccc62a548b3df38a6e0f91a4cd9e29a055`.
* Created snapshot SHA256
  `88d68307858c4f17d0c09139ba761db8b8a64a08c7758bbac45c1bef6d4c710f`.
* `/tmp/four-ball-active-ccd-source-v1.json` and manifest;
  SHA256 `2200d62bf28b53d2b828fffff29f15f22a8285829b5e03b470fc4bd454c899d2`.
* Source-native capture log `/tmp/four-ball-active-ccd-source-v1.log`.
* Actual controller negative-control log `/tmp/four-ball-active-pilot-v3.log`.

Artifact-only new contracts: 4/4 pass. Existing default initialization contracts:
10/10 pass. Full-world CPU/GPU recurrence remains a separate gate.

Reproduction environment:

```
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder
ACTIVE_CCD_SOURCE_PROBE=/tmp/billiard-active-ccd-target/debug/active-ccd-source-probe
ACTIVE_CCD_DIRECT_PROBE=/tmp/billiard-v3-native-target/debug/rapier-active-ccd-probe
ACTIVE_CCD_BUILD_PROVENANCE=/tmp/billiard-active-ccd-target/active-ccd-probe-provenance.json
POSITIVE_CCD_BUILD_REFERENCE_CAPTURE=/tmp/active-ccd-e35-source-capture-v2.json
FOUR_BALL_ACTIVE_CCD_V8=/tmp/four-ball-active-ccd-engine-v1.v8
FOUR_BALL_ACTIVE_CCD_SOURCE=/tmp/four-ball-active-ccd-source-v1.json
FOUR_BALL_CREATION_V8=/tmp/billiard-original-four-ball-created-canonical-v1.v8
```

Use create-new output paths for fixture and source-capture CLIs; evidence is never
overwritten. Run `node --test tests/four-ball-active-ccd-contract.cjs` and the
existing `tests/four-ball-initialization-contract.cjs` with the environment above.
