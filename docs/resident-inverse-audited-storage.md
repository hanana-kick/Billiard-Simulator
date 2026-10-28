# Opt-in audit + inverse-observation logical storage

`source-four-ball-inverse-audited-storage-v1` is **source/HOST transport proof**,
not native qualification, raw-to-terminal success, or runtime activation. It is
separate from observation-only v2, whose audit-composition rejection stays intact.

## Composition and boundaries

`composeInverseAuditObservationSource({observer, pc, template, auditPlan,
diagnostics, limits})` accepts the existing single-call/source-closures owner
profile and an authenticated v2 observer plan. It reconstructs phase-PC/owners
and requires exact bytecode, beginning code, complete owner source and state-size
agreement. It then builds the canonical original owner dispatcher, optionally
using the **unchanged** fixed h128/h192 tip-impact checkpoint composer. That
composer still verifies its original static-cap audit helper bodies first.

Only afterward are two exact original application declarations renamed and
wrapped: `rc_world_application_begin_outer` and `begin_post_h`. Their signature
and complete tokenized bodies must match `generateWorldApplicationWGSL`; their
original bodies/call order remain untouched. Initial sampling occurs before the
first original outer entry; subsequent sampling occurs before original
post-application, after the last solver pass. Scratch uses the original
candidate stride; the original substep/clock and producer epoch guards remain.
The original observer's five private point-query parameters are disjoint from
original physics globals, and each actual point-stage entry is checked to write
all five before any read. VM budget yields do not reset an in-flight function.

No new world frame, expected physics, residual or scorer value is uploaded.
All original bindings 0–4 and their logical lengths remain unchanged.

## One eighth binding, two bounded logical views

Binding 5 in source / binding 7 in the scalar VM is one physical slab:

1. The **entire original audit view**, including any diagnostic snapshots.
2. Zero alignment padding to a 64-word boundary.
3. All per-candidate observer allocations.

`mapInverseLogicalViewSource` tokenizes accesses to this single original global.
Every `arrayLength(&rc_event_audit)` becomes that source's original logical
length. Every indexed read/write/compound/update becomes a checked **final**
physical address. Original index arithmetic, including u32 wrap, evaluates
first and once. Out-of-view indices yield `0xffffffff`; no caller adds an offset
after that sentinel. The scalar VM consequently reports storage-range failure,
which must be unsupported/failed, never a physical miss. Do not submit this
source as a standalone native shader and rely on hardware robust-buffer zeros
as an equivalent error protocol.

Escaping pointers/unknown aliases, duplicate declarations, helper collisions,
overflow and incomplete memory limits reject. All mapping edits are reversible;
undo mapping and the two declaration renames recovers **every byte** of the
canonical original audit/checkpoint source. Bindings 0–4 are not rewritten.

`planInverseAuditObservationStorage` requires explicit binding/buffer-size limits
and at least eight storage buffers per shader stage. It checks the whole slab,
not only the event prefix, and never truncates candidates or snapshots. These
are planned limits, **not evidence of an actual device allocation**. A future
runtime must retain fresh zeroed storage, enforce the existing observer-vs-
physics/program/scratch/input/code/VM nonalias rule, bind exact original views,
and fail allocation explicitly before dispatch.

For the tested current count2/h128+h192 qualification shape:

| Part | Words | Bytes |
|---|---:|---:|
| Original event prefix | 2,056 | 8,224 |
| Complete original audit + snapshot logical view | 254,024 | 1,016,096 |
| Alignment padding | 56 | 224 |
| Observer tail (2 × 2,496 words) | 4,992 | 19,968 |
| Entire eighth binding | 259,072 | 1,036,288 |

This fits the declared 128 MiB binding limit. It is a **diagnostic qualification
allocation**, not the production compact-result footprint or measured total GPU
memory, and says nothing about 1024-candidate execution/performance.

`splitInverseAuditObservationStorage(layout, words)` only detaches the complete
logical views after execution; it refuses shared/incomplete input. The unchanged
original audit/checkpoint decoders and independent all11/native comparators must
still validate their entire original view. An empty tape cannot substitute for
the real h165 event in the later physical-impact gate.

## HOST evidence

The deterministic transport suite checks original lengths, nested accesses,
negative indices, u32 wrap, sentinel isolation, exact LHS/RHS/compound/update
order, and dirty neighbor preservation. It has no private artifact or GPU import.

The original-initial-capture suite separately establishes:

* genuine created-t0 and two retained h; all11 source groups and every original
  observation frame match independent original source oracles created only after
  the actual retained run;
* the **entire** original emission tape matches. This early fixture emits zero
  events; it is not active-tip tape evidence;
* exact canonical h192 checkpoint source recovery, with no h192 forward run;
* actual original keyed/non-key/overflow/error audit helpers and actual full-bank
  checkpoint-copy helpers produce exactly the standalone logical-view words
  beside dirty observer storage. Those helper inputs deliberately model discrete
  diagnostic counters, not a physically reached h128 world.

Commands:

```
node --test tests/resident-candidate-inverse-observation-storage.mjs
node --test tests/resident-candidate-inverse-audited-world.mjs
```

The second suite needs the original capture/decoder prerequisites documented in
`resident-candidate-original-fixture.mjs`; it is not artifact-independent CI.
No Dawn/WebGPU import or execution occurs. Native combined-view qualification,
genuine raw/impact/full-rest observer+terminal-join integration, unchanged actual
emission tape, allocation/admission, solver adapter, and throughput gates remain
open. The prior scalar query join is still legacy-query only; this storage
transport adds no final-gameplay authority and no planner/default switch.

## Separate terminal-query kernel

`generateInverseAuditedQueryJoinWGSL({composition, join})` in
`inverse-audited-query-join.mjs` accepts only the locally admitted composition and
an existing admitted query join with the **same observer object, candidate count,
stride and original source identity**. It maps the original scalar join to the
same observer tail and returns a separate kernel. This does not schedule the
kernel, inject frames, upload a scorer decision or establish a completed shot.

The original join's entire WGSL source (including attribution, function order,
arithmetic, nullability, status and constraint checks) is recoverable byte for
byte. Only binding5 indexed access/length is mapped; bindings0–4 and the full
original audit/checkpoint logical view remain unchanged. The original source
`Math.round(-0)` stays negative zero internally; only the original JSON contact
cell's encoded zero is canonicalized, as in the standalone join. Legacy source
query purposes and explicit final-gameplay receipts remain distinct; the join
still rejects a request carrying the new finalization policy.

The returned `sourceSha256` pins the complete mapped kernel, including its address
helper. Its `context` is the unchanged scalar observation contract, **not** a
replacement for a runtime manifest binding the complete physical executor,
logical views, initial raw inputs, immutable code and this mapped source. A
future runtime must dispatch it on the same resident banks only at the original
source boundary and preserve malformed/incomplete/unsupported handling. This
mapper is qualified only through the scalar microcode compiler/VM HOST path;
WGSL robust out-of-bounds behavior alone is not the VM's explicit failure receipt.

HOST component tests compare nine scenarios against the standalone original
join: discrete positive, negative and late-foul decisions, null first contact,
negative-zero cell serialization, and running/unsupported/incomplete/cancel/error
states. Every terminal record and the entire observer tail match; the entire
original audit + snapshot + alignment prefix remains dirty and untouched. Those
terminal inputs deliberately model source decisions, **not physically reached
h128/h192 states**. The separately rerun genuine t0/two-h all11/frame/tape gate
provides the available physical context, but no terminal trajectory.

No native compile/execution, full-rest observer integration, source-bound public
solver adapter, display replay or production activation is established here.
