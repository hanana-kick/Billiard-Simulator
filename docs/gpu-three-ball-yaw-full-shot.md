# Fixed yaw15 full-shot validation

Status: PASS, 2026-10-24. The fixed yaw15 shot passed both CPU/reference and
actual WebGPU/WGSL through native rest and the entire fixed horizon. This is one
explicit shot, not arbitrary-world parity. No runtime source was changed.

## Frozen scope

- Base runtime: `307e23e`, isolated branch `experiment/yaw-full-shot`.
- Original `PhysicsLab` creation, all three original balls and all sixteen statics.
- Original constructor's 72 native settling steps; zero extra application settling.
- Explicit existing variant: angle 15°, elevation 8°, speed 2, centered tip,
  selected index 0. No altered shot or repositioned objects.
- Native capture advances continuously from byte-identical strike-created state
  for exactly 9,600 outer steps (nominal 10 seconds).
- Every outer retains all body poses, velocities, inertia and sleep flags, event
  count, contact graph topology and scoring/turn state. All application events
  retain original times, endpoint identities and positions.
- Raw snapshots use a fixed 128-outer grid plus initial outers
  1, 2, 4, 6, 7, 8, 9. Before/at/after every native pair/manifold-count, cue-presence,
  sleep or application-event transition are retained by a fixed capture rule.
- The previously frozen through-cue replay is compared exactly at every common h,
  including snapshot bytes at every existing checkpoint. Sources, decoder binary,
  engine, prefix and full artifact are SHA-256 bound.
- Missing full rest at the fixed horizon is `horizon-incomplete`, never success.

## Candidate contract

The existing initial-only yaw exporter constructs each backend once from
`record.created`. Native future frames, snapshots, graph caches and scoring are
assertions only, never reseeds or supplied runtime inputs. Every candidate outer
is compared, with 1e-6 pose and 3e-6 velocity/inertia tolerances unchanged from the
previous gates. Checkpoints also compare 2e-6 contacts/proxies, exact full dense
graph, directional adjacency, live collider registry, complete manager/activation,
modified-body queue and unchanged contact/turn outcomes.

The runtime remains bounded to its already supported topology. The first
unsupported dynamic pair, coupled contact or active CCD is recorded exactly,
without changing inputs or physics. CPU and GPU must stop at the identical first
unsupported boundary. That result fails the full-shot gate and is explicitly
reported with `fullShot: false`; it is not presented as successful whole-shot
parity. A numerical mismatch stops before spending the GPU gate.

## Commands

Run serially only after the coordinator grants the native/GPU slot:

```sh
cd /tmp/billiard-yaw-full-shot-20261024
export RAPIER_SNAPSHOT_DECODER=/tmp/billiard-v3-native-target/debug/rapier-snapshot-decoder
export YAW15_REPLAY=/tmp/billiard-yaw15-native-through-switch-20261024.v8
export YAW15_FULL_REPLAY=/tmp/billiard-yaw15-native-full-shot-9600-20261024.v8
node tests/three-ball-yaw-full-shot-oracle.cjs "$YAW15_FULL_REPLAY"
REQUIRE_WEBGPU=1 GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
  VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
  node --test --test-concurrency=1 tests/experimental-three-ball-yaw-full-shot.cjs
```

Capture is explicit and never overwrites an existing frozen artifact. Test loading
never captures implicitly. Boundary artifacts are local `.v8` evidence with a
small SHA-256-addressed JSON summary under `/tmp/billiard-yaw15-full-shot-*`.

## Validation ledger

- Syntax checks: both new CJS files pass `node --check`.
- Frozen implementation under test: `9fa15ef` on runtime base `307e23e`.
- Native capture: complete through outer 9,600, nominal 10 seconds. Exact prior
  450-h observable agreement and 12 byte-identical common checkpoints.
- Native rest: outer 7,099. All three bodies remain asleep and cue remains absent
  through outer 9,600. Untouched balls 2 and 3 first sleep at outer 481.
- Contact events: compliant cue tip at outer 6, right cushion at outer 1,157,
  front cushion at outer 1,242. There is no ball-ball contact in this shot.
- Native capture retains 111 raw checkpoints (created state included) and 13
  topology/event/sleep transitions under the predeclared rule.
- CPU gate: PASS, 291.404 seconds. Actual WebGPU gate: PASS, 349.608 seconds.
  Total invocation: 673.562 seconds, two tests passed, none failed or skipped.
- Both backends compare all 9,600 outers / 10,041 h, 110 post-created raw graph,
  proxy, activation and manager checkpoints, and all three contact events.
- Both backends report max absolute error `1.7025832854677958e-8`, below the
  unchanged tolerances. This is numeric parity, not a claim that every compared
  floating-point observable is byte-identical.
- Both independently reach original score `{cueId:1, delta:0, nextCue:2}` and
  original first-rest outer 7,099. No unsupported boundary was encountered.
- WebGPU executes actual WGSL through Vulkan/SwiftShader in the agent container.
  This does not establish behavior on the user's hardware GPU.
- Loaded source hashes remained unchanged throughout the gate.

## Local evidence

- Native artifact: `/tmp/billiard-yaw15-native-full-shot-9600-20261024.v8`,
  29,596,430 bytes, SHA-256
  `71bfe7c124c17833ea8439126a5f4f783f230e90ce51e641a83445ce839afc29`.
- Native manifest: same path plus `.json`, SHA-256
  `2893cbe54b2af04db4b41a5d2c44f80bfd1f2e0d9b7f1b23dbbb544411b70450`.
- Gate log: `/tmp/billiard-yaw15-full-shot-gate-9fa15ef-20261024.log`, SHA-256
  `f8a87db99b257a30bd1893560d0ce8094bd9a97f9ae6118d7871ea19855d12a6`.
- Initial created snapshot: SHA-256
  `878f9c8eb6c92959ae4f940d7d5b482b672a26549d6d2e17af03552a41d557b3`.

The first command attempt stopped before capture because a fresh worktree omitted
ignored `vendor/rapier.cjs`. Copying the existing bundled file unchanged fixed the
setup; its exact admitted hash was verified before capture. No native artifact
was overwritten and no runtime, tolerance or expected value was modified.
