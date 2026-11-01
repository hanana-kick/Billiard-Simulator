# Canonical integer transport — source-only WIP checkpoint (2026-11-01)

This backup preserves experimental source, tests, and development packing/probe tools. It does not activate a new engine, change the default backend, publish build assets, or deploy the application. Existing release/build pins remain historical; they do not qualify this new source checkpoint.

- Compiler changes preserve typed integer storage and atomic operations. Experimental transport, authenticated program loading, owner lifecycle and resident scheduler sources are included.
- The new resident scheduler has HOST-only contract evidence. It has not completed real GPU qualification or whole-application validation.
- The earlier W46 12-case software-GPU comparison passed; this is limited comparison evidence, not full-search or whole-app success.
- At this checkpoint, the separate genuine full N1 GPU run remains pending. No completion, result equivalence, full physical-rest success or performance target is claimed.
- The owner-core reentrant disposal fix defers cleanup until the active run receipt is published and drained. The narrow owner host test set was reported as 36 passing tests; this is not native/browser qualification.
- Development probes and packing tests may depend on immutable local `/tmp` fixtures. Those fixtures, generated reports, giant buffers, native binaries and dependencies are deliberately not included. These tools are not a portable production build pipeline.
- No tests, build, native execution, deployment or workflow dispatch were performed to create this backup. The commit explicitly skips CI. Existing workflow files and release assets are unchanged.

Production adoption still requires independent artifact provenance, real GPU scheduler qualification, final N1 readback verification, and full application/physics/browser validation. Preserve the existing running experiment independently of this source backup.
