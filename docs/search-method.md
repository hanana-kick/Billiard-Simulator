# Shot search model and limits

The default hybrid solver preserves geometric/adaptive proposal allocation, bounded physical validation, and numerical correction. An explicitly selected analytical-input mode additionally combines restricted ideal closed-form input estimates with labelled fallback. It is not one exact closed-form solution of the full physical model or a global optimum proof.

1. Reflect goal positions across cushion lines to propose possible rail sequences.
2. Solve ideal contact-circle geometry directly, then calculate eligible ideal cue speed and backspin inputs. Restitution-root and tangent iterations remain approximate fallback.
3. In analytical-input mode only, interleave analytical input estimates with sampled/adaptive fallback within the requested ranges; the default hybrid mode preserves its existing allocation.
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
- Vertical elevation: the application defaults to search over the engine-supported 0–85 degree range; a fixed current value is an explicit advanced choice. A geometrically valid input can still be rejected by the physical world.
- Cue speed: 0.5–4.5 m/s, with selectable minimum and maximum.
- Tip X/Y: fractions of ball radius, under the existing playable radial limit.
- A larger search space with the same candidate budget can lower discovery rate. No route found is not a proof of impossibility.

## Primary references

- David G. Alciatore, *Pool and Billiards Physics*: https://drdavepoolinfo.com/physics_articles/Alciatore_pool_physics_article.pdf (ghost-ball geometry, stun/tangent relation, squirt and throw).
- David G. Alciatore, technical proofs: https://drdavepoolinfo.com/technical-proof/ (TP 3.2 ball speeds after stun impact; TP A.17 friction and throw; cue elevation and tip friction constraints).

These references motivate proposal geometry and limitations; the material parameters in this simulator are not claimed to be calibrated to any specific real table.

## Parallel execution

The application now owns one deterministic staged coordinator. It retains the full per-method/per-order candidate budget and refinement state centrally; workers no longer own independent adaptive pools. A fixed wave proposes up to four independent exploration inputs per group, or one dependent restoration/DLS input. Every completed wave is committed in stable candidate-ID order before further feedback-dependent proposals are generated. Hardware concurrency changes execution throughput, not wave boundaries, input settings, canonical physics counters or successful result archives. DLS probes and steps retain their dependency barriers and are never split into smaller hardware-dependent budgets.

Every worker evaluates only an assigned immutable shot proposal in its own fresh PhysicsLab. It returns physical outcome and feasibility observations, not a serialized world or its own beam. The coordinator folds clearance observations and DLS invalidation in candidate order. A rejected clearance still consumes one candidate. Reserved candidates, committed candidates and completed-but-uncommitted wave evaluations are reported separately; verified successes already received remain visible if the user stops the search.

The legacy `partition` search API remains for compatibility and low-level tests, but is not the application scheduler. Its old independent-pool behavior can still differ by partition count; the worker-independent guarantee applies to the staged coordinator and its fixed plan version. More workers do not promise lower total CPU consumption; dependency barriers can temporarily leave allocated workers idle.

## Mathematical inverse roots and physical residual solver

For a first object centre a, radius sum ρ and contact normal n(φ) = (cos φ, sin φ), the cue-ball centre at impact is g = a − ρ n. Reflect g across the requested prefix rails to get the incoming aim ray. Reflect the second object across the suffix rails to get q. In the ideal impact seed, with incoming unit direction d and κ = (1 + e) m₂ / (m₁ + m₂), the outgoing vector is v = d − κ(d·n)n. Solve F(φ) = cross₂(v, q − g) = 0, retaining only approaching contacts and forward outgoing rays.

The primary geometry has a closed-form solution in the ideal equal-mass elastic stun model. With w = q − a and L = |w| >= ρ, the two contact normals are n = −ρ w/L² ± sqrt(1 − ρ²/L²) perp(w)/L. These solve n·(q − g) = 0 without a root iteration. Incoming approach, outgoing direction and finite rail order are verified before proposing a cue angle. The formula is a derivation under the stated assumptions, not a claim that the cited sources print this exact expression. It does not uniquely determine cue speed or spin and is not exact for the simulator's nonideal contact model.

