# Opt-in single-bank compact microcode owner

`src/resident-candidate/initial-microcode-executor.mjs` is a separate production
execution/lifetime owner. It does not replace `executor.mjs`, activate a UI mode,
request an adapter/device, import test fixtures or run CPU forward physics.
The caller supplies an exclusively borrowed, already acquired device.

```js
const owner = createInitialMicrocodeExecutor(device, {
  experimental: true,
  maxDispatchesPerSubmission: 1024,
  maxLiveBytes: 512 * 1024 * 1024,
});
try {
  const result = await owner.evaluate(runtime, {
    macroWorkgroupSize: 8, // explicit 1 or 8; core remains 64
    identity: {sourceIdentity, preStrikeIdentity, generationIdentity},
    getIdentity: () => currentCompleteIdentity,
    signal,
  });
} finally {
  await owner.dispose(); // drains/disposes owned resources, not borrowed device
}
```

`runtime` must be the same-realm genuine `createInitialMicrocodeRuntime` result.
The source h ceiling and total VM-cycle work budget are distinct, explicit
constructor fields; the executor does not shorten them. The protocol-owned
`createInitialMicrocodeLaunch` regenerates and validates the four-macro source
launch. Exact source/init/program/bytecode identities, ordered IDs, raw input
bits, original history, original cap 32768 and logical spans remain authoritative.
No caller-supplied qualification mask or serialized envelope grants ownership.

## Transaction and lifetime

This first owner is **single bank**. It checks actual device limits, applies the
compatibility 128 MiB storage-binding ceiling and checks total live bytes before
creating shaders or buffers. An over-limit 1024-row bank rejects; it is not
silently reduced or tiled. The historical two-row-shape allocator is neither
relabelled nor used as authority for these exact runtime-owned resources.

All 27 logical entry descriptors preflight before any pipeline creation. The
core begin/main descriptors share a module, giving 26 unique compilation-info
queries on a cold request. Pipeline compilation is broad first, core begin and
pump, source-PC begin, the 19 original raw initialization stages, the other
three macros, then compact publication. Cache keys contain the complete shader,
entry point and binding types; only the current immutable program is retained.
Lost/failed-device caches are not reusable.

All 11 source/VM resources plus compact output and compact readback are allocated
before any upload or dispatch. Uploads are exact initial words, never CPU future
states. Original raw initialization and source/VM begin run before bounded
core-plus-four-macro cycles. Submission drains do not map state. There is one
final compact copy/map of exactly 16 bytes per input row and no public source,
VM, scratch, trajectory or audit buffer.

Cancellation, stale source/prestrike/generation, device loss, invalid source and
unknown queue errors remain distinct. After submission, interruption drains
before destruction or publication. Unknown drain failures poison reuse rather
than fabricate a cancellation. Publication is all-or-nothing and rechecks the
live three-part lease after mapping and resource cleanup. Device loss is raced
against unresolved asynchronous device work. The borrowed device itself is not
destroyed; unrelated queue/error-scope users must not share it concurrently.

## Ownership and result authority

The runtime constructor still computes complete canonical hashes. Metadata and
strings are frozen. Every owned typed view additionally has a private immutable
byte snapshot and exact buffer/offset/length/backing-length identity. Admissions
compare every mutable byte and span and reject detachment/replacement/mutation;
immutable shader strings need not be hashed at every asynchronous continuation.
The launch seal must prove its mutable uploads alias those exact runtime views.
This changes no shader, bytecode, descriptor or canonical profile identity.

The integer publisher independently checks source/VM terminal protocol, original
row IDs, clocks, errors, stack, source h ceiling and logical lengths. VM-budget
exhaustion, source-h exhaustion, unsupported numerics and original rejected
strikes remain separate. Physical PASS/MISS are guarded by the preserved-f32
**qualification mask 0** and cannot be published as evaluated outcomes. The
compact transaction independently refuses PASS/MISS even if a faulty producer
attempts them. A completed transport is not physical/full-rest qualification.

## Validation scope

The publisher HOST tests interpret its actual generated integer WGSL through
the guarded scalar VM, including malformed state and span cases. They do not
simulate billiards. Lifecycle HOST tests use a genuine original initial plan
and freshly constructed six-row runtime, but a noncomputing fake device. Fake
compact outputs are explicitly transport injections; they are not numerical
or trajectory evidence. Their two-cycle work budget is a declared lifecycle
test budget, not the historical native 512-cycle gate.

An initial cold/warm fake lifecycle run failed because its allocation assertion
counted already destroyed buffers from the first pass. The test now counts live
buffers. This was a test-accounting failure, not GPU failure. The same run also
exposed repeated immutable-source hashing during async admissions; the exact
view-seal refactor preserves complete constructor identities and mutable coverage.

No native execution, hardware timing, full-rest qualification, multi-bank
1024-candidate throughput or actual browser-worker/application qualification is
claimed by this checkpoint. These modules introduce no Node/test imports, but
the existing classic/CommonJS loading bridge remains a separate browser bundling
boundary. Full build and real-app browser tests remain mandatory before release.

HOST checkpoint: all 11 lifecycle groups passed, including a cold and warm
fresh-bank run, allocation failure, unresolved drain/device loss, unknown queue
failure, post-map stale generation and mutable source rejection. The four
generated integer publisher groups and exact ownership graph gates are separate
from this noncomputing device double. Run the focused lifecycle suite with:

```sh
node --test --test-concurrency=1 tests/resident-candidate-initial-microcode-executor.mjs
node --test tests/resident-candidate-initial-microcode-publication.mjs
```

The genuine initial source fixture remains test-only and requires its existing
local original-capture/WASM provenance files. It is not packaged in production.
