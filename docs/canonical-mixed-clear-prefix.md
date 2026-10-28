# Original-descriptor proved-clear prefix

`deterministic-mixed-clear-prefix.mjs` advances a positive, all-object-proved-clear
interval from the existing mixed-motion ledger. It does not admit a collision and
never converts a work-budget failure into one. The common duration is ledger word11,
which is the minimum proved-clear prefix over every pair, hull/static bound, cloth
and regime record. A commit requires query status6 and 0 < duration < horizon.

Every body's p/v/q is sampled from its original REST/SMT2/FLIGHT descriptor. The
original SMT2 duration and polynomial coefficients are retained, including full
normal spin. It returns the existing 160-word advanced layout plus a 256-word
whole-prefix dense receipt. This is a declared canonical-local step; accumulated
global physical enclosure is not claimed. No contact or rule event is fabricated.

The preserved raw fixture previously had local position uncertainty about83 Q24
quanta: the first fully-inside pair sample penetrated77 quanta, exceeding the
unchanged64-quanta budget. Advancing the proved-clear2513 ticks, then rebuilding
an actual64-tick local solve from the full sampled state qualifies the pair without
changing that budget. The caller owns progress/work/deadline accounting and must
not loop without a positive committed duration.

CPU API: `runMixedClearPrefixCPU(packet, scene, options)`.
GPU API: `createMixedClearPrefixGPU(device)`; `encode(encoder,index,buffers)`:

- 0: original descriptor rows, scene, 2-word query config, 1056-word query output.
- 1: rows, query, 160-word advanced output, 256-word dense output.

The standalone `run` method reads all diagnostics only at the end. Resident
integration may bind the same outputs directly to the world commit stage.

Recovered completed native test: five cases,7360 exact CPU/WGSL words,1/1 targeted
native test passed; shader compilation26.754s. These are SwiftShader software
Vulkan measurements, not hardware throughput. Tests include original raw full-state
advancement, shorter-solve admission, clear-world no-op and insufficient-work refusal.
