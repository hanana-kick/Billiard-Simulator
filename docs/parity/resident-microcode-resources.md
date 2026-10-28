# Current raw microcode executor: resource admission, not throughput

**Compatibility design: keep all 1024 candidates resident in two 512-row banks
under a 128 MiB storage-binding limit.** This is a resource plan, not an implemented
banked executor or 1024-candidate physics qualification. Enlarged single-bank
limits are an optional explicitly advertised/requested alternative.

## Source and scope

The source baseline is `b615d8d`. The initial-only frozen outer runtime is
`resident-native-artifacts/full-history-small-strike-native-v1/outer/runtime.v8`,
SHA-256 `5a233a1b2d79345a28dfe33964fae7d1c008764db0f0908d0ad7d81e0473375f`,
13,750,901 serialized bytes, prepared source head
`3b09eed1ce17d4bae6b9fe5e1e3e987961121f66`. No expected/future file was opened.

Actual test admission remains exactly **two rows 219/522, born-h64**, not arbitrary
counts. The rows below hypothetically scale this exact layout/program shape;
new shape-specialized source and fixed qualification gates would still be needed.
They are not GPU executions, measured VRAM, available-memory checks or timings.

`src/resident-candidate/microcode-resources.mjs` is a pure calculator, with no
runtime imports or activation. Existing `planWorldInitializationBanks` covers
initialization only: it omits VM storage, microcode, diagnostics and compact
output, and caps its binding assumption at 128 MiB even when supplied larger
limits. It was deliberately left unchanged.

## Exact formulas and aliases

For N candidates, in bytes:

| Allocation | Formula | Source |
|---|---:|---|
| World bank + PC/request tails | `252320*N + 4064` |62976 world +80 PC +24 request words per candidate, plus1016-word fixed CCD tail |
| VM continuation | `31256*N` |16 controls +7783 packed locals +15 call-stack words |
| Raw/numeric scratch **one buffer** | `54528*N` |max(raw13632,numeric13632) words, not their sum |
| Raw initialization state | `8040*N` |2010 words |
| Raw five-parameter input | `64*N` |16-word ABI; five binary64 parameters unchanged |
| Proposed compact result | `16*N` |existing4-word ID/status/pass/reason ABI; **not yet published by this executor** |
| Proposed final result readback | `16*N` |separate staging buffer, also not implemented |

Shared read-only allocations in one bank total **8,232,116B**:

| Buffer | Bytes |
|---|---:|
| rawProgram |20,284|
| rawGeometry |45,472|
| worldTemplate (including14 relocations) |251,960|
| worldProgram (including496 source-PC words) |3,499,968|
| worldGeometry |101,632|
| microcode |4,312,800|

The first three are initialization-only data,317,716B, but the current session
retains them and raw initialization state until disposal. The remaining immutable
resident data are7,914,400B. No earlier destruction or inter-bank sharing is
assumed. All body/contact/solver/warmstart/CCD/sleep/rule state and VM locals/stack
remain represented; this calculation does not shorten physics or copy state to CPU.

The exact base allocation is **`346208*N + 8236180`B**. It includes all live
initializer/runtime buffers but excludes diagnostic/result staging. This is the
current allocation peak before adding diagnostics, not an optimistic post-init
liveness estimate. Pipeline/compiler/driver memory, host arrays, serialized
payload text, implementation padding and allocator overhead are unknown/excluded.

## Declared row counts (bytes)

Read-only data are8,232,116B in every row. `Base` includes them once. Compact
result bytes are shown separately and are NOT included in base/current execution.

| N | Worlds incl. tails | VM | Aliased scratch | Raw init state | Input | Proposed result | Base |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 256,384 | 31,256 | 54,528 | 8,040 | 64 | 16 | 8,582,388 |
| 16 | 4,041,184 | 500,096 | 872,448 | 128,640 | 1,024 | 256 | 13,775,508 |
| 64 | 16,152,544 | 2,000,384 | 3,489,792 | 514,560 | 4,096 | 1,024 | 30,393,492 |
| 256 | 64,597,984 | 8,001,536 | 13,959,168 | 2,058,240 | 16,384 | 4,096 | 96,865,428 |
| 512 | 129,191,904 | 16,003,072 | 27,918,336 | 4,116,480 | 32,768 | 8,192 | 185,494,676 |
| 1024 | 258,379,744 | 32,006,144 | 55,836,672 | 8,232,960 | 65,536 | 16,384 | 362,753,172 |
| 4096 | 1,033,506,784 | 128,024,576 | 223,346,688 | 32,931,840 | 262,144 | 65,536 | 1,426,304,148 |
## Current diagnostics are a different allocation

