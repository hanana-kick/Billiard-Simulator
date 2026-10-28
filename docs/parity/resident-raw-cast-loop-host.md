# Raw cast-contact loop: bounded HOST differential

Status: **HOST-only source differential PASS**, not native compilation, GPU speed,
whole-shot parity, or production activation. The initializer/default source is
unchanged. Evidence: `docs/evidence/resident-raw-cast-loop-host-v1.json`.

## Genuine initial source and scope

`tests/resident-candidate-raw-cast-loop-host.mjs` authenticates the existing
registered common prestrike snapshot and builds the original raw initialization
plan. Only original roster rows 219 and 421 were executed. The fixed initial
Number program, all 60 original ordered obstacle/part pairs, and all 13 original
stage bodies run through the existing source compiler/HOST VM. Its existing
hash-approved `source-f64-v1` TEST numeric adapter is used; no production CPU
fallback or saved future world is introduced. This is physical h=0 clearance.

Immediately after each actual cast-contact-init, a temporary copy of all five
source bindings is compared after (a) the original 256 staged calls and (b) the
existing cast-only bounded loop. Every raw state/register/control, scratch, and
readonly word must match. Copies are discarded after each comparison; no
per-instruction or full-state trace accumulates. The full original raw path
continues on its original retained source bank.

| Original row | Matched boundaries | Active nonterminal fallbacks | Source microinstructions | Loop microinstructions |
|---|---:|---:|---:|---:|
|219 (clear)|60|0|75,648,110|10,199|
|421 (blocked)|60|3|79,034,276|155,756|

Row 421 genuinely enters the fallback at zero-based pairs 9, 10, 13. Its GJK
scratch status starts at zero and reaches source status 2 after 4, 4, 3 calls.
All remaining calls are inert; an additional terminal call is also checked at
all 120 boundaries. Thus sourceDispatches=68,361 per row includes the unchanged
68,301 raw schedule **plus 60 diagnostic no-op checks**. The 60 comparison-loop
invocations are separate HOST diagnostics, not replacement production commands.
The blocked result preserves raw status 1, clearance status 2/reason 3, 177
contacts and 59 casts. Row 219 stays clear. Neither result is a full-shot score.

## Strict admitted boundary

The wrapper must first satisfy the original clearance-active/selected-tip skip
condition. An active query must have the actual post-init cap word 256. The
existing loop explicitly diagnoses malformed caps whereas the staged helper
ignores that metadata; arbitrary malformed-cap equivalence is **not claimed**.
The HOST proof rejects caps 0/1/255/257/UINT_MAX and bad object spans before any
write. Completed/failed clearance and selected-tip skip remain inert. Those
admission checks do not activate a new production profile.

Only the one exact `generateRawCastQueryWGSL(...,'contact-gjk')` fragment is
replaced for the comparison. All other stages/wrappers are byte-identical. In
particular `storageLoops:true` remains unadmitted: the point-contact GJK loop
changes output+15, as documented in the prior boundary analysis.

## Reproduce and limits

```
TMPDIR=/workspace/scratch/f887f82f638e/resident-native-artifacts/host-tmp \
NODE_OPTIONS=--max-old-space-size=512 \
node tests/resident-candidate-raw-cast-loop-host.mjs 219 60 <new-report.json>
# Repeat with 421; each invocation has an explicit 120 s / 200 M instruction
# diagnostic cap. Exhaustion reports incomplete, never a miss or a passed gate.
node --test tests/resident-candidate-raw-cast-loop-host-tests.mjs
```

Both actual captures terminated exit 0 within those bounds; the two focused
admission/source-fragment groups passed. An initial harness attempt passed the
fixture-only `kind` field to the production ABI and was rejected before source
execution. Its log is retained; recovery projected only id/settings, with no
numerical/source change. Raw artifacts stay local and their hashes are recorded.

The conditional schedule saving remains 15,360 cast-contact-GJK dispatches to
60, hence 68,313 whole initialization dispatches to 53,013. No device measured
that saving; compiler expansion/resource cost, native numerical parity, and new
production profile admission remain pending. No additional physical row or
full-world recurrence was run.
