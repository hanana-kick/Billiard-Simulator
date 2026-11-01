# Source-built compiled GPU transport

The ordinary opt-in release build now regenerates the compiled transport from source:

```sh
npm ci --no-audit --no-fund
npm run prepare:engine
npm run build:release
```

`build:release` is exactly `node build.cjs --canonical-controller-assets`, the existing Pages build command. Plain `npm run build` is unchanged and does not package the experimental GPU entry. Activation remains the existing explicit user confirmation.

The normal wrapper at `tools/build-canonical-controller-assets.cjs` invokes `tools/compiled-release/build-release-assets.mjs`. It executes the reviewed-source asset generation, separately pinned search and selected compiler recipes, exact roundtrip/admission, scheduler verification and sealed controller/Worker bundling. All generated intermediates live in ignored `.compiled-build/`; no downloaded/prebuilt compiled binary or `/tmp` fixture is required. Build failure never falls back to the old eager-pipeline Worker. The explicit program-free diagnostic API remains available and emits no GPU Worker.

`build-sources/search-compiler`, `build-sources/selected-compiler` and `build-sources/runtime` retain separate source inventories and identities. Do not merge compiler variants or update expected pins merely to accept changed output. The original physical source pin, original verified generators and tracked scheduler remain unchanged. Installed dependencies must follow package-lock.json; esbuild 0.25.5 is enforced.

Validation commands after building:

```sh
node --test --test-concurrency=1 tests/compiled-release-build.cjs tests/canonical-controller-assets.cjs tests/canonical-controller-search-assets.mjs
python tools/compiled-release/check-release-http.py "$PWD"
npm run typecheck
npm test
npm run test:resident:host
npm run test:provenance
CANONICAL_ASSETS_REQUIRED=1 npm run test:e2e
```

The focused build tests do not replace physics, full UI or actual browser WebGPU qualification. Runtime/source/resource identities and the three compiled artifact hashes are checked independently. Generated Worker bytes can vary by esbuild source-path comments; a release must test its own exact sealed bytes and publish that tested build. The actual browser GPU shot gate is still required before publication. No deployment or CI/protection-gate change is included here.

## Selected-run acknowledgement policy

The compiled frontend now distinguishes forward GPU progress from a hung IPC
request. Selected runs have a 600,000 ms no-progress limit and an immutable
1,800,000 ms absolute acknowledgement limit. Only exact, ordered completed-chunk
messages from the hash-verified Worker/current request renew inactivity. Upload,
phase announcements, duplicate/stale messages and cancelled runs do not renew it.
Command counts come from the authenticated selected input contract; the chunk ABI
remains 256. Preparation/search/disposal timeouts, physics, bytecode, instruction
budgets, cancellation/drain and typed full-readback validation are unchanged.
The original pinned Worker client is preserved; the compiled build uses one
shared compiled client alias so endpoint identity checks are not bypassed.

Run policy regressions with:
`node --test tests/compiled-selected-watchdog.mjs tests/compiled-worker-client-regression.mjs`.
These are fake-clock/Worker host tests, not GPU qualification. Actual browser
qualification must target this build's exact assets; the prior separate 30-minute
software diagnostic is not a pass for this acknowledgement policy.
