# Resident PW1 continuation journal

`canonical-world-journal.mjs` records the actual commit counters of the bounded
PW1 world pipeline. It is a recording layer, not collision admission, a motion
solver, a whole-shot origin attestation, or kiss separation evidence. No production
default is changed.

## Composition

- CPU: `createWorldJournalCPU(world, {capacity})`, then `capture(state, {final})`
  immediately after each actual pair or landing commit and once at termination.
- GPU: `await createWorldJournalGPU(device)`, then `createBank(worldBuffer,
  {capacity})`; call `encodeInitialize(encoder)` before world execution and
  `encodeCapture(encoder, stateBuffer, {final})` at matching commit points.
- The bank exposes `buffer` and `byteLength` for a single final diagnostic copy.
  It performs no host physics, readback, queue submission, or synthetic event
  insertion between phases. Destroy the bank after completion.
- Capacity is explicitly bounded at 1–1024 events. Capacity exhaustion is sticky
  incomplete, never an omitted-event success. The default is 128 events.

The owning runner must admit the actual full PW1/scene, retain immutable identities,
and supply its own buffers. Public record functions do not convert arbitrary caller
words into physical proof. The recorder does not validate geometry or impulses.

## Layout

32 header words followed by capacity ×8 event words using the canonical rule event
ABI. Header fields:

- 0 version `0x574a3101`; 1 status (1 active, 2 complete interval, 3 incomplete).
- 2 reason; 3 written event count; 4 body count; 5 starting tick; 6 last common tick.
- 7 last recorded pair count; 8 last recorded landing count.
- 9 scene key; 10 request key; 11 candidate ID; 12 selected slot.
- 13 composite episode count; 14 required auxiliary format version (0 or1).
- 16–19 full roster body IDs; 20/21 source-owned raw-prefix marker/end;31 capacity. Other fields are reserved zero.

Pair events come only from changes in world word45 with the committed absolute
clock at46 and slots encoded in word6. Landing events come from word21 with slot22
and clock23. Captures must occur before these receipts are overwritten. A missed
increment, decrease, invalid slot, stale clock, identity mismatch, or pair and
landing arriving together without observed order makes the journal incomplete.
Repeated unchanged snapshots do not duplicate events. No sorting invents order.

Final MODEL_REST requires world status9, no unresolved pair marker, zero mode mask,
and all admitted bodies in rest mode with all six velocity/surface-spin components
zero. World budget termination emits BUDGET; all other unresolved terminal states
emit INCOMPLETE. A later snapshot cannot reverse an incomplete terminal state.
Cloth landing emits event5, never OFF_TABLE.

## Scope and rule binding

`inspectWorldJournal` always reports `wholeShotOriginBound:false` and
`kissCoverage:false`. Even a complete interval starting after a prior contact is
not a complete shot: do not initialize a fresh gameplay state at that interval and
publish its verdict as the shot's score. The source-owned raw-shot composition below
proves an empty initial contact prefix; a generic PW1 still cannot claim this.

This bounded world has no accepted cushion-response or off-table transitions;
unresolved ones must stop physics and leave this journal incomplete. If that
solver support expands, extend the recorder at those actual commit stages before
claiming complete interval coverage. The recorder does not certify the absence of
future transition kinds on behalf of an unrecognized producer. No KISS capability
or KISS_COVERAGE is emitted: continuous separation/impulse observation remains a
separate missing integration.

## Verification

Independent native reducer rerun: 4,105 synthetic rule streams, 213,460 exact CPU/GPU
words, 9/9 tests; 7.957s, sampled aggregate RSS550.55MiB, max child RSS515.64MiB.

Recorder tests: 22 synthetic commit/guard streams, 22,216 exact CPU/GPU words,
4/4 tests; 0.706s, sampled aggregate RSS196.24MiB, max child RSS164.90MiB.
This recorder test does not generate physical collisions; actual world integration
must additionally verify committed pair/landing paths. Measurements use SwiftShader
software Vulkan, not physical GPU throughput or VRAM usage.

## Owned raw-start binding and resident rule composition

`canonical-raw-journal-prefix.mjs` supplies the narrow seam used **inside** the
source-owned `runRaw(batch)` composition. The admitted raw factory starts the full
sphere roster stationary and uses complete other-sphere/noncloth AABBs plus finite
support exclusion guards throughout the strike. Its READY handoff consequently
provides an empty gameplay-contact prefix. The seam does not infer emptiness from
a generic PW1 snapshot.

After the raw bank and ordinary journal initializer, the resident prefix kernel
checks the same candidate, scene/request keys, roster/selected slot, READY status,
raw source kind, start/duration/end clock, and empty journal. Header20 records this
accepted prefix;21 records its end;5 is changed to the original shot start. Failure
is sticky incomplete. There are no fabricated pair, rail, off-table or kiss events.
The CPU seam is called only on the result freshly produced inside the owning raw
runner. Its exported low-level function is not an authority for externally supplied
raw words. Likewise, diagnostic header bits are not cryptographic proof.

`canonical-journal-rules.mjs` binds a validated request to the legitimate raw batch
and derives the canonical rule config from stable IDs. It grants only CONTACTS,
not KISS or RAILS. The resident reducer runs after journal finalization, consumes the
resident events, and returns48 state words plus the unchanged4-word compact result.
Incomplete journals, absent raw origin, or mismatching identities yield unavailable
score, never a guessed miss. Missing no-kiss evidence remains unsupported search;
full gameplay may finish independently. The owning world wrapper must compose this
module with its own raw bank and journal; a standalone journal array is not an
end-to-end execution receipt.

