# Shared-device GPU error-scope isolation

## Change

The 19 legacy operation scopes in 18 experimental modules now issue their
`mapAsync` request while their validation scope is open, call `popErrorScope`
synchronously, and only then yield. Each operation retains its own popped
validation promise. Rejection handlers are attached before awaiting either
promise, so a failed mapping or mapped-range access cannot leave an unhandled
scope rejection. Mapping and validation errors still reject the operation;
completion-marker and finite-output checks remain unchanged. Synchronous
allocation, upload, encoding, submit, or map failures retain the original
`finally` scope pop and resource cleanup. The ownership flag is cleared before
calling `popErrorScope`: an unexpected synchronous throw has an uncertain pop
outcome and must not trigger a second pop that could consume an outer scope.
The native receiver is preserved; no native object methods are patched.

`experimental-stage-runtime.js` was audited but not modified: its resident
operations already pop before their first asynchronous yield.

No arithmetic graph, WGSL, dispatch order, physical state, native object method,
or owner resource boundary was changed.

## Regression

Run:

    node --test tests/experimental-gpu-error-scope-isolation.cjs

The host regression checks every legacy scope and executes real free-body stage
methods through two facades over one native-like device-global LIFO stack. It
covers both mapping completion orders, per-owner validation attribution,
map-request validation capture, synchronous setup/map failures, rejected scopes
while maps are pending, mapping rejection, mapped-range and unmap failures,
incomplete-output rejection, cleanup, and retry. Host doubles are orchestration
evidence, not actual GPU execution or full-world parity evidence.

The optional native test uses one actual WebGPU device, two separate facades,
unchanged free-body shaders, and intentionally invalid GPU buffer descriptors
inside only one owner's scope. It also verifies that native device methods were
not replaced and that no validation error became uncaptured. Run only while
holding the coordinated GPU-test slot:

    VK_ICD_FILENAMES=/path/to/vulkan-driver.json GPU_NATIVE_MODULE=/path/to/webgpu/index.js REQUIRE_WEBGPU=1 node --test tests/experimental-gpu-error-scope-isolation.cjs

## Validation at integration handoff

- New host regression: 7 passed, including throw-after-pop and delayed mapping
  rejection without consuming an outer scope.
- Actual native WebGPU gate passed on the existing Dawn/SwiftShader Vulkan
  adapter: two owner facades, six real free-body dispatches, errors attributed
  correctly in both owner positions, exact CPU-F32 results on successful work,
  no uncaptured errors, and unchanged native methods. This was a software GPU
  correctness gate, not a physical-hardware performance measurement.
- Combined scope-isolation, resident-runtime, and empty-convex pipeline-cache
  suites initially: 28 passed, 3 optional gates skipped. The new pop-throw
  regression increases host coverage to 29 passing tests; the native gate was
  separately run with its slot and passed.
- All 18 modified modules pass `node --check`.
- Exact comparison against `edd7dd0` confirms production edits consist only of
  the map/scope lifetime change. Existing result checks and cleanup remain.
- Full actual-world, browser UI, and publication gates are not claimed by this
  targeted concurrency patch.

## Pipeline-cache audit, no cache changes

The empty-convex cache explicitly keys immutable compilations by the exact
`device` object, including owner facades. Its existing regression deliberately
expects eight module/pipeline compilations for two distinct facades instead of
four for a single shared identity. CCD sweep math and CCD proxy distance also
key their immutable pipeline WeakMaps by the passed device identity.

This causes duplicate immutable compilation across owner facades. It is not
correct to casually unwrap the facade: resource ownership, loss observation,
and permitted capabilities must remain isolated. A future shared immutable
pipeline authority would need an explicit owner-safe identity contract and
separate regression. Nothing in this patch changes those caches.
