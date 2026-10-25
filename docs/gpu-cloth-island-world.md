# Bounded two-ball cloth island

`experimental-cloth-island-world.js` connects two dynamic spheres and their
simultaneous contacts with a fixed cuboid's top face. It is an experimental
source-derived solver, not a general world implementation or complete shot.

The state starts from one independently exported native snapshot. Subsequent
broad-phase pair admission, geometry, frozen anchors and lever arms, warm caches,
velocities, poses and inverse inertia come only from the candidate's own state.
The reference backend evaluates the same f32 graph as the actual WGSL backend.
Native post-step snapshots are test assertions, never next-step inputs.

## Shared solve order

The implementation follows Rapier commit
`b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `geometry/narrow_phase/mod.rs::assign_pair_solver_color` assigns the first
  dynamic/dynamic edge color 0 and each disjoint dynamic/fixed edge color 127.
- `dynamics/solver/solver_contact_graph.rs::buckets` visits colors ascending.
- `dynamics/solver/staged_island_solver/worker.rs` performs each source substep's
  force update, color-ordered constraint update and warmstart, PGS passes, pose
  integration and relaxation. End-of-step restitution follows the same ordering.
- `contact_constraint/contact_with_coulomb_friction.rs` and its element routines
  supply the one-point Simplified friction constraints and impulse writeback.

All three constraints modify the same two velocity records within each pass.
This is not a sequence of independent pair-world simulations. Each contact keeps
its own effective material coefficients, geometry reference poses, anchors,
world-frozen lever arms, reporting impulse and final-substep warm impulse.
The fixed floor does not introduce a dynamic solver body or merge disconnected
bodies through a fictitious moving floor.

The five collider channels are the original PhysicsLab floor, two primary ball
colliders and two additional massless pair colliders. The primary channels see
only the environment; the pair channels see one another. Material combination
is Multiply. Pair coefficients are the native f32 values of the original square
root coefficients, multiplied in f32, not the original double parameter used as
an assumed already-combined value.

The controlled fixture executes the original public `PhysicsLab.fixedBox`,
`addSphere` and `material` methods. Its candidate world begins after 34 native
preparation steps: 33 floor-settling steps and one approach step that drains
initial velocity-edit notifications. There is no ball/ball impact during this
preparation and none is erased or replayed. The following trajectory starts
from exactly that one snapshot.

## Explicit limits

Only the three channel-permitted pair possibilities exist in this bounded
fixture. Identically posed duplicate sphere colliders have equal native fat
AABBs, which is checked initially and in the native test oracle. Pair birth and
death use the candidate's own proxy overlap and source sphere/sphere geometry;
there is no general BVH implementation. Both existing floor contacts must remain
on the admitted top face and solver-active. Floor contact loss returns an
explicit unsupported result before committing the candidate state.

Both dynamic bodies are awake and never-sleep. CCD is explicitly disabled for
this experiment. Original application CCD-enabled behavior, island sleep,
custom post-world angular resistance, cushions, cue joints, arbitrary changes,
more bodies and a complete shot are not covered. The bounded horizon is 4096
outer steps. The initial native snapshot exporter is a Node/native test tool,
not a browser admission implementation.

Source notices remain in `vendor/RAPIER-LICENSE.txt` and the official glam/glamx
MIT and Apache license files. See the separate sphere-pair and sphere/floor
component documents for their source operation-sequence constraints.

## Validation status

`tests/experimental-cloth-island-world.cjs` passes 3/3 tests with no skips
under the strict actual-WebGPU configuration. Each backend independently
advances 224 outer steps from the initial snapshot. The observed maximum
absolute error is 0 for all asserted body, force, contact/cache, proxy and event
fields; the fixed acceptance gate remains `2e-6 * max(1, abs(native))`.

Both fixtures use the original application radius 0.03075 m, mass 0.210 kg,
native f32 dt `0.0010416667209938169` and 12 solver substeps with four PGS
iterations. Their 34-step initial preparation is approximately
0.035416668514 seconds, separate from the measured horizon.

- Head-on: 96 steps, approximately 0.100000005215 seconds. Ball contact starts
  at frame 18 and ends at frame 22; four frames have all three active contacts.
  Peak ball reporting normal impulse is 0.18734011054039001. Floor contacts
  refresh 78 and 78 times.
- Oblique/spinning: 128 steps, approximately 0.133333340287 seconds. Ball contact
  starts at frame 19 and ends at frame 23; four frames have all three active
  contacts. Peak ball reporting normal impulse is 0.18200063705444336. Floor
  contacts refresh 128 and 124 times.

The test verifies native primary/pair groups, exact source material combine
rules and coefficients, zero pair-collider mass, initial/local collider poses,
awake body IDs, floor color 127 and active pair color 0. It compares both bodies'
complete numeric state after every step and all available point/solver cache
fields independently for the ball pair and each floor contact. The initial
collision is not prepared by native warm-up. These short horizons establish
coupled approach/impact/separation in this subset, not a complete shot or
browser product integration.

The optional `createReferenceStepperWithPostStep` and
`createGpuStepperWithPostStep` factories borrow exactly two branded angular
stages. Their own-state-only angular writeback occurs after the shared solve and
post-solve proxy update. These opt-in paths are validated separately by the
coupled angular-law adapter; the result above describes the unchanged default
no-law path.
