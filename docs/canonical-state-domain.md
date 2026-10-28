# Canonical v8/q16 encoded-state domain

This is an explicit integer admission contract, not a theorem that the discrete
solver conserves energy for every shot. It does not change production defaults.

- `p`, `v`, and `q=Rω` remain Q24; time remains Q20.
- Linear state is admitted iff its **exact encoded Euclidean norm** is at most
  `8 * 2^24`; surface-spin norm is at most `16 * 2^24`.
- `deterministic-state-domain.mjs` compares sums of unsigned two-word Q48 squares.
  Components are checked before absolute values, including rejection of INT_MIN.
  There is no floating-point norm, square-root rounding, saturation, or clipping.
- Position limits remain local: generally ±4, ±8 for prepared contact geometry.
  Material coefficients, force/rate caps, impulse caps, time horizons, geometric
  corrections, solver budgets, and uncertainty budgets are unchanged.
- The directional input remains a declared collinear invariant family, not a
  projection/import path for arbitrary raw `v/q` or nonzero normal spin.
- Landing retains `|vy|≤1`, gap≤1/8, gravity≤16, and the existing finite horizon.
  A generic v8 state does not broaden the shifted two-word ballistic root proof.

## Arithmetic

The original raw-strike `deterministic-contact-math.mjs` is deliberately unchanged
because its owner has a separately compiled checked arithmetic path. Widened
consumers use `deterministic-checked-contact-math.mjs`: checked dot/cross and
integer additions, INT_MIN refusal, and checked nonnegative cone multiplication.
Contact effective-mass and impulse updates and tube polynomial/dot accumulations
use mirrored checked operations. Numeric failures produce explicit unsupported
packets; tube ratio failure does not become a host exception.

With real unit-arm Jacobians, v8/q16 norm bounds give a two-body row dot bound of
approximately 48 in Q24, and target-minus-dot approximately 96, leaving headroom
under the signed Q24 ceiling of approximately 128. Checked sums remain the final
numeric guard, including rounded geometry and intermediate solver iterates.

### Smooth normalized derivative

The old formula stores `norm²` as signed Q24, which fails above approximately
`sqrt(128)=11.313708`. Merely increasing a state limit would not fix that.

The original fast path is unchanged when the sum-of-coefficient magnitude vector
has Q48 norm-squared at most `120 * Q²`. This also bounds every cross-polynomial
partial sum, with rounding headroom. Otherwise the new path chooses a power of
two and replaces each coefficient by the outward interval
`[floor(coefficient/divisor), ceil(coefficient/divisor)]`. It applies interval
products to the polynomial and to `cross(v0,v1) + 2t cross(v0,v2) + t² cross(v1,v2)`.

The scale is chosen so each axis's total coefficient magnitude is at most 7Q.
For `0≤t≤1`, squared vector norms and the absolute cross-polynomial bound are then
at most 98Q, well below signed-Q24 capacity even after integer rounding.
Normalized derivatives are invariant under this common positive scale; all
removed low bits widen the certificate, never alter the canonical physical state.
Zero-containing norm intervals remain unsupported. The normalized-derivative
cap4, residual cap8, and all original certificate budgets remain unchanged.

## Evidence and scope

The diagnostic raw-strike sweep has 1,080 inputs, 921 admitted raw outputs, and
195 admitted outputs exceeding the previous component4 downstream gates. Its
maximum admitted planar slip norm is 8.919873. These observations do not prove a
maximum over the continuous cue domain. Three actual strong-strike witnesses are
stored with exact encoded words, diagnostic inputs, source scene and artifact hash,
then imported unchanged by the stable tests. The stable tests do not import the
experimental raw-strike module.

`tests/deterministic-state-domain.mjs` checks exact norm boundaries ±1 quantum,
INT_MIN, offset views, a BigInt square oracle, unchanged position/material caps,
checked accumulation failures, large-norm odd-signed coefficient enclosures,
actual raw witnesses, and all words of eight pre-change accepted smooth fixtures.
`tests/deterministic-state-gates.mjs` exercises full contacts, directional family
guards, tube failure packets, landing commits, and the planar compatibility bridge.
`tests/deterministic-geometry-state-domain.mjs` covers geometry-wrapper admissions,
advanced-state vetoes, retained ballistic restrictions, and old output hashes.

Native tests compare all integer output/status/receipt words. Software Vulkan
parity evidence is not a hardware performance claim or a proof over every device.

Run the bounded stable checkpoint with `npm run test:canonical-state-domain`.
Native execution is opt-in via the established `REQUIRE_WEBGPU=1` and native
module/ICD environment; CPU-only runs explicitly report skipped native tests.

## Final checkpoint (2026-10-27)

- Scoped CPU run: 58 passed, 15 explicitly skipped native cases, zero failures.
- All 15 native regressions passed on their final kernels across bounded serial
  runs, comparing at least 155,714 integer words (states, statuses and receipts).
  This was not one uninterrupted green aggregate invocation.
- Branchy checked additions initially triggered compiler timeouts/a child
  termination. Equivalent branchless guards resolved both contact and tube
  compilation; the affected complete suites were rerun successfully.
- Independent review checked 100,000 signed add pairs and 8,712 analytic derivative
  samples. Eight pre-edit smooth fixtures still match every encoded word.
- Machine-readable source hashes, per-suite receipts and limitations are in
  `artifacts/canonical-state-domain/native-checkpoint.json`.
