# Inverse contact-constraint release verification

This release changes the default search architecture. It does not claim a single
closed-form exact solution for all spin, friction, moving contacts, and cushions.
No automatic fallback to the historical sampled planner is used.

## Scope and physical constraints

- Discrete contact topology and inverse contact geometry initialize bounded cue
  inputs. Nonlinear event residuals solve those inputs, followed by a separate
  fresh physical replay before certification.
- Default domain: up to three cushions, one additional first-target kiss,
  sixteen seconds of physical verification. It is adjustable and finite.
- Direction, elevation, speed, radial tip constraints, actual cue geometry and
  full cue stroke checks remain authoritative.
- Four-ball target/opponent rules are unchanged. Opponent fouls are checked to
  full rest; ordinary post-goal kisses do not cancel the achieved goal.
- Time-sliced continuation preserves iterates and verified results. Empty or
  unconverged results are not impossibility proofs.

## Reproducible evidence

`tests/inverse-physical-pipeline.cjs` derives cue inputs from geometric roots,
executes the production solver with legacy proposal APIs disabled, separately
verifies them, and reproduces the resulting three-cushion/four-ball shot in an
uninstrumented PhysicsLab. No saved winning cue input is used to initialize it.
The selected-topology evidence is in `benchmarks/inverse-physical-evidence.json`;
it is component efficacy evidence, not a guarantee for every default layout.

`tests/inverse-events-corner.cjs` starts with a genuinely blocked corner pose and
requires clearance restoration and a verified single-target physical hit within
an allowed elevation range. It does not assert that every two-target corner shot
is solved. A restricted five-degree run must not be misreported as a proven
infeasible domain.

`tests/e2e/inverse-default.spec.cjs` exercises the actual default three-ball UI,
resumable solving, result preservation, application, and the live shot. The
four-ball public flow also requires an actual +1 live score. Browser tests keep
the official Chrome sandbox enabled.

Manual own-cloud Chrome checks found a default three-cushion solution without
selecting a topology, then applied and executed it. A default four-ball solve
continued across a time slice and scored +1 after live application. These are
functional cloud observations, not Samsung-device/GPU benchmarks or universal
speed claims. The shortest-geometric-first schedule was further stratified by
depth to avoid one shallow family monopolizing the active frontier.

## Remaining limits

- Finite topology domain and local numerical convergence remain explicit limits.
- A successful geometric root is only an initializer, never physical proof.
- Full-physics impact-time discontinuities can prevent convergence.
- Success/time/diversity are workload-dependent; this release makes no blanket
  speedup or complete-global-solution claim against the historical sampler.
- Actual Samsung hardware and its native GPU/touch performance remain untested.
