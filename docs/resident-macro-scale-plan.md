# Staged row-boundary and physical qualification plan

**Planning only; no new source-count compilation or GPU run is authorized by
this document.** The six-row [bounded validation](resident-mixed-six-native-validation.md)
is evidence for its exact bytes, not a count-independent production runtime.

## Next bounded gates: eight, then nine, then review

1. Build a fresh authenticated **8-row / h2** initial-only source and exact
   compilation receipt. Preserve the existing six rows and append two distinct
   real raw settings. Independently classify them using the original source;
   require multiple actually admitted rows, preserve rejected/unsupported rows,
   and never replace a failure to obtain a desired result. Freeze the roster
   and exact Number parameters before native work.
2. After independent t0/all-11 h2/history and WGS1/WGS8 full-word parity for
   those eight, append a ninth varied row and regenerate **9-row / h2** source.
   Admit each exact profile independently. WGS8 must exercise lane 8 in the
   second workgroup, with seven guarded padding lanes. The core remains WGS64.
3. Review measured compile, raw-init, continuation, map and memory costs before
   scheduling an optional **16-row** pilot. Sixteen is not automatic, and no
   stage authorizes 1,024. Later core-boundary **64/65** and bank-boundary gates
   need their own plans. Duplicate settings with different IDs may test lane
   ownership, but must be labeled replication, not distinct physical coverage.

| Count | WGS8 groups | Padded lanes | Core WGS64 groups |
|---:|---:|---:|---:|
| 8 | 1 | 0 | 1 |
| 9 | 2 | 7 | 1 |
| 16 (conditional) | 2 | 0 | 1 |

For every new count, prepare independent expectations in a separate process
that terminates before native compilation. Retain the complete original created
t0 authority and all 11 h2 owners; WGS8 must bind an independent WGS1 PASS plus
exact baseline actual hashes. Compile all selected shader entries first, with
actual adapter/limit receipts and broad-first preparation. Stop on resource,
compile, admission or numerical failure; do not reduce count/WGS/horizon or
convert unfinished/error states into misses. Lead-owned decisions, explicit
continuation ownership and atomic cleanup remain mandatory.

## What actually changes with count

Source authorities: `world-initialization.mjs`, `macro-launch-profile.mjs`, the
source-PC generator and `microcode-vm.mjs`; the new production builder is a
separate implementation task, not permission to relabel the six-row runtime.

- Raw init/contact/cast dispatch **workgroups are N**. World transfer and five
  creation stages use **ceil(N / 32)**; creation embeds `RC_INIT_COUNT`.
- Fixed-CCD offset, control/request tail bases, state length and source-PC
  bounds depend on N. The six-row source/budget proof cannot be inherited.
- Core and handler shaders embed exact count/VM span guards; core dispatch is
  **ceil(N / 64)** and macros **ceil(N / WGS)**. Candidate-owned entry slots,
  parameter/return spans, source arguments and final padding must revalidate.
- Bytecode, complete descriptor array, local allocation, generator versions,
  initial input, generation and source hashes must bind the fresh count. No
  old VM state or historical future state may be inserted. Instruction count
  and VM local stride below are projections until compilation confirms them.
- Readonly sharing/cache reuse requires **byte-identical data/source plus the
  exact binding/entry descriptor**, never just the same function name. Some
  raw stages may remain identical; no predicted cache hit is a compile receipt.
- For the **same physical geometry, query caps and source schedule**, raw init
  remains 68,313 commands plus two begins. Count changes workgroup work, not
  that command count. A fixed 512-cycle pilot still has 2,560 continuation
  commands, 70,875 total dispatches and 72 submissions with the current chunk
  and two-capture policy. **512 is a work cap, not proof of completion** for
  new rows. Any incomplete row blocks physical PASS; extending work needs a
  separately frozen continuation decision, not an implicit retry.

## Cost review before larger work

The only observation is six rows on fallback SwiftShader: initialization
7.460–8.018 s and fixed continuation 107.104–129.253 s. The table below simply
multiplies those observations by N/6 to budget a discussion. **These are neither
predictions nor upper/lower performance bounds**: live-row mix, second-workgroup
occupancy, physical branches and source/compiler effects may be nonlinear.

