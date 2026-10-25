# Local search integration checkpoint

This branch assembles previously isolated components. It does **not** enable GPU
search in the public application or establish general CPU/GPU equivalence.

## Integrated components

- Independent multi-shot owner and full sequential comparison harness.
- Exact per-candidate capture from a private fork of current four-ball state.
- Shared inverse observation reducer, retaining demand-driven native queries.
- Native solid/non-solid convex projection and private pending contact readers.
- Shared physical scoring reducer with unchanged original CPU behavior.
- Commit-only inverse world receipts, opt-in batch observations and a same-realm
  inverse GPU wave evaluator with cohesive original-source preparation.
- Bounded live three-ball first-step and 64-substep ownership. These do not yet
  cover a complete three-ball shot.
- Explicit opt-in, provenance-checked worker asset packaging. Default build does
  not ship or activate the optional payload.

## Verified integrated code

At source commit `d624ec3`, the complete `npm test` command passed **321 tests**,
zero failures and zero skips. Build and typecheck passed. The final scoring and
observation focused suite passed 39 tests. Logs are local under
`artifacts/integration/` and are not publication artifacts.

Earlier assembly gates independently passed 20 worker source/transport tests,
2 optional packaging tests and 1 actual HTTP/MIME/hash test. These are not
browser execution tests. A fresh worktree requires `node tools/prepare-engine.cjs`
before tests; the first unprepared attempt failed on the missing generated engine
and was not counted as a pass.

## Component acceptance since the aggregate run

The isolated physical-scoring producer passed one complete original miss/contact/
return case on CPU reference and actual SwiftShader WGSL: h7946, 7505 outer steps,
266945 numeric comparisons per backend, measured error zero. The inverse wave
component separately passed two genuine early-foul candidates in single/batch
GPU execution, matching every original inverse outcome field, with no native
forward continuation. These are bounded component proofs, not general search
coverage or hardware performance measurements.

The integrated wave/observation/batch contract suite passed 21 tests, build and
typecheck at `ac0d742`. Earlier integrated worker load gates passed 20 tests after
the shared three-ball provenance import/order repair. The 321-test aggregate
above remains tied to `d624ec3`; it is not relabeled as a later aggregate run.

## Outstanding acceptance

- Full planner/service orchestration, worker/UI integration and successful-goal
  or post-goal-foul wave coverage remain outstanding.
- The default inverse search button remains on the original CPU path.
- Three-ball recurrence currently covers only 64 internal substeps. Actual tip
  contact, subsequent collision/scoring and full-rest coverage remain outstanding.
- Some legitimate four-ball inputs remain explicitly unsupported. In particular,
  an inactive retained sphere edge with an airborne cue is under separate repair;
  no guard has been relaxed in this integration checkpoint.
- Fresh complete CPU/sequential GPU/batch comparisons and failure lifecycle
  checks passed on frozen runtime `2ed077e` for the placed and awake sources.
  See `multishot-gpu-batch-validation.md`. Do not transfer those results to
  untested future numerical modifications.
- Full browser UI verification is blocked in this execution environment. Native
  Chromium launch fails at Unix-socket creation, and the existing cloud browser
  cannot reach the live development server even on its allowed port. The server
  was confirmed alive. No security settings were changed.

All actual shader evidence so far uses Dawn Vulkan SwiftShader (software GPU),
not consumer GPU hardware. No hardware speedup or production readiness is claimed.
No external upload, merge, or deployment was performed for this checkpoint.
