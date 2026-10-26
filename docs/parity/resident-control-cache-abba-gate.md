# Invocation-local control cache: bounded comparison gate

**The bounded native ABBA gate passed at source checkpoint `123c5b6`: sixteen independent original comparisons, all eleven source groups, and exact equality of every source/VM word across all four runs.** This is not a physical-strike/full-rest or 1,024-candidate gate. The first interrupted preparation attempt remains recorded separately.

`storage-v1` remains the default VM generator mode. `invocation-cache-v1` is explicitly opt-in and requires `vmStateDisjoint: true`. Only status, error, PC, SP, low/high step counters and last opcode are cached inside one invocation. Source banks, VM locals, CALL-stack words, bytecode and macro bodies stay in their original storage. The runtime checks actual GPUBuffer object identity before dispatch; the declaration alone is not sufficient.

The cache publishes the exact control prefix at committed RET, before the unchanged external validator, and at every kernel exit. Main-entry rejection and the post-budget yield-overflow check retain storage behavior. Host tests compare all source/VM words at normal and malformed boundaries, reverse the generated step/main transformation, and retain unchanged default/macro shader text. These tests are transport evidence, not native execution.

## Same-device ABBA

The coordinator prepares both artifacts from one committed source snapshot. The entire initial-only six-row payload, scalar bytecode, macro shaders, source caps and instruction budget must match. Only the core control mode/shader differs.

Execution order is storage→cache→cache→storage. One retained device/pipeline cache serves four **fresh** source/VM allocations. Both complete shader descriptor sets preflight before any expensive compilation. All distinct pipelines, including both core modes, then compile before any source/VM allocation or timed execution. Every run retains the unchanged original initializer, fixed 512 pump cycles and one final diagnostic map. There are no intermediate CPU state decisions or future-state uploads.

After execution, the existing independent original comparator runs separately for each artifact: sixteen original comparisons in total, all eleven source groups. A second assertion requires every source and VM word to agree across all four runs. These are not substitutes for each other.

```sh
ROOT=/workspace/scratch/f887f82f638e/resident-native-artifacts/control-pair-native-v2
RESIDENT_MICROCODE_BUDGET=65536 \
RESIDENT_MICROCODE_CHUNKS=512 \
RESIDENT_MICROCODE_WORKGROUP=64 \
RESIDENT_MICROCODE_INTRINSICS=none \
RESIDENT_MICROCODE_ALLOCATION=call-frames-v1 \
RESIDENT_MICROCODE_EXTERNAL_FUNCTIONS='["rc_cue_flat_advance","rc_num_eval","rc_world_broad_commit_collision"]' \
node tests/resident-candidate-microcode-world-isolated.mjs prepare-variants "$ROOT"

# Only the coordinator holding the globally serialized numerical slot runs this.
RUN_RESIDENT_MICROCODE_WORLD_GPU=1 REQUIRE_WEBGPU=1 \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
node tests/resident-candidate-microcode-world-isolated.mjs gpu-variants "$ROOT"

# A different process; only now may assertion-only original future data open.
node tests/resident-candidate-microcode-world-isolated.mjs assert-variants "$ROOT"
```

Cold compilation, initialization, CPU encoding/submission, queue-drain wall time and final mapping are reported separately. There is one warm sample per mode; these are not GPU timestamps or a hardware/software calibration ratio. All children must acknowledge a no-execution timing hold before submission. No long-shot extrapolation is justified by a small timing change.

Existing old artifacts without the new paired mode/disjoint fields remain storage-mode artifacts. They do not acquire cache qualification implicitly. Fresh prepared comparison artifacts include both fields and hash the cache transformer and comparison contract along with the compiler/runtime.

## First attempt and resource-sensitive retry boundary

At `f0cd90a`, all 50 descriptors (27 distinct cache identities) passed preflight. The child then received **SIGKILL**, confirmed return code −9 after 65.007 s, while compiling the unchanged broad macro. Cue/numeric macro pipelines had compiled; the new cached core had **not** compiled, no source/VM banks were allocated and no physics was dispatched. Peak child RSS was 1,685,476 KiB, lower than a prior successful broad run. This does not establish an OOM cause, a timeout or a cache-shader compiler defect. No cgroup counters were exposed; fresh exec PID namespaces cannot describe other sessions.

Two avoidable resource costs were found. Inspection re-deserialized artifacts already verified in memory, and identical read-only host inputs occupied separate backing stores. The retry removes those copies only after strict pair equality. Every GPU run still receives fresh independent banks. Pipeline preparation changes to broad-first, then both small core modes; ABBA execution, shaders, instruction budgets and physical bounds do not change.

Also, `/tmp` was a tmpfs holding about 2.7 GiB. Thirteen **owned diagnostic** files (278,152,600 bytes) were copied with matching SHA-256 hashes to disk-backed workspace storage; their original `/tmp` paths remain readable symlinks. No unrelated/expected-only external artifact was moved. This reduces tmpfs pressure but is not proof that pressure caused the kill. Exact failure phases, identities and reversible relocation records are retained in [the interruption evidence](../evidence/resident-control-cache-abba-precompile-interruption-v1.json).

## Successful preparation-only retry

The entire serialized runtime of each mode was byte-identical to its first-attempt artifact. The unchanged broad macro compiled first, followed by both small cores, then the other original pipelines. All 50 descriptors preflighted; all 27 distinct pipelines compiled before any source/VM allocation. Cold preparation was **116.373 s**, separate from the following execution observations:

| ABBA order | Mode | Pump host wall | Initialization | Steady end-to-end host wall |
| --- | --- | ---: | ---: | ---: |
| 1 | storage | 135.780 s | 8.053 s | 143.854 s |
| 2 | invocation cache | 109.612 s | 7.489 s | 117.133 s |
| 3 | invocation cache | 103.731 s | 6.740 s | 110.472 s |
| 4 | storage | 125.899 s | 7.007 s | 132.943 s |

All runs used the same retained SwiftShader device and compiled pipeline cache, fresh independent six-row GPU banks, the unchanged 512 pump cycles/2,048 pump dispatches, and one final diagnostic map. The four accepted rows reached h2; the two rejected rows retained unsupported status/reasons at h0, not physical misses. All sixteen original comparisons and complete wordwise transport comparisons passed. Child exit was 0, peak RSS 1,666,676 KiB, elapsed 625.106 s. The inherited AS/DATA/RSS/CPU resource limits were unlimited; the wrapper supplied no subprocess timeout. These observations do not identify the cause of the first SIGKILL.

The cache samples were lower in this ABBA run, but this is a small software-adapter host-wall comparison, not GPU timestamps, a hardware/software correction, or proof of full-shot throughput. Every worker acknowledged a timing hold; no child tests or source edits ran during the measurement. `storage-v1` remains default. The next gate is genuine retained-state recurrence beyond h2, not another claimed full-shot result.

Exact identities, separate encode/submit/drain/readback values, adapter identity, resource observations and gate outputs are in [the native evidence](../evidence/resident-control-cache-abba-native-v1.json).
