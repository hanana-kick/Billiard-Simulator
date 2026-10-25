# Authoritative CPU/GPU parity work

This is an experimental engineering contract, not a claim that the GPU implements the complete engine. The public gameplay backend remains unchanged Rapier 0.21.0. Its bundled engine SHA-256 is `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.

## Independent reference

`tools/parity/authoritative-trace.cjs` runs the original `PhysicsLab`, including its actual cue contact, stroke subdivisions, material handling, angular patch resistance, event filtering and game scoring. It does not replace `world.step`, move a ball to a desired outcome, or use a second simplified model as the reference. Each replay creates a fresh world. The preserved initial snapshot is an input for later backend testing, not a stream of CPU answers to inject into the GPU.

The initial fixed cases cover ordinary three-ball and four-ball shots, side spin, elevated cue, blocked corner and elevated corner. A bounded replay that reaches its horizon before rest has no final score. A rejected cue remains rejected. More contact-order, grazing, kiss and whole-shot four-ball foul holdouts are still required.

## Observable checks

`tools/parity/observable-contract.cjs` compares per-step body identity, sleep flags, position, orientation, linear/angular velocity, application-visible event order/timing, strike admission and final game result. Its fixed absolute bounds are 1e-6 metres for position, 1e-6 for quaternion components, 1e-5 metres/second for linear velocity and 1e-4 radians/second for angular velocity. The bounds are declared before GPU replay, not widened to accept failures. Missing or non-finite state fails the check.

Passing these observable checks is necessary but insufficient. PhysicsLab deliberately filters some raw contact events. Native contact manifolds, feature IDs, warmstart impulses, collider ordering, island state, CCD and joint caches must be checked independently using the pinned native snapshot exporter. Full-shot CPU/GPU parity is not certified by a scalar graph self-comparison or a few matching visible trajectories.

## Integration gates still required

1. Restore exact source-derived persistent contact/constraint state from one admitted initial snapshot.
2. Own broadphase pair birth/death, narrowphase manifold lifecycle, warmstart ordering and multi-contact solve on the GPU through time.
3. Integrate free bodies and constrained bodies on the same original step/substep grid, including rolling resistance and sleep/wake state.
4. Preserve actual cue spring contact, shaft geometry, joint lifecycle, CCD and elevated/jumping motion without disabling collisions.
5. Preserve three-ball turns, four-ball opponent prohibition through full rest, goal-time cushion counts and kiss restrictions only until the goal.
6. Validate independent full-shot holdouts with both internal-state and observable checks before enabling GPU gameplay/search. Unsupported states must be explicit; a hidden full-shot CPU execution is not a GPU implementation.

Actual software WebGPU execution is separate from hardware GPU performance. No hardware speedup or Samsung-device result is established by these checks.

## Strict component verification

`npm run test:parity-components` runs the reconstructed native snapshot, original CPU trace, arithmetic, integration, contact, activation and bounded recurrent-contact component tests serially. Set `RAPIER_SNAPSHOT_DECODER` to the verified native decoder executable and `GPU_NATIVE_MODULE` to the installed native WebGPU module. An implementation-specific software driver may also require its normal ICD selection environment. The cue-row diagnostic gate additionally requires `CUE_JOINT_ORACLE` and `CUE_JOINT_PROVENANCE` from the separately instrumented source build described in `tools/experimental-cue-joint-oracle/README.md`; that source observation does not substitute for original WASM world-step verification. The runner requires these files and forces `REQUIRE_WEBGPU=1`: unavailable actual compute cannot be counted as a successful skipped test. Do not disable browser or operating-system security to obtain an adapter.

A passing component suite does not certify the missing complete-world integration gates above. The tested GPU implementation remains experimental and is not selected by the public application. Native software compute establishes shader execution and differential behavior, not hardware GPU speed.
