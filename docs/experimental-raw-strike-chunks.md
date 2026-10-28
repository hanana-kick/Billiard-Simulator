# Exact raw-strike step chunks (opt-in)

This is an execution-schedule experiment for the compliant raw strike, not a new
physics law, complete-shot solver, hardware benchmark, or production/default change.
`experimental-raw-strike-chunks.mjs` generates a full-step shader from the exact four
existing stage bodies: clearance before contact, cue contact, cloth advance, and
clearance after advance. Initialization and finalization remain byte-identical.

The K8/K16 variant calls those four helpers sequentially up to K times inside one
invocation. K is a host-validated, private read-only control buffer, not a compile-time
unrolled loop bound. All original row-local stores, loads, checked arithmetic,
error flags and terminal guards remain. No shared workgroup memory, barriers,
atomics, host physics, or intermediate readback is introduced.

The chunk-boundary stop guard runs **before a complete step**, not between cloth
advance and post-clearance. Reaching the step budget during advance must still run
the final swept-clearance check. Different lanes may finish independently; a host
schedule of `ceil(maximumSteps/K)` chunks covers nondivisible per-row budgets.
Banks may be re-encoded: original initialization resets all row/scratch state.

At a 4,096-step cap, dispatches are:

- Original staged execution: 16,386.
- Full-step only (K1 experiment): 4,098.
- K8: 514.
- K16: 258.

Fewer dispatches alone did not prove faster execution. The adjacent two-stage
fusion and full-step K1 variants were exact but not faster in the measured software
backend. Runtime chunks additionally avoid repeatedly dispatching completed rows.

## Evidence

`artifacts/raw-strike-chunks/native-checkpoint.json` records trusted native
SwiftShader software Vulkan runs. All 128 output words are compared to both the
original staged GPU and unchanged CPU model, including reference work counters,
elapsed time, raw input provenance, diagnostics and failure status.

- Initial run: 2,312 candidate executions, 295,936 words identical.
- Extended run: 2,726 candidate executions, 348,928 words identical. This supersets
  the initial corpus; totals must not be added as unique cases.
- The extension includes fine angles, elevations up to 84.99998 degrees, large
  tip offsets, translated coordinates, explicit obstacles and gravity-bearing
  free flight (where the guided approach shortcut is disabled).
- Divergent lanes include rejected inputs, failed clearance, step caps around
  7/8/9 and 15/16/17 and other nondivisible budgets.
- Structural/host tests: three passed; two native tests skip without the native
  environment. Independent code review checked the final post-clearance guard,
  exact helper bodies, private K and candidate-owned storage.

Initial single timing samples (submit through map completion, compilation excluded):
N1024 staged 11.155 seconds, K8 2.043 seconds, K16 1.199 seconds. N32 K8/K16 timings
were nonmonotonic, so these are not stable speedup estimates. The extended run
completed in 67.367 seconds total, sampled aggregate process RSS650.12MiB and
maximum child RSS614.43MiB. RSS is not VRAM. These measurements must not be converted
into physical GPU throughput or complete-shot search times.

## API

`createExperimentalChunkedRawStrikeGPU(device).createBank(scene, rows,
{chunkSize:16})` exposes the same raw result-buffer contract as the staged factory.
Only K8 and K16 are accepted; invalid K rejects before allocation. The original raw
source SHA256 is
`aa30d6e9ab33ae6f8ebdf5455f2103c58b1d28cf9b7e270f1288aaf5158640dd`.

The source-owned raw-world adapter separately admits the explicit factory option
`createRawWorldGPU(device, {strikeBackend:'chunked-16'})`. Its default remains
`'staged'`; there is no automatic hardware-dependent model switch. Identity,
scene ownership, duration budget and downstream PW1 handoff remain unchanged.
The backend affects scheduling only and cannot turn unsupported input into success.

Run native tests under the exclusive `/tmp/billiard-native-gpu.lock` with time/RSS
watchdogs inside the lock. Ordinary aggregate CPU tests cannot establish GPU parity.

### Owned raw-world integration

The K16 backend passed the actual source-owned raw→PW1→initializer native suite:
10/10 tests; 67 raw candidates (64 admitted). Of the 56,816 returned words,
55,280 are literal CPU comparisons and 1,536 are expected invalid-initializer
packets. Another 17 elapsed/work-budget cases compare 5,712 literal CPU words,
including zero-physics duration limits and 7/8/9/15/16/17-step boundaries.
Nineteen synthetic handoff gate cases are additional ABI rejection checks, not
physical-shot evidence. No intermediate readback or host physics was used.
Evidence: `artifacts/raw-strike-chunks/raw-world-native-checkpoint.json`.
This checkpoint does not yet claim the complete raw→world→journal/rules chain for
K16; that consuming wrapper is validated independently.

### Full source-owned world and rule seam

`tests/canonical-raw-backend-parity.mjs` compares staged and K16 wrappers with the
unchanged CPU execution, using a genuine default-material off-center shot. The
admitted test is a complete **no-contact miss**, not a scored goal or general
collision coverage. Original shot start1234, deadline, source-owned no-kiss proof,
full p/v/q, absolute journal, composite sidecar, shot-relative rule state and four
final words are compared. Invalid/failed raw inputs and step budgets7/8/9/15/16/17
produce no continuation or invented score. Pre-submission and post-submission
cancellation throw AbortError; the next run succeeds. Post-submission cancellation
suppresses the result, not already submitted device work.

Native checkpoint:3/3 tests passed;18 compared executions,11,888 literal words
identical to CPU and original staged GPU, plus2 cancellation-after-submit runs.
No intermediate readback/host physics. Sequential devices kept peak sampled
aggregate RSS1409.82MiB below1500MiB;201.296 seconds total includes two roughly70s
world shader compilations. Full-world submit-to-completion single samples were
2.490s staged and2.119s K16. **The larger raw-strike-only gain must not be described
as a full-shot gain.** Evidence:
`artifacts/raw-strike-chunks/full-world-native-checkpoint.json`.

The wrapper API accepts the explicit third argument
`createCanonicalWorldContinuationGPU(device, binding, {strikeBackend:'chunked-16'})`.
Its default remains staged and invalid backend selection rejects before compilation.
Changes to the resident world graph after this checkpoint require new regression
coverage; this evidence does not qualify future numerical changes by association.
