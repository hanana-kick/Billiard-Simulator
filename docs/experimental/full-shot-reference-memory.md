# Full-shot reference memory, not physics

The original full-shot captures remain immutable inputs. This change does not
modify `src/`, the capture/oracle modules, snapshots, native decoder, seed
exporters, expected numbers, comparison tolerances, or CPU/GPU execution paths.
The full-shot tests' comparison/runner/test suffixes are byte-identical to commit
`3617c65`; `tests/full-shot-reference-memory.cjs` freezes those exact bytes.

## Two separate memory budgets

1. Preparation is an offline, expected-only conversion in its own Node process.
   It calls the **unchanged original loader**, including the loader's existing
   provenance, artifact hash, snapshot, grid, transition, and summary checks.
   The original monolithic V8 artifact must still be fully deserialized here.
   A 512 MiB heap is not claimed to suffice for preparation.
2. Actual replay reads only the small prepared reference. It rechecks the entire
   original artifact's SHA-256 and length in bounded 1 MiB chunks, verifies the
   original manifest and original source identity, and checks the prepared hash,
   conversion/assertion source hashes, and equivalence certificate. It never
   deserializes the original full-shot artifact.

Preparation reports memory at original load, projection, equivalence, and raw
reference release, plus process high-water RSS. `--expose-gc` is optional for the
last diagnostic only. Neither correctness nor actual replay requires explicit
GC. `tools/measure-full-shot-reference.cjs` reports a separate actual replay-load
and unchanged-seed-export memory budget without constructing a candidate world
or stepping physics.

## Preparation and replay

Use the same native decoder and frozen artifact environment as the original
tests. Use a new absolute output path; preparation refuses to overwrite either
frozen captures or prepared evidence.

```sh
node --expose-gc tools/prepare-full-shot-reference.cjs four-ball /absolute/new-four-reference.v8
export FOUR_BALL_FULL_REFERENCE=/absolute/new-four-reference.v8
node --max-old-space-size=512 tools/measure-full-shot-reference.cjs four-ball
node --test tests/experimental-four-ball-full-shot.cjs

node --expose-gc tools/prepare-full-shot-reference.cjs yaw15 /absolute/new-yaw-reference.v8
export YAW15_FULL_REFERENCE=/absolute/new-yaw-reference.v8
node --max-old-space-size=512 tools/measure-full-shot-reference.cjs yaw15
node --test tests/experimental-three-ball-yaw-full-shot.cjs
```

The existing `FOUR_BALL_CREATION_V8`, `FOUR_BALL_FULL_REPLAY`, `YAW15_REPLAY`,
`YAW15_FULL_REPLAY`, decoder, and mandatory GPU variables still name the originals.
No test falls back to a shorter horizon or skips a required comparison if a
prepared reference is missing or stale. It fails with the preparation instruction.

## Exact retention and omission contract

All per-frame rows are retained **unchanged**, including their complete event,
pose, velocity, inertia, sleep, game, and score values. No frame is sampled,
deduplicated, quantized, rescaled, regenerated, or removed. Checkpoint order,
steps, and reasons are retained; no checkpoint is removed.

### Four-ball checkpoints

Retained fields are exactly the data consumed by the existing `checkpoint`,
`cache`, `compareCache`, and `Graph.graphView` functions:

- Complete island manager and modified-body queue.
- Every body's handle, IDs, changes, and body type. Dynamic bodies also retain
  all five tested activation scalars and both sleep-history pose vectors.
- Every collider handle and parent-body handle, in original order.
- Every fat-proxy index/min/max and every contact pair's collider identities.
- Complete directional graph node weights/next links and edge next links.
- Every rigid contact's solver color and recycle validity/translation/rotation/
  max extent/max drift; all manifolds remain present. Each manifold retains
  its second local normal, points' local positions/distance, seven tested impulse
  and displacement fields, solver normal, anchors, and contact IDs. Keeping all
  manifolds also preserves graph active-state tests based on solver-contact
  counts. Non-rigid graph variants remain non-rigid.

Omitted are never-read duplicated raw snapshot bytes, lossless typed decoder
nodes (`typedState`), checkpoint capture metadata/application registry, verification
and summary objects, unqueried state arenas, broad-phase tree internals, unused
body/collider fields, joints, unused queues, and unused contact fields. Snapshot
bytes and all omitted fields remain available in the verified original artifact.
The root's unused schema/h-count/outer-step duplicates are not retained.
The complete aggregate event list is also retained unchanged. Full frame rows are intentionally not minimized.

The initial creation record is still loaded by the original `F.loadArtifact`,
validated, and passed without modification to the original `E.exportInitialSeed`.
It becomes block-local instead of remaining rooted for the whole CPU/GPU test.
Expected checkpoints never feed that seed or a candidate step.

### Yaw15 checkpoints

Preparation calls the same original `F.decode`, `F.flatBalls`,
`PairOracle.pairCache`, `GraphAssert.inspect`, and `CushionAssert.inspect` helper
expressions previously called in the replay `before` hook. Their complete plain
outputs are stored, not approximated or replaced by new contact calculations.

