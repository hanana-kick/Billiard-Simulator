# Candidate-parallel exact-source macro launch profile

**Implementation status: separately versioned HOST/source preparation adapter;
its general qualification flags remain false.** The later exact six-row WGS1/WGS8
native gate passed bounded created-t0 / isolated-h2 checks; see
[its validation checkpoint](resident-mixed-six-native-validation.md). The
preparation-stage evidence below is historical and does not claim full-rest,
1,024-trajectory or calibrated performance qualification. The frozen `7d5e70b` h192 source,
its initial runtime, and its live run/bank files are unchanged. The global
numerical slot remains lead-owned. These adapter changes do not edit the scalar VM,
compiler, source-macro bodies, existing WGS1 runtime validator, or default app.

## Actual source closure audit

The adapter audits the canonical dependency closures returned by
`sourceMacroNativeWGSL`, not just macro names or root functions. Tokens and AST
show no `var<workgroup>`, mutable module/private state, local-invocation or
workgroup identity dependency, subgroup operation, atomic operation or barrier.
Only immutable numeric-profile/BVH/journal constants remain at module scope.
Function-local variables belong to each invocation as usual.

| Macro | Closure bytes | Functions | Mutable storage views |
|---|---:|---:|---|
| `rc_cue_flat_advance` | 29,808 | 61 | `rc_state`, `rc_scratch` |
| `rc_num_eval` | 14,376 | 32 | `rc_scratch` |
| `rc_world_broad_commit_collision` | 39,431 | 64 | `rc_state` |
| `rc_coupled_transport_advance` | 24,784 | 41 | `rc_state`, `rc_scratch` |

The cue/numeric/coupled closures read the immutable `rc_program`; broad reads
and writes its passed-in source-state structures. Exact native source hashes
are asserted in `tests/resident-candidate-macro-launch-profile.mjs`.

**Important distinction:** scalar macro arguments are candidate-owned VM local
slots, but their values are addresses into source buffers. Absence of barriers
is not a new proof that every argument remains within its candidate's world or
scratch span. That still requires authenticated immutable source/bytecode,
actual GPU buffer disjointness, and independent mixed-lane comparisons. The
profile explicitly records this unresolved authority rather than claiming
that a larger workgroup is automatically physically safe.

## Adapter and launch contract

`src/resident-candidate/macro-launch-profile.mjs` exports:

- `auditSourceMacroLaunchClosures()` — canonical closure inventory and audit.
- `createMacroLaunchProfile(runtime, {macroWorkgroupSize, limits})` — explicit
  source-only `resident-four-macro-candidate-launch-v1` envelope. Supported
  source preparation sizes are WGS **1, 8, 32, 64**; the core remains **WGS64**.
- `verifyMacroLaunchProfile(runtime, profile, {limits})` — revalidate every
  source/geometry identity and the supplied device limits before use.
- `macroLaunchPipelineDescriptors(runtime, profile, {limits})` — six source
  descriptors: unchanged core begin/pump plus four separately regenerated
  handlers. It does not compile or dispatch them.
- `macroLaunchAllPipelineDescriptors(runtime, profile, {limits})` — complete
  staged preflight roster: 19 original initialization stages, source-PC begin,
  core begin/pump and four macro handlers (**26 descriptors**). Every selected
  shader/entry point must pass preflight and native compile/resource validation
  before execution; failure stops, without silently reducing WGS or rows.
- `assertMacroLaunchInitialHistory(original)` — fail-closed structural history
  requirement; never a replacement for authentic initial-source capture.

For every handler, regenerating WGS1 through the **existing**
`generateMicrocodeExternalWGSL` must exactly equal the original handler bytes.
Regenerating the chosen size must differ only in its **single**
`@workgroup_size(...)` annotation. No arithmetic, storage index, branch, macro
budget, CALL/RET stub, owner ordering or source capacity changes. New envelopes
are not silently installed into the old WGS1 runtime; its rejection remains
intentional until a separate lead-owned native gate is implemented.

The first handler statement retains the exact guard:

```wgsl
if (gid.x >= SOURCE_COUNT || arrayLength(&rc_vm_state) != EXACT_VM_WORDS) {
  return;
}
// Only after the guard: base = gid.x * EXACT_VM_STRIDE.
```

The adapter verifies the exact generated literal form, not this pseudocode.
There are no collective operations requiring padded invocations to participate.
Host dispatch is **`ceil(sourceCount / workgroupSize)`**, not `sourceCount`
workgroups after changing the annotation. VM magic/version/state/pending macro,
CALL/RET, stack and error guards remain unchanged. Core entry slots still seed
`gid.x`, zero, zero into consecutive original parameter words.

