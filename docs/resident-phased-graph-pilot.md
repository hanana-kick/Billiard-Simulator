# Bounded phased-graph post-impact pilot

This is a separate diagnostic profile, not an activated resident backend. It
reuses the same unchanged approved source and bytecode as the earlier owned HOST
h192→193 graph-only diagnostic, appends a fresh 16-word VM tail per lane and
selects `source-num-eval-phased-v1`. No previous VM state is relocated or patched.
The six original source bindings and original local/call-stack offsets are
unchanged. Numeric micro-work is charged to the existing 65,536-work-item pump;
the original NUM_EVAL source opcode commits only once at return.

The explicit first launch profile is **count2, WGS1, two workgroups**, not the
previous WG64 profile. HOST source generation proves that the corresponding
WG64 shader differs only in begin/main launch annotations; this does not prove
either native compilation or equivalent performance. The actual generated
cached-control core is **58,822 bytes**, SHA256
`fc7d4b912d3ddd72b801f5749531084a94c8a7169e07eaf29972521aac598fe4`.
It has no complete `rc_num_eval` function or native input/node/output traversal
loop; the original arithmetic helper closures remain substantial.

## HOST boundary

The emitted numeric helper and VM transport have their separate source-derived
and legacy-compatibility gates; see `parity/resident-phased-numeric-vm-transport.md`.
The genuine full-world h193 test **did not complete within its explicit
240,000ms HOST wall cap**. It exited1 on `bounded HOST-only wall cap, not physical
horizon`, before publishing a final result. No numerical mismatch was reported,
but full-world parity and work counts are **pending**, not passed. The failed
run retained no final progress profile, so the cost is not precisely attributed
and must not be reported as GPU timing. The earlier 49-pump /
196-command result from the complete-graph intrinsic is not this profile's
schedule and is not reused.

This diagnostic's input is the explicitly owned HOST h192 state. It is not a
raw-shot initializer, future-oracle shortcut or full-rest acceptance input.
Independent original PhysicsLab h193 represented-state evidence exists for the
baseline state, but it does not by itself qualify this unfinished execution.

## Compile-only feasibility gate

`tests/resident-candidate-phased-graph-compile.mjs` is a lean, explicitly requested
role with a closed **59,860-byte** shader-only payload, SHA256
`df64ed8c3d921a0442f084c4c1211d5597b7ca10d3c04ac635ee964bc273ff90`.
It opens no world/expected data, allocates no buffers and performs no uploads,
dispatches or mappings. Four focused HOST role tests pass. Its purpose is to
decide compilation feasibility before spending more nested-HOST interpreter
time. Native numerical dispatch remains prohibited until full-world comparison
is closed; no physical gate is replaced by a pipeline-creation result.

The frozen WGS1/count2 native role reached clean shader preflight, then terminated
with child **SIGKILL9** during `createComputePipelineAsync(main)`: **32.626s**
supervisor wall time and **1,924,332KiB** peak owned child RSS. No pipeline-ready
result was produced, and buffers, uploads, dispatches and mappings remained zero.
See `evidence/resident-phased-graph-core-compile-negative.json`. These observations
do **not** establish an OOM cause or a numerical failure. This profile is not
adopted and is not scheduled for an identical retry. Earlier whole-graph and
two-helper WG64 compile failures remain negative evidence. Full-world HOST and
native numerical parity for this profile remain unqualified.
