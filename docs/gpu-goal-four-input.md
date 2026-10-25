# Placed four-ball first-shot input adapters

These test-only adapters describe a distinct original-controller origin. They
are not runtime admission factories, product integration, or a CPU/GPU parity
claim. The original numerical engine, source runtime, frozen settled-second-turn
adapters, licenses, and attribution remain unchanged.

## Exact numerical boundary

The numerical input is exactly:

```js
{
  goalStrikeCreated: record.boundaries.goalStrikeCreated,
  strikeCreationJournal: record.strikeCreationJournal
}
```

The caller must first load and verify a complete, decoded source artifact with
`tests/four-ball-goal-artifact.cjs` from the goal-capture branch. Raw probe files
are not candidate-ready. The independent source capture must retain its original
boundary name, full snapshot, and genuine thirteen-call creation/mutator journal.
The creation phase is `goalStrikeCreation`, not `secondStrikeCreation`.

The original controller has moved four existing balls with `move`, allowed them
to reach native sleep, then fired the first shot with unchanged default manual
settings. Admission requires:

- Application shots = 1; selected source object ID = 1 and registry index = 0.
- Source application steps > 0 and native steps = 72 + application steps.
- Finite nonzero source absolute time, equal to the new cue's start time.
- Local h count, outer step, and outer substep all zero at `goalStrikeCreated`.
- Four registered sleeping original spheres, four exact retained cloth caches,
  sixteen statics, twenty-four existing BVH leaves, and three newly created cue
  bodies/colliders with their actual handles and generation values.
- Exact source snapshot SHA256, byte length, lossless typed re-encoding, and both
  native-bincode and JavaScript typed-tree byte-identity verification.

The typed initial tree supplies allocator holes, free-stack order, manager state,
body registration IDs, modified queues, broad-phase integer topology, proxies,
contact caches, and creation joints. Convenience copies of the state, bodies,
colliders, proxies, and contact pairs must match that tree. Numeric cue-body
initialization inputs are projected only from initial source descriptors and
collider attachments. The adapters do not initialize a native world, restore a
snapshot, decode new native data, advance physics, or run a GPU.

The selected ID is resolved through the exact source registry. It is never used
as an array index. Initial absolute time and source application-step count are
retained; local recurrence elapsed time starts at zero.

## Distinct origin contracts

| Component | Contract |
| --- | --- |
| Created flag | `originalPlacedGoalFourBallCreation: true` |
| Initialization kind | `original-placed-goal-four-ball-initialization-component-seed` |
| Broad kind | `source-created-placed-goal-four-ball-cue-broad-phase` |
| Broad phase | `original-placed-goal-four-created-before-first-h` |
| Contact graph kind | `original-placed-goal-four-ball-cue-contact-graph` |
| World kind | `original-placed-goal-four-ball-created-world` |
| Pair kind | `original-placed-goal-four-ball-two-body-contact-phase` |
| Environment contract | `original-controller-placed-goal-four-ball-layout` |

Source-created and broad records also retain source shots, selected ID/index,
application steps/time, and native-step count for later explicit runtime
admission. No existing settled-second-turn or fresh-fourth factory is called or
relabeled. Future runtime factories may reuse numerical arithmetic only after
validating this separate origin.

## Optional nonnumerical placement provenance

After the source artifact loader verifies the complete record:

```js
const provenance = GoalWorld.placementProvenanceFromRecord(record);
const seed = GoalWorld.exportInitialSeed(input, provenance);
```

The second argument is optional metadata, not another numerical source. It is
stored only under the returned world's `provenance.placement` and has:

- Kind `source-artifact-derived-placement-provenance` and `numericalInput: false`.
- Boundary `goalStrikeCreated` and the same initial snapshot SHA256.
- The four actual observed `LabController.move` records, including accepted
  results and before/after body samples.
- The actual placement API journal and its recomputed tagged canonical SHA256.

The metadata validator checks the four source body identities, actual
`setTranslation` arguments, accepted move samples, and the source's complete
32-call placement sequence at native step 72. It does not reconstruct a move
record from desired layout coordinates. The helper reads neither `record.input`
nor before-strike/future numerical boundaries, expected frames, score, or outcome.
Its record argument is required to have passed the artifact loader; this helper
is not an alternative source-authenticity verifier. Omitted metadata is explicitly
reported as `placementProvenanceIncluded: false` and claims no movement provenance.
Initialization and broad exporters still accept only the exact two-key numerical
input.

## Deliberate fail-closed geometry limits

Every one of the four native graph edges and contact-pair caches must be the
exact floor-to-primary-sphere pair. Six pair owners are created with genuinely
absent pair caches and empty original pair-channel adjacency. Sixteen dormant
ball/cushion owners retain the source rail geometry and static proxies.

Any retained cushion or dynamic-pair cache, including an inactive retained cache,
is rejected. Such a layout needs an explicit cache importer; the adapters never
discard it and replace it with dormant state. There is no fresh fourth-ball
cloth-birth stage. First-h, before-strike, second-shot, rest, and other future
snapshots can never seed these adapters.

## Verification status

Syntax checks and six light source/validation contracts pass with
`node --test tests/goal-four-input-contract.cjs`. The light harness deliberately
makes native and numerical dependencies inaccessible, so it can run in a clean
worktree without ignored vendor binaries. It checks real pure validation
functions and source contracts, not a successful numerical export.

No native capture, native decoder execution, numerical first-h comparison, full
shot, GPU dispatch, browser, or hardware verification was run in this adapter
worktree. Full-artifact export admission and later runtime CPU/GPU comparisons
remain coordinator-serialized work. The presence of a successful original
positive/late-foul fixture does not establish candidate parity.

## Subsequent genuine runtime acceptance

The separate runtime factories and complete original positive/late-foul CPU and
actual WGSL comparisons are now recorded in
[`gpu-goal-four-world.md`](gpu-goal-four-world.md). The historical light-only
results above describe the original adapter commit, not the later full proof.
