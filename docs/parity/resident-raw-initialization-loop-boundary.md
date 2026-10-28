# Raw initialization command boundary (read-only analysis)

This analysis uses existing committed eight/nine source evidence, not a new
profile, test, timing measurement or native execution. Production defaults and
frozen source artifacts are unchanged.

## Actual ranked schedule

`docs/evidence/resident-macro-scale-eight-nine.json` records the same per-bank
68,313 raw initialization dispatches for eight and nine candidates:

| Stage | Command entries | Dispatches | Source cap per entry |
|---|---:|---:|---:|
| contact-gjk | 180 | 46,080 | 256 |
| cast-contact-gjk | 60 | 15,360 | 256 |
| cast-cast | 60 | 6,000 | 100 |
| contact-init / contact-epa / contact-finish | 180 each | 540 combined | 1 |
| cast-init / cast-contact-init / cast-contact-epa / cast-finish | 60 each | 240 combined | 1 |
| raw-step | 1 | 79 | 256 Number-program instructions |
| raw-init / raw-finish | 1 each | 2 combined | 1 |
| world-transfer + created mass/history stages | — | 12 | unchanged |

Source-PC begin and compact-VM begin add two, yielding68,315 before the first
world continuation. The top three pump stages account for67,440 commands
(~98.72%). These are fixed schedule counts, not observed active iterations or
GPU-time shares. The exact original roster has20 obstacles ×3 cue parts;
selected-ball tip skipping and early query completion occur inside the source
kernel, not by dropping host schedule entries.

`rc_raw_program_step(pb,sb,cb,budget)` is already the native source Number-program
interpreter in the raw-step shader. Its79 dispatches (~0.116%) reflect the20,000
cumulative instruction ceiling and256-instruction chunks. Even a source-equivalent
79→1 wrapper would save only78 commands. The separately proven optional world
Number-program macro does not remove the dominant raw GJK/cast schedule.

## Smallest recommended separate experiment

Start with **cast-contact-gjk only**, not a new world interpreter and not all
`storageLoops`. Relevant source:

- `raw-strike.mjs:generateRawCastQueryWGSL`, stage `contact-gjk`;
- `rc_raw_cast_stage(scratch,input,output,hull,metadata)`;
- original `rc_cast_cast_contact_step()` → original `gjk_step()`;
- original `cast_contact_init()` decides tiny-TOI fallback; no synthetic active
  query should replace that decision;
- original256 calls, scratch/state storage and the subsequent EPA/finish stages
  must remain in source order.

Its five private globals are candidate storage-address adapters set by the
wrapper, not a private evolving query stack. The actual GJK state lives in the
candidate scratch bank. Terminal remainder calls are original no-ops, but exact
full-word parity still must prove that, including dirty scratch, status/cap
words and malformed-domain policy. A loop must not update return/status/metadata
beyond the original source's observable effects.

Conditional schedule arithmetic only:60×256→60 saves15,300 commands, giving
53,013 raw-init commands if this one stage qualifies. This is not measured speed
or proof of compilation. Direct native GJK loops can reintroduce compiler
expansion/SSA pressure; the existing linked-point/address-reload test scaffolds
are not evidence here of a completed native pass.

After the shared numerical hold is released, the authorized next HOST experiment
is a bounded capture of genuine raw-initializer states immediately after
`cast-contact-init`, comparing all raw-state, scratch and readonly words after
unchanged256 calls versus the exact bounded loop. Captures must cover actual
active and terminal/no-op cases if the source fixture produces them; missing
coverage must be reported, not fabricated. No future capture is production
runtime input. Generated closure/body/signature/binding hashes and compiler
resource behavior remain to be measured in that separate experiment.

## Explicit non-admission: whole storageLoops switch

`buildRawPreparationPlan(..., storageLoops:true)` already exists as an opt-in
source transport. Its raw plan is1,161 commands (1,173 including world creation),
but that number does not establish full dirty-word parity or native feasibility.
In particular, `generateConvexPointWGSL('gjk-loop')` explicitly clears
`rc_state[output+15]` from256 to0; the default one-step path leaves that word at256.
This is a concrete difference in the contact-gjk convex-point path. It must not
be normalized away, omitted from comparison or silently enabled by this pilot.
The cast-contact-gjk-only proposal avoids that separate point-loop marker change.

Read-only source identities used for this analysis:

- stage-count evidence SHA256 `8957844542369ee460e3de15fadf313af2cadf2c47b0d731a6205b248d5f5f9e`;
- `raw-strike.mjs` SHA256 `2a3f70d84762fd456f826a8734b1bfa47926ca6cbdda7fe2f2a61fafebdd59a7`;
- `convex-point.mjs` SHA256 `c93e0a3db388d7d88b7a1d970f39a1c349372659b775b32c8efc963d13e81621`.

These are file/evidence identities, not generated closure hashes or numerical
qualification. No source function has been rewritten and no GPU job was started.
