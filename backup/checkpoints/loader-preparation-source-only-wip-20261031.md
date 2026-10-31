# Source-only WIP backup: loader allocation and preparation diagnostics

This checkpoint is NOT release-ready, a deployment, a Mac Chrome fix, or full
GPU search qualification. Build artifacts and source/build pins are NOT
regenerated; their previous revision does not describe these changed sources.
Do not deploy this source tree with its historical generated artifacts.

Changes: avoid a redundant normalization copy only when hashing an already-owned
validated artifact snapshot; retain the public canonical serializer, caller
isolation, all authentication and structural admission checks. Preserve pending
preparation stage/label/entrypoint/byte-count diagnostics on Worker device loss,
and distinguish unavailable adapters from insufficient limits without replacing
native request errors. No shader, physics, command, binding requirement, timeout,
execution budget or validation weakening is included.

Own-executor CPU/host tests, Node 24.22.1, --max-semi-space-size=4
--max-old-space-size=256 --test --test-concurrency=1:
- engine-artifact, worker-owner-entry, worker-owner-protocol: 38/38 passed.
- program-library, device-loss-waiters, device-loss-subscriptions,
  pipeline-priming-budget, canonical-compile-cache-device, production-runtime,
  worker-owner-client: 89/89 passed.
These host suites include fake GPU objects for contract/error-path testing;
they are NOT real GPU execution evidence. Full build, physics aggregate and
full real-app browser tests were not rerun for this checkpoint.

Separate unchanged deployed-source experiments compiled 119/119 individual
pipeline descriptors in fresh software-driver processes. A combined retained
engine never reached full preparation or the 53,751-command search/readback;
there is NO independent CPU-versus-GPU search-result equality claim. These
software-driver resource experiments neither reproduce nor resolve the user's
macOS Chrome device loss. Native binaries, raw evidence, generated payloads,
reports and unrelated untracked files are excluded from this backup.

The previous backup/snapshot-manifest.json and historical backup documents
remain unchanged and do not describe this checkpoint. This commit is marked
[skip ci] intentionally: no Actions, main update or deployment is requested.
