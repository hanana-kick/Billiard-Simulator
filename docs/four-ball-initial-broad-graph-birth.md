# Original four-ball first-h broad and graph allocation

This is an experimental component prerequisite, not a four-ball world solver,
whole first-h parity, or whole-shot GPU/CPU parity. Production physics, world,
Pair, Scene, Init, and the native capture fixture are unchanged.

## Source and initial boundary

- Rapier source: b716d375efc0201003f0cd9ef7168eee0b62c177.
- Original controller: constructor with three balls and 72 native steps,
  setupGame creates one fourth ball, then fire creates the cue. No added settle.
- Frozen native artifact: `/tmp/billiard-original-four-ball-created-canonical-v1.v8`.
- Artifact SHA-256: `b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`.
- Only `strikeCreated`, `modeCreationJournal`, and `strikeCreationJournal` are
  exporter inputs. The exporter verifies the complete typed initial snapshot
  exactly re-encodes, reprojects it, and checks the convenience body/collider rows.
  `firstH.preWorld` and all later native boundaries are rejected as seeds.
- The official existing artifact loader retains all six byte-verified native
  boundaries. First-h postWorld is assertion-only and never feeds a candidate
  recurrence, proxy, graph, contact cache, or initialization.

At creation there are 27 colliders, 22 BVH leaves, and three cloth pairs. Actual
fresh insertion order is primary22, duplicate23, shaft24, tip25, neck26, all with
generation zero. Cue colliders are not conflated with all modified colliders.

## Separate factories and exact source ordering

Broad exposes `createInitialFourBallReferenceStage(seed)` and
`createInitialFourBallGpuStage(device, seed)`. Old factories remain three-ball
only. The initial registry retains explicit birth provenance and the actual
creation journals, whose handles, source-step counts, descriptor shapes,
collision groups and order must match the five newly created colliders. The
fresh sphere must retain its actual creation pose before insertion.

The existing capacity64 source BVH insertion implementation computes all five
fresh inserts, resolving refit, and raw BVTT traversal. No observed pair sorting
is used. Filtering produces this source AddPair stream:

1. collider6 / collider24
2. collider5 / collider24
3. cloth collider0 / fourth primary collider22

The frozen original first-h oracle has precisely this dense-edge extension.
The source traversal uses six rotations and emits seven unfiltered candidates.
The new sphere's two computed AABBs are bit-exact against the native boundary.
Parent pointers, leaf map, free nodes, and optimization counters also match.
This is not a claim that the full post-solve native tree matches: cue motion,
end-step fat-leaf writes and one internal box differ after the native solve.

Journal exposes `createReferenceStageWithInitialFourBallCue(seed, broad)` and
`createGpuStageWithInitialFourBallCue(device, seed, broad)`. It requires the same
branded initial registry. The fourth body has `proxyAbsent:true`, no min/max, and
its owned initial proxy is null. Separate presence lanes select the source
first-insertion AABB formula; unused zeroed shader inputs are not cached bounds.
Normal three-ball and prepared-four-ball arithmetic programs remain unchanged.

The narrow exception permits exactly one noncue AddPair, the original fourth
cloth edge, at sequence zero with the matching origin-bound broad receipt. It is
applied at its position in the source event stream. Later noncue birth/deletion
guards, active cue guards, lifetime ordering, atomic rejection, and receipt
freshness/origin checks remain in force.

## Explicit missing phase

The six-edge graph has four cloth identities and two inactive cue identities,
but the new cloth edge is inactive immediately after broad allocation. The
native postWorld edge is active because native narrow phase and solve ran.

The new Journal receipt explicitly reports:

- scope: `initial-broad-and-contact-graph-allocation-only`
- `activeFourthClothCacheOwned:false`
- `postCollisionManagerComplete:false`

The unresolved boundary is also retained in a private Journal origin identity,
not just these diagnostic fields. Every later state, receipt, and projection
retains `pendingCollisionBirth`. Removing labels from a returned graph, receipt
view, or projection snapshot does not change ownership. Direct fourth-cloth
`active:true` transitions are rejected, including later sequences and attempts
to attach a native expected cache. `assertFourthClothBirthOwned(projection,
backend)` reads the private identity and rejects completion. There is deliberately
no clearing API until a genuine numerical owner is integrated with origin,
backend, graph transaction, edge, lifetime, and cache receipt validation.

This receipt cannot complete Init's fresh-ball post-collision manager. The
fourth cloth manifold, warm/contact caches, solver-color ownership, activation,
manager contact link, and first-h solve remain for a separate owner. Held initial
poses and empty narrow transitions test only transactions, not rigid-body motion.

## Verification

Frozen implementation commit: `5b926d66396f6fe48259db6d827d630324188b74`.

Final verification on that frozen source:

- New N4 artifact/reference/actual-WGSL and negative gate: 9/9 passed, no skips.
- Existing three-cue broad, guards, and Journal reference/actual-WGSL: 9/9 passed,
  no skips. All 440 prepared source frames retain proxy maximum error zero and
  the original two AddPair identities/order.
- Existing bounded and freshness tests: 13/13 passed. The N3 packed inputs,
  arithmetic program, outputs, and pair-order hash regression remains unchanged.
- All experimental source files plus new test/exporter source hashes were
  checked before and after the heavy gates and were identical.
- No source native captures or production physics were changed.

Logs remain at `/tmp/n4-bvh-birth-5b926d6-gpu.log` and
`/tmp/n4-bvh-birth-5b926d6-three-cue-regression.log`. The complete source hash list
is `/tmp/n4-bvh-birth-5b926d6-before.sha256`; checked results are
`/tmp/n4-bvh-birth-5b926d6-after-first.log` and
`/tmp/n4-bvh-birth-5b926d6-after-regression.log`.

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
FOUR_BALL_CREATION_REPLAY=/tmp/billiard-original-four-ball-created-canonical-v1.v8 \
node --test --test-concurrency=1 \
  tests/experimental-four-ball-broad-graph-birth.cjs \
  tests/experimental-contact-graph-journal-bounded.cjs \
  tests/experimental-contact-graph-journal-freshness.cjs
```

Actual WGSL gate (executed after the shared slot was granted):

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
FOUR_BALL_CREATION_REPLAY=/tmp/billiard-original-four-ball-created-canonical-v1.v8 \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 node --test --test-concurrency=1 \
  tests/experimental-four-ball-broad-graph-birth.cjs
```

The gate freezes loaded source bytes and fails on edits during execution. Its
adversarial checks cover modified journals, insertion order, fresh identity,
extra settling, fake or absent proxies, changed native input, wrong boundary,
cross-origin/aborted receipts, atomic post rejection/retry, initial-only birth,
private pending-state label stripping, prohibited activation/cache injection,
late unowned overlap rejection, and sparse-ID BVTT metamorphism.

Existing three-cue regression used the same explicit decoder, GPU module, ICD,
and required-WebGPU environment, then ran sequentially:

```sh
node --test --test-concurrency=1 \
  tests/experimental-cue-broad-phase.cjs \
  tests/experimental-cue-broad-phase-guards.cjs \
  tests/experimental-cue-contact-graph-journal.cjs
```
