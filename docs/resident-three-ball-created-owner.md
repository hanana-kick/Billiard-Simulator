# Genuine three-ball created seed and owner composition (HOST/source only)

## Scope and interfaces

This is a separate initial-only composition, not a four-ball scoring option.
The authentic world has **3 spheres + shaft/head = 5 dynamic bodies**, one fixed
cue guide, 16 fixed table bodies, **22 bodies / 25 colliders / 2 cue joints**.
No physical fourth sphere or dummy collider is inserted. Generic serializers may
have capacity 27 colliders or 32 bodies; their live headers remain 25 and 22.

1. `admitThreeBallHost(decoder, originalCapture)` still owns the verified original
   pre-strike/created bytes and exact source creation journal privately.
2. `createThreeBallCreatedOwnerSeed(admission)` in
   `src/resident-candidate/three-ball-host-admission.mjs` produces a locally
   branded, frozen `resident-three-ball-created-owner-seed-v1`.
3. Internal `src/browser-initial-import/live-three-ball-owner-data.mjs` projects
   only that private original t0 tree. It does not admit arbitrary projected
   input, create a native world, step physics, or brand its own output.
4. `await packThreeBallCreatedOwnerTemplate(seed)` in
   `src/resident-candidate/three-ball-created-owner.mjs` builds sealed initial
   word regions and source program binaries. It rejects unbranded seeds,
   copied/mutated/detached banks, and injected options.
5. `requireThreeBallOneHOwner(template)` **always rejects** with
   `three-ball-one-h-owner-unavailable` and the exact missing owner links. This
   is unsupported, never a physical MISS or a CPU/GPU fallback.

The public complete-H/runtime gate in `requireThreeBallResidentOwner` also remains
closed. No defaults, old four-ball source generator, packer, or emitted bytes are
changed. This module does not call the existing first-step convenience owner.

## What is now genuinely source-owned

The seed retains the **entire decoded native t0 state**, original application and
ThreeBallGame state, full pre-strike/created accepted event history, native body
and collider order/attachment order, fresh modified queues, free lists,
manager/joint state, integration parameters, CCD metadata and original contact
and broad-phase state. Native future/reference arrays are not inputs.

The old `live-three-ball-step-seed.mjs` boolean `solverContactRoster: true` is NOT
used. The new seed mechanically extracts actual native:

- all 22 generation-bearing body handles/types;
- dense contact edge order and rigid-pair ownership;
- exact u128 body color masks (unsafe rounded Numbers rejected), all 130 buckets,
  pair hints/colors/owners, manifold flags/body IDs/graph positions;
- actual awake order/active IDs and all graph/island/multibody epochs.

It reuses generic `Roster.validate`, not the four-ball-boundary-only importer.
The boundary is never relabeled `liveRegisteredStrikeCreated`.

The geometry owner catalog has **18** genuine entries: 3 floor, 3 sphere-pair,
12 sphere/cushion. Each present cache keeps the complete original `sourcePair`,
features, normals, solver contacts, recycle state, all warmstart/tangent/twist
fields, source edge orientation and directional adjacency. Absent cache entries
are the existing source `projectCache(null)` result; they are not fabricated
active contacts or future states. All eight native convex hulls are retained.
The catalog is data ownership only: **pair/cushion numerical cache normalization
and the 18-row numerical gather/scatter are not yet ported**.

The initial bank composes, unchanged where generic:

| Region | Actual content / source |
|---|---|
| registration | Existing three-ball 22/5/25 created registration source plan; outputs still zero |
| bodies | Exactly five canonical rows: three spheres, shaft, head |
| cue | Existing source f32 joint inputs + binary64 application clock/constants |
| journal | All 25 collider identities, native attachment order and directional graph |
| roster | Actual native 22-body solver masks/buckets/hints/manifolds/awake IDs |
| BVH | Original 22-leaf tree/scheduler; live maximum 25; exact cue generations/fresh order |
| broad | Existing bounds program, 25 colliders and five dynamic + one guide bindings |
| cue guard inputs | Actual **54** native-filter pairs, source guard program/inputs only; no contact decision |
| floor caches | Existing unchanged floor packing, three actual spheres |
| convex hulls | Eight actual native hulls, unchanged existing packing |

Canonical cue INITIAL word movement mirrors `rc_cue_to_canonical` but explicitly
places the two actual cue bodies at indices **3/4**, not hardcoded 4/5. Existing
unused principal/radius/increment lanes remain ABI sentinels, not physical data.
Native t0 pose/velocity/mass/inertia/COM/CCD values are checked independently.
No post-registration values are smuggled into those initial rows.

### BVH versus broad-pair ownership

Native `broad_phase.pairs` and `pair_adjacency` are **not part of the existing BVH
word serializer**. Both remain exact frozen native sidecars and in the complete
native seed. A future complete owner must qualify their lifecycle; a tree
roundtrip is not full broad-phase serialization parity.

The existing source BVH constructor has one additional source-owned transient
field, `deferred_optimize_pending=false`. Its actual constructor is called only
to obtain its initial snapshot, then disposed, without begin/update/commit.
Every serialized native BVH tree/scheduler field must still compare exactly;
this source flag is explicitly NOT a captured native mid-stage observation.

## Concrete remaining one-h links (not just a scoring flag)

A truthful complete one-h port must compose the following in actual PhysicsLab
order. The exported `THREE_BALL_ONE_H_MISSING_LINKS` closes the gate until they
exist; this initial bank cannot be passed to the four-ball world driver.

