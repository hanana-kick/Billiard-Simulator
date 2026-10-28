# Exact cue-reference profile diagnosis

## Result

The retained h192 mismatch is reproduced exactly by the **deliberately
approximate CPU source-owner oracle**, not by changing the resident physics:

| h192 tangent low words | x | y | z |
|---|---:|---:|---:|
| Original PhysicsLab / independent JS Number / resident binary64 | 3610802870 | 2545628303 | 3902929616 |
| Compensated tangent recurrence / frozen legacy source owner | 3610802880 | 2545628320 | 3902929632 |
| Actual minus legacy expected | -10 | -17 | -16 |

The high words agree. No tolerance, predicate, original source, GPU code, or
historical gate was changed in this checkpoint.

The ordinary created reference factory at
`experimental-cue-created-stroke-stage.js:28` selects
`C.compensatedReference` and `T.compensatedReference`. Those are explicitly
double-single approximations, not exact IEEE binary64 references. The original
Number alternatives already exist. The resident `compileCueTipProgram` follows
the original Number law and native f32 API cast boundaries.

The first loss is demonstrable **before** sqrt/hypot: packing `.006`, `1/61440`,
and `.7` as f32 high-plus-residual changes their reconstructed binary64 low word
by -2, -1, and +2 respectively. The DS length also uses a different approximation
from original `Math.hypot`; no need to speculate that V8 hypot itself caused this
observed failure.

## Independent evidence

The capture generator restores the authenticated prestrike snapshot and applies
actual original row219 controls (angle310, elevation85, speed4.5, tip .2/-.1).
It executes exactly three unchanged latched outer calls (192 native h). Transparent
test-only wrappers forward the original compliant-tip and velocity-at-point calls
with identical receivers, arguments and results. At the selected-ball velocity
read, the lateral impulse has happened and the tip impulse has not: the getter
captures genuine inputs, not reconstructed final registers. Entry-time lifecycle
and tangent are retained separately because PhysicsLab inserts a birth contact
before that velocity read. Wrappers are restored in `finally`.

For **all 28 actual calls h165–192**:

- Original native tangent and post-tip body velocity outputs equal independent
  `Tip.sourceReference` bit for bit.
- Resident software-binary64 tip execution equals all represented source outputs
  bit for bit, including tangent, coefficients, impulse, point, and body outputs.
- Same-input compensated tangent already differs at first birth h165.
- Repeating only the compensated tangent on those observed inputs reproduces
  the frozen legacy source-owner h192 words exactly, including the y-history
  difference that a single final call does not reproduce.

The committed JSON fixture is **assertion-only**. No evolved value goes into a
resident world. The frozen V8 expected artifact was read only to confirm the
legacy final words; standalone regressions do not require it.

Run standalone:

```sh
node --test tests/resident-candidate-cue-reference-profile-diagnosis.mjs \
  tests/resident-candidate-cue-reference-native-diagnosis.mjs
```

Regenerate/verify actual observation (requires the existing authenticated
`originalRegisteredFixture` capture, bundled pinned Rapier and decoder):

```sh
RUN_RESIDENT_CUE_NUMBER_NATIVE_CAPTURE=1 node --test \
  tests/resident-candidate-cue-reference-profile-diagnosis.mjs \
  tests/resident-candidate-cue-reference-native-diagnosis.mjs
```

Observed: 5/5 pass in 2.19 s on Node24.22.1/V8 13.6.233.17-node.58. This is
CPU correctness evidence, not a performance benchmark. Full fresh source-owner
128/192 recurrence with an explicit original-Number profile remains a separate
gate owned by the compiler worker; no full-rest/1024/GPU qualification follows
from this diagnostic.

## Bounded application-reference inventory (read-only)

| Owner / factory | Default arithmetic | Independent original alternative / boundary |
|---|---|---|
| Created cue `experimental-cue-created-stroke-stage.js:28` | DS lateral + DS tip | `experimental-cue-lateral-compensated.js:24` delegates to compliance `sourceReference`; tip module `sourceReference` at22. Current mismatch proved here. |
| Four-ball angular patch factory `experimental-four-ball-world.js:230` | `P.createReferencePostWorldStage` -> `stepPreciseReference`, DS ~48-bit | `experimental-angular-patch.js:78` already exposes `createSourceDoublePostWorldStage`; source JS law at22 retains Math.hypot, then native f32 torque application. This is another explicit profile boundary, not proved faulty on current192. |
| Older `experimental-cue-stroke-stage.js:21` | f32 lateral + DS tip | Distinct older non-created stage; do not silently relabel as original-Number. |
| Three-ball, three-ball-CCD, cloth and cloth-island-patch world factories | Same DS post-world patch factory | Same source-double alternative; legacy defaults/gates must remain distinct. |
| Angular standalone trackers | `createReferenceTracker` is source JS; `createF32Tracker` is f32; `stepPreciseReference` is DS | Factory names alone do not determine precision. `createGpuPostWorldStage` is DS, not original f64. |

Only three numerical consumers import the shared `experimental-double-single`
module in this source tree: lateral, tip and angular patch. This inventory does
**not** imply that every f32 arithmetic graph is approximate: Rapier's original
native solver operations are f32 and are independently source-ordered ports.

Existing `tests/experimental-angular-patch.cjs` retains bounded original/native,
f32 and DS comparisons and exact DS CPU/GPU graph checks. Its declared numeric
criteria include torque absolute2e-12/relative2e-6 and angular relative2e-6;
passing them is not exact original-double qualification. Resident
`tests/resident-candidate-application.mjs:15` instead compares binary64 source
torque and final native f32 bits against `Source.sourceReference`; its opt-in
native test is a component gate, not an all-world proof. Neither suite was
rerun or weakened for this inventory.

No production/default reference routing is changed here. The parent owns
explicit profile selection and acceptance; old evidence must keep its original
precision label.
