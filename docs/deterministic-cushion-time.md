# Earliest uncleared cushion interval (experimental)

This geometry-only component finds a **certified clear prefix followed by the
first interval it cannot clear**. It does not return a certified collision time,
TOI bracket, entering-contact certificate, rebound or scoring result. A small
uncleared interval can occur before the true collision, or even when no collision
occurs. It must not be skipped to a later root or interpreted as a complete miss.

It uses the actual finite cushion triangle asset from
[the point-query component](deterministic-cushion-geometry.md), including faces,
finite edges and vertices. No infinite-plane shortcut, trajectory stepping,
per-candidate host physics, or production/default integration is present.

## Motion and scope

Prepared anchors p/v/A use Q24, time uses Q20 seconds. Acceleration is actual A,
not half-acceleration. At integer tick t the diagnostic state is:

```
pStored(t) = p + floor(v*t/2^20) + floor(A*t*t/2^41)
vStored(t) = v + floor(A*t/2^20)
```

The interval enclosure covers the real polynomial with those encoded coefficients
and its downward-rounded stored positions. It does not certify unquantized source
coefficients, old Rapier trajectories, or the validity of a motion regime. The
caller must bound the horizon by every applicable regime/other-event boundary.
Only the supplied hull participates; other cushions, balls and cloth still need
global earliest-event competition. Time is relative to this prepared anchor.

Domain: center anchors within ±4 m, velocity/acceleration components within ±16,
radius 4096 Q24 units through 1 m, horizon 1–65,535 ticks (under 1/16 second).
The entire outward polynomial position box must remain within ±4 m. This is
narrower than the general q-state's position admission and rejects unsupported
ranges rather than treating them as clear. Initial separation must have a
strictly positive lower gap bound. Initial touch/overlap/uncertain gap rejects;
persistent contact is not handled here.

## Continuous clearance proof, not uniform samples

A bounded stack visits intervals left first. At each interval [l,u]:

1. Evaluate the midpoint's downward-rounded center and its conservative hull
   distance lower bound using the shared full point-query implementation.
2. Bound each position component over the whole interval by independently
   outward-rounded linear and quadratic terms, including interior reversals.
3. Compute the maximum coordinate displacement from that midpoint to this box;
   the upward-rounded Euclidean norm is a movement-radius bound M.
4. Distance to a closed solid is 1-Lipschitz. Thus `distanceLower - M > radius`
   certifies separation throughout the interval, not merely at the midpoint.
5. Otherwise bisect, or return uncertain when the width is one tick. An inside
   or uncertain-containment midpoint supplies lower distance zero, never a miss.

Every discarded interval is wholly clear. Left-first visitation makes the
reported clear prefix contiguous. The implementation never skips an uncleared
interval. Bisection is adaptive interval bounding, not uniform time stepping.
No quartic coefficient overflow or real-number root assertion is hidden in it.

The exported `CUSHION_POINT_WGSL` is the exact full point evaluator used by both
kernels; no string slicing or duplicated feature formulas is used. CPU uses an
immutable, once-validated point-query closure. GPU evaluates every node resident
in one dispatch and reads back only the final records. Both GPU factories copy
scene words synchronously before any await, validate the snapshot and upload only
that snapshot. Paused-compilation mutation tests cover this ownership boundary.

## ABI and budgets

`packCushionMotion(cases)`, `runCushionMotionCPU(rows,scene)` and
`createCushionMotionGPU(device,scene)` are opt-in standalone APIs.

Input: 16 words / 64 bytes per motion:

- 0: candidate ID; 1: horizon ticks; 2: node budget; 3: zero.
- 4–6: p; 7–9: v; 10–12: A; 13: radius, all signed Q24.
- 14–15: zero.

Output: 64 words / 256 bytes:

