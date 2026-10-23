# Shot search model and limits

The solver is a bounded numerical search, not a closed-form solution or a global optimum proof.

1. Reflect goal positions across cushion lines to propose possible rail sequences.
2. Reverse from the outgoing goal ray to a cue/object contact circle. Tangent-contact iterations account for the outgoing ray starting at the contact position, not the object centre. Existing broad cut-angle seeds remain available.
3. Sample cue speed, contact point, and optionally vertical cue elevation within the requested ranges.
4. Evaluate every candidate in a fresh copy of the actual full-resolution Rapier world with the same cue/contact/cloth model as live shots.
5. Refine physically evaluated near misses. Rank only verified successes.

Tangent constructions are only proposal heuristics. The ideal tangent-line relation assumes a stun collision. Rolling/sliding transitions, spin, frictional throw, inelastic cushions, elevation, and multiple moving contacts mean that solving one geometric angle does not solve the full shot. No analytical prediction replaces actual collision integration.

## Kiss policy

“Allow kisses” permits the cue ball to contact an object ball again after that pair has separated. An initial hit on a moving ball is not by itself a kiss. The policy is checked only until the requested target sequence succeeds; collisions after that instant do not undo success.

The evaluator reads actual solver contact impulses and tracks separation (over 0.05 mm) before recognizing a new impact. It does not rely on the UI collision log, which debounces impacts for 120 ms. All balls continue moving normally. This is a candidate filter, not a physics setting. Contact sampling is at simulation-step resolution (normally 1/960 s); during cue substeps, multiple collisions entirely inside one outer step may not be distinguished. Simultaneous recorded kisses at the goal time are included conservatively; later ones are ignored.

The new `allowKiss` setting takes precedence. A legacy `allowMovingTargets` boolean is accepted only when the new key is absent, preserving its polarity (`true` means permitted). The legacy name no longer activates a moving-object filter; this is an intentional semantic migration to the requested billiards term.

Terminology references:
- https://drdavepoolinfo.com/faq/cue-ball-control/kiss-back/
- https://www.onepocket.org/glossary-of-one-pocket-terms/

## Free routes and result retention

Free-route evaluation imposes no named-family restriction. Three-cushion mode requires at least three cushions before the final target; carom/four-ball mode permits zero cushions and starts at depth zero. Inverse seeds progressively enumerate (total depth, geometry variant) diagonals, revisiting shallow depths with new variants while opening deeper ones. Each depth includes every before/after split p + q = n. There is no fixed maximum of five cushions and no eager infinite list. `seedMaxOrder` reports the actual reached depth. A finite candidate budget still makes each run incomplete; no finite run claims to enumerate infinitely many paths.

Every distinct verified success is retained separately from the 18-candidate adaptive refinement pool. Results are deduplicated only by exact shot settings, object order, and contact/rail signature; pagination must not discard the archive. Candidate budgets remain a finite compute safety boundary and are independent of how many results the UI displays.

## Parameters and results

- Horizontal aim: signed degrees in the table plane.
- Vertical elevation: fixed current value by default, or searched over a selected 0–80 degree range. A geometrically valid input can still be rejected by the physical world.
- Cue speed: 0.5–4.5 m/s, with selectable minimum and maximum.
- Tip X/Y: fractions of ball radius, under the existing playable radial limit.
- A larger search space with the same candidate budget can lower discovery rate. No route found is not a proof of impossibility.

## Primary references

- David G. Alciatore, *Pool and Billiards Physics*: https://drdavepoolinfo.com/physics_articles/Alciatore_pool_physics_article.pdf (ghost-ball geometry, stun/tangent relation, squirt and throw).
- David G. Alciatore, technical proofs: https://drdavepoolinfo.com/technical-proof/ (TP 3.2 ball speeds after stun impact; TP A.17 friction and throw; cue elevation and tip friction constraints).

These references motivate proposal geometry and limitations; the material parameters in this simulator are not claimed to be calibrated to any specific real table.

## Parallel execution

The orchestrator assigns method/order groups to workers first; workers assigned to the same group then take a deterministic strided subset of the candidate indices and an exact share of the original budget (including remainders). Each worker maintains an independent adaptive refinement pool. The same worker count and input remain deterministic; changing worker count can change the adaptive exploration and results. More workers can reduce elapsed time but do not promise reduced total CPU consumption.

## Mathematical inverse roots and physical residual solver

