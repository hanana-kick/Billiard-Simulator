# Bounded original three-ball pair ownership

This increment changes experimental ownership only. Production physics, cue admission, Pair arithmetic, contact-graph arithmetic and scene activation arithmetic remain unchanged. It does not establish all-path parity, four-ball support, multiple simultaneous contact support or product GPU gameplay.

## Ownership boundary

The shared-journal three-ball path constructs persistent 01, 02 and 12 Pair phases from one original initial snapshot. Their local body slots are mapped explicitly to the unchanged application object order. The journal alone owns dense edge order, directional adjacency, lifetimes, graph sequence and contact events. `snapshot().pair` remains the original 01 cache; `snapshot().pairs` explicitly reports the three named caches.

The post-broad graph may contain at most one retained dynamic pair, including inactive fat-AABB/manifold edges. Its phase prepares and integrates its two bodies once; all other bodies use their existing single-body floor/cushion phase. An old deleted pair does not integrate even if its committed cache was present. It consumes the sealed removal receipt graph-only, while a different born pair can solve once in the same transaction. Dormant phases consume every journal transaction without accepting another phase's cache.

All three Pair phases synchronize and assert before any phase commits. Rejection aborts every pending Pair, floor, cue, cushion and scene phase before invalidating journal receipts. No per-step native state or external contact cache is accepted. The non-journal legacy path remains 01-only.

Retained overlap, simultaneous active pairs, same-body pair plus cushion, unsupported cloth loss, sleeping pair endpoint and active CCD remain fail-closed. Retained-overlap support would require separating geometry-only cache lifetime work from body integration. Two active dynamic constraints require a single source-ordered coupled three-body solver, not successive independent two-body solves.

## Initial provenance

`tests/three-ball-initial-pair-seeds.cjs` reads original typed ContactPairs and the original graph's directional linked lists. It preserves full native nonempty point, impulse, frozen solver and recycle caches. An absent cache is emitted only after exact edge and endpoint adjacency incidence establish absence. Initial nonempty dynamic caches are not silently erased: they are retained in the exporter and rejected by the current world's floor-only initial admission. Every binding has the same created snapshot digest, original handles/materials and complete dense graph. The old `pairSeed` alias is exactly seed 01.

## Validation separation

- `experimental-three-ball-pair-ownership-routing.cjs`: lightweight production routing/admission unit tests with fake numerical phases. These prove routing, not physics.
- `experimental-three-ball-initial-pair-seeds.cjs`: native-created snapshot plus typed extraction/negative tests. No native simulation.
- `experimental-three-ball-pair-ownership.cjs`: controlled original-engine 02 head-on, 12 oblique and natural 02-to-12 switch component trajectories. Each capture must prove actual contact, positive impulse and broad deletion, with at most one retained pair. CPU runs before actual WGSL. The same production contact-preparation function is used, while activation is bounded to verified awake components; this is not a complete scene/island-manager gate.
- The component gate forces a post-sync/pre-commit abort, checks unchanged committed graph/caches and retries from the same owned state. It checks one integration per body, all three native pair caches, floor caches, body fields, source events, dense graph, directional adjacency and every sequence.
- Separate explicitly commanded original-native graph sentinels prove old 02 deletion/new 12 birth and the stricter two-retained/at-most-one-active rejection. Commanded graph tests are not natural trajectories.
- Existing original-constructor angle 0 and yaw 15 whole-shot tests remain independent regression requirements. Controlled component fixtures must not be substituted for those product-entry sources or used to broaden the cue whitelist.

## Reproduction

Run tests serially with the approved native/GPU slot. Set `RAPIER_SNAPSHOT_DECODER` to the pinned native decoder and `GPU_NATIVE_MODULE` to the actual WebGPU module. `REQUIRE_WEBGPU=1` prevents an implicit intended-GPU run from being mistaken for CPU-only evidence. `PAIR_OWNERSHIP_REPLAY` optionally stores native capture bytes with a digest and exact capture-source identity sidecar; mismatches must fail, not be rewritten. `PAIR_OWNERSHIP_FIXTURE` can select one explicitly named fixture for diagnosis.

node --test --test-concurrency=1 tests/experimental-three-ball-initial-pair-seeds.cjs tests/experimental-three-ball-pair-ownership-routing.cjs

node --test --test-concurrency=1 tests/experimental-three-ball-pair-ownership.cjs

The test-only `three-ball-pair-owner-internals.cjs` compiles the unchanged production implementation with a narrow export addition so the real ownership functions can be tested without adding a production backdoor or dependency injection API.

## Evidence status

Final gates on 2026-10-24: 21/21 lightweight extraction/routing/controller tests; 3/3 controlled native/CPU/actual-WGSL component tests; original default whole shot 2/2; original yaw15 whole shot 2/2. All final gates had no skipped tests. The chronological evidence and the first corrected test-only ordering assumption are recorded below.

## First controlled native evidence

The fixed original-engine captures passed CPU recurrence with zero maximum numerical error: 02 head-on (96 frames), 12 oblique (128 frames), and the natural 02-to-12 switch (220 frames). Every capture had at most one retained dynamic edge. The natural switch had 02 broad birth/deletion at frames 57/67 and 12 at 128/143; contact starts/ends were 60/63 and 134/138 respectively. The captured artifact SHA-256 is `ed267a20896ed00496766f4cb50395003c1666032495338f50ca19132ac3a790`.

