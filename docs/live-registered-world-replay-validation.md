# Live registered four-ball world replay validation

Validation date: 2026-10-25. Test: [`tests/live-registered-world-replay.mjs`](../tests/live-registered-world-replay.mjs).

## Result and scope

All three pinned live sources, `placed`, `settled`, and `awake`, completed through original physical rest on both `World.createReferenceStepper` and `World.createGpuStepper`. Each backend was independently compared with a continuously running original/native controller, not merely with the other backend. The GPU path executed actual WebGPU/WGSL on **Vulkan SwiftShader**, a software adapter. This is numerical and state-transition evidence, not hardware GPU performance evidence.

The test and this report do not change the production controller, optimizer, scoring rules, visible application, or selected product backend. They do not enable a GPU backend in production. The tested runtime advertises `liveRegisteredFourBall: true` and `wholeWorld: false`.

### Full-shot results

Each row below describes **each** backend separately. Both backends reached all the listed counts and the same maximum error. An `h` is one original physics substep; it is not an outer application call.

| Source | Committed h / internal collision passes | Completed outer calls | Post-h raw checkpoints | Injected atomic rollbacks | Maximum absolute numerical error | Final score `{cueId, delta, nextCue}` |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| placed | 5,683 | 5,053 | 43 | 45 | 1.2648604053033807e-8 | `{1, 0, 2}` |
| settled | 7,083 | 6,642 | 55 | 57 | 4.590196911458122e-8 | `{2, 0, 1}` |
| awake | 5,848 | 5,407 | 46 | 52 | 2.9890120378794904e-9 | `{1, -1, 2}` |

Across the three sources, each backend independently compared 18,614 original h. Cue-inertia maximum absolute error and maximum normalized error were both **zero** in all six completed replays. These are measured errors, not replacement tolerances.

Every full replay also passed:

- All balls sleeping at physical rest, with no awake island.
- Final game, score, next cue and all accumulated contact events against the original controller.
- Two subsequent finished `step()` calls and a snapshot returning exactly the same state, including clocks, caches and managers.
- Direct exact CPU/WebGPU final comparisons of the scene, global contact graph, game, score and authoritative solver roster. Only the roster's backend label is excluded from that last comparison.

## Independent input and oracle

The actual browser importer, `src/browser-initial-import/live-registered-four-ball.mjs`, receives only the raw initial `{snapshot, preStrikeSnapshot, capture}` envelope. It uses `tools/rapier-snapshot-decoder/browser.mjs` and the pinned read-only WASM decoder. The candidate world is constructed from that imported seed, and every candidate `step()` receives no arguments.

`tests/browser-live-registered-source.cjs` produced the original continuous references. Each reference has schema `original-controller-live-registered-continuous-reference-v1`, `candidateStateUsed: false`, `nativeRestoreUsed: false`, `originalSourceContinuous: true`, and a checked original/fork equivalence. Reference frames and future raw snapshots are assertion-only data. Expected checkpoints are decoded one at a time, compared and discarded; no expected decoded state, trajectory or final result is supplied to a candidate world.

The initial raw capture truthfully has `capture.nativeRestoreUsed: true`, because it records the original nonmutating source-fork creation. This is distinct from the continuous oracle, which did not restore, and from candidate replay, which never initializes, restores or steps a native engine. The test checks that native engine modules and original-controller globals are not loaded. Reading the engine bytes to verify decoder provenance is not engine execution.

All raw container hashes are checked immediately on file read, before deserialization/import. Reference manifests must link to the exact same raw capture and snapshot. The native producer source hashes and initial snapshot/application identity are checked as well. The raw evidence is not modified to fit the candidate.

### Pinned artifact SHA-256

Artifacts are external test inputs, not generated replacements for expected state.

