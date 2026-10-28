# Current-source candidate-parallel graph prototype

This additive prototype does not replace `experimental-raw-world-batch-*` or its
0850a4d/host128 evidence. It does not enable application search, manual playback,
or forecasting, and does not inherit the frozen N256/N1024 qualification.

## Why another adapter is required

The frozen path contains80 shader strings,86 audited binding variants, a manually
copied host schedule, and a signed32 stable-roster admission boundary. The live
canonical MMQ1 path has since changed high-ID recipes, journals and other source
stages; MMQ2/cushion adds further stages. Replacing old source hashes alone would
not establish equivalent schedules, buffer ownership, or the same search and
selected-shot model.

## Actual graph capture, not another copied schedule

`experimental-live-world-capture.mjs` invokes the real live raw/world factories
on a nonexecuting recording device. It records actual generated WGSL, pipeline
layouts, buffer ranges, dispatches, clears and copies. CPU physics is never run by
this capture. Exactly one original raw handoff marker separates the already
candidate-parallel real raw producer from world continuation.

The initial prototype accepts only N1/N3, MMQ1/no-cushion and no selected trace.
Each candidate gets a one-candidate host capture so its actual identity uploads
are retained. Captured source, allocation shape, complete binding ranges and
command graph must match exactly across candidates; only upload contents may
vary. An optional expected plan identity rejects a mismatched selected/search
recipe. This is a mechanical identity gate, not yet a unified application service.

Lowering preserves x lanes and adds candidate-y storage strides. Mutable buffers
are never shared. An unchanged read-only buffer can be shared only when every
candidate's uploaded bytes match. Original binding subview bases and lengths are
retained. Copies and partial clears are explicit candidate-local kernels, rather
than reinterpreting a subview length as a whole-candidate stride. Ordered complete
binding numbers, upload/copy/clear ranges, one submission and all writes before
submission are checked. Unknown operations reject. The ownership report exposes
allocation classification and every lowered dispatch's bindings.

## Explicit local bounds, not native OOB assumptions

