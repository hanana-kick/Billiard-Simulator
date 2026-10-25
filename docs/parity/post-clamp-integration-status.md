# Isolated post-clamp integration

This branch is not the validated active-TOI checkpoint or the product backend.
The positive post-clamp path has now passed one actual constructor-only original-shot boundary on CPU and native SwiftShader WGSL, through four subsequent application steps. This is not general whole-shot support.

The bounded original sphere domain has zero local COM, unlocked axes, identity
collider parent transforms, and unchanged local mass. After a certified post-solve
TOI, the owner now copies only the interpolated next translation/rotation and
recomputes the source-ordered world inverse inertia using the same backend.
It does not change physical velocity, warm-start contacts, force, activation, or
CCD velocity. The existing journal then receives the clamped poses and updates
both collision channels' proxy bounds. Remaining internal passes keep their
source timing and transaction rollback.

Pinned Rapier b716d375efc0201003f0cd9ef7168eee0b62c177:
- dynamics/ccd/ccd_solver.rs, apply_clamps: next_position only.
- pipeline/physics_pipeline/substep.rs, advance_to_final_positions: position,
  collider propagation/AABBs, then world mass properties.
- dynamics/rigid_body_components.rs, update_world_mass_properties.
- Parry 0.31.1 mass_properties.rs, world_inv_inertia.

The new operation retains the existing Apache-2.0 source attribution and
Rapier/Parry/glam notices. Its four captured native tensor comparisons pass on CPU and actual native
SwiftShader WGSL with exact f32 patterns. Six component checks pass and all
66 created buffers are destroyed. The positive-clamp replay result below is separate from these component checks.
The elevation35 h389 case has two actual TOI intervals but no post-clamp and must
not be counted as a positive-clamp test. The fixed elevation60 original capture
also found no clamp across all 768 ordinary post-cue steps (h193–h960).
Both genuine two-pass boundaries h384/h430 were negative. This exhaustive
fixed-input negative result does not establish positive-clamp integration.


## Positive constructor-yaw world result

The fixed source-derived yaw 2.0743270562430363°, elevation35, tipX0.25 and speed10 uses the unchanged constructor ball layout and real cue clearance. No ball setters run. Original maxCcdSubsteps4, materials, forces and cue equations remain unchanged. Its h389 post-solve clamp fraction is 0.8679085969924927. The late first impact makes the original minimum-time rule retain one full interval, rather than the earlier two-pass case.

`positive-clamp-world-replay.cjs` independently recreates the original elapsed-zero snapshot, supplies only that created state to the candidate, and compares every application h through393. Future native states are assertions only. CPU and actual native SwiftShader WGSL both reproduce all three balls' positions, rotations and linear/angular velocities with maximum error0. At each boundary385–393 the full represented graph, adjacency, collider registry, proxies and the represented numerical values (132 at most checked boundaries; 180 at h390–391) have maximum error0. The 220–223-value boundary checks include inertia, forces, floor caches, complete island manager, modification queue and application events; their maximum1.630640666938632e-8 difference is the existing JS-double compliant-tip event position. Six unrepresented graph cache fields remain explicitly outside the comparison.

A separate CPU-owner rollback test throws after the real positive clamp and proxy updates but before publication, twice. The public state remains identical to h388, then retry reaches the same original h393 boundary. It never substitutes physical values. Solid clamping adds no fake contact event; the original later narrow phase controls events.

The source diagnostics compare instrumented/unobserved/independent native execution byte-for-byte. Native versus original WASM retains four signed-zero differences, so no cross-engine byte-identical claim is made. The source fixture is discovery-derived, not an independent holdout. The legal-placement witness is also retained but is not used to broaden the world initializer's constructor-only contract.

Still unsupported: live-cue CCD and joint reslicing, order-dependent or multiple uncertified TOI targets, larger coupled simultaneous contacts and arbitrary full-shot recurrence. The public product backend is unchanged. Hardware GPU speed and Samsung device behavior are not established by native software execution.

Final validation of runtime revision 78120e5: both CPU and actual software-WGSL
created-only positive-clamp replay passed; the targeted contract, rollback and
mass-component suite passed9/9 without skips. Product regression passed308/308
without skips, followed by successful type checking, build and official24-component
UI provenance checking. The previous nine complete-shot regression source-hash
records were compared with this tree: all955 checked entries still match. Those
old-owner results are retained as unchanged-dependency evidence, not relabeled as
nine complete shots through the new CCD owner.
