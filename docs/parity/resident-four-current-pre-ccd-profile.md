# Separate four-ball native-current pre-CCD profile

**HOST schedule/component implementation. Not whole-h, GPU, numerical or release
qualification.** Original `world-h.mjs`, `world-ccd.mjs`, `cue-bridge.mjs`, frozen
four/five-macro source and old evidence are unchanged.

## Opt-in API and actual wiring

`src/resident-candidate/world-current-pre-ccd.mjs` exports:

```
generateWorldHCurrentPreCcdPlan(template, {
  profile: 'four-ball-live-cue-native-current-pre-v1',
  count,
  // Same explicitly selected transports/numericProfile as generateWorldHPlan.
})
```

The new function derives a baseline plan but changes its **complete source
schedule**, not merely an additional checker:

- `begin-ccd` keeps only the unchanged cue-absent branch; live cue does nothing.
- Neither `cue-pre-ccd-{0,1}` nor early `entry-inactive` has a scheduled CALL.
- After `narrow-commit`, `active-ccd-pre-begin` selects either the unchanged
  post-cue path or `rc_wcp_begin` for the current six-role live-cue roster.
- The original `entry-inactive-evaluate` / new control loop executes there,
  followed by `entry-inactive-done`, then `energy-begin`.
- The unchanged original64→11 graph is used for every actual awake role, in
  native chunk order. Its encoded program is byte-identical to the cue pre graph.
- `roster-and-new-wake` now validates the source prechecked mask. There is no
  after-energy pre-prediction or scheduled `newly-awake-inactive` CALL.
- Solver preparation requires the post-energy mask receipt. Ball/cue post-CCD,
  deferred cue solve, ball solve, event/rule/h publication and source caps retain
  their old source functions and ordering.

Unscheduled legacy pipeline definitions remain solely to preserve immutable
pipeline IDs and existing explicit owner partitions. The generated source-PC
bytecode has **no CALL** to their old precheck entries. This is checked, not
inferred from a helper's behavior.

## Source-state admission and receipt

Source bindings must be four original dynamic spheres, original dynamic shaft
and head, and a fixed guide, with matching initial identity and generations.
At runtime the distinct owner requires completed narrow/journal state, scene
phase5 and scene-world phase1, exact current h/cue frame/dt, initialized cue mass,
and live cue. It captures the actual awake chunk and validates reverse body
indices, uniqueness, all six activation flags and immutable slot/handle mapping.

Canonical64 pose/velocity/inertia and retained force47 are gathered before force
update. Previous force/torque rows are checked against the retained source bridge;
never-before-observed rows must match original initial force/torque metadata.
Cue extent/thickness must equal current registered initialization outputs. Every
input is finite. The evaluator and all arithmetic operations remain unchanged.

Adapter storage stays in the existing96-word CCD tail:

- words16..21: up to six roles in actual current order;
- words32..44: magic/version, h/frame/epoch, count/cursor, awake/checked masks,
  completion, exact dt, post-energy validation and failure reason.

No canonical body, scratch layout, immutable program, binding count or candidate
stride is expanded. Original active post-cue use of this tail is disjoint in time
and resets it through its unchanged begin path. Two-bank isolation is tested.

Only a complete all-inactive proof reaches adapter phase13 and energy. An active
predicate, bad/missing mask, altered wake order, foreign role, stale source phase,
retained-force disagreement or unsupported new awake role becomes unsupported,
not a false miss. After energy only a subset of already checked roles may be
awake; energy may sleep/reorder bodies, but cannot replace the prediction with
new force.

**Same-h cue withdrawal is deliberately unsupported.** It is detected after
narrow and before solve/h publication. Earlier cue application/collision state
can already have changed; this profile makes no transactional rollback claim.
Do not resume that partial rejected bank as an admitted candidate.

## Tests and exact scope

`tests/resident-candidate-world-current-pre-ccd.mjs` uses the fresh independent
six-boundary witness described in `resident-native-current-pre-ccd.md`. Its
native pre-energy states are explicitly **prepared component fixtures**, never
initial-only world inputs or an asserted full h execution. For each boundary it
executes the entire new pre-owner begin/evaluate/control/finish/post-energy
lifecycle and compares every64 input/11 output word and actual awake order.