The retained h64 test preallocates **three full world+VM snapshots** in ONE
MAP_READ buffer, then maps once at the end:

`diagnostics = 3 * (283576*N + 4064)`B.

It does not allocate a compact result buffer. Current total bytes equal base plus
diagnostics: for 256 rows314,663,988B; for 512 rows621,079,604B; for 1024 rows
1,233,910,836B. A256MiB `maxBufferSize` admits at most 315 rows in this three-copy
layout.512 rows already need435,584,928B in that single diagnostic allocation.
Even ONE 1024-row full snapshot needs290,385,888B and exceeds256MiB.

Thus "request256MiB storage" does not make the existing1024-row debug transport
viable. Production compact-only return and controlled separate qualification
captures are a required design boundary, not permission to remove numerical,
full-rest, late-foul or independent-native gates.

## 128 MiB compatibility banking and optional 256 MiB binding

The existing `createNativeOwner` calls `adapter.requestDevice()` without
`requiredLimits`. Use the returned **device** limits, not an adapter maximum or
assumed GPU model. The checked scenarios use128MiB storage/256MiB buffer and an
optional 256 MiB storage/256MiB buffer. Other explicit bind-group/dispatch/workgroup
limits are in the small checked-in shape fixture; they are scenario inputs, not
new measured hardware capabilities.

- **128 MiB storage:** world binding fits at most 531 rows; 532 does not. Choose
  **2×512** for 1024 so both banks have equal layout/program shape. Each world
  binding is129,191,904B (~123.21MiB). Keep both banks' world/VM/scratch/input
  allocations resident; dispatch separate bind groups with local lane indices
  and preserved candidate IDs. No extra simultaneous shader bindings are needed.
- Conservatively duplicating every immutable allocation and adding proposed
  result storage+readback gives **371,022,120B (~353.83MiB)** for 2×512. Sharing
  equal immutable buffers could save memory, but is not implemented or assumed.
-4096 as **8×512** similarly needs **1,484,088,480B (~1415.34MiB)**. Per-binding
  fit says nothing about actual available device memory or execution throughput.
- **Optional 256 MiB storage:** a single 1024 world binding is258,379,744B
  (~246.41MiB), and the full compact-oriented allocation estimate is362,785,940B
  (~345.98MiB). Maximum world-bank fit is 1063 rows; 1064 does not fit. The adapter
  must advertise sufficient limits and `requestDevice({requiredLimits: ...})`
  must actually grant them; current owner/planner do not implement this path.
- The current debug three-copy layout could be resource-partitioned into 4×256,
  but would retain **1,258,655,952B** across banks and return full states. It is
  not the requested compact terminal executor and is not the recommended default.

Banking also requires an explicit new source/runtime admission profile and
initialization/continuation orchestration; no existing fixed-count gate was
weakened. All banks must remain resident across bounded GPU work; allocation
failure cannot silently lower the candidate count, spill to CPU, or turn
unsearched/unsupported candidates into misses.

## Guards and evidence

The calculator validates source PC/request/fixed-tail consistency, VM slab,
scratch aliasing, complete immutable code length, fixed source profile and
32-bit word addressing. BigInt intermediate arithmetic rejects overflow rather
than wrapping. It independently checks every storage binding and buffer size,
seven storage bindings/bind-group entries, bind-group count, workgroup width,
invocations per workgroup and worst-case workgroup dispatch count. Counts and
capture counts retain existing 4096/64 arithmetic caps; these are NOT numerical
qualification. Audit-enabled eight-binding layouts require a distinct future
model and are explicitly rejected here.

`fits` means **declared per-object limits only**. Device memory is not queried,
and actual allocation may still fail. A future production banked owner must
handle out-of-memory/device-loss/allocation errors explicitly before publication;
the current test session scopes validation errors, not a production memory-budget
policy. No candidate trimming or success/miss fallback is offered by this planner.

Host tests:

```sh
node --test tests/resident-candidate-microcode-resources.mjs
# Optional local initial-only proof, no GPU or source physics:
RESIDENT_MICROCODE_RESOURCE_RUNTIME=/workspace/scratch/f887f82f638e/resident-native-artifacts/full-history-small-strike-native-v1/outer/runtime.v8 \
  node --test tests/resident-candidate-microcode-resources.mjs
```

The first command is standalone (six pass, two explicit local diagnostics skip).
The second passed **8/8**. It checks the pinned runtime digest, derives the exact
shape, and runs the **existing retained-session allocator on a fake device**:
every buffer size matches, scratch aliases are not double-counted, eight initial
uploads remain, and any submission throws. No physics, shader compilation,
GPU execution or performance measurement occurs. Curated counts/source digests
are in `docs/evidence/resident-microcode-resources.json`.
