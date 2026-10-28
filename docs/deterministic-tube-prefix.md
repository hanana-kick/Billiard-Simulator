# Fresh-impact common-clock tube prefix

This experimental composition performs:

1. The existing canonical intrinsic-direction motion/event query and full 3D pair/cloth response.
2. Admission of supported general motion, outward ballistic flight, and stationary translation at the resulting encoded state.
3. One common duration for every body, bounded before the earliest admitted flight return to cloth.
4. SMT2 supported integration plus exact ballistic/stationary formulas.
5. Conservative all-pair and full-scene exclusion, including the freshly resolved pair's separating release.

All ten phases remain GPU resident. No host physics or intermediate readback occurs. CPU executes the same integer operations; this checkpoint admits one three/four-body candidate per call, not a thousand-candidate performance claim.

## Authority, explicitly separated

The initial reference is the **exact canonical encoded post-impact state**. Its fresh flow uncertainty is zero relative to that point, not relative to an unquantized earlier trajectory. The result states:

- `initialReference: 'canonical-post-impact-state'`;
- `preImpactPhysicalEnclosurePreserved: false`;
- `physicalAcceptance: false`.

The complete source response is retained. The existing impact solver does not yet propagate interval event-position/normal/residual uncertainty into an outgoing velocity/spin enclosure. This module therefore does not silently carry a prior certified physical trajectory through that impulse, and it does not claim a global enclosure or unchanged whole-shot accuracy. A canonical numerical event loop and a strict globally certified profile have different authority.

## Modes and clock

Fresh source must be an actual successful directional impact and successful 3D response. Every center must equal the declared flat surface height plus its encoded radius. Nothing is projected to achieve this.

- Supported mode requires exactly zero vertical velocity. General horizontal v/q is retained; SMT2 refuses unresolved slip or tangent-spin boundaries.
- Flight at initial surface requires a strictly positive vertical velocity beyond the source residual and zero cloth normal impulse for that selected body. All three q components remain constant while airborne.
- Stationary translation/tangent spin permits exact independent normal-spin stopping; it is not automatically a gameplay REST.
- Below-surface, downward surface, ambiguous residual mode, or other unsupported states remain pending.

For initial flight, the rational return time is `2*vy/g`. Common h is at most one tick before its lower integer bracket. Up to16 additional integer endpoint checks ensure the packed ballistic position tube remains above cloth; this is an explicit clearance search, not an arbitrary fixed padding. Failure remains pending. All supported rows receive exactly this h with one certificate attempt. Any failure prevents all-body commit; bodies never end at different times.

The provided seven budgets govern SMT2 horizontal position/v/q and normal spin. Ballistic coefficient rounding separately gives per-axis position errors1/2/1 quanta and vertical velocity error1 quantum; horizontal velocities and angular state are unchanged exactly. These fixed representation errors are not mislabeled as user-selected supported budgets.

## Clearance and contact episodes

Every body's normalized-time dense polynomial is enlarged by its complete interval error receipt. The scene includes conservative AABBs of all four validated encoded cushion hull assets and every additionally declared static shape, plus the finite cloth footprint. These are bounds on the real finite hulls in the canonical encoded scene, not replacement vertical-wall response planes. A bound overlap is pending; it is not a collision event or a miss.

Every nonselected pair must have a strictly separated complete relative-position box. The selected pair gets an exception only for this freshly solved episode:

- lower bound of `relativePosition dot relativeVelocity` is strictly positive over the entire tube interval;
- endpoint distance lower bound is strictly greater than the radius sum.

Thus the numerical overlap is releasing monotonically and the pair is fully clear by the endpoint. A different pair token cannot suppress another pair. This token cannot be reused after any intervening response. No new impulse is applied in this prefix.

## Output and pending semantics

`state` remains256 words with four48-word body records starting at64. Header:

