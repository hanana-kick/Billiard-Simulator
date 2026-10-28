# Smallest next genuine-three-ball resident boundary

Review baseline: `ecebcd6` on the isolated `work/genuine-three-ball-host-v1`
branch, descended from `eb8179f`. This is a bounded source/layout review while
the separate four-ball raw-impact gate remains pending. No GPU, numeric port,
default activation, or publication is part of this work.

## Decision

**Do not parameterize the entire `packCreatedWorldTemplate()` yet.** The smallest
useful next implementation is an initial-only **created control-layout bridge**:
bind an authenticated genuine-three-ball created snapshot to the existing scene
registration/header format, retaining source managers and native IDs. Stop
before numeric user-change initialization, collision, a complete world bank, or
source-owner generation. Its kind must differ from `resident-created-world-layout`.

The tiny prerequisite added now, `three-ball-resident-roster.mjs`, derives an
immutable, locally branded roster description from the existing authenticated
HOST admission. It declares canonical **future** dynamic slot order
`[ball0,ball1,ball2,shaft,head]`, excludes fixed guide, and preserves exact arena
generations and source attachment order. It allocates no addresses, scene slots
or numeric state. There are exactly six ball colliders plus three cue colliders,
two other-ball indices, and 25 total created colliders. The descriptor contains
no `state`/`segments`, so it cannot pass the current world-plan entry guard.
Canonical slot 3 is a **shaft**, never a fourth ball. Its returned source row
index remains distinct from a scene slot or native arena handle.

## Actual blocker chain, in call order

1. `world-state.mjs:39`: `packCreatedWorldTemplate()` calls
   `experimental-four-ball-world.validate()` and requires
   `original-live-registered-four-ball-created-world`. A mode flag cannot admit
   genuine-three-ball source data.
2. `geometry-state.mjs:22–23` repeats that validator and allocates four ball64
   records. `world-state.mjs:41` then calls `encodeSceneInitialization()`.
3. `scene-initialization.mjs:16–25` delegates to
   `scene-activation.mjs:encodeSceneCreatedRegistration()`; its line 424 demands
   exactly **27 colliders / six dynamic bodies**. The general scene capacities
   (32 bodies, six dynamics) are not the blocker; this exact admission is.
4. No complete live-three world seed exists here.
   `browser-initial-import/live-three-ball-step-seed.mjs` returns a component
   bundle (`projection`, `broad`, `balls`, `bodyRegistry`, `cueInitial`, hulls,
   contact graph). Its `solverContactRoster:true` is a marker, **not** the full
   native solver-color/contact roster consumed by `encodeContactRoster()`.
   Neither it nor a copied HOST receipt can be relabeled as the four-ball seed.
5. Even bypassing these guards would be incorrect: the world bank puts shaft/
   head at `4*64`/`5*64`, allocates three other-ball entries, packs BVH leaf
   counts 24/27 and four-ball CCD/application/rules. `generateWorldHPlan()`
   embeds those sources, not an abstract roster-independent simulator.

## Proposed next commit: exact files and interfaces

This is a proposal, not code already implemented:

| File | Small intended change / interface |
|---|---|
| `three-ball-host-admission.mjs` | Add a narrowly scoped projection helper over the **private owned initial projection**, e.g. `projectThreeBallCreatedRegistration(receipt)`. Use existing `exportRegisteredCueInitialization` and initial `registry()` extraction. Return a locally branded `three-ball-created-registration-input-v1` containing only original created `sourceCreation`, complete `bodyRegistry`, immutable roster and source identity. No reference/future data or caller-supplied projected records. |
| `scene-activation.mjs` | Factor the existing *mechanical* packing into a private helper, retaining the old four-ball wrapper and guards unchanged. Add `encodeThreeBallSceneCreatedRegistration(initial)` with a distinct brand/origin check, exact 25-collider/five-dynamic checks and the same source joint/queue/manager invariants. Do not add an unvalidated `ballCount` argument that bypasses family admission. |
| `scene-initialization.mjs` | Factor the common field/graph serialization after scene admission. Add `encodeThreeBallSceneInitialization(initial)` using the new three-ball scene wrapper. Existing fixed capacities 27/32 can remain; write header **live** count 25 and preserve zero unused slots. Keep `generateSceneInitializationWGSL()` unchanged and unexecuted in this commit. |
| New `three-ball-created-control-layout.mjs` | `packThreeBallCreatedControlLayout(initial)` returns kind `resident-three-ball-created-control-layout-v1`, source identity, roster, scene/init words and diagnostic decode metadata. No complete world segments, rules bank, numeric programs, raw-candidate input or full-h plan. Capability explicitly `initialOnly:true`, `numericInitialized:false`, `collisionPrepared:false`, `residentExecution:false`. |
| New focused tests | Import independent default/manual-cue2/recycled-generation3 capture; encode/decode registration fields and compare exactly with the authenticated **created** source. Verify manager/free-list/queues/joint adjacency preserved, all native bodies reachable, exactly five dynamics and 25 live colliders, no phantom fourth ball/slot. Reject copied/forged authority, changed generations, wrong count, foreign origin or mutated arrays. Existing four-ball serialization/generation fixtures must remain exact. |

