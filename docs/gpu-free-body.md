# Bounded source free-body integration

Status: independently validated against native snapshots on scalar CPU and actual software WebGPU within the bounded contract below. This is an experimental component, not CPU/GPU engine equivalence and not wired into production physics.

## Source and licensing

Rapier commit `b716d375efc0201003f0cd9ef7168eee0b62c177`, Apache-2.0 (retained in `vendor/RAPIER-LICENSE.txt`):

- `src/pipeline/physics_pipeline/solve.rs:247–260`: energy observation before effective force preparation.
- `src/dynamics/rigid_body_components.rs:388–389,859–863,908–921,1054–1056`: effective mass, damping, linearized integration, effective force.
- `src/dynamics/solver/solver_body.rs:82–120`: world angular velocity and center-of-mass pose gather.
- `src/dynamics/solver/staged_island_solver/worker.rs:67–90,284–310,650–692,970–984`: baked increments, gyro, caps, integration and writeback.
- `src/dynamics/rigid_body.rs:2186–2207`: angular-momentum-preserving explicit gyroscopic correction.
- `src/pipeline/physics_pipeline/substep.rs:135–156`: position commit, collider updates and world mass-property refresh.
- `src/dynamics/integration_parameters.rs:390–395` and `src/utils/mod.rs:131–139`: linear cap and inclusive inverse epsilon.

Parry 0.31.1 `src/mass_properties/mass_properties.rs:240–270` and `src/utils/sdp_matrix.rs:259–275`: reciprocal principal inertia, world COM and symmetric inverse inertia. Scalar quaternion/matrix operations were checked against the audited decoder dependency versions glam 0.33.12 and glamx 0.3.1. The pinned WASM source audit identifies glam 0.33.10 paths; numerical tests against that actual WASM are distinct from reconstructing byte-identical dependencies. The Rust snapshot decoder is used only to inspect/restore independent native snapshots, not to calculate expected trajectories. Its x86 build may select SIMD math; this module ports the scalar path executed by the tested WASM.

Glam is dual MIT/Apache-2.0; this adaptation selects Apache-2.0. Its scalar quaternion and matrix expression order is preserved. Production physics is unchanged.

## Exact state boundary

The standalone recurrent input explicitly asserts a single enabled, awake dynamic sphere, no contacts/joints, no locked axes, no CCD and `canSleep:false`. The stateless integration phase additionally admits `canSleep:true` only with `activationPhase:'source-observed-awake'`, declaring that source activation and the applicable island decision have already left it awake. The standalone tracker does not accept that exception. Phase is `post-activation-pre-solve`. The caller supplies source-prepared mass properties and persistent force state once:

- World linear/angular velocity, body-origin translation and quaternion.
- Local COM, effective inverse mass, current world inverse inertia, principal inertia, inverse principal inertia and principal-axis local quaternion.
- Gravity, gravity scale, persistent user force/torque, linear/angular damping.
- Full dt, substeps (1–16), length unit, normalized linear cap, `allowFastRotation`, and the gyroscopic enable flag.

Every field is required. Unknown activation/topology work is not silently inferred. Only positive finite unlocked mass/inertia is supported. Initial world inertia is authoritative input, not replaced with an idealized diagonal sphere tensor. Subsequent inertia and COM are outputs of the owned arithmetic. The recurrent tracker exposes copies, accepts no per-frame state/pose/velocity inputs, and bounds trajectories to 512 steps.

Output phase is `post-body-writeback`; collider world poses and broad-phase AABBs are explicit downstream effects. This module does not update them. The tracker can re-establish its no-contact stationary topology boundary because it is isolated, not because it implements broad/narrow phase. `canSleep:false` means activation cannot halt the standalone tracker; activation history and island metadata are not outputs here. The separate singleton activation adapter owns sleep transitions and supplies the awake stateless-phase contract when it invokes integration.

## Scalar and GPU execution order

