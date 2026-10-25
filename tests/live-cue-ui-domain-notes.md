# Fixed original UI-domain cue observation

Baseline: `20b94dddaf87088e45f229ecf90449b79835f386`.

This preregisters exactly one original three-ball shot: angle 0°, elevation 35°,
speed 5 m/s, tipX 0.92, tipY 0, unchanged default materials. No placements,
additional settling, altered forces, disabled collisions, or alternate inputs.
The original clearance check must accept it or the experiment stops.

The actual manual UI has speed ≤5 and radial tip ≤0.92. The broader engine
validation permits speed ≤10 and radial tip <1; those are not the same domain.
Route application cannot bypass this distinction because it uses changeSettings.
The selected boundary tip maximizes initial transverse input within the manual UI,
but reduces normal approach and its Coulomb force cap. It does not guarantee CCD.

The massless neck contributes to the head's maximum extent and thickness despite
not contributing inertia. Expected analytical values are head extent about
0.126279681 m/thickness 0.0058 m and shaft extent about 0.615098366 m/thickness
0.011 m. The test uses actual decoded native values, not these approximations.

App compliant impulses precede world.step and its pre-solve CCD check. Joint
angular restrictions are impulse constraints, not exact instantaneous velocity
locks. Rapier does have a solver linear-speed cap (400 × 0.0615 ≈24.6 m/s) and a
MAX_ROTATION/full-step-dt angular cap; neither establishes the necessary smaller
pre/post CCD motion bound. In particular, pre-world impulses occur before these
solver caps.

For every captured pre-world shaft/head state the existing read-only native Rust
probe directly evaluates the pinned source pre-force CCD predicate. Actual native
mprops, thickness and velocities are retained at bootstrap and measured extrema.
Zero force/torque is source-derived and checked at the retained native boundaries;
the app uses impulses only and cue gravityScale is zero. The first-step deferred
maxExtent initialization cannot alter its predicate because angular velocity is zero.

Every wrapper forwards the original call and arguments unchanged. Only the two
original cue initial-velocity setters are allowed. Original source hashes are
checked before and after. Retained snapshots are serialized without modification.

A positive result means a reachable pre-solve activation predicate, not a positive
TOI or changed pose clamp. A negative result applies to this one shot only. This
does not prove the entire UI domain inactive and is not CPU/GPU world parity.

Execution requires explicit original vendor, native decoder, native CCD probe,
and a new output directory. Do not regenerate or select another input silently.

```sh
LIVE_CUE_UI_VENDOR=/absolute/pinned/vendor/rapier.cjs \
RAPIER_SNAPSHOT_DECODER=/absolute/rapier-snapshot-decoder \
RAPIER_CCD_PROBE=/absolute/rapier-ccd-probe \
node tests/live-cue-ui-domain-capture.cjs /absolute/new-output-directory
```

## Completed single-shot result

The original clearance check accepted the fixed input. Capture completed with
174 LIVE cue microsteps and 348 shaft/head pre-predicate comparisons against the
direct pinned Rust method. All comparisons were exact and all were inactive.

- Head maximum point speed: 15.735676765441895 m/s at h152,
  t=0.0024576822916666627 s. The native head maxExtent is
  0.12627968192100525 m and thickness is 0.005799999926239252 m.
  Its predicted motion was 0.00025611455203033984 m against
  threshold 0.002899999963119626 m.
- Shaft maximum point speed: 5.000006198883057 m/s at h54.
  Its native maxExtent is 0.6150983572006226 m and thickness
  0.010999999940395355 m.
- Pre-step observations span t=0 through 0.002815755208333328 s.
  Original cue withdrawal occurs at t=0.0028320312499999947 s.
- One contact episode; peak normal force 226.11700819687638 N.
- Retained head-maximum angular velocity is
  [50.13413619995117, 71.06145477294922, 0.12971672415733337] rad/s.
  This directly demonstrates that head angular velocity is not zero just because
  angular impulse joints constrain the later solve.

Local evidence directory:
`/tmp/live-cue-ui-domain-e35-speed5-tip092-v1`.
Report SHA256:
`b822d8c083fbf2abe17a6141e059cefac328ee4074d0875aa6d848e6cb201839`.
Head-maximum pre-world snapshot SHA256:
`0ec1bee82cb3ecd25ead0fa3d67d85335caeebb89d77b805f9f3d8047f80863a`.

This is only a negative pre-activation observation for this one original shot.
Post-solve activation, positive TOI, clamp coverage, and universal UI-domain
exclusion remain unestablished. No alternative shot was attempted.

```sh
LIVE_CUE_UI_REPORT=/absolute/evidence/report.json \
node --test tests/live-cue-ui-domain.cjs
```

## Post-solve follow-up preparation and verified blocker

