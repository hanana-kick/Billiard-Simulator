# Experimental cue joint row stage

## Supported endpoint

`experimental-cue-joint.js` implements a **prepared scalar joint-row operation**, not a world step. The CPU reference and actual WGSL graph use identical f32 operation order for:

- `JointConstraintHelper::new`, including free-axis application-point adjustment, quaternion-derivative angular basis, and sign correction.
- The actual cue flex's four rows: AngX, AngY, AngZ, LinX.
- The actual guide's six rows: AngX, AngY, AngZ, LinY, LinZ, LinX limit.
- Native modified Gram–Schmidt finalization, effective mass and CFM.
- Explicit impulse seeding, optional warmstart application, and a bounded number of ordered row sweeps.

The guide retains native infinite/zero impulse bounds. Infinity is represented as exact bound metadata and conditional clamping, not replaced with a finite force cap. Locked rows retain ±f32::MAX. `simd_inv` uses the source's strict ±1e-20 condition. Each arithmetic node rounds to f32. No native row result is a GPU input.

The endpoint consumes explicit prepared world joint frames, COM positions, inverse masses/inertia, internal substep dt, ERP/CFM, velocities and optional accumulated impulses. It does **not** infer a whole-engine phase from those values. The optional warmstart operation applies each row's native warmstart method before the requested sweeps; scheduling that operation into the engine's fused warmstart/first-pass loop is a separate task.

Unsupported inputs fail closed: motors/coupling or other masks, non-finite state, non-unit frame quaternions, negative inverse masses, unordered limits, more than eight sweeps, and relative quaternion hemisphere ties (absolute quaternion dot below 1e-7). The latter is a declared graph capability restriction, not a relaxed comparison tolerance.

## Actual cue descriptors and source

PhysicsLab creates a dynamic shaft, dynamic head and fixed guide. The flex mask is 57, with local +Y requested as the joint axis; native `GenericJoint::complete_ang_frame` maps the joint's X axis to that body-local Y. The prismatic mask is 62, with LinX limits [-0.08, 0.13]. Neither joint has motors. Lateral cue compliance is a separate application impulse hook and is not replaced by a motor here.

`experimental-cue-joint-snapshot.js` reads the original serialized body/joint descriptors only after pinned engine identity, native and independent typed byte roundtrips, and unchanged-tree SHA256 verification. Body and joint index/generation, body order, masks, enable/contact flags and guide limits are checked. Masses, COM offsets, inverse inertia and local-frame f32 values come from native initial state, not nominal decimal reconstruction. This is a host diagnostic export, not a per-frame native state feed or a browser transport.

Source-derived frame lowering subtracts local COM on dynamic sides and makes fixed-side frames world-space. Solver COM poses use the original scalar quaternion transform. The effective inverse inertia field is the actual inverse tensor despite a stale source comment referring to a square root. ERP/CFM use the explicitly supplied internal solver substep dt. PhysicsLab's ordinary cue world timestep is lab.dt/64, and the default 12 solver substeps divide that again; one row sweep is not one `world.step`.

Pinned Rapier revision: b716d375efc0201003f0cd9ef7168eee0b62c177 (Rust 0.36.0, bundled JS 0.21.0). Relevant source files:

- `dynamics/solver/joint_constraint/joint_constraint_helper.rs`: helper geometry, locks, limit and finalization.
- `dynamics/solver/joint_constraint/joint_velocity_constraint.rs`: scalar row order and row solve/warmstart.
- `dynamics/solver/joint_constraint/joint_constraint_builder.rs`: frame lowering and impulse seeding.
- `dynamics/joint/generic_joint.rs`, `dynamics/solver/solver_body.rs`.
- `utils/rotation_ops.rs`, `utils/angular_inertia_ops.rs`, `utils/mod.rs`.
- `dynamics/integration_parameters.rs` and `dynamics/solver/staged_island_solver/`.

The two actual cue joints remain below the source's 64-joint SIMD-color threshold. SIMD batching has a different row order and is not supported by this endpoint. Apache-2.0 attribution is retained; glam quaternion/matrix operations retain MIT/Apache-2.0 attribution.

## Independent validation and its limit

Original WASM snapshots do not serialize Jacobian rows. The row oracle is therefore explicitly an **instrumented pinned Rust diagnostic**, not the original WASM engine. A separately copied source tree adds one observation module and two append-only re-exports. It calls the unchanged original helper, row builders, finalizer, warmstart and solve methods. The original algorithm files, source archive and authoritative snapshot decoder are not modified.

`tools/experimental-cue-joint-oracle` verifies official archive hashes, copied files, observation patch, host, compiler and binary provenance. The successful diagnostic patch SHA256 is 331aafdca00e238bba19ec6a2b9141483ece6dc1ca75ed100d79e05fdf5650e2; diagnostic revision is cue-joint-observation-v1+331aafdca00e238b. These identities are checked when running the oracle.

