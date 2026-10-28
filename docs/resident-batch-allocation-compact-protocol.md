# Resident microcode batch allocation and compact protocol

**Scope: HOST/source and allocation protocol only; no physical producer.**

This change is isolated from `executor.mjs`, the running h192 experiment, and
the default application backend. No GPU, WebGPU/Dawn native numerical execution,
physics simulation, UI test, upload, publication, or deployment was performed.
No test here establishes 1,024 executed trajectories or measured hardware memory.
Existing executor qualification flags remain false.

## Interfaces

- `planResidentMicrocodeAllocation(shape, count, options)` is pure exact buffer
  arithmetic. Default compatibility is **2 × 512 resident banks for 1,024
  rows**, never one implicitly enlarged binding. The default peak-live buffer
  policy is 512 MiB. A smaller device/budget rejects the whole request; neither
  total count nor bank count is silently reduced. Explicit larger single-bank
  planning requires `bindingPolicy: 'queried-device'` and `bankRows: 1024`.
- `snapshotMicrocodeDeviceLimits(device)` reads granted **GPUDevice** limits,
  not advertised adapter capabilities. The allocator always calls it itself;
  caller-declared arithmetic is not a real-device check. A 1,024-row world
  binding is 258,379,744 bytes and needs an actually granted sufficiently large
  binding and buffer size. No global VRAM-availability query is assumed.
- `allocateResidentMicrocodeBatch(device, {experimental, shape, input, identity,
  getIdentity, signal, bankRows, bindingPolicy, maxLiveBytes})` reserves the
  complete plan with actual `createBuffer` calls and owns its lifecycle.
  `input` uses `abi.mjs`'s unchanged 16-word input records. Identity has exactly
  `sourceIdentity`, `preStrikeIdentity`, and `generationIdentity`; it is copied
  and rechecked, not authenticated merely by being supplied.
- The returned `resources(receipt)` and `submit(receipt, commandBuffers)` are
  **internal transport integration seams**, not a physical evaluator. Only the
  owner may submit work using these handles; callers must not use its device
  concurrently or interleave error scopes. Each submit returns a fresh opaque
  receipt only after queue drain and all validation/OOM/internal scopes finish.
  Old or another owner's receipts are invalid; one live owner/operation is
  permitted. The source compiler must additionally bound dispatches inside
  command buffers; this layer bounds buffers per submission, not their contents.
- `collectCompact(receipt)` makes one `16 × row count` result copy/map, validates
  every bank, destroys all allocations, rechecks live identity, then commits
  one complete ordered response. It does not copy world/VM state. Those buffers
  do not even carry `COPY_SRC` usage in the compact-only reservation.
- `cancel()` owns drain and cleanup; `dispose()` is idempotent cleanup. Caller
  cancellation does not release a bank still owned by submitted work. Device
  loss is a distinct failure, not a successful drain or miss. An unknown queue
  rejection can be retried for cleanup; if drain or scope closure remains
  unproven, handles are destroyed and that device lease remains poisoned rather
  than silently reused. Destruction failures are explicit, with best-effort
  cleanup of every remaining handle.
- `createResidentCompactTransaction` is the detached HOST validation journal.
  Its bank receipts prove only ownership, never source execution. It uses the
  existing four-word ABI `[id, status, pass, reason]`, including `UNSET` and
  existing `STATUS`/`REASON` enums; there is no second result encoding.

The allocation owner uploads **only raw input and PENDING compact records**.
Readonly source data and fixed-CCD initialization, source-specialized shaders,
initialization dispatch, VM continuation and the terminal physical producer are
not supplied by this module. `evaluate()` explicitly fails with `PHYSICS_SCOPE`
and closes its reservation. An unfilled reservation is not an initialized world.
The internal command-buffer seam is not a route around this missing admission.

## Exact source layouts — do not mix these profiles

| Dimension | Named outer64 baseline | Current coupled impact192 source |
|---|---:|---:|
| Source runtime rows | 2 | 2 |
| World words / row | 62,976 | 62,976 |
| PC / request words / row | 80 / 24 | 80 / 24 |
| VM control / local / stack | 16 / 7,783 / 15 | 16 / 7,786 / 15 |
| VM words / row | 7,814 | **7,817** |
| Scratch words / row | 13,632 | 13,632 |
| Retained raw initialization words / row | 2,010 | 2,010 |
| Microcode words | 1,078,200 | 1,055,264 |
| Source storage bindings | 7 | **8** |
| Mandatory event/audit words / row | none | **127,012** |

