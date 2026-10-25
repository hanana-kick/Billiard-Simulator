# Browser-safe initial four-ball import

## Verified boundary, not a product switch

`src/browser-initial-import/four-ball.mjs` exposes:

- `projectInitialFourBall({ snapshot, decoded, capture })`: pure initial projection from an existing read-only decoder result and its native bytes.
- `importInitialFourBall(decoder, { snapshot, capture })`: calls only `decoder.decodeSnapshot(snapshot)`, then the same projector.

The admitted boundary is the unchanged original application sequence: the PhysicsLab constructor completes its 72 native settling calls; the controller creates four-ball mode; the controller fires its original default first strike; capture occurs synchronously after `fire()` returns and before the first application h. Defaults remain angle 0, elevation 8, tip X/Y 0, speed 2, dt 1/960 and 64 stroke subdivisions. Default material and cue parameters are explicitly checked. This does not admit arbitrary settings, dragging/placements, later turns, rest snapshots, or any first-h/post-shot result.

The input is **not** a precomputed seed. All physics bodies, collider materials/shapes, mass state, contact caches, broad-phase topology, ordered adjacency, islands, modification queues, joints and hull topology come from the initial native snapshot. Application identity and creation history cannot be recovered from that snapshot and must be observed separately as described below. No fixture label or archived snapshot hash is a production admission key. Object IDs and generation-bearing handles come from the source registry, never guessed from array indices.

No gameplay code, product backend choice, native solver, GPU stepping or UI behavior is changed. The verification establishes import equivalence and existing runtime admission, **not** a complete browser GPU integration or CPU/GPU trajectory test. No production bundle is changed.

## Exact live capture contract

Take `snapshot = lab.world.takeSnapshot()` and a copied application record in one synchronous boundary, before any asynchronous decoding and before the animation loop can step again. `capture` must have exactly:

- `boundary: 'strikeCreated'`, `candidateInput: true`.
- `nativeSteps`: observed native World.step call count, exactly 72. Install observation before the constructor; `lab.steps === 0` alone does not establish this count.
- `apiJournalLength`: actual complete observed API journal length at this boundary. The last strike journal order plus one must equal it.
- `modeCreationJournal`: the three actual mode calls, in order: createRigidBody, createCollider, createCollider.
- `strikeCreationJournal`: the thirteen actual strike calls, in order: createRigidBody, createCollider, createRigidBody, createCollider, createCollider, createImpulseJoint, setContactsEnabled, createRigidBody, createImpulseJoint, setLimits, setContactsEnabled, setLinvel, setLinvel.
- `application`: the following contemporaneous source state, with exact numbers and handles.

`application` has exactly `time`, `steps`, `shots`, `revision`, `dt`, `strokeSubsteps`, `nextId`, `params`, `events`, `registry`, `controller`, `game`, `cue`. Preserve these source fields rather than recomputing them:

1. `params`: the full original sixteen material/gravity/tip/cue/resistance parameters from `lab.params`. `events`: copied source events, currently the single stroke event at time zero.
2. `registry`: `staticCount`, `objects`, `statics`, in original application order. Each object has `index`, `id`, `label`, `kind`, `shape`, `radius`, `mass`, `body`, `collider`, `pairCollider`. Each static has `index`, `label`, `kind`, `body`, `collider`. Handles are `{index,generation}` from the exact bit representation of the source f64 handle, not numeric casts.
3. `controller`: `gameMode`, `selectedId`, `paused`, copied `settings`, `undoCount`, `redoCount`.
4. `game`: the actual `c.game.snapshot()` (`threeCushion`, `cueIds`, `redIds`, `scores`, `activeCue`, `pending`, `lastResult`). Do not construct a replacement scoring state.
5. `cue`: exact source handles `shaft`, `head`, `guide`, `shaftCollider`, `tipCollider`, `neckCollider`, `flex`, `prismatic`; `selectedId`; the full `pose` (`direction`, `side`, `up`, `contact`, `tip`, `rotation`, `shaftCenter`, `surface`); `started`, `contacted`, arrays from `contacts` and `obstructions`, copied `stats`.

