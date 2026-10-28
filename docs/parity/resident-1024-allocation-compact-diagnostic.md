# Closed historical1024 allocation / compact ABI diagnostic

The separately approved diagnostic completed one lead-owned native run and an
independent assertion at frozen source `ae076ced2d3a35402e736527b736fcbb7b9a6aa4`.
This is an **allocation/access/lifetime and integer ABI pass**, not a physical
trajectory or production-classifier qualification.
The resource profile remains the historical four-macro512/h2 profile, stride
7814 words, with exactly25 buffers and370,787,688 logical bytes. It is neither
the current five-macro physics profile nor restored production runtime brands.
See the earlier proposal for the exact table and exclusions.

## Closed roles

`tests/resident-candidate-1024-allocation-native.mjs` has four explicit roles:

- `prepare DIR RETENTION_MS`: writes a fresh immutable input/plan, independent
  integer expected rows and manifest. This is small source metadata only, not
  world construction. Retention must be explicitly1–900,000 milliseconds.
- `held PREP MANIFEST_SHA OUT`: requires both native opt-ins, requests one owned
  device, logs adapter and granted limits, preflights and compiles **one1,308-byte
  integer shader**, then waits. The held receipt binds source/plan/adapter/limits,
  a fresh random challenge, exact fixed schedule and expiry. It has **zero
  buffers/compute dispatches** until a matching decision. Timeout is resource
  retention policy, not a physical horizon. Device loss invalidates the cache.
- `decision COMPILE_RECEIPT FILE_SHA ACTION OUTPUT`: creates either `stop` or
  `run-fixed-three-waves`. This is a separate lead-owned action, never emitted
  automatically by `held`. Missing, stale, changed or expired decisions reject.
- `assert PREP MANIFEST_SHA OUT RECEIPT`: independently opens expected and actual
  compact evidence and validates every ID/status/pass/reason plus all resource
  and command counters. Native never opens the expected file.

The exact prepared retention is900,000 ms. Prepared input is130,689 bytes;
expected is20,873 bytes. Their manifest/payload/source digests are recorded in
`docs/evidence/resident-1024-allocation-diagnostic-host-v2.json`.

## Fixed device schedule

The three serial waves are complete unqualified transport, cancellation after
clear/drain, and stale generation after staging bank0. Every wave allocates all
25 buffers before writes. All20 other source buffers are fully cleared; inputs
and compact seeds receive four full writes. Complete/stale waves also execute
two16-workgroup/WGS32 guards and two ordered compact copies, followed by one
16,384-byte map. Cancellation has no guard/copy/map. Peak logical bytes remain
370,787,688; total fixed operations are75 buffer creations,60 clears,12 writes,
four guard dispatches, four copies, three submissions and two compact maps.
No retries, auto-extension, reduced row counts, CPU physics or spill are allowed.

The guard is the actual current `generateNumericAdmissionWGSL` with mask0.
Adversarial PASS/MISS **transport inputs** must become unsupported; all public
pass values are null. Other synthetic rows exercise incomplete, unsupported,
cancelled, rejected and stale/lost failures, not their physical causes. The
unchanged real compact transaction separately rejects forged physical claims,
partial banks, duplicate staging and stale identity. Results commit only after
all buffers are destroyed and the final lease check succeeds.

API creation, clear/write/copy completion and cleanup are reported separately.
This does not prove physical VRAM materialization/free memory. Only the tiny
input/compact bindings are used by a pipeline; no production seven-binding
physics pipeline or world/VM classifier executes. The source buffers contain
diagnostic zeros, **not** original initialization or future states. Their
allocation/lifetime therefore cannot qualify1024 trajectories.

## HOST evidence

Ten deterministic groups passed (0 failures/skips,0.945 s): exact profile/limits/
roster negatives; allocation-free compile barrier; source parser; full sparse
fake access/compact parity; cancel/stale atomicity; partial allocation/scope/
upload failures; loss racing a hung drain; cache invalidation; malformed ID and
forged physical claims; and closed prepare/assert-role replay with a modified
counter negative. Fake devices are **noncomputing** and use only98,304 bytes of
HOST payload storage per wave, never370 MB source mirrors. The tiny guard's HOST
reference only tests integer ABI transport. No fake receipt is native evidence.

## Reproduction recipe (any new run requires a separate exclusive slot grant)

Use the frozen worktree and already prepared immutable files; do not regenerate
inside a retained device session. `PREP`, `OUT`, and `SCRIPT` below are explicit
local paths supplied by the lead. OUT must not already exist.

```sh
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 RUN_RESIDENT_1024_ALLOCATION_DIAGNOSTIC=compile-hold-only \
GPU_NATIVE_MODULE=/absolute/webgpu/index.js \
node "$SCRIPT" held "$PREP" \
  60d2c946911d0a087cad4811ad503e9d186700f7629f59932dea1f67b0b80f79 "$OUT"
```

