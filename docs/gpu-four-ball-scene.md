# Bounded four-ball scene activation

This extends the experimental scene manager, not production physics. It is not
an initial-only full-world, full-shot, or general six-body solver claim.

## Admission and unchanged numerics

- Scene-wide registry capacity is six dynamic bodies: the four original balls
  and the two dynamic cue bodies. The cue guide remains fixed.
- Six-body admission requires one disconnected two-dynamic persistent cue
  component with exactly two impulse links, one fixed guide, and four other
  joint-free dynamic members. It verifies reverse membership, joint link
  locations, endpoints, and complete joint adjacency. Optional role labels
  neither grant admission nor redefine the six-body cue withdrawal targets.
- A contact operation coupling that cue component with a ball component is
  rejected transactionally. This does not enable a coupled six-body solve.
- The previously admitted global split bound stays five members per persistent
  island. The source joint-free local split bound becomes four, retaining the
  native 1024-expansion fallback, dual-frontier order, native collider/edge
  adjacency order, swap-removal, and allocator rules.
- Local split input checks active edge endpoints against their persistent links,
  not just matching edge numbers or incident-edge counts.
- The force arithmetic graph, sleep-energy scalar/WGSL program, dispatch, and
  all numerical formulas are unchanged. No production world, solver, or
  application file is edited by this change.

## Independent native source observation

`tests/four-ball-scene-probe/` builds a separate diagnostic against the verified
Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177` and Parry 0.31.1. It
never patches the shared pinned source, original decoder, or production WASM.
The build manifest records original source/archive hashes, every instrumentation
change, helper hashes, and the resulting executable hash.

The diagnostic captures cloned native structures at two exact boundaries:

1. After `resolve_removals` and `run_pending_split`, before energy/force update.
2. After energy/force computation and `update_islands`, before solver grouping
   and constraint solving.

Capture-enabled and independently repeated capture-disabled source runs must
produce identical complete post-step serialized bytes. Input is the frozen
original controller's `firstH.preWorld` snapshot and recorded original cue
joint API journal. The native probe does not use any first-h post-world output
to initialize, adjust, or replay its physics.

### Why snapshot bytes alone were insufficient

A control run restoring only the original pre-world bytes produces cue
`constraint_remove_count = 1`; the actual continuous constructor-72-steps →
mode creation → strike → first-h sequence produces 2. The same discrepancy was
confirmed by restoring those bytes in the original WASM runtime. It is omitted
input state, not an arithmetic CPU/GPU discrepancy.

`ImpulseJointSet` serialization deliberately skips `island_events`,
`modified_joints`, `all_joints_modified`, `assembly_epoch`, and
`selection_epochs`. The scene initializer already replays the original creation
journal; the independent diagnostic must also retain these source inputs.

The diagnostic therefore replays only the verified original five joint rows:
create generic joint, disable contacts, create prismatic joint, set limits,
disable contacts. It calls the pinned source builders and `insert`/`get_mut`
APIs with the recorded arguments, as the TypeScript bindings do. The reproduced
joint data, handles, graph, and queued members must match the initial snapshot.

A fully rebuilt native joint set initially differed only in serialized
`to_wake_up`/`to_join` collection order. The native build uses deterministic
IndexSet insertion order; the captured original order is retained exactly,
not replaced or sorted. A separate test-only input-restoration helper copies
only the five serde-skipped fields from the source-API-replayed joint set into
the original deserialized set. It is called before stepping and never from the
physics pipeline. The complete initial world must then re-encode byte for byte
identically. No removal count, pose, force, energy, or post-h field is assigned.

The final reference requires both initial full-byte equality and exact manager
agreement with the independent continuous-original WASM first-h fixture.
The snapshot-only control remains in the artifact to prevent conflating the
two oracle contracts.

## Candidate-test scope

The scene component is deliberately seeded with the genuine captured native
pre-energy boundary, then computes its own force/energy and integer manager
transition. This is prepared-phase component evidence only. It must never be
used to seed an initial-only candidate world or any future candidate recurrence.
The continuous original first-h post-world state is expected-only comparison
material. A separate world-owner integration must prove initial-only whole-step
or full-shot behavior.

Focused tests cover:

- Six-body structural admission and rejection, including missing/misleading
  roles, duplicate endpoints, corrupt reverse registration, and cue coupling.
- Original fourth cloth link registration order and exact location slots.
- Atomic original cue withdrawal by structural identities.
- Four-body local split, alternate-path no-split, forged adjacency rejection,
  delayed global split, sleep, and allocator ordering.
- Native/CPU/actual-WGSL six-body force and activation at the real source phase.
- Existing three-ball prepared first-h and recurrent source split/sleep gates.

## Reproduction

Set the explicit pinned source/archive, Rust cache, and isolated writable build
paths, then run:

```sh
CARGO_INCREMENTAL=0 node tests/four-ball-scene-probe/build-native.cjs
```

Required build variables: `RAPIER_SOURCE_ROOT`, `RAPIER_SOURCE_ARCHIVE`,
`PARRY_SOURCE_ROOT`, `PARRY_SOURCE_ARCHIVE`, `CARGO_HOME`, `RUSTUP_HOME`,
`CARGO_TARGET_DIR`, `SCENE_SOURCE_COPY`, and `SCENE_PROBE_HOST`. Build source,
host, and target must be separate from each other and from the repository and
pinned sources. The helper only accepts the verified archive contents.

Set `RAPIER_SNAPSHOT_DECODER`, `FOUR_BALL_CREATION_V8` to the verified original
creation artifact, and `FOUR_BALL_SCENE_PROBE` to the built binary. Capture once
to a new absolute file:

```sh
node tests/four-ball-scene-fixture.cjs /absolute/new-scene-boundaries.v8
```

Then set `FOUR_BALL_SCENE_V8` to that file and run serially:

```sh
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test --test-concurrency=1 \
  tests/experimental-four-ball-scene-capacity.cjs \
  tests/experimental-four-ball-scene.cjs \
  tests/experimental-three-ball-scene.cjs \
  tests/experimental-scene-split.cjs
