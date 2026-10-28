# Fresh mixed-six staged native gate

This is a separately versioned test harness, not the default backend or a
PASS/MISS producer. Native execution is **not granted** by HOST tests, a budget
proof, a launch profile, or pipeline compilation. Source/physical qualification
flags remain false. The lead owns the exclusive native slot.

## Independent roles

- `macro-launch-gate-plan.mjs`: HOST-only exact source/profile and new six-row
  coupled-budget admission, then serialize one immutable WGS1 or WGS8 plan.
- `macro-launch-gate-runtime.mjs`: lean descriptor/bytecode admission plus
  staged native compilation. Imports no source generator, compiler, original
  oracle or physical expectation. Owns one deserialized plan privately; token
  cannot expose writable source arrays. Complete runtime content, profile,
  source, bytecode, descriptors, initializer roster and schedule are bound.
- `macro-launch-gate.mjs plan|compile|compile-hold|execute`: explicit process roles. Native
  role reads only its gate file, never runtime/compiler/expected files. The
  expected process must terminate before native pipeline work begins.
- `macro-launch-expectations.mjs`: separate actual independent CPU t0/h2
  preparation and post-native comparison. Future snapshots are never runtime
  inputs and never imported into the lean native process.

The native compile role logs adapter identity, actual granted device limits,
complete pipeline order and process memory/resource usage **before** heavyweight
pipeline creation. All **26** `getCompilationInfo` checks finish before any
pipeline is created. Compilation uses the successful h192 resource-preparation order: heavy macro
2 broad first, core begin/pump, source-PC begin, 19 initializer stages, then
macros 0/1/3. This changes preparation order only; execution order is unchanged. Every pipeline
has source hash/entry/progress/resource receipts. Failure stops without WGS,
row-count, source-body or budget fallback. No buffer is allocated or uploaded
until all pipelines compile. Execution additionally requires an explicit exact
lead schedule; `compile` cannot dispatch.

After compile success, allocation uses validation/OOM scopes, creates all eleven
independent storage buffers and diagnostic buffer, checks physical GPUBuffer
identity, and performs eight initial-only uploads. Raw/numeric scratch are the
only named aliases. Uploads are sealed before the first dispatch. Any error
cleans up buffers after outstanding work is drained; no partial physical result
is published. Device loss is explicit. `dispose` rejects active execution.

## Exact source-owned schedule (both WGS1 and WGS8)

The immutable runtime is SHA-256
`780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de`;
composed source is
`c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20`.
All six raw rows and requested two source h are retained. Preparation native
helper is disabled. No old per-node steady-state numeric pumps are restored.

| Initial stage | Schedule entries | Dispatches | Groups/dispatch |
|---|---:|---:|---:|
| raw-init | 1 | 1 | 6 |
| raw-step | 1 | 79 | 6 |
| raw-finish | 1 | 1 | 6 |
| contact-init | 180 | 180 | 6 |
| contact-gjk | 180 | 46,080 | 6 |
| contact-epa | 180 | 180 | 6 |
| contact-finish | 180 | 180 | 6 |
| cast-init | 60 | 60 | 6 |
| cast-cast | 60 | 6,000 | 6 |
| cast-contact-init | 60 | 60 | 6 |
| cast-contact-gjk | 60 | 15,360 | 6 |
| cast-contact-epa | 60 | 60 | 6 |
| cast-finish | 60 | 60 | 6 |
| world-transfer | 1 | 1 | 1 |
| creation-begin | 1 | 1 | 1 |
| creation-gather | 3 | 3 | 1 |
| creation-evaluate | 3 | 3 | 1 |
| creation-scatter | 3 | 3 | 1 |
| creation-finish | 1 | 1 | 1 |
| **Raw initialization subtotal** | **1,095** | **68,313** | |

Source-PC begin adds one dispatch (six groups); WGS64 VM begin adds one (one
group): **68,315 initialization dispatches / 67 submissions** at chunk 1,024.
The only continuation is **512 × (one scalar core pump + four macro handlers)**
= **2,560 dispatches / three submissions**. WGS1 handlers each use six groups;
WGS8 each uses one group with two guarded padding lanes. Core remains WGS64.

Per fresh run: **70,875 compute dispatches**, **72 total submissions** (67 init,
3 continuation, 2 capture-copy), six copies, one final mapping. Cycle cap is
exactly **512**, not adaptively extended. A ready/waiting/unsupported result at
that cap fails parity; it is not a physical miss. Initialization and continuation
encode/submit/drain timings are reported separately; total improvements must
not be mislabeled steady-state gains when initialization dominates.

## Diagnostic boundary and memory

`t0` is **after all raw initialization, source-PC begin and VM begin, before the
first scalar pump**. It is not an invented committed post-h scene phase. The
second capture is after all 512 fixed cycles, named `h2-or-incomplete` until the
independent post-run comparator proves completion.

Each capture copies world **379,496**, VM **46,884**, and scratch **81,792**
words; both remain unmapped until the final drain. No host-state continuation or
readback-driven dispatch choice exists. Eleven storage allocations total
**10,196,212 bytes**; the separate diagnostic readback is **4,065,376 bytes**;
planned peak live allocation is **14,261,588 bytes**. These are exact source
sizes, not measured VRAM or an allocation-success claim. Readback is diagnostic
full state, not the proposed production 16-byte result protocol.

