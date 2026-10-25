# Transactional cushion contact phase

The focused prepared-phase regression passes 3/3 tests: 64 recurrent frames independently evaluated by scalar and actual WGSL, each compared with the unchanged native world. Maximum absolute error is zero for all compared body, force, floor/cushion cache and activation fields. The lease/input-replacement sentinel confirms aborted transactions do not change committed caches. This is not yet a complete cue-to-rest or retained-three-ball world validation.

`experimental-cushion-contact-stage.js` borrows the exact geometry, fat-AABB and shared PGS arithmetic from `experimental-cushion-roster-world.js`. One external source owner retains the selected body's original `canSleep:true`, enabled CCD, activation history, modification queues, simulation clock and angular application law. This phase owns cushion caches and a generation-bearing contact-edge projection. It is not a standalone world or an oracle-fed stepping interface.

## Initialization

Factories are `createReferenceStage(seed, initialFlat)` and `createGpuStage(device, seed, initialFlat)`. The flat state is the existing selected sphere/cloth lifecycle schema. The seed contains:

- `kind: 'original-selected-cushion-contact-phase'`, `phase: 'post-world-step-post-application'`, `selectedSingleton: true`.
- Original generation-bearing `{index,generation}` handles: `ballBody`, `ballCollider`, `floorBody`, `floorCollider`.
- `globalEdges` in actual native dense edge order, each `{collider1,collider2,body1,body2,active}`. `selectedAdjacency` contains those global edge indices in the actual selected-primary-collider adjacency traversal order. The bounded phase requires that selected collider to be collider2 of every incident edge.
- Original `primaryMaterial:{groups,friction,restitution,frictionRule,restitutionRule,contactSkin}` and massless `pairChannel:{groups,mass}`.
- Two or four `cushions`, each with original branded native `hull`, `bodyHandle`, `colliderHandle`, `identityPose:true`, original `groups`, `frictionRule`, `restitutionRule`, zero `contactSkin`, fixed `proxy:{min,max}`, native `colliderFriction`/`colliderRestitution`, effective source-quantized Multiply `friction`/`restitution`, and its actual initial `cache`.
- Complete original `staticProxies`, each `{colliderHandle,bodyHandle,bodyType:'Fixed',groups,min,max}`, plus `originalStaticColliderCount`. Own GPU overlap with any untracked fixed collider is unsupported. The count is read from the initial source registry, not a guessed constant.

An absent native pair may start with source-default empty cache. An existing pair must preserve its original points, reporting/warm impulses, solver color, frozen anchors/levers and recycle reference. No cache, pose or ID may be fetched from a later native snapshot at a handoff.

## Atomic phases

The common owner calls `claim(privateToken)` once. It then calls:

1. `prepare(ownFlatState, sourceEvents, token)`: own broad-phase qualification, global edge append/swap-removal, full/recycled geometry and contact transitions. Returns the pending flat floor state, cushion records, contact/broad-phase events, global edges/adjacency and ordered persistent-manager operations.
2. The actual source activation/manager phase consumes these operations. `interaction-changed` uses weak wake on begin; active broad-phase deletion emits separate `interaction-strong-wake`. Fixed-contact links do not merge dynamic persistent components.
3. `solvePrepared(ownPreparedFlatState, token)`: requires actual source-awake and source-inactive-CCD phase markers; preserves every numerical body/integration input from geometry preparation. Solves cloth and all selected cushions against one velocity record and returns body, force, contact caches and post-body fat bounds.
4. The common owner completes post-solve CCD, original angular resistance and its manager/modified-queue writeback. Only after every owned phase succeeds does it call `assertPrepared(token)` and `commit(token)`. Any failure calls `abort(token)`; no partial cache state commits.

`sourceEvents.globalEdges` must be the common owner’s current complete graph and must match the last committed phase graph. In the unbound path, other-body graph mutation still fails explicitly. The bound path verifies its own broad proposal, then adopts the exact pending authoritative journal broad graph before resolving narrow edge IDs. This can transport remote append/delete and relocation without importing numerical caches. `sourceEvents.removedColliders` is a source-owned journal, not native future input. Removal with any incident contact edge currently fails explicitly because the full adjacency removal traversal is not implemented here. It may pass only when the complete carried graph proves there are no incident edges. The phase never fabricates ascending edge removal order.

## Boundaries

- Two or four admitted initial cushion hulls, at most two active simultaneously, continuous top-face cloth, one selected awake singleton. More than one new eligible admitted pair in a frame is unsupported; overlap with any other original static is also unsupported.
- Original full-scene other balls cannot be silently frozen. Their actual awake/sleep state and all interactions remain the common owner's responsibility; this phase does not establish that they are safely absent from integration.
- All generation-bearing identities and dense edge relocation operations survive. Every deletion emits `edge-removed {removedEdgeId,lastEdgeId}` even when removing the tail, so the owner can shrink the source link-location table. An additional `edge-relocated` identifies moved global graph references; it is not a second persistent-table removal. This is not a complete serialized broad phase, contact graph, solver graph or island-manager implementation.
- Timestep changes must occur at the actual outer-loop boundary. Both nested numerical parameters and the flat floor parameters use the same supplied native f32 dt; original application h remains a JS double owned by the application-law stage.
- Phase markers and branding identify an integration contract, not proof that arbitrary external code stayed on GPU. Only an independent full composed replay can establish that claim within a tested domain.

