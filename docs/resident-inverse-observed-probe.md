# Diagnostic raw inverse-observation two-h profile

This opt-in **count2/two-h source profile is not native-qualified**. It is distinct
from the committed count2/h192 observed profile, whose code/descriptor/kernel
pins and generated source remain unchanged. No solver, terminal policy, UI or
production backend is activated.

## Initial-only interface

`compileInverseProbeRuntimeCandidate` in
`tests/resident-candidate-inverse-probe-prepare.mjs` accepts the same branded
original initialization plan, authenticated common created seed, fixed raw rows
219/522 and provenance as the h192 source factory. It lowers a **fresh maxH=2**
original PC. `prepareInverseProbeRuntime` additionally enforces the separate
immutable source/code/shape pins. Transport work must be explicit. The original
physical query horizon remains 16 seconds / 15,360 outer steps; two h is only the
named diagnostic request, not a miss or a truncated full-rest verification.

`serializeRawInverseProbePcRuntime` has its own initial-only kind and exact
count2/two-h validation. Neither an old profile's kind nor horizon is rewritten
to pass its validator. All raw initialization commands remain source-ordered.
The native path still initializes fresh GPU banks; the HOST-created test described
below is a different, explicitly labeled source test, not an initializer fallback.

## Three logical views, eight physical bindings

Bindings 0–4 retain their original bytes and logical lengths. Binding7 contains:

| Logical view | Offset, words | Length, words |
|---|---:|---:|
| Complete original emission audit | 0 | 2,056 |
| Alignment padding | 2,056 | 56 |
| Existing observer/reducer banks | 2,112 | 4,992 |
| Diagnostic frame slots/control | 7,104 | 896 |

The total is **8,000 words / 32,000 bytes**. This is qualification storage, not a
production compact-output estimate. The diagnostic view has two 448-word lanes,
each with a 64-word header and three 128-word slots (16-word header, 108 actual
frame words, four padding words).

`src/resident-candidate/inverse-observation-probe.mjs` renames only the existing
observer declaration, then delegates to that exact original body. After a
successful call it copies the actual frame by sequence0/1/2 into its once-only
slot. Capture makes no writes to physics, audit or observer storage. All new
writes use a final checked address in the third view; an invalid index returns
`0xffffffff` without adding an offset afterward. The original audit and observer
mappers, bounds, convex iteration cap, numeric order and application boundaries
remain unchanged. Duplicate, out-of-order, out-of-range, stale or dirty-slot
attempts fail explicitly. Unwritten/failed frames never decode as zero-valued
observations.

There is no additional per-h dispatch or host frame upload. The existing retained
session pumps its original source PC/four handlers, copies the full slab at a
predeclared final boundary and maps once. It returns separate `auditWords`,
`inverseObservationWords`, padding and `inverseDiagnosticWords`. Raw rejected522
must leave both observer and probe lanes zero/unwritten. Limits, unknown source
pins, aliases and allocation failure are rejected rather than trimming rows.

## HOST evidence and its exact limits

The final serial HOST suite passed **23 tests, zero skips/failures (77.13 s)**.
A subsequent three-test source/lifecycle rerun also passed after adding explicit
source-recovery/write-domain assertions. The suite includes:

- Fresh source compilation and all old h192 observed/kernel/profile pins unchanged.
- Fake-device initialization/retention, three-view copies, single final map,
  immutable source/slot/cap mutation failures and actual buffer limit admission.
  Mock copy markers are not physical events.
- Genuine independently admitted **created219 t0 → two h**, running the exact new
  source bytecode (15,689,516 lane0 core instructions; 355 bounded pumps).
  This is not execution of raw GPU creation.
- Every frame at0/1/2 equals both the original source frame and fresh original
  PhysicsLab frame. The native assertion helper runs the complete unchanged
  64-subdivision outer call and retains only its first two h observations plus t0;
  it does not truncate the native outer call or upload those frames.
- Final original all11 state groups, every original nullable residual/episode
  reducer field, complete empty post-t0 event tape, exact rejected prestrike bank,
  and zero rejected observer/probe storage. No active impact occurs in this gate.
- Capturer-only negative components start from genuine saved pre-capture inputs
  solely as tests. They prove no write outside the new view, no duplicate slot
  overwrite and exact negative/u32/sentinel address rejection. They never repair
  the completed world or confer raw trajectory authority.

The original capture/decoder and documented local historical runtime artifacts
are prerequisites. These are local diagnostic gates, not artifact-free npm
regressions. Expected source/native frames are assertion-only. Source authority
is bound to the supported V8 Number profile, not every browser/engine.

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
  node --test --test-concurrency=1 \
  tests/resident-candidate-inverse-observed-runtime.mjs \
  tests/resident-candidate-microcode-world-runtime-tests.mjs \
  tests/resident-candidate-tip-impact-runtime-tests.mjs \
  tests/resident-candidate-inverse-probe-runtime.mjs \
  tests/resident-candidate-inverse-probe-created-host.mjs
```

Source hashes, sizes and exact scope are in
`docs/evidence/resident-inverse-observed-probe-host.json`.

## Next gate and remaining release boundaries

A coordinated native gate must use fresh raw buffers, the pinned source, fixed
pump budget, all shader preflight, final-only mapping and independent original
assertions for all frame slots/state/tape. HOST355 pumps is diagnostic evidence,
not a GPU timing or guaranteed native completion budget. Native incomplete/error
must stay incomplete/error, never miss. No GPU job is launched by these files.

The terminal query join is still **unscheduled**. Completing maxH2 or maxH192
while the physical world remains running cannot produce an evaluated negative or
winner. A later versioned root hook must use the authentic initial request and
query-plan identity, check actual terminal publication and preserve unfinished
statuses. Legacy source-query records are not final-gameplay receipts. Public
inverse-wave commit remains fail-closed pending qualified native terminal
production and the separately source-matched winner replay artifact.
