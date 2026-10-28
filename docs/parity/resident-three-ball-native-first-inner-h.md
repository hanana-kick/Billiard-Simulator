# Original native first-inner-h observation: partial exact parity and COM gap

This is a separate independent ORIGINAL native observation, not a source-wrapper
comparison. It is deliberately **not a native whole-h qualification**: it finds
an unimplemented final world-COM refresh and keeps that failure visible.

## Exact bounded original execution

`tests/resident-three-ball-first-application-native-fixture.cjs` constructs the
real three-ball controller with selected ball 2. Its original continuous `fire`
must reproduce the authenticated created snapshot byte-for-byte. It then calls
literal `PhysicsLab.step(1)`, preserving the original cue-present latch of 64
subdivisions. A test hook throws before the second `compliantTipContact` runs.

Thus exactly one actual native `world.step` and the original first inner-h
application phases run. The original binary64 clock, obstruction observation,
collision drain, angular patch, and withdrawal predicate all execute. Outer
`steps`, distances, heights and trails have not advanced. No convenience stepper,
modified dt/subdivision policy, whole shot, GPU or expected-state injection is
used. The case is the fresh selected-2 fixture only; it is not the immutable
after-turn capture rehydrated into a fabricated runtime.

The fixture produces separate `raw` (authentic t0 input) and `expected`
(observed h1) fields. The HOST test completes the candidate from `raw` before
decoding the expected endpoint. The expected endpoint never enters admission,
an initial bank, a numeric component or a plan. Temporary files use process-local
`TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp` and are
removed after the bounded test.

## Exact comparisons that passed

- All five actual dynamic bodies: current position/quaternion, linear/angular
  velocity, effective inverse mass/inertia and force slots.
- Complete native island manager, all represented body activation/IDs/change
  flags/extents, and the original modified-body queue.
- Final native BVH tree fields and current contact-pair endpoints/active flags.
  Native broad `pairs`/`pair_adjacency` and all serialized graph fields are not
  claimed covered merely by the tree/edge comparison.
- Current native solver color masks, pair hints, manifold metadata, graph
  buckets/epochs and exact awake order.
- Every one of the 144 packed words for all three native floor caches.
- Both actual joint descriptors, all joint/limit impulse lanes, cue local COM,
  mass/inertia and force metadata; no-contact cue application metadata.
- Exact binary64 application time, full events/game state, and unchanged outer
  bookkeeping.

## Real missing native owner: final world COM

The stronger test first failed on shaft `worldCom`. The source cue component
retains `[-0.6120642423629761, 0.14063364267349243, 0.054999999701976776]`;
the actual native endpoint has
`[-0.6120320558547974, 0.1406291127204895, 0.054999999701976776]`.
The head has the same missing refresh class. No tolerance was widened and the
field was not dropped: the committed test explicitly witnesses both mismatches,
checks they remain the pre-finalization canonical values, and asserts the
capability still reports `nativeWholeHVerified: false`.

Pinned Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177` explains the boundary:

- `src/pipeline/physics_pipeline/substep.rs`, `advance_to_final_positions`,
  lines 86–156: for each awake body, adopt final pose, propagate collider poses
  and harvest AABBs, then refresh world mass properties. Its caller at line 621
  runs this before post broad-phase updates.
- `src/dynamics/rigid_body_components.rs`,
  `update_world_mass_properties`, lines 547 onward: refresh world COM, effective
  inverse mass and world inverse inertia, then apply locks/type constraints.
- Parry 0.31.1 `mass_properties/mass_properties.rs`, `world_com`, lines 248–250:
  transform the retained local COM by the final body pose.

Original `Cue`/`Joint.adopt` component snapshots omit that native world-final
mass-property boundary. Their exact agreement cannot substitute for it. The
existing application checkpoint therefore remains correctly scoped.

The next source link must use current sealed poses and authentic retained local
mass, after each body's collider/AABB harvest and before broad post. The existing
initialization graph has the exact world-mass arithmetic as its first 12
outputs, but reusing that arithmetic does **not** authorize replaying creation
or relabeling an h1 state as initial input. The native-final projection must be
distinguished from the unchanged source cue component snapshot.

No runtime/default/four-ball gate is changed. Neither this partial native
observation nor the explicit unsupported witness qualifies outer-step, arbitrary
CCD/contact/event continuation, fully resident recurrence, or release activation.

## Exact numerical component, placement still separate

`three-ball-first-final-mass.mjs` now exposes the original initialization graph's
literal node prefix through its first 12 outputs. It packs only authenticated
retained local mass for the five actual dynamic bodies and gathers current poses
from the produced canonical bank. The unused lanes of the original 40-input
arithmetic ABI remain unused; they are not collider or body rows. The component
does not replay initialization, recompute attachment mass, or alter the old
four-ball programs.

Its emitted gather/evaluate/scatter verifies exact current awake order, body
handles/generations, local-mass identity, phase/epoch and unchanged gathered pose.
It publishes COM, effective inverse mass and expanded world inverse inertia.
Repeated execution or mutation of original local mass fails closed. The source
cue component bank is deliberately untouched.

The bounded native test is now 8/8 (18.08 s), including the explicit old-profile
COM-gap witness. The new numerical component reproduces **all five** native
final COM/mass/inertia fields exactly. This component harness does not establish
its original per-body AABB-harvest placement. That separate composed broad-owner
link must run after every actual collider of each awake body and before the next
body, then finish all mass updates before `set_aabbs`. It is not authorized by
passing this standalone component check.

## Distinct composed native-final profile

The new `createThreeBallFirstFinalMassBroadPostPlan` supplies that separate
placement. It interleaves bounds harvest and world-mass refresh in actual source
awake/collider order and requires all refreshes before BVH publication. The
ordinary and call-traced banks match exactly. Its older physical and legacy
profiles remain unchanged, so the missing-COM witness above remains an honest
regression for the old source-component scope.

`createThreeBallFirstFinalMassApplicationPlan` accepts only this sealed profile.
It first adopts the existing joint result and compares the complete original
source cue snapshot, exactly as before. That immutable snapshot is returned as
`sourceComponentCue`. It then verifies final native-mass inverse mass/inertia
against the existing joint result and reconciles the current canonical world
COM into cue metadata. This is a word-copy publication from the already
completed physical mass owner, not a delayed physical mass recomputation or a
second joint solve. The original application clock/observer/drain/patch/
withdrawal sequence follows unchanged.

The source-component and native-final factories reject each other's profiles.
Missing or repeated final-mass adoption fails before the application clock.
The new `cue` remains the component-shaped numerical projection (including
retained source helper fields), not an arbitrary native snapshot serializer;
`sourceComponentCue` remains explicitly separate.

The independent original fresh selected-2 test passed **9/9 in 35.19 s**. Its
new composed profile exactly matches all five native current poses, velocities,
COMs, mass/inertia and forces, while retaining all previously checked scene,
roster, BVH/journal, floor-cache, clock and history fields. The old-profile
unsupported COM witness is still tested, not erased or converted to a
whole-native pass.

This is one actual original inner h, not the 64-subdivision outer step or a
general native-whole-world serialization parity certificate. General contacts,
selected-1 empty cue edges, CCD continuations and fully resident recurrence stay
unsupported. Existing HOST source geometry/rigid-exclusion/roster orchestration
dependencies remain explicit. `nativeWholeHVerified`, `wholeH`, `worldCommit`
and runtime/GPU qualification remain false.
