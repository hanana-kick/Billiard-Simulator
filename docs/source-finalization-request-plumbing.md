# Explicit source gameplay request plumbing (CPU, opt-in)

This checkpoint connects the policy/CPU owner to Controller, the inverse planner,
worker and cooperative service. It updates the integration status of the earlier
policy-seam checkpoint in `source-query-finalization-policy.md`; that document's
"not implemented here" statements describe its original checkpoint, not this one.
No UI setting, default policy, physics, GPU runtime or deployment is changed.

## Explicit entry and initial binding

```js
controller.startSearch(); // unchanged synchronous legacy request
await controller.startSearch({
  finalizationPolicy: 'source-gameplay-finalization-v1'
});
// Explicit route-only alternative, without gameplay authority:
await controller.startSearch({finalizationPolicy: 'source-route-query-v1'});
```

Controller captures its actual ready original Game snapshot, full lab object
roster, native initial world snapshot, current settings/options and actual
per-shot rule. The browser-safe `LabSourceFinalizationRequest` helper detaches
these inputs and SHA256-binds their canonical typed representation. Binary64
Number bits, signed zero, typed-array bytes and undefined-versus-omitted fields
are distinguished. This is exact-data integrity, **not attestation of arbitrary
caller-fabricated history**. Only initial data is bound; no future trajectories
or final states are inputs.

Asynchronous capture has a generation guard and checks world, settings/options,
and game state before dispatch. Cancel, stop, a new request, or source changes
prevent obsolete dispatch. Resume checks the request/world/game stamps; applying
an archived shot checks world/game state. Applying a result still only changes
controls: the user must strike separately.

## Admission and purpose

`admit(req)` recomputes the digest and detects mutation across its await. It
returns an opaque same-realm WeakMap token, never a serialized job field.
Planner request admission and subsequent synchronous rechecks bind resume and
waves to the unchanged source. Worker/cooperative transport readmits serialized
requests independently **only for opted gameplay `verify` jobs**. Residual,
Jacobian, trial, clearance and route-only `begin` remain synchronous legacy calls.
Missing optional modules, unknown policies, missing tokens and stale identities
reject rather than silently selecting a weaker policy. The build and worker
bundle include the same original games, classic policy, request helper and CPU
owner before inverse-events. Web Crypto is required for the explicit profile;
the omitted path does not require it.

Each verify receipt carries an `evaluationBinding` containing the source identity,
purpose, **complete actual job settings and complete topology**, not merely seed
settings or a branch ID. The original owner confirms accepted strike parameters
against it. A request hash alone cannot authorize a different solver probe.

## Atomic publication and unresolved results

The planner validates every gameplay verify receipt in a wave **before** changing
any solver, counters or archive state. Missing, swapped, cross-probe or
contradictory proof produces `SOURCE_FINALIZATION_RECEIPT_MISMATCH`, propagated
as a source error, not an ordinary miss or a retry under weaker semantics.

Archive eligibility additionally requires a positive full-rest original-game
receipt, actual route/constraint success, matching exact settings/targets, and
word-preserving canonical equality between the displayed physical result and
its explicitly scoped original route result. The exact admitted outcome is
retained with `structuredClone` outside the unchanged solver's historical JSON
copy (which normalizes signed zero). No old `verifiedShot` can bypass this gate.

Matching incomplete/cancelled/stale/unsupported/failed results retain their
original reason, `physicalResult:null` and no authoritative top-level scalar
residual/constraint projection. Prefix diagnostics remain only under
`routeQueryObservation`; they cannot seed an archive success. The unchanged
solver reports unresolved/unsupported rather than misinterpreting the valueless
result as an infeasible physical miss. Matching receipts must also agree with
all top-level status/reason/purpose/settings/verification/flag fields. Unfinished
statuses accept only the versioned valueless key set, preventing hidden prefix
scalars from reappearing as terminal solver authority. A genuine evaluated-negative result is
separate. Observation-v1 still refuses the new finalization policy.

## Verification and remaining gates

Sequential HOST suite: **119 passed, 6 optional historical tests skipped, 0
failed**. The 13 plumbing groups cover atomic whole-wave rejection, exact
signed-zero archive binding through the real solver, stale async Controller
capture, worker/cooperative admission and cancellation, service error propagation
and actual classic-module loading. Six helper groups cover canonical encoding,
digest/token rejection and full probe identity. Historical planner, pool,
solver, inverse-events and observation tests are included.

The included genuine native CPU gates additionally establish:
- unchanged native bytes/clock/real events over a retained 221-outer prefix past
  a forced query latch (not a physically achieved goal);
- synchronous legacy-purpose/native observation equality;
- real snapshot binding → admission → original four-outer continuation → explicit
  timeout, and missing modules rejected before world construction;
- actual source constraint rejection distinct from timeout/cancellation;
- the strict final transport validator accepts both genuine native timeout and
  evaluated-negative producer outputs, while rejecting contradictory labels.

Command (no GPU):

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
node --test --test-concurrency=1 \
 tests/source-finalization-request.mjs tests/source-finalization-plumbing.mjs \
 tests/source-finalization-native-receipt.mjs \
 tests/source-query-finalization-policy.mjs \
 tests/source-gameplay-finalization-owner.mjs \
 tests/source-gameplay-inverse-admission.mjs \
 tests/inverse-planner.cjs tests/worker-pool.cjs \
 tests/inverse-constraint-solver.cjs tests/inverse-events.cjs \
 tests/resident-candidate-inverse-terminal-observation.mjs
```

This is not a physically achieved positive full-shot, later-foul end-to-end,
real-browser Worker, full UI/build/release, or GPU finalization qualification.
Synthetic archive positives test protocol rejection only, not reachability.
Those gates remain required before broader activation/publication.
