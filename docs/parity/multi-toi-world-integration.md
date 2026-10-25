# Owned multiple-TOI world integration

This experimental branch preserves original PhysicsLab/Rapier sources and does
not enable a new public GPU backend. It extends the bounded original three-ball
world owner with source BVH lifecycle, not an oracle query ordering.

The bridge starts from the original created tree, derives current shape bounds
from owned poses, performs source update/refit/optimizer joins, and writes every
active collider's raw AABB in source body/collider order after each solve/clamp.
The tree transaction spans the outer world step. Aborts discard tree, queues,
optimizer counters and staged topology together with physical stages.

The fixed-sphere CCD path consumes a branded current query receipt, traverses
qualified targets in original leaf order and tightens each subsequent cast bound.
Missing or stale ownership fails closed. The optional low-level order module
still relies on its caller to supply complete filtered candidates; FixedSphere
constructs those from its immutable full seed and checks creation identity.

## Evidence boundaries

- Source-operation component: 396 complete trees and 816 query streams match
  original native CPU and actual SwiftShader WGSL. Future trees are assertions.
- Ordered cast component: original before-split fraction
  0.9360221028327942 and post-solve fraction 0.9357571601867676 are reproduced,
  including each incoming bound. Invalid receipt/epoch/generation/origin checks
  are separate from numerical parity.
- Initial-only owned-world CPU replay: all three balls' position, rotation,
  linear velocity and angular velocity match unchanged PhysicsLab through
  h400 with observed maximum absolute error zero. Existing boundary and graph
  checks remain unchanged. The companion actual SwiftShader WGSL world run also passed with observed maximum physical error zero. This is software execution, not hardware performance evidence.

This source-derived corner is engine-accepted speed10, not a manual-UI speed5
case or independent holdout. It does not establish arbitrary live-cue CCD,
all simultaneous dynamic-body configurations, four-ball active CCD, full-shot
coverage, hardware performance or universal numerical identity.

## Final regression checkpoint

- Targeted BVH/order/owner suite: 22 passed, no failures or skips, including
  actual software WGSL, native operation recurrence and async receipt guards.
- Previous h389 two-pass CCD and h393 positive-clamp replay: CPU and actual
  software WGSL both pass, observed physical-state maximum error zero.
- Original corner h400 replay: CPU and actual software WGSL both pass; physical
  maximum error zero, represented graph maximum zero, application boundary
  maximum 3.613176147165831e-9. Six previously unrepresented graph/cache fields
  remain outside the existing comparison, not silently certified.
- New h396 late-BVH rollback and previous h389 second-pass rollback both pass
  on CPU. These are specific failure sites, not a claim about every GPU failure.
- Product tests: 308 passed, no failures/skips. Build, typecheck and 24 official
  styled-component provenance checks pass. Fresh worktrees need the build before
  product tests because several tests inspect generated CSS/distribution files.

The replay child and final coordinator differ only in explanatory capability
metadata/comments in three runtime files; the numerical implementations are
unchanged. Final legacy CPU/WGSL replays and targeted tests run on the integrated
coordinator source. No product backend change, external upload or deployment.
