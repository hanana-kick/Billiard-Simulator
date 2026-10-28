# Optional resident browser/Worker protocol — nonactivation checkpoint

This adds an actual dedicated-module-Worker entry and client around the existing
source-owned runtime and retained multi-bank APIs. Importing the client/runtime
starts nothing. Optional package and default application activation remain false.
No default CPU/UI code, source physics, shader or numerical qualification changed.

**Actual Chromium execution is currently blocked by the command environment,
not passed.** The prepared real HTTP/browser/Worker gate cannot yet establish its
required startup evidence: Chromium aborts before page startup at its denied
process-singleton socket; the authorized escalation launcher itself then fails
on a protected read-only session path. That path was not read or modified and no
workaround was attempted. HOST/VM mocks below are not substituted for browser
or trajectory proof. No adapter/device request or numerical GPU work occurred.

## Interfaces and authority

`loadResidentBrowserRuntime()` also exposes the existing initial multi-bank and
retained runtime/plan/executor constructors. The optional asset builder includes
`src/resident-candidate/worker-entry.mjs` and `worker-client.mjs`, with protocol
`resident-candidate-worker-v1`. A SHA-256 of the delivered file roster identifies
this package version. It is a packaging consistency identity, **not** a physical
source authentication or cryptographic trust claim against a hostile origin.
Original decoder WASM/engine/source provenance remains separately validated.

`createResidentWorkerClient({expectedSourceVersion,generation,onEvent})` explicitly
creates one Worker. Call `open()` first. The handshake loads only local original
modules and the read-only snapshot decoder; it never requests a GPU device.
The non-cross-origin-isolated browser case does not require a SharedArrayBuffer
global. Shared-backed or detached input storage is rejected, not raced.

- `evaluate(rows)` returns `{operationId,started,finished,result}`. Today its
  complete ordered result is ABI **UNSUPPORTED / PHYSICS_SCOPE**, with `pass:null`
  and an explicit numeric-qualification-unavailable outcome. No source world is
  fabricated: source/prestrike/generation identities remain null on this
  nonphysical availability path. This does not prove any candidate trajectory.
- `begin({input,rows,rule,ruleId,caps,execution})` is a **separate experimental
  execution request**, not called by `evaluate`. Its execution string must be
  `explicit-unqualified-retained-microcode-v1`. It returns an operation with
  `started` and `finished` promises. This path is implemented but has **not** been
  exercised on WebGPU through this Worker gate.
- `advance(operationId,sequence,cyclesByBank)` delegates exact bounded work.
  `finalize(operationId,sequence)` alone invokes the owner's sole compact map.
- `cancel(operationId)`, `invalidate(newerGeneration)` and `dispose()` cancel and
  await owned work. Client termination follows the confirmed dispose drain,
  never a timeout that claims success. Cleanup failure does not acknowledge a
  successful drain. Loss/cancel/stale/incomplete never become ordinary misses.

Begin's exact caps are `{bankCounts,maxHSteps,chunkCycles,maxTotalCycles,
macroWorkgroupSize,maxLiveBytes,maxDispatchesPerSubmission}`. All input IDs/order
must be covered by explicit nonempty banks of at most512 rows; no row shrinking
or automatic repartitioning occurs. Chunk and total work are explicit separate
caps, not guessed physical horizons or measured practical allowances.

Inside that Worker realm, the real adapter constructs:

`verified decoder → authenticated original raw initialization → fresh retained
count-specific runtimes → retained batch plan using actual device limits →
retained owner.begin/advance/finalize`.

Only explicit experimental begin can call the standard `requestAdapter()` and
`requestDevice()`; there is no fallback adapter selection or CPU-forward path.
All source/VM views and authentic owner receipts stay local. A serialized plan,
continuation bank, expected world, source-hash string or qualification mask cannot
restore ownership or be substituted through a message. Public work summaries
have `physicsStatusAvailable:false`; returning their sequence number cannot
resurrect a consumed private receipt.

## Atomic lifetime and public output

The host and client bound outstanding requests to16 and allow only one live
operation. Session, request, operation, package-version and request-generation
checks are separate from authenticated source/prestrike/generation identity.
Source invalidation explicitly cancels old work; it never rewrites an old lease
as current. Candidate arrays are copied before asynchronous startup. Terminal
publication validates all IDs/order and existing `{id,status,pass,reasonCode}`
rows together. Physical PASS/MISS is rejected even from a faulty injected backend.
Only whitelisted scalar/counter evidence crosses the wire, never source/VM banks.

The current retained publisher and compact journal remain fail-closed. This
Worker adds no qualification toggle. Incomplete bounded work may be finalized
as incomplete/unsupported, never as a successful or failed physical shot.
Source-stale and cancelled rows retain `pass:null`; device loss is FAILED with
DEVICE_LOST. No partial successful batch is published. Fresh operation resources
are disposed before replacement; failed/lost-device pipelines are not revived.

## Evidence categories — do not conflate them

| Gate | Observed result | Scope |
|---|---|---|
| Protocol/client/adapter HOST tests | 11 PASS | Fake backend/Worker/device, explicitly labelled; lifecycle only |
| Browser-like ESM graph | 2 PASS, 1 explicit skip | Node VM realm, not Chromium; private genuine-six construction case not run |
| Local HTTP package test | 1 PASS | Exact205-file graph, hashes/MIME/provenance; no browser or execution |
| Real Chromium + module Worker test | **BLOCKED before startup** | Prepared, no browser PASS and no screenshot yet |
| Real device loss / Worker retained physics | **NOT RUN** | Fake loss cannot qualify real device cleanup or trajectories |

The real-browser test serves only the fresh local opt-in bundle and uses installed
Chromium with its browser sandbox enabled, GPU disabled and an audited Worker
requestAdapter trap. It covers import/startup, package-version mismatch,
cancellation/stale/disposal during held local startup, all-row unsupported ABI,
and absent SharedArrayBuffer global. It does not call experimental begin.

Prepared command, for a permitted local execution context:

```sh
RAPIER_WASM_PROVENANCE=/absolute/original/decoder-provenance.json \
RAPIER_TEST_CHROMIUM=/usr/bin/chromium \
RESIDENT_WORKER_BROWSER_EVIDENCE=/absolute/new/local/evidence-directory \
node --test --test-concurrency=1 tests/resident-candidate-worker-browser.cjs
```

No external assets, user computer, deployment or publication is involved. Actual
browser completion is the immediate open gate; authenticated Worker source
construction and separately scheduled numerical/device-loss gates remain
subsequent work. Package import/unsupported responses are not raw-candidate,
full-rest or1024-row qualification. Default application activation stays false.
