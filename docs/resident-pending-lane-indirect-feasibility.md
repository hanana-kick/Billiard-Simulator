# Pending-lane indirect scheduling: bounded source inspection

This is an **unimplemented, unqualified** scheduling option, not a throughput
result or a replacement for the current four/five-macro diagnostic. The current
source bodies, numerical profiles, limits and final comparison remain authority.
No default profile or shader changed for this inspection.

## Existing source constraints

`microcode-vm.mjs::generateMicrocodeExternalWGSL` validates magic/version,
entryPC/stack/reserved words and waiting protocol **before** its macro-ID no-op.
A scheduler cannot merely select `pendingMacro != 0`: doing so would suppress
observable invalid-control errors on unselected lanes. It must preserve the
common source-wrapper validation, then queue only admitted waiting lanes. The
source handler still retains its own exact guards, including id4's Number-view
admission. Each successful handler clears pending, advances PC once and returns
READY; it does not run the core again. Thus current same-sweep handlers cannot
create a different handler's new work without another core dispatch.

The source state and VM are disjoint. Approved native macro bodies must remain
byte-identical; only the declared wrapper's invocation-to-original-candidate
mapping and exact binding-length contract may change. Existing direct launch
must remain the default and retain its exact shader identities.

## Smallest separate profile

1. Core executes unchanged over the original VM binding range.
2. One bounded scheduler checks the original common protocol in original lane
   order, writes ascending unique candidate-ID lists per approved handler, and
   writes each indirect triplet. Source/world/program/geometry/input words are
   never scheduler outputs. No CPU readback or candidate selection occurs.
3. Each existing macro dispatch reads an original candidate ID from its own
   list, then executes the unchanged source wrapper/body for that candidate.
   Source order within a candidate is unchanged. Empty lists dispatch zero
   workgroups; incomplete/failed rows do not become evaluated misses.
4. The next core dispatch repeats the process. Physical work budgets, query
   horizons, cancellation boundaries and final-only output remain unchanged.

Keep lists in a **distinct exact-size VM tail**, beyond all original per-lane
VM words. Bind only the original range for the unchanged core and the declared
extended range for indirect wrappers. Do not weaken global array-length checks.
Keep indirect arguments in a **separate** STORAGE|INDIRECT buffer, unbound from
macro dispatches. This avoids adding a ninth shader binding to audit-enabled
macros and avoids writable-storage/indirect use of one buffer in a dispatch.

WebGPU defines a compute usage scope per dispatch, indirect arguments as three
u32 workgroup counts, and requires INDIRECT usage, aligned/in-range offsets and
workgroup limits. Separate arguments may be written by the prior scheduler and
read by a later indirect dispatch; they must not also be writable storage in
that same indirect dispatch. These are API feasibility conditions, not proof of
this implementation or adapter behavior. [WebGPU specification source](https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs)

## Known diagnostic arithmetic, not measured performance

The owned HOST h192→193 four-macro diagnostic has108core pumps and85actual
source calls (cue4, graph77, broad1, coupled3) across two lanes, one rejected.
Its direct macro sweep invokes432macro workgroups /864candidate wrappers at
WGS1, of which85reach source handlers. A correctly built pending list would
preserve those85source calls, not make their arithmetic cheaper.

Adding one scheduler per pump changes the fixed command model from540 to648
(core+schedule+four indirect commands); it does **not** reduce CPU command count.
Native zero-work dispatch and scheduler overhead may erase any guard/inactive
work saving. These counts apply only to this diagnostic, not h1, all impacts,
full rest, a mixed1024batch or hardware timing. The separately compiled fifth
macro remains the immediate bounded native measurement before adoption choices.

## Required gates before numerical use

- Exact source-wrapper validation order and errors versus a full direct sweep,
  including malformed nonpending lanes, numeric tail, counter overflow and id4.
- Every original VM/source word equal across full direct and queued schedules;
  queued metadata is disjoint, cleared per sweep and cannot alias locals/stack.
- Mixed/padded lanes, all-empty/all-waiting, different IDs, bad offsets/limits,
  wrong source hash, duplicate/stale list and replay/lifetime rejection.
- Immutable shader-body identities, candidate mapping and storage layout bound
  to the profile; no scheduler-supplied physics value or CPU future state.
- Clean compile-only feasibility, then bounded actual source/native differential
  on the same h192 diagnostic, with compile/init/encode/queue/map separated.
- Intended-scale allocation/isolation and whole-shot costs remain independent.

No speed claim or further GPU schedule is authorized by this document.
