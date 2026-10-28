# Mixed-six WGS1/WGS8 bounded native validation

**2026-10-26 checkpoint: six unchanged raw candidates passed the independent
created-t0 / isolated-two-h gate on SwiftShader.** This is not full-rest,
1,024-trajectory, calibrated-speed, default-backend or compact-producer
qualification. Capability flags remain false. All evidence stays local; nothing
was uploaded or published.

The compact, source-owned evidence inventory is
[`resident-macro-mixed-six-native-validation.json`](../tests/fixtures/resident-macro-mixed-six-native-validation.json).
It records exact artifact/source hashes, the adapter's actual limits, all stage
counts, and unrounded HOST timing counters. Snapshot extraction verified the
artifact identity chain, independent PASS receipts, schedule and helper hashes;
it did not execute physics or rerun the GPU.

## Exact authority and result

- Frozen native harness: `8b8c53f`; repaired comparator:
  `89270bfac0b9333e1c5e3386d43b5f87a8496b06`.
- Fresh source SHA-256:
  `c2aded677c03f8db550530c39df80a5591057f892a2f44aa4f6fe99d956baa20`.
  Initial-only runtime:
  `780872cc0105e20375dcbd2f84a2e1962176133feefb23fdaa0a0778b312b4de`.
- Source profile `resident-preparation-disabled-integrated-isa-source-v1`:
  four exact source macros, no preparation opcode/helper call, core WGS64.
  This fresh seven-binding source does **not** inherit the historical audited
  h192 source's qualification or silently remove its mandatory eighth binding.
- IDs/order retained: **17, 118, 219, 320, 421, 522**. The first four were
  independently admitted; 421 was blocked and 522 invalid. No failed row was
  dropped. Accepted and rejected initial histories were checked.
- Independent expected bytes were prepared in a separate, terminated CPU
  process using **`original-js-number-v1`** for the application/cue reference.
  Native opened no expected banks and received no future state. Expected SHA:
  `c8d1dca508e4139d76916816bb71a0595be7b2ac42f7643b8fe0f300b6c49680`.
- Both WGS1 and WGS8 passed all **11 owners**: balls, cue, caches, cueCloth,
  journal, roster, scene, bvh, clock, rules and game. All six VM rows completed
  without VM errors. WGS8 additionally matched WGS1's **complete world, VM and
  scratch words bit-for-bit at both captures**, not only selected outputs.
- WGS1 independent PASS SHA:
  `da0c02ce7ed5639bf4aebe30923e25ab6c2958b014e84fec92220d45f8972dd3`.
  WGS8 independent PASS SHA:
  `548b6d40f57fb84ee1a3a29d351506b79d9b0c1a1884d7f247dc659fafd055ac`.
  The WGS8 receipt binds the actual baseline file **and** that independent PASS.

### Boundary repair, without changing input or dropping an owner

T0 is after all original raw initialization, source-PC begin and VM begin,
before the first scalar pump. The original CPU snapshot lazily represented
`scene` as null, so the first assertion threw before parity checking. The
assertion-only repair derives that owner from the **already-bound original
native created snapshot**, its validated 13-call no-step construction journal,
and original static body registry. Cue bodies remain genuinely created and
unregistered. It neither decodes GPU state as expected data nor invents a
post-h scene phase. Other ten t0 owners are unchanged.

Original runtime, expected and actual files stayed byte-identical. The separate
derivation receipt records helper/validator hashes and each native created
snapshot identity. Two bounded helper tests passed after WGS8 compilation and
before its execution, without timing overlap. Scope is **original native
created t0 plus all-11 isolated source-owner h2, outer-step 0**; it is not an
original Controller outer-step/h2 boundary or physical rest.

## Resource and scheduling evidence

Adapter: **SwiftShader 5.0.0, fallback adapter**, not hardware-GPU performance.
Actual device limits included 128 MiB storage binding, 256 MiB buffer, eight
storage bindings/stage, 256 invocations/workgroup, and 65,535 workgroups/axis.

Both runs retained the same six rows, h2 source and fixed **512 cycles**:

| Phase | Dispatches | Submissions |
|---|---:|---:|
| Original raw initialization | 68,313 | included below |
| Initialization plus source-PC/VM begins | 68,315 | 67 |
| 512 × (core + four macro handlers) | 2,560 | 3 |
| Two diagnostic captures | 0 | 2 |
| **Total** | **70,875** | **72** |

Each run used eight initial writes, six copies and one final mapping. Eleven
storage buffers totaled **10,196,212 bytes**; two full-state captures added
**4,065,376 bytes**, for **14,261,588 planned live buffer bytes**. This inventory
excludes pipeline/driver/compiler memory and is not measured total VRAM/RSS.
Scratch initialization aliases were retained; candidate world/VM/scratch
ownership was validated. There were no per-node CPU pumps or mid-run readbacks.

All 26 compilation-info checks preceded pipeline creation. Preparation used
broad macro 2 first, then core begin/pump, source begin, 19 initializers, then
macros 0/1/3; execution ordering was unchanged. Clean-device decision boundaries
required separate lead authorization before each fixed run. WGS8's four new
handlers compiled only after independently passing WGS1; 22 exact pipeline
keys were reused. No fallback, automatic extension or silent recompilation.

## Observed timing, not a speed calibration

HOST wall-clock seconds, one observation per profile; no GPU timestamp query:

| Profile | Native pipeline preparation | Original init + begins | Fixed continuation |
|---|---:|---:|---:|
| WGS1 | **151.643** (26 cold, 0 hits) | **8.018** | **129.253** |
| WGS8 | **103.400** (4 new, 22 hits) | **7.460** | **107.104** |

WGS8 preparation is an **incremental** cost on the retained device, not a cold
26-pipeline measurement. Continuation alone excludes initialization,
compilation, CPU reference preparation and mapping/assertion overhead. Different
cache histories, a fallback adapter and one sample each prohibit a calibrated
speedup or intended-scale throughput claim. No 1,024 extrapolation follows.

Next: [staged row-boundary and physical qualification plan](resident-macro-scale-plan.md).
