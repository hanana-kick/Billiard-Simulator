# Source preparation: bounded native component gate (compiler failure)

This is an explicitly opt-in component gate for
`source-geometry-preparation-count2-v1`. It is **not** a raw-shot/world
continuation, full-rest proof, 1,024-lane result, or performance calibration.
The original default remains unchanged. Preparation was HOST-only. The later authorized native attempts below did not
reach compute; this gate has no native numerical PASS.

## Authentic inputs and independent assertions

`tests/resident-candidate-preparation-component-fixture.mjs` repeats only the
bounded fresh CREATED-t0 → committed h1 HOST diagnostic. It verifies every one
of 216 actual calls, but retains only the maximum-source-write call of each prepare kind (earliest tie):
ordinals 1, 18, 43, 4, 105, 106. Both full h1 source runs still agree word-for-word;
all 74 existing external handoffs remain unchanged. No evolved VM input or CPU
future state is used to execute either h1 run.

The ten independent component cases are:

1. Six unmodified authentic kind1–6 calls (all source returns0). Maximal
   observed write counts are42/62/64/34/188/35. Actual ready-call counts are
   0/0/0/0/55/0 out of26/26/26/26/56/56 calls. Therefore this h1 fixture has
   **no ready-copy path for kinds1–4 or6**; this gate does not fabricate one or
   claim exhaustive loop coverage. Kind2/3 now exercise additional active
   state clearing compared with the first-occurrence selection.
2. Kind0 derived from authentic kind1: original source failure return
   `0xffffffff`, original bank/request failure writes, VM transport complete.
3. Geometry root derived from authentic kind5 moved to `geometry.length - 8`:
   first eight scratch copies survive; the first global read fault suppresses
   all later writes/publication. Original scalar and checked source effects
   match exactly.
4. Cache index derived from authentic kind6 points into the other candidate:
   stricter object-ownership rejection, **not** arbitrary malformed-source
   equivalence. The other bank remains untouched.
5. Unsigned `0xffffffff` bank derived from authentic kind1: unsupported input
   admission before any source write, not a billiards miss.

The fixed root guards make a first *write* fault unreachable in these admitted
root calls: scratch/request are checked before writes, and dynamic cache writes
follow a read of the same target. This gate does not invent a physical write-fault
case. Separate HOST transport tests cover direct checked-write failures.

The review-discovered in-range lane swap is closed in `c745f32`: both HOST and
native VM paths require `bank == executingLane * 62976` before helper execution.
Both swap directions preserve victim source words and failure PC/result/stack/
step counters. This new-profile defect did not affect the earlier frozen h192
run, which did not use this opcode.

`initial.v8` contains only captured before-state, original readonly arrays,
source/descriptor identity, six original arguments and explicitly described
fault derivatives. Strict schema rejects expected/after/VM-state fields.
`assertions.v8` is separate and contains original scalar/source-AST effects and
complete new-layout VM assertions. Full VM layout comes from the HOST VM with
an independent original-AST callback; it does not import old-layout VM words.
A failed opcode never publishes its result or advances its PC/stack/counter.
The original scalar's different internal PC is diagnostic, not falsely compared
to the new one-opcode frame.

## Component transport and command budget

`resident-candidate-preparation-component-program.mjs` lowers a tiny diagnostic
wrapper and authentic helper: 30 bytecode instructions, 23 locals, call depth2,
82 total VM words for count2. Only lane0 calls preparation; lane1 returns inertly.
The six arguments are appended to the existing 32-word readonly input prefix.
Only the wrapper reads this suffix: the approved 27-function closure has **no**
`rc_inputs` access or input-length query. Source-visible state/program/geometry/
scratch lengths and descriptor remain exact. This suffix is diagnostic transport,
not a production world-runtime layout change.

Fixed cached-control WGS64, original instruction budget65536. Two pipelines
(`begin`, `main`) share one 49,588-byte generated source. `compilationInfo` for
**all** descriptors is checked before **any** pipeline creation; all pipelines
are created before source buffers. Both device preflights later passed, but main-pipeline creation was killed;
there is no completed main pipeline or numerical result.

Per independent case: fresh buffers; `begin → core → core` (the last must be
inert), eight final copies into one map, no intermediate readback. Ten cases ×
two fresh-buffer passes = **60 dispatches, 20 submissions, 20 final maps**.
Only the compiled device/pipelines survive between cases, not physics state.
Cold preflight/compile is reported separately. The second pass is warm-pipeline
work with fresh buffers, not a retained physical trajectory.

Per-case storage is 5,236,896 bytes plus the same-size combined readback
(10,473,792 bytes total requested device buffer bytes; not measured resident
memory). Native outputs are written one case at a time, about105MB total on disk,
not retained as 20 full in-memory snapshots. Adapter/backend metadata and exact
limits are recorded. `queueDrainWallMs` is wall time, **not** GPU timestamp or a
hardware/software ratio; no compute timing result exists.