For a first object centre a, radius sum ρ and contact normal n(φ) = (cos φ, sin φ), the cue-ball centre at impact is g = a − ρ n. Reflect g across the requested prefix rails to get the incoming aim ray. Reflect the second object across the suffix rails to get q. In the ideal impact seed, with incoming unit direction d and κ = (1 + e) m₂ / (m₁ + m₂), the outgoing vector is v = d − κ(d·n)n. Solve F(φ) = cross₂(v, q − g) = 0, retaining only approaching contacts and forward outgoing rays.

The primary geometry has a closed-form solution in the ideal equal-mass elastic stun model. With w = q − a and L = |w| >= ρ, the two contact normals are n = −ρ w/L² ± sqrt(1 − ρ²/L²) perp(w)/L. These solve n·(q − g) = 0 without a root iteration. Incoming approach, outgoing direction and finite rail order are verified before proposing a cue angle. The formula is a derivation under the stated assumptions, not a claim that the cited sources print this exact expression. It does not uniquely determine cue speed or spin and is not exact for the simulator's nonideal contact model.

Secondary approximate correction includes restitution/mass in F(φ). This root finder uses 96 angular brackets and up to 48 bisections in a sign-changing bracket, with normalized directional residual below 10⁻⁷. It verifies the finite reflected rail sequences before accepting a seed. A tangent root without a sign change can be missed; these are not exhaustive roots. Friction, spin and cloth are not approximated as certified outcomes. Every seed still undergoes the actual physical simulation.

Local correction uses cue settings u = (horizontal angle, cue speed, tip X, tip Y), with elevation included only when the user enabled its allowed search range. Cue speed is NOT substituted for ball velocity: the actual compliant cue contact produces the ball's velocity and spin. The residual R(u) is the signed three-dimensional surface-clearance vector at the closest eligible target approach in the actual PhysicsLab trajectory. Target/contact topology changes make this residual non-smooth; probes that change the recorded topology are rejected rather than treated as a reliable derivative.

Finite-difference columns use ordinary full-resolution candidate evaluations at bounded perturbations h = (0.05°, 0.05 m/s, 0.025 radius, 0.025 radius), plus 1° for enabled nonzero-width elevation search. User speed/elevation bounds are applied to probes and steps; truncated probe differences are scaled by the actual perturbation. In normalized step coordinates, Jᵢ = [R(u + Δᵢeᵢ) − R(u)]hᵢ/Δᵢ. Solve (JᵀJ + λI)δ = −JᵀR and project each δᵢ into [−2, 2] before applying the physical input bounds. The initial damping is 10⁻⁴. An improved residual decreases damping; rejected/topology-changing steps increase damping and restart from another physically evaluated seed. No unvalidated step is a successful route. A rank-deficient Jacobian remains bounded by damping.

All derivative probes and correction steps consume the same candidate budget, interleaved with geometric exploration. The correction runs only when a suitable near-miss exists and sufficient candidates remain. Fixed candidate count is a finite runtime boundary, not a discrete full scan over the 4-D input space. Metadata includes solver probe/step counts, accepted/rejected corrections, physics steps, a partial/budget termination reason, and `globalOptimal: false` / `exhaustive: false`. Independent replay is the final validity test; small residual alone does not imply success or convergence to a global optimum.


## Cue feasibility and collision safeguards

The preflight uses actual finite-thickness shaft, neck, and tip shapes. Signed `contactShape` distances and continuous linear shape casts check the preparation-to-first-contact segment; they do not claim to cover subsequent compliant compression and flex. Only the intended tip/cue-ball contact is exempt, not shaft self-intersection or other balls and rails. The running physical simulation separately reports actual positive cue/obstacle contact impulses and rejects affected candidates before goal completion, including shaft/rail contacts hidden from the ball-only UI log.

If the user enabled elevation search, a bounded endpoint/midpoint and bracket refinement tries to restore geometric clearance within that allowed range. It retains a verified clear endpoint, not a proof of finding every non-monotone feasible interval. Fixed elevation is never silently widened. Clearance query counts are reported separately from counted full-physics candidates. Geometric feasibility is not the same as a successful target shot; a bounded failure is `not-found-within-budget`, never proof that the shot is impossible.

Model stages are deliberately separate: the ideal contact-circle inverse is closed-form under its assumptions; restitution root solving and actual-engine damped correction are iterative numerical fallbacks; the final shot is verified by the full physical model. This does not claim a one-shot exact inverse for all friction, spin, cue compliance, rails and arbitrary collisions.

Current candidate scheduling retains the current cue settings and nine legacy cut/speed proposals before inverse candidates for applicable paths. Closed-form contacts are first within the inverse candidate list, not yet the exclusive or first search stage. Cue speed and tip offsets still include sampled seeds; the full real-model cue input is not solved in one closed-form calculation.
