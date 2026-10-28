# Current-source compact GPU search service

Experimental opt-in; not default activation or a release certificate.

The production factory is exported only through the verified sealed entry. Direct
unsealed use fails. Its private runtime is the existing current-source batch GPU
producer, not a caller-provided factory, frozen shader snapshot, selected-shot loop
or CPU physics implementation. The packaged controller combines this service with
selected-shot sources whose overlapping bytes must match the reviewed source pin.

## Bounded flow

- A complete immutable request, raw start, continuation settings, candidate IDs and
  five strike parameters are captured before any asynchronous work.
- Full gameplay rules (`search:false`, allow-kiss, no condition-only early exit)
  match selected-shot scoring. Unsupported search filters are not silently ignored.
- Eligible MMQ1 tiles use N16 only with four bodies, raw maximumSteps=2048 and
  all 16 candidates admitted, through the exact qualified opt-in batch gate.
  MMQ2, three-body, other raw caps and unadmitted tiles retain N3/N1 processing.
  Each width reuses its compiled engine within the request; N3/N1 handle tails
  without fake padding. Unadmitted rows remain explicit UNSUPPORTED results.
- Each submitted candidate reads only its original 4-word/16-byte compact result.
  No full trajectory is captured for the population. A selected shot is a separate
  same-model execution, not a trace reconstructed from compact packets.
- Population limit4096 is a bound on queued candidates, **not4096-way parallel
  execution**. Maximum eligible MMQ1 width is16; MMQ2 remains3. Frozen
  `supportedWidths`, `n16RosterCount`, `n16MaximumSteps` describe eligibility;
  cumulative `batchWidths` records actual submitted widths.
- Compact statuses retain PASS, MISS, INCOMPLETE and UNSUPPORTED. Unknown outcomes,
  unresolved events and unavailable scores never become successful or missed shots.
- Source/request/scene/epoch/candidate identities and exact readback size are checked
  before immutable cumulative progress publication. Cancellation, supersession,
  source changes or disposal invalidate the result. One owner serializes compilation
  and submission even after a request is superseded.
- Existing time/local work limits remain. Cumulative event/work accounting is not
  newly implemented. Actual GPU performance, browser behavior and full model coverage
  remain separate gates.

## Host checks

`tests/canonical-compact-search-service.mjs`:11 tests passed at f3edc2b, including
N3 reuse/N1 tails, packet/source drift, unsupported admission, exact profile/rules,
input ownership, cancellation, source change and compile serialization. These use
an explicitly labelled fake runtime; they are not native GPU proof.

## Native integration test

`tests/canonical-compact-search-native.mjs` has a separate `--prepare` mode that
computes six original CPU compact packets before the bounded native process starts.
The native path imports no local CPU dynamics module. It loads exact artifact bytes
and verifies both artifact/reference hashes and every reviewed source-pin byte.

The native path exercises the production sealed service with two successive N3
submissions. It compares all24 compact words, requires real PASS and non-PASS
outcomes, checks cumulative progress3→6 and96 readback bytes, and observes actual
device shader/pipeline construction counts to ensure the second tile does not
recompile. No N33/default-width or physics arithmetic change is part of this test.

Native terminal evidence is recorded below only after the bounded process finishes.

### 2026-10-28 native terminal

The production sealed service passed on SwiftShader software Vulkan with the
reviewed86-module source revision
`e26d280ff1d9da4e1669cbbdb0d153338bedc90a15e3fcb6f30a0424ed7c7085`.
Standalone artifact SHA256:
`59fb1b65ec0c8dd94745c464d776fc4695d785e34377dff911fb6a98812fb491`.
Precomputed reference SHA256:
`5807e088683ed8839a50679b1291c27692035f1c6b83491ab60a0f3d74dda9d9`.

All24 words matched: three PASS, one gameplay MISS and two unresolved INCOMPLETE
results. The six admitted raw READY candidates used angles0,45,10,1,330,-1 with the
known goal fixture's other raw parameters, including candidate ID4294967294.

- Progress:3 then6; compact readbacks48 +48 =96 bytes.
- Actual pipeline constructions93 and shader-module constructions99 after both
  tiles: no second-tile compilation.
- Compile97.295s; first/second submit-through-readback6.199s /6.419s.
- Per-tile command encoding225.4ms /251.7ms;32,994 dispatches each.
- Planned owned buffers566,132 bytes per tile, separately from process memory.
- Bounded process112.697s; sampled aggregate RSS1,048.02MiB.
- Unchanged240s /1,500MiB watchdog, exit0, stopReason null.
- Receipt:`/tmp/canonical-compact-search-native-receipt.log`.

This proves repeated production compact service execution for this narrow MMQ1
fixture, not thousands of simultaneous candidates, MMQ2 search, a browser UI,
physical hardware throughput, or selected-shot re-execution within this same test.
The source producer generated all scores; unresolved cases remain unavailable.

## Public packaged controller end-to-end native proof

`tests/canonical-controller-public-native.mjs` separately generates the public
preset's nine CPU compact references and the first successful candidate's manual
256-word final state. The bounded native process then uses the final public
browser asset (not an injected service or selected-session harness):

1. `startCanonicalPractice` requests the real native WebGPU adapter/device and
   installs the authored practice preset on the actual `LabController` class.
2. `startSearch` evaluates the explicit nine-parameter population in three N3
   compact submissions. All nine computed PASS packets match their CPU references.
3. `applyRoute` applies the first computed PASS's exact settings: angle−2°,speed.5,
   elevation25°,tipX0,tipY.2. No settings are substituted after verification.
