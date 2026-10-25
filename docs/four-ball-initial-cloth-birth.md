# Original fourth-ball initial cloth birth

## Scope and result

This is a bounded, independent numerical component for the original fourth
ball's first cloth contact. It is not a new application physics engine, a
completed four-ball world, or whole-shot CPU/GPU parity.

The candidate initializes only from the original `strikeCreated` snapshot.
Fourth body `19:0`, primary collider `22:0`, and passive collider `23:0` have
no initial BVH proxy or cloth pair/point/recycle cache. The body retains the
actual eager mass/inertia, zero deferred body extent, and unregistered IDs.
No first-h native output is used as a candidate input.

The first gate at implementation commit
`1b0e2405aad0b4149c1123970ccd445e5e6f7b18` passed four tests, including actual
Vulkan/SwiftShader WGSL, in 0.82 seconds. CPU shared arithmetic and actual GPU
both exactly matched all tested nonzero f32 values against the frozen original
native `firstH.postWorld` oracle. Signed zero is treated as numerically equal.
The source artifact SHA-256 is
`b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187`;
the initial snapshot SHA-256 is
`cffbc79fdccfc6e763dfa6e72c78d84eca4ba1d050408b7e011192c18bf9413a`.

Compared fields:

- Newly computed primary AABB bounds, without a fabricated old fat box.
- Local witnesses, normal, local normal, distance, anchors, solver offsets.
- Normal impulse, tangent impulse, warmstart normal/tangent/world caches,
  contact ID, material coefficients, recycle pose, extent and drift limit.
- First-h position, rotation, linear/angular velocity, world inverse inertia
  and effective force produced by the shared numerical solver plan.

The native first-h gap is `0.00004999525845050812`, inside the prediction
distance. The contact is active, but all normal/tangent/warmstart impulses are
zero. The new ball accelerates downward under gravity. Thus this gate proves
initial cache creation and the particular numerical component, not a loaded
friction response. The tangent basis is reused unchanged from the shared
source solver. The native serialized state has normal/tangent cache values,
not the transient tangent basis; zero tangent caches cannot independently
distinguish a wrong basis. Existing loaded-contact component gates remain
necessary.

## Ownership and arithmetic

`tests/four-ball-cloth-birth-seed.cjs` accepts an exact one-key object containing
`strikeCreated`. It verifies the authoritative typed snapshot re-encoding,
snapshot SHA, body/collider projections, and absence of the fourth proxy/pair.
Expected native state is extracted by a separate test-only function.

The runtime descriptor validator is not a cryptographic snapshot verifier.
The hash field alone cannot authenticate a handwritten or edited seed. A
common-world factory must keep the authoritative verified initial exporter or
equivalent private provenance as its source, and cross-check body/configuration
and computed bounds when composing stages. A private receipt proves this
stage's computed result and transaction ownership, not the authenticity of an
arbitrary claimed seed hash.

`src/experimental-four-ball-cloth-birth.js` uses:

1. Existing cue broad-phase shared arithmetic to compute a truly new sphere
   bound. A new leaf uses half the prediction distance, not the enlargement
   reserved for an existing leaf that has escaped its old fat box.
2. Shared arithmetic for cloth extent, prediction/recycle lengths, material
   multiplication and principal inertia inversion.
3. Existing lifecycle prepared geometry for actual absent-to-pair-to-point
   cache creation. The newly computed bound is not called a native old proxy.
4. The unchanged exported world-stepper arithmetic plan for the explicitly
   numerical-only first-h solve. The CPU and GPU execute the same plan; GPU
   work is actual WGSL, not a CPU-hidden shot.

The numerical component intentionally does not call `solvePrepared` with
fabricated `source-observed-awake` or `source-prediction-inactive` labels.
Original sleep and enabled-CCD descriptors stay intact. No native runtime
physics calls occur in the candidate or gate after loading the independent
frozen oracle.

## API and integration boundary

- `createReferenceStage(seed)` / `createGpuStage(device, seed)`.
- `prepare()` returns an opaque private geometry receipt.
- `solveNumericalComponent()` returns a distinct opaque numerical receipt.
- `readReceipt(receipt)` returns a copy for inspection.
- `assertReceipt(receipt, stage, backend, phase)` checks the live exact origin,
  transaction, backend and phase. Clones, cross-stage receipts, aborted retry
  receipts, and committed receipts are rejected.
- Optional `claim(token)` / `release(token)` ownership uses the token as the
  sole argument to prepare/solve/commit/abort. Otherwise no external arguments
  are accepted. No per-step native data injection is supported.
- `commit()` completes only this numerical component, not the world.

Every receipt states `globalTransactionBound: false`, `activationOwned: false`,
and `postCollisionManagerComplete: false`. Reading or editing a returned copy
cannot change private identity. This implementation does not modify Init,
Journal, broad-phase, scene activation, lifecycle, or authoritative app code.
It does not clear their pending-fourth-cloth guards.

