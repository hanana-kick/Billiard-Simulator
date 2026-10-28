# Qualified prepared-world pair entry → full3D response

This bounded adapter handles a **complete supported rolling/rest roster**, not arbitrary sliding or flight. It consumes original rolling32 anchors/K/S and the immutable actual finite-table scene, without repacking through directional scalar metadata. A declared equal-sphere mass and combined pair/cloth materials must match the originating scene. The actual recurring pair13 broadphase fixture is a miss and receives no impulse; tests perturb the real target onto the path to exercise a genuine event.

## Admission and chronology

The adapter recomputes the complete rolling-world ledger. A header/record marked UNCLEARED is not an event. It only considers an earliest pair record, then:

1. Requires the entire directed lower-point distance interval strictly outside the summed radii.
2. Extends the same uncleared interval's upper endpoint by bounded geometric widths1,2,4,…, at most the explicit1..256-tick cap (default64). It never skips the unresolved lower interval. Requires the **entire** upper-point distance interval strictly inside the sphere sum; nominal midpoint overlap alone is insufficient.
3. Bounds maximum upper penetration by `Rsum-distanceLower`, at most the explicit overlap allowance (default64 Q24 quanta, at mostR/8).
4. Rejects if **any** other pair/hull/static/cloth or scalar-boundary record is unresolved/budget-limited with lower≤selected upper. Ties block; array order is not contact arbitration. A finite scalar lower with unknown upper beyond64s also blocks.
5. Bounds each body's whole bracket from its monotone component endpoints, subtracts these individual boxes, and encloses relative velocity similarly. Directed upper `relativePosition·relativeVelocity < -approachMargin` proves strictly decreasing separation across the bracket. This does not assume relative motion components are monotone.

Together these prove an entering root in the retained bracket for the encoded analytic reference family. The response convention is **chosen upper time**: all bodies advance to that common tick, with their independently bounded midpoint p/v/q. The original full3D contact solver receives the actual two centers and all six velocity/spin components, including normal spin. It uses real midpoint contact arms, two true dynamic homogeneous spheres, and the two genuine supported cloth contacts. No fictitious body or lost qy is introduced.

Upper-time packing/error intervals and root bracket/penetration are explicit diagnostics; the impulse is the canonical response at that upper representative, not a claim that its v/q exactly equals the continuum root state. No global physical error propagation through the impulse is asserted.

## State and receipts

All-body common-time state remains resident. Successful selected-body response changes all v/q components, sets modeUNKNOWN and dirty, and explicitly invalidates its current physical motion receipt. Retained radius fields on that body are **pre-impact history**, not reusable post-impulse uncertainty. Unselected bodies retain their valid local advancement receipt. Failed admission preserves original anchors and incoming errors; failed solver preserves the advanced pending state. Continuation must rebuild the response bodies' motion from their actual v/q, not reuse prior rolling K coefficients as a certified post-impact mode.

The return always has `physicalAcceptance:false`, `postImpactReceiptValid:false`, `continuationPending:true`. Query geometry is canonical-reference clearance, not an inflated global incoming-family certificate. Incoming radii are neither silently dropped nor relabeled as valid after response.

## API / ABI

`packRollingPairEntryConfig(material)` requires provenance `immutable-equal-sphere-pair-cloth-material`, mass(0,4], restitution/friction[0,1], extension1..256, overlap1..4096 and≤R/8, approach margin1..256, solver iterations1..256, residual budget16..1024. Position/velocity/spin limits remain those of the prepared rolling family and shared exact v8/q16 norm domain. Raw controls are checked before typed narrowing.

`runRollingPairEntryCPU(rows,scene,queryOptions,material)` and `createRollingPairEntryGPU(device,scene,material).run(rows,queryOptions)` return:
- `query`: complete1056-word competing ledger;
- `entry`:128 words, header `[version,status,pairA,pairB,lo,hi,reason,proofMask,penetration,approachUpper]`; admitted status1/proofMask31, otherwise6;
- `contactRows`: actual64-word full3D solver input, zero when admission refused;
- `advanced`/`state`:160-word all-body state;
- `response`:128-word solver receipt, zero when no impulse was authorized;
- `sourceRows`: unchanged original prepared descriptors.

State header:0version,1status(6unadvanced pending/1advanced/8response pending continuation/7solver pending),2common upper tick,3body count,4solver status. Body at16+i*32:0ID,1..3p,4..6v,7..9q,10R,11mass,12current mode,13dirty,14localMotionReceiptValid,16..22planar source/advancement radii,23joint rho. Selected applied response has12=NONE,13=1,14=0; its radii remain only labeled history. The common clock is not overwritten by solver status.

Reason2all geometry clear;3query budget;4not earliest pair;5sphere/material allowance;6invalid endpoint;7lower not strictly clear;8no admitted upper within cap;9penetration;10competitor/mode;11arithmetic;12not strictly approaching. Uncertainty always refuses impulse.

## Resident stages and resources

Six dispatches, no intermediate readback or per-candidate host physics:
1. Compact rolling cache preparation.
2. Whole-world bounded query.
3. At most40 independent analytic endpoint evaluations (4 bodies × lower plus at most9 geometric extension endpoints). Each invocation calls the existing partial evaluator once; this is bounded root refinement, not uniform trajectory stepping.
4. Entry qualification, common-state assembly and actual contact-row construction.
5. Unmodified canonical full3D contact solver.
6. Response merge and receipt invalidation.

The full partial evaluator is not nested inside an adaptive geometry loop. New private phase exports are `ROLLING_PAIR_SAMPLE_WGSL`, `ROLLING_PAIR_ENTRY_WGSL`, `ROLLING_PAIR_MERGE_WGSL`; existing query/cache/contact exports are reused. Standalone factories synchronously snapshot scene/material and candidate rows before awaits. Byte-offset views and mutation-during-setup/run are tested. Unsupported mixed modes, initial unresolved contacts, ambiguous corners, and competing earlier boundaries remain pending.

## Independent tests

Tests cover the actual false-positive miss; genuine oblique entering root and independent analytic circle/rolling root; zero-friction equal-mass restitution/zero torque; retained normal spin; earlier pair/hull/scalar and simultaneous pair tie; low extension/node budget refusal; nonzero incoming receipt preservation; and the63..64s unknown-upper stop boundary versus a real63.5s pair. CPU/GPU parity covers the complete competing ledger, entry, actual solver rows, all-body advance, response and final state—not just a success bit.

Pair fields2/3 are roster **slots**, not invented physical IDs. Their immutable IDs are `state[16+slot*32]` (also retained in `sourceRows[slot*32]`); an explicit nontrivial-ID regression verifies this mapping. Consumers must report those IDs in their event stream, not reinterpret slot numbers as identities.

Final checkpoint evidence: entry9/9 tests, nine GPU fixtures/15,264 exact words (two explicit extension-cap configurations), including offset and scene/material/row snapshot mutation. Together with query regression:13/13, no skips,19,488 exact words,10.510s. Corrected PPid-ancestry watchdog: sampled aggregate681.59MiB, maximum child644.13MiB, no stop under90s/1200MiB. Earlier v1-watchdog~40MiB figures are withdrawn because worker-spawned descendants were missed. Independent reviewer closed the compact cache, entry chronology, receipt invalidation, common-clock metadata and saturated scalar-boundary guard.

Clock2 is relative to the supplied original anchor. A recurring producer adds it to its retained absolute common clock exactly once; this adapter does not reset or infer an absolute timeline. The six-stage standalone runner assumes an active prepared world. A resident recurring integration must gate event emission by its active generation and rebuild dirty response motion; repeated dispatch of a retained receipt is not a new event.
