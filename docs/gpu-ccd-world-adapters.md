# Transactional internal CCD passes

These opt-in adapters separate one application/world step from Rapier's internal
CCD passes. They do not find a TOI, clamp a body, complete a world controller, or
establish active-CCD GPU parity by themselves. Existing single-pass entry points
and inactive-CCD admission remain unchanged.

The source is Rapier `b716d375efc0201003f0cd9ef7168eee0b62c177`,
`pipeline/physics_pipeline/substep.rs:447–665` and `solve.rs:112–155,163–405`.
Applicable licenses remain in `vendor/RAPIER-LICENSE.txt` and the existing
glam/libm notices. No numerical solver graph is changed by this adapter.

## Three separate clocks

- Application `h` is the original JS double passed once to application laws.
- Collision `dt` is the full native-f32 world-step duration for initial narrow
  phase, then the duration of the immediately preceding internal pass.
- Solve `dt` is selected after that collision phase using the remaining time and
  the source TOI splitter. It can differ from collision `dt`.

The CCD query's remaining-time argument is also distinct from the preceding
integration parameters' `dt` (`ccd_solver.rs:108–141`). The final moved-collider
prediction uses full outer parameters; intermediate prediction uses the pass
parameters. These admitted sphere proxies have zero soft-CCD prediction, but a
controller must not generalize that simplification to other proxy domains.

## Current pass capability

`experimental-ccd-pass-authority.js` exports `createAuthority(backend)`,
`assertOuter(capability, backend)`, and
`assertPass(capability, backend, outerCapability)`.

After claiming one private token, the authority accepts:

1. `beginOuter({dt,minCcdDt,maxCcdSubsteps:4}, token)` returns an opaque outer
   capability. These parameters originate in the initial native configuration.
2. `selectPass({firstImpact,selection}, token)` accepts the owner's own source
   query result and numerical schedule output. `selection` includes `dt`,
   `remainingTime`, and `remainingSubsteps`. The authority verifies exact source
   f32 scheduling and returns a current opaque pass capability.
3. `advanceInternalPass(pass, token)` invalidates that pass and enables the next
   selection, but only after all stage advances below have succeeded.
4. `assertPrepared(pass, token)` and `commit(pass, token)` accept only the final
   pass. `abort(token)` invalidates the entire outer transaction and every issued
   pass. Commit the authority last.

A capability validates source timing, origin, backend, and transaction lifetime.
It does not certify that arbitrary caller code obtained its TOI on a GPU. The
world integration must own those inputs and independently replay the trajectory.
Cloned, expired, cross-outer, and wrong-backend capabilities reject.

## Stateful stages

Prepared floor, pair, cushion, Scene, and contact-journal stages add:

- `beginOuter(outerCapability, token)` while idle and leased.
- `workingSnapshot(token)` for owner-only speculative state. Public `snapshot`
  remains at the prior committed state throughout the outer transaction.
- `advanceInternalPass(passCapability, token)` for a completed nonfinal pass.
- `assertOuterPrepared(passCapability, token)` followed by
  `commitOuter(passCapability, token)` only for the final pass.
- `abort(token)` restores the pre-outer caches/graph/manager and invalidates all
  staged receipts and projections. Existing `commit(token)` rejects inside an
  active outer transaction.

The journal's first bounded outer mode requires that the live cue has already
retired and initial collider insertion is complete. Journal sequence advances
per internal graph pass, not per application/world step; graph revision still
changes only for actual topology changes. The external world clock must not be
derived from this internal receipt sequence.

After a pass, first seal the journal and synchronize every bound numerical
phase. Preflight all participants. Advance numerical phases and Scene, then the
journal, then the authority. Every phase thereby sees the exact new private
graph head on its next preparation. A later failure restores the complete outer
transaction, not just the last pass.

### Collision before solver time selection

Floor `solvePrepared(admission, token, passCapability)` and pair/cushion
`solvePrepared(flatOrFlats, token, passCapability)` preserve geometry, body and
cache inputs. Only the current capability may change collision `dt` to solve
`dt`. The execution label is `source-selected-pass`, never a manufactured
`source-prediction-inactive` label. Floor `discardPrepared(token)` discards only
that pass's geometry when a coupled phase takes ownership, without aborting the
outer transaction. Sleeping floor commits accept the same optional pass argument.

Scene drains user changes once with `beginFrame`. It then calls
`applyCollisionOperations(operations, token)` before the splitter so real wake
effects and active order are visible. Each pass calls
`observe(inputs, {dt:solveDt,lengthUnit,connectivity,ccdPass}, [], token)`.
Internal advance does not repeat API queue processing or modification epochs.
`postApplication` and final publication are allowed once, after the final pass.

The controller must collect collision events in internal source order and drain
them once at application time `time+h`, using final poses/velocities. Original
angular resistance runs once with application `h` and the final point reporting
impulses, not an invented sum over CCD passes. Restore the flat configuration's
outer `dt` before that application boundary. Actual post-solve clamping, if any,
must precede body/collider propagation and subsequent narrow phase.

## Verification boundary

Thirty-one lightweight Node tests pass: new authority, journal, numerical and Scene
transaction tests plus the existing journal freshness regression. They cover
variable solver timing after frozen geometry, single-pass equivalence, source
queue/epoch isolation, sleep/wake manager recurrence, whole-outer rollback,
stale/clone/retry rejection, backend checks, and delayed browser loading.
These are synthetic component tests. They are not a native differential replay,
actual WGSL test, or complete active-CCD world result. Existing native/GPU
regressions and the composed world trajectory must be rerun after integration.
