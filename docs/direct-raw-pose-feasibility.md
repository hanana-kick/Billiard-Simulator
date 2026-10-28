# Raw five-parameter pose gate (not clearance or a physical step)

The direct path now accepts explicitly versioned **32-byte native-f32 rows**:
`id:u32, inputStatus:u32, angle:f32, elevation:f32, speed:f32, tipX:f32,
tipY:f32, reason:u32`. Ordinary input validation/packing happens once on CPU;
original JS Number parameters remain immutable host metadata for comparisons
and eventual winner replay. No pose or forward physics is computed by this packer.
There is no f64 decoder or old interpreter dependency.

One shared 64-byte scene and per-candidate output remain GPU resident. Initialization
is single-use; a repeated diagnostic read neither uploads nor recomputes the state.
The output includes original elevation/tip-offset pose, contact/surface, quaternion,
head/shaft/guide origins, initial cue velocities and all three collider centers.
These are geometry observations, **not** created physical joints/bodies or a shot.

## Local numerical finding, preserved failure

The first native raw-pose comparison failed on SwiftShader builtin sin/cos:
35° angle / 17° elevation gave direction.x `0.7832738161087036` versus original
`0.7833589958104059`, an absolute error of `8.517970170229816e-5`.
The declared budget was and remains `2e-5 + 2e-5 * abs(reference)`.
Compilation/resources succeeded; the numerical comparison did not.

Only this primitive was changed: bounded degree reduction and reflection followed
by native-f32 Horner sine/cosine polynomials. No software binary64, operation graph,
precision framework, CPU pose fallback, or tolerance relaxation was added.
Angles outside ±3,600° are explicitly unsupported; original source validation
accepts any finite angle, so this is a direct-profile limit, not an original error.
Invalid source domains are rejected, and uncertainty near the tip disk boundary
is unsupported rather than a false evaluated miss.

Eight fresh original pose/actual strike geometry observations then passed,
including negative angles, quadrants, 85° elevation and tip offsets. Four invalid
or profile-limited rows were classified distinctly. A separate 296-row frozen-budget holdout (7,400 scalars) also passed, spanning
±3,600°, quadrants and their immediate neighbors, elevations through 85°, and
varied offsets. The largest error was 1.1814e-5 in a near-vertical quaternion
component. See `docs/evidence/direct-raw-pose-grid-native.json`. This bounded
holdout is not proof for arbitrary inputs.

Every valid pose still returns **unsupported/physics scope/null-pass** because
full native direct clearance is not implemented. A later conservative swept-AABB
fast path is described in `direct-clearance-feasibility.md`; it does not turn
these pose-only rows into physical shots. Original CPU clearance observations
are reference-only and never authorize GPU progression. No clearance, joint solve,
world integration/collision, CCD, scoring or winning trajectory is claimed.

See `docs/evidence/direct-raw-pose-native.json` for the bounded software-Vulkan run.
These allocations/times are component observations, not hardware GPU benchmarks.
