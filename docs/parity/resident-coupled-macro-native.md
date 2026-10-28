# Exact coupled source-call native pilot

This is a bounded **component** gate, not raw-parameter-to-impact, full rest,
1024 physical lanes, or hardware performance qualification. The three inputs
are the actual complete calls captured from the owned HOST h191→192 diagnostic.
They are explicitly independent inputs because genuine world-PC writes occur
between calls. Later expected state is never patched into a claimed trajectory.

The optional id3 macro retains the exact 41-function source closure and all six
arguments, including the original 32768 source work budget. The generic core
transport budget is separately 4096; it only reaches and returns from the one
external source call. Native source/closure/declaration/profile admission is
documented in `resident-coupled-macro-admission.md`.

`tests/resident-candidate-coupled-macro-native.mjs` has three isolated roles:

```
node tests/resident-candidate-coupled-macro-native.mjs prepare INPUT_DIR RUN_DIR
RUN_RESIDENT_COUPLED_MACRO_GPU=1 REQUIRE_WEBGPU=1 \
  node tests/resident-candidate-coupled-macro-native.mjs gpu RUN_DIR
node tests/resident-candidate-coupled-macro-native.mjs assert RUN_DIR INPUT_DIR
```

The GPU role opens only the strict initial-call payload and manifest. It never
imports the original CPU world/capture/comparison module or opens the separate
assertions file. All three shaders pass compilation-info validation before any
pipeline is created. The exact coupled handler compiles first; the begin/core
pipelines follow. The same immutable pipelines are reused for two repetitions
of all three inputs, with fresh source/scratch/VM allocations every time.

Each case submits exactly six fixed dispatches: begin, core-to-wait, source
handler, core-to-return, duplicate handler, completed core. The latter two must
be inert. There is one combined final readback per case, no intermediate host
selection. Every mutable source word, every dirty scratch word, all readonly
source words, bytecode and VM words are compared independently. Return values
must be the original 0,0,1; a source continuation is not a physics miss.

Cold pipeline preparation, CPU command encoding/submission, queue-drain wall
and final mapping are recorded separately. Queue-drain wall is **not** a GPU
timestamp. Repetitions are diagnostic warm measurements, not a cross-device
calibration or a full-world speed ratio.

Preparation/transport host contracts: **5/5 passed** against the actual v2
fixtures. Original handoff/cap/schema groups: **7/7 passed**. Native compilation and exact numerical comparison now **PASS** on the reported
SwiftShader fallback adapter (Google, SwiftShader driver 5.0.0). All six fresh
runs preserve every source/scratch/read-only/code/VM word; returns are 0,0,1 in
each repetition. Native process exit0, no signal, peak RSS548,444KiB.

| Phase | Observed wall time |
|---|---:|
|All shader preflight + three cold pipelines|32.950s|
|Exact coupled handler cold pipeline|27.414s|
|Core cold pipeline|5.507s|
|Warm call0 queue drain|609.285ms|
|Warm call1 queue drain|608.705ms|
|Warm call2 queue drain|436.691ms|

The warm three-case sum is1.655s queue-drain wall, with18 total commands.
These cases replace isolated source-call interpreter work; they do not establish
a same-workload full-world speed ratio. The entire native child, including cold
compilation, six runs and serialization, took36.777s. Active children explicitly
acknowledged the timing hold. The first launcher failed with exit127 before
Node/GPU startup because `/usr/bin/time` was absent; the recorded retry changed
only the supervisor to Python exit/signal/resource capture, not source or bounds.

Evidence: `../evidence/resident-coupled-macro-native.json`. Frozen tested source
`e63791570d2fc0c68efe52bf265105357a4c3485`; inputSHA
`c15b0eebed74cb7a2ea2799f399131aa19b5802cf3d2cda6045a9a109d2c439d`;
actualSHA`5308eada2e813af1af2e504ca3c62f3363711d849bec53fef872c4ae4a784165`.

No default world executor, source time step, raw initialization or publication
gate changed. Whole-world optional-profile recurrence and measured command
reduction remain the next gate before any raw h192 native launch.

## Raw-impact preparation wiring (not execution evidence)

The isolated raw-impact coordinator accepts the explicit flags
`--coupled-macro --cue-original-number` in addition to mandatory `--work=...`.
The former without the latter is rejected; an omitted macro profile retains the
three-handler selection. No default work count or automatic native launch was
added. This profile needs the separately implemented strict four-macro runtime
admission before a prepared payload can be accepted.

Preparation verifies the actual captured prestrike history, fresh independent
PhysicsLab accepted-t0 history, and every raw clone history word. The original
cue Number oracle is regenerated independently for h128/h192; other oracle
owners and actual native evidence are not replaced. The final assertion also
checks the rejected row's untouched prestrike ring. Exact numerical/history
coverage is not reduced to accommodate the new macro.

Nine HOST option/history/reference groups passed, including fresh original
source/native fixtures. This is **not** a four-macro full recurrence or GPU
raw-to-impact result. No long replay has been launched by this checkpoint.
