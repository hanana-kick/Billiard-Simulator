# Exact canonical state between shots (experimental, not wired)

`canonical-state-store.mjs` is a new opt-in owner of complete admitted canonical
scenes and exact final integer words. An explicit application-adapter
source can consume this owner and explicitly commit completed manual results; it does not alter controller defaults, services,
UI, Rapier, game scores or turns. It is not a release or a
mid-shot checkpoint/resume implementation.

## Verified presentation precision problem

A local probe using the actual pinned `vendor/rapier.cjs` (version 0.21.0) on
2026-10-27 wrote x = 16777217 / 2^24 = 1.0000000596046448 into a rigid body.
`body.translation().x` and `PhysicsLab.snapshot().objects[0].pos.x` both returned
1, which re-encodes to 16777216. One canonical position bit was lost. JavaScript
Number represents the original Q24 value exactly; the native presentation body
is not an exact Q24 state container. Writing final positions to Rapier and then
recapturing the next scene would therefore change subsequent canonical inputs.

The same probe found the actual constructed/settled sphere y was
0.030721673741936684, encoded as 515424, while the nominal .03075 radius encodes
as 515899. A below-cloth `PhysicsLab.move` placement returned
0.030799999833106995, encoded as 516738. Construction/height controls use a
+.00005 placement offset; dragging retains the existing height. These poses do
not satisfy the raw initializer's exact supported-height requirement. **The store
never normalizes this discrepancy.** Initial admission requires an explicit
model-transition policy or deliberate canonical preset in future integration;
that policy is not implemented here. An admitted metadata scene can still fail
raw-start admission, including for nonzero initial motion or support/clearance.

## API and ownership

- `createCanonicalStateStore({scene, selectedWorldProfile})` requires a validated,
  complete admitted scene and explicit `mmq1-ball-ball` or `mmq2-cushion` profile.
- `readRevision()` exposes the monotonic owner generation, including begin,
  cancellation and same-scene restore, for ABA-safe read-only source guards.
- `readScene()` returns the immutable next-shot scene; `readFinalState()` returns
  an owned copy of the exact final 256 words, or null before the first commit.
- `begin({request, candidate, raw})` requires a complete validated **manual**
  candidate from the current scene. The existing `prepareRawWorldBinding`
  validates the complete raw-start support, geometry, materials, clock and keys.
  A new begin invalidates the previous transaction even when admission fails.
- The returned `commit(receipt)` consumes a guarded selected-session result,
  checks exact model/execution-profile/request/epoch/candidate identity (including
  MMQ2's additional selected-world-profile identity), raw keys/clock, source kind,
  full stable-ID roster and REST status. It requires no pending event, zero
  velocity/surface-spin and modes, exact encoded radius/mass, supported in-domain
  positions, and no hidden objects in unused rows. Guard checks surround reads
  and precede atomic replacement. Incomplete/prepared/foreign results cannot
  advance the owner. REST is a trusted producer claim plus consistency checks,
  not a physical proof manufactured by this module.
- The next scene is re-admitted from the original complete static geometry,
  parameters and source settings plus **signed integer positions divided by
  2^24**. Nominal mass .210 and radius .03075 remain unchanged metadata; their
  encoded words are validated, not substituted back into nominal metadata.
  Sphere presentation labels/colors/rotation are preserved. No Rapier readback,
  saturation, clipping, roster truncation or synthesized table is involved.
- Exact REST positions are retained even if the next raw shot cannot pass its
  conservative clearance gate. Such a next begin rejects; it does not move balls.
- `snapshot()` provides an opaque, same-owner branded undo snapshot. `restore()`
  restores the exact scene, all words and provenance and invalidates pending
  transactions, including scene-ID ABA cases. Snapshots survive later session
  cancellation: the verified data belong to the store, not to a live receipt.
  This is an in-memory seam, not arbitrary JSON/native-world snapshot import.
  `cancel()`/`dispose()` invalidate transactions; commits are single-use.

Physical completion does not depend on trace capture completeness; a complete
REST result with incomplete presentation capture can be stored. This does not
permit invented trace points or score/turn application. Stored final words are
retained as exact evidence, **not fed directly to a continuation resume kernel**.
The next shot initializes new rule/contact ledgers through the normal raw path.

## Required future integration

After canonical activation, renderer/Rapier transforms must be presentation-only.
The original application adapter still captures PhysicsLab as source authority.
The explicit `createCanonicalStateApplicationAdapter` alternative reads this
owner instead, with profile and monotonic-revision guards. Submission remains
read-only; complete manual results offer explicit `commitState()` using the
real session-owned `readSubmission()` request/candidate/raw tuple. This closes
the selected-session-to-store seam without guessing epochs. See
`canonical-application-adapter.md` for atomic guards and owned commit metadata.
A future atomic integration must switch request/forecast/search scene ownership
together, guard all physical
edits and settings/rules, pair canonical undo state with game/context history,
and use source-owned trace presentation. None of scoring, turn advancement,
controller history, live placement, initial model transition, build/default
selection, real UI or release qualification is claimed here.

## Tests

`tests/canonical-state-store.mjs` uses actual pinned Rapier for the precision and
legacy-height probes. Store tests use actual complete PhysicsLab geometry and
materials with **explicitly injected canonical starting positions and guarded
selected-session REST receipts**. These are ABI/ownership tests, not simulated
shot outcomes, native/GPU equality evidence or browser qualification. They cover
3/4 bodies, MMQ1/MMQ2, positive/negative odd position words, repeated shots,
undo/redo, immutable nominal materials, owned buffers, stale/foreign receipts,
rest/material/domain/clock/roster failures, and cancellation/ABA rejection.

Local validation (2026-10-27): serialized state-store, canonical-engine-contract
and canonical-application-adapter tests passed **37/37**, including 8 new store
tests; `npm run typecheck` exited 0. Independent source review found no blocking
defect in this isolated seam. No native/GPU/browser run was performed for it.