Owned raw-prefix/rule gate native check: 3 actual raw candidates (admitted,
zero-step duration budget, unsupported tip), 3,324 exact CPU/GPU words, 5/5 tests;
17.528s, aggregate sampled RSS817.29MiB, max child RSS776.71MiB. This run stops
before world continuation and correctly returns no gameplay verdict. Separate
synthetic journal fixtures test positive scoring, signed foul −1, and unavailable
no-kiss search; those fixtures are not physical complete-shot evidence.

Repeated-episode regression extends the recorder to23 fixture streams /23,272
exact CPU/GPU words,5/5 passing; one-tick-separated all-body pair episodes are
retained without presentation debounce. Native elapsed0.506s, aggregate sampled
RSS177.46MiB, max child RSS158.12MiB. These remain recorder guard fixtures.

## Rule time basis

The owning rule adapter now leaves the physical journal absolute but subtracts its
bound original shot start from every rule event tick and both KISS_COVERAGE interval
endpoints. It rejects underflow, coverage endpoints after their event, and events
after the journal end. Standalone CER ABI is unchanged. Receipts expose
`ruleTimeBasis:'shot-relative-q20'` and `ruleTimeOrigin`.

Origin1234 and1,000,000,000 produce identical rule states after conversion. Coverage
starts at relative0; a sample at/before an already published coverage endpoint is
still rejected. Native7/7, three actual raw prefix cases plus four synthetic
relative-clock cases,3,532 exact CPU/GPU words;17.718s, aggregate sampled
RSS819.98MiB, max child RSS779.70MiB. Whole-shot physical demonstration remains the
separate owning raw-world test, not these synthetic positive-score fixtures.

## Composite cloth episodes and auxiliary metadata v1

A sub-tick cloth bounce tail is an explicit composite episode, not one physical
impact. CLOTH_LANDING detail0 remains a single committed landing; detail1 marks a
composite episode. Both are cloth events and neither is a floor/off-table foul.
Header13 counts composite episodes, and header14 is auxiliary-format version1
when any exist (otherwise0). The ordinary eight-word event ABI is unchanged.

A parallel eight-word slot for every event stores, for composite events:
`[physicalImpactCount, absoluteLowerEnd, absoluteUpperEnd,
  durationSecondsNumerator, durationSecondsDenominator, bodySlot, sequence, 1]`.
Non-composite slots are zero-initialized. The resident bank exposes `auxBuffer`
and `auxByteLength`; CPU journals expose `auxWords`. Diagnostic readers return
both. Compact four-word results remain unchanged.

World metadata51 is the composite marker;53 is actual physical impact count;
54/55 are the absolute endpoint bracket;58/59 hold the exact total micro-flight
seconds numerator/denominator. The remaining fractional supported evolution ends
at the common upper tick. Count21 tracks committed cloth episodes, not the number
of physical bounces. The sidecar preserves the latter for future cumulative event
accounting; this does not claim that cumulative request budgets are implemented.

The recorder validates count1..128, positive even numerator between2*count and
254*count (at most32512), gravity denominator1..268435456, and exact Q20 duration
floor/ceil using bounded two-word integer division. The inferred episode start
must be no earlier than the previous journal observation; both endpoint bounds
must agree with the same rational duration and the upper bound must equal the
committed clock. The body slot, event sequence, and auxiliary version are also
checked. Missing/corrupt required sidecars make completeness false and rule
reduction incomplete. A sidecar is metadata from the recognized physical producer,
not an independent proof that its physical impacts occurred.

## Candidate-specific zero-pair kiss coverage

The source-owned raw→world adapter may enable KISS for one complete candidate
whose journal has zero pair commits, contains only cloth events followed by REST,
and has a matching cloth count and valid auxiliary metadata. The raw prefix is
already bound to the same request, scene, candidate, roster and original clock.
Because that recognized producer publishes every admitted pair episode, this
specific complete interval has no positive ball-pair impulses and no seen/active
kiss episodes. The adapter inserts complete shot-relative coverage immediately
before REST without mutating the absolute physical journal.

This is not global KISS support. Any pair event, nonzero pair count, missing raw
origin, unfinished physics, or inconsistent journal prevents this derivation.
Collided paths still require original-motion separation/impulse coverage, and
unresolved paths never acquire coverage by appending REST.

Native verification of this extension:14/14 tests, 72,848 recorder/sidecar words
across36 guard streams plus4,468 raw-prefix/rule words (3 actual raw strokes,
4 relative-clock cases,18 synthetic coverage cases), every CPU/GPU word identical.
Bounded SwiftShader run:19.644s, sampled aggregate RSS906.33MiB; not physical GPU
performance. Type checking passed. This is not a new complete scored-shot test.

### Actual cushion commit snapshots

The recorder also consumes source-owned finite-cushion impact snapshots. World
header 61 is the cumulative impact count, 62 the absolute common impact tick,
and 63 `bodySlot*8+rail`. Journal header 15 tracks the observed cushion count.
Every increment must be exactly one, with the actual impact snapshot clock and
full candidate/roster/scene identity matching. Kind 2 records carry the body slot
and verified rail 1..4 (x+, x−, z+, z−); the geometry-derived rail map is produced
by `packVerifiedCushionRailMap`, not inferred from hull-array order.

Capture the actual impulse state **before release**. A failed release still
leaves the genuine impact event followed by the pending/incomplete terminal
record. A final released state alone cannot substitute for the earlier impact
clock. Pair/cloth/cushion increments arriving in the same capture fail closed:
the recorder never invents an order. Repeated capture of the same counter does
not duplicate an event. This does not introduce off-table or KISS evidence and
does not change the production 16-byte compact result.

The currently cloth-only complete zero-PAIR coverage derivation also requires
journal header 15 (observed cushion count) to be zero. A nonzero cushion counter
without matching history cannot borrow no-kiss coverage. Cushion-only no-PAIR
coverage is not enabled by the recorder's new cushion support.
