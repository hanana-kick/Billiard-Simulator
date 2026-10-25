# Bounded application angular-patch stage

Status: 8/8 original-method/native/GPU, compensated arithmetic and stage-branding tests passed on 2026-10-24 under the fixed numeric criteria below. This is a post-world-step torque component, not a contact solver or full-shot parity claim. Production physics is unchanged.

## Original application contract

`PhysicsLab.angularPatchResistance` in `src/physics.js:213–235` runs after each actual world step and collision-event drain. During cue subdivision, its `h` is the original JS `dt / strokeSubsteps`, not a reread of the rounded native timestep. `src/math.js:4–8` supplies ordinary JS-double vector operations and `Math.hypot`.

The original method traverses objects, primary-collider contact pairs, manifold arrays and point arrays in their existing order. It skips sleeping/non-sphere objects, non-cloth/floor materials, nonpositive sums of positive point impulses, normals with `abs(y) < .95`, and bodies with `abs(linear.y) > .05`. It ignores the callback's `flipped` argument. It does not substitute solver-contact impulses, sort handles or normalize normals.

For each admitted manifold separately:

1. Sum `max(0, point.data.impulse)` in JS double, then cap at `(object.mass * params.gravity) * h`.
2. Read the body's current angular velocity, including prior manifolds' modifications.
3. Compute the normal spin `wn = dot(w, n)`, tangent `t = w - n * wn`, and `wt = Math.hypot(t.x, t.y, t.z)`.
4. Compute stopping inertia `((.4 * object.mass) * object.radius) * object.radius`, then rolling and spinning impulses as the corresponding minimum of material impulse and stopping impulse.
5. Form rolling torque only when `wt > 1e-12`, add spin torque, and invoke `applyTorqueImpulse(torque, false)`, even when the torque is zero.

The stopping inertia is application metadata. It is not substituted for the actual native body's full effective inverse-inertia matrix.

## Precision boundaries

`sourceReference` preserves the original JS-double operations and `Math.hypot`. The original metadata mass, radius, gravity, material lengths and h remain JS Numbers. Only the resulting torque components round to f32 at the native vector constructor; Rapier then applies its f32 symmetric matrix product and angular-velocity addition.

The separately named `stepReference` and actual WGSL stage share an explicit f32 arithmetic graph. This is an approximation of the application arithmetic, not a claim that the original was f32. It rounds metadata and intermediates and evaluates the tangent norm as a scalar f32 sum of squares and square root. Tests compare its effective f32 torque and resulting angular state with the unchanged original application method, rather than replacing the CPU oracle.

The two outer threshold predicates are exact on finite f32 native inputs: `abs(normal.y) > f32(.95)` and `abs(linear.y) < f32(.05)`. The first rounded constant is below its JS-double value; the second is above. Tests include immediate neighboring f32 values and both signs. Retaining the original comparator while merely rounding its constant would change eligibility.

