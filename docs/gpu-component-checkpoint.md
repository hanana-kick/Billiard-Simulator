# Bounded physics component checkpoint

Checkpoint `94a66c7ae49ba02bc3ff654a038ca962aeaaac59` passed the strict serial component suite: 103 tests, zero failures, zero skips, 207.15 seconds. Both pinned native Rapier source oracles and actual WebGPU compute were required. The observed compute adapter was Dawn Vulkan SwiftShader, not physical GPU hardware; this is correctness evidence, not hardware performance evidence.

The suite covers snapshot decoding, shared arithmetic, free bodies, bounded activation, original convex/cylinder contact queries, source joint rows and cue continuation, compensated cue-tip law, angular resistance, owned sphere/floor lifecycles, coupled two-ball/cloth dynamics, and native-enabled CCD predicates and inactive continuation. It retains failed ordinary-f32 precision examples as regression evidence rather than widening the numerical criteria.

This checkpoint is not complete shot parity. Actual TOI processing, general contact topology and island sleep/wake, full original cue approach/compression/separation, and all production initialization/modified-state bookkeeping are not certified by these component tests. Supported domains reject unsupported cases explicitly. Some preparation fixtures begin from one independently generated native snapshot; they are not proof of complete GPU initialization.

The CPU authority remains unchanged PhysicsLab and its pinned Rapier backend. Independent CPU full-shot reference capture exists for eight cases, including successful three/four-ball shots, a four-ball foul and a blocked corner, but those complete trajectories have not yet been matched by the GPU backend. The experimental modules do not replace production gameplay or silently run CPU shots while claiming GPU equivalence.

## Expanded checkpoint

Checkpoint `e477023349808c95cdf48d98ae1b52cd00c5404e` passed 131 strict serial tests, zero failures and zero skips, in 356.42 seconds. It adds original convex projection, four cushion orientations, corner simultaneous contacts, bounded fresh-pair insertion, original-awake admission and a complete cue approach/contact/separation continuation. Actual software WebGPU execution remains mandatory.

The cue continuation fixture is deliberately restricted: it retains the original static table/cloth/cushions and original physics equations, but removes the other two balls, moves the selected ball to x=0.4, and runs 72 additional application settling steps after the constructor's own settling. It is not the unchanged three-ball layout. Its initial condition is one native microstep after strike creation, followed by 445 owned microsteps to separation. A native matrix getter alias in an earlier reference capture was fixed using immediate copying and independently serialized inertia assertions; the invalid reference was not relabeled as passing.

The expanded suite does not certify the original three-ball full scene, first-strike-microstep initialization, arbitrary cue poses, active CCD/TOI, all broad-phase orderings or a full shot through final rest/scoring. Those remain integration requirements. The passing results do not enable an unverified production backend.

## Current runner coverage

The serial component runner now also includes the independently tested created-cue initialization, compensated lateral law, rigid-exclusion guard, cue broad-phase event projection, transactional graph freshness and full-cue graph adapter, prepared pair/cushion handoff, four-cache orientation/corner mapping, and prepared scene split gates. This expands the runner to46 test files; it is not a claim that46 physical worlds or a new aggregate test count have passed. A fresh frozen-source aggregate run is required before reporting an aggregate result for this expansion.

In addition to the pinned native/GPU executable paths, provide explicit `THREE_BALL_CREATION_V8`, `THREE_BALL_SWITCH_REPLAY`, and `THREE_BALL_SPLIT_REPLAY` artifact paths. Replay files require their source-identity/payload-digest `.json` sidecars. Individual tests verify artifact identity and source provenance; the runner's existence checks do not replace those validations. Original-scene trajectory gates run separately through `tools/run-parity-scene.cjs`, so prepared component inputs are not mistaken for full-world recurrence.

The lightweight `tests/parity/component-runner.cjs` tests use a mocked process launcher. They verify admission, required real-GPU configuration, serialization and failure propagation only; they are not additional native/GPU physics results.

## Frozen expanded aggregate result

The exact tree `12ad38d9f14e1f15fcb8a8518aecf3a03fb3791a` passed all 46 test files through the strict runner: 187 tests, 187 passes, no failures or skips, in 600.606 seconds. Both independent pinned native oracles and actual Dawn Vulkan SwiftShader WGSL execution were required. This is software-adapter correctness evidence, not a hardware speed result. The separately documented default full-shot test supplies the limited whole-shot evidence; this component aggregate does not generalize that input domain.

The yaw15 extension and its additional query-termination proof are isolated changes after this frozen aggregate and are not covered by this result. They require their own native/GPU regression and integration verification.
