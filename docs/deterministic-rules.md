# GPU-canonical integer RULE reducer (v1)

`src/direct-candidate/deterministic-rules.mjs` supplies ordinary u32 WGSL
`rule_init`, `rule_event`, `rule_status`, and their JavaScript mirror. No numeric
VM, original physical replay, trajectories, or physics changes are involved.
This is a **standalone conditional rule reducer**, not a qualified full-shot
simulation or a live application integration. Exact RULE words do not establish
physical producer accuracy, contact completeness, or CPU/GPU physics parity.

## Producer contract

Input is an ordered sequence of `[kind, subjectSlot, flags, tick]` u32 words.
Stable body slots are 0–31; config assigns the two scoring targets and opponent.
For four-ball, targets mean the two reds, **not their required gameplay order**.
For three-ball, targets mean the other two objects, including the opponent cue.
Only contacts involving the selected cue enter this ABI; ignore other pairs.

| Kind | Meaning |
|---|---|
| 1 OBJECT | Resolved cue/object contact episode, subject is other slot |
| 2 CUSHION | Resolved cue/cushion contact episode |
| 3 FLOOR | Resolved cue/floor contact or independently validated off-table foul |
| 4 KISS_SAMPLE | Other sphere slot; flags bit 0 positive impulse, bit 1 validated separation |
| 5 REST | Producer certifies **all bodies physically at rest and cue absent** |
| 6 BUDGET | Continuation stopped without physical completion |
| 7 UNSUPPORTED | Physics/event production incomplete or unsupported |
| 8 AMBIGUOUS | Source route-only same-tick ambiguity; gameplay contact emission order remains known |
| 9 CUE_OBSTRUCTION | Validated cue obstruction (search constraint only) |

If physical ordering itself is unproved (and could change gameplay cushion freezing),
emit UNSUPPORTED, not route-only AMBIGUOUS.

Ticks are non-wrapping ordered physical observation times. Equal ticks denote
one source-equivalent observation boundary; caller must preserve source grouping,
deduplication and ambiguity semantics. Samples through the goal tick can reject
a kiss-free search; later kiss samples cannot. REST is terminal; no subsequent
physical events are allowed. BUDGET is not physical rest and may be followed by
an explicitly resumed valid continuation. Invalid/unknown events yield unsupported.

`OBJECT` / `CUSHION` mean admitted rule-contact episodes, **not each solver
iteration, positive impulse, or overlapping endpoint**. The existing game's
`physics.js` contact journal filters collision starts (including early/small cloth
contacts and repeated keys in the last eight events within 120 ms). The fixtures
feed identical already-admitted streams to `game-rules.js`; they do not establish
that a new physics producer duplicates that presentation journal. A canonical
GPU producer must explicitly own and validate its resolved-episode contract.
Do not blindly transplant presentation debounce into the new physical law.

Kiss observations are a distinct raw physical channel, as in
`optimizer-core.js:samplePhysicalKisses` and `route-rules.js:observeKiss`.
Validated separation means gap **strictly greater than 0.00005 m**, not a missing
contact callback. Separation clears active *before* testing impact. First touch
of an already-moving object is not a kiss. Repeat impulses while active are not
new episodes. No-kiss search without `kissFacts:true` returns unsupported; setting
that capability is a producer attestation of complete validated observations,
not a way to convert a contact-only stream into a no-kiss proof.

The prepared axial pair producer currently does not provide a complete cushion,
floor/off-table or kiss channel. No adapter or full-shot approval is supplied here.
A rest result from a restricted physical profile alone does not authorize claiming
general gameplay validity.

## Configuration and outputs

Use `packRuleConfig`. Twelve words: game (3/4), first target, second target,
opponent, optional four-ball three-cushion, search enabled, method, minimum
cushions, allow kiss, complete kiss-facts capability, condition-only query, reserved.
Supported search methods: carom, direct, any, bank1, bank2, bank3. Other named
methods require rail identity/topology not present in this ABI and return
**unsupported search**, not partial/fake classification. Gameplay can still finish.

Twenty state words:

