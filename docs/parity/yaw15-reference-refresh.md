# Yaw15 reference refresh on the common runtime

## Result

The unchanged original PhysicsLab was explicitly recaptured on clean runtime
`dd70c41ce52c35d3b57e2c6f9f523632dbeec454`. Both capture processes exited 0 without
a signal. The unchanged strict prefix and full-shot loaders accept the new
artifacts. No runtime, helper, identity validator, input, tolerance, or immutable
old artifact was edited.

Against the exact old artifacts used by `run-common-world-regressions.sh`, every
deserialized payload field is equal, including every original native snapshot
byte. The prefix container is byte-identical. The full V8 container is **not**
byte-identical: its size changed from 29,631,458 to 29,631,902 bytes. Deserializing
and reserializing both produces the same SHA-256
`12f25990cbd481a395a23db65ea9b3c72a4eb368756ebffa25970dd46d20b6cb`.
Do not conflate container serialization with native-state equality.

This is reference recapture and validation, **not a candidate parity pass**.
Current CPU and actual WGSL acceptance must be rerun against these artifacts.

## Why the prior admission failed

The common acceptance log rejected yaw15 before simulation at
`three-ball-yaw-full-shot-oracle.cjs:185`. Its nested prefix `sourceIdentity()`
hashes the complete `experimental-cue-created-variant.js` and
`cue-broad-phase-fixture.cjs` files. Both intentionally changed while generalizing
the candidate. The native engine, PhysicsLab, inputs, capture functions and other
listed sources did not change.

The broad-phase fixture belongs to candidate initial-state export and is not
called by native capture. The variant module supplies the original YAW15 and
SETTINGS constants to capture, but also contains candidate admission logic. Thus
the identity conservatively couples reference provenance to candidate code. It
does not imply the reference simulation used candidate recurrence. Keeping the
strict identity and explicitly recapturing was the chosen remedy; accepting or
rewriting the old manifest was not.

A future versioned format could independently record native capture dependencies
and candidate-export/validation dependencies, while retaining exact hashes for
each and explicit input specifications. That change is not implemented here.

## Native observation

- Fixed input: yaw 15 degrees, elevation 8 degrees, speed 2, centered tip.
- Prefix: 450 h, with 12 byte-identical original checkpoints in full capture.
- Full capture: 9,600 outer steps / 10,041 h, 111 checkpoints including created,
  13 transitions, four application events including three contact events.
- Original first rest: outer 7,099; exact score `{cueId:1,delta:0,nextCue:2}`.
- No candidate later state was used as a seed or fed into the original engine.

## Paths and commands

Run captures only with the coordinator's native/GPU slot. Each destination must
not exist; both original capture functions enforce exclusive creation.

```sh
cd /workspace/scratch/f887f82f638e/billiard-yaw15-reference-refresh
export RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder
export YAW15_REPLAY=/workspace/scratch/f887f82f638e/billiard-yaw15-reference-evidence/yaw15-dd70c41-prefix.v8
export YAW15_FULL_REPLAY=/workspace/scratch/f887f82f638e/billiard-yaw15-reference-evidence/yaw15-dd70c41-full9600.v8
node tests/three-ball-yaw-fixture.cjs "$YAW15_REPLAY"
node tests/three-ball-yaw-full-shot-oracle.cjs "$YAW15_FULL_REPLAY"
```

Current common-runtime acceptance, after capture and under its own slot:

```sh
cd /workspace/scratch/f887f82f638e/billiard-parity-recovery-v3-20261024
# Keep the three exported replay/decoder variables above.
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test --test-concurrency=1 tests/experimental-three-ball-yaw-full-shot.cjs
```

Prefix SHA-256:
`276c7e00664412ff0d51ae2af1949faff81ed070b2a2ca1d36cd257439cb0b5b`.
Full SHA-256:
`0896ccd01636d8e0dbea1ec003f8958f191e472fdd25a314d4f4b6ce1830e1a3`.
Each has an unchanged-format `.json` manifest alongside it.

The complete capture process records, hashes, comparison and diagnostic history
are recorded in `docs/evidence/yaw15-reference-refresh-dd70c41.json`. The
read-only verifier and logs remain in the workspace evidence directory. Its
initial two auxiliary runs incorrectly assumed container-byte equality; those
failures are retained, not described as passes. The final verifier proves full
field/native-byte equality and explicitly reports the unequal full container.