```

The two existing three-ball tests also require their genuine creation and
split/sleep replay artifacts. These are focused component gates, not the full
production build, whole-shot suite, or browser/UI suite.

## Build-resource incident

The isolated helper build reached host compilation but failed writing its own
incremental query cache with `ENOSPC` on the 4.9 GiB `/tmp` mount. This was not a
numeric or reference mismatch. Only this task's reproducible incremental cache
(752 MiB) and three superseded 112 MiB diagnostic source copies were removed.
Shared oracle artifacts, other workers' files, the original pinned sources,
and the shared native target were untouched. The same build was retried using
`CARGO_INCREMENTAL=0`, retaining the current isolated source copy, host, and
target. The failed build log is `/tmp/billiard-n4-scene-probe-build-v5.log`;
the retry log is `/tmp/billiard-n4-scene-probe-build-v6.log`.

## Recorded result

Final focused run: **21 tests passed, zero failures, zero skips**, with actual
WebGPU required. The N4 scene CPU and actual WGSL results are exactly equal;
source post-activation manager, all body activation fields, and effective
forces/torques match the continuous-original WASM first-h expected state.
Existing N3 first-h maximum absolute error remains zero on both backends;
recurrent source split/sleep checkpoints also pass on both.

Frozen component artifact:
`/tmp/billiard-n4-scene-pre-energy-v2.v8`, SHA-256
`cbdfa50a489652c17868d7275def9d36c55b5649714f5d49881b8ab9dd2a0466`.
The original creation artifact SHA-256 is
`b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`.
The probe binary SHA-256 is
`86dca271e2dee02b417b75f1ac9c406cffe0f2b0a184be0d6262362f6f114e84`.
Final gate log: `/tmp/billiard-n4-scene-native-gpu-v2.log`.

The continuous source capture did not become the candidate world's initial
state. Its only candidate use here is the explicitly prepared scene component
input. Whole-world owners must continue starting from the original created
state and source API journal and computing their own intermediate states.
