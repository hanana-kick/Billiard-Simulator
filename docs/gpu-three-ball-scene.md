# Original three-ball same-world progression

## Verified original default shot

The same experimental owner now advances the original default three-ball shot from the strike-created state through cue removal, ball-ball impact, four cushion encounters, deferred island splitting and final native sleep. The scalar implementation and actual software-WebGPU implementation both pass the full-horizon test, with no skipped GPU test.

The initial condition retains all three original ball placements, all 16 original static colliders, the constructor's 72 native settling steps, and the original centered strike at angle 0, elevation 8 degrees and speed 2. It is the snapshot immediately after strike creation, before the first strike simulation substep. There is no additional settling, ball removal, pose change or hidden native first-strike step.

Both backends complete 6,316 internal substeps and 5,875 application steps, covering `6.1197916666664` seconds. The largest error in the full-horizon test's compared numerical fields is zero. Every completed application step compares all three bodies and application contact events against the unchanged original native baseline. Fifty-eight predetermined raw checkpoints additionally compare the serialized activation manager, allocators, queues, body IDs and flags, activation timers, complete dense contact graph and directional adjacency, live fat proxies, and represented floor, pair and cushion contact caches.

Only after the cue is absent, all three original bodies are asleep and no awake chunk remains does the test finish the shot. The unchanged `ThreeBallGame` class receives only the candidate's accumulated contact events and produces the same result as the native baseline: `{cueId: 1, delta: 0, nextCue: 2}`. No expected score is used as candidate input.

This result establishes one original default shot through rest and its miss-to-next-cue-2 outcome. It is not general three-ball/four-ball engine equivalence, successful-score coverage, universal bit identity or complete internal-cache serialization.

## Owned state and source ordering

`experimental-three-ball-world.js` creates one owner from the initial condition. Its `step()` accepts no external state. Native later snapshots are assertion data only: no pose, velocity, impulse, timer, island, warm start or contact cache is injected into the recurrent candidate.

The owner composes the source-created cue transaction, all three ball-floor components, coupled ball-ball and cloth solving, four independently retained cushion caches, source activation and manager bookkeeping, enabled-but-inactive CCD checks, and the original application angular-patch law. Original sleep and CCD descriptors remain unchanged.

Source user changes and body removal precede broad-phase preparation. A source-owned cue broad phase derives the initial two inactive cue edges from the original BVH insertion/traversal order. A separate recurring geometric guard proves that rigid cue contacts do not require an unimplemented solver. Narrow geometric transitions precede the common activation pass. Numerical solving and the application angular law precede publication of the next owned state.

Cue joint arithmetic is speculatively evaluated before the common activation scan but committed only after every phase accepts. This is admitted only for the disconnected, awake, zero-force cue component. Activation observes its own pre-solve poses and velocities, not the speculative joint result.

The owner supplies its own active-body order and poses to pre/post broad-phase work. One shared generation-bearing graph journal publishes the complete contact graph. A sealed transaction synchronizes every numerical phase, including dormant phases; private phase graphs are checked projections, not competing authorities. The journal commits before its borrowed cue-broad receipt is retired. All transaction preconditions are checked before commit, and failures abort pending state.

At substep 440, the cue's three colliders and two inactive edges are removed in source order. The graph changes from 25 to 22 live colliders without resetting the ball state or graph authority. Fine substeps 441–448 retain the original `1/61440`-second schedule; substep 449 starts ordinary `1/960` progression. The host application interval remains distinct from its float32 engine input.

The first coupled dynamic pair begins at completed application step 383 and ends at 385. Its two bodies share one contact solve, while the third advances on the same clock. Cloth-bucket order follows the owned dense graph rather than a newly sorted body order. The third ball sleeps at step 481. The first front-cushion contact begins at 1339 and ends at 1342; subsequent original cushion encounters continue with the same owned caches. Application callbacks use the still-unincremented outer step counter, so their recorded step labels are one less than these completed-step numbers. Event speed uses the original JavaScript `Math.hypot` operation.

## Sleep, split and allocator behavior

`experimental-scene-activation.js` preserves native chunk and persistent-island allocators, body order, IDs, modification queues, source thresholds and timers. Energy and effective-force arithmetic share scalar and actual WGSL expressions. Manager indices and counters remain exact host u32 values, not float-packed values.

Same-island contact removal uses the source current-speed farthest-point metric, not a substitute speed threshold or the stillness timer. When both endpoints are hot, it increments the removed-constraint count without inventing an immediate persistent-island split. The original pair death leaves dirty count 1.

At step 4947, yellow's timer reaches `0.5000030994415283` and nominates persistent island 0. The next pipeline call, 4948, consumes that pending nomination before energy observation: white retains island 0, yellow receives island 1, and the retained island cooldown becomes 5476 from pre-scan stamp 5460. Yellow sleeps in that same call. White sleeps at 5875.

The structural split follows source union-by-size and first-root tie rules, descending swap-removal of contact links, then joint links, then bodies, and separate persistent/active free stacks. Global splitting does not itself change active chunk order or epoch. Dirty singletons may nominate a split; whole-island sleep cancels its pending nomination. Sleeping bodies are not reintegrated or given the application angular law until a supported source wake transition.

Sleep reports the required pair-hint count clearing, force-event selection removal and solver-graph invalidation to the contact owner. Reporting these effects does not certify bytes of omitted native workspaces.