0 target mask; 1 total cushions; 2 cushions frozen at second distinct target;
3 gameplay foul; 4 kiss seen mask; 5 kiss active mask; 6 kiss count;
7 search first seen; 8 search goal seen; 9 search invalid;
10 search cushions frozen at goal; 11 pre-first cushions; 12 post-first cushions;
13 certified rest; 14 unsupported bits (physical=1, search=2); 15 ambiguity;
16 search goal tick; 17 budget encountered; 18 gameplay status; 19 search status.

Statuses: 0 pending, 1 pass, 2 fail, 3 incomplete, 4 unsupported. Positive gameplay
and positive search require REST. Only a condition-only **search** (not a gameplay query) with an exact
irreversible failure can report FAIL without rest; no claim of final gameplay
score follows. Budget/unsupported never imply miss. `gameplayDelta` returns null
until a supported complete gameplay result, otherwise four-ball -1/0/+1 or
three-ball 0/+1. Unsupported search cannot contaminate gameplay.

Four-ball uses unordered redmask and frozen second-red cushion count, and watches
opponent/floor fouls after a route goal. Three-ball allows the opponent cue as a
target, requires three cushions at the second target, and gives zero for floor
foul. A late three-ball floor event invalidates gameplay but not an already-latched
legacy route search goal; the two statuses are deliberately distinct. Search order, kiss prohibition, route prefix, ambiguity and cue obstruction
are separate from gameplay. Caller must provide a complete physical stream to
rest even after route success. All counters/ticks must fit u32; cushion overflow
is explicitly unsupported. The intended finite fixture/shot stream is far below
u32 count limits.

## Verification

`node --test tests/deterministic-rules.mjs` compares identical synthetic admitted
event streams against the repository's actual pure game/route/kiss functions.
Native parity additionally runs:

```
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 node --test tests/deterministic-rules.mjs
```

The GPU test compares every state word, using the trusted native backend. These
are reducer tests, not source-physical replay, browser UI, or full-shot qualification.

Verified native run: 400 fixture rows / 8,000 state words, exact CPU/GPU equality.
Additional CPU regression checks cover resumed budgets, route-only ambiguity and
late three-ball floor divergence between gameplay and latched route search.

## Validated host boundary and negative gameplay proof

`validateRuleConfig(config)` is the shared required gate before CPU reduction or
native upload (the native harness uses this same function). It accepts exactly
12 Uint32Array words; checks game3/4, slots0–31, distinct targets, four-ball
opponent distinct from targets, boolean words0/1, recognized method code or the
explicit unsupported sentinel0xffffffff, and reserved word0. Three-ball opponent
may be a target. `packRuleConfig` rejects explicitly supplied nonboolean flags
(including null/undefined/NaN) rather than silently coercing them. Omitted flags
retain documented defaults. Unknown method names produce the unsupported sentinel.
Low-level WGSL functions require a host-validated config; they are not an
untrusted binary input parser.

`gameplayFailureProof(config,state)` / WGSL
`rule_gameplay_failure_proof(state,config)` return u32 1 for a supported monotonic
gameplay foul, otherwise0. They work with search disabled and do not mutate state,
publish final gameplay status, or assign a final score. A four-ball opponent
contact or either game's floor foul proves no positive gameplay score is possible;
three-ball opponent contact alone does not. Unsupported physical state and an
uncompleted budget marker suppress the proof. Unsupported *search* alone does not.
The caller may consume this only for an explicitly condition-only query. Normal
gameplay must still simulate to validated physical rest; delta remains null
before rest. Producer cancellation, failure and resource status take precedence;
a proof is not permission to suppress or relabel those statuses.

Only actual certified physical completion may emit REST. An unsupported producer
failure is sticky and cannot be repaired by appending REST. A BUDGET marker can be
followed by REST only after a genuine explicitly resumed physical continuation,
never by a convenience finalizer or cancellation handler.

Follow-on validated native run: 413 fixture rows / 8,673 words (20 state words
plus one gameplay failure-proof word per row), exact CPU/GPU equality; 8/8 tests
passed with the trusted module and SwiftShader backend. No full-shot claim.
