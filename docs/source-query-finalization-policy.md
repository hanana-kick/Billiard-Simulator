# Explicit source gameplay finalization policy — HOST seam, not activated

`src/source-query-finalization-policy.mjs` adds a **pure, opt-in policy helper**.
Nothing imports it in current CPU workers, services, Controller, inverse solver,
resident runtime, or UI. Original `ThreeBallGame`, `FourBallGame`, scorer, default
request behavior and characterized legacy outputs are unchanged. No GPU port,
physical trajectory, reachability proof, forward replay or release claim exists.

## Actual caller mapping

| Caller / source | Current behavior and required distinction |
|---|---|
| Controller `setupGame`, `startSearch` (82–87,307–315) | `free` has actual ThreeBallGame + default `mode:three`; `four` has FourBallGame + `mode:carom`. Request currently sends gameMode/opponent but **not game snapshot/roster/rule binding**. |
| InverseSolver `next` (79–101) | Separate residual, Jacobian, trial, clearance, and finally verify purpose. Numerical roots/probes cannot directly certify gameplay. |
| InversePlanner `planWave/commitWave` (61,66–73) | Purpose preserved; archive accepts verify + `verified` + successful `physicalResult`. Finalization policy is not currently propagated. |
| Worker9 and cooperative service97 | Both call `InverseEvents.begin(...,{purpose})`; both need the same explicit policy/binding plumbing later. |
| InverseEvents `begin/advance/projectResult` (171–252) | Shared original Core stopping for all physical purposes; final projection currently gates verified only by `purpose==='verify' && goalVerified`. |
| Core/Optimizer route callers (`Core.validate13`, `Optimizer6–12`) | Genuine target/direct/carom/three route queries exist. They must not inherit ThreeBallGame rules merely from `gameMode:free`. |
| Controller `finishGameShot`87 | Actual gameplay finishes only without cue and with **every lab.objects body asleep**, including non-game added objects. |
| GPU wave/coordinator | Old opt-in host-orchestrated path is four-ball carom only. This policy does not broaden it or implement resident accumulation. |
| Forecast/applyRoute | Applying a candidate changes controls; display prediction is separate. Neither establishes a final game score. |

The source discrepancy is discrete and real: Core's non-four goal latch can stop
at goal + cue removal while other bodies remain awake (`optimizer-core255,282,293`).
A later selected-cue/floor event still makes original `ThreeBallGame.pending.foul`
true; its `finish()` returns delta0 and changes turn. The policy must not erase
that foul or redefine ThreeBallGame to match an early route-query success.

## Explicit input and effective policy

```js
createSourceFinalizationPolicy({
  policy: 'source-gameplay-finalization-v1', // or 'source-route-query-v1'
  purpose: 'verify',
  sourceIdentity: initialSourceSha256,
  query: {gameMode:'free', mode:'three', selectedId:1, targetId:2, secondId:3},
  gameBinding: {
    kind:'original-game-binding-v1', sourceIdentity:initialSourceSha256,
    gameKind:'three', snapshot:originalReadyGameSnapshot,
    worldObjectIds:originalLabObjectsInOrder,
    shotRules:{threeCushion:true}
  }
})
```

The binding is a copied/frozen **initial** source-game snapshot, complete world
object roster, original selected cue/target IDs and actual per-shot rule. The
source owner must authenticate it against the same prestrike world/generation;
a supplied hash alone is not that proof. No future arrays belong in it.
ThreeBallGame's rule is always its actual three cushions. FourBallGame's pending
per-shot option may differ from the object's default `threeCushion` property;
both remain unchanged and are independently checked.

- Named route policy requires `gameBinding:null` and never reads gameplay/rest.
  It supports target/direct/carom/three, including unspecified legacy gameMode.
- Named gameplay policy requires actual binding. Only compatible explicit
  three-ball+three / four-ball+carom goals are admitted. Pure target/direct
  callers are refused this policy, not silently converted to gameplay.
- Even an explicit gameplay-qualified search delegates **all non-verify
  purposes** to unchanged source queries. No additional game or physical work.
- Omitted legacy callers do not call the new helper; no default inference exists.

## Pure decision, original rules stay authoritative

`decideSourceFinalization(policy, frame)` reads only source-owned data:

- Same source identity and explicit execution status/reason.
- Actual route completion/goal+constraint predicate and a distinct
  `irreversiblyRejected` predicate. A horizon-caused completion alone is **not**
  irreversible rejection. Future source adapter must exclude
  `verificationIncomplete` (for example, original `invalid &&
  !verificationIncomplete`), rather than guessing from success:false.
- Actual cue presence and ordered sleeping state for **all** bound world objects.
- Original game snapshot, plus original `game.finish()` result if already
  finalized at the Controller rest boundary. The helper neither calls finish,
  reimplements score math, nor receives/sorts presentation events.

