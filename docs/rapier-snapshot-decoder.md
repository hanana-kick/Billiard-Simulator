# Source-derived native snapshot decoder

This is a newly verified implementation; previous aggregate results are not
evidence for this checkpoint. It does not step physics and is not a GPU engine.
It gives later independently replayed native tests exact typed snapshot fields,
without guessing cache offsets, converting float bits through JSON numbers, or
feeding native POST state into a recurrent GPU solver.

## Pinned sources and admission gates

- JS/WASM: `@dimforge/rapier3d-compat` 0.21.0; vendor SHA256
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.
- Official Rapier commit `b716d375efc0201003f0cd9ef7168eee0b62c177`;
  [official archive](https://codeload.github.com/dimforge/rapier/tar.gz/b716d375efc0201003f0cd9ef7168eee0b62c177),
  SHA256 `67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1`.
- Parry 0.31.1 official crates.io archive SHA256
  `7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e`.
- Bincode 1.3.3 legacy fixed-width integers, little endian. Cargo.lock pins all
  resolved dependencies. The exporter uses the local source override, not a
  similarly numbered registry Rapier crate.

`build-native.cjs` checks both archive hashes and byte-compares every Rust source,
Cargo manifest and license against its archive before compilation. It records a
source-manifest digest, exact compiler version, features and binary path. Source
mismatches fail; source downloads or toolchain installation are never implicit.
The build is single-job and uses explicitly selected source/toolchain/target paths.

The Rust world definition preserves the ten-field order in official
`bindings/typescript/src/pipeline/serialization_pipeline.rs`: gravity,
integration_parameters, islands, broad_phase, narrow_phase, bodies, colliders,
impulse_joints, multibody_joints, soft_bodies. All nested types are the actual
pinned Rapier/Parry `Deserialize`/`Serialize` implementations, including private
cache, graph and native convex topology fields.

Every accepted snapshot must pass all of these checks:

1. Explicit wrapper version and exact vendored engine hash.
2. Native source deserialization, followed by byte-identical bincode re-encoding.
3. Exported provenance, input byte length and SHA256 identity.
4. An independent JavaScript encoding of the complete typed serde tree, again
   byte-identical to the original WASM snapshot.

Missing fields, native failure, wrong engine, trailing/truncated data and either
roundtrip mismatch reject the snapshot. No partial result is used as a fallback.
Input is bounded to 32 MiB; JS tree depth/node count and native process output/time
are bounded. The native tool reads stdin and writes JSON stdout only.

## Important feature-boundary finding

The first minimal native build failed on an empty world with invalid tag 130 at
`[2][1][1][233]`, entering the islands field at the wrong offset. No cache offsets
were patched. The official TypeScript Cargo template enables `fem`, adding
serialized `SoftBodiesSettings` fields inside integration parameters. Rebuilding
with that wrapper's `serde-serialize`, `debug-render`, `profiler`, `fem` feature
contract resolved the mismatch. `enhanced-determinism` is additionally enabled;
the exporter never executes native physics. Both byte gates remain mandatory for
every input, rather than treating this feature finding as blanket compatibility.

## API and exact field representation

`require('../tools/rapier-snapshot-decoder')` exports `decodeWorld`,
`decodeSnapshot`, `encodeLosslessTree`, `field`, `walk`, `findStructs`, and
`floatValue`, plus source/version/hash constants. Pass
`{binary, engineVersion: '0.21.0'}`. `decodeWorld` only calls `takeSnapshot`.
The result contains `state` and
`verification.nativeBincodeByteIdentical` /
`verification.javascriptTypedReencodeByteIdentical`.

The non-human-readable serde tree records struct names and ordered field pairs;
ordered tuples/sequences/maps; option and enum variants with numeric tags; exact
integer widths with decimal strings; and f32/f64 bit strings in big-endian hex.
The bincode encoder writes their little-endian bytes. Signed zero and NaN payload
bits therefore survive. `floatValue` is an inspection helper, not the encoding
source. Unicode characters follow bincode's raw UTF-8 scalar representation.

A typed initial condition may be edited and passed through `encodeLosslessTree`
to the unchanged public `World.restoreSnapshot`; the tests demonstrate this for
a velocity cap and gyroscopic flag. That is not permission to supply later native
states to a GPU trajectory. The existing cue-hull EPA/polyhedron lifecycle gaps
are unrelated and are not fixed or relabeled by this decoder.

## Build and validation

Choose isolated source, toolchain and build directories. Download/extract the
pinned official Rapier archive above and the official Parry 0.31.1 crate, and
prepare an [official minimal Rust toolchain](https://rust-lang.org/tools/install/).
The verified compiler was Rust 1.99.1 (`58cf8f9c3`, 2026-10-13).

Set these variables to your chosen absolute paths:
`RAPIER_SOURCE_ROOT`, `RAPIER_SOURCE_ARCHIVE`, `PARRY_SOURCE_ROOT`,
`PARRY_SOURCE_ARCHIVE`, `CARGO_HOME`, `RUSTUP_HOME`, `CARGO_TARGET_DIR`.
The source roots must contain the extracted Cargo manifests and Rust files.
`RAPIER_CARGO` optionally selects a Cargo binary instead of `$CARGO_HOME/bin/cargo`.
No source checkout or system toolchain path is assumed.

```sh
node tools/rapier-snapshot-decoder/build-native.cjs --check-source
node tools/rapier-snapshot-decoder/build-native.cjs
RAPIER_SNAPSHOT_DECODER="$CARGO_TARGET_DIR/debug/rapier-snapshot-decoder" \
  node --test tests/rapier-snapshot-decoder.cjs
```

The first bounded suite passed 5/5, no skips (about 1.03 seconds):
- exact scalar/NaN/signed-zero/Unicode codec sentinels;
- empty world plus 12 independent sphere/floor snapshots and source cache fields;
- unchanged PhysicsLab snapshot, 37,715 bytes, 19 bodies and eight native convex
  hulls including points, faces and edges;
- initial typed-field edit, native restore, native step, and roundtrip;
- wrong version/hash, truncation and trailing-byte rejection.

This is a bounded decoder result, not a whole-world GPU parity result or a
substitute for the previous aggregate suite.
