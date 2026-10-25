# Fixed original positive-CCD fixture search

This dedicated source-only fixture searches for an **actual post-solve motion clamp**, not merely an active CCD flag or nonzero first TOI. The earlier elevation-35 h389 case remains a negative clamp control: its two source intervals avoid the post-solve fast-body branch.

## Preregistered scope

`tests/positive-ccd-input.json` fixes the unchanged PhysicsLab constructor's three balls, selected id 1, angle 0°, elevation 60°, tipX 0.25, tipY 0, and speed 10 m/s. It keeps 72 constructor settling steps, no additional settling or placement, dt 1/960, stroke subdivisions 64, max CCD substeps 4, and all original materials, forces, clearance checks, and cue equations.

The discovery horizon is exactly 768 ordinary post-cue world steps (0.8 s), with a 1024 original outer-step safety bound. This is a bounded discovery case, **not an independent holdout**. No other input is tried automatically if the fixed shot has no positive clamp. A negative result cannot pass the positive fixture's artifact tests.

## Data flow and guarantees

1. `positive-ccd-original-fixture.cjs` runs only the original bundled Rapier WASM and `src/physics.js`. It records original pre/post snapshots for every ordinary post-cue step, plus creation provenance, original event neighborhoods, and direct body-setter observations. All existing ball setters are observed as well as the source-created cue bodies. Only the two original cue shaft/head velocity assignments are permitted. The instrumented wrapper delegates every call unchanged; no new force, velocity, pose, CCD setting, or subdivision is supplied.
2. `positive-ccd-source-capture.cjs` loads the immutable original artifact. It prioritizes each actual source contact-event step and its two neighbors, then searches any remaining original steps chronologically. Every probe starts from that frame's independently captured original WASM pre-state. Native post-states are never used to generate later original states or any candidate recurrence.
3. The pinned existing read-only source probe records the exact `Body before-clamp` and immediately adjacent `Body after-clamp` around `rb.pos.next_position = sweep.transform_at(result.fraction)`. The fixture requires fraction < 1, a changed next pose, and unchanged current pose and velocities. It also locates the surrounding post-solve/pre-clamp and post-clamp/pre-advance stages. A clamp-branch visit that changes no represented next-pose bit does not stop the search.
4. Only the first positive step retains a full typed native trace. Negative steps retain compact hashes, pass/split summaries and their small native snapshots, not multi-megabyte JSON traces. The source-probe observation-enabled and disabled replays must be byte identical. A separate **unmodified** pinned source binary must independently reproduce the selected native post-state byte for byte.
5. The selected native post-state is compared with the original WASM post-state field by field and bit by bit. Signed zero is reported explicitly, never normalized. Structural or nonzero numeric differences are also retained rather than described as signed-zero parity. Original WASM and prepared native source remain separate authorities; this is not a candidate world or a full CPU/GPU parity claim.

Each completed native observation is immediately written and fsynced to a create-new, append-only, hash-chained JSONL checkpoint. It includes the original pre/post hashes, binary/source hashes, native post hash, full-output hash, pass/split summaries, and negative/positive clamp counts. A positive step also durably retains its complete trace before checkpointing. A native snapshot file without a completed verified checkpoint is never evidence of a negative clamp.

Resume uses the existing original WASM artifact, validates the exact scanner/source/binary identity and scan-order prefix, verifies saved native bytes, and writes a new output directory and checkpoint. Only a torn final JSONL line may be ignored; checksummed complete lines, changed identities, or other malformed records fail closed. Set `POSITIVE_CCD_RESUME_FROM=/absolute/previous-source.json.checkpoints.jsonl` for the source-capture command, and choose a new output filename. The previous output is never edited.

The original artifact and source capture are create-new only. Loading never silently regenerates expected results. Hashes cover the pinned vendor, source physics, input, fixture implementation, source probe, direct probe, decoder, build provenance, and each snapshot. The prior e35 capture provides the already-verified probe-build reference and explicit negative control; its source hashes and artifact manifest are checked before reuse.

## Reproduction

Use the pinned decoder and native probes built by the existing active-CCD workflows. No native source change or rebuild is needed for this fixture. Ensure the ignored bundled `vendor/rapier.cjs` exists in the worktree and matches the decoder's pinned engine hash.

