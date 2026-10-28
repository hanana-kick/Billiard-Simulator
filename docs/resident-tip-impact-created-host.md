# Created-t0 audited microcode HOST gate

This is a **HOST-only diagnostic**, not raw-row GPU creation, GPU throughput,
full-rest qualification, or a1024-candidate result. It starts from the original
independently admitted row219 CREATED snapshot at h0 (`feb6b6ee…f9c2ef`). Row522
retains the original rejected status8/reason2 at h0. No CPU future is used to
initialize or repair any evolving bank.

## Reproduction and admission

1. Run `tests/resident-candidate-tip-impact-compiler.mjs` with the documented
   source-only observer artifact to produce
   `/tmp/resident-tip-impact-compiled-initial-only.v8`.
2. `node tests/resident-candidate-tip-impact-created-host.mjs prepare DIR`
3. `RESIDENT_TIP_HOST_PUMPS=256 RESIDENT_TIP_HOST_MS=120000 node tests/resident-candidate-tip-impact-created-host.mjs run DIR`
4. A deliberately bounded incomplete run exits2 and writes `continuation.v8`.
   Resume with the same command plus `--resume`. The receipt pins its exact SHA;
   immutable bindings, initial artifact and bytecode identities are checked.
   Do not admit this continuation to a GPU runtime.
5. `RESIDENT_TIP_CREATED_HOST_FIXTURE=DIR node --test tests/resident-candidate-tip-impact-created-host-tests.mjs`

The existing packed audited artifact is reused:135,571 instructions,7,786 local
words, depth15, sourceSHA `5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7`.
The source/PC/begin are independently regenerated against authentic created219
and required to equal the common raw template's generated source exactly.
Only the original word-copy cue canonical bridge and original PC begin execute
before the main VM; no physical h advances. Numeric/physics caps are unchanged.

The six source bindings contain state, program, geometry, scratch, raw-input
metadata and audit storage. Expected original128/192/native states are in a
separate hashed `expected.v8`, never in any binding. Test macro models are shared
with earlier HOST tests, so this is not an independent numerical implementation
proof. The originalCPU/all11 and nativePhysicsLab/event comparisons remain the
independent acceptance gates.

## Initial geometry distinction (not a raw-path defect)

The authentic CREATED219 and common raw template differ in354 shared-geometry
words. Every differing index is checked against these exact source overwrite
locations, not merely ignored:

*18 words: cue collider descriptor bases5824,5856,5888 plus offsets
  8,9,10,11,13,14. `rc_world_cue_geometry_gather` replaces moving-body co+8..14
  from resident canonical bodies before writing gathered pose state.
*336 words: `18016 + 132*i + {0,1,2,3,5,6}`, i0..55.
  `rc_world_cue_geometry_pose` overwrites guard pose0..6 and16..22 before
  `rc_num_eval`; all other geometry words must match.

The run therefore keeps the **exact common raw-template geometry**, SHA
`cc501878c2ad2005b2d49955dfc8d814a11ad992f44949be03345e880b973c05`.
A mutation in a static pose, local pose, material or untouched guard field fails
admission. Scene template contents must match exactly except their separately
checked authenticated initial-snapshot identity.

## Checkpoint and pilot evidence

The256-pump pilot retained h3/sourcePC8 after22.646s HOST wall time,5,563,000 core
instructions,13 cue macro calls,206 numeric calls and3 broad calls. It was
**incomplete**, with no error or audit event; it establishes no impact parity.
A one-pump retained resume also completed without reinitialization (h3,
5,567,233 core instructions, total257 pumps). Four host test groups pass,
including actual artifact identity and fail-closed geometry mutations.
The original pilot preceded addition of the continuation SHA receipt; that
existing file was hashed once before the resume smoke, without altering its
state or VM words. Subsequent checkpoints produce their receipt themselves.

The early-path linear projection is roughly24minutes HOST to h192, not a bound
or GPU estimate; contact branches may cost more. Long continuation is separately
coordinated. It must compare **actual** audit storage plus all11 original source
groups at128 and192, exact native latched outer/body/scorer projections, the
whole accepted emission tape (one genuine tip event beforeh165), and retained
final192 bank equality. Missing/partial/unsupported output never becomes MISS.
No full-state-per-handoff trace or per-instruction profile is retained.

## h128 terminal failure (2026-10-26)

