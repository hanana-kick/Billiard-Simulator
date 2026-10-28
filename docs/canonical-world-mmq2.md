# Explicit MMQ2 world continuation

This opt-in experimental route retains original rolling recipes and uses the complete MMQ2 earliest-event ledger for rolling pairs, finite cushions, translational stops, and normal-spin stops. It does not replace rolling motion with fitted SMT2 polynomials.

- Default factory/binding revision remains `mmq1`.
- Select `mixedMotionRevision: 'mmq2'` in the immutable canonical world binding, or both the prepared GPU factory and its run options. Mismatched factory/run revisions are rejected.
- An all-object-clear original rolling tail may still advance directly to physical model rest. Otherwise, the original rolling descriptor participates in the mixed event query.
- Stop events advance the entire roster on the common clock without manufacturing an impulse. Overlapping unresolved event brackets remain pending.
- Qualified cushion response retains the actual impact even if the subsequent bounded departure cannot be proved. A failed proof is not a miss or a successful rest.
- The original shot deadline and component world-step cap remain authoritative. Cumulative request-wide work/event accounting is still not implemented.
- Selected GPU trace remains explicitly MMQ1/no-cushion until the separate MMQ2 source-capture adapter is qualified. This route is not wired into the application default or frozen multi-candidate batch.

## Validation scope

CPU world fixtures with the existing default material cover rolling cushion impact, the original 64-tick departure, subsequent clearance, and full rest at launch speeds 0.2, 0.3, and 0.5 m/s. A 0.1 m/s fixture consumes an original normal-spin stop but later remains unresolved; it is intentionally not reported as rest. Deadline and work-cap checks do not manufacture completion.

The GPU clear commit validates original candidate, roster, material, source state, descriptor clock and accepted endpoint before mutation. The stop consumer additionally validates result identity, stable IDs, radius/mass, clock anchor/duration and unchanged impulse counters. Isolated native tests passed 14 clear cases (7,168 exact words) and ten stop result cases (one accepted, nine rejected), using software Vulkan. The guard graph was simplified into accumulated side-effect-free predicates without removing checks after an earlier compiler RSS cap failure. Final isolated test: 233.6 ms, 379.31 MiB sampled aggregate RSS under the unchanged 1,500 MiB cap.

Composed native GPU qualification has now passed the six prepared three-body cases below. The following resource-limit failures are retained as historical evidence. Its first run exceeded the unchanged 1,500 MiB process RSS cap during post-world shared-engine compilation (1,533.65 MiB sampled aggregate, 167.089 seconds); it did not reach physics comparison. The opt-in factory omits ten old rolling-entry shaders never dispatched by this revision, and the independently qualified stop-proof guard restructuring retains exact results. A second composed run passed world, microtail and journal compilation but stopped at 1,525.87 MiB during lazy cushion compilation after 105.065 seconds, again before physics comparison. Further per-stage cushion markers and a same-engine no-cushion-first comparison are prepared; the cap has not been raised. Neither component nor composed parity checks certify physical-model accuracy, hardware GPU throughput, browser support, or release readiness.

## Local checkpoint, not a release

The third composed attempt first compared two no-cushion fixtures against CPU state, dense state, journal and auxiliary journal: 2,592 words each, 5,184 exact words total. Speed 0.2 m/s remained pending 7/6 at tick 50,319; speed 0.1 m/s remained pending 7/6 at tick 103,322. Neither reached a stop event. A separate interior source CPU fixture reaches the qy stop at tick 113,927, but its composed GPU comparison is still pending.

The same process subsequently stopped at 1,517.25 MiB after 93.182 seconds while compiling cushion entry stage 3 (`MIXED_V2_HULL_ENTRY_WGSL`). Earlier entry query/finite-query/ledger stages completed; the resolver finite-CLEAR stage was not reached. The test did not complete successfully and does not establish full rolling-cushion GPU parity. The source is checkpointed locally with default MMQ1 unchanged and the application feature still off.

CPU-only repeated-contact coverage additionally finds two actual cushions followed by rest at speed 2 m/s from x=0 (tick 7,763,487, 99/128 work steps). Speed 4 m/s reaches three cushions but exhausts the unchanged 128-step budget; its outcome remains status 5/reason 77, not rest. The two-cushion fixture subsequently passed composed native GPU qualification below. The three-cushion work-budget outcome remains CPU-only.


## Qualified composed prepared-world result

After the source-bound selected endpoint cache in `06b43b8`, the same prepared MMQ2 GPU engine passed all six cases. Each compares complete state (256 words), dense state (256), journal (1,056), and auxiliary journal (1,024): **15,552 exact CPU/GPU words**, including explicit array-length checks.

- Cushions disabled, speed 0.2 at x=1.38: pending 7/6, tick 50,319.
- Cushions disabled, speed 0.1 at x=1.38: pending 7/6, tick 103,322.
- Cushions disabled, speed 0.2 at x=1.3: original qy-stop chronology, then pending 7/6 at tick 540,177. The CPU source stop is tick 113,927.
- Cushions enabled, speed 0.2 at x=1.38: one actual cushion, full model rest at tick 1,103,434.
- Cushions enabled, speed 0.1 at x=1.38: stop and actual cushion followed by unresolved continuation, pending 7/6 at tick 123,756. It is not a miss or rest.
- Cushions enabled, speed 2 at x=0: two actual cushions, full model rest at tick 7,763,487.

The bounded native process exited successfully after 163.768 seconds with sampled aggregate RSS 1,334.69 MiB and maximum child RSS 1,292.99 MiB, under unchanged 240-second / 1,500-MiB limits. World compilation took 69.617 seconds; lazy cushion compilation took 64.776 seconds. Single software-Vulkan submit-to-completion observations ranged 3.38–4.75 seconds; these are not hardware throughput or calibrated acceleration measurements.

Owned GPU buffers were 204,504 bytes without cushions and 348,248 bytes with cushions. These figures cover world continuation, journal and rule buffers, exclude a raw producer, and are distinct from process/compiler RSS. No intermediate readback or host physics occurred between phases.

This is prepared three-body qualification, not raw-strike scoring, four-body MMQ2 qualification, full UI integration, selected MMQ2 trace qualification, or release approval. MMQ1 remains the default. Selected MMQ2 source capture is a separate next integration step.
