# Owned candidate-input capture (bounded, private seam)

`captureLiveRegisteredFourBall({controller, candidate, ...existingOptions})`
accepts this optional exact record:

```js
candidate: {
  settings: {angle: 17.125, elevation: 35, tipX: .17, tipY: -.23, speed: 1.35},
  rules: {fourBallThreeCushion: true}
}
```

Omit `candidate` to retain the existing API and output shape. Explicit
`candidate: undefined` is invalid. Each record must have exactly the indicated
own enumerable data properties; symbols, accessors, inherited records, extra or
missing fields are rejected without evaluating candidate getters. All five
controls must be finite, `0 < speed <= 10`, `0 <= elevation <= 85`, and
`hypot(tipX, tipY) < 1`, matching original `PhysicsLab.strike` admission. Angle
is not wrapped, values are not rounded/clamped, and elevation is never restored.
The rule is an actual boolean, not truthiness conversion. Inputs are owned before
forking; subsequent input mutation does not alter the private candidate.

The same source's original `PhysicsLab.fork()` restores actual native bytes.
Only the private controller's settings and next-shot rule are changed; its
original `fire()` creates the cue. Selected cue, object IDs, positions, native
history, materials, game scores and game setup rules come from the source, not
the candidate. The actual original game `begin()` freezes the per-shot rule.
Capture ends immediately after creation; native stepping is rejected before
invocation. The original source's motionlessness, no-cue/no-pending/no-windup,
four-ball registry and original fire readiness/cooldown/clearance gates remain.
An awake but motionless source is not arbitrarily put to sleep.

The existing strict `capture` schema is unchanged. Its `preStrikeApplication`
now describes the **configured private candidate**, not the unmodified visible
settings. Both native snapshots are still from that source fork. A separate
owned `candidateProvenance` receipt is returned only for explicit candidates:

- schema `live-registered-candidate-v1`;
- `sourceApplication` and `sourceRules` observed before the fork;
- exact `requested` and `applied` settings/rules, and source `selectedId`;
- `clearancePolicy: 'original-fire-no-settings-restoration'`;
- truthful capture-local `captureNativeSteps: 0`, not inferred lifetime steps.

Keep this receipt alongside the strict raw capture; do not spread it into the
strict importer's input. It is provenance, not a scoring certificate or an
independently cryptographic source identity. No raw importer schema is widened.
Capture verifies settings/rules after fire. On cancellation, rejection or error
it restores local wrappers and frees only the private candidate. Success
transfers ownership; call the idempotent `dispose()`. A blocked explicit candidate is refused by the genuine pre-strike clearance
query before original fire. A failed default fire can still surface either
rejection or strict journal-order rejection (its announcement may perform
another clearance query); neither yields an admitted candidate.

## Original search semantics and explicit restrictions

`ShotSearchCore.beginTrial` restores `req.snapshot`, checks cue clearance and,
when elevation search is enabled, may call `findCueFeasible`, normalize the
restored settings and reset DLS state before striking. `LabInverseEvents.begin`
uses a private fixed-elevation request to disable that automatic restoration,
while retaining the caller's original input inequalities. This seam follows the
latter exact-control policy, not the former implicit correction policy.

Physical strike ranges above are **not** search feasibility bounds. Original
search additionally validates target/opponent identities, speed/elevation
bounds, budget, horizon, spin, methods, objective, kiss/motion options and
four-ball carom rules. Those options are not silently accepted here, nor is
`allowKiss` represented as a gameplay rule. Search/scorer integration must retain
its own validated request and input inequalities. Opponent cue foul checking
through full rest and three-cushion freezing at the second distinct red remain
original scoring requirements; this initial-only capture proves neither.

No public search wiring, continuation, CPU/GPU parity claim, fixture/default
world reconstruction, four/three relabeling, or runtime deployment is included.

## Verification

CPU-only command (no GPU dispatch or shot continuation):

```sh
BROWSER_LIVE_REGISTERED_SETTLED=1 node --test tests/live-registered-candidate-capture.cjs tests/browser-live-registered-source.cjs tests/browser-live-configured-four-ball.cjs tests/browser-live-initial-four-ball.cjs
```

Result: 28 pass, 0 fail, 0 skipped. Settled-source preparation ran 5,404
original outer steps before capture; two distinct candidate speeds and rule
values preserve that actual preceding-shot history without stepping. Tests cover
multiple distinct candidate snapshots and rule values from one source, original
fire snapshot equivalence, zero native steps across all capture worlds,
unchanged source snapshot/time/history/undo/redo, ownership under mutation,
exact invalid/accessor rejection before fork, cancellation before and after
fire, mid-fire settings/rule corruption, forbidden stepping, cleanup/retry,
source readiness and actual geometric clearance refusal. Existing default,
placed, settled, awake and per-shot three-cushion capture tests also pass.
Initial/configured observer lifecycle regression tests pass as well.
Full browser/UI, captured-shot continuation and GPU suites were deliberately not
run for this isolated non-public seam while GPU batch validation is active.

