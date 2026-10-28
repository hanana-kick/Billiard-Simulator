# Current deterministic GPU-canonical continuation

The later GPU-first integer profile and CPU mirror are documented in
[deterministic q-state continuation](deterministic-q-continuation.md). Its
acceptance target is identical CPU/GPU program results plus independent physical
validation, not equality with historical Rapier output. The native-f32 component
notes below describe the earlier feasibility slice, not this newer ABI.

# Direct parameter-parallel correction

The old resident source interpreter is frozen as diagnostic evidence, not the
production architecture. Its private engine-layout, bytecode call stack and
full-bank equality are not requirements of the user's candidate evaluation API.
The production CPU backend and existing numerical gates remain unchanged.

## Required execution shape

Upload one immutable real table/material/initial-ball scene and N independent
five-parameter rows. One GPU invocation owns one candidate's physical progression;
candidates never share mutable state. Native direct WGSL functions implement the
physical phases, with bounded ordinary loops and a small per-candidate lifecycle
state. Coarse phase kernels are acceptable where a complete direct kernel exceeds
compiler limits; there is no bytecode dispatch, per-arithmetic-node kernel, or
CPU choice of next physical state. Keep state resident across bounded chunks,
return only id/status/pass/reason, and replay only already verified winners.

Keep current source contact/friction/restitution, compliant cue and joint laws,
spin/rolling torque, CCD, sleep/rest, ordering and game semantics. Static geometry
is shared. Bodies, active contacts, warm impulses, cue deformation, CCD progress,
sleep counters and rule accumulators are candidate-local. Allocator slabs,
generations, unrelated native heap bytes, full trajectories and debug tapes are
not automatically replicated. Removing a representation must not remove its
physical effect or change observable contact ordering without explicit analysis.
A small deterministic potential-pair list may replace the BVH for this fixed
scene only after showing the same physical candidates/order; it is not permission
to omit cushion, floor, cue or ball contacts.

## Reuse, without reusing the interpreter

- `physics.js:143-209`: original pose/strike construction and complete lateral,
  Kelvin–Voigt normal, tangential memory/Coulomb slip and equal/opposite impulses.
  The two cue bodies and guide/joints are real, not an assigned ball velocity.
- `experimental-coupled-contact-math.js:47-89`, and the named equations in
  `resident-candidate/coupled-solver.mjs`: contact preparation, force/gyro,
  warmstarting, biased/stabilization/restitution solves and integration. Reuse
  equations and source iteration/contact order, not graph program execution.
- `experimental-ccd-proxy-distance-kernel.js`, `experimental-convex-point.js`,
  `experimental-cue-epa-core.js`: existing direct WGSL geometry. Rebind to compact
  semantic records; retain limits and explicit nonconvergence, not false misses.
- `experimental-world-stepper.js`, `experimental-cloth-island-world.js`,
  `experimental-cushion-roster-world.js`: source floor/pair/convex contact/cache
  equations. Their old prepared-stage wrappers are not complete worlds.
- `physics.js:213-275`, `game-rules.js`, `route-rules.js`,
  `resident-candidate/physical-rules.mjs`: angular resistance, source chronology,
  rule state, late-foul and full-rest requirements. The direct discrete reducer
  is reusable; its currently exact binary64 producer contract is not silently
  changed by adopting native-f32 application arithmetic.
- The corrected direct profile uses versioned 32-byte native-f32 raw rows packed
  once on CPU, preserving original JS parameters as host reference/replay metadata.
  The old 64-byte f64 transport is not a constraint on direct execution. Preserve
  16-byte compact result semantics, explicit rejection,
  unsupported/incomplete/cancelled/device-lost states and separate inverse
  observations. Reuse lifecycle/protocol tests, not obsolete allocation sizes.

Do not reuse `microcode-*`, graph/Number-program interpreters, source-PC pumps,
engine allocator mirrors, per-owner diagnostic byte banks, or full-state readback
as the execution engine. Licenses/provenance of reused equations remain attached.

## First bounded physical slice

`src/direct-candidate/` starts with complete compliant-tip **application only**:
lateral spring/damping, all four ordered sphere contacts, normal compliance,
persistent shear/slip, native impulse-at-point updates and separation request.
It takes explicitly prepared component t0 inputs, not falsely labeled raw shots.
No ball velocity/spin target is assigned. Its source-semantic body/tangent bank is
1,024 bytes per candidate plus 64 shared material bytes. This is measured from
the new layout, **not a complete-world memory or device-memory claim**.

Missing joins remain explicit: raw pose/trig/clearance and actual cue creation,
guide/flex joint solve, ball/cloth/cushion contacts, integration/CCD/sleep, outer
clock, full rule/event history and final result. The component always lacks PASS
or MISS authority. It is a short compiler/data-layout feasibility step toward
that whole path, not a new general emulation framework.

## Numerical and acceptance boundary

The new feasibility profile uses native WGSL f32. Native Rapier body/API values
are already f32; original application JS Number arithmetic is now a declared
approximation. Do not call this bit-identical, replace it with old ~48-bit
wrappers as oracle, or silently return to software-f64 emulation. Compare original
PhysicsLab observables with an a-priori scale-aware error budget, exact stable
contact/slip/removal classifications and explicit near-threshold uncertainty.
Any demonstrated need for extra precision must be localized before adoption.

First: source/ABI tests and a few fresh original CPU component observations;
record numerical errors, bytes and shader size. Then structural review and one
tiny native compile/run with actual candidate isolation. Stop that feasibility
attempt on compiler/resource failure rather than blind retries. Next build one
real raw-input whole physical step/short recurrence, then actual impact and
terminal shots, mixed batches and intended scale. No long interpreter jobs,
full-rest launch, production selection or speed claims are authorized by this
component checkpoint alone. Observable trajectory/event/rest/scoring comparison,
not private native memory identity, is the new physical acceptance boundary.
