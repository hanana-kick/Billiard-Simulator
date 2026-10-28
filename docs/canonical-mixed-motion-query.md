# Original-descriptor mixed motion query

Opt-in geometry-only module `deterministic-mixed-motion-query.mjs`; no production wiring, collision response, physical certification, or gameplay authority.

`prepareMixedMotionDescriptorsCPU(current, smoothRows, smoothOutputs, context)` consumes a prepared prefix state (256 words), actual SMT2 original rows and matching accepted outputs (256 words each), and context (160 words). The common original horizon is `state[4]`, never the requested context horizon. Supported kinds are REST, SMT2, and ballistic FLIGHT. Rolling and bridges explicitly return an unsupported descriptor. This boundary consumes trusted producer buffers, not externally asserted collision certificates. It retains body IDs, original clock, complete p/v/q, original normalized polynomial coefficients, endpoint, and local error radii. It assumes a canonical local anchor for REST/FLIGHT; carried physical enclosures are not accepted or claimed.

`mixedMotionBoundsCPU(packet, slot, lo, hi)` evaluates original accepted SMT2 polynomials as `x + d(t/h) + c(t/h)^2` with directed two-u32 arithmetic. Position and velocity use their own original coefficients and radii; they are not reinterpreted as constant acceleration. FLIGHT keeps the original ballistic polynomial. Bounds enclose interior extrema by interval evaluation. Non-admitted arithmetic returns invalid.

`runMixedWorldQueryCPU(packet, scene, options)` enumerates all sphere pairs, every actual immutable scene obstacle, each finite-cloth footprint, and flight landing boundary. Bounded chronological subdivision returns first uncleared intervals and preceding clearance for every object. Status 1 is geometry clear; 4 unsupported; 5 work budget; 6 uncleared. **6 never means a collision.** Equal/overlapping time intervals remain in the ledger; array order does not establish physical order. A separate entry qualifier must use all competing records.

`createMixedWorldQueryGPU(device)` exposes `encodePrepare` and `encodeQuery` for resident composition; `run` is a diagnostic descriptor upload/readback wrapper, not a runtime CPU-preprocessing design. Native test separately verifies resident preparation words. No intermediate readback is required between these stages in a composed encoder.

## Validation

2026-10-27: 6/6 native tests passed, six source cases, 14,112 CPU/WGSL words equal (descriptor preparation plus query ledgers at node caps 1 and 256). Tests include an actual accepted SMT2 whole-path AABB false positive, genuine pair candidate, earlier cushion candidate, ballistic landing, overlapping pair-time intervals, unsupported law, and budget exhaustion. Point endpoints reproduce original SMT2 encoded endpoints plus/minus error receipts. Directed subinterval tests include an interior extremum.

SwiftShader software Vulkan, not physical GPU throughput: compilation 6.227 s, bounded process 6.849 s; sampled aggregate RSS 664.00 MiB, maximum child RSS 626.92 MiB (distinct measurements). All guarded under 1500 MiB and 110 s. No default switched.