Secondary approximate correction includes restitution/mass in F(φ). This root finder uses 96 angular brackets and up to 48 bisections in a sign-changing bracket, with normalized directional residual below 10⁻⁷. It verifies the finite reflected rail sequences before accepting a seed. A tangent root without a sign change can be missed; these are not exhaustive roots. Friction, spin and cloth are not approximated as certified outcomes. Every seed still undergoes the actual physical simulation.

Local correction uses cue settings u = (horizontal angle, cue speed, tip X, tip Y), with elevation included for the default search mode and omitted only for an explicit fixed choice. Cue speed is NOT substituted for ball velocity: the actual compliant cue contact produces the ball's velocity and spin. The residual R(u) is the signed three-dimensional surface-clearance vector at the closest eligible target approach in the actual PhysicsLab trajectory. Target/contact topology changes make this residual non-smooth; probes that change the recorded topology are rejected rather than treated as a reliable derivative.

Finite-difference columns use ordinary full-resolution candidate evaluations at bounded perturbations h = (0.05°, 0.05 m/s, 0.025 radius, 0.025 radius), plus 1° for enabled nonzero-width elevation search. User speed/elevation bounds are applied to probes and steps; truncated probe differences are scaled by the actual perturbation. In normalized step coordinates, Jᵢ = [R(u + Δᵢeᵢ) − R(u)]hᵢ/Δᵢ. Solve (JᵀJ + λI)δ = −JᵀR and project each δᵢ into [−2, 2] before applying the physical input bounds. The initial damping is 10⁻⁴. An improved residual decreases damping; rejected/topology-changing steps increase damping and restart from another physically evaluated seed. No unvalidated step is a successful route. A rank-deficient Jacobian remains bounded by damping.

All derivative probes and correction steps consume the same candidate budget, interleaved with geometric exploration. The correction runs only when a suitable near-miss exists and sufficient candidates remain. Fixed candidate count is a finite runtime boundary, not a discrete full scan over the 4-D input space. Metadata includes solver probe/step counts, accepted/rejected corrections, physics steps, a partial/budget termination reason, and `globalOptimal: false` / `exhaustive: false`. Independent replay is the final validity test; small residual alone does not imply success or convergence to a global optimum.


## Cue feasibility and collision safeguards

The preflight uses actual finite-thickness shaft, neck, and tip shapes. Signed `contactShape` distances and continuous linear shape casts check the preparation-to-first-contact segment; they do not claim to cover subsequent compliant compression and flex. Only the intended tip/cue-ball contact is exempt, not shaft self-intersection or other balls and rails. The running physical simulation separately reports actual positive cue/obstacle contact impulses and rejects affected candidates through cue separation, even after a goal latch, including shaft/rail contacts hidden from the ball-only UI log.

If the user enabled elevation search, a bounded endpoint/midpoint and bracket refinement tries to restore geometric clearance within that allowed range. It retains a verified clear endpoint, not a proof of finding every non-monotone feasible interval. Fixed elevation is never silently widened. Clearance query counts are reported separately from counted full-physics candidates. Geometric feasibility is not the same as a successful target shot; a bounded failure is `not-found-within-budget`, never proof that the shot is impossible.

Model stages are deliberately separate: the ideal contact-circle inverse is closed-form under its assumptions; restitution root solving and actual-engine damped correction are iterative numerical fallbacks; the final shot is verified by the full physical model. This does not claim a one-shot exact inverse for all friction, spin, cue compliance, rails and arbitrary collisions.

Both modes evaluate the explicit current cue settings first. Only the explicitly selected analytical-input mode then evaluates eligible closed-form cue-input estimates before legacy cut/speed proposals, with remaining analytical inputs interleaved with sampled/adaptive fallback. Each result records its generating stage. The complete real-model cue input is not solved in one exact closed-form calculation.

## Direct cue-input estimate (restricted ideal model)

