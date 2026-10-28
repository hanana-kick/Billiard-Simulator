# Original MMQ2 rolling stop endpoint adapter

Opt-in component only; not default/application routing or a release claim. A rolling translation or normal-spin stop is a change of regime, not a contact impulse and not a REST verdict.

## Ownership and admission

`runWorldRollingStopV2CPU` builds the complete original MMQ2 query; `commitWorldRollingStopV2CPU` consumes that producer-owned ledger. Resident GPU stages are original query, source/stop proof, original endpoint sampling, and endpoint commit. There are no intermediate CPU readbacks. The complete 80-word descriptor roster and 1056-word ledger include both authoritative stop records for every rolling body.

A pending clear/cushion state or active state must match the original descriptor identities, anchors, common clock, horizon, immutable cloth/footprint and rolling constants. All task identities and stop cache brackets are checked. The earliest candidate must be a stop; its **original**, positive upper endpoint must fit both source horizon and deadline. A clipped ledger upper endpoint cannot create an earlier stop.

Every object must be CLEAR for the full original horizon or have a valid lower bracket strictly later than the proposed endpoint with sufficient certified prefix. Equal/tied objects, budget exhaustion, malformed work counts and ambiguous overlapping stops reject without changing state or dense receipts. Multiple nonimpulse stops may be grouped only when their original upper endpoints have all ended by the chosen endpoint.

## Endpoint and bounded work

Every body is sampled from its original recipe at the same endpoint, retaining full position, velocity, spin and ordered error receipts. Rolling modes come from the original rolling sampler, including translation stopped with nonzero normal spin. Commit increments prefix/work counter 56, resets refinement counter 60, advances common clock and preserves all contact counters and impact records (21/45/61/62/63). It never asserts REST. Query work stays within the existing 32768-node aggregate bound; world integration must additionally charge its own iteration cap.

Dense error order is qx/qy/qz, whereas original rolling sample words 84/85/86 are qx/qz/qy. This adapter explicitly permutes the latter once. Arbitrary stable u32 IDs remain intact.

## Qualification status

CPU adversarial and positive coverage exists in `tests/deterministic-world-rolling-stop-v2.mjs`, including coexisting smooth/flight sources and a four-body high-bit-ID roster. Native software SwiftShader qualification passed 24 cases / 50,688 exact CPU/GPU words: complete query, proof, original endpoint samples, state and dense receipts. Compile 99.436 seconds; bounded elapsed 100.130 seconds; sampled aggregate RSS 1326.41 MiB under the unchanged 1500 MiB / 240 second limits. Production file hash matched before and after. No hardware throughput claim.

An initial shader reserved-word error was fixed; the following attempt hit the unchanged 1500 MiB watchdog limit at 1506.29 MiB after 31.226 seconds. Neither failed run is parity evidence. The qualified narrower proof kernel reuses exact original rolling-bounds stop arithmetic rather than resampling full rolling dynamics merely to obtain brackets. Original endpoint sampling remains a separate authoritative stage. This component qualification does not establish full-world rolling/cushion/release support.

## Source-guard compiler structure (2026-10-27)

The proof shader now accumulates source-binding predicates before entering exact
rolling-cache arithmetic, and accumulates cache comparisons outside per-body
loop exits. All original source, immutable material/footprint, identity, anchor,
reserved-word, budget and cached-bracket checks remain. Rejected sources still
produce the same reason-1 receipt. No physical formula, endpoint sampler, query
ledger, output ABI, work bound or acceptance tolerance changed. Independent
read-only source review found no dropped predicate or changed valid arithmetic.

The unchanged 24-case complete component regression again passed 50,688 exact
CPU/GPU words. In a separate SwiftShader run, compile time was 19.005 seconds,
bounded elapsed 19.655 seconds, sampled aggregate RSS 900.18 MiB (max child
865.28 MiB), compared with the earlier 99.436-second compile and 1326.41-MiB
aggregate observation. These are separate software-driver observations, not a
hardware speedup or full-world memory guarantee.

`tests/deterministic-world-rolling-stop-v2-proof.mjs` additionally checks the
accumulated-loop structure and 111 direct proof inputs (the original valid
source and 110 source/context/scene/cache mutations). Its isolated native proof
comparison passed all 3,552 words, including exact failure receipts; compile
0.393 seconds, elapsed 1.107 seconds, aggregate RSS 477.07 MiB. Direct dispatch
ensures malformed descriptors reach the shader rather than being rejected only
by host input validation. Native tests retained the 1500-MiB cap and used an
180-second execution bound. Full-world composition remains separately qualified.
