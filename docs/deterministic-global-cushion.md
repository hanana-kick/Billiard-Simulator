# Bounded global finite-cushion selection

`deterministic-global-cushion.mjs` is a **prepared exact encoded polynomial** component, not a complete billiards integrator. It does not accept smooth uncertainty tubes. Declaring polynomial coefficients is not proof that those coefficients obey the source friction laws; a canonical producer must establish that separately. Runtime defaults are unchanged.

## Resident pipeline

One candidate contains 1–4 complete moving or stationary bodies, each with Q24 position/velocity/acceleration and full q/q-rate. All share one Q20 horizon (1..65535). Four immutable actual finite hull assets are required. The test fixture packs all four `src/physics.js` cushion meshes and all eleven remaining source static AABBs (cloth slab handled separately). No four-plane cushion replacement.

Sixteen dispatches, zero intermediate readbacks:

1. Four hull time queries and four admission passes, each covering **every** body.
2. One exclusion pass: all unordered sphere pairs; each body's cloth/support ownership; all supplied scalar boundaries; each body against every remaining static AABB.
3. One deterministic global selector.
4. Gate all unselected admissions off; four static response passes (only the selected body/hull may enter response).
5. Merge selected result and preserve the complete common-clock state.

The host packs/validates inputs and immutable assets; it does not calculate per-candidate physics for the GPU path. CPU execution is an independent reference orchestration of the same integer decisions. Scene/config are copied before asynchronous setup; candidate buffers are copied synchronously before upload. SharedArrayBuffer inputs are rejected, including nonzero-offset views correctly handled.

## Conservative chronology

Pair exclusions use directed relative quadratic coordinate ranges and exact u64 squared-distance lower bounds. They isolate the first **uncleared** interval, not a certified pair collision. Cloth exclusions require either strictly clear continuous vertical gap or constant supported height and a wholly inside finite support footprint. Scalar inputs are signed nonzero values plus linear rates; the interval must retain its initial strict sign. AABB exclusions use continuous coordinate bounds enlarged by sphere radius, so they can conservatively refuse near non-box geometry but cannot certify penetration as clear.

Every exclusion uses bounded left-first DFS, not trajectory sampling. Unknown leaves and exhausted budgets remain blockers. Every hull contributes its actual point/time/admission proof, including initially invalid/inside states. A hull may be selected only if its admission is certified and **every other** non-clear hull or exclusion has lower time strictly greater than the selected upper time. Equality also blocks: no arbitrary tie ordering, no choosing a later proved hit over an earlier uncertainty. All records are retained, so a future pair/boundary integration can consume their identities and uncertainty honestly rather than treating them as solved roots.

If no hull can be selected, every body is advanced only to the minimum certified clear prefix, and the result is pending. This is a diagnostic prefix state, not permission to continue through its boundary. If selected, every body advances from its own original anchor to the same upper tick. Only the selected body's six v/q components are replaced by the true one-body/static response. A numerical response success still returns **status 8, continuation pending**, not complete physical acceptance. No general post-cushion friction law, rule event, rest, or whole-shot success is claimed. Failed response results are diagnostic and never applied.

## Bounds and ABI

`packGlobalCushionCandidate` requires profile `prepared-exact-polynomial-v1`, `bodies:[{motion,state}]`, explicit `boundaries` and `staticBounds`. A complete source roster is a caller obligation: this module cannot discover omitted objects from bytes. Each motion and state uses the existing cushion ABI. Response material is common per body's cushion policy in this slice; heterogeneous hull materials need an explicit material mapping before broader use.

