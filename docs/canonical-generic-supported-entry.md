# Initially supported full-vector PW1 entry

The canonical-local world runner accepts an initially supported SLIP roster directly into the existing shared-clock SMT2, qualified qt-neighborhood and slip-stop prefixes. It preserves all position, velocity and q=Rω components and roster IDs. State word 50 marks this initial-supported route. There is no directional reconstruction, forced rolling projection, host physics, or intermediate GPU readback.

Initial FLIGHT remains explicitly unresolved (reason 82). Whole-prefix geometry exclusion remains mandatory. A possible new pair/hull event is pending, not a committed collision or MISS. This change does not provide a general event router, gameplay score, global physical enclosure, or production runtime migration.

The GPU schedule reserves the existing first pair/mixed stages for the rolling-entry route and bypasses them for initial support. A GPU-side prefix budget gate prevents extra scheduled slots from granting extra work. The generic route consumes one component work item per supported prefix; the final clear rolling tail is terminal completion. Original elapsed-time deadline guards are unchanged. These component caps do not certify cumulative request work/event budgets.

## Verification

2026-10-27: 9/9 native tests passed with Vulkan SwiftShader (software, not hardware speed). Eighteen continuation cases compared 13,824 returned words exactly; the initializer separately compared 3,072 words. Original rolling clear and genuine pair→landing→qt fixtures retain their final clocks. The new non-collinear generic fixture reaches model REST in eleven supported prefixes, at tick 928,016 from initial tick 191,678, with zero invented pair or landing events. Work caps 1/2, deadline exhaustion, unsupported initial flight, normal-spin retention and cancellation are exercised.

Native compilation: 21.051 seconds; full test process: 33.935 seconds. Sampled aggregate descendant RSS 1078.60 MiB; maximum child RSS 1041.45 MiB. These are process metrics, not GPU allocation or VRAM measurements. Application buffers for a four-body continuation: 84,872 bytes.

## Owned raw-input integration and journals

The request-owned continuation engine now exposes `runRaw(batch)`; CPU fallback is `runCanonicalRawWorldContinuationCPU(binding, batch)`. It accepts one owned raw batch matching the exact request, scene, identity keys, original starting tick and original deadline. The GPU raw bank feeds PW1 directly into the resident world initializer, without CPU state reconstruction or intermediate readback. Unsupported/budget raw handoffs return `continuation: null`, with their original handoff status.

The resident journal records each actual pair and cloth-landing commit at its producer seam, followed by full-roster model REST or an explicit incomplete terminator. A guarded raw-origin prefix is attached only inside the owned raw chain. The rule reducer runs after the final journal on the GPU, before the final diagnostic readback. It has contact coverage only, not kiss-interval coverage. Unsupported route facts cannot become a successful route. Arbitrary standalone PW1 continuation journals do not acquire raw-shot origin authority.

The default-material fixture (yaw 35 degrees, elevation 25 degrees, speed 0.5, tip X 0.2, tip Y 0) uses the actual compliant strike and full four-body roster. It reaches REST at tick 4,504,515 from original tick 1,234, after ten supported prefixes. It has no ball contacts; its complete gameplay result is score 0 (MISS), not a manufactured scoring success. Native final-source verification compared all 1,892 words: world 768, journal 1,056, raw handoff 16 and rule state/result 52. The compact result is `[100, 2, 1, 0]`. The failed raw-input control returns no continuation. This is one bounded complete shot, not all raw parameter combinations or a production release.

The final raw→world→journal→rules native test passed on SwiftShader in 44.908 seconds including compilation; sampled aggregate RSS 1088.35 MiB and maximum child RSS 1059.28 MiB. World/journal/rule allocation was 93,152 bytes, explicitly excluding the upstream raw producer's own allocation. There were zero intermediate readbacks and zero host physics phases. This does not measure physical GPU throughput.

## Adversarial tail correction

A new supported→rolling obstruction fixture exposed CPU-only preparation of an uncommitted collision response. The CPU now runs only the same chronological query as the GPU when the bounded consumer cannot yet commit that next collision. It neither exports hypothetical impulse diagnostics nor applies them. The pending event returns 7/46; a one-node query budget returns 5/46. The obsolete bridge mask is cleared on entry to the tail query on both backends.

The combined final world/clock/journal run passed 15/15 native tests in 97.878 seconds. Twenty world cases compared 15,360 state/diagnostic words and 21,120 journal words exactly, including both obstruction controls. Initializer and request-clock tests also passed. This run preceded the final raw approach proof guard; the actual raw chain was separately rerun against that final source as stated above.
