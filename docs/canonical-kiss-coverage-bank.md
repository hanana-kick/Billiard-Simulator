# Resident kiss interval fact bank

`canonical-kiss-coverage-bank.mjs` composes existing original-descriptor separation
queries and actual qualified mixed-pair responses. It is a producer-composition
component, not a public certificate oracle, final rule adapter, or globally enabled
KISS implementation. Its inputs must be the owning runner's actual buffers; IDs
and status words alone cannot prove arbitrary caller-supplied trajectories.

## Initialization and persistent state

The factory requires an owned one-candidate raw batch. Initialization consumes the
same raw-prefix-bound journal before world events, matching the full roster,
selected slot, candidate, scene/request keys and original absolute clock. It emits
only the actually admitted raw stroke's no-contact coverage interval.

The header retains the contiguous covered end, seen and active cue-pair masks,
last observed pair commit count, complete identity and bounded capacity. Every
method derives activeMask from that resident state; callers cannot assert it.
Facts use the existing eight-word KISS_SAMPLE/KISS_COVERAGE formats, with absolute
clocks and bank-local sequence numbers. They must eventually be merged with the
physical journal by the owning rule composition, preserving sample-before-impact
semantics and using the same shot-relative time conversion. This merge is not
implemented here and the bank does not enable a rule capability.

## Accepted operations

- `clear`: requires an actual committed clear-prefix world endpoint, original
  REST/SMT2/FLIGHT descriptors at the current covered clock, matching IDs and pair
  counter, and the endpoint at the exact descriptor horizon. It reruns the actual
  full-scene query on those same descriptors and the separation query. Certified
  witnesses are emitted in ascending time (slot order only for independent equal-
  time separation observations), before the coverage record. A witness at or
  before the already-covered boundary is refused, never retroactively inserted.
- `pair`: consumes the recognized mixed-entry proof, accepted full3D response and
  matching actual world commit. The original descriptor start equals the covered
  clock; the unique qualified entry is at a strictly later tick within its
  original horizon. All competing events are already excluded by that entry
  producer. This establishes absence of other impulses, not absence of separation:
  the bank additionally runs the original-descriptor separation query for every
  currently active cue pair up to the entry time. Ordered release witnesses are
  emitted before the actual positive normal-impulse observation. Unresolved
  separation or a retroactive boundary witness prevents interval coverage.
  Non-cue or zero impulse still advances the observed pair count.
- `finish`: requires a matching complete source-bound physical journal and model
  REST at exactly the covered end with no skipped pair counter. An uncovered
  interval cannot become complete by supplying a later REST.

No physical event is manufactured. Unsupported bounds, query budgets, capacity,
identity/clock gaps or unresolved observations leave fact coverage incomplete.
Inactive candidate phases do not advance the bank. GPU initialization, dynamic
configuration, query, fact recording and final validation are resident dispatches;
there is no intermediate host physics or readback.

## Explicit remaining gaps

The current full-clear query rejects the just-solved pair's initial contact. It
must not be bypassed by pair ID: integration still needs the owning world's actual
monotone-release/no-new-impulse receipt plus the stricter 1/20000m witness. Rolling,
slip/qt bridges and composite cloth episodes also need their original motion
receipts before they can advance this bank. A pair path that enters any such
unhandled interval remains incomplete. The existing zero-pair whole-shot rule
adapter is separate and remains the only directly integrated no-kiss case.

The component tests combine genuine raw-prefix admission, genuine descriptor
queries and genuine pair responses with synthetic commit/journal records to check
composition guards. They are not a complete physical no-kiss goal demonstration.

## Validation checkpoint

Final native targeted suite:4/4 tests,15 composition/guard sequences and4,072
literal CPU/GPU words identical, with zero intermediate readbacks. This includes
a second qualified target impact while a previously active cue pair separates;
its release is emitted before the new impulse rather than silently retaining the
old active state. Missing origins, roster/clock gaps, capacity, missing REST record,
moving bodies at claimed REST and retroactive witnesses stay incomplete.

The initial implementation omitted separation observation on an interval ending
in a qualified pair. Independent review caught that no-other-impulse is not a
no-separation proof. The final implementation runs the same original-descriptor
separation query up to the entry tick before recording the impulse. The regression
would fail the earlier implementation. Independent structural/CPU review passed.

Bounded SwiftShader verification28.498s, sampled aggregate RSS699.86MiB, maximum
child RSS660.05MiB; these are software GPU measurements, not hardware throughput
or VRAM. CPU suite10 passed with2 native skips (including imported query tests).
Type checking passed. No global capability or production default is changed.

## Source-owned supported tube seam

`bank.tube(before, pathDense, world, tubeReceipt, originalRows, context)` and resident
`bank.encodeTube(encoder, {before, path, world, receipt, rows, context})` consume a bounded
snapshot of the **actual TUBE_CLEAR result before any mixed resolver runs**.
The world producer must capture that 256-word state at the TUBE_CLEAR boundary,
retain the original path until after consumption, and construct descriptors from
the original pre-state (with the accepted duration), actual SMT2 input/output and
same context. A later resolver's accepted state is not this receipt.

The adapter checks contiguous clocks, full identities, unchanged physical event
counters, supported-rebase count, original path start/end bindings and SMT2
position coefficients/error radii. Every descriptor also binds its full initial
position/velocity/spin to the before-state and gravity/cloth/spin material to the
actual producer context; a different ballistic law cannot borrow this receipt. Modes outside REST/SMT2/FLIGHT fail closed.
It uses the tube's owned no-impulse attestation, **not** a collision re-query that
would reject the just-solved initial contact. For every active cue pair the
existing separation query must prove a witness or the entire interval remains
within the threshold. Thus a short interval need not already separate by 50 µm.
Unresolved geometry, retroactive witnesses, capacity exhaustion and missing
source receipts remain incomplete. No global accumulated-error gate is added.