## Independent comparison authority

The test-only `createRawFirstHFixture` now accepts a known optional
`cueNumberProfile`. Omission remains unchanged. The new independent expectation
process explicitly requests **`original-js-number-v1`**, forwards it only to the
CPU oracle, and asserts the tag at t0 and each of two actual source h. This is
not a runtime/source-generation option, and the pinned initial runtime hash is
verified unchanged after expectation generation. No old expectations are merely
relabeled.

That option covers the original JavaScript Number cue lateral/compliant-tip
reference. Other original CPU owners remain unchanged, including the legacy
angular patch; application history/clocks retain their existing source behavior.
This **isolated two-h source microstep** gate is not full actual application
outer-step projection, physical rest, or 1,024 trajectories. The assertion
manifest records actual outer/subdivision fields per independently admitted row.

At t0, compare all eleven semantic projections (`balls`, `cue`, `caches`,
`cueCloth`, `journal`, `roster`, `scene`, `bvh`, `clock`, `rules`, `game`) against
fresh original no-step factories and scoring, with initial-specific source-PC,
VM, raw-creation and rejection checks. Do not impose post-h committed scene
phase. At h2, use the existing strict `compareRawWorldPcResult` → unchanged
`compareWorldBank`, all owners and both original rejections, and require all
six VM controls complete/error-free. Full-history ring state is included.

WGS8 additionally requires exact t0/final world, VM and scratch equality with an
**actual independently passed WGS1 run**, with its separately written PASS
receipt bound to the exact baseline gate/actual/expected hashes, never merely
an arbitrary baseline file or fabricated source words. All
physics comparisons happen in the separate CPU assertion process after native
work finishes.

## Commands and gates

HOST-only plan/expected preparation is authorized. Numerical dispatch is not.
The lead must grant a single exclusive `compile` invocation only after the
committed HOST plan tests and exact six-row source budget tests pass. The gate
manifest supplies the exact file SHA to the command; output directories must
be new. WGS1 precedes the separately scheduled WGS8 profile.

```sh
# These are separate HOST processes. Expected preparation exits before native work.
node tests/resident-candidate-macro-launch-expectations.mjs prepare ARTIFACT_DIR/runtime.v8 NEW_EXPECTATION_DIR
node tests/resident-candidate-macro-launch-gate.mjs plan ARTIFACT_DIR 1 NEW_PLAN_DIR 900 NEW_EXPECTATION_DIR/manifest.json
# Lead-only exclusive compile-and-hold grant; no execution yet:
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
REQUIRE_WEBGPU=1 RUN_RESIDENT_MACRO_LAUNCH_GATE=compile-hold \
  node tests/resident-candidate-macro-launch-gate.mjs compile-hold \
  NEW_PLAN_DIR/gate.v8 EXACT_GATE_SHA NEW_COMPILE_OUTPUT_DIR
```

The `900` seconds above is an **explicit lead-configured resource-retention
policy serialized in the plan** (maximum one hour), not a physical horizon,
solver budget or task-completion deadline. Each decision boundary has a fixed
nonce, phase, receipt/gate hashes and immutable expiration. A missing, expired,
malformed or mismatched decision never dispatches. On expiry or stop, owner and
cache are released; there is no automatic extension or recompilation.

### Retained-device decision sequence

1. After all 26 baseline pipelines compile, `boundary-1.json` identifies the
   zero-buffer/zero-compute receipt. The process waits for an atomically written
   `decision-1.json`: `stop`, or **`run-fixed-schedule`** with WGS1 and exactly
   512 cycles. All common nonce/phase/gate/receipt fields must match.
2. After final baseline mapping and buffer destruction, the still-clean cache
   is retained, not an oracle. The separate CPU assertion process writes
   `wgs1/assertion-receipt.json` only after t0 and h2 all-eleven-owner comparison
   passes, bound to exact gate/actual/expected hashes. `boundary-2.json` waits
   for `stop`, or **`compile-wgs8`** with the exact baseline actual hash, that
   parent-owned PASS receipt path/digest, and the exact WGS8 gate path/digest.
   The native process validates the small PASS receipt but never opens expected
   banks. An arbitrary claim string is insufficient.
3. The WGS8 plan must have the same runtime, generation, expected contract and
   fixed schedule. All 26 descriptor identities are preflighted: exactly **four
   new handlers** compile and **22 unchanged pipelines** hit the same-device
   cache. `boundary-3.json` requires a separate WGS8 `stop` or fixed-512-cycle
   run decision. After the parallel diagnostics, the device is released; its
   independent comparison still runs separately.

Any failed compilation, invalid execution or device loss permanently poisons
this retained session. Its pipelines cannot be reused on a replacement/invalid
device. HOST mocks cover no dispatch for absent/wrong/expired decisions and no
shader/dispatch API access after an injected invalid/lost device; those mocks
are ownership/control tests, not physics qualification.

Standalone `compile` remains a safe compile-and-release mode. Standalone
`execute` requires both `RUN_RESIDENT_MACRO_LAUNCH_GATE=execute` and
`RUN_RESIDENT_MACRO_LAUNCH_NUMERICAL=1`. The retained mode instead requires each
separate explicit matching lead decision. No mode upgrades compile-only
permission, changes a failed profile, or claims partial execution as parity.
