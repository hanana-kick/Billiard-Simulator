# Cold live-world shader source pruning

The live-world lowering now runs the existing `linkResidentWGSL` linker before
exact-source interning. It removes functions outside `main`'s transitive call
closure. It retains complete function declarations verbatim, all global
bindings/declarations, and compute attributes. It does not fuse dispatches,
change execution order, alter numerical operations, or remove a runtime branch.

CPU-generated MMQ2 N1 atomic-per-access world recipe:

| Measure | Before | After |
| --- | ---: | ---: |
| Unique world pipelines | 104 | 104 |
| Emitted WGSL bytes | 1,014,818 | 818,533 |
| Unreachable function declarations removed | — | 631 |

The source reduction is 196,285 bytes (19.34%). The separate seven raw pipelines
and result gate are unchanged: total cold pipeline count remains 112. This is a
shader-input reduction, **not** a reduction in executed physical calculations,
a measured compilation speedup, or a device-loss fix. Drivers may already
eliminate unreachable functions internally.

`experimental-live-world-shader-pruning.mjs` independently rebuilds pre-link
variants and verifies complete retained function bytes and the reachable name
set, storage bindings, compute attributes, dispatch bounds, and definition count
for MMQ2 N1/N3 with both fault publication policies. Existing capture, upload,
resource and mock pipeline tests cover graph and ownership contracts.

No native/GPU tests were run (user exclusion). Changed recipe source identities
invalidate previous exact-source receipts. The build seal must be independently
reviewed and refreshed through the normal owner; this change does not refresh it.
