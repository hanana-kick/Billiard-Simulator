# Prepared physical producer → RULE adapter

This opt-in path connects the resident physical event recurrence to the shared
integer RULE reducer. CPU and GPU produce the same physical, work, committed
contact-record and rule words. It is an outcome evaluator for the declared
prepared planar scene—not raw cue input, arbitrary 3D billiards or a release
qualification of all shots. Application defaults remain unchanged.

## Events with a physical source

A dedicated producer record is written from the successful initial pair
response and each successful subsequent pair merge. In the GPU command chain,
these writes occur before the next query can overwrite pending-event IDs or
times. The CPU uses the same committed response data, not next-candidate IDs.
The record stores a monotonically increasing contact serial, pair slots, root
bracket and emitted serial. Solver iterations do not emit duplicate contacts. These are canonical fresh resolved
impact episodes, not the legacy physics.js 120 ms presentation debounce.

Only pairs involving the explicitly declared cue slot emit RULE OBJECT, with
the other slot as subject. Object/object contacts are still recorded as
physical episodes but do not become cue contacts. Cloth landings emit neither
FLOOR nor CUSHION. The current geometry proof either excludes rails/edges or
returns unsupported; it does not fabricate cushion or off-table events.

No certified kiss/separation channel exists. The producer copies validated
rule configuration and forces its kiss-facts capability to false. A no-kiss
search is therefore UNSUPPORTED even if the caller asserted kiss facts.
Gameplay remains a separate channel and can still be evaluated. Three-cushion
requirements cannot become positive from this no-cushion producer.

## Actual terminal state, not early goal

RULE REST is emitted only after physical status3: all spheres are supported
with zero v/q and the prepared profile contains no active cue body. A goal
alone never creates REST or a final positive verdict. Physics budget status5
maps to RULE BUDGET. Unsupported, ambiguous or unhandled physical states map
to producer UNSUPPORTED, overriding positive acceptance in both channels.
Cancellation rejects result publication with AbortError; it is not a miss,
foul or score. Submitted GPU work drains before buffer cleanup.

This first adapter is full-rest only: condition-only configurations are
rejected rather than borrowing a search failure as an early gameplay verdict.
No early foul shortcut is used. Gameplay status and ordered-search status
remain distinct; no synthetic final score is published before actual REST.

## ABI and residency

`createQRecurrenceGPU(device,{rules:true})` enables the optional pipelines;
`run(...,{ruleConfig,cueSlot,...physicsOptions})` requires a validated roster.
The CPU mirror accepts the same options. Target/opponent slots must refer to
actual scene spheres and exclude the cue; game3/game4 must match three/four
physical scene spheres. Materials and physical scene remain
bound by the existing producer.

Each producer output is 32 words (128 bytes): words 0–19 are RULE state;
20 contact serial;21/22 committed left/right slots;23/24 root lower/upper
ticks;25 cue slot;26 emitted serial;27 committed flag;28 terminal physical
status;29 reserved;30 version 0x51525501;31 cue-object episode count.
This is a compact last-record/counter plus reducer state, not a complete path
or contact journal. The immutable adapter context is 64 bytes.

All rule initialization, event reduction and terminal reduction run on GPU
buffers beside the physical recurrence. There is no intermediate readback or
host-derived contact. The final readback returns physics, work and rule state
together. Optional disabled mode retains the previous output shape.

## Actual trajectory checks

A prepared draw fixture uses R=.03075 m, mass=.210 kg, cue x=0/vx=.8 m/s/
qz=1.5 m/s, targets at x=+.08001 and −.09 m, and opponent at +.8 m. The declared
cloth footprint remains the application's 2.84×1.42 m rectangle. Its actual
motion contacts both targets, then rests. A later target/opponent contact
correctly does NOT foul the cue. Landings occur but never become FLOOR.
No velocity, collision, outcome or terminal state is injected after input.
This fixture is not proof a real raw cue stroke produces that prepared state.

The weaker qz=.96 fixture reaches only one target and returns FAIL after rest.
The exact +.08 initial placement triggers an existing conservative initial
bracket refusal and returns UNSUPPORTED. Neither is relabeled as success.

Tests also cover actual first cue/opponent foul, separate three-cushion
GAME failure with unrestricted-route PASS, no-kiss unsupported search,
budget exhaustion after a physical two-target goal but before rest, and
cancellation. An actual-trajectory native batch compares every output word;
see `evidence/deterministic-physical-rules.json` for measured counts and costs.

Remaining gaps include certified kiss facts, actual cushion/off-table events,
non-collinear/airborne multi-body response, anisotropic raw cue solve and
release-wide validation. The existing fixed-budget resident dispatcher is
not a claimed hardware-GPU speedup.

## Native checkpoint receipt

The combined deterministic manifest (including standalone RULE tests) passes
39/39 tests in 26.52 s. The final roster-guard focused native rerun passes 2/2.
Across 105 physical/configuration/budget combinations, all 22,680 physics,
statistics, RULE and committed-record words match exactly. The unrestricted
batch has 30 gameplay/search passes from 35 trajectories; five remain physically
unsupported. The no-kiss batch has the same 30 gameplay passes and no search
passes (unsupported search capability). Budget2 produces no positive result.

For 35 candidates the allocation is 132,768 bytes, including a 128-byte producer
record per candidate and a 64-byte shared rule context. A 128-attempt run has
1,160 dispatches and 128 resident copies, zero intermediate readbacks and one
final readback. The combined-run compilation took 5.39 s; full-budget submits
were 141–220 ms on SwiftShader. Fixed dispatch/CPU-mirror/physical validation
costs are not hidden, and these software-GPU timings imply no hardware speedup.

## Compact query result follow-on

See [compact candidate finalizer](deterministic-candidate-finalizer.md). Rule-enabled GPU calls now default to a 16-byte combined verdict, with `diagnostics:true` required for the full state/rule output described above. Producer word 29 is a latched validated irreversible foul proof (not a final score); condition-only early termination is not yet enabled.

The subsequent [condition-only checkpoint](deterministic-condition-only.md) enables explicit `conditionOnly:true` using the committed proof latch and q status 8. Full-trajectory mode still runs to actual rest; no other route/kiss rejection shortcuts were added.
