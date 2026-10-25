# Original four-ball creation preprocessing

This is a component-only prerequisite, not complete first-h, whole-world, or
whole-shot CPU/GPU parity. Production physics, world/Scene, broad phase, contact
Journal, and cue-created stroke code are unchanged.

## Exact source boundary

The original controller constructs three balls and runs its 72 native settling
steps, then `setupGame()` attaches the fourth sphere and `fire()` creates the
unchanged cue. No additional settling is permitted. The independent original
artifact is `/tmp/billiard-original-four-ball-created-canonical-v1.v8`, SHA-256
`b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`, captured from
frozen source `afbf4feeee7abefa32566cf942224915d167dabb` and admitted by
`tests/four-ball-created-fixture.cjs`.

`exportInitialSeed({strikeCreated, modeCreationJournal, strikeCreationJournal})`
accepts only the initial strike boundary and actual three-call mode / 13-call
strike journals. It reconstructs source body, collider, manager, and queue fields
from the byte-verified initial typed tree, rather than later convenience copies.
Creation body defaults, attachment order, shape, mass and local poses are checked
against the actual source descriptors. The candidate receives no expected h,
snapshot, native world, or prepared native state.

The fourth ball is named `freshBall` in the component seed, corresponding to the
capture's `otherBall3`. It is followed by the unchanged `shaft`, `head`, `guide`
numeric inputs. All use the existing 40-float arithmetic plan.

## Eager attachment mass, deferred registration

The source's enabled concentric Ball attachments have radius
`0.030750000849366188`, primary mass `f32(0.21)`, and passive mass zero.
`attach_collider` already folded the local and world mass, COM, inertia and CCD
thickness before the first h. The local inverse mass is
`4.761904716491699`; all three principal inverse inertias are
`12590.1357421875`. These are retained original attachment-fold values, not zero
mass defaults and not an approximate sphere formula. The first-h unchanged fold
is an identity under this strict specialization. General mass/eigen operations
and changed attachments remain unsupported.

The numerical initializer computes the deferred max extent and collider world
transforms, while reproducing world COM/effective mass/inertia and CCD thickness.
Fresh-ball admission is separate from cue-role admission; a four-body GPU batch
must be exactly fresh ball, shaft, head, guide. Original one-to-three cue batches
remain unchanged.

`initializeFourBallUserChanges` consumes the exact pending body queue in source
order. It registers the fourth ball as awake slot 3 / persistent island 3 before
registering shaft and head, preserves allocator free-stack order, and replays the
existing 13 cue Link/Unlink events. Joint connectivity merges only shaft/head,
retaining the fixed guide as a link endpoint rather than an island member.
All native handles, island indices, and queue operations remain host u32 data,
not f32-packed GPU values.

## Deliberate unfinished collision boundary

The output is `source-user-changes-and-connectivity-complete-pre-collision`.
It preserves the three original cloth links, keeps the fourth island without a
cloth link, and exposes `pendingCollisionWork` with all five fresh collider
insertions. The first native h instead has a fourth cloth contact, additional
contact-link locations, consumed flags/removal journal, and an energy scan.
Tests compare only owned fields and assert that the complete manager differs.
They never delete the missing contact from expected data to manufacture parity.

`finishCollisionPhase` refuses this N4 result even if a caller supplies the old
three-ball collision boolean. The legacy initializer and finalizer also inspect
the actual pending/consumed body and collider queues, dynamic-body roster,
complete collider count, and already prepared/registered non-cue dual-sphere
attachments. Removing both N4 result labels, relabeling the fresh ball as another
settled ball, or shortening only its queue cannot admit the unprepared four-ball
structure through the legacy one/three-ball path. Active and persistent island
membership must also match the complete dynamic-body registry and native IDs,
so deleting the fourth registry rows while its manager membership remains is
rejected. The original altered-single-ball fixture's already prepared sphere may
remain in the modified-body queue; the check restricts fresh registrations, not
that existing source mutation. A separate owner must establish genuine broad/
narrow contact birth and connectivity before a future N4 finalization path can
be implemented. This change does not supply that path.

## Verification

Light gate: 17/17 tests passed, zero skipped, without native initialization,
decoder execution, or GPU use. The serial native and actual WGSL gate passed
8/8 tests, zero failures/skips, at frozen source
`bbe2c6dd045ec4e722e102d0c7f1230ba48da9ac` in 3.875 seconds. It includes all five
existing three-cue tests and three new N4 tests. Actual WGSL uses Vulkan /
SwiftShader in the agent container, not the user's hardware GPU. Every new N4
GPU numerical output equals the CPU arithmetic-plan output exactly; native
comparisons use the unchanged existing tolerances. Exact commands:

```sh
export RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder
export FOUR_BALL_CREATION_V8=/tmp/billiard-original-four-ball-created-canonical-v1.v8
node --test tests/four-ball-initialization-contract.cjs tests/four-ball-created-fixture-contract.cjs
REQUIRE_WEBGPU=1 GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
  VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
  node --test --test-concurrency=1 tests/experimental-four-ball-initialization.cjs tests/experimental-cue-initialization.cjs
```

The independent numeric reference restores only `strikeCreated` and calls the
unchanged native `recomputeMassPropertiesFromColliders` and
`propagateModifiedBodyPositionsToColliders` APIs. It never steps that world.
Existing tolerances remain unchanged: COM/pose/inertia `3e-6`, effective inverse
mass/extent/thickness `2e-6`, local mass identity exact. Original first-h state is
used only for expected extent/IDs/local-mass comparisons and to demonstrate the
missing collision/energy work. The previous three-cue native/WGSL tests are part
of the serial regression command.

The first serial attempt at `41228da` had five passes, three failures, and zero
skips. Two WGSL tests found no Vulkan adapter because the command omitted the
known SwiftShader ICD path; the explicit path above fixes backend selection.
The old altered-single-ball manager regression exposed an overly strict total
modified-body queue length check, now replaced by fresh-registration and actual
registry/membership checks. The new N4 native numeric and deferred extent/ID
tests already passed in that attempt. No tolerance or expected state was changed.
Its log is `/tmp/billiard-n4-init-41228da-native-wgsl.log`; recorded source and
commit hashes remained identical before and after the invocation.

Passing gate evidence:

- Log: `/tmp/billiard-n4-init-bbe2c6d-native-wgsl.log`.
- Exact command: `/tmp/billiard-n4-init-bbe2c6d.command`.
- Commit hashes: `/tmp/billiard-n4-init-bbe2c6d-before.sha` and `-after.sha`.
- Eight loaded source/fixture/engine hashes:
  `/tmp/billiard-n4-init-bbe2c6d-before.sources` and `-after.sources`.
- Both commit and source lists were byte-identical before and after the gate.

These gates establish numerical preprocessing and host-u32 registration only.
The N4 output still deliberately refuses collision-phase finalization.

Source attribution: Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`,
`src/dynamics/rigid_body_components.rs` (attachment fold and mass update),
`src/pipeline/user_changes.rs`, and `src/dynamics/island_manager`; Parry 0.31.1
mass properties and shape bounding spheres. The existing Apache-2.0 notice and
`vendor/RAPIER-LICENSE.txt` are retained.
