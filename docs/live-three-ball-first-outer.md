# Live three-ball first-outer-step recurrence

The bounded `createReferenceFirstOuterOwner` / `createGpuFirstOuterOwner` factories
in `browser-initial-import/live-three-ball-first-step.mjs` reuse the tested first-h
owner, but permit **64 committed substeps** (the first original outer-step
numerical interval). The original one-step factories remain capped at one.
There is no source reset, restore, or per-step native input.

Cue, contact journal, source BVH, scene activation and floor stages persist.
Each subsequent substep starts from its own committed ball/cue state and caches.
Initialization runs only at h1. Source mutable-body calls enter the existing
scene lifecycle on later h; contact caches, pair stamps and adjacency derive
from current receipts and the previous committed state. Native pair deletion
uses the original adjacency `swap_remove` behavior. Initial pair stamps are not
invented anew. Exact source family, selected index and target identities persist.

Each substep remains a transaction: prepare is private, abort/cancellation
preserve the preceding checkpoint, commit validates participants before
publication. Returned checkpoints are copies; mutating one cannot change the
owned recurrence. Prepare accepts only cancellation metadata, not injected
positions, caches, future native results or replacement state. No h65 is
admitted by these bounded factories.

## Independent acceptance

`tests/live-three-ball-first-outer.mjs` reproduces both genuine original
controller sources continuously and verifies their pre-strike/created bytes.
It observes all64 unchanged original native steps and original angular patches;
those observations are assertion-only and never enter the candidate.

Every substep uses the same native assertion helper as the first-h checkpoint:
full manager/queues/IDs/activation, dense graph and adjacency, native floor and
empty cue caches, joint/body numerical results, and the **entire serialized BVH
including pair maps, stamps and adjacency**. Native numerical component limits
remain unchanged. The test asserts initialization only at h1, source identity at
every endpoint, cancellation at h2/32/64, abort/retry at those checkpoints, and
snapshot mutation isolation. Actual WGSL additionally cancels after submission
at h2/32/64 and proves a recurrent h32 abort/retry.

CPU-only acceptance: **2/2 passed**, all128 original substep endpoints,
50.9 seconds on the shared environment. This includes original native fixture
observation and snapshot decoding; it is not a solver performance claim.

The separate first-h checkpoint remains documented in
[live-three-ball-first-step.md](live-three-ball-first-step.md). Numerical parity
is not universal float bit identity; original cue/component tolerances remain
fixed and tiny cross-backend residuals are reported rather than zeroed.

## Scope

This is the first64 numerical substeps only, not a full shot, three-ball scoring,
cue separation or physical rest. Unsupported rigid cue contact, active CCD,
new noncue rigid contacts or cue removal reject before publication. Initial
retained cushions/dynamic pairs remain rejected. UI/controller outer-step
bookkeeping and default search routing are not activated by this owner.

Next boundary: carry owned recurrence beyond h64 to the first actual compliant
cue/ball contact (or earlier unsupported physical event), with unchanged native
per-h assertions. Do not infer full stroke or rest from the first outer interval.

Actual WGSL acceptance: **2/2 passed**, all64 original endpoints for each source,
including successful final commit and resource disposal. Both backends are
compared at each checkpoint with the complete original native assertions.
CPU/WGSL manager, ball, graph, BVH and owned native-cache arithmetic compare
exactly. Cue public-component maximum absolute cross-backend residuals were
`1.0579449157400588e-37` (initial cue) and `3.009265538105056e-36` (after-turn cue),
under the unchanged original component limits; raw values are not normalized.

The first GPU attempt with a128MB V8 cap failed explicitly with a heap-allocation
OOM, not a numerical assertion. The retry used384MB and streamed each of the
same64 native checkpoints through both candidates, retaining every assertion
instead of unnecessarily storing128 decoded worlds and64 complete trace copies.
It passed in **56.42 s**. Python `resource.getrusage(RUSAGE_CHILDREN).ru_maxrss`
reported **648932 KiB** maximum child RSS (about634 MiB, including native runtime
memory; not merely the JS heap). `/usr/bin/time` was unavailable, so this recorded
resource counter was used. Failed and final logs remain in
`../three-ball-live-reverification/first-outer-*.log`.

Run with the same explicit `REQUIRE_WEBGPU=1`, `GPU_NATIVE_MODULE`, and
`VK_ICD_FILENAMES` configuration as the first-step guide, using
`node --max-old-space-size=384 --test tests/live-three-ball-first-outer.mjs`.
This used webgpu@0.6.2 / Vulkan SwiftShader software WebGPU, not a hardware GPU
performance result. The integrated parent branch's separately optimized graph
runner needs its own rerun; this evidence belongs to this isolated source tree.

The preserved one-step CPU regression passes2/2 after extracting the shared
assertion helper (7.0 s), and the application build passes. No original CPU
physics, default search routing, real-browser deployment or external state was
changed. No further numerical work remains running from this verification.

The next separately verified increment now owns the [actual first compliant-tip
contact and four-substep aftermath](live-three-ball-tip-contact.md), including
source-owned sleeping cue2 wake propagation. These64-step factories remain capped.
