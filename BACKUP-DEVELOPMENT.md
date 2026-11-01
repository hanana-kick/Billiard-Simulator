# Development source checkpoint — not a release

This backup branch contains an experimental native selected WebGPU implementation.
Overall interactive qualification is incomplete. Do not treat source preservation
as a production deployment, real-time performance guarantee, or macOS qualification.

Use Node.js 22 or later, install locked dependencies with `npm ci`, run `npm run prepare:engine`, then run
`node build.cjs --canonical-controller-assets`. The build regenerates original
pinned program inputs, compiler/runtime closures and the separately pinned native
selected transform. Original scheduler WASM remains the tracked, hash-verified
base artifact. Native selected transform WGSL and its build-time pin checks are
source files, not external runtime downloads.

After the canonical build succeeds (tests require its generated dist inputs),
focused host checks include `node --test tests/native-selected-artifact.mjs
 tests/native-selected-coverage.mjs tests/native-selected-runner.mjs
 tests/native-fourchunk-runner.mjs tests/native-header-copy.mjs
 tests/render-stale-size.cjs` and
`npm run typecheck`. Host checks are not actual browser/GPU proof.
`tests/native-terminal-integration.mjs` separately requires
`NATIVE_TERMINAL_ORIGINAL_ASSETS` set to the generated
`.compiled-build/release-*/generated/original-assets` directory.
The optional real-capture decoder test requires an explicitly supplied pinned
capture and is not part of the source-only build prerequisites.

No runtime logs, browser profiles, private diagnostic receipts or generated
candidate binaries are included in this checkpoint. Separate resolution,
snapshot-transport, renderer and mathematical experiments are not merged here.
