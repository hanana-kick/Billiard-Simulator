# Pre-strike next-search verification only

Frozen before browser outcomes. Baseline pressure-recovery commit 0434bb76d2a0538c318ba447b066f319ffa82ef2. Candidate source modifies controller and next-shot service only; native timestep, Rapier engine, search algorithms/options and scoring are identical. No deployment.

## Protocol

112 attempts: four known post-shot recipes (default3, shifted3, swapped4, offset4) × forecast-ready dwell 0/2/5 seconds, plus changing-aim default3/swapped4 cells. Each cell has four baseline/candidate pairs, pair order AB/BA/AB/BA; fixture starting index rotates per repeat. Every attempt uses a fresh sandboxed Chrome process and context. Both arms enable next-shot precompute. The baseline is the verified pressure-recovery candidate, not production main.

Changing-aim cells: initial exact full-rest forecast, wait1.5s, change angle+2°, wait matching full-rest forecast, wait1.5s, restore original angle, wait matching full-rest forecast, then final2s dwell. All intermediate setup, prediction, cancellation and work are retained. Pointer movement over the header every250ms during final nonzero dwell measures trusted-event-to-handler/frame delay without changing shot input. These events are the same for both arms. Zero-dwell cells do not intentionally wait after prediction.

Measure configuration→route, forecast latency, actual aiming/dwell, fire→rest, rest→route, fire→route, full-rest replay. Include all finite failures and missing latencies, no success-only headline. Record rAF intervals/longtasks by phase and input response samples. Service lifecycle wrappers capture cancellation/adoption and progress counts; they are observational and identical in both arms. Only candidate has the new methods.

Use Chrome SystemInfo process CPU snapshots at checkpoints as supplementary data. These include browser/renderer/utility overhead; exited processes between snapshots can be missed, and phase boundaries are approximate. Do not claim precise worker CPU or CPU savings. Lifecycle/progress and process snapshots expose speculative waste where measurable.

Each first shot must reach actual physical rest. Compare reconstructed before/after snapshot/game/options, search trace, route settings/contacts, and independently replayed final snapshot/game/native WASM world bytes exactly. Replay must score+1 through full rest with unchanged native world.step. No numeric tolerance. Preserve no-route/timeouts and unexpected errors. The late-opponent-negative correctness prerequisite is covered separately by native qualification; these browser success recipes do not establish exhaustive unseen recall.

Timeouts: navigation/readiness/prediction60s, initial rest90s, post-rest route60s, replay90s. Product search deadline remains20s; diagnostic timeouts are not product latencies. Maximum speculative budget and750ms stable delay are frozen candidate behavior. Tests do not intentionally wait beyond prescribed dwell to make the candidate win.

## Workflow safety

New branch backup/prestrike-speculation-20261105, contents:read, no deploy step. Existing Pages push is main-only and upload/deploy jobs require refs/heads/main. Other backup workflows only validate. Main and branch permissions unchanged. Source hashes are verified before builds; both arms' served HTML/module contents checked during each attempt. All112 attempts run even after a per-attempt failure, artifacts uploaded always. No local browser or personal computer.

## Interpretation

This hypothesis spends idle aiming time earlier. It is not an algorithm CPU reduction. No benefit is expected without useful idle time, and wasted work under input changes must accompany any post-rest win. Timing-related search divergence, deadline expiration, adoption/cancellation failures or physical mismatch block promotion. Report mean, variation, all paired differences and worst values; six prior LTO results are irrelevant to this candidate.
