# Resident finite-cushion response and departure composition

`deterministic-cushion-resolver.mjs` composes existing numerical components; it does not introduce an alternative collision or friction law.

1. Require the unresolved world status (7, reason 6/7), original descriptor roster, current clock, identities, radius/mass, mode, encoded gravity/cloth/spin-drag constants and all nine p/v/q words to agree.
2. Run the original finite-hull entry ledger and actual cushion response; commit only the qualified common-clock all-roster response.
3. Expose this **impact snapshot** separately for journal capture: header 61 is cushion count, 62 absolute impact tick, 63 body×8 plus verified rail.
4. Produce a fresh original supported SMT2 prefix with one attempt, unchanged local error budgets, or original REST/FLIGHT descriptors. ROLLING is explicitly unsupported here, not converted to sliding or a straight line.
5. Require the existing cushion departure proof: every other object clear, bounded owned initial penetration, strictly outward stored velocity AND original position-polynomial derivative throughout the prefix, positive strict finite-hull endpoint separation.
6. Sample every body's full p/v/q from those same original descriptors. Commit the common endpoint only after the proof and original deadline checks. A failed departure keeps the genuine impact and remains pending. It is never promoted to REST or a score.

The departure changes no impact counter or impact timestamp. The caller must capture `impact.state` / `impactStateBuffer` before using the later endpoint. A valid departure does increment the existing clear-prefix counter. Header 6 stays NONE: there is no hull-ID exclusion and no just-hit-object blind spot.

## Interfaces

CPU: `runCushionResolverCPU(current, descriptors, scene, hulls, context, rails, material, options)` returns final state/dense, `committed`, `released`, and (when committed) the `impact`, `cushion`, `departure`, and `release` packets.

GPU: `createCushionResolverGPU(device, material).createBank({stateBuffer, denseBuffer, descriptorBuffer, contextBuffer, scene, hulls, rails, bodyCount, material, options})` exposes final state/dense, impact state/dense, entry/response/proof and departure descriptor buffers, `allocatedBytes`, `dispatches`, `directDispatches`, `indirectDispatches`, `bufferClears`, `encode(encoder)`, and `destroy()`.

The shader factory may omit material; each bank must then supply its explicit source material. Material is validated and packed per bank without shader recompilation.

Options: `releaseTicks` (default64, 1..65535), `maxNodes` (default256, aggregate bounded), `maxInitialPenetrationQuanta` (default128, 1..4096). The fixed release horizon does not reset or extend the original deadline. If insufficient time remains, the genuine impact is retained but departure reports budget-pending (5/84).

The bank enqueues 26 compute phases, uses no intermediate readback, performs no host physics, and does not submit the command buffer. Buffers can be reused; dynamic scratch is cleared on each encode. Static hull identity, bounds and geometric rail mapping are checked against the supplied immutable actual scene.

This is a canonical-local certificate, not a global physical-error enclosure or full-shot release claim. The finite-hull source laws and local tolerances remain unchanged.

## Component checkpoint

CPU: 10 tests passed (2 native-only skips). Resident native: 9 cases, 7,408 complete CPU/GPU words exactly equal, including final state/dense, impact snapshot, release proof and original departure descriptors. Final native compile76.639s; bounded elapsed77.835s; sampled aggregate1066.54MiB (1500MiB cap). Backend was SwiftShader Vulkan, **not physical GPU performance**. The native case covers original-law substitutions and deadline refusal as well as the actual successful finite EDGE departures. Typecheck passed. Independent review found no additional blocker in the source/context/proof composition.

## Complete finite CLEAR branch

A conservative rail AABB can overlap the path even when the original finite-hull query proves the entire path clear. The resolver now consumes this genuine full finite ledger, not the AABB result. It requires the exact positive original horizon and all pair, finite-hull, extra-static, cloth and regime records in the expected complete order, every status CLEAR, and every proved-prefix length equal to that horizon. Stale/material-substituted source descriptors, a deadline overrun, budget exhaustion, ties or missing/nonclear records cannot advance the world.

