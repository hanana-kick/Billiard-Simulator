# MMQ2 mixed-pair entry component

Explicit component adapter only; no v1 routing, default switch, physical acceptance
or post-impact global receipt certification. Original ROLLING can coexist with
SMT2, FLIGHT and REST anywhere in the complete three/four-body roster.

## Resident stages and packets

`deterministic-mixed-pair-v2.mjs` exports `runMixedPairEntryV2CPU`,
`createMixedPairEntryV2GPU`, and two versioned stage source constants (query is reused).
The GPU exposes `encode(encoder,index,buffers,count=1)` with unchanged v1 bindings:

0. rows, immutable scene, query config,1056-word complete query ledger.
1. rows, query, pair material config, endpoint sample cache; dispatch11×body count.
2. rows, scene, query, pair config, cache,128-word entry,64-word contact,
   160-word advanced roster.
3. contact,128-word response (unchanged CONTACT_3D solver).
4. entry, advanced, response,160-word state (unchanged merge).

Stage1 caches11×body-count×128 words: initial, lower-clear, and nine doubling
extension endpoints, bounded by maxExtensionTicks≤256. Query bisection and
qualifier interval bounds use the original cached rollingPoint law and exact
scalar bounds; only endpoint sampling uses full rollingPartial. No polynomial fit.
The standalone diagnostic runner also reads the sample cache for exact parity;
resident encode stages do not read intermediate buffers back.

Advanced p/v/q values use XYZ. Advanced local-error words16..23 retain inherited
`px,pz,vx,vz,qx,qz,qy,rho`; these errors are not XYZ. Full original qy is retained
in every endpoint and unchanged 3D response input. Post-impact receipt validity
remains false; local pre-impact bounds do not certify a global post-impact tube.

## Admission and evidence

The v1 lower-clear, strict upper-entry, bounded penetration, whole-interval
approach, material/mass, and full-roster/common-clock checks are unchanged.
All query records remain authoritative, including both rolling translational and
qy stop records. Any competitor starting at or before the extended entry endpoint
blocks impulse dispatch admission; there is no object-ID suppression.

CPU bank13passed/2native skipped (including imported query tests). Native17cases,
102,048 complete query/entry/contact/advanced/response/state/cache words exact.
Includes active rolling/sliding pair, sliding or flying pair with another rolling
body, four-body roster, legacy SMT2 parity, earlier hull/cloth, pair tie, qy stop
before/equal/strictly after entry, other-body translation stop, budget refusal,
unsupported source and mass mismatch. Distinct qz/qy checks use original sampler. CPU cache-boundary regressions also
cover extension caps1,255,256 and require all unused slots to remain zero.

Native compile21.756s; bounded process22.506s, aggregate890.00MiB/max child855.18MiB
under1500MiB/150s. SwiftShader software Vulkan only, not hardware throughput or
full-world REST qualification. Serialized flock queue waiting is not execution time.
