# Shared source contact-graph journal

This bounded component owns one dense, generation-bearing contact graph for the
original three spheres, six sphere collider channels and sixteen fixed
colliders. It does not own rigid-body physics or replace native solver-bucket
bookkeeping. Rapier source attribution and the Apache-2.0 notice are retained in
`experimental-contact-graph-journal.js` and `vendor/RAPIER-LICENSE.txt`.

## Source contract

The pinned source is Rapier
`b716d375efc0201003f0cd9ef7168eee0b62c177`:

- `geometry/broad_phase_bvh/update.rs`: own fat proxies, original filters, BVTT
  additions before canonically ordered stale deletions.
- `data/graph.rs`: append at the dense tail; prepend collider1 outgoing and
  collider2 incoming adjacency; unlink then swap-remove; preserve adjacency
  chain position when relocating the previous tail.
- `geometry/narrow_phase/pair_management.rs`: exactly one unlink and dense
  edge-removal notification, followed by strong wake/stop for an active deleted
  pair. The informational relocation notification is not another swap.

The arithmetic graph computes all three source sphere fat bounds and every
eligible sphere/fixed or sphere/sphere overlap on scalar f32 or actual WGSL.
Same-parent exclusion, bilateral original groups, fixed-fixed exclusion,
zero skins/soft-CCD prediction and fixed change-detection margin are explicit
admission conditions. More than one fresh eligible pair fails closed because
source BVTT traversal order has not been implemented.

## Transaction and handoff

The scene leases `createReferenceStage(seed)` or `createGpuStage(device, seed)`.
It supplies only its own three current translations to `prepare`; immutable
shape, handle, filter and fixed-proxy data comes from one initial export.
`narrowTransitions` accepts the admitted source geometry phases' actual active
changes in dense-edge order. Its result is the cumulative operation/event
stream, consumed once before activation. Do not concatenate it with the earlier
`broadOperations` diagnostics.

After the owned solve and application law, `postSolve` updates proxy bounds only.
It deliberately does not add or delete contact pairs at the post-step pose.
`assertPrepared`, synchronous `commit` and `abort` participate in the same
transaction as geometry caches, scene activation and body states.

Origin-bound projections consume only complete/sealed receipts. A cloned,
foreign, aborted, skipped or out-of-order receipt is rejected. Add/remove
lifetimes are distinct from dense indices: a remote relocation preserves all
cached impulses and recycling reference data, while a genuine removal and
re-addition of the same collider handles creates a new lifetime. Directional
adjacency is never reconstructed by sorting dense edge indices.

A dormant contact phase must synchronize graph-only changes without performing
a fake solve. Floor active-state changes must also be consumed while that phase
is dormant. Numeric caches remain owned by their admitted phase, not by a
caller-supplied replacement. Pair and cushion phase adapters implement this optional contract; their default unbound behavior remains unchanged.

## Receipt freshness and phase binding

`revision` tracks graph changes only. A separate monotonic `sequence` advances
on every committed frame, including graph-no-op frames whose proxies changed.
`receiptsSince(sequence, token)` therefore includes no-op transactions. Consumers
use `graphSequence()`, not `graphRevision()`, as their cursor. Empty, replayed,
skipped, wrong-backend and non-current-head synchronization is rejected.

An idle phase binds one initial projection with `bindGraph(projection, token)`.
A bound numerical `prepare` captures the exact pending broad transaction identity
internally. Its solve and sealed synchronization require that same live
transaction; aborting A and retrying B at the same sequence cannot reuse A's
prepared numerical work. `synchronizeGraph(receipts, token)` is allowed once for
an idle or solved phase, and all participants must pass `assertPrepared` before
any synchronous commit. The owner aborts every participant on failure.

Bound preparation receives the prior committed graph, verifies its own broad
proposal against the exact pending receipt, then adopts the authoritative
post-broad graph before resolving narrow transitions. Remote append/delete and
relocation transport is covered by separate commanded component sentinels, not
claimed as a new whole-world physical trajectory. Domain checks use the
post-broad graph, so an already-deleted obsolete constraint does not block a
valid phase handoff. A dormant phase may consume remote operations, relocations
and floor-active changes without solving.
An owned birth or active transition cannot be supplied to a dormant cache as if
its geometry had executed. Initial cache identity and actual remove/re-add
lifetimes are checked independently of endpoint equality.

While a journal is live, history retains complete receipts, including graph-no-op
frames, so consumers can catch up from any valid sequence. Long-running
integration still needs cursor-aware pruning; this implementation does not claim
bounded-memory whole-shot execution.

After the existing no-lease/no-busy checks pass, `dispose()` clears the journal's
history, head and pending strong references. The latest committed `snapshot()`
remains readable and isolated by copying. Externally held committed receipts
remain inspectable through their existing WeakMap metadata; all disposed
projection/transaction authority stays rejected. Receipt/projection storage held
by callers is not forcibly erased, and no live receipt is pruned or capped.

A lease/busy rejection leaves journal state untouched. As before, if backend
`math.dispose()` throws, the journal is already disposed, and another `dispose()`
does not retry backend cleanup. Owned history/head roots are released before
that call, including on this error path. The focused disposal tests inspect
private references in a test-only compiled copy and inject a throwing disposer;
they do not add a production diagnostic API, measure heap use, claim immediate
garbage collection or establish GPU/physics parity.

