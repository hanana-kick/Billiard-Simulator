# Canonical resident landing chain (experimental)

One prepared directional candidate now executes:

1. Actual globally isolated pair impact, using full 3D pair + cloth response.
2. All-body, common-time supported/flight tube-clear prefix.
3. Earliest admissible cloth landing, with all other bodies advanced to its upper tick.
4. Full 3D cloth response with explicit immutable cloth restitution and 2D friction.
5. Rebuilt motion followed by one more landing cycle, or an explicitly requested supported observation prefix.

This is **not a full-shot evaluator**. No REST, score, or gameplay FLOOR event is emitted. A successful state means a completed local prefix/response only; `continuationPending:true`, `restCertified:false`, `physicalAcceptance:false`. Production defaults are unchanged.

## Numerical and geometric contract

The canonical numeric state is Q24 p/v/q, Q20 time, with q=R*omega. Existing material laws are retained. Input cloth restitution must equal the original directional candidate's cloth restitution; pair restitution is separate. Every ball shares the same absolute clock. Landing uses the reviewed component's bounded upper-time/root-geometry representative: the selected y and pre-vy corrections are explicit in its receipt, while all other balls advance to that same upper tick. No arbitrary support-height projection is made.

All flight root intervals are compared. Any uncertain/overlapping competitor is pending. Supported motion must pass SMT2 on the **same entire duration**, excluding a hidden slip/q boundary; a shorter accepted segment cannot be mixed into this clock. Entire-prefix pair, actual-hull AABB, other-static AABB and finite-cloth footprint checks remain active. The selected landing's y-correction bound enlarges its geometric envelope. Only its end-point cloth clearance test is exempted, because its validated landing is the event being handled. No other pair or static is exempted.

The original solved-pair release is used only in the initial tube prefix. All landing cycles set the old pair token to NONE, so that pair is tested normally thereafter. Each response keeps all v/q components and marks old motion coefficients dirty. Positive rebound is retained even though the landing impulse is positive; its mode comes from the isolated restitution postcondition, not a zero-normal-impulse test.

The input `durationTicks` is the flight/root-search horizon. `continuationTicks` is the requested no-flight supported observation horizon (defaults to `durationTicks`). `cycles` is a bounded number of attempts, 1 or 2, **not** a guarantee of that many landings. Exhaustion does not mean rest. A flight with no landing within the horizon is pending; it is not declared a miss.

## Error receipts and scope

Unchanged supported bodies carry their existing joint kinetic radius, position radii and normal-spin radius into the next SMT2 segment, with the same caller budgets. There is no repeated box-to-metric inflation or reset of those supported receipts. Rest/normal-spin rows use an outward monotone soft-threshold interval transform: zero drag preserves radius, complete damping may contract it to zero, and any remaining radius must fit the unchanged qy budget.

A successfully resolved landing establishes a new **canonical nominal response anchor**, not a proof that an incoming continuous physical uncertainty set maps to zero uncertainty. The component therefore explicitly returns `preImpactPhysicalEnclosurePreserved:false`; strict global physical-enclosure continuation across an impulse is not asserted. Ballistic position packing and selected landing corrections remain separately reported. This distinction does not discard any canonical state component or change material parameters.

## Resident execution and diagnostics

Initial 10 phases, then 9 phases per cycle: packet build, landing roots, global selection/common-time preparation, three smooth phases, geometry clearance, landing response, commit. No intermediate readback or host physics. CPU executes the same integer operations. Final diagnostics include every phase result; a computed landing response packet is a **proposal**, not an event until the commit header increments its successful landing count.

State header additions: 17 selected landing index+1 (zero for observation), 18 chain version `0x4c434801`, 19/20 relative lower/upper ticks, 21 committed landing count, 22 last landed index, 23 absolute committed impact tick, 24/25 last y/pre-vy corrections, 26 zero gameplay FLOOR count. Body word40 is current mode: rest-translation/normal-spin-only 0, supported 1, flight 2; none is a whole-world rest assertion.

Pending reasons: 20 rejected landing root, 21 overlapping landing intervals, 22 no landing inside flight horizon, 23 invalid next-mode/range, 24 rejected response, 25 inconsistent representative position, 26 normal-spin error budget. Existing prefix reasons retain their meaning. Operational budget failures remain status5, never MISS. Cancellation captures the original signal and suppresses publication even if queued GPU work finishes.

## Bounded evidence

The prepared four-ball fixture has an actual angled pair impact at tick28,939 and shared prefix to54,965. First landing commits at54,967. With e=0 it then advances every ball by the caller's2,000 ticks to56,967; with e=.2 it commits a second landing at60,173. The two-landing fixture gives the unrelated moving ball longer initial tangential spin; the original shorter-spin fixture remains a negative test that stops before its genuine earlier slip boundary. There is no hardcoded outcome or enlarged table.

Independent checks assert actual 2D friction impulse, unchanged normal spin, rebound/support postcondition, common clock and unmodified fixed budgets. Negative tests cover earlier regime boundary, footprint, overlapping roots, upstream/smooth budgets, restitution mismatch, cancellation and normal-spin interval budgets. Native receipt is in `docs/evidence/deterministic-landing-chain.json`; it is SwiftShader, not hardware performance evidence.