Source attribution and licenses follow `gpu-cushion-roster-world.md`: pinned Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`, Parry 0.31.1, with Apache-2.0, glam and libm notices retained.

## Focused verified trajectory

`tests/experimental-cushion-contact-stage.cjs` retains all 16 original fixed environment colliders, the selected ball and its original primary/massless pair channels. It explicitly removes the other two balls for this controlled phase test. Native `canSleep:true`, CCD enabled/max4, original material and angular laws remain unchanged. No activation thresholds are patched.

After 34 native preparation steps before any cushion collision, the one initial export starts a 64-frame trajectory containing actual positive right-cushion impact and separation. The application horizon is 0.06666666666666667 s; native f32 dt is 0.0010416667209938169 s, giving 0.06666667014360428 s. Preparation adds application 0.035416666666666666 s/native 0.03541666851378977 s and is disclosed rather than erased.

Both candidates evolve only their own prior state. Their source activation observation remains noneligible for sleep throughout; the test does not replace native manager sleep decisions. The source pre/post CCD stages remain inactive. Each frame then applies the original compensated angular law to its own cloth impulse and angular velocity. Native future snapshots are assertions only. Numeric gates remain `2e-6 * max(1, abs(native))`, and scalar/native success is required before GPU dispatch.

Global edge and operation transport is exercised through actual pair birth and contact transitions; full native island-manager serialization and multi-body activation are separate integration work. Preserve those limits when reusing this phase under a common scene owner.

### Constructor settling versus fixture preparation

The stated 34 fixture preparation steps follow the unchanged `PhysicsLab` constructor's 72 native settling steps. Thus constructor-to-export contains 106 native world steps in total: native f32 elapsed 0.11041667242534459 s (106 times the native dt), or 0.11041666666666666 s expressed using application h. No cushion collision occurs during either portion. The comparison horizon starts at the one exported seed; none of these earlier steps is counted as candidate recurrence. Constructor settling and directly invoked preparation steps do not advance `PhysicsLab.time` automatically.

## Optional authoritative graph synchronization

The phase can bind one initial origin-bound projection with `bindGraph`. A common
owner prepares the journal before numerical preparation, then seals its own
post-solve receipt and calls `synchronizeGraph(journal.receiptsSince(phase.graphSequence(), token), token)`.
Every frame advances the receipt sequence even if graph topology is unchanged.
Exact pending transaction identity prevents reuse of prepared work after abort
and retry. Dormant synchronization updates graph locations and floor activity
without a fake solve or numerical cache replacement. Genuine owned birth or
active geometry changes still require the numerical preparation phase that
frame. All source participants preflight before any commit.

The shared 40-frame native/scalar/WGSL handoff gate passes with zero error,
including a pair-to-cushion phase switch at frame 31 and no native reseed.
That short handoff contains no cushion impact. The existing independent impact
regressions remain the evidence for their own bounded domains. See
`gpu-contact-graph-journal.md` for the exact receipt freshness, remote-broad-event
and history-retention limitations.

### Four-hull prepared phase

The optional four-hull seed retains all four original cushion identities and
independent caches from initialization. Queries select the corresponding native
hull and cache; the maximum two active constraints map into existing solver
slots in native color order, with impulses written back to their original hull
indices. Inactive cache records are not replaced by another hull's values.
More than two active cushions or another unsupported static overlap still halts.

The dedicated four-hull gate passes 3/3: 64 frames/backend with actual left
cushion birth, positive impulse and separation, unchanged native sleeping/CCD
flags, and original compensated angular resistance. Maximum compared error is
zero. This controlled one-ball fixture keeps all 16 original statics but removes
the other two balls, and follows the same 72 constructor plus 34 preparation
steps disclosed above. It is not a retained-three-ball default-shot claim.

The existing bound 40-frame pair-to-cushion handoff also passes 7/7 after the
extension. Two additional source transport sentinels verify remote append/delete
adoption before numerical preparation and handoff after obsolete active-pair
removal. Those commanded topology checks are not new physical trajectories.

### Same-factory mapping holdouts

The same four-cache factory now passes the dedicated 4/4 mapping suite on scalar
and actual WGSL against independent native replay: right, front and back each
advance 64 frames (0.06666666666666667 application seconds), and the right/front
corner advances 32 frames (0.03333333333333333 seconds). Each backend covers 224
additional recurrent frames with maximum compared error zero. Together with the
separate 64-frame left gate, every active hull index is exercised in this same
four-cache factory.

The corner has two actual native frames where both cushions and cloth are active.
It begins with two native inactive broad-phase edges and no geometric points;
it does not bypass simultaneous new-pair ordering by inventing caches. Each
impact has native birth, positive reporting impulse and eventual inactivity.
All four cache slots, source color order, contact events and generated normal-sign
branches are compared. Packed feature/contact IDs and topology flags use exact
equality, with a mutation sentinel proving that large packed IDs cannot slip
through relative floating tolerance. Numerical tolerances are unchanged and
loaded source hashes remain fixed.

These are controlled single-ball fixtures retaining all 16 original fixed
colliders, original sleeping/CCD descriptors, materials and angular resistance.
The other two balls are explicitly removed. They establish slot mapping and
bounded coupled cloth/cushion recurrence, not a default retained-three-ball shot
or full island-manager serialization.
