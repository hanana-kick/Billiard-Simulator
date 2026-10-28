# Original-CPU opt-in final gameplay: physical holdouts

`tests/source-gameplay-full-rest.mjs` closes a physical-policy gate left by the
earlier bounded/discrete CPU witnesses. It does **not** qualify the resident GPU,
three-ball full shots, the planner's discovery, or a production backend.

Both inputs are rebuilt through original `LabController.move`, genuinely settle
for 484 outer steps, and fire angle 0°, elevation 8°, speed 2, tip (0,0). There is
no saved future state, injected event, or forced route latch. The known positive
places balls at (-.5,0), (-.8,.4), (.0435,.0435), (.2615,-.2). The genuine late
opponent input is the existing `four-ball-goal-late-opponent-input.json`, not the
older unsuccessful `BASE_INPUTS.lateFoul` hypothesis.

Each admitted opt-in owner runs the original PhysicsLab from the same initial
snapshot beside an independently fired original Controller. The test compares
exact clocks, outer/native step counts, **every actual emitted event and its
immediate original-game effect**, full original history, and full native bytes
at each 128-outer boundary and the query terminal. No synthetic scoring rules
are used. The original Controller finishes only at its actual rest boundary.

| Input | Owner query terminal | Independent full rest | Original game result |
| --- | --- | --- | --- |
| Positive | Outer 5039, physical rest | Outer 5039 / h5480 | +1, cue 1 retained |
| Later opponent foul | Outer 986, irreversible foul, still moving | Outer 4974 / h5415 | −1, next cue 2 |

The positive has matching full-rest original-game and exact transport receipts.
For the negative, an actual two-red goal precedes the opponent contact at a
strictly later event time. The early query returns `evaluated-negative` with no
fabricated finished score or physical result; only the independent Controller's
later full-rest finish supplies −1. These are distinct query/physical endpoints.

Two tests pass locally. All 40 positive and 8 negative native-state comparison
boundaries match. The owner and Controller use unchanged original physical
time steps and the explicit eight-second horizon. The ordinary CPU route-only
and omitted-policy paths are unchanged.

Run (CPU only; no private artifact or WebGPU dependency):

```sh
node --test --test-concurrency=1 tests/source-gameplay-full-rest.mjs
```

Still required: genuine three-ball physical finalization holdouts, GPU final
observations and final-gameplay policy, raw-to-rest resident trajectories,
intended-scale candidate isolation, browser integration, and release gates.
