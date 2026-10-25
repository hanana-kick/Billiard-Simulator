# Experimental shared-contact four-ball world

This is an experimental source-order port, not a replacement for the application's Rapier runtime and not a complete general GPU physics engine. The original `src/physics.js` and pinned Rapier WASM remain unchanged.

## What is different

A body participating in two ball contacts must not be integrated separately for each pair. The common owner instead prepares geometry in the existing privately owned pair/cushion phases, maintains the original persistent solver contact roster, and solves selected constraints against one shared mutable body array. The numerical graph is evaluated by the CPU reference or actual WGSL with the same float32 inputs and operation order.

The maintained metadata includes source BVTT pair birth order, dense graph edges, per-body color masks, pair hints, manifold GraphPos, persistent bucket insertion/removal, awake solver IDs and epochs. A newly woken ball's cloth hint is not fabricated from its post-wake state. Native first-contact count clearing and subsequent repair are preserved.

The common numerical result is an opaque transaction-bound receipt. A caller cannot provide a replacement solved state. Pair and cushion stages retain geometry, warm-start, broad-phase and rollback ownership. Each body is integrated once per solver substep. Original Simplified friction cache semantics are preserved; the Coulomb tangent cache is not overwritten as though a different solver were used.

## Validation case

The original application accepts a symmetric two-red-ball layout, using its default cue settings. The reference is captured from original controller actions without changing ball state after the shot. Only the initial created snapshot and its original creation journal are candidate inputs. Later native snapshots are assertion outputs only.

Validation is split into:

1. A prepared simultaneous-contact numerical comparison against the independent native/WASM boundary, including actual WGSL execution.
2. Continuous whole-world replay from the original created state, with all four bodies and cue lifetime.
3. Full graph, island manager, contact cache, solver roster and event comparisons at contact birth and activation boundaries.
4. Injected final-preflight failures followed by unchanged public snapshots and successful retries.
5. Physical rest, score/turn outcome and repeated completed-step invariance.

Run the repository's `tests/coupled-four-world-replay.cjs` with a verified original reference artifact and an explicitly reserved serial test slot. CPU and GPU are independent runs. The GPU mode requires an actual WebGPU adapter and does not silently run the CPU solver. Software Vulkan/SwiftShader execution is not hardware GPU performance evidence.

## Recorded bounded results

On 2026-10-25, the simultaneous two-red-ball case matched the original application through all 5,491 physical steps on the CPU port and actual Dawn Vulkan SwiftShader WGSL. Seven original post-application checkpoints covered the graph, island manager, 26 contact caches, source solver roster and terminal game result. Eight injected preflight failures per backend preserved the public snapshot and retried successfully. The maximum compared numerical error was 3.335045350993937e-9; signed-zero cache differences mean this is not a universal bit-identical claim.

Separate original four-ball regressions matched normal scoring through 5,480 steps and an opponent-ball foul after both red contacts through 5,415 steps on both backends. Their maximum compared error was 2.6770281880139635e-8. The latter retained the original -1 score and switched to cue 2 rather than stopping validation when the second red was hit. Original active-CCD and rollback regressions also passed on CPU and actual WGSL. The source engine was not modified to obtain these results.

The adapter was SwiftShader, a software implementation. These results establish execution and bounded source parity, not hardware-GPU acceleration or complete input coverage. Capability metadata reports the bounded shared-contact path separately and continues to declare `wholeWorld: false`.

## Scope and remaining limits

- The shared arithmetic supports original one-point cloth, sphere-pair and static convex constraints for up to four dynamic bodies.
- Exact selected constraints come from the owned source roster, not a guessed or sorted-per-frame substitute.
- Overflow/generic multimanifold grouping, arbitrary new body registries and live-cue active CCD are not admitted by this experiment.
- The original initial-only import contract now accepts registered fixed-cushion/primary-sphere contacts in addition to four retained cloth pairs. The typed snapshot, graph/hints, warm starts and recycle state are preserved. Initial dynamic-pair and arbitrary manifold origins remain outside the contract.
- A prepared arithmetic test is not proof of every whole-world topology. Likewise, one passing simultaneous-pair shot does not establish arbitrary simultaneous cushion contact, all sleeping contact components, or universal CPU/GPU equivalence.

Source attribution is retained in the ported modules and `vendor/RAPIER-LICENSE.txt`. The implementation follows the pinned Rapier revision identified by the tests, rather than substituting a different contact model to obtain agreement.

## Initial retained cushion extension

A legal original controller layout places the cue sphere beside the front cushion and an object sphere 10 mm further inside. All original move and default strike operations are accepted. Three original recreations agree byte-for-byte; the candidate receives only the created boundary and strike journal. At h549 the original shared sphere has positive sphere-pair and cushion impulses.

Both the CPU port and actual SwiftShader WGSL matched this shot through all 7,175 physical steps, including initial sleeping contacts, the simultaneous positive impulses, final physical rest, zero score and switch to cue 2. Eight original checkpoints compare 26 contact caches, graph/BVH/island state and exact solver metadata; eight injected preflight failures per backend roll back and retry. Maximum compared numerical error is 3.335045350993937e-9.

Unchanged sleeping retained cushions now follow the native skipped-update path without clearing cached contacts. A source-observed standalone cushion sleep crossing seals prepared geometry without numerical integration. A later bounded initial-dynamic-contact extension supports source-observed coupled component sleep without changing native caches; see experimental-initial-dynamic-contact-world.md. Modified sleeping colliders, multiple simultaneous new cushion pairs and generic multimanifold/overflow solver groups still fail closed. The passing witness does not establish these remaining domains.
