# Live-world device/resource preflight

This change does **not** widen the N1/N3 runtime gate. It implements the missing
resource admission identified by the N32/N33 planning exercise.

## Original-factory resource facts

`captureRawWorldResourceFacts` runs the original staged/chunked raw factories on
a nonexecuting recorder. Commands stream to an observer rather than retaining
another raw command graph. Default full graph recording is unchanged.

Roles are mapped using complete original consuming WGSL and exact binding views:
raw handoff, each generated raw-strike phase, and optional chunk control. The
capture rejects unknown commands/source/layout/workgroup shape, subviews, role
aliases, unclassified buffers, wrong exported bank handles, and dispatch-count
mismatch. All original raw workgroups must be size32 and have no workgroup
storage/barriers. No allocation ordinal or matching candidate value identifies a
role. Zero-step raw banks retain only the actual rejection-path allocations.
Host resource capture is bounded to counts1..33; this is not GPU width admission.

## Pure planner and mandatory validation

`planLiveWorldResources` checks:

- actual world allocation sizes and original ownership/view ranges;
- candidate-local u32 stride/address extents, indirect8-word arenas, copy/clear
  source ranges, padded raw row-base products and final-gate intermediate products;
- exact raw allocation-role byte sizes/usages against original captured facts;
- complete lowered binding arenas, storage-only layout/slot shape and dispatches;
- one-dimensional workgroup sizes1/16/32, rejecting workgroup storage or barriers;
- diagnostic or compact readback, fault/ID buffers and total explicit owned bytes.

Summaries deduplicate views, dispatch shapes and index expressions instead of
retaining another per-dispatch graph. The resulting deeply frozen plan is owned
by a private brand; copied metadata cannot be passed as a validated plan.

`validateLiveWorldResources` requires actual device limits (no assumed adapter
capabilities), all binding offsets aligned to the actual device, and an explicit
total-owned-byte budget. Runtime validates the diagnostic worst case before any
real GPU shader compilation/allocation, then validates the chosen readback mode
again before allocating each run. Replacements retain the same immutable request,
width, raw budget and exact allocation/graph contract.

The experimental policy permits at most **8MiB of explicit owned buffers per
run**; callers may lower but not raise it. This includes raw, world, fault/IDs and
readback buffers. It does **not** include shader compiler/driver memory, temporary
host uploads, or concurrent engines/runs. The separate 1,500MiB/240s native
watchdog is unchanged. Neither the budget nor arena checks prove physical model
accuracy or every internal physics index; scalar guards/source audits remain
independent requirements.

Returned metrics distinguish existing `allocatedWorldBytes` from
`plannedTotalOwnedBytes`, which also includes the raw bank. Device resource
requirements and the policy budget are exposed as immutable metadata.

## Evidence and remaining gate

13/13 resource/raw-capture tests passed, including exact/one-over limit and budget
negatives, missing device limits, alignment, forged plans, unknown roles,
workgroup storage/barrier rejection, zero-step and both raw backends, N32/N33 raw
padding, actual N1 allocation accounting, and rejection before real GPU compile.
9/9 default full-capture regressions and typecheck passed. Independent source
review accepted the unchanged-width preflight, including the arena/view address
coverage and its limits.

This edit adds two runtime modules and changes the capture/batch source closure.
An old sealed artifact is not a qualification of this new code. Exact refreshed
pin review/build is required before native use. Any N33 profile is a separate,
explicitly reviewed diagnostic gate; no UI or default profile changes here.
