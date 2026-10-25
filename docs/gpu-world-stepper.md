# Recurrent sphere/floor world experiment

This implementation is a bounded raw-Rapier subset, not application-level
CPU/GPU parity or a complete shot. The native differential suite passes 5/5,
including actual WGSL.

## Source and execution contract

The Apache-2.0 source port follows Rapier commit
`b716d375efc0201003f0cd9ef7168eee0b62c177` and Parry 0.31.1:

- `geometry/narrow_phase/pair_update.rs`: pre-solve recycle eligibility, fresh
  solver anchors, frozen world lever arms and recycle reference pose.
- `geometry/contact_pair.rs`: relative pose drift and absolute rotation bound.
- Parry `query/contact_manifolds/contact_manifolds_convex_ball.rs`: direct
  component division for normals, sphere-local witness transformation, and
  geometry-only replacement retaining existing single-point impulse caches.
- `dynamics/solver/contact_constraint/contact_with_twist_friction.rs` and
  `contact_constraint_element.rs`: native default Simplified friction, whose
  twist impulse is zero for one point, coupled 2×2 central friction, warmstart
  and separate whole-step normal reporting impulse.
- `dynamics/solver/staged_island_solver/worker.rs`: external-force and gyro
  increments, substep warmstart, biased PGS, pose integration, unbiased relax,
  final restitution, damping and body writeback.

`experimental-arithmetic-graph.js` supplies explicit rounded f32 operations;
`experimental-stage-runtime.js` runs those operations in an actual WGSL compute
pipeline. GPU readback is the sole next-step body, geometry and impulse state.
An initial native snapshot supplies source mass properties and existing caches.
The implementation has no native decoder or world reference. The separate test
oracle steps unchanged native worlds and uses subsequent snapshots only in
assertions. The public recurrent `step()` accepts no per-frame state argument.

## Current admitted domain

Exactly one awake, unlocked dynamic sphere, one identity-rotated fixed cuboid
floor, one existing active contact, zero COM offset, no contact skins, no hooks,
no joints, no CCD, no sleeping, no shape/material edits. The sphere center must
remain over the interior top face. The default friction-in-bias-pass=false branch
is supported. Substeps are bounded to 16; a trajectory to 4096 outer steps.
The gate does not claim broad-phase pair discovery, graph/island topology changes,
contact birth/death/recontact, or any complete-world behavior.

Recycle is rechecked at each new pre-solve pose. Saved reference poses, normals,
anchors and lever arms remain frozen while eligible; reference poses do not creep
forward. Refresh uses the GPU geometry result, never sampled CPU geometry. A
contact/top-face domain departure returns an unsupported status before committing
next state. The existing contact is not forced to remain active.

The application-scale fixture obtains actual radius, body mass, cloth dimensions,
material/combine settings and integration parameters from the unchanged public
`PhysicsLab` constructor. It then builds a controlled single-channel raw world.
This does not implement the application's extra body-pair collider channel,
post-step rolling resistance, compliant cue, sleep or CCD.

## Reproducible tests

Build the source-pinned snapshot decoder as described in
[the decoder guide](rapier-snapshot-decoder.md), then set
`RAPIER_SNAPSHOT_DECODER` to its executable. Run:

```sh
node --test tests/experimental-world-stepper.cjs
```

For actual WebGPU, also set `GPU_NATIVE_MODULE` to the installed official Dawn
Node module and `REQUIRE_WEBGPU=1`. Configure the GPU backend using your selected
platform's official environment settings. A skipped GPU test is not GPU evidence.
The gates compare position, rotation, linear/angular velocity, inverse inertia,
force, contact geometry, anchors, frozen arms, recycle references and warmstart
versus reporting impulses at the unchanged relative tolerance
`2e-6 * max(1, abs(native))`. Diagnostics report horizons and refresh counts.

## Newly verified trajectories

Both the scalar source graph and actual Dawn 0.6.2 / Vulkan SwiftShader compute
ran 144 recurrent outer frames, each compared independently to unchanged native
Rapier. All asserted numeric fields had maximum absolute error **0**, under the
fixed tolerance above. This is numeric equality on these fixtures, not a claim
that an entire GPU world snapshot is byte-identical.

- Resting: 32 frames, native f32 dt `0.008333333767950535`, approximately
  0.266666681 seconds, 4 substeps, 32 recycled steps, no refresh needed.
- Sliding/spinning: 48 frames, the same dt and 4 substeps, approximately
  0.400000021 seconds, 12 full geometry refreshes and 36 recycled steps.
- Actual cloth-scale single-channel subset: 64 frames, native f32 dt
  `0.0010416667209938169`, approximately 0.0666666701 seconds, 12 substeps,
  4 internal PGS iterations, 60 full refreshes and 4 recycled steps. Actual
  application radius is 0.03075 m and mass is 0.210 kg before native f32 storage.

The fixtures also verify an actual native initial contact-start event and no
further contact-event transitions during continuous contact. A mutation sentinel
changes the initial friction warmstart and proves the integrated pose changes.
No native per-frame state or geometry is supplied to either tested recurrence.
The finite horizons do not establish complete-shot parity or contact birth/death.

The native CLI snapshot decoder is currently a test/initialization tool. Browser
product integration needs a separately validated read-only WASM decoder or exact
generated JavaScript schema; this experiment does not secretly step a browser
CPU world to supply GPU state.

## Prepared numerical-phase exports

`validateConfiguration(input)` validates solver structure without admitting a physical step. `validatePrepared(input)` and `stepPreparedReference(input)` retain the original `canSleep:true` and enabled-CCD fields only with the corresponding explicit `source-observed-awake` and `source-prediction-inactive` phase declarations. The arithmetic graph is unchanged. These exports are numerical stages, not independent engine capabilities or evidence that a supplied phase declaration is true.

The trusted lifecycle must own and execute actual activation and pre/post CCD checks before committing any result. The strict standalone `validate` and recurrent factories remain never-sleep/CCD-off even when external callers supply phase strings. This separation prevents a configuration or prepared-stage helper from being mistaken for complete GPU physics admission.
