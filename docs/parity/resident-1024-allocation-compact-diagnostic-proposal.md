# Proposed 1024-row allocation / compact ABI native diagnostic

**Proposal only: no native harness implementation or GPU execution yet.** This
is a separate resource/ABI gate, not trajectory qualification. Frozen source
boundary: `b6b5eba`. Exact current contract-file hashes and the complete buffer
roster are in `docs/evidence/resident-1024-allocation-diagnostic-proposal-v1.json`.

## Source identity and admission boundary

The production batch API uses **25 buffers**, not the older capacity owner's
20-buffer shared-readonly plan. It requires genuine same-realm branded runtimes
and preflights all physics pipelines. Using it directly would both reconstruct
full source and compile heavy physics merely to test allocation. This proposal
therefore uses a closed **TEST-only descriptor** and the existing compact ABI,
mask-zero numeric guard and atomic compact journal. It never restores a brand
or invokes the production executor.

Resource sizes come from the already committed, genuinely constructed two-bank
512-row/h2 HOST plan `652cfb9841eaae09090f9c14cbad923b1d12fd9a2225cd78695ab30ab1492216`.
Its source is `86c0a2ce9ca618e89397ca50409a351c2fd1a7bd43bb0db99b278f5f27dc26a2`,
bytecode `44c0bfeedd9e0abcd144980198d4ba88c55d6e218341e9aed170425dd292714e`,
and VM stride **7814 words**. This is the named historical four-macro h2 profile;
it is **not** the h192 stride7817 profile or the newer five-macro profile. Current
schema/lifecycle implementation hashes are bound separately. No fresh current
count512 physics source identity is claimed without genuine reconstruction.
The integer diagnostic has its own exact count512 kernel and generation hash.

If fresh current physics-count specialization is required instead of this
explicit resource-profile gate, that is a separate prerequisite; metadata or
hash strings cannot satisfy its owned-brand admission. No such reconstruction
is proposed here.

## Exact live bytes

Each of the two512-row banks owns this complete roster:

| Name | Bytes per bank | Usage |
| --- | ---: | --- |
| rawProgram | 20,284 | STORAGE + COPY_DST |
| rawGeometry | 45,472 | STORAGE + COPY_DST |
| worldTemplate | 251,960 | STORAGE + COPY_DST |
| worldProgram | 3,499,968 | STORAGE + COPY_DST |
| worldGeometry | 101,632 | STORAGE + COPY_DST |
| worldState | **129,191,904** | STORAGE + COPY_DST |
| rawState | 4,116,480 | STORAGE + COPY_DST |
| scratch | 27,918,336 | STORAGE + COPY_DST |
| inputs | 32,768 | STORAGE + COPY_DST |
| microcode | 4,195,584 | STORAGE + COPY_DST |
| vmState | 16,003,072 | STORAGE + COPY_DST |
| compactResults | 8,192 | STORAGE + COPY_DST + COPY_SRC |

Per bank: **185,385,652 bytes**. One global MAP_READ + COPY_DST readback adds
**16,384 bytes**, for **370,787,688 bytes (353.611 MiB)** across25 buffers.
Raw/numeric scratch aliases share one buffer per bank. All other resources,
including readonly buffers, remain separate per bank. No diagnostics, hidden
source-state readback, implicit sharing or initializer retirement is assumed.

The largest binding is5,025,824 bytes below128 MiB. Before any allocation,
recheck the **granted GPUDevice** limits and explicit live-byte budget, including
the intended seven-binding/64-thread source-layout requirements. A larger
adapter limit cannot silently activate a single1024-row bank. Low limits or a
budget below the exact sum fail before allocation; errors never shrink rows.
Driver allocation overhead, host objects and compiler storage are separate,
unknown costs. WebGPU does not reveal free memory or physical residency.

## Bounded real access, not createBuffer alone

For a full-access wave:

1. Preflight/compile one tiny integer kernel, with exact shared
   `generateNumericAdmissionWGSL` output and qualification mask0. No physics
   initializer, core, macro or production world/VM publisher is compiled.
2. Allocate all25 real buffers under validation/OOM/internal error scopes.
   Publish no handles or response until the complete allocation phase passes.
