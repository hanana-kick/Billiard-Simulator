# Frozen shadow-depth reuse validation

Baseline: deployed d21e9ec2260f7c23e220a2e17baed81a5cf39380. Candidate changes renderer shadow-depth caching only. No physics, solver, deadline, input policy or main deployment change.

## Exact framebuffer and invalidation gate

Actual baseline/candidate WebGL2 LabRenderer classes run on same page/backend, same restored physical state. All RGBA bytes must match exactly, no tolerance. Each frame additionally asserts baseline depth pass count1 and candidate expected hit/miss. Test3/4-ball scenes: initial/repeat, yaw/pitch/zoom, ball translation/rotation, preview cue visibility/angle/pull, static transform, material color, light matrix, resize, explicit resource init, camera after init, test-managed context loss/restoration with init where supported, actual cue creation/motion/hidden. Context restoration is enabled and initialized by the test for both classes; not a claim that the product automatically recovers. No screenshot artifact uploads. Output hashes, byte mismatch counts and coverage records. Unsupported context extension is explicitly recorded, not counted as passed restoration.

Stop timing workload if exact pixel or pass-invalidation gate fails. Preserve failure evidence. Calibration separately checks external trusted input queued during150ms main-thread stall against synthetic control; callbacks use performance.now entry, not the rAF timestamp argument.

## Repeated workload

24 fresh sandboxed Chrome processes:3/4-ball × actualUI idle/orbit × baseline/candidate ×3 repeats. Each cell has paired arms, ordering alternates by repeat/fixture/mode; There are four fixture/mode cells and three repeats each. Manifest records exact24 order before execution. Same existing frozen3/4 requests. Each process has5s pre-search idle/orbit, then identical search until first verified result or120s infrastructure watchdog. Request solveTimeMs=3600000 avoids timing-dependent search censoring; replay independently goes to full rest with exact+1 game verification. No request hidden or failed attempt excluded.

Trusted CDP floor orbit uses held left-button state and verifies the controller classified orbit and renderer consumed a sequence before search. Input handler, rAF callback entry, render submission/return/bitmap draw are distinct boundaries; no actual display presentation claim. Produced/drawn frames are not monitor FPS. Actual worker WebGL backend, SystemInfo GPU/CPU/OS/Chrome flags recorded. Hardware absent means hardware not tested; software GPU results cannot establish Android/Mac performance.

Diagnostic wrapper records cumulative depth/main command submissions and synchronous CPU submission wall time, plus timer-query extension availability. No unsupported GPU-duration claim. Trace and per-process CPU counters retained; process deltas are an incomplete lower bound if a process exits between samples. Shader compilation/cold startup excluded from search but pre-search costs retained.

## Assessment

All pixel/physics/full-rest comparisons, strengthened real-app UI and no-error gates required. Report each cell's three pairs, all failures, median/mean/range, trusted input/renderer latency p95/worst and frame rates, CPU total/by process, cached-depth hit rate. A promising candidate requires all three orbit pairs in both3/4 cells to improve search wall, mean orbit gain≥5%, no idle mean search regression>5%, and no per-cell input-handler p95 regression>5ms or renderer-consumption p95 regression>10%; no CPU mean increase>10%. Small sample results remain pilot evidence, not broad equivalence or hardware qualification. Thresholds fixed before timing; no post hoc tuning.
