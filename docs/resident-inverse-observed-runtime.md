# Optional audited inverse-observation runtime

## Scope and authority

This is a separate, **diagnostic-only** fixed four-ball profile, not a new default
executor or a qualified solver producer. It is born with `maxH = 192`, two raw
rows (accepted-settings row 219 and rejected row 522), the original physical
horizon/caps and the existing four exact native macros. Transport pump counts do
not change the physical horizon. No previous VM layout or evolved source bank
is accepted as initialization.

`resident-raw-tip-impact-inverse-observation-runtime-v1` and
`source-coupled-inverse-observation-v1` distinguish this source from the historical
four-macro profile. Its fresh bytecode, entry/return slots, generated kernel and
initial-source resources have separate immutable admission hashes. The old
profile's bytecode/descriptor pins and selected macros are not rewritten.

## Resident scheduling

The existing authenticated source composer wraps two original application entry
points. Initial observation is performed once immediately before the original
`rc_world_application_begin_outer`; subsequent observations run after the actual
solve and before `rc_world_application_begin_post_h`. These calls are inside the
resident program. They are not additional host per-h dispatches or CPU frame
uploads. Source application h/time and the bank+10 CCD subdivision remain
separate. The original binary64 time addition after f32 widening, convex output,
positive-impulse word predicate and source-order reducer are retained.

Bindings 0–4 and their logical lengths are unchanged. Physical binding 7 contains
one fresh GPU-zeroed slab. The original event-audit/checkpoint prefix keeps its
original logical length; a disjoint aligned tail holds the latest frame and
resident reducer state. Every access goes through the already proven reversible
logical-view mapping. This allocation includes qualification snapshots and is
**not** a production compact-result or 1024-row memory estimate.

The session uploads immutable raw initialization data once, initializes once,
then pumps the original source PC and four handlers. Optional predeclared
checkpoints only copy GPU buffers. One final map returns the entire original
audit prefix, the observer tail and the alignment padding separately. Neither
maps nor CPU-observed frame values control recurrence. A completed session cannot
be reset or reopened. Limits and allocation failures are explicit, never a
candidate-count reduction.

## Preparation and HOST gates

- `tests/resident-candidate-inverse-observed-prepare.mjs` builds an initial-only
  source candidate and, separately, admits it against the pinned profile.
- `tests/resident-candidate-inverse-observed-runtime-profile.mjs` is the lean
  source/shape/limit contract. Its diagnostic allocation estimate counts real
  scratch aliases once; it is not measured GPU memory.
- `tests/resident-candidate-inverse-observed-runtime.mjs` checks fresh source
  composition, unchanged native macro closures and old profile pins, plus a
  fake-device lifecycle. Mock copy markers are **not physical events** or VM
  completion values.
- `tests/resident-candidate-inverse-audited-world.mjs` is the separate genuine
  created-t0/two-h source comparison, including all eleven original state groups,
  exact observation frames and the complete original audit prefix. It does not
  prove raw-to-h192 observation trajectories.

The fresh initial fixture is a local diagnostic prerequisite: it uses
`originalRegisteredFixture` and the authenticated initial capture/decoder listed
there. These tests are not portable artifact-free repository regressions. The observation
metadata field `expected` names the immutable route target/event specification,
not future frames or expected state banks. No expected future states enter the
runtime.

## Qualification still required

No GPU execution, h192 observed trajectory, full-rest terminal observation,
1024-row throughput or hardware speed claim follows from these HOST checks.
Numerical authority remains explicitly bound to the supported V8 Number profile,
not all JavaScript engines. Unsupported projection/precision/source states must
stay unsupported.

The terminal scalar join is deliberately **not scheduled** in this profile;
latest frame/reducer diagnostics do not become a terminal receipt. Existing
legacy source-query observations are not final-gameplay receipts. Public inverse
wave commit remains fail-closed until a source-matched qualified GPU terminal
producer and, for a winner, a separately source-checked replay artifact exist.
Replay may provide display/path/distance only; it cannot repair GPU residuals or
silently replace a mismatched result.

## Recorded HOST checkpoint

The separately generated source has 154,099 instructions and 8,158 local words.
The complete audit+observer allocation is 259,072 words (1,036,288 bytes), of which
4,992 words are observer state and 56 words are alignment padding. Two final-only
diagnostic captures give a planned total of 13,807,308 owned buffer bytes, not a
measurement of driver/compiler residency.

New source/profile/lifecycle tests: **3 passed** (15.01 s). Existing genuine
created-t0/two-h, audit helper and runtime compatibility tests: **19 passed**
(35.53 s; no skips). The genuine recurrence has three frames, no active tip event,
and is not a raw-to-h192 run. Exact source hashes, resource rows and boundaries
are recorded in `docs/evidence/resident-inverse-observed-runtime-host.json`.

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
  node --test tests/resident-candidate-inverse-observed-runtime.mjs
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
  node --test --test-concurrency=1 \
  tests/resident-candidate-microcode-world-runtime-tests.mjs \
  tests/resident-candidate-tip-impact-runtime-tests.mjs \
  tests/resident-candidate-inverse-audited-world.mjs
```

The compatibility suites also require their already documented historical local
initial/runtime artifacts. No native/Dawn test is part of these commands.