Raw checkpoint retention is limited to the complete island manager,
modified-body queue, every role's tested IDs/changes/activation/history, and joint
edge impulse vectors plus each limit impulse. All direct raw fields read by
`compareCheckpoint` remain. Raw native snapshot bytes, full collider/body physics
structures, integration state, source metadata, and unused joint fields are not
retained in the prepared checkpoints. They remain in the immutable original.
The unused top-level transition and prefix-agreement copies are omitted only
**after** the unchanged original loader verifies their complete invariants.

The full original `record` is retained verbatim in the prepared payload. Replay
still executes unchanged `Yaw.exportSeed(record)` and its original verification.
Only after export, the replay record reference is reduced to roles and initial
snapshot hash, the two fields subsequently read by checkpoint comparisons and
failure evidence. Any initial-created data intentionally retained by the seed
continues to be retained; it is not altered.

## Assertion equivalence and source freezing

The independent equivalence helper obtains unchanged comparison functions from
the existing test sources. It constructs candidate-shaped values only from each
original captured row, never from a projected expected row, then feeds that same
captured-value candidate to the original and projected expected-value paths.
Assertions are actually executed. Streaming assertion transcript hashes and
counts must agree. This is a storage-equivalence regression, not a substitute
for the actual CPU/native and GPU/native full-shot regressions.

The prepared manifest binds the original artifact bytes and original manifest,
original identity, projection implementation, equivalence implementation,
preparation script, full-shot assertion source, graph/contact helpers, and native
GPU lifetime diagnostic owner. Actual full-shot `after` checks preserve the
existing loaded/disk source freezing and additionally freeze these new helpers,
the full-shot test itself, and `native-gpu-test-owner.cjs` explicitly.

Failure artifacts now contain the checked projection in their nearest checkpoint
field. The original artifact path and seed snapshot hash remain in yaw evidence;
the original file is the authoritative source for omitted raw diagnostic data.

## Applying the boundary to settled/goal tests later

`hashFile`, `validateOriginal`, manifest verification, memory reporting, and the
four-ball row projector are separate from physics. The settled-four test has a
similar checkpoint contract, but its first-h broad-phase insertion assertions
require additional tree/pending-update fields. The goal-four test also checks
first-h insertion tree fields, first/withdrawal/rest/controller boundaries,
placement provenance, local first normals, feature IDs, and relative/body recycle
rotations. Do **not** simply use the default-four whitelist for those tests.
Add a kind-specific projector and equivalence adapter while retaining their
unmodified seed/export/provenance paths and every extra assertion. Those test
files are deliberately not changed in this patch.


## Measured storage-equivalence and load results (2026-10-24)

Evidence was prepared from implementation `c5893e5`, without candidate physics
or GPU dispatch. Both preparations used `--max-old-space-size=1536`; both separate
load/unchanged-seed-export diagnostics used `--max-old-space-size=512` **without**
`--expose-gc`. Source hashes also matched the integrated coordinator worktree.

| Measurement | Four-ball | Yaw15 |
| --- | ---: | ---: |
| Original artifact bytes | 144,434,495 | 29,631,902 |
| Prepared artifact bytes | 17,313,880 | 18,188,687 |
| All frames checked | 5,845 | 9,600 |
| Positive checkpoints checked | 132 | 110 |
| Checkpoints retained, including step zero | 133 | 111 |
| Actual assertions per original/projected pass | 1,048,347 | 1,114,742 |
| Preparation high-water RSS bytes | 948,334,592 | 423,391,232 |
| Separate load + seed heap-used bytes | 95,660,520 | 118,489,864 |
| Separate load + seed RSS bytes | 195,661,824 | 262,885,376 |

Each pair of ordered assertion transcripts had identical method counts and hash:

- Four-ball: `dcda5d2378fb1efbd3e7e70759215c4d2c15f0cab721486547d759697c6fe972`.
- Yaw15: `35ad158345867faaaf192f611852151712d73fe0cc8a24acf087c3de00e9a7f4`.
  All three original application contacts were compared as well.

The four-ball preparation still reported approximately 512 MB heap-used after
clearing the original binding and optional diagnostic GC. That is explicitly
**not** treated as proof that the preparation process has returned to its compact
steady-state budget. The separate replay-load process is the relevant evidence:
it never loaded the original monolithic V8 and stayed within its 512 MiB heap cap.
Preparation process exit isolates the raw-deserialization peak from actual GPU
replay. Increasing the preparation heap cap is not the claimed fix.

Prepared files and detailed phase-by-phase JSON manifests/logs are under
`/workspace/shared/billiard-parity-v3-checkpoints/reference-memory/`, named
`four-ball-c5893e5.v8` and `yaw15-c5893e5.v8`, with `.json` manifests and matching
`*-prepare-c5893e5.log` / `*-load512-c5893e5.log` diagnostics. The captures named by
the original environment were read-only and were hash-reverified after preparation.
These results establish storage equivalence and reduced fixture-loading memory,
not actual CPU/GPU full-shot parity; those regressions must still run unchanged.
