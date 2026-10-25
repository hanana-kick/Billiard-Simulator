# Explicit yaw15 parity experiment

Status: frozen `307e23e217dbacd26cbac96b599e09dfba684293` passes the stricter support-bound termination gate: 21/21 query/manifold/guard tests, 6/6 original first-h plus fixed yaw15 450-h tests, and 3/3 unchanged angle0 450-h tests, all without skips. Both recurrence gates compare independently initialized scalar and actual WGSL owners against native. The earlier `8a398fd` measurements and subsequent source-null review finding remain below as history. This is initialization-through-cue-withdrawal/time-grid evidence only, not whole-shot or arbitrary-angle support.

## Fixed contract and scope

Only one new named fixture is admitted: `original-three-ball-yaw15-centered-elevation8-speed2-v1`. It retains all original constructor placements and all three balls, selects body index0, and changes only azimuth from0° to15°. Elevation remains8°, speed2, and tipX/tipY0. The constructor's72 native settling steps are unchanged, with no extra application settling, body removal, movement, clearance override, or parameter scan. Original `src/physics.js`, `src/math.js`, and the official engine bytes are unchanged.

The legacy angle0 contract remains valid without extra metadata. Yaw15 requires its exact name, selected index0, exact settings and the unchanged JS-double source axis. No general-angle admission is introduced. The initial broad-phase exporter also requires the same marker on the record and cue application; its existing strict angle0 assertion remains for unmarked records, and it validates admission before decoding. All existing source/graph identity, contact, cue withdrawal, mass, CCD, body registry, and transactional guards remain active.

`tests/three-ball-yaw-fixture.cjs` captures the unchanged PhysicsLab created state, then independently recreates the same native scene and records its progression through compliant contact, cue withdrawal, the source64→1 subdivision switch, and exactly two ordinary1/960s steps. The creation and independent replay first-h snapshots must be byte-identical. The artifact has a mandatory sidecar pinning settings, layout, selected body, engine0.21.0 and Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`, source hashes, decoder binary hash, Node/V8 versions, snapshot identities, payload digest and length. Capture is explicit and never overwrites an existing artifact; loading never implicitly captures.

The complete25-collider candidate starts only from created state. It owns all three ball components, cue joints, energy/activation state, broad-phase and dense contact graph, then withdraws to22 colliders. Expected native frames are assertions, never recurrent candidate state. Every h compares body poses, velocities, inertia, source time and contact events; decoded checkpoints additionally compare contact caches, joint impulses, exact graph/adjacency, live colliders, proxies, island manager, flags, IDs and modified queues. Existing tolerances are retained: poses1e-6, velocities/inertia3e-6, caches/joint impulses2e-6. No adapter or missing artifact is a skipped success.

This gate does not establish whole-shot support. The world still admits only the existing body0/body1 dynamic pair and rejects unsupported contacts transactionally. A later yaw15 contact with another pair must fail rather than be bypassed. No assertion here implies final rest, arbitrary yaw/elevation/tip, four-ball, active CCD, or general GPU/CPU equivalence.

## Initial 432e6c4 admission boundary (preserved)

- Native replay:450 internal h,77 touching h, one cue withdrawal at h443, then the rest of the active64-substep outer step and exactly two ordinary h. Final physical time is0.009374999999999979s. The independently recreated first-h snapshot equals the creation probe byte-for-byte.
- Payload:2,753,610bytes; SHA-256 `6214cc2a44fb9f152399f02b49412f2f8ce88bc6a6fb8fb025bbe499a63f2b58`; created snapshot SHA-256 `878f9c8eb6c92959ae4f940d7d5b482b672a26549d6d2e17af03552a41d557b3`.
- Default angle0 first-h regression: scalar/native and actual WGSL both pass.
- Yaw15 owner: first attempted h1 fails with `CUE_RIGID_CONTACT_NOT_EXCLUDED`, Cylinder collider22 generation0 against left-rail collider5 generation0. Separation residual is−0.024012284353375435; the candidate remains frame0/time0/cueElapsed0. No state was committed or substituted.
- The existing conservative guard tests world axes and each shape's rotated principal axes. Its inability to prove separation is not an assertion of actual collision. The independently decoded native h1 graph has rail/shaft edges5→22 and6→22, both inactive, and only the three cloth edges active. This source evidence does not authorize bypassing the guard.
- Yaw15 actual WGSL: not run, blocked by the scalar/native prerequisite. Later pair/cushion support and final rest remain untested.

Isolated evidence files: `/tmp/billiard-yaw15-native-through-switch-20261024.v8` with mandatory `.json` sidecar, `/tmp/billiard-yaw15-native-capture-20261024.log`, `/tmp/billiard-yaw15-serial-gate-432e6c4-20261024.log`, and `/tmp/billiard-yaw15-full25-through-cue-cpu-failure.json`. The serial gate terminated with exit1: two default physics checks and two guard checks pass; the yaw15 scalar test fails and its dependent GPU test fails before GPU execution. Source integrity checks pass. No source equation or tolerance changed.

## Reproducible serial commands

Run from the isolated worktree. These commands need the coordinator's serial native/GPU slot. They do not build native software or use a browser.

Capture:

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
node tests/three-ball-yaw-fixture.cjs /tmp/billiard-yaw15-native-through-switch-20261024.v8
```

