# Canonical full-3D cloth landing

`deterministic-landing-3d.mjs` is a bounded **canonical numerical** single-sphere landing component. GPU results are authoritative; CPU mirrors every integer output word. It is not an interval proof that uncertainty from earlier impacts was propagated. It does not silently accept a smooth tube as exact ballistic state, certify global event order, or claim unchanged physical accuracy without tests.

## Motion and root convention

The original anchor is p/v/q, with full3D horizontal translation and all three surface-spin components `q=Rω`. Free flight uses immutable scene gravity: x/z velocity and q are constant, `y(t)=y0+vy0*t−g*t²/2`. No planar projection, fictitious ball, duplicated auxiliary cloth or hidden trajectory stepping is used.

The module reuses the existing exact-u64 `ballisticBoundary` and `landingSpeed` formulas from `deterministic-q-continuation.mjs` (the CPU speed function only gained an export; its formula is unchanged). The root finder isolates the descending root in Q20 ticks using exact polynomial signs and bounded binary search. An exact tick root has equal lower/upper. A root beyond the horizon is a clear result for this cloth plane only. Invalid initial overlap/support is not turned into a landing.

The canonical landing state is deliberately explicit:

1. Advance x/z and the uncorrected y/vy to the **upper tick** using existing signed-floor recurrence.
2. Correct only center y to `clothTop+R`; retain the correction and a directed local displacement bound. Refuse if it exceeds the caller's cap.
3. Reconstruct downward root speed as `floor(sqrt(vy0²+2*g*initialGap))`. Its error relative to the exact continuous root speed is less than one Q24 quantum. This avoids adding the extra upper-tick free-fall velocity to restitution and manufacturing bounce energy.
4. Retain root-speed minus stored-upper-vy correction and its directed bound `ceil(g*bracketWidth)+2` quanta; refuse if its separate cap is exceeded.
5. Keep x/z at their upper representatives. Per-axis bounds enclose their difference from every continuous root position in the bracket. The whole bracket's x/z enclosure must be strictly inside the immutable finite cloth rectangle, otherwise return uncertainty (including touching an edge).

The y correction bound is `ceil(|vy(lo)|*Δt)+ceil(g*Δt²/2)+2`, with the stored lower velocity conservatively rounded. These are local numerical convention/error bounds, not permission to move through another collider. A global scheduler must own the event and exclude every competing object/bracket before application.

A separating flight starting exactly at cloth height whose return is within the first tick has a bracket containing its initial touch as well as return. It is **uncertain**, not a fabricated repeated positive bounce or an arbitrary zero-velocity cutoff. Resolvable positive elastic rebounds are preserved. For dissipative restitution the outgoing speed uses a downward product, so tiny positive speeds cannot become an artificial rounding-induced fixed cycle. Any still-unresolved subtick flight stays pending rather than being silently damped to rest.

## One genuine static contact

The homogeneous sphere has one dynamic body and the cloth has zero inverse mass/inertia. The chosen contact arm is exactly `(0,−R,0)`, normal `(0,1,0)`. This is the closed-form specialization of the existing true one-body Jacobian, using the shared integer contact arithmetic:

- Normal effective inverse mass:1, not2.
- Each tangent effective inverse mass:`1+5/2=7/2`; off-diagonal coupling is zero.
- Slip:`(vx+qz, vz−qx)`.
- `bounce=floor(e*rootSpeed)`, `Jn/m=rootSpeed+bounce`.
- Trial tangent impulse `−slip/(7/2)`, division truncated toward zero, projected into the exact coefficient disk `|Jt/m|≤floor(μ*Jn/m)` using existing strict disk arithmetic.
- `Δvx=Jx/m`, `Δvz=Jz/m`, `Δqx=−(5/2)Jz/m`, `Δqz=(5/2)Jx/m`.
- qy is preserved exactly. The instantaneous point-contact model adds no invented torsional impulse; subsequent supported motion remains responsible for its physical spin-resistance law.

Directed trial division is intentional: nearest division plus nearest torque multiplication can alternate slip±2 quanta under repeated elastic contacts. For an impulse integer k opposing integer slip u, truncation ensures `ceil(3.5|k|)≤|u|`; inward disk projection only reduces |k|. Thus the resulting component slip cannot cross zero due to rounding. Subquantum trial impulses remain unresolved residual slip rather than fabricated alternating ±1 impulses. This is an explicit canonical quantization rule, not a velocity cutoff.

For the admitted |v|,|q|≤4 domain, a conservative local comparison bound is **7 Q24 quanta per tangent impulse component** relative to exact Coulomb projection at the chosen encoded pre-impact state and encoded normal impulse. Trial-vector truncation contributes Euclidean error<√2, floored cone radius<1, ceil-norm radial reduction<1, scale truncation per component<16/7, and final component truncation<1: total<7. Consequently tangent-velocity error is<7 quanta and tangent q-update error is<18 quanta relative to that same chosen-state oracle. These are not whole-trajectory or true-root impact bounds. Integer torque rounding can introduce tiny total-energy increases (review probes observed1.6/Q per unit mass); tests permit an explicit8/Q rounding allowance, not strict energy monotonicity.

There is one primary cloth contact only. Restitution0 produces exactly zero post-impact vertical speed. The full resulting v/q remain intact; current mode is UNKNOWN and coefficients dirty. No generic continuation is assumed from a zero vy alone.