## Numerical continuation acceptance

The admission audit confirmed that `live-registered-four-ball.mjs` builds
`sourceOrigin.settings` from the private candidate's captured controls, and the
runtime checks that same origin against its cue application. It does not compare
against the untouched visible controller's settings. No admission whitelist or
physics guard was changed to run the test.

```sh
node --max-old-space-size=256 --test tests/live-registered-candidate-prefix.mjs
```

This test creates one genuine original four-ball source and naturally settles it
(484 outer steps), then captures speeds 1.25 and 2.75 with false/true per-shot
three-cushion rules. The original engine runs only in an isolated producer
subprocess. Its fired private forks generate assertion-only future frames; the
numerical consumer does not load Rapier, restore a native world, or receive those
frames as stepping inputs. It imports only each initial raw capture through the
unchanged strict WASM decoder/importer, then creates the existing four-ball
`createReferenceStepper` owner. The source snapshot remains unchanged even after
private original-reference continuation.

The bounded comparison crosses first original sphere motion plus eight solver
steps (h595 → h603 and h269 → h277), not merely initial cue travel. It reuses the
unchanged per-frame gates and full manager/graph/roster/cache/BVH comparison at
h1, h64 and the impact-prefix endpoint. Initial h1 is observed within the first
outer step; h64 is after the outer return. Their exact application phase counts
are checked, not rounded or relabelled. This remains a short CPU numerical
acceptance test, not GPU parity, complete stroke/withdrawal, full-rest scoring,
or public inverse-search integration.

Measured result: both impact prefixes pass (about 97 seconds, 256 MB JS heap
limit). Speed 1.25: 603 h / 603 internal collision passes, maximum measured
absolute error `1.9225928071797682e-8`; speed 2.75: 277 h / 277 passes, maximum
`2.9784915756003727e-8`. Cue-inertia absolute and normalized error are zero.
Existing gates remain ball pose `1e-6`, ball velocity/inertia and cue motion
`3e-6`, normalized cue inertia `3e-6`, event position `1e-6`, cache/proxy `2e-6`.
All six full-state checkpoints pass without omitted unrepresented fields.
Original/native and owner application steps are respectively 484/484 at h1,
485/485 at h64, then 493/493 at h603 and 488/488 at h277. The 28 capture/lifecycle
regressions were rerun and pass with zero skips after adding this acceptance.

## Genuine pre-strike admission measurement

Explicit candidates additionally return an owned top-level `candidateAdmission`:

- `kind: 'original-prestrike-cue-clearance'`, exact `settings`, `rules`, `selectedId`;
- `time`, `sourceApplicationSteps`, `sourceRevision`, `sourceShots`, `selectedBody`;
- only the required geometric result `clearance: {clear, distance}`;
- `strikeAccepted: true` only after original fire and all capture guards succeed;
- `historyContactCount`, counting the same `contact` history entries as the strict
  importer's `initialContactEvents` (not replayed candidate events).

The measurement comes from original `cueClearance` on this exact private fork at
requested controls before fire. The query is separate from the original strike
journal. Both `lab.step` and native `world.step` are blocked during the query;
application state and complete native pre-strike snapshot bytes must remain
unchanged. Missing/nonfinite/refused clearance, altered query inputs, selection,
rules or pre-strike state reject and dispose the fork. Original fire can still
reject a geometrically clear candidate; no settings restoration is attempted.

This receipt intentionally has **no invented `initialSnapshotSha256`**. The
synchronous capture has not hashed or imported those bytes. Integration must keep
it associated with this return's raw `snapshot`, `preStrikeSnapshot` and capture,
verify its controls/rules/selection/clocks/body against that capture and imported
seed, and only then use the strict importer's verified created snapshot hash when
adapting it for `createFourBallPhysicalScoring`. The receipt is mutable owned data,
not a signature or transferable authority; mixing it with another capture is not
admitted merely because field shapes match. Neither raw capture/import schema nor
the default no-candidate API output changes.

30 capture/lifecycle tests pass with zero skips (about one second). New checks
compare the measurement to an independent original query, preserve exact source
snapshot and history, reject missing/nonfinite results, mutated controls/rules/
selection/state and stepping, test output ownership and preserve original fire
refusal. Heavy numerical-prefix/GPU suites were not rerun for this addition.
