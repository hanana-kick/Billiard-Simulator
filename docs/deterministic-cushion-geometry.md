# GPU-canonical finite cushion point query (experimental)

Geometry only: no continuous TOI, rebound, cloth response, integration, scoring,
raw-shot qualification or production default changes. The GPU integer program is
the numerical reference; CPU is a word-identical mirror. An independent floating
triangle oracle checks bounds in tests, not GPU candidate execution.

## Actual geometry and static preprocessing

`physics.js:59–78` constructs each cushion from four section points
`(u,y)=(0,.0399),(.057,.009),(.057,.061),(.014,.061)` with mitred longitudinal
ends `±(halfLength+u)`. Tests instantiate the source world and take the actual
`collider.vertices()/indices()` mesh retained by `lab.statics`. No rectangular
wall replacement or authored outcome fixture is used by the algorithm.

`packCushionHull({id,materialId,vertices,indices})` runs once for an immutable
static asset. Vertices round to Q24 using `floor(x*2^24+.5)`, sort
lexicographically, and triangles rotate cyclically/sort without changing winding.
It rejects collapsed vertices, degenerate/duplicate faces, non-outward/nonconvex
encoded meshes, open topology and zero volume. Q24 rounding can invalidate a
nearly planar source mesh; such an asset rejects rather than silently changes
connectivity. The actual four source cushions all pass.

Unit directions are enclosed using exact host BigInt comparisons against squared
norms, not floating normalization. Each component's lower/upper endpoints differ
by at most one Q24 unit. Edge lengths use exact integer square-root enclosure.
This is shared static preprocessing, never per-candidate host physics.

A scene contains one finite hull, reusable by all candidates. A caller can create
four immutable assets for four cushions; this component does not choose the
world's earliest collider. Asset bytes include collider ID and material ID;
material coefficients remain owned by a future contact/material table. Static
inverse mass/inertia are zero by contract. The asset deliberately preserves
triangulation edges: an internal face diagonal may cause feature uncertainty,
never an extra resolved impulse.

## ABI and caps

Version `0x43470101`. One asset: 16-word header plus 64 words per feature.
Header: version, collider ID, material ID, feature/vertex/edge/triangle counts,
stride, six AABB coordinates, two reserved zero words. Vertex features precede
lexicographic edges and triangles. Feature kinds: face=1, edge=2, vertex=3.
Every feature stores stable ID and origin; edges store tangent component
intervals, length interval and endpoint IDs. Faces store normal intervals and
three inward edge-plane origins/directions. All remaining words are zero.
`validateCushionHull` reconstructs/re-encodes and compares every word. GPU setup synchronously copies the caller's words before its first await,
validates that snapshot, uploads a private immutable buffer, and does not consult
the caller's asset again. Setup-mutation tests overwrite the original words while
compilation is awaiting and verify that the original validated snapshot is used.

Caps: 16 vertices, 32 triangles, 96 total features; coordinates within ±4 m.
The actual cushion has 8 vertices, 18 tessellation edges and 12 triangles: 38
features, 2,448 words / 9,792 shared bytes. No per-candidate mesh duplication.

Input: 16 words / 64 bytes per query. Words 0/1: candidate ID and feature budget;
2–4: Q24 center; 5: Q24 radius; 6–15: reserved zero. Center components within
±4 m; radius 4096 Q24 units through 1 m; 1–4096 queries. Feature budget 1–96;
insufficient budget yields incomplete before partial selection. Low-level rows
are range/reserved-word checked in both backends. Candidate IDs are opaque and
unique at the high-level packer, not geometry inputs.

Output: 32 words / 128 bytes per query:

| Words | Meaning |
|---|---|
| 0–7 | candidate ID, status, reason, collider ID, feature ID, kind, material ID, feature count |
| 8–11 | distance lower/upper, signed sphere gap lower/upper (distance minus radius) |
| 12–17 | closest-point x/y/z lower/upper pairs |
| 18–23 | cushion-to-sphere normal x/y/z lower/upper pairs |
| 24 | unique usable feature witness (1 only for status 1) |
| 25 | `0xffffffff`: no PASS/MISS authority |
| 26–31 | reserved zero |

