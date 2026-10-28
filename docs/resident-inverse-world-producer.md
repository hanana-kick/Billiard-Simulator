# Same-world inverse observation producer (opt-in, HOST proof only)

`inverse-world-observation.mjs` adds an authenticated, initial-only layout and
source hook. Current profile is `source-four-ball-inverse-producer-v2`. It does **not** activate a backend, upload observation frames,
replace source physics, implement final-gameplay qualification, or qualify GPU
execution. The unchanged standalone observation reducer remains available.

## Exact boundary and ownership

`createInverseWorldObservationPlan({seed,template,topology})` requires the actual
registered original seed and its hull ownership brands. The original template
and **every original physical view length remain unchanged**: state0, program1,
geometry2, scratch3 and raw inputs4 retain their exact original storage. Source
PC bytecode/control-tail lengths are unchanged too. There are no appended data
words in those views, so their original arrayLength guards and invalid-address
sentinels do not acquire new accessible storage.

Observer data exclusively owns source ID5 / GPU binding7 (historical binding
name `rc_event_audit`): control16, frame108, reducer2150 for two stages/cap256,
projection24 and original point output, with64-word alignment: **2496 words /
9984 bytes per candidate**. The23-word immutable config is compiled as constants,
not appended to program1. Existing point scratch is reused after physics has
finished consuming it; its physical/logical length does not change. These are
layout quantities, not measured device memory or qualified candidate capacity.

The original7-binding path gains the explicit optional eighth observer binding.
**Simultaneous emission-audit plus observer is rejected.** Existing mandatory
native tape gates are not dropped or weakened; combined ownership needs a
separate source-ordered logical-view proof before that profile can be admitted.
The future runtime must call `assertInverseObserverResources` and allocate a
fresh zeroed, distinct observer buffer. WGSL cannot detect host GPUBuffer aliasing.
No per-h map, CPU frame producer or future-state injection is introduced.

Historical v1 (`3b1a497`) appended observer state/config into physical views. Its
valid-fixture tests passed, but review found that enlarged arrayLength admission
was not proved equivalent on malformed source paths. It is superseded, not a
native-qualified or malformed-view-qualified profile. Historical evidence is
retained and labeled as such.

`attachInverseObservationToWorldH(plan,world)` changes only two opt-in source
calls, retaining all original loops/caps and device-PC scheduling:

1. Accepted canonical created t0, before the first original outer begin.
2. After the **last** collision/CCD pass seal, before
   `rc_world_application_begin_post_h`. Not after each internal CCD pass and not
   after angular/application updates.

The second cut requires the original world/application/scene/CCD/journal phase
seals and h/sequence equality. Live-cue and post-cue final-pass branches remain
distinct. Duplicate, stale and malformed cuts cannot publish another sample.
Rejected worlds do not initialize observation history.

Positions come from canonical body f32 translation, widened exactly. Radii come
from original application binary64 object rows, **not** rounded native radii.
The observed dt is `widen(f32(application.h))`; observed time is the original
binary64 `application.time + observedDt`. Header bank+10 can contain a final
CCD substep and is deliberately not used as the observation dt.

The ordered sphere/cushion caches are bound by complete handle generations in
the immutable original catalog and live journal. Presence, point and positive
impulse follow the original source cache contract; presentation event history
is never an input. Cache failure/nonfinite/inconsistent presence is unsupported. Positive impulse
uses integer sign-clear and nonzero magnitude after the finite guard: positive
subnormals remain positive without a hardware f32 comparison. Discrete generated
frame/reducer regressions cover ±minimum subnormal, ±0 and ±normal.

Each rail uses its actual identity-pose original convex hull and unchanged
`convex-point.mjs` init →256 GJK calls →EPA →finish, solid=true. No ideal plane,
fallback point, reduced iteration cap or newly approximated geometry is used.
The original f32 query and pinned V8 binary64/hypot reducer retain their distinct
numerical qualifications; HOST equality does not prove universal GPU semantics.

The adapter rebases reducer frame/state/projection reads into the same-candidate
disjoint observer bank and config reads into immutable constants.
Arithmetic and source reducer order are unchanged. Failure clears authoritative
projection payload and returns unsupported; partial frame/reducer data is
diagnostic only. This is not an ordinary evaluated miss.

## Evidence and remaining gates

Local diagnostic command:

```
node --test tests/resident-candidate-inverse-world-producer.mjs
```

Prerequisite: the authenticated original initial capture/decoder provenance
used by `resident-candidate-original-fixture.mjs`. This is **not** an
artifact-independent release-suite test. It never imports Dawn or launches GPU.

The test runs a genuine retained created-t0/two-h original world microcode path,
with the new producer inside source execution. Only after completion are fresh
independent original source futures computed. All108 frame words at both cuts
and all11 final physics/rule groups match. Original source PC bytes and complete
physical view lengths match the uninstrumented plan exactly. Initial frame, physical-bank
non-mutation, rejected/duplicate cuts, changed generations, malformed caches and
stale epochs are checked separately. The two-h case precedes real tip contact;
it is not strike, full-rest, raw-creation or1024-candidate qualification.

Still missing: native compilation/execution and original-frame parity, active
impact/episode and post-cue CCD cut integration, raw initial allocation/profile
admission, resource/throughput qualification, and legacy terminal scorer join.
In particular, inverse `begin` samples clearance again after accepted strike;
prestrike raw clearance cannot be reused merely by calling it the same value.
Read-set/transform/callback proof and authentic before/after witnesses are
required before joining that value and the exact input inequalities. New
final-gameplay receipts are a different policy/contract, not a flag upgrade of
this legacy source-query observation.

## Clearance read-set witness (not runtime activation)

`resident-candidate-inverse-clearance-readset.mjs` restores the same authentic
prestrike source and tests the four accepted varied controls17/118/219/320.
Before original strike, after original creation, and after the inverse-style
second clearance call, every queried old body/collider transform, shape,
generation, roster identity, selected radius, settings and source pose is exact.
All clearance result fields are exact; zero native steps occur. The callback is
the unchanged `FourBallGame.contact`, not an arbitrary user callback. The
original `physics.js` SHA256 is pinned to creation admission. Its clearance
loop reads only statics/objects; newly created cue/guide bodies are outside that
roster. The second propagation leaves those queried transforms unchanged.

This supplies bounded causal evidence for a later source-bound reuse admission.
It does not, by itself, authenticate GPU raw-clearance output, arbitrary callbacks,
new shapes/materials, or all settings. The scalar join remains unimplemented.
Diagnostic JSON hashes in this test are not request/candidate identities; exact
Number/signed-zero equality is checked directly, not inferred from those hashes.