```sh
node tests/positive-ccd-original-fixture.cjs /absolute/new-e60-original.v8

ACTIVE_CCD_SOURCE_PROBE=/absolute/active-ccd-source-probe \
ACTIVE_CCD_DIRECT_PROBE=/absolute/rapier-active-ccd-probe \
ACTIVE_CCD_BUILD_PROVENANCE=/absolute/active-ccd-probe-provenance.json \
RAPIER_SNAPSHOT_DECODER=/absolute/rapier-snapshot-decoder \
POSITIVE_CCD_BUILD_REFERENCE_CAPTURE=/absolute/existing-e35-source-capture.json \
node tests/positive-ccd-source-capture.cjs /absolute/new-e60-original.v8 /absolute/new-e60-source.json

POSITIVE_CCD_ORIGINAL_REPLAY=/absolute/new-e60-original.v8 \
POSITIVE_CCD_SOURCE_CAPTURE=/absolute/new-e60-source.json \
POSITIVE_CCD_BUILD_REFERENCE_CAPTURE=/absolute/existing-e35-source-capture.json \
node --test tests/positive-ccd.cjs
```

Without the original/source artifact variables, only input, scan-order, signed-zero comparison and negative-control unit coverage runs. Skipped positive artifact tests are not evidence of a successful capture. The scan prints only concise step/count progress to stderr and stops at the first changed-next-pose clamp or the fixed horizon. It never retunes the shot.

## Completed bounded result

The unchanged original e60 shot was captured successfully as `/tmp/positive-ccd-e60-original-v1.v8`: 60,387,634 bytes, SHA256 `2fd069427c7b81be503f602220459e0c8c7046b7b40773e4f607464d7fb869f7`, ordinary h193 through h960. The input hash is `be24fd13b0baf899223dba4c3af161c359412a6d3d5afed62dee5613a7d02c75`.

The first scan reported no clamps at the two actual contact neighborhoods h384±2 and h430±2; h384 and h430 each had two CCD passes. It then reached 69 completed console summaries through chronological h251 before its execution session was lost during an environment transition. No terminal exit status or final JSON was available; h252 had only a native snapshot and is uncertain. This is **partial negative evidence**, not a completed 768-step negative result. The earlier files remain unchanged. Because that first scanner did not seal per-step hash provenance, its console summaries are not accepted by the new resume mechanism; affected steps must be remeasured using the same original artifact.

The checkpointed v2 scan completed normally with exit 0, using the same original artifact. It sealed **all 768 independently prepared native source replays**, h193–h960, with **zero before/after-clamp pairs** and zero changed-next-pose clamps. There is no selected positive boundary. The input was not retuned and no other shot was tried.

- Capture: `/tmp/positive-ccd-e60-source-v2.json`, 665,772 bytes, SHA256 `c026fb8e99891537229bd08b4dc9e6d7c9192f9673aba782d61a172c82194be9`.
- Checkpoint SHA256: `91b4d2cf59850e5e6afd2cb9c34886c1257a39b185fdbfa2bd0b5c704b733ef5`.
- Native source probe SHA256: `2a7c8703e97e9d2167050465a06d0bdae0f77ad2b05cb6f5255732b76eeb7116`.
- Reported CCD pass counters: 529 zero, 237 one, and two two-pass boundaries. This counter is not used to infer clamp absence: every step's source Body records were checked.
- h384 first impact: 0.000322216481436044 s; h430 first impact: 0.00017080368706956506 s. Neither produces a clamp. h430's second split still reports `active: true` with no first impact, which also is not proof of a clamp.

`tests/positive-ccd-e60-bounded-negative.json` persists the compact result, input/binary/source/archive hashes, and both two-pass boundaries. It explicitly records `positiveClampCoverage: false` and `paritySuccess: false`. All 768 source observations were observation-enabled/disabled byte-identical; a separate unmodified-native replay and native-versus-WASM typed comparison were reserved for a positive selected boundary and therefore did not run. In particular, do not import the e35 case's three signed-zero-only differences as an e60 claim: the e60 difference classification remains unmeasured.

The eight applicable unit/bounded-negative checks pass. The two explicit positive-coverage gates deliberately reject this artifact: no positive clamp exists in this bounded prepared-source evidence, and there is no selected boundary to compare. For the bounded-negative validation only, run the same artifact test command with `--test-name-pattern='preregistered|scan prioritizes|comparisons preserve|pre-TOI/split|checkpoint resume|fixed original shot|fixed e60 negative|existing e35'`. Running the full positive gate remains expected to fail on this negative artifact. This task stops here rather than inventing a surrogate trajectory or automatically trying another input.
