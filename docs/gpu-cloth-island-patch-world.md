# Coupled cloth island with application angular resistance

This opt-in adapter composes the three-contact source island with the original
`PhysicsLab.angularPatchResistance` phase. It does not replace the shared solver
with independent pair worlds. All ball/ball and ball/cloth constraints finish
first; each ball then receives its own angular-patch result before that state is
committed as the next outer-step input.

`experimental-cloth-island-world.js` accepts only two matching-backend branded
post-world stages created by `experimental-angular-patch.js`. Their immutable
constants preserve the original JavaScript Number mass, radius, gravity,
application dt and resistance lengths. No native f32 body-mass getter is used as
a substitute for the original application mass. The original double `h` is
`application.dt / application.subdivisions`, separately checked against the
native f32 solver dt.

Each stage reads only the candidate's own solved body, complete inverse inertia,
floor normal and reporting point impulse. It can return only finite f32 angular
velocity and explicit metadata. It cannot replace position, linear velocity or
contact caches. The existing default no-post-law factories remain unchanged.
The ball/ball material is excluded by the original application law; each ball
has exactly one eligible floor manifold in the supported domain.

The independent native test executes the unchanged public
`PhysicsLab.angularPatchResistance(h)` after every native world step. It records
actual torque API invocation counts, including eligible zero torques, and
compares them exactly against the candidate's modified-body tracking marker.
No native per-step state or impulse is supplied to the candidate.

The application source uses JS-double arithmetic. Its actual GPU stage uses compensated two-f32 arithmetic with separate
source-reference tests, not a general claim of bit-identical JavaScript
arithmetic. Coupled trajectory gates are unchanged from
the no-law island: `2e-6 * max(1, abs(native))` on all numeric body/cache fields,
exact event and branch comparisons. A mismatch is a failure, not a reason to
quantize CPU constants or loosen the gate.

The native modified-body queue and island epochs caused by public torque calls
are not serialized by this adapter. Both balls remain awake and never-sleep;
the supported two-ball graph has fixed floor constraints and the separately
ported ball-contact lifecycle. Active CCD, native sleep, floor-contact loss, cushions,
cue joints and complete shots are not supported. Native initial-state export is
currently a Node test tool, not browser admission. Motion-threshold reporting,
when used, is not native sleep.

The prepared composed fixture retains original CCD enabled/max4 and uses the
source inactive-only checks before and after each shared solve.

The dedicated strict actual-GPU gate passes 3/3 tests without skips. Both CPU
reference and WGSL independently advance 224 frames, with maximum observed
absolute error 0 across every asserted body, cache, proxy and native `ccd_vels`
field. Exact original public-law API invocation counts are 96/96 calls for the
two head-on bodies and 128/128 calls for the oblique/spinning bodies.

Head-on advances 96 frames (0.1 seconds of original JS application time), with
ball contact start/end at frames 18/22 and peak reporting impulse
0.18734011054039001. Oblique/spin advances 128 frames (approximately
0.133333333333 seconds of application time), with contact start/end at frames
19/23 and peak impulse 0.18203648924827576. Each fixture has four frames with
all three contacts simultaneously active. Native solver time retains its
separate f32 dt `0.0010416667209938169`.

The independent native reference calls the unchanged original method using its
original JS-double constants. No CPU-law parameter is quantized to accommodate
the candidate. These short coupled trajectories still do not establish native
sleep, active CCD, a complete shot or general browser-world admission.
