# GPU physics coverage and remaining integration

The authoritative gameplay engine is the unchanged bundled Rapier engine. The GPU modules are experimental and are not enabled in the public application. These results describe bounded independent component comparisons, not complete CPU/GPU shot equivalence.

## Independently checked components

- Awake free-body integration: 21 fixtures, 596 recurrent frames on each scalar and actual WebGPU backend, including application and cue subdivision timesteps. Compared pose, velocities, mass properties and effective forces had zero measured numeric difference from native replay in these fixtures.
- Singleton activation and free-body integration: 14 scenarios, 1,150 recurrent frames per backend, plus 15 prepared native cases. Sleep/wake decisions and compared body states matched in these scenarios. This does not implement multi-body island activation propagation.
- Static cue/obstacle query: 386 pairs and 1,813 actual shader dispatches. The compared native distances, witnesses and normals matched in these bounded cases.
- Fresh cue/obstacle manifolds: 578 pairs, 1,016 ordered geometric points and 2,590 shader dispatches. Count, order and feature IDs matched, with zero measured numeric error. This includes original native convex topology, not reconstructed meshes. Persistent manifold continuation is a separate gate.
- Continuous single-sphere/fixed-floor world: 144 recurrent frames, including 72 geometry refreshes and 72 recycled steps. The implementation owns subsequent geometry, cached impulses and body state after one initial state import. Compared native state matched. These fixtures begin with contact already present.
- Single-sphere/fixed-floor contact lifecycle: an additional 256 recurrent frames on both backends match native body/cache/broadphase state. The separated-start fixture includes seven contact birth/death/recontact transitions; the initial inactive-pair fixture covers birth followed by settling. Together with continuous contact this is 400 frames per backend, not a general multi-body world.
- Actual cue creation/removal/recreation serialization: eight snapshots passed native and typed byte-roundtrip checks, including reused handle generations. This checks the decoder, not the joint solver.

- Prepared cue-joint rows: 32 fixtures and 168 rows match a separately instrumented pinned source diagnostic. Scalar error was zero; actual WGSL maximum error was approximately `6.10215e-39` under the fixed component criterion. This validates the bounded helper/finalization/one-sweep stage, not original WASM whole-step joint integration.

- Original-WASM isolated cue step: four actual cue poses with nonzero motion/forces, two joints, 12 substeps and the original solve/integrate/relax schedule. Both scalar and actual WGSL matched two body states and ten joint impulses with zero measured numeric, zero-sign or subnormal difference. This is one outer step without contacts or active CCD, not the full cue stroke.
- Two dynamic spheres: 608 recurrent frames per backend, including unequal masses/spin and application-scale oblique collision, near graze and miss. Both bodies, coupled contact state, pair lifecycle, source body ordering and generated tangent-basis decisions matched native state with zero measured numeric difference. Cloth and other concurrent contacts are not included.
- Original application angular patch: actual WGSL and a separately labeled f32 reference were checked against the unchanged JavaScript-double method. Maximum measured torque difference was `1.1368683772161603e-13` (2 ULP); angular difference was `1.8189894035458565e-12`, with no eligibility or arithmetic-branch mismatch under the fixed criteria. Raw signed-zero differences were retained. The observed zero-only torque variants produced byte-identical next native snapshots, but this does not establish general bit equivalence or full-shot equivalence. A 128-pass patch-only recurrence also passed; world-step integration is separate.

The tests use fixed declared numeric criteria and exact discrete-state checks. Zero measured error in a finite fixture set is not a proof of bitwise equality on every device. Actual adapter information reports vendor `google`, architecture `swiftshader`, device `swiftshader-device-subzero-`, description `SwiftShader driver 5.0.0`. This is software compute; no hardware performance result follows.

## Active integration boundaries

Contact birth/death and recontact are checked separately from continuous contact. A two-collider broadphase implementation does not imply support for the general application broadphase or arbitrary multiple-contact ordering.

The actual cue has generic and prismatic joints plus a separate application-level compliant contact law. A spring motor approximation is not a substitute. Original joint rows, impulse order, force hooks, stroke subdivisions, CCD and cue removal must all be independently validated.

Application angular patch resistance is originally JavaScript double arithmetic before native f32 impulses. Replacing it with unchecked f32 arithmetic is not authoritative equivalence. Threshold decisions, manifold callback order, effective impulses and long-run state require separate comparisons.

Before GPU gameplay or search is enabled, complete-world independent shots must also match contact sequences, event timing, three-ball turns, four-ball fouls through rest, goal-time cushion counts and cue obstruction behavior. Unsupported or unconverged validation must remain explicit. A hidden CPU full-shot calculation is not a GPU implementation.