| Count | Scaled init reference, s | Scaled continuation reference, s |
|---:|---:|---:|
| 8 | 9.95–10.69 | 142.81–172.34 |
| 9 | 11.19–12.03 | 160.66–193.88 |
| 16 (conditional) | 19.89–21.38 | 285.61–344.68 |

Budget **each** WGS1/WGS8 comparison run, not only WGS8. Add new-count source
lowering, native compilation, independent CPU reference, capture/map/assertion
and cleanup. Existing native observations were 151.643 s for 26 cold pipelines
and 103.400 s for four additional macro pipelines; neither establishes a new
count's preparation cost. No large-row run should start before actual fresh
source/allocation/compile receipts and a lead-reviewed measured-cost update.

## Capacity arithmetic is not execution qualification

Measured six-row non-audited shape: world stride 62,976 words, fixed CCD 1,016
words/bank, PC 80 and request 24 words/row; raw state 2,010, scratch 13,632,
inputs 16 and VM **7,814** words/row. This differs from audited h192's 7,817.
The five readonly initialization/source buffers total 3,919,316 bytes; the
count-specialized six-row microcode is 4,195,584 bytes.

Holding that shape/code size fixed **only for arithmetic**:

```
world storage bytes = 4,064 + 252,320 * N
all storage bytes   = 3,919,316 + 4,195,584 + 4,064 + 346,208 * N
two capture bytes   = 8,128 + 676,208 * N
```

| Rows/bank | World binding bytes | All storage bytes | Two captures bytes | Planned live bytes |
|---:|---:|---:|---:|---:|
| 8 | 2,022,624 | 10,888,628 | 5,417,792 | 16,306,420 |
| 9 | 2,274,944 | 11,234,836 | 6,094,000 | 17,328,836 |
| 16 | 4,041,184 | 13,658,292 | 10,827,456 | 24,485,748 |
| 512 (capacity only) | 129,191,904 | 185,377,460 | **346,226,624** | 531,604,084 |

Actual six-row device limits were **134,217,728 bytes/binding** and
**268,435,456 bytes/buffer**. Thus the unchanged two-capture readback already
fails maxBufferSize at 512 (arithmetic ceiling 396 rows), despite that bank's
world binding fitting. Segmented diagnostics or a different capture-lifetime
plan require explicit new allocation/lifecycle validation; merely removing the
copy is not equivalent diagnostic coverage. Driver/compiler/pipeline overhead
is absent from this inventory, and arithmetic fit never proves available RAM.

For intended 1,024-row compatibility, keep honest **two resident 512-row banks**
under the default 128 MiB binding limit, subject to fresh actual source shape,
atomic allocation and physical qualification. Share readonly data only after
byte comparison; maintain disjoint per-bank state/VM/scratch and ordered global
IDs/generation. A single 1,024-row world here would require **258,379,744 bytes**,
so it does not fit the current binding limit. A larger single-bank path needs
actual queried **and requested/granted** device limits, never an assumed limit.

The historical mandatory audit is a separate binding: **127,012 words/row**,
arithmetic ceiling **264 rows** at 128 MiB. It cannot be silently removed to
claim 512-row audited execution. Future event/long-horizon proof must either
retain a fitting audited bank or explicitly qualify a different audit design.
The proposed **16-byte compact result/row** is another separately tested
allocation/publication protocol, not a replacement physical result producer;
that producer is still unavailable and production PASS/MISS remains blocked.

## Physical completion is a separate axis

Eight/nine/h2 primarily tests launch boundaries and real early owner parity.
It does **not** establish late cue/contact transitions, collision chronology,
rule scoring or physical rest. Before release, independently select genuine
source-observed early and late events and complete-rest cases, retain every row
and its event-history authority, and compare all corresponding original owners
and terminal semantics. Four-ball opponent-cue prohibition must hold through
full physical rest; three-cushion scoring uses the second distinct red first
hit. Unsupported, incomplete, cancelled, stale or device-lost rows are explicit
non-results, never false misses or partial-success publication. No full-rest
horizon, terminal classification or throughput can be inferred by repeating h2.

### Actual eight/nine preparation checkpoint

The approved fixed roster has now passed genuine original no-step admission and
independent created-t0/two-h reference preparation; each count was freshly
constructed once through the production builder. See the
[eight/nine preflight checkpoint](resident-macro-eight-nine-preflight.md) for
actual hashes/layouts, admitted-row-aware cost references and unrun native gates.
