# Explicit resident qualification entry points

These commands are **not release activation**. The default CPU backend, inverse
planner, physics rules, UI and existing `npm test` command are unchanged. See
[release gates](resident-release-gates.md) for the larger outstanding requirements.
No component/metadata test can qualify raw GPU full rest, late foul, a genuine
three-ball GPU owner, 1024 physical trajectories, hardware throughput or release.

## Deterministic HOST contracts

```sh
npm run test:resident:host -- --plan  # list only; no tests or temp allocation
npm run test:resident:host          # serial, explicitly enumerated tests
```

Requires Node with `module.registerHooks` (22.15+ / 24+) and the repository's
bundled `vendor/rapier.cjs`. Missing files fail before execution. The source of
truth is the ordered `HOST_TESTS` array in
`tools/run-resident-qualification.cjs`: **never glob**
`resident-candidate-*.mjs`. That directory also contains standalone helpers,
artifact-dependent programs and long native jobs.

The 36-file maintained list covers:

- ABI, intrinsic backing-buffer ownership (including absent/shared/cross-realm
  SharedArrayBuffer cases), parameter counts, full initial event history and optional inverse
  terminal-observation encoding (not a GPU observation producer).
- Scalar VM/control-cache/external-call/source-intrinsic/operand contracts and
  word predicates, all on the host. Exact optional Number-macro candidate-local
  guards and unchanged four-macro source identities are explicit tests; the
  historical pre-preparation and current disabled-preparation core profiles
  remain distinct rather than blanket repinning old receipts.
- Generated inverse-observation reducer differentials against the original
  observation source (including malformed frames, nonfinite arithmetic and
  lane isolation), plus portable SHA-256 independent vectors/byte semantics.
  These do not qualify the native observation producer or browser worker.
- Resource formulas, fake-device allocation, cancellation/loss/disposal,
  atomic compact publication, identity/continuation/variant/session contracts.
  Fake-device 1024-row allocation is **not** real device memory admission or
  execution of 1024 physical trajectories.
- Actual ThreeBallGame discrete semantics and explicit final-gameplay policy,
  request/admission/worker/cooperative/planner receipt contracts.
- Genuine original CPU retained-prefix, positive full-rest and late-opponent-foul
  fixtures. The latter are real CPU trajectory checks, not GPU qualification.
- This runner's own contract tests with injected phase launchers; tiny real Node
  subprocesses test the import guard, never a GPU binding or native runner.

Seven deliberately optional cases remain skipped: one native VM GPU case,
four private-artifact metadata/fake-allocation cases and two Number-program
capture/created-world fixture cases. They are **not passes**.
The independent artifact-backed compiler/world/long recurrence suites are not
included. Add new tests by name only after checking their full import graph,
environment branches, artifact requirements and cost.

### HOST execution guard

Inherited GPU/runtime/capture/decoder feature variables and `NODE_OPTIONS` are
removed; `REQUIRE_WEBGPU=0` and `INVERSE_EVENTS_PHYSICS=0` are explicit. This
includes `RESIDENT_BATCH_SOURCE_RUNTIME`, so the optional source-runtime fake
allocation branch cannot acquire a private input accidentally. Tests get a fresh
owned temporary directory under caller `TMPDIR` (or the platform temp root),
removed after completion. An explicit existing `TMPDIR` is recommended for
concurrent cloud tasks.

The preload denies both CJS and ESM WebGPU/Dawn/helper/native-addon imports,
`process.dlopen`, `navigator.gpu`, known native coordinator child commands,
shell/external child executables and historical `/tmp` reads outside the repo or
this run's fresh temp area. Permitted Node children must retain the same guard.
Original Rapier **CPU WASM** remains allowed and is exercised by the full-rest
fixtures. This is defense in depth for a maintained trusted test list, **not an
OS sandbox** or proof against arbitrary hostile JavaScript.

Exit 0 means only the enumerated HOST contracts passed. Test failure/signal and
missing dependencies fail closed; logs always retain `releaseQualified:false`.

The source Pages workflow now explicitly runs `typecheck` and this HOST command
alongside the unchanged full application/browser gates. It does **not** launch
the native command or claim GPU qualification. This local wiring change is not
evidence of a remote CI run, publication, or deployment. Actual resident browser
and independent numerical release-SHA gates remain separately required.

## Separate native boundary qualification

`npm run test:resident:native` with no arguments fails with exit 2. There is no
`all`, default work count, auto-detected native module, direct unbounded `gpu`
phase, retry or automatic pilot continuation.

This entry point currently supports only the separately profiled **raw rows
219/522, born h192**, full application history, original-JS-number cue oracle,
and the optional four-macro source profile. It delegates to the existing
independent `tests/resident-candidate-tip-impact-isolated.mjs` prepare / retained
pilot / assert processes; it does not implement another simulation/comparator.

### 1. Prepare explicitly (original CPU oracle work)

