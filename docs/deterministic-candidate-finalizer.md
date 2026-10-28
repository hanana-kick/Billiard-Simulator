# Compact candidate verdict (experimental)

The rule-enabled resident recurrence now finishes with a GPU-only finalizer and defaults to **16 bytes per candidate** read back: `[candidateId, status, reason, gameplayDeltaBits]`. CPU `runQRecurrenceCPU` includes the identical `verdicts` array alongside diagnostic state. GPU `{diagnostics:true}` returns all state/statistics/rules plus verdicts (880 bytes per candidate); the default returns only verdicts and dispatch/allocation metrics. No intermediate readback or host physics was added.

## Result contract

Statuses: 1 PASS, 2 FAIL, 3 INCOMPLETE, 4 UNSUPPORTED, 5 irreversible condition-only failure proof. Reasons: 0 accepted, 1 gameplay failed, 2 requested search failed, 3 work exhausted, 4 physical completion unsupported, 5 requested search unsupported, 6 gameplay unsupported, 7 earlier irreversible proof.

PASS requires actual supported all-ball rest, gameplay PASS, and requested search PASS (if enabled). Completed gameplay FAIL proves the conjunction false even when optional search is unknown. Physical incomplete/unsupported cannot become MISS. Completed gameplay PASS with missing no-kiss facts remains UNSUPPORTED.

The fourth word is **gameplay score**, not a success flag: signed i32 bit patterns `0xffffffff` = valid −1, `0` = 0, `1` = +1. `0x80000000` alone means no final gameplay score. A completed known gameplay score may accompany an unsupported combined query.

## Proof and cancellation boundaries

Producer record word 29 now latches the existing validated gameplay-foul proof immediately after a successful committed cue/object impact, before later operational budget/unsupported tags. The private finalizer supports this earlier irreversible proof taking precedence over later budget/unsupported, with status 5 and unavailable final score. **Condition-only activation/early dispatch termination remains unwired:** the public physical producer still rejects condition-only config. Tests of this finalizer branch use explicit private-producer unit records, not fabricated physical trajectories or a claim of accelerated early termination. Ordinary full-rest calls ignore the proof latch for finalization.

Cancellation remains outside the kernel: an aborted call publishes no result, including after queued GPU work completes. Stale/untrusted producer packets are not a public finalizer API contract. The latch is not generated from a pending pair query, solver iteration, or arbitrary endpoint.

## Validation and cost

Tests compare every physical/state/rule/verdict word, actual draw-to-two-targets then rest, missing kiss channel, completed foul with valid −1, budget after a goal, unsupported physics, and cancellation. Direct CPU/WGSL finalizer tests independently cover retained negative proof after budget/unsupported. The final stage is one additional dispatch, a 16-byte resident output per candidate, and no new physics. Diagnostics are optional, not part of the normal returned payload. SwiftShader timings are software-backend measurements, not hardware performance or a full raw-shot release claim.

Receipt: `docs/evidence/deterministic-candidate-finalizer.json`. Existing prepared planar/no-rail domain, finite geometry guards, raw-cue/general-angle/cushion/kiss limitations and disabled production defaults remain unchanged.

Checkpoint measurement: full deterministic native manifest **41/41 passed in 24.35 s**. The physical/rule integration compared **30,800 words across 140 candidate/config combinations**, plus direct finalizer negative-proof cases. A 35-candidate default compact run returned **560 bytes** (versus 30,800 diagnostic bytes), allocated **103,648 bytes** of application buffers, and took **146.35 ms** submission-to-completion on SwiftShader. Pipeline compilation was **4.86 s** for the full composed chain, not the finalizer alone. These are total chain costs, not evidence of a hardware speedup.

### Condition-only activation

The subsequent [condition-only checkpoint](deterministic-condition-only.md) activates the previously unwired proof branch. Full-trajectory defaults remain unchanged; condition-only failures are query-terminal, never REST or final gameplay scores.
