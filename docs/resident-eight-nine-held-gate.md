# Frozen four-macro eight/nine held diagnostic gate

> Historical stage record; subsequent outcomes are preserved in the
> [four-profile validation checkpoint](resident-eight-nine-validation.md).

**Prepared only; no eight/nine native compilation or GPU execution yet.**
Implementation checkpoint `5c0721f74cdac639ebca2831ab6b611faaf12668`, isolated
worktree `billiard-resident-scale-held-gate-v1`. Exact runtime and independent
reference bytes remain those of the [source checkpoint](resident-macro-eight-nine-preflight.md).
No production ownership brand is restored from a serialized test artifact.
All general/full-rest/1,024 and performance qualification flags remain false.

## Frozen plans

Local directory: `resident-native-artifacts/macro-scale-held-plans-v1`.
Manifest SHA:
`28a94f09f1a1139a76a6ca70deee4a878ac909b7dce24d8abea1b23c5b34f215`.
The [source-owned receipt](evidence/resident-scale-held-gates.json) records exact
script hashes, resource inventory, pipeline order and test scope.

| File | SHA-256 |
|---|---|
| `count8-wgs1.v8` | `5256fea5d39dcfec53a22dd803b7b6e0cf6e65a1d2b790e2bd2d892275409ef2` |
| `count8-wgs8.v8` | `694a82ec41dc1f3133860764b3d60ba706fe8ac0debeb54cf81e776aa9765f37` |
| `count9-wgs1.v8` | `04d27df2f03cc7dd1239b3ff0675ddfeee01b1f08f1f5e414a4bb70565843978` |
| `count9-wgs8.v8` | `679a2a921d0839f062ce524561277e90c77c4ef29c2bf6b0a48544f6ff945110` |

All four plans explicitly select **900 seconds** of idle-device decision
retention. This is a lead-configured resource policy, not a physical horizon,
performance target or automatic execution deadline. A different policy requires
new plan bytes/hashes. The native entry point accepts only count8/WGS1.

## Unchanged diagnostic engine and exact work

The existing mixed-six native engine was extracted behind its unchanged closed
six-row validator and reused by a **separate closed eight/nine validator**.
Only the adapter-selected authorization/actual-kind and capture row count are
variable. Neither native path imports a compiler, source generator or oracle.
Token metadata is detached/deep-frozen so nested ordered IDs cannot mutate its
private admitted plan. Expected banks are never opened by the native process.

For each independently authorized run:

- All **26 compilation-info checks** precede pipeline creation.
- Compile order: broad macro2 → core begin/pump → source-PC begin → 19 original
  initializers → macros0/1/3. Execution order stays core + macros0/1/2/3.
- **68,313 raw-init dispatches + two begins = 68,315**, 67 submissions.
- **512 fixed cycles × five = 2,560** continuation dispatches, three submissions.
- Two full world/VM/scratch copies, no intermediate host map: six copies,
  two capture submissions and **one final mapping**.
- Total: **70,875 dispatches / 72 submissions / eight initial writes**.

If, and only if, all four runs receive their separate decisions, the complete
chain totals **283,500 dispatches / 288 submissions / 24 copies / four final
mappings / 32 initial writes**. Initialization runs afresh for every run; only
exact same-device pipelines are retained. There is no per-node host pump,
CPU-forward input, reduced roster, hidden horizon extension or warm-state reuse.

Count8 planned live buffers total 16,306,420 bytes; count9 17,328,836 bytes.
These figures exclude pipeline/driver/host memory. Actual device limits are
queried before pipeline work and rechecked before allocation. Historical
six-row cold pipeline preparation peaked at 1,672,180 KiB RSS on SwiftShader;
that is neither an eight/nine measurement nor proof against OOM. Use default
Node heap, not an unnecessary 4 GiB override, and observe the owned child.

## Seven decision boundaries

Every record must match its current boundary's nonce, gate hash, receipt hash,
phase and count. Unknown fields, expired/mismatched records and missing decisions
never start work. `stop` is allowed at every boundary. Loss/failure poisons the
retained cache; allocation/execution errors drain and destroy owned buffers.