| Source | Artifact | SHA-256 |
| --- | --- | --- |
| placed | `capture.placed.v8` | `4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403` |
| placed | Initial native snapshot | `d1f072a0f70c78a1918368c90a9f3b1d0e85e5dacbd08184675fe4b575dabc86` |
| placed | `reference.placed.v8` | `2f81d4855d850bba3d807f79df246ffbc43a84dfa8fd3ebd1333bd14a3ab5a50` |
| settled | `capture.settled.v8` | `11f41cd9c11ff47911f14afc084b27f32a15fc69db1f26d7970eb864f35f2262` |
| settled | Initial native snapshot | `a93473fceb1da27bb580a2981d3e536057eb30856e49d64405ad2b96f8b51e0f` |
| settled | `reference.settled.v8` | `cb4eb621a96cc6d06f355a647ddd63eda2c3997d7d527e40a219d58c6187a05a` |
| awake | `capture.awake.v8` | `789955f1ecdd79cb4b39af2c8ab5ba578d6b7e3b49d9882845cb9a57ea57d0d6` |
| awake | Initial native snapshot | `c677336fd7d9528bef546f29782bf877d927b16f9bf56b3f873a1eaf6911efd3` |
| awake | `reference.awake.v8` | `699ede31cb19809b0487f3f85d3665e465f3721cc7cf12c316cbb2d48d7fd53c` |

Decoder WASM SHA-256: `1647149118688a7152bc385e0c06ce985eda36e97a3a7e16a8f86fa8506eeabd`.

Original engine-byte SHA-256 used for decoder provenance: `fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4`.

## Assertion coverage and unchanged tolerances

Every h checks all four ball positions, rotations, linear/angular velocities, effective inverse inertia and sleeping flags; the cue shaft/head equivalents while present; cue presence/removal; contact events; game state; source identity; and source clocks. Awake source flags are imported and compared as recorded, never forced asleep.

| Quantity | Gate |
| --- | --- |
| Ball position and rotation | Absolute 1e-6 |
| Ball linear/angular velocity and inertia | Absolute 3e-6 |
| Cue position, rotation and linear/angular velocity | Absolute 3e-6 |
| Cue inertia matrix | 3e-6 times `max(1, max(abs(expected matrix components)))` |
| Contact-event position | Absolute 1e-6 |
| Contact cache and broad-phase proxy numerical fields | Absolute 2e-6 |
| Sleep, IDs, handles/generations, topology, ordering, clocks, game and score | Exact |

The ball/world gates preserve the established `tests/experimental-settled-four-world.cjs` and `tests/experimental-goal-four-world.cjs` criteria. The cue-inertia matrix-scale criterion comes from the existing `tests/cue-cloth-joint-stepper.cjs`; it is explicitly separate from the absolute ball-inertia gate. A candidate symmetric six-component cue matrix is expanded to nine components only on the assertion side. The report records both absolute and normalized cue-inertia errors.

Every completed-h native raw checkpoint checks the complete represented island manager, dense contact graph and directional adjacency, live collider/body identities and changes, activation and modified queues, solver-contact roster/masks/order, all four cloth, sixteen rail and six ball-pair caches, cue-cloth cache, empty cue-pair caches, owned BVH metadata/topology and numerical bounds, and all fat proxies. The test reuses the unchanged native comparison and graph projection helpers without loading their native fixture dependencies, and adds explicit checks for fields those helpers omit. Runtime-only BVH deferred-optimization state must independently be false.

### Exact observation phases

The reference artifacts contain 45, 57 and 48 raw checkpoints respectively. Each includes one initial checkpoint, checked byte-for-byte against the imported source, and one `cueWithdrawal.postRemoval` checkpoint inside an h. That mid-h observation is not misrepresented as a completed-h state; it is explicitly excluded from the post-h table. The first subsequent completed h is fully compared. Checkpoint counts are observations, so native rest and controller-finished snapshots may share an h number.

Original `angularPatchResistance` observations occur inside `PhysicsLab.step`, before the outer `this.steps++`. Only the exact `firstH.postApplication` and `cueWithdrawal.firstSubsequentH` callback boundaries with their exact reasons can have a pending outer increment, and only when `outerSubstep === 0`. At settled h448 this means the unchanged raw application counter is 5410 while the logically completed owner counter is 5411. The test asserts that specific phase relationship. All other checkpoint counter differences still fail. A dedicated regression checks permitted and forbidden cases.

