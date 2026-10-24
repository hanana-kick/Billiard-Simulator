# Contact-constrained inverse solver

This is a replacement default orchestration, not a renamed 48/128/320-candidate
sampler. The historical sampler remains for regression comparisons only. The
application selects `searchAlgorithm: inverse-constraints`; neither worker
execution nor cooperative recovery calls its proposal or adaptive-pool API.

## Problem domain

A problem fixes the initial physical snapshot and rules, and enumerates discrete
contact sequences: target order, exact rail words before/after the first object,
and bounded repeated first-object contacts when kisses are permitted. The user
explicitly selects maximum cushion and additional-kiss counts and a physical
shot horizon. Defaults are three cushions, one additional first-object kiss,
and a 16-second physical horizon. This finite domain is not every possible physical path. Increasing
its depth adds discrete constraint problems, not angle/speed grid samples.

Each branch's initial contact normal is obtained from the inverse reflection and
contact equations. Restricted inelastic normal transfer gives
`v_out = v_in - kappa * dot(v_in,n) * n`. Requiring this direction to reach the
unfolded final contact gives a scalar cross-product equation in the contact angle.
The half-angle substitution produces a polynomial of degree at most four;
derivative-root interval partitioning retains tangent and narrow paired roots.
The two half-angle charts cover the full circle. This solves that restricted
geometry, not spin/cloth/cushion dynamics. Energy-derived cue seeds are explicitly
approximate. Where that full contact equation has no usable root, exact-prefix
first-contact inversion initializes staged continuation, without inventing a
complete-shot solution or scanning alternative cue inputs.

## Actual-physics nonlinear solve

The unknown vector is horizontal direction, elevation, cue speed and two tip
offsets. Input bounds, radial tip limits and signed cue clearance are constraints.
For each iterate, an independent unchanged PhysicsLab observes the currently
reachable contact stage's signed three-dimensional surface miss. Subsequent
unreached stages remain unavailable. Contact-prefix changes start a new stage;
Jacobian probes from different stages are not subtracted as if continuous.

The local numerical step minimizes a damped Gauss–Newton residual model while
respecting linearized physical inequalities, box bounds and a trust region.
Raw clearance gradients remain available even at feasible iterates; a feasible
active-set quadratic subproblem and fraction-to-boundary control prevent the
solver from treating a satisfied obstacle constraint as having zero derivative.
When local Gauss–Newton fails at blocked cue clearance with a flat gradient,
a separate signed-clearance root brackets the allowed elevation interval and
bisects a blocked/clear pair. Other cue inputs stay fixed during this feasibility
restoration. These fresh-world geometric queries never strike or certify a shot;
the recovered pose must return to full physical evaluation and independent replay.
A blocked upper endpoint is not an infeasibility proof or a reason to widen bounds.

A failed local solve is `unconverged`, never a proof that the physical shot is
impossible. Numerical iteration limits govern convergence of one branch, not a
quota of sampled candidate shots. Branch iterates remain available to continue.

No residual convergence alone enters the result list. The solver requests a
separate fresh-world replay. Exact contact topology, authoritative goal rules,
cue stroke obstruction and all applicable four-ball full-shot checks must pass.
A four-ball opponent contact after the second red still invalidates that shot;
ordinary post-goal kisses do not undo a completed goal.

## Scheduling and limits

A deterministic work-quantum-fair depth × method × target-order stream schedules geometric branches by
distance lower bounds within each depth. Classification checkpoints also rotate
to the next stratum, so a large rootless region cannot monopolize planning. This is not globally shortest-first
across all depths, and no branch is dropped. A deterministic four-branch frontier
schedules independent derivative probes
on the existing bounded worker pool. Worker count changes evaluation throughput,
not the dependency graph or results of identical completed waves. A fixed wall-time
slice can complete different numbers of waves on different hardware, so it does
not promise identical result sets at the deadline. Cooperative recovery runs the same inverse evaluator;
it does not fall back to the legacy search. A wall-time slice pauses at a wave
boundary and preserves state. Changed layout or settings invalidate continuation.

`verified`, `unconverged`, `unsupported` and proven local-domain `infeasible`
are separate statuses. Empty results are not a no-solution proof. Unvisited
branches and out-of-domain sequences are not tested. This implementation is not
a single closed-form solution of full spin/friction/multiple-contact physics,
a global optimum proof, or a guarantee of real-table accuracy.

Release efficacy requires actual new-solver physical solves and independent
replays. Historical sampled-planner benchmark gains do not validate this solver.
