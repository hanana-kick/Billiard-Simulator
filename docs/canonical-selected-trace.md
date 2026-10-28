# Selected source trace SST1 (experimental, not app-wired)

This opt-in component captures **one** selected/manual/forecast candidate. It does
not alter ordinary 16-byte/candidate results, physics, shader numeric bodies,
execution defaults, or public contract stubs. It is not a restart checkpoint.

## Compact bounded format

Each 2048-u32 record contains a 32-word header (version, source kind, absolute
Q20 start/end clocks, roster count, source length, event kind/bracket/resolution),
two 40-word complete roster states (ID + Q24 p/v/q, ten words per body), then up
to 1936 original source words. qy is retained; IDs are arbitrary u32 and remain
in source slot order. Maximum 512 records = 4 MiB numeric payload. Exact canonical
identity is separate metadata. Snapshot export explicitly allocates owned copies.
Overflow marks capture incomplete and leaves the final four result words unchanged.
It never discards old records to pretend the whole trajectory is available.

## Minimal producer API

`createCanonicalSelectedShotCapture(request, candidate, options)` validates the
canonical request/candidate and binds identity/full roster. The lower-level
`createSelectedShotTraceCapture` accepts trace-request metadata and is **not** an
admission authority. `captureAccepted({startTick,endTick,sourceKind,sourceWords,
startState,endState,event})` owns copies. `finish(compactResult)` seals capture.
`selectedTraceWorldBoundary` extracts full p/v/q from an accepted world state.
`sampleSelectedShotTrace` returns exact source/boundary, explicit unsupported,
or unavailable status, never a reconstructed path. Presentation interpolation
is not implemented and must not be confused with these integer source samples.

MMQ1 and MMQ2 versions are distinguished and validated, never relabeled. Original
SMT2 polynomial, ballistic, rest, and rolling-recipe samplers are reused directly.
Source source-clock, roster and horizon remain original (a prefix does not shorten
the polynomial denominator). At an event, interior bracket samples are unavailable;
post-impact endpoint uses the producer's corrected state, including impulses.
Unresolved events have no usable post-impact endpoint. Exact contiguous clocks
and boundary states are required across records. Export mutations cannot affect
sampling. Epoch/cancellation checks around awaits remain the caller's obligation.

## Capture points, not final-state reconstruction

Capture descriptors **before** prefix/impact routines overwrite their buffers.
Current world producer uses MMQ1: supported-prefix preparation and cushion route
own the original descriptor rows. Cushion impact and departure are separate
records, not one interpolated jump. Resident dispatch 51 prepares descriptors;
impactStateBuffer and final state are distinct. Keep the original pre-state in a
separate source snapshot before mutation. `createSelectedTraceResidentWriter`
enqueues three buffer copies (before state, corrected after state, original rows)
in the same encoder; the old source must still exist when the copies execute.
Its 832-word staging slots cost at most 1,703,936 bytes. If both staging and expanded
SST1 records are retained, their bounds add; neither allocation is per candidate.
No CPU mapping occurs during capture. Snapshot readback/hydration is not wired.

## Explicit remaining gaps

Raw compliant-contact interior and microtail intra-flight/intra-fraction point
samplers remain explicitly unsupported. Their original source recipes and accepted
endpoints are retained; no path is invented. Slip/qt comparison-reference, original
rolling, and microtail rational boundary coverage are described below. `captureComplete` is bounded coverage, not physical acceptance;
`samplingComplete` additionally requires supported samplers and resolved events.
Neither flag is a gameplay verdict or global error certificate.

Actual raw GOAL96c947f / lateFOUL2db1090 **CPU source captures are established**
through the optional accepted-phase hook. GOAL uses 78 records / 638,976 bytes and
ends at tick 3343649 with `[100,1,0,1]`; late FOUL uses 100 records / 819,200 bytes
and ends at tick 3343645 with `[100,2,1,0xffffffff]`. Full final states and compact
results equal trace-disabled runs exactly. All source anchors, record seams,
original recipe endpoints and actual pair event counts/brackets are tested.
Raw input/scene/template are retained as an explicitly unsupported interior phase.
The CPU adapter is labeled CPU diagnostics and is never substituted for a GPU trace.
Resident world hooks/hydration and app wiring remain unimplemented. No Rapier
trajectory replay is used. The native resident COPY writer retains all 832 source
words exactly across later same-encoder mutation; this test used SwiftShader
software Vulkan, not physical GPU hardware.

Validation: selected-trace, bridge-trace, microtail-trace, selected-trace-raw and
selected-trace-resident tests. The resident test requires REQUIRE_WEBGPU=1.
World callback payloads are owned clones; cap exhaustion/callback failure stops
capture only, never physical evolution or the compact verdict.

## Additional original-source coverage

`canonical-bridge-trace.mjs` evaluates the retained qt/slip **K=0 comparison
reference**, not an invented real-K point trajectory. The distinction is in its
`bounded-source-reference` status and `referenceState` field (not canonical
`state`). Reference representatives never feed back into physics or scoring. Original acceleration/position interval recipes
and directed integer arithmetic are retained; endpoints match accepted words.
The slip norm's stop bracket stays unavailable. `canonical-bridge-phase-trace.mjs`
combines these explicit overrides with unchanged full-roster MMQ1/MMQ2 descriptors.
Bridge recipe IDs are original local slots, not rewritten stable IDs.
`canonical-rolling-trace.mjs` handles standalone tail recipes at their original
anchor and clocks, including the independent normal-spin stop.

`deterministic-microtail-trace.mjs` preserves original input, cloth, context,
accepted microtail/fraction words and each original quantized bounce endpoint.
Each bounce has exact rational time, full p/v/q, and retained tangential impulse.
It verifies the enumerated recurrence against accepted encoded outputs (508
configurations tested). The source has no defined intra-flight or intra-fraction
point trajectory, so those queries remain explicitly unsupported. This is not
permission to linearly interpolate through its composite impacts.

`canonical-selected-trace-cpu.mjs` consumes accepted-phase hooks, including separate
cushion impact and departure intervals. Its captureComplete flag is coverage only;
samplingComplete remains false for these actual raw shots because the raw interior
and microtail interior laws are not implemented. Original microtail per-bounce
rational boundaries remain available from retained source words.

Undefined microtail interior queries expose `bounded-source-interval`, the original
whole-composite swept position box (explicit loXYZ/hiXYZ ordering), and
`pointSampling: unsupported`, with no canonical point state. Integer common-clock
roster queries retain the other bodies as separate exact source samples alongside
that interval. No invented point representative is used for the composite.
