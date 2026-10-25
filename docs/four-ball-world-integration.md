# Bounded original four-ball common world

## Verified result and scope (2026-10-24)

Tested runtime/test commit: `97975c703894611a6bc8486782f09d7392143282`.
All gates below ran serially on that exact source, with no source changes during
execution, required real WGSL execution, and zero skips. Final `src/tests/tools`
hashes equal the pre-regression manifest. This document is a later docs-only
commit; it does not change the tested runtime.

The new `experimental-four-ball-world.js` owns one common physical clock from
verified original `strikeCreated` data and recorded creation/mutator journals.
It never accepts native future states or per-frame reseeding. It performs source
initialization, owned broad/narrow journal transitions, genuine fourth cloth
birth, source Scene energy/activation, cue/floor/pair/cushion integration,
application angular resistance, withdrawal, sleep, and original scoring.

The selected object is derived from original controller object ID and matched to
its body, not assumed to be array index 1. This fixture selects object ID 1 at
index 0. Six persistent pair bindings (01/02/03/12/13/23) are established at the
initial graph. At most one retained pair is admitted. The initially absent fourth
cloth cache is computed by the owned birth phase, bound to the exact live
Journal edge 5/lifetime 6, and its same lifecycle is transferred after commit.
No prepared native cache is adopted. Rigid cue exclusion checks the full N4
roster of 56 source pairs.

### Frozen gate ledger

| Gate | Tests | Verified outcome |
| --- | --- | --- |
| N4 continuous full shot, CPU + actual WGSL | 2/2 | 5,845 physical h, 5,404 outer steps, full rest; max absolute native error `2.815995547855721e-9` on each backend |
| N4 public first h + first-h atomic rollback | 3/3 | CPU max error 0; WGSL `1.0579449157400588e-37`; exact source manager/queues/graph and deterministic retry |
| No-cue pair ownership + live membership + geometry guards | 8/8 | Controlled 02/12/natural switch, 444 frames per backend, native max error 0; retained-overlap rejection and rollback preserved |
| N3 original 0-degree whole-shot regression | 2/2 | 6,316 h / 5,875 outer steps, 58 cache checkpoints, native max error 0 on each backend |
| N3 original yaw15 whole-shot regression | 2/2 | First rest outer 7,099, continued through fixed horizon 9,600; 110 post-initial checkpoints; native max error `1.7025832854677958e-8` on each backend |

These are 17 passing tests with zero skips, not a universal parity claim. The
separate earlier CPU-only N4 diagnostic is not counted again. N4 preserves the
original **foul** result `{cueId:1, delta:-1, nextCue:2}`; it is not a successful
scoring shot. Both N3 regression shots preserve `{cueId:1, delta:0, nextCue:2}`.
Existing FourBallGame late-opponent-foul and optional three-cushion policy are
used unchanged. The default N4 whole-shot fixture does not prove every possible
three-cushion scoring trajectory.

### What was compared

N4 compares every physical h's ball/cue numerical state, real application clock,
sleep flags, contact events and pending/final game state. It also checks 132
post-created decoded contact-cache/manager checkpoints: the native artifact has
133 snapshots total, including initial checkpoint 0. Checkpoints cover fixed
128-outer intervals and before/at/after contact, cue and sleep transitions.

Checkpoint comparisons include exact managers, IDs/flags, modified queues,
dense contact graph/adjacency, and retained floor/pair/cushion cache fields. They
are not a claim of every-h serialized-world byte identity. Numerical bounds in
the test are 1e-6 for pose, 3e-6 for body velocity/inertia, and 2e-6 for selected
cache fields; actual measured errors are the much smaller values above.

The new inactive and source-wake paths are exercised by actual WGSL, not a CPU
fallback. Instrumentation only wraps the actual stages to count one integration
per awake body (zero for sleeping bodies), reject false numerical admission,
and inject precommit failures at h 1221 and h 4520. All stage snapshots and the
common world remain unchanged after each rejection, and retries match native.
The original world source and observer source hashes are recorded separately
from the pass-through instrumentation transform hash.

## Native evidence and provenance

Evidence directory in the cloud workspace:
`../billiard-four-ball-world-evidence/`.

- Original native artifact: `original-four-ball-full-c49bc03.v8`, 144,434,495 bytes.
- Artifact SHA256: `5b8f3dff1f96cdd105199709c633cd8347aa3915d855a742e6845403ea726c18`.
- Capture independently runs original controller mode selection, fire and
  continuous stepping to rest. It never restores a future snapshot or reads
  candidate state. Its first h is byte-identical to the canonical continuous
  native fixture.
- The artifact manifest binds the original capture/fixture/controller/physics/
  math/game/engine sources and verified initial artifact bytes. It does **not**
  pretend to bind a later candidate commit. Candidate source freezing and loaded
  source hashes are independent gate evidence.