After reviewing the emitted adapter/limits/compile receipt, the lead may create
exactly one decision using the compile receipt's actual file SHA:

```sh
node "$SCRIPT" decision "$OUT/compile-receipt.json" "$COMPILE_FILE_SHA" \
  run-fixed-three-waves "$OUT/decision.json"
```

`stop` is the other permitted action. After native terminal and cleanup:

```sh
node "$SCRIPT" assert "$PREP" \
  60d2c946911d0a087cad4811ad503e9d186700f7629f59932dea1f67b0b80f79 \
  "$OUT" "$OUT/assertion-receipt.json"
```

The original CPU/UI backend, production admission/masks and all physics
qualification flags remain unchanged. Browser execution is not attempted.


### Reporting freeze v2

Prepared v1 is preserved, not overwritten. V2 adds the explicit label
`historical-four-macro-512-h2-resources/current-mask0-compact-ABI` to input,
compile/actual/assertion receipts and every wave's metrics. Every one of the75
buffer create/destroy identities has exact bank/name/size/usage and clear/write/
copy byte counters; the independent comparator checks each entry and aggregate
75/75 balance with peak25. Complete/stale waves access all25 buffer ranges.
Cancellation intentionally leaves the16,384-byte readback untouched, because
it stops after source clear/write drain and performs no copy or map. Neither
version proves physical residency. The1,308-byte shader, source buffer roster,
seeded ABI rows and fixed GPU schedule are unchanged by this reporting update.


## Native evidence: one closed run

[Curated evidence](../evidence/resident-1024-allocation-diagnostic-native-v1.json)
binds the frozen source, prepared input, actual, independent assertion and
supervisor digests. Earlier proposal/HOST snapshots remain unchanged as dated
pre-native evidence. No native work or test suite was rerun for this curation.
The device reported **SwiftShader fallback**, with a 134,217,728-byte storage
binding limit and a 268,435,456-byte buffer limit. The largest historical buffer
was 129,191,904 bytes: 5,025,824 bytes below the binding limit.

All 75 create/destroy identities balanced, with at most 25 live buffers and
370,787,688 logical bytes. Independent checking covered each buffer's exact
bank/name/size/usage and full clear/write/copy coverage, all 1,024 IDs in order,
and every public status/pass/reason. The complete wave committed all rows;
controlled cancellation after drain and stale generation after bank 0 staging
committed neither partial nor physical success. Every public `pass` was null.
Totals were 60 clears, 12 writes, 4 integer guard dispatches, 4 copies,
3 submissions, and 2 final compact maps of 16,384 bytes each. Device release
was logged and the owned process exited 0.

| Stage | Host wall milliseconds | Compact publication |
| --- | ---: | --- |
| One tiny pipeline preflight/compile | 29.891798 | No buffers or dispatches before the explicit decision |
| Complete unqualified transport | 151.775676 | All 1,024 rows, no physical PASS/MISS |
| Controlled cancellation after clear/drain | 180.816936 | Atomic cancelled outcome, no map |
| Controlled stale identity after bank 0 staging | 146.358014 | Atomic failed outcome, no partial commit |

These are one run's **host wall** durations, not GPU timestamps, trajectory
costs, calibrated throughput or speedups. The supervisor's 36.009 s lifetime
includes the explicit decision wait and is not an execution benchmark.

### Memory observations, not residency or a true peak

The 2 s supervisor sampling reported a maximum sampled `VmHWM` of
**75,540 KiB** (its terminal field is named `peakOwnedChildRssKiB`) and a maximum
sampled instantaneous `VmRSS` of 74,584 KiB. It **missed the subsecond allocation
waves**. Native event logging separately observed RSS as high as
**837,795,840 bytes**, at `stale-after-bank0` / `uploaded`. Neither observation
establishes a continuously measured process peak; neither measures VRAM or
proves physical GPU residency. The 370,787,688-byte figure is the exact logical
live-buffer budget, not either observed process-memory value.

### Remaining boundaries

This result uses the **historical four-macro 512/h2 resource shape**, not the
current five-macro runtime. Source resources were zeroed diagnostic allocations,
not original initialized physical worlds; only the current mask-0 integer guard
ran. Physical PASS/MISS remained unavailable. Actual native device loss and
allocation failure were not induced: those cleanup paths retain only the
separately labeled noncomputing HOST evidence. Synthetic device-lost status rows
are transport coverage, not proof of real loss recovery. Browser execution,
production classifier execution, physical residency, 1,024-trajectory parity,
full-rest scoring and release qualification remain unproven. Default CPU/UI
activation and all qualification flags are unchanged.