The original index-only lifting utility does not prove original indices in range.
An original out-of-bounds subview index could address a neighboring candidate
when the view is enlarged into an arena. Mapping it to the arena's end is also
insufficient: WGSL dynamic-error behavior may return data elsewhere in the bound
GPUBuffer, not necessarily zero. See [WGSL invalid memory references](https://www.w3.org/TR/WGSL/#invalid-memory-reference).

`experimental-guarded-storage-lift.mjs` adds a strict scalar u32/i32 storage-access
rewrite. A load/store/update checks the original view length before any physical
storage access. Negative indices become out of range, each index is evaluated
once; compound updates capture their old value before evaluating the RHS. Shared
read-only pointers/shadowing and residual unclassified storage identifiers also
reject, and unreviewed index function effects, pointer escapes, workgroup state,
atomics in the original source and unsupported assignment forms reject.

Any invalid local access sets a separate atomic sticky candidate fault. Its local
load returns zero and its store does nothing solely to finish safely; this is
**not a claim of matching native undefined/dynamic-error behavior**. Subsequent
guarded phases skip that candidate. A final GPU gate overrides its compact result
with `[candidateId,4,4,0x80000000]` (unsupported, score unavailable), never MISS or a
score. The fault buffer is not part of the captured physics buffers and is reset
for each run. In-range source arithmetic and physics branches are unchanged.

This experimental profile can require9 storage bindings per shader stage. Device
limits are checked before native compilation; unsupported devices reject. It is
not a claim of baseline mobile/browser compatibility. A future8-binding design
would need its own ownership proof.

## Evidence and limits

- CPU capture/lowering tests check current-source graph identity, source/layout/
  ownership drift rejection, mutable sharing rejection and upload/order/range
  failure cases.
- The small native guarded-storage test verifies valid, one-past-end and signed
  negative candidates, unchanged neighbor padding, sticky fault across dispatches
  and final unsupported gating (55 exact words). It is not whole-shot evidence.
- Current-source guarded N1 passed:2916 full diagnostic words equal the live
  CPU reference; repeated compact output is16 bytes and identical. The run used
  85 lowered variants,96.961s compilation,110.574s total and1391.21MiB sampled
  aggregate RSS under180s/1500MiB on SwiftShader software Vulkan.
- Current-source guarded N3 subsequently passed 8,748 full diagnostic words,
  repeated 48-byte compact output, same-engine reversed order, post-submit
  cancellation and reuse. Compilation took 114.540 s; compact submission took
  7.130 s; total was 163.032 s with sampled aggregate RSS 1,368.32 MiB under
  the unchanged 180 s / 1,500 MiB bound. Actual recipe manifest SHA-256:
  `a43cb25eb9b88f53f215a4586d2f82c75a268493a0c46bcba8a3848634f61477`.
  Candidate IDs 100 / 4294967294 / 300 produced GOAL / unsupported / unsupported,
  respectively; this does not qualify goal/miss/foul combinations. The profile
  remains MMQ1/no-cushion and no larger-N or hardware-speed claim is made.
- No source file or numeric rule in the live or frozen engines is rewritten by
  this adapter. No CPU physics verifies candidates during execution.
- Compact output is16 bytes per candidate. Optional full diagnostic readback is
  for qualification only. Owned world allocation excludes the real raw bank.
- Capturing individual host graphs is intentionally a small-N prototype, not an
  efficient1024-candidate host preparation strategy. Large-N should parameterize
  candidate-specific uploads from one verified graph before scale qualification.
- Cumulative work/event budget enforcement, application routing, selected trace,
  device loss, every malformed-input path and full browser/UI release checks are
  not established by these component tests.

The first N1 attempt failed on a reserved identifier in a generated copy kernel.
That identifier was corrected, and all modules now receive syntax preflight
before heavy compilation. The subsequent bounded N1 run completed successfully;
the failed run is not counted as a successful qualification.

## Launch-shape inventory (not a hardware benchmark)

For the captured four-body MMQ1/P128 graph,85 lowered variants comprise63
workgroup-size1 and22 workgroup-size32 variants. The corresponding command graph
has10,144 and14,654 dispatches (29,901 and15,250 x-workgroups per candidate),
including transport helpers. The graph has29,022 total dispatch/clear commands.
This excludes the separate raw producer and final fault gate.

The baseline retains those original launch shapes. A future candidate-y packing
experiment could use more lanes per workgroup only after proving no original
workgroup storage/barriers or cross-invocation dependencies, with an explicit
candidate-count guard BEFORE the fault-buffer access. Copy/clear helpers need the
same tail-lane guard. The existing AoS candidate stride may also affect hardware
coalescing; a SoA change would require a separate layout proof. These are unmeasured
hardware concerns, not promised speedups.

## Compact reporting, exact compatibility authority

Reporting identities use SHA-256 source and command-chunk manifests to avoid
retaining huge duplicated serialized graphs. Capture/reuse compatibility still
compares full original source bytes, layouts, allocation metadata, and every
command; lowered recipe comparison also compares every guarded source and binding
command. A copied reported identity cannot bypass those checks. After comparison,
candidate captures share the first graph and retain only candidate-specific upload
bytes. Full dispatch ownership details are available as a streaming iterator,
not a second retained graph. Logical source-plan identity and lowered execution
recipe identity are distinct; candidate-width/layout lowering belongs to the
latter. The optional identity strings are additional rejection checks, not proof
of application integration.

The first N3 attempt stopped at compile phase 22 after sampled RSS reached
1,534.04 MiB; it produced no numerical evidence. Exact graph interning, compact
reporting manifests and streamed ownership reporting removed duplicate retained
host structures without relaxing full-byte compatibility checks. The successful
retry above used the same native caps. Local receipts are
`/tmp/live-world-guarded-n3b-native.log` and
`/tmp/live-world-guarded-n3b-receipt.log`; these are execution evidence, not
portable hardware benchmarks.

## MMQ2/cushion extension (qualification pending)

The opt-in `profile: 'mmq2-cushion'` requires a matching current canonical binding;
it does not silently change the MMQ1 default. Actual factory capture contains
34,642 commands, including 3,712 cushion indirect dispatches, and lowers to 104
variants. It requires 10 storage bindings per stage. The current size-16 kernels
retain their original size; the structural adapter still rejects workgroup
storage, barriers and unclassified invocation builtins.

Indirect support is only the current source-owned cushion config: exactly 32 bytes,
owner binding 3, offsets 8 or 20, a dominating exact current owner shader and 29
uses per owner epoch. Other writes, read/write aliases, clears and copy targets
reject. Bounded direct launches read candidate-local GPU-owned arguments before
original storage access: x must be zero or the declared bound, y and z must equal
one; invalid counts set sticky unsupported. Zero x preserves inactivity. Active
workgroups use `global.x / originalWorkgroupSize`, not a per-invocation count.
The additional argument binding and all guard code enter recipe identity.

## Upload-only scale plan (not implemented)

In a two-candidate MMQ2 capture probe (different angle and candidate ID), all
194 allocations and the entire command graph matched; only two initial uploads
changed: the 24-byte canonical rule identity and the 32-byte raw-journal identity.
This observation is not proof for every candidate. The next scalable design is:

1. Capture and validate one graph per immutable request/profile; preserve its
   exact sources, ownership and command identity.
2. Use the existing raw-batch producer for per-candidate strike inputs. Obtain
   the two identity uploads through the actual small rule/raw-journal factories
   on a recording device, or expose their existing source-owned packers. Do not
   duplicate identity formulas or patch allocation numbers by convention.
3. Bind upload roles by exact consuming shader/binding/layout and validate sizes,
   not by incidental allocation IDs. Force candidate-varying identity buffers
   local even for N1. Retain all other immutable uploads once.
4. Compare upload-only construction against complete captures across varied
   IDs, parameters, roster sizes and profiles before admitting large N. Reject
   unknown upload dependence rather than recapturing silently or assuming it.

This removes O(N × graph-command-count) host preparation without changing GPU
physics. Large-N memory, device limits and GPU throughput need new evidence.

MMQ2 extension evidence: independent source review accepted the scoped indirect
adapter after requiring the owner to dispatch exactly one workgroup. CPU suites
passed 15 tests (two native skips); typecheck passed. The dedicated native guard
unit compared 390 words across six candidates: inactive/active size-16 dispatches,
partial/over-bound x, and corrupt y/z. It passed in 1.007 s at 279.22 MiB.

The first full MMQ2 N1 attempt did **not** qualify: the unchanged 1,500 MiB
watchdog stopped compilation at variant 69/104 after sampled aggregate RSS
reached 1,510.92 MiB (120.261 s). No candidate execution or numerical comparison
occurred. Receipt: `/tmp/live-mmq2-n1-receipt.log`. N3 remains blocked until N1
passes. These failures are not treated as GPU/CPU result mismatches or evidence
of hardware throughput; this is software Vulkan shader compilation pressure.

A separate source-identical lifetime experiment streams shader creation,
compilation-info validation and pipeline compilation instead of retaining all
future shader modules. This changes error timing only; it does not change WGSL,
recipe or dispatch order. The bounded MMQ2 N1 retry still stopped at phase 69:
1,506.35 MiB / 125.338 s, no execution. Recipe manifest SHA-256 was
`08dbb0f3f95e4c91535b543668e5babfe1d556eb775b1de9c28f1cb19727f58e`;
phase-zero JS heap was 48.46 MiB. Thus future-module lifetime reduction alone
has not resolved this compiler-memory blocker. Receipt:
`/tmp/live-mmq2-n1stream-receipt.log`.

## Experimental per-invocation fault publication

`faultPolicy: 'private-per-invocation'` is an explicit alternative to the default
`'atomic-per-access'`. Every scalar bounds guard and safe fallback remains intact.
Only fault publication changes: invalid access sets an invocation-private bit;
the former compute body becomes an ordinary void function, and the sole compute
wrapper publishes that bit atomically after the body returns. Nested early
returns and implicit exit therefore converge without editing return statements.
The wrapper retains the original workgroup size and global-invocation argument,
checks the prior sticky fault and resets private state before execution. Invalid
indirect dimensions still publish globally before returning from the wrapper.

Other invocations of a faulted candidate may finish their guarded work within
the same dispatch; no invalid physical storage access is allowed, and later
stages/final compact gating remain sticky. The mode and generated sources are
part of recipe identity; modes cannot silently share compiled recipes.

Dedicated native tests passed 475 exact words (390 indirect + 85 wrapper cases),
including inactivity, malformed dimensions, nested/helper early returns, implicit
exit, compound-assignment ordering, later-kernel skip and final fault dominance.
The run took 1.410 s with sampled aggregate RSS 261.42 MiB. This unit evidence does
not qualify full MMQ2 parity or prove reduced whole-shot compilation memory.

The first full MMQ2 N1 private-publication run also stopped at compile variant
69/104: 1,501.61 MiB / 117.139 s under unchanged caps, before execution. Recipe
manifest SHA-256 was
`9284ed9498a7622943c4678af60804c948cdff640b0aa510d9ad958c5c1f278a`.
Receipt: `/tmp/live-mmq2-n1private-receipt.log`. Neither publication coalescing nor
streamed module lifetime alone has resolved the whole-engine compiler peak;
full MMQ2 N1 and N3 remain unqualified.

## Source-identical compilation-order experiment

Exact private-policy phase 69 compiled alone in 14.212 s (16.400 s total), with
sampled aggregate RSS 1,326.08 MiB under the same 1,500 MiB bound. Its code hash
was `de2e2915673340ba6994998a5e81d34f6d82f0a535ae695212a140d78766a915`.
This distinguishes the full-engine retained baseline from an individual shader
that cannot fit at all; it is compile-only evidence.

The explicit `compileOrder: 'largest-first'` option compiles a stable permutation
of definition indices by source length, storing each pipeline at its original
index. Shader bytes, layouts, recipe and execution commands remain unchanged;
`'source'` is still the default. Review accepted the host-only transformation.
The first full retry stayed below the RSS bound (1,392.34 MiB) but hit the
unchanged 180 s time budget at compile ordinal 40/104, after the formerly failing
heavy phases completed. It performed no candidate execution. Receipt:
`/tmp/live-mmq2-n1priority-receipt.log`. The observation supports this compile
ordering experiment, not a general memory guarantee or full MMQ2 qualification.

A separately authorized full-MMQ2 attempt uses a 240 s time bound, matching the
qualified MMQ2 world composition, with RSS still limited to 1,500 MiB. This is
specific to the larger 104-variant profile and does not authorize further automatic
increases. It isolates compilation ordering on the original atomic-per-access
policy, because private publication did not independently resolve the peak.
Per-definition start/end elapsed timings are recorded to identify costly shaders;
no execution graph or shader arithmetic changes accompany this experiment.

The authorized atomic-per-access/largest-first MMQ2 **N1 passed**: 2,916 full
CPU-reference words exactly matched, including state, journal, auxiliaries, raw
status, rule state and compact `[100,2,1,0]`. Repeated compact readback was 16
bytes and identical. Compilation took 187.956 s, compact execution 6.046 s,
total 204.545 s, sampled aggregate RSS 1,377.72 MiB (240 s / 1,500 MiB limits).
Recipe SHA-256:
`2656fbca80321f384c21ac809843dd53baec53ea144fe083178f032199d977cd`.
Receipt: `/tmp/live-mmq2-n1atomic240-receipt.log`.

All 104 definition compilations consumed 180.77 s in total; the largest single
one was phase 69 at 13.33 s, followed by phases 14 and 10 at about 10 s each.
The successful run therefore does not hide one indefinitely compiling shader.
It qualifies the original atomic-per-access policy, not private publication.

The next N3 attempt uses the same bounds and an explicit `parity-reverse` test
scope: full diagnostic parity followed by one reversed compact tile in the same
engine. MMQ2 post-submit cancellation and reuse after cancellation are deliberately
not qualified by that bounded test, and MMQ1 evidence is not transferred to it.

### Interrupted N3 recovery observation (2026-10-27 23:03 UTC)

The initial 240 s / 1,500 MiB N3 `parity-reverse` attempt did not leave a
terminal bounded-process receipt. Its last native log line was phase 10,
compile ordinal 29/104, elapsed 134.510 s; the log stopped changing at
22:59:40 UTC. At 23:03 UTC the shared native lock could be acquired
non-blockingly, while the receipt file remained empty. This is an interrupted
or otherwise unobserved termination, **not** a timeout/OOM diagnosis, pass, or
CPU/GPU mismatch. No N3 parity, reverse permutation, elapsed-total, or peak-RSS
qualification can be inferred from it. The successful N1 evidence above is
unchanged. Retained partial logs: `/tmp/live-mmq2-n3atomic240-native.log` and
`/tmp/live-mmq2-n3atomic240-receipt.log`.

## Upload-only preparation source audit (not runtime integrated)

For one immutable original raw/world binding, trace disabled, the actual
`runRaw` host path substitutes the candidate ID into its template. The template
is external GPU input; its fixed roster count only determines allocation sizes
and dispatch widths. Scene, context/deadline, cloth, tail assets, material,
iteration words and Qt configuration uploads depend on the fixed binding/options,
not candidate strike settings. The two remaining candidate-dependent post-handoff
uploads are the original rule reducer's 24-byte identity and raw-prefix owner's
32-byte identity. Selected trace is another candidate-ID host seam and stays
explicitly prohibited in this profile.

`experimental-live-world-uploads.mjs` now explores this seam without changing the
qualified N1/N3 runtime. It captures one original full graph internally (thereby
using original raw admission), then tiny-captures the original rule and raw-prefix
factories' packers. Roles are resolved by full consuming WGSL/entrypoint bytes,
binding 2, exact allocation size and subview, with alias/copy/clear rejection—not
allocation ordinal, a matching candidate value, or hash identity. Subsequent
candidates must retain the exact owned raw binding. There is no reconstruction
of the private request or hand-copied identity arithmetic.

Preparation returns an opaque token containing only two private uploads (56
bytes), not another 34,642-command graph. Snapshot uploads are copies; full-plan
materialization is a separate diagnostic-only deep copy. This is host preparation
work only: no larger-N GPU execution, hardware throughput, cancellation, or
release qualification is claimed, and existing runtime defaults are unchanged.

The helper explicitly reports `sourceQualified:false` and
`graphReuseQualified:false`. Its finite full-capture comparisons are diagnostic
observations, not authority to skip full captures after future host-source edits.
Before runtime integration, the complete audited host-factory source closure must
be sealed/pinned with source-drift rejection; the tiny-factory signature alone
does not cover an unrelated factory adding a candidate-dependent host upload.
Optional `expectedPlan` checks source, graph, layout and every initial byte, but
never replaces the helper's internally owned baseline capture.

## MMQ2 N3 parity/reverse qualified (recovery rerun)

The fresh identical authorized attempt passed on 2026-10-27 at 23:09 UTC:
8,748 complete CPU-reference words exactly matched for N3, followed by an exact
reversed candidate permutation in the same engine with only 48 bytes read back.
Original-order compact results were `[100,2,1,0]`,
`[4294967294,3,3,2147483648]`, `[300,2,1,0]`: two MISS results and one unsupported
budget result, **not** goal/miss/foul outcome coverage. Compilation of 104 guarded
definitions plus raw producer took 186.593 s; reversed compact submit/readback
10.761 s; total bounded process 221.920 s; sampled aggregate RSS 1,397.64 MiB.
The unchanged bounds were 240 s and 1,500 MiB; stopReason was null and exitCode 0.
Policy was atomic-per-access, compilation largest-first, scope parity-reverse.
Recipe SHA-256:
`f1ed12398e220b33ded2f1a4b2c96a9cc4afc88737b615b00dbacceb356a1300`.
Receipt: `/tmp/live-mmq2-n3atomic240-recovery-receipt.log`.
This is SwiftShader software-Vulkan evidence, not physical GPU throughput.
MMQ2 post-submit cancellation and reuse after cancellation remain unqualified.
The interrupted original attempt is retained separately above, not rewritten
as a successful run or assigned a speculative cause.

Upload-only diagnostic validation: 5 tests passed, comparing every initial byte
against full captures for 12 varied candidates across three-ball MMQ1,
four-ball MMQ1 and four-ball MMQ2 (including three explicitly unadmitted inputs).
Source/initial drift, forged batches/tokens, cross-preparer tokens, raw owner drift,
and caller mutation were rejected or isolated as appropriate. An expanded targeted
owner test also passed for a multi-candidate batch and mutable cloned request.
`npm run typecheck` passed. These tests do not remove the unsealed-host-source
integration blocker above.