3. Queue full writes to both32,768-byte input buffers and both8,192-byte compact
   seed buffers. These are declared **synthetic ABI cases**, not world states.
   No giant host mirror of source/world/VM/scratch buffers is created.
4. Encode full `clearBuffer` operations for the20 other source buffers. Thus
   every byte of those20 buffers has explicit device work; the input/compact
   ranges are fully written and the readback is fully copied. This uses the
   actual production usage flags without pretending zeros are original source.
5. Dispatch the same count512/WGS32 integer guard once per bank:16 workgroups
   each. Preserve the input IDs/order, reject identity mismatch, and apply the
   actual mask-zero numeric guard to four-word ABI records.
6. Copy both compact outputs into their ordered global offsets; one submission,
   one queue drain, one16,384-byte map. Never map a source/world/VM buffer.
7. Feed the detached rows to the real `createResidentCompactTransaction`, check
   both source/generation leases through cleanup and final commit, then destroy
   all25 buffers before publishing one whole-wave result.

These operations establish API allocation and bounded real buffer access. They
still do not prove physical VRAM residency/materialization or hardware capacity
independent of driver behavior. Clear commands and scope/drain success must be
reported separately from mere creation.

## Transport and lifetime cases

Use an explicit deterministic nonmonotonic1024-ID roster, unique across banks,
bound with the packed input bytes, exact resource-profile identity, current
contract hashes, kernel bytes and generation. It is a **diagnostic** lease, not
an authenticated live billiards source/Controller request. No future states or
claimed source hashes can grant physics authority.

An eight-case ABI cycle covers adversarial PASS, adversarial MISS, unsupported,
incomplete, cancelled, stale-source failure, device-lost failure and rejected
records. The actual numeric guard converts both adversarial physical results to
UNSUPPORTED/NUMERIC. Expected status counts are384 unsupported,128 incomplete,
128 cancelled,256 failed and128 rejected. Every public `pass` field is null.
These status labels test integer transport, not physical causes. In particular,
a seeded device-lost row is **not** a genuine device-loss experiment.

Proposed fixed native schedule, pending separate authorization:

| Sequential wave | GPU work | Map | Public outcome |
| --- | --- | --- | --- |
| Complete unqualified transport |20 clears +2 guard dispatches +2 copies;1 submit |16,384 B once | Atomic1024-row unevaluated result |
| Cancellation after clear drain |20 clears, same4 full uploads;1 submit |None | Cancel entire1024-row lease, destroy all buffers |
| Stale after staging bank0 |Same full-access schedule |16,384 B once | Change generation before bank1 staging; reject entire wave |

Peak is one25-buffer wave, never three live waves. Total declared work:75 buffer
creations, one shared tiny pipeline, four guard dispatches, three submissions,
two compact maps, **zero physics dispatches**. No retries or adaptive extension.
Actual unexpected allocation/queue/device loss aborts and preserves failure;
no simulated loss is relabelled an observed driver fault.

Before native scheduling, small HOST-only contract/mocks should cover wrong
profile/count/ID/order/usage/byte counts, insufficient limits/budget, partial
allocation cleanup, duplicate staging, partial commit, forged PASS/MISS after
guard bypass, cancelled/stale leases and loss/drain cleanup. Injected failures
remain labelled HOST injection. Existing retained executor/fake lifecycle gates
remain separate; this new TEST owner does not qualify the production owner.

## Required dependencies and remaining decision

Only committed resource metadata plus ABI/numeric guard/compact journal and
actual granted device limits are required. No original WASM decoder, native
physics fixture,512-row source compilation, private v8, expected world or raw
future snapshot is needed. A separate native role must require explicit opt-in,
source/plan hashes, a fresh result directory and lead-owned exclusive scheduling.
No device request, browser attempt or native run is authorized by this proposal.

The primary remaining scope decision is whether this **historical-profile
API-allocation/shared-compact-ABI** gate is the intended next evidence. It cannot
be presented as the full production `generateInitialMicrocodePublication`
world/VM classifier or a current1024-trajectory producer. Default activation,
qualification masks and public physics capability flags stay unchanged.
