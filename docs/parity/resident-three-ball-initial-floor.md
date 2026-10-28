# Genuine-three initial floor source owner

This distinct producer replaces the missing numerical `Floor.prepare` input
boundary with emitted source fat-AABB and floor-narrow programs. It accepts only
an authenticated created template: three real spheres, 22 bodies, 25 colliders,
and all 18 geometry catalog identities. It does not change old four-ball bytes.

`createThreeBallInitialFloorPlan(template)` seals initial words and programs.
`generateThreeBallInitialFloorWGSL(plan, {stateBase,programBase,scratchBase})`
exports begin/gather/fat/narrow/publish functions; the five-stage immutable
schedule is returned by `buildThreeBallInitialFloorSource`. Current scene,
collider generations, genuine dense edge IDs/lifetimes, entry awake/dynamic/changed
masks, actual sleeping flags, body poses, and caches are read from the bank.
Original edge order is **not** normalized to ball order (fresh fixture: 0,2,1).
Sleeping flags are original f32 activation words, not invented integer booleans.

All three fat/narrow results must retain their original active single-point floor
before any actual cache publication. Work occurs in a private draft. Unsupported
features, changed floor topology, invalid generations, missing/replayed phases,
and new edges fail closed; none is an ordinary three-ball miss. `begin` captures
entry masks before broad; a composed owner must place geometry after the actual
broad producer and reject unsupported new edges before publication.

The low-level HOST harness is a **component test**, not authority for that phase
placement, whole h, native boundary, runtime continuation, or GPU execution. It
uses only emitted kernels; original Floor owners execute afterward as oracles.
Tests cover both original selections and the immutable after-turn input with
recycled cue generations. A separate deliberately invalidated recycle-cache
witness covers refresh equations, not a claimed physically reachable trajectory.
All 144 words are checked: lanes 138/139 are explicit refresh/old-active sidecars;
119 is the existing narrow graph's prediction-distance work lane, independently
checked on refresh rather than silently dropped or normalized.

Process-local test TMPDIR:
`/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp`.
Immutable historical after-turn input remains
`/tmp/three-ball-live-evidence-20261025/capture`; no new fullshot is captured.

## Current-word hint / roster bridge

`three-ball-first-roster.mjs` consumes the emitted floor owner (including frozen
pre-broad entry masks and prior dense metadata), current journal, and completed
source energy words. All hint outcomes are validated before roster mutation.
The original `rc_world_scene_hint` literal is exported additively, unchanged,
from `scene-integration.mjs`; old four-ball shader emission is byte-compared to
commit `370a086`. Current source energy owns slept/awake order and graph
invalidation; no reference `rows`, booleans, or reordered contact lists enter.

The focused roster harness remains a phase differential, not a full same-bank
world driver: it uses the existing produced first-scene boundary and explicitly
replaces its HOST floor cache with the independently emitted floor cache. The
next first-h composition must connect these same functions directly without
copying a later bank or HOST forward callback. Whole-h/native/runtime flags stay
false until that owner and its native represented-state gates are complete.
