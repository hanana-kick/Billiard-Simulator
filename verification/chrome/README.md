# Sandboxed Chrome real-app comparison

Prepared harness only; no browser was run during adaptation. No product changes.

Start separate loopback HTTP servers serving each freshly built `dist` directory, then:

```sh
CPU_WINDOW_RELEASED=yes BOUNDED_CANDIDATE_PASSED=yes \
APP_ROOT="$GITHUB_WORKSPACE" \
BASELINE_ROOT="$RUNNER_TEMP/baseline" CANDIDATE_ROOT="$GITHUB_WORKSPACE" \
BASELINE_URL=http://127.0.0.1:8793/ CANDIDATE_URL=http://127.0.0.1:8794/ \
CHROME_PATH=/usr/bin/google-chrome \
OUT_DIR="$RUNNER_TEMP/chrome-comparison-raw" \
node verification/chrome/browser-comparison.cjs
```

Use the actual script location if not copied to `verification/chrome/`. `APP_ROOT` supplies installed Playwright dependencies only. `BASELINE_ROOT` and `CANDIDATE_ROOT` supply each arm's `src` and `dist/index.html`. URL variables select each arm's server. `OUT_DIR` must not already exist. The workflow must build both arms before starting servers.

Default `MODE=pacing` compares the frozen integrated baseline with the private pacing candidate, both with precompute on. This is **not pristine main versus candidate**. The exact optimizer hashes are pinned, all other recursively collected source-file hashes must match, each served index must match that arm's disk index, and five served source modules must match disk source. An optional `precompute-integration-manifest.json` is retained as provenance, including whether its index hash matches; old inherited manifests are not treated as fresh build attestations. Fresh manifests can use `{ "built": true, "compiledIndexSHA256": "...", "sourceHashes": {...} }`; no manifest keys are required, because disk and served-build checks are computed directly by the harness.

`MODE=precompute` instead runs off/on against `BASELINE_ROOT` (defaults to `APP_ROOT`) and `BASELINE_URL` (fallback `APP_URL`). The candidate root is unnecessary in this mode.

The harness discovers preinstalled Chrome using `CHROME_PATH`, `CHROME_BIN` or standard Chrome/Chromium paths. Sandboxing is explicitly enabled with no disable-sandbox fallback, and no browser is downloaded. Sandbox launch errors are failed attempts retained individually.

Each mode runs 40 attempts: two three-ball and two four-ball fixtures at normal playback rate, plus the four-ball swapped fixture at quarter-speed, four repeats each, with AB/BA order balanced across repeats. Every attempt gets its own fresh browser process and raw JSON row before launch, even on failure. No warmups or failed attempts are discarded. A summary updates after each attempt.

Outputs include setup, aiming, prediction, fire-to-rest, rest-to-first-route, fire-to-first-route and physical replay durations; raw frames and long tasks; phase frame quantiles and >32/>50 ms counts; worker errors and route checkpoints; pair snapshot/game/settings/options identity checks; and successful-route replay requiring exactly +1 score at physical rest with unchanged native stepping. Strict gates fail on any runtime/network error, including classified font-load failures. All finite timings, including failed attempts, remain in aggregates; missing outcomes and failures are counted separately. A nonzero final exit means a strict gate failed, not that every metric is absent.

Static validation only: `node --check browser-comparison.cjs` plus importing `makeOrder` to assert each mode's 40 attempts and arm balance. Full UI and browser verification remain workflow work.
