# Genuine live three-ball first-substep owner

`browser-initial-import/live-three-ball-first-step.mjs` owns **one** original
1/61440-second substep from an authenticated live three-ball strike-created
capture. Both genuine sources pass unchanged-original CPU and actual WGSL
verification: initial selected cue index 0, and after-turn selected cue index 1
with targets `[1,3]`. No source is relabeled as constructor or four-ball input.

The independent oracle continuously recreates the original controller state,
checks pre-strike and created native bytes exactly, then observes the unchanged
original `world.step` and original post-world angular patch. Only initial capture
bytes enter the candidate. Native results are assertions only.

## Owned numerical transaction

The owner composes the existing same-body numerical stages: original lateral/tip
application, created cue mass/registration, BVH insertion and contact graph,
retained cloth geometry, inactive sphere/cylinder and convex/cylinder caches,
collision connectivity, scene energy/force observation, disconnected cue-joint
and floor solves, inactive pre/post CCD checks, and angular patch. Native
integer manager bookkeeping remains exact host u32; GPU numerical stages execute
actual WGSL, without CPU fallback.

The shared cue and BVH modules now admit an explicit live-three family and actual
source-selected index. Existing four-ball/constructor admission remains separate.
The pair map and generation-bearing adjacency are derived from the branded
insertion receipt, retaining original existing stamps/order. This follows pinned
Rapier `broad_phase_bvh/update.rs:418–429`, `serialize_pairs`, and `Coarena`:
new pairs receive the current frame stamp, adjacency appends in source event
order, and map serialization sorts handle tuples. No later tree/map is supplied.

`prepare({signal})` keeps every state private. `abort()` rolls back and a retry
reproduces the same result. Cancellation before preparation and after actual GPU
submission leaves the committed source unchanged. All participants are checked
before publication; journal commits before the broad receipt is invalidated,
as in the existing owner. `commit()` publishes one completed substep; further
preparation is rejected. The prior initialization and collision-only modules
remain separate unchanged checkpoints.

## Verification and acceptance

`tests/live-three-ball-first-step.mjs`: **2 CPU passes**, **2 actual WGSL passes**
(~6.3 s / 14.3 s). Both include abort/retry and successful commit/disposal; GPU
also includes cancellation after submission. Exact gates cover managers, queues,
IDs, discrete activation, graph/adjacency, complete serialized BVH including
pair maps/stamps, and source identity. Ball/cue motion, joint impulses, sleep pose
history and native contact caches use the existing original component criteria:
ball pose 1e-6, cue/body components 3e-6, joint/cache 2e-6, and existing normalized
cue-inertia criteria. CPU/WGSL ball, manager, graph, BVH and native cache arithmetic
also compare exactly. Backend/dispatch metadata is checked separately, not
misrepresented as numerical state.

A newly added *bit-exact cue cross-backend* assertion initially failed on tiny
raw values. It was replaced with the **pre-existing source component criterion**
from `gpu-cue-stroke-continuation.md` and `gpu-cue-joint.md`, not a widened native
tolerance or a change to physics. Both independent original-native gates remain.
No value is zeroed, normalized, patched, or copied from expected output.
Measured cue cross-backend maximum residuals (including traces):

| Source | Maximum absolute residual | Nonzero differences |
| --- | ---: | ---: |
| Initial cue 1 | 6.6415430821459244e-37 | 12 |
| After-turn cue 2 | 2.0424214345537245e-36 | 12 |

Raw head z velocity is respectively CPU `-7.758262715427098e-37` / GPU
`-6.700317799687039e-37`, and CPU `1.7279766957087626e-36` / GPU
`-3.144447388449619e-37`. This is bounded numerical parity, **not bit identity**.
Failed attempts and final logs are retained in
`../three-ball-live-reverification/first-step-*.log`.

Actual WGSL ran with webgpu@0.6.2, Vulkan SwiftShader software adapter:

```sh
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --max-old-space-size=128 --test tests/live-three-ball-first-step.mjs
```

## Limits and next integration

This is not a usable full-shot three-ball evaluator. Only the first substep is
owned. Initial retained cushions/dynamic pairs, new noncue rigid contacts, active
rigid cue contact, cue removal and active CCD are rejected. A full outer step,
recurrent contacts/caches, cue separation, actual three-ball scoring and physical
rest remain outside this owner. Serde-skipped native workspaces are not a claim
of byte-for-byte engine reconstruction. No general live-owner routing or default
search backend is activated; `requireLiveThreeBallNumericalOwner` remains closed.

The next checkpoint now provides [owned64-substep recurrence](live-three-ball-first-outer.md), preserving this source family and exact cue-2 selection.
Contact/separation and full physical rest remain later work.
Keep these first-h gates as regression requirements. Real-browser integration
and hardware performance remain unverified; no publication/deployment occurred.

Focused shared-code regression: **30 passed, 1 explicit GPU opt-in skip**, zero
failures (`experimental-ccd-bvh-state`, `live-registered-origin-contract`, and
`four-ball-initialization-contract`), using existing source artifacts and the
configured native snapshot decoder. Build passes. Existing constructor cue and
live-four origin regression also passed 16 tests with 2 explicit GPU skips during
cue-admission implementation. Full real-app browser tests were not rerun: this
local experimental checkpoint is not published or switched into default search.
