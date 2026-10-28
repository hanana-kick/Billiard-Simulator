# Canonical intrinsic preparation → global finite cushions

`deterministic-intrinsic-cushion.mjs` binds the global selector to the **existing** `prepareDirectionalCPU` / `DIRECTIONAL_PREPARE_WGSL`. It adds no force law. Input is one original 96-word directional candidate (3 or4 spheres), the immutable resident source-material scene, four actual encoded hulls, and explicit source-combined cushion material/error/work policy. Caller-supplied polynomial coefficients, q vectors, normal spin, cached collision certificates or smooth tubes are not this input interface.

The existing preparer alone derives normalized direction, mode, V/C/A/D, p/v/q, acceleration and q-rate from intrinsic state and the scene's normal load, patch cap, cloth friction and rolling length. Conversion copies those words directly. It derives two scalar guards per body from `(V−C,A−D)` and either `(V,A)` for rolling or `(C,D)` otherwise. Exactly zero initial scalars are inactive, matching the preparer's own boundary semantics; inactive entries use constant positive unit placeholders, not invented roots. All finite cloth and remaining static bounds are copied from the same immutable scene. Cushion restitution/friction are separately explicit combined material, not silently substituted pair coefficients. Normal load and patch cap remain those of the existing producer.

This is still a bounded supported-intrinsic family, **not** a generic post-impact motion adapter. All bodies, including rest bodies, are retained. A failed canonical preparation vetoes selection at time0; its raw source rows and prepared diagnostics remain available. Placeholder zero-motion buffers in this rejected case are diagnostics only, not a physically accepted state. Source scene/response/config/hulls are copied before the first await; run copies the offset-aware candidate before async upload. Shared backing stores are rejected.

## Exact canonical rolling advancement

The small shared `deterministic-canonical-spin.mjs` has explicit modes0 (generic polynomial) and3 (canonical rolling). Mode3 is never inferred from approximate equalities. Before use its anchor and rate identities must hold exactly:

- vy=Ay=qy=qRateY=0
- qx=vz, qz=−vx
- qRateX=Az, qRateZ=−Ax.

Body state word24 carries the mode;25..31 stay reserved. The adapter derives it only from canonical preparation mode3. Generic public polynomial packing defaults to0, preserving prior arithmetic. Global common-time advance and selected static response both call the same reconstruction rule **after** signed time rounding: `qx=vz`, `qz=−vx`, `qy=0`. Independent floor evaluation of opposite signed expressions otherwise differs by one quantum. This reconstruction matches `advanceDirectionalCPU` exactly, including both signs; it is not zeroing arbitrary post-impact spin. After response all six v/q output components remain untouched. Global bodyword19 is exclusively the SOURCE ANCHOR mode paired with anchors20..28 and coefficients11..16, not a current mode. After response bodyword29 is explicitly1: coefficientsDirty/currentModeUnknown, and word30 current mode becomes NONE. The intrinsic entrypoint rejects responded global-state ABI/version rather than treating it as new source input. The retained source mode never admits rolling continuation.

The global factory exposes `encodePrepared` only as a low-level resident composition operation. It assumes its producer has already established buffer shape/ranges and must not be presented as an unvalidated public physics entry point. The adapter validates the original source inputs and uses the existing GPU preparer; all final uncertainty/competition gates are still in the global selector. A preparation-veto word at global limits6 can only disable selection; normal generic input leaves it0. Scalar-rate range extends to±96 Q24 to cover A−D (A≤16,D≤64) without narrowing. Other resource caps are unchanged.

## GPU ownership and outputs

18 resident dispatches: canonical prepare, word conversion, then the existing16 global query/admit/exclude/select/gate/respond/merge dispatches. No per-candidate host physics and no intermediate readback. CPU is the matching reference. Output includes source rows, full canonical prepared state, converted motion/state/limit words, every exclusion/admission diagnostic, common-clock state and selected response.

`physicalAcceptance:false` and `continuationPending:true` remain unconditional. A selected response uses the documented bounded upper representative, not an exact-root impulse. No whole-shot acceptance or generic continuation is introduced. In particular a future event loop may **not reset** incoming smooth trajectory uncertainty, contact representative error, penetration allowance or solver residual to zero. This adapter accepts only its original intrinsic family; an uncertainty-bearing continuation requires a distinct envelope-aware interface and inflated geometry.

## Tests

`tests/deterministic-intrinsic-cushion.mjs` uses all four actual source hulls and eleven other static bounds. Fixtures cover sliding nose response, canonical rolling in both directions, angled rolling uncertainty, derived spin-zero boundary preemption and earlier pair uncertainty. Assertions compare every copied coefficient and every advanced/pre-response p/v/q word with the existing preparer/advancer, plus independent source-friction acceleration and quadratic finite nose-edge chronology. The signed-rounding fixture observes the actual one-quantum discrepancy and its exact correction. Invalid mode values and one-quantum broken rolling identities reject, as do raw reserved words, shared memory, multiple candidates and wrong source provenance. GPU checks every returned word, offset views and input/scene mutation during async setup/run.

## Checkpoint receipts

- Canonical binding native: **3/3 pass**, **7 scenarios /25,648 words exact CPU/GPU**, including preparation veto and offset/mutation checks;9.27s compile in the final run.18 dispatches,0 intermediate readbacks.
- Same final run: existing global selector3/3,11 scenarios/15,280 words exact, with explicit post-response UNKNOWN/dirty metadata. Combined6/6 in21.96s.
- Existing static-response native3/3 separately passed17 scenarios/2,176 words exact after the shared rolling helper change. Its two new raw-mode host-rejection assertions were added afterward (no shader/runtime change); CPU mode guards pass and the next native manifest exercises those assertions.
- CPU combined regression6 pass/3 native skips across response/global/intrinsic. Reviewer independently checked coefficient/boundary ownership, rolling identities, preparation veto and conservative selection.

The next event-loop integration must reclassify the complete response v/q with UNKNOWN current mode, preserve diagnostic point/normal/penetration/residual uncertainty, and provide a justified propagation envelope before generic continuation. Neither current source-history coefficients nor this exact-polynomial selector may be reused as a zero-error smooth continuation.
