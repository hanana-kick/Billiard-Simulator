# Canonical component CI: CPU-only scope

`.github/workflows/canonical-components-cpu.yml` adds the independent check
**Canonical components / CPU only (native SKIP)** on pull requests, pushes to
`main` or `backup/**`, and manual dispatch. It has read-only repository permission,
no deployment step, no new secrets, and no native binary installation. It uses the
same `actions/checkout@v4`, `actions/setup-node@v4`, and
`actions/upload-artifact@v4` versions already used by the repository workflows,
Node 22, and dependency versions resolved by the existing `package-lock.json`.
Those action tags are the existing version policy, not immutable SHA pins.

The sequence is:

```sh
npm ci --no-audit --no-fund
npm run prepare:engine
npm run typecheck
REQUIRE_WEBGPU=0 GPU_NATIVE_MODULE= npm run test:canonical-components
```

The aggregate's shell pipeline preserves test failures via `pipefail`; its log is
retained for 14 days when available, including failure output and explicit native
SKIP records. A failed install/preparation/typecheck cannot become a successful
component job merely because no test log exists. The package script, not a second
workflow-owned test list, owns aggregate membership.

## What a green check does and does not mean

It establishes that the checked-out aggregate's CPU checks and fake-device
contracts pass. It does **not** establish native CPU/GPU exact-word parity,
physical GPU speed, all physical-law acceptance, production engine migration,
full browser behavior, or release readiness. Native tests are intentionally
**SKIP**, not passed. Imported/repeated suites must not be summed as unique cases.
See [component validation](canonical-component-validation.md) for the separate
native qualification procedure and interpretation of software Vulkan evidence.

The existing `pages.yml` build, physics, resident-host, provenance, and complete
real-app desktop/mobile browser gates are unchanged and remain necessary.
This separate workflow is additive: it does **not** automatically block the
existing Pages deploy job. Enforcing it as a release/merge dependency requires an
explicit later workflow or branch-protection change; no such policy change is
made here. Component success alone never authorizes publication.

## Native CI prerequisite and publication boundary

No existing `.github/workflows` file provides a trusted native WebGPU provisioning
recipe. Do not turn this CPU job into a native claim by setting `REQUIRE_WEBGPU=1`
without an actual, verified adapter and trusted runtime. A future separate native
job needs an approved/pinned runtime and adapter recipe, exclusive execution,
bounded process/RSS cleanup, and retained every-word comparison evidence. Label
SwiftShader as software Vulkan, not hardware acceleration. Browser qualification
and physical hardware timing remain separate.

The local working branch at introduction is `work/direct-parameter-candidates-v1`;
the intended backup destination is `backup/cpu-gpu-parity-20261024`. A local check
or commit is not a backup upload. This addition neither pushes that branch nor
runs GitHub Actions. Publication remains blocked pending the required explicit
authorization; no remote status is inferred from these files.