- Outer 4080 / h 4521 is a real raw checkpoint, array index 107, reason
  `after-transition`, snapshot SHA256
  `bfda7173a11b58a85102d80d42905bbf0d494b05e323d8166c05527f83c217f8`.
- The initial exporter verifies typed original `strikeCreated` data and recorded
  source journals. Runtime descriptor/SHA labels alone are not cryptographic
  proof that an arbitrary handwritten seed came from that snapshot.

Final logs in that directory:

- `97975c7-fullshot-cpu-wgsl.log` (558.8 seconds)
- `97975c7-firsth-atomicity-final.log` (18.6 seconds)
- `97975c7-no-cue-component-regression.log` (22.5 seconds)
- `97975c7-n3-default-fullshot-regression.log` (514.1 seconds)
- `97975c7-n3-yaw15-fullshot-regression.log` (729.2 seconds)
- `97975c7-all-source-before-regressions.sha256` and
  `97975c7-all-source-final.sha256` (identical)

The strict GPU runs set `REQUIRE_WEBGPU=1`, use the actual `webgpu` module at
`/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js`, and the Vulkan
SwiftShader ICD `/usr/lib/chromium/vk_swiftshader_icd.json`. This is real shader
execution, not a hardware-GPU performance claim. All work and evidence remain
local to the authorized cloud workspace; no remote push or deployment occurred.

## Remaining admission boundaries

This proves the fixed original N4 default shot and preserves the existing N3
0-degree/yaw15 shots. It does not enable a default product GPU path or establish
arbitrary angle/spin/layout/settled-next-turn parity. Multiple retained dynamic
pairs, pair-plus-cushion coupled components, active CCD, unsupported cloth loss,
and active rigid cue contacts remain guarded and transactionally rejected.


## Source sleep/contact sequencing

### Inactive pair geometry and source wake boundary

The N4 path uses the distinct pair `prepareGeometry` entrypoint. It computes
owned fat-AABB/manifold/recycle state against the live Journal transaction without
asserting that both bodies are awake. Inactive geometry is `geometryComplete`,
not numerically solved; sealing still consumes exactly that transaction and
checks its actual pair identity, edge activity and source lifetime. Sleeping
entry body/cloth state remains unchanged, and each awake ball keeps its singleton
floor integration. The original N3 awake-only `prepare` contract is unchanged.

On an active transition, geometry uses the source **entry** awake mask: a sleeping
ball's existing cloth cache is not refreshed. Journal narrow transitions and
Scene deferred wake/energy observation occur before numerical admission. Only an
actual observed-awake state with inactive CCD admission may enter the shared
solver. The geometry validator does not admit numerical integration. Multipair,
pair-plus-cushion, active CCD, and cloth-loss guards remain closed.

The original fixed shot contains an inactive 03 lifetime at outer 780–797, a
second lifetime beginning at outer 3943, and its actual first active/wake at outer
4079. These are expected-only checkpoints from the unchanged continuous native
capture, not candidate seeds. Full-shot instrumentation counts exactly one
integration per awake ball and zero per sleeping ball, rejects false numerical
promotion, and injects an abort after final preflight at attempted h 1221 before
retry. These checks passed on both backends in the frozen full-shot gate below.

### First wake h: solver hints lag the awake state

At native outer 4079 the fourth ball wakes and integrates gravity plus the new
03 constraint, but its cloth constraint remains absent from the solver for one
h. The asleep transition had count-cleared that pair's solver hint; source
`pair_update.rs` skips it under the entry awake mask, and deferred contact wake
does not requalify it in the same h. `solver_graph.rs` explicitly selects by the
hint, not live awake state. At outer 4080 the awake narrow update requalifies the
floor, using its unchanged old warmstart cache.

A private, current Journal narrow-transition receipt now derives exactly that
source floor subset. The separate active-wake arithmetic plan only filters the
existing source floor bucket list; the original two-floor plan and all arithmetic
remain unchanged. Omitted floor impulse, warmstart, tangent and geometry caches
are preserved. Forged public floor-disable requests are rejected.

Prepared-component diagnosis reproduced the old error with both floors and
matched all six native output linear components plus pair impulse exactly with
the source-qualified subset. This is diagnostic evidence, not a replacement for
initial-only full recurrence. The subsequent initial-only full recurrence passed on both backends; see the gate ledger below.

Scope restriction: this first-wake subset is admitted only by the original N4
common owner, whose sleeping body has no user collider edits and whose prior
source whole-island sleep count-cleared the retained cloth hint. It is not a
general rule that all newly awake bodies lack floor constraints. The source
contact transition wakes its sleeping side with reset; the label “weak wake”
does not describe that sleeping-side reset accurately.
