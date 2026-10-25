# A source-derived positive post-solve clamp

This is a separately identified legal-placement discovery fixture, not the
constructor-layout checkpoint and not an independent holdout. It establishes an
actual original-source pose clamp. It does not establish whole-world CPU/WGSL
parity, and it must not be relabeled as the constructor-layout input.

## Necessary source conditions

Pinned Rapier b716d375efc0201003f0cd9ef7168eee0b62c177:

- `dynamics/rigid_body_components.rs:1126–1175`: pre-solve activation uses current
  velocities plus forces; post-solve activation uses the larger of actual pose
  displacement and solved effective velocity displacement. The displacement must
  exceed half the CCD thickness.
- For the original radius .03075 and dt 1/960, effective point speed
  `|v| + radius*|omega|` must exceed 14.76 m/s. At one quarter dt the required
  speed is 59.04 m/s. Rotation can activate sphere CCD although its collision
  shape itself is rotation-invariant.
- `dynamics/ccd/sweeps.rs:35–51, 423–450`: the original balls are bullets, so
  ball–ball CCD pairs are excluded. A useful target is fixed cloth, cushion, or
  wood. A solid sweep is accepted only for a strict positive fraction below its
  current maximum; initial overlap fraction zero does not clamp in this 3D path.
- `pipeline/physics_pipeline/substep.rs`: with four remaining passes, a first
  impact at fraction f>=.25 selects dt'=(.25+.75f)*dt. If the remaining time is
  at most min_ccd_dt, it is merged back and no further pass is scheduled.
- Here min_ccd_dt=.00016666667943354696 and dt=.0010416667209938169.
  A first hit at f>=approximately .786667 therefore restores the full dt.
  Exhaustion of the pass budget also skips a further split, but was not needed.

A solver/impact-induced velocity change can make the post-solve sweep differ
from the predicted sweep, including a new active body after no pre-solve hit.
That is a possible route, not a necessary ingredient of this positive example.
Here the minimum-step merge preserves activation until the known fixed-target
impact. Force integration, contact solving, and subsequent clamping remain the
unmodified source operations.

## One preregistered placement, one observed boundary

The prior unmodified elevation35 h389 evidence contained:

- First impact t=.0004171431646682322, vx=9.787644386291504.
- Effective point speed approximately 20.36513223035453 m/s.
- Selected dt=.0005732740391977131. Its shorter interval deactivated the body,
  explaining its zero post-clamp count without treating pre-TOI as success.

To move the impact late in the same ordinary step, target t*=.90*dt and delay
the trajectory by initial displacement dx=-vx*(t*-t). Evaluating that expression
gives -.005093068136764734 m. Before executing any new input, the bounded fixture
fixed the nearby approximate value -.005093665 m, a difference below .6 micrometre.
Only this single declared value was executed. The declared scan was the nine
boundaries h385–h393, starting at h389 and stopping at the first positive result.

The original `PhysicsLab.move` accepted the request, with overlap disabled.
Important: the requested settled y=.030721673741936684 was below the radius, so
the application's own cloth-protection rule raised it to .030799999833106995.
The actual final center was
(-.665093719959259, .030799999833106995, .10000000149011612).
This is not a claim of pure x-only translation. Requested and actual placement
are separately preserved, including its queued source user changes.

The unchanged real cue then accepted angle0/elevation35/tipX.25/tipY0/speed10;
clearance was .010970784351229668 m. Max CCD substeps remained four, the original
64 cue subdivisions remained, and no ball setter ran after the created snapshot.
Only the original placement API assigned zero ball velocities before the shot.

The very first observed boundary h389 was positive:

- Pre-solve first impact .0009243164677172899, approximately .88734 of full dt.
- One internal pass; the minimum-step rule restored full dt.
- One paired before/after clamp, fraction .8870855569839478, body16 generation0.
- Next translation changed from
  (1.3918800354003906, .03048805519938469, .20092496275901794) to
  (1.3907289505004883, .03048808127641678, .20085512101650238).
- Next rotation also changed; velocity and current position were preserved.
- Instrumented and unobserved native snapshots were byte-identical; the separate
  unmodified direct native probe also produced the same snapshot bytes.
- Native versus original WASM had four typed differences, all signed zero in
  resting contact warm-start fields. They are preserved, not normalized away.

## Persisted evidence and reproduction

The fixture preserves before-placement, before-strike, created, all nine pre/post
snapshots, registry, actual placement, clearance, setter audit, and all 393
original pose/velocity frames. Future original states are assertions only, not
candidate recurrence seeds.

- Original: `/tmp/placed-positive-ccd-e35-late-v1.v8`
  SHA256 `438686fe85f3693ef8f48604a797120af6ed52cb3b9fc65fba825d31f8a9ffbe`.
- Source: `/tmp/placed-positive-ccd-e35-late-source-v1.json`
  SHA256 `fb85215a05847240813d1bfaf4d442acccdeff44040660bd6b2a1be93ca5aa34`.
- Created snapshot SHA256
  `5573a574c92021f1e2c3fe49fee1d70de94c3e7b16e036ce3c900bf134dc0651`.
- Original engine SHA256
  `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.

Run `node tests/placed-positive-ccd-original-fixture.cjs /absolute/new.v8`.
Then run `tests/placed-positive-ccd-source-capture.cjs` with that path and a new
absolute output path. Its required environment variables are
ACTIVE_CCD_SOURCE_PROBE, ACTIVE_CCD_DIRECT_PROBE, RAPIER_SNAPSHOT_DECODER,
ACTIVE_CCD_BUILD_PROVENANCE, and POSITIVE_CCD_BUILD_REFERENCE_CAPTURE. It verifies
the same pinned build provenance and binary hashes as the existing source gate.
Run the evidence gate with PLACED_POSITIVE_CCD_ORIGINAL_CAPTURE,
PLACED_POSITIVE_CCD_SOURCE_CAPTURE, and REQUIRE_PLACED_POSITIVE_CCD_CAPTURE=1 using
`node --test tests/placed-positive-ccd.cjs`. No gate implicitly regenerates evidence.

The existing world owner assumes constructor-layout initialization. Integration
must explicitly accept this placed variant and verify pending user changes and
initial contact-cache state from the actual created snapshot.

## Constructor-only yaw alternative derived before execution

Before any yaw experiment, a single alternative was derived from the original
e35 h389 displacement and velocity, rotating its planar trajectory about the
unchanged starting cue-ball center. This assumes planar rotational covariance
until the right cushion, so it is a justified candidate, not an observed result.

Let A=Dx+vx*t*=2.0558250750916556,
B=Dz+vz*t*=.10348987228406442, and
C=Dx+vx*t=2.050732006954891. Solve A*cos(alpha)-B*sin(alpha)=C:

alpha=acos(C/hypot(A,B))-atan2(B,A)
     =.03620383689464258 rad =2.0743270562430363 degrees.

Use this angle with the same e35/tipX.25/tipY0/speed10 and no placements. The
predicted rail contact z=.2778345557582592 moves away from the other balls. This
could avoid placed-initialization support. It was unexecuted when this placement
experiment completed. Its subsequent separately authorized single-input positive
result is recorded in
[yaw-positive-clamp-source-result.md](yaw-positive-clamp-source-result.md).