Provide absolute existing `RESIDENT_ORIGINAL_CAPTURE` and
`RAPIER_WASM_PROVENANCE`; the latter must reference an existing decoder WASM
whose bytes match its SHA256. The original source importer independently checks
the capture, engine and decoder provenance. The target directory must be fresh
and empty. No fallback to a historical private `/tmp` path is admitted here.

```sh
RESIDENT_ORIGINAL_CAPTURE=/absolute/initial-capture.v8 \
RAPIER_WASM_PROVENANCE=/absolute/decoder-provenance.json \
npm run test:resident:native -- prepare --dir=/absolute/fresh-artifacts \
  --work=512,4096,4096,4096,4096 --plan
```

Replace `--plan` with `--confirm-prepare` only when the original-source oracle work
is authorized. Work is fixed in the manifest before any GPU state is initialized:
first block 512, at least one remaining block, original per-block/total caps.
Preparation produces distinct initial-only `runtime.v8` and assertion-only
`expected.v8` plus their hash manifests. No expected future state is a GPU input.
Record the actual **whole-file** SHA256 of `manifest.json` and `runtime.v8`.

### 2. Explicit, exclusively scheduled retained pilot

The caller must already own the numerical slot. `--exclusive-slot=...` is an
operator acknowledgment recorded in the wrapper log, **not an interprocess lock**.
Provide an absolute `GPU_NATIVE_MODULE` explicitly; the wrapper checks/hashes its
file without importing it. Native adapter identity still comes from the actual
coordinator; “native” does not imply hardware (SwiftShader is software).

```sh
GPU_NATIVE_MODULE=/absolute/webgpu/index.js \
npm run test:resident:native -- gpu-pilot --dir=/absolute/fresh-artifacts \
  --manifest-sha256=EXACT_64_HEX --runtime-sha256=EXACT_64_HEX \
  --wait-ms=600000 --exclusive-slot=coordinator-issued-token --plan
```

Replace `--plan` with `--confirm-native` only with numerical execution authority.
Every current pinned source file and both supplied hashes must match before
launch. The pilot validates initial-only inputs, **does not open expected files**,
and refuses a directory with prior execution/pilot results. The operational wait
is explicit, 1–3,600,000 ms; timeout/abort is incomplete, never a physical miss.

After the first predetermined block and GPU-copy-only capture, the existing
pilot writes its immutable cost receipt and retains the exact live session.
Only a separately authorized local operator may create an exact receipt:

```sh
node tests/resident-candidate-tip-impact-pilot-decision.mjs \
  /absolute/fresh-artifacts continue \
  --cost-sha256=EXACT_64_HEX --gpu-invocation-id=EXACT_INVOCATION \
  --manifest-sha256=EXACT_64_HEX --runtime-sha256=EXACT_64_HEX
```

Use explicit `abort` instead of `continue` to stop. The wrapper never makes this
decision. Continue consumes only the already declared remaining work, without
state mapping/patching or horizon changes. Device/pipeline errors remain real
errors. End-to-end elapsed time includes operator wait; report wait separately,
not as throughput. A successful transport still has **no comparator authority**.

### 3. Independent assertion

```sh
npm run test:resident:native -- assert --dir=/absolute/fresh-artifacts \
  --manifest-sha256=EXACT_64_HEX --runtime-sha256=EXACT_64_HEX --plan
```

Remove `--plan` to run the independent original-source comparator, never a GPU
phase. Actual/expected payloads and manifests must exist and match their hashes;
an existing assertion receipt cannot be overwritten. The original comparator
checks separate invocation identity, all 11 source groups, native PhysicsLab
outer-boundary projections, full accepted emission tape and rejected history.
The wrapper additionally requires the exact successful bounded receipt; process
exit 0 alone is insufficient.

Only that **count2/h192 raw-to-tip boundary** can be reported. Full rest, query
terminal, 1024 trajectories and hardware-performance flags must remain false.
Preparation/native/comparator failures or absent modules/artifacts are explicit
blocked/failed/incomplete outcomes, never skipped or broadened qualification.
Changed source requires fresh source-bound preparation; do not edit old manifests
or re-label frozen historical evidence to make a new checkout pass.

## Runner validation evidence

Focused tests use visibly labeled synthetic files and injected spawn results to
validate refusal, hash/source binding, exit/signal behavior and phase separation.
They never claim those mock files are physics evidence. The final guarded serial
run after the backing-buffer repair passed 170 cases, skipped the 5 named optional
cases, and failed none (28 test files; about 12.75 s on the development host). No native runner phase was executed
while developing this entry point. These counts are a checkpoint, not a release
claim; rerun the explicit command for current checkout evidence.

## Newly maintained deterministic contracts and explicit costly HOST suites

The normal `test:resident:host` list now also includes:

- curated count8/9 evidence identity/scope consistency (not a numerical replay);
- raw-cast exact fragment and authentic-cap admission units (not a full cast);
- bounded post-impact counter/budget units (not the h192→193 diagnostic);
- all-six-binding comparison negatives (not the h192 physical evidence);
- admission, environment and disposal tests for the explicit source runner.

These additions do not activate an optional artifact case. The existing seven
named optional cases remain non-passes. `npm test`, CPU defaults, CI native
policy and the native runner are unchanged.

Costly source interpreters, independent original CPU/WASM expectations and
frozen artifact replay use **separate explicit commands**. No default, `all`,
GPU phase or implicit artifact location is accepted:

```sh
npm run test:resident:source -- --suite=three-components \
  --decoder-provenance=/absolute/snapshot-wasm-decoder-provenance.json \
  --three-capture-prefix=/absolute/authenticated/capture --plan

npm run test:resident:source -- --suite=three-first-h \
  --decoder-provenance=/absolute/snapshot-wasm-decoder-provenance.json \
  --three-capture-prefix=/absolute/authenticated/capture --plan

npm run test:resident:source -- --suite=three-native-represented \
  --decoder-provenance=/absolute/snapshot-wasm-decoder-provenance.json --plan

npm run test:resident:source -- --suite=scale-artifacts \
  --artifact-root=/absolute/frozen-artifact-root --plan
```

Replace `--plan` with `--confirm-source` to execute only that declared suite.
Every process is serial and receives a fresh disposable temporary directory.
The explicit decoder's WASM and bundled CPU-engine hashes are checked before
launch. The after-turn input is exactly `PREFIX.after-turn.v8` and is mandatory
for the first two commands, so missing generation3 coverage cannot silently
turn into a skipped fixture. The original importers still authenticate contents.

| Suite | Maintained tests | Scope / cost class |
|---|---|---|
| `three-components` | initial-pre-ccd; produced-roster-broad-post | Exact source components and legacy byte fingerprints; tens of seconds, not complete h |
| `three-first-h` | first-h | Same-bank fresh/after-turn first inner h, full cue/cache/tape checks; costly source interpreter, not recurrence |
| `three-native-represented` | first-h-native | Independent original **CPU/WASM** represented first h; “native” here never means WebGPU |
| `scale-artifacts` | scale-gate-tests; scale-comparison-repair-tests; scale-recovery-tests | Frozen8/9 admission, comparator replay and mocked compilation/decision; sizeable private artifacts, no new numerical execution |

The frozen scale root must contain `macro-scale-source-v1`,
`macro-scale-bound-preflight-v1`, `macro-scale-original-expectations-v1`,
`macro-scale-held-plans-v1`, `macro-scale-held-native-v1` and
`macro-scale-count9-wgs8-recovery-evidence-v1` with the exact maintained files.
Missing files block before launch; existing individual tests retain their pinned
hashes, comparator predicates and original caps. These are historical artifacts;
the command must not be represented as fresh numerical proof for changed code.

The existing HOST preload still denies GPU bindings/helpers/addons and native
child launchers. Only the explicit source runner supplies bounded artifact read
paths; the default HOST command supplies none. Child processes must retain the
same read allowances and cannot widen them. This remains defense in depth for
maintained trusted tests, not an OS sandbox.

### Diagnostics intentionally outside both normal lists

Full `tests/resident-candidate-raw-cast-loop-host.mjs ROW PAIRS OUTPUT` and
`tests/resident-candidate-post-impact-profile.mjs prepare ARTIFACT_ROOT OUT_DIR`
then `... run OUT_DIR` are existing explicit, bounded HOST diagnostics. They are
not default tests or GPU qualifications. The raw-cast command requires explicit
`RESIDENT_ORIGINAL_CAPTURE` and `RAPIER_WASM_PROVENANCE` for portable use; read its
terminal `status`/completed pair count because an incomplete diagnostic is not a
pass. Post-impact preparation requires the pinned completed banks and independent
assertion; run caps remain2048 pumps/180000 ms. Neither command is automatically
launched by this wiring, and no horizon/source cap was changed.

### 2026-10-26 wiring checkpoint

- Runner/admission contracts:13/13, no skips; injected launchers plus real tiny
  guarded Node imports, never GPU execution.
- Updated default guarded serial HOST aggregate:226 passed,0 failed,7 previously
  named optional cases skipped;233 total,15.53 s. Skips remain non-passes.
- Explicit guarded `three-components`:10/10, no skips,34.05 s, including all
  three authentic pre-CCD fixtures and produced-roster byte/provenance checks.
- All four costly-suite plans validated against present explicit inputs with
  no test launch. `three-first-h`, `three-native-represented` and `scale-artifacts`
  were **not rerun by this wiring checkpoint**; use their explicit commands.
- Full raw-cast and post-impact diagnostic executions remain separate and were
  not launched. No GPU, publication, deployment or default simulation change.
