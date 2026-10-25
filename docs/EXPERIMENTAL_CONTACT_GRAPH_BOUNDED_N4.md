# Bounded prepared four-sphere contact graph foundation

This is a Journal component prerequisite, not four-ball product-world support
and not an elapsed-zero four-ball initialization proof. Production physics,
world/cue/scene stages, pair contact solvers and their admission limits are
unchanged.

## Explicit admission

- `original-three-ball-contact-graph` keeps exactly three dynamic sphere bodies,
  sixteen fixed colliders and two exact collision channels per sphere.
- `prepared-four-ball-contact-graph` admits exactly four already-prepared sphere
  bodies, sixteen fixed colliders, eight sphere channels, all 24 collider entries
  and all 24 directional adjacency entries. Every sphere must provide its actual
  finite f32 radius, current existing fat proxy and generation-bearing handles.
- `original-four-ball-contact-graph` and four-ball cue kinds are not aliases.
  Unsupported body counts and incomplete proxies are rejected.
- The full-cue factory still requires its original branded 25-collider N=3
  initial registry and matching source cue receipts. This change cannot create
  or admit a 27-collider N=4 cue registry.

The app's actual four-ball mode first constructs and settles the original three
balls for 72 steps, then adds the fourth sphere and the cue without an extra
settling step. At that entry the fourth sphere has not yet obtained its native
broad-phase proxy or cloth contact. Relabeling this entry as prepared, copying
another sphere's proxy or inventing a floor edge is invalid. A future native
Journal component gate must retain evidence of the independent native update
that actually creates those structures before exporting a prepared snapshot.
That later snapshot still does not prove original elapsed-zero initialization.

## One common arithmetic layout

`arithmeticLayout(bodyCount)` is bounded to the numeric counts 3 and 4 and returns
an immutable layout. The shared scalar/WGSL arithmetic plan uses that same layout
for packing and output interpretation:

- Sphere input: translation (3), radius (1), old minimum (3), old maximum (3).
- Fixed input: minimum (3), maximum (3), for all sixteen fixed colliders.
- Parameters: length unit and normalized prediction distance, after the boxes.
- Sphere output: updated minimum (3), maximum (3), followed by eligible pair flags.

Consequently, N=3 has 128 inputs, fixed offset 30, parameter offsets 126/127 and
pair-output offset 18. N=4 has 138 inputs, fixed offset 40, parameter offsets
136/137 and pair-output offset 24. The per-sphere f32 operation order and the
collider iteration/canonical pair order are unchanged. N=3 test goldens capture
the entire input, instruction graph, output indices, pair rows and results from
unmodified commit `827dc29`.

## Preserved limits

The Journal still permits at most one fresh non-cue broad-phase pair per update.
It does not approximate unsupported BVTT insertion order. Canonical handles,
dense append/swap-remove, directional prepend adjacency, edge lifetimes, active
contact deletion events, transaction sequencing, private ownership, sealed
same-origin receipt freshness and abort/retry behavior remain intact.

## Focused checks

Run the light CPU/representation checks without a native capture or GPU:

```
node --test tests/experimental-contact-graph-journal-bounded.cjs \
  tests/experimental-contact-graph-journal-freshness.cjs
```

The fixture in `tests/contact-graph-bounded-fixture.cjs` is synthetic and uses
widely separated fixed boxes. It is deliberately not a native initial-state
exporter. It exercises four-body proxy arithmetic, a fourth-body fixed overlap,
handle reordering, append/removal/rebirth and rejected transaction paths.

An explicit actual-WGSL component gate is available after reserving the shared
native/GPU test slot:

```
GPU_NATIVE_MODULE=/absolute/path/to/webgpu/index.js REQUIRE_WEBGPU=1 \
  node --test tests/experimental-contact-graph-journal-bounded-webgpu.cjs
```

That gate compares CPU and actual WGSL prepared graph transactions exactly; it
is not a Rapier-vs-Journal trajectory test. Existing native N=3 Journal and
full-cue regressions must be run separately, unchanged. Full application tests,
N=4 native/source world initialization and complete N=4 CPU/GPU/Rapier shot
parity are outside this prerequisite's passing claims.

## Required independent native prepared-component gate

`tests/four-ball-prepared-journal-native-fixture.cjs` consumes the frozen,
source-verified creation artifact from `tests/four-ball-created-fixture.cjs`.
It first proves that the actual mode-created snapshot has only 22 proxies and
three cloth pairs and is rejected by the prepared exporter. It restores exactly
those snapshot bytes in independent Rapier, performs one native no-cue update,
and only then exports the four existing proxies and four actual cloth pairs.

