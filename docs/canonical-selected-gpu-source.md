# Selected resident GPU source capture (experimental v1)

The optional `runRaw(batch, { selectedTrace: true })` side channel records only one explicitly selected candidate. Normal batch search still returns its compact result, not every candidate's trajectory. This is not yet wired into the application or a release/default engine change.

## Source ownership

The append shader copies accepted source state and recipes before producer buffers are overwritten, in the same command encoder. It never writes physics buffers. Inactive scheduled phases do not append. Each snapshot carries candidate/scene/request identity, full stable-u32 roster, common clock, before/after state and original accepted recipe words. Microtail snapshots copy the micro producer's actual private context and original input, rather than the caller context with a different landing-clearance exemption.

After one final snapshot readback, `hydrateCanonicalSelectedGPUTrace` builds the selected trace without running the CPU raw/world/microtail/smooth/bridge/rolling physics. The resident micro format stores accepted rational and interval outputs rather than re-running bounces. A test loader replaces these CPU dynamics functions with throwing functions during hydration.

Hydration and sampling are separate operations. Exact accepted boundaries are retained. Some original-source interior samplers may execute source equations, and some raw-contact/microtail interiors have only bounded intervals or are unavailable. `physicsResultComplete`, `captureComplete`, and `samplingComplete` remain independent; capture completion is not a promise of exact arbitrary point sampling.

## Limits and memory

- Explicit MMQ1, no-cushion capture only. MMQ2/cushion capture is rejected, not silently approximated.
- One selected candidate, 3 or 4 balls, maximum 1–512 source records.
- Each source record is 4096 u32 words. The default arena is at most 8 MiB, with a separate same-size staging readback and small capture buffers. Normalized selected records have their own 2048-word format (at most 4 MiB). These are separate allocations, not a claim that total process RSS is 4 or 8 MiB.
- Overflow/error marks capture incomplete without changing the physical result. Cancellation invalidates the request; it is not a MISS.
- Receipt and every record must agree on identity/roster and continuous clocks; tampering with internally consistent but foreign record IDs is rejected.
- No hardware speedup is inferred from the software Vulkan runs.

## Qualification

Native test: `tests/canonical-selected-world-trace-native.mjs` uses `SELECTED_TRACE_CASES=goal`, `high`, or `late` in separate processes, with the native GPU lock and 180-second/1500-MiB watchdog. Ordinary GOAL and high-bit stable-ID GOAL each retain 78 exact source records (159,744 normalized words) and identical complete physics/journal/rules/compact output. The high-ID run took 92.75 seconds including compilation, with sampled aggregate RSS 1107.92 MiB on SwiftShader software Vulkan. The ordinary GOAL retained final tick 3343649 and compact `[100,1,0,1]`.

Focused CPU tests cover the append admission, wire hydration, selected source representations and raw trace. These component results do not substitute for application integration, full browser/UI testing, no-kiss qualification, MMQ2 trace support, or physical-GPU benchmarking.

Late-FOUL native qualification retains 100 exact source records (204,800 normalized words), final tick 3343645 and compact `[100,2,1,4294967295]`. This verifies that selected capture does not terminate at the earlier goal: the later forbidden opponent contact remains a foul through physical rest. The successful bounded run took 95.96 seconds, sampled aggregate RSS 1028.41 MiB. An earlier native child terminated without an assertion and its default reporter did not expose the signal; that failed attempt is not counted as a pass. A TAP-reporter retry passed with unchanged physics shaders. A separate transient host import error was corrected before that retry.

The final explicit GOAL isolation run also passed: a one-record arena overflows only the capture, cancellation after submission rejects with `AbortError`, and a subsequent untraced run returns the identical physical/compact output. This bounded run took 99.18 seconds including compilation and repeated execution, sampled aggregate RSS 1118.02 MiB. The focused CPU suite passed 29 tests with 2 native-only skips; typecheck passed. Source hashes were checked unchanged across the final native qualifications.