The retained HOST continuation stopped at its first mandatory checkpoint:
10,566 total pumps,222,039,775 accepted-row core instructions,884.064s total HOST
wall. No h192 continuation was attempted. The exact failing continuation SHA is
`3cf0e22aa43d20eb1a2c59ecb18c396af4168fd74f71592fea46fc84e46bf787`.
It remains local at `/tmp/resident-tip-impact-created-host-v1/continuation.v8`.

**All11 source groups PASS**, but the actual native before-tip history fails:
represented ring count7 versus native count8. Independent native balls, cue,
clock, rules and game match exactly. Actual audit prefix has zero new events,
which is correct before the tip; it does not repair missing initial history.
Structured evidence is in
`docs/evidence/resident-tip-impact-created-host-h128-failure.json`.
The native history assertion is unchanged and the result is **failed**, not
qualified, incomplete/MISS, or successful impact.

The initial provenance is now explicit:

* `src/browser-initial-import/live-world.mjs:72` builds
  `initialContactEvents` from `app.events.filter(e=>e.kind==='contact')`;
  `prepare-live-candidate.mjs:59–60` validates that contact-only history.
* `src/resident-candidate/world-state.mjs:73` seeds the represented debounce
  ring from that contact-only list. Both created219 and the common raw template
  (`a93473fc…b51e0f`) contain count7/head7 with the same seven contacts.
* Native PhysicsLab t0 contains nine total events: old stroke at0, those seven
  contacts, then the newly accepted stroke at5.6291666666664275. Its last-eight
  window contains the seven contacts **and the new stroke**.
* `src/physics.js:263` debounces against unfiltered `this.events.slice(-8)`.
  The original source-owner wrapper starts its contact-only stream at
  `src/experimental-four-ball-world.js:185`; its all11 comparator also derives
  represented history from `contactEvents`, so that gate alone cannot detect
  this mismatch.
* The current raw transfer clones the same common template and the creation
  stages do not append the missing nonkey stroke to its rule ring. This is a
  source/data-contract concern, not evidence that numerical VM evolution failed.

No production/source module, comparator field, tolerance, history check or
physics cap was changed to obtain this result. The smallest repair requires
preserving authenticated full initial emission/debounce history separately from
the contact-only scorer stream, followed by fresh initial-only qualification.
A known-bad h128 state must not be patched with a future expected history and
resumed as if it were a valid run. Frozen raw h64 is judged by its own untouched
final comparator, not inferred solely from this HOST result.

## Fresh full-history profile and exact h8 observation

After the source producer/reference/raw-initializer history repair, this harness
requires `source-full-application-history-v1`. It rejects missing/unknown profiles
and refuses to overwrite an existing artifact directory. Historical failing
h128 artifacts above remain unchanged. A fresh capture verifies actual native t0
history:9 events, contact-only scorer count7, full ring count8/head0. Rejected522
uses the authentic prestrike clone and retains that FIFO, without an accepted
stroke. A new expected file is generated independently.

Fresh lowering also proves full source text, bytecode, functions/signatures,
external macro approvals, local count and call depth identical to the immutable
historical program. No old evolved state is reused. Geometry proofs are unchanged.
The current fresh local directory is
`/tmp/resident-tip-impact-full-history-created-host-v2`:
initialSHA `c500a622817129cfa240aa6ac2a49582dd2391398a6e391b1692563cf34d7b53`.

An explicitly opt-in **HOST-only** short gate keeps requestedH192 unchanged:

```
node tests/resident-candidate-tip-impact-created-host.mjs prepare-short DIR
RESIDENT_TIP_HOST_PUMPS=512 node tests/resident-candidate-tip-impact-created-host.mjs run DIR --resume --observe-h8
```

The existing TEST `onReturn` observer accepts only an original owner RET with
source h8 and originalPC.completedH8. It snapshots once after all original owner
work/PC advance returned and before the next owner can mutate the source bank.
It calls `assertWholeHCommitted` and the unchanged all11 comparator against a
fresh independently admitted original h8 fixture. A separately stepped actual
PhysicsLab first outer64 proves no post-t0 emission; the actual h8 audit prefix
must be zero and its full native t0 ring must still match exactly. This is NOT a
native h8 body projection. The snapshot is assertion-only, never restored into
the VM; the real retained execution proceeds toward128/192.

This short gate passed at `rc_micro_original_owner_13` RET23455; actual snapshot
SHA `7d43ef3fbaa1412bf8e23c4da4c481497ec0ca3a35f021a7400fa647952c8a45`.
The retained born192 VM then reached h9/768 pumps,16,374,320 core instructions,
61.040s cumulative HOST wall. Seven host regression groups pass, including
negative requestedH/completedH, altered native emissions/history, unknown profile
and actual audit mutations. The h128/192 impact and native GPU gates are still
separate requirements; this short pass is not completion of either.

