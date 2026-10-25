# Native retired contact colors

The shared CPU/WGSL roster now distinguishes two pinned Rapier source paths:

- `geometry/narrow_phase/pair_management.rs:78–200`: collider-node withdrawal invalidates the solver graph and drops incident graph edges without clearing their reserved body color bits.
- `pair_management.rs:428–555`, specifically line 546: ordinary pair deletion clears its reserved colors. Normal narrow-phase stop also clears the color in `contacts.rs:359–360`.

Revision: `b716d375efc0201003f0cd9ef7168eee0b62c177`.

## Ownership and validation

A retirement requires the private, same-origin graph receipt's `removalReason: "collider-node"`, a generation-matching member of its verified `removedColliders`, and source graph invalidation. The removed collider must exist before and be absent after the transaction. The roster derives private source-pair provenance before discarding the pair, including source hash, journal sequence/revision, lifetime, collider/body generations, native color, and raw mask owners.

The invariant remains exact: each mask bit belongs either to a live colored pair or to a privately derived retired reservation. No caller field can supply residual masks. Public snapshot copies deliberately do not carry retirement authority, and cannot be reimported as initial seeds. Private internal clones preserve provenance for speculative preparation, later passes, and outer rollback.

## Independent native witness

`retired-contact-color-native-fixture.json` is a read-only projection of the original legal low-tip speed-2 shot's native snapshots:

- h463 postApplication: eight graph edges, cloth-tip edge 7 in bucket 127, color owner 21.
- h464 preWorld: original body/collider withdrawal queue `[25:0, 26:0, 24:0]`; the old graph, bucket and masks are still retained.
- h464 postWorld: four graph edges, empty solver buckets, valid rebuilt solver graph, body 21 absent, but the original 22-element mask vector retains `1 << 127` at raw index 21.

The fixture preserves the independent artifact SHA-256 and all three raw snapshot hashes. The extractor verifies the artifact manifest, raw snapshot hashes, and recorded native/JavaScript lossless roundtrip checks without stepping or restoring Rapier. With the full original artifact available, the regression re-extracts and exactly compares the committed projection.

## Scope and tests

This is an isolated source integer-bookkeeping component proof, not a whole-world trajectory, initial-world import, or new public active-cue-contact admission. A fresh test-only module exposes the unchanged closure-local kernel; production has no test hook. Genuine public journal binding separately rejects counterfeit receipts and ignores caller-added retirement fields. The journal's active-cue-contact admission guard remains unchanged by this patch.

Run the deterministic component and existing roster suite:

    node --test tests/retired-contact-color-roster.cjs tests/solver-contact-roster.cjs

Verify again against the full independent native artifact:

    RETIRED_CONTACT_COLOR_ORACLE=/absolute/path/speed2-full.v8 node --test tests/retired-contact-color-roster.cjs tests/solver-contact-roster.cjs

The latter passed all 20 tests. Coverage includes exact native withdrawal, unchanged ordinary deletion, a generic fixed-collider withdrawal with surviving owners and no premature color reuse, wrong-generation/foreign-source/invalid-reason negatives, forged/unrelated residual mask rejection, and private-clone rollback. No heavy native/GPU execution was performed.
