# Canonical committed-event RULE contract

`canonical-event-rules.mjs` is an **opt-in standalone event reducer**, not a solver,
producer implementation, production/default migration, or end-to-end scoring
qualification. The GPU uses ordinary u32 WGSL and the CPU mirrors its integer
transitions. Actual admitted contact order and independent physical tests are the
physical engine's responsibility. A global carried enclosure is optional diagnostic
evidence, **not a gameplay gate** in this module. No Rapier trajectory oracle is used.

## Compatibility

The old `deterministic-rules.mjs` and `deterministic-physical-rules.mjs` APIs are
unchanged. The new 48-word state preserves the first 20 legacy rule words. A new
16-word config contains the first 12 legacy fields plus cue slot, complete body
count, capability mask, and version `0x43525201`. Methods 0–5 retain their old
meaning; 6 turn, 7 grand, 8 return, 9 cross, 10 allWalls extend the named routes.
The old validator intentionally does not admit those codes: use the new
`validateCanonicalRuleConfig` at every new host upload/CPU boundary.

`finalizeCanonicalRuleCPU(id,state,config)` and WGSL `cer_finalize` preserve the
four-word wire result `[id,status,reason,scoreBits]`. Status1 PASS,2 FAIL,3 INCOMPLETE,
4 UNSUPPORTED. Signed score -1 is `0xffffffff`; unavailable is **`0x80000000`**.
The finalizer does not merge gameplay into ordered-search state: positive gameplay
with failed or unsupported route retains gameplay score+1 but reports the separate
search failure/unsupported reason. Gameplay failure takes precedence as before.
There is no early condition-only finalizer in this new adapter yet.

## Events: eight u32 words

`[kind,a,b,detail,tick,sequence,flags,reserved]`. Sequence starts at1, increases
exactly by1 without wrapping, and ticks are nondecreasing canonical model times.
Reserved is0. Simultaneous ordering must be established by the producer; do not
invent order by sorting rails/IDs. An unresolvable physical order is UNSUPPORTED.

| kind | a | b | detail | flags |
|---|---|---|---|---|
|1 PAIR|body slot|other distinct body slot|0|1 committed|
|2 CUSHION|body slot|rail1 x+,2 x−,3 z+,4 z−;0 unknown|0|1 committed|
|3 OFF_TABLE|body slot|0|0|1 actual floor/off-table fact|
|4 KISS_SAMPLE|cue slot|other sphere slot|bit0 positive impulse,bit1 validated separation|1 validated observation|
|5 CLOTH_LANDING|body slot|0|0 single,1 composite|1 committed|
|6 MODEL_REST|complete roster mask|same complete resting mask|1 cue absent|1 complete event journal|
|7 BUDGET|0|0|0|0|
|8 CANCEL|0|0|0|0|
|9 UNSUPPORTED|0|0|4 physics or12 not implemented|0|
|10 INCOMPLETE|0|0|9 horizon,10 numeric failure,11 unresolved event|0|
|11 ROUTE_AMBIGUOUS|0|0|0|0|
|12 CUE_OBSTRUCTION|0|0|0|0|
|13 KISS_COVERAGE|complete non-cue sphere mask|previous coverage-end tick|0|1 complete interval observations|

All-body pair/cushion/off-table records are allowed; the reducer selects contacts
involving the configured cue. **Cloth landing is never a floor foul.** Pair events
are committed collision episodes, not pending geometry or a per-iteration impulse
log. The producer must own admission/deduplication of those episodes. The source
presentation journal's 120ms debounce is not transplanted as a new physics law.

MODEL_REST requires all3 or4 admitted bodies, zero unresolved physical events,
complete event publication, cue absence, and actual rest under the declared
canonical motion law. A complete integer mask is necessary but is not by itself
physical evidence: only the motion producer may emit this record. Complete roster
rest does not require a global error envelope. Every terminal operational marker
is sticky; appending REST after budget/cancellation/failure cannot make it PASS.
Unlike the old resumable standalone marker, continuation requires a new explicit
checkpoint/resume contract; this module does not accept implicit resumption.

Operation state word32 distinguishes active0,model-rest1,budget2,cancel3,
unsupported4,incomplete5. Word33 stores wire reason. Budget reason3 and cancellation
reason8 are distinct; horizon/numeric/unresolved preserve9/10/11. No operational
non-result is converted to a gameplay miss or a score.

