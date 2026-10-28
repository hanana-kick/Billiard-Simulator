# Direct cue component — bounded native feasibility

2026-10-27: the preserved component was completed and executed as direct WGSL,
not an interpreter. One invocation owns one candidate. The original production
CPU default, worker selection, gameplay and UI are untouched.

## Observed result

Nine fresh original PhysicsLab/Rapier prepared call boundaries passed the native
f32 comparison: center, sticking, sliding, lateral spring, persistent shear,
separation, two ordered contacts, zero-clamped normal force, and a rotated
anisotropic shaft. The last case tests real effective inverse inertia, including
off-diagonals, rather than square-root inertia or a linear-only shortcut.
The fixture calls the actual original method with a read-only branch observer;
it does not substitute a copied CPU contact solver as its oracle.

Stable contact creation, obstruction, active state, slip and removal request
match exactly. Maximum absolute differences across this corpus were 2.3842e-6
in linear velocity, 7.1526e-7 in angular velocity, and 4.9607e-11 in shear.
A malformed row does not change its semantic body state or neighboring rows.
Near-contact thresholds explicitly reject rather than claim reliable outcomes.

The a-priori comparison budget (not a proof or full-shot acceptance budget) is
`absolute + 2e-4 * abs(reference)`, with absolute allowances 2e-5 linear,
2e-4 angular, and 2e-8 shear. Application JS Number arithmetic is approximated by
native f32. This is not binary64/bitwise parity; branch guards are local heuristics,
not accumulated trajectory-error bounds.

Why this one-call budget: the linear floor is 0.02 mm/s and the angular floor
is 0.0002 rad/s (about 0.0062 mm/s surface speed at the source ball radius).
The 20 nm shear floor corresponds to 0.008 N at the source tangential stiffness;
over the original 1/61,440 s call this is about 1.3e-7 N s. These small absolute
floors avoid making near-zero cancellation a relative-error test. The 0.02%
relative allowance bounds scale-dependent responses at this application/native
API boundary. It was fixed before comparing the first fixture outputs and is
frozen for holdouts; it cannot be silently loosened to pass. These are engineering
component tolerances, not a derived error bound, perceptual/full-game guarantee,
or permission to accumulate this error over a trajectory.

## Actual costs

See [machine-readable receipt](evidence/direct-cue-component-native.json).
The adapter is **SwiftShader software Vulkan**, not hardware GPU performance.

- Physical shader: 7,159 UTF-8 bytes; compact-output shader: 340 bytes.
- Both pipelines compiled in approximately 325 ms.
- Semantic persistent state: 64 shared bytes + 1,024 bytes per candidate.
- Nine candidates, compact-only: 9,568 allocated WebGPU buffer bytes total,
  144 bytes read back. This includes storage output and readback staging.
- Diagnostic verification: 18,784 allocated bytes, 9,360 readback bytes.
- First diagnostic submission-to-completion: approximately 12 ms; subsequent
  compact-only submission: approximately 0.19 ms. These include dispatch/copies,
  exclude upload/map and compilation, are single tiny observations, and are not
  throughput or hardware benchmarks.

Reported allocations are requested buffer sizes, **not** driver/device total
memory. The entire three-test command completed in under one second. No large
batch, full-rest run, or old host interpreter was launched.

## Scope still missing

Outputs always carry incomplete/physicsScope/null-pass. Cue separation is a
request, not a completed joint/world deletion. Diagnostic full component readback
is optional; normal runner output is 16 bytes per candidate (id/status/pass/reason).

This component has prepared positions, native body properties and cue states.
It is not raw parameter evaluation, a full physical step, a completed shot, or
winning-shot verification. Raw pose/trigonometry/clearance, cue/joint creation,
cloth/cushion/ball contact solving, direct integration/CCD/sleep, chronology and
full rule accumulation remain to join. No winner exists to replay at this stage.
The next bounded gate must compare raw pose and clearance, then one genuine
physical recurrence, before scaling or making any search claim.

## Reproduce without installing dependencies

Use an existing trusted bundled Rapier artifact and existing native WebGPU module:

```sh
DIRECT_CUE_RAPIER_PATH=/absolute/trusted/vendor/rapier.cjs \
GPU_NATIVE_MODULE=/absolute/trusted/webgpu/index.js \
REQUIRE_WEBGPU=1 VK_ICD_FILENAMES=/absolute/approved/icd.json \
DIRECT_CUE_RECEIPT=/tmp/direct-cue-receipt.json \
timeout 60s node --test tests/direct-cue-component.mjs
```

Omit `REQUIRE_WEBGPU=1` for CPU component checks only (native test reports skipped).
No dependencies were installed. Full production build/UI regression tests were
not run in this worktree: installed app dependencies and local bundled engine are
absent; browser execution was already blocked and was not retried. This checkpoint
is not release/publication qualification. No external publication was attempted.
