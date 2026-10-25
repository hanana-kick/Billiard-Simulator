# Initial N3 empty convex-cache ownership

Status: focused original-created first-h CPU evidence, not a complete shot or a new CPU/WGSL parity result. This is a separate lifecycle correction after the sleeping-target admission change.

## Boundary and source evidence

For the unchanged `yaw23-side-follow` input (angle23°, elevation8°, speed1.5, tip X0.2, tip Y0.1), the initial source BVTT inserts empty hull/cylinder pairs in order 6:0↔22:0, then 5:0↔22:0. The original graph owner already generated that order. However, `prepareEmptyConvexCaches` excluded all initial-frame additions, so the numerical manifold/cache owner omitted those pairs. The broader convex assertion caught that omission at h64 during a frozen `4d343cc` run.

Evidence identities:

- `yaw23-side-follow-prefix.v8`: SHA-256 `7c32d83cdd14559433815ce01f52127e2578d24460eaff89a7e02beeba8deb32`.
- CREATED snapshot: `4b1ead5323fa676482e88f62fb52925103b141a961f296197625cafcc675514e`.
- Original h1 snapshot: `934571d9dc6f526e728cf471adf17262c0465d840ac1ba4beb0879cde50ef478`.
- Original h8 snapshot: `908a41a4884c9f329855839ff64bdc598960f7df3439cf8f7723cf705fde8065`.
- Original h64 snapshot: `9711d4ad01672ccc43cac6d49e628270ab52a009696259ea6741892bdd9affb4`.
- Read-only isolated arithmetic diagnostic `yaw23-initial-convex-cache-stage-diagnostic-4d343cc.json`: SHA-256 `2eaaadc6dd862b250fab9c34ad92c96f9c8494a72612290f6011993d0bb0619d`.

The existing arithmetic stage, applied only to the CREATED shaft pose and each genuine CREATED native hull, exactly reproduces the original h1 cache and normals. The normals are:

- Hull6: `[0.12052732706069946, 0.9918709397315979, 0.040806885808706284]`.
- Hull5: `[0.11334596574306488, 0.9934049248695374, 0.01729939505457878]`.

These observed numbers are assertions only, never runtime input or special-case constants.

Pinned Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177` creates the empty pair in `geometry/narrow_phase/pair_management.rs:636–640`, computes manifolds in `pair_update.rs:438–446`, and populates the empty manifold metadata and world normal in `pair_update.rs:523–534`. There is no source rule excluding initial insertion from this manifold lifecycle.

## Minimal correction

When the complete optional `cueEmptyConvexHulls` roster is supplied, initial and recurrent convex `AddPair` events now use the same existing cache owner, in authoritative receipt order. Legacy seeds without that optional capability retain their previous admission and make no complete convex-cache ownership claim. Full yaw23/holdout gates supply the complete validated roster and keep all cache assertions. Nothing changes in the numerical stage, initial BVTT, source hull ordering, source receipt generation, recurring singleton limit, N4 world, or sphere/cylinder lifecycle.

Every cache still requires the current same-backend rigid-cue separation proof, an inactive edge, original Multiply materials, the matching private branded stage, and genuine immutable native hull topology. The first call has `previous:null`. Later calls consume only the owner's committed result. Incomplete or cloned enabled hull rosters fail closed; a missing matching branded stage still fails closed. The existing recurring-birth guard is unchanged.

## Focused verification

`tests/experimental-three-ball-initial-convex-cache.cjs` performs only the first two own CPU h from the original CREATED input. It never steps/restores a native world and never seeds from an AFTER snapshot.

- Actual first h reproduces both complete native rigid manifold/cache structures in source order with maximum numeric error0.
- Every initial numeric call uses the CREATED shaft pose, original hull identity and absent prior cache.
- Second h uses only the cache committed by the first h.
- An injected final-preflight failure after both real numeric births leaves the entire world at its unchanged initial state. Retry repeats identical source-owned inputs and results.
- Incomplete or cloned enabled hull rosters reject. Omitting the optional capability preserves the old initial-only seed contract without asserting complete convex-cache parity.

Native h8/h64 and complete-shot comparisons, and actual WGSL recurrence, remain separate coordinated gates.

The combined six-file focused regression (this file plus the five sleeping-target admission test files) passed 26 tests with zero failures and zero skips. No GPU or full-shot gate was run for this follow-up.