Each journal row has exactly `order`, `phase`, `target`, `method`, `args`, `nativeStepsBefore`, `result`, `nativeStepsAfter`. Phases are `modeCreation` or `strikeCreation`; both native counters remain 72. Capture arguments **before** the original method runs. Retain descriptors as `{kind:'descriptor', className, fields}`, native references as tagged kinds with generation-bearing handles, arrays/typed views without narrowing, and ordinary values including undefined and negative zero. Do not invoke descriptor accessors. Calls must retain the original receiver, original argument object references, return result and source order. The journal verifies the default-before-attachment mass state, geometry, local poses, attachment order, actual parent and joint endpoints, and source wake/velocity calls.

`tests/four-ball-created-fixture.cjs` already contains the exact observation patterns in `observeMethod`, `argument`, `objectRegistry`, and `applicationState`. Its full capture function also performs a first h for an oracle; **do not port that continuation** into a live initial importer. Stop after the `strikeCreated` checkpoint. The Node filesystem/artifact/decoder-source helpers are not part of the browser dependency graph.

### Next live integration files and missing work

The next bounded step can observe original methods without changing physics. Add a browser-only observation/capture module and a live browser test harness. Source surfaces are `src/physics.js` (PhysicsLab constructor and native world), `src/controller.js` (`setupGame`, `fire`, selected/settings/history), `src/game-rules.js` (game snapshot), and the reference wrappers above. No formula or gameplay mutation is required to gather the data.

Missing from current product initialization: pre-constructor native-step observation; ordered API argument/result journaling across mode and cue creation; synchronous combined snapshot/application capture before the next h; browser composition with build-pinned decoder provenance/engine/WASM bytes; and a controlled experimental route that hands the resulting seed to one world owner. A capture started only after `fire()` cannot recover the earlier descriptor/default-mass journal. No saved seed, archive, constructor-count guess, or later native state may substitute for those observations. The default initial path needs validation on a genuinely live source instance before product integration.

## Provenance and authority

The browser decoder is the existing read-only WASM bridge. The application must initialize it using its build-pinned official source manifest, pinned WASM hash, actual bundled engine bytes and actual WASM bytes. The projector re-encodes the typed tree, compares every byte to the supplied snapshot, and re-hashes with Web Crypto. Source/engine/version and both native/JavaScript byte-roundtrip checks remain mandatory. Unknown capture fields, unsupported phases/settings, changed generations, altered source journals and hidden post-state inputs fail closed. All input is copied before the first await, including inside the convenience importer.

`experimental-cue-convex-topology.js` gains `exportNativeHullBrowser`. It copies the decoded tree, validates the same provenance/byte bounds, performs a real Web Crypto SHA-256, then calls the **same private extraction/structural validation function and WeakSet authority** as the unchanged synchronous Node exporter. No public boolean, injectable success callback, fake Node globals, global replacement or new authority is accepted. Cloned hulls remain inadmissible. Caller mutation during the hash cannot alter the admitted owned tree.

Load the topology module only once per browser realm: the ESM importer establishes the same global authority used by the existing browser runtime scripts. Do not separately execute the topology file again or structured-clone hulls across a worker boundary; either would create/lose its private admission identity. The test page loads the importer first and excludes topology from its later runtime dependency list. A future bundle must likewise preserve one module instance; this change does not yet alter the product bundler.

## Projection lineage

This port deliberately retains the established projection logic, with browser-native validation and hashing instead of importing Node fixture helpers:

- `four-ball.mjs`: initial-only functions from `tests/four-ball-initialization-seed.cjs`, `four-ball-broad-graph-seed.cjs`, `four-ball-cloth-birth-seed.cjs`, and `four-ball-world-seed.cjs`; explicit source-capture adapter and additional rejection guards.
- `initial-cloth.mjs`: `allBodies`, `registry`, and `flatBalls` from `tests/three-ball-scene-fixture.cjs`, excluding capture/restore/step/oracle helpers.
- `initial-body.mjs`: validation only from `experimental-cue-initialization.js`; no arithmetic execution/runtime dependency.
- `cue-joints.mjs`: descriptor extraction from `experimental-cue-joint-snapshot.js`, retaining exact source shape/mask/phase guards, with owned input and Web Crypto; no solver/preparation formulas.
- `exact-data.mjs`: exact browser data comparisons, full integer-preserving typed projection, SHA-256 and the established tagged sorted f64 journal encoding. Not a Node shim.

