# Qualified original-descriptor mixed pair entry

`deterministic-mixed-pair-entry.mjs` is an opt-in resident composition, not a world loop or release migration.

CPU `runMixedPairEntryCPU(descriptors, scene, queryOptions, material)` recomputes the complete mixed-world chronological ledger. It admits only an equal-sphere pair with:

- strictly clear lower endpoint;
- strictly overlapping upper endpoint within the original accepted horizon, found in a bounded extension of at most 256 ticks;
- overlap no greater than the explicitly declared budget;
- strictly approaching interval relative radial velocity;
- every other pair, actual wall/static obstacle, finite cloth edge, and landing boundary strictly later than the chosen upper endpoint.

Tangencies, initial touching/overlap, uncertain ordering, earlier cloth/walls, missing law descriptors, and exhausted work remain unresolved. Array order does not break simultaneous contacts. All bodies advance to the same selected time. Full p/v/q is sampled from the **original** accepted SMT2 six-component polynomial, with original qy drag, or the original ballistic reference. The accepted horizon is never repacked or re-integrated to manufacture entry. Original mass and cloth identity must match. The unchanged 3D contact solver receives actual full state and cloth-contact mask derived from the actual endpoint gap, not an unconditional two-body support mask.

The response only changes selected bodies. Their mode and previous receipt are invalidated for rebuilding. The result retains `continuationPending:true` and `postImpactReceiptValid:false`; no physical global envelope or gameplay PASS is asserted.

## Resident interface

`createMixedPairEntryGPU(device, material)` exposes `encode(encoder,index,buffers,count)` with stages:

0. mixed query: descriptors, scene, queryConfig, query;
1. samples: descriptors, query, materialConfig, sampleCache; dispatch `11*bodyCount`;
2. entry: descriptors, scene, query, materialConfig, sampleCache, entry, contacts, advanced;
3. unchanged 3D contact: contacts, response;
4. unchanged pair merge: entry, advanced, response, state.

Sizes in words: query1056, samples `11*bodyCount*128`, entry128, contacts64, advanced160, response128, state160. Query config is `[horizonTicks,maxNodes]`; material config uses `packRollingPairEntryConfig`. The public `run` wrapper is diagnostic; runtime can bind resident descriptor output directly without CPU physics or intermediate readback. `advanced`/`state` body layout matches the existing rolling pair adapter.

The mixed descriptor producer now also retains original mass at17 and qy drag at50. It must receive the accepted precommit prefix, not a rebased endpoint. Existing solved-contact separation/release is still required before querying again; the new query intentionally does not ignore an initially touching pair.

## Validation

2026-10-27 frozen-source native run: **11/11 passed**, eight entry cases totaling **13,568 literal CPU/WGSL words**, plus query regression **14,112 words**. Positives include original SMT2 pair entries, genuine FLIGHT-to-supported-sphere entry, and a four-body roster. Negatives include clear broadphase false positives, earlier cushion, earlier landing, overlapping pair-time intervals, work cap, mass mismatch, and cloth mismatch. Normal spin and unchanged other-body identity are checked.

SwiftShader software Vulkan only: entry compilation10.255s, query compilation6.517s; bounded process17.662s, sampled aggregate RSS733.05MiB, maximum child RSS695.80MiB. These are not hardware throughput/VRAM measurements. No default switched or external publication performed.

### Admission hardening checkpoint

Subsequent independent review closed forged admission flags/laws, accepted SMT2 material mismatch (F/K/qy drag), REST/support state invariants, and potential unchecked relative-position overflow. Geometry now rejects intervals outside the canonical position ±4m and per-component velocity ±8m/s domain *before* differences; a coefficient-extreme regression must remain unsupported on both backends. Descriptor preparation preserves original row material rather than silently adopting a mismatched context.

Final hardening native run: 13/13 passed; 17,520 descriptor/query words (seven producer cases plus extreme ledger) and 13,568 entry words, **31,088 exact words total**. Query compilation26.341s, entry28.837s, bounded process55.976s; sampled aggregateRSS703.60MiB, maximumchildRSS664.36MiB. Timings are software compiler/run measurements, not hardware throughput.

`advanced[16+slot*32+14] == 1` denotes a valid canonical sampled state only. Zero diagnostic-error slots are not certified zero physical uncertainty. Returned `postImpactReceiptValid:false` and `continuationPending:true` remain authoritative; the world must explicitly reclassify states at the new canonical anchor.