The profile binds a deterministic data-content SHA-256 of the complete initial
runtime; source/prestrike/generation identities; exact ordered IDs/raw-input
hash; source/bytecode/core hashes; old/new handler hashes; source closure hashes;
parameter/return spans inside each VM stride; world/CCD/PC/request/scratch/input/
VM spans; all storage sizes; initializer/source-begin descriptors; and launch
geometry. Missing/changed count, code, generation, arguments, padding guard or
geometry fails verification, even if a caller recomputes the outer profile hash.
A limit check is caller-supplied source planning until the lead supplies actual
queried GPUDevice limits; it is not a VRAM-availability or native compile proof.

### Historical core versus fresh baseline

The historical audited h192 runtime remains exactly **2 rows**, eight storage
bindings, VM stride **7,817 words**, mandatory audit buffer **1,016,096 bytes**.
Its bytes are retained unchanged as historical evidence, not relabeled. The
integrated generator from `fb038cd` has an added *disabled/unsupported* opcode
case, so the old core no longer regenerates byte-identically: the adapter now
**rejects it explicitly**. Its former positive checks under the earlier generator
do not qualify the new core.

The fresh six-row source uses the named generator profile
`resident-preparation-disabled-integrated-isa-source-v1`. Preparation is
explicitly **disabled**: zero preparation opcodes, no preparation descriptor,
helper closure or helper call in the generated core (`rc_geometry_numeric_prepare`
and `rc_gp_*` absent). The four canonical macro closures are unchanged. The
new core/bytecode require their own native gates; they inherit no old runtime
qualification.

## Why the historical six-row runtime cannot be reused

The historical initial-only runtime at
`/tmp/resident-raw-pc-isolated-native-v2/runtime.v8`, SHA-256
`4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc`,
has the desired raw roster, but:

- `identity.options.initialHistoryProfile` is absent.
- Its `creation-finish` shader does **not** contain
  `rc_world_initial_history_commit` or the accepted-stroke append before RUNNING.

It therefore predates the successful-stroke/full-history repair and is rejected
as runtime authority. Merely adding a profile label also rejects. Only these
exact raw inputs are reused as input provenance:

| ID | Angle | Elevation | Speed | Tip X | Tip Y |
|---:|---:|---:|---:|---:|---:|
| 17 | 0 | 8 | 2 | 0 | 0 |
| 118 | 23 | 37 | 1.7 | 0.2 | -0.1 |
| 219 | 310 | 85 | 4.5 | 0.2 | -0.1 |
| 320 | 180 | 37 | 0.5 | -0.3 | 0.15 |
| 421 | 180 | 8 | 2 | 0 | 0 |
| 522 | 9 | 8 | 0 | 0 | 0 |

The historical roster deliberately includes four independently admitted clear
settings plus blocked/invalid settings. Their **current** results must still be
independently re-established; no labels/pass outcomes or expected future state
are installed in a runtime. No row may be dropped to make the gate easier.
Old h2/h8 expected files are not reused as corrected-history authority.

## Fresh mixed-lane fixture preparation interface

`tests/resident-candidate-macro-launch-fixture.mjs` has three explicit stages:

1. `mixedLaunchInputsFromLegacyInitial(bytes)` checks the exact pinned initial
   file and roster, returns only owned raw rows/provenance, and records why its
   obsolete source cannot be reused. It opens no expected or actual bank file.
2. `prepareMixedMacroLaunchSource({initializationPlan, inputProvenance,
   sourceHead, sourceHashes, sweeps})` requires a **locally authenticated current
   `createWorldInitializationPlan`**. It validates full history and exact raw
   prestrike clone, checks common source/prestrike identities, regenerates all
   six rows' initialization plus unchanged h2 source/owner schedule, then
   composes source for scalar compilation. It preserves the rule words/source
   horizon, actual successful-stroke commit, IDs and raw Number parameters.
   It imports no scalar compiler and runs no forward physics/oracle.
3. `attachMixedMacroLaunchCompilation(fixture, compiled, options)` accepts only
   actual separately compiled output whose source SHA and entry exactly match
   the owned fresh source fixture. It requires all four canonical macros,
   unchanged WGS64 core, original argument/return slots, and no new intrinsic
   authority. It creates the new preparation-only
   `resident-mixed-six-four-macro-initial-only-runtime-v1`, never relabels the
   historical runtime or the count2/h192 coupled-budget proof.

The preparer retains the owned fixture while handing `source.code` to the
coordinated compiler process; returned real compiler output is attached back to
that fixture. There is deliberately no unchecked rehydrate/qualify switch.
The new six-row compiled envelope records `coupledBudgetAdmission: false` until
an exact source-bound proof is separately established. The current fixed
`assertCoupledMacroBudget` hash applies only to count2/h192 and is not reused.

