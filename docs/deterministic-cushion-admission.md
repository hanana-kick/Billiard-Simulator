# One-hull continuous entering proof and upper contact intervals

This opt-in component follows the [earliest uncleared interval
query](deterministic-cushion-time.md). It can certify a **single hull's unique
entering crossing within one tick**, but only after additional strict tests.
It never treats the incoming uncleared interval itself as a collision.

No rebound, impulse, position projection, global event ordering, scoring, raw-cue
qualification or production default changes are implemented. `responseAllowed`
and `continuousFeatureIdentity` are always zero. Stored-point face/edge/vertex
IDs remain diagnostic, not a claim that the same feature persists in time.

## Resident ownership

`runCushionAdmissionCPU(rows,scene,config)` independently recomputes the time
query and point queries from original motion anchors. There is no API accepting
caller-supplied time/contact claims. The GPU performs two resident dispatches:
time query → admission, sharing immutable scene and original rows, with **zero
intermediate readbacks**. Only final 64-word packets are read back.

The point evaluator and interval arithmetic are shared explicit exports; motion
term/bound functions are also shared, not copied or sliced out of shader source.
Scene and configuration are synchronously snapshotted before the first await.
SharedArrayBuffer-backed motion rows reject before aggregate-budget validation.
The time query's per-candidate and aggregate node limits remain unchanged.

Required configuration:

- `maxPenetrationQuanta`: explicit integer 1–4096 (Q24 metres).
- `approachMarginQuanta`: integer 1–256, default 1 (Q24 m/s).

The test configuration uses 64 and 1. These are named admission limits, not
changes to position precision or an epsilon allowing a separated ball to hit.

## Continuous crossing proof

All distances refer to the canonical encoded convex hull and radius; p/v/A are
the encoded polynomial coefficients. Let `[lo,hi]` be the first uncleared
interval, with `hi-lo=1` and the certified clear prefix reaching `lo`.

1. Recompute the upper stored center `c` and point query. Require its status 1
   unique witness. This status includes an explicit strictly outward face-side
   certificate: **c is exterior**, not merely a point with positive distance.
2. The continuous upper position is not generally c. Use the directed polynomial
   box at `[hi,hi]` and let E be the ceil Euclidean radius of that box around c.
   Each coordinate rounding error is at most two quanta; E is at most four.
   Require **`upperDistance + E < radius`**. Stored overlap alone is insufficient.
3. Recompute the lower stored point and corresponding error radius El. Require
   **`lowerDistance - El > radius`**. Together with continuity, the endpoint
   inequalities prove at least one crossing strictly inside `(lo,hi)`.
4. Let B enclose *all continuous bracket positions* relative to c using the full
   directed polynomial box. Require **`lowerDistanceAtC > B`**. Combined with c's
   explicit exterior certificate, this keeps the entire bracket outside the
   solid hull and away from an undefined zero-distance normal.
5. Convex projection is nonexpansive. Its residual changes by at most 2B under
   the elementary triangle inequality; normalization then changes the outward
   unit normal by at most **`4B/(lowerDistanceAtC-B)`**. This conservative bound
   is evaluated upward in integer arithmetic and applied to every component of
   the stored normal interval, clamped only to mathematical unit bounds [-1,1].
   (Using the stronger residual nonexpansiveness could halve it; this slice does
   not need that optimization.) The argument remains valid across feature changes.
6. Enclose the exact derivative `v0+A*t/2^20` over the full bracket, with directed
   endpoint rounding. Require the outward dot-product upper bound strictly below
   `-approachMarginQuanta`. Distance is then strictly decreasing throughout the
   bracket, so the entering crossing is unique for this one hull.

The normal bound is a family bound, not a representative rounded normal treated
as exact. A competitor-distance margin from the point query would be unsafe for
feature persistence because definitely invalid face projections were discarded.
This implementation deliberately does **not** use that shortcut.

## Penetration and packet scope

At the upper continuous position, penetration is bounded above by
`radius - lowerDistanceAtC + E` (the preceding gates ensure an exterior center).
The bound must satisfy the configured maximum and a second derived limit:

```
D = ceil Euclidean norm of full-bracket coordinate-box widths
U = upperDistanceAtC - lowerDistanceAtC
penetrationUpper <= D + U + 2E
```

