# Event-based prediction: compatibility with the current source

This is source analysis only. No alternate cloth model, event-driven backend,
trajectory skipping, production selection, or PASS/MISS producer is enabled.

## What solving an event time means

An unknown arrival time can be solved from a collision equation without sampling
all intermediate times. For constant straight motion the first wall can instead
be selected by ray distance, before calculating time at all. This is genuinely
different from stepping a trajectory only when the state evolution used inside
the collision equation is independently valid. Hiding a full simulation inside a
root evaluator does not provide that advantage.

## Source boundaries

| Phase | Current source | Safe analytical opportunity / remaining obligation |
| --- | --- | --- |
| Raw shot → cue release | `physics.js:99-109,143-209`: pose, two dynamic cue bodies, real guide/flex joints, Kelvin–Voigt contact, shear memory/slip, lateral compliance | Pose is direct algebra. Ball release velocity/spin is **not** assigned from shot parameters; retain the short physical cue/contact solve. |
| Truly contact-free flight | `physics.js:83-89`: spheres have zero linear/angular damping; constructor supplies constant gravity | In the continuous model, `p=p0+v0*t+g*t*t/2`, `v=v0+g*t`; isotropic sphere spin is constant absent torque. Solve candidate plane/sphere events directly. This is not bit-identical to finite-step Rapier integration/CCD. |
| Real cushions | `physics.js:59-78`: mitred convex rails with nose/crown geometry | Four rectangular wall planes are insufficient in general. Hull faces, edges/corners and vertical geometry compete, particularly airborne. Shared actual hull vertices are already available for direct geometry work. |
| Cloth sliding/rolling/spinning | Native friction constraints plus `physics.js:213-233` angular patch resistance | Torque depends on solved manifold normal impulse, capped by `mass*gravity*h`, current tangential/normal angular speed, min clamps, normal orientation and vertical-velocity thresholds. A generic constant-acceleration rolling/sliding formula does **not** reproduce this source automatically. |
| Transition/rest/event bookkeeping | `physics.js:253-273` and native world | Earliest ball, wall, floor, cue, slip/rolling/stop and CCD events compete. Preserve contact order, warm impulses, sleep state, source time and rule history; no jump past a competing event. |

Even where an ideal isolated sliding sphere has an analytical slip-to-roll time,
that equation cannot silently replace the present rolling-resistance torque plus
constraint solver. Native contact caches and per-step angular resistance make
source equivalence a separate question. A certified rolling advance is future
work, not an established capability of this checkpoint.

## Compatible next design, without replacing the model

1. Retain direct native-f32 cue/contact solve to establish the post-contact state.
2. Use shared actual scene geometry to propose the earliest event, using closed
   forms only for a proved-valid phase (contact-free flight is the clean first
   example). Include competing objects, floor, phase changes and stop events.
3. Advance only when a bounded source-compatibility check establishes no hidden
   contact/CCD/phase change and acceptable observable error. Otherwise retain
   bounded physical integration or explicit unsupported status.
4. At the event, apply the original coupled contact response and chronology;
   do not substitute a billiards rebound-angle formula or external cloth model.
5. Keep event prediction distinct from verified search predicates. An estimated
   first wall/arrival state is not a full-shot success and not winner authority.

Current reusable work: raw pose/actual cue geometry, compact per-candidate cue
component, immutable original obstacle roster, conservative clearance diagnostic,
and source equations for direct contact/joint integration. Current missing work:
source-faithful joint/world recurrence, exact unresolved geometry/CCD, and proof
or explicit tolerance qualification for each proposed event advance. No pooltool
or other alternate physics has been imported or implemented.

## Later opt-in scheduler experiment

The above source-equivalence analysis still applies. A deliberately different,
prepared-state experimental profile is now implemented separately; see
[experimental event candidates](experimental-event-candidates.md). Its planar
Coulomb reference and smaller linear GPU proof do not establish original-source
parity or activate a production backend.
