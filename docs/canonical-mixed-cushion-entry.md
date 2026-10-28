# Original-motion finite-cushion admission

`deterministic-mixed-cushion-entry.mjs` uses the original REST/SMT2/FLIGHT descriptors
for all timing and geometry. Four actual finite convex hulls replace their broad
AABB records in the complete chronological ledger; body pairs, other statics and
cloth records remain competing events. A first AABB overlap is not a collision.

Admission requires a strictly exterior lower state, a uniquely qualified finite
feature at the upper state, strictly inward normal velocity over the interval,
bounded penetration, and every competing unresolved object strictly later.
Uncertain feature normals, ties, earlier cloth/pairs, overflow or exhausted work
remain uncommitted. All bodies are sampled at the same original upper time.

Only after admission is the selected body's sampled full p/v/q placed in an
instantaneous (dt=0) contact packet. This packet is not a refitted SMT2 trajectory.
The existing coupled cushion/cloth impulse algebra runs unchanged, including real
contact arm, interval point/normal errors, iteration and residual limits. The old
`runCushionResponseCPU` retains its original admission and delegates only the
unchanged post-admission numerical body to `solvePreparedCushionImpulseCPU`.
The latter is a numerical helper, not independent physical admission authority.

Actual nose fixture: unique EDGE feature, root23774..23776 ticks, penetration74 Q24
quanta; coupled cloth solver22 iterations, residual56. Full q and normal spin are
retained. A response failure does not become a committed state. Output state8 means
an admitted response requiring world continuation, not REST or a gameplay score.

Resident encoding from `createMixedCushionEntryGPU(device, material)`:
Use `packMixedCushionConfig(rows, scene, rail, material)` for each immutable
32-word material/config buffer; it validates integer budgets before packing.

1. Index0: original rows, world scene, query config, broad ledger.
2. Index1 per hull: rows, actual hull, query config, per-hull time subview; n lanes.
3. Index2: broad ledger, concatenated hull times, [n,staticCount], refined ledger,
   entry128 and advanced160 outputs.
4. Index3 per hull: rows, hull, refined ledger, material config, entry,
   packet192 and advanced outputs. Only the selected hull writes admission.
5. Index4 unchanged response: packet motion view(offset0,size64B), response-state
   view(offset256,size128B), admission view(offset512,size256B), response128.
6. Index5: entry, advanced, response, state160.

The standalone method performs12 dispatches and one final diagnostic readback.
It does not publish world contacts or apply a world recurrence: the owning runner
must commit state, rebuild the motion law, and append an authoritative cushion event.

Recovered completed native run: four cases,10048 exact CPU/WGSL words,1/1 targeted
native test passed; compilation38.129s. Fixtures include the admitted edge, earlier
pair, earlier cloth and clear path. CPU tests also check work/normal-error refusal
and reject fractional or wrapped material budgets before integer packing.
SwiftShader software Vulkan timings are not physical GPU performance claims.