The completed artifact retains exact post-compliance/pre-world snapshots only
for h1, h54 (shaft maximum), and h152 (head maximum). The h0 creation snapshot
still has the outer timestep, and h1 post-world precedes the next application's
compliant impulse. Neither is substituted for a missing pre-world boundary.
The 174 compact velocity frames do not contain full world/joint/contact state;
they cannot reconstruct the other 171 pre-world snapshots without a new replay.

The existing source probe is verified against
`/tmp/positive-ccd-e60-source-v2.json.sourceBuild`:

- Binary: `/tmp/billiard-active-ccd-target/debug/active-ccd-source-probe`
- SHA256: `2a7c8703e97e9d2167050465a06d0bdae0f77ad2b05cb6f5255732b76eeb7116`
- Its host, `tests/active-ccd-source-probe/main.rs:14`, explicitly rejects any
  nonempty impulse-joint set: "Post-withdrawal no-joint source capture only".
- The independent direct probe's `--step` mode has the same no-joint scope.
- The existing cue-joint oracle observes scalar joint constraints; it does not
  run a complete joint/contact world or expose the post-solve CCD stage.

These LIVE snapshots have the original two cue joints. Therefore the existing
verified source-step route is unsupported. No probe was invoked on a rejected
domain, no joint was removed, and no guard or physical source was changed.

A later approved joint-capable observer could inspect only these three retained
world steps, reporting per-body post-solve activation separately from pre-TOI,
accepted sweep fraction, and actual changed-pose clamps. That would still cover
3 of 174 steps, not prove post-solve inactivity throughout this shot. An original
WASM one-step replay could instead reveal only final retained CCD flags without
the internal pre-clamp trace; it must not be presented as equivalent evidence.

## Completed separate LIVE-joint observer

A separately named host now explicitly admits only the exact original
h1/h54/h152 snapshot hashes. It validates 22 original bodies, 25 colliders,
the two original flex/guide joint connections and masks, their nonmotor/contact
configuration, and the unchanged microstep/solver/CCD settings. The old no-joint
host and binary were not edited or replaced.

The new host reuses the already-verified read-only observation hooks in
`/tmp/billiard-active-ccd-source-v2` without changing any engine file. A complete
source-manifest audit passed before and after the host-only compilation, including
the original upstream and Parry source trees. The existing source binary remained
at SHA256 `2a7c8703e97e9d2167050465a06d0bdae0f77ad2b05cb6f5255732b76eeb7116`.
New host binary SHA256:
`174be89fa8e9e8a47a188e3ad3637b5ec150c0dea9bca518772ca3ac65b98fc3`.

Each retained boundary was independently stepped, with observation enabled and
disabled. Both post snapshots were byte identical, and input/output serde
roundtrips passed. Only five dynamic bodies plus split/query/clamp information
were serialized into the observation trace, approximately 290 KB per boundary.

At h1, h54 and h152:
- All five post-solve body CCD flags were inactive, including both cue parts.
- Direct pinned Rust post-predicate/ccd-velocity comparisons passed for every
  body (15 total comparisons).
- The pre-split flag was false, first impact was absent, no sweep query was made,
  and no clamp was applied. The CCD accounting counter is 0 because CCD did not
  act; this does not mean the ordinary solver step was skipped.
- The cue final translations/rotations matched the next original pre-world
  frame exactly. App compliant impulses between these boundaries alter velocities,
  not cue poses, so this is a limited original-pose comparison only.

The source post head point speeds were approximately 5.01031971, 4.99286890,
and 5.06758690 m/s respectively. This does not establish the maximum post speed
over the entire stroke.

Post evidence: `/tmp/live-cue-ui-domain-post-three-v1/report.json`.
SHA256: `9560f02681b82cc958e80a63d41f934b48b7b0d3994713f798e220de173cbe3d`.
Build provenance: `/tmp/live-cue-ui-domain-source-host-v1/build-provenance.json`.
The five applicable guard/pre-artifact/post-artifact tests passed without skips.

### Native-source versus original-WASM difference

The full h1 native post snapshot is not byte identical to the saved original
WASM post snapshot. A complete lossless typed comparison found exactly one
difference:

`world.islands.persistent.islands.v.items.3.value.constraint_remove_count.value`

Native-source replay: 1. Original WASM: 2.

This is island-manager bookkeeping, not signed zero or a body pose/velocity/mass
field. All other serialized typed fields matched at h1. Its behavioral consequence
has not been diagnosed; it must not be normalized away or called full-world parity.
The comparison used the existing snapshots only, with no additional physics step.
Details: `/tmp/live-cue-ui-domain-post-three-v1/h1.native-wasm-diff.json`.

Exactly 3 of 174 LIVE world steps now have internal source post-solve observations.
The other 171 remain unmeasured. Neither these negative observations nor the
complete pre-predicate negative trace proves universal UI-domain CCD exclusion.