For prefix-zero ideal stun contacts, the inverse now computes angle, cue speed and backspin tip offset together, without a parameter scan. This is exact algebra only within the stated ideal assumptions, not the compliant spring-tip, raised-cue or real-cushion model. A minimum target residual speed of 0.25 m/s and normalized tip-margin 0.4 choose one member of an underdetermined family; they are explicit seed policies, not user requirements or a global minimum-speed proof.

Let a be sliding deceleration, ar the ideal rolling deceleration, L the post-impact path length and λ = 1 − (d·n)². The post-stun sliding distance is 12 V²/(49a), followed by rolling at squared speed 25 V²/49. Invert either the sliding branch V² = vf² + 2aL or rolling branch V² = 49(vf² + 2arL)/(25 + 24ar/a), checking the branch condition. Set X = max(V²/λ, q·2aLbefore/(1−q)), q = (1−0.4)², then v0² = X + 2aLbefore. This margin bounds ideal required backspin without clipping the solved inputs. Recompute terminal speed after increasing X.

With t = 2Lbefore/(v0 + sqrt(X)), the initial backspin is −5at/(2R) times (up × ray), giving zero spin at the ideal first impact. From J = m v0 ray and angular impulse Lspin = Iω, derive rperp = (J × Lspin)/|J|² and the rear sphere contact r. Cue speed follows the ideal elastic guide-impulse effective-mass relation. Candidate speed or tip limits are checked, not clipped. Zero friction uses the constant-speed branch. Singular head-on stun and unsupported prefix routes return an explicit no-seed reason.

Cushion images do not correctly transport real spin, and raised-cue support and spring-tip compliance invalidate exact input prediction. Such seeds remain explicitly approximate and must pass the unchanged full physical replay. Existing sampled seeds and iterative numerical corrections are retained as labelled fallback. Current-input verification is separate from generated analytical candidates.

Goal verification now latches goal-time contacts/score and continues only any remaining cue-contact tail. Post-goal ball kisses do not cancel the goal; real cue obstruction still invalidates the shot. A cue remaining at the time horizon is incomplete verification, not a certified hit.

Primary background for ideal impact assumptions and cue offset/speed relations: https://drdavepoolinfo.com/technical_proofs/TP_3-1.pdf and https://drdavepoolinfo.com/technical_proofs/new/TP_A-30.pdf. The contact-circle and inverse branch equations here are derived for this implementation rather than quoted verbatim from those sources.

### Measured limited-budget comparison

The sequential comparison in `docs/benchmarks/ideal-inputs-48.json` uses the same frozen physical engine, 48 candidates per scenario and the tail-verified `bbf2a32` search baseline. For default/shifted/corner layouts, verified result counts were 3/0/41 before and 2/0/41 after; first success was candidate 11/none/1 both before and after. Analytical candidate attempts were 6/6/0. CPU milliseconds were 16954/13151/3502 versus 15649/13176/3427 in this cloud run. These are fixture observations, not population success rates, and CPU timing varies with system load. The analytical estimates did not improve coverage or solution yield in these cases and displaced one verified default-layout candidate. They must not be advertised as a proven search-quality or performance improvement. The corner fixture exercises elevation restoration on a single target and does not use the two-target analytical input model.

In explicitly selected analytical-input mode, one analytical candidate is tried after the explicit current input, then additional analytical candidates are interleaved every eight local candidate indices. Worker partitions use disjoint analytical ordinals. `analyticStats.evaluated` counts analytical candidate attempts (including possible geometric preflight rejection), not guaranteed successful physical trajectories. Result `searchModel.stage` distinguishes current input, analytical estimate, sampled/adaptive fallback and iterative physical correction. `modified` records subsequent elevation restoration or duplicate-input angle perturbation.

## Explicit input strategy and preservation regression

`inputStrategy: "hybrid"` is the default. The sequential low-level API preserves the tail-verified baseline candidate schedule, including geometric proposals and actual-engine numerical correction. The newer application staged scheduler changes feedback timing identically for every worker count; it does not claim to preserve the old sequential candidate sequence. `inputStrategy: "analytic"` is an explicit experimental choice to spend part of the same budget on the restricted ideal angle/speed/tip inverse above. It does not silently increase the candidate budget or replace the default search. The UI explains that its changed allocation can reduce the number of discovered results.