These are trusted producer-composition APIs, not authentication of arbitrary
caller-created buffers. Tests with synthetic source snapshots validate adapter
ordering and rejection behavior, not physical whole-shot certification. The
bounded diagnostic fact bank is not a full trajectory per production candidate;
production should stream-fold rule/KISS state and return the existing 16 bytes.

Resident scheduling may call the tube stage on every world iteration: a snapshot
whose TUBE status is not accepted is an inactive no-op, not evidence of coverage.
The covered clock does not advance; a later unsupported gap cannot pass `finish`.
An accepted snapshot with mismatched provenance still fails immediately.

The mixed-pair hook also accepts the producer's parked status 12 while retaining
all accepted-entry, response, clock and counter checks. An unchanged pair commit
counter is an inactive no-op, making repeated loop dispatch consume a genuine
commit exactly once. Unsupported rolling-pair descriptors remain outside this
adapter; they cannot become coverage through a stale mixed-pair scratch buffer.

## Ordinary landing: same source interval, corrected endpoint

`bank.landing(before, path, world, receipt, rows, context, result)` and
`encodeLanding(encoder, {before, path, world, receipt, rows, context, result})`
are the ordinary-cloth specialization of the existing tube/separation adapter.
They do not implement another motion or collision law. Capture the accepted
TUBE_CLEAR state and original path immediately before LANDING_COMMIT overwrites
its selected body, then consume the actual post-commit state before rebasing.
The original before-state, descriptor inputs and immutable material context must
all belong to this same producer interval and candidate.

The actual 4×96-word landing response binds selected slot, version, radius/mass,
gravity, cloth top, root bracket, corrected position and full velocity/spin.
Exactly one ordinary cloth counter increment and matching slot/clock are required;
composite flag 1 is not ordinary landing. Sphere/cushion counters stay unchanged.
All unselected states and the complete roster remain bound. Bank header 14 tracks
consumed ordinary-cloth commits; subsequent interval/pair/REST gates reject a
missing same-clock cloth commit.

Landing may correct vertical position at the representative root tick. That
corrected endpoint must remain inside the original source-owned path endpoint
error envelope; x/z cannot change. Existing separation queries cover the original
interval. Any additional exact corrected-endpoint separation witness is recorded
before the coverage fact at the same clock. Cloth normal/friction impulses never
become KISS positive-impulse samples. Unresolved interval queries remain incomplete.

GPU resource layout stays within eight storage buffers. Each candidate's bank
owns a bounded 544-word scratch packet: words 0..159 are copied from the actual
context and words 160..543 from the actual landing result. Copies and consumption
are ordered in the same encoder with zero host readback. Future batched use must
retain disjoint per-candidate packet ownership or serialize each packet's complete
copy/query/consume sequence; it must not share a mutable packet across candidates.

Component tests use genuine landing root/response calculations with synthetic
source-owned tube snapshots to exercise contract guards and ordering. They do
not establish a connected actual raw-hit-to-REST no-kiss path. Mixed microtail,
rolling-tail and other missing receipt adapters remain fail-closed; global KISS
capability is still disabled.

A witness found only at the nominal ballistic upper tick must also pass the
corrected endpoint's exact threshold test. If correction removes that separation,
the adapter stays incomplete rather than treating nominal overshoot as a physical
visit. Earlier integer-tick witnesses remain admissible. A regression uses an
actual landing response with an airborne other ball to exercise this edge.

## Next receipt adapters (not implemented)

- Composite microtail: consume `prepareMicrotailWorldCPU` / GPU original inputs,
  accepted micro/fraction outputs, and `mergeMicrotailWorldCPU`'s `pathDense`
  before rebasing. Bind complete identity, initial p/v/q, immutable context,
  common clock, exactly one composite cloth commit and its rational/bracket/count
  sidecar. Its mode-3 swept enclosure is not an SMT2 or FLIGHT polynomial.
- Rolling tail: consume actual original rolling rows, immutable finite-table
  scene and accepted complete tail output (including echoed inputs and full-path
  bounds), then bind the committed REST endpoint and unchanged impulse counters.
  Tail acceptance via a separate pair query must include that actual query receipt,
  not merely the tail's unsuccessful nominal-clear flag.
- A conservative first implementation may retain an active pair only when the
  same-source full-interval enclosure proves its maximum distance never exceeds
  the exact threshold; alternatively an exact committed endpoint strictly beyond
  the threshold can supply a release witness at that endpoint. An unresolved
  enclosure with no endpoint witness stays incomplete. This uses existing receipt
  bounds and exact threshold arithmetic, not a new trajectory or motion law.
- Tests must include threshold equality, interior separation with close endpoints
  (incomplete for this conservative adapter), changed source/context/clock,
  wrong composite counts and missing sidecars, prior active-pair continuity,
  endpoint corrections, and native all-word equivalence. Actual runner wiring and
  a complete collided raw-to-REST fixture are separate prerequisites for enabling
  candidate-specific coverage. Global KISS stays disabled until every supported
  path and rule-composition boundary has complete coverage.

Until a cushion-specific interval receipt adapter is implemented, every bank
world endpoint must also have zero actual cushion-commit count (world header 61),
and initialization/finalization require zero physical-journal cushion count
(header 15). This prevents an omitted same-clock cushion from being hidden by a
later interval whose local before/after counts happen to agree.
