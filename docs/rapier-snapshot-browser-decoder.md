# Read-only browser snapshot import bridge

## Validation checkpoint (2026-10-24)

The isolated native candidate and import-free WASM library compile successfully.
- Shared codec/reference-preservation tests: **4/4 passed**.
- Rust bounded-deserializer tests: **2/2 passed** (accepted shallow source type,
  rejection of excessive recursive depth and node exhaustion).
- Native/WASM differential and negative/read-only ABI tests: **4/4 passed**.
  All **eight real archived boundaries** match the original native CLI stdout,
  full typed output and exact input-to-typed-to-binary roundtrip.
- Browser-targeted JavaScript bundle: no runtime imports or Node dependencies.
- **Actual managed cloud Chromium 155: 8/8 archived snapshot imports passed.**
  The browser's complete typed-state SHA-256 matched the original-native
  reference for each boundary; every byte of each JS typed re-encode matched
  its input. Twelve rejection cases, zero Node globals, zero WASM host imports,
  the snapshot-only world contract and owned-buffer ABI checks also passed.
  See the separate browser checkpoint below.
- The earlier standalone Playwright launch still has its original environment
  failure: first no managed executable, then installed Chromium with
  `chromiumSandbox: true` failed before navigation because
  `process_singleton_posix.cc` reported `socket() failed: Operation not permitted`.
  Its run remains four passes and one environment failure, not a five-test pass.
  No sandbox reduction, manual CDP route or retry around that restriction was
  used. The managed cloud browser is a separate supported execution surface;
  its launch configuration was not altered.

These results prove bounded snapshot decoding only, not real-app gameplay or
CPU/GPU world parity. No product backend was activated by this work.

This bridge imports genuine snapshots into the exact source-derived typed serde
representation. It does not step physics, restore a world, generate contacts,
run a GPU world, change the default backend, or provide a CPU fallback. A decoder
pass alone is **not** evidence of browser gameplay or CPU/GPU trajectory parity.

## Source and ABI

The frozen Node `index.cjs`, original exporter crate, batch wrapper, build scripts
and their source/hash contracts remain byte-for-byte unchanged. They remain the
reference implementation used by prior physics evidence. A separate
`tools/rapier-snapshot-browser-exporter` crate supplies the new native candidate
and WASM static library; `candidate.cjs` is an opt-in versioned Node adapter.

The new crate includes the original `src/main.rs` verbatim to reuse its actual
ten-field world declaration, all Rapier/Parry types and complete typed serializer.
Its shared bounded decode function is used by both the new native CLI and WASM.
There is no copied schema or second new typed serializer. The candidate CLI must
match the original's version JSON, accepted-input stdout JSON, error prefix and
exit-code contract. The original binary is never rebuilt or overwritten by these
new builders. Prior manifests/hashes must not be rewritten for candidate code.

