# Owned initial-only production microcode construction

`src/resident-candidate/initial-microcode-runtime.mjs` now owns the source-only
construction that previously lived in a fixed six-row test fixture. It does not
import tests, deserialize artifacts, request a device, step CPU physics, execute
GPU work, publish a result or change the default executor/backend.

```js
const runtime = createInitialMicrocodeRuntime(initializationPlan, rawRows, {
  experimental: true,
  maxHSteps: 2,       // explicit source-physics h ceiling, not a VM pump count
  dispatchChunks: 512, // explicit independent total VM work budget
  instructionBudget: 65536, // optional spelling; only this baseline is admitted
});
assertInitialMicrocodeRuntime(runtime); // same producing realm, before use
```

`initializationPlan` must be the existing genuine locally authenticated
`createWorldInitializationPlan` result. A clone, caller hash, fabricated receipt,
saved six-row runtime or future/expected state cannot grant this authority.
The same worker must authenticate the initial input and construct the runtime.
A later executor also needs the ordinary live application source-revision lease;
this initial-data brand is not a claim that the user's game has not since moved.

## Exact supported source profile

- Raw `{id, settings:{angle,elevation,speed,tipX,tipY}}` rows retain original
  Number bits without clamping, quantization or candidate generation. The
  existing transport accepts 1–4096 distinct IDs; this is **source construction
  capacity**, not device memory/scale or numerical admission. Only count six
  has been differentially exercised in this checkpoint. Eight/nine rows will
  be generated once through this API under a separate declared gate.
- Genuine complete prestrike/accepted-stroke history; raw clone equality is
  checked against the authenticated template.
- Unchanged `micro/flat/staged/staged/staged` world transports, source-closures-v1
  ownership and single-call control, preserved-f32 profile, original caps,
  call-frame allocation, no inline intrinsic/preparation helper, WGS64 cached
  disjoint core and all four exact WGS1 source macros.
- Current admitted bank/scratch layout is exactly 62976/13632 words. Changed
  layouts or caller shapes reject; this is not a general-layout proof.
- The new seven-binding constructor explicitly rejects requested audit or
  observation profiles, even a caller-supplied false override. It cannot
  silently remove a required eighth binding or observer. Future observed
  transport requires its own declared builder/admission.
- Unknown options, numerical-qualification overrides, wrong budgets, malformed
  raw rows and unbranded input fail before publication. No `qualifiedMask` is
  accepted; qualification flags remain false.

`initial-microcode-budget.mjs` binds the complete coupled/cue caller ASTs,
source guard, canonical macro signature/body/transitive closure, and complete
compiled caller/control words. Only the actual lane-count guard in the source
cap-initializer AST and its corresponding single compiled `SET` are normalized.
Bank/scratch strides, offsets, pointer arguments, cap store, error path, source
order and original 32768 cap are not normalized or replaced. The actual complete
new source/bytecode/descriptors are hashed; the sole coupled CALL must remain in
the admitted caller and target the exact id3 stub/RET. This source-budget proof
is not arbitrary-pointer or numerical qualification. The constructor itself
runs the real compiler; an externally supplied compiled object is not an API.

## Runtime ownership / integration boundary

The new kind is `resident-owned-initial-microcode-runtime-v1`, with:

- `original`: fresh initializer commands/resources/uploads, original PC,
  packed raw inputs, world program/geometry and authoritative rule/row/source
  identity; no evolving world bank or VM state;
- `vm`: freshly compiled code, complete core and four handlers, descriptors,
  entry slots, exact layout and independent work budget;
- `identity`: original-generation, source/code/core and logical-view identities;
- `source`: actual source WGSL/entry, not a caller source hash;
- `sourcePreparation`: explicit disabled preparation/audit/observation profile,
  source budget proof, logical views and unqualified capability.

Everything is independently detached from the input plan with `structuredClone`.
Metadata is frozen. Typed arrays cannot be frozen, so admission rechecks every
reachable typed span against private exact byte/buffer/offset/length/backing-span
snapshots and revalidates the original authenticated plan. Constructor canonical
hashes remain unchanged; frozen immutable metadata need not be repeatedly hashed. Changed/detached spans reject; cloned envelopes
have no brand. This deliberately does not reuse the fixed-six runtime kind,
historical sourceHead/file manifest or prepared-source fixture identity.

The existing executor still runs its old transports; production submission,
launch-scale admission and compact result publication have **not** been changed.
The protocol worker can consume this brand in a separate new launch envelope;
its fixed-six and historical count-two gates must not be broadened/relabelled.
The existing classic/CommonJS browser loading adapters remain a separate
integration requirement (see `resident-browser-source-hash.md`). The new module
adds no Node builtin, test harness, filesystem or ambient device dependency.
Actual browser-worker/application tests are still required before release.

## HOST differential

`tests/resident-candidate-initial-microcode-runtime.mjs` independently loads the
original no-step fixture only in the test process, creates a fresh authenticated
plan, then invokes the production API. Against immutable accepted six-row
runtime SHA `780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de`,
it requires exact initializer commands/arrays/shaders, complete original PC,
program, geometry, raw words, full source, bytecode, VM locals/layout, macro
approval descriptors and complete core/handler strings. Only explicit new
ownership/provenance/profile metadata differs. The test rereads frozen inputs;
no artifact is overwritten or imported as constructor authority.

Seven HOST groups passed (six full differential/admission groups, plus one
separately filtered arbitrary-row group). The latter changes IDs and preserves
signed zero/nonfinite raw Number values, with a declared h ceiling 43 and VM
budget 3; it generates source only and does not execute those h. An ambient
navigator getter throws during construction, verifying no device request.

Mutation gates cover every reachable nonempty typed view, nested metadata,
detachment, unknown authority/audit options, malformed rows and source/compiled
cap drift. Source bodies are never simplified. No CPU future, native physical
step, GPU run, full-rest result, browser release or performance measurement is
claimed. Run the genuine gate with:

```sh
RESIDENT_INITIAL_RUNTIME_ARTIFACTS=/path/to/mixed-six-macro-launch-v1 \
  node --test --test-concurrency=1 tests/resident-candidate-initial-microcode-runtime.mjs
```

Without the explicit local evidence directory, the genuine differential groups
are skipped, not marked qualified. Frozen evidence stays read-only.