Statuses: 1 unique feature enclosure; 4 rejected; 5 incomplete budget;
6 uncertain closest feature. Reasons: 0 none; 1 input; 2 center strictly inside;
3 surface/feature/zero-normal ambiguity; 4 budget; 5 arithmetic range.
Rejected/incomplete output fields other than header are not geometry evidence.
For status 6, distance/gap bounds remain conservative when populated, but the
point/normal describe one valid witness and **do not enclose every possible
closest feature**. They must not be used as a resolved contact packet.
Status 1 does not mean collision: inspect signed gap. If gap straddles zero,
contact-versus-separation remains unresolved even with a unique feature.

## Directed arithmetic and proof scope

The canonical object is the closed triangle surface with encoded Q24 vertices.
Vertex quantization relative to supplied source coordinates is at most half a
quantum per component (about 29.8 nm); the returned intervals certify the encoded
object, not unquantized Rapier distances. These are point queries at the supplied
encoded center, not polynomial trajectory enclosures.

The kernel enumerates vertex distances, finite edge projections and finite face
projections. Projection side tests use interval signs. A definitely outside
projection is discarded; an uncertain projection contributes only a lower bound.
Only a definitely valid feature supplies the global upper bound. Unique selection
requires its upper bound strictly below every competing lower bound. Centers
inside/on an unresolved hull boundary reject rather than invent a normal.

Each signed Q24 product is computed with `multiplyWide` and separately directed
floor/ceil. Dot products sum the endpoint intervals; all projection operations
propagate these intervals. Distance bounds use two-word sums of squared minimum/
maximum absolute components and integer floor/ceil square roots. Normal bounds
use directed `divideWide` and the distance enclosure; division cannot silently
narrow an overflowing quotient. No fixed epsilon substitutes for error bounds.

Range argument: encoded center/origin differences are at most 8 m/component;
unit direction enclosure width is at most one quantum. Dot products are bounded
by `sqrt(3)*8 m` plus rounding, below 14 m. Projected coordinate differences are
below 23 m, and a face side dot's conservative component sum is below 80 m;
all signed Q24 intermediates therefore fit i32 (limit 128 m). Three squares of
23 m in Q24 fit u64 with ample margin. The explicit multiply guard fails closed
before narrowing; static re-encoding ensures directions satisfy these premises.
Normal division is clipped to the mathematical unit-component bounds [-1,1].

`createCushionGeometryGPU(device,scene)` uploads the asset once, compiles once,
and exposes `run(rows)` and `dispose()`. A dispatch owns each complete point
query; there is no CPU closest-feature evaluation or intermediate readback.
Only final diagnostic records are read back. Kernel scratch is bounded by
96 distance intervals plus flags and fixed-size vector temporaries per invocation.

## Verification and next boundary

`node --test tests/deterministic-cushion-geometry.mjs` exercises actual meshes,
canonicalization under vertex/triangle permutation, nominal nose-edge contact
and downward normal, face/edge/vertex paths, finite ends, corners/feature seams,
inside/surface guards, quantum perturbations, range/reserved/budget rejection,
byte offsets, independent triangle bounds and deterministic randomized queries.

For native exact-word checks:

```sh
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test tests/deterministic-cushion-geometry.mjs
```

Native SwiftShader receipt (2026-10-27): 4/4 tests passed in 1.31 s. All 8,960
output words for 280 candidates matched CPU exactly, with additional byte-offset,
reordered, mutation-isolation and invalid-row batches also identical. Shader size
5,815 bytes; compilation about 545 ms; observed first submit/readback about
12.7 ms. Candidate input/output were 17,920/35,840 bytes with 9,792 shared asset
bytes. These are software-GPU component measurements, not hardware throughput
or full-shot physical acceptance. Full UI/build tests were not rerun because
this isolated module is imported only by its new tests; production is unchanged.

Smallest next component: use this geometry distance enclosure plus a conservative
movement bound in left-first Q20 interval subdivision, certify all earlier
intervals clear, and return the earliest unresolved bracket. It must compete with
pair/cloth/regime events. A possible-contact bracket must not be relabeled an
entering impact, and upper-tick overlap must be separately bounded before any
full3D contact response is admitted.


### Shared callable point evaluator

The continuous-prefix component now imports the explicit `CUSHION_POINT_WGSL`
export; both kernels call the same complete feature evaluator. CPU has an
immutable once-validated `createCushionPointCPU` closure for repeated queries.
After this refactor and the setup-snapshot fix, native point tests passed **5/5**:
8,960 words remained identical, shader 6,502 bytes, observed compile about 458 ms.
The original receipt above remains a historical checkpoint, not the new size.