The upstream source pins are unchanged:
- Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`.
- Parry `0.31.1` and bincode `1.3.3`.
- Engine `0.21.0`, vendored source SHA-256
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.

No guessed byte offsets or independently maintained snapshot schema are used.
`rapier-snapshot-browser-exporter/src/bounded.rs` wraps serde's actual deserializer, seed, visitor, sequence, map and
variant interfaces to reject depth above 128 or more than 2,000,000 nodes. It does
not substitute any source type or numeric conversion. All accepted snapshots must
still reserialize byte-for-byte using the pinned source types.

A direct `cdylib` build retained unrelated wasm-bindgen descriptor exports via
Rapier's unchanged `profiler → web-time` dependency and therefore failed the
no-host-import gate. Official Binaryen root pruning/DCE removed three imports,
but conservatively retained two referenced from the function table; it was not
used for the final module. The admitted builder produces a Rust `staticlib` and
uses the **same official toolchain's rust-lld** with only the ten decoder functions
and memory exported. Its standard linker reachability/section garbage collection
leaves **zero imports and exactly eleven exports**. No upstream physics/serde
feature, imported stub, or reachable arithmetic was changed. Both first failures
were preserved rather than relabeled as passes.

The WASM ABI exposes:
- `snapshot_decoder_abi`, `snapshot_decoder_max_input/output/depth/nodes`.
- `snapshot_decoder_prepare(length)`: owns a zeroed input allocation; returns its
  offset or zero for an invalid size. No host-supplied pointer is dereferenced.
- `snapshot_decoder_decode()`: reads only that allocation. Status 0 is success;
  status 1 is a JSON decoder error; status 2 is an output-limit/encoding failure.
- `snapshot_decoder_output_ptr/len` and `snapshot_decoder_release`.

The build is capped at 1 GiB linear memory, with an 8 MiB stack and 16 MiB initial
memory. Inputs are 1..32 MiB and JSON output is at most 256 MiB. The wrapper creates
one instance per decode, validates every exposed range, copies input before any
await, and discards an instance after errors/traps. A failed decode returns no
partial state. It never tries another physics engine or native subprocess.

## One JavaScript serializer

`codec.js` is the single pure Uint8Array bincode encoder and typed-tree inspection
implementation. The new candidate Node and browser imports use exactly that implementation.
The candidate Node API wraps its result in Buffer to retain the familiar return
type. The historical standalone encoder remains frozen in `index.cjs` solely as
the independent legacy reference; it is not a second candidate implementation.
Widths, integer decimal strings, enum tags, ordered fields, options, Unicode,
negative zero and NaN payload bits retain the original encoding behavior.
Tree depth/node count and output-size limits also apply in JavaScript.

`browser.mjs` exports `createSnapshotDecoder`, the shared codec helpers and the
source/version/hash constants. Creation requires:
- `engineVersion: '0.21.0'` and actual `engineBytes` (Uint8Array), not only a claim
  about the engine hash;
- `wasmBytes`, the verified build `provenance`, and separately application-pinned
  `expectedWasmSha256`;
- Web Crypto SHA-256 and WebAssembly in a secure browser context.

The manifest/hash must be admitted by the application build, not supplied by an
untrusted snapshot. Both actual engine and WASM bytes are hashed before use. Each
accepted result must also match all source/version pins, the input SHA-256 and
length, the Rust bincode roundtrip flag, and a full JavaScript typed reencode.
`decodeSnapshot(Uint8Array)` is async. `decodeWorld(world)` calls only the genuine
`world.takeSnapshot` function, never `step`, `restoreSnapshot`, or mutation APIs.

## Explicit isolated build

Prepare official source archives and an official Rust `wasm32-unknown-unknown`
target. No wasm-bindgen CLI, Binaryen, WASI runtime or generated JS glue is required
by the final build/runtime path. The builder never downloads these implicitly. Use the same explicit
`RAPIER_SOURCE_ROOT`, `RAPIER_SOURCE_ARCHIVE`, `PARRY_SOURCE_ROOT`,
`PARRY_SOURCE_ARCHIVE`, `CARGO_HOME` and `RUSTUP_HOME` as the native builder.
Set `CARGO_TARGET_DIR` to a **new isolated directory**, not the original admitted
native target. Source verification byte-compares all Rust/Cargo/license files
against the official pinned archive hashes before any compilation.

```sh
node tools/rapier-snapshot-decoder/build-wasm.cjs --check-source
node tools/rapier-snapshot-decoder/build-wasm.cjs
node tools/rapier-snapshot-decoder/build-candidate.cjs
```

WASM output is `wasm32-unknown-unknown/release/rapier_snapshot_browser_decoder.wasm` in the
selected target directory. The adjacent `snapshot-wasm-decoder-provenance.json`
binds the exact source files, Cargo.lock, compiler, static archive hash, official
linker hash/version/arguments, final module hash, ABI and limits. Compilation is single-job with incremental compilation disabled.
Keep the generated runtime bytes and their admitted manifest bundled locally if
integrating the bridge. Do not fetch runtime WASM from a CDN.

## Validation and integration boundaries

`tests/rapier-snapshot-codec.cjs` is a small Node/no-Node-realm codec unit suite.
`tests/rapier-snapshot-browser.cjs` requires separate original/candidate native
binaries, the WASM manifest and an explicit source-index JSON mapping `real3`,
`fresh4`, `settled4` and `moved4` to the original archived fixtures. The immutable
artifact hashes and each snapshot's recorded identity are verified before use.
No fixture is regenerated, patched or re-signed against candidate source hashes.

It checks eight actual boundaries: three-ball ready/strike-created; four-ball
fresh mode/strike-created; physically rested/second-strike-created; and moved
four-ball ready/goal-strike-created. The original binary is the reference. The
candidate CLI must produce identical stdout bytes; the WASM must produce the
identical full typed tree and typed reencoded bytes. A separate Chromium test
(with GPU disabled) imports all eight without Node globals. Negative tests cover
wrong version/provenance/hash, bounds, malformed/trailing/truncated data, and
recovery after failures. It never restores or steps these snapshots.

Legacy source identity is preserved, rather than invalidated by integrating a
refactor into the old Node wrapper. New capture manifests that opt in to
`candidate.cjs` must bind that wrapper and `codec.js`. The new WASM/native build
manifests bind all included original and candidate source files. Prior fixture
manifests and originals remain untouched. Product activation, full real-app
tests, and GPU world parity are separate gates not completed by decoder tests.

## Actual browser checkpoint (2026-10-24, 19:06 UTC)

The existing managed cloud browser (Chromium 155 on Linux, official `cdp`
control surface) loaded a self-running verification page from a new dedicated
`127.0.0.1:8791` server. Its secure-context result was true. The page was started
with its visible button, and the completed result was read from its rendered
status element. No test code was injected via browser evaluation, no browser
security setting or launch flag was changed, and no user computer was accessed.
This verifies import execution in an actual browser; it does not independently
attest the managed browser's underlying sandbox configuration.

Only a newly opened blank terminal, the new server and a new test tab were used.
The existing application server on port 8788 and existing windows were not
changed. An attempted read of an existing terminal was denied and abandoned;
no alternate read, screenshot or history access of that terminal was performed.
The dedicated verification server, terminal and tab were closed after capturing
results, and browser control was released.

`tests/rapier-snapshot-browser-page.cjs` prepares only the required local assets
inside the ignored evidence directory. It verifies build-source, engine, WASM,
original capture and snapshot hashes. It uses the already-completed native
comparison log as its expected typed-state hash reference, without rerunning
native physics or replacing reference evidence. Run it with explicit
`RAPIER_BROWSER_SOURCE_INDEX`, `RAPIER_WASM_PROVENANCE` and
`RAPIER_BROWSER_REFERENCE_LOG` paths. Serve the printed directory over localhost
using the environment's supported server path, then open the page and click
**Run eight snapshot checks**. The browser harness is
`tests/rapier-snapshot-browser-page.mjs`; it imports the unchanged production
candidate wrapper and shared codec rather than duplicating them.

Actual results:

- Eight complete typed-state hashes matched the original native reference,
  and all eight input-to-typed-to-binary roundtrips were byte-identical.
- Twelve negative checks rejected wrong engine version, engine bytes, WASM
  bytes, pinned WASM hash, source revision, empty/oversized/wrong-type inputs,
  truncated/trailing/malformed binary and excessive typed-tree depth.
- No Node globals and no WASM host imports; `decodeWorld` requested exactly one
  `takeSnapshot` and no other world API; invalid owned ABI inputs were rejected.
- All checks passed on the first actual test-page run. This follow-up performed
  no additional compile, engine restore, physics step or GPU trajectory.

Evidence identities (raw logs and generated assets remain ignored):

- Prior original/candidate/Node-WASM differential log SHA-256:
  `c49111658aa8e8ba4e11d05d6957840074fdacb077da56dd099255dc3639c513`.
- Local test manifest SHA-256:
  `12fa3763a11b1fd4a1cc9eeac29e3440f6f91853469ec872002546b4639f7874`.
- Rendered browser result JSON, captured without modifying page state, SHA-256:
  `a5873187ba1a3dd91fb39e8554eaa4cd3d1dfd90ab4f66ccb9a5a48f8ab43b08`.
- WASM remains the same admitted `1647149118688a7152bc385e0c06ce985eda36e97a3a7e16a8f86fa8506eeabd` build.

The native-vs-WASM Node comparison previously used full deep equality; this
actual-browser comparison additionally checked the SHA-256 of the complete
serialized typed state against that preserved native reference. It did not
substitute approximate numerical tolerances or regenerated expected outputs.

## Licensing

New bridge sources are Apache-2.0. The derived world declaration/serializer
preserves its existing attribution to Dimforge's pinned serialization pipeline.
Rapier and Parry are Apache-2.0; the complete license is retained at
`vendor/RAPIER-LICENSE.txt`. The builder writes complete license/author notices for all resolved Cargo
packages alongside the module. Preserve that notices file when distributing it. Also preserve the selected Rust toolchain’s `COPYRIGHT-library.html` and
its accompanying `licenses` directory for the statically linked standard library.
The validation artifacts retain those files unchanged.
Four official crates omit their linked license files; for their explicitly
declared Apache-2.0 option, the notices retain authors and the unchanged full
standard license text, clearly labeled rather than misrepresented as a packaged
upstream license file. Existing product
licensing and authoritative CPU sources are unchanged.

## Verified artifact identities

- Original reference executable SHA-256 (unchanged):
  `0bbebced302953113abd7c428d7b66a7a8a9b7d293fe4108c8d67dc06a824d82`.
- New native candidate SHA-256:
  `8b66dae962f442245a28943618df15867915eba30a33c827c4001686e078301c`.
- Admitted WASM SHA-256, 6,276,648 bytes:
  `1647149118688a7152bc385e0c06ce985eda36e97a3a7e16a8f86fa8506eeabd`.
- Input static archive SHA-256:
  `778aca7dde148b3d787a8a25341563a47297a24f300f7968bdc3825ce5622c3e`.
- Rust 1.99.1 (`58cf8f9c3`, 2026-10-13), official LLD 23.1.1.

The admitted eight boundaries are `real3.before`, `real3.created`,
`fresh4.modeCreated`, `fresh4.strikeCreated`,
`settled4.firstShot.physicalRest`, `settled4.secondStrikeCreated`,
`moved4.beforeStrike`, and `moved4.goalStrikeCreated`. Their immutable source
artifact hashes are recorded in the fixture loader; their individual snapshot
hashes are checked against the original records before decoding. No original
fixture, manifest or binary was rewritten.