This commit should not call existing reference `prepare()`/`commit()` stages to
manufacture expected initialized state. It merely represents the actual created
boundary. A later numeric initialization proof must independently exercise the
original operations and retain its own unsupported/termination conditions.

## Can existing source generation parameterize a real roster?

**Yes at the transport layer; not by changing only world-state or loop counts.**

- `world-owner-routing.mjs:compileWorldDeviceOwners()` routes explicit original
  pipeline IDs and source CALL receipts; it has no intrinsic four-ball model.
  `world-device-pc.mjs` compiles an already-generated plan.
  `world-microcode-source.mjs:composeWorldMicrocodeSource()` links exact owner
  code and dispatches source CALLs. These can remain unchanged once a valid
  genuine-three source plan exists. They cannot supply missing physical owners.
- `world-owners.mjs:compileWorldSourceOwners()` uses explicit family/stage-name
  coverage. Keeping source names can reuse routing; removing a no-longer-live
  phase needs explicit partition/coverage changes, not inferred routing.
- Generic candidate pieces include contact-journal capacity 27, scene capacity
  32/6, body-independent numeric primitives, the coupled solver's **1–4** body
  layout function, and generic source-number transport. Capacity is not live
  cardinality. Numeric source operation order/caps must remain source-derived.
- Whole-h code is **not** generic: `world-h.mjs:111,115,118,145–146` hardcodes
  three others, 27 broad rows and 26 geometry rows. `geometry-world.mjs:26–27`
  embeds 26 rows/four ball endpoints; `world-geometry.mjs:31–34` embeds cursor
  completion 26. `world-cue-geometry.mjs:27,34–40,52–55` requires a four-ball
  seed, 27 colliders and 56 cue-pair descriptors. CCD, application and rules
  retain separate fixed-four assumptions documented in the main HOST report.

The eventual seam should be a branded `template.roster` with exact live counts,
canonical bindings and validated source catalog rows, passed explicitly to
each leaf generator. Do not do string substitutions (`4`→`3`, `27`→`25`), assume
all constants mean cardinality, or reduce solver/query iteration caps.
For example three floor + three pair + twelve cushion **possible** catalog
entries give 18, but their actual source row order/cache schemas must be
extracted and verified; combinations are not the native contact/solver order.
Unused capacity rows must have no handle, live flag, mask bit, body address or
event/solver participation. Old four-ball wrappers should preserve their exact
default output and continue failing closed on a three-ball profile.

## Enforceable unsupported boundaries

1. **Authority/input:** only locally branded genuine-three source admission;
   exact free/ThreeBallGame, three spheres, two legal cue IDs, ordered remaining
   targets, pinned engine/default material/timing, ready prestrike and exact
   zero-step creation. Reject four-ball or constructor-origin relabeling.
2. **Native state:** actual complete generation-bearing identities/arenas,
   managers/queues and two source cue joints. Arena reserve/growth is unsupported
   by the current fast-path receipt. Never normalize recycled handles to g0.
3. **History:** actual full prestrike→one accepted stroke transition; all emits
   occupy last-eight FIFO. Unmappable live-window generations are unsupported,
   not dropped. Preserve exact binary64 clocks and target identity.
4. **Control-layout scope:** created state only; no initialized mass, post-
   collision state, active CCD prediction, floor/cushion/ball contact solve,
   source-owner CALL, candidate numeric reconstruction or raw admission claim.
   Distinct kind must remain rejected by `generateWorldHPlan()`.
5. **Narrow initial continuation, later only:** current live-three collision and
   first-step owners explicitly require exactly three retained floor contacts,
   no retained cushion/dynamic pairs and no unsupported rigid cue contacts
   (`live-three-ball-collision.mjs:25`, `live-three-ball-first-step.mjs:66`).
   Merely importing a more general history does not admit it to those owners.
   Preserve source rest/sleep state instead of forcing a supported layout.
6. **Rules/termination:** pure game replay, controller full-rest publication and
   optimizer query stopping are distinct. No opponent prohibition or −1.
   True-three route/search/cue/kiss/ambiguity/horizon handling remains absent.
   Unsupported and incomplete must never become a physical MISS.
7. **Release:** no 3-ball full-h/raw-to-rest/full-search parity or speed claim,
   production entry, fallback, automatic enablement or deployment. The current
   four-ball raw-impact blocker is not weakened or considered solved by any of
   these three-ball structural checks.

## Bounded verification performed for this review

Only the immutable roster-description prerequisite and HOST tests were added.
Existing source/physics/controller/four-ball generators were not changed.
Focused suite includes both selected cues and the separately authenticated
existing after-turn input (no new fullshot), and ensures the future shaft/head
slots preserve bodies `21:g3` / `19:g3`, with fixed guide `20:g3`.
Source evidence remains its own next-shot prestrike/created boundary; no
expected-only future arrays become initial/runtime inputs.

Final focused HOST suite: **10 passed, 0 failed, 0 skipped** (including the
pre-existing after-turn capture); syntax and whitespace checks passed. No GPU,
performance job, broad numerical port or release/full-UI sweep was run.
