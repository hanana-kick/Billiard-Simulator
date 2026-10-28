# Sandboxed backup browser validation

## Scope and status

`backup-browser-validation.yml` is a **non-deploying** validation proposal implemented
locally. It has not been pushed, dispatched, or run on GitHub. Publishing remains
blocked pending fresh authorization; adding this file is not permission to push.

The workflow runs on `backup/**` pushes or manual dispatch of a backup ref, with
only `contents: read`, no deployment environment, no secrets, and no saved checkout
credentials. It uses an ordinary non-root GitHub-hosted Ubuntu 24.04 VM, not a
privileged container or the user's computer. The explicit OS label avoids an
unreviewed `ubuntu-latest` migration. Existing Pages deployment is unchanged.

The existing Playwright config selects installed stable Chrome on Actions and
sets `chromiumSandbox: true`. The new workflow retains this configuration and
rejects custom executable/launch arguments or ignored TLS errors. No AppArmor,
seccomp, user-namespace, sandbox, blocklist, certificate, or protocol relaxation is
introduced. Browser/runner/package versions and the tested commit are retained.
Stable Chrome and pinned Playwright can drift: an incompatibility must be diagnosed
and reviewed, not bypassed. The presence of Chrome does not prove launch success.

## Required ordinary-application evidence

After prepare/typecheck/build, full physics/search regressions, resident **host**
contracts and component provenance, run the entire existing `tests/e2e` suite via
`npm run test:e2e`, without a grep, harness substitution, or new skip. This includes
real-app narrow screens, manual/settings controls, persistent tabs, gestures,
three/four-ball behavior, and actual Korean Pretendard loading. Existing font tests
check pinned CDN stylesheet/subset responses and rendered platform fonts; existing
screenshot helpers wait for loaded Korean font coverage. Font/network failures
remain failures, not permission to replace the requested font or ignore TLS.

This validates the **default** app only when all required checks actually pass.
The current agent container reportedly fails Chromium 155 startup with socket
`EPERM`, before any page opens. A local HTTP 200 or test discovery cannot close
that gap. The new CI workflow is an execution route, not evidence of a pass.

## Browser WebGPU is a separate gate

Commit `94bcb6f` adds explicit canonical-controller installation and optional
`--canonical-controller-assets` packaging. A normal build neither includes nor
activates that bundle. Existing e2e tests do not install it. Therefore a green
ordinary-app job does **not** prove browser WebGPU engine execution or qualify
canonical-controller release behavior. Node native GPU tests and injected/fake
receipt host tests are also not browser execution.

Before claiming the complete gate, the real-app browser suite must cover:

1. Packages/imports the opt-in assets without changing default startup; obtains a
   real browser GPU adapter/device and records adapter/browser/driver evidence.
   Missing device or unsupported capabilities must fail a required qualification
   job, not count as a pass or silently use fake/CPU physics.
2. Admits an actual canonical scene/store and installs on the mounted, idle
   controller with its supported explicit profile/options. Verifies authoritative
   raw engine dispatch/readback and physical REST, not just `navigator.gpu` presence.
3. Exercises real manual firing, exact/held presentation, forecast, pause,
   cancellation, stale-source rejection, undo/redo and scoring/turn updates across
   narrow layouts/settings tabs; verifies no legacy fallback and correct explicit
   refusal for currently unsupported placement/reset/rule operations.
4. Repeats actual font checks before screenshots; retains traces, browser errors,
   device errors/loss and authoritative receipts alongside source/commit identity.

A GPU-capable, sandbox-compatible environment is still needed. Do not equate a
standard hosted Linux VM with a qualified GPU runner. No new runner, paid resource,
security flag, or remote computer access is authorized by this document.

## Official sources and flag decisions

