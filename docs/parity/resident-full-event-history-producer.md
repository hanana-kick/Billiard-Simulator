# Versioned initial full application history

`source-full-application-history-v1` fixes a diagnosed missing-input problem,
not a numerical tolerance. Original `PhysicsLab` debounces against its last eight
**unfiltered** emitted events (`src/physics.js:263`). The pinned settled capture
contains eight prestrike events and nine created events; the old exporter kept
only seven contacts and dropped both strokes.

## Producer contract

Fresh live imports now carry all three fields, or reject:

- `initialEventHistoryProfile: 'source-full-application-history-v1'`
- `preStrikeEventHistory`: complete original prestrike application list
- `initialEventHistory`: complete original created application list

`initialContactEvents` remains the contact-only projection. The owned capture
must show exactly `(prestrike + acceptedStroke).slice(-120)`, with the original
stroke kind, label, time, and no key/extra metadata. All retained prefix fields
must compare exactly, including native keys and absolute binary64 times. The
profile binds its clocks/settings and initial snapshot identity to the existing
source origin. It does not claim the Rapier snapshot bytes contain or authenticate
JavaScript application events: provenance includes the owned capture envelope.

The pure browser-safe `src/source-event-history.mjs` exports capture validation,
seed validation and canonical ring packing without an engine, GPU or decoder.
All three fields absent means the old serialized seed retains its legacy
contact-only semantics. Partial fields, an unknown profile or inconsistent full
history reject; they never silently fall back. Old artifacts are not rewritten.

`packCreatedWorldTemplate` additionally exposes:

```
historyInitialization = {
  kind: 'resident-initial-event-history-v1', profile,
  preStrike: {count, head, words: Uint32Array(32)},
  created:   {count, head, words: Uint32Array(32)},
  strokeTime: Uint32Array(2)
}
```

Each initial ring is canonical chronological order, with `count=min(length,8)`
and `head=count%8`; unused words are zero. Slot words are pair ID, time low,
time high, keyed flag. Non-key events still occupy/evict slots. Generation-bearing
native keys must resolve to the exact admitted 27-collider roster, otherwise the
input is unsupported. Created templates seed the created ring. The raw initializer
must separately clone the prestrike ring, append/canonicalize exactly once after
successful creation, and not append for invalid/blocked/unsupported rows. Later h
FIFO operations must remain unchanged. That integration is a separate gate.

## Evidence and limits

- `node --test tests/resident-candidate-source-event-history.mjs`: six pure
  protocol groups pass, including lengths0/7/8/120 and malformed-profile rejection.
- `node --test tests/resident-candidate-source-event-history-producer.mjs`: three
  local authentic diagnostic groups pass. This test requires the pinned original
  capture and decoder artifacts documented by `originalRegisteredFixture`;
  it is not a standalone fresh-checkout test. It compares full/legacy templates
  and calls unchanged original `PhysicsLab.strike` for accepted219, invalid522,
  blocked421 while prohibiting native forward steps.
- Existing `browser-live-registered-import.cjs`:13 pass; its Chromium opt-in case
  remains skipped. Source/body/cache checks and original contact projection stay
  unchanged.

No GPU work, raw-to-impact recurrence, full-rest, late-foul or1024 qualification
is established by these producer checks. Original `physics.js`, main and the
production/default CPU path are unchanged.