Tests also execute the changed stage bodies, check energy/roster placement and
failure guards, malformed masks/order, late untested wake, changed retained
force, early phase, duplicate completion and same-h withdrawal. Default plan
objects and every unaffected shader remain exact, with source solver/geometry/
CCD pass capacities unchanged. Existing16-owner routing and merged **source-as-
data** composition link without introducing a new numerical request kind.

This is not a physical counterexample against frozen row219 h192. The authentic
witness has exact old/current predicate inputs and dt at its six sampled h.
It does not prove other h, other rows or arbitrary force transitions.

## Next required whole-h gate and exact integration hook

No promoted runtime use is committed. The next independent gate must select the
new generator BEFORE any source-PC lowering:

1. In a new separately named test/profile, replace only the call to
   `generateWorldHPlan` with `generateWorldHCurrentPreCcdPlan` for the authenticated
   original initial template (or declare the existing owned h192 bank as a
   diagnostic initial boundary, **not** a raw-to-h193 proof).
2. Call unchanged `compileWorldDevicePc(newPlan, {programBase, controlTailBase,
   maxH:1})`, then `compileWorldSourceOwners(template,newPlan,newPc,{
   controlVisitPolicy:'single-call',controlPartition:'source-closures-v1'})`.
3. `composeWorldMicrocodeSource(newOwners)` is the exact source-as-data integration
   seam. Shared numeric request kind20 still invokes the unchanged pre program;
   no graph-owner rewrite or runtime callback is necessary.
4. Compile a **new** source/bytecode identity and new macro approval descriptors.
   Never patch the old compiled instructions, relabel the old frozen artifact or
   reuse old source hashes. The immutable source-PC schedule must be freshly
   lowered/rebased; h192 physical state must remain the authentic owned input.
5. Execute the entire new h transition, then compare original source-owner groups
   and the independent original h193 native projection, emissions, partial-outer
   latch/current dt, source masks and all meaningful retained state. Expected
   future states remain comparison-only. Source control bookkeeping differs and
   must be compared by explicit field ownership, not force whole-bank equality
   or silently drop differences.

Until this succeeds, flags remain `wholeHQualified:false`,
`numericalQualified:false`, `nativeQualified:false`, `releaseActivated:false`.
No GPU execution has occurred for this profile.

## Whole-h admission correction (retained failure)

The first fresh owned h192→193 HOST integration attempt exposed an error in this
**new optional adapter**, not in frozen baseline physics: `journal+15` is
`CONTACT_JOURNAL_LAYOUT.header.cuePresent`, not an event count. The adapter had
copied the cue-absent owner's `==0` guard. Authentic live-cue state is1, so the
run rejected before energy/solve/publication at h192 (reason1;65 pumps;3.95s).
Its unmodified initial/final remain `/tmp/resident-four-current-preccd-h193-v1/`
with SHA256 `88c26ce0319fd658af3a43906bd326847b4f27bc6bf3c20fee9f8a0ef56b0891`
and `5b2089cddde8375dc2b2fa8cdb378b151cc65e0bcd3e656f09e122a258a8e873`.

The repair uses exported journal header constants and requires cuePresent1,
original cueCount3, and no removed colliders. Component fixtures now derive cue
presence/count and removals from the actual native pre-energy collider arena and
original registered collider rows; they no longer assign a convenient zero.
Negative tests independently reject absent journal cue, wrong count and removal.
All7 HOST component/schedule tests pass after this correction. Full-transition
qualification is a separate artifact and must not be inferred from those tests.

## Completed bounded owned HOST h192→193 gate

`tests/resident-candidate-four-current-preccd-whole-h.mjs` now integrates the
**entire new schedule** through unchanged PC → original16 owners → merged
source-as-data → fresh scalar VM, with fresh canonical four-macro approvals.
This is a separately declared owned-h192 diagnostic, **not raw creation or a
raw-to-h193 replay**. The original h/dt, solver, geometry, CCD and horizon caps
are unchanged. No GPU was executed and no release/profile flag was activated.

