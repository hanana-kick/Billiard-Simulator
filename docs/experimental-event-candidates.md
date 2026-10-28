# Experimental event-driven candidate scheduler

## Status and deliberate separation

This is an **opt-in, prepared-post-strike scheduler proof**, not a production
backend. No UI, default physics, search scoring, or release selection changed.
There are two explicitly different profiles:

- `experimental-planar-coulomb-event-v1`: readable JS Number reference event
  core, ideal Coulomb sliding, independently specified rolling and spin drag,
  quadratic wall equations and relative-acceleration quartic ball equations.
- `experimental-planar-frictionless-linear-event-gpu-v1`: native f32 GPU proof
  with constant velocities, no cloth or angular state. One invocation owns all
  three/four balls and its event loop. This is **not** the Coulomb core on GPU.

Both have frictionless, instantaneous, equal-mass collision response with named
restitution. Neither reproduces Rapier cloth, contact persistence, sleeping,
mitred/nose/crown cushion geometry, tangential collision friction, cushion spin
transfer, airborne/landing events, or real compliant cue release. Neither
qualifies raw five-parameter shots. Existing direct raw pose/cue components remain
separate; no arbitrary assignment from raw shot parameters to ball velocity was
introduced. Genuine production 3D physics stays unchanged.

## Event algorithm implemented

1. Recompute every ball's current motion segment and its regime horizon.
2. Predict all sphere-pair and finite wall-face arrival times, bounded by the
   earliest regime change and the remaining observation budget.
3. Select the global earliest event, not one event per moving ball. Reject
   ambiguous grazing roots, simultaneous events and zero-time contacts rather
   than choose a physically unjustified order.
4. Advance **all** ball positions, velocities and spin to that same time using
   segment equations, then apply the selected transition or normal impulse.
5. Discard all old arrival times and repeat. A currently motionless ball with
   horizontal spin is not skipped: cloth friction may start its translation.

A wall is a radius-offset finite rectangle face. A plane intersection outside
that face's span is discarded before global selection. A true corner tie remains
unsupported. Rectangular faces are not a proxy for the actual game's convex rails.

No event within the budget returns `incomplete`, not MISS. Event/time budgets
also return `incomplete`. Rest returns `rest-unscored`; all outputs have no PASS
or MISS authority. A rule reducer and full-rest original-observable qualification
are still required. Prototype numerical rest thresholds are not Rapier sleep.
Optional CPU traces and GPU diagnostic state readback exist for these tests only;
normal GPU output is the compact status record, not a trajectory.

## Named equations and units

The prepared core uses **XY as the cloth plane and Z as its normal**. `p` and `v`
are two-dimensional; `w[2]` is normal spin. Original game coordinates are Y-up:
any future adapter must explicitly map both linear and axial vectors. Positions
are metres, velocities m/s, angular velocities rad/s; solid-sphere inertia is
`I = 2 m r² / 5`.

For slip `u = (vx - r wy, vy + r wx)`, sliding acceleration is
`a = -mu_s g u / |u|` and angular acceleration is
`alpha_xy = (5 ay / (2r), -5 ax / (2r))`. Thus `du/dt = 7a/2` and
`t_roll = 2 |u| / (7 mu_s g)`. Rolling acceleration is independently specified
`-rho v/|v|`, where **rho is m/s²**, not an original rolling-torque coefficient.
Rolling spin obeys `w_xy = (-vy/r, vx/r)`; its stop time is `|v|/rho`.
Independent normal-spin drag is `-sigma sign(wz)`, with sigma in rad/s².
Coincident transitions are conservatively unsupported in this first reference.

For a segment, `p(t) = p0 + v0 t + a t²/2`. A wall yields a quadratic. A pair
uses relative `p`, `v`, and `q = (a_j-a_i)/2`; the ascending quartic coefficients
are `[p·p - R², 2p·v, v·v + 2p·q, 2v·q, q·q]`.
Derivative roots partition monotone intervals; bounded bisection isolates roots.
This is polynomial root solving, **not uniform trajectory time stepping**.
Nonfinite arithmetic is rejected. This is not certified interval arithmetic;
close/ill-conditioned roots remain an explicit numerical qualification limit.

The collision impulse magnitude per unit mass is
`J = -(1+e) ((v_j-v_i)·n)/2`; apply `v_i -= Jn`, `v_j += Jn`.
A wall reverses/scales only its normal velocity. Collision spin is unchanged
**because collision friction is explicitly zero**, not because spin transfer has
been reproduced. Airborne, differing mass overrides and non-rectangle geometry
are rejected, not projected into the plane.

Equations were independently implemented, not imported as a pooltool engine.
Background checked against the author's [motion-law discussion](https://ekiefl.github.io/2020/04/24/pooltool-theory/)
and [event algorithm discussion](https://ekiefl.github.io/2020/12/20/pooltool-alg/).
The experimental profile deliberately differs from the existing source model;
see [source compatibility analysis](event-driven-source-compatibility.md).

## Small native evidence and reproducibility

`tests/direct-event-core.mjs` has 13 analytic/guard cases: moving pair, nearer
object, global advance, finite radius, stop before wall, transition before
collision, spin-stop, quartic roots/grazing, ambiguity/overlap/airborne rejection,
zero-speed horizontal spin, stale-TOI invalidation, face-list order and overflow.
`tests/direct-event-gpu.mjs` executes nine prepared candidates, including both
orders of the diagonal finite-face case, three-event recurrence, mixed outcomes,
mutation isolation and compact-only readback. CPU and GPU comparisons only cover
their **shared linear subset** (2e-4 absolute test tolerance).
The reference uses a 1e-8 base guard; native uses 1e-5. These rest/tie/root
thresholds differ deliberately and the comparison covers stable cases, not
threshold equivalence. Nonfinite inputs and duplicate/non-u32 candidate IDs are
rejected by the host boundary; the native kernel also guards finite body/shared
values and derived pair coefficients before producing a status.

Native receipt: [SwiftShader JSON](evidence/direct-event-linear-swiftshader.json).
3,680-byte WGSL; approximately 291 ms compile in this observation. Persistent
semantic storage is 96 bytes/candidate plus 32 shared bytes; output is 16 bytes
per candidate. These numbers exclude runtime/compiler allocations and staging
buffers and are **not full-shot memory or hardware performance claims**.
The explicit native domain is tables at most 100 m, radius at least 1e-4 m,
position/velocity magnitudes per component at most 100, and horizon at most
3,600 seconds. Native budget is 1–32 events; reference budget is 1–4,096.

```sh
node --test tests/direct-event-core.mjs tests/direct-event-gpu.mjs
REQUIRE_WEBGPU=1 \
GPU_NATIVE_MODULE=/tmp/billiard-gpu-tools-v3/node_modules/webgpu/index.js \
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json \
timeout 35s node --test tests/direct-event-core.mjs tests/direct-event-gpu.mjs
```

Both new modules are imported by their tests only. Full app/browser/release
qualification was not run or implied for this bounded opt-in checkpoint.
Required next gates: native Coulomb/quartic implementation, actual raw cue-release
join, realistic frictional/3D contact and landing resolution, rules through full
rest, original-physics observable comparisons, and hardware-scale qualification.
