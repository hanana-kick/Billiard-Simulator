# Shot search model and limits

The solver is a bounded numerical search, not a closed-form solution or a global optimum proof.

1. Reflect goal positions across cushion lines to propose possible rail sequences.
2. Reverse from the outgoing goal ray to a cue/object contact circle. Tangent-contact iterations account for the outgoing ray starting at the contact position, not the object centre. Existing broad cut-angle seeds remain available.
3. Sample cue speed, contact point, and optionally vertical cue elevation within the requested ranges.
4. Evaluate every candidate in a fresh copy of the actual full-resolution Rapier world with the same cue/contact/cloth model as live shots.
5. Refine physically evaluated near misses. Rank only verified successes.

Tangent constructions are only proposal heuristics. The ideal tangent-line relation assumes a stun collision. Rolling/sliding transitions, spin, frictional throw, inelastic cushions, elevation, and multiple moving contacts mean that solving one geometric angle does not solve the full shot. No analytical prediction replaces actual collision integration.

## Moving-target option

With “allow moving targets” off, a candidate is rejected if the cue ball contacts an object that, before the current physics step, has speed over 0.01 m/s or has moved over 0.001 m from its starting position. The pre-step measurement avoids confusing the impact's own outgoing velocity with prior motion. Prior displacement also rejects a ball that moved and came to rest during the shot. Thresholds suppress resting-contact numerical noise. At most one full simulation timestep of classification uncertainty remains (normally 1/960 s).

All balls continue moving normally in the simulated world. This is a route filter, not a frozen-object physics mode. The policy is conservatively evaluated for every cue/object contact needed by the candidate.

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

A partition takes a deterministic strided subset of the candidate indices and an exact share of the original budget (including remainders). Each worker maintains an independent adaptive refinement pool. The same worker count and input remain deterministic; changing worker count can change the adaptive exploration and results. More workers can reduce elapsed time but do not promise reduced total CPU consumption.
