# Shared GPU-canonical contact arithmetic

`deterministic-contact-math.mjs` exports `createContactMath`,
`CONTACT_MATH_WGSL`, and `CONTACT_MATH_VERSION=0x43334d01`.
The formulas were extracted unchanged from the existing 3D contact component:

- Q24 nearest signed multiply/divide using two-word products/division.
- Exact ceil integer norm, exact square check, cross/dot primitives.
- Unit-vector normalization first rescales by exact powers of two; it does not
  discard short-vector direction precision.
- Strict two-component coefficient-disk projection and downward material products.
- Sticky arithmetic failure and multiplication/division/norm work counters.

This is a low-level shared kernel, **not an input validator**. Callers must admit
integer, non-INT_MIN operands within their established vector/sum ranges before
using it, check the sticky failure flag, and bound resulting states/impulses.
The 3D and static-cushion response modules retain their separate domain guards.
WGSL exports private failure/counter variables and functions; importing kernels
own their contact/Jacobian arrays, so no pair-specific state leaks into static
response. `normalizeContactDirectionCPU` remains exported by contact-3d unchanged.

Extraction receipt: existing native 3D contact suite **5/5 passed**, 70 fixtures /
8,960 output words exactly CPU/GPU identical; shader 8,754 bytes, compile about
1.82 s in this software-GPU observation. CPU directional/bridge regression also
passed (7 tests, two native-only tests skipped in that separate CPU run).
No input/output ABI, physical law, normalization rounding or production default
changed. This receipt is component parity, not full-shot physical qualification.
