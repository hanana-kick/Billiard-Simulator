# Private pending contact cache reader

`pendingContactSnapshot(token, pass?)` was added to the existing pair and cushion
phase owners. It is a read-only prerequisite for inverse observation, not a
world observer, solver, callback, or proof that a whole shot committed.

## What it reads

- Requires the owner's private token, idle/non-disposed phase, and sealed pending
  geometry/solve. It never substitutes `current` or `outer.before` for `pending`.
- Pair numerical/coupled/sleep results: `pairState(pending.s)`.
- Pair inactive geometry-complete result: same actual pending cache, even when
  no numerical contact row ran.
- Cushion numerical/coupled/sleep/cache-only result: `pending.s.cushions`.
- Graph-only pending synchronization: its actual `pending.d` cache.
- Returns full cache copies and authoritative collider handles, deeply frozen.
  It does not recompute impulses or erase retained values based on `active`.
  Consumers must distinguish `pairPresent`, `pointPresent` and raw `impulse`;
  native `contactImpulse > 0` is not equivalent to an active solver row.

For a CCD outer, the pass must be owned, **final**, and have the current outer
pass index. If a numerical solve ran, it must be the same pass object used by
that solve. The returned `ccdPassIndex` identifies this boundary; normal
non-CCD stage reads use null and reject a supplied CCD pass.

## Ownership / publication

The result is labeled `private-pending-contact-cache` and
`publication: owner-only-uncommitted`. It contains no body poses: contact stage
poses precede world CCD clamping and are not inverse-observation positions.
The world owner must privately retain the detached cache and its separately
collected post-clamp/pre-application positions until **whole-world** commit.
Only then may it construct/deliver an inverse receipt. Stage commit alone is
not whole-world commit. No callback or automatic publication was introduced.

Abort, failure and cancellation invalidate the pending read opportunity. A
previously copied value cannot be revoked; it remains private uncommitted data
and must be discarded by its owner on rollback, never delivered to the inverse
reducer. After successful whole-world commit, detached evidence has an independent
lifetime; later stage work/disposal cannot mutate it. Freezing is not provenance
or authorization. Unvisited retained contacts still use the existing explicitly
committed snapshot, not a fabricated pending read.

## Evidence / limits

- Real reference pair stage: 96 original-native frames, positive collision at
  frame 18 and separation at frame 22, max native error 0.
- Real reference cushion stage: 64 original-native frames with collision and
  separation, max native error 0.
- These recurrence tests compare reader caches to actual solve return values
  before commit and committed caches afterward, reject wrong token, test frozen
  mutation, and reject reads after commit.
- Actual stage solved-abort/retry tests check unchanged committed caches and
  caller-owned publication only after a successful retry commit.
- Focused exact-method protocol tests cover pending/current distinction,
  wrong/intermediate/stale final CCD pass, busy/disposed/aborted/unsealed state,
  graph-only and inactive caches, and authenticated coupled adoption. Their
  mocked arithmetic is protocol evidence, **not numerical GPU/CCD parity**.

The full commit-only world producer remains unwired. It still needs native
phase receipt comparisons on both cue-present and post-cue multi-pass paths,
source-time/dt preservation, solid convex query use, and world rollback gates.
