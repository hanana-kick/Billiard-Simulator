# One original CPU / SwiftShader inverse-wave measurement

Measured 2026-10-25 after an explicit exclusive numerical-slot grant, frozen
harness/runtime commit `a713b92f7976604886e515e26490e3fcd103b71b`,
`BENCH_WARM_REPETITIONS=0`, 384 MiB JS heap limit. Adapter: Google SwiftShader
5.0.0, fallback software Vulkan. Pipeline-cache prototype disabled.

**Result: parity passes; this GPU path is far slower than original Rapier in this
software-adapter sample. No hardware acceleration or robust median claim.**
Original CPU here really is Rapier `LabInverseEvents`, not the parity interpreter.

| Observable boundary | Wall time |
|---|---:|
| Engine/module/decoder setup | 166.496 ms |
| Original source setup/settling | 123.958 ms |
| Device setup | 8.252 ms |
| Original CPU speed 1.25 (begin/advance/finish/dispose) | 110.359 ms |
| Original CPU speed 2 (same) | 49.829 ms |
| Genuine preparation speed 1.25 | 918.302 ms |
| Genuine preparation speed 2 | 842.610 ms |
| GPU single speed 1.25 | 85.919 s |
| GPU single speed 2 | 54.746 s |
| GPU two-candidate batch | 123.164 s |
| Final parity/resource validation, excluded | 1.818 ms |
| Final device/source cleanup | 25.528 ms |

GPU evaluator times include owner construction, lazy pipelines, simulation,
scoring and owned-resource cleanup. The first single is device-cold; later calls
share the device but recreate owners. One fixed-order sequence is not controlled
statistical evidence. Batch was 12.44% below the sum of these two singles
(140.665 s), an observation only. Original CPU evaluation total was 160.187 ms.
Preparation costs are shown separately, not hidden in a CPU/GPU comparison.

| Observed API metric | Single 1.25 | Single 2 | Pair |
|---|---:|---:|---:|
| Dispatches | 259,596 | 162,152 | 420,262 |
| Queue submissions / read mappings | 21,720 | 14,576 | 34,810 |
| Readback bytes | 7,792,736 | 5,155,692 | 12,948,428 |
| Pipelines created | 72 | 66 | 129 |
| Mapping-outstanding union | 34.509 s | 21.784 s | 71.032 s |
| Mapping wait sum | 34.509 s | 21.784 s | 87.017 s |
| Observed synchronous API wall | 4.376 s | 2.780 s | 6.746 s |
| Buffers created = destroyed | 65,010 | 42,080 | 106,976 |
| Returned live logical buffers / bytes | 0 / 0 | 0 / 0 | 0 / 0 |

Mapping union/sum are host-observed roundtrip waits, not GPU timestamps. API wall
includes observer overhead; these figures are not disjoint elapsed-time partitions.
Resource peaks in JSON are observer-lifetime cumulative peaks, not independent
per-call peaks. API buffer bytes are requested logical sizes, not physical VRAM.
Final RSS sample was 828,137,472 bytes; no process peak-RSS assertion is made.

All original result fields passed unchanged gates with maximum absolute error 0.
Both jobs stopped for genuine opponent foul at h921/h571 and original outer
steps228/130. Native continuation calls during GPU evaluation: 0. Original source
bytes unchanged. Batch receipts show 1,486 multi-owner dispatches, maximum2 owners.
No uncaptured GPU error or rejected mapping was observed. Resource gates pass
after each evaluator independently. The process exited normally with status0.

## Evidence

- `artifacts/inverse-wave-cold-a713b92.json`: SHA-256
  `5e9f778a24a4956ffdc66693a6fb4359dc4ab0d1358328bd71e5f341cdd3a8b4`
- `artifacts/inverse-wave-cold-a713b92.log`: SHA-256
  `782d37635c047667b070a7572dd44a0b6b8c159d7da706f168730552e43acdcc`
- JSON retains clean measured git status, full source manifest/end recheck,
  source/request/engine/decoder hashes, adapter, raw timing/counters and gates.
- Initial launch failed before numerical work because the isolated worktree
  lacked ignored `vendor/rapier.cjs`. The exact integration dependency was copied
  (SHA-256 `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`)
  and existing node_modules linked; frozen measured source was unchanged. That
  initial error is preserved separately in the bootstrap-failure log.

This early-foul sample does not establish full-rest success, generalized search,
UI integration, warm distributions or hardware/mobile behavior. Numerical slot
was released immediately on the terminal validated result.
