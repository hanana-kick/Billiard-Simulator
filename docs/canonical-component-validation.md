# Canonical component validation

Run `npm run test:canonical-components` for the current isolated canonical
physics, state-domain, rule reducer, candidate batching, and command-schedule
checks. This deliberately does not change the production entry points or claim a
complete application/release qualification.

Without `GPU_NATIVE_MODULE`, native tests are explicitly skipped. CPU and
fake-device scheduling tests do **not** prove CPU/GPU execution parity. For actual
native runs, use the trusted native WebGPU installation, `REQUIRE_WEBGPU=1`, the
selected Vulkan ICD, and the exclusive `/tmp/billiard-native-gpu.lock` lock. Put
process-time/RSS watchdogs **inside** the lock and retain the lock until descendants
are cleaned up. Run targeted native suites rather than one unbounded aggregate.
SwiftShader results are software Vulkan correctness measurements, not hardware
GPU performance measurements.

The aggregate currently repeats some tests shared by the state-domain and event
suites. Report per-suite totals, not their sum as unique test cases. At historical local
checkpoint `24ab8b9` the default run recorded:

- Event components: 159 passed, 37 native skips, 0 failed.
- State-domain components: 58 passed, 15 native skips, 0 failed.
- Rules/batch/schedule components: 13 passed, 2 native skips, 0 failed.
- `npm run typecheck`: passed separately.

Physical-law acceptance, exact CPU/GPU word parity, gameplay-rule correctness,
and complete raw-shot execution are separate claims. A compact physics REST
result is not a gameplay PASS. Missing event or kiss coverage must remain explicit.
The build, physics regression suite, and full real-app browser tests required by
`AGENTS.md` remain necessary before publication/release. These component checks do
not replace them.

## Expanded local checkpoint (2026-10-27)

After the source-owned raw-hit/microtail integration and reviewed tube derivative
gate, the expanded aggregate passed with these **per-suite** CPU/default results:

- Event components: 166 passed, 39 native skips, 0 failed.
- State-domain components: 58 passed, 15 native skips, 0 failed.
- Additional canonical components: 115 passed, 23 native skips, 0 failed.
- Type checking passed separately.

Some test files are imported by other suites, so these totals are not unique case
counts. The phase9 candidate-address audit was renewed explicitly in `5eeb40f`
after the release derivative guard changed; the other28 source pins were unchanged.
Its separate native candidate-isolation regression covered12 scenarios and234,752
exact words. CPU aggregate success alone is still not native qualification.

## Expanded rolling, trace, and batching coverage (2026-10-27)

The aggregate additionally covers the committed MMQ2 original rolling-law
primitives, mixed pair and finite cushion entry, clear/departure/stop adapters,
explicit MMQ2 cushion resolver, v1 repeated-pair and cushion world routes, selected
trace foundations, and frozen raw-batch schedule/admission guards. The v1 finite
CLEAR and inactive indirect-dispatch fake-device contracts are included as well.
The opt-in compile-cache tests cover native layout identity, failure/device-loss
handling, and bounded retention (a child process explicitly enables GC).

Committed selected raw-shot trace capture, GPU trace profile admission, and
source hydration CPU checks are included after trace checkpoint `cf7ce27`.
The selected-shot service lifecycle tests are included after `7037d5e`; they
exercise cancellation, supersession, unsupported replacement, and receipt guards
without claiming that the application entry points have been switched.
Native-only scale and producer/ledger suites and uncommitted MMQ2 world
integration are not added by this checkpoint. Existing native cases in
mixed CPU/native files remain explicit skips with `REQUIRE_WEBGPU=0` and an empty
`GPU_NATIVE_MODULE`. No physical GPU, full app, browser, or release qualification
follows from this aggregate. The separate CPU workflow does not itself gate the
Pages deployment workflow.

The final local command for this expansion was run on the shared working tree
based on `7037d5e`, with stable selected-trace/cache/session commits above and
concurrent MMQ2 world-route edits still present. Therefore this is a working-tree
checkpoint, **not** an immutable clean-checkout or full MMQ2 world qualification:

- Event components: 171 passed, 40 native skips, 0 failed.
- State-domain components: 58 passed, 15 native skips, 0 failed.
- Additional canonical components: 357 passed, 50 native skips, 0 failed.
- All three processes reported 0 cancelled and 0 todo; separate type checking passed.
- Command: `REQUIRE_WEBGPU=0 GPU_NATIVE_MODULE= npm run test:canonical-components`.

The earlier retry encountered a temporary missing selected-trace export during a
concurrent edit. That run was failed, not counted as passing; the source owner
restored the export before `cf7ce27`, and the complete command above passed after
that fix. Re-run the aggregate on the final integrated commit before using it as
a reproducible release gate. These per-suite counts still contain repeated and
imported tests and must not be summed as unique cases.

## Fixture-only imports and reduced duplicate registration (2026-10-27)

Commits `f18b95d` and `b3bdf85` move shared query, rolling, cushion, resolver, and
stop fixtures into `tests/fixtures/`. Consumers no longer import executable test
suites just to obtain a fixture. The fixture definitions and original test
assertions are preserved; an AST comparison of 103 existing test calls across 23
touched suites found no changes other than fixture import paths. The separate
world owner extracted its world fixture in `809e9b4`.

The new `canonical-fixture-imports.mjs` gate parses imports with TypeScript's AST.
It rejects executable-test imports in the aggregate's dependency graph and checks
that the extracted fixture dependency closure imports no `node:test`. Both static
imports and the existing `import(root + 'tests/...')` pattern are checked. This is
not a general dynamic-code evaluator. Native-only suites remain independently
invoked; they must also consume fixture-only modules.

The final CPU aggregate and typecheck passed after correcting two initially
missed dynamic fixture imports in the v1/v2 cushion-release suites:

- Event components: 171 passed, 40 native skips, 0 failed.
- State-domain components: 58 passed, 15 native skips, 0 failed.
- Additional canonical components: 182 passed, 31 native skips, 0 failed.
- All three processes: 0 cancelled, 0 todo. Type checking passed separately.

Comparing the preceding successful aggregate with this one:

- Total registrations: 691 to 497, despite adding 3 import-guard cases and 2 stop
  proof cases (the native proof is skipped in this run).
- No existing unique test name disappeared: 435 names before, 440 after. Names
  are an audit aid, not a claim of unique physical scenarios; different assertions
  can share a name. The preserved test-call bodies provide the stronger check.
- Repeated registrations by name: 256 to 57. Remaining repetitions include the
  intentionally overlapping event/state-domain commands and separately written
  tests with identical names; they are not all removable duplicate assertions.
- Each of the 8 base mixed-query cases registered 19 times before and once after.
  Each of the 6 MMQ2-motion cases registered 7 times before and once after.
  Each of the 3 rolling-cushion cases registered 4 times before and once after.
- The removed imports eliminate 179 repeated CPU-case registrations and 20
  repeated native-case registrations. Native cases were SKIP in this comparison;
  no native throughput or RSS improvement was measured here.

The aggregate elapsed sum was about 88 seconds before and 91 seconds after under
concurrent development/compilation. This does **not** establish a wall-time
speedup. The concrete benefit is removal of redundant assertions and accidental
native-suite launches from fixture imports, without dropping prior assertions.
No production physics code changed in this refactor. Re-run on the final complete
integration commit for a reproducible release gate; full application/browser and
native qualifications remain separate.