- 0 id, 1 status (1 clear committed prefix; 5 incomplete certificate; 7 pending), 2 reason, 3 body count;
- 4 proposed/common ticks, 5 committed absolute time, 6 fresh source pair, 7 per-body two-bit mode;
- 8 source impact time, 9 profile version `0x54504201`, 10 geometry checks;
- 11 point RHS, 12 interval RHS, 13 normalized-derivative evaluations;
- 14 separating release proved, 15 no-outcome marker, 16 landing-clearance checks.

Pending outputs retain current positions/time at the source impact. Dense/smooth diagnostics can contain proposed future states, never committed states. Work counts include all supported bodies even when the first body fails.

Body current p/v/q remain at offsets24/27/30. Old acceleration/q-rate coefficients9..14 are cleared after commit;39 marks them dirty. Field40 stores the current admitted mode (0 stationary translation,1 general supported,2 flight). Historical intrinsic mode/direction/scalar fields are not continuation coefficients. The separate64-word-per-body `dense` receipt retains polynomial anchors, increments, errors and joint kinetic radius.

Private phase helpers require the validated upstream producer. Public run entry points validate raw rows/scenes and snapshot actual hull assets before asynchronous compilation. Private all-zero inactive smooth rows do no work; public SMT2 rows still require a positive attempt budget. Original AbortSignal identity is preserved.

## Evidence

The real angled-impact fixture commits26,026 ticks (24.82ms) after the impact, with supported / flight / supported / stationary modes. All four bodies advance; the moving uninvolved ball moves too. There are70 geometry checks, four point RHS evaluations,16 interval RHS evaluations and16 normalized-derivative evaluations. The flight body is descending but remains above cloth, ready for a subsequent landing event.

Independent binary64 supported integration lies within retained component radii; ballistic formulas lie within the stated fixed rounding bounds. Supported kinetic energy dissipates and all angular components are retained. Pending tests cover tiny prelanding duration, insufficient error budget, stale episode, injected static enclosure and pre-impact query exhaustion.

Native parity covers four scenarios and5,632 words, including inactive rows and cancellation. Ten resident phases, zero intermediate reads. Software SwiftShader timings are not hardware performance claims. No raw cue, full repeated trajectory, new landing response, scoring outcome, or production activation is included here.

Final targeted run: 4/4 native tests passed in13.67s; compilation13.10s and16,128 application-buffer bytes. The receipt's submit/read timing is for the final upstream-query-budget case, not the successful physical trajectory. Upstream solver/query budget exhaustion remains explicit status5. These timings are software-backend diagnostics only.

### Solved-pair release: two independent radial proofs

The exceptional release of a just-solved pair now requires both the existing
physical-velocity radial lower bound and a strictly positive radial lower bound
formed from the derivative of the **original position polynomial**. For
`p(s)=p0+d*s+c*s²`, `s∈[0,1]`, the latter uses directed bounds on
`(d+2*c*s)*2^20/h` with the original duration `h`; checked arithmetic is used for
`2*c`, sums, relative differences and dot products. Endpoint separation remains
mandatory. Position and velocity coefficients and local error budgets are not
changed by this additional admission gate.

The two proofs cannot be substituted: an accepted one-tick SMT2 example has
position coefficients `d=1,c=-1` while its independently encoded velocity has a
strictly positive lower bound. Its position derivative reverses sign. Synthetic
swept-box mode 3 has no generic position-polynomial derivative contract, so the
exception fails closed for that mode. Ordinary swept-box separation is unaffected.
Only modes 0–2 and durations 1–65535 are admitted to this derivative proof.
This is a local canonical-path safety gate, not a global physical enclosure claim.

Validation (2026-10-27): `tests/deterministic-tube-release-derivative.mjs` covers
both directions, negative curvature, non-power-of-two duration, derivative
reversal/zero, negative physical velocity, unknown/synthetic modes and invalid
durations. Native SwiftShader exact parity passed all 10 cases (5120 state/dense
words); the existing tube suite also passed its 4 native cases (5632 words).
Combined suites passed 7/7. Source phase hashes intentionally change; batch pins
must be independently reviewed rather than mechanically replaced.
