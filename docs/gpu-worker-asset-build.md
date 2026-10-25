# Optional self-contained GPU worker asset build

Default `node build.cjs` stays CPU-public and does not ship or load these assets.
It removes the generated optional `dist/gpu-worker-assets/` subtree to prevent
stale opt-in output from accidentally entering a later default build. The public
`index.html` is byte-identical between default and opt-in builds. No public
search/backend switch or extra page fetch was introduced.

Explicit local packaging:

```sh
RAPIER_WASM_PROVENANCE=/absolute/path/snapshot-wasm-decoder-provenance.json \
  node build.cjs --gpu-worker-assets
```

The manifest must come from `tools/rapier-snapshot-decoder/build-wasm.cjs`'s
existing official-source build. That build requires explicitly provisioned
pinned Rapier/Parry source and Rust tooling; see the decoder build scripts.
There is no implicit machine-specific path, `/tmp` dependency, download, CDN,
fixture fallback or automatic decoder rebuild. Missing provenance, source hash,
engine hash, WASM hash, host-import/ABI admission, or dependency notices fails the
optional build. The normal CPU build needs none of these decoder artifacts.
CI provisioning/reproducible decoder artifact production remains an explicit
production-enablement prerequisite, not silently assumed here.

`tools/build-gpu-worker-assets.cjs` is shared by the opt-in build and existing
`tests/bounded-gpu-shot-worker-page.cjs`. It copies the source-derived module
closure without rewriting physics or manufacturing a runtime API. Output includes:

- Both existing dedicated-worker entries, evaluation client, protocol/transport,
  lifecycle and resource ownership modules.
- Exact original numerical world dependencies and browser initial import graph.
- Read-only browser decoder/codec, exact engine identity bytes (not executed by
  the worker), admitted decoder WASM/provenance and all decoder license notices.
- Existing optional multi-shot world module and plan scheduler. Import the batch
  module only after the existing worker runtime initialization; it is not added
  to the public search API or automatically activated.
- A hash/size manifest at `gpu-worker-build-manifest.json`.

Relative URLs are preserved under `dist/gpu-worker-assets/`. Provenance's local
WASM/notice paths are rewritten only to their bundled filenames; admission hashes
and source records are unchanged. Local server MIME types now support `.mjs`,
`.json`, `.wasm` and `.bin` with `nosniff` intact. Host deployments must likewise
serve JavaScript modules as JavaScript and WASM as `application/wasm`. A secure
context and actual supported worker WebGPU adapter remain runtime requirements.

## Size and behavior

Current emitted payload is 104 files / 13,151,651 bytes (about 12.54 MiB), plus
the 17,578-byte build inventory JSON (13,169,229 bytes total). This is **uncompressed file content on disk**, not
measured network transfer, compressed download size, resident GPU memory or
startup latency. The largest files are decoder WASM (6,276,648 bytes), engine
identity bytes (4,343,409 bytes), and dependency notices. Default builds ship
none of this optional subtree; opt-in builds still do not load it from the
public page. Fetching begins only when an existing explicit worker client is
actually constructed and initialized.

## Verification and discovered prerequisite

2ed077e's worker ordered list omitted the newly added plan scheduler dependency
of StageRuntime. Its existing strict source/realm tests caught this. The list
now places the scheduler before StageRuntime; the reverse scheduler lookup is
proven lazy via `runtime()`. All four known lazy cycles remain explicitly tested.
No numerical method, admission whitelist, runtime capability or protocol changed.

Verified locally:

```sh
RAPIER_WASM_PROVENANCE=/path/to/manifest.json \
 node --experimental-vm-modules --test tests/gpu-worker-build-assets.cjs
node --experimental-vm-modules --test \
 tests/bounded-gpu-shot-worker-source.mjs tests/bounded-gpu-shot-worker-transport.mjs
# After the opt-in build:
node --test tests/gpu-worker-build-http.cjs
```

2 packaging tests, 20 source/realm/transport tests, and 1 real local HTTP test
pass. The shared test-page generator succeeds. Both default and opt-in full
builds succeed; default removes optional assets and retains the exact public
HTML. Packaging tests verify bytes/hashes, no external/bare imports, all 100 JS
module paths, browser module branches without CommonJS, initialization order,
single private hull authority and optional batch compatibility. HTTP tests fetch
every emitted asset from the actual static server and verify MIME/hash/size.

**Not verified:** actual browser DedicatedWorker/WebGPU execution, GPU arithmetic
or full UI behavior. VM-module and Node transport checks are not browser tests.
No browser launch, GPU-heavy test, upload, push or deployment was performed.
