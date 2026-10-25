# Commit-only four-ball inverse receipts

`LabFourBallWorldExperimental.createReferenceStepper(seed, {observeInverse:true})`
and `createGpuStepper(device, seed, {observeInverse:true})` expose a frozen,
detached `snapshot().inverseObservation`. Omission/false leaves the old snapshot
shape and performs zero additional inverse point projections. This is an
experimental producer, not public search integration or a physical scorer.

The initial receipt is sequence 0. Each successful `world.step()` publishes one
receipt in the shared `LabInverseEvents.observation` contract. Completed worlds
retain their last receipt; consumers must not feed it again. Native CPU inverse
continues using its demand-driven geometry adapter, not this eager four-rail path.

## Exact boundary

Cue-present stepping copies solved translations before the application angular
patch, and reads sealed pending raw pair/cushion caches with the owner token.
Post-cue stepping obtains final clamped translations after all internal CCD passes;
the shared CCD helper invokes the optional preparation hook once, before events
and the angular patch. The pending reader additionally authenticates the final
CCD pass. Neither pre-clamp bodies nor presentation contact events are substituted.
Positive raw manifold impulses define impact, independently of solver-row activity.

All four selected-ball rail projections use original identity-pose convex hulls
and Parry solid-query semantics. GPU mode dispatches the actual shared WGSL query;
reference mode uses the corresponding source arithmetic. No plane approximation.
Time is the previous application JS clock plus the native f32 integration dt, not
the subsequently advanced presentation clock. Sequence counts external world
steps, not internal CCD passes.

Preparation/query exceptions abort the owning transaction. The receipt becomes
public only when the complete world commit assigns `state=next`; no callback is
issued and no speculative receipt escapes. Subsequent transactions cannot mutate
a previously returned receipt.

## Reproducible acceptance

`node --test tests/inverse-world-observation.mjs` generates a separate original
native CPU trajectory, imports only its raw capture through the pinned browser
snapshot decoder, and compares the candidate owner against original receipts.
The candidate process has no native PhysicsLab/Rapier continuation. The oracle
records hashes of its native engine, physics, controller and route-rule sources.

Settled four-ball positions (x,z): 1=(.9,0), 2=(-.4,.4), 3=(1.25,0),
4=(-.6,-.3). Original settings: angle0, elevation8, speed2, tipX=tipY=0.
727 successful steps include cue-present and 280 post-cue outer steps, and two
actual object3 contact episodes (h571 and h727). Shared reducer receipt/event/
residual comparisons retain exact time/dt/order and 1e-6 position tolerance
(the existing four-ball pose comparator threshold). Reference measured maxima are exactly 0 for positions, projections, residuals and
other numeric fields; the test reports maxima separately from acceptance limits.
Tests inject failed observation queries in both branches, require unchanged full
snapshot, then compare retry to original. Opt-out query count is zero.

Native GPU execution requires `REQUIRE_WEBGPU=1`, `GPU_NATIVE_MODULE` and a
working Vulkan ICD; use the GPU test name filter when reference validation is
already complete. Actual WGSL/software-Vulkan acceptance passed all 727 steps in 76.9 seconds,
including both-branch failure/retry. Measured maximum errors were exactly 0 for
positions, solid projections, residuals and other numeric fields. Software Vulkan
proves WGSL execution, not hardware speedup.

## Retained empty-contact flight boundary

The genuine speed4.5 case formerly failed at h311 after original first impact
h309. That **specific physical admission gap is resolved** by the bounded shared
owner dispatch: cue cloth and sphere manifolds refresh empty while their broad
edges remain retained; original floor free-flight integration continues, and the
sphere edge is deleted at h312. The continuous-cloth guard is unchanged. Full
independent CPU/GPU physical acceptance through rest h7228 is recorded in
[`retained-flight-evidence.md`](../tests/retained-flight-evidence.md).

The observer regression now checks this genuine source through its second contact
h374 rather than expecting the obsolete h311 rejection. It compares every frozen
receipt, exact sequence/time/dt/impact episode, reducer event/mismatch and residual
against the untouched original CPU at the existing 1e-6 tolerance. At h311, h312
and h374 it injects two consecutive observation-query failures, verifies the full
prior snapshot and receipt remain unchanged, then compares the successful retry
to original. Existing cue-present and first post-cue failure checks remain.

Integrated speed4.5 receipt acceptance passed independently on CPU reference and
native WGSL/Vulkan SwiftShader: **374 committed receipts each**, original object3
contacts h309 and h374, with **zero measured error** in positions, projections,
residuals and other numeric receipt fields. Each backend passed eight injected
query failures (cue-present, first post-cue, and twice at each of h311/h312/h374),
with unchanged full snapshots/receipts and successful original-matching retries.
No reader/commit interaction failure occurred. Results are exactly equal except
for the backend label; the GPU owner was released. CPU took 34.1 seconds and GPU
47.7 seconds in these tests—not a hardware-performance claim.

Proof and artifact hashes: [retained-flight inverse observation](evidence/retained-flight-inverse-observation.json).
The focused cases can be reproduced with `--test-name-pattern='legitimate faster
return reference'` and separately `'legitimate faster return GPU'`; GPU requires
the same environment described above. `INVERSE_WORLD_RESULT_DIR` writes result
JSON; default original artifacts stay in the worktree's `artifacts` directory.

This bounded observer correction does not establish general shot admission,
arbitrary contact topologies, full-rest inverse scoring, or public GPU search
completion. The independent physical full-rest evidence remains separately scoped.

## Independent batch owners

`createGpuBatchStepper(device, seeds, {observeInverse:true})` accepts one uniform
boolean for the batch, copied before asynchronous construction and passed to each
world. The default remains off. Public batch views copy and re-freeze each receipt;
no receipt shares mutable storage with another owner or earlier view. Sequence
remains each world's committed frame, not a batch-global counter. Cancellation or
failure retains that owner's last committed receipt; siblings can independently
commit (there is deliberately no cross-world atomicity).

Host orchestration coverage is in `experimental-multishot-world-contract.cjs`.
Actual native coverage uses `BATCH_INVERSE_OBSERVATION=1 REQUIRE_WEBGPU=1` with
`live-registered-multishot-batch.mjs` and the test-name filter
`opt-in independent|one real world|cancel and actual`. It checks two distinct
pinned source inputs, eight exact reference receipt steps, native multi-owner
plan/row witnesses, frozen snapshot lifetime, independent rollback, in-flight
cancellation and actual device loss. It does not activate public GPU search.

Acceptance: host coordinator 8/8 passed; actual software-Vulkan batch/lifecycle
3/3 passed (64.8 seconds total). Placed and awake sources matched all eight
reference receipts exactly. The witnessed dispatch had two owners/two requests,
eight logical rows, one dispatch/readback, and matching native plan buffer sizes.
All cancellation/device-loss modes retained sequence0; the injected failed owner
retained sequence1 while its sibling progressed to sequence3. Native tracked
buffers were released. This is execution/parity evidence, not a hardware-speed claim.
