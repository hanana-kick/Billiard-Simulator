# Canonical rolling-to-rest clear tail

`deterministic-rolling-tail.mjs` is an opt-in **canonical numerical** fast path for a complete roster of 1–4 supported rolling/rest balls. It does not alter runtime defaults, re-derive forces, solve contact, or certify physical rest of an incoming uncertainty family.

## Authority and geometry

The caller supplies the reviewed rolling family with the original encoded rolling drag `K` and normal-spin drag `S`. Tangent `q=(vz,-vx)` is checked exactly; rest mode requires zero tangent velocity/spin. Mode does not suppress normal spin. The support plane is immutable finite cloth. Inputs from generic sliding/flight or a smooth tube cannot silently be reinterpreted as this family.

For speed `s=|v|`, the family has acceleration magnitude `2K/7`, stop time `7s/(2K)`, and displacement `7 v s/(4K)`. Normal spin stops at `|qy|/S`. Each body follows a monotone straight segment until its own stop and remains there. Every body is advanced to the **maximum** tangent/normal-spin stop time only after the entire nominal tail is proved clear. No fixed-rate stepping is used.

An outward integer square-root interval encloses `s`. Directed wide multiply/divide bounds both displacement components and upper stop time. The canonical endpoint is the midpoint of its displacement interval. Its packing error is explicit; the whole reference segment and the packed endpoint lie in the swept axis-aligned box.

The once-only scene packer validates all four canonical finite cushion hulls and takes their actual encoded AABBs; it also includes every supplied remaining source static AABB. These are **conservative finite-geometry broad-phase enclosures**, not infinite rails or a closest-feature substitute. Actual source fixtures include all four hulls and eleven remaining statics. Sphere-expanded swept boxes must separate from every obstacle and every other body's swept box. Finite cloth footprint is checked separately. A possible overlap, even one that a tighter query could clear, returns `NEEDS_EVENT`; no known-contact exemption exists. Solved touching pairs must be revalidated by a future release proof, not dropped.

Caller obligation: the immutable asset roster must be complete for its scene. The API validates the four distinct encoded hulls and all supplied boxes, not the identity/completeness of arbitrary forged scene declarations.

## Nominal versus strict diagnostics

Persistent incoming kinetic radius `rho`, independent position errors and normal-spin error are retained. The rolling family is nonexpansive in its joint kinetic norm. A conservative position diagnostic grows by `ceil(h*rho)` plus endpoint packing error; tangent velocity radius remains `rho`, tangent spin component radius is `ceil(sqrt(5/2)*rho)`. Normal-spin signed clamp is nonexpansive and retains its error. These diagnostics assume the incoming family is already supported rolling/rest (the bridge's all-state stop premise), not a generic six-dimensional box.

The original five caller budgets are tested unchanged. A nominal clear tail can finish even if these strict diagnostic budgets are exceeded. `strictBudgetWithin` and `strictSweptClear` are independent diagnostic flags; neither certifies actual physical rest. `physicalRestCertified` is always false, including nominal zero endpoints with positive incoming radius. No radius is reset and no global propagated-impact proof is claimed. Incoming uncertainty and source state remain in every output.

## Bounded arithmetic and ABI

Q24 position/v/q/K/S; **new** Q20 tail clock, at most 64 seconds (`67,108,864` ticks), configurable downward in the scene. This does not widen the existing ballistic or polynomial horizon. Position components remain within ±4; exact shared norm admission is |v|≤8 and |q|≤16 (no clipping); K/S within [0,4], radius [4096/Q,1], incoming errors/rho and budgets at most Q/16. Missing drag with nonzero corresponding motion, excessive stop time, displacement outside position range, or arithmetic exhaustion stays incomplete. No elapsed-time wrapping or forced rest is allowed.

Input32/body: `0 id, 1 mode(0/3), 2 R, 3 K, 4 S, 5 rho, 8..14 [px,pz,vx,vz,qx,qz,qy], 16/17 position errors, 18 normal-spin error, 20..24 [epX,epZ,ev,eq,eqy] budgets`; reserved words zero. Raw integer guards precede typed narrowing. Scene176: version, box count, max ticks, cloth top/footprint, then up to20 eight-word bounds/identity/kind records.

Output272: header16 then four64-word body slots. Header `0 version,1 status,2 reason/obstacle kind,3 obstacle/body index,4 common stop-upper time,5 strict-budget flag,6 strict-inflated-clear flag,7 physical-rest authority(0),8 body count,9 common-clock advance applied`.

Status1 = nominal clear rest; 5 = incomplete (reason1 zero drag,2 clock/arithmetic,3 endpoint range); 6 = `NEEDS_EVENT` (kind1 hull,2 static,3 finite cloth,4 pair). On failure endpoint fields are **proposals only**, not advanced states: header9 is zero. Source bytes are retained.

Body64: `0 id,1 rolling stop upper,2 normal-spin stop upper,3 proposal ready,6/7 endpoint position packing errors,8..14 proposed final state,16..21 whole-path XYZ box,22 position growth,23/24 propagated position errors,25 retained rho,32..63 original input`.

One GPU invocation handles the bounded full roster; no per-candidate host physics, no intermediate readback. CPU is the integer mirror. Scene and rows are synchronously copied before awaits; SharedArrayBuffer is rejected. Exported WGSL is available for trusted resident composition; direct callers must enforce the same input contract.

## Tests

`tests/deterministic-rolling-tail.mjs` uses actual source meshes and static bounds. Independent analytic stopping time/distance cover twelve azimuths, normal spin, different per-body stopping times/common clock, wall/pair obstruction, unvalidated touching contact, zero drag, bounded clock, strict budget exceeded with nominal completion, invalid modes/linked identities and ownership. Native test compares every output word and mutates original scene/rows during async setup/run.

Checkpoint native receipt: 5/5 tests, 22 cases, 5,984 output words exact; compile 0.428s, suite 1.065s. The trusted `rollingTailBodyFromBridge(packet,radius)` adapter carries accepted joint-ball bridge endpoint/K/S/errors/budgets unchanged. The recorded actual SMT2 bridge endpoint stops nominally in about 1.856s; its retained rho12,200 causes the unchanged strict budget diagnostic to fail, correctly without preventing a nominal clear-tail result.

Domain follow-on: tail input validation now uses the shared exact velocity/spin norm predicates rather than a hidden4m/s component gate. Existing analytic and conservative exclusion behavior is unchanged; long displaced endpoints outside the unchanged4m position domain still remain incomplete.

After shared-domain admission update: native tail6/6,24 cases/6,528 words exact, compile0.370s; combined partial/tail9/9 with no skips. The former22-case canonical results remain word-identical, with two new high-domain cases covering separate position-range incompleteness and pure normal-spin16 termination.

Private resident composition guard: the WGSL entry returns without touching output for an empty roster or radius0 in its first row. Trusted recurring builders use all-zero inactive rows to preserve the last active receipt. Public host validation continues to reject empty/zero-radius inputs; this is not a new physical input profile.