1. **Created registration -> first collision.** A distinct bounded executable
   three-ball adapter is now available: see
   [first-scene source step](resident-three-ball-first-scene.md). Its authenticated
   current collision input is HOST source-component test-only, not resident
   whole-h geometry/energy integration. Reuse existing exact init and
   scene numeric kernels, but bind a three-floor-edge/five-dynamic scene owner.
   `scene-world.mjs` initial encoder and first-collision source require four
   initial edges. Preserve original scene role order, joint linkage, queues and
   epochs. No native internal registration boundary has been observed.
2. **Geometry/contact ownership.** Port distinct live-three pair/cushion
   validators and 18-row gather/scatter/cursors in `geometry-state.mjs`,
   `geometry-world.mjs`, `world-geometry.mjs`. Existing provenance gates and
   26-row/four-sphere assumptions must not be bypassed. Retained native cache
   orientation, BVH query receipts and journal/roster sequencing remain exact.
3. **Actual solver schedule.** `coupledStateLayout(3, capacity)` is possible, but
   `world-solver.mjs` currently binds four bodies and the 26-row catalog. Build
   the true three-sphere gather/bucket/writeback schedule; cue constraints have
   their own original two-dynamic joint owner, not fake sphere slots.
4. **Cue/geometry/contact caches.** Existing numeric cue source is reusable;
   `cue-bridge.mjs` canonical addressing and `world-cue-geometry.mjs` fixed
   6-body/27-collider/56-filter-row assumptions are not. The new initial guard roster now enumerates **54** pairs from actual native
   `And` filters in exact source cue/obstacle order (independently checked), rather
   than guessing a smaller count. Its original numerical input/program packing
   is available, but lifecycle/query/gather/scatter is not ported. Cue-cloth/empty convex/pair
   lifecycle and tip/shaft exclusions need exact source ownership.
5. **CCD and world transaction.** `ccd.mjs`/`world-h.mjs` have four-body gathers
   and fixed world scheduling. Port actual three-sphere pre/post data, pass
   authority, BVH updates, bounded unsupported states and atomic commit. The
   presence of complete native CCD t0 data does not create a functioning owner.
6. **Application and rules.** `application.mjs`, `world-application.mjs`,
   `world-h.mjs`, `physical-rules.mjs` remain four-ball-specific. Preserve
   PhysicsLab's **outer-step-latched subdivisions**, Number/f32 boundaries,
   application/event ordering and debounce history. The ThreeBallGame replay
   reducer is ready, but gameplay finalization, controller cue-removal/rest and
   optimizer early goal stopping are distinct. Do not import four-ball opponent
   rules or assume all-three-rest is the free-mode search policy.
7. **Independent original native parity.** Source initialization agreement is
   not native internal-stage observation, one-h parity, or original outer-step
   parity. Separate original zero-step, actual latched outer-step, physical
   contact/CCD and eventual fullshot/release gates remain required.

Admission additionally remains bounded by the existing genuine-three original
origin, exact initial history/live generations, one-manifold sphere cache
support, source rigid graph/mask invariants and original created queues. Missing
native state, new unsupported cache/topology, future states and arbitrary
projected inputs fail closed; none become misses.

## HOST evidence and resource boundary

`tests/resident-three-ball-created-owner.mjs` uses the independent ORIGINAL
zero-step fixture process, not resident/source-owner expected future output.
Both cue selections are original `LabController.fire()` byte-matched captures.
The optional historical file is:

`THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture`

Its after-turn artifact is a separately authenticated ready-world next-shot t0
input, **not** an expected future state relabeled as input. It retains cue-body
order/generation `[21:g3,19:g3,20:g3]`, collider creation order
`[22:g3,24:g3,23:g3]`, original allocator maps/queues and all eight events.

Final sequential regression: **24 passed, 0 failed, 0 skipped** (~16.8 s),
including the immutable after-turn input and all earlier admission, registration,
game and search-semantic tests. Focused owner checks: **5/5**, including full independent native-tree equality, exact
roster/cache fields, generic serializer roundtrips, all five canonical native
bodies, binary64 cue clocks, and explicit no-H/mutation/detach rejection.
The fixture never steps physics after creation; no whole shot, GPU or numerical
performance run was used.

Run with process-local disk temporary storage (historical `/tmp` input unchanged):

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test --test-concurrency=1 tests/resident-three-ball-created-owner.mjs
```

Capabilities remain `preCollisionOnly=true`,
`nativeRegistrationBoundaryVerified=false`, `completeOneHSourcePlan=false`,
`wholeH=false`, `runtimeIntegrated=false`, `gpuQualified=false`.

## First numerical checkpoint

The distinct [first force/energy and solver-preparation adapter](resident-three-ball-first-numerical.md) now executes the next bounded HOST phase. It does not remove the complete-h, cue-joint, CCD-pass, general geometry or native parity blockers. Selected-1 fresh inactive cue edges still lack current empty-manifold/hint ownership; selected-2 and after-turn have exact current floor-only gathers.

The [first deferred cue component](resident-three-ball-first-cue.md) additionally connects exact two-dynamic numerical cue output and original cue post-CCD checks after energy/current roster for the admitted selected-2/after-turn fixtures. That component alone does not provide sphere postchecks or all-dynamic inactive-while-cue authority.

The subsequent [first sphere numerical component](resident-three-ball-first-sphere.md)
connects the genuine three-sphere solve/writeback and all source-required sphere
postchecks after that cue owner. Its sealed initial-inactive-while-cue receipt is
not a general CCD pass or a world commit. Fat/cache, BVH, journal, cue/application
and outer-step commits remain pending; selected-1 remains unsupported.

The [first post-fat/application-queue draft](resident-three-ball-first-post.md)
then connects exact original floor-fat/cache payloads, binary64 angular patch
and source scene mutation queues. Its collision/geometry inputs remain explicitly
HOST-owned; BVH/journal, cue/application-clock and outer-step commit are separate
remaining links. No whole-h or fully resident recurrence claim follows.