Descriptor polynomials and receipt radii come from the existing trusted `prepareMixedMotionDescriptorsCPU` / resident original-producer boundary. This resolver checks their current owner and encoded context, but is not an independent authenticity check for arbitrary caller-authored polynomial coefficients.

The endpoint uses the same original all-roster sampler and receipt/mode assignment as a proved departure. The return is `cleared:true, committed:false, released:false`; among the segment/event counters, only header 56 increments. Cushion count/tick/rail 61/62/63 and other event counters are unchanged. No hull ID is excluded, including the last-hit rail. The impact snapshot remains separately available on genuine impact paths; CLEAR creates no impact snapshot or journal event. GPU integration detects the source-bound 56 increment with unchanged 61, rather than assuming a failed entry is clear.

The complete-CLEAR phase is independently source/deadline guarded even if invoked on inactive input. The initial direct-dispatch checkpoint used 26 dispatches and 13 buffer clears; the GPU-owned gate below supersedes that execution policy without changing the original numerical laws.

Final CLEAR checkpoint: CPU 14 passed with 3 native-only skips; typecheck passed. Final source-bound native 9 cases / 4,608 complete state+dense words exactly matched, including genuine 3- and 4-body CLEAR endpoints and deadline, stale source, obstacle, pair, landing and work-budget refusals. Bank allocations are 70,824 bytes (3 bodies) and 72,168 bytes (4 bodies), excluding caller-owned input buffers and compiled pipelines. Final compile 86.215s, bounded elapsed 87.251s, sampled aggregate 1072.41MiB under 1500MiB. Before/after source hashes matched. Backend: SwiftShader software Vulkan, not hardware performance. The preceding full native suite passed 16/16, also rechecking 7,408 original impact/departure words and 17,520 chronological-ledger words. Independent review corrected the extracted CPU departure failure path: rejected original samples retain the genuine impact pending 7/96 rather than leaving it active; CLEAR rejection still leaves its source unchanged.

## Candidate-local inactive dispatch gate

The direct owner phase now writes two indirect dispatch records into the existing query-config buffer: one for single-workgroup phases and one for full-roster phases. Original horizon and work-budget words remain unchanged. Only an unresolved reason 6/7 source with matching original descriptors/context activates them; every encode resets both records before any return. No host predicate, readback, zero-horizon shortcut, additional shader binding, or standalone shader change is used. The query-config buffer is writable only in the direct owner pass, and storage-read wherever it is also an indirect source.

There remain **26 encoded compute commands: 1 direct and 25 indirect** (20 single-workgroup phases and 5 roster phases). An inactive candidate executes zero workgroups in all 25 heavy phases. This is not a reduction in encoded dispatch count or a hardware performance claim. The indirect adapter accepts only counts 1 and the immutable 3/4-body roster with unit y/z, rejecting any new dispatch shape.

Original state/dense are copied unconditionally. The public impact state is overwritten by the owner (including the existing reason 97 owner-rejection marker), and entry, response, proof and departure-descriptor buffers are cleared so inactive bank reuse exposes no stale event or diagnostic packet. Successful active outputs and failure statuses retain the original numerical semantics. There are 14 buffer clears, and the extended config adds 24 bytes: 70,848 bytes for 3 bodies or 72,192 bytes for 4 bodies, excluding caller inputs/pipelines. `dispatchConfigBuffer` exposes the 32-byte config for diagnostics; records start at byte offsets 8 and 20. Production execution does not read it back.

Gate checkpoint: CPU 27 passed / 6 native-only skips across the two component test files, including the emitted-command audit for both roster sizes and unknown-shape rejection; typecheck passed. Sequential bounded native tests passed 2/2: 9 finite-CLEAR cases / 4,608 exact words, plus 9 reused-bank transitions / 14,328 exact words. The reuse sequence covers active impact/departure, inactive REST/live/budget/other-pending states, mismatched owner, reactivation, and active deadline refusal. All active impact/entry/response/proof/descriptor words matched CPU; inactive public diagnostics were zero and GPU dispatch records had zero heavy workgroups. Source hashes matched before/after. Native elapsed 170.057s, sampled 1055.18MiB under 1500MiB; SwiftShader software Vulkan only. Full-world journal equivalence is qualified separately by the owning world integration test.
