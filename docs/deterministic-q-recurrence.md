# Bounded resident q-event recurrence

This opt-in GPU-canonical checkpoint connects the prepared initial axial
pair/cloth impact to repeated landing and supported regime responses, ending
at actual all-ball rest when the bounded scene permits. CPU and GPU use the
same integer rules. No default application, raw strike or scoring behavior is
changed. Wider contacts remain explicitly pending, not misses.

## Event equations, not threshold stopping

The driver alternates two 640-byte q-state buffers. Each response uses the
existing global upper-bracket clock and advances every sphere consistently.
Landing, slip-zero, tangential-q-zero and rolling-stop are handled; ambiguous
or unsupported pair/static contacts stop with a non-result.

Supported scalar response velocities are evaluated at their **rational event
time**, using bounded u64/u32 arithmetic from the retained segment anchor:

- Slip: tau=−(v0+q0)/(a+qRate), v*=v0+a*tau, q*=−v*.
- Tangential q-stop: tau=−q0/qRate, v*=v0+a*tau, q*=0.
- Rolling stop: v*=q*=0 and x*=x0+v0*abs(v0)/(2*abs(a)).

Thus a rolling sphere does not reverse during the final bracket. These are
rounded event equations, not arbitrary velocity clamps. Positions other than
rolling stopping position retain the common upper-time observation convention.
Explicit position/v/q differences from that representative state are recorded
and checked against caller budgets. Fresh force coefficients are recomputed.
Non-event supported spheres must retain their slip/q/rolling signs after
packing; rounding into an unhandled boundary returns unsupported.

Rebased flight is no longer restricted to starting at zero gap. The exact
encoded quadratic sign is evaluated with two-word unsigned integers. The
admitted domain is gap in [0,1/8] m, |vy|<=1 m/s, 0<g<=16 m/s² and elapsed
at most 65,535 Q20 ticks. Within these bounds the positive terms fit u64
(height<=2^62, velocity term<2^61, gravity term<2^60). Concavity gives one
positive descending root; zero-gap flight must initially separate upward.
Bisection is over this exact sign, not sampled trajectory marching or a
rounded-value monotonicity assumption.

### Landing refinement needed for real recurrence

Using upper-tick vy repeatedly can create an artificial tiny bounce cycle.
The landing handler now uses the root speed
`vy* = -floor_sqrt(vy0² + 2*g*gap)` in encoded velocity units. Zero-gap flight
therefore returns exactly −vy0 before restitution. The integer square-root
error is less than one velocity quantum. The same explicit cloth restitution
and real-arm friction response then applies. Small rebounds decay through
normal quantization; there is no velocity epsilon or forced rest threshold.
The correction from upper-time vy is recorded in q-header word15 and checked
against the recurrence state-correction budget.

## Bounds, completion and accounting

`maxEvents` (1–128) bounds **response/observation attempts**, not only physical
impacts. Observation windows are required when the current fixed-width time
horizon ends before the next physical boundary. They are at most 65,535 ticks
(~62.5 ms), not a collision-detection timestep. Their count is separately
reported; no claim is made that this bounded ABI already jumps arbitrarily
long rolling intervals in one operation.

Hard node budgets remain per query; total query work is bounded by the attempt
budget. Exhaustion returns status5/incomplete, never rest or miss. Status3/rest
requires EVERY sphere supported, mode0, and all v/q components exactly zero.
An airborne apex with vy0 is not rest. Positive encoded rebound remains flight.

Default correction budgets are 64 position quanta and 256 velocity/q quanta;
they are numerical-domain caps, not a physical acceptance criterion. Every
reanchor also incurs the ordinary evaluation roundoff (less than 2 position
quanta, less than 1 velocity and q quantum per component), separately from
explicit event conditioning. Recomputed force coefficients have their stated
integer rounding. The sum of local rounding counts is NOT asserted to be a
certified global trajectory error bound or partition-independent representation.

The compact 16-word statistics row records:
0 version;1 attempted responses/windows;2 observation windows;3 rolling stops;
4 landings;5 slip boundaries;6 q-stops;7 interval nodes;8 terminal status;
9 current global tick;10 completed rebases;11–13 summed absolute explicit
position/v/q corrections;14 maximum v/q correction;15 maximum position
correction. Attempts may fail; only completed rebases contribute correction
sums. The original initial-pair stage has its existing separate component tests.

GPU buffers remain resident across every copy/dispatch. All budget slots are
encoded up front, so terminal candidates still occupy no-op invocations in
later slots. There is one final readback and no host-dependent physics branch.
This first bounded driver intentionally exposes that overhead rather than
claiming an optimized scheduler.

## Verification

`npm run test:deterministic-event`:27/27 native tests pass in 11.13 s.
Across 140 candidate/material/budget combinations, all 24,640 state/stat words
match exactly. With 80 attempts, both e=0 and e=.2 reach rest in 33/35 cases;
the remaining prepared candidates remain unsupported. Budgets 2 and elastic
budget 8 yield no false rest.

A representative e=0 run uses 59 attempts: 51 observation windows, 1 landing,
3 slip transitions,1 q-stop and3 rolling stops. For e=.2 there are 67 attempts,
including 9 landings and the same 51 observation windows. All three spheres
finish with zero v/q on the cloth. Independent tests inspect intermediate
anchors against rational event velocities, stopping distance and energy, and
verify strict correction-budget refusal.

The 35-row GPU allocation is 121,504 bytes. With 80 attempts there are 406
dispatches and 80 resident copies, zero intermediate readbacks. Compile took
2.33 s; the two 80-attempt submissions took 30.9/62.0 ms on SwiftShader versus
24.2/32.1 ms for the CPU mirrors. **No GPU speedup is claimed**: the current
software GPU and deliberately fixed dispatch budget have real overhead.
See `evidence/deterministic-q-recurrence.json`.

Next missing integration is subsequent pair/contact response beyond the first
validated initial impact, especially non-collinear or airborne pair geometry.
General cushions, arbitrary 3D spin, raw anisotropic cue solve, game event
journaling and full-shot success/failure authority remain outside this slice.

## Subsequent pair integration

[Supported subsequent-pair recurrence](deterministic-q-pair-recurrence.md)
now adds the existing coupled contact solver to this loop. Statistics version
0x51520302 extends the former16-word layout to24 words; the measurements above
are the prior246f65b checkpoint, not current expanded dispatch costs.
