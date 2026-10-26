# Raw six-row broad-macro native checkpoint

**Strict original comparison passed; the throughput target is not met.**

At source commit `704a1ca954cfa279657e3e84592ec58d22a64d38`, the same six raw rows (four admitted, blocked, invalid) ran through the unchanged original raw initializer and two source h. Two fresh allocations shared only the retained compiled device/pipeline cache. Each run had one final diagnostic map, never intermediate CPU state selection, injected future state, or a CPU forward fallback.

The only execution-boundary change from the preceding external-macro gate was the exact source `rc_world_broad_commit_collision` closure. Its three u32 arguments and **void** return are preserved. All 64 source functions, changed-tree BVTT-before-deferred-join ordering, signed-zero helpers, guards and capacities remain hash-bound. No synthetic return word or private state was introduced. The separate [paired host gate](../evidence/resident-microcode-broad-paired-host-v1.json) matched all 147 complete-state/scratch handoffs and both independent original-CPU comparisons before native execution.

## Native result

- All 25 shader preflights passed before any expensive pipeline creation. Source buffers and original CPU oracle were absent during cold compilation.
- All eight original comparisons across both runs passed all 11 source groups. Warm source and VM words matched the first run in full.
- Four admitted worlds reached h2. Blocked/invalid worlds remained status 8, reasons 3/2, at h0: unsupported/rejected is not an ordinary miss.
- Native child exited 0, no timeout or signal. Peak RSS was 1,712,476 KiB. Adapter was **SwiftShader**, fallback=true, not physical GPU hardware.
- Fresh per-process invocation identities, rather than PID uniqueness, verified preparation/GPU/comparison separation.

| Measured host-wall scope | First execution | Warm fresh execution |
|---|---:|---:|
| Raw initialization, 68,315 dispatches | 7.022 s | 8.151 s |
| Two-h pump, 2,048 dispatches / two submissions | 111.546 s | 110.174 s |
| Steady end-to-end through final map/validation | 118.604 s | 118.373 s |

Cold compilation was separately **98.115 s**. Pump scheduling remained 512 fixed cycles of core→cue→numeric→broad, at the original 65,536 core-instruction budget. It contains 1,536 handler dispatches, but the actual host trace had only 147 source macro handoffs. The accepted native rows committed 3,664,809–3,735,006 core instructions; rejected rows committed 2,511.

The earlier two-macro warm pump was 133.939 s, while the older 16-owner native debug schedule was 65.870 s. This is a modest observed improvement, **not** an order-of-magnitude solution. Two lightweight host checks (318.1304 ms and 120.34853 ms, ending around 22:39:44/22:40:30 UTC) overlapped portions of this run; exact start times were not logged. These are host-wall/queue-drain measurements with one warm sample, not GPU timestamps, a rigorous calibrated ratio, or hardware predictions.

## Exact boundary and next work

This proves only the same bounded prestrike two-h input. It does **not** prove raw-to-impact, full rest, late-foul handling on a complete native trajectory, 1,024 physically simulated candidates, or a speed benefit on hardware. Public source/domain qualification and the default CPU backend are unchanged. No long-shot run is warranted at this cost.

The next bounded change is opcode-specific operand loading, with identical scalar bytecode and physical caps. COPY/FILL was not selected: measured contiguous runs cover only 8.62% of interpreter-dispatch opportunities. Full instruction costs and the fact that f64 helpers are only 2.00% of remaining core instructions are recorded in the [cost profile](../resident-microcode-core-cost-profile.md). PC/counter caching is a separate, unqualified proposal; it was not mixed into this gate.

Curated identities, per-kernel cold compile times, every run's control words, timing scopes and adapter proof: [evidence JSON](../evidence/resident-raw-broad-macro-two-h-v1.json). Local complete artifacts: `/tmp/resident-microcode-world-broad-v1`; raw logs and `.v8` files are not committed.
