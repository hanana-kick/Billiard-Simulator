# Four-ball owned active CCD integration

Status: local experimental work, not a published or general-parity claim.

The post-cue outer-step runner is shared with the verified three-ball implementation. It iterates the actual body roster and retains the source CCD pass authority, recurrent BVH, source candidate order, per-pass solve duration, post-solve clamping, one application angular patch, event publication and atomic commit. Four-ball contact preparation and unchanged `FourBallGame` scoring remain separate hooks.

The original-input witness uses engine speed 10, elevation 35 degrees, yaw 2.0743270562430363 degrees and tipX 0.25. The existing controller clamps manual speed to 5; this witness is not advertised as accepted manual UI input. Original bodies and physics settings, including four maximum CCD substeps, are unchanged. No ball velocity/position assignment or future native state is passed into the experimental runtime.

Initial four-ball cloth birth now binds the source transaction's unique edge and generation-bearing lifetime instead of assuming graph index 5/lifetime 6. Cue empty manifold handling reuses the existing branded sphere/cylinder and fixed-hull/cylinder cache modules. Actual rigid cue contacts still fail closed. Recurring births require a same-backend guard, source hull provenance, singleton candidate and source BVTT order verification.

Current evidence:
- Original four-ball creation and source witness contracts: 4 passed.
- Default first application step CPU, actual WGSL and initial rollback: 3 passed.
- CPU initial-only recurrence through 394 application h: four bodies' position, rotation, linear/angular velocity and sleeping state match original values (maximum observed absolute error 0). Events and game state agree. Actual positive clamp at h389 has fraction 0.8679085969924927.
- Actual software WGSL recurrence through 394 h also passed with trajectory maximum error 0. At h388–394, 26 represented caches (four cloth, sixteen cushion, six dynamic pair), graphs, islands and events passed the unchanged tolerance; maximum observed difference was 1.630640666938632e-8, with signed-zero differences recorded separately. This is not bit-identical whole-world proof.
- CPU failure injected after the actual h389 completed CCD slice twice: all public/private state, BVH, game/events/clocks remained unchanged; successful retry recomputed the original positive clamp.
- The same repeated completed-slice rollback passed on actual software WGSL. A separate original-native early-cue comparison at h1/39/40/41/64 verified the empty sphere/cylinder cache birth and persistence with maximum observed difference 0. This fixture contains no empty convex/cylinder cache; only its absence is verified here.
- Full normal-scoring shot: CPU and actual software WGSL each completed 5,480 h through all bodies sleeping, 33 compared state boundaries and eight injected rollback points. Original outcome +1 and selected cue 1 retained matched; two extra terminal calls left the complete state unchanged.
- Full late-opponent-foul shot: CPU and actual software WGSL each completed 5,415 h through all bodies sleeping, 34 compared state boundaries and nine rollback points. Opponent contact after the target goal still produced the original -1 and selected cue 2. Two extra terminal calls were also unchanged. Maximum observed numerical difference across each full-shot run was 2.6770281880139635e-8 within the pre-existing fixed tolerances; no tolerance was relaxed.

- Limited final CPU regression: settled second-cue identity/generation and source clocks passed through 512 h (three state boundaries, two rollbacks, maximum difference 4.590196911458122e-8). This is a prefix check, not a new complete second-shot claim. The existing three-ball original active-CCD replay passed through 400 h, including its original positive clamp at h396.

The full-shot test process uses a 512 MiB V8 heap limit to collect temporary comparison objects rather than allowing a large default heap to grow indefinitely. An initial unrestricted positive-shot test terminated abnormally after h1536; its reporter did not establish the termination signal or cause. The bounded-heap rerun completed normally. This is test-harness resource management, not a measured product memory or hardware-GPU optimization.

Expected-only native references may use the compact assertion-equivalent representation. The original initial seed, provenance and future-state injection negative check are retained. Every compared frame and checkpoint value and their assertion order are identical to the original representation (986,942 positive-shot and 1,015,429 foul-shot ordered assertions); these are comparison operations, not test-case counts. Positive and foul reference byte sizes fell by 65.89% and 65.15%. The actual GPU positive run used the original reference; the foul run used the equivalence-verified compact reference. Runtime source and vendor trees were unchanged between those runs.

Limitations retained: no general complete-world capability; simultaneous coupled dynamic pairs and live-cue active CCD are not admitted. Live-cue reachability within UI bounds has not been disproved. Software WebGPU validation does not measure real GPU or Samsung device performance. The original Rapier application is not replaced by this experimental module.

Source attribution: pinned Rapier/Parry phases and licenses remain in existing vendor/license and experimental module headers. No new physics approximation or outcome-forcing modification is introduced.

Final product regression on this source tree: 308 tests passed with no failures or skips; build and TypeScript checks passed; 24 official UI component snapshots verified. A separate 22-test admission, native-comparator and reference-equivalence contract suite passed. The first contract invocation omitted the explicit CCD source-artifact environment variable and failed one setup-dependent assertion; the corrected invocation reran the entire 22-test suite without source or assertion changes.