Eight controlled native updates exercise dynamic pair creation, activation,
deletions, dense relocation and rebirth. The Journal receives each native pose
and actual narrow-phase transition as an explicit component input. CPU and
actual WGSL then compare full dense identities, directional adjacency, fat
proxies, active graph and contact event order against independent native results.
This is deliberately not a self-driven rigid-body trajectory test.

After the creation artifact exists and the shared serial slot is reserved:

```
RAPIER_SNAPSHOT_DECODER=/absolute/path/to/rapier-snapshot-decoder \
FOUR_BALL_CREATION_V8=/absolute/path/to/original-four-ball-created.v8 \
GPU_NATIVE_MODULE=/absolute/path/to/webgpu/index.js REQUIRE_WEBGPU=1 \
  node --test tests/experimental-contact-graph-journal-four-ball-native.cjs
```

During isolated worktree development, `FOUR_BALL_CREATION_FIXTURE` can point to
an absolute verified creation-fixture module in its frozen worktree. After both
commits are integrated, the default sibling fixture path is used. Artifact
loading never implicitly creates or overwrites a native oracle.

## Verified result, 2026-10-24

At frozen implementation commit `846823375d095733a177938ef2a3c594762ed8a7`
and exporter-only correction `4b199760947bf501efd9152150e721a12b63c8d4`:

- Light arithmetic/representation/freshness checks: 13 passed, zero skipped.
- Serial actual GPU and native component/regression gate: 14 passed, zero
  skipped, exit 0, elapsed 24.98 seconds.
- Synthetic prepared N=4 CPU/actual-WGSL graph equality: six transactions.
- Independently restored original-mode native N=4 prepared graph: CPU and actual
  WGSL both exactly match all eight controlled frames, including three pair
  additions, three removals, one dense relocation and one actual activation.
- Unmodified N=3 native Journal tests: CPU and actual WGSL each pass 40 own-state
  frames with maximum absolute error zero. The native allocation/multi-delete
  holdout, receipt freshness and rollback tests also pass.
- Unmodified original 25-collider cue allocation: CPU and actual WGSL both pass.

The first gate at `8468233` passed the synthetic GPU test but exposed a test
exporter schema mistake before Journal-native execution: the exact typed-tree
manifold field is `ContactPair.contacts` (the `Rigid` enum variant), then
`value.manifolds`, not a top-level `manifolds` field. The isolated worktree also
needed its ignored official `vendor/rapier.cjs` file materialized. The correction
changes only the new exporter and asserts the rigid variant; no source runtime,
expected value, precision tolerance or verification scope was weakened. The
local vendor was copied from the existing pinned repository and verified against
the admitted engine SHA. The first failure log is retained.

Reproduction used the following source-verified creation artifact and fixture:

- Creation artifact: `/tmp/billiard-original-four-ball-created-canonical-v1.v8`.
- Creation artifact SHA-256:
  `b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`.
- Exact original mode-created snapshot SHA-256:
  `982919a351245906b3eed35fd28daa48073f7669f9cf10ae240c0a5ed528b3ac`.
- Independent one-update prepared snapshot SHA-256:
  `2a00ed91225bfc9acb1d58cc8d27f586433688f0564f4cf61b59f38128fdb8a7`.
- Official creation fixture source SHA-256:
  `d61e122a8f8ee5b7467dcaae187b072d18124b66845c51e9632a351a65dd3991`.
- Journal source SHA-256, unchanged throughout both gates:
  `1363a3173ae36312d3833a77a48adaae6369803eef111916e1cb52f8e9a41562`.
- Official pinned vendor SHA-256:
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.
- Passing log: `/tmp/billiard-journal-bounded-n4-gate-4b19976.log`, SHA-256
  `7a3232ae62bd8c23b77744ed133679cc25f97bd1a9c18b9c61e351f494997163`.
- Original failure log: `/tmp/billiard-journal-bounded-n4-gate-8468233.log`, SHA-256
  `ac18f5c873e9dfa87214829157a8a206a5f2c0d14ce18a87f8dc775b97280988`.

The passing command, run with the shared native/GPU slot reserved, was:

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
FOUR_BALL_CREATION_FIXTURE=/workspace/scratch/f887f82f638e/billiard-four-ball-native-creation-20261024/tests/four-ball-created-fixture.cjs \
FOUR_BALL_CREATION_V8=/tmp/billiard-original-four-ball-created-canonical-v1.v8 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test --test-concurrency=1 \
  tests/experimental-contact-graph-journal-bounded-webgpu.cjs \
  tests/experimental-contact-graph-journal-four-ball-native.cjs \
  tests/experimental-contact-graph-journal.cjs \
  tests/experimental-cue-contact-graph-journal.cjs
```

These passing checks establish the bounded prepared Journal component only.
They do not establish four-ball cue creation, the original elapsed-zero world,
complete four-ball CPU/GPU/Rapier shots or full application/UI tests. No product
world admission or original source physics was changed.
