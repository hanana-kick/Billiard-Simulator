# Explicit same-realm inverse GPU wave

`evaluateInverseGpuWave` in `src/evaluate-inverse-gpu-wave.mjs` evaluates one to
four already-prepared jobs. It does not propose candidates, select a default
backend, run native physics, fall back to CPU, transport worker messages, or
commit results into the visible application.

```js
const wave = await evaluateInverseGpuWave({
  backend: 'webgpu', device,
  candidates: [{prepared, req, topology, settings, purpose: 'verify'}],
  getSourceRevision: () => controller.lab.revision,
  signal
});
```

`prepared` must be the exact same-realm object returned by
`prepareLiveFourBallCandidate`, not a serialized, cloned or hand-assembled seed /
admission pair. Preparation privately retains original prestrike native bytes and
an owned imported seed (preserving authenticated frozen hull identity). Evaluation
checks the entire original request snapshot (captured with `trails:false`), including
native bytes, source clock and application metadata, and obtains a new owned
seed; later mutations of the caller's exposed seed cannot alter the candidate.
This is an in-process authority boundary, not cryptographic authenticity.

Only four-ball carom physical `evaluate`, `residual`, `jacobian`, `trial` and
`verify` are supported; only `verify` may certify verification. Clearance-only
queries, unsupported purposes, mismatched controls/rules/source and missing
admission are explicit unsupported jobs, not manufactured physical misses. Input
inequalities still use the caller's original search bounds. The private physical
request uses the exact original inverse topology overrides and fixed-elevation
policy, and the actual prepared strike settings. No automatic pose restoration.
All valid jobs in a wave must come from the same original source bytes/revision.

The required synchronous source revision reader is called before dispatch, during
stepping, and after final asynchronous cleanup. Changed revision invalidates every
otherwise publishable result. The caller must also invalidate/suppress publication
when its selected cue, readiness, search generation or user intent changes; this
module does not own UI state or install a result in the controller.

## Lifecycle and results

Each output row retains its original input index. `evaluated` means the genuine
physical scorer reached its original stopping condition, not that the world
reached physical rest or the candidate succeeded. Its `result` is the exact shared
pure inverse final-result projection: topology, signed residuals, inequalities,
physical result and verification policy are unchanged. Other statuses are
`unsupported`, `failed`, `cancelled` and `stale`, with `result: null` and a reason.
Numerical runtime exceptions remain failures, never ordinary physical misses.

One job uses the actual GPU world; multiple jobs use the independent GPU batch
owner with inverse observation enabled. Both consume each committed receipt once
and the physical scorer only until done. A completed physical scorer can stop
before rest (foul, invalid shot or horizon). Batch `stopOwner(id, reason)` is legal
only at a live committed idle boundary. It disposes that owner, marks it `stopped`
(not `complete`/`cancelled`), preserves its last snapshot and lets siblings continue.
A naturally resting owner retains `complete`. There is no cross-owner atomicity.
Cancellation/failure clean up GPU ownership without publishing a partial score.

## Acceptance boundary

Lightweight acceptance: original inverse golden characterization / reducer6/6,
batch lifecycle host contracts9/9, bridge host contracts6/6, and genuine cohesive
preparation/source-binding tests4/4. These include 1/2/4 job order, different
scoring stops, immutable preparation ownership, failed sibling isolation, no
post-done consumption, cancellation during a committed single step, and revision
invalidation during cleanup. Host doubles are orchestration tests, not GPU proof.

`tests/inverse-gpu-wave-native.cjs` is the actual same-realm end-to-end test. It
prepares two candidate speeds from one genuine source, computes original CPU
inverse outcomes independently, then forbids every native world step during GPU
evaluation. Genuine opponent contact supplies an original early stopping boundary,
not a synthetic shortened horizon. Native execution requires the coordinator's
exclusive slot and `REQUIRE_WEBGPU=1`; outcome acceptance passed for both single and batch ownership. Independent full
scorer acceptance also passed on its separate pinned source; that does not expand
this short wave's admission coverage. This seam does not
certify arbitrary source/candidate admission, successful full-rest search, UI
wiring, worker transport, or a GPU performance improvement.


## Actual same-realm acceptance

The original source used settled positions (x,z): cue1=(.6,0), opponent2=(.95,0),
red3=(-.4,.4), red4=(-.6,-.3), and genuine candidate speeds1.25 and2 at angle0,
elevation8, zero tip offset. Neither an expected trajectory nor imported fixture
seed was used as a candidate. Each candidate went through the cohesive original
capture/import/admission helper from the same live controller.

Actual GPU single-owner evaluation and then two-owner evaluation matched every
original CPU inverse result field with measured maximum absolute error **0**.
The jobs stopped at committed h921 / h571, corresponding to original outer
steps228 /130, with `four-ball-opponent-or-off-table`. Both were explicitly
`worldStatus: stopped`, not complete. Batch execution reported1486 multi-owner
dispatches with maximum2 owners. Overriding native `World.step` to throw throughout
GPU continuation observed **0 calls**. Source native bytes remained unchanged.

Elapsed:208.0 seconds including original preparation/reference;205.47 seconds for
GPU single+batch evaluation.384MB JS heap cap; sampled peak RSS about932MB.
This is software-Vulkan execution/parity, not a hardware acceleration claim.
The runtime returns compact execution mode/multi-owner metrics alongside results.

Cancellation/source invalidation/cleanup tests for the bridge are host contracts;
actual per-owner rollback/cancellation/device-loss resource tests belong to the
separately accepted batch owner. This wave test did not instrument a separate
per-wave native buffer count or issue cancellation during native execution. It
retained/released the native GPU owner and exited normally. No full-rest successful
wave or UI/worker result commit is certified by this genuine early-foul case.
