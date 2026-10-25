# Original active-TOI capture

This is original-engine evidence, not a candidate GPU world and not complete CPU/GPU parity. Input `active-ccd-original-input.json` was frozen after discovery and before instrumented capture; it is deliberately not labeled an independent holdout.

Original three-ball constructor layout, selected id 1: angle 0°, elevation 35°, tipX 0.25, tipY 0, speed 10 m/s. The real clearance check accepts the shot. Default material/force/cue equations, 72 constructor settling steps, dt 1/960, stroke subdivisions 64, and CCD max substeps 4 remain unchanged. No placement, ball velocity injection, CCD disable, or input retuning occurs. The only two source velocity assignments create the cue shaft/head.

Cue removal is h163. The original outer-step subdivision choice retains 64 until h192; ordinary h starts 193. Target h389 is outer200, after cue removal. Application angular resistance/event filtering remains once per original external h, after all native internal CCD passes. The sphere is still in an active cloth manifold at h389, not an airborne surrogate.

## Genuine TOI, not an activation-only test

Native first impact is 0.0004171431646682322 s. Candidate records marked `accepted` store the newly accepted fraction in their bound field; the corresponding Query record retains the incoming max_fraction. The source BVH visits cloth/self/duplicate sphere/right cushion in that order per collider. Cloth raw Hit fraction 0 is not accepted. Sphere collider 16/body 16 versus fixed right-cushion collider 4/body 4 returns Hit fraction 0.4004574120044708, which is accepted.

The unchanged splitter chooses first interval 0.0005732740391977131, then remaining 0.0004683926817961037. Native min_ccd_dt is 0.00016666667943354696. There are two passes and one intermediate collision-detection phase. A real Started(4,16) event occurs during that intermediate phase.

This case has **no post-solve motion clamp**: the shortened intervals make post-solve fast-body flags false. Solved next poses and post-clamp poses are recorded and exactly equal. Do not promote this result into coverage of actual positive clamping or general active CCD. A separately captured clamping case remains required.

## Provenance and limitations

- Pinned Rapier revision b716d375efc0201003f0cd9ef7168eee0b62c177; official archive SHA256 67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1.
- Parry 0.31.1 official crate archive SHA256 7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e.
- Original WASM engine SHA256fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4.
- h389 original pre snapshot SHA256 2ed2cb463a24c876de89e67ce6ee4c8208067d0a014c563802f2c7fa7493e6b7.
- h389 original post snapshot SHA256d011fdd1404c77b684499bf894bd80288d3b05f775d0f04dcd42cee26c7344db.

The source probe operates on an isolated copy with read-only inserted observations. Its exact patches, original/source hashes and binary hash are recorded. Observations enabled/disabled produce byte-identical post snapshots. A separately compiled **unmodified source** replay also produces the same native snapshot bytes.

Native vs original WASM snapshots differ in exactly three signed-zero bits: cushion contact edge 3 warmstart_tangent_impulse[0,1] and warmstart_tangent_world[1], native +0 versus WASM −0. Every other typed field is bit-identical. The tests retain and disclose this difference; they do not normalize it into a byte-equivalence claim. This boundary replay is prepared-component evidence, not initial-only full-shot parity.

## Reproduction

1. Build the direct probe with `node tests/active-ccd-build-direct.cjs`, supplying the same explicit official source/archive, Cargo/Rustup and target variables used by the snapshot decoder. Existing decoder and inactive-CCD probe binaries are verified unchanged.
2. Build `node tests/active-ccd-source-probe/build-native.cjs` with those variables plus isolated `ACTIVE_CCD_SOURCE_COPY`, `ACTIVE_CCD_PROBE_HOST`, and `CARGO_TARGET_DIR`. The original engine source is verified before and after building. Existing differing source copies are never modified.
3. Capture a new original artifact: `node tests/active-ccd-original-fixture.cjs /absolute/new-original.v8`.
4. Capture source diagnostics: `node tests/active-ccd-source-capture.cjs /absolute/new-original.v8 /absolute/new-source.json`. Set `ACTIVE_CCD_SOURCE_PROBE`, `ACTIVE_CCD_DIRECT_PROBE`, `ACTIVE_CCD_BUILD_PROVENANCE`, and `RAPIER_SNAPSHOT_DECODER`.
5. Test with `ACTIVE_CCD_ORIGINAL_REPLAY`, `ACTIVE_CCD_SOURCE_CAPTURE`, and `ACTIVE_CCD_DIRECT_PROBE`: `node --test tests/active-ccd-original.cjs`.

Captures are create-new only. Loading never implicitly regenerates expectations. Source identity changes require a new capture path. Full later snapshots/query results are assertion-only and must never be uploaded as candidate recurrence inputs.