Preparation consumes pinned original `post-impact-profile-v1/initial.v8`
(`05f78e…`) only as declared t0. Fresh genuine original row219 creation supplies
immutable metadata/programs; its one-h fixture expectation is not consumed.
The common raw-template geometry distinction uses the existing exact
`classifyCreatedGeometryDifferences` overwrite-before-read proof and retains
that pinned binding unchanged. Only the original PC begin bookkeeping and
newly lowered phase schedule differ at diagnostic start. Physical state, dirty
scratch, geometry, inputs, audit and old completed checkpoints are untouched.

Run artifacts are `/tmp/resident-four-current-preccd-h193-v2/`, each written
with exclusive creation and pinned by hash before comparison:

- initial: `316e12d1794a81ea9ab1f65dc228d302a620a929ae7990cdaa6f18d7c9494d1f`
- final: `1117b13edb594291702f69bdd6be07fbad3ac7cb11114bdf0fe754843e5632b4`
- all old/new changed words:
  `6847c946de776d2cd74ffcf3f88422009ca38e4995a76b9938c409c2748dce66`

The full h completed in108 bounded HOST pumps /34.18s (not a GPU timing), with
77 original numeric evaluations,4 cue advances,3 coupled advances and1 broad
commit. The new phase program has118 instructions; unchanged old schedule124.
The scalar source ran2,720,947 instructions across accepted219/rejected522.

Only AFTER final serialization, independent comparisons ran:

- All11 represented source-owner groups exact at both initial h192 and final
  h193, against a fresh original source stepper through193h (comparison only).
- All8 represented original PhysicsLab h193 groups exact: balls, cue, clock,
  rules, complete retained history, game, partial outer and full emission tape.
- The actual current pre-energy order is **shaft22:g3 → head20:g3 → selected17:g0**
  (canonical roles4,5,1). Every64 input and11 output words per body equal the
  independent original native boundary; mask50, epoch15107, dtword931694729.
- True outer4 remains partial: one of64 h completed; outer3/scorer3 remain
  committed. No convenience full-outer equality is substituted.

Every old/new word difference is saved, not erased or normalized:

| Binding/region | Changed words | Source reason |
|---|---:|---|
| Candidate CCD adapter |16| Pre-evaluation count now includes both cue roles; new exact order and h/frame/epoch/mask/dt receipt. Every96 adapter words checked against independent current-order expectation plus unchanged post suffix. |
| Source-PC control |12| Shorter immutable schedule, changed skipped/call counts and relocated stale loop frames.599 actual owner returns match source-PC calls/visits and `rc_pc_advance` count. Stale frames match new begin/body/end rows, unchanged source caps and identical source skip predicates despite renumbered IDs. |
| Numeric request tail |1| Completed request originalPC105→99; exact same source pipeline73 and successful source status. |
| Immutable phase-program suffix |264| Newly lowered118-row schedule versus124; all original arithmetic-program prefix words remain exact. |

**Every other physical/source-owner word, all rejected-lane words, every dirty
numeric scratch word, geometry/input word, and complete audit/checkpoint word is
byte-identical.** This broad equality supplements, rather than replaces, fresh
original-source/native projections. Source-PC skipped counters are retained new
schedule bookkeeping, not required to equal the known differently ordered old
schedule. No complete native-engine-memory equality is claimed.

Fast artifact-only regression:

```
node --test tests/resident-candidate-four-current-preccd-whole-h-tests.mjs
```

6pass/0fail/0skip (2.84s), including physical/scratch/audit/order/epoch/control
mutation rejection. This suite does not rerun a scalar h or native prefix.
Explicit reconstruction commands (fresh directory required):

```
node tests/resident-candidate-four-current-preccd-whole-h.mjs prepare ARTIFACT_ROOT NEW_DIR
node tests/resident-candidate-four-current-preccd-whole-h.mjs run NEW_DIR
node tests/resident-candidate-four-current-preccd-whole-h.mjs compare NEW_DIR ARTIFACT_ROOT
```

The gate proves only this independently checked **owned HOST one-h transition**.
New-profile native execution, raw recurrence, same-h withdrawal, arbitrary input,
full rest and release admission remain unqualified. Baseline four/five source
and frozen raw evidence remain unchanged.
