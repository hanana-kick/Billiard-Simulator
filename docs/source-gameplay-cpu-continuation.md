# Opt-in CPU gameplay verification: owner checkpoint

No default/UI activation, GPU producer, observation-v1 adaptation, full-shot
qualification, or physical reachability claim is included here.

## Shared request boundary

The separately reviewed browser request helper supplies an explicit
`source-finalization-request-v1` gameplay envelope, validates its SHA256 against
the actual detached initial snapshot bytes/request/original game data, and
returns a same-realm admission token. A caller-supplied digest alone is not
admission. `LabInverseEvents.begin(...,{purpose:'verify',finalizationAdmission})`
uses `policyFor` and `evaluationBindingFor` before constructing a physical world.
The evaluation binding includes the **actual probe settings, complete topology,
purpose, and source identity**, not merely the request's seed settings.

Only explicitly gameplay-qualified **verify** uses this owner. Omitted requests,
explicit route-only queries, and residual/Jacobian/trial/clearance purposes keep
the synchronous original path and original result shape. Unknown policy names
fail closed. The optional request/worker/planner helper is a separate integration
dependency; this checkpoint does not bypass it with a test token.

## Same-world execution

`ShotSearchCore.stepTrialOuter` performs exactly one original `PhysicsLab.step`
followed by the unchanged original outer route observation. The legacy
`stepTrial` retains its old guards and uses that primitive. The gameplay owner
does **not** repeatedly invoke the early-returning legacy function and pretend
that physics advanced.

The owner restores the bound original `ThreeBallGame`/`FourBallGame`, calls its
original `begin` only **after** the original strike is accepted, and forwards
each subsequent actual emission to the original `contact` method in emission
order. The original route callback remains intact and the inverse solver-impulse
observer remains separate. No synthetic event, score, sleeping flag, future bank,
or alternative physics step is used by the owner.

At each completed original outer boundary, original `game.finish()` is called
only under the exact Controller guard: a pending game, no cue, and every
original `lab.objects` body asleep, including non-game objects. The named pure
policy then requires a positive actual finish delta **and** genuine route and
input-constraint satisfaction. Pending foul may terminate an irreversible query
failure without calling `finish` or claiming physical rest.

The original horizon `round(horizon / dt)` remains authoritative. Horizon without
finalization is incomplete; operational timeout, cancellation, stale source,
unsupported data and errors remain distinct. No physical budget is extended.

## Result authority

The optional receipt is `source-gameplay-finalization-result-v1`, containing
policy, source identity, verify purpose, complete evaluation binding, status,
`gameplayVerified`, `physicalRest`, nullable **actual** `finishedGameResult`, and
reason. Top-level `verified`/`goalVerified` and `physicalResult` are published only
for qualified final success. Non-positive results have `physicalResult:null`;
the untouched original query projection is separately named
`routeQueryPhysicalResult`/`routeQueryGoalVerified`, never relabeled as gameplay.
`verification.finalization` retains authority through the original solver.
Incomplete/cancelled/stale/unsupported/failed results expose **no top-level solver
scalar projection** at all. Their original source-query prefix is retained only
under diagnostic `routeQueryObservation`; identity, steps and the explicit
receipt remain authoritative. No zero residual or invented inequality is added.

The optional inverse observation-v1 codec explicitly rejects this new receipt.
Its source-query identity and free-mode early-stop scope cannot encode final
gameplay by flipping a boolean. A future version/profile and genuine GPU producer
remain required. The planner must validate receipt identity against the exact
pending job before publishing a winner.

## Bounded evidence

`tests/source-gameplay-finalization-owner.mjs` independently steps two genuine
native worlds for 221 original outers, compares full native world bytes, clocks,
real emissions, original game state and bookkeeping, and disposes both worlds.
The last step follows a **deliberately forced route-query latch** to exercise the
control-flow distinction. This is a discrete query-state witness, **not** evidence
that the settings physically achieved the route. Original gameplay is never
fabricated; the owner remains unverified and a test timeout remains incomplete.

Initial gate: 41 host tests passed, six unrelated opt-in native-forward tests
skipped. Bounded native test cost about 305 ms on this host; not a throughput or
hardware claim. Full worker/admission integration, an actually reached scoring
route continued to rest, broader native fixtures, build and UI gates remain
separate.

Follow-up bounded gates use the actual async byte/Number-bound request helper,
real `begin`, four original native outers and explicit interruption. Native bytes,
clock/events and source observations match the omitted-policy path exactly.
Missing/stale admission rejects before world creation. The actual timeout record
has no scalar solver fields; the unchanged solver's verify phase returns
`unconverged` with the timeout reason, not an infeasibility or residual fallback.
Native speed `.4` (allowed by PhysicsLab, below the unchanged inverse `.5` bound)
gives a genuine constraint-negative query without a fabricated game finish.

The historical short `physical-scoring-original-cpu.json` fixtures target,
wrong-first, four-ball and gentle each retain their exact original outcome at 383
outers. This selected gate passed in about 0.88 s. The longer 4k+ outer fixtures
were not run by this task.