There is one 1,016-word fixed-CCD tail **per bank**. The actual world layout is
all world rows, then the shared fixed-CCD tail, then all PC rows, then all
request rows. The PC/request tails are not interleaved in each world row.
Raw/numeric scratch names alias the same bank-local buffer; scratch is neither
summed twice nor reused between live banks. Raw initialization buffers remain
allocated throughout; early retirement is not assumed.

`deriveMicrocodeResourceShape` now reads both named source profiles. The new
current-profile fixture records initial-only runtime SHA-256
`7cf2c1be3dc3c6736ed07a89d5df92fb01df416df519e86532f1f008839c9f1e`,
13,703,810 bytes, source commit
`7d5e70bff01ae9182080ef0496210348c8f12c9a`. Only this initial runtime was read;
no h192 bank, future snapshot, expected output, or run file was read or changed.

`assertResidentMicrocodeBankSource` refuses a two-row source at a 512-row bank,
even if allocation arithmetic fits. It also refuses audited source for this
compact-only owner. Layout compatibility is not shader/numerical admission.
`assertResidentMicrocodeReadonlySharing` compares actual common word arrays,
not just lengths/names/identity strings; differing bytes reject sharing.
Count-specialized world programs and microcode always have separate bank
reservations. The allocator does not upload source payloads, so future source
integration must use these checks before sharing/uploading data and must
revalidate immutable source provenance; this patch does not invent that gate.

### Named seven-binding baseline, 1,024-row reservation

| Live allocation category | Bytes |
|---|---:|
| Common raw program/geometry/template/world geometry, once | 419,348 |
| Separate world program + microcode per bank | 15,625,536 |
| All resident world + VM + aliased scratch buffers | 346,226,624 |
| Retained raw initialization state | 8,232,960 |
| Exact raw inputs | 65,536 |
| Compact storage output | 16,384 |
| Compact map staging | 16,384 |
| Diagnostic readback copies | **0** |
| **Peak live GPUBuffer bytes** | **370,602,772** |

Each 512-row world binding is 129,191,904 bytes, below 134,217,728 bytes
(128 MiB). Common payload reservations assume one exact byte-identical source;
actual payload equality must pass the sharing check before integration.
The older independent-session estimator intentionally duplicates all readonly
allocations and still reports 371,022,120 bytes. These are different explicit
allocation strategies, not contradictory measurements.

These totals exclude host typed arrays, pipeline/compiler memory, driver/device
overhead and allocator padding. All banks are simultaneously resident; there
is no CPU spill, per-h host forward fallback, or memory-availability promise.

### Audited h192 source is **not** this compact profile

Its eighth binding contains mandatory source event history and two full-state
checkpoint snapshots. At 512 rows it would require **260,120,576 bytes** per
bank. At 128 MiB the audit-binding arithmetic ceiling is **264 rows**:

- 264 rows: 134,124,672 bytes, fits this binding.
- 265 rows: 134,632,720 bytes, does not fit.

This is a **binding-size ceiling only**, not permission to scale the current
fixed two-row shaders to 264 trajectories. A hypothetical two-bank audited
1,024 reservation totals 890,672,724 bytes, including 520,241,152 audit bytes;
it fails both the compact-only policy and the default live-byte budget, as well
as the per-bank audit binding limit. Merely removing audit allocation would
break that source's eight-binding contract, so the owner rejects it even at two
rows. No audit shader was rewritten to make the estimate fit.

## Terminal validation and commit

1. Snapshot exact input words and distinct IDs; snapshot source/prestrike/
   generation identity. Preserve original order, including across bank ranges.
2. Preflight the complete plan, then allocate **all** buffers under validation,
   OOM, and internal error scopes before initial writes or external handles.
3. On allocation/initial-write/scope failure, publish no partial owner/results;
   drain if required, destroy all allocated handles, reject explicitly with an
   ABI failure outcome containing every original ID. Never shrink the request.