At every h, `World.sourceApplicationSteps` remains exactly `seed.sourceApplicationSteps + frame.outerStep`. Native broad-phase clock checks use the recorded source clock plus the actual internal collision-pass count. No clock is inferred from a fresh-world zero origin.

The original final per-h game sample is taken before the controller's finish call, so its pending game is not the finished game. At the common final physical-rest h, the candidate's immediately finished game is compared with the original `finalGame` and final score. Earlier h compare their original per-h game samples.

### Atomic rollback and diagnostics

The test loads unchanged world/stage implementations and observes their real snapshots. It throws a test exception immediately after the actual final preflight and before commit, at the first h, completed-h checkpoints, new contact-event steps and the terminal h. Public world state and all tracked private stage snapshots must remain exactly unchanged; the same h then executes normally. Unexpected step arguments also reject without mutation. This instrumentation does not replace numerical kernels or return expected states.

Large exact comparisons use Node's `isDeepStrictEqual`, preserving prototypes, signed zero, typed arrays and other strict semantics. On failure, only a bounded first-mismatch diagnostic is formatted instead of a giant whole-state diff. The regression for this diagnostic verifies strict failures as well as successful comparisons; this changes failure presentation, not acceptance criteria.

## Actual adapter and execution records

The runs used Node v24.22.1 and the official `webgpu` package v0.6.2, with Vulkan ICD `vk_swiftshader_icd.json` from Chromium. Adapter information was:

- Vendor: `google`.
- Architecture: `swiftshader`.
- Device: `swiftshader-device-subzero-`.
- Description: `SwiftShader driver 5.0.0`.
- `isFallbackAdapter: true`.

The test still requires a real adapter/device and actual shader execution; it has no substitute CPU-reference fallback for a missing WebGPU adapter. The adapter itself is software, so these results cannot establish discrete/integrated GPU behavior, browser hardware support, acceleration or interactive throughput.

| Completed command scope | Node old-space cap | Elapsed seconds | Maximum child-process RSS, KiB | Test result |
| --- | ---: | ---: | ---: | --- |
| placed, CPU then actual WebGPU | 256 MiB | 734.5634798340034 | 780176 | 1 pass, 0 skipped, exit 0 |
| settled, CPU then actual WebGPU | 384 MiB | 756.2829163450078 | 969556 | 3 pass, 0 skipped, exit 0 |
| awake, CPU then actual WebGPU | 384 MiB | 697.4372383919981 | 972560 | 3 pass, 0 skipped, exit 0 |

The later three-test commands include the two assertion/phase regressions plus the full source replay. Elapsed time includes importing, CPU replay, shader replay, checkpoint decoding/assertions, rollback probes and cleanup. RSS is the maximum child-process resident value reported by Python `resource.getrusage(RUSAGE_CHILDREN)`, not an aggregate simultaneous-process total or GPU allocation measurement. The V8 old-space cap is not a cap on total process, WASM or driver memory. None of these measurements is a performance benchmark.

### Memory failure and limits

An earlier settled command at 256 MiB completed CPU h7083, but the GPU run terminated with V8 out-of-memory after its last h6912 progress record. It exited 1 after 1079.2219287879998 seconds, with maximum child-process RSS 729596 KiB. It had **no terminal GPU full-shot result** and is not counted as a pass. No conclusion about its unobserved final comparisons is inferred from earlier progress.

The complete CPU-plus-GPU scope was rerun at 384 MiB, preserving all numerical and exact checks, including the direct CPU/GPU final comparisons, and passed. No physics implementation was changed for this retry.