1. Effective mass is Rapier's inclusive epsilon reciprocal of inverse mass: values at or below positive f32 `1e-20` become zero. This differs from Parry's exact-zero principal-inertia reciprocal; principal inertia is explicit initial source state.
2. Compute `userForce + ((gravity * effectiveMass) * gravityScale)`. Torque is persistent user torque.
3. Gather COM pose as body origin plus scalar quaternion rotation of local COM. World angular velocity is copied directly, without an invented inertia gather/scatter.
4. Bake `((worldInverseInertia * torque) * subDt)` and `((force * inverseMass) * subDt)` once. World inverse inertia remains the initial full-step tensor through all substeps.
5. Each substep adds both increments, then performs source gyroscopic correction with the **current integrated quaternion** times principal frame. Preserve the momentum cross product, unary negation, dt multiply, squared norm, ratio/sqrt and zero-momentum branch. Do not simplify isotropic-sphere gyro to unchanged angular velocity: f32 rotation roundoff can change the angular velocity.
6. Cap speed with strict `length > cap` before each pose integration. Angular cap is f32 π/4 multiplied by reciprocal **full dt**, independent of substep count. `allowFastRotation` bypasses it. Normalized linear cap is scaled by length unit, except `Real::MAX` disables scaling/capping.
7. Integrate COM translation and left-multiply the linearized quaternion `[angular*(subDt*0.5),1]`, then normalize with the source scalar sum order.
8. Apply damping once, to final velocities only, using full dt. Position has already integrated the pre-damped solver velocity.
9. Write body-origin pose as COM pose plus rotated negative local COM. Recompute world COM and world inverse inertia using the new body quaternion times principal frame. Matrix columns are scaled before multiplying by the original transpose; retain/mirror the symmetric upper triangle.

`experimental-free-body.js` builds an independent scalar operation graph. It uses the narrow `experimental-arithmetic-graph.js` executor/encoder and `experimental-stage-runtime.js` scalar WGSL interpreter; it never constructs a fake zero contact or invokes contact-island topology/solver construction. CPU stores each node in f32. WGSL executes those same scalar nodes in storage buffers and emits completion plus intermediate stage values. Some arithmetic graphs express unary negation using multiplication by −1. WGSL floating-point arithmetic does not universally guarantee zero-sign preservation; sign-sensitive source paths must use the explicit bitwise `negate` operation. Output arrays canonicalize zero for comparison only.

## Independent tests

Tests complete actual native trajectories before starting either owned tracker. Each frame is an actual native world step with a decoded snapshot, compared against only the tracker's previous outputs. No expected pose, angular velocity, inertia or force is injected into the GPU trajectory.

Prepared first-step comparisons and source/CPU/GPU intermediate-stage comparisons are separately labeled. Initial snapshot fixtures set flags/caps not exposed by the pinned JS API, restore those exact serialized bytes into an independent actual native world, and decode its initial state again before stepping. The deterministic mutations are retained in `setup` in the test file; no expected output is modified.

Cases include isotropic spin, nonidentity quaternion, gravity and persistent force/torque, damping with four substeps, three-substep dt rounding, anisotropic tilted inertia, COM offset, disabled gyro, angular cap and bypass, scaled/disabled linear cap, and strict linear-cap boundaries. All native/CPU/GPU comparisons keep the fixed existing bound `2e-6 * max(1, abs(expected))`; no tolerance fitting or trajectory correction is used.

The full native free-body replay uses the compatible snapshot decoder/exporter and requires both native-bincode and JavaScript typed-tree byte-roundtrip gates. The separate arithmetic runtime command below does not need that decoder.

## Unsupported

Contacts, joints, contact-separated-world topology, island/activation ownership, sleeping bodies, kinematic bodies, locked/singular axes, CCD, extra-iteration solve groups, body/collider/mass changes, forces scheduled after initialization, broad-phase collision discovery and production integration. These are not implemented by this component. A future world caller must establish its no-constraint body boundary and correctly consume downstream metadata; it must not relabel this singleton tracker a full world.

## Arithmetic runtime contract

The arithmetic runtime exports a bounded DAG validator, f32 CPU execution and u32 opcode encoding, with no topology or contacts. Every operation has a named scalar CPU function and corresponding WGSL expression. `choose` selects one scalar branch; inputs, intermediates and outputs must be finite or the runtime fails closed. Source branches choose safe operands before arithmetic (including the disabled MAX cap and zero-effective-mass inverse), so unselected division/overflow is not silently evaluated. Generic `inv` intentionally retains its strict epsilon opcode semantics; the free-body source explicitly builds Rapier's different inclusive mass reciprocal rather than calling that generic opcode.

`shaderForInputFloats(n)` builds the actual GPU storage-buffer interpreter with explicit stride, dependency/output bounds, batch bounds and a per-item completion marker. `WGSL` remains the 136-float compatibility layout, but free-body no longer does textual stride substitution. The shader executes the encoded graph; host code never substitutes a CPU answer. `tests/experimental-arithmetic-graph.cjs` separately checks all 16 opcodes, node-wise f32 rounding, invalid graph rejection and a 35-item actual GPU tail dispatch. These runtime checks are not independent native physics validation.

