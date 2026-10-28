# Exact guided precontact prefix acceleration

This is an execution optimization of the existing raw strike model, not a new
impulse law, shortened physical shot time, relaxed clearance test, or free-flight
approximation. It preserves all 128 output words, including the original step
count and reference arithmetic counters. The six resident phases and host
maximum-step dispatch schedule are unchanged.

## Admission and unchanged recurrence

A speculative jump is considered only for cloth support before any contact,
with zero ball v/q, zero transverse cue u/du, and the ball still at its initial
position. The cue's speed and direction are unchanged. For a jump of n original
steps, with k = rounded(vs / 65536):

- axial displacement becomes s + n*k, exactly the repeated integer additions;
- head and shaft become initial + roundQ24(axis * (s + n*k));
- ball p/v/q and all transverse variables remain unchanged;
- cloth normal impulse ledger increases by n * encoded gravity step;
- elapsed steps increase by n, and elapsed Q20 time still equals steps * 16.

The old/new cue momentum and moment in each original step are evaluated at the
**same** head/shaft before position advancement. With unchanged vs and du=0,
their rounded terms cancel bit-for-bit. This is not a claim that a continuous
angular-momentum identity eliminates rounding between different cue positions.
The ball gravity moment is zero because p equals the ledger origin. The cloth
normal force is parallel to its vertical arm, so its torque is exactly zero.
Zero slip, zero rolling/spin state and zero transverse spring displacement yield
zero tangent, resistance and spring increments under the original arithmetic.

All admitted positions, speeds and relative cue moment arms stay within the
original checked arithmetic ranges. The jump additionally checks displacement
and position limits. It does not skip an original overflow or domain failure.

## Whole-prefix proof and conservative fallback

A rounded unit direction has norm at most Q+2 (checked). Adjacent rounded affine
positions travel at most k+4 Q24 quanta. A candidate n is limited by the original
remaining step budget and by (initial distance − contact radius − 64)/(k+4).
The norm ceiling and affine rounding are covered by this contact slack: the
whole skipped prefix has no positive tip compression.

At the candidate endpoint, (ball − head) dot axis must exceed 256 Q24 quanta.
The sphere therefore remains forward of the head and both shaft/neck endpoints
through the prefix. Their nearest-point projections clamp to the forward
endpoint; no hidden closest-feature change is skipped. More explicitly, for
neck endpoint offset B=.006 and segment length L=.12, the difference between
projection numerator and denominator contains L*B*|axis|², over 12,000 Q24
quanta. For the shaft B=.126 and L=1.23 the margin is larger. With the admitted
pose/advance ranges, rounded constant endpoints and both rounded dot products
perturb this difference by fewer than 64 quanta. The positive forward-dot guard
only increases the margin. Thus the rounded divide still exceeds Q and clamps
exactly to Q. Multiplication of the integer segment by Q is exact and `a+(b-a)`
returns endpoint b exactly. There is no amplified .12-m denominator error in the
accepted branch; subsequent norm ceiling contributes less than one quantum.
The existing capsule
clearance is evaluated with motion n*(k+4)+32, including its original doubled
capsule–sphere inflation. This encloses the full rounded affine sweep and each
original per-step clearance margin. Floor and static-AABB checks likewise use
this full-prefix margin, not just endpoint overlap.

At most four candidate lengths are tried, halving after a failed proof; fewer
than eight steps are left to ordinary stepping. An obstacle/cloth/numeric proof
failure restores all speculative error flags and counters and executes the
unchanged step. No partially advanced state is committed. Free-flight and all
post-contact states use the original path.

## Counters and performance interpretation

For an accepted, noncontact, supported original step, the existing arithmetic
calls are exactly 173 multiplies, 6 divides, and 10 norms. Both capsule lengths
are nonzero, all clear checks pass, and the zero-spin branch is known. Words80–82
retain these **reference-equivalent** counts for ABI/diagnostic parity; they are
not measured optimized operation counts. Test-only instrumentation separately
counts proof calls, skipped steps and the three endpoint-reconstruction multiplies.
Integer additions, memory traffic, scheduling and compiler work are not included
in those three call counters.

Host dispatch count is unchanged (16,386 at maximumSteps4096). Fewer active
arithmetic operations must not be advertised as fewer dispatches or a measured
physical-GPU speedup. Native tests here use software Vulkan/SwiftShader.

## Verification

`node --test tests/deterministic-raw-approach.mjs` constructs the original CPU
step loop by removing the single explicitly marked optimization block. It
compares all 128 words, not just final p/v/q. Fixtures include fine fractional
yaw/elevation, translated extreme origins, geometry rejection, free-flight,
gravity zero, and step budgets stopping inside the approach.

A targeted trusted native run is enabled with REQUIRE_WEBGPU=1 and the configured
GPU_NATIVE_MODULE/ICD. Hold the exclusive native lock and use a bounded watchdog.
It compares actual WGSL output directly against the unchanged original CPU loop.
The existing raw-strike tests independently retain physical-law checks.

Final local witness (raw module SHA256
`aa30d6e9ab33ae6f8ebdf5455f2103c58b1d28cf9b7e270f1288aaf5158640dd`):

- CPU old-loop comparison: 1,652 cases, 211,456 words identical.
- Native final fractional-angle corpus: 188 cases, 24,064 old-loop words
  identical; compile8.451s, bounded process21.36s, aggregate RSS501.50MiB,
  maximum-child RSS461.08MiB. These are distinct RSS measurements.
- Test instrumentation over the 1,512 scene/candidate corpus (the separate140
  budget rows excluded from work totals) skipped627,541 original logical steps
  through11,371 proof attempts. Multiplies161,200,338→52,963,834;
  divides6,250,418→2,502,546; norms8,921,828→2,686,534. These are arithmetic-call
  counts, not elapsed-time or GPU-throughput claims.
- Existing physical raw-strike CPU checks:6 passed,1 native skip in that
  separate invocation. Full native raw-world integration is verified separately.
