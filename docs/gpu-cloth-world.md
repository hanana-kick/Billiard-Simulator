# Bounded cloth-world composition

Status: 4/4 tests passed on 2026-10-24, including 1,088 independent native frames compared with each scalar and actual-GPU owned recurrence under unchanged criteria. This is an isolated dynamic sphere and fixed cloth box with contact lifecycle and application angular-patch resistance. It is not the production scene or full-shot CPU/GPU equivalence.

## Owned time progression

`experimental-cloth-world.js` composes the sphere/floor lifecycle with a once-created, module-branded angular-patch stage. The lifecycle advances its own geometry, contact birth/death, solved impulses, cached anchors, free-flight/contact dynamics and fat AABBs. After that full step, but before committing its private state, the branded stage reads only that just-produced state and writes back the angular velocity for the next step.

The stage receives the current point impulse and normal from the owned world. No native per-frame impulse, pose, velocity or topology is supplied. The scalar backend uses the shared compensated f32-pair candidate graph; the actual GPU backend executes the actual lifecycle and angular-patch kernels. An arbitrary callback cannot claim this path: the angular module brands its reference and GPU factories in separate private WeakSets, and the lifecycle rejects forged or wrong-backend stages.

The original patch inspects geometric point impulses, not whether a contact currently has a solver row. Consequently, the adapter uses `pairPresent` and `pointPresent`, not `topology.active`, to expose the stored impulse. One floor/sphere pair and at most one geometric point are supported here; general contact ordering remains outside this world adapter.

## Application and native precision

Original application `dt`, subdivision count, mass, radius, gravity and resistance lengths remain JS Numbers. Application h is exactly `dt / subdivisions`; it is not replaced by native f32 dt. Admission verifies their corresponding native settings, including native inverse mass `f32(1 / f32(applicationMass))`. The reciprocal is checked directly: computing a public mass from that inverse can introduce another f32 rounding step.

The angular-patch component retains an independent JS-double source reference. This composition uses its compensated f32-pair graph with approximately 48-bit precision, not its ordinary f32 approximation. Original static cap/inertia/material constants are packed as high/low parts; dynamic torque comes from the owned GPU state. This is not IEEE binary64 or a claim of bitwise identity. Raw angular output is not zero-canonicalized. See [the angular-patch precision contract](gpu-angular-patch.md).

## Independent validation design

The oracle creates a real pinned Rapier sphere and cloth box, using the original `PhysicsLab.material` method and application dimensions/materials. Each oracle frame performs the unchanged native `world.step`, drains native collision events, and calls the actual unmodified `PhysicsLab.angularPatchResistance(h)`. Expected states are then decoded from native snapshots. Complete oracle trajectories are collected before either tested tracker starts; each tracker receives one initial state only.

The bounded fixtures use application radius 0.03075, mass 0.210, length unit 0.0615 and 12 solver substeps. They cover separated-start rolling and spinning at application dt 1/960, plus a 64-way subdivision using original h 1/(960×64). Initial contact absence is asserted, rather than pre-warming an existing contact. All three fixtures begin with no native broadphase pair and no geometric contact. The cue-subdivision fixture retains two initialization steps and a gap of 0.0001; its initial pair absence is asserted from the actual source snapshot.

Per-frame body observations use the unchanged global observable contract:

- Position and quaternion components: absolute error at most 1e-6.
- Linear velocity: absolute error at most 1e-5.
- Angular velocity: absolute error at most 1e-4.
- Body identity, sleep flags, contact event order/timing and application motion flags: exact.

Additional impulse/cache/inertia comparisons retain the existing component bound `2e-6 * max(1, abs(nativeValue))`. A fixed horizon is compared in full, including frames after application motion stops. The GPU test is not dispatched unless the scalar/native recurrence first passes.

## Retained precision regression

The ordinary f32 patch failed this suite's original inverse-inertia cache criterion on zero-based spinning frame 74, with `-0.00006103515625` versus `-0.0001220703125`. The fixture, horizon and tolerance are retained. A separately labeled 96-frame exact-JS-double diagnostic removes that discrepancy without changing the lifecycle solver, identifying patch precision as the cause. The compensated candidate subsequently passed the full unchanged 1,088-frame native and actual-GPU suite. The short CPU diagnostic is kept distinct from that acceptance.

## Measured compensated results

All three complete trajectories passed. Scalar versus native maximum position, quaternion, linear velocity, angular velocity and cache/inertia errors were zero. Actual GPU versus native maximum angular error was `7.52316384526264e-37` in the spinning trajectory; all other listed physical maxima and all cache/inertia maxima were zero. This is numerical agreement under the fixed criteria, not a claim of bit-identical state.

- Rolling: 320 frames at h = 1/960, duration 1/3 second, 43 free-flight frames, contact birth at step 44, and 263 applied patch phases.
- Spinning: 256 frames at h = 1/960, duration 4/15 second, 48 free-flight frames, contact birth/death/rebirth at steps 39/43/53, and 203 applied patch phases.
- Subdivided spinning: 512 frames at h = 1/(960×64), duration 1/120 second, 178 free-flight frames, contact birth at step 179, and 104 applied patch phases.

Motion flags, contact events and application time matched exactly in every frame, including the tail after motion-threshold rest. The GPU used its own solved impulses throughout. Forged and wrong-backend post-world stages were rejected.

## Rest and unsupported state

The initial scope is explicitly CCD-disabled and `canSleep:false`. Both native and candidate sleep flags therefore remain false. “Rest” here means the original application's motion predicate becomes false: speed at most .002 m/s and angular speed at most .05 rad/s. This is not a native sleep transition, and the world still advances afterward.

The application torque API reports a required modified-body tracking effect even for zero torque, but this adapter does not serialize native modified-body queues, active-set epochs or island metadata. The native oracle does process those operations; comparing selected physical/cache observations does not establish equality of all hidden state. Contact-island sleep, wake propagation, additional objects, multiple simultaneous pairs, CCD, cue dynamics, game scoring and complete shots remain unsupported.

```sh
GPU_NATIVE_MODULE="$GPU_NATIVE_MODULE" \
VK_ICD_FILENAMES="$VK_ICD_FILENAMES" \
RAPIER_SNAPSHOT_DECODER="$RAPIER_SNAPSHOT_DECODER" \
REQUIRE_WEBGPU=1 node --test tests/experimental-cloth-world.cjs
```