Full free-body tests require a compatible native snapshot decoder, the unchanged version/hash-pinned native engine, and an actual GPU backend. No missing decoder is replaced by invented expected states.

The runtime rejects sparse input arrays and nonfinite intermediate values, keeps recurrent state private, masks unsafe inactive branches and clears completion markers before every dispatch. These fixed comparisons are tolerance checks, not a promise of bitwise equality on all WebGPU devices.

### Current validation

The complete free-body suite passed 5/5 tests with no skips on 2026-10-24. All 21 fixtures total 596 independent native frames per CPU/GPU backend. Every compared pose, velocity, COM, inverse-inertia and effective-force value had measured maximum absolute error 0 under the fixed `2e-6 * max(1, abs(expected))` criterion. Prepared native first-step comparisons are separate from recurrent trajectories. The native byte-roundtrip gates and initial-only source flag/cap edits were enforced by the decoder.

The narrow arithmetic/runtime suite separately passed 7/7 tests, no skips, in 259 ms. Actual GPU execution covered all 16 opcodes over 35 items, including the partial final workgroup, with measured CPU/GPU difference 0. The appended `signbitSign` opcode occupies index 14, leaves indices 0–13 unchanged, and returns ±1 from the input sign bit, including negative zero. Exact CPU/GPU signed-zero sentinels passed. The appended `negate` opcode at index 15 flips the raw sign bit without altering indices 0–14: actual GPU `negate(+0)` produced `0x80000000` and `negate(-0)` produced `0x00000000`, with exact downstream signbit sentinels. This validates explicit bit preservation, not preservation of zero signs through every ordinary floating-point operation. Three additional nonfinite unused-input cases (NaN, positive infinity, negative infinity) each cleared the per-item completion marker to zero despite reusing a previously successful output buffer. These arithmetic checks compare CPU and GPU implementations, not a separate native physics oracle.

These are measured results for the tested backend and bounded fixtures, not a promise of bitwise equality on all hardware or whole-engine equivalence. The physics fixtures exercise 1, 3, 4 and 12 substeps; the graph accepts up to 16 but native coverage of every count is not claimed. Contact creation/end, collision topology and general world integration remain unsupported here.

Install the published `webgpu` package from the official npm registry in a tooling environment. Set `GPU_NATIVE_MODULE` to that package’s entry module and `VK_ICD_FILENAMES` to your chosen Vulkan driver configuration. A working Dawn software Vulkan adapter can run the narrow suite without the native decoder:

```sh
GPU_NATIVE_MODULE="$GPU_NATIVE_MODULE" \
VK_ICD_FILENAMES="$VK_ICD_FILENAMES" \
REQUIRE_WEBGPU=1 node --test tests/experimental-arithmetic-graph.cjs
```

For the independent native replay, also set `RAPIER_SNAPSHOT_DECODER` to the compiled, source-pinned decoder executable:

```sh
GPU_NATIVE_MODULE="$GPU_NATIVE_MODULE" \
VK_ICD_FILENAMES="$VK_ICD_FILENAMES" \
RAPIER_SNAPSHOT_DECODER="$RAPIER_SNAPSHOT_DECODER" \
REQUIRE_WEBGPU=1 node --test tests/experimental-free-body.cjs
```

### Application-scale coverage

The fixture set includes two 64-frame cases using radius `0.03075`, mass `0.210`, length unit `0.0615` and 12 solver substeps. Their full timesteps are `1/960` and `1/(960*64)` respectively. The actual native collider radius is asserted, not merely labeled in test metadata.

The ordinary-scale case includes gravity, and both cases include linear motion and rotation. They remain contact-free and CCD-disabled, so passing does not establish cloth contact, cue impact, sleep, or full-world parity.

## Prepared enabled-setting boundary

The stateless prepared integrator may retain `canSleep:true` only with `activationPhase:'source-observed-awake'`. It may retain enabled CCD only with `ccdPhase:'source-prediction-inactive'` and the original four-substep CCD setting. These are numerical-stage caller contracts, not proof that an arbitrary caller ran activation or CCD. The trusted lifecycle must actually execute those source checks and reject an active/sleeping transition before committing the integrator output. The strict standalone free-body tracker still rejects these enabled descriptors. No force, gyro, damping, cap or integration arithmetic changes at this boundary.
