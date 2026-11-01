# Real-app compiled transport candidate (not deployed)

This packaging tool does not run GPU work or qualify a browser. It constructs the
existing full application and activation/search/strike UI, not a diagnostic page.
Original physics source75c09 remains an independently authenticated immutable
input. New compiler artifacts, combined runtime closure, frontend resource receipt,
Worker bytes and controller bundle have separate identities.

`node tools/build-canonical-app-candidate.mjs <reviewed-config.json>`
requires originalRoot, integrationRoot, programDirectory, dependencyDirectory,
outputDirectory (must not exist), sourceRevision, inputManifestSHA256, and explicit
programs search-N1/search-N3/selected-N1 artifactFile/artifactSHA256/compilerRevision.
It never treats adjacent pins.json as independent authority, installs packages,
deploys assets, changes original sources or alters RPC timeouts.

Build phases: original source/build pin verification; parser-derived combined
runtime closure; per-program owned loader+plan admission in fresh serial CPU
processes; exact fixed-pool resource receipt; lazy-profile Worker; controller
bundle with one production-runtime alias; ordinary genuine UI build in an isolated
copy; standard canonical availability flag and immutable compiled assets.

Required existing commands in generated app:
- `npm run typecheck`
- `npm test`
- `npm run test:provenance`
- `npm run test:canonical-integration:cpu`
- `npm run test:ui` (actual complete browser suite incl narrow/settings)
- focused host suites from `tools/run-wasm-gpu-host.cjs` serially; its full wrapper
  rebuilds WASM and must not be represented as a lightweight check.
- `CANONICAL_ASSETS_REQUIRED=1 npx playwright test tests/e2e/canonical-manual-entry.spec.cjs`
  checks packaging/open/cancel ONLY, not native search.
- `RUN_CANONICAL_REAL_GPU=1 CANONICAL_ASSETS_REQUIRED=1 npx playwright test tests/e2e/canonical-compiled-real-flow.spec.cjs`
  uses actual existing activation/settings/search/cancel/retry/result/strike/history
  controls. Its test-runner40minute allowance is distinct from unchanged production
  RPC600000ms and progress watchdogs. No mocked GPU or injected CPU answers.

Run native/browser jobs separately from memory-heavy rebuilds. Keep
qualified runtime directories frozen. Publication is blocked until required full
application, physics and UI gates pass. Software WebGPU evidence does not establish
Mac Chrome hardware compatibility.

## Browser verification boundary
The protected browser available during qualification returned no WebGPU adapter.
Positive actual UI GPU flow was therefore not run; software-WebGPU Worker results
are separate evidence, not browser or macOS Metal qualification. Use a protected
browser with a genuine supported adapter for the preserved real-flow test. Do not
mock the GPU, disable browser protections, bypass TLS checks, or weaken assertions.

## Restoring without the original temporary directories
See [REPRODUCING.md](REPRODUCING.md) and
`tools/prepare-reproduction-configs.mjs`. The new path-parameterized recipe covers
original asset generation, pinned historical inputs, three compiler artifacts,
and final app packaging. The complete nine-step source reconstruction/build passed; all three artifacts and
core identities reproduced exactly. App bundle bytes differ only by source-path
comments and the resulting Worker descriptor. See the documented comparison and
remaining native/browser qualification boundaries.
