# Default four-ball search continuation regression

Source baseline: `4ef104eb58b070c370ffc082b811e8e6527cf71c`.

## Failure evidence

GitHub Actions run `40191971912`, browser artifact `12599330108`, failed
`tests/e2e/deterministic-search.spec.cjs:27` while waiting for a verified result.
The trace shows six successful 20–24 second slice resumptions with zero results,
then the unchanged 150 second observation deadline expired. No scoring assertion
was reached; this was not a selector or worker-startup error.

A native production-planner reproduction using the default four-ball request,
all-angle 0–85 degree input domain and 16 second physical horizon still had no
result after 180.83 seconds / 804 evaluations. The first four frontier slots
were initially occupied by two geometric topologies with two roots each; every
resume gave those same difficult roots exclusive ownership until termination.

## Change

At a completed-wave continuation boundary, retain running solver objects in a
FIFO and alternate fresh topology admission with the oldest retained batch.
Pending-wave cancellation never moves ownership: its original probes must
commit to their original solver states. Exhausted geometry drains retained
running roots before reporting completion. Iteration accounting includes both
active and suspended states.

No physical evaluator, root solver, input bounds, contact rules, physical
horizon, verification requirements, browser test deadline or selected branch
was changed. CPU and optional GPU coordinators use this same planner.

## Validation

The unrestricted native production planner found a separately certified result
in 32.63 seconds / 233 evaluations in the diagnostic run (timings are host
observations, not performance guarantees). It found the reversed target order
4 → x+ rail → 3, not a manually selected branch. The new regression independently
repeated the entire default search and then replayed its first result in an
uninstrumented PhysicsLab: full rest, +1 point, same cue turn (32.20 seconds).

Tests cover FIFO state identity, retained iteration accounting, pending-wave
cancellation ownership, and draining suspended roots after domain exhaustion.
Build and TypeScript checks pass. Full browser revalidation is still pending an
authorized CI rerun; local browser execution was not attempted because the
available route is blocked by security policy.