## Evidence and fixed criteria

The full-horizon test is `tests/experimental-three-ball-shared-graph-rest.cjs`. It passes two tests without skips, one scalar/native and one actual-WGSL/native. Loaded participating source bytes are checked against disk at completion. The independently captured native traces verify their initial snapshot, source provenance and payload digests before reuse.

The 58 raw checkpoint steps are 380–400, 480–484, 1336–1346, 1527–1531, 1703–1707, 3224–3228, 4946–4949 and 5874–5875. Overlapping checkpoints from independent continuous native captures must have identical snapshot hashes. These snapshots are assertion-only, not alternate starting states.

The fixed numerical criteria are:

- Body position and rotation: `1e-6`.
- Body linear/angular velocity, force and inverse inertia: `3e-6`.
- Contact caches, fat proxies and activation pose history: `2e-6`.
- Serialized manager structure, allocators, generation-bearing IDs, flags, scalar activation state, queues, graph order, adjacency, feature/contact IDs, activity flags and solver colors: exact where represented.
- Application contact endpoint identities, ordering and event times: exact.

Zero measured residual in the full-horizon observations is not a universal bitwise-equality claim. Earlier complete-graph 450-substep coverage compares every fine substep's three-ball and live-cue physical observations and events, plus twelve raw checkpoints. Both backends passed with maximum residual `2.815995547855721e-9`. That finer cue-body result remains distinct from the full-rest test's outer-step and selected-cache observations; the latter does not claim every microstep's cue joint-cache serialization.

Additional complete-graph gates passed eight initial substeps, 925 substeps through the first pair and third sleep, and 1,787 substeps through the first cushion. The prefix's scalar maximum is zero and WGSL maximum is `1.0579449157400588e-37`. The 925- and 1,787-substep compared fields have zero maximum error. These independent gates preserve their own sampling scopes rather than substituting for the full-rest evidence.

## Prepared-stage evidence is separate

Four initial prepared floor/activation tests retain the original three-ball setup and compare the first native substep's numerical floor components and entire serialized manager. Scalar and actual WGSL numerical residuals are zero. That prepared test does not compose the cue's own joint evolution and is not by itself a complete first-strike step.

Six prepared split/sleep tests use an uninterrupted original native run at steps 384–386, 4946–4949 and 5874–5875. The activation stage owns its manager, timers and allocators recurrently across those bounded windows, while physical pre-solve states and application-call receipts are prepared oracle inputs. Those tests are phase evidence, not an owned numerical world trajectory. The full-horizon test above separately supplies the owned trajectory evidence for this original shot.

A bounded local-search port exists for at most three joint-free rigid members. It requires the complete owned post-narrow directional adjacency and source body-collider order. Synthetic source-order tests cover fixed-contact link migration, but an independent native local-detach comparison has not been established. That branch is not included in accepted native recurrent-world coverage.

## Remaining boundaries

- Only the specified original default shot and miss-to-next-cue-2 result are established. Arbitrary settings, other layouts, four-ball play and successful scoring require their own evidence.
- Active CCD, general sleep/wake propagation, general joint/soft/multibody island splitting, arbitrary removal and scan/cooldown overflow remain unsupported.
- The contact solver admits the selected dynamic pair with its two cloth contacts, or the supported sphere/cloth/cushion component with at most two active cushions. Unsupported simultaneously coupled constraints reject explicitly.
- New post-insertion cue pair births and unmodeled rigid cue contacts fail explicitly. The narrow exclusion guard is not used to pretend inactive broad edges are absent.
- A same-frame old-family deletion/new-family birth can conservatively reject before phase handoff when an old private cache still marks the prior family present. This is an availability boundary, not a substituted independent solve; the verified default shot does not hit it.
- Full evolving BVH workspace, skipped native solver/joint workspaces and every manifold field are not serialized or compared. Cushion checkpoint comparisons exclude per-phase solver body offsets, graph positions, tangent velocity and unrepresented recycle rotations. Exact represented graph/feature/state claims do not extend to those fields.
- Production CPU physics is unchanged. These experimental stages are not a blanket product GPU-capability declaration.

## Reproduction and source attribution

The test requires the pinned Rapier snapshot decoder, an actual WebGPU implementation, the original elapsed-zero creation record, the unchanged full-shot baseline, and the verified pair, cushion and split replay artifacts. Set `RAPIER_SNAPSHOT_DECODER`, `GPU_NATIVE_MODULE`, `THREE_BALL_CREATION_V8`, `THREE_BALL_FULL_TRACE`, `THREE_BALL_PAIR_REPLAY`, `THREE_BALL_CUSHION_REPLAY` and `THREE_BALL_SPLIT_REPLAY` to the corresponding local inputs. Set `REQUIRE_WEBGPU=1` and run:

```sh
node --test --test-concurrency=1 tests/experimental-three-ball-shared-graph-rest.cjs
```

The native oracle uses unchanged `PhysicsLab` and the original `ThreeBallGame`; the candidate never receives a later expected state. Source authority is Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`, particularly island-manager, user-change, contact-graph and physics-pipeline phases, with Parry 0.31.1 geometry. Apache-2.0 attribution is retained in source and `vendor/RAPIER-LICENSE.txt`.
