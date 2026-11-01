# Rebuilding the compiled application candidate from source

## Verified result (2026-11-01)

A separate workspace was reconstructed from original Git commit
`ee1c1cfca7a930eaa8d376a009da6f0aad2c08e6` and hash-verified local source
inventories. No prebuilt compiled program artifacts were copied. The complete
nine-step recipe passed sequentially, including original asset generation,
independent CPU input recipes, all three bytecode compilations/roundtrips, and the
real application build. Dependencies were existing packages, not newly downloaded.

Exact reproduction succeeded for the original manifest, all three compiled
artifacts and compiler identities, runtime closure, resource receipt, and HTML.
Worker bundle bytes are **not identical** across filesystem locations: esbuild
includes source-path comments. Parser-based comment-free Worker output is exactly
identical; controller output is exactly identical after replacing only its expected
Worker SHA and byte length. The rebuilt app's own hashes, seals, and18 HTTP-served
assets passed integrity checks. This does not claim a fresh native or browser run.
The separately qualified v3 bundle remains immutable.

## Source trees and independent pins

Restore these separate trees; do not mix compiler versions:

- `original`: Git commit `ee1c1cfca7a930eaa8d376a009da6f0aad2c08e6`, including
  original source pin, tools, package-lock, tracked scheduler WASM/provenance.
- `search-compiler`: complete `divide` source inventory. Compiler identity:
  `b4b9ceeea9ff0548547a519c40cf4a6fdd4f55576a7ae30fe67a3ac396d867db`.
- `selected-compiler`: complete `selected-divide` source inventory. Compiler:
  `23b4e960113ca740d4345d30b94e7e277df914c17ef7f574f094aa38bce15c35`.
- `integration`: complete `app-integration` source inventory, v3 runtime closure
  `c30036bdf9efa60080e621a317ec07ceb60a9c8dd053b6bf57c6c9ddff4b5142`.
- `candidate-tools`: this directory's tools and real user-flow test.

Source-only overlays originally referenced base commit
`2e7877b30be5bb77a0e99b4e3b7f0259aae8b866`. The verified reconstruction instead
used complete source inventories including base-identical files, checking every
byte length/SHA256. It did not pretend to check out that unavailable local commit.
Use complete inventories, not incomplete overlays without their base.

Original physics content identity (not a Git commit):
`75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df`.
Original generated manifest:
`93f9bcc033060761a0a5dd445c4c8bf43eeca4c5088878d83e187c40fe628f02`.
Never regenerate reviewed pins merely to accept different source bytes.

## Dependencies

Use Node >=22 and reviewed package-lock dependencies. The tested environment used
Node24.22.1 and esbuild0.25.5. Dependency preparation/download is separate from this
recipe; no tool here installs packages. `original/node_modules` must resolve those
packages (including TypeScript, esbuild and @dimforge/rapier3d-compat0.21.0), and
`dependencyDirectory` must identify the same installed node_modules.

The first recipe step runs the original `tools/prepare-engine.cjs`, which copies
Rapier from its pinned installed package to vendor/rapier.cjs. Its bytes must match
original source-pin SHA `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.
The integration scheduler is restored from the original Git-tracked16,343-byte
WASM, SHA `396145c6ff702e8e28b9ca9acb6aa489322e486a6c18bae9f080a284e727806e`.
It is not recompiled or replaced. A separate full Rust rebuild needs Cargo.lock and
the WASM target and must independently reproduce that hash.

## Execute the recipe

Create a layout file using your own absolute directories:

```json
{
  "originalRoot": "/your/build/original",
  "integrationRoot": "/your/build/integration",
  "searchCompilerRoot": "/your/build/search-compiler",
  "selectedCompilerRoot": "/your/build/selected-compiler",
  "dependencyDirectory": "/your/build/dependencies/node_modules",
  "outputRoot": "/your/build/new-output"
}
```

Run `node tools/prepare-reproduction-configs.mjs layout.json`. This writes configs
and `steps.json`; it does not execute the builds. Execute each `argv` array in
`steps.json` in order, stopping on any nonzero exit. All generated output paths
must be new. The sequence is:

1. Original pinned Rapier vendor preparation.
2. Original reviewed-source capability → authenticated program assets.
3. Historical N1 input packing and independent CPU reference.
4. N1 compilation and exact roundtrip.
5. Historical N3 input packing and independent CPU reference.
6. N3 compilation and exact roundtrip.
7. Selected compilation and exact roundtrip.
8. Original pinned scheduler restoration into integration.
9. Actual app packaging with independently fixed artifact/compiler pins.

Expected compiled artifact SHA256 values are embedded in the recipe:

| Profile | SHA256 |
|---|---|
| search-N1 | `5173c9b81b22d026351eb73840e2e84a128e7b8659cd272299a70e31163f080b` |
| search-N3 | `80c7e07360aefc859997162a3759456176583315aac1bd84857a0ed893fb55f1` |
| selected-N1 | `226b524d67368b15795a11ccc071351a86d6ffa19315da3c3149348a4a922d31` |

The historical input recipes preserve manifest metadata exactly; the later CPU
pair-reference supplements are separate evidence, not substituted input manifests.
Runtime execution still uses fresh validated RPC inputs, not these build fixtures.

## Verify the resulting app

`python3 tools/check-built-app-http.py <absolute-candidate-root>` checks the actual
original HTTP server and served asset hashes/MIME/headers, then stops the server.
`node tools/compare-candidate-builds.mjs <baseline-root> <fresh-root> <node_modules> <receipt-file>`
compares exact core identities and parser-normalized bundles with only the explicit
Worker descriptor substitution allowed. It does not run GPU work.

Run the CPU, host and real UI tests listed in README. A build or source archive is
not a native/browser qualification. Existing physics, allocation policies and
600000ms product RPC timeout remain unchanged. The protected browser available in
the tested environment returned no WebGPU adapter, so positive real UI GPU flow
and macOS Chrome/Metal compatibility remain unverified. Do not replace those gates
with mocks or weakened security settings. No deployment is performed by this recipe.
