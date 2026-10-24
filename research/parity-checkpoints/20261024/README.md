# CPU/GPU parity source checkpoint — partial, unvalidated

This backup-only checkpoint preserves recovered experimental source and tests. It is not a product release, a complete engine, or evidence that CPU/GPU whole-shot parity is achieved. Production code is unchanged.

- `free-body/`: recovered initial source and tests, plus ordered source/test patches. The patches have not been reapplied or revalidated in this checkpoint.
- `cue/`: six ordered source-construction fragments for fresh cylinder/cuboid manifolds. They require the missing exact `experimental-cue-obstacle-contact.js` implementation. Convex-hull manifold equivalence is not established.
- `world/`: contact-birth source/test patches requiring the missing prior world-island implementation and its dependencies. These additions were not validated.
- The singleton sleep test is present, but its implementation is missing.

Missing dependencies include the shared arithmetic graph and WGSL runtime, native pinned snapshot decoder/exporter, contact/constraint kernels, query implementation, and recurrent world-loop base. No executable complete project can be assembled from these fragments alone. Every reconstructed module must be checked again against the unchanged authoritative Rapier engine, including actual GPU execution where available. Prior test results do not certify these recovered bytes.

Source basis: Rapier revision `b716d375efc0201003f0cd9ef7168eee0b62c177`, Parry3d 0.31.1. Preserve Apache-2.0 notices and `vendor/RAPIER-LICENSE.txt`; quaternion arithmetic has glam MIT/Apache-2.0 provenance as noted in source. This branch must not be merged or deployed as-is.