## Fresh six-row initial source evidence

The HOST coordinator `tests/resident-candidate-macro-launch-prepare.mjs` directly
uses `originalRegisteredFixture` and `createWorldInitializationPlan`, not the
forward-oracle helper. It verifies the pinned initial capture, zero native
steps, full history and exact raw clone; retains the owned fresh source fixture
while a separate compiler worker runs; then attaches only the matching actual
compiler artifact. It atomically writes handoff files with no overwrite and
publishes the final source manifest last. A bounded timeout or any mismatch
fails without a usable final manifest. It does not import a GPU runtime or CPU
forward oracle, open future assertion files, or supply physics outcomes.

Fresh files are under
`resident-native-artifacts/mixed-six-macro-launch-v1/`. The committed compact
receipt is `tests/fixtures/resident-microcode-mixed-launch-source-shape.json`.

- Generation HEAD: `3514fd3e0a993685b2348d74b18b6f999fceb2c3`.
- Original source: **542,365 bytes**, SHA-256
  `c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20`.
- Initial-only runtime SHA-256:
  `780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de`.
- Bytecode SHA-256:
  `30f7e7aae2258d01bdcb98811024f314592351f83ced1ffadfde2cda36c825e4`.
- New core SHA-256:
  `cedfc8e0b6fdb26a174ebefb2e687172d7466f6e03a5c50ad88e19ed289872f6`.
- **131,112 instructions**; call-frame allocation **92,493 → 7,783 locals**;
  stack 15 plus control 16 gives **7,814 VM words/row**. This is the actual
  fresh non-audited six-row profile, not the audited h192 7,817-word profile.
- Source state **379,496 words**, source program **874,992**, geometry **25,408**,
  shared scratch allocation **81,792**, input **96**, VM **46,884** words.
- Exact seven VM storage bindings. All candidate rows remain resident together.
  This source inventory is not measured VRAM or an allocation-success claim.

| Macro WGS | Groups for six rows | Padding lanes |
|---:|---:|---:|
| 1 | 6 | 0 |
| 8 | 1 | 2 |
| 32 | 1 | 26 |
| 64 | 1 | 58 |

The compiler worker recorded **two** HOST lowering invocations: the first
successfully lowered/allocated but its receipt-only assertion incorrectly
assumed source descriptor order matched requested-name order. Stable IDs were
correct. The corrected receipt checks the exact ID/name set and records this
recovery; no physical failure or result was hidden. Successful compile plus
allocation was **627 ms**, peak process RSS **288,472 KiB**. These are HOST
preparation measurements, not GPU timing. Runtime construction and attachment
then succeeded. No native compilation, numerical execution, GPU readback or
CPU forward oracle ran.

## HOST checks and original native-gate handoff

```sh
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
RESIDENT_MACRO_LAUNCH_RUNTIME=/workspace/scratch/f887f82f638e/resident-native-artifacts/coupled-raw-impact-native-v1/runtime.v8 \
RESIDENT_MACRO_LAUNCH_INPUTS=/tmp/resident-raw-pc-isolated-native-v2/runtime.v8 \
RESIDENT_MACRO_LAUNCH_FRESH_RUNTIME=/workspace/scratch/f887f82f638e/resident-native-artifacts/mixed-six-macro-launch-v1/runtime.v8 \
RESIDENT_MACRO_LAUNCH_FRESH_SHA256=780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de \
node --test --test-concurrency=1 tests/resident-candidate-macro-launch-profile.mjs
```

Ten HOST/source tests pass (zero skips with the explicit artifacts): closure audit; exact data identity; old history/core
rejection; raw roster preservation; fresh original handler regeneration; annotation-
only change; exact ceil/padding/bindings; argument/count/history mutation guards;
and supplied device-limit failure. These are not native WGSL compilation or
trajectory tests. The implementation emits no GPU work or evaluation result.

The lead exclusively owns: exact new source-budget
proof, native compile/resource validation, a small six-row WGS1 versus candidate-
parallel comparison, independent fresh ORIGINAL physical assertions (including
initial history and multiple real valid rows), complete source/scratch/VM/PC
comparison, repeatability and mixed terminal/unsupported handling. Increasing
row counts, full-rest qualification and performance measurement come only after
those gates. Existing qualification flags remain false.

The subsequently completed bounded six-row native gate and remaining scale/physical
gates are recorded separately in the [validation checkpoint](resident-mixed-six-native-validation.md)
and [staged scale plan](resident-macro-scale-plan.md); preparation flags are not
retroactively rewritten into production qualification.
