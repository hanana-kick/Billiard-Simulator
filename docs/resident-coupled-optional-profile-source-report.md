# Optional fourth-macro whole-source comparison

This is **source compilation and static transport proof**, not another physics
replay, native whole-world execution, throughput measurement or hardware ratio.
The full genuine audited dispatcher has unchanged SHA
`5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7`.
The ordinary three selected macros remain unchanged; id3 is explicitly opt-in.
No previous VM/source state is loaded or relocated into the new layout.

## Exact compiled sizes

| Property | Existing3 macros | Optional4 macros |
|---|---:|---:|
| Bytecode instructions |135571|131908|
| Bytecode bytes |4338272|4221056|
| Functions |826|808|
| Unallocated scalar words |95665|93100|
| Compacted local words/candidate |7786|7786|
| Call depth |15|15|
| VM bytes/candidate, including controls/stack |31268|31268|
| Cached-control core WGSL bytes |37454|37493|

The new coupled native handler is27722bytes; its unchanged canonical closure is
24784bytes. Existing cue/numeric/broad canonical closures retain exact hashes;
their generated wrappers each grow39bytes for the selected four-macro metadata.
Core WGS64, handler WGS1 and65536 core-instruction budget remain fixed. The
candidate VM footprint does **not** shrink, and no1024 admission follows.

## Source-equivalent remaining operations

A normalization proof uses compiler-certified owner-relative local slots,
explicit address-constant metadata, source-function-relative branch targets and
exact named CALL targets. All other opcode operands remain literal and exact.
All808 retained non-replaced function/module records match. Eighteen now-unused
helpers are pruned, and the coupled body becomes EXTERNAL_CALL+RET (899→2 static
instructions). The six arguments, return transport and all other retained
instructions/signatures stay source-equivalent. The old profile independently
recompiles to the exact executed bytecode SHA `f69fed56…d438a`.

The already measured h191→192 segment contains15418956 core operations and
three **complete** coupled calls totaling11748617 operations (CALL excluded,
RET included). Therefore, **conditional on exact macro side effects and the
same source path**, substitution of three two-op stubs leaves3670345 core
operations:11748611 fewer. This is a precisely mapped conditional instruction
delta, not a measured new recurrence or percentage time improvement. The native
component gate is separate; a fresh whole-world profile gate is still required.

The new handler must execute three times with the original32768 controller
work budget. The two continuation returns consume that full budget; the final
completion call consumes1..32768 units, hence65537..98304 controller units.
These are source-controller units, not f32/f64 primitive operations or time.

## Dispatch bounds and break-even

The current production pump issues one core followed by **every** selected
handler. Keeping244 pumps would increase dispatches976→1220, including241 new
inert coupled-handler dispatches. This unchanged-pump regression is not hidden.

For this known segment only, after substitution there are14 active external
services and3670331 non-service core instructions. With budget65536, a
conditional57..71 pump bound yields285..355 dispatches under the five-stage
pump. The upper bound accounts for every external yield, including a service
exactly at a core-budget boundary. These are algebraic bounds from the proven
same-path delta, **not actual new command counts**, a general horizon bound,
or a chosen immutable production budget.

At unchanged fixed pump count P, the steady-time break-even condition is:

> Net core time saved after stub work must exceed
> (P−3)×new-handler inert time +3×new-handler active time
> + incremental host encoding/submission cost.

Compilation is separate from steady time. The independent native component
measurement combines six commands per case; it does not isolate those terms
or calibrate the full world. New core/cache timing, actual whole-profile pump
count, whole-profile compiler/resource behavior, raw-to-impact/full-rest
recurrence and many-candidate throughput remain to be measured.

## Reproduction / artifact

`tests/resident-candidate-coupled-profile-report.mjs` exports
`compileCoupledSourceProfiles`, `normalizeSourceMicrocode`,
`proveRetainedSourceTransport`, and `createCoupledProfileReport`.
The CLI consumes only immutable WGSL, fixed PC counters and committed numeric
cost/handoff reports—never an evolved VM bank. Exact report:
`docs/evidence/resident-coupled-optional-profile-source-report.json`.

Three host groups pass: relocation/address normalization; changed arithmetic
or branch detection; authentic report deltas/unchanged-pump regression.

A local source-only compiled artifact is available at
`resident-native-artifacts/coupled-four-macro-source-only.v8`
(SHA `f23e08f16a942826b754ae805e294112bae03bef0b83f47fb1d22e7cdbb3ea75`).
It contains compiled code/metadata only, no state. Its exact call-neighborhood
companion is `.v8.calls.json`: sole coupled CALL40508 targets40512, parameters
2966..2971 and return2972. Arg6 comes from original state[bank+62720+24]; the
original budget guard remains earlier in the same source owner. These offsets
are profile-specific and are **not** permission to transplant old VM words.
