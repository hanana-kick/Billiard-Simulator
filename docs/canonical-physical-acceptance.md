# Independent canonical physical acceptance slice

Run `node --test tests/canonical-physical-acceptance.mjs`.

This separately authored suite calls canonical CPU mirrors, but computes its expectations from closed-form mechanics and world-origin momentum ledgers. It imports neither Rapier nor existing test oracles. With `REQUIRE_WEBGPU=1` and `GPU_NATIVE_MODULE` set, the native test batches these same fixtures through existing GPU factories, compares every returned state/contact/response/root word, then applies the identical analytic checks to the native outputs. Missing module, adapter, shader compilation, or execution is a failure, not a skip. CPU-only invocation explicitly skips this native test; generic native parity matrices remain additional coverage. No solver code or acceptance tolerance was changed.

## Existing criteria reused

| New fixture | Existing criterion and exact source | Scope |
|---|---|---|
| Equal-mass normal inelastic pair | `tests/accuracy.cjs:42–45`: each outgoing speed ±0.002 m/s; velocity sum ±1e-5 m/s | Analytical equal-mass restitution, no cloth |
| Free oblique frictional pair | `tests/accuracy.cjs:46–51`: momentum error <1e-5 kg m/s, angular momentum error <0.0002 kg m²/s, final energy ≤1.001 initial | Full 3D spin, common contact point, no external impulses |
| Equal-mass elastic specialization | `tests/physics-invariants.cjs:15–24`: velocity ±0.0001 m/s, momentum ±1e-6 kg m/s, energy ±1e-6 J | Uses equal masses supported by current kernel; does not assert unequal-mass coverage |
| Fixed-sign supported sliding | `tests/accuracy.cjs:21–25`: speed ±0.0015 m/s, surface-speed/slip-scale ±0.002 m/s | Checks pre-transition analytic linear evolution only, not the original complete 5/7 slide-to-roll fixture |
| Normal torsion during supported sliding | `tests/accuracy.cjs:31–35`: angular speed ±0.02 rad/s | Independent q/R conversion and torque decay, before stopping |
| Ballistic vertical landing | `tests/accuracy.cjs:17–20,52–55`: impact speed ±0.0002 m/s; restitution ratio ±0.003 | Independent square-root impact speed and time; short resolvable isolated fall |
| Supported rolling | `tests/accuracy.cjs:26–30`: speed ±0.001 m/s | Configured rolling torque law, exact encoded rolling cancellation |

The short supported slices run for approximately 0.05 s, not the original 0.3/0.5 s source fixtures; passing them cannot substitute for complete transition/long-duration validation. Parameters are physical requested values, so discrepancies include coefficient/state quantization. Contact ledger geometry/mass/radius use the encoded packet, which is the canonical collision model. No universal energy claim is made for simultaneous Newton-restitution multi-contact solves.

## Measured CPU receipt (2026-10-27)

- Inelastic outgoing speed errors: ±2.3842e-8 m/s; sum error 0.
- Oblique momentum error 0; angular momentum error 6.1653e-10 kg m²/s; energy 0.118650 → 0.0796512 J.
- Supported sliding speed error −1.3351e-8 m/s; tangential surface-speed error −4.5707e-8 m/s; torsion error 1.0666e-6 rad/s.
- Elastic outgoing velocity and energy errors: 0.
- Landing incoming-speed error −4.3605e-8 m/s; restitution-ratio error −1.4912e-7; independent root 0.02822022756 s lies in returned bracket [0.02822017670, 0.02822113037] s.
- Rolling speed error −1.8745e-7 m/s; encoded slip exactly zero.

CPU analytic suite: 6/6 passed (about 0.13 s); CPU-only invocation additionally reports one explicit native-test skip. Each execution prints measured errors in TAP diagnostics. These are observations, not new tolerances.

## Missing release coverage—not passing skips

No complete raw-cue-to-rest, all-geometry full-shot claim follows from these tests. Missing here: complete 5/7 transition, torsion stop, general-angle carried smooth evolution through impacts, repeated landing/contact chains, cushions and corners, successive contacts, simultaneous/grazing cases, and equipment calibration. Unequal masses and anisotropic cue dynamics are not covered by this equal-sphere kernel.

Minimal next independent matrix: straight/draw/follow, arbitrary azimuth with side spin, airborne landing, finite cushion face/nose/corner, successive pairs/rails, then explicit ambiguous simultaneous/grazing cases. Compare a separately implemented high-accuracy same-law reference and progressively refined canonical resolution at common observation times and full rest. Record p/v/q, event-time brackets/order, stopping time, and scores; test momentum/energy only in domains where their assumptions hold. Never use old Rapier trajectories as the physical oracle.

Scoring remains exact and separate: unordered gameplay target mask vs ordered search, three-cushion count frozen at second distinct target, opponent foul after goal, genuine kiss episodes, no PASS before rest, and no false miss on budget/cancel/unsupported. Existing contracts are in `tests/deterministic-rules.mjs:12–55,75` and `tests/deterministic-physical-rules.mjs:13+`.

**Unspecified criteria:** no agreed universal full-shot p/v/q or event-time tolerance, near-boundary scoring robustness margin, or equipment calibration exists in these files. The 2 mm / 0.01 m/s cushion refinement thresholds (`tests/physics-invariants.cjs:33–39`) apply to that cushion fixture, not arbitrary whole shots. The 1e-9 m same-engine replay criterion (`tests/accuracy.cjs:80–88`) is determinism, not a physical accuracy budget. Do not invent or extrapolate these into a release threshold; obtain project/user criteria before a broad “unchanged accuracy” claim.

## Same-fixture native receipt

2026-10-27: `REQUIRE_WEBGPU=1` native run passed **7/7 tests**, no skips, in 12.53 s (including compilation). Three free-pair fixtures share one contact batch; one batch each covers smooth sliding/torsion, rolling directional advancement, and landing. **1,056 result words matched exactly**, including all directional state/contact/response and landing root/response words. The six identical analytic assertion functions then ran on the native outputs, with the measured errors above unchanged. This receipt uses Vulkan SwiftShader, not physical-GPU throughput evidence; it does not certify every hardware implementation or full shots.