| Words | Meaning |
|---|---|
| 0–3 | ID, status, reason, hull ID |
| 4–5 | earliest uncleared interval, pending interval on budget exhaustion, or horizon/horizon if wholly clear |
| 6–7 | nodes evaluated, requested horizon |
| 8 | `0xffffffff`: no PASS/MISS authority |
| 9 | 1: contact admission is not supplied by this API |
| 10 | contiguous clear-prefix end tick |
| 11 | zero |
| 12–14 | stored center at word 5 |
| 15–17 | stored velocity at word 5 |
| 18 | diagnostic upper point-query status (normal completion paths) |
| 19–31 | zero |
| 32–63 | complete point-query record at word 5, or initial record on initial-separation rejection |

Statuses: 2 clear through this hull horizon; 4 rejected; 5 incomplete budget;
6 earliest uncleared interval. Reasons: 0 none, 1 input, 2 initial separation
unproved, 3 unresolved interval, 4 budget, 5 range/arithmetic.
Rejected rows must not be treated as advanced states. The upper diagnostic is
not an admitted event state: on incomplete it belongs to a pending interval,
and on status 6 it can still be separated. Its point gap refers to the rounded
stored center, not an exact continuous-polynomial position. A future admission
step must account for that difference and establish approach/overlap bounds.

Explicit budgets: 1–128 candidates, default 256 nodes per candidate, configurable
1–8192, at most 32,768 aggregate declared nodes per batch. SharedArrayBuffer-backed motion rows reject before validation/upload, preventing
concurrent writers from changing a validated aggregate budget. Invalid raw candidate
budgets reject; a batch exceeding the aggregate cap rejects before dispatch.
The stack is 17 intervals, sufficient for all 65,535-tick bisections. Output
preserves incomplete work and clear-prefix diagnostics; no automatic budget
escalation occurs.

## Verification and measured difficulty

Independent analytic checks use the actual encoded nose edge and top face.
Fixtures also include a finite-end bypass, interior acceleration reversal with
clear endpoints, fast passage through the hull, exact finite-vertex grazing,
initial contact/inside rejection, swept-domain rejection, low node budget,
byte-offset views, reordered batches, reserved words and signed INT_MIN guards.
Full upper point records are checked against the separately exported point API.

Native SwiftShader: 4/4 tests passed in 6.31 seconds, 11 motions / 704 output words
exactly CPU/GPU identical, including additional offset/reordered/invalid batches.
Shader: 9,501 bytes, compilation about 2.91 seconds; first tangent-heavy
submission/readback about 490 ms. Shared asset 9,792 bytes, input 704 bytes,
output/readback 2,816 bytes. These are software-GPU component observations, not
hardware throughput or full-shot physical qualification.

| Fixture | Nodes | Budget | Outcome |
|---|---:|---:|---|
| Nose-edge approach | 29 | 256 | uncleared [53102,53103] |
| Top-face approach | 26 | 256 | uncleared [61079,61080] |
| Finite-end bypass | 1 | 256 | clear horizon |
| Acceleration reversal | 41 | 256 | uncleared [13106,13107] |
| Fast passage through hull | 26 | 256 | uncleared [5327,5328] |
| Static separated | 1 | 256 | clear horizon |
| Finite-vertex grazing | 1262 | **2048 explicitly for this fixture** | uncleared [15139,15140] |
| Budget-limited approach | 1 | 1 | incomplete, pending [0,32767] |

The grazing fixture's analytic tangency is tick **16384**, later than its first
uncleared interval. This deliberately demonstrates why output is not a TOI
bracket. The same grazing fixture with the general 256-node budget runs out of
budget; raising only its explicit test budget does not change the general default.

```sh
node --test tests/deterministic-cushion-geometry.mjs tests/deterministic-cushion-time.mjs
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test tests/deterministic-cushion-time.mjs
```

Next bounded work: rigorous refinement/contact admission where possible, keeping
point/time/grazing ambiguity explicit. Then compete this hull prefix against the
other scene events. No rebound should consume status 6 directly.