The first run's separate commanded graph sentinel failed its invented delete-then-add expectation. Actual source order is AddPair12, then DeletePair02 in that same transaction; exact native dense graph and directional adjacency had already matched. Only this expected test order was corrected. The original failure log and capture artifact remain preserved. No fixture coordinates, physical inputs, capture helper or runtime solver were changed. The post-broad selection rule intentionally uses the final authoritative graph, independent of an assumed event order.

The direct-controller spy gate additionally covers actual controller activation/writeback for 02 and 12, stable 01 alias, all-phase assert-before-commit, abort-before-journal and deterministic retry. Combined initial extraction/routing/controller unit gates: 20/20, no skips. These are control-flow checks, not substitutes for native/actual-WGSL physics evidence.

## Controlled component result

After the documented test-order correction, CPU replay from the unchanged frozen capture passed, then the actual WGSL run passed 3/3 with no skipped tests (21.09 seconds total). Both backends had maximum absolute error 0 on all 444 controlled trajectory frames, including all three cache owners and native dense graph/directional adjacency/source events. GPU execution used Vulkan with the explicit Chromium SwiftShader ICD, not the user's hardware GPU. The GPU gate log SHA-256 is `f86f64ac7937c9598d960924757abf14f20697ae0d5d07183eb596582a57c64b`.

A further saved-original-native cache test independently decoded all 35 fields of the active 01 cache at native outer 383 and matched the new extractor exactly. The projected actual graph/cache also passes Pair.validate, while feeding that later snapshot to the original-created exporter is rejected. This test does not step native physics or replace initial state.

The old yaw15 replay remains intentionally source-locked: its prefix manifest includes the previous contact-seed exporter hash, so the changed initial-only exporter correctly causes `Exact native variant/source provenance` on load. The artifact and manifest were not edited. Controlled success does not bypass this whole-shot regression requirement.

## Original default whole-shot regression

On the unchanged all-pair runtime, the original default full25-to22 gate passed 2/2 with no skips: CPU 259.51 seconds and actual WGSL/SwiftShader 269.00 seconds. Both ran 5,875 outer steps / 6,316 source h, compared 58 native cache/graph/activation/scene-manager checkpoints, reached original physical rest and score, and reported maximum absolute error 0. Original pair activity 383–385, third-ball sleep 481 and first cushion event 1,339 remain unchanged.

The gate's ordinary loaded-source freeze passed. An additional external SHA-256 audit verified the runtime, contact exporter and new plural `initial-pair-seeds` helper before and after this execution. After completion only, the future default/yaw whole-shot loaded-source matchers were strengthened to include both `seed` and `seeds` helper names. Yaw's new-capture source list also includes the new extractor dependency. Old yaw artifact and manifest hashes still match their pre-run recorded values; new capture paths are distinct and exclusive-create.

## Original yaw15 whole-shot regression

New native prefix450 and fixed9600 full-shot artifacts were captured under the strengthened exporter/helper provenance, with the same original PhysicsLab inputs, horizon, grid and transition rule. No old artifact or manifest was overwritten or amended. Read-only deep comparison proves every decoded native payload field unchanged: all body observations, graph topology, events, score, transitions and caches. A separate Buffer.equals audit proves byte identity of all three creation-record native snapshots, all 12 prefix raw checkpoints and all 111 full-shot raw checkpoints. The serialized `.v8` containers themselves are not byte-identical, so this is not a claim that their complete container hashes match.

New prefix SHA-256: `276c7e00664412ff0d51ae2af1949faff81ed070b2a2ca1d36cd257439cb0b5b`. New full-shot SHA-256: `9d2638e3efb6fc68c372f97054f3222add0192c9e30f9be8d8486b9db41eb614`. The exact native created snapshot remains `878f9c8eb6c92959ae4f940d7d5b482b672a26549d6d2e17af03552a41d557b3`.

On the frozen all-pair runtime, the yaw15 full-shot gate passed 2/2 with no skips. CPU took 312.69 seconds and actual WGSL/SwiftShader 371.57 seconds (714.83 seconds total including preparation). Both compared all 9,600 outer steps, 110 post-created native graph/cache/activation/scene-manager checkpoints and three application contact events. Both reached the original first rest at outer 7,099, retained sleep through the fixed horizon and produced the unchanged score `{cueId:1,delta:0,nextCue:2}`. Both reported maximum absolute error `1.7025832854677958e-8`, identical to the previous admitted yaw15 result and within unchanged tolerances. No unsupported boundary occurred.

The strengthened loaded-source freeze explicitly includes `tests/three-ball-initial-pair-seeds.cjs` and passed. The external before/after runtime/exporter/helper hashes also passed. Production physics, Pair, Journal, scene mathematics, cue whitelist, fixture trajectories and tolerances were not altered by this ownership increment.

This completes the bounded three-pair ownership increment. It still does not support overlapping retained dynamic pairs, simultaneous multi-contact integration, active CCD, four-ball ownership, every arbitrary shot, or product GPU gameplay.