4. Serialize submits with one-use owner-local receipts. No receipt is issued
   during outstanding validation. Cancellation waits for owned submitted work;
   device loss terminates it explicitly. Device-loss subscriptions are shared
   per device and closed owners/waiters unsubscribe to avoid retained waves.
5. Read only compact output. Copy/stage each complete bank with its own opaque
   journal receipt. Reject wrong IDs/order/count, duplicate/cross-owner receipts,
   malformed statuses/reasons/pass words, and PENDING/RUNNING rows. The journal
   poisons the whole aggregate on any validation failure, including a late bank.
6. `UNSUPPORTED`, `INCOMPLETE`, `CANCELLED`, `FAILED`, and `REJECTED` remain
   terminal non-evaluations with `pass: null`; they never become misses.
   **PASS and MISS are both rejected with `NUMERIC` while physical production
   and qualification remain unavailable.** There is no `qualifiedMask`, boolean
   override, fabricated successful producer, or physical toy model.
7. After all scopes, map, bank validation and cleanup, recheck identity and
   commit all rows atomically. A generation/source change at final validation
   or even cleanup prevents publication. A committed wave cannot later be
   reclassified by calling `cancel()`.

A successful protocol commit may therefore contain only unsupported/incomplete
etc. rows. It means transport validation succeeded, not that the physical query
was evaluated. Its evidence explicitly keeps `physicalProducerAvailable` and
`numericallyQualified` false.

## HOST verification

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
RESIDENT_BATCH_SOURCE_RUNTIME=/workspace/scratch/f887f82f638e/resident-native-artifacts/coupled-raw-impact-native-v1/runtime.v8 \
node --test --test-concurrency=1 \
  tests/resident-candidate-batch-protocol.mjs \
  tests/resident-candidate-live-allocation.mjs \
  tests/resident-candidate-microcode-resources.mjs
```

The metadata-only fake device does not allocate hundreds of MB of CPU world
arrays. It stores descriptors and small raw/compact ABI payloads. Tests cover
all 20 partial-allocation failure positions, asynchronous OOM, every input ID,
real-limit selection, 2 × 512 reservations, source-count refusal, byte-identical
readonly checks, unknown queue/scope failure, drain/cancel/device loss, one-time
receipts, stale source/generation, late malformed rows, no partial commits,
16-byte-only copies, PASS/MISS rejection, and exactly-once cleanup. An optional
pinned-runtime test reconciles **every actual existing h192 retained-session
allocation descriptor** using a fake device/cache whose `submit` throws. It
never initializes, pumps, executes WGSL, maps a physical bank, or runs physics.

## Remaining release gates

- A source-authenticated, count-specialized, compact-compatible bank runtime;
  the current two-row audited h192 runtime is not such a runtime.
- Real initialization/continuation/terminal producer integration that preserves
  every source guard, capacity, body interaction and full-rest scoring rule.
- Independent physical/numeric admission for both PASS **and** MISS, including
  incomplete/stale/cancelled/device-lost behavior and multi-bank identity.
- Real serialized GPU execution at increasing declared row counts, eventually
  1,024 complete trajectories; actual memory availability/peak and performance.
- Separate original-physics, full UI/browser, build and authorized release
  validation. Nothing in this HOST protocol patch substitutes for these gates.

## Ordinary-page buffer admission repair

`abi.mjs` and the compact journal now share `isOwnedUint32Array`. It positively
checks the intrinsic Uint32Array view and ordinary ArrayBuffer backing-store
brands, without referencing the optional `SharedArrayBuffer` global. This
preserves ordinary non-cross-origin-isolated WebGPU page admission while still
rejecting actual shared storage, including saved/cross-realm shared buffers and
spoofed `.buffer` properties or backing prototypes. The existing same-realm
Uint32Array-view contract is preserved; the input/result word layout is unchanged.

`tests/resident-candidate-owned-buffers.mjs` imports both modules in an isolated
HOST process after deleting `globalThis.SharedArrayBuffer`, checks normal
pack/unpack/initial-results/decode/compact-journal behavior, and verifies that
previously created shared-backed inputs/results still reject. It also checks
normal-global and cross-realm backing-store cases. No browser/GPU execution is
claimed by this HOST regression.
