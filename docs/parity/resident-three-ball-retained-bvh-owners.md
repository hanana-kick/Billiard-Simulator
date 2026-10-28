# Retained genuine-three Guard/cache/physical work

This is an additive source/HOST checkpoint, not native GPU or h3 physics
qualification. The fixed initial and h2 profiles are unchanged. The retained
integrator must bootstrap the original first h once, then execute the same
advance source against one persistent bank. No completed prior bank is an input.

## Interfaces and schedule

* `createThreeBallRetainedRigidExclusionPlan(template)` and matching
  `assert/generate/buildThreeBallRetainedRigidExclusion*`: original four absolute
  bases plus `controlBase`. Original 54 pairs, tip/cloth predicate and 256-query
  cap remain exact. Call `rc_three_guard_rearm` **after** the new cue prefix,
  before the unchanged Guard stages.
* `createThreeBallRetainedEmptyPairsPlan(template, retainedGuard)` and matching
  `assert/generate/buildThreeBallRetainedEmptyPairs*`: original five absolute
  bases plus `controlBase`. Call `rc_three_empty_rearm` while journal phase0,
  before collision. Current separation facts remain phase2/entrySequence; exact
  source cache recurrence remains after narrow at phase3/sequence.
* `createThreeBallRetainedPhysicalPlan(secondPhysical)` reuses the locally owned
  fixed-h2 layout/program as immutable ABI. Matching assert/generate/build
  functions take only `{controlBase}`. Call `rc_three_second_physical_rearm`
  during journal phase0. Actual physical work follows new numerical completion:
  each awake body's last collider bounds → original world-mass graph → final
  `set_aabbs` → original journal finish. The existing joint remains unadopted.

Build results expose raw `rearmSource` as well as the usual linked `source` and
stages. Link both into an enclosing root that actually calls rearm; ordinary
reachability pruning must not discard it. Function names remain the original
component names; separate immutable source parts select the retained profile.

The root ABI is `three-ball-retained-control.mjs`: dynamic clocks and epochs
come from that resident owner, never caller-supplied proof booleans. Guard19,
Empty14, Physical13 are their private last-rearmed-frame guards. First rearm
requires genuinely fresh work and entry frame/sequence1; later rearm requires
the exact prior frame's completion. Replays and failures are sticky.

## Persistent versus work

Guard rearm clears only support/query/pose-proof work. Empty rearm preserves all
six 48-word caches, all native material/manifold metadata, previous candidate
queue and count. Empty16..27 snapshots each previous descriptor's lifetime;
Empty28 snapshots its entry mask. Current rows/views are rebuilt. Candidates
retain source previous-list order then actual ordered AddPair births. A pair
filtered out of the actual graph loses previous-cache authority, so a later
birth starts with `previous=null`, without erasing unrelated caches.

Physical rearm retains canonical state, scene, BVH, graph, roster, caches and
cue/tape. It clears only its 32-word work header and original final-mass work
header/input/output, preserving authenticated local mass parameters32..111.
Physical validation checks actual current journal revisions, inactive-empty
append/remove operation order, retained lifetimes or real births, all native
empty metadata, and the complete current roster/awake source order.

## Evidence boundary

`tests/resident-three-ball-retained-bvh-owners.mjs` covers generated-source
compatibility and emitted rearm guards/persistence. Its synthetic control-header
unit cases are **not** physical admission evidence. The committed baseline was
generated from verbatim 7512e3a source using authentic selected-2 initial input;
it compares all old generated stages plus full initial/program/geometry/layout.

Actual original continuous t0→h3 observation, bootstrap+same advance twice,
retained Pair previous-cache numerical inputs and every physical/application
projection remain a separate same-bank integration gate. Active cue contacts,
withdrawal, eventful application, outer64, full rest and hardware throughput
are not admitted by this checkpoint.
