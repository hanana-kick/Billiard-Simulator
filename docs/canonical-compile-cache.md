# Experimental compilation cache

This opt-in device facade is **not wired into production factories**. It shares
exact WGSL module sources and asynchronous compute pipelines. It never shares
candidate buffers or changes shader arithmetic. Explicit native pipeline layouts
are keyed by object identity, not structural similarity: a newly created layout
can fail validation or allocation even when its descriptor equals an older one.
Unknown descriptors or layout provenance bypass sharing.

Completed and pending cache tables are separately bounded (128 entries each by
default). Overflow bypasses sharing. Device loss rejects outstanding operations;
settled operations remove their loss callbacks, avoiding lifetime retention of
LRU-evicted pipelines. A subprocess GC test creates 50 pipelines with limit one
and verifies only the cached pipeline remains live while device loss is pending.

Caching is not transparent to validation/OOM observation: skipping a native
allocation also skips that allocation's error observations. No additional error
scopes are pushed, but callers must accept this explicit compilation/allocation
contract. Diagnostic labels belong to the first creation. The facade only covers
asynchronous compute factories, not synchronous compute or render pipelines.

## Qualification on 2026-10-27 UTC

CPU/fake tests: 13 passed; native comparison skipped without REQUIRE_WEBGPU=1.
Representative unchanged world + cushion resolver + staged raw factories create
111 modules / 107 pipelines without the facade, versus 90 / 98 with it. These are
creation counts, not timing or memory estimates.

Two fresh native processes used SwiftShader software Vulkan, with the same smooth
and 3D-contact factories each constructed and executed twice. Each process was
serialized under /tmp/billiard-native-gpu.lock; the watchdog ran inside the lock
with 110-second and 1500-MiB limits. Both passed 2 tests and compared all 2048
output words exactly against CPU. Their output SHA-256 was identical:
82edcc3f5b15814699dc885e132e13b028e85db204b715ced90cf4a7d752fc11.

- Uncached: 8 module creates, 8 pipeline creates, 16 buffers, 34,816 cumulative
  allocated buffer bytes; elapsed 14.495 s; sampled aggregate RSS 738.36 MiB;
  maximum child RSS 702.57 MiB.
- Cached: 4 module creates, 7 pipeline creates, the same buffers and allocated
  bytes; elapsed 12.174 s; sampled aggregate RSS 751.38 MiB; maximum child RSS
  711.16 MiB.
- Repeated contact factory compilation: 1572.883 ms uncached versus 0.049 ms
  cached. Repeated smooth factory compilation was already small without this
  cache (0.691 ms versus 1.193 ms), consistent with driver-side reuse.

These are single observations, not a reliable overall speedup factor. Peak RSS
was higher with the facade, so this experiment does not establish memory savings.
This is not physical-GPU throughput, fullworld cache qualification, or release QA.

Run tests/canonical-compile-cache-native.mjs in separate processes with
CANONICAL_CACHE_MODE=uncached and =cached, REQUIRE_WEBGPU=1 and the native module
path. Preserve the native lock and watchdog protocol for both runs.
