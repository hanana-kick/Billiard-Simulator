# Exact count9/WGS8 fresh-device recovery gate

> Historical stage record; subsequent outcomes are preserved in the
> [four-profile validation checkpoint](resident-eight-nine-validation.md).

The retained eight/nine session ended with SIGKILL (signal9) while creating the
first count9/WGS8 pipeline: broad macro2. All26 compilation-info checks had
passed; no count9/WGS8 execution decision or actual artifact was produced.
Observed child peak RSS was1,934,112KiB. **The cause is unproven; this is not an
OOM diagnosis or a physical mismatch.** Existing logs, resource traces and
successful count8/WGS1, count8/WGS8 and count9/WGS1 results remain immutable.

This separately closed entry retries only the missing count9/WGS8 diagnostic.
It does not change or reopen the historical held lifecycle/cache assertions.
Exact plan SHA:
`679a2a921d0839f062ce524561277e90c77c4ef29c2bf6b0a48544f6ff945110`.
No source/input/shader/layout/cap/schedule/reference bytes change. All original
raw initialization is repeated on fresh buffers; no old actual/expected bank
is read natively or uploaded. The preparation was HOST-only, not a native grant.

## Admission and ownership

`tests/fixtures/resident-scale-recovery-contract.json` pins the prior count8
WGS1 independent PASS, count8 WGS8 PASS and its exact baseline chain, count9 WGS1
PASS, original failed compile decision6, supervisor terminal receipt, and a
bounded last-stage observation bound to original logs. All evidence is small
metadata JSON, read before device creation. The observation is source-side
failure evidence, not physical qualification. Contract SHA: `a4e925c2bf7d3af2a9f68f03f1c165cc821494187b052dcc56c3ec75e2d407e7`.

The CLI creates a **new owner and new private empty cache**. It validates all26
WGSL modules before any pipeline, compiles all26 cold in unchanged broad-first
order, and requires26cold/0warm. No failed cache or existing owner is accepted
by the CLI. Limits/adapter/order/resources are logged before heavy compilation.
Compile-only allocates no runtime buffers and dispatches no work. Failure/loss
invalidates this attempt; there is no implicit second retry or WGS fallback.

After full compilation it writes `compile-receipt.json`, `boundary-1.json`, and
waits for one explicit decision. Resource retention remains the exact plan's
900seconds, not a physical horizon or automatic task deadline. Decision schema:
`resident-count9-wgs8-fresh-device-lead-decision-v1`, exact fields
`{kind,nonce,gateSha256,receiptSha256,contractSha256,phase,count,action}`;
phase is `count9-wgs8-fresh-device-compiled`, count9. `stop` has no extra fields.
`run-fixed-schedule` adds **only** `{cycles:512,macroWorkgroupSize:8}`. Old held
session decisions, missing/expired/mismatched records and changed caps cannot run.
Write decision metadata atomically only after lead review; no automatic decision.

## Lead-only compile command (not executed during preparation)

```sh
REQUIRE_WEBGPU=1 RUN_RESIDENT_SCALE_RECOVERY=compile-hold \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
node tests/resident-candidate-scale-recovery.mjs compile-hold \
 /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-held-plans-v1/count9-wgs8.v8 \
 679a2a921d0839f062ce524561277e90c77c4ef29c2bf6b0a48544f6ff945110 \
 /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-count9-wgs8-recovery-evidence-v1 \
 /workspace/scratch/f887f82f638e/resident-native-artifacts/macro-scale-count9-wgs8-recovery-native-v1
```

Use default Node heap and the owned-child resource supervisor. Clean inherited
GPU/Node overrides, verify exact frozen HEAD/plan/evidence bytes, record actual
adapter/limits, and observe owned PID memory. Fresh-device memory/compile success
is not assumed from the prior peak or current MemAvailable.

A separately granted run has68,315 initialization commands (68,313raw +2begins),
2,560 continuation commands (512×core+four macros),70,875total dispatches,
72submissions,8initial writes,6copies and1final map. Count9 WGS8 uses2groups and
7padding lanes; real admitted ID825 is gid8. All nine rows remain in order.
Only pipeline coldness changes; no successful prior schedule is rerun.

The output is pending independent assertions, never physical PASS by itself.
Run the corrected `tests/resident-candidate-scale-assertions.mjs` on the new
`count9-wgs8` actual directory with original count9 runtime/reference and both
original count9/WGS1 actual-directory and its explicit independent PASS path.
Require all11 created-t0/isolated-h2 owners, full accepted/rejected history and
bit-exact full world/VM/scratch at both captures against that baseline. No
Controller outer-step, full-rest, speed, default-backend or1,024 claim follows.

## HOST checks

Five groups passed (1.82s,0skips): fixed prior-chain/failure metadata; exact
one-decision rejection cases; all26-before-pipeline/cold-only mock compilation
with zero allocations/dispatch; stop/failure/loss without fallback; lean imports.
Mocks prove lifecycle only, not compilation by a real driver or physical parity.
The initial mock omitted two required device-limit fields and correctly failed
admission; its log is retained separately before the corrected mock suite PASS.
