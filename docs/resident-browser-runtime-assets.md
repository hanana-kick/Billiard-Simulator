# Optional resident browser-module packaging

This is **local source/initialization packaging**, not browser rendering,
WebGPU qualification, a selected application backend or a release.

The previous resident import graph used CommonJS default exports from original
classic scripts. Native browser modules have no such default exports. Ten small
import adapters now use the existing namespace/default-or-original-global
pattern, retaining original classic source and global authority. The resident
entry first loads the established original dependency order, then exposes the
source initializer, four-macro runtime/launch constructors, lifetime owner and
compact decoder. It requests no device and executes no candidates.

## Explicit build only

```sh
RAPIER_WASM_PROVENANCE=/absolute/pinned/provenance.json \
  node tools/build-gpu-worker-assets.cjs /absolute/output --resident
# Or, when deliberately building the full app with optional dormant assets:
RAPIER_WASM_PROVENANCE=/absolute/pinned/provenance.json \
  node build.cjs --resident-gpu-worker-assets
```

Default build behavior, CPU search and UI are unchanged. The manifest records
`activation:false`, `automaticDeviceRequest:false`, `numericallyQualified:false`.
It retains the existing decoder/engine/source/license hashes, all-local paths,
and source bytes without bundler rewriting. This does not automatically load a
worker or authorize messages. Production worker routing/cancellation/device-loss
UX, inverse result mode, multiple banks and numerical release gates remain
separate. Use HTTP localhost or HTTPS and an admitted secure-context Web Crypto
implementation for the actual decoder; no `file://` deployment is claimed.

## HOST evidence

`tests/resident-browser-runtime-assets.cjs`, run explicitly with
`--experimental-vm-modules`, passed **3/3** with the genuine source capture and
pinned decoder provenance. The test realm has no `module`, `require`, `process`,
`Buffer`, `navigator` or `fetch`. Its realm-aware native-clone shim preserves
cloned data/prototypes/aliases for this HOST test; it is not shipped or evidence
about a particular browser's structuredClone implementation.

- 195 packaged files, **14,500,580 bytes** at this checkpoint; 169 initialized
  browser-like modules. Payload size is not measured network transfer.
- The original 13-call raw-t0 import authenticated with **zero native steps**.
- Six distinct raw inputs generated the exact previously qualified source hash
  `c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20`
  and bytecode hash
  `30f7e7aae2258d01bdcb98811024f314592351f83ced1ffadfde2cda36c825e4`.
- The complete generic core, all four handler strings and every bytecode word
  equal the unchanged mixed-six baseline; 131,112 instructions, 7,783 locals.
- Actual browser, Worker/WebGPU execution, full rest and1024 remain untested.

The first HOST harness attempt exposed concurrent VM-linking behavior; imports
are now deliberately sequential after original-global initialization. A later
full delivered-graph link found the same pre-existing default-import issue in
`live-three-ball-owner-data.mjs`; its import adapter is corrected without
changing rules or source equations. Initial syntax/dependency setup failures
were not counted as passes. The genuine packaged/source gate took 9.954 s in a
concurrent HOST correctness run, not a performance benchmark.

## Integrated local delivery check

At source checkpoint `f528efc`, `npm run typecheck`, the self-contained
`node build.cjs --resident-gpu-worker-assets` build, and
`node --test tests/gpu-worker-build-http.cjs` all passed. The actual local static
server delivered all 195 manifest entries (14,500,793 payload bytes) with exact
lengths/SHA256, declared MIME types and `nosniff`; missing modules returned404.
The public HTML did not reference or activate the optional GPU assets.

This establishes local packaging/HTTP delivery, not a real browser module,
Worker, WebGPU, UI, network-performance or release gate. The test uses a pinned
locally built read-only decoder and performs no physical stepping or GPU work.
The prior 14,500,580-byte result above belongs to its earlier source checkpoint,
not the current payload. No source/provenance hash was relaxed for this build.