The disposal-only gate passes 5/5; combined with the existing freshness and
bounded synthetic journal gates it passes 18/18:

```sh
node --test tests/experimental-contact-graph-journal-disposal.cjs \
  tests/experimental-contact-graph-journal-freshness.cjs \
  tests/experimental-contact-graph-journal-bounded.cjs
```

## Validation status

The final gate passes 11/11: seven journal/native/phase tests plus four pure
transaction freshness tests. The 40-frame trajectory (0.041666666666666664
application seconds) advances all three candidate bodies using their own
pair/floor, activation, CCD and original angular-law outputs. Native future
states and adjacency are assertions only. Maximum absolute error is zero across
all three body states, forces, activation histories and floor caches, with exact
fat bounds, dense graph, directional adjacency and events. At frame 31 the own
pair absence selects the cushion phase initialized from the same original seed;
no later native cache or pose is imported. This short handoff has no cushion
impact and is not a full default-layout shot.

The native graph-allocation holdout separately confirms multiple canonical
stale deletions and directional chains using explicit pose commands. It is an
allocation component test, not a recurrent physical-trajectory claim. Pure
sentinels cover non-tail relocation, same-handle rebirth, dormant floor activity,
foreign/unsealed/aborted receipt rejection, no-op proxy rewind, empty/skipped
synchronization, and stale numerical work across an identical abort/retry.

The default pair head-on regression (96 frames/backend, 0.1 application seconds)
and default cushion regression (64 frames/backend, 0.06666666666666667 seconds)
also pass 3/3 each with zero error. The fixed arithmetic tolerance is unchanged;
loaded source hashes remain identical through each run. No whole-shot or native
manager completeness claim follows from these component gates.

## Live cue boundary

The 22-collider factory does not include cue colliders. The original default
three-ball stroke has native inactive cue/environment pairs; therefore this
factory alone is not a complete elapsed-zero scene graph. The separate admitted
full-registry path below consumes source-generated cue BVH events, retain inactive
edges, and processes actual collider withdrawal in the same authoritative dense
graph. A shape-level no-contact guard is not proof of absent broad-phase edges.

## Admitted full-registry cue bridge

The separate factories `createReferenceStageWithCue(seed, cueBroadStage)` and
`createGpuStageWithCue(device, seed, cueBroadStage)` require the actual branded
`experimental-cue-broad-phase` stage and the same elapsed-zero source registry.
The seed uses `kind: 'original-three-ball-cue-contact-graph'`, the full 25
collider/adjacency records, source-ordered `cueColliders`, and the exact initial
snapshot SHA. The original three sphere records and sixteen fixed proxies are
unchanged. Initial cue edges must actually be absent before their first BVTT
insertion.

`prepare(ownThreeTranslations, token, cuePreReceipt)` checks that the opaque
receipt is current, origin-bound, backend-matched and tied to that initial
registry. It verifies all original sphere/fixed proxies and the complete prior
pair set before applying the source-derived event sequence. The journal alone
owns dense edges and directional adjacency. Cue allocation order is not
reconstructed by sorting collider handles. While the cue lives, simultaneous
noncue pair additions/deletions fail closed rather than inventing cross-stream
BVTT order.

Actual collider withdrawal is separate from stale `DeletePair` events. It
follows the source removed-collider order, traverses each current outgoing chain
then incoming chain, and mirrors every dense swap removal. Inactive cue edges do
not acquire fake persistent links or collision-start events. The bridge reports
solver-graph and force-list invalidation; it does not itself reconstruct those
source buckets. Active cue geometry remains unsupported.

`postSolve(ownThreeSolvedTranslations, token, cuePostReceipt)` requires the exact
same cue transaction. Candidate proxies are checked before any pending state is
published, so a rejected post cannot contaminate a retry. All participants
preflight before synchronous commits; commit this journal before committing the
cue broad stage, whose receipts then expire. Abort all participants on failure.

The withdrawal post keeps the same own ball proxies. After that frame commits,
cue authority is retired and the journal's existing three-sphere arithmetic
continues without resetting caches, proxies or clock; further cue receipts are
rejected. This bridge does not claim evolving full-BVH serialization parity or
new post-initial cue-pair traversal. Its validation is bounded as recorded below.

### Full-registry validation

The standalone bridge gate passes 2/2 on scalar and actual WGSL. From one
original creation export, the first source BVTT allocation yields the exact
independent native five-edge graph and 25 directional adjacency records. Cloned
receipts are rejected, and a deliberately invalid post proxy cannot contaminate
a corrected retry. This is a prepared graph-allocation/protocol test, not a
rigid-body trajectory. Loaded source hashes remain unchanged.

Separately, the common owner passes eight recurrent source h on scalar/native
and actual WGSL/native, retaining all three original balls and the cue from the
original elapsed-zero state. Dense graph, all 25 adjacency records, all native
fat proxies, physical/cache state and manager checks pass: CPU maximum error
zero, GPU maximum angular residual 1.0579449157400588e-37. The horizon is
8/61440 seconds. This short prefix does not yet validate cue withdrawal, later
ball impacts, cushion impacts or the full shot under this new graph bridge.
