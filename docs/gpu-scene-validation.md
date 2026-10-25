# Re-running the original-scene continuation gate

The current admitted default-shot test reaches final rest from the original elapsed-zero creation state: 6,316 internal steps, 5,875 outer steps, and about 6.119792 physical seconds. Both scalar/native and actual software-WebGPU/native comparisons pass with zero measured residual across their compared fields, 58 predetermined hidden-state checkpoints, and the existing scoring class's miss→next cue 2 outcome. This is one explicitly restricted default shot, not arbitrary angles, spin, layouts, 4-ball play, full evolving BVH serialization or a production GPU speed claim. The earlier shorter tests remain separate regressions rather than being relabeled as whole-shot evidence.

Run `node tools/run-parity-scene.cjs` after preparing the following explicit environment variables. Paths must be absolute files; this runner deliberately has no machine-specific default paths.

- `GPU_NATIVE_MODULE`: the official native WebGPU module entry point.
- `RAPIER_SNAPSHOT_DECODER`: the pinned snapshot decoder executable.
- `THREE_BALL_CREATION_V8`: the original three-ball strike-created snapshot record.
- `THREE_BALL_FULL_TRACE`: the compressed unchanged-PhysicsLab full-shot observable trace.
- `THREE_BALL_SWITCH_REPLAY`: the independent native cue/time-grid replay and its `.json` provenance sidecar.
- `THREE_BALL_PAIR_REPLAY`: the independent native first-pair/sleep checkpoint replay and its `.json` provenance sidecar.
- `THREE_BALL_SHARED_PREFIX_REPLAY`: the independent native prefix replay containing the complete live-cue contact graph, with its `.json` provenance sidecar.
- `THREE_BALL_CUSHION_REPLAY`: the continuous native run's fixed cushion checkpoints, with its `.json` sidecar.
- `THREE_BALL_SPLIT_REPLAY`: the continuous native run's deferred split and final sleep checkpoints, with its `.json` sidecar.

The source capture helpers are `tests/cue-initialization-fixture.cjs`, `tests/three-ball-scene-fixture.cjs`, `tests/three-ball-pair-oracle.cjs`, and `tools/parity/capture-authoritative-corpus.cjs`. Capture the original constructor layout, selected index 0, angle 0, elevation 8, speed 2, and centered tip. Do not substitute the separately documented modified one-ball fixture. Captures use the unmodified authoritative engine. Replay identity, engine/source hashes and payload digests are checked by the tests; presence checks in the runner are not a substitute for those checks. Native captures are expected outputs, never recurrent state inputs to the candidate.

The runner forces `REQUIRE_WEBGPU=1` and serial execution. Missing adapter/native execution or missing evidence is a failure, not a skipped success. It preserves the process exit status, including treating signal termination as failure. Backend-specific adapter selection must preserve the browser or process security configuration.

The earlier scene regressions cover the original created state, cue contact and withdrawal, the source time-grid switch, the first coupled ball collision, and the unhit third ball's sleep transition. Their longest test ends at 484 outer steps, about 0.504167 seconds, but they do not certify inactive cue edges during the stroke. The additional shared-graph tests explicitly use the complete 25-collider owner, check its initial prefix, and retain source-ordered cue edge withdrawal into the 22-collider scene through 450 internal steps. These are separate paths; passing the legacy test cannot substitute for passing the shared-graph test. Those shorter gates alone do not certify later cushion contacts or final rest. The stronger final-rest extension below supplies that evidence only for the explicit default shot; four-ball gameplay, arbitrary settings, active CCD and general GPU/CPU equivalence remain unsupported or unverified. Every extension must retain the earlier cue and state-transition regressions rather than replacing them with a later endpoint-only comparison.

The shared-graph first-pair test advances that complete owner to 484 outer steps (925 internal substeps), checking first pair birth/death and third-ball sleep without replacing candidate state from native checkpoints. A subsequent first-cushion test advances to 1,346 outer steps (1,787 internal steps), and the final-rest test covers the remaining cushion events, deferred island split, final sleep and original default-shot scoring. These progressively stronger tests retain exact source/transaction guards. None enables a broader input domain or production backend by itself.

`node --test tests/parity/scene-runner.cjs` checks only runner admission, serialization and failure propagation using temporary placeholder files. Those three lightweight tests do not execute physics or WGSL and must not be reported as physics-parity evidence.

## Product regression boundary

The frozen product tree `12ad38d9f14e1f15fcb8a8518aecf3a03fb3791a` passed `npm run build && npm test && npm run typecheck` with exit status 0. The six test groups passed 233, 3, 41, 27, 3 and 1 tests respectively, totaling 308 with no failures or skips. These include deterministic worker planning, independent three/four-ball solver replay and existing game-rule regressions. This result protects the existing product while experimental parity modules remain disconnected from production. It does not substitute for browser UI testing, the separate native/GPU component suite, or the restricted whole-shot comparison described above.
