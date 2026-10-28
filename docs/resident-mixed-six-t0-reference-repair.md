# Mixed-six t0 assertion repair (assertion-only v2)

The first native baseline completed its immutable 512-cycle schedule, but the
initial comparator threw before parity: `initial.scene` was `null` in the
original `World.createReferenceStepper` snapshot. That controller intentionally
creates the processed scene owner lazily in its first h. Calling that processed
factory at captured t0 would invent first-h user changes/registration.

The captured boundary is after raw creation, source-PC begin and VM begin,
before the first scalar pump. The correct scene authority is the independently
captured **native created** snapshot, not a post-h or Controller h2 boundary.
`resident-candidate-original-t0-created-scene.mjs` validates each already-bound
seed through the unchanged original `Live.validateCreatedSource` (13-call
construction journal), then directly projects native islands, ordered bodies,
IDs/activation/maxExtent, modified queues and original static registry. It uses
no resident encoder, GPU words, initialized future context or physical step.
The unconsumed created phase retains fresh cue IDs and changes=255.

Only the missing lazy scene view is supplied to the t0 semantic comparator;
other ten t0 owners are unchanged. All eleven source-owner h2 comparisons remain
unchanged. Rejected rows additionally require the original prestrike history at
t0 and final (no accepted stroke). Every VM must complete error-free.

Original runtime `780872cc…b4de`, actual `d26d7eff…17716c` and expected
`c8d1dca5…49680` remain byte-identical. No gate/source/expected receipt is
relabeled or rebound. The existing expected artifact already contains the
independent raw native authority; the new comparator interprets it explicitly
as `mixed-six-original-t0-native-scene-and-h2-v2` and records per-row derivations
and source/helper identities. This is **original native created t0 plus all11
source-owner isolated h2 at outer0**, not a fabricated original Controller h2
boundary, full-rest result, 1,024 trajectories or performance qualification.

Bounded separate assertion PASS receipt:
`resident-native-artifacts/mixed-six-macro-t0-reference-repair-v1/assertion-receipt.json`,
SHA-256 `da0c02ce7ed5639bf4aebe30923e25ab6c2958b014e84fec92220d45f8972dd3`.
The original assertion exception remains historical evidence.