Native torque application follows Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`, `src/dynamics/rigid_body.rs:1482–1489`, and Parry 0.31.1 `src/utils/sdp_matrix.rs`. Each matrix row retains left-associative f32 products/additions, followed by the f32 angular addition. Zero torque does not update native angular state, and `wake_up:false` does not wake the body. Source licenses are retained in `vendor/RAPIER-LICENSE.txt`.

## API and ordering

Each stateless input declares `kind:'ordered-single-manifold-angular-patch'`, `phase:'post-world-step-pre-angular-patch'`, one dynamic body, source eligibility metadata, its current angular/linear velocity and full six-entry symmetric inverse inertia, one unmodified normal, and at most 32 ordered point impulses. Native-origin vectors must be exactly f32-representable. Application metadata remains double until the explicit graph packing boundary.

`sourceReference(input)` is the JS-double source path. `stepReference(input)` is the f32 approximation. `await createGpuStage(device).step(input)` executes actual WGSL and returns only mapped GPU results. Every admitted call reports `requiresModifiedBodyTracking:true`, including zero torque: the native wrapper obtains a mutable body before the arithmetic no-op check. The component reports that downstream requirement but does not mutate a world queue or activation state.

A world caller must process manifolds sequentially, using each preceding result as the body's next angular input. It must preserve native contact graph adjacency and nested manifold/point order. The prepared-contact trackers demonstrate this with owned angular state and unchanged body/application configuration; they accept no per-pass expected velocity. They do not integrate pose, advance time or generate contacts.

Unused skipped-stage operands are masked before arithmetic. Active nonfinite f32 intermediates fail closed. The bound does not silently approximate arbitrary overflow, singular input provenance or changing body/material data.

## Branded lifecycle integration boundary

`createReferencePostWorldStage(constants)` and `createGpuPostWorldStage(device, constants)` create frozen, separately branded stages. `isPostWorldStage(stage, backend)` checks module-private WeakSet membership; copying a stage object or claiming a backend string does not produce a valid brand. Constants are restricted to original cloth metadata and cannot override angular/body inputs. The reference wrapper uses the shared compensated candidate graph, not the independent JS-double oracle. The explicit `createF32PostWorldStage` retains the ordinary f32 candidate for regression diagnostics. `createSourceDoublePostWorldStage` is a separately named CPU diagnostic and never supplies a GPU result.

Each wrapper consumes a lifecycle-owned, solved flat state and returns only angular velocity plus patch metadata. It validates original h/radius/gravity against their native f32 settings and checks the declared single-body inverse mass directly. Pair presence, geometric point presence and stored point impulse are used independently of solver-active status. The wrapper is not itself a recurrent world, and combined-world validation is separate from these component tests.

## Compensated post-world candidate

A whole-world recurrence exposed a precision limitation of the ordinary f32 patch even though its standalone tests passed. On the separated-start spinning fixture, the first effective torque discrepancy was one ULP at zero-based frame 52. Angular velocity first differed at frame 54, quaternion at frame 72, and an inverse-inertia off-diagonal first exceeded the unchanged cache criterion at frame 74: `-0.00006103515625` versus native `-0.0001220703125`. The limit remained `2e-6 * max(1, abs(native))`; it was not widened. A separate 96-frame diagnostic using the exact original JS-double patch, while leaving lifecycle arithmetic unchanged, had zero numeric discrepancy in torque, pose, velocity and inertia. This CPU diagnostic isolates the cause; it is not an accepted GPU fallback.

`stepPreciseReference` and `createGpuPreciseStage` use the shared `experimental-double-single.js` primitives. Two f32 components carry approximately 48 significant bits, not IEEE binary64. The host evaluates only immutable source expressions `(mass * gravity) * h` and `((.4 * mass) * radius) * radius` with their original JS parentheses, then packs these and the original material lengths as `hi = f32(value)`, `lo = f32(value - hi)`. No dynamic torque, native expected velocity or oracle result is computed for the GPU path.

Ordered impulse sums, dot products, tangent construction, a scaled tangent norm, branch comparisons and torque formation execute in the shared compensated graph. The final torque is rounded once to f32 before the unchanged native-order f32 inverse-inertia product and angular addition. Zero denominators in inactive rolling/norm paths are explicitly guarded. The original outer eligibility predicates are retained. Raw GPU zero signs remain unmodified.

The post-world factories select this compensated candidate. Its validation is separate from the earlier standalone f32 measurements below. This is bounded precision, not a general binary64 emulator: Dekker splitting may overflow on extreme values, tiny products may underflow, and nonfinite graph intermediates fail closed. The fixture-specific original-method and recurrent-world gates, not a nominal bit count, determine admission.

## Independent validation and fixed criteria

Tests execute the unchanged `PhysicsLab.prototype.angularPatchResistance` with real pinned Rapier bodies. Explicitly labeled prepared-manifold adapters cover surgical thresholds and ordering. Separate observations use actual full-application cloth manifolds immediately after real steps, with public point ordering checked against losslessly decoded native snapshots. The source and GPU component never import their oracle.

The criteria were fixed before execution:

- Exact outer eligibility and native-wrapper tracking requirement.
- Effective torque error at most `2e-12 + 2e-6 * abs(original f32 torque)` per component.
- Angular error at most `2e-6 * max(1, abs(original native angular velocity))` per component.
- Exact JS-double reference torque and native f32 angular agreement with the original method.
- Separate CPU-f32 versus actual-GPU numeric comparisons, including owned ordered recurrence. Raw sign-bit differences are recorded independently and are not canonicalized.

Reports include maximum absolute errors, ULP distances, non-bit-identical torque counts, eligibility mismatches and arithmetic branch differences. Arithmetic branch expectations are reconstructed from the original vector helpers and the recorded native input, not claimed as instrumented Rust branch observations. Passing numerical tolerances is not bitwise equivalence, nor evidence of complete-shot equality.

## Measured results and signed-zero limit

The unchanged original method and the separate JS-double reference agreed exactly for torque and resulting native angular velocity. Coverage includes 37 prepared scenarios, 8 real full-application post-step cloth observations, and 128 owned patch-only passes with two non-collinear ordered manifolds per pass.

For prepared and real-contact observations, actual GPU versus original native results had maximum effective torque error `1.1368683772161603e-13` (maximum distance 2 ULP) and angular error `1.8189894035458565e-12`. Maximum angular ULP distance was 536,870,912 for near-zero values; this must not be described as bit identity. There were 53 non-bit-identical torque components, including 3 zero-sign differences. Eligibility and reported arithmetic-branch mismatches were zero.

For the 128-pass owned patch recurrence, maximum torque error was `1.7763568394002505e-15` (2 ULP), with 335 non-bit-identical torque components. Angular error and eligibility/arithmetic-branch mismatches were zero. CPU-f32 and GPU numeric results agreed exactly in these fixtures, while their raw zero signs are treated separately.

An all-node trace of pure rolling found its first representation difference at `max(+0, -0)`: CPU bits `0x00000000`, GPU bits `0x80000000`. It found 19 signed-zero intermediate differences and no numeric differences. This is compatible with the [WGSL floating-point rules](https://www.w3.org/TR/WGSL/#floating-point-evaluation), which permit ignoring zero signs; it is not proof of a different nonzero arithmetic order. The raw GPU outputs and recurrent state are retained unchanged. Two independent native worlds restored from the same pre-stage snapshot, then given raw GPU versus CPU-f32 torque differing only in zero signs, produced byte-identical next snapshots. That verifies the observed torque applications only, not arbitrary sign-sensitive downstream algorithms. Contact basis construction with `copysign` must separately preserve and test its raw signs.

All fixed numeric criteria were unchanged. An initial exact representation assertion failed on the zero-sign difference; numeric equivalence and raw-bit identity are now explicitly separate results rather than hiding it by rewriting outputs.

## Compensated validation result

The compensated path passed all 37 prepared scenarios and 8 real post-world-step observations with zero numeric torque/angular error and zero ULP distance against the original method. Five torque components differed only in their raw zero sign; these remain unchanged in the output. The same actual GPU graph also passed 128 owned, ordered two-manifold passes with zero torque/angular error, zero ULP distance and zero bit-differing torque components. Eligibility and reported arithmetic-branch mismatches were zero in both scopes.

The independent [cloth-world composition](gpu-cloth-world.md) passed 1,088 frames per backend with its own generated contacts and impulses. It retains a tiny GPU angular residual and explicitly reports numerical rather than bitwise agreement. The earlier ordinary-f32 failure remains in `tests/experimental-cloth-precision.cjs`, including exact first-divergence raw bits; this separately labeled diagnostic does not replace the full recurrent-world gate.

## Unsupported

Contact discovery, solver impulse generation, island activation, queue mutation, body/shape changes, arbitrary reordering, multiple bodies in one tracker, dynamic material changes, pose/time integration and full application execution on the GPU remain outside this component. Prepared repeated contact records are not a recurrent GPU world. Whole-shot validation requires integrating the stage at the original application's exact ordering boundary.

```sh
GPU_NATIVE_MODULE="$GPU_NATIVE_MODULE" \
VK_ICD_FILENAMES="$VK_ICD_FILENAMES" \
RAPIER_SNAPSHOT_DECODER="$RAPIER_SNAPSHOT_DECODER" \
REQUIRE_WEBGPU=1 node --test tests/experimental-angular-patch.cjs
```
