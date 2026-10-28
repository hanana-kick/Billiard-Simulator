# Authentic row219 milestones after h192

One fresh original CPU trial, from the same authenticated registered-four-ball
raw common input, used angle 310°, elevation 85°, speed 4.5, tipX 0.2, tipY −0.1.
The initial accepted creation SHA is
`feb6b6eea9a0d29236df73680e79d3cbedf84dee702f3dae0c1e80a33ef9c2ef`;
the capture, prestrike SHA, full-history digests and exact source hashes are in
`docs/evidence/resident-row219-original-milestones-v1.json`. The original
PhysicsLab/Rapier numerical methods were unchanged. Transparent forwarding
observers record chronology only; nothing here initializes a resident bank.

## Next bounded endpoints

All h counts below count actual native steps since this accepted unstepped
creation; they are **not** a constant-time clock after cue removal.

| Endpoint | Actual native h | Outer / location | Extra native steps after h192 |
| --- | ---: | --- | ---: |
| Last native step with cue before withdrawal | 306 | outer5, substep50 | 114 |
| First h crossing withdrawal | **307** | outer5, substep51 | **115** |
| Containing latched outer finishes | **320** | outer5 endpoint | **128** |
| Next outer re-latches coarse dt | **321** | outer6 endpoint | **129** |
| First later new contact | **353** | outer38, yellow cue/right cushion | **161** |

Withdrawal happens in `compliantTipContact` **before world.step of h307**, at
absolute time **5.634147135416355** (binary64 words
`[3722304639,1075218781]`), elapsed **0.004980468749927525 s** from creation.
The tip had contacted and now has no touching sphere; it is separation, **not**
the 0.22-second expiry. Last contact time is 5.634130859374689. Removal advances
no native step and changes no ball linear/angular velocity.

Outer5 already latched 64 substeps at entry. It executes **all h257–320** at
`1/61440 s` (native f32 dt word931694729), even though h307–320 are cue-absent:
50 cue-present native calls and 14 cue-absent calls. It restores the outer dt at
its endpoint. Outer6 then selects one step h321 at `1/960 s` (word982026377).
A profile that truncates outer5 or switches dt immediately at withdrawal does
not reproduce the original source schedule.

There is **no newly emitted contact or floor event between h192 and
withdrawal**. The next emitted contact is h353, time5.668749999999683,
right cushion/yellow cue. Native internal scene/FIFO/CCD facts were not captured
by this public chronology and must not be inferred from these event counters.

## Later chronology from the same cheap trial

The one trial continued, within an 8-second simulated-horizon ceiling, to actual
no-cue/all-four-balls-sleeping rest. No second trial or scalar-VM replay ran.

| Event | h / outer | Absolute event time |
| --- | --- | --- |
| Yellow cue/front cushion | 861 / 546 | 6.19791666666632 |
| White/yellow opponent contact | 1136 / 821 | 6.484374999999637 |
| White cue/red2 contact | 1170 / 855 | 6.519791666666301 |
| Red2/rear cushion | 3842 / 3527 | 9.303125000000588 |
| Full rest | **6302 / 5987** | **11.865625000002627** |

Full-rest elapsed time is **6.236458333336199 s** from this creation, not 11.86
seconds. No floor event was emitted through rest. The original FourBallGame
received every actual emission and its original `finish()` returned
`{cueId:2, delta:-1, nextCue:1}` at the unchanged Controller rest predicate.
This is not a score inferred from PhysicsLab alone: the game class executed.
The Controller method/UI side effects themselves did **not** execute.

These are physical-step workload landmarks, **not GPU cycle or time
estimates**. H307, h320 and h321 are useful successive gates for same-h removal,
remaining fine-step ownership and the subsequent dt transition. H353 adds a
real subsequent collision. Full rest needs 6110 more native steps after h192;
this original CPU run does not authorize a blind long resident/GPU run or
predict its pump budget. Count-specialized source, removal lifecycle, native
current-pre-CCD admission and separate numerical scheduling remain required.

## Reproduction and observed scope

The three tests share exactly one original trial:

```sh
RESIDENT_ORIGINAL_CAPTURE=/absolute/original-capture.v8 \
RAPIER_WASM_PROVENANCE=/absolute/decoder-provenance.json \
RESIDENT_ROW219_MILESTONE_OUT=/new/chronology.json \
node --test --test-concurrency=1 tests/resident-candidate-row219-milestones-tests.mjs
```

The capture must satisfy the existing original fixture's exact pinned hash.
The optional output path must not exist. This is an explicit costly original
CPU oracle test, not a default HOST inventory addition. The observer can stop
at a 5-second wall budget only after withdrawal/next-outer evidence exists;
that diagnostic stop would be incomplete chronology, never a physical miss.
Here it reached rest in 2.345 seconds observer time: **3 tests passed, 0 failed,
0 skipped**, total process test duration 2.600 seconds. The full chronology is
kept as private assertion evidence; the committed JSON contains only bounded
counters/events/source digests, no raw native snapshots or private paths.
No browser, GPU, resident VM, physics fallback, qualification override or
publication was performed.
