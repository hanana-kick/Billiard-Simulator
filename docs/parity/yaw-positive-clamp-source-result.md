# Constructor-layout positive post-solve CCD clamp

The single yaw alternative mathematically derived in
[placed-positive-clamp-derivation.md](placed-positive-clamp-derivation.md) has now
been executed once, without ball placement. Its first selected original boundary
h389 has a verified positive post-solve pose clamp. This is source evidence, not
yet an integrated CPU/WGSL world-parity result or independent holdout.

## Fixed legal input

- Original PhysicsLab constructor layout, unchanged source physics and settings.
- Angle 2.0743270562430363 degrees, elevation35, tipX.25, tipY0, speed10.
- No placements, no added/removed balls, maxCcdSubsteps4, cue subdivisions64.
- Normal clearance accepted, minimum distance .010970769450068474 m.
- No ball setter at any time. Only the two original cue-body setLinvel calls.
- Declared observation range h385–h393, order 389,388,390,387,391,386,392,385,393.
  The first observation was positive, so no other boundary was probed and no
  alternate input was tried.

The constructor pre-strike snapshot SHA256 is exactly
`d736c6964006af5ae74d05cfeba99ad8e48d02ee15293affe6e224c36c9ff269`, identical to
the original elevation35 constructor checkpoint. This avoids the placement
fixture's pending user-change and initial cloth-height support expansion.

The yaw was derived by solving A*cos(alpha)-B*sin(alpha)=C, where the existing
original pre-impact position and velocity provide
A=2.0558250750916556, B=.10348987228406442, C=2.050732006954891.
Thus alpha=acos(C/hypot(A,B))-atan2(B,A)=2.0743270562430363 degrees. This rotates
the original planar trajectory to delay the fixed right-cushion impact into the
last part of the step, where the min_ccd_dt merge retains full-dt activation.
Rotational covariance was only the candidate derivation; the result below is
measured from the actual unchanged application, not an analytical substitute.

## Original-source observation

- h389, outer200, ordinary post-cue interval dt=.0010416667209938169.
- Pre-solve first impact .0009043353493325412, approximately .868 of the interval.
- Minimum-step merge selected the full dt, with one pass.
- One actual before/after clamp, body16 generation0, fraction .8679085969924927.
- Next translation changed from
  (1.3920730352401733, .030484238639473915, .27793553471565247) to
  (1.3907301425933838, .030484268441796303, .27780333161354065).
- Next rotation changed too. Physical velocity and current pose were untouched.
- Source-instrumented and source-unobserved native snapshots were byte-identical.
  The independent unmodified direct native probe reproduced those exact bytes.
- Native versus original WASM: four typed signed-zero differences in resting
  contact warm-start values. These remain explicit; byte identity is not claimed.

The original captures preserve before-strike and created snapshots, original
roles/registry, every source pose/velocity frame through h393, and nine selected
pre/post snapshots. Only original WASM runs recurrence. Native diagnostics start
from a selected original boundary and do not feed any later original step.

## Evidence and gate

- Original `/tmp/yaw-positive-ccd-e35-late-v1.v8`, SHA256
  `21843809433b5ec1d282b3ba3896411c8af523de8caced65e6bcd2cf443b5ddc`.
- Source `/tmp/yaw-positive-ccd-e35-late-source-v1.json`, SHA256
  `0985fe3b884267849852877b6db9440a5fe8e4d0b1f4ad6c4a498d640e40603d`.
- Created snapshot SHA256
  `b723bbf90124f38aff62ff3d452cc4a4a5a2c1dc5d549b4bc8b5308ef69cb682`.
- After-application h393 snapshot SHA256
  `e14da29565877b476c31c80ac06ff38bd34b78bcc4463a8c7deb986fb3fb2f47`.

Capture helpers are `tests/yaw-positive-ccd-original-fixture.cjs` and
`tests/yaw-positive-ccd-source-capture.cjs`, with the same required explicit
native-probe environment variables as the placed-source helper. Each refuses to
overwrite evidence. The evidence gate is `tests/yaw-positive-ccd.cjs`; pass
YAW_POSITIVE_CCD_ORIGINAL_CAPTURE, YAW_POSITIVE_CCD_SOURCE_CAPTURE, and
REQUIRE_YAW_POSITIVE_CCD_CAPTURE=1 to require both persisted captures.

Actual CPU/WGSL integrated recurrence, from the created snapshot with later
original states assertion-only, is a separate next validation gate.
