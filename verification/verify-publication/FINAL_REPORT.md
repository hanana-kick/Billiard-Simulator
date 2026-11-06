# Verified-row early publication: validation result

## Recommendation

Keep this as a qualified, limited display-latency improvement on the validation branch. Do not describe it as the fix for the user's roughly ten-second first result or high CPU, and do not deploy it without a separate decision. It removes completed-verify wave waiting, but practical default layouts barely improve and total CPU does not decrease.

Final candidate: `86a1a306d429c80c5ae5dd6e6bec853b37691cca`, branch `backup/verify-publication-final-20261106`. Main remains `cf7521de07fb03612650835114d2b5023600ff8c`; no deployment was performed.

## Actual Chrome comparison

Run: https://github.com/hanana-kick/Billiard-Simulator/actions/runs/42199176204

24 attempts passed: four layouts × three repeats × alternating baseline/candidate arms. All 29 returned routes scored in separate normal-game full-rest replays. The candidate returned 15 total routes versus baseline 14 (default3 6 versus 5; all other groups 3 versus 3). No observed recall loss; these finite runs are not an exhaustive domain guarantee.

Chrome 156.0.8078.79, GitHub Ubuntu 24.04, four reported AMD EPYC 7763 CPUs, browser sandbox enabled. Both arms opened the route panel, used original default inverse options, and resumed normally for up to three slices. Predictor/precompute were disabled for this isolated foreground comparison; their real lifecycle boundaries are covered by the full app suite.

Medians, baseline → candidate:

| Layout | First visible route card | Verify complete → visible card | Whole-search Chrome CPU lower bound |
| --- | --- | --- | --- |
| Default 3-ball | 58.086 → 57.963 s | 167.5 → 9.2 ms | 222.14 → 223.56 CPU-s |
| Default 4-ball | 28.541 → 28.733 s | 31.7 → 9.5 ms | 148.04 → 148.86 CPU-s |
| Moved 3-ball | 33.804 → 31.601 s | 2310.9 → 32.4 ms | 157.42 → 157.68 CPU-s |
| Moved 4-ball | 27.950 → 26.935 s | 1171.7 → 21.6 ms | 148.59 → 149.53 CPU-s |

Moved-layout first-card median gains were 2.20s and 1.01s. Default3 gained only 0.12s; default4 did not improve. No solver work is removed and search does not automatically stop at early publication, so intrinsic CPU savings are not expected. CPU medians rose 0.17–0.64%, a small difference in three-replicate measurements, not evidence of a CPU saving. Summed CPU-seconds across processes are not wall time or a single-core CPU percentage. Samples omit unobserved exited-process work and are lower bounds.

First-visible-card timestamps use a visible DOM card observed at the next animation frame, not a compositor pixel-present trace. The earlier baseline-only 12-attempt experiment did not open the route panel or measure visible cards; its 19–27s first state publication is not directly comparable to the panel-open experiment. Original report-start timestamps are lower bounds; the table uses completed-outcome timestamps to independently observed visible DOM instead.

## Safety and behavior

- Optimizer report now asks the inverse planner for a detached union of committed rows and completed current-wave verify rows.
- Shared commit/overlay admission checks issued immutable job binding, current pending request/wave/branch/probe, exact settings/topology and independent replay flags. Source-gameplay receipts use both matching and verified-gameplay checks.
- No solver inputs, work ordering, root updates, physical steps, complete-wave commit barrier, archive/counter updates or cancellation ownership are advanced by projection.
- Pending rows explicitly carry `verified-pending-wave`; committed branch status is not fabricated. Rows survive retained cancel/resume and deduplicate/order consistently.
- UI selection follows the displayed physical identity if numeric row IDs reorder. Admission exceptions reach onError; queued messages after failure cannot publish.
- Existing three-ball route-query completion semantics are preserved, not relabeled as all-balls-rest gameplay. Four-ball full-rest admission and independent all-route replay checks remain intact.

## Qualification

Final full application: https://github.com/hanana-kick/Billiard-Simulator/actions/runs/42200110298

- 481 npm regression tests passed.
- HOST: 279 passed, 7 explicitly skipped.
- Full real-app UI: 73/73 passed in 9.3 minutes, including default inverse live replay, precompute/exact-rest/cancel/resume, settings, narrow screens and Korean font.
- Typecheck, build and provenance passed.
- Final canonical CPU/WASM suite: https://github.com/hanana-kick/Billiard-Simulator/actions/runs/42200110058 passed. Native WebGPU qualification remains skipped/not claimed.
- Comparison used runtime commit e4e42898. Final 86a1a306 changes only an expected planner hash/test description and status documentation, with no product-source difference.

The supplemental fixed-clock real-physics differential passed both layouts in a clean, one-time run with unchanged bounds: default3 26 waves / 321 evaluations / 1,624,990 physics steps; default4 79 waves / 1,318 evaluations / 7,291,941 steps. All 1,639 per-outcome overlay purity checks passed; jobs, settings/topology, full solver states, counters, committed routes and ordering exactly matched cf7521de. Ten shared solver/physics dependencies remain byte-identical. The clean traces are byte-identical to the earlier final traces. This is a serial fixed-clock equivalence check through first success, not a latency or exhaustive-recall proof. Default4 finished in 286.7s near the unchanged 300s bound. Older interrupted-process output overlap remains separately documented and is not erased by the clean run.

## Preserved failures and evidence

- Initial full run 42199176097 failed on the obsolete planner SHA pin. HOST/UI stages were skipped. The exact planner pin was updated for the reviewed change; all physics/solver/evaluator/geometry/CPU-event pins remained unchanged. The original failed log is retained.
- Local browser launch failed before page creation due the environment's socket/crashpad restriction. No sandbox bypass was used; Chrome qualification ran on supported GitHub runners.
- A new selection-test harness initially omitted RenderCadence. Its failure log is retained; adding the required test dependency passed.
- Differential harness cross-realm assertion/interrupted-run/overlapping-writer limitations are preserved in `retained-attempts.md`; overwritten older raw bytes are explicitly disclosed, not reconstructed.

Original downloaded artifacts retained and SHA256 verified:

- Baseline 13492657479: cf6a64dda10c10652dfab80bac9e280bcbab4e90cee9d28b321d276fdc010f69
- Comparison 13494029514: 0fd54dc4ce1038857331a5dd093af08ec98cc8131e0cd9d41e118a508f9c9f77
- Final UI 13495041384: 907c216d5ba2f62b3428335b109838fac301b8086e95348e65b19131dbe59a2a

Raw attempt JSON, CPU samples, route settings and full-rest scores, reproducible scripts, final metrics and candidate.patch are retained alongside this report.