Capture stops after the native cue withdrawal, the remaining substeps of that already-started outer step, and two ordinary source steps. It has a1280-internal-step failure bound inherited from the unchanged capture helper, not a selected passing endpoint. The actual frame count and physical horizon must be reported from the artifact.

Regression and new full-owner gate, serialized:

```sh
RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 \
YAW15_REPLAY=/tmp/billiard-yaw15-native-through-switch-20261024.v8 \
node --test --test-concurrency=1 \
  tests/experimental-cue-created-stroke-stage.cjs \
  tests/experimental-three-ball-yaw-through-cue.cjs
```

The first file retains the original angle0 first-h scalar/native and actual-WGSL regression. The second file compares the yaw15 complete owner through exactly the recorded native withdrawal/time-grid horizon, with scalar/native success required before the actual-WGSL test. A failure is reported at its first failing h; no native checkpoint replaces the candidate state.

Lightweight admission/exporter checks, without executing native or GPU physics:

```sh
node --test tests/parity/cue-created-variant.cjs tests/parity/yaw-replay-contract.cjs
```

## Attribution

The new variant module is admission metadata, not new physical equations. Existing source-port modules retain their Apache-2.0 SPDX headers and Rapier attribution. `vendor/RAPIER-LICENSE.txt`, GLAM/GLAMX notices, LIBM notices, and `THIRD_PARTY_NOTICES.txt` remain intact. No dependency, binary, source revision, or license has been replaced.

## Verified precise-query continuation

The fixed two-pose diagnostic was authorized and completed without world steps or pose changes. For shaft22 versus left-rail5, original native and the existing `experimental-cue-obstacle-contact.js` source-derived query agree exactly in distance, points and normals. Created distance is0.07060866802930832m; h1 distance is0.07060865312814713m. Both return no proximity at the unchanged f32 sourcePrediction+BAND margin0.00016150000737980008m. The fixed0.1m query range was diagnostic only and is not used by the candidate guard.

The guard retains all54 original collision-filter pairs and its existing fast-axis graph. Only ambiguous cylinder/fixed-cuboid-or-native-convex pairs may invoke the existing source GJK/EPA query, on the same backend as the world. The query uses current owned body rotations and centers composed by the same-backend fast graph from current body/local transforms. Original hull point order, groups, source prediction, exclusion band and all phase guards are unchanged. Only an explicit completed support-bound receipt may admit. Source null by itself is inconclusive. Actual contact, a GJK cap or EPA failure, incomplete output, unsupported shape/pair, or backend mismatch rejects. The native query is oracle-only and never called by the candidate.

The focused tests require zero precise fallbacks for the original angle0 created/h1 poses, successful precise proof for yaw15 created/h1, continued rejection of forced cloth and other-ball contacts, and the earlier synthetic thrown/incomplete-query checks, which did not cover source-null failure exits. The metadata revision below replaces those inadequate checks with actual shared-code status-branch regressions. Actual WGSL must report positive GJK/EPA dispatch/readback counts for the yaw15 ambiguities. The focused native/CPU/actual-WGSL tests and the 450-h candidate replay pass on frozen `8a398fd`. The actual WGSL checks execute 259 GJK/EPA dispatches with readback for each two-pair refinement; these are correctness evidence, not an acceleration claim.

The successful serial gate has two phases and stops if the focused guard gate fails:

```sh
export RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder
export GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js
export VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json
export REQUIRE_WEBGPU=1
export THREE_BALL_CREATION_V8=/tmp/billiard-v3-cue-three-ball-creation-registry.v8
export YAW15_REPLAY=/tmp/billiard-yaw15-native-through-switch-20261024.v8
export YAW15_FAILURE_PREFIX=/tmp/billiard-yaw15-precise-query-through-cue
node --test --test-concurrency=1 tests/experimental-cue-rigid-exclusion.cjs tests/experimental-cue-rigid-yaw-exclusion.cjs && \
node --test --test-concurrency=1 tests/experimental-cue-created-stroke-stage.cjs tests/experimental-three-ball-yaw-through-cue.cjs
```

The focused native-query oracles intentionally include the existing negative fixtures: tip lowered into cloth, shaft lowered0.15m through cloth, and another ball placed inside the shaft. They are guard rejection tests only, never replacement shot settings or candidate recurrence seeds. The final replay remains the original fixed yaw15 scene and450 recorded h. Failure paths use a distinct prefix to retain the original432e6c4 first-h evidence.


## Historical 8a398fd gate evidence

- The independent oracle artifact remains unchanged. Native capture was not repeated or replaced to obtain a passing result.
- Focused guard suite: 8/8 pass. Original angle0 created/h1 uses all 54 fast proofs, zero precise fallbacks, and zero precise GPU dispatches. Yaw15 created/h1 uses 52 fast proofs and two same-backend source-query proofs for shaft22 against fixed rails5/6. Actual contacts, unsupported sphere pairs, and synthetic thrown/incomplete responses rejected in this historical gate. That did not establish rejection of GJK-cap or EPA-failure null results; the later review and fix below address that gap.
- Recurrence/regression suite: 6/6 pass. The original angle0 first-h scalar/native and actual WGSL regressions pass; yaw15 scalar/native and actual WGSL each complete 450 h with 12 decoded checkpoints. Each backend's maximum absolute error is 1.7025832854677958e-8. There are 77 touching h, cue withdrawal at h443, and exactly two ordinary h, ending at 0.009374999999999979 seconds.
- Exact graph/adjacency, live25→22 collider lifecycle, source clock, contact events, manager, flags, IDs and modified queues pass; body/contact/joint tolerances remain unchanged. Loaded/disk source-byte integrity checks pass. The candidate never receives a future native recurrent state.
- No failure occurs within this tested horizon. Later dynamic pairs, later cushion contacts, final rest, arbitrary settings, active CCD, four-ball support and performance gains remain unestablished by this gate.
- Complete command output: `/tmp/billiard-yaw15-precise-serial-gate-8a398fd-20261024.log`. The process exited0. No new native capture or horizon extension followed it. The earlier conservative-admission failure remains in its original evidence files above.


## Source-null ambiguity correction (revalidated on 307e23e)

Pinned Parry `gjk.rs` returns `NoIntersection(Vector::X)` at 100 reductions. Its support-map contact wrapper also returns that result when EPA returns no witness after failure. The port correctly preserves those contact-query semantics, but they cannot authorize a rigid-cue separation proof. The prior test injecting an exception did not exercise either source-null path.

The revised Query API preserves `queryReference` and GPU contact/null values. `queryReferenceDetailed` and GPU per-query `terminations` additionally report why the query ended. Only actual `min_bound > prediction` emits reason1 with its strict f32 lower bound. GJK cap, each of the four EPA miss predicates, and zero/uncompleted output are distinct non-proof statuses. The guard uses the same `isSeparationProof` predicate for both backends and retains the unchanged margin, collision filters and fail-closed transaction behavior. No production method accepts test scratch states.

Pure tests now execute the real shared branch code: one GJK reduction at counter99 reaches the100-cap transition; EPA heap-distance, empty-heap, empty-silhouette and no-new-face predicates each produce their source null and a non-proof receipt. These are deliberately algorithm-control-state fixtures, not a claim that a natural scene required100 iterations. Valid strict support separation, actual contact, finite/exact-margin requirements, and zero output are also tested. The previous fake-throw test is removed.

Completed serial revalidation on frozen `307e23e`, with the same exported environment and oracle artifact as above and `YAW15_FAILURE_PREFIX=/tmp/billiard-yaw15-termination-proof-through-cue`:

```sh
node --test --test-concurrency=1 \
  tests/experimental-cue-query-termination-gpu.cjs \
  tests/experimental-cue-obstacle-contact.cjs \
  tests/experimental-cue-obstacle-manifold.cjs \
  tests/experimental-cue-rigid-exclusion.cjs \
  tests/experimental-cue-rigid-yaw-exclusion.cjs && \
node --test --test-concurrency=1 \
  tests/experimental-cue-created-stroke-stage.cjs \
  tests/experimental-three-ball-yaw-through-cue.cjs
```