4. `fire` executes exactly one selected GPU shot using the packaged same-model
   selected source. `advanceSeconds` drives presentation to authoritative REST.
5. All256 committed state words equal the separately computed original CPU
   reference. Score+1 and active cue50 agree, and undo/redo restores the exact state
   and game score. Mutating the returned state copy does not mutate authority.

The host supplies no browser DOM/render scheduling; it uses actual controller,
physics-table construction and game classes. Legacy `step`, `strike` and `restore`
are replaced by throwing assertions so any fallback would fail. During the native
run no CPU dynamics reference routine is imported or executed. This is native
controller integration evidence, **not real browser or UI evidence**.

2026-10-28 terminal:
- Public asset SHA256:`865c2b3eae4e451999169327e176c0bb363ec3762592dded643faa5fe24bf94e`.
- Sealed batch source revision remains`e26d280ff1d9da4e1669cbbdb0d153338bedc90a15e3fcb6f30a0424ed7c7085`.
- Reference SHA256:`98bf982b9ecf25220f9e7c9e18860235e48cf6f9fc48bad8de4f4ff31d04b014`.
- Progress3→6→9; each stage still93 pipelines/99 shader modules.
- Exactly4 native queue submissions:3 search tiles and1 selected shot.
- Final total184 pipelines/194 modules; no per-candidate selected-shot execution.
- Selected final candidate ID2, final absolute tick3,286,952, physical REST,
  score+1, active cue50;256 exact state words and exact undo/redo.
- Bounded process195.918s, sampled aggregate RSS1,354.07MiB,
  unchanged240s/1,500MiB limits, exit0, stopReason null.
- Receipt:`/tmp/canonical-controller-public-native-receipt.log`.

The public preset currently covers nine successful short MMQ1 shots, not a broad
search domain or cushion-path suite. The earlier service test independently keeps
MISS and unresolved INCOMPLETE outcomes distinct. Physical hardware throughput,
actual browser/mobile/settings/font operation and general release readiness remain
unqualified; this proof does not waive those gates.

## MMQ1 N16 kernel qualification (2026-10-28)

`tests/experimental-live-world-n16-native.mjs` prepares original CPU references
in a separate process, then imports a byte-verified sealed artifact for native
execution. This is an explicit qualification profile, not default width promotion:
`mmq1-n16-repeat-qualification-v1` requires MMQ1, four bodies, admitted candidates,
staged strike, sealed uploads, atomic bounds faults, source-order compilation and
raw maximumSteps=2048. Replacements enforce admission before any GPU allocation.
N1/N3 defaults and MMQ2 remain unchanged at this checkpoint.

- Reviewed source revision: `c8ca0113dacafb4db3ab1112a9a12bbc6ead49cf786e3eec9b73f17140075348` (86 files; only batch policy changed).
- Artifact: `/tmp/canonical-n16-reviewed-sealed.mjs`, 947,432 bytes,
  SHA-256 `653127ac1814c65255b015688fbad6805350264a538e6346540a9acd95db4225`.
- CPU reference: `/tmp/canonical-n16-reference.json`,
  SHA-256 `2bbe929ecea18ff2fde4a5279c5733f5405e7554dd4867a00c0b1ccf1bad3c9a`.
- Native receipt: `/tmp/canonical-n16-native-receipt.log`;
  native log: `/tmp/canonical-n16-native.log`.

The 16 candidates use the known raw goal geometry, gameplay `search:false`,
mixed angles `[0,45,10,1,330,-1]`, distinct high IDs including `0xfffffffe` and
`0xffffffff`. Their compact outcomes are 8 PASS, 3 MISS, 5 INCOMPLETE; incomplete
results are retained, not converted to misses. Full diagnostic readback matched
all **46,656 words**, then a reversed replacement population matched all **64
compact words**. Request, scene, epoch, source and candidate-key identities also
matched. A real unadmitted tip candidate was rejected without a buffer allocation
or submission. The two valid submissions reused exactly 93 pipelines / 99 shader
modules; no CPU dynamics were executed in the native process.

| Metric | Full diagnostic | Repeated compact |
|---|---:|---:|
| Readback bytes | 186,624 | 256 |
| Planned total owned GPU bytes | 3,050,640 | 2,864,272 |
| Dispatches | 32,994 | 32,994 |
| Submit-to-done including readback | 14.349 s | 13.792 s |
| Command encoding | 221.4 ms | 277.9 ms |

Compilation was 95.799 s. The bounded process completed in **127.694 s** with
sampled aggregate RSS **1,036.01 MiB**, exit 0, no watchdog stop, under the unchanged
240 s / 1,500 MiB limits and native flock. Allocation admission remained below the
existing **8 MiB total-owned-buffer** policy (not merely a per-storage limit).

This qualifies this explicit **MMQ1 N16 kernel and repeat/permutation path** on
SwiftShader software Vulkan. It does not qualify MMQ2 N16, physical-GPU speed,
all physics branches, actual browser behavior, or a new N16 production-service
composition. The previously documented public-controller N3 proof remains a
separate historical artifact; its checksum is not this artifact's checksum.


### N16 service composition after kernel qualification

The service opts into the same tested N16 gate only for eligible MMQ1 tiles;
the batch factory's default remains N1/N3. Host tests cover populations16/17/19/
32/34, compiled-width reuse, exact source-order N16 configuration, 3/1 tails,
MMQ2/three-body/non2048 fallback, and an unadmitted row followed by a valid N16
tile. Progress and final receipts expose immutable actual `batchWidths`. This
host composition test is distinct from the N16 native kernel proof above; no
new full public-controller N16 native execution is asserted.
