# Exact condition-only irreversible failure termination

`ruleConfig.conditionOnly: true` now activates the existing private proof latch in the resident chain. Default full-trajectory mode is unchanged. This removes subsequent physical work after a validated permanent gameplay foul; it does not approximate motion or introduce a new failure shortcut.

## Authority and scheduling

Only successful, validated initial/subsequent coupled pair responses emit committed cue/object contacts. The existing gameplay foul proof is latched at that commit. A resident termination phase then marks q status **8: query-terminal**, before any next-event query. Initial termination occurs after q admission, so admission cannot overwrite it. Subsequent termination occurs after response work accounting, so the proof-producing solve remains counted.

Status 8 is not REST. RULE finalization preserves the prefix without injecting REST, BUDGET or UNSUPPORTED. Compact status 5 means an irreversible condition failure, reason 7; score is always `0x80000000` (unavailable). The physical prefix need not reach rest, and no final trajectory/turn/score is claimed. Even if the following motion mode is unimplemented, the previously validated contact still proves the permanent foul. Cancellation before submission or during queued work suppresses publication entirely.

Gameplay-only queries and optional-search-unknown queries can both terminate on a proven gameplay foul: their requested conjunction is already false. Missing kiss facts alone never produce a proof. Positive target completion is not terminal; positive results still require all-ball supported rest and all requested conditions.

## Work removed and retained

All motion, response and query handlers skip query-terminal candidates. The pair packet builder still clears its inactive packet; the contact solver rejects that invalid packet rather than reusing a stale contact. The fixed bounded dispatch schedule and ping-pong copies remain, including small inactive-row validation/accounting work. This checkpoint reduces **actual physical advances/root queries**, not the number of submitted dispatches. It does not claim proportional wall-time or hardware speedup.

CPU mirrors the same ordering, including deferring the initial query until the proof check. Tests cover an actual first-contact opponent foul, later-contact proof exactly at the last allowed response, incomplete immediately before it, optional unknown search, positive goal before rest, and cancellation. Every returned state/statistics/rule/verdict word is compared with native WGSL, not just the compact verdict.

The no-rail prepared planar domain, input guards, material laws, correction budgets and production defaults are unchanged. This is the exact negative-exit policy carried into the new canonical resident candidate path, not a claim of a new optimization over the app's older policy-based search.

Receipt: `docs/evidence/deterministic-condition-only.json`.

## Measured checkpoint

Full native deterministic manifest: **42/42 passed, 26.44 s**. The integration compared **69,300 words across 315 candidate/config combinations**. For the actual first-opponent fixture, full-rest mode performed 95 recurrence response/observation attempts and 145 query nodes; condition-only mode performed **0 subsequent attempts and 0 post-contact query nodes**. Both still execute the initial physical collision, which is not included in these recurrence counters. Full-rest returns completed FAIL/score −1; condition-only returns irreversible FAIL proof/no score.

The later-opponent fixture terminates after 16 attempts: budget 16 preserves the proof, budget 15 reports INCOMPLETE without proof. For the 35-row batches at the same 128-slot schedule, sampled SwiftShader submission times were 149.32 ms full-rest foul, 76.42 ms gameplay-only early foul and 66.35 ms early foul with optional unknown search. These are single diagnostic samples, not a warmed performance study or a hardware-GPU throughput claim. Fixed dispatches/copies still run after candidates become terminal.
