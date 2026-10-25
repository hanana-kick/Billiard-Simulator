# Settled four-ball next-turn input boundary

This is a separate experimental start boundary, not a relaxation of the original
fresh-fourth input. It is not connected to product UI or prediction services.

## Accepted input

The source-only adapters accept exactly the original controller's
`secondStrikeCreated` snapshot and the observed thirteen-call second-cue creation
journal. The source must have completed its first shot, reached physical rest,
called `finishGameShot`, selected yellow cue object ID 2 (registry index 1), and
actually created the next cue with unchanged default manual settings.

The full byte-verified snapshot supplies four registered, sleeping sphere bodies,
four retained cloth caches, all sixteen fixed colliders, all twenty-four existing
BVH leaves, generation-bearing handles, allocator holes/free-stack order, source
absolute time, and source application steps. Only the three cue bodies and their
three colliders are new. No fourth-sphere mass/cloth birth is invented. No native
h1 or later value enters candidate recurrence.

The snapshot does not serialize pending impulse-joint journal internals. The
actual creation/mutator history is preserved and expanded in source order; its
API inputs are not misrepresented as a direct read of skipped native fields.

## Separate factories, shared arithmetic

- Initialization adds three real cue bodies to the existing manager. When the
  source awake chunk is absent, its allocator creates the next chunk using the
  exact source free-stack/VecMap order.
- Broad phase inserts three actual cue colliders into the existing twenty-four
  leaves. Reused handles are resolved in the source modified-collider order, not
  arena index order. The original 22+5 fresh-fourth branch is unchanged.
- Journal imports all four existing proxies/cloth edges and binds six dormant
  pair owners. There is no pending fourth-cloth birth receipt or birth stage.
- Sleeping floor/cushion configuration has distinct admission factories. It does
  not authorize integration. Source API wake, source observed activation and
  inactive enabled-CCD checks still gate every numerical solve.
- The same four-ball transaction sequencer owns cue, cloth, pair, cushion, scene,
  application events and physical-rest score. Original fresh4 and N3 contracts
  remain distinct.

The source absolute application clock is retained. Candidate `frame` and
`outerStep` are local recurrence counts; `sourceApplicationSteps` tracks the
source absolute outer count. Object ID and registry index are never conflated.

## Remaining limits

Only the separately verified second-turn origin and default cue settings are
admitted. Goal-placement origins and alternate manual controls require their own
source contracts and evidence. Active CCD, simultaneous retained dynamic pairs,
unsupported rigid cue contact and pair/cushion coupled constraints remain
fail-closed. This is not a general GPU world importer, product integration,
browser-hardware or performance claim.

## Verification status

Runtime and adapter syntax checks, exported factory checks, the existing ten
fresh-fourth initialization contracts and five settled native-capture source
contracts passed during implementation. The independently captured actual `secondStrikeCreated` artifact passed four
new input/allocator/origin contracts. CPU-reference and actual WGSL both passed
its first physical h from that snapshot plus the real thirteen-call journal.
The CPU maximum absolute numeric difference was 0; actual WGSL was
2.0424214345537245e-36. Both verified one forced rollback, complete source manager
and allocator state, four cloth caches, six dormant pair caches, sixteen dormant
cushion caches, generation-bearing registry/creation order, first BVH insertion
integer topology, pending-leaf order, game state and absolute time. All four
sphere bodies remain asleep during this first h, as in the actual source.

Evidence used native source boundary hash
`a93473fceb1da27bb580a2981d3e536057eb30856e49d64405ad2b96f8b51e0f`, source time
5.6291666666664275, native step5917 and candidate revision `1dbf642`. Actual WGSL
ran through the native Vulkan WebGPU backend with SwiftShader. It is not a
browser/user-hardware or performance claim.

### Full second-shot verification

On 2026-10-24, the same runtime passed the complete independently captured second
shot on both CPU-reference and actual WGSL. The test revision was `61982df`; the
runtime remained byte-for-byte unchanged from the first-h proof at `1dbf642`.
Each backend compared all 7,083 physical h frames, all 6,642 application outer
steps, the first-h boundary plus 28 decoded native checkpoints, and two forced
transaction rollback probes. The maximum absolute numeric difference from the
original CPU was 4.590196911458122e-8 for each backend, within the unchanged
pose 1e-6 / velocity 3e-6 / cache 2e-6 tolerances. Loaded/disk source hashes were
checked at completion and agree between both runs.

This includes the real sleeping yellow-cue wake, tip contact, cue withdrawal
before h448, both cushion impacts, exact manager/allocator and graph state,
retained contact caches and sleep history, physical rest at absolute time
12.547916666669806, and score result `{cueId:2,delta:0,nextCue:1}`. Native
physical-rest frames preserve the pending game until the original controller
finishes the shot; the candidate's completion is compared with that separately
recorded controller-finished boundary, not a relabeled physical-rest frame.
Only `secondStrikeCreated` and its real creation/mutator journal seed either
backend. Later native frames and checkpoints remain assertion-only.

The full native artifact SHA-256 is
`270000ebe58d2e51f83484917425cb2999425e39a215c2c11620d56d743d591c`.
Reproduction inputs, result counters, log hashes and source hashes are preserved
in `gpu-settled-four-full-proof.json`. The native source was captured twice
independently with matching 7,083-frame second-shot traces and 18 byte-identical boundaries.
This second shot has no red-ball contact, so it does **not** establish sleeping
red-ball wake, a positive score, arbitrary cue inputs, or browser/user-hardware
behavior. Those remain separate genuine-source acceptance cases.