The common world owner must still:

1. Bind the genuine cache receipt to the exact live Journal transaction, not
   merely the same snapshot hash/handles/backend. This prevents same-sequence
   aborted-retry replay. The initial allocation is dense edge 5, lifetime 6.
2. Check the cache's computed bounds against the owned five-insertion BVH and
   graph transaction. Shape inputs come from initial cloth/sphere descriptors.
3. Feed the *pre-solve* geometry state's unchanged pose/velocities into the
   actual six-dynamic-body scene force/energy scan, install the source contact
   link and activation transition in global order, and check enabled CCD.
4. Solve under that authentic global admission, write back solver-body/color/
   graph metadata, finalize the source queues/manager, and commit atomically.

The standalone numerical receipt is not sufficient authorization or evidence
for any of these steps. The existing Init/Journal pending guards remain closed.

## Live transaction binding extension

The adapter also supports an explicitly coordinated common-owner path:

1. After `prepare`, call `bindGeometry({projection, transaction}, token)` with
   the genuine current Journal projection and broad transaction. The adapter
   calls the real Journal private-identity validators, requires source snapshot
   identity, sequence 0, inactive edge 5/lifetime 6 and exact own computed bounds.
2. `assertBoundGeometryReceipt(receipt, transaction, backend)` is the Journal
   consumer's validator. Its opaque proof retains that exact transaction, not
   merely a hash, handle, copied cache, or phase label. Either-side abort, a
   cloned identity, cross-origin transaction, or wrong backend fails.
3. The Journal consumer must separately accept the actual geometry and create
   the source transition/link. Binding alone does not clear a pending guard.
4. Only after the same Journal transaction is in its narrow phase with that
   edge active may `solvePrepared(admission, token)` run. It delegates the exact
   existing claimed lifecycle stage, rather than the standalone numerical
   diagnostic. The common world owner remains responsible for obtaining the
   supplied activation and enabled-CCD admission from its actual stages; this
   adapter does not claim to authenticate scene results or finish the manager.
5. `assertPrepared(token)` while both stages are live records a private
   precommit assertion. After all common-owner assertions pass, commit Journal
   first (it still needs the live cloth proof), then `commit(token)` here. The
   adapter accepts only that exact committed, still-current Journal head with
   its earlier private assertion. A later transaction or either-side abort
   cannot use this exception. Preparation, solving and receipt consumption
   still require a live pending graph transaction.
6. `takeContinuation(token)` transfers the exact committed lifecycle object
   from its private lease to the common owner's lease. No reconstructed native
   state or replacement cache is needed. The receiving owner must eventually
   release and dispose that lifecycle. The birth adapter relinquishes it.

`initialState()` is available after geometry preparation and returns the own
computed *absent* configuration. `snapshot()` returns own committed numerical
state. The earlier standalone geometry receipt stays unbound permanently;
`solveNumericalComponent()` cannot run after binding. The extension alone does
not modify the Journal acceptance path or Init finalization.

## Reproduction

Use the pinned local decoder and native WebGPU module. No downloads are needed.

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
FOUR_BALL_CREATION_V8=/tmp/billiard-original-four-ball-created-canonical-v1.v8 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
REQUIRE_WEBGPU=1 \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node --test --test-concurrency=1 tests/experimental-four-ball-cloth-birth.cjs
```

First gate log: `/tmp/billiard-four-ball-cloth-birth-gate1.log`.
Runtime, test, exporter and artifact SHA-256 values were unchanged before/after
that run. The final frozen implementation
`532055f093fb47859bca8c747cf80b9a1d30e212` passed the same CPU/native-oracle and
actual WGSL gate: **4 passed, 0 failed, 0 skipped**, in 0.727 seconds.
`/tmp/billiard-four-ball-cloth-birth-gate2.log` records the exact command, frozen
commit, and equal before/after SHA-256 hashes for source, both test files,
documentation and the unchanged original artifact. This later evidence adds
the plan-size/prediction negative guards; it does not broaden the numerical
component's ownership or first-h scope.

## Integrated creation-component check

Local integrated revision `12c8ce3` ran `tools/run-four-ball-birth-components.cjs`
with the same verified original creation artifact for initialization, broad/graph
birth and cloth numerical birth. The serialized native/actual-WGSL gate passed
26/26 tests, with zero skipped tests. The runner rejects missing native/GPU inputs
or different artifacts between stages. Its own two launch-contract tests passed.

This checks the integrated component source tree, not a combined world recurrence.
Scene activation, authentic live transaction binding and a complete four-ball shot
remain separate acceptance gates. Software Vulkan SwiftShader was used; no hardware
GPU performance or Samsung-device claim follows from this result.
