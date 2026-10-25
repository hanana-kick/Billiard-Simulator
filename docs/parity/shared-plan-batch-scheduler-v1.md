# Explicit shared arithmetic-plan scope

`Runtime.createPlanBatchScope(actualDevice, bounds)` is opt-in. Call
`scope.createDevice('world-id')` once per independent world, then pass that facade
to the existing world constructor. Only `Runtime.createResidentGraph` recognizes
these facades, through its private WeakMap. Every ordinary GPU method forwards to
the original device with the correct receiver. Passing the original device does
not opt in. Nested scopes, anonymous owners, duplicate IDs and arbitrary backend
callbacks are not supported. Load `experimental-plan-batch-scheduler.js` before
calling the factory in browser builds; its global is
`LabPlanBatchSchedulerExperimental`.

Each exact wire plan shares one compiled native resident graph: input stride,
every encoded instruction word (including constant signed-zero bits), and the
ordered result indices must all match. Hashes are not used for identity. Plans
are frozen at construction. Nonmatching plans have separate groups. Requests
whose combined row counts exceed the plan's row cap dispatch in separate groups.
There is no CPU arithmetic or approximate physics path.

Same-turn independent requests are copied synchronously and gathered at a
microtask boundary. One native `run` packs their input rows, performs one unchanged
WGSL vector dispatch and one readback, then slices detached outputs back to each
request. Groups execute serially, including requests which arrive during mapping.
Microtask scheduling alone does not promise that asynchronous worlds reach the
same plan together. A real two-world first-step measurement found 176 requests
and 176 dispatches with no multi-owner dispatch, so world orchestration must use
explicit owner frontiers rather than claim same-turn grouping is sufficient.

Call `scope.beginRound(activeOwnerIds)` before launching independent world steps.
Each step must call `scope.endRoundOwner(id)` in its `finally` block, including
worlds which never use a shared graph. After all steps settle, call
`await scope.finishRound()`. A frontier waits until every still-active participant
has queued arithmetic work or explicitly ended; there is no timeout. It then
freezes the queued requests, groups exact plans, and dispatches only that frozen
frontier. Faster owners' newly queued work waits for the next frontier. Mixed
plans remain separate dispatch groups. This provides real sharing across
asynchronous GPU-map callbacks without conflating worlds or arithmetic plans.

`cancelOwner`, `cancel`, and device loss mark affected round participants ended
before waiting for drain, so a cancelled/not-yet-queued owner cannot deadlock its
siblings. Queued signal cancellation must still reach the world's required
`finally`/`endRoundOwner` boundary. `finishRound` rejects while any participant has
not ended. Beginning another round requires the previous round finished and the
scope idle. Snapshot `round`, `frontiers`, `roundsStarted`, `roundsCompleted`,
`maxFrontierOwners`, and each dispatch's `frontierId` expose these boundaries.

Default and maximum limits:

| Bound | Default | Maximum |
|---|---:|---:|
| Rows per native dispatch | 512 | 512 |
| Resident GPU bytes, including growth peak | 256 MiB | 1 GiB |
| Owners | 64 | 128 |
| Exact plans | 64 | 256 |
| Stage handles | 4096 | 16384 |
| Pending requests (queued plus submitted) | 1024 | 4096 |
| Pending rows | 8192 | 65536 |
| Pending input bytes | 64 MiB | 512 MiB |

Owner IDs and scope labels have 1–128 characters. Device storage limits further
reduce legal rows. All bounds fail closed. GPU byte accounting includes retained
program/index storage, all four resident row buffers and the old-plus-new peak
during growth. It does not count driver allocations or JavaScript metadata.

Handles preserve their own busy lease and cannot be disposed while a request is
pending. Disposing one idle handle does not destroy a kernel shared by other
owners. Queued cancellation removes only that request. Submitted cancellation
keeps its lease busy until the shared native dispatch drains, rejects that lane,
and delivers other lanes normally. A row-status failure triggers GPU-only per-request isolation retries. The ordinary
resident API still rejects incomplete or non-finite rows. Valid sibling requests
receive their separately rerun results; only invalid requests fail. These pure
arithmetic retries do not touch world state. Every initial and retry dispatch
and readback is counted, with `rowFailureIsolationGroups`,
`rowFailureRetryDispatches` and `recentDispatches[].isolationRetry`. Submit, map,
validation-scope and device failures are not classified as row failures and are
not retried. No partial results are committed. Device loss rejects queued
work and the native runtime invalidates shared resident buffers.

`cancelOwner(id, reason?)` terminally cancels that owner and returns a drain
promise. `cancel(reason?)` does the same for all owners. Neither destroys buffers
under a sibling request. `flush()` waits for already admitted initialization and
queued/in-flight work. Always `await scope.flush()` before `scope.dispose()`:
request promises can settle just before the scheduler's final drain microtask.
Disposal rejects a busy scope and otherwise disposes its handles and kernels.

Snapshots include bounded recent dispatch records (last 32), exact plan IDs,
owner IDs, logical rows, request counts and actual native dispatch/readback
counter deltas. `multiOwnerDispatches` is incremented only when the underlying
resident runtime submitted a vector dispatch containing at least two distinct
owner IDs. `programCompilations` and per-plan native buffer counters expose reuse.
Snapshots are evidence, not a replacement for an independent GPU observer.

Validation on 2026-10-25 used native WebGPU with Vulkan SwiftShader, not a claim
about hardware throughput. The focused suite passed seven tests, including six
real WGSL tests. Explicit round-frontier tests used distinct asynchronous task
callbacks for three owners and two exact plans: nine requests formed three
frontiers and six actual dispatches, three containing both matching-plan owners.
No-shared-work completion, terminal cancellation, queued device loss, and a
failed owner releasing its surviving sibling into the next frontier also passed. A two-owner divide-by-zero case preserved the valid sibling
through one failed combined dispatch plus two independently observed GPU retries
(three dispatches/readbacks total, with the invalid request rejected). The first pair of independent owner requests produced exactly
one independently observed submit/dispatch and one readback; three repeated
pairs reused program and resident storage. Mixed output order, row-cap splitting,
queued and submitted cancellation, owner-terminal cancellation, device loss and
cleanup passed. Existing arithmetic/resident host regressions also passed (17).
World-level integration and end-to-end physics parity are separate gates.