ROUTE_AMBIGUOUS has the source search-only same-time-group meaning while the actual
gameplay contact emission order is known. If ambiguity can alter gameplay's frozen
cushion count, use physical UNSUPPORTED instead. Late four-ball opponent and
floor/off-table fouls remain active after route goal. Three-ball opponent cue is a
legal target; a late floor foul updates gameplay independently of the already
latched legacy route query. Both need complete model-rest before finalization.

## All UI route methods

The implementation follows the actual `route-rules.js` pure functions, not inferred
sport terminology:

- turn: no pre-first cushions; first3 post-first rails all different.
- grand: no pre-first cushions; at least4 afterward across at least3 rails.
- return: no pre-first cushions; a contiguous A–B–A subsequence, A≠B.
- cross: no pre-first cushions; first3 post-first rails z+/z−/z+ or reverse.
- allWalls: all4 distinct rails before first object, at least4 contacts, none between objects.

Existing direct/carom/any/bank1/bank2/bank3 retain exact prefix and count rules.
Named non-direct/carom routes require at least3 total cushions, or the configured
higher minimum. Counts/topology freeze at second target. Gameplay two-target mask
is unordered and its optional three-cushion count freezes at the second distinct
target separately. Missing rail identity/capability means unsupported named search,
not a guessed classification; gameplay and rail-independent methods remain usable.

## Motion-provider separation facts (binding still required)

Capabilities: CONTACTS1 means a complete canonical contact/off-table journal for
this admitted model; KISS2 means complete physical separation/positive-impulse
observations; RAILS4 means authoritative cushion identities. Missing CONTACTS is
unsupported gameplay. These bits are **producer capability attestations**, not
user switches that manufacture evidence. `kissFacts` is derived from KISS rather
than accepted as independent proof.

A bound motion provider must supply, for every non-cue sphere and every covered
interval:

1. Exact canonical interval endpoints, common monotonic clock, full sphere roster,
   and no omitted/unresolved separation or impact transition.
2. Positive physical impulse observations independently of presentation contacts.
3. Actual separation observations with gap **strictly greater than1/20000 m**.
   Missing contact, absence of endpoint overlap, a pending TOI, or motion of the
   target is not separation proof. The provider must evaluate its canonical motion
   and every intervening crossing, not infer the entire interval from endpoints.
4. Ordered KISS_SAMPLE events for all relevant observations. Separation clears
   active before impact; seen+inactive impact is a kiss; first moving-target touch
   is not. Simultaneous separated+impact is handled in that order.
5. KISS_COVERAGE records certifying contiguous intervals from tick0 through REST,
   full non-cue mask, and all relevant samples already emitted (a later sample at/before that covered end
   is rejected). `b` equals the previous
   coverage end; the event tick is the new end. At REST, no-kiss search requires
   coverage through that same tick. Coverage is not itself a numerical solver and
   must never be emitted for an endpoint-only provider.

No-kiss search without complete capability/coverage returns unsupported; gameplay
still finishes independently. Kisses at/before route goal tick can invalidate search;
later kisses cannot. Current existing restricted pair producer has not been bound
to this complete motion-fact interface; no end-to-end no-kiss claim is made.

## State extension

20 pre-first rail mask;21 post-first rail mask;22 first3 rail mask;
23 latest rail;24 penultimate rail;25 A–B–A seen;26 reserved;
27–29 first3 rail IDs;30 missing rail fact;31 reserved;
32 operation;33 reason;34 full roster;35 resting roster;36 last tick;
37 accepted sequence;38 kiss coverage end;39 coverage seen;40–47 reserved.

## Tests

`node --test tests/canonical-event-rules.mjs` feeds identical synthetic admitted
streams to the actual pure source game and route functions. The opt-in native test
compares all48 state words and all4 finalizer words against the CPU mirror. Acquire
`/tmp/billiard-native-gpu.lock` with flock before the trusted native WebGPU run.
These fixtures do not produce physical collisions and are not end-to-end authority.

Verified trusted native run: **4,105 fixture streams, 213,460 u32 words**
(48 state +4 finalizer words per stream), every CPU/GPU word identical;9/9 tests
passed. This establishes reducer parity and pure-source rule fixtures only,
not physical producer coverage or end-to-end goal authority.

### Composite cloth extension

CLOTH_LANDING detail1 is an explicitly composite cloth episode; detail0 retains
single-landing meaning. Both remain non-foul events. The recognized world journal
adapter additionally requires auxiliary metadata v1 for detail1, including actual
impact count and exact rational time bounds; the standalone reducer is not the
metadata/physics validator. See `canonical-world-journal.md` for the required
sidecar contract and candidate-specific zero-pair coverage rule. The compact
result layout is unchanged.
