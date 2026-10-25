# Actual original corner: multiple positive qualified TOIs

## Scope

The single source-derived constructor yaw in
[multi-toi-source-derivation.md](multi-toi-source-derivation.md) succeeded. This is
an engine-accepted source discovery fixture, not an independent holdout or a
claim of UI reachability. The real PhysicsLab strike accepts speed 10, whereas
the currently observed manual UI/controller caps speed at 5. No UI input-limit
change is part of this work. This result is not whole-world CPU/WGSL parity.

Fixed input: angle 12.905686665770533 degrees, elevation 35, tipX .25, tipY 0,
speed 10. Original constructor layout and parameters, max CCD substeps 4 and
64 cue subdivisions. No placements, original-ball setters, velocity injection,
additional settling or original-source changes. Real clearance passed with
minimum distance .010970784351229668 m. The before-strike world is exactly the
existing constructor checkpoint with SHA256
d736c6964006af5ae74d05cfeba99ad8e48d02ee15293affe6e224c36c9ff269.

## Observation and numerical consequence

Only h397 then h396 were probed, in the preregistered seven-boundary order.
At h397 the right cushion was already a fraction-zero contact, so only the
front cushion had a strict-positive TOI. h396 was the first positive group,
and the search stopped. No second input was tried.

At h396 the complete original source-qualified target order for selected
body16's environment collider16 was cloth0, front-cushion8, right-cushion4.
The massless pair collider17 was rejected by the source collision-group filter.
The cloth returned fraction zero. Both cushions had strict-positive fractions
at full bound 1 in both phases:

| Phase | Front full-bound | Right full-bound | Actual right after front tightened bound |
|---|---:|---:|---:|
| Pre-solve | .9512113928794861 | .9360193610191345 | .9360221028327942 |
| Post-solve | .9496107697486877 | .9357519745826721 | .9357571601867676 |

This is concrete evidence that a naive minimum of independently cast full-bound
TOIs is not bit-identical to the original source. The later cast changes by a
few f32 ULPs because its root bracket starts with the earlier cast's bound.
To generalize exact multi-target CCD, preserve the actual source traversal and
shrinking-bound recurrence or prove equivalence with an appropriate certificate.
An arbitrary collider sort or min-only reduction is not an exact replacement.

The original pre-solve first impact was .0009750230819918215 seconds. The
minimum-step merge selected the complete dt=.0010416667209938169 with one pass.
Post-solve performed one actual clamp at fraction .9357571601867676:

- Before next translation: (1.3913594484329224, .030482657253742218, .6808768510818481).
- After next translation: (1.3907307386398315, .030482672154903412, .680690586566925).
- Next rotation changed as well. Physical velocity and current pose were preserved.

Instrumented and unobserved native snapshots were byte-identical. A separate
unmodified direct native step reproduced those bytes. Native versus original
WASM had exactly four typed signed-zero differences in resting contact caches;
byte identity is not claimed.

## Artifacts and validation

- Original /tmp/multi-toi-corner-e35-yaw12906-v1.v8, SHA256
  dc422327a39dfded11544de5114a8cb41bf67833f53e9b9d3fd92c912da4b6a6.
- Source /tmp/multi-toi-corner-e35-yaw12906-source-v1.json, SHA256
  98a2fcda0f3aab6fdb0b1d5a2126ad690555c653af8a606a6ff4deb7cc641c06.
- Created snapshot SHA256
  5daa1cc43aaea8b4145176d546c6b8681eef7e04a2fa28153a77f9843ba950e6.
- Original h396 pre SHA256
  19db84fff55c558cc4095f7cafb75f30f05cfc562073e71f6e93ad9d44aed174.
- Original h396 post SHA256
  4ca260a53f03d430e5ff8a402fb328bfc1418953e97e0b40ae16181f1c56b9d2.
- Native h396 post SHA256
  de4dcf4c116b9047da67ed40c04c2dee7a0422a06a60b4fddddd0d4a704fd634.

The original artifact preserves every pose/velocity frame through h400 and
before-strike, created, and h394–400 pre/post snapshots. Later original states
are diagnostics/assertions only, never recurrence seeds. The source artifact
preserves the exact visited and filtered candidate sequence, typed phase
worlds, exact query inputs, direct full-bound and original-bound query replay,
clamp records, and native/WASM differences. An append-only hash chain records
completed observations. Capture helpers refuse to overwrite evidence.

The compact checked-in source witness is
`tests/multi-toi-original-source-witness.json`. It contains both complete
source-qualified phase sets in actual traversal order, plus original-bound
and full-bound native results. Five evidence tests pass, including:

1. One fixed constructor input and fixed observation range.
2. Both phases really have multiple qualified strict-positive target TOIs.
3. Existing translated CPU sweep matches all 12 original-bound/full-bound
   replay fractions, statuses, points and normals exactly.
4. The unchanged conservative certificate rejects both phases with
   unsupported-order-sensitive-multiple-hits, as designed.
5. Persisted original/source provenance, source unchanged, setter audit,
   original clamp, unmodified native replay and signed-zero-only discrepancy.

Run the gate with MULTI_TOI_ORIGINAL_CAPTURE and MULTI_TOI_SOURCE_CAPTURE set
to the artifacts above, REQUIRE_MULTI_TOI_CAPTURE=1, then
`node --test tests/multi-toi-original-gate.cjs`.
No test implicitly regenerates the original shot.

The source helper uses the same explicit pinned binary/provenance environment
variables as existing source captures: ACTIVE_CCD_SOURCE_PROBE,
ACTIVE_CCD_DIRECT_PROBE, RAPIER_SNAPSHOT_DECODER, ACTIVE_CCD_BUILD_PROVENANCE and
POSITIVE_CCD_BUILD_REFERENCE_CAPTURE. The verified yaw-positive source capture
is the reference used for this run.
