# Three authentic coupled-call component fixtures

**HOST component evidence only; no GPU run, raw-to-impact qualification, full
rest,1024-candidate result or hardware speedup.** The component inputs are
explicitly intermediate source-call inputs, never production world initializers.

`tests/resident-candidate-coupled-handoff-fixture.mjs` replays only the immutable
owned h191→192 continuation SHA
`7d5f264cb6e73ebb4c437d0582bbf34407ea91901ba4cf7884ce2eb73c637efa`.
It captures exactly the three complete `rc_coupled_transport_advance` calls:
six u32 arguments, u32 return, complete before/after source state and dirty
scratch, and readonly program/geometry/input/audit identities. No per-instruction
or arbitrary per-call trace is retained. The source root is regenerated from
`coupled-transport.mjs` under `source-f32-preserved-v1`, and every canonical
function AST is checked against the authentic original dispatcher.

| Call | Original arguments | Return | Original body core operations |
|---|---|---:|---:|
|0|49728,50912,54368,793032,0,32768|0 (continue)|4405862|
|1|same|0 (continue)|4314181|
|2|same|1 (complete)|3028574|

Each call independently runs through an unchanged canonical scalar source-call
compilation:6987 instructions,2103 local words, no intrinsic/external
substitutions. Entire state, all dirty scratch words, return/status, cursors and
readonly identities match. The standalone entry wrapper adds exactly four core
instructions per call. This differential shares the compiler and scalar VM; it
is **not** an independent arithmetic implementation. The final independent
original-CPU all11, actual PhysicsLab projections, complete accepted-emission
tape, every retained final source word and VM word also pass unchanged.

The fixed244-pump segment still contains15418956 source VM instructions.
Capture plus three canonical replays took43.103s HOST wall, not GPU timing.
The assertion evidence is `docs/evidence/resident-coupled-handoff-host.json`.

## Honest native component boundary

The world owner changes five then four world-PC control words between target
calls (126976,126979,126980,126982,126991; the second gap omits126980).
Scratch does not change between calls. These fields are **not ignored or
patched**. Therefore the native component runner must treat the three cases as
independent captured-call inputs with fresh buffers. Keeping compiled pipelines
resident is valid; claiming a retained whole-world sequence from these cases is
not. All three calls retain their original32768 source work budget.

Lean schema helper: `tests/resident-candidate-coupled-component-schema.mjs`.
It imports only Node assert/crypto and exports:

* `COUPLED_COMPONENT`
* `assertCoupledComponentInput(input)`
* `assertCoupledComponentAssertions(expected,{input,inputSha256})`

The input schema is `resident-coupled-component-call-inputs-v1` with fixed root,
profile, exact source hashes, immutable shared readonly bindings1/2/4/5 and
three `{index,args,before:{state,scratch}}` cases. Expected after-states/returns
are forbidden in this strict initial-only payload. The assertion file separately
binds the exact serialized input-file SHA. A GPU role must not import the heavy
capture/comparison module, which also imports original CPU physics comparers.

Local artifacts (not published):
`/workspace/scratch/f887f82f638e/resident-native-artifacts/coupled-handoff-component-v2`

* `call-inputs.v8`:6497011bytes, SHA
  `c15b0eebed74cb7a2ea2799f399131aa19b5802cf3d2cda6045a9a109d2c439d`
* `assertions.v8`:3711689bytes, SHA
  `d634320aeb00cca8de397f45495042cdc91c76b93587a2e5f15581878647b408`

V1 is retained. V2 only adds explicit assertion/input hash binding; every input
byte and all before/after words/arguments/results remain unchanged. During
initial preparation the full-word readonly check caught accidental use of the
later final audit checkpoint. The input now captures the audit once at the
first target entry and requires its hash match all three actual call entries;
no final/future audit is uploaded as a component input.

## Gates

Seven host test groups pass: canonical signature/no substitutions; zero/oversize
budget error semantics; prior-status/invalid-base/magic handling; exact pending
mode cursors; dirty scratch/unrelated state/return/readonly mutations; all three
authentic calls and final physics evidence; strict runtime schema negatives.

```sh
RESIDENT_COUPLED_HANDOFF_DIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/coupled-handoff-component-v2 \
  node --test tests/resident-candidate-coupled-handoff-tests.mjs
```

Native macro admission, compilation, native complete side-effect comparison and
new whole-world raw resident integration are separate gates. None is asserted
by this HOST fixture checkpoint.
