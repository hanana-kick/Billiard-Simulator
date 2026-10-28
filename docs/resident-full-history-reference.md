# Full application-history reference profile

This checkpoint fixes the source/reference side of the observed history7 vs8
failure. It does **not** convert the old failed native h64 or HOST h128 artifact
into a pass. Native/runtime replay must be freshly prepared and compared.
`resident-candidate-strike-continuation-bank.mjs` is unchanged.

## Exact defect and source authority

The authentic row219 prestrike application has eight events: the prior stroke
and seven contacts. Accepted original `PhysicsLab.strike` appends the second
stroke at`5.6291666666664275`, yielding nine CREATED events. Native debounce uses
its complete event FIFO, so the initial last8 contains seven contacts and this
new non-key stroke; canonical initialization is count8/head0. The former seed's
contact-only seven-event list is still correct for the old scorer observation
stream, but cannot stand in for the native debounce FIFO.

New admitted seeds declare `source-full-application-history-v1` and carry exact
owned `preStrikeEventHistory` and `initialEventHistory`. The importer validates
full captured application metadata separately from native snapshot hashes.
Old serialized seeds with all three fields absent keep the former contract;
partial or unknown profiles fail rather than silently falling back.

## Source/reference changes

- `experimental-four-ball-world.js` preserves existing `contactEvents` and all
  game/scorer cursors. For the new profile only, separate `eventHistory` starts
  with the complete CREATED list and mirrors native120-entry truncation.
- One helper mirrors each genuinely accepted subsequent event once into this
  FIFO and increments `eventHistoryEmissionCount`. It covers compliant tip,
  obstruction, native application contacts, pair fallback; the existing shared
  CCD `applicationEvents` hook calls the same function. No CCD interface or
  numerical/solver source changes were needed.
- Both debounce checks use fullhistory last8 for the new profile. Legacy
  snapshots retain their previous shape and contact-only behavior.
- The all11 comparator's history projection validates full FIFO against the
  declared initial history plus the unchanged append-only observation stream.
  It uses the exact emission counter, not capped array length, for ring-head
  advancement. Original native history projection is literally unchanged.

## Independent host evidence

`tests/resident-candidate-full-history-fixture.mjs:createFullHistoryFixture`
performs fresh original admission, separate source-owner recurrence, and
separate untouched `PhysicsLab.step(1)` trials. Initial metadata and future
assertions are separated in the return shape; no future bank is a runtime input.

`node --test tests/resident-candidate-full-history-reference-tests.mjs`
passes5/5 host tests. For row219:

| Boundary | contact/scorer entries | Full history entries | Last8 count/head |
|---|---:|---:|---:|
| CREATED |7|9|8/0|
| h64/outer1 |7|9|8/0|
| h128/outer2 |7|9|8/0|
| h192/outer3 |8|10|8/1|

Independent source and original native projections agree on exact ordered
pair/time-bit history rows at64/128/192. Canonical ball/cue states, clocks and
scorer step counts also remain exact. First tip remains beforeh165 (164 completed
h, outer3/substep36), with normal impulse`0.564861770919994` at h192.

A separate explicitly **mock-event** FIFO test invokes the real source mirror
helper and unchanged `PhysicsLab.emit`137 times. It checks120-entry truncation,
non-key occupancy, exact timestamps/order and head wrap, not physical evolution.
Partial/tampered profiles and missing/miscounted fullhistory fail; unprofiled
legacy seeds remain contact-only. These tests establish neither GPU execution,
raw initialization parity, full-rest success nor1024-candidate performance.