## Ownership, range, resource caps

`packLandingCloth` requires provenance `immutable-finite-cloth-face`, ID, top, finite `[xmin,xmax,zmin,zmax]`, gravity, restitution and friction. Footprint limits round inward. Scene16 words: version `0x4c334401`, ID, top, four bounds, g,e,μ; words10..15 zero. Position/cloth coordinates ±4m, g in(0,16], e/μ in[0,1].

`packLanding3D` requires profile `canonical-ballistic-landing-v1`, 1..128 unique-ID rows, p/v/q vectors, R,mass,horizon and explicit correction caps. No acceleration or uncertainty field is accepted as an implicit override.

Input32 words: ID,version,horizon,maxPositionCorrection; p3,v3,q3,R,mass,maxVelocityCorrection;16..31 zero. p/v/q components ≤4 in magnitude, |vy|≤1, R4096/Q..1m, mass(0,4], initial gap0..1/8m, horizon1..65535 ticks, position-correction cap1..256 quanta, velocity-correction cap1..4096. Failed range/height premises reject. SharedArrayBuffer is rejected; offset views are supported. Scene is copied before await, input before async execution.

Two resident passes (root/correction, then one-body response), zero intermediate readbacks. At most128 candidates; binary root search takes at most16 bisections plus endpoint checks. The response is closed form, no iteration budget escalation. Maximum readback81,920 bytes (128×160words).

## Output

`roots`:64 words per candidate. `result`:96 words, first64 copied from root packet (status updated on response).

- 0ID,1status (1root ready,2no root in horizon,4invalid,6uncertain,8response complete **pending continuation**),2reason,3lower,4upper,5version,6R,7mass.
- 8..10 uncorrected upper p;11..13 upper v;14..16 original q.
- 17root pre-vy,18root-speed error bound1,19y correction,20y bound,21vy correction,22vy bound;23zero.
- 24..26 chosen corrected p,27..29 chosen root-preimpact v,30..32 q,33g,34e,35μ.
- 36/37 x/z representative-vs-root errors,38bracket width,39zero,40cloth ID;41..43 actual chosen cloth point,44..46 physical contact arm `(0,−R,0)`,47..49 outward normal;50..63zero.
- Result64..66 postv,67..69 postq,70normal impulse/mass,71/72 tangent impulses/mass,73mul count,74divide count.
- 75currentMode UNKNOWN,76coefficientsDirty (1only applied),77continuationPending1,78primaryContactCount1 (only applied);79..95zero.

Reason1invalid root domain,2upper position range,3unresolved subtick surface return,4correction/approach refusal,5finite footprint uncertainty,6response arithmetic/range. Failed packets are diagnostics, not applied states. `physicalAcceptance:false` and `continuationPending:true` remain explicit; a future canonical event executor can consume the result under its own nominal numerical profile without mislabeling it as global physical enclosure.

## Evidence

`tests/deterministic-landing-3d.mjs`: independent exact ballistic root (tick32768), continuous quadratic root brackets, oblique 3D slip/spin, restitution0/.2/1, force/torque ledger, exact BigInt Coulomb disk, energy checks, qy preservation, finite ends, correction refusal, absent root, tiny-bounce progression and resolvable elastic bounce, input/scene ownership and quantization guards.

Initial nearest-trial receipt (superseded by the directed-trial checkpoint below): **4/4 passed**,24 cases across three restitution scenes, **3,840 words exactly equal** CPU/GPU. Combined three scene compiles0.92s, suite1.18s. Independent tangent impulse discrepancy at most1.42e−7 (less than3 Q24 quanta; test bound5), measured against the declared chosen-state Jacobian rather than a broad accuracy claim.

Final directed-rounding checkpoint: **6/6 native tests pass**,29 cases including exact tick/g8, small positive rebound and the independent strict-disk regression; **4,640 words exact CPU/GPU**,1.30s combined five-scene compilation,1.54s suite. CPU-only replay of the reviewer's fixed seed0x9e3779b9 independently checked50,000 exact BigInt root/sqrt cases and4,993 accepted randomized responses; worst measured tangent discrepancy3.989 quanta (within the derived7-quanta bound). The routine suite retains just its targeted regression, not an unbounded fuzz workload.

Trusted resident-builder exports `landingRootsCPU` / `landingResponseCPU` expose the same arithmetic without public packing. The builder owns range/provenance validation and outer terminal gating. A zero inactive row deterministically rejects with status4 under CPU and WGSL (including nonzero cloth heights); it never applies a response. Its diagnostic rejection must not overwrite an unrelated terminal chain state.

## Representative-clock domain versus root accuracy

`deriveLandingVelocityCorrectionCap(encodedGravity)` gives the existing directed
one-tick correction bound `ceil(g / 2^20) + 2` in Q24 velocity quanta. At encoded
g=9.81 this is159, so legitimate corrections136 and147 exceed the legacy chain
default128 but remain inside the already-proved representative-clock bound.
An explicit canonical-world caller may use this derived domain cap; a supplied
stricter cap is still honored, and the legacy chain default remains128. This
expands admission, not the root-speed error: the energy-root formula and its
less-than-one-quantum error, position correction cap, local motion budgets and
impact law are unchanged. No unresolved competing collision is admitted by this
cap. See `tests/deterministic-landing-clock-domain.mjs`.