| Decision | Meaning |
|---|---|
| delegate-source-query | Exact old query behavior; no gameplay assertion |
| continue | Route success/prefix is not final gameplay while motion/cue remains |
| awaiting-original-game-finish | Rest reached; call actual original finish in owned game, no extra physics required |
| evaluated-negative | Proven irreversible source foul/rejection, or actual finished game/route rejection |
| verified-final-gameplay | No cue + all objects sleeping + original finish delta>0 + actual route/constraint success |
| incomplete | Physical horizon without finalization, or request timeout |
| cancelled / stale / unsupported / failed | No evaluated result, no miss or manufactured score |

An original pending foul can end this **query** early because it is monotonic.
The result has `finishedGameResult:null`, no invented delta or turn and no claim
that gameplay/physical rest finished. Actual game scores are published only from
an actual original finish result at rest. A non-game-object awake flag blocks
success just like Controller. Failed physical verification never becomes an
ordinary miss merely because a resource/time budget ended.

## Observation codec is a separate versioned integration boundary

The optional `inverse-terminal-observation-v1` codec deliberately represents the
legacy source-query profiles. In particular, it **forbids free-mode `full-rest`**
and derives `requiresFullRest` from the legacy four-only source policy. This new
explicit gameplay-finalization policy cannot be relabelled into that existing
record or enabled by flipping its `requiresFullRest` boolean. Future activation
needs a new versioned/profile-bound request/result identity carrying the actual
game binding and named finalization policy, matching CPU/GPU producer semantics,
and new independent gates. Historical codec/source artifacts remain immutable.

The pure decision helper also does not authenticate event receipt continuity,
prove that a producer retained every source event, or attest that game.finish was
called at the reported outer boundary. The owned CPU/GPU producer must enforce
that event/commit/lifetime authority. Its future tests must reject skipped,
duplicate, reordered, speculative or stale tail events and stale final results.

## Required reviewed integration (NOT implemented here)

1. **Controller request intent:** explicitly select final-gameplay policy only
   for gameplay-qualified search, capture original ready game snapshot and full
   world roster/per-shot rules with the initial world identity. Keep target/direct
   route-only callers explicitly route queries. No automatic default change in
   this checkpoint.
2. **Planner → worker/cooperative:** preserve the named policy and source binding
   through job serialization, both worker/cooperative `begin` calls, build/worker
   module inclusion, resume and source-generation invalidation. Both paths must
   use the same helper/policy; do not duplicate a weaker default in one path.
3. **Verify owner:** create an owned original game from the original snapshot,
   call unchanged begin with actual per-shot rules, feed **every genuine source
   presentation event in original order** through unchanged game.contact even
   after a route goal. Keep inverse impulse-episode observation separate.
4. **Retained native continuation:** after legacy query stop, do not repeatedly
   call early-returning `Core.stepTrial` and pretend physics advances. The explicit
   profile needs a reviewed continuation loop around the same actual PhysicsLab
   step/application/outer boundaries, retaining all state, ordinary event/cue
   obstruction checks and observation sequence. No predicted states or shortened
   horizon. Preserve the legacy query result for diagnostics; new authoritative
   finalization is a separately versioned result, not an edited old artifact.
5. **Atomic publication:** only a new-policy positive final decision may publish
   new-policy `verified:true`/archive eligibility. Route-prefix satisfaction is
   separate. Keep original legacy outputs untouched when omitted; negative,
   incomplete and unsupported cannot leak an earlier positive verify flag.
   Keep winner display replay/source identity/mismatch checks and timing separate.
6. **Eventual GPU:** port the same source game and policy predicates at committed
   outer boundaries, with resident state/no per-h readback and independent CPU
   full-rest/late-foul gates. This HOST helper is not a GPU accumulator.

Before activation: independent source/new-policy CPU trajectories, final-gameplay
late-foul cases (not just discrete witnesses), worker/cooperative parity,
cancellation/horizon/source-change behavior, all historical characterizations,
and full app/UI/release gates. GPU raw h192 and other frozen runs are unrelated
and unchanged by this policy checkpoint.

## Evidence

`tests/source-query-finalization-policy.mjs` uses the **actual unchanged**
ShotSearchCore, ThreeBallGame, FourBallGame and Controller methods with constructed
ordered contacts and rest observations. It instantiates no PhysicsLab/Rapier
world. These are discrete semantics, **not physically reachable trajectories**.
Tests cover early source success then later floor, no-foul rest success, both cue
IDs, original four-ball −1, per-shot three-cushion option, late-cushion rejection,
all-object rest, immutable binding, source/score/turn validation, route-only and
intermediate delegation, and distinct interruptions/horizon.

Host command (no native forward tests enabled):

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
node --test tests/source-query-finalization-policy.mjs \
  tests/resident-candidate-inverse-terminal-observation.mjs \
  tests/inverse-constraint-solver.cjs tests/inverse-events.cjs tests/inverse-planner.cjs
```

**82 PASS, 0 FAIL, 6 SKIP**, including8 new policy/witness groups. The6 opt-in
native forward tests remain skipped. This is not complete release testing.
