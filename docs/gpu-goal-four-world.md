# Genuine placed-goal four-ball world admission

This experimental owner adds an explicit first-shot origin after four actual
original-controller moves and native settling. It does not rename the boundary
to a second shot, initialize a native world, use later native states as inputs,
or replace the GPU solve with a CPU full-shot computation.

The separate origin is `goalStrikeCreated`. Its typed snapshot and thirteen-call
cue journal seed the existing shared CPU/WGSL arithmetic. The origin retains
absolute application time and step count, selected source ID 1/index 0, actual
body/collider generations, all four sleeping cloth caches, and source allocator
and BVH topology. The real 32-call placement journal and four observed moves are
preserved as nonnumerical provenance, including in public goal-world snapshots.

The initializer, cue environment, broad owner, graph receipt, pair factory,
cushion factory, rigid-cue guard, and world admission distinguish this origin
from both fresh-fourth creation and settled second-turn creation. Generic/N3,
fresh-fourth, and second-turn factories continue to reject its source input.
Arithmetic plans and solver code are reused, not forked or replaced.

The new test is `tests/experimental-goal-four-world.cjs`. It loads a complete,
frozen original artifact through `tests/four-ball-goal-artifact.cjs`, verifies
its identity, and passes only the initial snapshot/journal and optional observed
placement metadata to the candidate. Every later source value is assertion-only.

Coverage includes each physical h; all four body poses, velocities, rotations,
inertias and sleep states; cue continuation and withdrawal; exact absolute clock,
outer-step and application-step counters; graph adjacency/edge order and manager
allocators; all cloth, sixteen cushion and six dynamic-pair cache owners; and
contact events and scoring through physical rest. Source cache checkpoints
include first h, cue withdrawal, every captured outer checkpoint, physical rest,
and controller-finished. Pair recycle rotation references are compared explicitly.
Floor cache metadata absent from the prior singleton numerical packed layout is
projected from the initial source cache and retained under its unchanged fixed-face
geometry guard, then checked against source checkpoints rather than synthesized
from future states.

Pass-through stage instrumentation checks exactly one integration per awake body,
zero per sleeping body, source-observed pair wakes, rejection of cache/numerical
injection, and full public/private rollback at first h and each contact birth.
Unsupported coupled contacts still fail closed. Rejection of multiple retained
pairs includes their exact handles, binding keys, attempted h, and time.

## Verification status

All four full-rest comparisons passed on frozen commit `2b7cdc6`. The numerical
runtime and tests were not edited between runs. Their fifty recorded loaded-source
and final-disk hashes are identical across the four runs. See the machine-readable
[`gpu-goal-four-world-evidence.json`](gpu-goal-four-world-evidence.json).

| Original goal fixture | Backend | Compared h | Outer steps | Source checks | Rollbacks | Rest score |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Positive | CPU reference | 5,480 | 5,039 | 33 | 8 | ID 1, +1, next ID 1 |
| Positive | Actual WGSL | 5,480 | 5,039 | 33 | 8 | ID 1, +1, next ID 1 |
| Late opponent foul | CPU reference | 5,415 | 4,974 | 34 | 9 | ID 1, -1, next ID 2 |
| Late opponent foul | Actual WGSL | 5,415 | 4,974 | 34 | 9 | ID 1, -1, next ID 2 |

Every run's maximum absolute error against the immutable original trace is
`2.6770281880139635e-8`; discrete state and scores are exact. These are numerical
parity comparisons against the original, not a claim of bit-identical CPU/GPU
floats. The actual GPU is native Dawn Vulkan with SwiftShader software, not a
hardware or browser GPU verification. All four balls genuinely reach sleep in
both cases. The late opponent collision occurs at absolute time
`1.5312499999999862`, which is `0.5770833333333054` seconds after the original
both-red goal at `0.9541666666666808`; the candidate continues through that foul
and subsequent physical rest rather than stopping at the apparent goal.

The initial adapter incorrectly expected seven calls per move. Real full-artifact
admission rejected its 28-call assumption before any numerical h. Commit
`2b7cdc6` corrects this to the exact eight-call source method pattern and retains
all 32 calls, body IDs/handles, target positions, arguments, native-step counts,
and contiguous order. No original producer/runtime source was changed, and no
call or placement provenance was discarded. The initial failure log is retained
as `positive-first-h-6b582a9.log` in the evidence directory.

Ten lightweight adapter/runtime contracts, twelve syntax checks and diff checks
also pass. Full comparison logs are in the sibling cloud directory
`billiard-goal-four-world-evidence`, with filenames and hashes recorded in the
JSON evidence. Neither full fixture reached an unsupported coupled-contact
boundary; the single-retained-pair, shared pair/cushion, active CCD, and rigid-cue
guards remain in force. This is still a bounded experimental owner, not general
whole-world admission, product integration, UI acceptance, or publication.

Example serialized invocation after slot authorization:

```sh
FOUR_BALL_GOAL_REPLAY=/absolute/path/f9a18d6-positive-full.v8 \
GOAL_MAX_H=1 GOAL_FAILURE_PREFIX=/absolute/path/goal-positive \
node --test tests/experimental-goal-four-world.cjs
```

Omit `GOAL_MAX_H` for full rest. `GOAL_BACKEND=gpu REQUIRE_WEBGPU=1` selects the
actual WGSL run and requires the verified `GPU_NATIVE_MODULE` and Vulkan runtime
configuration. Use the late-opponent artifact independently after positive CPU
and WGSL acceptance. No rejected or omitted h counts as a passed continuation.
