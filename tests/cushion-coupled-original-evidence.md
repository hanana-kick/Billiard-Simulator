# Original cushion and sphere-pair coupled witness

This is an original-engine oracle only. It does not claim that a candidate CPU or GPU runtime has reproduced the result.

The frozen original at base `4a95d4aeccd5f4f1ecfe39669a24f9df605ae8e2` accepts all four requested `LabController.move` calls at y=0.0308:

- cue 1: x=-0.30, z=0.68062
- opponent 2: x=-0.8, z=-0.4
- red 3: x=0, z=0.67062
- red 4: x=0.8, z=-0.4

After native sleep, genuine `LabController.fire` accepts unchanged defaults: angle 0, elevation 8, tipX/tipY 0, speed 2. There are no post-fire ball state assignments, no `restoreSnapshot`, no candidate state, and no modified production runtime file.

The owned controller harness is derived from `four-ball-goal-fixture.cjs`. Its only behavioral differences are an observed-rest outcome category and removal of that fixture's artificial rectangular placement envelope. Legality is established by the actual original collision-safe move return, not a replacement collision test or an `allowOverlap` bypass.

## Captured facts

- Initial candidate boundary: `goalStrikeCreated` only, paired with the original strike-creation journal.
- Initial native contact graph order: 0→16, 0→20, 0→18, 0→22, 8→16. The first four are cloth contacts. The last is the original retained front-cushion/cue-primary contact.
- The retained cushion contact has one manifold point and one solver contact. Initial impulse and warm impulse are zero, event status 1, solver color 126, original recycle state present, workspace null. No cache is synthesized.
- First pair-retained/shared-cushion observation: h546.
- First simultaneous active and positive shared contacts: h549. Sphere-pair 17→21 impulse is 0.43702271580696106; cushion 8→16 impulse is 0.034451987594366074. Both involve cue body 16 in the same original native step.
- Full native rest: outer6734, h7175. The real controller returns `{cueId:1,delta:0,nextCue:2}`. Scoring leaves native snapshot bytes unchanged.
- Three independent original recreations, including one without extra contact observers/journaling, agree byte-for-byte across 29 raw boundaries and exactly on contact/game observables.
- All 11 standard record boundaries and 18 additional h545–550 preWorld/postWorld/postApplication rows are decoded using the pinned native decoder. Every future row is assertion-only. Full raw native checkpoints and per-h application frames are retained as evidence, not replay input.

## Artifacts

The committed `cushion-coupled-original-evidence.json` is the original capture manifest. The binary is deliberately outside Git:

`/workspace/scratch/f887f82f638e/cushion-coupled-original-artifacts/oracle-v2.v8`

- Bytes: 48,859,744
- Artifact SHA-256: `2b522adacad0f1a3b4f7f0ef73ca9ae076f897dc6ecb90e5aef199a96f8328e3`
- Initial snapshot SHA-256: `b4498d6c80d1c4bbae65eb264e1eaa1688ef7b61581a5064cac545cb5ec32a14`
- Original strike journal SHA-256: `af790ed7748783fa658917286c94d57ab020bde0b9c96dff39fbdbfa78375f92`
- Decoder SHA-256: `0bbebced302953113abd7c428d7b66a7a8a9b7d293fe4108c8d67dc06a824d82`

`initial-topology-v1.json` in that same artifact directory provides the exact initial plain contact/manifold/recycle/graph metadata for inspection. The authoritative native binary and lossless typed tree remain in the V8 oracle. The v1 artifact is preserved. The v2 recapture only removes a candidate-helper source dependency by independently projecting the graph inside the owned oracle; the complete native records, decoded rows, assertions, transitions, strike journal, and observer agreement are exactly identical to v1. No candidate importer is loaded by v2.

## Validation

```sh
CUSHION_COUPLED_REPLAY=/workspace/scratch/f887f82f638e/cushion-coupled-original-artifacts/oracle-v2.v8 \
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
node --test tests/cushion-coupled-original-contract.cjs
```

All 3 contracts pass, none skipped. Capture requires an explicitly coordinator-granted serial slot:

```sh
CUSHION_COUPLED_SERIAL_SLOT=1 \
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
node tests/cushion-coupled-original-fixture.cjs /absolute/new-oracle.v8
```

The capture rejects overwriting evidence. A non-capture probe can be requested with the final `probe` argument; probe output does not contain decoded replay checkpoints.