`docs/benchmarks/strategy-preservation-48.json` supersedes the forced-allocation experiment as the default-mode decision. With the same physical source and 48 candidates, current hybrid and baseline `bbf2a32` produced exactly matching input settings, contact events, residuals and success flags across all 48 evaluated candidates; all three baseline successes remain. Both first succeeded on candidate 11 after 71,622 physical steps. Analytical mode retained two successes and first succeeded on candidate 11 after 67,164 physical steps. Its six analytical inputs all hit the first object but none satisfied the complete three-cushion goal: five missed the eligible final contact, while one contacted the second object after only one cushion. Near-zero ideal geometric residual was not a real-model success. Actual pre-impact spin remained approximately 14–39 rad/s instead of the assumed zero. Changed adaptive-pool parents, rather than input duplication alone, explained the lost third success. No improved success rate or runtime is claimed.

The result UI distinguishes analytical estimates, current settings, fallback and numerical correction. Analytical diagnostics retain both ideal geometric residual and real physical residual, goal success and failure reason; a zero physical residual with insufficient cushions is still a failure. `firstSuccessCost` reports observed candidates, physical steps and elapsed time. The legacy partition merge reports worker-local cost; the staged scheduler reports global-plan candidate order and cumulative ordered physical work, independent of completion timing. Attempt counters can include preflight rejections; completed physical diagnostic rows are separate.

Reproduce the detailed default fixture with `node tools/analyze-inverse-candidates.cjs bbf2a32 hybrid`, `node tools/analyze-inverse-candidates.cjs current hybrid`, and `node tools/analyze-inverse-candidates.cjs current analytic`. The trace instruments observations without changing simulation inputs or outcomes. CPU and wall time remain load-dependent observations.

## Automatic worker allocation and complete result visibility

The basic game presets are three-ball / three-cushion, kisses allowed, any route and either object order; four-ball uses the two red balls with no cushion minimum. Resetting or switching the game restores these preset conditions.

Worker selection is automatic, ignoring the previous user `workers` preference. It uses all reported logical cores up to the finite useful candidate count, a defensive maximum of 64, and (when `deviceMemory` is exposed) a conservative half-memory budget estimated at 128 MiB per worker. The estimate is a guard, not measured allocation or guaranteed free memory. Missing hardware information defaults to two cores. Touch devices have no separate two-worker cap and a core is no longer artificially withheld. Metadata `workerPlan` exposes the limits, and `workerCount` reports actual allocation. With the staged scheduler, changing worker count alone does not change the candidate plan or yield; more workers do not imply less total CPU work.

The complete worker pool is constructed before posting any candidate. A construction failure terminates the partial pool and halves its size, down to one. Per-worker watchdogs require a first message within 45 seconds and subsequent progress within 30 seconds. Completed/cancelled tasks clear their timers; request epochs and candidate IDs reject stale or duplicate replies. If no worker can be constructed, or a worker errors/stalls, cooperative main-thread execution retains the same coordinator and completed envelopes, and retries only unresolved candidate IDs with exactly the same settings. Its bounded work slices use the same physical evaluator and the same wave commit order. It never restarts a differently allocated search.

`retryOverhead` records attempted evaluations and reported physical steps abandoned during recovery; `workAttemptTotal` adds these to canonical completed work. Unreported in-flight steps mean this is not an exact CPU-cost measure. Canonical tested/total, solver statistics and completion reason are unaffected by retries. A cooperative evaluation failure returns an error rather than claiming a completed search.

There is no top-two result cap in core, family aggregation or worker merging. The 18-entry adaptive refinement pool is separate from the complete verified-success archive. `resultLimit: null` and `resultCount` distinguish actual available unique candidates from attempted/verified counts. Identity includes both object IDs, all shot inputs and ordered goal-time contact/rail signatures. The same geometric path with different angle, speed, tip or elevation remains a distinct candidate; only exact identities are deduplicated. UI pagination must keep every archived candidate reachable.

