# Prepared rolling-world chronology refinement

This is an opt-in canonical-reference query over the complete supported rolling/rest roster. It refines the conservative whole-tail AABB rejection; it is **not** an impact packet, and `collisionAdmitted` is always false. Original K/S and all original anchors remain unchanged. It does not project arbitrary post-impact states into directional scalars or pretend that general sliding/flight is rolling.

## Actual blocked fixture

The recurring fixture at absolute191,678 ticks reports broadphase pair13. That is **not a real collision**: ball1's straight rolling path is0.1314467878m transversely away from stationary ball3, more than the0.0614999533m diameter. Ball0's nearby stationary ball2 is also missed. Refined query clears the complete4,521,411-tick tail using76 geometric nodes, including every pair, four actual finite cushion bounds for each ball, eleven remaining source static bounds for each ball, and finite cloth support. A perturbed target placed on ball1's path remains UNCLEARED; it must be admitted separately before any impulse.

## Proof and limits

Every rolling component is monotone through its analytic stop. The union of outward position intervals at interval endpoints therefore encloses that body's entire path on the interval, including its stop. Relative pair separation uses the difference of the two individual interval boxes, not an unjustified monotonic-relative-motion assumption. A floor square-root of minimum per-axis separations must exceed the sum of radii. Hull/static exclusion uses sphere-expanded actual finite AABBs; overlap is unresolved, never collision. Cloth checks its finite footprint; vertical support is the declared rolling-family premise.

Each geometric task uses bounded left-first interval subdivision, no fixed trajectory stepping. Cleared closed intervals form a contiguous prefix. A one-tick unresolved interval is `UNCLEARED`; node exhaustion is incomplete. Neither is a TOI or collision. Every competitor record remains available; equal lower times are not resolved by array order. Scalar tangent/normal-spin stop brackets are recorded separately. Those analytic transitions do not invalidate a complete clear-tail proof, but a later response adapter must explicitly handle or refuse any earlier/overlapping mode boundary.

The complete scene/ball roster is a prepared producer obligation. Four distinct canonical hull assets and every supplied static box are validated, but an arbitrary caller cannot prove it omitted no collider by choosing a provenance string. Runtime integration must bind the original immutable source roster.

Incoming physical radii are preserved in source descriptors but **not** inflated into this canonical-reference query. It is not a global propagated physical certificate. Strict carried uncertainty queries require their own inflation/profile; no endpoint reference result may be relabeled as strict-family clearance.

## Compiler-safe cache, not new dynamics

`deterministic-rolling-bounds.mjs` prepares32words/body once, caching original radius/K/p/v, directed speed bounds and scalar stop brackets. Its compact point evaluator uses the same directed rolling position formulas as the full partial descriptor without computing unused endpoint q/rho/packing metadata at every DFS node. The512-case fixed-seed test checks exact endpoint-position and stop-word equivalence against the full partial evaluator when that evaluator accepts. Geometry may remain valid when unrelated endpoint state-packing admission would fail; a response still must use the full endpoint evaluator and refuse that failure.

The first monolithic query, which repeatedly embedded the128-word partial evaluator, terminated during native compilation at40.9s with no parity result. The two-stage cache repair changed no budgets, chronology proof or source forces. Native retry passed3/3,3cases/3,168 words exactly, compile1.595s, suite1.983s. The60s time bound completed without a stop. The initial40.06MiB RSS figure is WITHDRAWN: the first watchdog inspected only main-thread child lists and missed worker-spawned descendants. The corrected final resource receipt below uses PPid ancestry. No failed run is counted as parity evidence.

## API / resident ABI

`runRollingPairWorldCPU(rows,scene,{horizonTicks,maxNodes})`, `createRollingPairWorldGPU(device,scene)` use existing rolling32 rows and immutable tail scene176. Horizon1..scene cap≤64s; maxNodes1..1024 per task; aggregate geometric nodes capped32,768. Up to4bodies/20finite boxes yields at most90geometric+8scalar records. DFS stack32 exceeds the maximum28 required for the64s Q20 horizon.

Two resident dispatches, zero intermediate readback:
1. `ROLLING_BOUNDS_PREPARE_WGSL`: binding0rows,1cache32/body; workgroup1, dispatch body count.
2. `ROLLING_PAIR_WORLD_WGSL`: binding0rows,1scene,2config `[horizon,maxNodes]`,3output1056,4cache; one invocation.

Private config horizon0 returns before output initialization, preserving the previous receipt for inactive recurring iterations. Public validation rejects horizon0. Scene/rows are owned snapshots before awaits; shared mutable buffers are rejected.

Output1056: header32, then at most128 eight-word records. Header0version,1status(1all geometric clear/5budget/6uncleared),2horizon,4earliest geometric record,5/6earliest bounds,7totalnodes,8recordcount,9geometriccount,10earliest scalar record,11minimum geometric clear prefix. Records: `[kind,bodyA,bodyB/obstacle,status,lo,hi,nodes,clearPrefix]`; kind1pair,2hull,3static,4cloth,5scalar. Scalar clipped upper endpoints are diagnostics, not a claim that a root occurred before the requested horizon.

Scalar-cap correction: a finite lower stop bound with `NONE` upper (upper interval beyond64s) remains uncertain when lower≤h. For integer vXZ=(18,1),K=1, the speed interval gives stop[63s,66.5s]; the64s query must retain[63s,64s] as a clipped uncertain scalar diagnostic, not call it clear. A regression places a genuine later pair near63.5s and verifies this unresolved regime blocks response. This does not change the actual4.49475s clear-tail fixture.

Scalar-cap regression native receipt:4/4 query tests,4 cases/4,224 words exact, compile1.583s. Combined with pair-entry9-case parity:12/12 tests,19,488 words exact,14.31s; 90s time bound completed; the original RSS coverage for that run was incomplete and is withdrawn. Compact cache and entry metadata were independently reviewed; scalar-cap edge was independently confirmed before correction.

Final corrected-resource verification (unchanged query/entry physics):13/13 tests, no skips; query4 cases/4,224 exact words plus entry9 cases/15,264 exact words. Total10.510s. PPid-status-table ancestry watchdog measured sampled aggregate681.59MiB and maximum child644.13MiB separately, within unchanged90s/1200MiB caps. The previous~40MiB resource figures are not valid aggregate-memory evidence.
