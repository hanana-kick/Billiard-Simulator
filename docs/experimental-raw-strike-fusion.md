# Opt-in raw strike adjacent-stage fusion

`experimental-raw-strike-fusion.mjs` is an execution-only experiment. The original
`createRawStrikeGPU` implementation and production defaults are unchanged.

It extracts the existing `cloth_advance` and `clearance_post` stage entry bodies,
renames only their entry signatures, and invokes both sequentially from one
candidate invocation. Their original storage loads/stores, checked arithmetic,
private error handling, scratch flags, early returns and step-budget decisions
are retained verbatim. The rest of the stage graph is unchanged. Matching shared
headers and the exact six-stage graph are required; unexpected source shape
throws rather than guessing a transformation.

Every invocation accesses its own128-word output and32-word scratch row. There
is no cross-candidate storage, workgroup communication, atomics, or changed
candidate ordering. Same-invocation program order makes the first body's stores
available to the second body's loads. If the first body marks the candidate
finished or unsupported, the second body's original scratch guard returns just
as it did in the next dispatch. Clearance still consumes the pre-step poses
written by `clearance_pre`, not reconstructed endpoints.

Five pipelines replace six, and three dispatches replace four per allowed step:
`2 + 3*maximumSteps`, hence12,290 instead of16,386 at4096. No step is omitted and
no host physics/readback is introduced. Candidate finalization remains at the
same physical clock. This is not full four-stage fusion or a multi-step loop;
it avoids restoring the whole original monolithic compiler footprint.

## Checks

`node --test tests/experimental-raw-strike-fusion.mjs` verifies:

- Original stage bodies are unchanged except their entry signatures.
- Expanding each fused host command into its original two commands reproduces
  the original uploads, bindings, dispatch widths and sequence exactly.
- Native opt-in tests compare every128 words against both the original GPU bank
  and CPU, including mixed statuses/budgets,33-lane boundaries, translated scene
  origins and blocked clearance.
- Native timing separately records compilation, host encoding, encoder finish,
  and submission-to-map for N1/32/1024. Single timing samples are exploratory,
  order/cache-sensitive, and not statistically established speedup estimates.

Use the exclusive native lock with a time/RSS watchdog. SwiftShader measurements
are software Vulkan evidence, not physical GPU performance. The experimental
bank is not wired into raw-world/manual/forecast/search or adopted as the default.

## Measured result: do not promote on dispatch count alone

Bounded local native run:1,156 cases,147,968 words identical to both original GPU
and CPU. Fused compile8.580s vs original8.208s in the same process; this is not an
independent cold-cache comparison. Total run61.86s; aggregate RSS504.20MiB,
maximum-child RSS464.34MiB.

Single-sample submission-to-map times (original→fused):

- N1:1,752.0→1,769.7ms.
- N32:1,691.7→1,811.7ms.
- N1024:10,501.1→10,502.2ms.

Host encode atN1024 decreased79.2→49.8ms, but there is **no demonstrated device
execution improvement**. The sample does not justify promoting this variant.
Reducing dispatch count by25% is not equivalent to reducing total work or elapsed
time by25%; compiler lowering, invocation work and memory behavior still matter.
Original defaults remain unchanged.