The original test exporters remain independent and unchanged. Whole-output comparison includes undefined fields, f64 negative-zero bit patterns, bigint, Uint8Array bytes, all numerical/cache fields and all metadata, not just ball positions.

### Transport-independent native handle representation

The test evidence codec intentionally sorts object keys. Its roundtrip therefore
turns a captured `{index,generation}` into `{generation,index}` without changing
either value. This exposed a real first-h integration rejection: the unchanged
fourth-cloth `bindGeometry` checks native identity with `JSON.stringify`, so the
broad birth's captured handle order differed from the decoder's native order.
World admission alone did not detect that later binding mismatch.

The projector now reconstructs only the explicit registry/cue handles and API
journal reference `handle` fields in its already-owned capture, before hashing
or projection, as `{index,generation}`. Each input must still contain exactly
those two fields and exact unsigned 32-bit integer values (not negative zero).
Unknown fields are rejected rather than discarded, values are never narrowed or
coerced, and subsequent native-generation/attachment checks are unchanged.
Caller objects, unrelated metadata order, typed native trees, numerical data,
sorted-key journal digests, private hull authority and runtime guards are not
modified. Hull provenance's existing extra `bitsHex` field is preserved.

The import regression now uses both a sorted roundtrip of the independent
original record and, when `LIVE_FOUR_BALL_CAPTURE_JSON` plus its explicit
`LIVE_FOUR_BALL_CAPTURE_SHA256` are supplied, an immutable downloaded live
capture. It checks full exporter equality, all projected handle key orders, and
the four exact JSON identity comparisons used by cloth binding, with no native
initialization or physics execution. The live browser harness also imports its
real capture after this transport and verifies the same conditions before any
first h. These checks do not by themselves claim a successful GPU first h.

An old live artifact remains evidence for its recorded source hashes, not for a
modified importer. Independent replay may cite that immutable original input
and the new importer's source separately; a service gate requiring all current
source hashes must instead consume a freshly verified browser artifact, without
silently replacing or ignoring the old hashes.

## Reproduction and observed results

1. Set `FOUR_BALL_CREATION_V8` to the unchanged original canonical creation artifact (default `/tmp/billiard-original-four-ball-created-canonical-v1.v8`). Set `RAPIER_WASM_PROVENANCE` to an admitted decoder build manifest.
2. Run `node --test tests/browser-initial-four-ball-import.cjs`. Six tests pass without initializing/restoring/stepping a native engine. An optional direct Playwright test runs when `RAPIER_TEST_CHROMIUM` is explicitly set. In this sandbox that launcher cannot create its OS socket, so it is skipped in the successful Node run, not reported as a browser pass.
3. Run `node tests/browser-initial-four-ball-page.cjs` with the same environment. Serve the generated `.browser-import-evidence/page` directory on a new localhost port and click **Run initial import checks** in the cloud browser. The page is standalone and uses no Node globals/shims or native physics runtime. No external upload or deployment is needed.

The final source was checked in actual cloud Chromium 155 on 2026-10-24. Native snapshot SHA-256: `cffbc79fdccfc6e763dfa6e72c78d84eca4ba1d050408b7e011192c18bf9413a`. Complete expected/actual seed fingerprint: `0ee42731b1817a5a60e0e9c257aedc775af604f259da8a25260f2ef63d2162f0`. Existing World.validate and shared hull authority pass; five unsupported browser captures reject; synchronous and asynchronous inputs remain unchanged. See `docs/evidence/browser-initial-four-ball-import.json` for the observed result and source hashes.

Only import/admission was run. No heavy native recapture, shader run, physics step, full product UI test, deployment, or user-computer access occurred. Source base was b90f06c; later runtime generalization must rerun this admission harness against its updated dependencies.
