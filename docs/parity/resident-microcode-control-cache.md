# Invocation-local VM control cache: host proof, native gate pending

The default remains `controlMode: 'storage-v1'`. The separate opt-in
`'invocation-cache-v1'` requires `vmStateDisjoint: true`; either both fields are
present or neither is. Old artifacts without either field retain storage mode.
Unknown/partial contracts are rejected. The lean runner owns fresh GPU buffers
and checks the VM GPUBuffer identity against every source/code resource before
any physics dispatch. Standalone shader callers must enforce the same contract.

Only seven transport words are cached in one invocation-local scalar struct:
status, error, PC, stack pointer, low/high instruction count, and last opcode.
Source buffers, scalar local slots, CALL stack, pending macro, and yield count
remain in their existing storage locations. No bytecode, source equation,
numerical domain, instruction budget, macro body, or candidate admission changes.

The cache is loaded only after unchanged main admission checks. It is flushed:

- before the existing external-call validator reads current PC/SP/error;
- after each successfully committed RET, including its counter and PC changes;
- on every step exit, including unsupported/invalid/waiting/completion;
- at an ordinary budget yield, **before** the original yield-overflow guard.

Thus a late failure exposes the original committed prefix, not the beginning of
the chunk. Invalid pre-admission and terminal/waiting retries remain on the
unchanged storage path. Separate macro kernels are byte-identical in both modes.

## Host evidence and limits

`tests/resident-candidate-microcode-control-cache.mjs` compares full VM
control/local/stack and source arrays at budgets 1, 2, 3, 7 and 64, plus scalar
operations, nested CALL/RET, memory ranges, integer/float domains, malformed
controls, every ISA operand mutation, counter carry/overflow, yield overflow,
external wait/service/duplicate/malformed paths and void source returns.

The differential adapter runs the unchanged canonical host interpreter through a
seven-word control proxy; it is a transport model, **not an independent physics
oracle or GPU runtime fallback**. Diagnostic callbacks are read-only with respect
to VM transport authority and receive a flushed backing view. Structural tests
reverse the exact generated control substitutions to recover the original step
and main bodies, parse all four intrinsic profiles, and verify unchanged begin,
external validator, default shaders, and all three macro shaders.

The lean runner exports `microcodeWorldPipelineDescriptors(plan)` so every shader
in both variants can be preflighted before any expensive pipeline construction.
Runtime mock tests reject false nonaliasing claims before submission.

Native compilation, native cache/storage bit equality and performance remain
pending a separately serialized same-device ABBA gate. Host pass alone does not
qualify any device, numerical domain, physical strike, full-rest shot, or 1024-row
throughput. The previous operand-loader native gate did not meaningfully solve
software execution cost; no speed claim is made for this cache before measurement.
