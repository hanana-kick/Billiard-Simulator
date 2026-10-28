# Optional inverse-wave HOST contract — not an enabled GPU solver

`inverse-wave-adapter.mjs` is an explicitly source-bound, **non-authoritative**
HOST seam. No request, worker, cooperative evaluator, planner, solver or UI default
is changed. It imports no Node builtin and performs no forward physics or residual
calculation. The physical observation producer/terminal scheduling and native
qualification remain absent.

## Current consumer mapping

* `optimizer-service.js`: `loadWave()` retains `planWave()` jobs; worker outcomes
  arrive by candidate ID; `completeWave()` constructs one complete ordered
  `jobs.map(job => ({id, outcome}))` array. Cooperative execution uses the same
  jobs and final `commitWave`, not another solver.
* `inverse-planner.js`: each pending job binds request, wave, job ID, solver ID,
  branch, purpose, exact settings and full topology. `commitWave` checks complete
  IDs, remaps to each original solver ID, and accounts supplied steps. Archive
  publication needs a successful `physicalResult` on a verify job. Gameplay
  finalization additionally uses its separately bound original-game receipt.
* `inverse-solver.js`: consumes actual residuals, inequalities, availability,
  stage, event prefix, contact cell and clearance. It does not accept Boolean
  pass/miss substitutes. Its existing JSON copies normalize negative zero and
  nonfinite values; this adapter preserves exact source Numbers **up to that
  unchanged boundary**, with differential characterization rather than a solver
  rewrite.

## API and authority boundary

```
createResidentInverseWaveContract({
  search, generationId, getGeneration,
  queries: [{plan: admittedQueryJoinPlan, inputs: exactInitialRawWords}, ...]
})
projectResidentInverseWaveForHostTest({testOnly:true, contract, records})
commitResidentInverseWave({contract, ...})
```

The first function admits only current four/carom legacy source-query plans, not
an arbitrary source hash. Each plan is already same-realm branded by the original
initial snapshot/rule/creation admission. Every raw word must match its sealed
initial plan. Its existing source-query context must match the complete current
request, rule options, topology, purpose, Number-bit settings, generation and
prestrike bytes. Each pending planner job occurs once; partition ordering is
explicit, and resulting outcomes always retain the original job order.

The contract is private-brand checked on use. It rechecks the original request,
pending array/job identities, order, wave and exact contents, generation callback
and initial raw banks. Changing signed zero, topology metadata, rule settings or
source bytes invalidates it. The service must use its non-reused generation ID;
a digest alone cannot establish historical truth or GPU execution.

The **test-only** projector atomically decodes all fixed-width records. Unknown,
duplicate, partial, misordered, cross-context or malformed records reject before
any mutation. It never calls the planner. Its outputs always have
`qualificationGranted:false` and `committable:false`:

* evaluated non-winning probes retain the exact original scalar fields/nulls;
* source unsupported remains explicit unsupported, without invented residuals
  or executed-step counts;
* incomplete/cancelled/stale/failed transport returns `outcomes:null` for the
  complete dependency wave and retains each exact status/reason. The pending
  solver remains untouched: missing arrays are not sent through its malformed-
  residual fallback and no unresolved result becomes a miss/infeasibility;
* positive verify returns `outcomes:null` and explicit winner-artifact needs.
  It cannot finish/archive a root from a flag or a structurally valid record.

**Production commit currently always throws
`RESIDENT_INVERSE_PRODUCER_UNQUALIFIED`.** There is no receipt minting function,
Boolean/hash override or hidden test flag enabling it. This is intentionally an
unimplemented qualification boundary, not a functioning GPU backend. Neither a
HOST projection nor matching replay can qualify physical GPU observations.

## Reviewed future activation still required

1. Connect the same-world source hook/reducer/scorer/terminal kernel without CPU
   frame uploads or per-h readback, and qualify the original physics/full-rest
   boundary independently. A source owner must then issue a same-realm receipt
   binding the exact request/jobs/initial inputs, immutable executor and observer
   source versions, bank ownership, generation, output and terminal evidence.
2. For a genuinely GPU-qualified verify winner only, replay the unchanged
   original source to obtain display/path/distance. Bind source, rules, settings,
   topology and generation; compare with `assertInverseWinnerReplayAgreement`.
   Mismatch is an explicit error, not an ordinary miss, residual reevaluation or
   silent replacement. Report replay timing separately from GPU evaluation.
3. Add a reviewed complete-wave commit path using that receipt and matched winner
   artifact; call the unchanged planner exactly once. Worker/cooperative default
   CPU behavior and existing planner candidate generation remain unchanged.
4. A gameplay finalization policy needs a new versioned game-bound observation
   contract/producer receipt. Observation v1 cannot be relabeled into it, even
   for a four-ball record; free-mode/route-only callers are not silently upgraded.

## HOST evidence scope

`tests/resident-candidate-inverse-wave-adapter.mjs` uses an authentic INITIAL-only
registered four-ball capture and admitted raw parameters. It runs the actual
planner and solver against a deliberately enumerated discrete frontier and
unchanged original `inverse-events` projector. These are control/transport tests,
not physical trajectories or native GPU results. Genuine evaluated values,
nullable fields, unavailable carriers, signed zero/nonfinite handling, unsupported
classification and next solver state agree with the original direct source path.
All unqualified production calls leave roots/counters/pending/archive unchanged.

The initial fixture is shared with the prior query-join gate; it requires the
original capture/decoder documented in `resident-candidate-original-fixture.mjs`.
No future expected bank is runtime input. This suite does not establish full-rest,
active-tip, 1024-row execution, hardware speed or release readiness.
