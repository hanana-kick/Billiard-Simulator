# Cohesive live candidate preparation and scoring admission

```js
import {prepareLiveFourBallCandidate} from
  './src/browser-initial-import/prepare-live-candidate.mjs';
const {seed, admission, candidateProvenance} = await prepareLiveFourBallCandidate({
  controller, candidate: {settings, rules: {fourBallThreeCushion: false}},
  decoder, signal
});
```

`controller` must be the trusted original four-ball controller with a ready live
source; `decoder` is the initialized, admitted read-only snapshot decoder. The
helper has no detached `capture`, `raw`, `seed` or `admission` input. Unknown
options and accessor options reject. It internally invokes synchronous original
candidate capture, owns all raw bytes/metadata before any await, checks receipt
bindings, and **disposes the private native candidate before decoder work**.
Neither source controller nor caller's decoder is owned or disposed.

The strict existing registered-four-ball importer verifies the raw pre/post
snapshot bytes and application/journal binding. Preparation then checks settings,
selection/body, rules, source clocks, revision/shots and exact initial contact
history against the imported seed. Only the importer's verified
`initialSnapshotSha256` is added to the capture's genuine geometric admission.
The returned admission is deeply frozen plain data containing the fields required
by `createFourBallPhysicalScoring`, plus explicit rule and prestrike identity
fields. `candidateProvenance` is separately frozen; the imported seed retains its
existing same-realm private hull identity rather than being cloned/reconstructed.

For the physical scorer, use request settings equal to `admission.settings` and
request per-shot three-cushion rule equal to `admission.rules.fourBallThreeCushion`.
The scorer/request layer still owns all topology, search-domain, input-inequality,
full-rest foul and final-goal checks. This helper never observes a completed shot,
instantiates a numerical/GPU owner, supplies expected trajectories, or selects a
public backend.

## Trust and ownership boundary

This is an in-process preparation boundary, **not cryptographic authenticity**.
It does not accept an arbitrary edited receipt and add an apparently authoritative
hash to it. The source engine/controller constructors and decoder remain trusted
application dependencies. A hostile caller replacing those dependencies is not
made trustworthy by this API. Likewise cloning a returned admission removes its
freeze, and an arbitrary caller can fabricate plain objects; consumers must not
interpret field shape as an authority token.

The snapshot hash binds imported created bytes, not a signature over clearance.
Clearance provenance comes from the cohesive original capture/query before the
same import. Asynchronous caller mutation of its proposed controls cannot change
the detached operation. Subsequent visible play does not change the prepared
historical source; this helper does not certify that source is still current at
later commit time. Current-source/revision checks at any eventual search result
commit remain a separate integration obligation.

The return is same-realm: a numerical owner can consume `seed` directly. It is not
a worker wire protocol, and serialized seeds must not bypass the existing strict
raw import or re-create private hull authority. Future worker integration needs
its own explicit receipt transport/binding design; no protocol is widened here.
Cancellation/error after capture frees the fork; cancellation during read-only
import is reported after that bounded import returns. No live native candidate
or GPU owner is retained while awaiting it.

## Lightweight verification

```sh
RAPIER_WASM_PROVENANCE=/path/to/admitted-provenance.json \
 node --max-old-space-size=256 --test tests/prepare-live-candidate.cjs
```

Three tests pass in about five seconds with tiny genuine source captures, no
large fixtures or numerical/GPU continuation. They cover two exact candidate
settings/rules, equality to independent original clearance queries, unchanged
visible source snapshots/history, zero capture physics steps, cleanup before
first decode, frozen output, mutation during await, detached receipt/seed
rejection, mismatched candidate poststrike decoding, foreign-source prestrike
decoding, pre/during-import cancellation and genuine blocked geometry refusal.
The existing synchronous capture API and raw import schema are unchanged.
