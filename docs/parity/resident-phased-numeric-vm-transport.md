# Optional phased NUM_EVAL transport — HOST checkpoint

This checkpoint changes **execution transport**, not the numeric program or the
physics. It is off by default. It has no native compilation, trajectory,
full-rest, hardware-performance, or production PASS qualification.

## Source and API boundary

`microcode-vm.mjs` accepts the explicit configuration:

```js
const options = {
  // Exact immutable compiled program, count/localWords/stackCapacity/entryPc,
  // original source bindings and initial slots remain caller-owned.
  numericContinuation: 'source-num-eval-phased-v1',
  intrinsics: 'source-numeric-v1',
  intrinsicFunctions: ['rc_num_eval'],
  controlMode: 'invocation-cache-v1',
  vmStateDisjoint: true,
};
const layout = microcodeVmLayout(options);
options.numericContinuationDescriptor = microcodeNumericContinuationDescriptor({
  candidateCount: layout.count,
  vmStride: layout.stride,
  tailOffset: layout.numericTailOffset,
});
const shader = generateMicrocodeVmWGSL(options);
```

The descriptor pins the original signature/body/transitive dependencies,
preserved-f32 numeric profile, extracted source parts, generated helper, count,
stride and appended tail. Unknown modes, absent/changed descriptors, another
intrinsic allowlist, duplicate external `rc_num_eval`, or nondisjoint storage
reject. No compiler/ISA opcode is changed. Existing compiled `NUM_EVAL` calls
use the source-derived phased helper only under this explicit mode.

Fresh VM allocation is required. Original control, locals and CALL stack retain
their offsets; **16 words are appended after the stack**, increasing each lane's
stride. Do not relocate an old VM capture or treat it as a fresh physical input.
A same-profile copied-state HOST continuation is supported and tested.

Tail words 0–13 hold the helper continuation; words 14–15 hold cumulative
unsigned 64-bit micro-work. Original source bindings and physical state layouts
are not enlarged. During an unfinished numeric call, status remains READY,
pendingMacro remains zero, and original PC/destination/CALL stack remain held.
Each start or step consumes one existing pump-budget iteration. Original source
instruction count and diagnostic PC count advance once on numeric return, not
once per phase. Helper clear is return housekeeping, not another phase charge.
Ordinary pump yields are intentionally more numerous than the synchronous
reference. A microstep is **not a constant-time operation**: a single original
numeric node may still invoke bounded software-number primitives.

The source's numeric returns 2/3/4 are ordinary local return values, preserving
partial scratch writes. They are not VM unsupported/error statuses. Malformed
continuation state or counter overflow instead fails the transport without
committing the original PC/result/opcode count. Pending numeric work leaves
unselected external-handler sweeps inert; contradictory external WAITING plus
numeric tail rejects before any macro body. Cached controls flush on every
public continuation boundary and remain word-identical to storage controls.

## Independent HOST authority

The TEST-only callback is:

```js
numericContinuationHandler(operation, args, {state, bindings, configuration})
```

It invokes `start`, `step` or `clear` from
`tests/resident-candidate-microcode-numeric-continuation-reference.mjs`, using
only current VM words, program binding 1 and scratch binding 3. That adapter
lowers the **actual generated helper WGSL**. It is not production execution or a
CPU fallback. Expected effects come independently from the unchanged complete
original `rc_num_eval` source; no expected future state is injected.

The new transport gates cover arbitrary pump splits, fresh adapters restored
from copied words, two interleaved lanes, both control modes, every source and
readonly word, dirty/partial failure writes, destination/PC/stack retention,
source instruction and 64-bit micro-work accounting, counter carry/overflow,
forged continuation fields, inactive dirty tails, disjointness and external
protocol interaction. Final original controls/locals/stack match the legacy
source execution, except the explicitly different yield count. The source
helper's independent nine groups additionally cover all numeric node opcodes,
header/input/node/output order, malformed domains, and lane authority.

Terminal commands (disk TMPDIR, Node heap cap 512 MiB; no GPU):

- Numeric transport + helper + legacy VM/cache/external: **49 PASS, 1 optional
  native SKIP, 0 FAIL**.
- Legacy source/compiler/continuation intrinsic gates: **18 PASS, 0 FAIL**.

The evidence JSON contains ten exact baseline comparisons against
`4969f45d8bba797818adea87bec3a06c2bdf6df4`: five complete legacy configurations,
layouts and core shaders; five canonical external-root configurations/core
shaders/handler shaders. The Number-program handler keeps its mandatory
explicit logical-view/disjoint contract. These are component identities, not a
claim that an old whole-program source manifest admits changed module files.
Prior frozen artifacts are untouched; no runtime seal was relabeled.

Two test-setup failures are preserved in the report: an initial assertion picked
an unreachable compiler stub rather than the executed call; an initial baseline
sweep omitted the existing Number handler admission options. Neither changed
source arithmetic nor was a numerical GPU failure.

## Separately pinned launch sources

`tests/resident-candidate-microcode-numeric-vm-profile.mjs` produces a small
**two-lane component wrapper**, not the parent's genuine post-impact program.
Both explicit profiles use cached controls, disjoint storage and budget 65536.
They have 11 local words, stack capacity 2, old prefix 29 words, appended stride
45 and total 90 words. The immutable bytecode, source approval and body are
identical; only the two `@workgroup_size` annotations differ.

| Profile | Workgroups | WGSL bytes | SHA-256 |
|---|---:|---:|---|
| WGS1 | 2 | 56,985 | `830c926afcf839cdbc2e4afe40f70291ee8c1474c5d0ce19d4eadc29cd3253b7` |
| WGS64 | 1 | 56,987 | `5c88fd34212362da89aae9e77d54c80dcf4db8ee2de4d6302c3411b1605faee5` |

See `docs/evidence/resident-phased-numeric-vm-host-v1.json` for exact configuration,
source, descriptor and legacy hashes. HOST source parsing is not Dawn compilation.
The next gates belong to the coordinator: independently prepared genuine bounded
post-impact HOST comparison, then explicitly granted compile-only/native tests.
No pump count, throughput or WGS64 compilation behavior is inferred here.
