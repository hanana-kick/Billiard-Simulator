# Empty-convex device-local compilation reuse

## Bounded change

This patch starts from frozen revision
`dded16de6797041d90fd227f64063d4ffc3f86ad`. Only the private compilation path in
`src/experimental-cue-empty-convex-cache.js` changes. The default product, world
controller, physics graph, GJK source, shader generator, and transaction guards
are unchanged.

A private `WeakMap` caches compilation promises by the **exact passed device
object** and exact shader descriptor identity (module label plus shader bytes).
The four fixed programs retain `layout: 'auto'` and `entryPoint: 'main'`.
Concurrent stage factories share pending promises; later factories reuse the
resolved programs. Failed promises are removed individually so retries can
reuse successful programs. Device loss clears/removes that device's cache,
prevents reuse of the lost device, and rejects a compilation that resolves
after loss. A fresh device gets its own cache. Rejected loss notifications are
handled conservatively as loss.

A service's scoped device facade is deliberately **not unwrapped**. Therefore
reuse is guaranteed within one world using that same facade, not between
operations whose facade objects differ. There is no renderer/global-device
sharing or monkey patch.

No hull, input, scratch/output/readback buffer, program/index buffer, bind group,
brand, busy/disposed flag, previous cache, or other mutable stage data is shared.
Stage disposal still destroys only its own buffers. Pipelines are retained for
the device lifetime, rather than one stage lifetime. All source text beginning
at the persistent-buffer allocation through bindings, every dispatch/readback,
step, disposal and public export is byte-for-byte identical to the frozen file.
The existing cleanup gap if the second persistent-buffer allocation fails is
not changed by this patch.

## Exact shader identity

The frozen source file SHA-256 is
`bc0198f2c21e5cb3e364b8419b997163a31cfb9fd91a19ad33628f93f3c9d21e`.
Both versions request these exact UTF-8 programs:

| Program label | Bytes | SHA-256 |
| --- | ---: | --- |
| empty convex cache recurrence | 2252 | 36abe5c8998b9024eae7265e2d52cfc550406c118b4287300170ff42109839d0 |
| empty convex init | 10038 | d954e48891bac2338d23c32b205772b56124c350cb92530612404451c06a4343 |
| empty convex gjk | 11442 | 2daf24854b70277548c9dd3cf7dfa4d221ac3cd17a03933f6c2e3f0d31612e77 |
| empty convex finish | 1977 | 223b82dc968f82f7b44f3976138b6731cef58882827d56bee6187aa8282609bc |

## Verification performed

1. **Orchestration only:** 12 fake-device regressions pass, including an exact
   frozen-source comparison. Eight stage factories request **32 shader modules
   and 32 compute pipelines before; four of each after**. The persistent buffer
   count, descriptors, and written program/index bytes match exactly. Tests
   cover pending shader/pipeline concurrency, sequential/warm construction,
   different hull identities, separate devices/facades, diagnostics and
   synchronous/asynchronous compile failure, retry, exact-code cache keys,
   device loss, in-flight loss, and stage-owned disposal. The topology fixture
   is an explicit test stub. These results are not shader execution or physics
   parity evidence.
2. **Actual CPU stage values:** old/new reference stages match exactly on five
   fixed cases: birth, reuse, refresh, captured h410 birth and h411 reuse.
   The existing captured native hull is admitted using the pinned decoder's
   JavaScript re-encoding/provenance checks; no native process is run.
   The result sequence's canonical numeric SHA-256 is
   `7cea9d97991e21a56bb4b5d4cb98e70be73d04064a832a1390bca7faffdef5d8`.
   Recycle flags are `[false, true, false, false, true]`.
3. **Existing light regressions:** 14 CPU/controller tests pass, including
   source hull order, h410/h411 cache values and normals, recycle/refresh,
   unsupported-input guards, and cloned-world rollback/retry. The actual WGSL
   case was intentionally skipped in the light combined run; the stronger
   separate actual before/after WGSL check below subsequently passed.
4. `git diff --check` passes. No app/browser/UI suite, deployment, or user
   computer operation was performed for this private experimental change.

**Actual fixed-stage WGSL result:** on clean commit
`451434b68fa222d177f6ee894be76c21cf803367`, the separately assigned Dawn/Vulkan
SwiftShader run exited **0**, with **two tests passed, no failures or skips**.
It compared the frozen WGSL stage, two new shared-program WGSL stages, and both
CPU stages across all five fixed cases. Every numeric value matched exactly;
the numeric sequence SHA-256 remained the value above. Dispatch counts were
unchanged (259 for birth/refresh; one for reuse). The API observed eight shader
module requests and eight pipeline requests total: four for the old stage, then
only four shared by the two new stages. This is a completed **bounded stage**
conformance check, not a complete-world or full-shot claim.

The frozen file was compared byte-for-byte with `git show dded16d:...` immediately
before the run. The configured installed module was
`/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js`, with Vulkan ICD
`/usr/lib/chromium/vk_swiftshader_icd.json`. The captured command output is
[empty-convex-device-pipeline-cache-wgsl.txt](empty-convex-device-pipeline-cache-wgsl.txt).
This documentation-only follow-up does not change the tested implementation.

Compilation request reduction is measured at the API boundary, not inside the
driver. No hardware memory, speed improvement, complete-world CPU/GPU parity,
or full-rest GPU outcome is claimed.

## Reproduce light checks

```sh
git show dded16de6797041d90fd227f64063d4ffc3f86ad:src/experimental-cue-empty-convex-cache.js \
  > /tmp/empty-convex-pipeline-cache-dded16d.js
EMPTY_CONVEX_PIPELINE_BASELINE_SOURCE=/tmp/empty-convex-pipeline-cache-dded16d.js \
  env -u GPU_NATIVE_MODULE -u REQUIRE_WEBGPU node --test \
  tests/experimental-empty-convex-pipeline-cache.cjs \
  tests/experimental-empty-convex-pipeline-values.cjs \
  tests/experimental-cue-empty-convex-cache.cjs \
  tests/experimental-three-ball-world-pair-transaction.cjs
```

CPU value tests need the already captured source fixture at
`CUE_EMPTY_CONVEX_CREATED_JSON` (default `/tmp/billiard-all-pair-created-typed.json`).
The captured h410/h411 cases additionally use
`CUE_EMPTY_PAIR_EVIDENCE_DIR/yaw61-25-elevated-holdout-hull-birth.v8`.
Missing fixture tests skip rather than manufacture evidence. Set these paths
explicitly when replaying elsewhere. The frozen-source tests also skip without
`EMPTY_CONVEX_PIPELINE_BASELINE_SOURCE`; when supplied, its content hash must
match the frozen file above.

Only after a GPU slot is assigned, enable the actual fixed WGSL test by setting
`GPU_NATIVE_MODULE` to the approved installed native WebGPU module and
`REQUIRE_WEBGPU=1`, retaining the fixture and frozen-source environment values,
and run `tests/experimental-empty-convex-pipeline-values.cjs`. Do not interpret
an intentionally skipped GPU test as a pass.
