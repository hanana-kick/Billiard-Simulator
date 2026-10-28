# Resident 3D contact in the certified axial motion path

Opt in with `createQRecurrenceGPU(device,{rules:true,contact3D:true})` and matching run option `contact3D:true`. CPU `runQRecurrenceCPU` uses the same run option. The explicit existing `clothRestitution` run option supplies the separate floor material. Production defaults and the previous planar contact path are unchanged.

The profile is **`full3d-contact-planar-motion-v1`**. It replaces both initial and subsequent pair impulse solves, not event prediction or free-motion equations. The existing event builders still prove the selected bracket, upper-time state, other-pair/static clearance, equal radius/mass, actual cloth geometry, and supported axial input regime. They do not admit general-angle or side-spin trajectories.

## Resident phases

After the existing certified contact builder, a private adapter packs actual positions, linear velocities, q, equal radius/mass and combined materials into the new full-3D contact ABI. Absolute y is restored from the actual cloth top and the builder's relative y, and z comes from the immutable declared scene; neither is invented as zero. The full-3D solver then computes all velocity/spin components. A final adapter maps a response back to the scalar motion ABI **only if vz, qx and qy are exactly zero for both selected bodies**. Its tangent coefficients use the actual deterministic bases: pair normal +X gives t1=+Z,t2=−Y; floor normal +Y gives t1=−Z,t2=−X. No q→omega→q conversion occurs.

Unsupported ranges, unresolved impacts and nonplanar responses remain non-results. No velocity or spin component is cleared to make a response fit. Offending components are retained with the full response; existing motion-admission guards still handle vertical separation, residual cloth impulses and other regime constraints. Positive results require the actual rule/physical completion path, not merely solver convergence.

All phases use resident storage buffers, with no intermediate readback or host-derived physics. The CPU mirror executes the same packing/arithmetic and response-admission ordering. Shader input rows generated internally use an inactive sentinel that exits before arithmetic; external raw 3D rows still pass the strict public validator. The private bridge is not an arbitrary raw-contact API.

## Full response diagnostics

`diagnostics:true` adds `contact3DHistory`: 128 words per candidate containing the **last attempted active contact response**, not a complete journal. Its vA/qA/vB/qB components are unchanged from the actual 3D solver. Additional reserved fields carry:
- 69: first offending response component index, or zero.
- 70: adapter version `0x33444201`.
- 72..77: actual input pA/pB, 78 radius, 79 mass.
- 80..81: the event builder's lower/upper clock bracket.

The original solver status/reason/residual remain in words 1/2/4. A nonplanar response has scalar-admission status 4/reason 12; the response history preserves the full solved state instead of projecting it. The q state remains explicitly unsupported, not a claim of continued 3D motion. The separate side-spin test uses a genuine prepared 3D impact and verifies this boundary; it does **not** claim that the axial event producer supports that side-spin input.

Normal rule-enabled calls still read only the 16-byte combined verdict. Diagnostic output is 1392 bytes per candidate with rules, or 1248 without rules; additional resident buffers are required regardless of diagnostic readback. Fixed phase/dispatch overhead remains and no performance improvement is claimed.

## Ownership and cancellation

The recurrence captures the original AbortSignal synchronously and reuses it before/after queued work, so replacing `options.signal` cannot hide cancellation. Aborted calls publish nothing. SharedArrayBuffer-backed candidate/scene/rule inputs are rejected in this API, as are shared standalone 3D contact rows. Ordinary inputs must be owned and unchanged for the synchronous validation/upload portion; there is no await between validation and upload. Pipeline factory setup accepts no caller scene buffer.

## Tests

The prepared draw fixture executes initial plus two subsequent 3D impacts, then landings/scalar changes to actual rest and a valid two-target result. Every final q/statistics/rules/verdict/history word is compared CPU/GPU across 35 candidates, including cross-workgroup dispatch. Tests also cover compact/no-rule output layouts, genuine side-spin refusal with complete response retained, SharedArrayBuffer rejection and replacement-signal cancellation. Separate contact tests continue to supply independent physical invariants. Raw cue, arbitrary-angle motion, general airborne pair prediction and cushions remain unimplemented here.

Checkpoint: final sequential native manifest **59/59 passed in 42.92 s**, including point/time cushion geometry suites (geometry remains independently scoped). The 35-candidate 3D-contact chain compared **12,180 words exactly** across q state, work, rules, verdicts and last 3D response, with zero intermediate readbacks. The prepared draw chain reaches rest after 95 response/observation attempts and two subsequent pair solves in addition to the initial impact. Recorded full-rule diagnostic buffers total **196,608 bytes**, readback **48,720 bytes**; default compact readback remains **560 bytes** for 35 candidates. Receipt compile **5.77 s**, submit/completion **182.51 ms** on SwiftShader; these are software-backend diagnostic costs, not a speedup claim. The no-rule layout and replacement-signal abort were also tested natively.