Limits are 192 words: version `0x47430101`, body count, common horizon, exclusion node cap, scalar count, static-box count; word6 preparation veto (0normal/1refuse), words7..15 zero; up to8 scalar records `(body,kind,value,rate)` at16 (kind1 or2 diagnostic); up to16 outward-encoded static boxes `(xmin,xmax,ymin,ymax,zmin,zmax)` at48; unused words zero. Static bounds may extend to ±8m to include the actual source floor; moving centers retain ±4m domain. At most32768 total allowed hull-query nodes and32768 exclusion nodes per invocation. Exclusion cap1..1024 per task; defaults256. Exhaustion never increases these caps silently. Response caps remain the static component's explicit choices.

Exclusion records have8 words: kind (2pair,3cloth/support,4scalar,5static), bodyA, bodyB or source index, status (2clear,6uncleared,5budget), lower, upper, nodes, clearPrefix. A hull record uses kind1 and hull index. Scalar lower/upper includes directed quantization uncertainty; not necessarily the minimal exact linear root bracket.

Output state256 words:

- 0version,1status (6pending /8response merged but continuation pending),2reason (0selected,1blocked/no eligible hull,2response failed),3body count.
- 4common tick,5minimum clear prefix,6selected body orNONE,7selected hull orNONE,8horizon.
- 9blocking class,10blocking record/index (first deterministic blocker, not necessarily earliest),11candidate hull-major index,12selection certified,13response status,14response reason;15zero.
- 16..23 earliest uncleared record in the8-word format, diagnostic deterministic tie only; **all** concurrent records remain available separately.
- 24..31reserved; body records32+i*32: ID, p3,v3,q3, responseApplied; offsets11..13 original A,14..16 original qRate,17radius,18mass,19original canonical mode,20..28 original p/v/q anchors,29coefficientsDirty/currentModeUnknown (1after response),30current mode (0/3 before response, NONE afterward),31zero. Words11..16 and19 are exclusively SOURCE ANCHOR coefficients/mode associated with anchors20..28, never current post-impact mode. Word29 explicitly marks them dirty for the current state after response. They are NOT admitted post-response laws. Unused output words zero.

Returns full `time`, `admission`, `records`, selected128-word `response`, and `state`. `physicalAcceptance:false`, `continuationPending:true` are unconditional. Upper representative point/normal quantization/error semantics and penetration/solver residual budgets remain exactly those in `deterministic-cushion-response.md`; no exact-root impulse accuracy claim.

## Tests

`tests/deterministic-global-cushion.mjs` checks the actual source roster; isolated nose; analytically earlier pair; another moving ball's earlier opposite cushion; corner uncertainty; scalar preemption; remaining-static preemption; common-clock nonselected advancement; identity/profile/shared-buffer/offset guards. GPU parity covers every returned word with no intermediate readback. Independent analytic pair and scalar times are checked, not merely CPU/GPU self-consistency.

## Checkpoint receipt

- Native Vulkan software WebGPU: **3/3 pass**, 11 candidate scenarios, **15,280 returned words exactly equal** CPU/GPU; 6.54s pipeline compile, 7.83s whole suite. Includes a four-body roster, simultaneous certified hull tie, early exhausted exclusion budget, later boundary acceptance, equal-time boundary refusal, and offset-buffer mutation during asynchronous execution.
- Every run uses16 dispatches and0 intermediate readbacks. Shader sizes9503/11147/6406/6650/438/11817/557 bytes.
- Dependency CPU regression:14 pass,5 native skips across point/time/admission/response/global tests. A final independent analytic finite nose-edge assertion was added after the native receipt and passed CPU; no runtime/shader changed afterward.
- Reviewer independently closed conservative ordering/range/ownership and the pre-narrowing exclusion-budget guard. The first native attempt hit a WGSL predicate parsing ambiguity, fixed with explicit parentheses before successful parity; it produced no runtime result.

Next smallest integration: bind this declared-polynomial input and scalar boundary list to a canonical supported intrinsic-motion producer, preserving its provenance and invariant limits; separately attach a certified pair response only after the pair's currently uncleared interval is rigorously admitted. Smooth tubes require inflated pair/hull/static clearance and cannot reuse this exact-polynomial certificate.
