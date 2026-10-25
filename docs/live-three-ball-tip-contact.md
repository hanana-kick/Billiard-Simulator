# Source-owned live three-ball first tip-contact boundary

The separate `createReferenceTipContactOwner` and `createGpuTipContactOwner`
factories extend the same owned recurrence to its **first actual compliant-tip
birth plus four substeps**. They do not accept a contact frame from the caller.
A1024-substep hard horizon fails closed if the physical event is not reached;
consumers must require `eventBoundary.complete`, not merely a returned state.
The existing one-step and64-step factories retain their original caps.

The original controller independently discovers contact at **h363** for initial
cue1 (time `0.005891927083333318`), and **h371** for after-turn cue2 (time
`6.125813802082979`). Their accepted stopping boundaries are h367 and h375.
These are observations, not constants in candidate physics or acceptance input.

## Wake and event ownership

Original `PhysicsLab.compliantTipContact` (`physics.js:174–204`) applies the
existing lateral/tip impulses and invokes mutable body APIs with wake enabled.
The shared cue stage reports their exact order and nonzero-impulse wake flags.
`Scene.beginFrame` owns the corresponding activation/manager changes.

Before CCD/floor geometry, the owner copies **only an already-owned
sleeping→awake transition** from that current scene into its own ball state.
This follows the existing registered-four ordering, without adopting its family
or rules. It does not force wake, zero velocity, reconstruct a source snapshot,
reset caches, or substitute a ball. The selected cue2 and targets `[1,3]` remain
source-exact. The first-contact test checks native island wake propagation.

Tip births are recorded separately from native rigid graph events. Event
identity, selected handle/index, ordering and original **pre-substep time** are
checked exactly. Event position uses the existing tip kernel's applied f32 point
and is checked against the original JS event position under the unchanged cue
component3e-6 bound; it is not claimed to reproduce all JS-double position bits.

## Acceptance

`tests/live-three-ball-tip-contact.mjs` runs the continuously existing original
controller without restore or patched physics. Its first contact is discovered
from the actual cue contact episode, not a chosen h. It buffers at most one
outer call's raw snapshots, then streams each native pre/post-angular endpoint
through the candidates. No native future state enters an owner.

All previous per-h gates remain: full manager/queues/IDs/activation, full serialized
BVH including pair maps/stamps/adjacency, dense contact graph, floor/empty-cue
caches, body motion and cue joint impulses. Native numerical tolerances are not
widened. Source identity and initialization-only-at-h1 are checked throughout.
Cancel/abort/retry is exercised at actual birth and the final aftermath boundary;
GPU cancellation occurs after submission. Committed event/wake state must retry
identically. After completion, further preparation rejects.

CPU source shards both pass:

| Source | Observed birth | Completed | Elapsed | Maximum child RSS |
| --- | ---: | ---: | ---: | ---: |
| Initial cue1 |363|367|109.02s|536748KiB|
| After-turn cue2 |371|375|103.73s|522984KiB|

These timings include independent original observations, snapshot decoding,
all assertions and retry checks; they are not solver throughput benchmarks.

## Explicit remaining boundary

This proves first contact and four subsequent numerical substeps only. It is
not cue separation, full stroke, full physical rest, three-ball scoring or a
usable search evaluator. Rigid cue contacts, active CCD, new noncue rigid
contacts and cue removal still reject. Separation requires native cue/graph/BVH
retirement and source timestep scheduling: the current outer call retains64
substeps after withdrawal, then the following outer call uses1/960 s. No default
search or UI route is activated, and no deployment or external write occurred.

Actual-WGSL source shards both pass, using webgpu@0.6.2 with Vulkan SwiftShader
software WebGPU and384MB V8 heaps:

| Source | Completed | Elapsed | Maximum child RSS | Maximum public cue CPU/WGSL residual |
| --- | ---: | ---: | ---: | ---: |
| Initial cue1 |367|147.85s|654912KiB|1.0579449157400588e-37|
| After-turn cue2 |375|137.05s|567444KiB|3.009265538105056e-36|

CPU/WGSL balls, manager, graph, BVH and native-cache arithmetic compare exactly;
cue components retain their established numerical limits and raw residuals.
The complete observed event/wake state passes abort/retry and committed-state
checks on each backend. This is software-adapter execution, not a hardware speed
claim. Memory is Python `RUSAGE_CHILDREN.ru_maxrss`, not JS heap usage alone.

Evidence: `../three-ball-live-reverification/tip-contact-{cpu,gpu}-{default,after-turn}.log`.
Reproduce each source independently with `node --max-old-space-size=384 --test
--test-name-pattern='default discovers' tests/live-three-ball-tip-contact.mjs`
(or `after-turn discovers`), setting the same explicit WebGPU environment as the
first-step guide for actual-WGSL execution. The original contact frames are
rediscovered by the test, never passed into the candidate API.

Preserved one-step CPU factory regression:2/2 passed (6.4s); build passed.
The event suite independently rechecks all first64 endpoints on both backends;
the old1/64 factories' bounds are unchanged. This proof is for the isolated tree;
the integrated parent's optimized runner/browser wiring needs its own validation.
