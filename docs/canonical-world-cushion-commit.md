# Qualified cushion world commit

This adapter commits an already qualified mixed-motion finite-cushion result. It is
not an admission solver and does not suppress the next collision check.

`packVerifiedCushionRailMap(hulls, clothBoundsQ24)` derives the rule rail identity
from actual finite-hull placement, not array ordering or a rounded contact normal.
Each hull must uniquely abut one whole cloth side and span the other coordinate;
all four sides and hull IDs must be unique. Two position quanta permit only the
independent quantization of the shared boundary. Geometry is not shifted.
Mapping: x+→1, x−→2, z+→3, z−→4. Permuted hull ordering is tested.

The owning request runner must generate and snapshot this map from its immutable
hulls/cloth, then upload it. Low-level integer packets are not source provenance:
`commitMixedCushionWorldCPU` checks packet/identity consistency, not the original
vertices again. A caller-supplied relabelled map is not physical/rule authority.

The commit accepts only world status7/reason6 or7 (an unresolved supported tube),
qualified entry/response, matching entire roster/material, original source clock,
strictly positive in-horizon elapsed time, and the original deadline. Every body's
full p/v/q is copied at the same event time; the selected body uses the unchanged
coupled cushion/cloth impulse result. Regimes are rebuilt without velocity/spin
projection. Invalid packets do not advance time or append an event; inactive or
already-committed snapshots are no-ops, preventing replay at later phases.

Reserved world header fields, coordinated with the world owner:

- 61: committed cushion episode count.
- 62: absolute event tick.
- 63: bodySlot×8 + verified rail code.

No pair or cloth-landing counter is incremented. The coupled cloth support impulse
is not a separate landing or floor event. The recorder must capture this receipt
at the actual commit point and emit the authoritative cushion event before the
receipt is overwritten.

The dense state is a new declared canonical-local impact anchor, not a propagated
global enclosure. `requiresCushionRelease:true` means that finite penetration at
the impact cannot be ignored: a later accepted prefix must prove actual outward
separation from that same finite hull while clearing every other object. There is
no last-hull ID exemption. Without that proof, ordinary clearance remains pending.

GPU stage bindings: world state256, dense256, entry128, responded advanced160,
response128, original context160, immutable rail-map16. The single dispatch does
not perform a readback. `createWorldCushionCommitGPU(device).encode` exposes it for
the owning resident world graph.

Validation: six native packets (real admitted edge commit plus deadline,
zero-progress, roster, hull-ID and response mismatch guards),3072 CPU/WGSL words
identical; targeted native1/1 passed. Independent review found no blocking issue in
state/clock/rail mapping, with the immutable-owner map contract above explicitly
retained. The bounded SwiftShader process took1.212s with sampled aggregate
RSS394.62MiB; this is not hardware GPU throughput or VRAM usage.