## Fresh full-history h192 terminal: strict source parity still fails

The fresh retained run reached192 without changing its request, state authority,
source caps or timestep. It yielded safely at the30-minute HOST bound at h191,
then resumed the exact pinned state under2,048 pumps/5minutes. It completed after
21,457 total pumps,690,143,272 accepted-row core instructions (rejected row2,511),
and768 cue /13,309 numeric /192 broad macro calls. Total HOST wall was1,887.435s;
this is not GPU timing. Final continuationSHA:
`c1013531a239adb273544bbf39e2840821131c89fb555f059416c67c2a0f051c`.

At128, unchanged all11 source and all native observable/history groups pass.
At192, **all actual native projected groups pass** (balls, cue including tangent,
clock, rules, full history, game), but the mandatory source all11 gate **fails**
in the cue tangent's three binary64 low words:

| Component | Actual word | Source-reference word |
|---|---:|---:|
| x low |3610802870|3610802880|
| y low |2545628303|2545628320|
| z low |3902929616|3902929632|

All high words and all other all11 groups match. This distinction has not been
attributed to a VM, numeric helper or source-reference defect yet. The strict
source comparator/tolerance remains unchanged; the result remains **failed**.
It is not a full raw-GPU impact qualification, despite the native projection
match. Independent read-only source arithmetic diagnosis is pending.

The entire actual audit tape matches the original native tape exactly: one
unkeyed tip event, binary64 time words[4294966983,1075218175], nativeh completed164
(beforeh165), completedouter2/outerordinal3, substep36/64, worldphase2, order0.
The accepted initial stroke prefix was not re-emitted. The rejected lane's
prestrike FIFO and empty audit remain intact.

Evidence, including exact192 totals, recorded128 pump/time plus adjacent core
counter bounds, and existing165 progress counters, is committed in
`docs/evidence/resident-tip-impact-full-history-h192-host.json`. Exact128 macro
counts were not recorded on this fresh run and are explicitly not invented.

For workload planning only,21,457 HOST pumps are10.477 times the corrected
software-GPU probe's2,048 fixed cycles. Multiplying that probe's321.382s pump wall
by this ratio gives a **conditional56.12-minute software-only scenario**, not a
measured core rate, post-impact native time, or hardware ratio. Active/inactive
cycle proportions and post-impact native macro costs differ; the scenario is
not a reliable completion bound or permission to launch a long GPU run.

## Explicit cue-Number reference authority gate (2026-10-26)

The negative result above remains a negative result under its original
compensated CPU expectation. A **new, separately named cue-only CPU profile**,
`cueNumberProfile: 'original-js-number-v1'`, selects the existing independent
`C.sourceReference` and `T.sourceReference`. It does not select resident numeric
helpers, reuse GPU values, or change any physics equation. Omitted options and
`legacy-double-single-v1` retain the historical double-single approximation and
snapshot surface. GPU factory overrides and unknown profiles fail closed.

`tests/resident-candidate-original-number-profile.mjs` regenerates an authentic
original row219 source seed and its independently stepped128/192 expectations.
Against the unchanged retained actual HOST capture, all11 source groups, both
native completed-outer projections, the complete actual one-event tape and the
final bank equality pass. The test separately requires that the **old expectation
still fails** at the exact cue tangent boundary. It verifies every retained
source binding/VM state and the initial/legacy-expected/actual file hashes remain
unchanged, and independently regenerates byte-identical production WGSL,
bytecode, function signatures and approved external closures.

```sh
RESIDENT_ORIGINAL_NUMBER_ACTUAL_DIR=/tmp/resident-tip-impact-full-history-created-host-v2 \
  node --test tests/resident-candidate-original-number-profile.mjs
```

This adds a new assertion artifact, `source-number-expected.v8`; it never
rewrites `expected.v8`, `continuation.v8`, or the prior failed `result.json`.
The exact evidence is `docs/evidence/resident-cue-original-number-h192-host.json`.
There is no additional VM evolution, GPU run, native192 run, full-rest result or
1024-candidate qualification in this reference-authority gate.

**Scope is cue lateral and compliant-tip arithmetic only.** Other CPU owners
remain unchanged. In particular the world angular post-stage still uses its
legacy `createReferencePostWorldStage` double-single path; the separately
available `createSourceDoublePostWorldStage` has not been silently enabled. This
is not a claim that every CPU reference owner has original-JS-Number semantics.
