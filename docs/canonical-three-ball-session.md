# Genuine three-ball selected-session qualification

This is bounded evidence for the experimental GPU-canonical selected-shot service,
not a three-cushion goal, application migration, or full three-ball release.

## Fixture provenance and scope

`tests/fixtures/canonical-three-ball-source.mjs` starts with the actual
`PhysicsLab.snapshot()` static table geometry and canonical default materials.
It constructs exactly three stationary equal spheres **before** canonical scene
admission, request creation, raw strike packing, and continuation binding. There
is no hidden fourth opponent ball. Stable IDs `[50,8,300]` map to canonical slots
`[8,50,300]`; the cue is slot 1. Rules explicitly use game 3, opponent ID null,
three-cushion scoring, minimum three cushions, and kisses allowed.

The shots are fixed regression inputs, not hardcoded physical outcomes. The
production raw-strike and event engines compute their contacts and full rest.
The fixture helper imports no executable test modules.

## CPU evidence

`node --test tests/canonical-three-ball-session.mjs`

- No-contact shot: REST tick 4504515, 12 selected source records, target mask 0.
- Both-target-contact shot: REST tick 3343649, 78 source records, target mask 3.
- Both have zero cushion contacts and correctly produce compact
  `[100,2,1,0]`: evaluated search failure and gameplay delta zero, not PASS.
- Every selected record preserves the complete three-ball stable-ID roster.
- Source capture is complete and its final boundary equals accepted final state.

## Native service test

`tests/canonical-three-ball-session-native.mjs` executes the real
`createCanonicalSessionService` GPU backend, not an injected fake. It compares
all 256 final-state words, all four compact words, and the selected final source
boundary with the independent CPU execution. It also checks full physical rest,
complete source capture, incomplete arbitrary interior sampling, and invalidation
after cancellation.

Run it separately under the native GPU lock and the 180-second/1500-MiB process
watchdog. The 2026-10-27 run passed on SwiftShader software Vulkan:

- Full 256-word final state and 4-word compact result exactly matched CPU.
- The 78-record source capture completed; final sampled source boundary matched.
- Both targets were contacted, zero cushions recorded, and the three-cushion rule
  correctly returned `[100,2,1,0]` rather than awarding a goal.
- Native test duration: 84.463 seconds; watchdog total: 85.227 seconds.
- Sampled aggregate RSS: 1094.88 MiB; reported max child RSS: 1058.52 MiB.
- Watchdog exited 0 with no stop reason under the unchanged limits.

The separate CPU/default run passed 2 tests with 1 explicit native skip; type
checking passed. These are distinct from the actual native run above.

## Explicit limits

This test uses the qualified MMQ1/no-cushion selected-source profile. It verifies
that touching both targets **without** three cushions does not score. It does not
establish a positive three-cushion goal, repeated cushion support, no-kiss coverage,
full UI controls, the whole exposed parameter domain, or hardware GPU speed.
Cumulative work/event budget enforcement remains explicitly false in the service.