D bounds displacement from the clear lower position; U and 2E cover point-query
and endpoint-enclosure uncertainty. No sphere center is projected to the hull.

Upper continuous closest-point intervals expand the stored closest-point
intervals by E per coordinate, using projection nonexpansiveness. Upper normal
intervals use the same directed `4E/(dLo-E)` construction. A separate normal
family covers the whole bracket for the approach proof. **Upper point intervals
are not claimed to be the closest point at the earlier crossing time.**

Even admitted packets still lack other-collider chronology, a chosen response
point/normal with an error contract, coupled cloth resolution and impulse
integration. They must not be passed straight into a rebound solver.

## Output ABI

Input rows are exactly the 16-word motion rows of the time-query component.
Output is 64 words / 256 bytes per candidate:

| Words | Meaning |
|---|---|
| 0–8 | ID, status, reason, hull ID, lo, hi, stored feature ID, stored kind, material ID |
| 9 | proof bits: lower clear=1, upper overlap=2, bracket exterior=4, strict approach=8, penetration bounded=16 |
| 10–11 | penetration upper bound, configured maximum |
| 12–14 | upper E, whole-bracket B, whole-normal expansion |
| 15–16 | whole-bracket approach velocity lower/upper |
| 17–18 | time clear-prefix tick, time nodes consumed |
| 19 | `0xffffffff`: no PASS/MISS authority |
| 20–21 | responseAllowed=0, continuousFeatureIdentity=0 |
| 22–24 | corrected lower gap lower, corrected upper gap upper, derived penetration limit |
| 25–28 | lower El, upper-normal expansion, upper/lower point statuses |
| 29–31 | zero, explicit bracket-exterior proof flag, zero |
| 32–37 | upper continuous center xyz interval pairs |
| 38–43 | whole-bracket derivative velocity xyz interval pairs |
| 44–49 | upper continuous closest-point xyz interval pairs |
| 50–55 | upper continuous outward-normal xyz interval pairs |
| 56–61 | whole-bracket outward-normal xyz interval pairs |
| 62–63 | zero |

Status 1: all five proofs complete (mask 31). Status 6: remains uncertain;
partial diagnostic fields are not an admitted packet. Status 2 propagates a
one-hull clear horizon; 4/5 propagate rejection/incomplete time work.

Reasons: 0 admitted/clear; 1 prior time status; 2 uncertified/non-one-tick
prefix; 3 upper point ambiguity; 4 continuous upper overlap not proved;
5 lower clearance not proved; 6 penetration cap; 7 exterior bracket not proved;
8 approach not proved; 9 arithmetic guard. Zero-filled fields on early refusal
carry no geometric claim. No refinement jumps over an uncleared interval.

## Tests and evidence

CPU checks include actual nose-edge and top-face entry, an oblique 3D trajectory
whose upper center needs a nonzero rounding enclosure, independent analytic
crossing times/normals/closest points, stored-overlap-but-continuous-unproved
refusal, strictly positive upper gap, grazing, diagonal feature ambiguity,
inside and incomplete time states, penetration cap refusal, and a tiny-radius
high-speed 3D case whose broad normal family cannot certify approach even after
loosening the penetration cap. Configuration/scene mutation during compilation,
shared motion buffers, byte offsets and candidate mutation isolation are covered.

Native final expanded-fixture receipt: **4/4 tests passed in 7.87 s**, 13 candidates
/ **832 output words exactly CPU/GPU identical**, with additional byte-offset,
candidate mutation-isolation and invalid-row batches equal. Two resident
dispatches, zero intermediate readbacks. Compile about 4.36 s; shader sizes
9,503/11,147 bytes; software-GPU first submit/readback about 486 ms. Shared
scene/config 9,800 bytes, input 832 bytes, resident time state 3,328 bytes and
final output/readback 3,328 bytes. These are bounded software-GPU observations,
not hardware throughput or full-shot physical acceptance.

```sh
node --test tests/deterministic-cushion-admission.mjs
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test tests/deterministic-cushion-admission.mjs
```

Next boundary: global competing-event certification and a separately specified
static-contact response packet/normal-selection error contract. This checkpoint
must remain non-authoritative for rebound and complete-shot outcomes.
