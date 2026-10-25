# Bounded complete multi-TOI ordering certificate

The first stage below is the conservative fallback without an owned BVH. The
later owned-traversal extension is now integrated into the bounded world; see
`multi-toi-world-integration.md` for its independent CPU/WGSL world evidence.
Original PhysicsLab and the public product backend remain unchanged.

## Initial conservative stage

For multiple initially positive casts and at most four **complete** qualified
targets, the evaluator visits every sequential permutation. Every cast receives
the current tightened fraction, exactly as in the original sweep reducer. Queries
that initially did not hit are still retried at every reachable smaller bound.
Only one identical final fraction across all orders is admitted. Different winning
collider identities at the same fraction are reported as such, not guessed.

This works because the admitted fixed-sphere context has no sensors, pseudo hits,
nonzero local COM, evolving fixed target geometry, or solid-hit side effects
besides the final pose fraction. It is a conservative proof over a superset of
native traversal orders. Taking the minimum of independently computed casts
would not be the same proof, because conservative-advancement failures and
bounds can alter subsequent answers.

The four-target limit is a proof-domain/resource bound, not truncation of the
candidate list and not a sampled shot-input budget. A larger complete set with
multiple positive hits stays explicitly unsupported. Ambiguous order outcomes
also fail closed. Existing no-hit and single-hit certificates retain their prior
behavior. Per-query memoization reuses exact same-index/same-fraction evaluations
without dropping any sequential path.

## Validation status

Eight lightweight protocol and original-single-target tests pass. Mock-cast
protocol tests prove all6/all24 order coverage, initially non-hitting targets,
divergent-order rejection, equal-fraction identity ambiguity, and no truncation.
These mocks are not physics or WGSL parity evidence. A real source-derived corner
fixture and actual native/software-WGSL validation are pending.

Pinned sources: Rapier b716d375, dynamics/ccd/sweeps.rs accept-hit and sequential
body-collider/BVH loops; Parry0.31.1 partitioning/bvh/bvh_traverse.rs. Existing
Apache-2.0 source attribution remains applicable.

## Actual corner witness

The single source-derived constructor yaw12.905686665770533 at elevation35,
speed10 and tipX.25 produces two positive cushions at h396. This is an
engine-accepted input, not the current manual UI speed range (maximum5).
`multi-toi-original-source-witness.json` retains native front→right traversal
and both original-bound and independent-full-bound answers. Their fractions
differ, so the new complete-order proof correctly still rejects this case.

Actual native SwiftShader WGSL matches all12 native casts' fractions, statuses,
points and normals. Both pre/post order certificates match CPU and reject the
observed divergent final fractions. Eleven protocol/native-evidence/software-GPU
tests pass without skips. This verifies the exact cast math and safe rejection,
not support for the corner world. At that stage recurrent original BVH ordering was still required; hardcoding
front-before-right would not implement it. The extension below supplies it.

## Owned recurrent traversal extension

The optional fixed-sphere context now accepts a current owned BVH stage, not a
raw order array. Its branded query receipt binds bounds, backend, transaction,
and mutation epoch. Sequential casts consume every qualified pair in native
moving-collider and tree-leaf order, passing the winning fraction into each
subsequent Parry cast. The receipt is checked again after asynchronous work.
The existing conservative default is preserved for worlds without that stage.

The actual h1–396 source-operation component replay passes on CPU and actual
SwiftShader WGSL. Both return original pre-split fraction
0.9360221028327942 and post-solve fraction 0.9357571601867676, including every
incoming bound and result. Forged/stale receipts and incomplete moving identity
are rejected. This fixes the proven corner ordering discrepancy at component
level. Separate owned-world evidence is documented in
`multi-toi-world-integration.md`; neither proves all shots.

The order module is low-level: complete filtered pairs are a caller contract,
not inferred from unfiltered leaf IDs. FixedSphere owns that completeness by
building from its immutable full seed. It additionally binds the BVH creation
hash to its own seed. This bounded scene permits only original generation-zero
fixed leaves 0–15 and original ball channel pairs 16/17, 18/19, or 20/21 in that
order; forged generations or caller-swapped channel order are rejected.
