# Three-ball search success versus completed gameplay

Scope: source audit and discrete HOST witnesses only. **No CPU policy change,
physical trajectory/reachability proof, numerical/full-shot qualification, GPU
work, or activation.** The existing initial-only control bridge remains initial-only.

## Finding

**Existing three-ball query success is not an irrevocable gameplay score.**
If an accepted selected-cue/floor contact arrives after the qualifying second
target but before controller completion, actual `ThreeBallGame` sets `foul` and
ultimately awards **zero**, switching cue. The frozen qualifying cushion count
does not freeze the foul flag. A hypothetical valid prefix followed by a later
floor contact is therefore a source-semantic counterexample to irrevocability;
it is **not evidence that a native physically reachable shot realizes it**.

## Exact source boundaries

- `src/controller.js:82,88,310–311`: free mode uses `ThreeBallGame`, passes
  `gameMode:'free', opponentId:null` to search, and publishes gameplay only when
  the cue is absent and **every** live object sleeps (three in this admitted
  mode). Its event callback keeps calling the pending game's `contact`.
- `src/game-rules.js:14–16`: both other balls are targets, including the other
  player's cue. The second distinct hit freezes `goalCushions`. Any later
  selected-cue contact with `other.kind==='floor'` sets `pending.foul=true`.
  `finish()` requires `!foul` for +1; otherwise it returns 0 and switches cue.
  The pure class does not inspect positions, sleeping, cue removal, or horizons.
- `src/physics.js:249–264,267`: native collision-start events can produce the
  keyed `contact` with ball/floor identities; floor/cloth contacts below .12 m/s
  and recent repeated pair contacts are filtered before emission. Cue removal
  after .22 seconds is a separate operation, not a rest/score proof. This audit
  does not bypass those filters or claim an invented event was physically emitted.
- `src/optimizer-core.js:9–10,201–220`: three-mode requires three cushions, but
  `fullShot` means **four-ball only**. Four-ball floor/opponent observation runs
  before the goal-latch return; free-mode floor does not. Cue obstruction is
  still processed before the latch return, so query success is not unconditional
  while its cue tail is still being evaluated.
- `src/optimizer-core.js:252–283`: before latching, the shared positional bounds
  check can invalidate a free-mode candidate. After latching, the free-mode
  branch returns before that check and does not require all objects asleep.
  Goal plus cue absence is sufficient to stop a non-four-ball successful query.
- `src/optimizer-core.js:286–309`: horizon handling requires full rest only for
  four-ball. `stepTrial` also has the early success/no-cue/non-four-ball return.
  `physicalResult` is `success && !invalid`; it does not call `ThreeBallGame` or
  extrapolate the rest of the physical world.
- `src/inverse-events.js:194–196,217–249`: the inverse evaluator preserves the
  core contact handler, advances through `ShotSearchCore.stepTrial`, then uses
  its `physicalResult.success` with topology/inequality checks. Those additional
  checks do not supply an independent rest-complete gameplay evaluation.

Thus **positional off-table** and **accepted cue/floor contact** are not
interchangeable source predicates. The former is a search bounds observation;
the latter is what this gameplay class consumes. No four-ball opponent policy,
minus-one, full-rest search policy, or fabricated physical miss is imported.

## Minimal reproducible HOST witness

`tests/resident-three-ball-search-semantics.mjs` loads the actual unchanged
optimizer, route rules, gameplay class, and controller prototype. It constructs
discrete events/read-only observations (no world/engine instance or integration):

1. Both selectable cue identities; plain and `any` route method: three cushions,
   both targets, cue absent, balls awake => source query success but source
   controller remains pending. Hypothetical later floor => original game and
   independent HOST reducer finish at rest with 0 and cue switch.
2. While the post-goal cue tail remains, later free-mode bounds observations are
   not read and a floor event is ignored by search, whereas obstruction remains
   invalidating. The game independently retains the floor foul.
3. Before the latch, the existing free-mode positional guard still invalidates.

Run (process-local temporary root only; no fixture generation):

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
  node --test tests/resident-three-ball-search-semantics.mjs \
  tests/resident-three-ball-game.mjs
```

This establishes the **semantic distinction**, not native reachability of a
late-floor trajectory. Qualifying a final gameplay outcome would need an actual
physical continuation through the source controller's completion boundary.
Changing CPU search termination or result labeling is a separate product/rule
decision, not silently part of the resident three-ball port.
