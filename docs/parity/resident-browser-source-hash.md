# Browser-portable resident source identities (HOST-only)

## Implemented boundary

`src/resident-candidate/source-sha256.mjs` is a source-owned synchronous
SHA-256 implementation of FIPS 180-4 §§4–6. No library implementation was
copied, and no dependency, installation, license change or asynchronous hash
boundary was introduced. It supplies only the API these source generators use:
`createHash('sha256').update(string | ArrayBufferView).digest('hex')`.

Eight production modules replace **only** their `node:crypto` import:
`raw-microcode-source`, `microcode-compiler`, `microcode-source-intrinsics`,
`microcode-preparation`, `microcode-source-macros`, `microcode-allocation`,
`macro-launch-profile`, and the extracted `macro-launch-data` (all under
`src/resident-candidate/`). The exact two-file extraction prerequisite is
upstream `808933d`, adopted separately here as `d3cfab1`; an integration branch
already containing it must skip that prerequisite, not duplicate the extraction.

The utility consumes raw view bytes at their intrinsic offset/length. It does
not numerically convert typed elements or retain caller buffers. Strings use
UTF-8 with the same lone-surrogate replacement and per-update encoding as Node.
Shared/detached inputs reject before hash state changes; this is the deliberately
narrow owned-input contract, **not** a claim to polyfill every Node crypto API.
Unknown algorithms/encodings and repeated finalization reject. Working state is
bounded (64-byte tail, 64-word schedule, eight hash words); a string update also
allocates its UTF-8 encoding. It is a content identity, not evidence of provenance
or a replacement for authenticated initial-world admission.

## Evidence

- **44 focused HOST tests passed**, including seven hash tests: published
  empty/abc/multiblock/million-a vectors, independent Node and WebCrypto checks,
  UTF-8/Korean/emoji/lone surrogates, padding/chunk boundaries, offset typed and
  DataView/Buffer/cross-realm spans, shadow getters, mutation, detached/shared
  rejection and a browser-like realm without Node/Buffer/WebCrypto globals.
- **One static import inventory test passed.** Eleven actual initialization,
  world/source composition, compiler/allocation, VM/macro and launch roots cover
  128 modules using static import/export-from (including side-effect imports).
  No external static import remains. This is not a dynamic `require` graph.
- **One independent frozen fresh-six identity test passed.** It reads the
  initial-only `mixed-six-macro-launch-v1` artifacts, regenerates all 542,365 WGSL
  source bytes, compares the entire allocated compiler object (131,112
  instructions, 7,783 locals, depth 15), complete source approval metadata,
  original core and four macro shaders, canonical runtime identity and all four
  WGS 1/8/32/64 launch profiles. All are exactly equal. Inputs are hashed before
  and reread afterward; no frozen artifact is written or relabeled.

The identity test initially failed at its **own** final launch-profile leg:
`manifest.deviceLimits` was not the declared planning-limit object. The earlier
source/code/shader assertions had passed. The test now uses each frozen launch
profile's actual `planningLimits`; no production admission, cap or numerical
code changed. This was HOST test plumbing, not a GPU failure. Curated failure
and terminal evidence are retained in
`docs/evidence/resident-browser-source-hash.json`.

Reproduction (the identity fixture is local evidence, not checked into Git):

```sh
node --test --test-concurrency=1 \
  tests/resident-candidate-source-sha256.mjs \
  tests/resident-candidate-microcode-source-intrinsics.mjs \
  tests/resident-candidate-microcode-compiler.mjs \
  tests/resident-candidate-microcode-allocation.mjs \
  tests/resident-candidate-microcode-compiler-intrinsics.mjs \
  tests/resident-candidate-microcode-external.mjs \
  tests/resident-candidate-browser-hash-closure.mjs
RESIDENT_SHA_IDENTITY_ARTIFACTS=/path/to/mixed-six-macro-launch-v1 \
  node --test tests/resident-candidate-source-sha256-identity.mjs
```

Without the explicit artifact directory, the last gate is **skipped**, not
reported as verified. The fixture pins its original bytes with independent Node
hashes; V8 serialization is not treated as a canonical metadata encoding.

## Remaining real browser adapter boundary

This checkpoint is **not browser-ready resident execution**. The inventory
still contains 35 classic/CommonJS/process modules. For example:

- `world-initialization.mjs` imports classic `.js` modules through Node-style
  default exports; their browser globals require explicit dependency/load-order
  adapters or a verified browser bundle. Removing crypto alone does not provide
  those exports.
- `experimental-cue-convex-topology.js:73` intentionally rejects native decoded
  topology export outside Node and checks its mutable decoded bytes with a
  conditional `require('node:crypto')`. Packing an already admitted topology is a
  separate source path. This authority boundary was **not** bypassed or edited.
- `experimental-ccd-proxy-distance-kernel.js:324` retains its guarded Node CLI
  `node:fs`/`node:path` generation branch. Other modules dynamically choose
  CommonJS `require` versus named globals. A browser bundler must not silently
  replace these with empty Node shims.

The next adapter must preserve the real initial-world brands, exact source
closure and candidate input authority, then be exercised by the repository's
actual browser worker/application tests. No Chromium, WebGPU/Dawn, physical
step, hardware measurement, worker activation, package/CI/default backend,
publication or deployment is part of this checkpoint. Generated WGSL and
bytecode are unchanged; source-file hashes necessarily change and old frozen
source manifests remain untouched.
