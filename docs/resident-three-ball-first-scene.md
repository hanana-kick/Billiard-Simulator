# Genuine three-ball first-collision scene step

## Executable boundary, not a whole-h claim

`src/resident-candidate/three-ball-scene-first-collision.mjs` adds:

- `createThreeBallFirstScenePlan(brandedOwnerTemplate)`;
- `generateThreeBallFirstSceneWGSL()` / distinct
  `rc_scene_three_first_collision` entry;
- `executeThreeBallFirstSceneForTest(plan, {testOnly: true})`;
- local plan validation and a test-only interpreter of the **same emitted**
  integer kernel text.

The endpoint is exactly
`live-three-ball-collision-and-connectivity-complete-pre-energy`:
created registration has completed, the authentic current first collision is
owned, consumed body/collider flags are cleared, original joint unlink/removal
bookkeeping is accounted for, and actual scene incidence is installed.
**No force/energy scan, joint solve, physical integration, application commit,
whole h or runtime evaluator executes.** The consumed body queue intentionally
remains present at this source finish boundary; ordinary scene frame application
consumes it later. It is not prematurely cleared to resemble a later endpoint.

Counts and identities are genuine: 22 bodies, five dynamics (three spheres plus
shaft/head), 25 colliders, two joints, three existing floor edges. The 48-word
adapter has exactly three edge rows. No fourth sphere/contact or borrowed
four-ball admission is used.

## Authenticated current dependencies

The public execution helper accepts only a locally sealed plan and exactly
`{testOnly:true}`. It accepts no later pose, collision trace, numerical output,
expected state or caller-provided journal. Every invocation starts from original
t0 and runs this bounded **HOST source-component** prefix privately:

1. Original cue `createReferencePreWorldStage` with explicit
   **`original-js-number-v1`**, then **`prepareApplication`**. This preserves the
   original Number/f32 order and defers the joint solve. It is not the convenience
   first-step/full-h wrapper, nor the legacy double-single profile.
2. Existing authentic live-three broad owner and contact-journal owner, with a
   private lease and current source-branded receipts. The original rigid cue
   guard checks all **54** real source-filter pairs.
3. Actual source floor geometry preparation for awake spheres; sleeping sphere
   contacts retain their original source caches. Constructor fixtures are **not
   assumed asleep**. The admitted first-scene profile requires unchanged three
   floor activities and only inactive cue appends.
4. `assertInitialLiveThreeBallCollisionOwned` authenticates the current narrow
   receipt while its source owner is still pending. The mechanical journal
   transport preserves its exact dense IDs, generations, lifetimes, revisions,
   append order, adjacency and logs. All source stages are aborted/disposed after
   obtaining this bounded component evidence—nothing commits a physical h.
5. The resident registration interpreter runs the unchanged existing numerical
   initializer and exact generic scene initializer from the sealed original
   inputs. Its full registration result must equal the established source
   initializer before the distinct scene kernel executes.

Source-expected output is returned only as **test diagnostics**, never fed to
registration or scene word packing. No original future/native endpoint array
is accepted as initial or current owner data.

This closes a bounded source scene-adapter step, **not** resident generation of
its collision dependencies. The current broad/guard/floor/journal inputs remain
HOST source-component test outputs; complete resident geometry, energy and
world scheduling remain separate missing links.

## Source differential and native evidence are separate

The entire initialized result—raw body fields, all colliders, manager maps,
free queues, IDs, flags, joint event journal and mutation queues—matches
`Init.finishLiveThreeBallCollisionPhase` on the actual branded source receipt.
The complete mutable scene context matches `Scene.createReferenceStage` at that
same genuine-three source boundary. The emitted generic scene incidence code
is reused unchanged.

No exposed original/native internal first-collision or registration snapshot
hook was found in the current decoder/tool interfaces. A post-first-h native
snapshot would be a **different boundary** and is not used as a substitute.
Therefore:

- `nativeRegistrationBoundaryVerified = false`;
- `nativeFirstCollisionBoundaryVerified = false`;
- `physicalSteps = 0`, `numericalEnergyEvaluated = false`;
- `wholeH = false`, `gpuQualified = false`, `runtimeIntegrated = false`.

The independent original native t0/zero-step fixture checks from the preceding
seed/registration work remain valid; source-owner equality here is not native
internal-boundary parity. PhysicsLab's outer-step-latched subdivision semantics
are still not claimed by this pre-energy adapter.

## Enforceable unsupported profile

Reject, rather than return a gameplay MISS:

- unbranded/copied/mutated/detached initial plans or extra input options;
- anything other than the actual 22/5/25 registry and three original active
  sphere/floor contacts;
- initial compliant tip touching/birth/removal, selected-ball mutation or joint
  solve instead of the deferred preparation boundary;
- unresolved rigid cue exclusion, new non-cue edges, floor activity changes,
  active cue contacts, removals, collision operations/events or additional
  manifold/contact owners;
- incorrect source generations/parents/cue tags, sequence/revision/lifetimes,
  incomplete numerical initialization, wrong consumed creation queues or
  replay of the already consumed boundary;
- arbitrary general removal-connectivity work instead of the original cold
  cue-joint unlink journal.

The kernel binds original cue role slots, including generation-3 recycled
handles, rather than assuming raw body indices 19/20/21 or initial collider order.

## Tests and unchanged four-ball bytes

`tests/resident-three-ball-first-scene.mjs` uses the independent original fixture
producer for both cue selections plus the immutable ready-world next-shot input:

`THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture`

Actual new inactive cue edge counts are **2 / 0 / 0** for selected-1,
selected-2 and after-turn respectively. They are observations, not programmed
outcomes or invented required contacts.

Final sequential HOST validation: **14 passed, 0 failed, 0 skipped** (~16.2 s)
across registration, owner composition and first-scene suites; the first-scene
suite contains **5 passing tests**. The source kernel tests cover full source differential and negative generation,
roster, activity, clock, queue, injection and replay cases. Separate regression
checks require the old four-ball encoder to keep rejecting three floor edges
and compare complete emitted source SHA-256s against the pre-change `d1be2a3`
checkpoint:

| Existing generator | SHA-256 |
|---|---|
| scene activation | `6563bcf5be0ed2877c60d7f7a3ef9ebf71f7a6e1c689b0825176fc07299734a8` |
| scene initialization | `a84a5bfca1dbc688986834f931cbdf58f4b032c0b06db2d6f158b8752149bb05` |
| scene world | `9f7a4465c20e33a8a73928cceff5e045d47f1fdc10d64f7bdfc1b9b9c987a0c0` |

No existing four-ball emitted source or default is modified.

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
THREE_BALL_LIVE_CAPTURE_PREFIX=/tmp/three-ball-live-evidence-20261025/capture \
node --test --test-concurrency=1 tests/resident-three-ball-first-scene.mjs
```

The process-local temporary directory is disk backed; the historical `/tmp`
fixture path is preserved. No GPU, fullshot, long multi-h replay or publication
is part of this step.