- [Playwright CI](https://playwright.dev/docs/ci) documents GitHub Actions execution;
  [browser channels](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)
  documents branded Chrome support. [BrowserType launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-chromium-sandbox)
  documents `chromiumSandbox`; explicit `true` is retained because its default is false.
- [GitHub Ubuntu 24.04 image inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
  is the source for the runner's installed Chrome; the workflow checks the actual version.
- [Playwright Docker](https://playwright.dev/docs/docker) explains that default root
  execution disables Chromium sandbox and describes separate-user/seccomp setup.
  This proposal avoids container/security-policy changes entirely.
- [Chrome WebGPU troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips)
  permits loopback HTTP as a development secure context. It describes experimental
  Linux WebGPU/Vulkan support and blocklist overrides. This workflow does **not**
  add `--enable-unsafe-webgpu`, `--ignore-gpu-blocklist`, insecure-origin overrides,
  ignored certificates, or `--enable-unsafe-swiftshader`.
- [Chromium headless GPU guidance](https://chromium.googlesource.com/chromium/src.git/+/main/docs/gpu/using-gpu-hardware-in-headless-chrome.md)
  describes `--enable-gpu` and, for some Linux setups, `--use-angle=vulkan`.
  These are environment-specific renderer choices, not proof that WebGPU works;
  neither is required or added to this ordinary UI job. A future GPU runner must
  establish real capabilities with its supported driver/display setup first.

No documented workaround overrides the repository's sandbox/security constraints.
If safe Linux browser WebGPU remains unsupported, report the gate blocked and seek
an explicitly authorized suitable CI environment; do not weaken it until it passes.

## Local static review receipt (2026-10-28)

- Workflow YAML parsed successfully; the only declared permission is
  `contents: read`, and the only job is backup-ref-guarded application validation.
- Under `GITHUB_ACTIONS=true`, the actual Playwright config passed assertions for
  stable Chrome, `chromiumSandbox: true`, no executable override, no extra launch
  arguments, and no ignored HTTPS errors.
- `npm exec -- playwright test --list` discovered **57 tests in 9 files**.
  Discovery does not launch Chrome or execute any UI assertion.
- No remote workflow run, push, browser pass, or deployment is claimed.

## Separate required opt-in browser smoke test

`playwright.canonical.config.cjs` selects only
`tests/browser-canonical/controller.spec.cjs`, outside default e2e discovery.
Run it explicitly on a suitable sandbox-compatible GPU browser environment:

```sh
npm run prepare:engine
node build.cjs --canonical-controller-assets
npm exec -- playwright test --config=playwright.canonical.config.cjs
```

The test now uses the actual optional-build **GPU 실험 새 게임** button and
confirmation dialog. Opening then cancelling must request no adapter and preserve
the original lab; confirming uses the production fresh four-ball MMQ1 preset and
real browser GPU device. No fixture scene or store is injected through page code.
It clicks the actual search button, requires all nine explicit candidates to be
processed and at least one final PASS, applies a real candidate card, and fires the
real strike button. The shot must reach physical REST with +1 score and retained
turn. Keyboard undo/redo must preserve all 256 final-state words and game snapshots.
Narrow/wide settings tabs, retained canvas, requested font and screenshots remain
required. Legacy strike/step/restore calls throw. Test instrumentation wraps actual
adapter/device methods solely to record calls, errors and device loss; no GPU or
physics result is substituted. Missing assets/device, GPU errors or incomplete
physics fail rather than skip. Adapter strings do not establish physical-hardware
status. Manifest, compact search result and final-state evidence are attached.
This is a narrow MMQ1 entry/search/play flow, not cushion coverage or migration of
an arbitrary existing legacy scene. The preset's nine candidates are not evidence
of thousands of simultaneous GPU candidates.

This is a **prepared, not browser-executed** smoke test. Its own static discovery
finds one test. It is not included in the ordinary backup workflow because that
runner's GPU capability is not yet established. Even a future pass would not close
all gates: mid-shot cancellation/pause/forecast/stale-source behavior, additional
scoring/contact branches, complete pointer interactions, and real hardware
performance still need dedicated browser cases.

The smoke validates REST/status and exact restoration of its own 256-word result;
it does not compare every browser-produced word to a CPU reference and therefore
is not a full browser CPU/GPU numerical-parity qualification.