## Local prepared artifact

Directory:
`/workspace/scratch/f887f82f638e/resident-native-artifacts/preparation-component-input-maxwrites-v2`

- `initial.v8`: 10,801,139 bytes,
  SHA256 `58236191ca257eee9071c2158a1b18a11a13fe4203dee58d710959e83fb479a0`.
- `assertions.v8`: 10,911,023 bytes,
  SHA256 `9ba7996d7772ba400b1f9a22756cfdd0867c4761e2ed31aa3119819dc995f66e`.
- Bytecode SHA256
  `58cf045ecb691ef5423e15795da74f72e1ef7fde32713d6f9324689632e7e2a7`.
- Generated shader SHA256
  `f881bcaee17ba61cd09c2f29d3e63767a1d24ce33d5c54068240ddf88114e0bf`.

Prepared native-v1/first-occurrence artifacts remain unchanged and unexecuted.
This max-write selection is initial-only input schema v2; no physical horizon or
source budget changed. Selection/readiness counts stay assertion/report-only,
not source runtime authority.

Curated HOST report: `docs/evidence/resident-preparation-component-host.json`.
The first preparation attempt failed only because the fixture inspected an
unused intrinsic-stub return slot instead of its wrapper's actual return slot;
no source/runtime arithmetic was changed. Its failure log and h1 report remain
local. v2 is a fresh authentic capture, not a patched expected result.

## Commands and stopping gate

From this frozen worktree, first prepare in a **new** run directory:

```sh
node tests/resident-candidate-preparation-component-native.mjs prepare INPUT_DIR RUN_DIR
```

**Only after the lead releases the exclusive numerical slot:**

```sh
RUN_RESIDENT_PREPARATION_COMPONENT_GPU=1 REQUIRE_WEBGPU=1 \
node tests/resident-candidate-preparation-component-native.mjs gpu RUN_DIR
node tests/resident-candidate-preparation-component-native.mjs assert RUN_DIR INPUT_DIR
```

The native role reads only `initial.v8`/manifest and code; assertion role is a
separate process, and opens `assertions.v8` only then. It compares every state,
dirty scratch, readonly prefix/suffix, audit, bytecode and VM word. Any parser,
pipeline, source, transport or comparison failure remains failure, not miss.

HOST qualification before native: 47 PASS /1 optional native SKIP in focused component,
preparation, AST-reference, VM and cache suites. Mock device transport proves
command/copy/map shape only, never native numerical execution. Both native attempts below failed before compute. All ten device comparisons
remain unqualified. A further native attempt requires a separate explicit grant.

## Authorized native attempts (2026-10-26)

Frozen source `26be4cd0682b64c413b3e888691036640cd68c8a` and identical
49,588-byte shader /30-instruction bytecode /max-write inputs were used.

- **native-v2**: missing explicit Vulkan ICD environment, no adapter/device.
  `vkCreateInstance: Found no drivers`, `VK_ERROR_INCOMPATIBLE_DRIVER`; exit1,
  no signal,0.265s, child peak RSS83,484KiB. No preflight or compute.
- **native-v3**: specifically authorized environment-only recovery with existing
  `VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json`; no installation
  or system setting change. Immutable initial bytes and every manifest field
  except preparation-process identity matched native-v2. Both `compilationInfo`
  preflights passed before pipelines. Begin pipeline compiled in22.025ms.
  During **main pipeline creation**, child returncode−9 /SIGKILL at27.228s;
  child peak RSS1,845,108KiB. Last sampled MemAvailable was1,281,648KiB.
  Zero compute submissions, zero case maps, no `actual.v8` and no assertion run.

SIGKILL and compiler phase are confirmed; **OOM cause is not proven**. No
accessible cgroup limit/event counter was available in this executor read.
SIGKILL prevented JavaScript `finally`/owner.release; process termination reclaimed
that process's resources. No retry followed. The native-v3 terminal never wrote
adapter-info fields (they were previously saved only after all cases); selected
ICD/device creation alone is not an adapter metadata receipt. The harness now
logs adapter/limits/backend/ICD immediately before preflight for any future run,
without changing generated WGSL, bytecode, inputs or mathematical semantics.

Raw logs, one-second owned-child resource samples, direct subprocess returncode
and environment-recovery receipt remain local under native-v2/native-v3. Curated
failure evidence: `docs/evidence/resident-preparation-native-failure.json`.
The prepared native-v1 selection remains unexecuted. The failure does not
invalidate the independent HOST216-call equality proof or the earlier different
raw h192 native gate; it blocks this in-core helper's native qualification.
