# Finite-time rolling companion

`deterministic-rolling-partial.mjs` evaluates the same supported rolling family as the full-tail fast path at a caller-selected common time. It is a **motion descriptor**, not an event selector or collision-clearance certificate. It enables other bodies to remain in smooth/slip modes on the same clock without advancing rolling bodies prematurely to rest.

## Contract

Input is the existing rolling32 body ABI; `runRollingPartialCPU(rows,h)` and GPU `.run(rows,h)` accept 1–4 bodies and integer Q20 `h` in [0,64 seconds]. Position stays component-bounded by4m. Shared `deterministic-state-domain.mjs` supplies exact Q48 norm admission **|v|≤8 and |q|≤16**, used by both the full tail's host validation and this companion's WGSL. Tangent spin must be exactly linked (`qx=vz,qz=-vx`). Normal spin remains independent. K/S, radius, incoming persistent joint radius and caller diagnostic budgets are unchanged. Neither API silently substitutes a smooth tube for an already-supported rolling family.

A finite zero-K query is constant motion, whereas a full tail with nonzero motion/zero drag remains incomplete. Similarly zero-S retains normal spin in a partial query. There is no clipping to make a state fit the domain. Position overflow or exhausted integer arithmetic returns incomplete with descriptor-valid0.

## Analytic interval evaluation

For `s=|v|`, `a=2K/7`, stop is `7s/(2K)`. Before stop:

- `v(h)=v*(1-2Kh/(7s))`
- `p(h)=p0+v*h*(1-Kh/(7s))`

After stop, displacement is `7*v*s/(4K)` and tangent v/q are zero. Q24 s has exact outward floor/ceil square-root bounds. Wide multiplication and directed division enclose Kh, the dimensionless factors and the final products. The public stop bracket uses directed Q20 bounds. `NONE` means that bound is beyond this module's64s domain or the drag is zero; it never means an immediate stop. A query straddling the stop uncertainty takes the union of the pre-stop extension and stopped endpoint. Endpoint monotonicity gives the full-prefix XZ box without time sampling.

Nominal position/velocity are interval midpoints. Packed q is reconstructed exactly from the chosen velocity. Per-axis packing errors are explicit. A conservative kinetic packing radius `2*ceilNorm(vErrorXZ)` exceeds `sqrt(7/5)*norm(vErrorXZ)` for linked rolling q. The receipt retains incoming rho and adds this packing radius; position error retains incoming position error plus `ceil(h*rhoIncoming)` and position packing. Normal spin uses signed clamp of the exact original drag, with at most one additional Q24 quantum for packing (zero when h or S is zero).

Strict caller-budget diagnostics are independent of descriptor acceptance. A descriptor may be nominally usable while strict budgets are exceeded. Nominal zero v is not certified true rest of the family. Incoming uncertainty is not reset. The output carries all source bytes and does not certify that previous responses propagated a global physical enclosure.

## Resident composition

Exports:
- `runRollingPartialCPU(rows,h)` → `{output,collisionClear:false,physicalRestCertified:false}`
- `createRollingPartialGPU(device)` → `.run(rows,h)`
- `ROLLING_PARTIAL_HELPER_WGSL` defines `rollingPartial(x:array<i32,32>,h:u32)->array<u32,128>`.

The helper requires `CONTACT_MATH_WGSL` and `CANONICAL_STATE_DOMAIN_WGSL` exactly once. A trusted resident producer must enforce the full rolling32 material, budget, support, mode and range contract just as host validation does. The helper checks the velocity/spin linked domain and h again, but does not authenticate arbitrary proof bytes or recover scene support. One standalone dispatch has no intermediate readback/per-candidate host physics.

Output128/body:
`0 id,1 status(1descriptor/5incomplete),2 reason,3 version,4 h,5/6 stop lower/upper,7 nominal tangent mode,8/9 authority0,10 strict-budget flag,11 descriptor-valid,12/13 normal-spin stop lower/upper`;
`16..22 [px,pz,vx,vz,qx,qz,qy]`, `24..30 corresponding errors`;
`32..35 endpoint XZ intervals`, `36..39 endpoint velocity XZ intervals`, `40..43 whole-prefix XZ box`;
`48 incoming rho,49 endpoint rho,50 packing rho,51 h*rho position growth,52/53 position packing errors,54/55 velocity packing errors`;
`96..127 complete source body`.

Whole-prefix boxes are nominal reference bounds. Collision queries must inflate them by the retained position/error descriptor when asserting strict-family clearance. Neither nominal nor strict collision clearance is provided by this helper. Do not feed them into an uninflated exact-polynomial selector.

Tests compare independent double analytic solutions at arbitrary azimuths and stop boundaries, full-prefix containment at independently chosen reference times, zero drag, one-quantum states, exact v8/q16 domain edges, finite long clocks, persistent errors and original bytes. CPU/GPU all-word parity is required separately.

Independent bounded replay: seed `0x71a2c39d`, 10,000 cases, 9,894 accepted in-domain endpoints all enclosed by the intervals against independent analytic formulas; replay kept outside the worktree (`/tmp/rolling-partial-audit.mjs`), not added as an unbounded routine fuzz job.

Native checkpoint: partial suite3/3 with55 cases/7,040 exact CPU/GPU words, compile0.611s. Combined with the shared-domain full-tail regression:9/9 tests, no skips,1.769s total. Full-tail regression24 cases/6,528 words exact, compile0.370s. Shared domain prerequisite is commit295008f. Dedicated independent reviewer was unavailable at this checkpoint because all agent slots were occupied; independent analytic test/replay evidence is not presented as a separate reviewer sign-off.
