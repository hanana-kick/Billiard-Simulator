# Predeclared Chrome verification

No browser was launched while preparing these files. Publish/run is owned by the parent.

## Files to stage

- verification/resume-background/chrome.cjs
- verification/resume-background/audit-init.js
- verification/resume-background/source-hashes.json
- verification/resume-background/baseline-controller.js from controller-original.js
- verification/resume-background/baseline-next-shot-service.js from next-shot-original.js
- Reviewed fixed src/controller.js and src/next-shot-service.js
- stop-first-chrome.yml replaces .github/workflows/stop-first-chrome.yml

Both arms must retain the same quantum8192 inverse-planner, physics, forecast, optimizer and all other runtime files. The source manifest asserts exact build-newline-wrapped source hashes. No whitespace normalization or unknown hash is accepted.

## Fixed matrix and limits

Four condition shards: queued forecast, in-flight forecast, queued aim timer, active aim computation. Each shard runs four baseline/fixed pairs in AB/BA/BA/AB order, one runner per shard: 32 cases total, no retries. Desktop viewport 1280x850. No additional mobile coverage is claimed.

Real UI Search obtains a retained verified route with at most three slices, at most two no-result Resumes, 45 seconds per observation and 120 seconds total preparation. A genuine default3 ThreeBallGame is required. No scene injection is used. Actual UI prediction off/on refresh occurs after the first result; it is controlled setup, not an estimate of ordinary user behavior. Prediction and precompute are on at Resume, and settings/options must remain unchanged. Each condition is bounded to eight seconds and must still be true synchronously inside the actual Resume handler. Unreached/missed conditions are uncovered failures, never synthesized or retried.

Three-second early Resume CPU window. Queued-condition cases alone allow at most four additional natural slices, observed up to 25 seconds each, seeking a new identity; absence makes that qualification false. Existing identities and completed-job retention/no redispatch are checked. This additional measurement precedes all controlled stale-callback delivery.

Controlled stale-timer and real-result callback delivery is a separately labelled window and occurs only if foreground search is still running; otherwise it remains uncovered. Actual Stop is used if searching. Forecast restoration/cache is observed for at most eight seconds, followed by a three-second CPU observation. Natural completion without a Stop is explicitly not Stop-restoration coverage.

## Instrumentation scope

Verification-only wrappers append to exact original Blob worker source. They preserve function arguments, return values, thrown errors, physics/planner inputs and outputs, and scheduling delays. Hashes of original worker source are logged. Main-thread dispatch, worker receipt, compute begin, first actual advance, synchronous advance duration, finish, result post/receipt, cancellation, disposal and worker termination are distinct events. All event clocks use performance.timeOrigin + performance.now.

Forecast advance intervals are retained. Foreground evaluation advance duration is aggregated per evaluation. Begin-to-finish includes yield time and is not CPU time. CDP process CPU covers shared renderer/process work, not a specific worker. Any interval analysis must distinguish these limits and controlled-injection windows. Logging adds overhead; timings are not directly comparable to earlier uninstrumented runs.

Baselines expose expected race findings without treating exposure itself as a harness failure. Fixed-arm exclusivity checks, actual entry coverage, source checks and retained-state checks are hard assertions. Every case writes final screenshots and JSON, including failures. The workflow uses pipefail and uploads evidence under always(); red runs remain preserved.
