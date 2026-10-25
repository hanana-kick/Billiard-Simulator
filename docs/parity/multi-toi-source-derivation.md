# Source-derived constructor corner candidate

This preregistered candidate is a discovery fixture, not an independent holdout.
No execution result is claimed here. Source frozen at commit 20b94dd.

Use original constructor layout, angle 12.905686665770533 degrees,
elevation 35, tipX .25, tipY 0, speed 10. No placements, no setters, no material,
clearance, maxCCD4, or cue subdivision changes.

Pinned source `sweeps.rs` queries a bullet against the complete fat-BVH-qualified
fixed-target set. For solid targets the acceptance test is strictly
0 < fraction < current bound. A cast later in traversal can be separated at a
reduced bound despite having a positive TOI at the initial bound of 1. Thus
capture original visited/cast identities and replay those exact query inputs
with max_fraction 1 using the independently unmodified original probe; do not
mistake multiple accepted shrinking-bound hits for the complete candidate set.

At unchanged e35 h389 pre, displacement from constructor center is
D=(2.046649158000946, .10292168706655502) in x/z and current velocity is
V=(9.787644386291504, .6060642004013062). The prior measured right-cushion TOI
.0004171431646682322 gives contact center x=1.3907319807288472. The identical
source cushion profiles and half-width minus half-depth .71 give candidate
front contact z=.6807319807288472 at the same height. The target displacement
is (2.050732006954891, .5807319792387311).

Use the observed h380–388 velocity difference over eight dt to estimate planar
acceleration A=(-1.6799925881628088, 1.0152196354676972). Solve
length(D+V*t+.5*A*t*t)=length(target), giving t=.008382308820502532,
8.04701604799784 dt after h389 pre. Rotate the predicted displacement onto the
target: yaw=atan2(target.z,target.x)-atan2(predicted.z,predicted.x), giving
12.905686665770533 degrees. Planar covariance and the acceleration estimate are
candidate derivation only, never substituted for original recurrence.

Before execution, fix seven observations h394–400, in order
397,396,398,395,399,394,400. Stop at the first original phase/body with at least
two full-bound strict-positive source-qualified fixed-target casts. Preserve
original before-strike/created snapshots and every original frame through h400.
Native diagnostics start independently from these original boundaries and do
not feed later original states.
