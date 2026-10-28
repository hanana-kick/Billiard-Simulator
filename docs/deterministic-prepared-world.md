# PW1 full-state world entry and bounded pair continuation

This is an experimental GPU-canonical component, not the production evaluator.
It removes the requirement to manufacture directional scalar inputs after a raw
strike or a 3D response. Perfect isotropic spheres require p/v/q, not attitude.

## PW1 ABI (192 u32 words)

Header32, followed by four40-word slots. Unused slots and reserved words are zero.

| Header | Meaning |
|---|---|
|0|`0x50575201`|
|1,2,3|candidate ID, complete3/4 sphere count, absolute Q20 clock|
|4,5|model version1, canonical-local profile1|
|6,7|source kind(raw1/prepared2/response3), selected slot|
|8,9|opaque scene/request transport keys (not geometric certificates)|

Each body: stable ID0, equal physical/collision radius1 and mass2(Q24), pXYZ4–6,
vXYZ8–10, qXYZ12–14. All other words reserved. There are no mode hints, inferred
directions, projected spin components, or caller-supplied collision proofs.

The initializer checks the shared v-norm8/q-norm16 domain without clipping,
complete IDs, immutable sphere dimensions/material, support/flight geometry,
finite cloth and conservative static bounds. Modes are rebuilt from actual
components. Fresh local receipts describe a declared encoded model anchor;
`preImpactPhysicalEnclosurePreserved:false` and `globalReceiptCertified:false`
are explicit. A source-kind label is not authentication of a raw-strike result.
The engine contract must bind actual request/scene/source ownership separately.

`createPreparedWorldGPU(...).createBank(worldBuffer,count)` initializes resident
state/dense buffers (256 words per candidate each), with no readback. Valid public
CPU inputs are strictly validated; the low-level GPU initializer returns pending
reason64 for an invalid/zero packet, allowing failed raw producers to remain
inactive. Such invalid-packet outputs are not an admitted physical trajectory.

## Bounded recurring-world coverage

The new resident entry currently admits rolling/rest worlds for first-event
selection. Initial generic sliding or flight remains pending82, preserving full
state; it is not converted into the directional family.

One globally qualified rolling pair entry uses the existing real common-point
3D pair+cloth solver. Every body advances to the same upper bracket. Full p/v/q
is merged, selected motion is rebuilt, and the solved episode gets a temporary
release token. The token is removed only after whole-prefix radial separation
and strict endpoint clearance. It is not a permanent collision exemption.

One mixed support/flight prefix may complete an isolated cloth landing. The
landing is not a gameplay FLOOR foul. Supported smooth/bridge/rolling recurrence
then resumes. Later unimplemented pair or flight branches remain pending; this
is deliberately not a generic full-table repeated-impact engine.

The original clear-tail fixture still reaches model REST. The genuine-hit
perturbation qualifies pair slots1/3 at absolute tick532997, lands at548887, and
continues to562312. It then stops at the tangential-spin-near-zero domain boundary:
body3 has |slip|≈0.3071269m/s and |qt|≈0.00149064m/s. The old all-slip-stop bridge
would require49484ticks and exceeds unchanged local budgets. This is not a
near-slip-zero event, and no spin-zero projection or material change is applied.

Already-rest zero duration is valid. Incomplete rolling tails cannot be turned
into REST by a clear geometry query. Work exhaustion, geometry budgets,
out-of-domain endpoints, clock overflow and cancellation remain non-results.
The first-entry diagnostic may describe an attempted, uncommitted entry on a
failure path; scoring must use successful committed responses only.

## Separate total shot budget

`durationTicks` is a LOCAL segment cap, not total elapsed shot duration. This
component's absolute-clock/work guards do not yet make it a complete consumer of
the engine contract's `maximumTicks` (which includes raw strike time). The
original immutable shot-clock/deadline must be threaded into later integration;
no handoff may reset it. No contract-complete raw-shot or gameplay verdict is
claimed by this checkpoint.

## Measured native checkpoint

Five focused tests passed, including six initializer cases (3,072 words) and eight
world cases (6,144 words), all words equal to their CPU mirror. The matrix covers
model REST, qualified pair, landing, unchanged-budget boundary refusal, zero-time
rest, clock overflow, geometry budget, initial generic sliding refusal, and
cancellation publication suppression. WGSL module preflight precedes all pipeline
lowering, so parser failures do not wait behind earlier expensive pipelines.

The software Vulkan run compiled in22.13s; the64-step genuine-hit case submitted
4,230 fixed dispatches and completed/read in1,071ms. Application buffers78,440B;
zero intermediate readbacks or host physics. Fresh final `RUSAGE_CHILDREN`
maximum1,056.26MiB and sampled aggregate1,094.42MiB are separate measurements. These
are not hardware GPU speed claims. Receipt: `artifacts/deterministic-prepared-world/native-receipt.json`.

## Original shot deadline (request-bound continuation)

`prepareCanonicalWorldContinuation(request, shotClock, options)` owns the immutable
request's complete finite table and equal-sphere roster. The clock is the original
`createCanonicalShotClock`/raw binding, including elapsed strike time. The wrapper
never creates a new clock from the PW1 post-strike tick. Opaque scene/request keys,
stable IDs and selected slot must match; these keys are transport checks, not a
replacement for the owned exact request identity. A supplied PW1 is a trusted
canonical producer checkpoint, not proof of an arbitrary external trajectory.

`runCanonicalWorldContinuationCPU` and `createCanonicalWorldContinuationGPU`
use the same absolute deadline. Resident gates cap each common-time smooth/mixed
prefix and pair search by remaining time. A tail longer than the remaining time
cannot produce REST, even when the shorter geometry query is clear. Exact
completion at the deadline is allowed. At zero remaining time, only an already
admitted roster with every velocity and surface-spin component exactly zero and
no unresolved contact episode may be recognized as model REST. Other active
states return INCOMPLETE (`reason84`), preserving their state and clock.

The existing `maxWorldSteps`, geometry-node and local numerical budgets remain
separate. This wrapper **does not yet enforce the contract's cumulative
maximumWorkItems/maximumEvents across raw and continuation phases**, does not run
the rule reducer and returns no gameplay verdict. Its receipt says so explicitly.
The component-level `deadlineTick` option by itself is not request-identity proof;
use the wrapper to retain the original clock binding. Initial generic SLIP/FLIGHT
still returns pending82 in this bounded world path, without projection.

## Qualified qt-neighborhood continuation

The world path now distinguishes a failed smooth-domain certificate from a
proven slip-stop event. On a singular smooth proposal it evaluates the original
slip-stop comparison and the separate short qt-neighborhood comparison. A qt
proposal is selected only when its actual proof succeeds. Every selected body is
then evaluated again at the **same fixed common duration** as all other bodies;
individual adaptive search durations are never merged as if simultaneous.

The qt reference retains the real rolling-resistance discrepancy in its local
receipt, all spin components and the ordinary inflated whole-prefix pair/hull/
cloth clearance. It returns SLIDING, not zero spin or rolling. The swept geometry
receipt remains separate from the restored endpoint receipt. Canonical-local
execution retains accumulated diagnostics separately; no global-through-impact
certificate is asserted.

World header35 counts actual slip-probe/fixed-slip evaluations,48 counts qt trial
evaluations (not normalization operations),49 counts committed qt prefixes.
The original prepared batch kernels are unchanged; this is a world-only adapter.
The genuine-hit fixture now passes its actual pair response and cloth landing,
then the qt neighborhood, and reaches canonical model REST. This still is not
RULE PASS, arbitrary raw-shot coverage, or a universal physical-accuracy claim.
