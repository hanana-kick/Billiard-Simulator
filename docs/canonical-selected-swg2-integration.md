# Opt-in SWG2 selected-source integration

This is an explicit MMQ2 diagnostic capture path, not an application/default switch or a release claim. The existing MMQ1/SWG1 writer and admission remain separate.

## Ownership and bounded capture

The world factory chooses SWG2 only for its immutable `mixedMotionRevision:'mmq2'` and `selectedTrace:true`. One selected candidate owns an arena capped at 1–512 records. Each source snapshot is 4096 words; each normalized trace record is 2048 words. At capacity 256 the raw arena is 4 MiB, plus a same-size readback and small staging/control allocations (8,407,424 bytes observed in the raw fixture). There are no intermediate source readbacks and no CPU dynamics replay.

SWG2 phases retain original MMQ2 descriptor words, including rolling geometry caches, before later dispatches overwrite them. Pair, stop, clear, cushion impact, and genuine departure are distinct accepted sources. A cushion uses two records only when its departure advances. Generic endpoint duplicates are suppressed only with unchanged physical state and impulse counters; zero-time impacts remain typed events. Changed mode, support, radius or mass cannot silently disappear.

Hydration binds every source record to the outer numeric candidate/scene/request identity, complete stable ball roster, ordinal, first initial boundary, continuous clocks, pinned version, and final declared capture clock. It copies/adapts original recipes rather than fitting a trajectory to final states.

## Two entry points, different provenance

- `hydrateCanonicalSelectedV2GPUTrace` receives the original canonical request/candidate/batch and the GPU-owned raw-shot continuation capture. Its receipt has `entryKind:'canonical-raw-shot'`.
- `hydrateSelectedPreparedV2GPUTrace` starts from an explicitly supplied host-prepared world, not a raw strike. Its receipt has `entryKind:'host-prepared-world'`, `rawStrikeSourceCaptured:false`, `rawStrikeSourceComplete:false`, `startingTick`, and numeric `preparedBinding`. Caller string labels are not claimed to be verified raw-request provenance (`callerLabelIdentityVerified:false`). Both endpoints of every CPU hook must match the numeric prepared binding.

The prepared test's unavailable compact wire is a diagnostic placeholder, not a newly calculated gameplay verdict.

`captureComplete`, `physicsResultComplete`, and `samplingComplete` mean different things. Preserving accepted sources does not implement all raw-contact interiors or guarantee continuous point sampling. Pending/overflow/cancellation is not relabeled as a completed shot.

## Qualification evidence and limits

The first native raw four-ball MMQ2 run reached full rest after one cushion, retaining 31 normalized records / 63,488 words exactly equal to the CPU source oracle, with unchanged state/dense/journal/rules/compact outputs. Software SwiftShader run: 164.282 s, sampled aggregate 1365.66 MiB under 240 s / 1500 MiB limits. That run preceded the final duplicate/material and prepared-provenance hardening; it is not evidence of a hardware GPU speedup. Latest strict hydration of its saved sources passes with CPU dynamics and source sampling disabled.

An initial combined append-smoke + prepared native test process hit the unchanged RSS watchdog at 1500.44 MiB after 106.816 s before prepared capture execution. This is a compilation/resource failure, not a physics parity mismatch or prepared capture success. The retry separates the prepared process and releases resolved world shader wrappers; any changed RSS cannot be attributed solely to either change.

CPU coverage includes original rolling/pair/cushion adapters, zero-time typed impact retention, 32 prepared endpoint identity mutations, and outer receipt/roster/ordinal/version/final-clock tampering. Native prepared qualification and final hardened raw rerun are tracked separately until terminal results are available.

### Final prepared native results

The isolated prepared retry passed at **170.219 s / 1344.05 MiB** sampled aggregate RSS, under the unchanged 240 s / 1500 MiB limits:

| Genuine prepared case | Normalized records | Exact source words | Physical outcome |
| --- | ---: | ---: | --- |
| Speed .2, one cushion | 13 | 26,624 | Full rest |
| Speed .1, qy stop | 11 | 22,528 | Later pending; not full rest |
| Speed 2, two cushions | 101 | 206,848 | Full rest |

Each run preserved the exact uninstrumented GPU state/dense/journal and CPU normalized sources. A separate strict-loader process hydrated each saved GPU source dump with CPU dynamics **and point sampling** forbidden. The pending case correctly retains `physicsResultComplete:false`.

Final append-only native negatives also passed (0.605 s / 179.07 MiB): changed mode/support/radius/mass was not suppressed as an identical endpoint; cap-1 overflow remained incomplete; cancellation after submission rejected the cancelled read without corrupting the captured source. This is source-arena behavior, not an additional physics proof.

A subsequent hardened raw rerun was externally terminated with child `SIGKILL` at 13.44 s, sampled aggregate 1072.2 MiB; its watchdog reported no stop reason. No assertion or quota diagnosis is inferred from that signal. A concurrent CPU test child also terminated without an assertion detail; isolated MMQ2 source tests passed 8/8 and the serialized full selected-source regression passed **37 tests / 8 native skips**. Cgroup event counters were unavailable in the sandbox.

### Hardened raw retry passed

The single coordinated quiet-window retry on committed SWG2 source **6223fbb** passed: **151.383 s / 1392.10 MiB** sampled aggregate RSS, exit 0, no watchdog stop reason. The genuine four-ball raw shot reached full rest at tick 2,945,185 after one cushion; all **31 normalized records / 63,488 words** matched CPU original sources exactly. Trace-on/off physical results and CPU state/dense/journal/rules/compact outputs were identical. The capture includes genuine impact/departure phases 9/10; final hydration again passed with CPU dynamics and point sampling disabled.

The unexplained prior SIGKILL remains recorded above; the passing retry does not establish its cause. No hardware throughput, whole-application integration, complete interior sampling, or release qualification is implied.
