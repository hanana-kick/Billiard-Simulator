# Four-ball live-cue current pre-CCD source order

HOST/source witness only. The frozen four-macro profile, existing evidence and
all original physics/default source files are unchanged.

## What is actually different

The earlier gap is documented in
`resident-three-ball-second-collision-source.md:60–73`. This file supplies the
previously missing four-ball-specific report, not a replacement for that report.

Pinned Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`:

1. `physics_pipeline/substep.rs:447` detects collisions; `:463` clears the
   modified queues.
2. `:516` calls `update_ccd_active_flags(..., remaining_time, true)` on the
   **current awake chunk**, in its actual order (`ccd_solver.rs:67`,
   `island_manager/manager.rs:272`). It predicts from retained force/torque.
3. `:517–550` joins deferred BVH and selects solve dt; no first-impact search is
   called if all predicates are inactive.
4. `:568–580` interpolates kinematics then enters islands/energy/force/solve.

In contrast, `world-h.mjs:137–140` checks cue/entry-awake balls before collision.
`:158` checks newly awake balls after energy; `world-ccd.mjs:81–100` reads new
force/torque for this second check. This chronology is not generally proved
source equivalent. Pure early checks can commute only when membership and every
predicate input relevant to the admitted branch are preserved. Two false answers
alone are not sufficient proof.

## Authentic narrow witness: no demonstrated regression

New `tests/resident-candidate-four-preccd-source-order-witness.mjs` creates the
same independently authenticated prestrike and ORIGINAL accepted row219 controls:
angle310, elevation85, speed4.5, tipX0.2, tipY−0.1. It runs original PhysicsLab
continuously, transparently recording native pre/post snapshots at
**h2,128,164,165,192,193**, then stops before h194. No future bank, scalar VM,
velocity/pose setter, modified dt, or invented scene enters that run.

The already-built hash-pinned read-only source observer replays each actual
preWorld snapshot. At all six boundaries:

- observed and independently unobserved source post bytes agree;
- that native source replay's entire post-snapshot SHA agrees with the actual
  untouched WASM world-step snapshot SHA;
- every awake body's **all64 packed input words and all11 original graph output
  words** agree between entry, current pre-energy, and post-energy;
- all original pre predicates and the actual source `ccd_active` flags are false;
- native solve dt remains the full inner h, f32 word **931694729**;
- there is no collision-only wake or energy sleep/reordering in these snapshots.

The actual order is shaft22:g3 → head20:g3. At h165, selected17:g0 is appended.
Immediately before native user-change drain, the awake chunk still contains only
the cue, while selected17:g0 already has `sleeping=false` from original tip API.
The entry gate is **after** this drain, so treating that stale preWorld chunk as
its membership would falsely report a collision wake. This witness checks body
activation membership and preserves actual chunk order separately.

At h165/192/193 the selected retained and computed force is exactly
`[0,-2.0601000785827637,0]`; torque is exactly zero. Cue force/torque are zero.
The comparison checks words, including signed zero; tests mutate one force word
while the predicate remains inactive and require rejection.

**This does not invalidate the frozen raw-to-h192 projection.** It also does not
prove all h1–193, arbitrary shots, collision-woken bodies, active CCD, full rest,
complete engine-memory equivalence of a resident bank, or release qualification.
No numerical/GPU performance claim follows.

## Honest observation boundary

The existing source hook is immediately after
`islands.persistent.run_pending_split(bodies)` in `solve.rs:190`, before the new
energy/force traversal. It is **not** a new directly observed pre-CCD hook.
For these snapshots the intervening source preserves the predicate projection:

- `interpolate_kinematic_velocities` writes velocity only for
  `KinematicPositionBased`; the complete observed registry has only Dynamic/Fixed.
- `resolve_removals` / `run_pending_split` operate on persistent connectivity.
  Their body writes are `ids.island_id` / `ids.island_index`, not awake-chunk
  membership, activation, pose, velocity, force, inertia or extent.
- the actual observed pre-energy dt equals entry dt; all current source flags
  are inactive, and the source branch does not perform a TOI query.

Those properties plus exact original input/output checks justify this limited
projection. They do not relabel the hook as an internal pre-CCD capture.

Probe binary SHA:
`86dca271e2dee02b417b75f1ac9c406cffe0f2b0a184be0d6262362f6f114e84`.
The test checks its build provenance, capture/host/restoration source hashes,
original source revision, roundtrip, and observed/unobserved identity.
Local full capture: `/tmp/resident-four-preccd-witness-v1/capture.v8`.
Committed compact evidence: `docs/evidence/resident-four-preccd-source-order.json`.

## A genuine opt-in repair: required owner boundary

A second late checker is not a repair. A distinct profile must remove BOTH early
cue and ball checks, then after `narrow-commit` and before `energy-begin`:

1. capture the exact current scene awake chunk (all four balls plus shaft/head),
   immutable handles/generations, epoch and complete collision receipt;
2. gather retained force/torque and registered COM/extent/thickness from the
   current device-owned bank, preserving source order;
3. evaluate the unchanged original pre graph in that order; active CCD remains
   explicit unsupported for live cue, not a false miss;
4. only after complete all-inactive proof authorize full solve dt;
5. after energy, reject any awake role absent from the checked mask; do not
   substitute a new-force prediction;
6. preserve old pre-pose rows needed by ball/cue post-CCD and the existing
   adapter lifecycle expected by solver/post/next-h owners.

`native-current-pre-ccd.mjs` provides source gather/order groundwork but is not
four-ball admission by itself. Four-ball needs a separate branded shape/lifecycle
caller, six-role order storage (the three-ball order17..21 overlaps header22 for
six roles), and source-owner routing for its numerical request. No such repair is
claimed or activated by this witness.

Reproduce (HOST only):

```
node --test tests/resident-candidate-four-preccd-source-order.mjs
node tests/resident-candidate-four-preccd-source-order-witness.mjs /tmp/NEW-DIRECTORY
```

Missing original fixture or pinned observer is a failure, not silently generated
expectations or a reported pass. No new native probe build is needed.

A later separately named schedule/component implementation is documented in
`resident-four-current-pre-ccd-profile.md`. It is not a qualification upgrade to
this six-boundary witness or to the frozen default profile.
