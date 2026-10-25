# Experimental initial dynamic contacts and island sleep

This extends the bounded original-physics world experiment. It does not replace the production Rapier engine, enable a general GPU gameplay backend, or establish universal CPU/GPU equivalence. The original physics, controller and scoring sources remain unchanged.

## Initial state ownership

The initial-only exporter copies retained sphere-pair contacts from the byte-verified original created snapshot. It preserves native endpoint orientation, collider generations, parent bodies, dense graph positions, directional adjacency, manifold and point presence, impulses, warm starts, recycling references, material channels, solver colors, hints and GraphPos ownership. Empty retained pairs are not treated as absent, and default expansion does not mutate the raw original cache.

Each of the six sphere-pair owners receives its actual source cache. Initial cushion contacts continue to use their original owners. No later expected snapshot is accepted as a recurrence input or used to repair a candidate frame.

The existing all-sleeping initial origin remains protected. A distinct motionless-awake origin requires an observed accepted original controller fire and its actual `anyMotion() === false` result. Its body identities, activation and velocities are checked against the same initial bytes. The original thresholds remain 0.002 m/s and 0.05 rad/s for awake bodies. This origin preserves the original island allocator, body IDs, queues and caches rather than forcing sleep or wake.

## Coupled sleep completion

Narrow-phase geometry and deferred wake precede source island observation. The common owner then uses the actual observed island membership and contact roster to select the surviving awake bodies. They are integrated once through the common numerical solver. A sleeping component receives a transaction-bound completion receipt without numerical integration.

Only a genuine source `sleptBodies` transition zeros velocities. Already-sleeping bodies keep their existing state. Contact points, impulses, recycling state and colors are retained. Solver-graph reconciliation clears contact selection and GraphPos as the original engine does; it does not erase cached solver body IDs. Skipped or recycled zero-manifold pairs remain zero-manifold pairs.

A narrowly verified deferred-wake path preserves a retained active pair that remains unselected for that pass: both endpoints were asleep at entry, both are now awake, geometry was not refreshed, and the authoritative count-cleared hint/GraphPos/contact roster proves non-selection. This is not permission to omit an arbitrary constraint.

All completion receipts are bound to owner, backend, graph transaction and CCD pass. Failed final preflight rolls back the whole world transaction.

## Validation fixtures

- Legal original controller moves create a retained cue-ball/red-ball contact before a default shot. The original pair wakes with its island, receives positive impulse during live cue contact, separates and eventually reaches full physical rest at h6275. Its original result is score 0 and next cue 2.
- A second legal layout uses the original UI allowance to fire when the balls are motionless but still awake. A retained red/red contact naturally sleeps as one island at h922 while the cue sphere continues moving. h923 and h924 verify persistent dormant caches and count-cleared hints. This deliberately bounded observation is not a completed shot.

The oracle is captured independently from unchanged original controller operations. Future snapshots are assertion-only. Numerical tolerances are fixed before replay; graph identities, event ordering, allocator/solver metadata and scoring are checked separately. Actual Dawn Vulkan SwiftShader execution tests WGSL, not hardware GPU performance. Isolated ownership tests labelled with a backend name are not substitutes for these real WGSL runs.

## Measured replay results

The initial cue/red retained-contact shot matches unchanged original physics through all 6,275 physical steps on both the CPU port and actual Dawn Vulkan SwiftShader WGSL. Maximum observed absolute numerical difference is 3.335045350993937e-9, within the predeclared field-specific tolerances. Each backend passes 22 native checkpoints and nine injected final-preflight rollback/retry checks, then reaches the original physical rest and score/next-cue result.

The motionless-awake red/red retained-contact case matches through h924 on both backends, including the h922 coupled sleep transition and two following dormant-cache passes. It passes nine native checkpoints and eight rollback/retry checks per backend with the same maximum numerical difference. This case is intentionally not a whole-shot result.

One initial full GPU process terminated with exit 137 after h1536 without a comparison failure; the cause was not established. A test-only reference adapter then reduced duplicated oracle storage from 100,565,372 to 42,838,669 bytes. Preparation verifies the complete original artifact and proves all retained values and 1,032,867 ordered comparison assertions unchanged. No physics, tolerance, frame, contact or scoring comparison was removed. The subsequent full GPU run completed normally.

The preserved regression witnesses also pass on both the CPU and actual WGSL backends: the prior simultaneous-pair path, initial cushion/pair path, four-ball active CCD and rollback, and three-ball multiple-TOI path. The late-opponent four-ball foul witness passes all 5,415 steps through physical rest: score -1 and turn switch to cue 2, 34 native checkpoints, nine rollback checks and maximum observed difference 2.6770281880139635e-8. Backend-filtered tests deliberately execute each physical backend in its own serial process; an opposite-backend test skip is not counted as a pass.

The production regression command passes 308 tests with zero failures or skips, alongside build, TypeScript checks and provenance verification for 24 official UI components. The original production physics, controller, game-rules and Rapier file hashes are unchanged. These are local experimental results, not a production release.

## Remaining boundaries

Modified sleeping geometry, generic multimanifold/overflow groups, some simultaneous new cushion topologies, floor-contact loss/rebirth and live-cue active CCD remain outside the admitted general domain. The default runtime still uses original Rapier. Passing these fixed original cases does not prove every user input, every contact topology, hardware acceleration, or a complete GPU search backend.
