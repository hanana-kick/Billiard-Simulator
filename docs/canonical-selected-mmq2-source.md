# MMQ2 selected-source adapter and integration map

`selectedMMQ2PhaseRecords` is an independent source-to-record adapter. It does not enable GPU capture or change the world engine. It returns at most two owned arguments for the existing bounded `captureAccepted` interface. The normalized trace already understands MMQ2 source kind 2, so there is no need to fit a rolling path to an SMT2 polynomial.

## Required accepted source mapping

| Accepted route | Original source | Accepted boundary | Trace records |
| --- | --- | --- | --- |
| Rolling-aware full/partial CLEAR | Original `mixedDescriptors` (80 words/body) | Accepted advanced world state | One MMQ2 record; no impulse |
| Mixed pair | Original `mixedDescriptors`, actual `mixedEntry` | Committed pair state | One MMQ2 record with actual entry bracket |
| Translational/qy stop | Original `mixedDescriptors`; source-owned stop endpoint | Committed stop world state | One MMQ2 record; no impulse |
| Finite cushion | Original pre-impact `mixedDescriptors`, actual cushion entry | `impactStateBuffer` | First MMQ2 record ends at actual impact |
| Cushion departure | Cushion bank's original `descriptorBuffer` | Accepted bank `stateBuffer` | Second record begins at impact, ends at actual departure endpoint |

The cushion bank already exposes impact state, original departure descriptors, entry, and accepted state. An extra departure state getter is unnecessary for trace boundary construction: impact is the original departure anchor. The actual MMQ2 resolver currently creates MMQ2 departure descriptors. If departure fails without advancing, retain only the real impact record; never invent a 64-tick segment. Capture before the next scheduled stage overwrites any source buffer.

Two source appends for a cushion avoid enlarging the existing 4096-word source snapshot. Each append still consumes the selected-only bounded arena cap; the collector must honestly mark overflow/incomplete. A future GPU snapshot version must explicitly admit the MMQ2 pipeline and cushion event counter, preserve the existing v1 format/rejection behavior, and validate original source identity and clock. Do not relabel a v1 snapshot to claim v2 producer support.

## Adapter checks and tests

- Complete 3/4-ball identity, stable IDs, sphere radius/mass, exact original p/v/q anchor and source horizon.
- Actual pair/cushion event bracket and single impulse counter change; non-impulse clear/stop paths cannot increment collision counters.
- Exact join at impact, independent original departure recipe, rejected-departure endpoint unchanged.
- Inputs copied, not aliased; no CPU trajectory/contact evolution or point sampling during adaptation.
- Actual CPU-observed MMQ2 rolling cushion fixtures at speeds .2 and .1, including qy stop and later pending geometry.
- Actual rolling pair fixture reaches its impulse at tick24441; counter/bracket tampering rejected.
- A child loader replaces CPU evolution and mixed-source sampling with throwing functions and verifies the adapter still succeeds.

Focused test: 9 passed / 1 native skip (includes imported world-fixture tests). Typecheck passed. These are source-adapter results, not GPU MMQ2 capture, whole-shot trace, application rendering, or release qualification. The next integration gate is GPU-owned source appends around the qualified world stages followed by exact source parity and unchanged physical results.

## Snapshot ABI readiness (not a GPU capture claim)

The standalone `canonical-selected-mmq2-snapshot.mjs` defines SWG2 (`0x53574702`) with the unchanged 4096-word layout, explicit pinned MMQ2 version, and distinct phases CLEAR=6, PAIR=7, STOP=8, CUSHION_IMPACT=9, CUSHION_DEPARTURE=10. It copies all 80 words per body, including cached rolling geometry at 64–75. Each record's complete candidate/scene/request/body identity and common clock are validated before source adaptation. Stop/clear/departure records cannot hide a changed pair or cushion counter.

A cushion uses two independently bounded records, not one oversized record. No producer is installed by this module, and the existing SWG1 validation is unchanged. The future world hook must preserve original descriptors until each append finishes and bind the whole record sequence to the selected request. The focused fixture was extracted to avoid duplicate world tests; the latest independent source/snapshot suite has 8 passing tests, no native run and no duplicated fixture test registrations.

The standalone readiness results above are historical. The explicit SWG2 world hookup and its separately qualified raw/prepared cases are now documented in [SWG2 integration](canonical-selected-swg2-integration.md); they do not change this adapter's no-replay contract.
