# Transactional shared sphere-pair contact phase

This experimental phase owns two dynamic sphere contact caches and their two
continuous cloth contacts. Its arithmetic shares both velocity records in one
source-ordered PGS solve: the dynamic pair, then the native fixed-contact bucket
order. It is not two independent collision worlds and is not a complete scene
controller.

## Source and ownership

The source contract is Rapier commit
`b716d375efc0201003f0cd9ef7168eee0b62c177`, Parry 0.31.1 and the retained
Rapier/Parry/glam license notices. `experimental-cloth-island-world.js` supplies
the same arithmetic plans used by the separately tested two-body recurrence.
The new math factories do not widen that module's standalone admission.

`createReferenceStage(seed, states)` and `createGpuStage(device, seed, states)`
accept a single initial read-only native export. The seed carries generation-
bearing body/collider handles, the complete dense contact graph, both pair-channel
adjacencies, the native floor bucket order, native material values and existing
cache values. Actual primary/pair channels, massless pair colliders, Multiply
combination and native quantization of the square-root pair coefficients are
required. No predicted or expected future native state is an input.

A private owner claims the phase and calls `prepare`, `solvePrepared`, and
`commit`, or `abort`. Preparation reads only that owner's recurrent body states.
It updates fat bounds, qualifies the selected pair, emits source graph operations,
refreshes or recycles geometry, and preserves the saved anchors, lever arms and
warm caches when recycling. Numerical state cannot change between preparation
and solve. Only actual activation/CCD phase metadata may be attached; the
original `canSleep: true` and enabled CCD descriptors are not overwritten.

The common scene owner must process the emitted global `link`, `unlink`, dense
`edge-removed`, informational `edge-relocated`, and interaction wake operations
before solving. It must observe source activation, reject active CCD, apply the
original post-world angular law from the solved impulses, and commit all of its
stages atomically. Arbitrary per-frame callbacks are not a parity guarantee.

## Bounded domain

- Exactly one selected dynamic sphere pair, with both cloth contacts continuous.
- Fixed contact-recycle margin, identity local sphere colliders, zero contact
  skins and soft CCD prediction, finite native fat bounds.
- At most this one new eligible pair; another new pair candidate fails closed.
- No additional active constraints sharing either selected dynamic body.
- Both original sleeping-enabled bodies remain source-observed awake. CCD is
  enabled with max four substeps but must be source-prediction inactive.
- No active TOI, flight, simultaneous pair/cushion solve, general BVTT event order,
  or autonomous whole-scene activation/sleep controller.

Pair death can be emitted by this phase, but emitting an unlink is not evidence
that a caller implements persistent-island split/removal-journal semantics.
The native CLI exporter is test infrastructure, not browser snapshot transport.

## Validation status

Both retained-three-ball fixture gates pass 3/3 on the scalar reference and
actual WGSL. Each backend advances 224 frames in total: 96 head-on frames
(0.1 application seconds) and 128 oblique/spin frames (0.13333333333333333
application seconds), each from one initial export. The native f32 step is
0.0010416667209938169 seconds; the unchanged application law uses JS-double
1/960 seconds. Maximum absolute error is zero across all three body states, forces,
activation histories, contact caches and fat bounds; dense graph/adjacency order
and contact events also match. The head-on pair begins at zero-based frame 18, ends at frame 22, and reports
a peak normal impulse of 0.18734011054039001. The oblique/spin pair begins at
frame 19, ends at frame 23, and reports 0.18203863501548767. Lease, injection,
source-flag and ambiguous-candidate rejection tests pass. Both runs preserve
identical loaded source bytes throughout comparison.

The harness compares native replay with two own-state coupled bodies plus a third
independently constrained body advanced at the same step size. All three original
balls, all 16 fixed colliders, materials, sleeping and CCD descriptors remain.
The interacting two placements and initial velocities are controlled; this is
not the original default-layout shot. The initial export follows the unchanged
72-step constructor settling and 34 additional fixture preparation steps. No
ball-pair collision occurs before that export. Future native snapshots are used
only for assertions.

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

When bound, the phase now verifies its own broad proposal and adopts the exact
authoritative post-broad graph before resolving geometry edge IDs. Remote
append/delete transport and same-frame removal admission have dedicated
commanded component sentinels. The root still consumes one cumulative journal
operation stream, not concatenated per-phase copies. This does not add a
combined ball/cushion constraint solve or general BVTT traversal.