| Boundary | Sole non-stop action | Required evidence |
|---|---|---|
| 1: count8 WGS1 compiled | `run-fixed-schedule` | exact WGS1, cycles512 |
| 2: count8 WGS1 actual | `compile-same-count-wgs8` | independently passing count8 WGS1 actual + receipt |
| 3: count8 WGS8 compiled | `run-fixed-schedule` | exact WGS8, cycles512 |
| 4: count8 WGS8 actual | `compile-count9-baseline` | count8 independent WGS8 PASS, bound to count8 WGS1 actual/PASS |
| 5: count9 WGS1 compiled | `run-fixed-schedule` | exact WGS1, cycles512 |
| 6: count9 WGS1 actual | `compile-same-count-wgs8` | independently passing count9 WGS1 actual + receipt |
| 7: count9 WGS8 compiled | `run-fixed-schedule` | exact WGS8, cycles512 |

No count9 plan is loaded or compiled by this lifecycle before boundary4's
validated terminal count8 proof. Final count9 diagnostics still require the
separate independent assertion; completion of the fixed work cap alone is not
physical PASS. Expected cache deltas in this retained order are cold/warm
**26/0 → 4/22 → 12/14 → 4/22**; a changed/lost cache stops, not silently recompiles.
These deltas passed mock protocol checks but have not been measured natively.

Decision schema: `resident-scale-macro-lead-decision-v1` (not the old mixed-six
schema). All records carry `{kind, nonce, gateSha256, receiptSha256, phase, count,
action}`. Run adds `{cycles:512, macroWorkgroupSize}`. Compile-WGS8 adds
`{baselineActualSha256, passReceiptPath, passReceiptSha256, nextGatePath,
nextGateSha256}`. Compile-count9 replaces `baselineActualSha256` with
`terminalActualSha256`; the retained owner validates the full baseline chain.
Only metadata PASS receipts are opened natively, never the expected banks.

## Lead-only launch and observation setup (NOT executed)

Run only after the lead grants the exclusive numerical slot and establishes the
quiet compile/timing window. The prepared supervisor follows the successful
mixed-six owned-child pattern: verify clean exact HEAD and all plan hashes,
clear inherited GPU/run/Node overrides, set the explicit existing ICD and
native module, use Node's default heap, capture stdout/stderr and poll only its
owned child. It records VmRSS/VmHWM/Threads and MemAvailable/Swap every10seconds,
then records actual exit/signal and child resource use. Memory polling is
observation, not a qualification threshold or permission to lower workload.

The child command is:

```sh
REQUIRE_WEBGPU=1 RUN_RESIDENT_SCALE_GATE=compile-hold \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
node tests/resident-candidate-scale-gate.mjs compile-hold \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-held-plans-v1/count8-wgs1.v8 \
  5256fea5d39dcfec53a22dd803b7b6e0cf6e65a1d2b790e2bd2d892275409ef2 \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-held-native-v1
```

That grant compiles/holds the first profile only. It cannot numerically dispatch
without the separately written matching boundary1 decision. The lead owns all
subsequent decisions and supervision; this preparation task does not launch it.

## Separate post-run assertion role

For each count/WGS, invoke `tests/resident-candidate-scale-assertions.mjs` with
`count runtimePath expectedPath actualDirectory newReceiptPath`. WGS8 additionally
requires **both** `sameCountBaselineDirectory explicitBaselinePassReceiptPath`.
For example, after an authorized count8 WGS1 run has terminated:

```sh
node tests/resident-candidate-scale-assertions.mjs 8 \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-source-v1/count8/runtime.v8 \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-original-expectations-v1/assertions-count8.v8 \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-held-native-v1/count8-wgs1 \
  /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-held-native-v1/count8-wgs1/assertion-receipt.json
```

The comparator retains original created-t0 authority, all11 isolated h2 owners,
accepted/rejected full history, immutable CCD tail, and complete/error-free VM
rows. WGS8 also requires bit-exact **entire world/VM/scratch at both captures**
against its own count's independently passing WGS1. Incomplete/unsupported/error
states cannot become misses. There is no newly manufactured original Controller
outer-step boundary, full-rest proof or default-backend release.

HOST checks passed: six new contract groups (13.45s, zero skips) and six old-six
regression groups (12.86s, zero skips). The new comparator has not yet consumed
an eight/nine native result. No raw/future binary was committed, uploaded or
published, and no new runtime/expected generation occurred for this adapter.
