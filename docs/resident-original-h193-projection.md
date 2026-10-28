# Independent original PhysicsLab h193 projection

The same authentic row219 `(310°,85°,4.5,.2,-.1)` now has a **fresh original CPU
h193 assertion endpoint**. It starts at the authenticated original prestrike,
uses the original clearance/strike path, completes three original64-h outers,
then completes only the first h of outer4. No saved h192/h193 bank or expected
future is used to advance the original engine.

## Exact partial-outer boundary

`PhysicsLab.step` calls `compliantTipContact(h)` at the beginning of each inner
iteration (`physics.js:248–269`). A transparent TEST-only wrapper forwards its
first call in outer4. The next call occurs **after** h193's native step, binary64
time accumulation, obstruction observation, collision-event drain, angular patch
and cue-expiry check. The wrapper captures there and throws a private sentinel
**before** h194's first compliant effect. An angular wrapper forwards identical
receiver/arguments and witnesses one completed angular call. `PhysicsLab.step`
and Rapier numerical implementations remain unchanged; all wrappers are restored.

Unwinding is deliberate: the original outer-dt restore, application-step count,
presentation loop, optimizer outer observation and game-finalization boundary
have not run for outer4. The captured trial is disposed, never resumed by calling
`step(1)` again. A second snapshot after unwinding is exactly identical.

Actual boundary:

- native h193; completed outers/scorer steps3; outer4/substep1 of latched64;
- h=`1/61440`, current native dt word`931694729`, **not** outer dt`1/960`;
- time`5.6323079427080485`; application steps5407;
- cue present/contacted, one contact episode, accumulated normal impulse
  `0.5958041510074077`;
- all emitted events/receipts, full game/scorer snapshots, full ball/cue records,
  last120 history and native snapshot bytes retained.

The reused oracle snapshot's legacy `kind` and `boundary` fields describe its
outer-oriented wrapper and last **completed** outer3. They are retained unchanged,
not treated as proof of outer4 completion. The new explicit partial-outer receipt
is authoritative for this diagnostic's boundary.

## Strict comparison result

After the fresh native capture finishes, the assertion loader opens the pinned
existing HOST diagnostic's `post-impact-profile-v1/four-final.v8`. It also checks
that the entire fresh native CREATED and complete-h192 snapshots match earlier
independent evidence, including native snapshot bytes. These are assertions only.

All8 represented groups match exactly: **balls, cue, clock, rules, history, game,
partialOuter, emissions**. Every existing field in the completed-outer native
projection is retained. Only expected clock substep is adapted to the observed1;
no outer completion, dt restoration or scorer increment is invented. Additional
guards compare the resident next-h-ready phase, actual inner dt, binary64 h/dt,
latched64, cue frame/started time, and completed deferred solve. The complete
accepted emission tape is checked, not just its count or last entry.

This is not complete native-engine memory equality: native contact caches, BVH,
journal allocator, warmstarts and joint impulses are outside this projection.
Full native game static metadata/scores and cue guide/COM metadata remain in the
capture but are not falsely reconstructed as resident fields. The separate
all11 source-owner gate retains its own scope. No GPU was executed, no scalar VM
prefix was replayed, and no raw-to-h193 GPU/full-rest/hardware claim follows.

## Reproduction

The original fixture/capture and pinned Rapier decoder assets are required.

```sh
node --test tests/resident-candidate-post-impact-native-projection-tests.mjs
node tests/resident-candidate-post-impact-native-projection.mjs compare \
  /tmp/new-h193-comparison /path/to/resident-native-artifacts
```

`capture` mode accepts only a new output directory and does not read comparison
artifacts. `compare` captures independently first, then loads the pinned files.
The focused tests include altered bits in all8 roots, fake outer completion,
wrong native dt and incomplete cue solve. The original CPU193-h prefix took about
101–147ms in the observed runs, excluding initial fixture loading; this is **not**
a matched GPU benchmark or calibrated speed ratio.