Source inspection shows that `experimental-contact-graph-journal.js` retains committed receipt history, including before/after graph copies, until disposal. This is genuine runtime per-pass retained state, not only test reporting data. In the instrumented settled/awake runs, the test observer set contained 16 stages at construction, 18 after first h, and 18 at completion; the set is cleared after disposal. Reference archives are fixed input data, and future checkpoint trees are decoded only when asserted, not accumulated as decoded history. These observations distinguish known retention from a growing observer count, but do not provide an exact allocation attribution. Successful finite runs at 384 MiB do **not** prove constant-memory execution, leak-free driver behavior, indefinite multi-shot stability or a production memory bound.

## Source and log provenance

Each successful command emitted `live-registered-world-replay-source-proof-v1`, checked all 90 recorded source hashes again at completion, and reported zero native runtime steps. All 89 non-test source hashes are identical across the three successful commands. Important common hashes are:

- `src/experimental-four-ball-world.js`: `ab03f871f28e1079ab9a79ac6592a182dbf229f8451cd04d783da62b63e8f400`.
- `src/browser-initial-import/live-registered-four-ball.mjs`: `d63bfa11772ffc0cf53639ac28a58233c142091c137310b3f100b0a49572eec5`.

Test source SHA-256:

- Placed full command, commit `9625521`: `a0c43366b61a115115a4db324dd159d8aaac464ba027c7b56c2c259be2f0076e`.
- Settled/awake successful full commands, commit `4142622`: `d405fa74282f1334b99b35740c659d8003dc18b45d086a85bc2714787cab3d2d`.

Between those test versions, the callback-clock distinction was made explicit, strict mismatch formatting and observer cleanup/telemetry were added, and awake was pinned to the raw container explicitly named by its unchanged original reference. Numerical tolerances and runtime sources were not changed. The placed full result is evidence for its recorded test version; it is not represented as a rerun of the later harness.

Successful full-log artifact hashes:

| Artifact | SHA-256 |
| --- | --- |
| `live-registered-placed-full.log` | `412496e78a5eb8a7ee8acc999fbb34356945fbb4aceb2f34c20ecdca2a089387` |
| `live-registered-settled-full-384.log` | `b75e7f0da59cd3adb10c0f3ac93f6025a0fba4bee3745c1846a0f92627e7d36e` |
| `live-registered-awake-full-384.log` | `32896f80849b46ba758892973c8b51c505eb858ca3ce65aa2c5a812acdbf08e5` |

## Reproduction and unsupported conclusions

Provide the exact capture/reference files and their `.v8.json` manifests, the matching original engine bytes, and the decoder build/provenance. `RAPIER_WASM_PROVENANCE` selects the decoder provenance; its default is the sibling browser-decoder build. `GPU_NATIVE_MODULE` selects the absolute path to the official WebGPU module, and `VK_ICD_FILENAMES` selects the actual Vulkan ICD. Missing prerequisites must fail, not silently replace the backend or inputs.

Run one full source per process, serially:

```sh
LIVE_REGISTERED_EVIDENCE_DIR=/path/to/pinned-evidence \
LIVE_REGISTERED_SOURCES=settled LIVE_REGISTERED_BACKEND=both \
REQUIRE_WEBGPU=1 node --max-old-space-size=384 --test \
  tests/live-registered-world-replay.mjs
```

Use `placed` or `awake` for the other pinned sources. The full command omits `LIVE_REGISTERED_MAX_H`. A positive smaller value produces only `verified-prefix`, with `fullShot: false`, and cannot support a full-shot claim. `LIVE_REGISTERED_BACKEND=cpu` runs only the reference candidate; `gpu` runs only the actual WebGPU candidate and omits the direct final CPU/GPU comparison. The results above used `both`. For these long full commands, use the documented 384 MiB cap rather than treating the test header's 256 MiB example as a demonstrated full-suite memory requirement.

This evidence is limited to the three pinned, source-bound four-ball cases and the represented runtime domain. It does not certify arbitrary snapshots or future shots, general-purpose engine replacement, arbitrary contact topology, resident parallel multi-shot GPU batching, production recommendation validity, browser/device coverage, mobile UI behavior, deployment readiness or a product backend switch. Those require separate evidence.