## Staged worker invariance regression

`tests/deterministic-workers.cjs` runs the actual worker script and Rapier in separate Node worker threads at 1, 2, 4 and 9 workers, using the same default three-cushion snapshot and 48-candidate budget. It asserts exact equality of proposal settings/stages, successful settings and contact traces, solver/feasibility counters, analytical diagnostics, physical steps and first-success candidate cost (excluding wall time). A worker failure during DLS must recover to the same canonical outputs. A winning candidate is replayed independently in a fresh physical world, and the source world must remain unchanged. This is one fixture, not proof for every possible table state or cross-browser floating-point implementation.

The first measured run produced four verified candidates at every worker count, five DLS probes, one accepted numerical step and 352,867 physical steps. Wall times were approximately 14.51/8.77/6.00/4.53 seconds at 1/2/4/9 workers on this cloud host, with no cooperative fallback. These observations are not a broad speedup guarantee. The prior forced-analytical and sequential preservation benchmarks above remain historical comparisons, not measurements of this new fixed-wave scheduler.

The repeated run with process CPU measurement is recorded in `docs/benchmarks/staged-workers-48.json`: 1/2/4/9 workers used approximately 16.72/17.37/18.72/23.12 CPU seconds while wall times were 14.61/8.88/5.44/4.68 seconds. Parallelism reduced wait time in this fixture but increased total CPU use.

The final evaluator constructs only evaluation state, not a new proposal sampler for each shot. Coordinator initialization took 0.11–0.62 ms and the largest synchronous planning wave 4.34–12.10 ms in this Node run. These are planner measurements, not browser input-latency measurements. The full test command runs the actual high-worker-count integration after the standard suite to avoid overlapping heavy suites; this scheduling change does not establish a measured per-worker memory limit.

## Full-angle defaults and four-ball safeguards

The application now defaults to elevation search over 0–85 degrees and a full 360-degree horizontal domain. 85 degrees is the existing PhysicsLab input acceptance bound, not a claim about an absolute physical limit. Explicit fixed elevation and narrower user bounds are still respected. Every eighth exploration position schedules an independent full-direction low-discrepancy proposal; both elevation endpoints are included. Geometric seeds use continuous low-discrepancy elevation inputs biased toward the lower end, not a finite set of elevation presets. Local physical refinement, current-input verification and analytical-input estimates retain their own elevation rather than silently changing an unrelated coordinate. DLS still optimizes elevation within the allowed bounds. This remains bounded search in a continuous domain, not enumeration or a proof of all possible solutions.

Four-ball requests carry the game mode, the opponent cue-ball ID and an optional three-cushion condition independently of kiss permission. The two red targets must be distinct from both cue balls. Opponent cue-ball impact invalidates the candidate even when kisses are allowed. A goal is latched at the second distinct red; optional three cushions must already have occurred by that point. Later cushions cannot repair a failed goal. Unlike the ordinary post-goal kiss cutoff, opponent contact remains monitored until the complete shot settles. A moving ball or attached cue at the time horizon leaves verification incomplete and cannot produce a certified success. The game scorer freezes the same optional condition at shot start and preserves it in undo snapshots. No body's motion is altered to satisfy a rule.

The same 48-candidate three-ball fixture yielded two verified full-angle results, versus four with explicitly fixed 8° elevation. Full-angle runs at one and four workers agreed on all candidate inputs/outcomes and 333,243 physical steps; thirteen topology-checked probes produced no completed DLS update in this particular request. Trying a 0.1° elevation difference instead of 1° did not change that outcome, so the prior 1° difference is retained. The full angular domain is a capability, not a claim of improved small-budget success yield. The default four-ball layout produced two successes at 48 and seven at 128 in the measured run; a selected candidate was independently replayed through full sleep and scored +1 by FourBallGame. See `docs/benchmarks/full-angle-four-ball.json` for the exact measurement scope.