This verifies actual WGSL termination/control branches and readback first, retains the independent native query/manifold contact suites after metadata-only shared-core changes, then repeats the old0-degree and fixed yaw15 guards before the unchanged450-h recurrence. It does not recapture, extend the shot horizon, change settings, or claim a speedup.


## Final 307e23e gate evidence

The source was fixed at `307e23e217dbacd26cbac96b599e09dfba684293` throughout all three serial phases. All processes exited 0 with no skips. The original independent yaw artifact, original angle0 fixtures, native decoder, engine bytes, and tolerances were not changed or recaptured.

- Query/manifold/termination/guard phase: 21/21 pass. The actual shared GJK 99→100 cap and each of four EPA miss predicates retain source null but emit non-proof receipts on both scalar and actual WGSL. Each WGSL control-branch fixture executes two dispatches with readback. Zero/uncompleted output executes no dispatch and cannot prove separation. These remain test-only algorithm-control-state fixtures, not claims about a naturally cap-reaching scene.
- Independent native geometry regression: 386 actual-WGSL query cases with 1,813 dispatches and 578 actual-WGSL fresh manifold cases with 1,016 ordered points and 2,590 dispatches retain measured distance/point/normal maxima of zero. Contact values, IDs, point order and original source-null semantics remain intact after metadata-only changes.
- Original angle0 created/h1 guard: all 54 pairs use the unchanged fast proof; there are zero precise fallback queries or precise GPU dispatches. Fixed yaw15 created/h1: 52 fast proofs and two positive support-bound proofs, with 259 actual query dispatches/readback per GPU check. Scalar/GPU lower bounds match exactly: created rails5/6 are 0.03434102237224579 and 0.02609771490097046; h1 rails5/6 are 0.034341201186180115 and 0.026098042726516724. All strictly exceed the unchanged exact f32 margin 0.00016150000737980008. Native-contact and unsupported-pair negative fixtures continue to reject.
- First-h plus yaw recurrence phase: 6/6 pass. Original angle0 first h passes scalar/native and actual WGSL. Both yaw15 owners complete 450 h, each with maximum absolute error 1.7025832854677958e-8, 77 touching h, withdrawal at h443, 12 decoded checkpoints and exactly two ordinary h. Final time is 0.009374999999999979 seconds.
- Additional unchanged default recurrence phase: 3/3 pass. `tests/experimental-three-ball-shared-graph-through-cue.cjs` completes the original angle0 full25→22 450-h gate on both scalar/native and actual WGSL. Each backend has maximum absolute error 2.815995547855721e-9, 77 touching h, withdrawal at h440, 12 decoded checkpoints, and exactly two ordinary h ending at the same physical time.
- Both recurrence gates retain every-h body, time and event checks; exact graph/adjacency, collider lifecycle, manager, flags, IDs and modified queues; decoded contact/joint checks; and loaded/disk source integrity. No future native state is injected into either candidate owner.

The additional default regression used the same GPU/decoder environment above and the existing source fixtures, without modifying its test or expected values:

```sh
THREE_BALL_CREATION_V8=/tmp/billiard-v3-cue-three-ball-creation-registry.v8 \
THREE_BALL_SWITCH_REPLAY=/tmp/billiard-v3-original-three-ball-through-switch-v1.v8 \
THREE_BALL_FULL_TRACE=/tmp/billiard-v3-authoritative-corpus-1249/three-default.json.gz \
node --test --test-concurrency=1 tests/experimental-three-ball-shared-graph-through-cue.cjs
```

Evidence logs:

- `/tmp/billiard-yaw15-termination-serial-gate-307e23e-20261024.log`, SHA-256 `f930266bfe01e7ebd9244f63386070b86ebbdbc52325e928b708c1081bd33947`.
- `/tmp/billiard-default450-termination-regression-307e23e-20261024.log`, SHA-256 `f91ad6bddc9499d07c53244ae51a12427ae6e352e836b015d1de2a0d2031a785`.

The serial slot was released after these terminal results. No native capture or horizon extension followed in this worktree. Dispatch counts are correctness evidence only, not GPU acceleration. Later yaw15 contacts, unsupported dynamic pairs, full-shot rest, general settings, active CCD and four-ball support remain outside this result.