Current focused gate: **4/4 tests, no skips**. Original native cue creation/removal/recreation gives eight byte-identical native/typed snapshot roundtrips, including reused handle generations. Four actual aim/elevation poses supply 32 prepared fixtures and 168 rows, including displaced anchors, relative velocities, nonzero warmstart seeds, and lower/upper guide violations. All helper matrices, ordered row IDs, bounds, coefficients, impulses and resulting velocities are compared. CPU diagnostic maximum error is 0; actual Dawn/SwiftShader WGSL maximum is 6.102148943388957e-39 (subnormal arithmetic). The fixed absolute component tolerance is 3e-6. This is a software Vulkan execution result, not a hardware speed claim.

## Not complete

The prepared row endpoint alone does not establish original-WASM whole-step parity. A separate bounded isolated recurrence is validated below. Neither endpoint supplies general island scheduling, contact interaction, compliant-tip forces, persistent continuation, CCD or complete cue clearance.

## Validated isolated one-outer-step recurrence

`experimental-cue-joint-stepper.js` now adds a separately bounded **original-WASM one-outer-step gate**, rather than treating the diagnostic row test as whole-step evidence. It accepts an isolated actual cue with exactly three bodies, the original shaft/head colliders and collider-free fixed guide, and the two actual joint descriptors. Source snapshots must pass the same native/typed roundtrip and generation checks. The unrelated table/ball bodies are removed only in this test fixture; production physics is unchanged. No compliant-tip hook or contact force is synthesized.

The complete graph executes 12 solver substeps. Each substep applies original external-force increments and gyroscopic correction, rebuilds the actual four/six rows, performs four biased PGS passes, applies source velocity caps and linearized pose integration, then performs one unbiased relaxation pass using the same rows. Joint warmstarting is off, matching PhysicsLab's native default. Source graph coloring puts dynamic flex before fixed-side guide in this contact-free two-joint world. The final stage applies damping, converts COM poses back to body origins, and emits the original ten ordered row impulses. No native output is injected during the recurrence.

The current four independently created native fixtures use actual aim/elevation poses (0/0, 23/37, 180/7, 310/85), nonzero relative linear/angular velocity, external force/torque and small initial anchor displacement. For each, the independent original bundled WASM world executes one ordinary cue outer timestep, lab.dt/64, using its unchanged 12/4/1 solver settings. Both dynamic body translations, rotations, linear/angular velocities, and all ten joint impulses are compared. The CPU and actual Dawn/SwiftShader WGSL recurrence both have measured maximum error **0**. The 72,346-node graph executes on the GPU and is read back; this is not a CPU-labelled GPU result. Native contact count zero and native CCD inactive are asserted. Fixed gates are 3e-6 for body components and 2e-6 for impulses.

This establishes one outer step for an **isolated, contact-free cue**, not a full shot. General persistent joint/layout continuation, additional islands/constraints, warmstarted world scheduling, CCD impacts, active table/ball contacts, compliant-tip forces and whole-world integration remain unsupported. A narrow single-initial-state continuation is measured separately below. The earlier diagnostic row gate's nonzero subnormal maximum remains reported separately; this original-WASM recurrence gate does not replace that result.

Final combined row plus one-step gate: **7/7 tests, no skips**. The one-step body/impulse comparison reports zero raw signed-zero differences and zero subnormal differences on both CPU and actual WGSL. Those counts apply to the compared one-step outputs, not every intermediate operation or the separate prepared-row gate.

## Single-snapshot own-state continuation

The isolated cue controller now advances from one initial snapshot without accepting per-frame external state. It retains its own body poses/velocities and joint impulses, and the graph recomputes source world inverse inertia after each outer step for the next step. `step(...)` rejects all arguments; inspection returns a copy, not a writable view into the controller.

Current continuation gate: **2/2 tests, no skips**, four actual cue poses × 32 ordinary native `world.step` calls. CPU and actual WGSL each compare 128 states against the independently running original WASM world, including both bodies' pose/velocities/world inverse inertia and all ten active joint impulses at every step. Maximum numeric error, raw signed-zero differences and subnormal differences are all **0** for both backends. Contact count remains zero and native CCD remains inactive. The same fixed 3e-6 body/tensor and 2e-6 impulse gates are retained.

Time is explicit: each native world step uses h=lab.dt/64. At the default lab.dt=1/960 seconds, 32 such steps cover about **0.520833 ms**, not 32 application ticks or rendered frames. The API limits a controller to 64 steps, but this checkpoint measures 32. General persistent joint/layout continuation is not claimed: this is the unchanged two-joint, three-body contact-free configuration, with default joint warmstarting disabled. Compliant-tip contact and full-shot time coverage remain separate.
