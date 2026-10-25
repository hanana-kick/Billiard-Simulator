# Browser mode/turn assertion repair

Source base: `4ef104eb58b070c370ffc082b811e8e6527cf71c`.
Equivalent sanitized backup tested in GitHub Actions: `fb344e4cc40dcbc2c87a78ee7e2cc27bf9a5daed`.

## Observed failure

[Run 40191971912](https://github.com/hanana-kick/Billiard-Simulator/actions/runs/40191971912), job 121164686288, failed the visible-mode test at `tests/e2e/four-ball.spec.cjs:51:236` after selecting 3구. It expected `{balls:3,game:null,shots:0}`. Actual balls/shots were correct, and `game` was the initialized three-ball rule object: active cue 1, cue IDs [1,2], object IDs [1,2,3], zero scores, no pending shot. All preceding assertions in that test passed. Artifact `12599330108` contains the failure screenshot, trace and page snapshot.

The identical expected/actual mismatch was reproduced with the real native Rapier engine and controller, switching four-ball → inspecting red → selecting yellow → three-ball. No browser security restrictions were retried or bypassed.

## Cause and repair

Commit `e7e0f25` introduced three-ball turn/scoring rules and changed the native integration assertion to require `ThreeBallGame`; `43804dc` also initializes those rules on first mount. The browser test's old `game:null` assertion was left behind. Nulling the game in production would remove required three-ball turn/scoring behavior.

Only tests are changed. The browser test now checks the three-ball rule identity, reset score/turn/selection, and the displayed actual turn while inspecting the red ball. Existing four-ball assertions are preserved. A native regression checks repeated mode changes reset exactly once, same-mode selection never resets, rules and score reset, and inspection does not change actual turn.

## Verification scope

- Focused native rule/controller tests: 17 passed.
- Full `npm test` chain: passed (primary batch plus deterministic-worker and inverse suites).
- TypeScript typecheck and self-contained bundled build: passed.
- Browser syntax and diff whitespace checks: passed.
- Updated full real-app browser suite: not run locally, because Playwright launch is blocked in this environment. Requires authorized GitHub Actions rerun; this patch does not establish browser-suite or release readiness.
- The separate route-search timeout in the same CI run is outside this repair.
