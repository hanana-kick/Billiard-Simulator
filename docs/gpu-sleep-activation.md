# Singleton activation and free-body integration

Status: 12/12 tests passed against independent pinned-native snapshots and actual Dawn/SwiftShader WebGPU on 2026-10-24. This is not a full island manager or full-world engine.

## Authoritative source

Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `src/dynamics/rigid_body_components.rs:1420–1508`: weak/strong wake, manual sleep, eligibility and dynamic update-energy ordering.
- `src/geometry/contact_pair.rs:389–411`: scalar quaternion/translation pose drift.
- `src/dynamics/rigid_body.rs:915–934,1016–1090`: body sleep zeroes both velocities; velocity setters wake strongly only on a changed value.
- `src/pipeline/physics_pipeline/solve.rs:247–260`: observe energy at pre-solve pose, then prepare effective forces before the island decision.
- `src/dynamics/island_manager/persistent.rs:494–545` and `sleep.rs:81–123`: reduce every member's eligibility, apply the removed-constraint guard, then commit whole-island sleep before solve.

Apache-2.0 notices and `vendor/RAPIER-LICENSE.txt` are retained. The new module uses the same explicit f32 operation graph and actual WGSL runtime as the free-body component.

## Stage contract and exact arithmetic

The stateless stage accepts complete native activation fields, previous sleep pose, current body pose/velocities, maximum extent, length unit and full timestep. Only dynamic bodies are admitted. Missing history is not defaulted to identity or zero. Active calculations must stay within finite f32 arithmetic; genuine active-branch overflow is rejected. Sleeping/command early-return branches mask unused operands before calculation, rather than evaluating irrelevant overflowing expressions. Operations are `update-energy`, `sleep`, `wake-weak`, and `wake-strong`.

For a sleeping body, update-energy pins the timer to time-until-sleep and leaves the previous pose unchanged. For an awake dynamic body, first replace the stored previous pose with the current pre-solve pose. Compute translation norm plus `2 * norm((currentQuaternion * conjugate(previousQuaternion)).xyz) * maxExtent`, retaining scalar operation order. The linear gate is strict: `drift * 0.5 < (normalizedLinearThreshold * lengthUnit) * dt`. There is no separately invented linear-speed threshold.

For positive extent the angular gate is `angularThreshold >= 0 && squaredAngularVelocity < f32(pi/2)^2`. With zero extent it is `squaredAngularVelocity < angularThreshold * abs(angularThreshold)`. Eligible observations add dt to the timer; otherwise the timer resets to zero. Eligibility is timer >= time-until-sleep. Weak wake does not reset the timer; strong wake does. Manual body sleep sets the timer to its threshold and zeroes velocities.

## Three deliberately separate scopes

1. `updateReference` / GPU `createGpuUpdater().updateBatch`: prepared source body-activation stage, not an island decision or world trajectory.
2. `createReferenceStepper` / `createGpuStepper`: retained-test-compatible nonrotating, force-free, one-substep singleton recurrence. Its source linearized integration normalizes the quaternion each awake step. It rejects rotation, force/damping and unsupported speed-cap domains instead of inventing mass properties.
3. `createReferenceFreeBodyStepper` / `createGpuFreeBodyStepper`: singleton connection using complete authoritative mass properties and integration parameters. It observes current pose first, commits singleton sleep if eligible, and runs the source free-body integrator only if still awake. Sleeping steps hold pose/velocity. Each step commits a private draft only after all required stages succeed; a failed integration cannot advance the timer/history while leaving the frame counter unchanged. Public strong-wake and changed-velocity commands use explicit input commands, not expected oracle states.

The connected input starts awake, explicitly identifies one no-contact/no-joint CCD-disabled body, supplies native `maxExtent`, activation and a `freeBody` prepared state. The stateless free-body phase admits `canSleep:true` only with `activationPhase:'source-observed-awake'` and `phase:'post-activation-pre-solve'`. This is an explicit caller phase contract, not proof that an arbitrary external caller ran the island manager. The standalone free-body tracker still refuses `canSleep:true`; the token cannot make it silently integrate sleeping bodies. The connected controller itself owns and produces that phase after its actual scalar/GPU activation observation.

Source force preparation and complete island metadata are not outputs of the activation stage. The free-body stage computes source forces for awake integration; this bounded tracker validates body motion and activation, not every serialized force-cache/manager field when a body commits sleep. A full-world caller must preserve the source force-preparation and island-commit ordering, rather than treating this tracker as a replacement for them.

## Independent validation design

The source-import guard prohibits importing a native oracle into the component. All native scenarios use the fixed `2e-6 * max(1, abs(expected))` comparisons remain.

Separate cases connect rotating sleep/wake motion, application-scale stationary sleep at radius 0.03075/mass 0.210/length unit 0.0615/dt 1/960/12 substeps, and rotating gravitational free flight. Complete native trajectories are collected first using the pinned engine and the byte-roundtrip-gated decoder. Each CPU/GPU controller receives one initial state and then only its own outputs plus the same explicit user commands. Prepared angular one-step tests are labeled separately from recurrence. No native per-frame pose, velocity or expected sleep flag is injected into the tested trajectory.

## Measured validation result

- 11 singleton scenarios, 466 recurrent frames per backend, including initial sleep, strict drift boundary, changed-velocity wake and manual sleep after teleport.
- 3 connected free-body scenarios, 684 recurrent frames per backend. The rotating sleep/wake case first slept at index 31; the 12-substep application-scale case first slept at index 479; gravitational rotation remained awake over all 64 frames.
- 15 separate native prepared angular/quaternion cases, plus 21 CPU/GPU synthetic strict-boundary and command/unused-branch cases.
- All 1,150 recurrent frames per backend had measured maximum absolute activation/body error 0. The fixed acceptance rule remains `2e-6 * max(1, abs(expected))`; this result is not a guarantee of bitwise equality on every GPU architecture.
- All 12 tests passed with no skips, including actual GPU execution, unsupported-state guards, private state ownership, explicit free-body phase-token admission and rollback of a failed integration.

## Unsupported boundaries

Contact islands, membership/order/epoch bookkeeping, modified-body queues, wake propagation across contacts/joints, topology merge/split, collider/broad-phase maintenance, CCD, kinematic bodies and arbitrary mutations remain unsupported. A single body's eligibility must not be used to sleep it independently inside a multi-body island. The general island reduction, removed-constraint split guard and whole-island wake are not implemented here. The connected tracker starts awake; initially sleeping source-state fixtures remain covered only by the narrow legacy singleton tracker.

Use the configured native decoder and actual GPU backend to run:

```sh
GPU_NATIVE_MODULE="$GPU_NATIVE_MODULE" \
VK_ICD_FILENAMES="$VK_ICD_FILENAMES" \
RAPIER_SNAPSHOT_DECODER="$RAPIER_SNAPSHOT_DECODER" \
REQUIRE_WEBGPU=1 node --test tests/experimental-sleep-activation.cjs
```
