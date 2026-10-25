# Bounded four-ball CCD primitives

Existing BVH and bridge factories accept the exact initial-four, settled-four,
and placed-goal-four broad-phase kinds via their existing source validators.
Initial-only creation inserts five source-ordered rows into22 leaves; settled
creation inserts three cue rows into24 leaves. No later native tree is accepted.
The retained legacy seed contract remains22→25→22, constructor frame72.
The public optimizer helper retains its legacy25-leaf default; an explicit
27-leaf bound is used by the registered source paths.

The new paths derive generations, protected ball/fixed leaves, removable cue
leaves and moving-body collider order from the validated creation roster.
Reused arena indices remain generation-bearing in receipt authorization and
pending set_aabb snapshots. A missing registered seed or a changed roster fails
closed. Post-creation new colliders remain unsupported. Transaction, receipt
origin/backend/epoch and creation SHA binding are unchanged.

Parry0.31.1 bvh_optimize.rs supplies the sqrt/log2/ceil/round formula; each Real
operation is rounded to f32. The resulting integer regime is bounded to22..27
leaves. Geometry/SAH arithmetic still uses the matching CPU/WGSL plans. Initial
insertion reuses the existing source-port First.firstInsert (capacity64), rather
than inventing a four-ball insertion algorithm. Temporary wide-node bound96 is
unchanged. Fixed targets remain16 and per-body candidate capacity32 is unchanged;
GPU immutable query roster capacity128 is exactly eight channels ×16 targets.

The dedicated frozen-fixture test checks native first-insertion topology, source
query roster and cue-only retirement. This is primitive evidence, not a claim of
full-world CCD recurrence or four-ball active-impact parity. Coordinator-run
native CPU/WGSL recurrence and active-CCD tests are additionally required.

## Verification

- Existing three-ball BVH, order-certificate and fixed-sphere CPU regressions
  passed unchanged.
- Actual SwiftShader WGSL gate:10/10 passed, no skips. Existing three-ball
 43-snapshot recurrence retained SHA256
 45b60bc60095ae6a3560daca629a3525c6aa3541278150a6e602fd82b1bed338.
- Canonical frozen original four-ball artifact first-insertion topology matched
 the native oracle.27→24 cue retirement, fourth-body ordered query admission,
 wrong-generation rejection and CPU/WGSL final primitive state all passed.
- Settled creation/reused-generation native recurrence is not covered by this
 gate; its source validators and roster handling are implemented but require
 the separate coordinator-owned native/full-world gate.
